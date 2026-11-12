//! Sound effects on top of Earshot. Claude writes `audio/kit.json` (one role per kind of event,
//! sounds from the Earshot bank, pitches in the film's key) and `sfx.json` (which frame gets
//! which role and how far under the voice). The tool renders the kit through Earshot, places
//! every take by the sync point Earshot measured, and sets its level against the voice, or
//! against the music in a film without one.
use crate::{
    audio::{self, RATE, round},
    earshot,
    model::Manifest,
    project::{ProjectStore, safe_path},
};
use anyhow::{Context, Result, bail, ensure};
use serde::Deserialize;
use serde_json::{Value, json};
use std::{collections::BTreeMap, fs, path::Path};

pub const KIT: &str = "audio/kit.json";
pub const TAKES: &str = "audio/sfx";
pub const CUES: &str = "sfx.json";
/// The placed cues in Earshot's cue format, for `earshot timeline --cues` and `sheet --cues`.
pub const EARSHOT_CUES: &str = "audio/sfx/cues.json";
const PREFIX: &str = "sfx-";
/// SFX sit far under the voice: big hits 14–18 dB, accents 20–26, textures 27–37. About 10 dB was
/// rejected as much too loud, however good it measured.
const UNDER: std::ops::RangeInclusive<f64> = 12.0..=40.0;

/// `earshot kit render` and `kit check` into `audio/sfx/`.
pub async fn kit(root: &Path) -> Result<Value> {
    let kit = root.join(KIT);
    ensure!(
        kit.is_file(),
        "{KIT} is missing: write it from `earshot kit init --preset calm` and the bank (`superint-video sfx list`)"
    );
    let out = root.join(TAKES);
    fs::create_dir_all(&out)?;
    let (render, check) = earshot::kit(&kit, &out).await?;
    let lock = read_lock(&out)?;
    let takes = lock
        .roles
        .values()
        .map(|role| role.takes.len())
        .sum::<usize>();
    Ok(json!({
        "ok": check["ok"] == true,
        "kit": KIT,
        "takes": TAKES,
        "lock": format!("{TAKES}/kit.lock.json"),
        "earshot": render["earshot"],
        "bank": render["bank"],
        "roles": lock.roles.len(),
        "takeCount": takes,
        "summary": check["summary"],
        "problems": check["problems"],
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Cues {
    /// Default distance under the voice in dB.
    #[serde(default = "default_under")]
    under: f64,
    cues: Vec<Cue>,
}
fn default_under() -> f64 {
    24.0
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Cue {
    /// The frame the sound's sync point (onset, peak or end, per the role's `align`) lands on.
    frame: u64,
    role: String,
    /// 1-based take; default rotates through the role's takes.
    take: Option<usize>,
    /// Pick the take with this pitch, for tuned roles.
    pitch: Option<String>,
    under: Option<f64>,
    #[serde(default)]
    note: String,
}

#[derive(Deserialize)]
struct Lock {
    #[serde(deserialize_with = "present_roles")]
    roles: BTreeMap<String, Role>,
}
#[derive(Deserialize)]
struct Role {
    align: String,
    takes: Vec<Take>,
}
#[derive(Deserialize)]
struct Take {
    file: String,
    pitch: Option<String>,
    onset_s: f64,
    peak_s: f64,
    end_s: f64,
    dur_s: f64,
    lufs_m_max: f64,
}

/// Roles switched off in the kit appear as null; they cannot be cued.
fn present_roles<'de, D>(deserializer: D) -> Result<BTreeMap<String, Role>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let roles = BTreeMap::<String, Option<Role>>::deserialize(deserializer)?;
    Ok(roles
        .into_iter()
        .filter_map(|(name, role)| role.map(|role| (name, role)))
        .collect())
}

fn read_lock(takes: &Path) -> Result<Lock> {
    let path = takes.join("kit.lock.json");
    let bytes = fs::read(&path).with_context(|| {
        format!(
            "{} is missing: run `superint-video sfx kit` first",
            path.display()
        )
    })?;
    serde_json::from_slice(&bytes).context("kit.lock.json does not match Earshot's lock format")
}

/// One placed cue, before it becomes a clip.
struct Placed {
    frame: u64,
    role: String,
    file: String,
    start_frame: u64,
    duration_frames: u64,
    sync_seconds: f64,
    gain_db: f64,
    under: f64,
    note: String,
}

/// Place every cue of `sfx.json` into `video.json` on the `sfx` track. Clips the tool placed
/// before (id prefix `sfx-`) are replaced; everything else on the track stays.
pub async fn place(root: &Path) -> Result<Value> {
    let cues: Cues = serde_json::from_slice(
        &fs::read(root.join(CUES)).with_context(|| format!("{CUES} is missing"))?,
    )
    .with_context(|| format!("{CUES} is invalid"))?;
    let lock = read_lock(&root.join(TAKES))?;
    let mut store = ProjectStore::open(root)?;
    let manifest = store.manifest.clone();
    let reference = reference_loudness(root, &manifest).await?;
    let (placed, warnings) = arrange(&cues, &lock, &manifest, reference)?;

    let mut operations = Vec::new();
    if !manifest.tracks.iter().any(|t| t.id == "sfx") {
        operations.push(
            json!({"type":"addTrack","track":{"id":"sfx","name":"Sound effects","kind":"audio"}}),
        );
    }
    let stale: Vec<String> = store
        .manifest
        .clips
        .iter()
        .filter(|c| c.track == "sfx" && c.id.starts_with(PREFIX))
        .map(|c| c.id.clone())
        .collect();
    for id in &stale {
        operations.push(json!({"type":"deleteClip","id":id}));
    }
    for (index, cue) in placed.iter().enumerate() {
        let id = clip_id(index, &cue.role);
        operations.push(json!({"type":"addClip","clip":{
            "id": id,
            "type": "audio",
            "src": format!("{TAKES}/{}", cue.file),
            "track": "sfx",
            "startFrame": cue.start_frame,
            "durationFrames": cue.duration_frames,
            "gain": 10f64.powf(cue.gain_db / 20.0),
        }}));
    }
    let revision = store.revision.clone();
    store.edit_many(&revision, &operations)?;
    // After the edit: this file counts towards the revision the edit checks.
    let fps = manifest.fps.num as f64 / manifest.fps.den as f64;
    let events: Vec<Value> = placed
        .iter()
        .enumerate()
        .map(|(index, cue)| {
            json!({"f": cue.frame, "kind": cue.role, "id": clip_id(index, &cue.role)})
        })
        .collect();
    crate::project::atomic_write(
        &root.join(EARSHOT_CUES),
        &serde_json::to_vec_pretty(&json!({"fps": fps, "events": events}))?,
    )?;
    Ok(json!({
        "ok": warnings.is_empty(),
        "reference": reference.0,
        "referenceLufs": round(reference.1, 2),
        "replaced": stale.len(),
        "earshotCues": EARSHOT_CUES,
        "cues": placed.iter().map(|c| json!({
            "frame": c.frame,
            "role": c.role,
            "file": c.file,
            "startFrame": c.start_frame,
            "durationFrames": c.duration_frames,
            "syncSeconds": c.sync_seconds,
            "gainDb": round(c.gain_db, 2),
            "under": c.under,
            "note": c.note,
        })).collect::<Vec<_>>(),
        "warnings": warnings,
    }))
}

fn clip_id(index: usize, role: &str) -> String {
    format!("{PREFIX}{:02}-{}", index + 1, role.replace('.', "-"))
}

/// The integrated loudness every cue is set against: the voice's, or in a film without one (a
/// music-led launch film) the music's.
async fn reference_loudness(root: &Path, manifest: &Manifest) -> Result<(&'static str, f64)> {
    for track in ["voice", "music"] {
        let audible = |c: &&crate::model::Clip| c.track == track && !c.muted && !c.hidden;
        if let Some(clip) = manifest.clips.iter().find(audible) {
            let samples = audio::decode(&safe_path(root, &clip.src)?, RATE).await?;
            let lufs = audio::loudness(&samples, RATE, 1)?.integrated_lufs + audio::db(clip.gain);
            return Ok((track, lufs));
        }
    }
    bail!("place the narration (or, in a film without one, the music) first; SFX levels follow it")
}

fn arrange(
    cues: &Cues,
    lock: &Lock,
    manifest: &Manifest,
    (reference, reference_lufs): (&str, f64),
) -> Result<(Vec<Placed>, Vec<String>)> {
    let fps = manifest.fps.num as f64 / manifest.fps.den as f64;
    let mut used: BTreeMap<&str, usize> = BTreeMap::new();
    let mut placed = Vec::new();
    let mut warnings = Vec::new();
    for cue in &cues.cues {
        let Some(role) = lock.roles.get(&cue.role) else {
            bail!(
                "role {} is not in the kit (or switched off); roles: {}",
                cue.role,
                lock.roles.keys().cloned().collect::<Vec<_>>().join(", ")
            );
        };
        ensure!(!role.takes.is_empty(), "role {} has no takes", cue.role);
        let take = match (&cue.pitch, cue.take) {
            (Some(pitch), _) => role
                .takes
                .iter()
                .find(|t| t.pitch.as_deref() == Some(pitch))
                .with_context(|| format!("role {} has no take at {pitch}", cue.role))?,
            (None, Some(n)) => role
                .takes
                .get(n.wrapping_sub(1))
                .with_context(|| format!("role {} has {} takes", cue.role, role.takes.len()))?,
            (None, None) => {
                let next = used.entry(&cue.role).or_default();
                let take = &role.takes[*next % role.takes.len()];
                *next += 1;
                take
            }
        };
        let sync = match role.align.as_str() {
            "peak" => take.peak_s,
            "end" => take.end_s,
            _ => take.onset_s,
        };
        let lead = (sync * fps).round() as u64;
        if lead > cue.frame {
            warnings.push(format!(
                "frame {} {}: the sync point is {lead} frames into the take; it starts at 0 and lands late",
                cue.frame, cue.role
            ));
        }
        let start = cue.frame.saturating_sub(lead);
        ensure!(
            start < manifest.duration_frames,
            "cue at frame {} is past the end of the film",
            cue.frame
        );
        // Whole frames inside the take: a clip may not run past its source (`check`), and the
        // part under a frame that is dropped is the take's silent tail.
        let duration = ((take.dur_s * fps).floor() as u64)
            .max(1)
            .min(manifest.duration_frames - start);
        let under = cue.under.unwrap_or(cues.under);
        if !UNDER.contains(&under) {
            warnings.push(format!(
                "frame {} {}: {under} dB under the {reference} is outside 12–40 dB",
                cue.frame, cue.role
            ));
        }
        let gain_db = reference_lufs - under - take.lufs_m_max;
        ensure!(
            gain_db <= audio::db(16.0),
            "frame {} {}: needs {gain_db:.1} dB of gain; pick a louder sound",
            cue.frame,
            cue.role
        );
        placed.push(Placed {
            frame: cue.frame,
            role: cue.role.clone(),
            file: take.file.clone(),
            start_frame: start,
            duration_frames: duration,
            sync_seconds: round(sync, 4),
            gain_db,
            under,
            note: cue.note.clone(),
        });
    }
    placed.sort_by_key(|c| c.frame);
    for pair in placed.windows(2) {
        if pair[1].frame - pair[0].frame < 3 {
            warnings.push(format!(
                "frames {} and {}: two cues {} frames apart stack into one smear",
                pair[0].frame,
                pair[1].frame,
                pair[1].frame - pair[0].frame
            ));
        }
    }
    let second = fps.round() as u64;
    for (i, cue) in placed.iter().enumerate() {
        let dense = placed[i..]
            .iter()
            .take_while(|c| c.frame < cue.frame + second)
            .count();
        if dense > 4 {
            warnings.push(format!(
                "from frame {}: {dense} cues within one second; keep the strongest",
                cue.frame
            ));
        }
    }
    warnings.dedup();
    Ok((placed, warnings))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn manifest() -> Manifest {
        serde_json::from_value(json!({
            "version":1,"width":1920,"height":1080,"fps":{"num":30,"den":1},"durationFrames":300,
            "tracks":[{"id":"sfx","name":"Sound effects","kind":"audio"}],"clips":[]
        }))
        .unwrap()
    }

    fn lock() -> Lock {
        serde_json::from_value(json!({"roles":{
            "whoosh": {"align":"peak","takes":[
                {"file":"whoosh_1.wav","pitch":null,"onset_s":0.08,"peak_s":0.4,"end_s":0.9,"dur_s":1.02,"lufs_m_max":-14.0}]},
            "bell": {"align":"onset","takes":[
                {"file":"bell_D5.wav","pitch":"D5","onset_s":0.003,"peak_s":0.01,"end_s":2.3,"dur_s":3.0,"lufs_m_max":-9.0},
                {"file":"bell_A5.wav","pitch":"A5","onset_s":0.003,"peak_s":0.01,"end_s":2.3,"dur_s":3.0,"lufs_m_max":-9.5}]},
            "riser": null
        }}))
        .unwrap()
    }

    #[test]
    fn places_by_the_measured_sync_point_and_sets_level_against_the_voice() {
        let cues: Cues = serde_json::from_value(json!({"cues":[
            {"frame":60,"role":"whoosh","under":22},
            {"frame":90,"role":"bell","pitch":"A5","under":16}
        ]}))
        .unwrap();
        let (placed, warnings) = arrange(&cues, &lock(), &manifest(), ("voice", -16.0)).unwrap();
        assert!(warnings.is_empty(), "{warnings:?}");
        // The whoosh peaks 0.4 s (12 frames) in, so it starts 12 frames early.
        assert_eq!(placed[0].start_frame, 48);
        // 1.02 s is 30.6 frames; the clip stays inside the take.
        assert_eq!(placed[0].duration_frames, 30);
        assert!((placed[0].gain_db - (-16.0 - 22.0 + 14.0)).abs() < 1e-9);
        assert_eq!(placed[1].file, "bell_A5.wav");
        assert_eq!(placed[1].start_frame, 90);
    }

    #[test]
    fn warns_about_stacked_cues_and_levels_outside_the_range() {
        let cues: Cues = serde_json::from_value(json!({"under":3,"cues":[
            {"frame":100,"role":"bell"},{"frame":101,"role":"bell"}
        ]}))
        .unwrap();
        let (placed, warnings) = arrange(&cues, &lock(), &manifest(), ("voice", -16.0)).unwrap();
        // Without a take or pitch the role rotates through its takes.
        assert_eq!(placed[0].file, "bell_D5.wav");
        assert_eq!(placed[1].file, "bell_A5.wav");
        assert!(warnings.iter().any(|w| w.contains("outside 12–40 dB")));
        assert!(warnings.iter().any(|w| w.contains("stack")));
    }

    #[test]
    fn rejects_roles_that_are_off() {
        let cues: Cues =
            serde_json::from_value(json!({"cues":[{"frame":10,"role":"riser"}]})).unwrap();
        assert!(arrange(&cues, &lock(), &manifest(), ("voice", -16.0)).is_err());
    }
}
