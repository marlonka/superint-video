//! `rebuild`: an existing video made into an editable film and measured against it.
//!
//! `open` starts the film at the source's own size, rate and length, with the source's sound as
//! one clip and its shots listed. `look` shows a run of source frames and measures them: changes
//! inside a region, the box of what is drawn, the colours of the ground. `lift` cuts a region of
//! the source into the film's assets with the clip that puts it back on its own box. `compare`
//! scores the film against the source, at a few frames straight from the scenes or over a whole
//! render, and leaves lifted footage out of the score that says how well the rest was rebuilt.
//! The tool measures and cuts; what is rebuilt and how stays with the author.
pub mod decode;
pub mod measure;

use crate::{
    home::{self, Settings},
    media,
    model::{ClipType, Fps, Manifest},
    process,
    project::{ProjectStore, atomic_write, display_path, without_verbatim},
    renderer,
};
use anyhow::{Context, Result, ensure};
use decode::{Pixels, Stream, Take};
use image::{Rgb, RgbImage, imageops};
use measure::{Change, Kind};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    collections::BTreeSet,
    path::{Path, PathBuf},
    time::Duration,
};
use tokio_util::sync::CancellationToken;

/// The film's record of its source, its shots and what was lifted from it.
pub const RECORD: &str = "process/rebuild.json";
/// Where lifted footage goes.
const LIFTED: &str = "assets/lifted";
/// Containers whose sound plays in Studio as well as in the render.
const CONTAINERS: &[&str] = &["mp4", "m4v", "mov", "webm", "mkv"];
/// Largest tile of a strip or of the shot sheet.
const TILE: (u32, u32) = (384, 216);
/// The size pictures are scored at: large enough for type, small enough for a long film.
const ANALYSIS: u32 = 480;
/// Score below which a run of frames counts as a weak stretch.
const WEAK: f64 = 0.6;
/// Frames a cut in the film may sit from the source's and still count as the same cut.
const CUT_TOLERANCE: u64 = 2;
/// Weakest moments a full comparison pictures.
const WORST: usize = 6;
/// Lifts of the whole picture may cover at most this share of the film.
const WHOLE_PICTURE_SHARE: f64 = 0.9;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Record {
    pub version: u32,
    /// The source as copied into the film, project-relative.
    pub source: String,
    pub width: u32,
    pub height: u32,
    pub fps: Fps,
    /// Frames of the source at `fps`.
    pub frames: u64,
    /// The source has no steady frame rate; `fps` is the nearest common rate.
    pub vfr: bool,
    /// Seconds of sound, or None for a silent source.
    pub audio: Option<f64>,
    pub changes: Vec<Change>,
    #[serde(default)]
    pub lifts: Vec<Lift>,
}

/// A region of the source cut into the film.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Lift {
    pub id: String,
    /// Project-relative file.
    pub file: String,
    /// x, y, w, h in source pixels.
    pub region: [u32; 4],
    pub from: u64,
    pub to: u64,
    pub still: bool,
    /// Boxes painted out of it, in source pixels.
    #[serde(default)]
    pub cleaned: Vec<[u32; 4]>,
}

impl Record {
    pub fn load(root: &Path) -> Result<Self> {
        let path = root.join(RECORD);
        let bytes = std::fs::read(&path).with_context(|| {
            format!(
                "{} has no {RECORD}: start a rebuild with `superint-video rebuild open <video>`",
                root.display()
            )
        })?;
        serde_json::from_slice(&bytes).with_context(|| format!("Reading {RECORD}"))
    }
    fn save(&self, root: &Path) -> Result<()> {
        std::fs::create_dir_all(root.join("process"))?;
        atomic_write(&root.join(RECORD), &serde_json::to_vec_pretty(self)?)
    }
    fn source_path(&self, root: &Path) -> PathBuf {
        root.join(&self.source)
    }
    fn full(&self) -> (u32, u32) {
        (self.width, self.height)
    }
    /// The shots: the first frame of each, from the cuts and dissolves.
    pub fn shot_starts(&self) -> Vec<u64> {
        let mut starts = vec![0];
        for c in &self.changes {
            match c.kind {
                Kind::Cut => starts.push(c.frame),
                Kind::Dissolve => starts.push(c.to),
                _ => {}
            }
        }
        starts.dedup();
        starts
    }
}

// ------------------------------------------------------------------------------------- source

/// What a source is, read from ffprobe.
#[derive(Debug, Clone, PartialEq)]
pub struct Facts {
    pub width: u32,
    pub height: u32,
    pub fps: Fps,
    pub vfr: bool,
    pub audio: Option<f64>,
}

fn rate(text: &str) -> Option<Fps> {
    let (n, d) = text.split_once('/')?;
    let (n, d) = (n.trim().parse::<u64>().ok()?, d.trim().parse::<u64>().ok()?);
    if n == 0 || d == 0 {
        return None;
    }
    let g = gcd(n, d);
    Some(Fps {
        num: u32::try_from(n / g).ok()?,
        den: u32::try_from(d / g).ok()?,
    })
}
fn gcd(a: u64, b: u64) -> u64 {
    if b == 0 { a } else { gcd(b, a % b) }
}
fn value(f: Fps) -> f64 {
    f.num as f64 / f.den as f64
}

/// Rates a film is usually made at, for a source without a steady one.
const COMMON: [(u32, u32); 9] = [
    (24000, 1001),
    (24, 1),
    (25, 1),
    (30000, 1001),
    (30, 1),
    (48, 1),
    (50, 1),
    (60000, 1001),
    (60, 1),
];

pub fn facts(info: &Value) -> Result<Facts> {
    let streams = info["streams"].as_array().cloned().unwrap_or_default();
    let video = streams
        .iter()
        .find(|s| s["codec_type"] == "video" && s["disposition"]["attached_pic"] != 1)
        .context("The file has no picture")?;
    let transfer = video["color_transfer"].as_str().unwrap_or("");
    ensure!(
        transfer != "smpte2084" && transfer != "arib-std-b67",
        "The video is HDR. Export it as SDR (Rec. 709) first; the tool renders SDR only."
    );
    let sar = video["sample_aspect_ratio"].as_str().unwrap_or("1:1");
    ensure!(
        matches!(sar, "1:1" | "0:1" | "N/A" | ""),
        "The video has non-square pixels ({sar}). Export it with square pixels first."
    );
    let (mut width, mut height) = (
        video["width"]
            .as_u64()
            .context("The picture has no width")? as u32,
        video["height"]
            .as_u64()
            .context("The picture has no height")? as u32,
    );
    let rotation = video["side_data_list"]
        .as_array()
        .and_then(|l| l.iter().find_map(|d| d["rotation"].as_f64()))
        .or_else(|| video["tags"]["rotate"].as_str()?.parse::<f64>().ok())
        .unwrap_or(0.0);
    if (rotation.abs() - 90.0).abs() < 1.0 || (rotation.abs() - 270.0).abs() < 1.0 {
        std::mem::swap(&mut width, &mut height);
    }
    ensure!(
        width % 2 == 0 && height % 2 == 0,
        "The picture is {width} × {height}; an MP4 needs an even width and height. Export it at an even size first."
    );
    let real = video["r_frame_rate"].as_str().and_then(rate);
    let average = video["avg_frame_rate"].as_str().and_then(rate);
    let (fps, vfr) = match (real, average) {
        (Some(r), Some(a)) if (value(r) - value(a)).abs() / value(r) < 0.002 => (r, false),
        (r, a) => {
            let seen = a.or(r).context("The picture has no frame rate")?;
            let (num, den) = COMMON
                .iter()
                .copied()
                .min_by(|x, y| {
                    let d = |(n, d): (u32, u32)| (n as f64 / d as f64 - value(seen)).abs();
                    d(*x).total_cmp(&d(*y))
                })
                .unwrap_or((30, 1));
            (Fps { num, den }, true)
        }
    };
    ensure!(
        value(fps) <= 240.0,
        "The video runs at {:.1} frames per second; at most 240 are supported.",
        value(fps)
    );
    let audio = streams
        .iter()
        .find(|s| s["codec_type"] == "audio")
        .map(|s| {
            s["duration"]
                .as_str()
                .and_then(|d| d.parse::<f64>().ok())
                .or_else(|| media::duration(info))
                .unwrap_or(0.0)
        });
    Ok(Facts {
        width,
        height,
        fps,
        vfr,
        audio,
    })
}

/// A file name that is safe as a project path.
fn safe_name(text: &str) -> String {
    let name: String = text
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    let name = name.trim_matches('-').to_string();
    if name.is_empty() {
        "source".into()
    } else {
        name.chars().take(60).collect()
    }
}

/// A size that fits inside `bound` with the source's proportions, even on both sides.
fn fit(size: (u32, u32), bound: (u32, u32), grow: bool) -> (u32, u32) {
    let s = (bound.0 as f64 / size.0 as f64).min(bound.1 as f64 / size.1 as f64);
    let s = if grow { s } else { s.min(1.0) };
    let even = |v: f64| ((v / 2.0).round() as u32 * 2).max(2);
    (even(size.0 as f64 * s), even(size.1 as f64 * s))
}

// --------------------------------------------------------------------------------------- open

pub struct Open<'a> {
    pub video: &'a Path,
    pub name: Option<&'a str>,
    pub to: Option<PathBuf>,
}

/// A new film at the source's size, rate and length, with its sound and its shots.
pub async fn open(options: Open<'_>) -> Result<(PathBuf, Value)> {
    let video = options.video;
    ensure!(video.is_file(), "No video at {}", video.display());
    let ext = video
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    ensure!(
        CONTAINERS.contains(&ext.as_str()),
        "{} is not an MP4, MOV, WebM or MKV file. Convert it to MP4 first.",
        video.display()
    );
    let info = media::probe(video).await?;
    let facts = facts(&info)?;
    let stem = video
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("source");
    let name = home::film_name(options.name.unwrap_or(stem)).unwrap_or_else(|| "Rebuild".into());
    let root = match options.to {
        Some(dir) => dir,
        None => {
            let folder = home::films_dir(&Settings::current())
                .context("No films folder on this computer: give a folder with --to")?;
            std::fs::create_dir_all(&folder)?;
            home::new_film_dir(&folder, &name)
        }
    };
    ensure!(
        !root.exists() || std::fs::read_dir(&root)?.next().is_none(),
        "{} exists and is not empty",
        root.display()
    );
    for dir in ["source", LIFTED, "scenes", "renders", "process"] {
        std::fs::create_dir_all(root.join(dir))?;
    }
    let source = format!("source/{}.{ext}", safe_name(stem));
    std::fs::copy(video, root.join(&source))
        .with_context(|| format!("Copying {}", video.display()))?;
    std::fs::write(root.join(".gitignore"), ".superint/\nrenders/\n")?;

    // One pass over the picture: the frames as the film counts them, and their changes.
    let path = root.join(&source);
    let full = (facts.width, facts.height);
    let features = features(&path, facts.fps, full, None).await?;
    let frames = features.len() as u64;
    ensure!(frames > 0, "The video has no frames that can be read");
    let changes = measure::changes(&features, 0, measure::SHOTS);
    let audio_frames = facts
        .audio
        .map(|s| ((s * value(facts.fps)) + 1e-6).floor() as u64)
        .map(|f| f.min(frames));

    let mut clips = Vec::new();
    if let Some(n) = audio_frames.filter(|&n| n > 0) {
        clips.push(json!({
            "id": "source-sound", "type": "audio", "src": source, "track": "sound",
            "startFrame": 0, "durationFrames": n,
        }));
    }
    let manifest: Manifest = serde_json::from_value(json!({
        "version": 1, "name": name, "width": facts.width, "height": facts.height,
        "fps": facts.fps, "durationFrames": frames, "background": "#000000",
        "tracks": [
            {"id": "ground", "kind": "visual", "name": "Ground"},
            {"id": "lifted", "kind": "visual", "name": "Lifted"},
            {"id": "rebuilt", "kind": "visual", "name": "Rebuilt"},
            {"id": "sound", "kind": "audio", "name": "Source sound"},
        ],
        "clips": clips,
    }))?;
    manifest.validate()?;
    atomic_write(
        &root.join("video.json"),
        &serde_json::to_vec_pretty(&manifest)?,
    )?;
    let record = Record {
        version: 1,
        source: source.clone(),
        width: facts.width,
        height: facts.height,
        fps: facts.fps,
        frames,
        vfr: facts.vfr,
        audio: facts.audio,
        changes,
        lifts: Vec::new(),
    };
    record.save(&root)?;
    let root = ProjectStore::open(&root)?.root;
    let sheet = shot_sheet(&root, &record).await?;
    if let Some(home) = home::dir() {
        home::remember(&home, &root, &name, true);
    }
    let shots = record.shot_starts();
    let mut printed = json!({
        "project": display_path(&root)?,
        "name": name,
        "source": source,
        "width": facts.width,
        "height": facts.height,
        "fps": facts.fps,
        "frames": frames,
        "seconds": round2(facts.fps.seconds(frames)),
        "vfr": facts.vfr,
        "sound": audio_frames.map(|n| json!({"clip": "source-sound", "frames": n})),
        "shots": shots,
        "changes": record.changes,
        "sheet": sheet,
        "record": RECORD,
        "next": "Look at the sheet (the frame after every change), then write the shot map. Every shot and every change starts on its listed frame; read the frames around each with `rebuild look`.",
    });
    if facts.vfr {
        printed["note"] = json!(format!(
            "The source has no steady frame rate; the film runs at {}/{} and every count here is at that rate.",
            facts.fps.num, facts.fps.den
        ));
    }
    Ok((root, printed))
}

/// The 64 × 36 colour frames of a source (or of a range of it), for changes.
async fn features(
    path: &Path,
    fps: Fps,
    full: (u32, u32),
    range: Option<(u64, u64)>,
) -> Result<Vec<Vec<u8>>> {
    let (fw, fh) = measure::FEATURE;
    let take = Take {
        range,
        crop: None,
        scale: Some((fw as u32 * 2, fh as u32 * 2)),
    };
    let mut stream = Stream::open(path, fps, full, &take, Pixels::Rgb)?;
    let (w, h) = (stream.width as usize, stream.height as usize);
    let mut buffer = Vec::new();
    let mut out = Vec::new();
    while stream.next(&mut buffer).await? {
        out.push(measure::shrink_rgb(&buffer, w, h, fw, fh));
        if out.len() % 1800 == 0 {
            eprintln!("Read {} frames", out.len());
        }
    }
    stream.finish().await?;
    Ok(out)
}

/// The frames after every change on one sheet, for the shot map: the first frame of the film,
/// of every shot and of what every change brings.
async fn shot_sheet(root: &Path, record: &Record) -> Result<Value> {
    const MOST: usize = 120;
    let starts: BTreeSet<u64> = std::iter::once(0)
        .chain(record.changes.iter().map(|c| match c.kind {
            Kind::Dissolve | Kind::Flash => c.to,
            _ => c.frame,
        }))
        .take(MOST)
        .collect();
    let size = fit(record.full(), TILE, false);
    let take = Take {
        range: None,
        crop: None,
        scale: Some(size),
    };
    let mut stream = Stream::open(
        &record.source_path(root),
        record.fps,
        record.full(),
        &take,
        Pixels::Rgb,
    )?;
    let last = starts.last().copied().unwrap_or(0);
    let table = measure::css_levels();
    let mut buffer = Vec::new();
    let mut tiles = Vec::new();
    let mut frame = 0u64;
    while frame <= last && stream.next(&mut buffer).await? {
        if starts.contains(&frame) {
            let mut pixels = buffer.clone();
            measure::to_css(&mut pixels, &table);
            let tile = RgbImage::from_raw(size.0, size.1, pixels).context("tile")?;
            tiles.push((format!("F {frame}"), tile));
        }
        frame += 1;
    }
    stream.stop().await;
    let folder = root.join("renders/rebuild/shots");
    std::fs::create_dir_all(&folder)?;
    let file = folder.join("contact-sheet.png");
    sheet(&tiles).save(&file)?;
    Ok(json!({
        "file": without_verbatim(&file),
        "frames": tiles.len(),
        "more": (record.changes.len() + 1).saturating_sub(MOST),
    }))
}

// --------------------------------------------------------------------------------------- look

pub struct Look {
    pub range: (u64, u64),
    pub region: Option<[u32; 4]>,
    pub max: usize,
    pub events: bool,
    pub colours: Option<(usize, usize)>,
    pub ink: bool,
}

/// A run of source frames on a sheet, with what can be measured on them.
pub async fn look(root: &Path, options: Look) -> Result<Value> {
    let record = Record::load(root)?;
    let (from, to) = options.range;
    ensure!(from <= to, "The range {from}-{to} ends before it starts");
    ensure!(
        to < record.frames,
        "The source has frames 0 to {}; {to} is past its end",
        record.frames - 1
    );
    let region = match options.region {
        Some(r) => inside(r, record.full())?,
        None => [0, 0, record.width, record.height],
    };
    let count = (to - from + 1) as usize;
    let step = count.div_ceil(options.max.max(1)).max(1) as u64;
    let tile = fit((region[2], region[3]), tile_bound(region), true);
    let tile = (tile.0.max(2), tile.1.max(2));
    let take = Take {
        range: Some((from, to)),
        crop: (region != [0, 0, record.width, record.height]).then_some(region),
        scale: None,
    };
    let mut stream = Stream::open(
        &record.source_path(root),
        record.fps,
        record.full(),
        &take,
        Pixels::Rgb,
    )?;
    let (w, h) = (region[2] as usize, region[3] as usize);
    let event_size = {
        let (ew, eh) = fit((region[2], region[3]), (128, 72), false);
        (ew as usize, eh as usize)
    };
    let mut buffer = Vec::new();
    let (mut tiles, mut inks, mut features, mut sampled, mut pictures) =
        (Vec::new(), Vec::new(), Vec::new(), Vec::new(), Vec::new());
    let table = measure::css_levels();
    let mut frame = from;
    while frame <= to && stream.next(&mut buffer).await? {
        measure::to_css(&mut buffer, &table);
        if options.events {
            features.push(measure::shrink_rgb(
                &buffer,
                w,
                h,
                event_size.0,
                event_size.1,
            ));
        }
        if (frame - from) % step == 0 || frame == to {
            let picture =
                RgbImage::from_raw(w as u32, h as u32, buffer.clone()).context("frame")?;
            let small = imageops::resize(&picture, tile.0, tile.1, imageops::FilterType::Triangle);
            tiles.push((format!("F {frame}"), small));
            if options.ink {
                let found = measure::ink(&buffer, w, h);
                inks.push(json!({
                    "frame": frame,
                    "box": found.bounds.map(|b| [b[0] + region[0], b[1] + region[1], b[2], b[3]]),
                    "colour": found.colour, "ground": found.ground, "coverage": found.coverage,
                }));
            }
            sampled.push(frame);
            if options.colours.is_some() {
                pictures.push(picture);
            }
        }
        frame += 1;
    }
    stream.finish().await?;
    let folder = next_folder(&root.join("renders/rebuild/look"));
    std::fs::create_dir_all(&folder)?;
    let file = folder.join("contact-sheet.png");
    sheet(&tiles).save(&file)?;
    let mut printed = json!({
        "range": [from, to],
        "region": region,
        "step": step,
        "frames": sampled,
        "sheet": without_verbatim(&file),
    });
    if step > 1 {
        printed["note"] = json!(format!(
            "Every {step}th frame: the range holds more than {} frames. Look at a shorter range for every frame.",
            options.max
        ));
    }
    if options.events {
        let found = measure::changes(&features, from, measure::EVENTS);
        printed["events"] = json!(found);
    }
    if options.ink {
        printed["ink"] = json!(inks);
    }
    if let Some((cols, rows)) = options.colours {
        let picks = [0, pictures.len() / 2, pictures.len().saturating_sub(1)];
        let picks: BTreeSet<usize> = picks.into_iter().collect();
        printed["colours"] = json!(
            picks
                .into_iter()
                .filter_map(|i| Some((sampled.get(i)?, pictures.get(i)?)))
                .map(|(frame, p)| json!({
                    "frame": frame,
                    "grid": measure::colour_grid(p.as_raw(), w, h, cols, rows),
                }))
                .collect::<Vec<_>>()
        );
    }
    Ok(printed)
}

/// Wide regions such as a caption band get wider tiles.
fn tile_bound(region: [u32; 4]) -> (u32, u32) {
    let aspect = region[2] as f64 / region[3].max(1) as f64;
    if aspect > 3.5 { (768, 216) } else { TILE }
}

/// A region checked against the source's size.
fn inside(r: [u32; 4], (w, h): (u32, u32)) -> Result<[u32; 4]> {
    ensure!(r[2] >= 2 && r[3] >= 2, "The region {r:?} is empty");
    ensure!(
        r[0] + r[2] <= w && r[1] + r[3] <= h,
        "The region {},{},{},{} reaches past the {w} × {h} picture",
        r[0],
        r[1],
        r[2],
        r[3]
    );
    Ok(r)
}

/// `renders/…/<n>` with the next free number.
fn next_folder(base: &Path) -> PathBuf {
    let last = std::fs::read_dir(base)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|e| e.file_name().to_str()?.parse::<u32>().ok())
        .max()
        .unwrap_or(0);
    base.join((last + 1).to_string())
}

// --------------------------------------------------------------------------------------- lift

pub struct LiftOptions {
    pub region: Option<[u32; 4]>,
    pub range: (u64, u64),
    pub id: Option<String>,
    pub still: bool,
    pub clean: Vec<[u32; 4]>,
    pub add: bool,
    pub track: String,
}

/// The clip that shows a lifted region on its own box: the file is fitted into the frame
/// (object-fit: contain), so the transform scales it back to its size and moves its centre onto
/// the box's centre.
pub fn placement(region: [u32; 4], canvas: (u32, u32)) -> (f64, f64, f64) {
    let (w, h) = (region[2] as f64, region[3] as f64);
    let (cw, ch) = (canvas.0 as f64, canvas.1 as f64);
    let fitted = (cw / w).min(ch / h);
    (
        region[0] as f64 + w / 2.0 - cw / 2.0,
        region[1] as f64 + h / 2.0 - ch / 2.0,
        1.0 / fitted,
    )
}

/// A region widened to even pixels, which a video file needs, inside the picture.
fn even(r: [u32; 4], (w, h): (u32, u32)) -> [u32; 4] {
    let x0 = r[0] & !1;
    let y0 = r[1] & !1;
    let x1 = ((r[0] + r[2] + 1) & !1).min(w);
    let y1 = ((r[1] + r[3] + 1) & !1).min(h);
    [x0, y0, x1 - x0, y1 - y0]
}

pub async fn lift(root: &Path, options: LiftOptions) -> Result<Value> {
    let mut record = Record::load(root)?;
    let (from, to) = options.range;
    ensure!(from <= to, "The range {from}-{to} ends before it starts");
    ensure!(
        to < record.frames,
        "The source has frames 0 to {}; {to} is past its end",
        record.frames - 1
    );
    let full = [0, 0, record.width, record.height];
    let region = even(
        inside(options.region.unwrap_or(full), record.full())?,
        record.full(),
    );
    let frames = to - from + 1;
    ensure!(
        region != full || (frames as f64) < WHOLE_PICTURE_SHARE * record.frames as f64,
        "That lifts the whole picture for almost the whole film, which is the source itself, not a rebuild. Lift shot by shot, and only what cannot be rebuilt."
    );
    let id = options.id.as_deref().map(safe_name).unwrap_or_else(|| {
        if options.still {
            format!("still-{from}")
        } else {
            format!("lift-{from}-{to}")
        }
    });
    let file = format!(
        "{LIFTED}/{id}.{}",
        if options.still { "png" } else { "mp4" }
    );
    let out = root.join(&file);
    std::fs::create_dir_all(root.join(LIFTED))?;
    let replaced = out.exists();

    let fps = record.fps;
    let (seek, skip) = decode::seek(fps, from);
    let last = if options.still {
        skip + 1
    } else {
        skip + frames
    };
    let mut filters = vec![
        format!("fps={}/{}", fps.num, fps.den),
        format!("trim=start_frame={skip}:end_frame={last}"),
        "setpts=N/FRAME_RATE/TB".to_string(),
        format!(
            "crop={}:{}:{}:{}",
            region[2], region[3], region[0], region[1]
        ),
    ];
    let mut cleaned = Vec::new();
    for c in &options.clean {
        let c = inside(*c, record.full())?;
        // The box inside the lifted picture, kept a pixel from its edge, which delogo reads.
        let x0 = c[0].max(region[0] + 1).min(region[0] + region[2] - 2) - region[0];
        let y0 = c[1].max(region[1] + 1).min(region[1] + region[3] - 2) - region[1];
        let x1 = (c[0] + c[2]).min(region[0] + region[2] - 1) - region[0];
        let y1 = (c[1] + c[3]).min(region[1] + region[3] - 1) - region[1];
        ensure!(
            x1 > x0 + 1 && y1 > y0 + 1,
            "The box {c:?} to clean lies outside the lifted region"
        );
        filters.push(format!("delogo=x={x0}:y={y0}:w={}:h={}", x1 - x0, y1 - y0));
        cleaned.push(c);
    }
    if !options.still {
        // Written as BT.709 and tagged so, whatever the source says or leaves out. The player
        // shows a tagged frame as the render expects; an untagged one would come out lighter.
        filters.push(
            concat!(
                "format=gbrp,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,",
                "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv"
            )
            .into(),
        );
    }
    let mut cmd = process::command(process::binary("ffmpeg"));
    cmd.args(["-v", "error", "-nostdin", "-y"])
        .args(&seek)
        .arg("-i")
        .arg(record.source_path(root))
        .args(["-map", "0:v:0", "-an", "-sn", "-vf"])
        .arg(filters.join(","));
    if options.still {
        // The frame is saved in CSS levels and untagged: a scene shows it as it is, and the
        // render brings it back to the source's levels, as it does for a lifted video.
        cmd.args(["-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
        let mut bytes = process::output(cmd, &CancellationToken::new(), Duration::from_secs(600))
            .await
            .context("Lifting the region failed")?;
        measure::to_css(&mut bytes, &measure::css_levels());
        RgbImage::from_raw(region[2], region[3], bytes)
            .context("The lifted frame has the wrong size")?
            .save(&out)?;
    } else {
        cmd.args(["-c:v", "libx264", "-preset", "medium", "-crf", "12"])
            .args(["-pix_fmt", "yuv420p", "-movflags", "+faststart"])
            .args(["-color_primaries", "bt709", "-color_trc", "bt709"])
            .args(["-colorspace", "bt709", "-color_range", "tv"])
            .args(["-r", &format!("{}/{}", fps.num, fps.den)])
            .arg(&out);
        process::output(cmd, &CancellationToken::new(), Duration::from_secs(1800))
            .await
            .context("Lifting the region failed")?;
    }
    if !options.still {
        let info = media::probe(&out).await?;
        let made = info["streams"][0]["nb_frames"]
            .as_str()
            .and_then(|n| n.parse::<u64>().ok());
        if let Some(made) = made {
            ensure!(
                made == frames,
                "The lifted file has {made} frames, not {frames}; the source may skip frames here"
            );
        }
    }

    let (x, y, scale) = placement(region, record.full());
    let clip = json!({
        "id": id,
        "type": if options.still { "image" } else { "video" },
        "src": file,
        "track": options.track,
        "startFrame": from,
        "durationFrames": frames,
        "transform": {"x": x, "y": y, "scale": scale},
    });
    record.lifts.retain(|l| l.id != id);
    record.lifts.push(Lift {
        id: id.clone(),
        file: file.clone(),
        region,
        from,
        to,
        still: options.still,
        cleaned,
    });
    record.save(root)?;
    let crosses: Vec<&Change> = record
        .changes
        .iter()
        .filter(|c| c.frame > from && c.frame <= to && c.kind != Kind::Change)
        .collect();
    let mut printed = json!({
        "id": id,
        "file": file,
        "region": region,
        "frames": frames,
        "clip": clip,
        "replaced": replaced,
    });
    if !crosses.is_empty() {
        printed["crosses"] = json!(crosses);
        printed["note"] = json!(
            "The lift runs across cuts: after each, the region may show something else. Lift each shot on its own box."
        );
    }
    if options.add {
        let manifest = ProjectStore::open(root)?.manifest;
        let mut operations = Vec::new();
        if !manifest.tracks.iter().any(|t| t.id == options.track) {
            operations.push(json!({"type": "addTrack", "track": {"id": options.track, "kind": "visual", "name": "Lifted"}}));
        }
        if manifest.clips.iter().any(|c| c.id == id) {
            operations.push(json!({"type": "deleteClip", "id": id}));
        }
        operations.push(json!({"type": "addClip", "clip": clip}));
        let text = serde_json::to_string(&operations)?;
        let request = crate::edit::Request {
            operations: Some(&text),
            clip: None,
            props: &[],
            sets: &[],
            dry_run: false,
        };
        printed["added"] = crate::edit::run(root, &request).await?;
    } else {
        printed["next"] = json!(
            "Add the clip with `superint-video edit <dir> '{\"type\":\"addClip\",\"clip\":…}'`, or lift again with --add."
        );
    }
    let manifest = ProjectStore::open(root)?.manifest;
    printed["sourceShare"] = json!(round3(source_share(&manifest, &record)));
    Ok(printed)
}

/// Where lifted footage shows: (first frame, end frame, box in source pixels) per visible clip.
pub fn lifted_boxes(manifest: &Manifest, record: &Record) -> Vec<(u64, u64, [f64; 4])> {
    let canvas = (manifest.width as f64, manifest.height as f64);
    manifest
        .clips
        .iter()
        .filter(|c| matches!(c.clip_type, ClipType::Video | ClipType::Image) && !c.hidden)
        .filter(|c| manifest.tracks.iter().any(|t| t.id == c.track && !t.hidden))
        .filter_map(|c| {
            let lift = record.lifts.iter().find(|l| l.file == c.src)?;
            let (w, h) = (lift.region[2] as f64, lift.region[3] as f64);
            let fitted = (canvas.0 / w).min(canvas.1 / h) * c.transform.scale;
            let (dw, dh) = (w * fitted, h * fitted);
            let (cx, cy) = (
                canvas.0 / 2.0 + c.transform.x,
                canvas.1 / 2.0 + c.transform.y,
            );
            let x0 = (cx - dw / 2.0).max(0.0);
            let y0 = (cy - dh / 2.0).max(0.0);
            let x1 = (cx + dw / 2.0).min(canvas.0);
            let y1 = (cy + dh / 2.0).min(canvas.1);
            (x1 > x0 && y1 > y0).then_some((
                c.start_frame,
                c.end_frame(),
                [x0, y0, x1 - x0, y1 - y0],
            ))
        })
        .collect()
}

/// Share of the film's picture, area times frames, that is lifted footage.
pub fn source_share(manifest: &Manifest, record: &Record) -> f64 {
    let total = manifest.width as f64 * manifest.height as f64 * manifest.duration_frames as f64;
    let lifted: f64 = lifted_boxes(manifest, record)
        .iter()
        .map(|(a, b, r)| r[2] * r[3] * (b.min(&manifest.duration_frames).saturating_sub(*a)) as f64)
        .sum();
    (lifted / total.max(1.0)).min(1.0)
}

// ------------------------------------------------------------------------------------ compare

pub struct CompareOptions {
    pub at: Vec<u64>,
    pub render: Option<PathBuf>,
    pub region: Option<[u32; 4]>,
    pub range: Option<(u64, u64)>,
    pub side_by_side: bool,
}

pub async fn compare(root: &Path, options: CompareOptions) -> Result<Value> {
    let record = Record::load(root)?;
    let mut store = ProjectStore::open(root)?;
    ensure!(
        store.manifest.width == record.width && store.manifest.height == record.height,
        "The film is {} × {} but the source is {} × {}; a rebuild keeps the source's size",
        store.manifest.width,
        store.manifest.height,
        record.width,
        record.height
    );
    let region = options
        .region
        .map(|r| inside(r, record.full()))
        .transpose()?;
    match options.render {
        Some(render) => {
            let render = if render.is_absolute() {
                render
            } else {
                root.join(render)
            };
            compare_render(
                root,
                &record,
                &store.manifest,
                &render,
                &options.range,
                options.side_by_side,
            )
            .await
        }
        None => {
            ensure!(
                !options.at.is_empty(),
                "Say what to compare: --at <frames> for moments straight from the scenes, or --render <mp4> for a whole render"
            );
            let snapshot = store.settled_snapshot()?;
            compare_at(root, &record, snapshot, &options.at, region).await
        }
    }
}

/// The analysis size of the source's picture.
fn analysis(record: &Record) -> (u32, u32) {
    fit(record.full(), (ANALYSIS, ANALYSIS), false)
}

/// Masks in analysis pixels for the lifted footage that shows at `frame`.
fn masks_at(boxes: &[(u64, u64, [f64; 4])], frame: u64, k: f64) -> Vec<[f64; 4]> {
    boxes
        .iter()
        .filter(|(a, b, _)| frame >= *a && frame < *b)
        .map(|(_, _, r)| [r[0] * k, r[1] * k, r[2] * k, r[3] * k])
        .collect()
}

/// The weakest grid cells of a picture, with their boxes in source pixels.
fn weakest(cells: &[f64], full: (u32, u32), n: usize) -> Vec<Value> {
    let mut indexed: Vec<(usize, f64)> = cells
        .iter()
        .copied()
        .enumerate()
        .filter(|(_, s)| s.is_finite())
        .collect();
    indexed.sort_by(|a, b| a.1.total_cmp(&b.1));
    indexed
        .into_iter()
        .take(n)
        .map(|(i, s)| {
            let (c, r) = ((i % measure::GRID) as u32, (i / measure::GRID) as u32);
            json!({"cell": [c, r], "box": cell_box(c, r, full), "score": round3(s)})
        })
        .collect()
}
fn cell_box(c: u32, r: u32, (w, h): (u32, u32)) -> [u32; 4] {
    let g = measure::GRID as u32;
    let (x0, y0) = (c * w / g, r * h / g);
    [x0, y0, (c + 1) * w / g - x0, (r + 1) * h / g - y0]
}

/// One frame of source and film scored side by side.
struct Scored {
    score: f64,
    rebuilt: Option<f64>,
    colour: f64,
    cells: Vec<f64>,
}
fn score(source: &RgbImage, film: &RgbImage, size: (u32, u32), masks: &[[f64; 4]]) -> Scored {
    let small = |p: &RgbImage| {
        if p.dimensions() == size {
            p.clone()
        } else {
            imageops::resize(p, size.0, size.1, imageops::FilterType::Triangle)
        }
    };
    let (a, b) = (small(source), small(film));
    let (ga, gb) = (measure::grey(a.as_raw()), measure::grey(b.as_raw()));
    let like = measure::likeness(&ga, &gb, size.0 as usize, size.1 as usize, masks);
    Scored {
        score: like.score,
        rebuilt: like.rebuilt,
        colour: measure::colour_difference(a.as_raw(), b.as_raw()),
        cells: like.cells,
    }
}

async fn compare_at(
    root: &Path,
    record: &Record,
    snapshot: crate::project::ProjectSnapshot,
    at: &[u64],
    region: Option<[u32; 4]>,
) -> Result<Value> {
    let frames: Vec<u64> = at
        .iter()
        .copied()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    for &f in &frames {
        ensure!(
            f < record.frames && f < snapshot.manifest.duration_frames,
            "Frame {f} is past the end of the film"
        );
    }
    let boxes = lifted_boxes(&snapshot.manifest, record);
    let share = source_share(&snapshot.manifest, record);
    let capture = renderer::Capture::open(snapshot.root.clone(), snapshot.manifest.clone()).await?;
    let mut films = Vec::new();
    let captured = async {
        for &f in &frames {
            let png = capture.frame(f).await?;
            films.push(image::load_from_memory(&png)?.to_rgb8());
        }
        Ok::<_, anyhow::Error>(())
    }
    .await;
    capture.close().await;
    captured?;
    let size = analysis(record);
    let k = size.0 as f64 / record.width as f64;
    let folder = next_folder(&root.join("renders/rebuild/compare"));
    std::fs::create_dir_all(&folder)?;
    let table = measure::css_levels();
    let mut rows = Vec::new();
    let mut printed = Vec::new();
    for (&frame, film) in frames.iter().zip(&films) {
        let mut source =
            decode::picture(&record.source_path(root), record.fps, record.full(), frame).await?;
        measure::to_css(&mut source, &table);
        let scored = score(&source, film, size, &masks_at(&boxes, frame, k));
        let worst = weakest(&scored.cells, record.full(), 3);
        let marks: Vec<[u32; 4]> = worst
            .iter()
            .filter_map(|w| serde_json::from_value(w["box"].clone()).ok())
            .collect();
        let picture = triptych(&source, film, &marks);
        let file = folder.join(format!("frame-{frame:06}.png"));
        picture.save(&file)?;
        let mut entry = json!({
            "frame": frame,
            "score": round3(scored.score),
            "rebuilt": scored.rebuilt.map(round3),
            "colour": round2(scored.colour),
            "weakest": worst,
            "picture": without_verbatim(&file),
        });
        if let Some(r) = region {
            let (a, b) = (crop(&source, r), crop(film, r));
            let (ia, ib) = (
                measure::ink(a.as_raw(), r[2] as usize, r[3] as usize),
                measure::ink(b.as_raw(), r[2] as usize, r[3] as usize),
            );
            let place = |i: &measure::Ink| i.bounds.map(|b| [b[0] + r[0], b[1] + r[1], b[2], b[3]]);
            let delta = match (ia.bounds, ib.bounds) {
                (Some(s), Some(f)) => json!({
                    "dx": f[0] as i64 - s[0] as i64, "dy": f[1] as i64 - s[1] as i64,
                    "dw": f[2] as i64 - s[2] as i64, "dh": f[3] as i64 - s[3] as i64,
                    "coverage": round3(ib.coverage - ia.coverage),
                }),
                _ => Value::Null,
            };
            let pair_file = folder.join(format!("region-{frame:06}.png"));
            pair(&a, &b).save(&pair_file)?;
            entry["region"] = json!({
                "box": r,
                "source": {"box": place(&ia), "colour": ia.colour, "ground": ia.ground, "coverage": ia.coverage},
                "film": {"box": place(&ib), "colour": ib.colour, "ground": ib.ground, "coverage": ib.coverage},
                "delta": delta,
                "picture": without_verbatim(&pair_file),
            });
        }
        rows.push(picture);
        printed.push(entry);
    }
    let sheet_file = folder.join("contact-sheet.png");
    stack(&rows).save(&sheet_file)?;
    Ok(json!({
        "frames": printed,
        "sheet": without_verbatim(&sheet_file),
        "sourceShare": round3(share),
        "layout": "Each picture: source | film | difference (bright where they differ); the weakest cells are outlined.",
    }))
}

async fn compare_render(
    root: &Path,
    record: &Record,
    manifest: &Manifest,
    render: &Path,
    range: &Option<(u64, u64)>,
    side_by_side: bool,
) -> Result<Value> {
    ensure!(render.is_file(), "No render at {}", render.display());
    let size = analysis(record);
    let k = size.0 as f64 / record.width as f64;
    let boxes = lifted_boxes(manifest, record);
    let first = range.map_or(0, |r| r.0);
    if let Some((a, b)) = range {
        ensure!(
            a <= b && *b < record.frames,
            "The range {a}-{b} is outside the source"
        );
    }
    let take = Take {
        range: *range,
        crop: None,
        scale: Some(size),
    };
    let film_info = media::probe(render).await?;
    let film_facts = facts(&film_info)?;
    let mut source = Stream::open(
        &record.source_path(root),
        record.fps,
        record.full(),
        &take,
        Pixels::Rgb,
    )?;
    let mut film = Stream::open(
        render,
        record.fps,
        (film_facts.width, film_facts.height),
        &take,
        Pixels::Rgb,
    )?;
    let (fw, fh) = measure::FEATURE;
    let (mut a, mut b) = (Vec::new(), Vec::new());
    let (mut fa, mut fb) = (Vec::new(), Vec::new());
    let mut scores: Vec<(f64, Option<f64>, f64)> = Vec::new();
    let mut empty = Vec::new();
    let (mut source_frames, mut film_frames) = (0u64, 0u64);
    loop {
        let has_a = source.next(&mut a).await?;
        let has_b = film.next(&mut b).await?;
        source_frames += has_a as u64;
        film_frames += has_b as u64;
        if !(has_a && has_b) {
            if has_a {
                while source.next(&mut a).await? {
                    source_frames += 1;
                }
            }
            if has_b {
                while film.next(&mut b).await? {
                    film_frames += 1;
                }
            }
            break;
        }
        let frame = first + scores.len() as u64;
        let (ga, gb) = (measure::grey(&a), measure::grey(&b));
        let (w, h) = (size.0 as usize, size.1 as usize);
        let like = measure::likeness(&ga, &gb, w, h, &masks_at(&boxes, frame, k));
        scores.push((like.score, like.rebuilt, measure::colour_difference(&a, &b)));
        empty.push(measure::spread(&gb) < 2.0 && measure::spread(&ga) > 6.0);
        fa.push(measure::shrink_rgb(&a, w, h, fw, fh));
        fb.push(measure::shrink_rgb(&b, w, h, fw, fh));
        if scores.len().is_multiple_of(900) {
            eprintln!("Compared {} frames", scores.len());
        }
    }
    source.finish().await?;
    film.finish().await?;
    ensure!(!scores.is_empty(), "The render has no frames to compare");

    let mean = |v: Vec<f64>| (!v.is_empty()).then(|| v.iter().sum::<f64>() / v.len() as f64);
    let all = mean(scores.iter().map(|s| s.0).collect()).unwrap_or(0.0);
    let rebuilt = mean(scores.iter().filter_map(|s| s.1).collect());
    let colour = mean(scores.iter().map(|s| s.2).collect()).unwrap_or(0.0);
    // What was rebuilt is judged; a frame that is all lifted footage has nothing to fix.
    let judged: Vec<Option<f64>> = scores.iter().map(|s| s.1).collect();

    // Cuts of both, found the same way, matched within a frame or two.
    let ours = measure::changes(&fb, first, measure::SHOTS);
    let theirs = measure::changes(&fa, first, measure::SHOTS);
    let (mut missed, mut shifted) = (Vec::new(), Vec::new());
    let mut used = vec![false; ours.len()];
    for t in &theirs {
        let best = ours
            .iter()
            .enumerate()
            .filter(|(i, o)| !used[*i] && o.frame.abs_diff(t.frame) <= CUT_TOLERANCE)
            .min_by_key(|(_, o)| o.frame.abs_diff(t.frame));
        match best {
            Some((i, o)) => {
                used[i] = true;
                if o.frame != t.frame {
                    shifted.push(json!({"frame": t.frame, "by": o.frame as i64 - t.frame as i64, "kind": t.kind}));
                }
            }
            None => missed.push(json!({"frame": t.frame, "kind": t.kind, "to": t.to})),
        }
    }
    let extra: Vec<Value> = ours
        .iter()
        .zip(&used)
        .filter(|(_, u)| !**u)
        .map(|(o, _)| json!({"frame": o.frame, "kind": o.kind, "to": o.to}))
        .collect();

    // Weak and empty stretches.
    let shortest = (value(record.fps) / 4.0).ceil().max(3.0) as usize;
    let runs = |flags: &[bool]| {
        let mut out = Vec::new();
        let mut i = 0;
        while i < flags.len() {
            if !flags[i] {
                i += 1;
                continue;
            }
            let start = i;
            while i < flags.len() && flags[i] {
                i += 1;
            }
            if i - start >= shortest {
                out.push((start, i - 1));
            }
        }
        out
    };
    let weak_flags: Vec<bool> = judged.iter().map(|s| s.is_some_and(|s| s < WEAK)).collect();
    let mut weak: Vec<Value> = runs(&weak_flags)
        .into_iter()
        .map(|(s, e)| {
            let m = judged[s..=e].iter().flatten().sum::<f64>() / (e - s + 1) as f64;
            json!({"from": first + s as u64, "to": first + e as u64, "score": round3(m)})
        })
        .collect();
    weak.truncate(20);
    let empty: Vec<Value> = runs(&empty)
        .into_iter()
        .map(|(s, e)| json!({"from": first + s as u64, "to": first + e as u64}))
        .collect();

    // The weakest moments, at least a second apart, pictured.
    let mut order: Vec<(usize, f64)> = judged
        .iter()
        .enumerate()
        .filter_map(|(i, s)| Some((i, (*s)?)))
        .collect();
    order.sort_by(|x, y| x.1.total_cmp(&y.1));
    let apart = value(record.fps).round() as usize;
    let mut picks: Vec<usize> = Vec::new();
    for (i, _) in order {
        if picks.len() == WORST {
            break;
        }
        if picks.iter().all(|&p| p.abs_diff(i) >= apart) {
            picks.push(i);
        }
    }
    picks.sort();
    let folder = next_folder(&root.join("renders/rebuild/compare"));
    std::fs::create_dir_all(&folder)?;
    let mut worst = Vec::new();
    let mut rows = Vec::new();
    for i in picks {
        let frame = first + i as u64;
        let src =
            decode::picture(&record.source_path(root), record.fps, record.full(), frame).await?;
        let ours = decode::picture(
            render,
            record.fps,
            (film_facts.width, film_facts.height),
            frame,
        )
        .await?;
        let ours = if ours.dimensions() == src.dimensions() {
            ours
        } else {
            imageops::resize(
                &ours,
                src.width(),
                src.height(),
                imageops::FilterType::Triangle,
            )
        };
        let scored = score(&src, &ours, size, &masks_at(&boxes, frame, k));
        let cells = weakest(&scored.cells, record.full(), 3);
        let marks: Vec<[u32; 4]> = cells
            .iter()
            .filter_map(|w| serde_json::from_value(w["box"].clone()).ok())
            .collect();
        let picture = triptych(&src, &ours, &marks);
        let file = folder.join(format!("frame-{frame:06}.png"));
        picture.save(&file)?;
        rows.push(picture);
        worst.push(json!({
            "frame": frame,
            "score": round3(scores[i].0),
            "rebuilt": scores[i].1.map(round3),
            "colour": round2(scores[i].2),
            "weakest": cells,
            "picture": without_verbatim(&file),
        }));
    }
    let sheet_file = folder.join("contact-sheet.png");
    stack(&rows).save(&sheet_file)?;

    // How far the film's sound runs behind the source's.
    let from_s = record.fps.seconds(first);
    let span = range.map(|(a, b)| record.fps.seconds(b - a + 1));
    let sound = match (
        decode::samples(&record.source_path(root), 8000, from_s, span).await?,
        decode::samples(render, 8000, from_s, span).await?,
    ) {
        (Some(x), Some(y)) => {
            const HOP: usize = 8; // 1 ms at 8 kHz
            let limit = 120_000 * HOP;
            let (x, y) = (&x[..x.len().min(limit)], &y[..y.len().min(limit)]);
            match measure::lag(&measure::envelope(x, HOP), &measure::envelope(y, HOP), 500) {
                Some((ms, r)) => json!({
                    "offsetMs": ms,
                    "offsetFrames": round2(ms as f64 * value(record.fps) / 1000.0),
                    "match": r,
                }),
                None => json!({"note": "Too quiet or too short to line up"}),
            }
        }
        (None, None) => json!({"note": "Neither has sound"}),
        (None, _) => json!({"note": "The source has no sound"}),
        (_, None) => json!({"note": "The render has no sound"}),
    };

    let mut printed = json!({
        "frames": {"source": source_frames, "film": film_frames, "compared": scores.len()},
        "score": {"all": round3(all), "rebuilt": rebuilt.map(round3), "colour": round2(colour)},
        "sourceShare": round3(source_share(manifest, record)),
        "cuts": {"source": theirs.len(), "film": ours.len(), "missed": missed, "extra": extra, "shifted": shifted},
        "sound": sound,
        "weak": weak,
        "empty": empty,
        "worst": worst,
        "sheet": without_verbatim(&sheet_file),
        "layout": "Each picture: source | film | difference (bright where they differ); the weakest cells are outlined.",
    });
    if source_frames != film_frames {
        printed["length"] = json!(format!(
            "The film has {film_frames} frames and the source {source_frames}"
        ));
    }
    if side_by_side {
        printed["sideBySide"] = json!(without_verbatim(
            &side_by_side_file(root, record, render, range).await?
        ));
    }
    Ok(printed)
}

/// Source and film next to each other in one MP4 with the film's sound, to watch both at once.
async fn side_by_side_file(
    root: &Path,
    record: &Record,
    render: &Path,
    range: &Option<(u64, u64)>,
) -> Result<PathBuf> {
    let out = root.join("renders/rebuild/side-by-side.mp4");
    std::fs::create_dir_all(out.parent().unwrap())?;
    let height = (record.height.min(720) / 2) * 2;
    let fps = format!("{}/{}", record.fps.num, record.fps.den);
    let mut trim = String::new();
    if let Some((a, b)) = range {
        trim = format!(
            ",trim=start_frame={a}:end_frame={},setpts=N/FRAME_RATE/TB",
            b + 1
        );
    }
    let graph = format!(
        "[0:v]fps={fps}{trim},scale=-2:{height}[a];[1:v]fps={fps}{trim},scale=-2:{height}[b];[a][b]hstack=inputs=2[v]"
    );
    let mut cmd = process::command(process::binary("ffmpeg"));
    cmd.args(["-v", "error", "-nostdin", "-y", "-i"])
        .arg(record.source_path(root))
        .arg("-i")
        .arg(render)
        .args(["-filter_complex", &graph, "-map", "[v]", "-map", "1:a?"]);
    if let Some((a, b)) = range {
        cmd.args([
            "-af",
            &format!(
                "atrim=start={}:end={},asetpts=N/SR/TB",
                decode::time(record.fps, *a),
                decode::time(record.fps, b + 1)
            ),
        ]);
    }
    cmd.args([
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    ])
    .args([
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
    ])
    .arg(&out);
    process::output(cmd, &CancellationToken::new(), Duration::from_secs(3600))
        .await
        .context("Writing the side-by-side film failed")?;
    Ok(out)
}

// ------------------------------------------------------------------------------------ pictures

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}
fn round3(v: f64) -> f64 {
    (v * 1000.0).round() / 1000.0
}

fn crop(p: &RgbImage, r: [u32; 4]) -> RgbImage {
    imageops::crop_imm(p, r[0], r[1], r[2], r[3]).to_image()
}

/// Labelled tiles in rows, as many to a row as fit in about 1600 pixels.
fn sheet(tiles: &[(String, RgbImage)]) -> RgbImage {
    let tw = tiles.iter().map(|t| t.1.width()).max().unwrap_or(TILE.0);
    let th = tiles.iter().map(|t| t.1.height()).max().unwrap_or(TILE.1);
    let columns = (1600 / (tw + 8)).clamp(1, 6).min(tiles.len().max(1) as u32);
    let rows = (tiles.len() as u32).div_ceil(columns).max(1);
    let (cw, ch) = (tw + 8, th + 28);
    let mut out = RgbImage::from_pixel(columns * cw, rows * ch, Rgb([16, 17, 19]));
    for (i, (text, tile)) in tiles.iter().enumerate() {
        let (x, y) = (i as u32 % columns * cw + 4, i as u32 / columns * ch + 4);
        imageops::overlay(&mut out, tile, x as i64, y as i64);
        renderer::label(&mut out, x + 4, y + th + 6, text);
    }
    out
}

/// Source, film and their difference next to each other, the weakest cells outlined in red.
fn triptych(source: &RgbImage, film: &RgbImage, marks: &[[u32; 4]]) -> RgbImage {
    let (pw, ph) = fit(source.dimensions(), (640, 640), false);
    let k = pw as f64 / source.width() as f64;
    let a = imageops::resize(source, pw, ph, imageops::FilterType::Triangle);
    let b = imageops::resize(film, pw, ph, imageops::FilterType::Triangle);
    let mut diff = RgbImage::new(pw, ph);
    for (d, (p, q)) in diff.pixels_mut().zip(a.pixels().zip(b.pixels())) {
        let v = (0..3)
            .map(|c| (p[c] as i32 - q[c] as i32).unsigned_abs())
            .max()
            .unwrap_or(0);
        let v = (v * 3).min(255) as u8;
        *d = Rgb([v, (v as u32 * 2 / 3) as u8, (v as u32 / 4) as u8]);
    }
    let gap = 6;
    let mut out = RgbImage::from_pixel(pw * 3 + gap * 2, ph, Rgb([16, 17, 19]));
    for (i, panel) in [a, b, diff].iter().enumerate() {
        let x = i as u32 * (pw + gap);
        imageops::overlay(&mut out, panel, x as i64, 0);
        for m in marks {
            let r = [
                x + (m[0] as f64 * k) as u32,
                (m[1] as f64 * k) as u32,
                ((m[2] as f64 * k) as u32).max(2),
                ((m[3] as f64 * k) as u32).max(2),
            ];
            outline(&mut out, r, Rgb([235, 64, 52]));
        }
    }
    out
}

/// The region of source and film next to each other, enlarged when small.
fn pair(source: &RgbImage, film: &RgbImage) -> RgbImage {
    let (w, h) = fit(source.dimensions(), (900, 300), true);
    let (w, h) = if w > source.width() * 4 {
        (source.width() * 4, source.height() * 4)
    } else {
        (w, h)
    };
    let a = imageops::resize(source, w, h, imageops::FilterType::Nearest);
    let b = imageops::resize(film, w, h, imageops::FilterType::Nearest);
    let mut out = RgbImage::from_pixel(w * 2 + 6, h, Rgb([16, 17, 19]));
    imageops::overlay(&mut out, &a, 0, 0);
    imageops::overlay(&mut out, &b, (w + 6) as i64, 0);
    out
}

/// Pictures one under the other.
fn stack(rows: &[RgbImage]) -> RgbImage {
    let rows = &rows[..rows.len().min(8)];
    let w = rows.iter().map(|r| r.width()).max().unwrap_or(2);
    let h: u32 = rows.iter().map(|r| r.height() + 6).sum::<u32>().max(2);
    let mut out = RgbImage::from_pixel(w, h, Rgb([16, 17, 19]));
    let mut y = 0;
    for r in rows {
        imageops::overlay(&mut out, r, 0, y as i64);
        y += r.height() + 6;
    }
    out
}

fn outline(p: &mut RgbImage, r: [u32; 4], colour: Rgb<u8>) {
    let (w, h) = p.dimensions();
    for t in 0..2 {
        for x in r[0]..(r[0] + r[2]).min(w) {
            for y in [r[1] + t, (r[1] + r[3]).saturating_sub(1 + t)] {
                if y < h {
                    p.put_pixel(x, y, colour);
                }
            }
        }
        for y in r[1]..(r[1] + r[3]).min(h) {
            for x in [r[0] + t, (r[0] + r[2]).saturating_sub(1 + t)] {
                if x < w {
                    p.put_pixel(x, y, colour);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_lifted_region_lands_back_on_its_own_box() {
        // A 400 × 200 photo at 1200, 300 in a 1920 × 1080 film. Fitted into the frame it grows
        // by 4.8 (the width is the limit), so the clip scales it back by 1 / 4.8.
        let (x, y, scale) = placement([1200, 300, 400, 200], (1920, 1080));
        let fitted = (1920.0f64 / 400.0).min(1080.0 / 200.0);
        assert!((scale - 1.0 / fitted).abs() < 1e-12);
        assert_eq!((x, y), (1200.0 + 200.0 - 960.0, 300.0 + 100.0 - 540.0));
        // Shown size and place, the way the player draws a clip.
        let shown = 400.0 * fitted * scale;
        assert!((shown - 400.0).abs() < 1e-9);
        assert_eq!(960.0 + x - shown / 2.0, 1200.0);
    }

    #[test]
    fn regions_are_widened_to_even_pixels_inside_the_picture() {
        assert_eq!(even([3, 5, 101, 51], (1920, 1080)), [2, 4, 102, 52]);
        assert_eq!(even([1910, 1070, 9, 9], (1920, 1080)), [1910, 1070, 10, 10]);
        assert!(inside([1900, 0, 40, 10], (1920, 1080)).is_err());
    }

    #[test]
    fn rates_and_odd_sources_are_read_from_ffprobe() {
        let info = |r: &str, a: &str| {
            json!({"streams": [
                {"codec_type": "video", "width": 1920, "height": 1080, "r_frame_rate": r, "avg_frame_rate": a},
                {"codec_type": "audio", "duration": "9.98"},
            ], "format": {"duration": "10.0"}})
        };
        let ntsc = facts(&info("30000/1001", "30000/1001")).unwrap();
        assert_eq!((ntsc.fps.num, ntsc.fps.den, ntsc.vfr), (30000, 1001, false));
        assert_eq!(ntsc.audio, Some(9.98));
        // A phone video: a steady base rate, an uneven average.
        let phone = facts(&info("90000/1", "28123/949")).unwrap();
        assert_eq!(
            (phone.fps.num, phone.fps.den, phone.vfr),
            (30000, 1001, true)
        );
        let mut hdr = info("25/1", "25/1");
        hdr["streams"][0]["color_transfer"] = json!("smpte2084");
        assert!(facts(&hdr).is_err());
        let mut portrait = info("25/1", "25/1");
        portrait["streams"][0]["side_data_list"] = json!([{"rotation": -90}]);
        let p = facts(&portrait).unwrap();
        assert_eq!((p.width, p.height), (1080, 1920));
    }

    #[test]
    fn lifted_clips_are_masked_where_they_show_and_count_toward_the_share() {
        let record = Record {
            version: 1,
            source: "source/a.mp4".into(),
            width: 1920,
            height: 1080,
            fps: Fps { num: 30, den: 1 },
            frames: 100,
            vfr: false,
            audio: None,
            changes: Vec::new(),
            lifts: vec![Lift {
                id: "photo".into(),
                file: "assets/lifted/photo.mp4".into(),
                region: [100, 100, 480, 270],
                from: 0,
                to: 49,
                still: false,
                cleaned: Vec::new(),
            }],
        };
        let (x, y, scale) = placement([100, 100, 480, 270], (1920, 1080));
        let manifest: Manifest = serde_json::from_value(json!({
            "version": 1, "width": 1920, "height": 1080, "fps": {"num": 30, "den": 1},
            "durationFrames": 100,
            "tracks": [{"id": "lifted", "kind": "visual"}],
            "clips": [{"id": "photo", "type": "video", "src": "assets/lifted/photo.mp4",
                "track": "lifted", "startFrame": 0, "durationFrames": 50,
                "transform": {"x": x, "y": y, "scale": scale}}],
        }))
        .unwrap();
        let boxes = lifted_boxes(&manifest, &record);
        assert_eq!(boxes.len(), 1);
        let (a, b, r) = boxes[0];
        assert_eq!((a, b), (0, 50));
        for (got, want) in r.iter().zip([100.0, 100.0, 480.0, 270.0]) {
            assert!((got - want).abs() < 1e-6, "{r:?}");
        }
        let share = source_share(&manifest, &record);
        assert!((share - 0.0625 * 0.5).abs() < 1e-9, "{share}");
        assert_eq!(masks_at(&boxes, 10, 0.25), vec![[25.0, 25.0, 120.0, 67.5]]);
        assert!(masks_at(&boxes, 50, 0.25).is_empty());
    }

    #[test]
    fn the_shot_sheet_starts_every_shot_once() {
        let record = Record {
            version: 1,
            source: String::new(),
            width: 2,
            height: 2,
            fps: Fps { num: 30, den: 1 },
            frames: 300,
            vfr: false,
            audio: None,
            changes: vec![
                Change {
                    frame: 40,
                    kind: Kind::Cut,
                    to: 40,
                    strength: 30.0,
                    share: 0.9,
                },
                Change {
                    frame: 60,
                    kind: Kind::Change,
                    to: 60,
                    strength: 9.0,
                    share: 0.2,
                },
                Change {
                    frame: 90,
                    kind: Kind::Flash,
                    to: 91,
                    strength: 80.0,
                    share: 1.0,
                },
                Change {
                    frame: 120,
                    kind: Kind::Dissolve,
                    to: 135,
                    strength: 40.0,
                    share: 0.9,
                },
            ],
            lifts: Vec::new(),
        };
        assert_eq!(record.shot_starts(), [0, 40, 135]);
    }
}
