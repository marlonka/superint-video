//! `polish`: the last look before a render, made for eyes that did not build the film, one
//! picture at a time. A round walks the film in steps of ten seconds (five in a short film).
//! Every `polish` call takes the next still from the picture as it is now; the polisher looks at
//! that one picture, fixes what is wrong in it, looks once at the fixed still, writes its row
//! and calls again for the next. Earlier fixes therefore show in every later still, a still is
//! taken at most twice, and nobody looks at hundreds of images.
//! `--accept` records the walk once every row says `ok`, `kept` or `fixed`, and `render` asks
//! for that record. Judging stays with whoever looks.
//!
//! A film gets one to three rounds (`polishRounds`). A round is one pair of fresh eyes. The round
//! after an accepted one walks the film again with stills between the earlier ones, what the
//! earlier rounds fixed, and questions of its own. After the last round, a change to the picture
//! gets a pass that lists only the stills that no longer show what somebody looked at.
use crate::{
    project::{self, ProjectSnapshot, without_verbatim},
    renderer::{self, Capture},
    review,
};
use anyhow::{Context, Result, bail, ensure};
use image::RgbImage;
use serde_json::{Value, json};
use std::{
    collections::{BTreeMap, BTreeSet},
    fmt::Write as _,
    path::{Path, PathBuf},
    time::Instant,
};

/// Seconds between stills unless `--every` says otherwise …
pub const EVERY_SECONDS: f64 = 10.0;
/// … and in a film no longer than `SHORT_FILM_SECONDS`.
pub const EVERY_SECONDS_SHORT: f64 = 5.0;
pub const SHORT_FILM_SECONDS: f64 = 60.0;
/// A channel must move this far for a pixel to count as changed since somebody looked …
const PIXEL_STEP: u8 = 10;
/// … and this many pixels must change. The browser repeats a frame exactly; the slack is for
/// the odd rounding at an edge.
const CHANGED_PIXELS: usize = 24;
/// How often one still is taken in a walk: as it was, and once with the fix in it.
const MOST_LOOKS: u64 = 2;
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

/// Seconds between the stills of a film that long.
pub fn every_for(seconds: f64) -> f64 {
    if seconds <= SHORT_FILM_SECONDS {
        EVERY_SECONDS_SHORT
    } else {
        EVERY_SECONDS
    }
}

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

/// The passes that were laid out, oldest first, with what their `polish.json` says.
fn finished(root: &Path) -> Vec<(u32, PathBuf, Value)> {
    let mut done: Vec<(u32, PathBuf, Value)> = std::fs::read_dir(passes(root))
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| {
            let pass = entry.file_name().to_str()?.parse::<u32>().ok()?;
            let data = read_pass(&entry.path()).ok()?;
            Some((pass, entry.path(), data))
        })
        .collect();
    done.sort_by_key(|(pass, ..)| *pass);
    done
}

fn record(root: &Path) -> Option<Value> {
    serde_json::from_slice(&std::fs::read(root.join(RECORD)).ok()?).ok()
}

fn read_pass(folder: &Path) -> Result<Value> {
    let bytes = std::fs::read(folder.join("polish.json"))
        .with_context(|| format!("{} has no polish.json", folder.display()))?;
    serde_json::from_slice(&bytes).context("polish.json is invalid")
}

fn write_pass(folder: &Path, data: &Value) -> Result<()> {
    project::atomic_write(
        &folder.join("polish.json"),
        &serde_json::to_vec_pretty(data)?,
    )
}

/// The images a pass lists, in the order they are looked at, with their frames. A pass from
/// before the walk also listed cuts and moves.
fn listed(data: &Value) -> Vec<(String, u64)> {
    ["stills", "cuts", "moves"]
        .iter()
        .flat_map(|list| data[*list].as_array().into_iter().flatten())
        .filter_map(|row| {
            Some((
                row["file"].as_str()?.to_string(),
                row["frame"].as_u64().unwrap_or(0),
            ))
        })
        .collect()
}

/// What the next `polish` call does.
#[derive(Debug, PartialEq)]
enum Step {
    /// Start a round: every still of its grid gets a row, and they are taken one by one.
    Walk,
    /// The picture changed after the pass in this folder was accepted: take every still and
    /// list those that no longer show what that pass looked at.
    Changed(PathBuf),
    /// Go on with the latest pass at its next empty row.
    Resume,
    /// The polish is accepted for the picture as it is.
    Done,
}

/// What the next `polish` call works on.
pub struct Next {
    /// `renders/polish/<pass>`.
    pub output: PathBuf,
    pub pass: u32,
    /// The round it belongs to, and how many the film gets.
    pub round: u8,
    pub rounds: u8,
    step: Step,
    /// The passes of the rounds before this one.
    earlier: Vec<PathBuf>,
}

/// What `polish` does next for a film that gets `rounds` rounds and whose picture is `picture`.
/// An open walk goes on. Once the latest pass is the accepted one, the next round starts while
/// rounds are left; after the last round a changed picture gets a pass over what changed.
pub fn next(root: &Path, rounds: u8, picture: &str) -> Next {
    let done = finished(root);
    let record = record(root);
    let accepted = record.as_ref().and_then(|record| record["pass"].as_u64());
    let fresh = latest(root).unwrap_or(0) + 1;
    let (pass, round, step) = match done.last() {
        None => (fresh, 1, Step::Walk),
        Some((last, folder, data)) => {
            let round = round_of(data);
            if accepted == Some(u64::from(*last)) {
                if round < rounds {
                    (fresh, round + 1, Step::Walk)
                } else if record.as_ref().is_some_and(|r| r["picture"] == picture) {
                    (*last, round, Step::Done)
                } else {
                    (fresh, round, Step::Changed(folder.clone()))
                }
            } else if data["walk"] == true {
                (*last, round, Step::Resume)
            } else {
                // A pass from before the walk laid everything out at once and was never
                // accepted: the round starts over, one picture at a time.
                (fresh, round, Step::Walk)
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
        step,
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
/// worksheet says about it so far, which one is being looked at, and whether a clean pass is on
/// record for the picture. None while no pass was ever started.
pub fn overview(root: &Path) -> Option<Value> {
    let pass = latest(root)?;
    let folder = passes(root).join(pass.to_string());
    let record = remembered_state(root);
    let place = format!("renders/polish/{pass}");
    let Ok(data) = read_pass(&folder) else {
        // The frames are still being taken.
        return Some(json!({"pass": pass, "folder": place, "capturing": true, "record": record}));
    };
    let said: BTreeMap<String, (String, String)> = sheet_rows(&folder)
        .into_iter()
        .map(|row| (row.file, (row.said, row.fix)))
        .collect();
    let walk = data["walk"] == true;
    let mut rows = Vec::new();
    let (mut fine, mut kept, mut fixed, mut defects, mut open) = (0, 0, 0, 0, 0);
    let mut current = Value::Null;
    for (kind, list) in [("still", "stills"), ("cut", "cuts"), ("move", "moves")] {
        for row in data[list].as_array().into_iter().flatten() {
            let file = row["file"].as_str().unwrap_or_default();
            let (found, fix) = said.get(file).cloned().unwrap_or_default();
            let verdict = match verdict(&found, &fix) {
                Verdict::Blank => {
                    open += 1;
                    if current.is_null() {
                        current = json!(file);
                    }
                    "open"
                }
                Verdict::Ok => {
                    fine += 1;
                    "ok"
                }
                Verdict::Kept => {
                    kept += 1;
                    "kept"
                }
                Verdict::Fixed => {
                    fixed += 1;
                    "fixed"
                }
                Verdict::Defect(_) => {
                    defects += 1;
                    "defect"
                }
            };
            let close_ups = match &row["closeUps"] {
                Value::Array(list) => json!(list),
                _ => json!([]),
            };
            rows.push(json!({
                "file": file, "kind": kind, "time": row["time"], "closeUps": close_ups,
                // A walk takes a still when its turn comes; until then there is no picture.
                "taken": !walk || row["taken"].is_string(),
                "verdict": verdict, "said": found, "fix": fix,
            }));
        }
    }
    Some(json!({
        "pass": pass,
        "folder": place,
        "capturing": false,
        "record": record,
        "walk": walk,
        "current": current,
        "round": round_of(&data),
        // As many as the film gets now; the pass may have been taken before a change.
        "rounds": record["rounds"].as_u64().or(data["rounds"].as_u64()).unwrap_or(1),
        "rows": rows,
        "counts": {
            "listed": rows.len(), "ok": fine, "kept": kept, "fixed": fixed, "defects": defects,
            "open": open, "settled": data["settled"].as_array().map_or(0, Vec::len),
        },
    }))
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

fn still_name(frame: u64) -> String {
    format!("frame-{frame:06}.png")
}

/// The next step of the polish: starts a pass when one is due, then takes the still of the first
/// empty row from the picture as it is now and names it. `every` only counts when a round
/// starts; without it the film's length decides.
pub async fn polish(
    snapshot: ProjectSnapshot,
    picture: &str,
    every: Option<f64>,
    next: &Next,
) -> Result<Value> {
    let started = Instant::now();
    let output = next.output.as_path();
    if next.step == Step::Done {
        return Ok(json!({
            "pass": next.pass, "round": next.round, "rounds": next.rounds, "accepted": true,
            "next": null, "left": 0,
            "note": "The polish is accepted for the picture as it is: nothing to look at.",
        }));
    }
    let manifest = &snapshot.manifest;
    let fps = manifest.fps.num as f64 / manifest.fps.den as f64;
    let duration = manifest.duration_frames;
    let words = review::words(&snapshot.root, manifest);
    let mut capture: Option<Capture> = None;
    let result = async {
        let mut data = match &next.step {
            Step::Resume => read_pass(output)?,
            Step::Walk => {
                let every = every.unwrap_or_else(|| every_for(duration as f64 / fps));
                ensure!(every * fps >= 1.0, "--every must be at least one frame");
                let start = offset(next.round, every);
                let frames = review::grid(every, start, fps, duration);
                let rows: Vec<Row> = frames.iter().map(|&frame| Row::new(frame)).collect();
                let data = pass_data(&snapshot, picture, next, every, start, &rows, &[], false);
                std::fs::create_dir_all(output)?;
                let sheet = Worksheet {
                    pass: next.pass,
                    round: next.round,
                    rounds: next.rounds,
                    picture,
                    every,
                    start,
                    found: &found_before(&next.earlier),
                    fps,
                    duration,
                    stills: frames.len(),
                    rows: &rows,
                    settled: 0,
                    changed: false,
                    words: &words,
                };
                std::fs::write(output.join("polish.md"), sheet.render())?;
                write_pass(output, &data)?;
                data
            }
            Step::Changed(accepted) => {
                // The same stills the accepted pass looked at, so the two compare.
                let then = read_pass(accepted)?;
                let every = every
                    .or(then["every"].as_f64())
                    .unwrap_or_else(|| every_for(duration as f64 / fps));
                ensure!(every * fps >= 1.0, "--every must be at least one frame");
                let start = then["offset"]
                    .as_f64()
                    .unwrap_or_else(|| offset(next.round, every));
                let frames = review::grid(every, start, fps, duration);
                let before = Before::read(accepted);
                std::fs::create_dir_all(output)?;
                let camera = opened(&mut capture, &snapshot).await?;
                let (mut rows, mut settled, mut thumbs) = (Vec::new(), Vec::new(), Vec::new());
                for &frame in &frames {
                    let file = still_name(frame);
                    let bytes = take(camera, output, &file, frame).await?;
                    let image = image::load_from_memory(&bytes)?;
                    thumbs.push((label(frame, fps), image.thumbnail(384, 216).to_rgb8()));
                    let now = image.to_rgb8();
                    let same = before.image(&file).is_some_and(|then| {
                        then.dimensions() == now.dimensions() && !differs(&then, &now)
                    });
                    if same && before.settled.contains(&file) {
                        settled.push(file);
                    } else {
                        rows.push(Row {
                            file,
                            frame,
                            taken: true,
                        });
                    }
                }
                renderer::contact_sheet(&thumbs).save(output.join("contact-sheet.png"))?;
                let data = pass_data(&snapshot, picture, next, every, start, &rows, &settled, true);
                let sheet = Worksheet {
                    pass: next.pass,
                    round: next.round,
                    rounds: next.rounds,
                    picture,
                    every,
                    start,
                    found: &[],
                    fps,
                    duration,
                    stills: frames.len(),
                    rows: &rows,
                    settled: settled.len(),
                    changed: true,
                    words: &words,
                };
                std::fs::write(output.join("polish.md"), sheet.render())?;
                write_pass(output, &data)?;
                data
            }
            Step::Done => unreachable!("answered above"),
        };

        let (said, _) = verdicts(output);
        let rows = listed(&data);
        let blank = |file: &str| said.get(file).is_none_or(|v| matches!(v, Verdict::Blank));
        let left = rows.iter().filter(|(file, _)| blank(file)).count();
        let defects: Vec<&str> = rows
            .iter()
            .filter(|(file, _)| matches!(said.get(file), Some(Verdict::Defect(_))))
            .map(|(file, _)| file.as_str())
            .collect();
        let worksheet = output.join("polish.md");
        let mut answer = json!({
            "pass": next.pass,
            "round": next.round,
            "rounds": next.rounds,
            "startsRound": next.step == Step::Walk,
            "output": without_verbatim(output),
            "worksheet": without_verbatim(&worksheet),
            "every": data["every"],
            "stills": rows.len(),
            "settled": data["settled"].as_array().map_or(0, Vec::len),
            "done": rows.len() - left,
            "left": left,
            "picture": picture,
        });
        match rows.iter().find(|(file, _)| blank(file)) {
            Some((file, frame)) => {
                let path = output.join(file);
                let index = data["stills"]
                    .as_array()
                    .and_then(|stills| stills.iter().position(|row| row["file"] == *file));
                let was = index.map_or(Value::Null, |i| data["stills"][i]["taken"].clone());
                // Whether an earlier call already named this still.
                let looks = index.map_or(0, |i| data["stills"][i]["looks"].as_u64().unwrap_or(0));
                let shown = looks > 0;
                let current = path.is_file() && was == picture;
                // A still gets two looks: as it was, and once more with the fix in it. After
                // that the row is written and the walk goes on; it is not taken a third time.
                let spent = !current && looks >= MOST_LOOKS;
                if !current && !spent {
                    let camera = opened(&mut capture, &snapshot).await?;
                    take(camera, output, file, *frame).await?;
                }
                if let Some(i) = index
                    && !(current && shown)
                    && !spent
                {
                    data["stills"][i]["taken"] = json!(picture);
                    data["stills"][i]["looks"] = json!(looks + 1);
                    write_pass(output, &data)?;
                }
                let taken = match (shown, current) {
                    (false, _) => "new",
                    (true, false) if spent => "limit",
                    (true, false) => "again",
                    (true, true) => "same",
                };
                answer["next"] = json!({
                    "image": without_verbatim(&path),
                    "row": file,
                    "frame": frame,
                    "time": review::round(*frame as f64 / fps, 2),
                    "words": review::spoken(&words, *frame, fps),
                    "taken": taken,
                });
                answer["how"] = json!(match taken {
                    "again" => "This is the still with your changes in it: its second and last look. Write its row now (Finding: what was wrong or missing; Fix: `fixed: …`, `added: …`, plus what is still not right, if anything) and run `polish` again for the next still.",
                    "limit" => "This still was already taken twice, as it was and with your changes, and is not taken again. Write its row now, say in it what is still not right, and run `polish` again for the next still.",
                    "same" => "Nothing changed and this row is still empty. Write it (Finding: `ok`, or what was wrong or missing; Fix: `fixed: …`, `added: …` or `kept: <reason>`) and run `polish` again for the next still.",
                    _ => "Look at this one picture once, at full size. Fix in the code what a viewer would spot as wrong, and add the detail the picture lacks (material, small parts, light, depth). Then run `polish` once to see the changed still and write its row (Finding: what was wrong or missing; Fix: `fixed: …`, `added: …`). A picture that needs nothing gets `ok` under Finding. Then run `polish` again for the next still.",
                });
            }
            None => {
                answer["next"] = Value::Null;
                answer["clean"] = json!(defects.is_empty());
                answer["then"] = json!(if defects.is_empty() {
                    "Every row is settled. Run `check`, then record the walk with `superint-video polish <dir> --accept`.".to_string()
                } else {
                    format!(
                        "{} a defect that is not fixed ({}). Fix each, write `fixed: …` into its row, then `polish --accept`.",
                        if defects.len() == 1 { "1 row names".to_string() } else { format!("{} rows name", defects.len()) },
                        defects.iter().take(6).copied().collect::<Vec<_>>().join(", ")
                    )
                });
            }
        }
        answer["seconds"] = json!(review::round(started.elapsed().as_secs_f64(), 1));
        Ok(answer)
    }
    .await;
    if let Some(capture) = capture {
        capture.close().await;
    }
    result
}

/// The browser that takes the stills, opened when the first one is due.
async fn opened<'a>(
    capture: &'a mut Option<Capture>,
    snapshot: &ProjectSnapshot,
) -> Result<&'a Capture> {
    if capture.is_none() {
        *capture = Some(Capture::open(snapshot.root.clone(), snapshot.manifest.clone()).await?);
    }
    Ok(capture.as_ref().expect("opened above"))
}

/// Takes one still at full size into the pass folder.
async fn take(capture: &Capture, folder: &Path, file: &str, frame: u64) -> Result<Vec<u8>> {
    let (bytes, _) = capture.frame_state(frame, false).await?;
    std::fs::write(folder.join(file), &bytes)?;
    Ok(bytes)
}

/// What `polish.json` keeps about a pass. `walk` marks a pass that is looked at one still at a
/// time; `taken` is the picture a still was last taken from, null until its turn comes.
#[allow(clippy::too_many_arguments)]
fn pass_data(
    snapshot: &ProjectSnapshot,
    picture: &str,
    next: &Next,
    every: f64,
    start: f64,
    rows: &[Row],
    settled: &[String],
    changed: bool,
) -> Value {
    let manifest = &snapshot.manifest;
    let fps = manifest.fps.num as f64 / manifest.fps.den as f64;
    let stills: Vec<Value> = rows
        .iter()
        .map(|row| {
            json!({
                "file": row.file, "frame": row.frame,
                "time": review::round(row.frame as f64 / fps, 2),
                "taken": if row.taken { json!(picture) } else { Value::Null },
            })
        })
        .collect();
    json!({
        "pass": next.pass, "round": next.round, "rounds": next.rounds, "walk": true,
        "changed": changed, "picture": picture, "revision": snapshot.revision,
        "every": every, "offset": start, "fps": fps,
        "durationFrames": manifest.duration_frames,
        "width": manifest.width, "height": manifest.height,
        "stills": stills, "cuts": [], "moves": [], "settled": settled, "warnings": [],
    })
}

/// Records the latest pass as clean: every image it lists was taken and looked at, and its row
/// says `ok`, `kept` or `fixed`. The record holds the picture as it is now, with the fixes of
/// the walk in it. Says whether another round is due for a film that gets `rounds`.
pub fn accept(root: &Path, picture: &str, rounds: u8) -> Result<Value> {
    let done = finished(root);
    let (pass, folder, data) = done
        .last()
        .context("No polish pass yet: run `superint-video polish <dir>`")?;
    let pass = *pass;
    let walk = data["walk"] == true;
    if let Some(record) = record(root)
        && record["pass"].as_u64() == Some(u64::from(pass))
    {
        ensure!(
            record["picture"] == picture,
            "The picture changed after pass {pass} was accepted. Run `polish`: it lists the stills that changed."
        );
    }
    // A pass from before the walk looked at everything at once: it only counts for that picture.
    ensure!(
        walk || data["picture"] == picture,
        "The picture changed after pass {pass}. Run `polish`: it walks the film one still at a time."
    );
    let (said, _) = verdicts(folder);
    let rows = listed(data);
    let mut open = Vec::new();
    let (mut kept, mut fixed) = (0, 0);
    for (file, _) in &rows {
        match said.get(file) {
            Some(Verdict::Ok) => {}
            Some(Verdict::Kept) => kept += 1,
            Some(Verdict::Fixed) => fixed += 1,
            Some(Verdict::Defect(_)) => {
                open.push(format!("{file}: names a defect that is not fixed"))
            }
            Some(Verdict::Blank) | None => open.push(format!("{file}: not looked at")),
        }
    }
    ensure!(
        open.is_empty(),
        "Pass {pass} is not done ({} of {} rows): {}. Run `polish` for the next still; a row's Finding says `ok`, or its Fix begins with `fixed:`, `added:` or `kept:`.",
        open.len(),
        rows.len(),
        open.iter().take(6).cloned().collect::<Vec<_>>().join("; ")
    );
    if walk {
        let unseen: Vec<&str> = data["stills"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|row| {
                !row["taken"].is_string()
                    || !folder
                        .join(row["file"].as_str().unwrap_or_default())
                        .is_file()
            })
            .filter_map(|row| row["file"].as_str())
            .collect();
        let one = unseen.len() == 1;
        ensure!(
            unseen.is_empty(),
            "Pass {pass}: {} never taken, so nobody looked at {}: {}. Empty {} and run `polish`.",
            if one {
                "1 still was".to_string()
            } else {
                format!("{} stills were", unseen.len())
            },
            if one { "it" } else { "them" },
            unseen
                .iter()
                .take(6)
                .copied()
                .collect::<Vec<_>>()
                .join(", "),
            if one { "its row" } else { "their rows" }
        );
    }
    let round = round_of(data);
    let record = json!({
        "pass": pass, "round": round, "rounds": rounds, "picture": picture,
        "rows": rows.len(), "kept": kept, "fixed": fixed,
    });
    let path = root.join(RECORD);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, serde_json::to_vec_pretty(&record)?)?;
    // The walked film on one sheet, for whoever wants to see what was looked at.
    let fps = data["fps"].as_f64().unwrap_or(30.0);
    let sheet = walked_sheet(folder, fps);
    let next = if round < rounds {
        format!(
            "Round {round} of {rounds} is clean. Round {} needs fresh eyes: start a new polisher, cold, with the brief in references/polish.md of the superint-video skill. Its `superint-video polish <dir>` starts round {} at the first still; render waits until that round is accepted too.",
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
        "rows": rows.len(), "kept": kept, "fixed": fixed, "record": without_verbatim(&path),
        "contactSheet": sheet.as_deref().map(without_verbatim), "next": next,
    }))
}

/// `contact-sheet.png` from the stills in a pass folder; None when it cannot be made.
fn walked_sheet(folder: &Path, fps: f64) -> Option<PathBuf> {
    let mut stills: Vec<(u64, PathBuf)> = std::fs::read_dir(folder)
        .ok()?
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name();
            let frame = name
                .to_str()?
                .strip_prefix("frame-")?
                .strip_suffix(".png")?
                .parse::<u64>()
                .ok()?;
            Some((frame, entry.path()))
        })
        .collect();
    stills.sort();
    let thumbs: Vec<(String, RgbImage)> = stills
        .iter()
        .filter_map(|(frame, path)| {
            let image = image::open(path).ok()?;
            Some((label(*frame, fps), image.thumbnail(384, 216).to_rgb8()))
        })
        .collect();
    if thumbs.is_empty() {
        return None;
    }
    let path = folder.join("contact-sheet.png");
    renderer::contact_sheet(&thumbs).save(&path).ok()?;
    Some(path)
}

enum Verdict {
    Ok,
    Kept,
    /// Found and fixed on the spot, or a detail added.
    Fixed,
    Blank,
    Defect(String),
}

/// One image row of a worksheet: the image, what was found and how it was fixed.
struct SheetRow {
    file: String,
    said: String,
    fix: String,
}

/// The image rows of a pass's worksheet. A walk has five columns (image, time, words, finding,
/// fix); a pass from before the walk had a column of close-ups before the finding.
fn sheet_rows(folder: &Path) -> Vec<SheetRow> {
    let sheet = std::fs::read_to_string(folder.join("polish.md")).unwrap_or_default();
    sheet
        .lines()
        .map(cells)
        .filter(|cells| cells.len() >= 5 && cells[0].trim_matches('`').ends_with(".png"))
        .map(|cells| {
            let at = if cells.len() >= 6 { 4 } else { 3 };
            SheetRow {
                file: cells[0].trim_matches('`').to_string(),
                said: cells[at].clone(),
                fix: cells[at + 1].clone(),
            }
        })
        .collect()
}

/// What a row says. The word that settles it (`fixed`, `added`, `kept`, `ok`) may open either
/// cell: "lid too wide | fixed: as wide as the base" reads the same as "fixed: lid too wide |
/// as wide as the base". A finding with a fix that carries no such word is still to do.
fn verdict(said: &str, fix: &str) -> Verdict {
    let (said, fix) = (said.trim(), fix.trim());
    let opens = |text: &str, words: &[&str]| {
        let low = text.to_lowercase();
        words.iter().any(|word| low.starts_with(word))
    };
    if said.is_empty() && fix.is_empty() {
        Verdict::Blank
    } else if opens(said, &["fixed", "added"]) || opens(fix, &["fixed", "added"]) {
        Verdict::Fixed
    } else if opens(said, &["kept"]) || opens(fix, &["kept"]) {
        Verdict::Kept
    } else if opens(said, &["ok"]) || (said.is_empty() && opens(fix, &["ok"])) {
        Verdict::Ok
    } else {
        Verdict::Defect(if said.is_empty() { fix } else { said }.to_string())
    }
}

/// What every image row of a pass's worksheet says, and the names the pass had settled before.
fn verdicts(folder: &Path) -> (BTreeMap<String, Verdict>, BTreeSet<String>) {
    let out = sheet_rows(folder)
        .into_iter()
        .map(|row| {
            let verdict = verdict(&row.said, &row.fix);
            (row.file, verdict)
        })
        .collect();
    let settled = read_pass(folder)
        .ok()
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

/// An accepted pass: its folder and the images it settled, its own and those of passes before.
#[derive(Default)]
struct Before {
    folder: Option<PathBuf>,
    settled: BTreeSet<String>,
}
impl Before {
    fn read(folder: &Path) -> Self {
        let (verdicts, mut settled) = verdicts(folder);
        for (file, verdict) in verdicts {
            if matches!(verdict, Verdict::Ok | Verdict::Kept | Verdict::Fixed) {
                settled.insert(file);
            }
        }
        Self {
            folder: Some(folder.to_path_buf()),
            settled,
        }
    }
    fn image(&self, file: &str) -> Option<RgbImage> {
        Some(
            image::open(self.folder.as_ref()?.join(file))
                .ok()?
                .to_rgb8(),
        )
    }
}

/// What the rounds before found and how it was fixed, each finding once, oldest first.
fn found_before(earlier: &[PathBuf]) -> Vec<(String, String, String)> {
    let mut said = BTreeSet::new();
    let mut found = Vec::new();
    for folder in earlier {
        for row in sheet_rows(folder) {
            let (text, done) = (row.said.trim(), row.fix.trim().to_lowercase());
            let low = text.to_lowercase();
            let finding = match verdict(&row.said, &row.fix) {
                Verdict::Defect(text) => text,
                // "fixed: the label was cut" names the finding after the word. What a round
                // added is no finding for the next one to check.
                Verdict::Fixed if low.starts_with("fixed") => {
                    text[5..].trim_start_matches([':', ',', ' ']).to_string()
                }
                // The finding in its own words, with "fixed: …" beside it.
                Verdict::Fixed if done.starts_with("fixed") && !low.starts_with("added") => {
                    text.to_string()
                }
                _ => continue,
            };
            if !finding.is_empty() && said.insert(finding.to_lowercase()) {
                found.push((row.file, finding, row.fix));
            }
        }
    }
    found
}

/// Whether more than a few pixels differ between two images of the same size.
fn differs(a: &RgbImage, b: &RgbImage) -> bool {
    let mut count = 0;
    for (p, q) in a.pixels().zip(b.pixels()) {
        if p.0.iter().zip(q.0).any(|(m, n)| m.abs_diff(n) > PIXEL_STEP) {
            count += 1;
            if count > CHANGED_PIXELS {
                return true;
            }
        }
    }
    false
}

fn label(frame: u64, fps: f64) -> String {
    format!("F {frame}  {:.1}s", frame as f64 / fps)
}

/// One still of a pass.
struct Row {
    file: String,
    frame: u64,
    /// Whether it was taken when the pass was laid out; a walk takes it when its turn comes.
    taken: bool,
}
impl Row {
    fn new(frame: u64) -> Self {
        Self {
            file: still_name(frame),
            frame,
            taken: false,
        }
    }
}

/// `polish.md`: how to look, and one row per still for what was found and how it was fixed.
struct Worksheet<'a> {
    pass: u32,
    round: u8,
    rounds: u8,
    picture: &'a str,
    every: f64,
    /// Seconds from which the stills come every `every`.
    start: f64,
    /// What earlier rounds found: image, finding, fix.
    found: &'a [(String, String, String)],
    fps: f64,
    duration: u64,
    /// Stills in the round's grid; `rows` are those to look at.
    stills: usize,
    rows: &'a [Row],
    settled: usize,
    /// A pass over what changed after an accepted pass.
    changed: bool,
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
            "A still every {} s{from} ({}), looked at one at a time. Picture `{}`, {} frames at {} fps.\n",
            self.every,
            count(self.stills, "still"),
            &self.picture[..self.picture.len().min(12)],
            self.duration,
            review::round(self.fps, 3)
        );
        if self.changed {
            let _ = writeln!(
                md,
                "The picture changed after a pass was accepted. Listed are the stills that no longer show what that pass looked at; {} unchanged and stay settled.\n",
                if self.settled == 1 {
                    "1 still is".to_string()
                } else {
                    format!("{} stills are", self.settled)
                }
            );
        }
        if self.rows.is_empty() {
            md.push_str("No still changed: this pass is clean. Record it with `superint-video polish <dir> --accept`.\n");
            return md;
        }
        if self.round > 1 {
            md.push_str(&self.found_before());
        }
        md.push_str(HOW_IT_WORKS);
        md.push_str(match self.round {
            0 | 1 => WHAT_TO_LOOK_FOR,
            2 => ROUND_TWO,
            _ => ROUND_THREE,
        });
        md.push_str(WHAT_TO_ADD);
        md.push_str("\n## Stills\n\n| Image | Time | Words | Finding | Fix |\n| --- | --- | --- | --- | --- |\n");
        for row in self.rows {
            let _ = writeln!(
                md,
                "| {} | {:.1} s | {} | | |",
                row.file,
                row.frame as f64 / self.fps,
                cell(&review::spoken(self.words, row.frame, self.fps)),
            );
        }
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

/// How every round walks the film and fills in its worksheet.
const HOW_IT_WORKS: &str = "## How this works

One picture at a time, and each at most twice: as it is, and once with your changes in it. That keeps the polish quick. Do not lay out more pictures, and do not go back over a still you have settled.

The walk makes the film better, not only correct. In every still you fix what is wrong and you add the detail that makes the picture richer.

1. Run `superint-video polish <dir>`. It takes the next still and prints its path as `next.image`; `next.words` is what the voice says there. Open that one picture at full size and name each thing in it before you judge it.
2. Decide two things: what is wrong here, and what this picture would gain from (both lists below).
3. Do both now, in the scene code, where the thing lives (a shared library carries it into every scene). Redraw rather than nudge when something is built wrong. Do everything for this still in one go.
4. Run `polish` once more. The row is still empty, so it takes the same still again with your changes in it. Look at it once.
5. Write the row. Under Finding: what was wrong or missing, in a few words. Under Fix: what you did, beginning with `fixed:` or `added:` (both in one cell is fine: `fixed: lid as wide as its base; added: brushed metal`); if something is still not right, say so there too. `kept: <reason>` under Fix is for something left on purpose. A picture that needs nothing and holds up beside the references as it is gets `ok` under Finding. Then go to step 1: the next still is taken after your changes, so it shows the film as it is now.

A still is never taken a third time. A row whose Fix does not begin with one of those words stays open. When no row is left: `superint-video check <dir>`, then `superint-video polish <dir> --accept`.
";

/// What a walk adds: a film that is merely free of faults is as plain as it was.
const WHAT_TO_ADD: &str = "
## What to add

Find the place in the still that is flat, empty or generic beside the references, and give it what the real thing has. One good detail per still is enough.

- **Material.** Grain, weave, brushed metal, paper fibre, a gloss where the light hits.
- **Small parts.** Seams, screws, stitches, labels, buttons, edges with thickness.
- **Light.** A contact shadow, a rim of light, a little colour bounced from a neighbour.
- **Depth.** Something in front, an overlap, a background that is not one flat colour.
- **Life.** Something small that moves or settles, kept quiet so it never pulls the eye from what the voice speaks about.

Stay inside the film's look (`STYLE.md`, `direction.md`, its palette). Add nothing that states a fact, and change no word on screen.
";

/// The questions a viewer answers at a glance. They are about how things are made, not about a
/// style; the workflow's rubric and the project's references say what good looks like.
const WHAT_TO_LOOK_FOR: &str = "
## What to look for

Look as someone who has never seen the film, and ask of each thing in the picture:

1. **Built right?** Parts that belong together fit: a lid as wide as its base, pages inside their cover, flaps that meet, drawers inside a body, a shelf on its brackets, a handle joined to its cup.
2. **One viewpoint, one light?** Everything on a surface is seen from the same side and lit from the same side, and touches the surface with a tight shadow. Nothing floats.
3. **Does it look like its name?** Cover the label: would a stranger still say what it is?
4. **Finished?** The smallest icon gets the care of the hero object. A plain disc, bar or blob that stands for a real thing is a placeholder.
5. **Clean?** Nothing sticks out of what holds it, covers a label, is cut to a sliver by the frame edge, or is left over from an earlier beat. Lines end on what they join; text is spelled right and stays long enough to read.
6. **The same everywhere?** A thing you saw in an earlier still is the same thing here: size, colour, build.
7. **Caught mid-move or at a cut?** Layers keep their order, nothing passes through something solid, nothing pops in.

Then compare with the references and the workflow's rubric: would this picture stand beside them?
";

/// A second round, by new eyes after the first round's fixes: what those fixes left, and the
/// detail the first look skimmed.
const ROUND_TWO: &str = "
## What to look for: round 2

An earlier round looked for what a viewer spots at once and fixed it. You are new to this film: look for what is still wrong after those fixes. This round's stills fall between the earlier ones. Name each thing in the picture before you judge it, then ask:

1. **Do the fixes hold?** Each finding above is gone wherever that thing appears, and its fix broke nothing next to it: a shadow, a seam, a label, an overlap.
2. **The same fault elsewhere?** A finding is a kind of fault. One floating lamp means every foot and shadow gets a look; one lid too narrow means every part that should fit.
3. **Behind the hero.** The background, the edges and the corners: each prop finished, nothing plain or standing in for a real thing, nothing cut to a sliver.
4. **Between the beats.** A half-finished entrance, a label mid-fade, two things overlapping for a moment, a gap where something was.
5. **Detail against the references.** Set the still beside the closest reference and name what the reference has that this picture lacks: texture, small parts, wear, light, things moving in the background. Add it.
6. **Words on screen.** Spelled right, in the film's language, readable at their size, on screen long enough, gone when the voice moves on.

Anything new or changed still answers the first round's questions: built right, one viewpoint and one light, looks like its name, finished, clean, the same everywhere.
";

/// A third round: the viewer who pauses, after two rounds of fixes.
const ROUND_THREE: &str = "
## What to look for: round 3

Earlier rounds fixed what a viewer spots at once and what was left after that. You are new to this film: look at it as the viewer who pauses and looks closely. This round's stills fall between all earlier ones. Name each thing in the picture, then ask:

1. **Do the fixes hold?** Each finding above is gone everywhere, its kind is found nowhere else, and no fix broke a neighbour.
2. **One film.** Follow each thing that comes back through the stills: the same size, colour, build and light each time, and one look per place.
3. **Light and depth.** Shadows agree from still to still; front, middle and back read apart; nothing is flat that should have volume.
4. **Materials and small parts.** Would the picture hold as a print on a wall? Seams, screws, wear, highlights and edges where the real thing has them.
5. **Composition.** One place to look at a time, and it is the thing the voice speaks about; no picture crowded, none empty.
6. **The end.** The last still and the end card: the message reads, nothing is left over.
";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_short_film_gets_a_still_every_five_seconds_a_longer_one_every_ten() {
        assert_eq!(every_for(30.0), 5.0);
        assert_eq!(every_for(60.0), 5.0);
        assert_eq!(every_for(60.5), 10.0);
        assert_eq!(every_for(263.0), 10.0);
        // 4:23 at 30 fps: 27 stills and the last frame, not hundreds of images.
        assert_eq!(review::grid(every_for(262.8), 0.0, 30.0, 7884).len(), 28);
    }

    #[test]
    fn a_small_change_counts_and_a_stray_pixel_does_not() {
        let a = RgbImage::from_pixel(200, 100, image::Rgb([40, 40, 40]));
        let mut b = a.clone();
        b.put_pixel(10, 10, image::Rgb([200, 40, 40]));
        assert!(!differs(&a, &b));
        for x in 100..106 {
            for y in 50..56 {
                b.put_pixel(x, y, image::Rgb([200, 200, 40]));
            }
        }
        assert!(differs(&a, &b));
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

    /// A walk of `round` in `renders/polish/<pass>`: every still in `rows` was taken from
    /// picture `p`, and the worksheet holds `rows` as written.
    fn walked_pass(root: &Path, pass: u32, round: u8, rows: &str) -> PathBuf {
        let folder = passes(root).join(pass.to_string());
        std::fs::create_dir_all(&folder).unwrap();
        let stills: Vec<Value> = rows
            .lines()
            .map(|line| cells(line)[0].clone())
            .map(|file| {
                RgbImage::from_pixel(64, 36, image::Rgb([40, 40, 40]))
                    .save(folder.join(&file))
                    .unwrap();
                json!({"file": file, "frame": 0, "time": 0.0, "taken": "p"})
            })
            .collect();
        std::fs::write(
            folder.join("polish.json"),
            json!({"pass": pass, "round": round, "walk": true, "picture": "p", "every": 10.0,
                "offset": 0.0, "fps": 30.0, "stills": stills, "settled": ["frame-009000.png"]})
            .to_string(),
        )
        .unwrap();
        std::fs::write(
            folder.join("polish.md"),
            format!(
                "| Image | Time | Words | Finding | Fix |\n| --- | --- | --- | --- | --- |\n{rows}"
            ),
        )
        .unwrap();
        folder
    }

    #[test]
    fn an_open_walk_goes_on_and_an_accepted_round_starts_the_next() {
        let film = tempfile::tempdir().unwrap();
        let root = film.path();
        let first = next(root, 2, "p");
        assert_eq!((first.pass, first.round, first.rounds), (1, 1, 2));
        assert!(first.step == Step::Walk && first.earlier.is_empty());

        // A walk with an empty row goes on in its own folder: no new pass, no second look.
        let one = walked_pass(
            root,
            1,
            1,
            "| frame-000000.png | 0.0 s | | fixed: lamp floats above the desk. | redrew its foot |\n\
             | frame-000300.png | 10.0 s | | | |\n",
        );
        let again = next(root, 2, "changed-by-the-fix");
        assert_eq!((again.pass, again.round), (1, 1));
        assert!(again.step == Step::Resume);
        assert_eq!(again.output, one);

        // Accepted: the next round starts fresh and knows what round 1 found.
        accept_as(root, 1, 1, "p");
        let round_two = next(root, 2, "p");
        assert_eq!((round_two.pass, round_two.round), (2, 2));
        assert!(round_two.step == Step::Walk);
        assert_eq!(round_two.earlier, vec![one.clone()]);
        let found = found_before(&round_two.earlier);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].1, "lamp floats above the desk.");
        assert_eq!(found[0].2, "redrew its foot");

        // A film that gets one round is done while the picture stays as accepted …
        let done = next(root, 1, "p");
        assert!(done.step == Step::Done && done.pass == 1);
        // … and a change to the picture gets a pass over what changed, in the same round.
        let changed = next(root, 1, "q");
        assert_eq!((changed.pass, changed.round), (2, 1));
        assert!(changed.step == Step::Changed(one));
    }

    #[test]
    fn the_next_round_hears_of_a_fix_written_in_either_cell_and_of_no_addition() {
        let film = tempfile::tempdir().unwrap();
        let one = walked_pass(
            film.path(),
            1,
            1,
            "| frame-000000.png | 0.0 s | | lid wider than its base | fixed: as wide as the base |
             | frame-000300.png | 10.0 s | | cloth is flat | added: a weave |
",
        );
        let found = found_before(&[one]);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].1, "lid wider than its base");
        assert_eq!(found[0].2, "fixed: as wide as the base");
    }

    #[test]
    fn a_pass_from_before_the_walk_is_not_gone_on_with() {
        let film = tempfile::tempdir().unwrap();
        let root = film.path();
        let folder = passes(root).join("1");
        std::fs::create_dir_all(&folder).unwrap();
        std::fs::write(
            folder.join("polish.json"),
            json!({"pass": 1, "round": 1, "picture": "p", "stills": [{"file": "frame-000000.png"}],
                "cuts": [{"file": "cut-000090.png"}], "moves": []})
            .to_string(),
        )
        .unwrap();
        let fresh = next(root, 1, "p");
        assert_eq!((fresh.pass, fresh.round), (2, 1));
        assert!(fresh.step == Step::Walk);
    }

    fn accept_as(root: &Path, pass: u32, round: u8, picture: &str) {
        std::fs::create_dir_all(root.join("process")).unwrap();
        std::fs::write(
            root.join(RECORD),
            json!({"pass": pass, "round": round, "picture": picture}).to_string(),
        )
        .unwrap();
    }

    #[test]
    fn a_walk_is_accepted_with_its_fixes_once_every_row_is_settled() {
        let film = tempfile::tempdir().unwrap();
        let root = film.path();
        walked_pass(
            root,
            1,
            1,
            "| frame-000000.png | 0.0 s | | ok: reads at once | |\n\
             | frame-000300.png | 10.0 s | | | |\n",
        );
        let open = accept(root, "q", 1).unwrap_err().to_string();
        assert!(open.contains("frame-000300.png: not looked at"), "{open}");

        // The picture is no longer the one the walk started from: the fixes changed it.
        let folder = walked_pass(
            root,
            1,
            1,
            "| frame-000000.png | 0.0 s | | ok: reads at once | |\n\
             | frame-000300.png | 10.0 s | | fixed: label cut by the edge | moved the camera |\n\
             | frame-000600.png | 20.0 s | | kept: the peek is on purpose | |\n",
        );
        let done = accept(root, "q", 1).unwrap();
        assert_eq!(done["accepted"], true);
        assert_eq!(
            (done["rows"].as_u64(), done["fixed"].as_u64()),
            (Some(3), Some(1))
        );
        assert_eq!(done["kept"], 1);
        assert!(folder.join("contact-sheet.png").is_file());
        assert_eq!(record(root).unwrap()["picture"], "q");
        assert!(next(root, 1, "q").step == Step::Done);

        // Accepting again after the picture changed would record a look nobody took.
        let stale = accept(root, "r", 1).unwrap_err().to_string();
        assert!(
            stale.contains("changed after pass 1 was accepted"),
            "{stale}"
        );
    }

    #[test]
    fn a_row_filled_in_for_a_still_nobody_took_does_not_count() {
        let film = tempfile::tempdir().unwrap();
        let root = film.path();
        let folder = walked_pass(
            root,
            1,
            1,
            "| frame-000000.png | 0.0 s | | ok | |\n| frame-000300.png | 10.0 s | | ok | |\n",
        );
        let mut data = read_pass(&folder).unwrap();
        data["stills"][1]["taken"] = Value::Null;
        write_pass(&folder, &data).unwrap();
        let unseen = accept(root, "p", 1).unwrap_err().to_string();
        assert!(
            unseen.contains("never taken") && unseen.contains("frame-000300.png"),
            "{unseen}"
        );
        // A row that only names a defect is open too.
        walked_pass(root, 1, 1, "| frame-000000.png | 0.0 s | | glow pops | |\n");
        let defect = accept(root, "p", 1).unwrap_err().to_string();
        assert!(
            defect.contains("names a defect that is not fixed"),
            "{defect}"
        );
    }

    #[test]
    fn each_round_looks_between_the_stills_of_the_rounds_before() {
        assert_eq!(offset(1, 10.0), 0.0);
        assert_eq!(offset(2, 10.0), 5.0);
        assert_eq!(offset(3, 10.0), 2.5);
        let fps = 30.0;
        let grids: Vec<BTreeSet<u64>> = (1..=3)
            .map(|round| {
                let mut stills = review::grid(10.0, offset(round, 10.0), fps, 1800);
                stills.pop(); // every round ends on the last frame
                stills.into_iter().collect()
            })
            .collect();
        assert!(grids[0].is_disjoint(&grids[1]));
        assert!(grids[0].is_disjoint(&grids[2]));
        assert!(grids[1].is_disjoint(&grids[2]));
    }

    #[test]
    fn a_worksheet_says_how_to_walk_and_a_later_round_what_was_found() {
        let found = vec![(
            "frame-000300.png".to_string(),
            "lamp floats above the desk.".to_string(),
            "redrew its foot".to_string(),
        )];
        let rows = vec![Row::new(150)];
        let sheet = |round: u8, rounds: u8, found: &[(String, String, String)], changed: bool| {
            Worksheet {
                pass: 3,
                round,
                rounds,
                picture: "0123456789abcdef",
                every: 10.0,
                start: offset(round, 10.0),
                found,
                fps: 30.0,
                duration: 1800,
                stills: 7,
                rows: &rows,
                settled: 6,
                changed,
                words: &[],
            }
            .render()
        };
        let first = sheet(1, 1, &[], false);
        assert!(first.starts_with("# Polish pass 3\n"));
        assert!(first.contains("A still every 10 s (7 stills), looked at one at a time."));
        assert!(first.contains("## How this works\n") && first.contains("## What to look for\n"));
        assert!(!first.contains("Found in earlier rounds"));
        // The rows read as the overview and `--accept` read them.
        assert!(first.contains("| frame-000150.png | 5.0 s |  | | |"));
        assert_eq!(sheet_rows_of(&first).len(), 1);
        let second = sheet(2, 3, &found, false);
        assert!(second.starts_with("# Polish pass 3, round 2 of 3\n"));
        assert!(second.contains("A still every 10 s from 5 s on"));
        assert!(second.contains(
            "- 10.0 s, `frame-000300.png`: lamp floats above the desk. Fix: redrew its foot\n"
        ));
        assert!(second.contains("## What to look for: round 2"));
        let third = sheet(3, 3, &[], false);
        assert!(third.contains("## What to look for: round 3"));
        assert!(third.contains("The earlier rounds found nothing to fix."));
        let changed = sheet(1, 1, &[], true);
        assert!(changed.contains("6 stills are unchanged and stay settled."));
    }

    /// The image rows of a worksheet's text, read as from its file.
    fn sheet_rows_of(text: &str) -> Vec<SheetRow> {
        let folder = tempfile::tempdir().unwrap();
        std::fs::write(folder.path().join("polish.md"), text).unwrap();
        sheet_rows(folder.path())
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
                "walk": true,
                "stills": [
                    {"file": "frame-000000.png", "time": 0.0, "taken": "p"},
                    {"file": "frame-000300.png", "time": 10.0, "taken": "p"},
                    {"file": "frame-000600.png", "time": 20.0, "taken": "p"},
                    {"file": "frame-000900.png", "time": 30.0, "taken": "p"},
                    {"file": "frame-001200.png", "time": 40.0, "taken": null},
                ],
                "cuts": [], "moves": [],
                "settled": ["frame-001500.png"],
            })
            .to_string(),
        )
        .unwrap();
        std::fs::write(
            folder.join("polish.md"),
            "| Image | Time | Words | Finding | Fix |\n| --- | --- | --- | --- | --- |\n\
             | `frame-000000.png` | 0.0 s | | ok, holds up | |\n\
             | `frame-000300.png` | 10.0 s | | fixed: lamp floats above the desk | redrew its foot |\n\
             | `frame-000600.png` | 20.0 s | | kept: the glow is meant to stay | |\n\
             | `frame-000900.png` | 30.0 s | | | |\n\
             | `frame-001200.png` | 40.0 s | | | |\n",
        )
        .unwrap();
        let view = overview(project.path()).unwrap();
        assert_eq!(view["pass"], 2);
        assert_eq!(view["folder"], "renders/polish/2");
        assert_eq!(
            view["counts"],
            json!({"listed": 5, "ok": 1, "kept": 1, "fixed": 1, "defects": 0, "open": 2, "settled": 1})
        );
        let lamp = &view["rows"][1];
        assert_eq!(lamp["verdict"], "fixed");
        assert_eq!(lamp["fix"], "redrew its foot");
        // The still being looked at, and one whose turn has not come.
        assert_eq!(view["current"], "frame-000900.png");
        assert_eq!(view["rows"][3]["taken"], true);
        assert_eq!(view["rows"][4]["taken"], false);
        assert_eq!(view["record"]["state"], "missing");
    }

    #[test]
    fn a_worksheet_row_is_ok_kept_fixed_blank_or_a_defect() {
        let folder = tempfile::tempdir().unwrap();
        // Five columns in a walk; six in a pass from before it, with close-ups before the finding.
        std::fs::write(
            folder.path().join("polish.md"),
            "| Image | Time | Words | Finding | Fix |\n| --- | --- | --- | --- | --- |\n\
             | frame-000000.png | 0.0 s | | ok: reads at once | |\n\
             | frame-000150.png | 5.0 s | | Kept: the peek is on purpose | |\n\
             | frame-000300.png | 10.0 s | | Fixed: glow popped | carried it over |\n\
             | frame-000330.png | 11.0 s | | added: a seam along the folder | stitched it |\n\
             | frame-000450.png | 15.0 s | | glow pops | carry it over |\n\
             | frame-000480.png | 16.0 s | | lid wider than its base | fixed: as wide as the base; added: brushed metal |\n\
             | frame-000510.png | 17.0 s | | cloth is flat | Added: a weave that catches the light |\n\
             | frame-000540.png | 18.0 s | | peek at the edge | kept: it is on purpose |\n\
             | frame-000600.png | 20.0 s | | | |\n\
             | cut-000300.png | 10.0 s | | a b | ok: an old row | |\n",
        )
        .unwrap();
        let (verdicts, _) = verdicts(folder.path());
        assert!(matches!(verdicts["frame-000000.png"], Verdict::Ok));
        assert!(matches!(verdicts["frame-000150.png"], Verdict::Kept));
        assert!(matches!(verdicts["frame-000300.png"], Verdict::Fixed));
        assert!(matches!(verdicts["frame-000330.png"], Verdict::Fixed));
        assert!(matches!(verdicts["frame-000450.png"], Verdict::Defect(_)));
        // The word may open the Fix cell, with the finding in its own words before it.
        assert!(matches!(verdicts["frame-000480.png"], Verdict::Fixed));
        assert!(matches!(verdicts["frame-000510.png"], Verdict::Fixed));
        assert!(matches!(verdicts["frame-000540.png"], Verdict::Kept));
        assert!(matches!(verdicts["frame-000600.png"], Verdict::Blank));
        assert!(matches!(verdicts["cut-000300.png"], Verdict::Ok));
        let before = Before::read(folder.path());
        assert!(before.settled.contains("frame-000150.png"));
        assert!(before.settled.contains("frame-000300.png"));
        assert!(!before.settled.contains("frame-000450.png"));
    }
}
