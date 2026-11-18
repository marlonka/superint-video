//! A whole rebuild through FFmpeg and the real browser: a two-shot source is opened, its first
//! shot lifted, its second built as a scene from what `look` measured, rendered in parallel and
//! compared with the source.
use anyhow::{Context, Result, ensure};
use serde_json::{Value, json};
use std::{fs, path::Path, sync::Arc, time::Duration};
use superint_video::{
    edit, process,
    project::ProjectStore,
    rebuild::{self, CompareOptions, LiftOptions, Look, Open},
    renderer,
};
use tokio_util::sync::CancellationToken;

/// Two shots of two seconds at 30 fps, 640 × 360, with a tone: a white box on blue, cut at
/// frame 60 to a yellow box on dark red.
async fn source(path: &Path) -> Result<()> {
    let mut cmd = process::command(process::binary("ffmpeg"));
    cmd.args(["-v", "error", "-nostdin", "-y"])
        .args(["-f", "lavfi", "-i", "color=c=0x203060:s=640x360:r=30:d=2"])
        .args(["-f", "lavfi", "-i", "color=c=0x6a1c1c:s=640x360:r=30:d=2"])
        .args(["-f", "lavfi", "-i", "sine=f=330:d=4"])
        .args([
            "-filter_complex",
            "[0:v]drawbox=x=100:y=100:w=200:h=100:c=white:t=fill[a];\
             [1:v]drawbox=x=300:y=150:w=160:h=120:c=0xf2d040:t=fill[b];\
             [a][b]concat=n=2,format=yuv420p[v]",
        ])
        .args([
            "-map", "[v]", "-map", "2:a", "-c:v", "libx264", "-crf", "12",
        ])
        .args(["-c:a", "aac", "-shortest"])
        .arg(path);
    process::output(cmd, &CancellationToken::new(), Duration::from_secs(60)).await?;
    Ok(())
}

#[tokio::test]
#[ignore = "requires local Chrome and FFmpeg"]
async fn a_rebuild_is_opened_lifted_built_rendered_and_matches_its_source() -> Result<()> {
    let directory = tempfile::Builder::new()
        .prefix("superint-rebuild-")
        .tempdir()?;
    // The films list of this test, not the user's.
    // SAFETY: no other test in this binary reads the variable.
    unsafe { std::env::set_var("SUPERINT_HOME", directory.path().join("home")) };
    let video = directory.path().join("two shots.mp4");
    source(&video).await?;

    let (root, opened) = rebuild::open(Open {
        video: &video,
        name: Some("Two shots"),
        to: Some(directory.path().join("film")),
    })
    .await?;
    ensure!(opened["frames"] == 120, "{opened:#}");
    ensure!(opened["shots"] == json!([0, 60]), "{opened:#}");
    ensure!(opened["sound"]["clip"] == "source-sound", "{opened:#}");
    let manifest = ProjectStore::open(&root)?.manifest;
    ensure!((manifest.width, manifest.height) == (640, 360));

    // The first shot is lifted whole; the whole film at once is refused.
    let whole = rebuild::lift(
        &root,
        LiftOptions {
            region: None,
            range: (0, 119),
            id: None,
            still: false,
            clean: Vec::new(),
            add: false,
            track: "lifted".into(),
        },
    )
    .await;
    ensure!(whole.is_err(), "the whole source was lifted");
    let lifted = rebuild::lift(
        &root,
        LiftOptions {
            region: None,
            range: (0, 59),
            id: Some("first".into()),
            still: false,
            clean: Vec::new(),
            add: true,
            track: "lifted".into(),
        },
    )
    .await?;
    ensure!(lifted["clip"]["transform"] == json!({"x": 0.0, "y": 0.0, "scale": 1.0}));
    ensure!(lifted["sourceShare"] == 0.5, "{lifted:#}");

    // The second shot is built from what `look` measures, in CSS levels.
    let ground = rebuild::look(
        &root,
        Look {
            range: (90, 90),
            region: Some([0, 0, 64, 64]),
            max: 1,
            events: false,
            colours: Some((1, 1)),
            ink: false,
        },
    )
    .await?;
    let ground = ground["colours"][0]["grid"][0][0]
        .as_str()
        .context("ground colour")?
        .to_string();
    let boxed = rebuild::look(
        &root,
        Look {
            range: (90, 90),
            region: Some([200, 100, 400, 220]),
            max: 1,
            events: false,
            colours: None,
            ink: true,
        },
    )
    .await?;
    let ink = &boxed["ink"][0];
    let b: Vec<u64> = serde_json::from_value(ink["box"].clone())?;
    ensure!(b == [300, 150, 160, 120], "{ink:#}");
    let scene = format!(
        r#"<!doctype html><html><head><meta charset="utf-8"><style>
html,body{{margin:0;width:100%;height:100%;overflow:hidden;background:{ground}}}
#box{{position:absolute;left:{}px;top:{}px;width:{}px;height:{}px;background:{}}}
</style></head><body><div id="box"></div><script type="module">
import {{defineScene}} from '/runtime/scene.js'; defineScene({{render() {{}}}});
</script></body></html>"#,
        b[0],
        b[1],
        b[2],
        b[3],
        ink["colour"].as_str().context("ink colour")?
    );
    fs::write(root.join("scenes/second.html"), scene)?;
    let add = json!({"type": "addClip", "clip": {"id": "second", "type": "scene",
        "src": "scenes/second.html", "track": "rebuilt", "startFrame": 60, "durationFrames": 60}})
    .to_string();
    edit::run(
        &root,
        &edit::Request {
            operations: Some(&add),
            clip: None,
            props: &[],
            sets: &[],
            dry_run: false,
        },
    )
    .await?;

    // Straight from the scenes: the lifted frame has nothing rebuilt, the built one matches.
    let at = rebuild::compare(
        &root,
        CompareOptions {
            at: vec![30, 90],
            render: None,
            region: None,
            range: None,
            side_by_side: false,
        },
    )
    .await?;
    let frames = at["frames"].as_array().context("frames")?;
    ensure!(frames[0]["rebuilt"].is_null(), "{at:#}");
    ensure!(score(&frames[0]["score"]) > 0.97, "{at:#}");
    ensure!(score(&frames[1]["rebuilt"]) > 0.97, "{at:#}");
    ensure!(score(&frames[1]["colour"]) < 3.0, "{at:#}");

    // Rendered in parallel, with the lifted clip's frames shared between the workers.
    let output = root.join("renders/rebuild.mp4");
    let progress: renderer::ProgressFn = Arc::new(|_, _, _| {});
    renderer::render(
        ProjectStore::open(&root)?.snapshot()?,
        output.clone(),
        "final",
        "x264",
        false,
        None,
        Some(3),
        CancellationToken::new(),
        progress,
    )
    .await?;
    let whole = rebuild::compare(
        &root,
        CompareOptions {
            at: Vec::new(),
            render: Some(output),
            region: None,
            range: None,
            side_by_side: true,
        },
    )
    .await?;
    ensure!(whole["frames"]["film"] == 120, "{whole:#}");
    ensure!(whole["cuts"]["missed"] == json!([]), "{whole:#}");
    ensure!(whole["cuts"]["extra"] == json!([]), "{whole:#}");
    ensure!(
        whole["sound"]["offsetMs"]
            .as_i64()
            .is_some_and(|ms| ms.abs() <= 5),
        "{whole:#}"
    );
    ensure!(score(&whole["score"]["rebuilt"]) > 0.97, "{whole:#}");
    ensure!(score(&whole["score"]["colour"]) < 3.0, "{whole:#}");
    ensure!(whole["sourceShare"] == 0.5, "{whole:#}");
    ensure!(root.join("renders/rebuild/side-by-side.mp4").is_file());
    Ok(())
}

fn score(value: &Value) -> f64 {
    value.as_f64().unwrap_or(f64::NAN)
}
