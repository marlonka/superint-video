//! Failure behavior at the real render boundary, including cleanup and external edits.
use anyhow::{Context, Result, ensure};
use serde_json::Value;
use std::{
    fs,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};
use superint_video::{model::Manifest, process, project::ProjectStore, renderer};
use tempfile::TempDir;
use tokio_util::sync::CancellationToken;

fn project() -> Result<TempDir> {
    let directory = tempfile::Builder::new()
        .prefix("superint-failure-contract-")
        .tempdir()?;
    fs::create_dir(directory.path().join("scenes"))?;
    fs::write(
        directory.path().join("scenes/markers.html"),
        include_str!("../examples/fixture/scenes/markers.html"),
    )?;
    fs::write(
        directory.path().join("video.json"),
        include_str!("../examples/fixture/video.json"),
    )?;
    Ok(directory)
}

#[tokio::test]
#[ignore = "requires local Chromium and FFmpeg"]
async fn cancellation_preserves_existing_export_and_cleans_staging() -> Result<()> {
    let directory = project()?;
    let output_folder = directory.path().join("renders");
    fs::create_dir(&output_folder)?;
    let output = output_folder.join("previous.mp4");
    fs::write(&output, b"previous export must remain untouched")?;
    let store = ProjectStore::open(directory.path())?;
    let cancel = CancellationToken::new();
    let callback_cancel = cancel.clone();
    let cancelled_during_frames = Arc::new(AtomicBool::new(false));
    let flag = cancelled_during_frames.clone();
    let progress: renderer::ProgressFn = Arc::new(move |stage, completed, _| {
        if stage == "Rendering frames" && completed == 3 {
            flag.store(true, Ordering::Relaxed);
            callback_cancel.cancel();
        }
    });
    let result = renderer::render(
        store.snapshot()?,
        output.clone(),
        "final",
        renderer::DEFAULT_CODEC,
        true,
        None,
        None,
        cancel,
        progress,
    )
    .await;
    ensure!(
        cancelled_during_frames.load(Ordering::Relaxed),
        "test never reached active encoding"
    );
    let error = result.expect_err("cancelled render unexpectedly succeeded");
    ensure!(
        format!("{error:#}").contains("cancelled"),
        "wrong cancellation error: {error:#}"
    );
    ensure!(
        fs::read(&output)? == b"previous export must remain untouched",
        "cancelled overwrite replaced existing output"
    );
    let entries = fs::read_dir(&output_folder)?.collect::<std::io::Result<Vec<_>>>()?;
    ensure!(
        entries.len() == 1 && entries[0].file_name() == "previous.mp4",
        "render left temporary output behind"
    );
    // On Windows this also fails if an owned child still holds project/output files.
    directory.close()?;
    Ok(())
}

#[tokio::test]
#[ignore = "requires local Chromium and FFmpeg"]
async fn missing_source_is_reported_before_any_visual_samples_or_output() -> Result<()> {
    let directory = project()?;
    let mut manifest: Manifest =
        serde_json::from_slice(&fs::read(directory.path().join("video.json"))?)?;
    manifest.clips[0].src = "scenes/missing.html".into();
    fs::write(
        directory.path().join("video.json"),
        serde_json::to_vec_pretty(&manifest)?,
    )?;
    let store = ProjectStore::open(directory.path())?;
    let check = renderer::check(store.snapshot()?).await?;
    ensure!(
        check["ok"] == false && check["sampledFrames"] == 0,
        "missing asset passed visual check: {check}"
    );
    let diagnostics = check["diagnostics"]
        .as_array()
        .context("missing diagnostics")?;
    ensure!(
        diagnostics.iter().any(|d| d["code"] == "missing_asset"
            && d["clipId"] == "first"
            && d["path"] == "scenes/missing.html"),
        "missing asset lacks clip/path context: {check}"
    );
    let output = directory.path().join("renders/missing.mp4");
    let result = renderer::render(
        store.snapshot()?,
        output.clone(),
        "final",
        renderer::DEFAULT_CODEC,
        false,
        None,
        None,
        CancellationToken::new(),
        Arc::new(|_, _, _| {}),
    )
    .await;
    ensure!(
        result.is_err() && !output.exists(),
        "missing source created completed-looking output"
    );
    Ok(())
}

async fn check_scene(source: &str) -> Result<Value> {
    let directory = project()?;
    fs::write(directory.path().join("scenes/markers.html"), source)?;
    let store = ProjectStore::open(directory.path())?;
    renderer::check(store.snapshot()?).await
}

#[tokio::test]
#[ignore = "requires local Chromium and FFmpeg"]
async fn failed_fonts_exceptions_and_readiness_timeouts_are_actionable() -> Result<()> {
    for (source, expected) in [
        (
            r#"<!doctype html><style>@font-face{font-family:MissingFixture;src:url('../assets/missing.woff2')}h1{font-family:MissingFixture}</style><h1>Required font</h1>"#,
            "Font failed",
        ),
        (
            r#"<!doctype html><script type="module">import{defineScene}from'/runtime/scene.js';defineScene({render(){throw new Error('fixture scene exception')}});</script>"#,
            "fixture scene exception",
        ),
        (
            r#"<!doctype html><script type="module">import{defineScene}from'/runtime/scene.js';defineScene({ready:new Promise(()=>{}),render(){}});</script>"#,
            "Scene initialization timed out",
        ),
    ] {
        let result = check_scene(source).await?;
        ensure!(
            result["ok"] == false && result["sampledFrames"] == 0,
            "failed scene passed: {result}"
        );
        ensure!(
            result["diagnostics"].to_string().contains(expected),
            "expected {expected}, got {result}"
        );
    }
    Ok(())
}

#[tokio::test]
#[ignore = "requires local Chromium and FFmpeg"]
async fn a_browser_without_html_in_canvas_stops_the_capture_and_names_what_it_needs() -> Result<()>
{
    // An older Chrome, made here by taking the feature away before the scene looks for it.
    let result = check_scene(
        r#"<!doctype html><script>delete HTMLCanvasElement.prototype.content</script>
<canvas id="stage"><p drawable>Text</p></canvas><script type="module">
import {defineScene} from '/runtime/scene.js';
import {htmlCanvas} from '/runtime/html-in-canvas.js';
const stage = htmlCanvas(document.querySelector('#stage'));
defineScene({ready: stage.ready, render: () => stage.paint(() => {})});
</script>"#,
    )
    .await?;
    ensure!(result["ok"] == false, "the capture went on: {result}");
    ensure!(
        result["diagnostics"].to_string().contains("Chrome 157"),
        "expected the Chrome it needs, got {result}"
    );
    Ok(())
}

#[tokio::test]
#[ignore = "requires local Chromium and FFmpeg"]
async fn a_scene_failure_names_the_scene_and_the_project_file_in_plain_words() -> Result<()> {
    // The picture is missing, and the HTML that names it is built after `htmlCanvas()`.
    let result = check_scene(
        r#"<!doctype html><style>.tile{width:100px;height:100px;background:url('../assets/gone.png')}</style>
<canvas id="stage"></canvas><script type="module">
import {defineScene} from '/runtime/scene.js';
import {htmlCanvas} from '/runtime/html-in-canvas.js';
const stage = htmlCanvas(document.querySelector('#stage'));
stage.canvas.innerHTML = '<div drawable><div class="tile"></div></div>';
defineScene({ready: stage.ready, render: () => stage.paint(() => {})});
</script>"#,
    )
    .await?;
    let said = result["diagnostics"][0]["message"]
        .as_str()
        .context("no diagnostic")?;
    ensure!(
        said.starts_with("scenes/markers.html [first]: Image failed: assets/gone.png (404)"),
        "expected the scene and the file, got {said}"
    );
    ensure!(
        !said.contains("http://") && !said.contains("ExceptionDetails"),
        "the message carries the server's address or the browser's record: {said}"
    );
    Ok(())
}

#[tokio::test]
#[ignore = "requires local Chromium and FFmpeg"]
async fn encoder_failure_leaves_existing_output_unchanged() -> Result<()> {
    let directory = project()?;
    let output = directory.path().join("existing.mp4");
    fs::write(&output, b"previous output")?;
    let mut command = process::command(env!("CARGO_BIN_EXE_superint-video"));
    command
        .args(["render"])
        .arg(directory.path())
        .args(["--output"])
        .arg(&output)
        .args(["--overwrite"])
        .env("SUPERINT_NO_STUDIO", "1")
        // ffprobe accepts no encoder pipeline arguments, producing a real spawnable
        // encoder failure without mutating the test process's environment.
        .env("SUPERINT_FFMPEG", process::binary("ffprobe"));
    let result = process::output(command, &CancellationToken::new(), Duration::from_secs(45)).await;
    let error = result.expect_err("invalid encoder succeeded");
    ensure!(
        format!("{error:#}").contains("FFmpeg"),
        "encoder error lacks useful context: {error:#}"
    );
    ensure!(
        fs::read(&output)? == b"previous output",
        "failed encode replaced existing output"
    );
    ensure!(
        !fs::read_dir(directory.path())?.any(|entry| entry.is_ok_and(|entry| entry
            .file_name()
            .to_string_lossy()
            .starts_with(".superint-render-"))),
        "failed encode left staging folder"
    );
    directory.close()?;
    Ok(())
}
