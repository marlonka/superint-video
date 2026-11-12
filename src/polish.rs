//! `polish`: the last look before a render, made for eyes that did not build the film. A still
//! every few seconds, the same stills cut into close-ups at native resolution, both sides of
//! every cut and strips over the fastest moves go on a worksheet with one row each. A later
//! pass lists only what changed or was left open. `--accept` records a clean pass for the
//! picture as it stands, and `render` asks for that record. Judging stays with whoever looks.
//!
//! A film gets one to three rounds (`polishRounds`). A round is one pair of fresh eyes: its
//! passes repeat until one is clean. The round after an accepted one starts over the whole film
//! with stills between the earlier ones, close-ups of every still, moves no round showed yet,
//! what the earlier rounds fixed, and questions of its own.
use crate::{
    model::{ClipType, Manifest},
    project::{self, ProjectSnapshot, without_verbatim},
    renderer::{self, Capture},
    review,
};
use anyhow::{Context, Result, bail, ensure};
use image::{DynamicImage, RgbImage};
use serde_json::{Value, json};
use std::{
    collections::{BTreeMap, BTreeSet},
    fmt::Write as _,
    path::{Path, PathBuf},
    time::Instant,
};

/// Seconds between stills unless `--every` says otherwise.
pub const EVERY_SECONDS: f64 = 5.0;
/// Seconds between the samples that find the fastest moves.
const SAMPLE_SECONDS: f64 = 0.5;
/// Mean luma difference (64 × 36, see `review`) from which a still shows a view no earlier still
/// showed, so it gets close-ups. Measured on a 150 s explainer with a travelling camera: stills
/// 5 s apart inside one held shot differ by 2–9, a new framing or a new world by 13–90.
const NEW_VIEW: f64 = 12.0;
/// The same measure under which a close-up shows what an earlier close-up of that quarter showed.
const SAME_VIEW: f64 = 4.0;
/// A channel must move this far for a pixel to count as changed since the pass before …
const PIXEL_STEP: u8 = 10;
/// … and this many pixels must change. The browser repeats a frame exactly; the slack is for
/// the odd rounding at an edge.
const CHANGED_PIXELS: usize = 24;
/// Change between two samples from which a move is worth a strip. A slow camera push measures
/// 1.5–2.6 (see `review`), an entrance or a fast move well above 3.
const MOVE_LEVEL: f64 = 3.0;
/// Frames between the pictures of a strip, and how many it holds: 0.7 s at 30 fps.
const STRIP_STEP: u64 = 3;
const STRIP_FRAMES: u64 = 8;
/// Seconds of film per strip, and the most strips one scene gets.
const SECONDS_PER_STRIP: f64 = 10.0;
const STRIPS_PER_SCENE: usize = 4;
/// Most cuts and strips one pass shows, so a film of many short clips stays readable.
const MOST_CUTS: usize = 60;
const MOST_STRIPS: usize = 24;
/// The accepted pass, kept with the notes so it survives cleaning `renders/`.
const RECORD: &str = "process/polish.json";
/// Rounds a film gets unless the user chose more in the app or its brief says otherwise.
pub const DEFAULT_ROUNDS: u8 = 1;
/// The most rounds there are to choose.
pub const MOST_ROUNDS: u8 = 3;
/// The key in `brief.md`'s front matter that sets the rounds for one film.
pub const BRIEF_KEY: &str = "polishRounds";
/// Most findings of earlier rounds a worksheet repeats.
const MOST_FOUND: usize = 40;

/// A number of rounds as it is typed in the settings, `brief.md` or on the command line.
pub fn parse_rounds(text: &str) -> Result<u8> {
    let text = text.trim();
    match text.parse::<u8>() {
        Ok(rounds) if (1..=MOST_ROUNDS).contains(&rounds) => Ok(rounds),
        _ => bail!("{BRIEF_KEY} is 1, 2 or 3, not \"{text}\""),
    }
}

/// How many rounds the film in `root` gets, and where that number comes from: `polishRounds`
/// in its `brief.md` front matter (`brief`), else the user's setting (`settings`).
pub fn rounds(root: &Path) -> Result<(u8, &'static str)> {
    rounds_with(root, crate::home::Settings::current().polish_rounds)
}

fn rounds_with(root: &Path, setting: u8) -> Result<(u8, &'static str)> {
    if let Ok(text) = std::fs::read_to_string(root.join("brief.md"))
        && let Some(value) = crate::frontmatter::split(&text).values.get(BRIEF_KEY)
    {
        // An empty value follows the setting, like a missing one.
        let value = crate::frontmatter::string(value);
        if !value.is_empty() {
            let rounds = parse_rounds(&value).context("brief.md")?;
            return Ok((rounds, "brief"));
        }
    }
    Ok((setting.clamp(1, MOST_ROUNDS), "settings"))
}

fn passes(root: &Path) -> PathBuf {
    root.join("renders").join("polish")
}

/// Number of the latest pass in `renders/polish/`.
fn latest(root: &Path) -> Option<u32> {
    std::fs::read_dir(passes(root))
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| entry.file_name().to_str()?.parse::<u32>().ok())
        .max()
}

/// The folder of the latest pass.
pub fn latest_pass(root: &Path) -> Option<PathBuf> {
    latest(root).map(|n| passes(root).join(n.to_string()))
}

/// The round a pass belonged to; passes from before rounds were round 1.
fn round_of(data: &Value) -> u8 {
    data["round"]
        .as_u64()
        .map_or(1, |round| round.clamp(1, u64::from(u8::MAX)) as u8)
}

/// The passes whose frames were all taken, oldest first, with what their `polish.json` says.
fn finished(root: &Path) -> Vec<(u32, PathBuf, Value)> {
    let mut done: Vec<(u32, PathBuf, Value)> = std::fs::read_dir(passes(root))
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| {
            let pass = entry.file_name().to_str()?.parse::<u32>().ok()?;
            let data =
                serde_json::from_slice(&std::fs::read(entry.path().join("polish.json")).ok()?)
                    .ok()?;
            Some((pass, entry.path(), data))
        })
        .collect();
    done.sort_by_key(|(pass, ..)| *pass);
    done
}

fn record(root: &Path) -> Option<Value> {
    serde_json::from_slice(&std::fs::read(root.join(RECORD)).ok()?).ok()
}

/// What the next pass is.
pub struct Next {
    /// `renders/polish/<pass>`.
    pub output: PathBuf,
    pub pass: u32,
    /// The round it belongs to, and how many the film gets.
    pub round: u8,
    pub rounds: u8,
    /// The pass before it in the same round: what that pass settled stays settled. None when
    /// the pass starts a round.
    pub previous: Option<PathBuf>,
    /// The passes of the rounds before this one.
    earlier: Vec<PathBuf>,
}

/// The next pass of a film that gets `rounds` rounds. It starts the next round once the latest
/// pass is the accepted one and rounds are left; otherwise it goes on with the latest round,
/// which after the last round lists only what changed.
pub fn next(root: &Path, rounds: u8) -> Next {
    let pass = latest(root).unwrap_or(0) + 1;
    let done = finished(root);
    let accepted = record(root).and_then(|record| record["pass"].as_u64());
    let (round, previous) = match done.last() {
        None => (1, None),
        Some((last, folder, data)) => {
            let round = round_of(data);
            if accepted == Some(u64::from(*last)) && round < rounds {
                (round + 1, None)
            } else {
                (round, Some(folder.clone()))
            }
        }
    };
    let earlier = done
        .into_iter()
        .filter(|(_, _, data)| round_of(data) < round)
        .map(|(_, folder, _)| folder)
        .collect();
    Next {
        output: passes(root).join(pass.to_string()),
        pass,
        round,
        rounds,
        previous,
        earlier,
    }
}

/// Whether a clean pass is on record for the picture as it stands, after as many rounds as the
/// film gets: `accepted`, `next-round` (a round is clean, another is due), `stale` (the picture
/// changed since) or `missing`.
pub fn state(root: &Path, rounds: u8) -> Result<Value> {
    let Some(record) = record(root) else {
        return Ok(json!({"state": "missing", "rounds": rounds}));
    };
    let round = round_of(&record);
    let picture = project::picture_revision(root)?;
    let state = if record["picture"] != picture {
        "stale"
    } else if round < rounds {
        "next-round"
    } else {
        "accepted"
    };
    Ok(json!({"state": state, "pass": record["pass"], "round": round, "rounds": rounds}))
}

/// How long Studio's view trusts the last answer about the picture: hashing the whole project
/// every few seconds would be wasteful.
const STATE_FOR: std::time::Duration = std::time::Duration::from_secs(15);

fn remembered_state(root: &Path) -> Value {
    use std::{collections::HashMap, sync::Mutex, time::Instant};
    static SEEN: Mutex<Option<HashMap<PathBuf, (Instant, Value)>>> = Mutex::new(None);
    let mut seen = SEEN.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let seen = seen.get_or_insert_with(HashMap::new);
    if let Some((at, value)) = seen.get(root)
        && at.elapsed() < STATE_FOR
    {
        return value.clone();
    }
    // A brief whose rounds do not read is the CLI's to report; the view goes by the setting.
    let rounds = rounds(root).map_or_else(
        |_| crate::home::Settings::current().polish_rounds,
        |(rounds, _)| rounds,
    );
    let value = state(root, rounds).unwrap_or_else(|_| json!({"state": "missing"}));
    seen.insert(root.to_path_buf(), (Instant::now(), value.clone()));
    value
}

/// What Studio shows about the polish: the latest pass, every image it lists with what the
/// worksheet says about it so far, and whether a clean pass is on record for the picture.
/// None while no pass was ever started.
pub fn overview(root: &Path) -> Option<Value> {
    let pass = latest(root)?;
    let folder = passes(root).join(pass.to_string());
    let record = remembered_state(root);
    let place = format!("renders/polish/{pass}");
    let Some(data) = std::fs::read(folder.join("polish.json"))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
    else {
        // The frames are still being taken.
        return Some(json!({"pass": pass, "folder": place, "capturing": true, "record": record}));
    };
    let said: BTreeMap<String, (String, String)> = sheet_rows(&folder)
        .into_iter()
        .map(|row| (row.file, (row.said, row.fix)))
        .collect();
    let mut rows = Vec::new();
    let (mut fine, mut kept, mut defects, mut open) = (0, 0, 0, 0);
    for (kind, list) in [("still", "stills"), ("cut", "cuts"), ("move", "moves")] {
        for row in data[list].as_array().into_iter().flatten() {
            let file = row["file"].as_str().unwrap_or_default();
            let (defect, fix) = said.get(file).cloned().unwrap_or_default();
            let low = defect.to_lowercase();
            let verdict = if defect.is_empty() {
                open += 1;
                "open"
            } else if low.starts_with("ok") {
                fine += 1;
                "ok"
            } else if low.starts_with("kept") {
                kept += 1;
                "kept"
            } else {
                defects += 1;
                "defect"
            };
            rows.push(json!({
                "file": file, "kind": kind, "time": row["time"], "closeUps": row["closeUps"],
                "verdict": verdict, "said": defect, "fix": fix,
            }));
        }
    }
    Some(json!({
        "pass": pass,
        "folder": place,
        "capturing": false,
        "record": record,
        "round": round_of(&data),
        // As many as the film gets now; the pass may have been taken before a change.
        "rounds": record["rounds"].as_u64().or(data["rounds"].as_u64()).unwrap_or(1),
        "rows": rows,
        "counts": {
            "listed": rows.len(), "ok": fine, "kept": kept, "defects": defects, "open": open,
            "settled": data["settled"].as_array().map_or(0, Vec::len),
        },
    }))
}

/// One image of a pass and what the pass before said about it.
struct Row {
    file: String,
    frame: u64,
    close_ups: Vec<char>,
    /// The words of the pass before when it left this image open and the image did not change.
    carried: Option<String>,
}

/// Where a round's stills start, in seconds: each round looks between the stills of the rounds
/// before it (0, then half of `every`, then a quarter).
fn offset(round: u8, every: f64) -> f64 {
    match round {
        0 | 1 => 0.0,
        2 => every / 2.0,
        _ => every / 4.0,
    }
}

pub async fn polish(
    snapshot: ProjectSnapshot,
    picture: &str,
    every: f64,
    next: &Next,
) -> Result<Value> {
    let started = Instant::now();
    let (output, pass, round) = (next.output.as_path(), next.pass, next.round);
    let manifest = snapshot.manifest.clone();
    let fps = manifest.fps.num as f64 / manifest.fps.den as f64;
    let duration = manifest.duration_frames;
    ensure!(every * fps >= 1.0, "--every must be at least one frame");
    let (width, height) = (manifest.width, manifest.height);
    let start = offset(round, every);
    let stills: BTreeSet<u64> = review::grid(every, start, fps, duration)
        .into_iter()
        .collect();
    // What the rounds before found, so this one checks the fixes and looks for their kind, and
    // the moves they showed, so this one shows others.
    let found = found_before(&next.earlier);
    let shown = moves_shown(&next.earlier);
    let mut warnings = Vec::new();
    let mut cuts = cuts(&manifest);
    if cuts.len() > MOST_CUTS {
        let message = format!("{} cuts; the first {MOST_CUTS} are shown", cuts.len());
        warnings.push(json!({"code": "many-cuts", "message": message}));
        cuts.truncate(MOST_CUTS);
    }
    let sides: BTreeSet<u64> = cuts.iter().flat_map(|&f| [f - 1, f]).collect();
    let step = ((SAMPLE_SECONDS * fps).round() as usize).max(1);
    let samples: BTreeSet<u64> = (0..duration).step_by(step).chain([duration - 1]).collect();
    // What the pass before settled: an image it called ok or kept stays settled until it changes.
    let before = next
        .previous
        .as_deref()
        .map(Before::read)
        .unwrap_or_default();
    std::fs::create_dir_all(output)?;
    let words = review::words(&snapshot.root, &manifest);
    let capture = Capture::open(snapshot.root.clone(), snapshot.manifest.clone()).await?;
    // Whether an image differs from the one the pass before looked at, and what that pass said
    // about it when it is the same.
    let changed_since = |file: &str, now: &RgbImage| {
        before
            .image(file)
            .is_none_or(|then| then.dimensions() != now.dimensions() || differs(&then, now, None))
    };
    let carried = |file: &str, changed: bool| if changed { None } else { before.said(file) };
    let result = async {
        let order: BTreeSet<u64> = stills
            .iter()
            .chain(&sides)
            .chain(&samples)
            .copied()
            .collect();
        let mut signatures = Vec::new();
        let mut thumbs = Vec::new();
        let mut halves: BTreeMap<u64, RgbImage> = BTreeMap::new();
        let mut seen: BTreeMap<char, Vec<Vec<u8>>> = BTreeMap::new();
        let mut views: Vec<Vec<u8>> = Vec::new();
        let mut rows = Vec::new();
        let (mut settled, mut close_ups) = (Vec::new(), 0);
        for &frame in &order {
            let still = stills.contains(&frame);
            let side = sides.contains(&frame);
            let (bytes, _) = capture.frame_state(frame, !(still || side)).await?;
            let image = image::load_from_memory(&bytes)?;
            if samples.contains(&frame) {
                signatures.push((frame, review::signature(&image)));
            }
            if side {
                halves.insert(
                    frame,
                    image.thumbnail_exact(width / 2, height / 2).to_rgb8(),
                );
            }
            if !still {
                continue;
            }
            let file = format!("frame-{frame:06}.png");
            std::fs::write(output.join(&file), &bytes)?;
            thumbs.push((label(frame, fps), image.thumbnail(384, 216).to_rgb8()));
            let now = image.to_rgb8();
            let then = before
                .image(&file)
                .filter(|then| then.dimensions() == now.dimensions());
            let changed = then.as_ref().is_none_or(|then| differs(then, &now, None));
            if !changed && before.settled.contains(&file) {
                settled.push(file);
                continue;
            }
            let mut letters = Vec::new();
            // First look: close-ups where the still shows a new view, and in a later round of
            // every still. After a fix: the quarters that changed.
            let whole = review::signature(&image);
            let new_view = views
                .iter()
                .all(|other| review::difference(other, &whole) >= NEW_VIEW);
            let closer = round > 1 && then.is_none();
            if changed && then.is_some() || new_view || closer {
                if new_view {
                    views.push(whole);
                }
                for (letter, [x, y, w, h]) in tiles(width, height) {
                    if changed
                        && then
                            .as_ref()
                            .is_some_and(|then| !differs(then, &now, Some([x, y, w, h])))
                    {
                        continue;
                    }
                    let tile = image::imageops::crop_imm(&now, x, y, w, h).to_image();
                    let signature = review::signature(&DynamicImage::ImageRgb8(tile.clone()));
                    let known = seen.entry(letter).or_default();
                    if known
                        .iter()
                        .any(|other| review::difference(other, &signature) < SAME_VIEW)
                    {
                        continue;
                    }
                    known.push(signature);
                    tile.save(output.join(format!("close-{frame:06}-{letter}.png")))?;
                    letters.push(letter);
                }
            }
            close_ups += letters.len();
            rows.push(Row {
                carried: carried(&file, changed),
                file,
                frame,
                close_ups: letters,
            });
        }
        let contact = output.join("contact-sheet.png");
        renderer::contact_sheet(&thumbs).save(&contact)?;

        // Both sides of every cut, side by side: what is there before and gone after pops.
        let mut cut_rows = Vec::new();
        for &cut in &cuts {
            let file = format!("cut-{cut:06}.png");
            let dark = image::Rgb([16, 17, 19]);
            let mut pair = RgbImage::from_pixel(width / 2 * 2 + 8, height / 2, dark);
            image::imageops::overlay(&mut pair, &halves[&(cut - 1)], 0, 0);
            image::imageops::overlay(&mut pair, &halves[&cut], i64::from(width / 2 + 8), 0);
            let changed = changed_since(&file, &pair);
            pair.save(output.join(&file))?;
            if !changed && before.settled.contains(&file) {
                settled.push(file);
                continue;
            }
            cut_rows.push(Row {
                carried: carried(&file, changed),
                file,
                frame: cut,
                close_ups: Vec::new(),
            });
        }

        // The fastest moves of every scene, a few frames apart: ugly frames hide mid-motion. A
        // later round shows the fastest ones no round before it showed.
        let mut peaks = moves(&signatures, &cuts, duration, fps, &shown);
        if peaks.len() > MOST_STRIPS {
            let many = peaks.len();
            let message = format!("{many} fast moves; the {MOST_STRIPS} fastest are shown");
            warnings.push(json!({"code": "many-moves", "message": message}));
            peaks.truncate(MOST_STRIPS);
        }
        peaks.sort_by_key(|peak| peak.frame);
        let mut move_rows = Vec::new();
        for peak in &peaks {
            let first = peak
                .frame
                .saturating_sub(STRIP_STEP * (STRIP_FRAMES - 2))
                .max(peak.from);
            let frames = (0..STRIP_FRAMES)
                .map(|k| first + k * STRIP_STEP)
                .filter(|&f| f < peak.to);
            let mut strip = Vec::new();
            for frame in frames {
                let (bytes, _) = capture.frame_state(frame, true).await?;
                let thumb = image::load_from_memory(&bytes)?.thumbnail(384, 216);
                strip.push((label(frame, fps), thumb.to_rgb8()));
            }
            let file = format!("motion-{:06}.png", peak.frame);
            let sheet = renderer::contact_sheet(&strip);
            let changed = changed_since(&file, &sheet);
            sheet.save(output.join(&file))?;
            if !changed && before.settled.contains(&file) {
                settled.push(file);
                continue;
            }
            move_rows.push(Row {
                carried: carried(&file, changed),
                file,
                frame: peak.frame,
                close_ups: Vec::new(),
            });
        }

        let listed = rows.len() + cut_rows.len() + move_rows.len();
        let row = |r: &Row| {
            let close_ups: Vec<String> = r
                .close_ups
                .iter()
                .map(|l| format!("close-{:06}-{l}.png", r.frame))
                .collect();
            json!({
                "file": r.file, "frame": r.frame, "time": review::round(r.frame as f64 / fps, 2),
                "closeUps": close_ups, "carried": r.carried,
            })
        };
        let record = json!({
            "pass": pass, "round": round, "rounds": next.rounds, "picture": picture,
            "revision": snapshot.revision, "every": every, "offset": start,
            "fps": fps, "durationFrames": duration, "width": width, "height": height,
            "stills": rows.iter().map(row).collect::<Vec<_>>(),
            "cuts": cut_rows.iter().map(row).collect::<Vec<_>>(),
            "moves": move_rows.iter().map(row).collect::<Vec<_>>(),
            "settled": settled, "warnings": warnings,
        });
        std::fs::write(
            output.join("polish.json"),
            serde_json::to_vec_pretty(&record)?,
        )?;
        let sheet = Worksheet {
            pass,
            round,
            rounds: next.rounds,
            picture,
            every,
            start,
            found: &found,
            fps,
            duration,
            stills: stills.len(),
            cuts: cuts.len(),
            strips: peaks.len(),
            rows: &rows,
            cut_rows: &cut_rows,
            move_rows: &move_rows,
            settled: settled.len(),
            words: &words,
        }
        .render();
        let worksheet = output.join("polish.md");
        std::fs::write(&worksheet, sheet)?;
        Ok(json!({
            "pass": pass,
            "round": round,
            "rounds": next.rounds,
            "startsRound": next.previous.is_none(),
            "output": without_verbatim(output),
            "worksheet": without_verbatim(&worksheet),
            "contactSheet": without_verbatim(&contact),
            "toLookAt": {
                "stills": rows.len(), "closeUps": close_ups, "cuts": cut_rows.len(),
                "moves": move_rows.len(),
            },
            "settled": settled.len(),
            "clean": listed == 0,
            "picture": picture,
            "warnings": warnings,
            "seconds": review::round(started.elapsed().as_secs_f64(), 1),
        }))
    }
    .await;
    capture.close().await;
    result
}

/// Records the latest pass as clean: nothing changed since its frames were taken, and every row
/// of its worksheet says `ok` or `kept`. Says whether another round is due for a film that gets
/// `rounds`.
pub fn accept(root: &Path, picture: &str, rounds: u8) -> Result<Value> {
    let pass = latest(root).context("No polish pass yet: run `superint-video polish <dir>`")?;
    let folder = passes(root).join(pass.to_string());
    let data: Value = serde_json::from_slice(
        &std::fs::read(folder.join("polish.json"))
            .with_context(|| format!("Pass {pass} did not finish: run `polish` again"))?,
    )?;
    ensure!(
        data["picture"] == picture,
        "The picture changed after pass {pass}. Run `polish` again: it lists only what changed since."
    );
    let (verdicts, _) = verdicts(&folder);
    let open: Vec<String> = verdicts
        .iter()
        .filter_map(|(file, verdict)| match verdict {
            Verdict::Ok | Verdict::Kept => None,
            Verdict::Blank => Some(format!("{file}: not looked at")),
            Verdict::Defect(_) => Some(format!("{file}: has a defect")),
        })
        .collect();
    ensure!(
        open.is_empty(),
        "Pass {pass} is not clean ({} of {} rows): {}. Fill in every row; fix each defect, run `check`, then `polish` again.",
        open.len(),
        verdicts.len(),
        open.iter().take(6).cloned().collect::<Vec<_>>().join("; ")
    );
    let kept = verdicts
        .values()
        .filter(|v| matches!(v, Verdict::Kept))
        .count();
    let round = round_of(&data);
    let record = json!({
        "pass": pass, "round": round, "rounds": rounds, "picture": picture,
        "rows": verdicts.len(), "kept": kept,
    });
    let path = root.join(RECORD);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, serde_json::to_vec_pretty(&record)?)?;
    let next = if round < rounds {
        format!(
            "Round {round} of {rounds} is clean. Round {} needs fresh eyes: start a new polisher, cold, with the brief in references/polish.md of the superint-video skill. Its `superint-video polish <dir>` starts round {} over the whole film; render waits until that round is accepted too.",
            round + 1,
            round + 1
        )
    } else {
        format!(
            "{} clean: the film may be rendered.",
            if rounds == 1 {
                "The polish is".to_string()
            } else {
                format!("All {rounds} rounds are")
            }
        )
    };
    Ok(json!({
        "accepted": true, "pass": pass, "round": round, "rounds": rounds,
        "rows": verdicts.len(), "kept": kept, "record": without_verbatim(&path), "next": next,
    }))
}

enum Verdict {
    Ok,
    Kept,
    Blank,
    Defect(String),
}

/// One image row of a worksheet: the image, its Defect cell and its Fix cell.
struct SheetRow {
    file: String,
    said: String,
    fix: String,
}

/// The image rows of a pass's worksheet.
fn sheet_rows(folder: &Path) -> Vec<SheetRow> {
    let sheet = std::fs::read_to_string(folder.join("polish.md")).unwrap_or_default();
    sheet
        .lines()
        .map(cells)
        .filter(|cells| cells.len() >= 6 && cells[0].trim_matches('`').ends_with(".png"))
        .map(|cells| SheetRow {
            file: cells[0].trim_matches('`').to_string(),
            said: cells[4].clone(),
            fix: cells[5].clone(),
        })
        .collect()
}

fn verdict(said: &str) -> Verdict {
    let said = said.trim();
    let low = said.to_lowercase();
    if said.is_empty() {
        Verdict::Blank
    } else if low.starts_with("ok") {
        Verdict::Ok
    } else if low.starts_with("kept") {
        Verdict::Kept
    } else {
        Verdict::Defect(said.to_string())
    }
}

/// The Defect cell of every image row of a pass's worksheet, and the names it had settled before.
fn verdicts(folder: &Path) -> (BTreeMap<String, Verdict>, BTreeSet<String>) {
    let out = sheet_rows(folder)
        .into_iter()
        .map(|row| (row.file, verdict(&row.said)))
        .collect();
    let settled = std::fs::read(folder.join("polish.json"))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
        .and_then(|data| data["settled"].as_array().cloned())
        .into_iter()
        .flatten()
        .filter_map(|name| name.as_str().map(str::to_string))
        .collect();
    (out, settled)
}

/// The cells of a markdown table row; `\|` stays inside its cell.
fn cells(line: &str) -> Vec<String> {
    let line = line.trim();
    if !line.starts_with('|') {
        return Vec::new();
    }
    let mut cells = vec![String::new()];
    let mut chars = line[1..].chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '\\' if chars.peek() == Some(&'|') => {
                chars.next();
                cells.last_mut().expect("never empty").push('|');
            }
            '|' => cells.push(String::new()),
            _ => cells.last_mut().expect("never empty").push(c),
        }
    }
    cells.pop();
    cells.iter().map(|cell| cell.trim().to_string()).collect()
}

/// The pass before: its folder, the images it settled, and what it said about the others.
#[derive(Default)]
struct Before {
    folder: Option<PathBuf>,
    settled: BTreeSet<String>,
    open: BTreeMap<String, String>,
}
impl Before {
    fn read(folder: &Path) -> Self {
        let (verdicts, mut settled) = verdicts(folder);
        let mut open = BTreeMap::new();
        for (file, verdict) in verdicts {
            match verdict {
                Verdict::Ok | Verdict::Kept => {
                    settled.insert(file);
                }
                Verdict::Blank => {
                    open.insert(file, "not looked at".to_string());
                }
                Verdict::Defect(said) => {
                    open.insert(file, said);
                }
            }
        }
        Self {
            folder: Some(folder.to_path_buf()),
            settled,
            open,
        }
    }
    fn image(&self, file: &str) -> Option<RgbImage> {
        Some(
            image::open(self.folder.as_ref()?.join(file))
                .ok()?
                .to_rgb8(),
        )
    }
    fn said(&self, file: &str) -> Option<String> {
        self.open.get(file).cloned()
    }
}

/// What the rounds before found and how it was to be fixed, each finding once, oldest first.
fn found_before(earlier: &[PathBuf]) -> Vec<(String, String, String)> {
    let mut said = BTreeSet::new();
    let mut found = Vec::new();
    for folder in earlier {
        for row in sheet_rows(folder) {
            if matches!(verdict(&row.said), Verdict::Defect(_))
                && said.insert(row.said.to_lowercase())
            {
                found.push((row.file, row.said, row.fix));
            }
        }
    }
    found
}

/// The frames whose moves the rounds before showed as strips.
fn moves_shown(earlier: &[PathBuf]) -> Vec<u64> {
    let frame = |name: &str| {
        name.strip_prefix("motion-")?
            .strip_suffix(".png")?
            .parse::<u64>()
            .ok()
    };
    let mut shown = BTreeSet::new();
    for folder in earlier {
        let Some(data) = std::fs::read(folder.join("polish.json"))
            .ok()
            .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
        else {
            continue;
        };
        let listed = data["moves"].as_array().into_iter().flatten();
        let settled = data["settled"].as_array().into_iter().flatten();
        shown.extend(
            listed
                .filter_map(|row| row["file"].as_str())
                .chain(settled.filter_map(Value::as_str))
                .filter_map(frame),
        );
    }
    shown.into_iter().collect()
}

/// Frames at which a visible clip starts while the film is running: the cuts.
fn cuts(manifest: &Manifest) -> Vec<u64> {
    let audio: BTreeSet<&str> = manifest
        .tracks
        .iter()
        .filter(|t| t.hidden)
        .map(|t| t.id.as_str())
        .collect();
    manifest
        .clips
        .iter()
        .filter(|c| {
            c.clip_type != ClipType::Audio && !c.hidden && !audio.contains(c.track.as_str())
        })
        .flat_map(|c| [c.start_frame, c.end_frame()])
        .filter(|&f| f > 0 && f < manifest.duration_frames)
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

/// Four overlapping quarters, a and b across the top, c and d across the bottom, each at native
/// resolution and small enough to be looked at without being scaled down.
fn tiles(width: u32, height: u32) -> Vec<(char, [u32; 4])> {
    let (w, h) = (width * 11 / 20, height * 11 / 20);
    let xs = [0, width - w];
    let ys = [0, height - h];
    "abcd"
        .chars()
        .enumerate()
        .map(|(i, letter)| (letter, [xs[i % 2], ys[i / 2], w, h]))
        .collect()
}

/// Whether more than a few pixels differ, in the whole image or inside x, y, w, h.
fn differs(a: &RgbImage, b: &RgbImage, area: Option<[u32; 4]>) -> bool {
    let [x0, y0, w, h] = area.unwrap_or([0, 0, a.width(), a.height()]);
    let mut count = 0;
    for y in y0..y0 + h {
        for x in x0..x0 + w {
            let (p, q) = (a.get_pixel(x, y).0, b.get_pixel(x, y).0);
            if p.iter().zip(q).any(|(m, n)| m.abs_diff(n) > PIXEL_STEP) {
                count += 1;
                if count > CHANGED_PIXELS {
                    return true;
                }
            }
        }
    }
    false
}

struct Peak {
    /// The sample at which the move shows most.
    frame: u64,
    change: f64,
    /// The scene the move belongs to, as a half-open frame range.
    from: u64,
    to: u64,
}

/// The fastest moves inside every scene, strongest first: at most one per SECONDS_PER_STRIP of
/// scene, at least two seconds apart from each other and from the moves in `shown`, never
/// across a cut.
fn moves(
    samples: &[(u64, Vec<u8>)],
    cuts: &[u64],
    duration: u64,
    fps: f64,
    shown: &[u64],
) -> Vec<Peak> {
    let bounds: Vec<u64> = [0]
        .into_iter()
        .chain(cuts.iter().copied())
        .chain([duration])
        .collect();
    let apart = (2.0 * fps).round() as u64;
    let mut out = Vec::new();
    for scene in bounds.windows(2) {
        let (from, to) = (scene[0], scene[1]);
        let mut inside: Vec<(u64, f64)> = samples
            .windows(2)
            .filter(|w| w[0].0 >= from && w[1].0 < to)
            .map(|w| (w[1].0, review::difference(&w[0].1, &w[1].1)))
            .filter(|&(_, change)| change >= MOVE_LEVEL)
            .collect();
        inside.sort_by(|a, b| b.1.total_cmp(&a.1));
        let most = (((to - from) as f64 / fps / SECONDS_PER_STRIP).ceil() as usize)
            .clamp(1, STRIPS_PER_SCENE);
        let mut picked: Vec<u64> = Vec::new();
        for (frame, change) in inside {
            if picked.len() == most {
                break;
            }
            if picked
                .iter()
                .chain(shown)
                .all(|&p| p.abs_diff(frame) >= apart)
            {
                picked.push(frame);
                out.push(Peak {
                    frame,
                    change,
                    from,
                    to,
                });
            }
        }
    }
    out.sort_by(|a, b| b.change.total_cmp(&a.change));
    out
}

fn label(frame: u64, fps: f64) -> String {
    format!("F {frame}  {:.1}s", frame as f64 / fps)
}

/// `polish.md`: how to look, and one row per image for the defect and its fix.
struct Worksheet<'a> {
    pass: u32,
    round: u8,
    rounds: u8,
    picture: &'a str,
    every: f64,
    /// Seconds from which the stills come every `every`.
    start: f64,
    /// What earlier rounds found: image, defect, fix.
    found: &'a [(String, String, String)],
    fps: f64,
    duration: u64,
    stills: usize,
    cuts: usize,
    strips: usize,
    rows: &'a [Row],
    cut_rows: &'a [Row],
    move_rows: &'a [Row],
    settled: usize,
    words: &'a [review::Word],
}
impl Worksheet<'_> {
    fn render(&self) -> String {
        let cell = |text: &str| text.replace('|', "\\|");
        let mut md = format!("# Polish pass {}", self.pass);
        if self.rounds > 1 || self.round > 1 {
            let _ = write!(md, ", round {} of {}", self.round, self.rounds);
        }
        md.push_str("\n\n");
        let from = if self.start > 0.0 {
            format!(" from {} s on", review::round(self.start, 2))
        } else {
            String::new()
        };
        let _ = writeln!(
            md,
            "A still every {} s{from} ({}), {} and {}. Picture `{}`, {} frames at {} fps.\n",
            self.every,
            count(self.stills, "still"),
            count(self.cuts, "cut"),
            count(self.strips, "fast move"),
            &self.picture[..self.picture.len().min(12)],
            self.duration,
            review::round(self.fps, 3)
        );
        let listed = self.rows.len() + self.cut_rows.len() + self.move_rows.len();
        if self.settled > 0 {
            let _ = writeln!(
                md,
                "{} unchanged since a pass that called them `ok` or `kept`, so not listed again.\n",
                count(self.settled, "image")
            );
        }
        if listed == 0 {
            md.push_str("Nothing changed and nothing is open: this pass is clean. Record it with `superint-video polish <dir> --accept`.\n");
            return md;
        }
        if self.round > 1 {
            md.push_str(&self.found_before());
        }
        md.push_str(match self.round {
            0 | 1 => HOW_TO_LOOK,
            2 => ROUND_TWO,
            _ => ROUND_THREE,
        });
        md.push_str(FILL_IN);
        let table = |md: &mut String, title: &str, about: &str, rows: &[Row]| {
            if rows.is_empty() {
                return;
            }
            let _ = write!(
                md,
                "\n## {title}\n\n{about}\n\n| Image | Time | Words | Close-ups | Defect | Fix |\n| --- | --- | --- | --- | --- | --- |\n"
            );
            for row in rows {
                let _ = writeln!(
                    md,
                    "| {} | {:.1} s | {} | {} | {} | |",
                    row.file,
                    row.frame as f64 / self.fps,
                    cell(&review::spoken(self.words, row.frame, self.fps)),
                    row.close_ups
                        .iter()
                        .map(char::to_string)
                        .collect::<Vec<_>>()
                        .join(" "),
                    row.carried
                        .as_deref()
                        .map(|said| cell(&format!(
                            "unchanged since the pass before, which said: {said}"
                        )))
                        .unwrap_or_default(),
                );
            }
        };
        table(
            &mut md,
            "Stills",
            if self.round > 1 {
                "Each still at full size, with close-ups `close-<frame>-<letter>.png` of its quarters (a b across the top, c d across the bottom); a quarter that shows what an earlier close-up of this pass showed is left out. For any other detail: `review <dir> --frames <f> --crop x,y,w,h`."
            } else {
                "Each still at full size. A still that shows a new view also has close-ups `close-<frame>-<letter>.png` of its quarters (a b across the top, c d across the bottom); a quarter that shows what an earlier close-up showed is left out. For any other detail: `review <dir> --frames <f> --crop x,y,w,h`."
            },
            self.rows,
        );
        table(
            &mut md,
            "Cuts",
            "The last frame before each cut beside the first frame after it.",
            self.cut_rows,
        );
        table(
            &mut md,
            "Moves",
            if self.round > 1 {
                "The fastest moves no earlier round showed, three frames apart."
            } else {
                "The fastest moves, three frames apart."
            },
            self.move_rows,
        );
        md
    }

    /// What the rounds before found, for this round to check and to look for elsewhere.
    fn found_before(&self) -> String {
        let mut md = String::from("## Found in earlier rounds\n\n");
        if self.found.is_empty() {
            md.push_str("The earlier rounds found nothing to fix.\n\n");
            return md;
        }
        md.push_str("Fixed since. Check that each fix holds wherever the thing appears, and look for the same kind of fault elsewhere.\n\n");
        let at = |file: &str| {
            file.trim_end_matches(".png")
                .rsplit('-')
                .next()
                .and_then(|digits| digits.parse::<u64>().ok())
                .map(|frame| format!("{:.1} s, ", frame as f64 / self.fps))
                .unwrap_or_default()
        };
        for (file, said, fix) in self.found.iter().take(MOST_FOUND) {
            let fix = if fix.is_empty() {
                String::new()
            } else {
                format!(" Fix: {fix}")
            };
            let said = said.trim_end_matches('.');
            let _ = writeln!(md, "- {}`{file}`: {said}.{fix}", at(file));
        }
        if self.found.len() > MOST_FOUND {
            let _ = writeln!(
                md,
                "- and {} more in the worksheets of the earlier rounds",
                self.found.len() - MOST_FOUND
            );
        }
        md.push('\n');
        md
    }
}

fn count(n: usize, noun: &str) -> String {
    format!("{n} {noun}{}", if n == 1 { "" } else { "s" })
}

/// The questions a viewer answers at a glance. They are about how things are made, not about a
/// style; the workflow's rubric and the project's references say what good looks like.
const HOW_TO_LOOK: &str = "## How to look

Open every image listed below at full size; the contact sheet is only the map. Look as someone who has never seen the film: name each thing in the picture before you judge it, then ask of each one:

1. **Built right?** Parts that belong together fit: a lid as wide as its base, pages inside their cover, flaps that meet, drawers inside a body, a shelf on its brackets, a handle joined to its cup.
2. **One viewpoint, one light?** Everything on a surface is seen from the same side and lit from the same side, and touches the surface with a tight shadow. Nothing floats.
3. **Does it look like its name?** Cover the label: would a stranger still say what it is?
4. **Finished?** The smallest icon gets the care of the hero object. A plain disc, bar or blob that stands for a real thing is a placeholder.
5. **Clean?** Nothing sticks out of what holds it, covers a label, is cut to a sliver by the frame edge, or is left over from an earlier beat. Lines end on what they join; text is spelled right and stays long enough to read.
6. **The same everywhere?** A thing that appears twice (large and as an icon, in two scenes) is the same thing both times.
7. **Cuts:** what is on screen before a cut and gone after it pops. Carry it across and fade it, or let it go before the cut. On a match cut, size and place agree.
8. **Moves:** things ease in and out and come from a place that makes sense. Nothing appears or vanishes inside one frame, and layers keep their order mid-move.

Then compare with the references and the workflow's rubric: would this frame stand beside them?
";

/// A second round, by new eyes after the first round's fixes: what those fixes left, and the
/// detail the first look skimmed.
const ROUND_TWO: &str = "## How to look: round 2

An earlier round looked for what a viewer spots at once and fixed it. You are new to this film: look for what is still wrong after those fixes. This round's stills fall between the earlier ones, every still has close-ups, and the moves are ones the earlier round did not show. Open every image listed below at full size; the contact sheet is only the map. Name each thing in the picture before you judge it, then ask:

1. **Do the fixes hold?** Each finding above is gone wherever that thing appears, and its fix broke nothing next to it: a shadow, a seam, a label, an overlap.
2. **The same fault elsewhere?** A finding is a kind of fault. One floating lamp means every foot and shadow gets a look; one lid too narrow means every part that should fit.
3. **Behind the hero.** The background, the edges and the corners of every close-up: each prop finished, nothing plain or standing in for a real thing, nothing cut to a sliver.
4. **Between the stills.** A half-finished entrance, a label mid-fade, two things overlapping for a moment, a gap where something was.
5. **Detail against the references.** Set each still beside the closest reference and name what the reference has that this frame lacks: texture, small parts, wear, light, things moving in the background. Add it.
6. **Words on screen.** Spelled right, in the film's language, readable at their size, on screen long enough, gone when the voice moves on.

Anything new or changed still answers the first round's questions: built right, one viewpoint and one light, looks like its name, finished, clean, the same everywhere.
";

/// A third round: the viewer who pauses, after two rounds of fixes.
const ROUND_THREE: &str = "## How to look: round 3

Earlier rounds fixed what a viewer spots at once and what was left after that. You are new to this film: look at it as the viewer who pauses and looks closely. This round's stills fall between all earlier ones, every still has close-ups, and the moves are ones no round showed yet. Open every image listed below at full size, name each thing in it, then ask:

1. **Do the fixes hold?** Each finding above is gone everywhere, its kind is found nowhere else, and no fix broke a neighbour.
2. **One film.** Follow each thing that comes back through every scene: the same size, colour, build and light each time, and one look per place.
3. **Light and depth.** Shadows agree across cuts; front, middle and back read apart; nothing is flat that should have volume.
4. **Materials and small parts.** Would the frame hold as a print on a wall? Seams, screws, wear, highlights and edges where the real thing has them.
5. **Motion.** In the strips: arcs, easing, overlap and follow-through; nothing stiff, nothing linear, nothing passing through something solid.
6. **Composition.** One place to look at a time, and it is the thing the voice speaks about; no frame crowded, none empty.
7. **The end.** The last frames and the end card at full size: the message reads, nothing is left over.
";

/// How every round fills in its worksheet and ends.
const FILL_IN: &str = "
Fill in every row before changing anything: the defect and its fix, as concrete as a note to a colleague. `ok` plus a few words when the image holds up; `kept: <reason>` for something left on purpose. Then fix everything, run `check`, and run `polish` again: it lists only what changed or stayed open. A pass with nothing but `ok` and `kept` is recorded with `polish --accept`.
";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn close_ups_cover_the_frame_at_native_size() {
        let tiles = tiles(1920, 1080);
        assert_eq!(tiles.len(), 4);
        assert_eq!(tiles[0], ('a', [0, 0, 1056, 594]));
        assert_eq!(tiles[3], ('d', [864, 486, 1056, 594]));
        // neighbours overlap, so nothing sits on a seam only
        assert!(tiles[1].1[0] < tiles[0].1[0] + tiles[0].1[2]);
        assert!(tiles[2].1[1] < tiles[0].1[1] + tiles[0].1[3]);
    }

    #[test]
    fn a_small_change_counts_and_a_stray_pixel_does_not() {
        let a = RgbImage::from_pixel(200, 100, image::Rgb([40, 40, 40]));
        let mut b = a.clone();
        b.put_pixel(10, 10, image::Rgb([200, 40, 40]));
        assert!(!differs(&a, &b, None));
        for x in 100..106 {
            for y in 50..56 {
                b.put_pixel(x, y, image::Rgb([200, 200, 40]));
            }
        }
        assert!(differs(&a, &b, None));
        assert!(differs(&a, &b, Some([90, 40, 30, 30])));
        assert!(!differs(&a, &b, Some([0, 0, 60, 60])));
    }

    #[test]
    fn table_rows_split_into_cells_and_keep_escaped_pipes() {
        let row = cells(r"| frame-000150.png | 5.0 s | a \| b | a c | ok: holds up | |");
        assert_eq!(row.len(), 6);
        assert_eq!(row[0], "frame-000150.png");
        assert_eq!(row[2], "a | b");
        assert_eq!(row[4], "ok: holds up");
        assert_eq!(row[5], "");
        assert!(cells("Some text").is_empty());
    }

    #[test]
    fn the_fastest_moves_stay_inside_their_scene_and_apart() {
        let flat = vec![0u8; 16];
        let jump = |level: u8| vec![level; 16];
        // samples every 15 frames; a move at 60, a stronger one at 75, a cut at 150, a move at 210
        let samples: Vec<(u64, Vec<u8>)> = (0..20)
            .map(|i| {
                let frame = i * 15;
                let picture = match frame {
                    60 => jump(5),
                    75 => jump(20),
                    150 => jump(90),
                    210 => jump(100),
                    f if f > 210 => jump(100),
                    f if f >= 150 => jump(90),
                    f if f > 75 => jump(20),
                    _ => flat.clone(),
                };
                (frame, picture)
            })
            .collect();
        let peaks = moves(&samples, &[150], 300, 30.0, &[]);
        let frames: Vec<u64> = peaks.iter().map(|p| p.frame).collect();
        // 75 beats 60 and they are closer than two seconds; the cut itself is no move
        assert_eq!(frames, vec![75, 210]);
        assert_eq!((peaks[0].from, peaks[0].to), (0, 150));
        assert_eq!((peaks[1].from, peaks[1].to), (150, 300));
        // A later round skips the moves an earlier round showed: the next fastest takes over.
        let later = moves(&samples, &[150], 300, 30.0, &[75, 210]);
        let frames: Vec<u64> = later.iter().map(|p| p.frame).collect();
        assert!(frames.is_empty(), "60 is too close to 75: {frames:?}");
        let later = moves(&samples, &[150], 300, 30.0, &[150, 210]);
        let frames: Vec<u64> = later.iter().map(|p| p.frame).collect();
        assert_eq!(frames, vec![75]);
    }

    #[test]
    fn rounds_are_one_to_three_and_the_brief_beats_the_setting() {
        assert_eq!(DEFAULT_ROUNDS, 1);
        assert_eq!(
            crate::home::Settings::default().polish_rounds,
            DEFAULT_ROUNDS
        );
        for (text, rounds) in [("1", 1), ("2", 2), (" 3 ", 3)] {
            assert_eq!(parse_rounds(text).unwrap(), rounds);
        }
        for text in ["0", "4", "-1", "two", "", "2.5", "300"] {
            assert!(parse_rounds(text).is_err(), "{text} is no number of rounds");
        }
        let film = tempfile::tempdir().unwrap();
        // No brief: the setting, kept inside 1..=3 even when the file holds something else.
        assert_eq!(rounds_with(film.path(), 2).unwrap(), (2, "settings"));
        assert_eq!(rounds_with(film.path(), 0).unwrap(), (1, "settings"));
        assert_eq!(rounds_with(film.path(), 9).unwrap(), (3, "settings"));
        let brief = film.path().join("brief.md");
        std::fs::write(&brief, "---\npreset: blank\n---\n\n# Brief\n").unwrap();
        assert_eq!(rounds_with(film.path(), 2).unwrap(), (2, "settings"));
        std::fs::write(&brief, "---\npreset: blank\npolishRounds: \"\"\n---\n").unwrap();
        assert_eq!(rounds_with(film.path(), 2).unwrap(), (2, "settings"));
        std::fs::write(&brief, "---\npreset: blank\npolishRounds: 3\n---\n").unwrap();
        assert_eq!(rounds_with(film.path(), 1).unwrap(), (3, "brief"));
        std::fs::write(&brief, "---\npolishRounds: 5\n---\n").unwrap();
        let wrong = rounds_with(film.path(), 1).unwrap_err();
        assert!(format!("{wrong:#}").contains("brief.md"), "{wrong:#}");
    }

    /// A finished pass of `round` in `renders/polish/<pass>` whose worksheet holds `rows`.
    fn finished_pass(root: &Path, pass: u32, round: u8, moves: &[&str], rows: &str) -> PathBuf {
        let folder = passes(root).join(pass.to_string());
        std::fs::create_dir_all(&folder).unwrap();
        let moves: Vec<Value> = moves.iter().map(|file| json!({"file": file})).collect();
        std::fs::write(
            folder.join("polish.json"),
            json!({"pass": pass, "round": round, "moves": moves, "settled": ["motion-000400.png"]})
                .to_string(),
        )
        .unwrap();
        std::fs::write(
            folder.join("polish.md"),
            format!(
                "| Image | Time | Words | Close-ups | Defect | Fix |\n| --- | --- | --- | --- | --- | --- |\n{rows}"
            ),
        )
        .unwrap();
        folder
    }

    fn accepted(root: &Path, pass: u32, round: u8) {
        std::fs::create_dir_all(root.join("process")).unwrap();
        std::fs::write(
            root.join(RECORD),
            json!({"pass": pass, "round": round, "picture": "p"}).to_string(),
        )
        .unwrap();
    }

    #[test]
    fn an_accepted_round_starts_the_next_until_the_last() {
        let film = tempfile::tempdir().unwrap();
        let root = film.path();
        let first = next(root, 2);
        assert_eq!((first.pass, first.round, first.rounds), (1, 1, 2));
        assert!(first.previous.is_none() && first.earlier.is_empty());

        // Round 1 goes on until a pass of it is accepted.
        let one = finished_pass(
            root,
            1,
            1,
            &["motion-000090.png"],
            "| frame-000150.png | 5.0 s | | | lamp floats above the desk. | redraw its foot |\n",
        );
        let again = next(root, 2);
        assert_eq!((again.pass, again.round), (2, 1));
        assert_eq!(again.previous.as_deref(), Some(one.as_path()));
        let two = finished_pass(
            root,
            2,
            1,
            &[],
            "| frame-000150.png | 5.0 s | | | ok: stands now | |\n",
        );
        accepted(root, 2, 1);

        // The next round starts fresh and knows what round 1 found and which moves it showed.
        let round_two = next(root, 2);
        assert_eq!((round_two.pass, round_two.round), (3, 2));
        assert!(round_two.previous.is_none());
        assert_eq!(round_two.earlier, vec![one.clone(), two.clone()]);
        let found = found_before(&round_two.earlier);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].1, "lamp floats above the desk.");
        assert_eq!(found[0].2, "redraw its foot");
        assert_eq!(moves_shown(&round_two.earlier), vec![90, 400]);

        // A film that gets one round goes on with that round after it was accepted: a change is
        // looked at in a pass that lists what changed.
        let one_round = next(root, 1);
        assert_eq!(
            (one_round.round, one_round.previous),
            (1, Some(two.clone()))
        );

        // A pass of round 2 that is not accepted yet goes on with round 2; once the last round
        // is accepted, later passes stay in it.
        let three = finished_pass(root, 3, 2, &[], "");
        let more = next(root, 2);
        assert_eq!((more.pass, more.round), (4, 2));
        assert_eq!(more.previous.as_deref(), Some(three.as_path()));
        assert_eq!(more.earlier, vec![one, two]);
        accepted(root, 3, 2);
        let after = next(root, 2);
        assert_eq!((after.round, after.previous), (2, Some(three)));
    }

    #[test]
    fn each_round_looks_between_the_stills_of_the_rounds_before() {
        assert_eq!(offset(1, 5.0), 0.0);
        assert_eq!(offset(2, 5.0), 2.5);
        assert_eq!(offset(3, 5.0), 1.25);
        let fps = 30.0;
        let grids: Vec<BTreeSet<u64>> = (1..=3)
            .map(|round| {
                let mut stills = review::grid(5.0, offset(round, 5.0), fps, 900);
                stills.pop(); // every round ends on the last frame
                stills.into_iter().collect()
            })
            .collect();
        assert!(grids[0].is_disjoint(&grids[1]));
        assert!(grids[0].is_disjoint(&grids[2]));
        assert!(grids[1].is_disjoint(&grids[2]));
    }

    #[test]
    fn a_later_round_has_its_own_questions_and_the_earlier_findings() {
        let found = vec![(
            "frame-000150.png".to_string(),
            "lamp floats above the desk.".to_string(),
            "redraw its foot".to_string(),
        )];
        let rows = vec![Row {
            file: "frame-000075.png".into(),
            frame: 75,
            close_ups: vec!['a', 'b', 'c', 'd'],
            carried: None,
        }];
        let sheet = |round: u8, rounds: u8, found: &[(String, String, String)]| {
            Worksheet {
                pass: 3,
                round,
                rounds,
                picture: "0123456789abcdef",
                every: 5.0,
                start: offset(round, 5.0),
                found,
                fps: 30.0,
                duration: 900,
                stills: 6,
                cuts: 0,
                strips: 0,
                rows: &rows,
                cut_rows: &[],
                move_rows: &[],
                settled: 0,
                words: &[],
            }
            .render()
        };
        let first = sheet(1, 1, &[]);
        assert!(first.starts_with("# Polish pass 3\n"));
        assert!(first.contains("## How to look\n") && !first.contains("Found in earlier rounds"));
        let second = sheet(2, 3, &found);
        assert!(second.starts_with("# Polish pass 3, round 2 of 3\n"));
        assert!(second.contains("A still every 5 s from 2.5 s on"));
        assert!(second.contains(
            "- 5.0 s, `frame-000150.png`: lamp floats above the desk. Fix: redraw its foot\n"
        ));
        assert!(second.contains("## How to look: round 2") && second.contains("Fill in every row"));
        // The rows still read as the overview and `--accept` read them.
        assert!(second.contains("| frame-000075.png | 2.5 s |  | a b c d |  | |"));
        let third = sheet(3, 3, &[]);
        assert!(third.contains("## How to look: round 3"));
        assert!(third.contains("The earlier rounds found nothing to fix."));
    }

    #[test]
    fn the_overview_counts_what_the_worksheet_says() {
        let project = tempfile::TempDir::new().unwrap();
        let folder = project.path().join("renders/polish/2");
        std::fs::create_dir_all(&folder).unwrap();
        assert_eq!(overview(project.path()).unwrap()["capturing"], true);
        std::fs::write(
            folder.join("polish.json"),
            json!({
                "stills": [
                    {"file": "frame-000000.png", "time": 0.0, "closeUps": ["close-000000-a.png"]},
                    {"file": "frame-000150.png", "time": 5.0, "closeUps": []},
                ],
                "cuts": [{"file": "cut-000090.png", "time": 3.0, "closeUps": []}],
                "moves": [{"file": "motion-000030.png", "time": 1.0, "closeUps": []}],
                "settled": ["frame-000300.png"],
            })
            .to_string(),
        )
        .unwrap();
        std::fs::write(
            folder.join("polish.md"),
            "| Image | Time | Words | Close-ups | Defect | Fix |\n| --- | --- | --- | --- | --- | --- |\n\
             | `frame-000000.png` | 0:00 | | a | ok, holds up | |\n\
             | `frame-000150.png` | 0:05 | | | lamp floats above the desk | redraw its foot |\n\
             | `cut-000090.png` | 0:03 | | | kept: the glow is meant to stay | |\n\
             | `motion-000030.png` | 0:01 | | | | |\n",
        )
        .unwrap();
        let view = overview(project.path()).unwrap();
        assert_eq!(view["pass"], 2);
        assert_eq!(view["folder"], "renders/polish/2");
        assert_eq!(
            view["counts"],
            json!({"listed": 4, "ok": 1, "kept": 1, "defects": 1, "open": 1, "settled": 1})
        );
        let lamp = &view["rows"][1];
        assert_eq!(lamp["verdict"], "defect");
        assert_eq!(lamp["fix"], "redraw its foot");
        assert_eq!(view["rows"][3]["kind"], "move");
        assert_eq!(view["record"]["state"], "missing");
    }

    #[test]
    fn a_worksheet_row_is_ok_kept_blank_or_a_defect() {
        let folder = tempfile::tempdir().unwrap();
        std::fs::write(
            folder.path().join("polish.md"),
            "| Image | Time | Words | Close-ups | Defect | Fix |\n| --- | --- | --- | --- | --- | --- |\n\
             | frame-000000.png | 0.0 s | | a | ok: reads at once | |\n\
             | frame-000150.png | 5.0 s | | | Kept: the peek is on purpose | |\n\
             | cut-000300.png | 10.0 s | | | glow pops | carry it over |\n\
             | motion-000400.png | 13.3 s | | | | |\n",
        )
        .unwrap();
        let (verdicts, _) = verdicts(folder.path());
        assert!(matches!(verdicts["frame-000000.png"], Verdict::Ok));
        assert!(matches!(verdicts["frame-000150.png"], Verdict::Kept));
        assert!(matches!(verdicts["cut-000300.png"], Verdict::Defect(_)));
        assert!(matches!(verdicts["motion-000400.png"], Verdict::Blank));
        let before = Before::read(folder.path());
        assert!(before.settled.contains("frame-000150.png"));
        assert_eq!(before.said("cut-000300.png").as_deref(), Some("glow pops"));
        assert_eq!(
            before.said("motion-000400.png").as_deref(),
            Some("not looked at")
        );
    }
}
