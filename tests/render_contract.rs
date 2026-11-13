//! Real Chromium/FFmpeg boundary tests. Run explicitly on a prepared local machine:
//! cargo test --test render_contract -- --ignored --test-threads=1
//! Expected pixels come from the synthetic fixture's documented frame markers.
use anyhow::{Context, Result, ensure};
use chromiumoxide::{cdp::browser_protocol::page::CaptureScreenshotFormat, page::ScreenshotParams};
use image::RgbImage;
use serde_json::json;
use std::{fs, path::Path, sync::Arc, time::Duration};
use superint_video::{
    media,
    model::{Fps, Manifest},
    process,
    project::ProjectStore,
    renderer::{self, Capture},
    review,
};
use tempfile::TempDir;
use tokio_util::sync::CancellationToken;

fn project(fps: Fps) -> Result<(TempDir, Manifest)> {
    let directory = tempfile::Builder::new()
        .prefix("superint-contract-")
        .tempdir()?;
    fs::create_dir(directory.path().join("scenes"))?;
    fs::write(
        directory.path().join("scenes/markers.html"),
        include_str!("../examples/fixture/scenes/markers.html"),
    )?;
    let mut manifest: Manifest =
        serde_json::from_str(include_str!("../examples/fixture/video.json"))?;
    manifest.fps = fps;
    manifest.validate()?;
    fs::write(
        directory.path().join("video.json"),
        serde_json::to_vec_pretty(&manifest)?,
    )?;
    Ok((directory, manifest))
}

fn png(bytes: &[u8]) -> Result<RgbImage> {
    Ok(image::load_from_memory(bytes)?.to_rgb8())
}

fn pixel(image: &RgbImage, x: u32, y: u32, expected: [u8; 3], tolerance: u8) -> Result<()> {
    let actual = image.get_pixel(x, y).0;
    ensure!(
        actual
            .iter()
            .zip(expected)
            .all(|(a, b)| a.abs_diff(b) <= tolerance),
        "pixel ({x},{y}) expected {expected:?} ± {tolerance}; found {actual:?}"
    );
    Ok(())
}

fn frame_markers(image: &RgbImage, project_frame: u64, tolerance: u8) -> Result<()> {
    ensure!(
        image.dimensions() == (640, 360),
        "composition dimensions changed"
    );
    let (local, color) = match project_frame {
        0..=29 => (project_frame, [232, 62, 65]),
        30..=34 => {
            pixel(image, 500, 100, [0, 0, 0], tolerance)?;
            pixel(image, 10, 350, [0, 0, 0], tolerance)?;
            return Ok(());
        }
        35..=59 => (project_frame - 5, [49, 199, 137]),
        60..=89 => (project_frame, [70, 133, 245]),
        _ => anyhow::bail!("test frame is outside fixture"),
    };
    pixel(image, 500, 100, color, tolerance)?;
    for bit in 0..16 {
        let level = if local & (1 << bit) != 0 { 255 } else { 0 };
        pixel(image, bit * 20 + 10, 350, [level, level, level], tolerance)?;
    }
    pixel(
        image,
        (local as u32 * 5) % 632 + 3,
        285,
        [255, 255, 255],
        tolerance,
    )?;
    Ok(())
}

#[tokio::test]
#[ignore = "requires local Chromium and FFmpeg"]
async fn seeks_preserve_source_frames_boundaries_and_latest_scrub() -> Result<()> {
    let (directory, manifest) = project(Fps { num: 30, den: 1 })?;
    let capture = Capture::open(directory.path().to_path_buf(), manifest).await?;
    let result = async {
        let mut repeated = None;
        for frame in [89, 0, 35, 29, 30, 34, 59, 60, 64, 65, 1, 89, 35] {
            let image = png(&capture.frame(frame).await?)?;
            frame_markers(&image, frame, 0).with_context(|| format!("requested frame {frame}"))?;
            if frame == 89 {
                if let Some(previous) = &repeated {
                    ensure!(previous == &image, "repeated seek changed pixels");
                } else {
                    repeated = Some(image);
                }
            }
        }
        let state = renderer::eval(&capture.page, "(async()=>{await Promise.all([2,65,3,40,1,87,60,83].map(f=>window.__superint.seek(f)));return window.__superint.getState()})()").await?;
        ensure!(state["frame"] == 83, "rapid scrub committed a stale frame: {state}");
        ensure!(state["errors"].as_array().is_some_and(Vec::is_empty), "runtime errors: {state}");
        // Capture directly: another seek here would hide a stale-paint regression.
        let bytes = capture.page.screenshot(ScreenshotParams::builder().format(CaptureScreenshotFormat::Png).full_page(false).build()).await?;
        frame_markers(&png(&bytes)?, 83, 0)?;
        Ok(())
    }.await;
    capture.close().await;
    result
}

#[tokio::test]
#[ignore = "requires local Chromium and FFmpeg"]
async fn sixty_fps_motion_and_rational_time_reach_the_scene() -> Result<()> {
    for (fps, cases) in [
        (
            Fps { num: 60, den: 1 },
            vec![(1, [0, 17, 0]), (2, [0, 33, 0]), (35, [1, 244, 0])],
        ),
        (
            Fps {
                num: 30_000,
                den: 1001,
            },
            vec![(35, [3, 233, 0]), (65, [8, 121, 0])],
        ),
    ] {
        let (directory, manifest) = project(fps)?;
        let capture = Capture::open(directory.path().to_path_buf(), manifest).await?;
        let result: Result<()> = async {
            for (frame, expected_milliseconds) in cases {
                let image = png(&capture.frame(frame).await?)?;
                frame_markers(&image, frame, 0)?;
                // Red/green encode round(localTime * 1000), independent of displayed text.
                pixel(&image, 520, 320, expected_milliseconds, 0)?;
            }
            Ok(())
        }
        .await;
        capture.close().await;
        result?;
    }
    Ok(())
}

#[tokio::test]
#[ignore = "requires local Chromium and FFmpeg"]
async fn a_scene_may_wait_for_a_bitmap_and_an_animation_frame() -> Result<()> {
    // Chrome pauses a hidden cross-origin frame, so this would hang if the player hid scenes early.
    let (directory, manifest) = project(Fps { num: 30, den: 1 })?;
    let green =
        "data:image/gif;base64,R0lGODlhAQABAIAAAAD/AAAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";
    fs::write(
        directory.path().join(&manifest.clips[0].src),
        format!(
            r#"<!doctype html><style>html,body{{margin:0;background:#000}}img{{display:block;width:100%;height:100vh}}</style>
<img src="{green}" alt=""><script type="module">
import {{defineScene}} from '/runtime/scene.js';
defineScene({{render(){{return new Promise(done=>requestAnimationFrame(()=>done([])));}}}});
</script>"#
        ),
    )?;
    let capture = Capture::open(directory.path().to_path_buf(), manifest).await?;
    let result = capture.frame(1).await;
    capture.close().await;
    pixel(&png(&result?)?, 100, 100, [0, 255, 0], 2)
}

#[tokio::test]
#[ignore = "requires local Chromium and FFmpeg"]
async fn html_in_a_canvas_reaches_a_shader_with_its_project_pictures() -> Result<()> {
    let (directory, manifest) = project(Fps { num: 30, den: 1 })?;
    let assets = directory.path().join("assets");
    fs::create_dir(&assets)?;
    RgbImage::from_pixel(2, 2, image::Rgb([255, 0, 0])).save(assets.join("red.png"))?;
    RgbImage::from_pixel(2, 2, image::Rgb([0, 255, 0])).save(assets.join("green.png"))?;
    // Red picture, green background picture, a white bar that grows with the frame, on blue.
    // The shader mirrors the page, so a page that showed as plain HTML would fail every pixel.
    fs::write(
        directory.path().join(&manifest.clips[0].src),
        r#"<!doctype html><style>html,body{margin:0;background:#000}canvas{position:absolute;inset:0;width:100%;height:100%}
#page{position:relative;width:640px;height:360px;background:#00f}
#page img{position:absolute;left:0;top:0;width:160px;height:360px}
#tile{position:absolute;left:160px;top:0;width:160px;height:360px;background:url('../assets/green.png') 0 0/100% 100%}
#bar{position:absolute;left:320px;top:0;height:180px;background:#fff}</style>
<canvas id="stage"><div drawable id="page"><img src="../assets/red.png" alt=""><div id="tile"></div><div id="bar"></div></div></canvas>
<script type="module">
import {defineScene} from '/runtime/scene.js';
import {htmlCanvas} from '/runtime/html-in-canvas.js';
const stage = htmlCanvas(document.querySelector('#stage'));
const mirror = stage.shader(`uniform sampler2D page; void main() { color = texture(page, vec2(1. - uv.x, uv.y)); }`);
defineScene({ready: stage.ready, async render({frame}) {
  document.querySelector('#bar').style.width = frame * 10 + 'px';
  await stage.paint(() => mirror.draw({page: document.querySelector('#page')}));
}});
</script>"#,
    )?;
    let capture = Capture::open(directory.path().to_path_buf(), manifest).await?;
    let result = async {
        let first = capture.frame(4).await?;
        let image = png(&first)?;
        pixel(&image, 560, 300, [255, 0, 0], 2).context("the <img> from the project")?;
        pixel(&image, 400, 300, [0, 255, 0], 2).context("the CSS background from the project")?;
        pixel(&image, 300, 90, [255, 255, 255], 2).context("the bar at frame 4")?;
        pixel(&image, 200, 90, [0, 0, 255], 2).context("left of the bar at frame 4")?;
        let later = png(&capture.frame(16).await?)?;
        pixel(&later, 200, 90, [255, 255, 255], 2).context("the bar at frame 16")?;
        ensure!(
            capture.frame(4).await? == first,
            "seeking back gave another picture of the same frame"
        );
        // The player as Studio's preview loads it draws the same picture.
        let watched = capture
            .page
            .url()
            .await?
            .context("the capture has no address")?
            .replace("?capture=1", "");
        capture.page.goto(watched).await?;
        renderer::eval(
            &capture.page,
            "(async()=>{await window.__superint.ready;await window.__superint.seek(4);return window.__superint.getState()})()",
        )
        .await?;
        let shown = capture
            .page
            .screenshot(
                ScreenshotParams::builder()
                    .format(CaptureScreenshotFormat::Png)
                    .full_page(false)
                    .build(),
            )
            .await?;
        pixel(&png(&shown)?, 560, 300, [255, 0, 0], 2).context("the preview")?;
        pixel(&png(&shown)?, 300, 90, [255, 255, 255], 2).context("the preview's bar")?;
        Ok(())
    }
    .await;
    capture.close().await;
    result
}

async fn decoded_frame(path: &Path, frame: u64) -> Result<RgbImage> {
    let mut command = process::command(process::binary("ffmpeg"));
    command
        .args(["-v", "error", "-nostdin", "-i"])
        .arg(path)
        .args([
            "-vf",
            &format!("select=eq(n\\,{frame})"),
            "-frames:v",
            "1",
            "-an",
            "-f",
            "image2pipe",
            "-vcodec",
            "png",
            "pipe:1",
        ]);
    let bytes =
        process::output(command, &CancellationToken::new(), Duration::from_secs(30)).await?;
    png(&bytes)
}

#[tokio::test]
#[ignore = "requires local Chromium and FFmpeg"]
async fn preview_snapshot_and_frozen_silent_export_share_the_frame_contract() -> Result<()> {
    let (directory, manifest) = project(Fps { num: 30, den: 1 })?;
    let capture = Capture::open(directory.path().to_path_buf(), manifest.clone()).await?;
    let preview_result = capture.frame(35).await;
    capture.close().await;
    let preview = png(&preview_result?)?;
    frame_markers(&preview, 35, 0)?;
    let store = ProjectStore::open(directory.path())?;
    let snapshots = directory.path().join("renders/snapshots");
    renderer::snapshots(store.snapshot()?, &[0, 35, 89], &snapshots).await?;
    let snapshot = png(&fs::read(snapshots.join("frame-000035.png"))?)?;
    ensure!(
        snapshot == preview,
        "snapshot pixels differ from preview at frame 35"
    );
    ensure!(
        snapshots.join("contact-sheet.png").is_file(),
        "contact sheet missing"
    );
    let output = directory.path().join("renders/fixture.mp4");
    let live_scene = directory.path().join("scenes/markers.html");
    let changed = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let changed_flag = changed.clone();
    let progress: renderer::ProgressFn = Arc::new(move |stage, completed, _| {
        if stage == "Rendering frames" && completed == 3 {
            let result = fs::write(
                &live_scene,
                "<!doctype html><style>html,body{margin:0;background:black}</style>",
            );
            changed_flag.store(result.is_ok(), std::sync::atomic::Ordering::Relaxed);
        }
    });
    renderer::render(
        store.snapshot()?,
        output.clone(),
        "final",
        renderer::DEFAULT_CODEC,
        false,
        None,
        Some(3),
        CancellationToken::new(),
        progress,
    )
    .await?;
    ensure!(
        changed.load(std::sync::atomic::Ordering::Relaxed),
        "external edit was not made while encoding"
    );
    let probe = media::probe(&output).await?;
    let streams = probe["streams"]
        .as_array()
        .context("missing export streams")?;
    // A film with nothing to hear still carries a (silent) stereo track: files without an
    // audio stream are refused by some upload forms, editors and television sets.
    let audio = streams
        .iter()
        .find(|s| s["codec_type"] == "audio")
        .context("silent composition has no audio track")?;
    ensure!(audio["channels"] == 2, "silent track is not stereo");
    let video = streams
        .iter()
        .find(|s| s["codec_type"] == "video")
        .context("missing video")?;
    ensure!(video["nb_frames"] == "90", "export lost frames");
    ensure!(
        video["avg_frame_rate"] == "30/1",
        "export changed frame rate"
    );
    // H.264 YUV420 plus sRGB→BT.709 transfer conversion is lossy. Check interiors
    // of flat regions within 24 RGB levels, and binary frame identity within 8.
    for frame in [0, 29, 30, 34, 35, 59, 60, 89] {
        let image = decoded_frame(&output, frame).await?;
        frame_markers(&image, frame, 24).with_context(|| format!("encoded frame {frame}"))?;
        if !(30..=34).contains(&frame) {
            let local = if (35..60).contains(&frame) {
                frame - 5
            } else {
                frame
            };
            for bit in 0..16 {
                let level = if local & (1 << bit) != 0 { 255 } else { 0 };
                pixel(&image, bit * 20 + 10, 350, [level, level, level], 8)?;
            }
        }
    }
    Ok(())
}

// A picture that stands still until frame 120; an actor the clip transform (x −40, scale 2 about
// the stage centre) pushes to a quarter at the left edge; a highlight whose target sticks out
// 10 scene px (20 stage px) on the right. The check camera paints the frame white.
const ACTORS_SCENE: &str = r#"<!doctype html><html lang="en"><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}</style></head><body><script type="module">
import{defineScene}from'/runtime/scene.js';
defineScene({props:{camX:{type:'number',default:0},camY:{type:'number',default:0},camZ:{type:'number',default:0,min:0}},render({frame,props}){
document.body.style.background=props.camZ>0?'#ffffff':frame<120?'#203040':'#e0a020';
return{actors:[{id:'sliver',x:165,y:150,w:20,h:20},{id:'frame',x:300,y:160,w:40,h:20,target:'card'},{id:'card',x:310,y:165,w:40,h:10}]};
}});
</script></body></html>"#;

#[tokio::test]
#[ignore = "requires local Chromium and FFmpeg"]
async fn review_measures_actors_through_the_clip_transform_and_takes_close_ups() -> Result<()> {
    let directory = tempfile::Builder::new()
        .prefix("superint-review-")
        .tempdir()?;
    fs::create_dir(directory.path().join("scenes"))?;
    fs::write(directory.path().join("scenes/actors.html"), ACTORS_SCENE)?;
    fs::write(
        directory.path().join("scenes/markers.html"),
        include_str!("../examples/fixture/scenes/markers.html"),
    )?;
    let manifest: Manifest = serde_json::from_value(json!({
        "version": 1, "name": "Review fixture", "width": 640, "height": 360,
        "fps": {"num": 30, "den": 1}, "durationFrames": 150, "background": "#000000",
        "tracks": [{"id": "visuals", "kind": "visual"}],
        "clips": [
            {"id": "actors", "type": "scene", "src": "scenes/actors.html", "track": "visuals", "startFrame": 0, "durationFrames": 140, "sourceOffsetFrames": 0, "props": {}, "transform": {"x": -40, "scale": 2}},
            {"id": "plain", "type": "scene", "src": "scenes/markers.html", "track": "visuals", "startFrame": 140, "durationFrames": 10, "sourceOffsetFrames": 0, "props": {"label": "P"}}
        ]
    }))?;
    manifest.validate()?;
    fs::write(
        directory.path().join("video.json"),
        serde_json::to_vec_pretty(&manifest)?,
    )?;
    let store = ProjectStore::open(directory.path())?;

    let pass = directory.path().join("renders/review/1");
    let options = review::Options {
        every: Some(1.0),
        offset: 0.0,
        frames: Vec::new(),
        strips: vec![(118, 122)],
        camera: None,
        crop: Some([0, 0, 320, 180]),
        motion: true,
    };
    let result = review::review(store.snapshot()?, &options, &pass).await?;
    for file in [
        "contact-sheet.png",
        "review.json",
        "review.md",
        "frame-000000.png",
        "frame-000149.png",
        "crop-000060.png",
        "frame-000120.png",
        "strip-000118-000122.png",
    ] {
        ensure!(pass.join(file).is_file(), "{file} missing");
    }
    ensure!(
        result["static"] == json!([{"from": 0, "to": 105, "seconds": 3.5}]),
        "static stretches: {}",
        result["static"]
    );
    let findings = result["findings"].as_array().context("findings")?;
    ensure!(findings.len() == 2, "findings: {findings:?}");
    let edge = findings
        .iter()
        .find(|f| f["code"] == "edge-cut")
        .context("no edge cut")?;
    ensure!(
        edge["actor"] == "sliver"
            && edge["worst"]["visible"] == 0.25
            && edge["worst"]["sides"] == json!(["left"])
            && (edge["from"].as_u64(), edge["to"].as_u64()) == (Some(0), Some(135)),
        "edge cut: {edge}"
    );
    let off = findings
        .iter()
        .find(|f| f["code"] == "off-target")
        .context("no off-target")?;
    ensure!(
        off["actor"] == "frame"
            && off["target"] == "card"
            && off["worst"]["outside"] == json!({"right": 20}),
        "off target: {off}"
    );
    let worksheet = fs::read_to_string(pass.join("review.md"))?;
    ensure!(
        worksheet.contains("| 60 | 2.0 s |") && worksheet.contains("| 118–122 | 3.9–4.1 s |"),
        "worksheet rows: {worksheet}"
    );

    let close = directory.path().join("renders/review/2");
    let options = review::Options {
        every: None,
        offset: 0.0,
        frames: vec![60],
        strips: Vec::new(),
        camera: Some([320.0, 180.0, 2.0]),
        crop: None,
        motion: false,
    };
    let result = review::review(store.snapshot()?, &options, &close).await?;
    pixel(
        &png(&fs::read(close.join("frame-000060.png"))?)?,
        320,
        180,
        [255, 255, 255],
        0,
    )?;
    ensure!(
        result["findings"] == json!([])
            && result["warnings"][0]["code"] == "no-camera"
            && result["warnings"][0]["clips"] == json!(["plain"]),
        "close-up pass: {result}"
    );
    ensure!(
        fs::read_to_string(close.join("review.md"))?.contains("Nothing measured"),
        "close-up worksheet"
    );
    Ok(())
}

#[tokio::test]
#[ignore = "requires local Chromium and FFmpeg"]
async fn polish_walks_one_still_at_a_time_and_accepts_the_walk_with_its_fixes() -> Result<()> {
    use serde_json::Value;
    use std::path::PathBuf;
    use superint_video::{polish, project::picture_revision};
    let (directory, _) = project(Fps { num: 30, den: 1 })?;
    let root = directory.path();
    // What the polisher writes into the row of one still.
    let fill = |pass: &Path, file: &str, finding: &str, fix: &str| -> Result<()> {
        let sheet = fs::read_to_string(pass.join("polish.md"))?;
        let start = format!("| {file} |");
        ensure!(sheet.contains(&start), "no row for {file}");
        let rows: Vec<String> = sheet
            .lines()
            .map(|line| {
                if !line.starts_with(&start) {
                    return line.to_string();
                }
                let cells: Vec<&str> = line.split('|').map(str::trim).collect();
                format!(
                    "| {file} | {} | {} | {finding} | {fix} |",
                    cells[2], cells[3]
                )
            })
            .collect();
        fs::write(pass.join("polish.md"), rows.join("\n"))?;
        Ok(())
    };
    // One `polish` call for a film that gets `rounds`: what it answers, and the pass folder.
    async fn step(root: &Path, rounds: u8) -> Result<(Value, PathBuf)> {
        let picture = picture_revision(root)?;
        let next = polish::next(root, rounds, &picture);
        let snapshot = ProjectStore::open(root)?.settled_snapshot()?;
        let answer = polish::polish(snapshot, &picture, Some(1.0), &next).await?;
        Ok((answer, next.output.clone()))
    }
    let colour = |clip: usize, colour: &str| -> Result<()> {
        let mut manifest: Value = serde_json::from_slice(&fs::read(root.join("video.json"))?)?;
        manifest["clips"][clip]["props"]["color"] = json!(colour);
        fs::write(
            root.join("video.json"),
            serde_json::to_vec_pretty(&manifest)?,
        )?;
        Ok(())
    };

    // The first call lays out the walk and takes one still: the first.
    let (answer, first) = step(root, 1).await?;
    ensure!(
        answer["pass"] == 1
            && answer["round"] == 1
            && answer["stills"] == 4
            && answer["left"] == 4
            && answer["next"]["row"] == "frame-000000.png"
            && answer["next"]["taken"] == "new",
        "first call: {answer}"
    );
    for file in ["polish.json", "polish.md", "frame-000000.png"] {
        ensure!(first.join(file).is_file(), "{file} missing");
    }
    let taken = |folder: &Path| -> usize {
        fs::read_dir(folder)
            .into_iter()
            .flatten()
            .flatten()
            .filter(|entry| entry.file_name().to_string_lossy().ends_with(".png"))
            .count()
    };
    ensure!(taken(&first) == 1, "more than one picture was laid out");
    ensure!(
        polish::state(root, 1)?["state"] == "missing",
        "state before"
    );
    ensure!(
        polish::accept(root, &picture_revision(root)?, 1).is_err(),
        "a worksheet nobody filled in was accepted"
    );
    // Nothing written, nothing changed: the same still, not taken again.
    let (answer, _) = step(root, 1).await?;
    ensure!(
        answer["next"]["row"] == "frame-000000.png" && answer["next"]["taken"] == "same",
        "the same still again: {answer}"
    );

    // The row is written: the next call takes the next still.
    fill(&first, "frame-000000.png", "ok: reads at once", "")?;
    let (answer, _) = step(root, 1).await?;
    ensure!(
        answer["next"]["row"] == "frame-000030.png"
            && answer["next"]["taken"] == "new"
            && answer["done"] == 1
            && answer["left"] == 3
            && taken(&first) == 2,
        "second still: {answer}"
    );
    // A fix changes the picture: the still whose row is empty is taken again, with the fix.
    colour(1, "#f5c046")?;
    let (answer, _) = step(root, 1).await?;
    ensure!(
        answer["next"]["row"] == "frame-000030.png" && answer["next"]["taken"] == "again",
        "after a fix: {answer}"
    );
    // A still gets two looks, not three: after another change it is not taken again.
    colour(1, "#f58a46")?;
    let before = fs::metadata(first.join("frame-000030.png"))?.modified()?;
    let (answer, _) = step(root, 1).await?;
    ensure!(
        answer["next"]["row"] == "frame-000030.png"
            && answer["next"]["taken"] == "limit"
            && fs::metadata(first.join("frame-000030.png"))?.modified()? == before,
        "a third look: {answer}"
    );
    fill(
        &first,
        "frame-000030.png",
        "the marker had the wrong colour",
        "fixed: recoloured it",
    )?;
    let (answer, _) = step(root, 1).await?;
    ensure!(
        answer["next"]["row"] == "frame-000060.png",
        "third still: {answer}"
    );
    fill(
        &first,
        "frame-000060.png",
        "the label sits on the marker",
        "",
    )?;
    let (answer, _) = step(root, 1).await?;
    ensure!(
        answer["next"]["row"] == "frame-000089.png",
        "last still: {answer}"
    );
    fill(
        &first,
        "frame-000089.png",
        "kept: the end card stands still on purpose",
        "",
    )?;

    // No row is empty, but one only names a defect: the walk is not done.
    let (answer, _) = step(root, 1).await?;
    ensure!(
        answer["next"].is_null() && answer["left"] == 0 && answer["clean"] == false,
        "a named defect: {answer}"
    );
    ensure!(
        polish::accept(root, &picture_revision(root)?, 1).is_err(),
        "a pass with a defect was accepted"
    );
    fill(&first, "frame-000060.png", "ok: reads at once", "")?;
    let (answer, _) = step(root, 1).await?;
    ensure!(answer["clean"] == true, "every row settled: {answer}");
    // Accepted for the picture as the fixes left it, with no second look at everything.
    let accepted = polish::accept(root, &picture_revision(root)?, 1)?;
    ensure!(
        accepted["rows"] == 4 && accepted["fixed"] == 1 && accepted["kept"] == 1,
        "accept: {accepted}"
    );
    ensure!(
        first.join("contact-sheet.png").is_file(),
        "no sheet of the walk"
    );
    ensure!(
        polish::state(root, 1)?["state"] == "accepted",
        "state after"
    );
    let (answer, _) = step(root, 1).await?;
    ensure!(
        answer["accepted"] == true && answer["next"].is_null(),
        "nothing to look at: {answer}"
    );

    // Notes and the report do not touch the picture.
    fs::create_dir_all(root.join("process"))?;
    fs::write(root.join("process/review.md"), "a note")?;
    fs::write(root.join("report.md"), "a report")?;
    ensure!(
        polish::state(root, 1)?["state"] == "accepted",
        "a note made the pass stale"
    );

    // A change to the last clip: the record goes stale, and the next pass lists the stills
    // that no longer show what somebody looked at.
    colour(2, "#9a46f5")?;
    ensure!(
        polish::state(root, 1)?["state"] == "stale",
        "state after a change"
    );
    ensure!(
        polish::accept(root, &picture_revision(root)?, 1).is_err(),
        "a pass was accepted for a picture it never saw"
    );
    let (answer, second) = step(root, 1).await?;
    let sheet = fs::read_to_string(second.join("polish.md"))?;
    ensure!(
        answer["pass"] == 2
            && answer["round"] == 1
            && answer["stills"] == 2
            && answer["settled"] == 2
            && answer["next"]["row"] == "frame-000060.png"
            && answer["next"]["taken"] == "new"
            && sheet.contains("| frame-000089.png |")
            && !sheet.contains("| frame-000000.png |"),
        "second pass: {answer}\n{sheet}"
    );
    fill(&second, "frame-000060.png", "ok: reads at once", "")?;
    fill(&second, "frame-000089.png", "ok: reads at once", "")?;
    polish::accept(root, &picture_revision(root)?, 1)?;
    let state = polish::state(root, 1)?;
    ensure!(
        state["state"] == "accepted" && state["pass"] == 2,
        "state after the second pass: {state}"
    );

    // The user wants two rounds: the clean round 1 is not enough to render. The next call
    // starts round 2 at its first still, between the stills of round 1, with what round 1 found.
    let picture = picture_revision(root)?;
    let accepted = polish::accept(root, &picture, 2)?;
    ensure!(
        accepted["round"] == 1 && accepted["next"].as_str().unwrap_or("").contains("Round 2"),
        "accept of round 1 of 2: {accepted}"
    );
    let state = polish::state(root, 2)?;
    ensure!(
        state["state"] == "next-round",
        "state after round 1 of 2: {state}"
    );
    let (answer, third) = step(root, 2).await?;
    let sheet = fs::read_to_string(third.join("polish.md"))?;
    ensure!(
        answer["pass"] == 3
            && answer["round"] == 2
            && answer["next"]["row"] == "frame-000015.png"
            && sheet.starts_with("# Polish pass 3, round 2 of 2")
            && sheet.contains("## Found in earlier rounds")
            && sheet.contains("the marker had the wrong colour")
            && sheet.contains("## What to look for: round 2")
            && !sheet.contains("| frame-000000.png |"),
        "round 2: {answer}\n{sheet}"
    );
    ensure!(
        polish::accept(root, &picture, 2).is_err(),
        "round 2 was accepted before anyone looked"
    );
    let mut answer = answer;
    while let Some(row) = answer["next"]["row"].as_str().map(str::to_string) {
        fill(&third, &row, "ok: holds up", "")?;
        answer = step(root, 2).await?.0;
    }
    let accepted = polish::accept(root, &picture, 2)?;
    ensure!(accepted["round"] == 2, "accept of round 2: {accepted}");
    ensure!(
        polish::state(root, 2)?["state"] == "accepted",
        "two rounds are done"
    );
    Ok(())
}
