//! `review`: the frames to critique after a full build, and the checks a machine can make
//! without judging taste. A grid every few seconds goes on a contact sheet with a worksheet row
//! per frame, strips show every frame of an exit, and a check camera gives close-ups. Over the
//! whole film it measures stretches where the picture stands still, actors the frame edge cuts
//! to a sliver, and highlights that miss what they mark. Judging stays with the author.
use crate::{
    model::{ClipType, Manifest},
    project::{ProjectSnapshot, without_verbatim},
    renderer::{self, Capture},
};
use anyhow::{Result, ensure};
use serde_json::{Value, json};
use std::{
    collections::{BTreeMap, BTreeSet},
    fmt::Write,
    path::{Path, PathBuf},
    time::Instant,
};

/// What one review pass captures.
pub struct Options {
    /// Seconds between grid frames; `None` skips the grid.
    pub every: Option<f64>,
    /// Start of the grid in seconds.
    pub offset: f64,
    /// Extra frames for the contact sheet.
    pub frames: Vec<u64>,
    /// Inclusive frame ranges captured frame by frame.
    pub strips: Vec<(u64, u64)>,
    /// Check camera x, y and zoom, for scenes that declare camX, camY and camZ.
    pub camera: Option<[f64; 3]>,
    /// A native-resolution crop x, y, w, h saved for every still.
    pub crop: Option<[u32; 4]>,
    /// Sample the whole film for static stretches.
    pub motion: bool,
}

/// Seconds without visible change after which a stretch counts as standing still.
pub const STATIC_SECONDS: f64 = 3.0;
/// Seconds between the samples that measure motion and edges over the whole film.
const SAMPLE_SECONDS: f64 = 0.5;
/// Mean luma difference (0–255, at 64 × 36) below which two samples show the same picture.
/// Measured on a busy canvas film, samples 0.5 s apart: idle motion alone (bobbing, blinks,
/// twinkling) differs by 1.0–1.2, a slow camera push by 1.5–2.6. A small pill appearing adds
/// only about 0.9, so a static stretch is a reason to look, not a verdict.
const STILL_LEVEL: f64 = 1.5;
/// Below this share of its box on screen, an actor reads as a sliver at the frame edge.
const SLIVER: f64 = 0.35;
/// Pixels a highlight may miss its target by.
const TARGET_TOLERANCE: f64 = 2.0;
/// Longest strip, so its sheet stays readable.
const STRIP_FRAMES: u64 = 90;

/// `600-615` → (600, 615), for `--strip`.
pub fn parse_range(text: &str) -> Result<(u64, u64), String> {
    let (from, to) = text
        .split_once('-')
        .ok_or("expected FROM-TO in frames, e.g. 600-615")?;
    let parse = |s: &str| s.trim().parse::<u64>().map_err(|e| format!("{s}: {e}"));
    let (from, to) = (parse(from)?, parse(to)?);
    if to < from {
        return Err(format!("strip {from}-{to} ends before it starts"));
    }
    if to - from >= STRIP_FRAMES {
        return Err(format!(
            "strip {from}-{to} is longer than {STRIP_FRAMES} frames; split it"
        ));
    }
    Ok((from, to))
}

/// `renders/review/<n>` with the next free number, so every pass keeps its own frames.
pub fn next_output(root: &Path) -> PathBuf {
    let base = root.join("renders").join("review");
    let last = std::fs::read_dir(&base)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| entry.file_name().to_str()?.parse::<u32>().ok())
        .max()
        .unwrap_or(0);
    base.join((last + 1).to_string())
}

pub async fn review(
    mut snapshot: ProjectSnapshot,
    options: &Options,
    output: &Path,
) -> Result<Value> {
    let started = Instant::now();
    let manifest = snapshot.manifest.clone();
    let fps = manifest.fps.num as f64 / manifest.fps.den as f64;
    let duration = manifest.duration_frames;
    if let Some(every) = options.every {
        ensure!(every * fps >= 1.0, "--every must be at least one frame");
    }
    ensure!(
        options.offset >= 0.0 && options.offset * fps < duration as f64,
        "--offset lies outside the film"
    );
    let grid = options
        .every
        .map(|every| grid(every, options.offset, fps, duration))
        .unwrap_or_default();
    let sheet: BTreeSet<u64> = grid.iter().chain(&options.frames).copied().collect();
    let strips: BTreeSet<u64> = options.strips.iter().flat_map(|&(a, b)| a..=b).collect();
    if let Some(&frame) = sheet.iter().chain(&strips).find(|&&f| f >= duration) {
        anyhow::bail!("Frame {frame} is outside the film ({duration} frames)");
    }
    if let Some([x, y, w, h]) = options.crop {
        ensure!(
            w > 0 && h > 0 && x + w <= manifest.width && y + h <= manifest.height,
            "--crop must lie inside the {}×{} frame",
            manifest.width,
            manifest.height
        );
    }
    // A close-up moves every actor, so edges and targets are measured only through the film camera.
    let measured = options.camera.is_none();
    let step = ((SAMPLE_SECONDS * fps).round() as usize).max(1);
    let samples: BTreeSet<u64> = if options.motion && measured {
        (0..duration).step_by(step).chain([duration - 1]).collect()
    } else {
        BTreeSet::new()
    };
    if let Some([x, y, z]) = options.camera {
        ensure!(z > 0.0, "--camera zoom must be above 0");
        for clip in snapshot
            .manifest
            .clips
            .iter_mut()
            .filter(|c| c.clip_type == ClipType::Scene)
        {
            clip.props.insert("camX".into(), json!(x));
            clip.props.insert("camY".into(), json!(y));
            clip.props.insert("camZ".into(), json!(z));
        }
    }
    std::fs::create_dir_all(output)?;
    let words = words(&snapshot.root, &manifest);
    let capture = Capture::open(snapshot.root.clone(), snapshot.manifest.clone()).await?;
    let result = async {
        let mut warnings = Vec::new();
        if options.camera.is_some() {
            let state = renderer::eval(&capture.page, "window.__superint.getState()").await?;
            let scenes: Vec<&str> = manifest
                .clips
                .iter()
                .filter(|c| c.clip_type == ClipType::Scene)
                .map(|c| c.id.as_str())
                .collect();
            let lacking: Vec<&str> = scenes
                .iter()
                .copied()
                .filter(|id| state["propDefinitions"][id]["camZ"].is_null())
                .collect();
            ensure!(
                lacking.len() < scenes.len(),
                "No scene declares the check camera (props camX, camY, camZ); use --crop for a close-up"
            );
            if !lacking.is_empty() {
                let message = "these scenes keep the film camera";
                warnings.push(json!({"code": "no-camera", "clips": lacking, "message": message}));
            }
        }
        let order: BTreeSet<u64> = sheet.iter().chain(&strips).chain(&samples).copied().collect();
        let order: Vec<u64> = order.into_iter().collect();
        let mut flags = Vec::new();
        let mut thumbs = BTreeMap::new();
        let mut boxes = BTreeMap::new();
        let mut signatures = Vec::new();
        let mut reported = false;
        for &frame in &order {
            let still = sheet.contains(&frame) || strips.contains(&frame);
            let (bytes, state) = capture.frame_state(frame, !still).await?;
            let actors = actors(&state);
            reported |= !actors.is_empty();
            if measured {
                let (width, height) = (manifest.width as f64, manifest.height as f64);
                flags.extend(edge_cuts(frame, &actors, width, height));
                flags.extend(off_target(frame, &actors));
            }
            if sheet.contains(&frame) {
                boxes.insert(frame, actors.iter().map(Actor::json).collect::<Vec<_>>());
            }
            let image = image::load_from_memory(&bytes)?;
            if samples.contains(&frame) {
                signatures.push((frame, signature(&image)));
            }
            if still {
                std::fs::write(output.join(format!("frame-{frame:06}.png")), &bytes)?;
                if let Some([x, y, w, h]) = options.crop {
                    image.crop_imm(x, y, w, h).save(output.join(format!("crop-{frame:06}.png")))?;
                }
                thumbs.insert(frame, image.thumbnail(384, 216).to_rgb8());
            }
        }
        let label = |frame: u64| format!("F {frame}  {:.1}s", frame as f64 / fps);
        let contact = (!sheet.is_empty()).then(|| output.join("contact-sheet.png"));
        let sheet_of = |frames: &mut dyn Iterator<Item = u64>| {
            let labelled: Vec<_> = frames.map(|f| (label(f), thumbs[&f].clone())).collect();
            renderer::contact_sheet(&labelled)
        };
        if let Some(path) = &contact {
            sheet_of(&mut sheet.iter().copied()).save(path)?;
        }
        let mut strip_files = Vec::new();
        for &(a, b) in &options.strips {
            let path = output.join(format!("strip-{a:06}-{b:06}.png"));
            sheet_of(&mut (a..=b)).save(&path)?;
            strip_files.push(path);
        }
        if measured && !reported {
            let message = "no scene reported actors, so edge cuts and highlight targets went unchecked; see scene-api.md";
            warnings.push(json!({"code": "no-actors", "message": message}));
        }
        let still = static_stretches(&signatures, (STATIC_SECONDS * fps).round() as u64);
        let still: Vec<Value> = still
            .iter()
            .map(|&(a, b)| json!({"from": a, "to": b, "seconds": round((b - a) as f64 / fps, 1)}))
            .collect();
        let findings = findings(&flags, &order, step as u64);
        let motion: Vec<Value> = signatures.windows(2)
            .map(|w| json!({"frame": w[1].0, "change": round(difference(&w[0].1, &w[1].1), 2)}))
            .collect();
        let pass = json!({
            "every": options.every, "offset": options.offset, "frames": options.frames,
            "strips": options.strips, "camera": options.camera, "crop": options.crop,
        });
        let rows: Vec<Value> = sheet
            .iter()
            .map(|&f| {
                let flagged: Vec<_> = flags.iter().filter(|x| x.frame == f).collect();
                json!({
                    "frame": f, "time": round(f as f64 / fps, 2),
                    "file": format!("frame-{f:06}.png"), "words": spoken(&words, f, fps),
                    "flags": flagged.into_iter().map(Flag::short).collect::<Vec<_>>(),
                    "actors": boxes[&f],
                })
            })
            .collect();
        let record = json!({
            "pass": pass, "revision": snapshot.revision, "fps": fps, "durationFrames": duration,
            "width": manifest.width, "height": manifest.height, "sheet": rows,
            "strips": options.strips, "static": still, "findings": findings, "motion": motion,
            "warnings": warnings,
        });
        std::fs::write(output.join("review.json"), serde_json::to_vec_pretty(&record)?)?;
        let name = output.file_name().map(|n| n.to_string_lossy().into_owned());
        let sheet_md = Worksheet {
            name: &name.unwrap_or_default(),
            options,
            revision: &snapshot.revision,
            fps,
            duration,
            rows: &rows,
            words: &words,
            flags: &flags,
            still: &still,
            findings: &findings,
            measured,
            reported,
        }
        .render();
        let worksheet = output.join("review.md");
        std::fs::write(&worksheet, sheet_md)?;
        Ok(json!({
            "output": without_verbatim(output),
            "worksheet": without_verbatim(&worksheet),
            "contactSheet": contact.as_deref().map(without_verbatim),
            "strips": strip_files.iter().map(|p| without_verbatim(p)).collect::<Vec<_>>(),
            "stills": sheet.len() + strips.difference(&sheet).count(),
            "samples": samples.len(),
            "static": still,
            "findings": findings,
            "warnings": warnings,
            "revision": snapshot.revision,
            "seconds": round(started.elapsed().as_secs_f64(), 1),
        }))
    }
    .await;
    capture.close().await;
    result
}

/// Frames every `every` seconds from `offset`, plus the last frame of the film.
pub(crate) fn grid(every: f64, offset: f64, fps: f64, duration: u64) -> Vec<u64> {
    let mut frames: Vec<u64> = (0u64..)
        .map(|k| ((offset + every * k as f64) * fps).round() as u64)
        .take_while(|&frame| frame < duration)
        .collect();
    frames.push(duration - 1);
    frames.dedup();
    frames
}

pub(crate) struct Word {
    frame: u64,
    text: String,
}

/// Spoken words in project frames, from `audio/words.json` and the clips that play the voice
/// (one, or several when the narration is split around a title card).
pub(crate) fn words(root: &Path, manifest: &Manifest) -> Vec<Word> {
    let Ok(text) = std::fs::read_to_string(root.join("audio/words.json")) else {
        return Vec::new();
    };
    let Ok(list) = serde_json::from_str::<Vec<Value>>(&text) else {
        return Vec::new();
    };
    let voices: Vec<_> = manifest
        .clips
        .iter()
        .filter(|c| {
            c.clip_type == ClipType::Audio && (c.src == "audio/voice.wav" || c.track == "voice")
        })
        .collect();
    let mut words: Vec<Word> = list
        .iter()
        .filter_map(|w| {
            let source = w["startFrame"].as_u64()?;
            let frame = if voices.is_empty() {
                source
            } else {
                let clip = voices.iter().find(|c| {
                    (c.source_offset_frames..c.source_offset_frames + c.duration_frames)
                        .contains(&source)
                })?;
                clip.start_frame + source - clip.source_offset_frames
            };
            Some(Word {
                frame,
                text: w["word"].as_str()?.to_string(),
            })
        })
        .collect();
    words.sort_by_key(|w| w.frame);
    words
}

/// What the voice says from 1.2 s before a frame to 0.2 s after: what the picture should show.
pub(crate) fn spoken(words: &[Word], frame: u64, fps: f64) -> String {
    let before = (1.2 * fps).round() as u64;
    let after = (0.2 * fps).round() as u64;
    words
        .iter()
        .filter(|w| w.frame + before >= frame && w.frame <= frame + after)
        .map(|w| w.text.as_str())
        .collect::<Vec<_>>()
        .join(" ")
}

#[derive(Clone, Debug)]
struct Actor {
    clip: String,
    id: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    target: Option<String>,
}

/// The actors the scenes reported for this frame, in frame pixels (see scene-api.md).
fn actors(state: &Value) -> Vec<Actor> {
    state["actors"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|a| {
            Some(Actor {
                clip: a["clipId"].as_str()?.to_string(),
                id: a["id"].as_str()?.to_string(),
                x: a["x"].as_f64()?,
                y: a["y"].as_f64()?,
                w: a["w"].as_f64()?,
                h: a["h"].as_f64()?,
                target: a["target"].as_str().map(str::to_string),
            })
        })
        .collect()
}

impl Actor {
    fn json(&self) -> Value {
        json!({
            "clip": self.clip, "id": self.id, "x": self.x.round(), "y": self.y.round(),
            "w": self.w.round(), "h": self.h.round(), "target": self.target,
        })
    }
}

#[derive(Debug)]
struct Flag {
    code: &'static str,
    frame: u64,
    clip: String,
    actor: String,
    target: Option<String>,
    /// Larger is worse; picks the frame a finding reports.
    worst: f64,
    detail: Value,
}
impl Flag {
    fn short(&self) -> String {
        match self.code {
            "edge-cut" => format!(
                "edge-cut {} {} visible",
                self.actor,
                percent(self.detail["visible"].as_f64().unwrap_or(0.0))
            ),
            _ => format!(
                "{} {} → {}",
                self.code,
                self.actor,
                self.target.as_deref().unwrap_or("")
            ),
        }
    }
}

/// Actors partly on screen, but with less than SLIVER of their box: a sliver at the frame edge.
fn edge_cuts(frame: u64, actors: &[Actor], width: f64, height: f64) -> Vec<Flag> {
    actors
        .iter()
        .filter_map(|a| {
            let area = a.w * a.h;
            let seen = ((a.x + a.w).min(width) - a.x.max(0.0)).max(0.0)
                * ((a.y + a.h).min(height) - a.y.max(0.0)).max(0.0);
            if area <= 0.0 || seen <= 0.0 || seen / area >= SLIVER {
                return None;
            }
            let sides: Vec<&str> = [
                (a.x < 0.0, "left"),
                (a.x + a.w > width, "right"),
                (a.y < 0.0, "top"),
                (a.y + a.h > height, "bottom"),
            ]
            .into_iter()
            .filter_map(|(cut, side)| cut.then_some(side))
            .collect();
            Some(Flag {
                code: "edge-cut",
                frame,
                clip: a.clip.clone(),
                actor: a.id.clone(),
                target: None,
                worst: 1.0 - seen / area,
                detail: json!({"visible": round(seen / area, 2), "sides": sides}),
            })
        })
        .collect()
}

/// Highlights whose box leaves part of their target outside, or whose target is not on screen.
fn off_target(frame: u64, actors: &[Actor]) -> Vec<Flag> {
    actors
        .iter()
        .filter_map(|a| {
            let wanted = a.target.as_deref()?;
            let flag = |code, worst, detail| {
                Some(Flag {
                    code,
                    frame,
                    clip: a.clip.clone(),
                    actor: a.id.clone(),
                    target: Some(wanted.to_string()),
                    worst,
                    detail,
                })
            };
            let target = actors
                .iter()
                .find(|t| t.id == wanted && t.clip == a.clip)
                .or_else(|| actors.iter().find(|t| t.id == wanted));
            let Some(t) = target else {
                return flag("target-missing", f64::MAX, json!({}));
            };
            // how far the target sticks out of the highlight on each side
            let outside = [
                ("left", a.x - t.x),
                ("right", t.x + t.w - a.x - a.w),
                ("top", a.y - t.y),
                ("bottom", t.y + t.h - a.y - a.h),
            ];
            let worst = outside.iter().map(|o| o.1).fold(f64::MIN, f64::max);
            if worst <= TARGET_TOLERANCE {
                return None;
            }
            let sides: serde_json::Map<String, Value> = outside
                .iter()
                .filter(|o| o.1 > TARGET_TOLERANCE)
                .map(|o| (o.0.to_string(), json!(o.1.round() as i64)))
                .collect();
            let centre = [
                round(t.x + t.w / 2.0 - a.x - a.w / 2.0, 1),
                round(t.y + t.h / 2.0 - a.y - a.h / 2.0, 1),
            ];
            flag(
                "off-target",
                worst,
                json!({"outside": sides, "centreOffset": centre}),
            )
        })
        .collect()
}

/// Flags of one kind on one actor in consecutive captures at most `gap` frames apart become one
/// finding with its worst frame.
fn findings(flags: &[Flag], order: &[u64], gap: u64) -> Vec<Value> {
    let index: BTreeMap<u64, usize> = order.iter().enumerate().map(|(i, &f)| (f, i)).collect();
    let mut groups: BTreeMap<(&str, &str, &str, Option<&str>), Vec<&Flag>> = BTreeMap::new();
    for flag in flags {
        groups
            .entry((
                flag.code,
                flag.clip.as_str(),
                flag.actor.as_str(),
                flag.target.as_deref(),
            ))
            .or_default()
            .push(flag);
    }
    let report = |run: &[&Flag]| {
        let worst = run
            .iter()
            .max_by(|a, b| a.worst.total_cmp(&b.worst))
            .expect("a run is never empty");
        let mut detail = worst.detail.clone();
        detail["frame"] = json!(worst.frame);
        json!({
            "code": worst.code, "clip": worst.clip, "actor": worst.actor, "target": worst.target,
            "from": run[0].frame, "to": run[run.len() - 1].frame, "samples": run.len(),
            "worst": detail,
        })
    };
    let mut out = Vec::new();
    for list in groups.values() {
        let mut run: Vec<&Flag> = Vec::new();
        for &flag in list {
            if let Some(last) = run.last()
                && (index[&flag.frame] != index[&last.frame] + 1 || flag.frame - last.frame > gap)
            {
                out.push(report(&run));
                run.clear();
            }
            run.push(flag);
        }
        if !run.is_empty() {
            out.push(report(&run));
        }
    }
    out.sort_by_key(|f| f["from"].as_u64());
    out
}

/// 64 × 36 luma: enough to see a beat, too coarse to see drift or grain.
pub(crate) fn signature(image: &image::DynamicImage) -> Vec<u8> {
    image.thumbnail_exact(64, 36).to_luma8().into_raw()
}

pub(crate) fn difference(a: &[u8], b: &[u8]) -> f64 {
    a.iter()
        .zip(b)
        .map(|(x, y)| f64::from(x.abs_diff(*y)))
        .sum::<f64>()
        / a.len().max(1) as f64
}

/// Stretches of at least `min` frames in which no sample differs from the first by STILL_LEVEL.
fn static_stretches(samples: &[(u64, Vec<u8>)], min: u64) -> Vec<(u64, u64)> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < samples.len() {
        let mut j = i;
        while j + 1 < samples.len() && difference(&samples[i].1, &samples[j + 1].1) < STILL_LEVEL {
            j += 1;
        }
        if samples[j].0 - samples[i].0 >= min {
            out.push((samples[i].0, samples[j].0));
            i = j + 1;
        } else {
            i += 1;
        }
    }
    out
}

pub(crate) fn round(value: f64, places: i32) -> f64 {
    let scale = 10f64.powi(places);
    (value * scale).round() / scale
}

/// A share on screen as a percentage; a sliver that rounds to nothing still shows as there.
fn percent(share: f64) -> String {
    if share < 0.01 {
        "<1 %".into()
    } else {
        format!("{} %", (share * 100.0).round())
    }
}

/// `review.md`: the measured findings and one row per still for the author's critique.
struct Worksheet<'a> {
    name: &'a str,
    options: &'a Options,
    revision: &'a str,
    fps: f64,
    duration: u64,
    rows: &'a [Value],
    words: &'a [Word],
    flags: &'a [Flag],
    still: &'a [Value],
    findings: &'a [Value],
    measured: bool,
    reported: bool,
}
impl Worksheet<'_> {
    fn render(&self) -> String {
        let seconds = |frame: u64| format!("{:.1} s", frame as f64 / self.fps);
        // frames a–b in seconds, given once when both ends round to the same tenth
        let time = |a: u64, b: u64| match (seconds(a), seconds(b)) {
            (from, to) if from == to => to,
            (from, to) => format!("{}–{to}", from.trim_end_matches(" s")),
        };
        let span = |a: u64, b: u64| {
            if a == b {
                format!("{} (frame {a})", seconds(a))
            } else {
                format!("{} (frames {a}–{b})", time(a, b))
            }
        };
        let cell = |text: &str| text.replace('|', "\\|");
        let mut md = format!("# Review {}\n\n", self.name);
        let mut pass = Vec::new();
        if let Some(every) = self.options.every {
            pass.push(format!(
                "grid every {every} s from {} s",
                self.options.offset
            ));
        }
        if !self.options.frames.is_empty() {
            pass.push(format!(
                "frames {}",
                self.options
                    .frames
                    .iter()
                    .map(u64::to_string)
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
        }
        for (a, b) in &self.options.strips {
            pass.push(format!("strip {a}–{b}"));
        }
        pass.push(match self.options.camera {
            Some([x, y, z]) => format!("check camera ({x}, {y}, {z})"),
            None => "film camera".into(),
        });
        let _ = writeln!(
            md,
            "{}. Revision `{}`, {} frames at {} fps.\n",
            capitalise(&pass.join("; ")),
            self.revision,
            self.duration,
            round(self.fps, 3)
        );
        md.push_str("## Measured\n\n");
        if !self.measured {
            md.push_str("Nothing measured: a close-up moves every actor.\n\n");
        } else {
            let mut notes = Vec::new();
            if !self.options.motion {
                notes.push("Static stretches are measured only on grid passes.");
            }
            if !self.reported {
                notes.push(
                    "No scene reported actors, so edge cuts and highlight targets went unchecked.",
                );
            }
            if self.still.is_empty() && self.findings.is_empty() {
                notes.push("Nothing flagged.");
            }
            if !notes.is_empty() {
                let _ = writeln!(md, "{}\n", notes.join(" "));
            }
            for s in self.still {
                let (a, b) = (
                    s["from"].as_u64().unwrap_or(0),
                    s["to"].as_u64().unwrap_or(0),
                );
                let _ = writeln!(
                    md,
                    "- Static {}: the picture barely changes for {} s.",
                    span(a, b),
                    s["seconds"]
                );
            }
            for f in self.findings {
                let (a, b) = (
                    f["from"].as_u64().unwrap_or(0),
                    f["to"].as_u64().unwrap_or(0),
                );
                let (worst, actor, target) = (
                    &f["worst"],
                    f["actor"].as_str().unwrap_or(""),
                    f["target"].as_str().unwrap_or(""),
                );
                let (kind, what) = match f["code"].as_str() {
                    Some("edge-cut") => (
                        "Edge cut",
                        format!(
                            "`{actor}` only {} on screen ({})",
                            percent(worst["visible"].as_f64().unwrap_or(0.0)),
                            worst["sides"]
                                .as_array()
                                .into_iter()
                                .flatten()
                                .filter_map(Value::as_str)
                                .collect::<Vec<_>>()
                                .join(", ")
                        ),
                    ),
                    Some("off-target") => (
                        "Off target",
                        format!(
                            "`{actor}` leaves `{target}` outside by {}",
                            worst["outside"]
                                .as_object()
                                .into_iter()
                                .flatten()
                                .map(|(side, px)| format!("{px} px {side}"))
                                .collect::<Vec<_>>()
                                .join(", ")
                        ),
                    ),
                    _ => (
                        "Target missing",
                        format!("`{actor}` marks `{target}`, which is not on screen"),
                    ),
                };
                let _ = writeln!(
                    md,
                    "- {kind} {}, worst frame {}: {what}.",
                    span(a, b),
                    worst["frame"]
                );
            }
            if !self.still.is_empty() || !self.findings.is_empty() {
                md.push('\n');
            }
        }
        md.push_str("## Frames\n\nFill in every row before changing anything: the defect you see, then the change. Write `ok` and why when a frame already holds up.\n\n| Frame | Time | Words | Measured | Defect | Change |\n| --- | --- | --- | --- | --- | --- |\n");
        for row in self.rows {
            let flags = row["flags"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>()
                .join("; ");
            let _ = writeln!(
                md,
                "| {} | {} | {} | {} | | |",
                row["frame"],
                seconds(row["frame"].as_u64().unwrap_or(0)),
                cell(row["words"].as_str().unwrap_or("")),
                cell(&flags)
            );
        }
        for &(a, b) in &self.options.strips {
            // one entry per actor and kind, with its worst frame, instead of one per flagged frame
            let mut groups: BTreeMap<(&str, &str, Option<&str>), Vec<&Flag>> = BTreeMap::new();
            for flag in self.flags.iter().filter(|f| (a..=b).contains(&f.frame)) {
                groups
                    .entry((flag.code, flag.actor.as_str(), flag.target.as_deref()))
                    .or_default()
                    .push(flag);
            }
            let flags = groups.values().map(|group| {
                let worst = group
                    .iter()
                    .max_by(|x, y| x.worst.total_cmp(&y.worst))
                    .expect("a group is never empty");
                match group.len() {
                    1 => format!("{} (frame {})", worst.short(), worst.frame),
                    n => format!(
                        "{} at worst (frame {}, {n} frames flagged)",
                        worst.short(),
                        worst.frame
                    ),
                }
            });
            let _ = writeln!(
                md,
                "| {a}–{b} | {} | {} | {} | | |",
                time(a, b),
                cell(&spoken(self.words, b, self.fps)),
                cell(&flags.collect::<Vec<_>>().join("; "))
            );
        }
        md
    }
}

fn capitalise(text: &str) -> String {
    let mut chars = text.chars();
    chars
        .next()
        .map_or_else(String::new, |c| c.to_uppercase().chain(chars).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn actor(id: &str, x: f64, y: f64, w: f64, h: f64) -> Actor {
        Actor {
            clip: "film".into(),
            id: id.into(),
            x,
            y,
            w,
            h,
            target: None,
        }
    }

    #[test]
    fn grid_covers_the_film_and_ends_on_its_last_frame() {
        let frames = grid(3.0, 0.0, 30.0, 1140);
        assert_eq!(&frames[..2], &[0, 90]);
        assert_eq!(frames.last(), Some(&1139));
        assert_eq!(frames.len(), 14);
        let between = grid(3.0, 1.5, 30.0, 1140);
        assert_eq!(&between[..2], &[45, 135]);
        assert_eq!(between.last(), Some(&1139));
    }

    #[test]
    fn slivers_at_the_edge_are_flagged_and_peeks_are_not() {
        let actors = [
            actor("sliver", -90.0, 400.0, 100.0, 200.0),
            actor("peek", 1870.0, 400.0, 100.0, 200.0),
            actor("inside", 800.0, 400.0, 100.0, 200.0),
            actor("gone", -300.0, 400.0, 100.0, 200.0),
        ];
        let flags = edge_cuts(7, &actors, 1920.0, 1080.0);
        assert_eq!(flags.len(), 1);
        assert_eq!(flags[0].actor, "sliver");
        assert_eq!(flags[0].detail["visible"], 0.1);
        assert_eq!(flags[0].detail["sides"], json!(["left"]));
    }

    #[test]
    fn highlights_must_enclose_their_target() {
        let mut frame = actor("frame", 100.0, 100.0, 200.0, 80.0);
        frame.target = Some("label".into());
        assert!(
            off_target(
                1,
                &[frame.clone(), actor("label", 110.0, 110.0, 180.0, 60.0)]
            )
            .is_empty()
        );
        let off = off_target(
            1,
            &[frame.clone(), actor("label", 130.0, 110.0, 180.0, 60.0)],
        );
        assert_eq!(off[0].code, "off-target");
        assert_eq!(off[0].detail["outside"], json!({"right": 10}));
        assert_eq!(off_target(1, &[frame])[0].code, "target-missing");
    }

    #[test]
    fn a_stretch_is_static_only_when_nothing_changes_for_long_enough() {
        let (same, other) = (vec![100u8; 64 * 36], vec![140u8; 64 * 36]);
        let mut samples: Vec<(u64, Vec<u8>)> = (0..=10).map(|i| (i * 15, same.clone())).collect();
        samples.extend((11..=15).map(|i| (i * 15, other.clone())));
        assert_eq!(static_stretches(&samples, 90), vec![(0, 150)]);
        // a slow drift stays under the level from sample to sample, but adds up against the first
        let drift: Vec<(u64, Vec<u8>)> = (0..=10)
            .map(|i| (i * 15, vec![100 + i as u8; 64 * 36]))
            .collect();
        assert!(static_stretches(&drift, 90).is_empty());
    }

    #[test]
    fn flags_on_consecutive_captures_become_one_finding() {
        let order = [0, 15, 30, 45, 60, 300];
        let sliver = |frame, x| {
            edge_cuts(
                frame,
                &[actor("claude", x, 400.0, 100.0, 200.0)],
                1920.0,
                1080.0,
            )
        };
        let flags: Vec<Flag> = [
            sliver(0, -90.0),
            sliver(15, -80.0),
            sliver(45, -95.0),
            sliver(60, -95.0),
            sliver(300, -95.0),
        ]
        .into_iter()
        .flatten()
        .collect();
        let found = findings(&flags, &order, 15);
        assert_eq!(found.len(), 3);
        assert_eq!(
            (
                found[0]["from"].as_u64(),
                found[0]["to"].as_u64(),
                found[0]["samples"].as_u64()
            ),
            (Some(0), Some(15), Some(2))
        );
        assert_eq!(found[0]["worst"]["frame"], 0);
        assert_eq!(found[1]["worst"]["visible"], 0.05);
        // the next capture, but too far away to be the same moment
        assert_eq!(
            (found[2]["from"].as_u64(), found[2]["to"].as_u64()),
            (Some(300), Some(300))
        );
    }

    #[test]
    fn the_worksheet_names_each_finding_once_with_its_span() {
        let options = Options {
            every: Some(3.0),
            offset: 0.0,
            frames: Vec::new(),
            strips: vec![(495, 500)],
            camera: None,
            crop: None,
            motion: true,
        };
        let flags: Vec<Flag> = [495, 510, 525]
            .into_iter()
            .flat_map(|f| {
                edge_cuts(
                    f,
                    &[actor("copilot", 1919.0, 1079.0, 100.0, 200.0)],
                    1920.0,
                    1080.0,
                )
            })
            .collect();
        let found = findings(&flags, &[495, 510, 525], 15);
        let still = [json!({"from": 0, "to": 120, "seconds": 4.0})];
        let rows = [json!({"frame": 495, "flags": [flags[0].short()], "words": "Copilot"})];
        let md = Worksheet {
            name: "1",
            options: &options,
            revision: "r1",
            fps: 30.0,
            duration: 1140,
            rows: &rows,
            words: &[],
            flags: &flags,
            still: &still,
            findings: &found,
            measured: true,
            reported: true,
        }
        .render();
        assert!(
            !md.contains("Nothing flagged") && !md.contains("unchecked"),
            "{md}"
        );
        assert!(
            md.contains("- Static 0.0–4.0 s (frames 0–120): the picture barely changes for 4.0 s."),
            "{md}"
        );
        assert!(md.contains("- Edge cut 16.5–17.5 s (frames 495–525), worst frame 525: `copilot` only <1 % on screen (right, bottom)."), "{md}");
        assert!(
            md.contains("| 495 | 16.5 s | Copilot | edge-cut copilot <1 % visible | | |"),
            "{md}"
        );
        assert!(
            md.contains(
                "| 495–500 | 16.5–16.7 s |  | edge-cut copilot <1 % visible (frame 495) | | |"
            ),
            "{md}"
        );
        // a scene that reports nothing must not read as a clean pass
        let quiet = Worksheet {
            name: "2",
            options: &options,
            revision: "r1",
            fps: 30.0,
            duration: 1140,
            rows: &[],
            words: &[],
            flags: &[],
            still: &[],
            findings: &[],
            measured: true,
            reported: false,
        }
        .render();
        assert!(quiet.contains("No scene reported actors, so edge cuts and highlight targets went unchecked. Nothing flagged."), "{quiet}");
    }

    #[test]
    fn short_spans_and_strip_rows_stay_compact() {
        let options = Options {
            every: None,
            offset: 0.0,
            frames: Vec::new(),
            strips: vec![(592, 615)],
            camera: None,
            crop: None,
            motion: false,
        };
        let mut flags: Vec<Flag> = [(599, 1070.0), (600, 1060.0), (601, 1050.0)]
            .into_iter()
            .flat_map(|(f, y)| {
                edge_cuts(
                    f,
                    &[actor("chatgpt", 800.0, y, 100.0, 200.0)],
                    1920.0,
                    1080.0,
                )
            })
            .collect();
        flags.extend(edge_cuts(
            602,
            &[actor("copilot", 1915.0, 400.0, 100.0, 200.0)],
            1920.0,
            1080.0,
        ));
        let found = findings(&flags, &(592..=615).collect::<Vec<_>>(), 15);
        let md = Worksheet {
            name: "1",
            options: &options,
            revision: "r1",
            fps: 30.0,
            duration: 1140,
            rows: &[],
            words: &[],
            flags: &flags,
            still: &[],
            findings: &found,
            measured: true,
            reported: true,
        }
        .render();
        // 599 and 601 both round to 20.0 s
        assert!(md.contains("- Edge cut 20.0 s (frames 599–601), worst frame 599: `chatgpt` only 5 % on screen (bottom)."), "{md}");
        assert!(md.contains("| 592–615 | 19.7–20.5 s |  | edge-cut chatgpt 5 % visible at worst (frame 599, 3 frames flagged); edge-cut copilot 5 % visible (frame 602) | | |"), "{md}");
    }

    #[test]
    fn words_are_the_ones_just_spoken() {
        let words = [
            Word {
                frame: 30,
                text: "Skills".into(),
            },
            Word {
                frame: 60,
                text: "sind".into(),
            },
            Word {
                frame: 120,
                text: "Ordner".into(),
            },
        ];
        assert_eq!(spoken(&words, 66, 30.0), "Skills sind");
        assert_eq!(spoken(&words, 115, 30.0), "Ordner");
    }

    #[test]
    fn strips_parse_and_refuse_reversed_or_long_ranges() {
        assert_eq!(parse_range("600-615"), Ok((600, 615)));
        assert!(parse_range("615-600").is_err());
        assert!(parse_range("0-200").is_err());
        assert!(parse_range("600").is_err());
    }

    #[test]
    fn review_folders_count_up() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            next_output(dir.path()),
            dir.path().join("renders").join("review").join("1")
        );
        for name in ["1", "3", "notes"] {
            std::fs::create_dir_all(dir.path().join("renders/review").join(name)).unwrap();
        }
        assert_eq!(
            next_output(dir.path()),
            dir.path().join("renders").join("review").join("4")
        );
    }
}
