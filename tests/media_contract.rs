//! Exact video sampling and audio placement through the real browser/encoder boundary.
use anyhow::{Context, Result, ensure};
use image::{Rgb, RgbImage};
use serde_json::json;
use std::{fs, path::Path, sync::Arc, time::Duration};
use superint_video::{
    audio, media,
    model::Manifest,
    process,
    project::ProjectStore,
    renderer::{self, Capture},
};
use tokio_util::sync::CancellationToken;

fn write_tones(path: &Path) -> Result<()> {
    // Two 10 ms synthetic bursts, at 105 ms and 205 ms in a 500 ms PCM source.
    let sample_count = 24_000u32;
    let data_bytes = sample_count * 2;
    let mut wav = Vec::with_capacity(data_bytes as usize + 44);
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&(36 + data_bytes).to_le_bytes());
    wav.extend_from_slice(b"WAVEfmt ");
    wav.extend_from_slice(&16u32.to_le_bytes());
    wav.extend_from_slice(&1u16.to_le_bytes());
    wav.extend_from_slice(&1u16.to_le_bytes());
    wav.extend_from_slice(&48_000u32.to_le_bytes());
    wav.extend_from_slice(&96_000u32.to_le_bytes());
    wav.extend_from_slice(&2u16.to_le_bytes());
    wav.extend_from_slice(&16u16.to_le_bytes());
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&data_bytes.to_le_bytes());
    for sample in 0..sample_count {
        let active = (5040..5520).contains(&sample) || (9840..10320).contains(&sample);
        let amplitude = if active {
            ((sample as f64 / 48.0 * std::f64::consts::TAU).sin() * 21_000.0) as i16
        } else {
            0
        };
        wav.extend_from_slice(&amplitude.to_le_bytes());
    }
    fs::write(path, wav)?;
    Ok(())
}

fn source_marker(image: &RgbImage, expected: u32) -> Result<()> {
    for bit in 0..8 {
        let level = if expected & (1 << bit) != 0 {
            255u8
        } else {
            0u8
        };
        let pixel = image.get_pixel(bit * 40 + 20, 330).0;
        ensure!(
            pixel.iter().all(|channel| channel.abs_diff(level) < 12),
            "source frame {expected}: bit {bit} expected {level}, found {pixel:?}"
        );
    }
    Ok(())
}

fn rms(samples: &[f32], from: usize, to: usize) -> f64 {
    let interval = &samples[from..to];
    (interval
        .iter()
        .map(|sample| (*sample as f64).powi(2))
        .sum::<f64>()
        / interval.len() as f64)
        .sqrt()
}

#[tokio::test]
#[ignore = "requires local FFmpeg"]
async fn shorter_video_stream_cannot_freeze_until_longer_audio_ends() -> Result<()> {
    let directory = tempfile::Builder::new()
        .prefix("superint-stream-bounds-")
        .tempdir()?;
    fs::create_dir(directory.path().join("assets"))?;
    let source = directory.path().join("assets/unequal.mp4");
    let mut command = process::command(process::binary("ffmpeg"));
    command
        .args([
            "-v",
            "error",
            "-nostdin",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=red:s=320x180:r=30:d=1",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:sample_rate=48000:duration=2",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
        ])
        .arg(&source);
    process::output(command, &CancellationToken::new(), Duration::from_secs(30)).await?;
    let info = media::probe(&source).await?;
    ensure!(
        media::duration(&info).is_some_and(|duration| duration > 1.99),
        "fixture container is not two seconds"
    );
    let manifest: Manifest = serde_json::from_value(json!({
        "version":1,"width":320,"height":180,"fps":{"num":30,"den":1},"durationFrames":45,
        "tracks":[{"id":"visuals","kind":"visual"}],
        "clips":[{"id":"video","type":"video","src":"assets/unequal.mp4","track":"visuals","startFrame":0,"durationFrames":45,"sourceOffsetFrames":0}]
    }))?;
    fs::write(
        directory.path().join("video.json"),
        serde_json::to_vec_pretty(&manifest)?,
    )?;
    let diagnostics = media::validate_media(directory.path(), &manifest).await;
    ensure!(
        diagnostics
            .iter()
            .any(|diagnostic| diagnostic["code"] == "source_bounds"
                && diagnostic["clipId"] == "video"),
        "1.5-second video accepted despite one-second video stream: {diagnostics:?}"
    );
    let service = media::MediaService::new(directory.path().to_path_buf());
    fs::write(
        directory.path().join("assets/graphic.svg"),
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100\" height=\"100\"/>",
    )?;
    fs::write(
        directory.path().join("assets/still.html"),
        "<!doctype html><p>Scene</p>",
    )?;
    for (path, kind) in [
        ("assets/graphic.svg", "image"),
        ("assets/still.html", "scene"),
    ] {
        let metadata = service.metadata(path).await?;
        ensure!(
            metadata["kind"] == kind && metadata["hasAudio"] == false,
            "supported static asset metadata failed: {metadata}"
        );
    }
    let result = service.frame(&manifest, "video", 44).await;
    ensure!(
        result.is_err(),
        "out-of-range frame repeated cached final video frame"
    );
    let metadata = service.metadata("assets/unequal.mp4").await?;
    ensure!(
        metadata["duration"]
            .as_f64()
            .is_some_and(|duration| (duration - 1.0).abs() < 0.001),
        "asset metadata used container duration: {metadata}"
    );
    let store = ProjectStore::open(directory.path())?;
    let check = renderer::check(store.snapshot()?).await?;
    ensure!(
        check["ok"] == false && check["sampledFrames"] == 0,
        "invalid source bounds reached visual sampling: {check}"
    );
    Ok(())
}

#[tokio::test]
#[ignore = "requires local Chromium and FFmpeg"]
async fn numbered_source_offsets_and_early_audio_keep_exact_timing() -> Result<()> {
    let directory = tempfile::Builder::new()
        .prefix("superint-media-contract-")
        .tempdir()?;
    let assets = directory.path().join("assets");
    fs::create_dir(&assets)?;
    // Lossless synthetic source: binary index in eight 40px squares, 30 fps.
    for frame in 0..20 {
        let mut image = RgbImage::from_pixel(640, 360, Rgb([24, 24, 24]));
        for bit in 0..8 {
            let level = if frame & (1 << bit) != 0 { 255 } else { 0 };
            for y in 300..360 {
                for x in bit * 40..(bit + 1) * 40 {
                    image.put_pixel(x, y, Rgb([level, level, level]));
                }
            }
        }
        image.save(assets.join(format!("source-{frame:02}.png")))?;
    }
    let mut command = process::command(process::binary("ffmpeg"));
    command
        .args(["-v", "error", "-nostdin", "-y", "-framerate", "30", "-i"])
        .arg(assets.join("source-%02d.png"))
        .args([
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-crf",
            "0",
            "-pix_fmt",
            "yuv444p",
        ])
        .arg(assets.join("numbered.mp4"));
    process::output(command, &CancellationToken::new(), Duration::from_secs(30)).await?;
    write_tones(&assets.join("impulses.wav"))?;
    let manifest: Manifest = serde_json::from_value(json!({
        "version":1,"width":640,"height":360,"fps":{"num":60,"den":1},"durationFrames":24,
        "tracks":[{"id":"visuals","kind":"visual"},{"id":"audio","kind":"audio"}],
        "clips":[
            {"id":"first","type":"video","src":"assets/numbered.mp4","track":"visuals","startFrame":0,"durationFrames":12,"sourceOffsetFrames":6},
            {"id":"reused","type":"video","src":"assets/numbered.mp4","track":"visuals","startFrame":12,"durationFrames":12,"sourceOffsetFrames":12},
            {"id":"burst-one","type":"audio","src":"assets/impulses.wav","track":"audio","startFrame":6,"durationFrames":6,"sourceOffsetFrames":6},
            {"id":"burst-two","type":"audio","src":"assets/impulses.wav","track":"audio","startFrame":18,"durationFrames":3,"sourceOffsetFrames":12}
        ]
    }))?;
    manifest.validate()?;
    fs::write(
        directory.path().join("video.json"),
        serde_json::to_vec_pretty(&manifest)?,
    )?;
    let capture = Capture::open(directory.path().to_path_buf(), manifest).await?;
    let result: Result<()> = async {
        // Explicit expected frame numbers protect timebase conversion, source reuse,
        // offsets, boundary selection and reverse/cache retrieval.
        for (frame, expected_source) in [
            (0, 3),
            (1, 3),
            (2, 4),
            (4, 5),
            (10, 8),
            (11, 8),
            (12, 6),
            (14, 7),
            (23, 11),
            (2, 4),
            (0, 3),
        ] {
            let image = image::load_from_memory(&capture.frame(frame).await?)?.to_rgb8();
            source_marker(&image, expected_source)
                .with_context(|| format!("project frame {frame}"))?;
        }
        Ok(())
    }
    .await;
    capture.close().await;
    result?;

    // Create a true VFR source: frames 0–10 remain 30 fps, subsequent frames 15 fps.
    let mut command = process::command(process::binary("ffmpeg"));
    command
        .args(["-v", "error", "-nostdin", "-y", "-i"])
        .arg(assets.join("numbered.mp4"))
        .args([
            "-vf",
            r"setpts=(N+max(0\,N-10))/(30*TB)",
            "-fps_mode",
            "vfr",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-crf",
            "0",
            "-pix_fmt",
            "yuv444p",
        ])
        .arg(assets.join("variable.mp4"));
    process::output(command, &CancellationToken::new(), Duration::from_secs(30)).await?;
    let mut command = process::command(process::binary("ffprobe"));
    command
        .args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_frames",
            "-show_entries",
            "frame=best_effort_timestamp",
            "-of",
            "json",
        ])
        .arg(assets.join("variable.mp4"));
    let bytes =
        process::output(command, &CancellationToken::new(), Duration::from_secs(30)).await?;
    let timestamps: serde_json::Value = serde_json::from_slice(&bytes)?;
    let timestamps: Vec<i64> = timestamps["frames"]
        .as_array()
        .context("VFR fixture has no frames")?
        .iter()
        .filter_map(|frame| frame["best_effort_timestamp"].as_i64())
        .collect();
    ensure!(
        timestamps.len() == 20 && timestamps[1] - timestamps[0] != timestamps[11] - timestamps[10],
        "synthetic source is not actually variable frame rate"
    );
    let mut variable: Manifest =
        serde_json::from_slice(&fs::read(directory.path().join("video.json"))?)?;
    variable.clips.truncate(1);
    variable.clips[0].src = "assets/variable.mp4".into();
    variable.clips[0].duration_frames = 24;
    variable.clips[0].source_offset_frames = 18;
    let capture = Capture::open(directory.path().to_path_buf(), variable).await?;
    let result: Result<()> = async {
        for (frame, expected_source) in [
            (0, 9),
            (1, 9),
            (2, 10),
            (5, 10),
            (6, 11),
            (9, 11),
            (10, 12),
            (23, 15),
        ] {
            let image = image::load_from_memory(&capture.frame(frame).await?)?.to_rgb8();
            source_marker(&image, expected_source)
                .with_context(|| format!("VFR project frame {frame}"))?;
        }
        Ok(())
    }
    .await;
    capture.close().await;
    result?;

    let store = ProjectStore::open(directory.path())?;
    let output = directory.path().join("renders/media.mp4");
    renderer::render(
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
    .await?;
    let info = media::probe(&output).await?;
    let streams = info["streams"].as_array().context("missing streams")?;
    let video = streams
        .iter()
        .find(|stream| stream["codec_type"] == "video")
        .context("missing video")?;
    ensure!(video["nb_frames"] == "24", "early audio truncated video");
    ensure!(
        video["avg_frame_rate"] == "60/1",
        "media export changed rate"
    );
    ensure!(
        streams.iter().any(|stream| stream["codec_type"] == "audio"),
        "audio not muxed"
    );
    let mut command = process::command(process::binary("ffmpeg"));
    command
        .args(["-v", "error", "-nostdin", "-i"])
        .arg(&output)
        .args(["-vn", "-ac", "1", "-ar", "48000", "-f", "f32le", "pipe:1"]);
    let bytes =
        process::output(command, &CancellationToken::new(), Duration::from_secs(30)).await?;
    let samples: Vec<f32> = bytes
        .as_chunks::<4>()
        .0
        .iter()
        .map(|bytes| f32::from_le_bytes(*bytes))
        .collect();
    ensure!(
        samples.len() >= 19_200 && samples.len() <= 20_480,
        "decoded AAC duration outside codec padding tolerance: {}",
        samples.len()
    );
    // AAC may smear a transient by one codec window. Wide windows verify placement;
    // separated silent regions catch untrimmed sources and accidental duplication.
    ensure!(
        rms(&samples, 0, 2400) < 0.004,
        "sound started before placement"
    );
    ensure!(
        rms(&samples, 4800, 5760) > 0.15,
        "first trimmed burst missing at 100–120ms"
    );
    ensure!(
        rms(&samples, 7200, 12_000) < 0.004,
        "source audio leaked between clips"
    );
    ensure!(
        rms(&samples, 14_400, 15_360) > 0.15,
        "reused source burst missing at 300–320ms"
    );
    ensure!(
        rms(&samples, 17_760, 19_200) < 0.004,
        "audio not padded with silence after early ending"
    );
    Ok(())
}

#[tokio::test]
#[ignore = "requires local Chromium and FFmpeg"]
async fn mono_voice_from_the_tool_mixes_into_both_channels() -> Result<()> {
    let directory = tempfile::Builder::new()
        .prefix("superint-mono-voice-")
        .tempdir()?;
    fs::create_dir(directory.path().join("scenes"))?;
    fs::create_dir(directory.path().join("audio"))?;
    fs::write(
        directory.path().join("scenes/markers.html"),
        include_str!("../examples/fixture/scenes/markers.html"),
    )?;
    // 24-bit mono as `voice assemble` writes it. FFmpeg reads its layout as "1 channels (FL)",
    // which the AAC encoder rejects and a plain stereo upmix would put on the left only.
    let tone: Vec<f32> = (0..48_000)
        .map(|n| (n as f32 / 48.0 * std::f32::consts::TAU).sin() * 0.5)
        .collect();
    audio::write_wav(&directory.path().join("audio/voice.wav"), &tone, 48_000)?;
    let manifest: Manifest = serde_json::from_value(json!({
        "version":1,"width":320,"height":180,"fps":{"num":30,"den":1},"durationFrames":30,
        "tracks":[{"id":"visuals","kind":"visual"},{"id":"voice","kind":"audio"}],
        "clips":[
            {"id":"scene","type":"scene","src":"scenes/markers.html","track":"visuals","startFrame":0,"durationFrames":30,"sourceOffsetFrames":0,"props":{"label":"V","color":"#4685f5"}},
            {"id":"voice","type":"audio","src":"audio/voice.wav","track":"voice","startFrame":0,"durationFrames":30,"sourceOffsetFrames":0}
        ]
    }))?;
    manifest.validate()?;
    fs::write(
        directory.path().join("video.json"),
        serde_json::to_vec_pretty(&manifest)?,
    )?;
    let store = ProjectStore::open(directory.path())?;
    let output = directory.path().join("renders/voice.mp4");
    renderer::render(
        store.snapshot()?,
        output.clone(),
        "final",
        "x264", // the other codec, so both encoders stay covered
        false,
        None,
        None,
        CancellationToken::new(),
        Arc::new(|_, _, _| {}),
    )
    .await?;
    let mut command = process::command(process::binary("ffmpeg"));
    command
        .args(["-v", "error", "-nostdin", "-i"])
        .arg(&output)
        .args(["-vn", "-ac", "2", "-ar", "48000", "-f", "f32le", "pipe:1"]);
    let bytes =
        process::output(command, &CancellationToken::new(), Duration::from_secs(30)).await?;
    let samples: Vec<f32> = bytes
        .as_chunks::<4>()
        .0
        .iter()
        .map(|bytes| f32::from_le_bytes(*bytes))
        .collect();
    let channel = |c: usize| -> Vec<f32> { samples.iter().skip(c).step_by(2).copied().collect() };
    let (left, right) = (channel(0), channel(1));
    ensure!(
        left.len() >= 40_000,
        "decoded audio too short: {}",
        left.len()
    );
    let (left, right) = (rms(&left, 4800, 40_000), rms(&right, 4800, 40_000));
    // A sine at 0.5 has an RMS of 0.354; both channels must carry it at the same level.
    ensure!(
        left > 0.3 && right > 0.3 && (left - right).abs() < 0.01,
        "mono voice not centred: left {left:.3}, right {right:.3}"
    );
    Ok(())
}
