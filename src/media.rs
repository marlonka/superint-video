use crate::{
    model::{ClipType, Manifest},
    process,
    project::safe_path,
};
use anyhow::{Context, Result, bail};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};
use tokio::io::AsyncReadExt;
use tokio::sync::{Mutex, OnceCell, Semaphore};
use tokio_util::sync::CancellationToken;

#[derive(Clone)]
pub struct MediaService {
    pub root: PathBuf,
    cache: PathBuf,
    indexes: Arc<Mutex<HashMap<String, Arc<VideoIndex>>>>,
    slots: Arc<Semaphore>,
    tool_identity: Arc<OnceCell<Vec<u8>>>,
}
struct VideoIndex {
    timestamps: Vec<f64>,
    duration: f64,
    key: String,
}

pub fn kind(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|v| v.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "html" | "htm" => "scene",
        "png" | "jpg" | "jpeg" | "svg" | "webp" => "image",
        "mp4" | "mov" | "webm" | "mkv" => "video",
        "wav" | "mp3" | "aac" | "m4a" | "flac" | "ogg" => "audio",
        _ => "file",
    }
}

pub async fn probe(path: &Path) -> Result<Value> {
    let mut cmd = process::command(process::binary("ffprobe"));
    cmd.args([
        "-v",
        "error",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
    ])
    .arg(path);
    let bytes = process::output(cmd, &CancellationToken::new(), Duration::from_secs(30)).await?;
    serde_json::from_slice(&bytes).context("Invalid ffprobe response")
}

fn number(value: &Value) -> Option<f64> {
    value.as_f64().or_else(|| value.as_str()?.parse().ok())
}
pub fn duration(info: &Value) -> Option<f64> {
    number(&info["format"]["duration"]).or_else(|| {
        info["streams"]
            .as_array()?
            .iter()
            .filter_map(|s| number(&s["duration"]))
            .max_by(f64::total_cmp)
    })
}

fn stream_time_base(stream: &Value) -> Option<f64> {
    let (num, den) = stream["time_base"].as_str()?.split_once('/')?;
    let num = num.parse::<f64>().ok()?;
    let den = den.parse::<f64>().ok()?;
    (num > 0.0 && den > 0.0).then_some(num / den)
}

/// Container duration may belong to a different, longer stream.
fn stream_duration(info: &Value, codec_type: &str) -> Option<f64> {
    let streams = info["streams"].as_array()?;
    let stream = streams
        .iter()
        .find(|stream| stream["codec_type"] == codec_type)?;
    number(&stream["duration"])
        .or_else(|| Some(number(&stream["duration_ts"])? * stream_time_base(stream)?))
        .or_else(|| {
            let parts = stream["tags"]["DURATION"]
                .as_str()?
                .split(':')
                .map(str::parse::<f64>)
                .collect::<std::result::Result<Vec<_>, _>>()
                .ok()?;
            (parts.len() == 3).then(|| parts[0] * 3600.0 + parts[1] * 60.0 + parts[2])
        })
        .or_else(|| {
            (streams
                .iter()
                .filter(|stream| stream["codec_type"] == "video" || stream["codec_type"] == "audio")
                .count()
                == 1)
                .then(|| number(&info["format"]["duration"]))
                .flatten()
        })
        .filter(|value| value.is_finite() && *value > 0.0)
}

impl MediaService {
    pub fn new(root: PathBuf) -> Self {
        Self {
            cache: root.join(".superint/frames"),
            root,
            indexes: Default::default(),
            slots: Arc::new(Semaphore::new(2)),
            tool_identity: Arc::new(OnceCell::new()),
        }
    }

    async fn index(&self, path: &Path) -> Result<Arc<VideoIndex>> {
        let meta = tokio::fs::metadata(path).await?;
        let signature = format!("{}:{}:{:?}", path.display(), meta.len(), meta.modified()?);
        let mut indexes = self.indexes.lock().await;
        if let Some(index) = indexes.get(&signature) {
            return Ok(index.clone());
        }
        let mut source = tokio::fs::File::open(path).await?;
        let mut hasher = Sha256::new();
        let tool_identity = self
            .tool_identity
            .get_or_try_init(|| async {
                let mut command = process::command(process::binary("ffmpeg"));
                command.arg("-version");
                process::output(command, &CancellationToken::new(), Duration::from_secs(10)).await
            })
            .await?;
        hasher.update(b"superint-pts-v2\0");
        hasher.update(tool_identity);
        hasher.update(b"\0");
        let mut buffer = vec![0; 65536];
        loop {
            let n = source.read(&mut buffer).await?;
            if n == 0 {
                break;
            }
            hasher.update(&buffer[..n]);
        }
        let key = hex::encode(hasher.finalize());
        let mut cmd = process::command(process::binary("ffprobe"));
        cmd.args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_frames",
            "-show_streams",
            "-show_entries",
            "frame=best_effort_timestamp,duration,pkt_duration:stream=time_base",
            "-of",
            "json",
        ])
        .arg(path);
        let bytes =
            process::output(cmd, &CancellationToken::new(), Duration::from_secs(60)).await?;
        let data: Value = serde_json::from_slice(&bytes)?;
        let tick = stream_time_base(&data["streams"][0])
            .context("Video has no valid timestamp timebase")?;
        let mut timestamps: Vec<f64> = data["frames"]
            .as_array()
            .context("No video frames")?
            .iter()
            // Decimal *_timestamp_time fields are rounded to microseconds. Keep
            // integer timestamps until this conversion or exact boundaries drift.
            .filter_map(|f| {
                f["best_effort_timestamp"]
                    .as_i64()
                    .map(|value| value as f64 * tick)
            })
            .collect();
        if timestamps.is_empty() {
            bail!("Video contains no timestamped frames: {}", path.display());
        }
        let first = timestamps[0];
        for t in &mut timestamps {
            *t -= first;
        }
        if timestamps.len() > 108000 {
            bail!("Video exceeds the v1 source limit of 108000 frames; trim the source first");
        }
        let info = probe(path).await?;
        let last_frame = data["frames"].as_array().and_then(|frames| frames.last());
        let final_frame_duration = last_frame
            .and_then(|frame| number(&frame["duration"]).or_else(|| number(&frame["pkt_duration"])))
            .filter(|duration| *duration > 0.0)
            .map(|duration| duration * tick);
        let source_duration = final_frame_duration
            .and_then(|duration| Some(timestamps.last()? + duration))
            .or_else(|| stream_duration(&info, "video"))
            .context(
                "Cannot establish video stream duration; convert the source to a supported SDR video",
            )?;
        let index = Arc::new(VideoIndex {
            duration: source_duration,
            timestamps,
            key,
        });
        if indexes.len() >= 128 {
            indexes.clear();
        }
        indexes.insert(signature, index.clone());
        Ok(index)
    }

    pub async fn frame(&self, manifest: &Manifest, id: &str, local_frame: u64) -> Result<Vec<u8>> {
        let clip = manifest
            .clips
            .iter()
            .find(|c| c.id == id)
            .context("Unknown video clip")?;
        if clip.clip_type != ClipType::Video {
            bail!("Frame source is not a video");
        }
        let path = safe_path(&self.root, &clip.src)?;
        let index = self.index(&path).await?;
        let time = manifest.fps.seconds(local_frame);
        if time >= index.duration - 0.000001 {
            bail!(
                "Clip {id}: source time {time:.4}s exceeds video duration {:.4}s",
                index.duration
            );
        }
        let n = index
            .timestamps
            .partition_point(|t| *t <= time + 1e-9)
            .saturating_sub(1);
        let file = self
            .cache
            .join(format!("pts-v2-{}-{n:08}.png", &index.key[..24]));
        if let Ok(data) = tokio::fs::read(&file).await {
            return Ok(data);
        }
        let _permit = self.slots.acquire().await?;
        if let Ok(data) = tokio::fs::read(&file).await {
            return Ok(data);
        }
        let mut cmd = process::command(process::binary("ffmpeg"));
        cmd.args([
            "-v",
            "error",
            "-nostdin",
            "-ss",
            // FFmpeg parses -ss in microseconds. Round down so a representational
            // rounding error cannot seek just beyond the selected source frame.
            &format!(
                "{:.6}",
                (index.timestamps[n] * 1_000_000.0).floor() / 1_000_000.0
            ),
            "-i",
        ])
        .arg(&path)
        .args([
            "-frames:v",
            "1",
            "-an",
            "-f",
            "image2pipe",
            "-vcodec",
            "png",
            "-compression_level",
            "1",
            "pipe:1",
        ]);
        let data = process::output(cmd, &CancellationToken::new(), Duration::from_secs(30)).await?;
        if data.is_empty() {
            bail!("Video decoder returned no frame for {id} at {time}s");
        }
        tokio::fs::create_dir_all(&self.cache).await?;
        // Encoded frames stay within both a count and a byte budget.
        let mut entries = tokio::fs::read_dir(&self.cache).await?;
        let mut files = Vec::new();
        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_file() {
                let meta = entry.metadata().await?;
                files.push((meta.modified()?, entry.path(), meta.len()));
            }
        }
        files.sort_by_key(|x| x.0);
        let mut bytes = files.iter().map(|x| x.2).sum::<u64>() + data.len() as u64;
        let mut count = files.len() + 1;
        for (_, old, size) in files {
            if count <= 512 && bytes <= 1024 * 1024 * 1024 {
                break;
            }
            if tokio::fs::remove_file(old).await.is_ok() {
                bytes = bytes.saturating_sub(size);
                count -= 1;
            }
        }
        crate::project::atomic_write(&file, &data)?;
        Ok(data)
    }

    pub async fn metadata(&self, relative: &str) -> Result<Value> {
        let path = safe_path(&self.root, relative)?;
        if !path.is_file() {
            bail!("Asset not found: {relative}");
        }
        let asset_kind = kind(&path);
        if asset_kind == "scene"
            || path
                .extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("svg"))
        {
            return Ok(json!({
                "path": relative, "kind": asset_kind, "duration": null, "width": null,
                "height": null, "hasAudio": false,
            }));
        }
        let info = probe(&path).await?;
        let streams = info["streams"].as_array().context("No streams")?;
        let video = streams.iter().find(|s| s["codec_type"] == "video");
        let asset_duration = match asset_kind {
            "video" => stream_duration(&info, "video"),
            "audio" => stream_duration(&info, "audio"),
            _ => None,
        };
        let mut result = json!({
            "path": relative,
            "kind": asset_kind,
            "duration": asset_duration,
            "width": video.map(|s| &s["width"]),
            "height": video.map(|s| &s["height"]),
            "hasAudio": streams.iter().any(|s| s["codec_type"] == "audio"),
        });
        if kind(&path) == "audio" {
            let mut cmd = process::command(process::binary("ffmpeg"));
            cmd.args(["-v", "error", "-nostdin", "-i"])
                .arg(&path)
                .args([
                    "-t", "300", "-vn", "-ac", "1", "-ar", "8000", "-f", "f32le", "pipe:1",
                ]);
            let bytes =
                process::output(cmd, &CancellationToken::new(), Duration::from_secs(30)).await?;
            let samples: Vec<f32> = bytes
                .as_chunks::<4>()
                .0
                .iter()
                .map(|b| f32::from_le_bytes(*b).abs())
                .collect();
            let step = samples.len().div_ceil(160).max(1);
            let peaks: Vec<f32> = samples
                .chunks(step)
                .map(|c| c.iter().copied().fold(0.0, f32::max).min(1.0))
                .collect();
            result["waveform"] = json!(peaks);
        }
        Ok(result)
    }
}

pub async fn validate_media(root: &Path, manifest: &Manifest) -> Vec<Value> {
    let mut errors = Vec::new();
    let service = MediaService::new(root.to_path_buf());
    for clip in &manifest.clips {
        let error = |code: &str, message: String| {
            json!({
                "severity": "error", "code": code, "message": message,
                "clipId": clip.id, "path": clip.src,
            })
        };
        let path = match safe_path(root, &clip.src) {
            Ok(p) if p.is_file() => p,
            _ => {
                errors.push(error(
                    "missing_asset",
                    format!("Missing asset: {}", clip.src),
                ));
                continue;
            }
        };
        let codec_type = match clip.clip_type {
            ClipType::Video => "video",
            ClipType::Audio => "audio",
            _ => continue,
        };
        let info = match probe(&path).await {
            Ok(info) => info,
            Err(e) => {
                errors.push(error("media_probe", e.to_string()));
                continue;
            }
        };
        let streams = info["streams"].as_array().cloned().unwrap_or_default();
        if !streams.iter().any(|s| s["codec_type"] == codec_type) {
            errors.push(error(
                "missing_stream",
                format!("Source has no {codec_type} stream"),
            ));
            continue;
        }
        let source_duration = match stream_duration(&info, codec_type) {
            None if codec_type == "video" => service.index(&path).await.ok().map(|i| i.duration),
            duration => duration,
        };
        match source_duration {
            Some(d) => {
                let end = manifest
                    .fps
                    .seconds(clip.source_offset_frames + clip.duration_frames);
                if end > d + 0.001 {
                    let message = format!("Clip ends at source {end:.4}s, beyond {d:.4}s");
                    errors.push(error("source_bounds", message));
                }
            }
            None => errors.push(error(
                "unknown_duration",
                format!(
                    "Cannot establish {codec_type} stream duration; convert source to a supported SDR media format"
                ),
            )),
        }
        let hdr =
            |s: &Value| s["color_transfer"] == "smpte2084" || s["color_transfer"] == "arib-std-b67";
        if streams.iter().any(hdr) {
            let message = "Convert HDR source to SDR before importing";
            errors.push(error("hdr_unsupported", message.into()));
        }
    }
    errors
}
