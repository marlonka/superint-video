use crate::{
    media,
    model::{ClipType, Manifest},
    process,
    project::{ProjectSnapshot, safe_path},
    server,
};
use anyhow::{Context, Result, bail};
use chromiumoxide::{
    Browser,
    browser::BrowserConfig,
    cdp::{
        browser_protocol::page::{CaptureScreenshotFormat, CaptureScreenshotParams},
        js_protocol::runtime::EvaluateParams,
    },
    error::CdpError,
    handler::viewport::Viewport,
    page::{Page, ScreenshotParams},
};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    path::{Path, PathBuf},
    process::Stdio,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::io::AsyncWriteExt;
use tokio_util::sync::CancellationToken;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub id: String,
    pub status: String,
    pub stage: String,
    pub completed: u64,
    pub total: u64,
    pub output: String,
    pub error: Option<String>,
}
pub type ProgressFn = Arc<dyn Fn(&str, u64, u64) + Send + Sync>;
/// Sees each finished PNG on its way to the encoder.
pub type FrameFn = Arc<dyn Fn(u64, &[u8]) + Send + Sync>;

pub struct Capture {
    browser: Browser,
    pub page: Page,
    handler: tokio::task::JoinHandle<()>,
    _profile: tempfile::TempDir,
    preview: server::PreviewHandle,
    pid: Option<u32>,
}
impl Capture {
    pub async fn open(root: PathBuf, manifest: Manifest) -> Result<Self> {
        let preview = server::start_preview(root, Some(manifest.clone()), None).await?;
        let profile = tempfile::Builder::new()
            .prefix("superint-chrome-")
            .tempdir()?;
        let config = BrowserConfig::builder()
            .chrome_executable(process::chrome()?)
            .user_data_dir(profile.path())
            .new_headless_mode()
            .window_size(manifest.width, manifest.height)
            .viewport(Viewport {
                width: manifest.width,
                height: manifest.height,
                device_scale_factor: Some(1.0),
                ..Default::default()
            })
            .launch_timeout(Duration::from_secs(30))
            .request_timeout(Duration::from_secs(45))
            .args([
                "--force-color-profile=srgb",
                "--disable-background-networking",
                "--disable-component-update",
                "--disable-sync",
                "--no-first-run",
                "--mute-audio",
                "--disable-renderer-backgrounding",
                "--disable-background-timer-throttling",
            ])
            .build()
            .map_err(anyhow::Error::msg)?;
        let (mut browser, mut handler) = Browser::launch(config)
            .await
            .context("Could not launch rendering browser")?;
        let pid = browser.get_mut_child().and_then(|c| c.inner.id());
        let handler = tokio::spawn(async move {
            while let Some(result) = handler.next().await {
                if result.is_err() {
                    break;
                }
            }
        });
        let result = async {
            let page = browser
                .new_page(format!("{}/player.html?capture=1", preview.url))
                .await?;
            eval(
                &page,
                "(async()=>{await window.__superint.ready;return window.__superint.getState()})()",
            )
            .await?;
            Ok::<Page, anyhow::Error>(page)
        }
        .await;
        match result {
            Ok(page) => Ok(Self {
                browser,
                page,
                handler,
                _profile: profile,
                preview,
                pid,
            }),
            Err(error) => {
                if let Some(pid) = pid {
                    process::kill_tree(pid).await;
                }
                let _ = browser.kill().await;
                handler.abort();
                preview.stop();
                Err(error)
            }
        }
    }
    pub async fn frame(&self, frame: u64) -> Result<Vec<u8>> {
        Ok(self.frame_state(frame, false).await?.0)
    }
    /// Seek and capture one frame; returns the image (PNG, or JPEG for measuring only) and the
    /// player state of that frame, which carries the actors the scenes reported.
    pub async fn frame_state(&self, frame: u64, jpeg: bool) -> Result<(Vec<u8>, Value)> {
        let seek = format!(
            "(async()=>{{await window.__superint.seek({frame});return window.__superint.getState()}})()"
        );
        let state = eval(&self.page, &seek)
            .await
            .with_context(|| format!("Frame {frame} failed"))?;
        if state["errors"].as_array().is_some_and(|e| !e.is_empty()) {
            bail!("Runtime frame {frame}: {}", state["errors"]);
        }
        // optimizeForSpeed keeps PNG lossless but compresses lightly: 1080p frames with grain took
        // ~560 ms each at Chrome's default level and ~170 ms with it, the same pixels.
        let cdp_params = if jpeg {
            CaptureScreenshotParams::builder()
                .format(CaptureScreenshotFormat::Jpeg)
                .quality(80)
        } else {
            CaptureScreenshotParams::builder()
                .format(CaptureScreenshotFormat::Png)
                .optimize_for_speed(true)
        };
        let params = ScreenshotParams {
            cdp_params: cdp_params.build(),
            full_page: Some(false),
            omit_background: None,
        };
        let image = self.page.screenshot(params).await?;
        Ok((image, state))
    }
    pub async fn close(mut self) {
        let _ = tokio::time::timeout(Duration::from_secs(3), self.browser.close()).await;
        if let Some(pid) = self.pid
            && self.browser.try_wait().ok().flatten().is_none()
        {
            process::kill_tree(pid).await;
        }
        let _ = self.browser.kill().await;
        self.handler.abort();
        self.preview.stop();
    }
}
pub async fn eval(page: &Page, expression: &str) -> Result<Value> {
    let params = EvaluateParams::builder()
        .expression(expression)
        .await_promise(true)
        .return_by_value(true)
        .build()
        .map_err(anyhow::Error::msg)?;
    let answer = tokio::time::timeout(Duration::from_secs(45), page.evaluate(params))
        .await
        .context("Scene readiness timed out")?;
    match answer {
        Ok(value) => Ok(value.into_value()?),
        Err(CdpError::JavascriptException(details)) => {
            let said = details
                .exception
                .as_ref()
                .and_then(|thrown| thrown.description.as_deref())
                .unwrap_or(&details.text);
            bail!("{}", plain_exception(said))
        }
        Err(error) => Err(error.into()),
    }
}

/// What the page threw, in its own words: without the browser's wrapping, the player's own
/// stack and the preview server's address, so a project file reads as its path.
fn plain_exception(said: &str) -> String {
    let said = said.strip_prefix("Uncaught (in promise) ").unwrap_or(said);
    let said = said.strip_prefix("Error: ").unwrap_or(said);
    said.lines()
        .filter(|line| {
            !(line.trim_start().starts_with("at ") && line.contains("/runtime/player.js"))
        })
        .map(without_server)
        .collect::<Vec<_>>()
        .join("\n")
}

fn without_server(line: &str) -> String {
    const SERVER: &str = "http://127.0.0.1:";
    let (mut plain, mut rest) = (String::new(), line);
    while let Some(at) = rest.find(SERVER) {
        plain.push_str(&rest[..at]);
        let path = rest[at + SERVER.len()..].trim_start_matches(|c: char| c.is_ascii_digit());
        rest = path.strip_prefix("/asset/").unwrap_or(path);
    }
    plain + rest
}

/// Video codecs `render` can write. x265 (HEVC) is the default: about half the file size of x264
/// at the same look; x264 (H.264) plays everywhere, also where HEVC needs an extension.
pub const CODECS: [&str; 2] = ["x265", "x264"];
pub const DEFAULT_CODEC: &str = "x265";

/// Browsers that capture in parallel by default. Chrome's PNG encoding is CPU-bound; half the
/// logical cores measured best (8 on a 16-thread CPU), more only queue for the same cores.
pub fn default_workers() -> usize {
    std::thread::available_parallelism()
        .map_or(1, |n| n.get() / 2)
        .clamp(1, 8)
}

#[allow(clippy::too_many_arguments)]
pub async fn render(
    snapshot: ProjectSnapshot,
    output: PathBuf,
    quality: &str,
    codec: &str,
    overwrite: bool,
    master: Option<PathBuf>,
    workers: Option<usize>,
    cancel: CancellationToken,
    progress: ProgressFn,
) -> Result<Value> {
    render_watched(
        snapshot, output, quality, codec, overwrite, master, workers, cancel, progress, None,
    )
    .await
}

/// `render`, and every finished frame also passes `watch` (Studio's live picture).
#[allow(clippy::too_many_arguments)]
pub async fn render_watched(
    snapshot: ProjectSnapshot,
    output: PathBuf,
    quality: &str,
    codec: &str,
    overwrite: bool,
    master: Option<PathBuf>,
    workers: Option<usize>,
    cancel: CancellationToken,
    progress: ProgressFn,
    watch: Option<FrameFn>,
) -> Result<Value> {
    if !snapshot.manifest.width.is_multiple_of(2) || !snapshot.manifest.height.is_multiple_of(2) {
        bail!("MP4 export requires even width and height; adjust project dimensions");
    }
    if !CODECS.contains(&codec) {
        bail!("Codec must be one of {}", CODECS.join(", "));
    }
    if cancel.is_cancelled() {
        bail!("cancelled");
    }
    if output.exists() && !overwrite {
        bail!("Output exists; choose another name or pass --overwrite");
    }
    let errors = media::validate_media(&snapshot.root, &snapshot.manifest).await;
    if !errors.is_empty() {
        bail!("Media validation failed: {}", json!(errors));
    }
    let parent = output
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    std::fs::create_dir_all(parent)?;
    let work = tempfile::Builder::new()
        .prefix(".superint-render-")
        .tempdir_in(parent)?;
    let video = work.path().join("video.mp4");
    let final_path = work.path().join("complete.mp4");
    let total = snapshot.manifest.duration_frames;
    let started = Instant::now();
    progress("Preparing browser", 0, total);
    // Every frame is a pure function of time, so browsers can capture disjoint frames side by side.
    let workers = workers
        .unwrap_or_else(default_workers)
        .clamp(1, total.max(1) as usize);
    let opened = futures::future::join_all(
        (0..workers).map(|_| Capture::open(snapshot.root.clone(), snapshot.manifest.clone())),
    )
    .await;
    let mut captures = Vec::new();
    let mut failure = None;
    for result in opened {
        match result {
            Ok(capture) => captures.push(capture),
            Err(error) => failure = failure.or(Some(error)),
        }
    }
    if let Some(error) = failure {
        futures::future::join_all(captures.into_iter().map(Capture::close)).await;
        return Err(error);
    }
    let browser_version = captures[0]
        .browser
        .version()
        .await
        .map(|v| v.product)
        .unwrap_or_default();
    let result = async {
        let manifest = &snapshot.manifest;
        encode(
            &captures,
            manifest,
            &video,
            quality,
            codec,
            &cancel,
            &progress,
            watch.as_ref(),
        )
        .await?;
        progress("Mixing audio", total, total);
        match &master {
            Some(master) => mux(manifest, &video, master, &final_path, &cancel).await?,
            None => mix(&snapshot, &video, &final_path, &cancel).await?,
        }
        progress("Verifying output", total, total);
        let verified = verify(&final_path, manifest).await?;
        // Every film has a soundtrack, a silent one when nothing is to be heard (see `mix`).
        let has_audio = verified["streams"]
            .as_array()
            .is_some_and(|s| s.iter().any(|s| s["codec_type"] == "audio"));
        if !has_audio {
            bail!("The export has no audio stream");
        }
        let loudness = crate::mix::measure(&final_path).await?;
        if cancel.is_cancelled() {
            bail!("cancelled");
        }
        if output.exists() && !overwrite {
            bail!("Output appeared during render; refusing overwrite");
        }
        let byte_count = tokio::fs::metadata(&final_path).await?.len();
        let mut prepared = tempfile::NamedTempFile::new_in(parent)?;
        std::io::copy(
            &mut std::fs::File::open(&final_path)?,
            prepared.as_file_mut(),
        )?;
        prepared.as_file_mut().sync_all()?;
        if overwrite {
            prepared.persist(&output).map_err(|e| e.error)?;
        } else {
            prepared.persist_noclobber(&output).map_err(|e| e.error)?;
        }
        Ok(json!({
            "output": crate::project::without_verbatim(&output),
            "frames": total,
            "seconds": started.elapsed().as_secs_f64(),
            "workers": workers,
            "codec": codec,
            "fps": manifest.fps,
            "width": manifest.width,
            "height": manifest.height,
            "revision": snapshot.revision,
            "browser": browser_version,
            "bytes": byte_count,
            "audio": loudness,
            "silent": loudness.integrated_lufs <= crate::mix::SILENCE_LUFS,
        }))
    }
    .await;
    futures::future::join_all(captures.into_iter().map(Capture::close)).await;
    result
}

/// Written into every exported MP4, so players and platforms can see how the film was made.
/// Voice and music usually come from generative models; the EU AI Act asks for such content
/// to be recognisable, and the IPTC term is the common machine-readable way to say it.
const PROVENANCE: [&str; 4] = [
    "-metadata",
    concat!(
        "comment=Made with Superint Video (https://github.com/marlonka/superint-video). ",
        "Picture written as code with an AI coding agent; voice and music may be AI-generated. ",
        "IPTC digital source type: compositeWithTrainedAlgorithmicMedia"
    ),
    "-metadata",
    "description=Contains AI-generated or AI-assisted content (Superint Video)",
];

#[allow(clippy::too_many_arguments)]
async fn encode(
    captures: &[Capture],
    manifest: &Manifest,
    path: &Path,
    quality: &str,
    codec: &str,
    cancel: &CancellationToken,
    progress: &ProgressFn,
    watch: Option<&FrameFn>,
) -> Result<()> {
    let fps = format!("{}/{}", manifest.fps.num, manifest.fps.den);
    let draft = quality == "draft";
    // x265 CRF 20 looks like x264 CRF 18 at about half the size; hvc1 lets Apple players open it.
    let encoder: &[&str] = match (codec, draft) {
        ("x264", true) => &["-c:v", "libx264", "-preset", "ultrafast", "-crf", "25"],
        ("x264", false) => &["-c:v", "libx264", "-preset", "fast", "-crf", "18"],
        (_, true) => &[
            "-c:v",
            "libx265",
            "-preset",
            "ultrafast",
            "-crf",
            "28",
            "-tag:v",
            "hvc1",
            "-x265-params",
            "log-level=error",
        ],
        (_, false) => &[
            "-c:v",
            "libx265",
            "-preset",
            "medium",
            "-crf",
            "20",
            "-tag:v",
            "hvc1",
            "-x265-params",
            "log-level=error",
        ],
    };
    let mut cmd = process::command(process::binary("ffmpeg"));
    // Browser pixels are full-range sRGB; the film is limited-range BT.709, tagged as such.
    let colour = concat!(
        "format=gbrp,zscale=matrixin=gbr:transferin=iec61966-2-1:primariesin=709:rangein=full",
        ":matrix=709:transfer=709:primaries=709:range=limited,format=yuv420p"
    );
    cmd.args([
        "-v",
        "error",
        "-nostdin",
        "-y",
        "-f",
        "image2pipe",
        "-vcodec",
        "png",
    ])
    .args(["-framerate", &fps, "-i", "pipe:0", "-an", "-vf", colour])
    .args(encoder)
    .args([
        "-color_primaries",
        "bt709",
        "-color_trc",
        "bt709",
        "-colorspace",
        "bt709",
    ])
    .args(PROVENANCE)
    .args(["-movflags", "+faststart"])
    .arg(path)
    .stdin(Stdio::piped())
    .stdout(Stdio::null())
    .stderr(Stdio::piped());
    let mut child = cmd.spawn().context("Could not start FFmpeg encoder")?;
    let pid = child.id();
    let mut input = child.stdin.take().context("Encoder stdin missing")?;
    let stderr = child.stderr.take().context("Encoder stderr missing")?;
    let mut err_task = tokio::spawn(process::read_diagnostics(stderr));
    let result = async {
        // Browser w captures frames w, w+n, w+2n, … into its own short queue; the writer takes them
        // round-robin, so FFmpeg gets every frame in order and memory stays at two frames a browser.
        let total = manifest.duration_frames;
        let n = captures.len();
        let (senders, mut queues): (Vec<_>, Vec<_>) = (0..n)
            .map(|_| tokio::sync::mpsc::channel::<Vec<u8>>(2))
            .unzip();
        let capturing =
            futures::future::try_join_all(captures.iter().zip(senders).enumerate().map(
                |(w, (capture, queue))| async move {
                    for frame in (w as u64..total).step_by(n) {
                        let png = capture.frame(frame).await?;
                        if queue.send(png).await.is_err() {
                            break;
                        }
                    }
                    anyhow::Ok(())
                },
            ));
        let writing = async {
            for frame in 0..total {
                let png = queues[frame as usize % n]
                    .recv()
                    .await
                    .with_context(|| format!("Frame {frame} was not captured"))?;
                if let Some(watch) = watch {
                    watch(frame, &png);
                }
                input
                    .write_all(&png)
                    .await
                    .context("Encoder stopped receiving frames")?;
                progress("Rendering frames", frame + 1, total);
            }
            anyhow::Ok(())
        };
        tokio::select! {
            _ = cancel.cancelled() => bail!("cancelled"),
            done = futures::future::try_join(capturing, writing) => { done?; }
        }
        input.shutdown().await?;
        drop(input);
        let status = tokio::select! {
            _ = cancel.cancelled() => bail!("cancelled"),
            waited = tokio::time::timeout(Duration::from_secs(60), child.wait()) => {
                waited.context("Encoder finalization timeout")??
            }
        };
        if !status.success() {
            bail!("Encoder exited with {status}");
        }
        anyhow::Ok(())
    }
    .await;
    if result.is_err() {
        if let Some(pid) = pid {
            process::kill_tree(pid).await;
        }
        let _ = child.kill().await;
    }
    let err = match tokio::time::timeout(Duration::from_secs(3), &mut err_task).await {
        Ok(task) => task.context("Encoder diagnostics task failed")??,
        Err(_) => {
            err_task.abort();
            bail!("Encoder diagnostics stream did not close");
        }
    };
    result.with_context(|| format!("FFmpeg: {}", String::from_utf8_lossy(&err)))
}

/// Mixes the audible clips into the film's soundtrack. A film with nothing to hear (no voice,
/// no music, no sound effects) gets a silent stereo track instead of none: a file without an
/// audio stream is refused or flagged by some upload forms, editors and television sets, while
/// a silent track plays everywhere and costs about two kilobits a second.
async fn mix(
    snapshot: &ProjectSnapshot,
    video: &Path,
    output: &Path,
    cancel: &CancellationToken,
) -> Result<()> {
    let manifest = &snapshot.manifest;
    let mut clips = Vec::new();
    for clip in &manifest.clips {
        let track = manifest
            .tracks
            .iter()
            .find(|t| t.id == clip.track)
            .context("Missing track")?;
        if clip.hidden
            || clip.muted
            || track.hidden
            || track.muted
            || !(clip.clip_type == ClipType::Audio
                || (clip.clip_type == ClipType::Video && clip.include_audio))
        {
            continue;
        }
        let path = safe_path(&snapshot.root, &clip.src)?;
        let info = media::probe(&path).await?;
        let audio = info["streams"]
            .as_array()
            .and_then(|s| s.iter().find(|s| s["codec_type"] == "audio"));
        if let Some(stream) = audio {
            clips.push((clip, path, stream["channels"].as_u64() == Some(1)));
        }
    }
    let duration = manifest.fps.seconds(manifest.duration_frames);
    let mut cmd = process::command(process::binary("ffmpeg"));
    cmd.args(["-v", "error", "-nostdin", "-y", "-i"]).arg(video);
    for (_, path, _) in &clips {
        cmd.arg("-i").arg(path);
    }
    let mut filters = Vec::new();
    if clips.is_empty() {
        filters.push(format!(
            "anullsrc=r=48000:cl=stereo,atrim=duration={duration:.9}[mix]"
        ));
    }
    for (i, (clip, _, mono)) in clips.iter().enumerate() {
        let start = manifest.fps.seconds(clip.source_offset_frames);
        let duration = manifest.fps.seconds(clip.duration_frames);
        let delay = (manifest.fps.seconds(clip.start_frame) * 48000.0).round() as u64;
        let mut filter = format!(
            "[{}:a]atrim=start={start:.9}:duration={duration:.9},asetpts=PTS-STARTPTS,aresample=48000,volume={:.9}",
            i + 1,
            clip.gain
        );
        if clip.fade_in_frames > 0 {
            filter += &format!(
                ",afade=t=in:st=0:d={:.9}",
                manifest.fps.seconds(clip.fade_in_frames)
            );
        }
        if clip.fade_out_frames > 0 {
            let fade = manifest.fps.seconds(clip.fade_out_frames);
            filter += &format!(",afade=t=out:st={:.9}:d={fade:.9}", duration - fade);
        }
        // Every clip enters the mix as stereo. A mono file goes to both channels: WAVs that FFmpeg
        // tags "1 channels (FL)" (24-bit mono from `voice assemble`) would otherwise stop the AAC
        // encoder or land on the left only.
        filter += if *mono {
            ",pan=stereo|c0=c0|c1=c0"
        } else {
            ",aformat=channel_layouts=stereo"
        };
        filter += &format!(",adelay={delay}S:all=1[a{i}]");
        filters.push(filter);
    }
    if !clips.is_empty() {
        let labels = (0..clips.len())
            .map(|i| format!("[a{i}]"))
            .collect::<String>();
        let inputs = clips.len();
        filters.push(format!(
            "{labels}amix=inputs={inputs}:normalize=0:duration=longest,apad,atrim=duration={duration:.9}[mix]"
        ));
    }
    cmd.args([
        "-filter_complex",
        &filters.join(";"),
        "-map",
        "0:v:0",
        "-map",
        "[mix]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-ar",
        "48000",
        "-movflags",
        "+faststart",
    ])
    .args(PROVENANCE)
    .arg(output);
    process::output(cmd, cancel, Duration::from_secs(120)).await?;
    Ok(())
}

/// Mux a finished master instead of mixing the clips; padded or cut to the film's length.
async fn mux(
    manifest: &Manifest,
    video: &Path,
    master: &Path,
    output: &Path,
    cancel: &CancellationToken,
) -> Result<()> {
    if !master.is_file() {
        bail!(
            "Audio master {} does not exist; run superint-video mix",
            master.display()
        );
    }
    let duration = manifest.fps.seconds(manifest.duration_frames);
    let mut cmd = process::command(process::binary("ffmpeg"));
    cmd.args(["-v", "error", "-nostdin", "-y", "-i"])
        .arg(video)
        .arg("-i")
        .arg(master)
        .args([
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-af",
            &format!("apad,atrim=duration={duration:.9}"),
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "256k",
            "-ar",
            "48000",
            "-movflags",
            "+faststart",
        ])
        .args(PROVENANCE)
        .arg(output);
    process::output(cmd, cancel, Duration::from_secs(120)).await?;
    Ok(())
}

pub async fn verify(path: &Path, manifest: &Manifest) -> Result<Value> {
    let info = media::probe(path).await?;
    let streams = info["streams"]
        .as_array()
        .context("Export has no streams")?;
    let video = streams
        .iter()
        .find(|s| s["codec_type"] == "video")
        .context("Export has no video stream")?;
    let count = video["nb_frames"]
        .as_str()
        .and_then(|s| s.parse::<u64>().ok())
        .context("Export has no verified frame count")?;
    if count != manifest.duration_frames {
        bail!(
            "Export frame count: expected {}, found {count}",
            manifest.duration_frames
        );
    }
    if video["width"] != manifest.width || video["height"] != manifest.height {
        bail!("Export dimensions differ from project");
    }
    let expected = manifest.fps.seconds(manifest.duration_frames);
    let actual = media::duration(&info).context("Export duration unknown")?;
    if (actual - expected).abs() > 0.1 {
        bail!("Export duration {actual} differs from {expected}");
    }
    let rate = video["avg_frame_rate"]
        .as_str()
        .unwrap_or("")
        .split('/')
        .filter_map(|s| s.parse::<f64>().ok())
        .collect::<Vec<_>>();
    if rate.len() != 2
        || (rate[0] / rate[1] - manifest.fps.num as f64 / manifest.fps.den as f64).abs() > 0.001
    {
        bail!("Export frame rate differs from project");
    }
    Ok(info)
}

pub async fn snapshots(snapshot: ProjectSnapshot, frames: &[u64], output: &Path) -> Result<Value> {
    std::fs::create_dir_all(output)?;
    let capture = Capture::open(snapshot.root.clone(), snapshot.manifest.clone()).await?;
    let result = async {
        let mut files = Vec::new();
        let mut thumbs = Vec::new();
        for &frame in frames {
            if frame >= snapshot.manifest.duration_frames {
                bail!("Snapshot frame {frame} is outside project");
            }
            let bytes = capture.frame(frame).await?;
            let file = output.join(format!("frame-{frame:06}.png"));
            std::fs::write(&file, &bytes)?;
            let thumb = image::load_from_memory(&bytes)?.thumbnail(384, 216);
            thumbs.push((format!("F {frame}"), thumb.to_rgb8()));
            files.push(crate::project::without_verbatim(&file));
        }
        let contact = output.join("contact-sheet.png");
        contact_sheet(&thumbs).save(&contact)?;
        let record = json!({
            "frames": frames, "files": files, "columns": frames.len().clamp(1, 4),
            "revision": snapshot.revision,
        });
        std::fs::write(
            output.join("frames.json"),
            serde_json::to_vec_pretty(&record)?,
        )?;
        Ok(json!({
            "frames": frames, "files": files,
            "contactSheet": crate::project::without_verbatim(&contact),
            "revision": snapshot.revision,
        }))
    }
    .await;
    capture.close().await;
    result
}

/// Thumbnails of 384 × 216 in rows of four, each with its label underneath.
pub fn contact_sheet(thumbs: &[(String, image::RgbImage)]) -> image::RgbImage {
    let columns = thumbs.len().clamp(1, 4) as u32;
    let rows = (thumbs.len() as u32).div_ceil(columns).max(1);
    let mut sheet =
        image::RgbImage::from_pixel(columns * 384, rows * 244, image::Rgb([16, 17, 19]));
    for (i, (text, thumb)) in thumbs.iter().enumerate() {
        let x = i as u32 % columns * 384;
        let y = i as u32 / columns * 244;
        image::imageops::overlay(&mut sheet, thumb, x as i64, y as i64);
        label(&mut sheet, x + 10, y + 222, text);
    }
    sheet
}

// A tiny bitmap label keeps contact sheets self-identifying without host fonts.
fn label(image: &mut image::RgbImage, x: u32, y: u32, text: &str) {
    let digits: [[u8; 5]; 10] = [
        [7, 5, 5, 5, 7],
        [2, 6, 2, 2, 7],
        [7, 1, 7, 4, 7],
        [7, 1, 7, 1, 7],
        [5, 5, 7, 1, 1],
        [7, 4, 7, 1, 7],
        [7, 4, 7, 5, 7],
        [7, 1, 1, 1, 1],
        [7, 5, 7, 5, 7],
        [7, 5, 7, 1, 7],
    ];
    for (index, ch) in text.chars().enumerate() {
        let glyph = match ch {
            'F' => [7, 4, 6, 4, 4],
            's' => [0, 3, 4, 1, 6],
            '.' => [0, 0, 0, 0, 2],
            '-' => [0, 0, 7, 0, 0],
            _ => ch.to_digit(10).map_or([0; 5], |n| digits[n as usize]),
        };
        for (row, bits) in glyph.iter().enumerate() {
            for col in 0..3 {
                if bits & (1 << (2 - col)) != 0 {
                    for dy in 0..2 {
                        for dx in 0..2 {
                            let px = x + index as u32 * 10 + col * 2 + dx;
                            let py = y + row as u32 * 2 + dy;
                            if px < image.width() && py < image.height() {
                                image.put_pixel(px, py, image::Rgb([211, 215, 218]));
                            }
                        }
                    }
                }
            }
        }
    }
}

pub async fn check(snapshot: ProjectSnapshot) -> Result<Value> {
    let mut diagnostics = media::validate_media(&snapshot.root, &snapshot.manifest).await;
    if !diagnostics.is_empty() {
        return Ok(json!({"ok":false,"diagnostics":diagnostics,"sampledFrames":0}));
    }
    let mut frames = vec![0, snapshot.manifest.duration_frames - 1];
    for clip in &snapshot.manifest.clips {
        frames.push(clip.start_frame);
        frames.push(clip.start_frame + clip.duration_frames / 2);
    }
    frames.sort_unstable();
    frames.dedup();
    let mut sampled = 0;
    match Capture::open(snapshot.root.clone(), snapshot.manifest.clone()).await {
        Ok(capture) => {
            for frame in frames {
                match capture.frame(frame).await {
                    Ok(_) => sampled += 1,
                    Err(e) => diagnostics.push(json!({
                        "severity": "error", "code": "runtime", "message": e.to_string(),
                        "frame": frame,
                    })),
                }
            }
            capture.close().await;
        }
        Err(e) => diagnostics
            .push(json!({"severity":"error","code":"runtime_init","message":e.to_string()})),
    }
    Ok(json!({
        "ok": diagnostics.is_empty() && sampled > 0,
        "diagnostics": diagnostics,
        "sampledFrames": sampled,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn what_a_scene_threw_reads_as_its_own_words() {
        let thrown = "Error: scenes/film.html [film]: Image failed: http://127.0.0.1:50811/asset/assets/strip.jpg (404)
    at http://127.0.0.1:50811/runtime/html-in-canvas.js:34:31
    at http://127.0.0.1:50811/runtime/player.js:63:38";
        assert_eq!(
            plain_exception(thrown),
            "scenes/film.html [film]: Image failed: assets/strip.jpg (404)
    at /runtime/html-in-canvas.js:34:31"
        );
        assert_eq!(
            plain_exception("Uncaught (in promise) TypeError: no such thing"),
            "TypeError: no such thing"
        );
        assert_eq!(without_server("at 127.0.0.1"), "at 127.0.0.1");
    }
}
