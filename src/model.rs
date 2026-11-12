//! The manifest is the only editable authority for composition timing.
use anyhow::{Context, Result, bail, ensure};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::HashSet;

fn default_name() -> String {
    "Untitled".into()
}
fn default_background() -> String {
    "#101113".into()
}
fn one() -> f64 {
    1.0
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Fps {
    #[schemars(range(min = 1))]
    pub num: u32,
    #[schemars(range(min = 1))]
    pub den: u32,
}
impl Fps {
    pub fn seconds(&self, frame: u64) -> f64 {
        frame as f64 * self.den as f64 / self.num as f64
    }
    /// Nearest audio sample, with ties rounded upward, without accumulating drift.
    pub fn sample_at(&self, frame: u64, sample_rate: u32) -> Result<u64> {
        ensure!(self.num > 0 && self.den > 0, "frame rate must be positive");
        let numerator = u128::from(frame) * u128::from(self.den) * u128::from(sample_rate);
        u64::try_from((numerator + u128::from(self.num / 2)) / u128::from(self.num))
            .context("audio sample position overflow")
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum TrackKind {
    Visual,
    Audio,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum ClipType {
    Scene,
    Image,
    Video,
    Audio,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Track {
    #[schemars(regex(pattern = "^[A-Za-z0-9_-]{1,128}$"))]
    pub id: String,
    #[serde(default)]
    pub name: String,
    pub kind: TrackKind,
    #[serde(default)]
    pub hidden: bool,
    #[serde(default)]
    pub muted: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Transform {
    #[serde(default)]
    pub x: f64,
    #[serde(default)]
    pub y: f64,
    #[serde(default = "one")]
    pub scale: f64,
    #[serde(default)]
    pub rotation: f64,
}
impl Default for Transform {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            scale: 1.0,
            rotation: 0.0,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Clip {
    #[schemars(regex(pattern = "^[A-Za-z0-9_-]{1,128}$"))]
    pub id: String,
    #[serde(rename = "type")]
    pub clip_type: ClipType,
    /// Project-relative path using forward slashes; traversal, remote URLs, Windows device names and symlink escapes are rejected.
    #[schemars(length(min = 1, max = 4096))]
    pub src: String,
    pub track: String,
    #[schemars(range(max = 9_007_199_254_740_991_u64))]
    pub start_frame: u64,
    #[schemars(range(min = 1, max = 9_007_199_254_740_991_u64))]
    pub duration_frames: u64,
    #[serde(default)]
    #[schemars(range(max = 9_007_199_254_740_991_u64))]
    pub source_offset_frames: u64,
    #[serde(default)]
    pub props: Map<String, Value>,
    #[serde(default)]
    pub transform: Transform,
    #[serde(default = "one")]
    #[schemars(range(min = 0.0, max = 1.0))]
    pub opacity: f64,
    #[serde(default = "one")]
    #[schemars(range(min = 0.0, max = 16.0))]
    pub gain: f64,
    #[serde(default)]
    pub fade_in_frames: u64,
    #[serde(default)]
    pub fade_out_frames: u64,
    #[serde(default)]
    pub hidden: bool,
    #[serde(default)]
    pub muted: bool,
    /// Video audio is opt-in. Audio clips always contribute unless muted/hidden.
    #[serde(default)]
    pub include_audio: bool,
}
impl Clip {
    pub fn end_frame(&self) -> u64 {
        self.start_frame.saturating_add(self.duration_frames)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Manifest {
    #[schemars(range(min = 1, max = 1))]
    pub version: u32,
    #[serde(default = "default_name")]
    pub name: String,
    #[schemars(range(min = 1, max = 8192))]
    pub width: u32,
    #[schemars(range(min = 1, max = 8192))]
    pub height: u32,
    /// Rational project timebase; num/den must not exceed 240 frames per second.
    pub fps: Fps,
    #[schemars(range(min = 1, max = 9_007_199_254_740_991_u64))]
    pub duration_frames: u64,
    #[serde(default = "default_background")]
    #[schemars(regex(pattern = "^#[A-Fa-f0-9]{6}([A-Fa-f0-9]{2})?$"))]
    pub background: String,
    /// The film's main font: a family its own files declare or one of the tool's library. Scenes
    /// take it through the `--font` CSS variable; absent, each keeps its style's own.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schemars(length(min = 1, max = 100))]
    pub font: Option<String>,
    #[schemars(length(min = 1))]
    pub tracks: Vec<Track>,
    pub clips: Vec<Clip>,
}

/// Portable project-relative URL/file path. Filesystem symlink checks live in project::safe_path.
pub fn validate_relative_path(path: &str) -> Result<()> {
    ensure!(
        !path.is_empty() && path.len() <= 4096,
        "source path must contain 1–4096 bytes"
    );
    ensure!(
        !path.starts_with('/') && !path.contains('\\'),
        "source path must be project-relative and use forward slashes: {path}"
    );
    ensure!(
        !path
            .chars()
            .any(|c| c.is_control() || matches!(c, ':' | '?' | '#' | '*' | '"' | '<' | '>' | '|')),
        "source path contains forbidden characters: {path}"
    );
    for part in path.split('/') {
        ensure!(
            !part.is_empty() && part != "." && part != "..",
            "source path contains traversal or an empty component: {path}"
        );
        ensure!(
            !part.ends_with('.') && !part.ends_with(' '),
            "source path has a nonportable component: {path}"
        );
        let stem = part
            .split('.')
            .next()
            .unwrap_or("")
            .trim_end_matches(' ')
            .to_ascii_uppercase();
        let reserved = matches!(
            stem.as_str(),
            "CON" | "PRN" | "AUX" | "NUL" | "CLOCK$" | "CONIN$" | "CONOUT$"
        ) || (stem.len() == 4
            && (stem.starts_with("COM") || stem.starts_with("LPT"))
            && matches!(stem.as_bytes()[3], b'1'..=b'9'))
            || matches!(
                stem.as_str(),
                "COM¹" | "COM²" | "COM³" | "LPT¹" | "LPT²" | "LPT³"
            );
        ensure!(
            !reserved,
            "source path contains a reserved Windows filename: {path}"
        );
    }
    Ok(())
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

impl Manifest {
    pub fn validate(&self) -> Result<()> {
        ensure!(
            self.version == 1,
            "unsupported manifest version {}; expected 1",
            self.version
        );
        ensure!(
            (1..=8192).contains(&self.width) && (1..=8192).contains(&self.height),
            "dimensions must be between 1 and 8192 pixels"
        );
        ensure!(
            self.fps.num > 0
                && self.fps.den > 0
                && u64::from(self.fps.num) <= 240 * u64::from(self.fps.den),
            "fps must be positive and no more than 240"
        );
        // JS integers must represent every frame exactly, including source offsets.
        ensure!(
            self.duration_frames > 0 && self.duration_frames <= 9_007_199_254_740_991,
            "durationFrames must be a positive safe integer"
        );
        ensure!(self.name.len() <= 512, "project name exceeds 512 bytes");
        ensure!(
            matches!(self.background.len(), 7 | 9)
                && self.background.starts_with('#')
                && self.background[1..].bytes().all(|b| b.is_ascii_hexdigit()),
            "background must be #RRGGBB or #RRGGBBAA"
        );
        if let Some(font) = &self.font {
            ensure!(
                !font.trim().is_empty()
                    && font.len() <= 100
                    && !font.chars().any(|c| c.is_control()
                        || matches!(c, '"' | '\'' | '\\' | ';' | '{' | '}' | '<' | '>')),
                "font must be the name of a font family"
            );
        }
        ensure!(
            !self.tracks.is_empty(),
            "project requires at least one track"
        );
        let mut track_ids = HashSet::new();
        for track in &self.tracks {
            ensure!(
                valid_id(&track.id),
                "invalid track ID {}; use letters, digits, hyphens or underscores",
                track.id
            );
            ensure!(
                track_ids.insert(&track.id),
                "duplicate track ID {}",
                track.id
            );
        }
        let mut clip_ids = HashSet::new();
        for clip in &self.clips {
            ensure!(
                valid_id(&clip.id),
                "invalid clip ID {}; use letters, digits, hyphens or underscores",
                clip.id
            );
            ensure!(clip_ids.insert(&clip.id), "duplicate clip ID {}", clip.id);
            validate_relative_path(&clip.src).with_context(|| format!("clip {}", clip.id))?;
            let track = self
                .tracks
                .iter()
                .find(|t| t.id == clip.track)
                .with_context(|| {
                    format!("clip {} references missing track {}", clip.id, clip.track)
                })?;
            ensure!(
                (clip.clip_type == ClipType::Audio) == (track.kind == TrackKind::Audio),
                "clip {} type does not match track {}",
                clip.id,
                clip.track
            );
            ensure!(
                clip.duration_frames > 0,
                "clip {} durationFrames must be positive",
                clip.id
            );
            let end = clip
                .start_frame
                .checked_add(clip.duration_frames)
                .context("clip end overflow")?;
            ensure!(
                end <= self.duration_frames,
                "clip {} ends at frame {end}, after project end {}",
                clip.id,
                self.duration_frames
            );
            let source_end = clip
                .source_offset_frames
                .checked_add(clip.duration_frames)
                .context("source time overflow")?;
            ensure!(
                source_end <= 9_007_199_254_740_991,
                "clip {} source position is not a safe integer",
                clip.id
            );
            ensure!(
                clip.opacity.is_finite() && (0.0..=1.0).contains(&clip.opacity),
                "clip {} opacity must be between 0 and 1",
                clip.id
            );
            ensure!(
                clip.gain.is_finite() && (0.0..=16.0).contains(&clip.gain),
                "clip {} gain must be between 0 and 16",
                clip.id
            );
            ensure!(
                clip.transform.x.is_finite()
                    && clip.transform.y.is_finite()
                    && clip.transform.rotation.is_finite()
                    && clip.transform.scale.is_finite()
                    && clip.transform.scale > 0.0,
                "clip {} transform must be finite with positive scale",
                clip.id
            );
            ensure!(
                clip.fade_in_frames <= clip.duration_frames
                    && clip.fade_out_frames <= clip.duration_frames,
                "clip {} fade exceeds its duration",
                clip.id
            );
            if clip.clip_type == ClipType::Scene {
                ensure!(
                    clip.src.to_ascii_lowercase().ends_with(".html")
                        || clip.src.to_ascii_lowercase().ends_with(".htm"),
                    "scene {} source must be an HTML file",
                    clip.id
                );
            }
        }
        Ok(())
    }

    /// Evaluate an edit against a clone; an invalid edit never changes the original.
    pub fn apply_operation(&self, operation: &Value) -> Result<Self> {
        self.validate()?;
        let object = operation
            .as_object()
            .context("operation must be an object")?;
        let kind = object
            .get("type")
            .and_then(Value::as_str)
            .context("operation.type is required")?;
        let mut next = self.clone();
        match kind {
            "updateClip" => {
                let clip = next.find_clip_mut(required_string(operation, "id")?)?;
                let changes = operation
                    .get("changes")
                    .and_then(Value::as_object)
                    .context("changes must be an object")?;
                ensure!(
                    !changes.contains_key("id") && !changes.contains_key("type"),
                    "updateClip cannot change id or type"
                );
                let mut value = serde_json::to_value(&*clip)?;
                merge_object(&mut value, changes)?;
                *clip = serde_json::from_value(value).context("invalid clip changes")?;
            }
            "splitClip" => {
                let id = required_string(operation, "id")?;
                let index = next
                    .clips
                    .iter()
                    .position(|c| c.id == id)
                    .context("clip not found")?;
                let frame = operation
                    .get("frame")
                    .and_then(Value::as_u64)
                    .context("frame must be an integer")?;
                let original = &next.clips[index];
                ensure!(
                    frame > original.start_frame && frame < original.end_frame(),
                    "split frame must be strictly inside clip {}",
                    id
                );
                let left_duration = frame - original.start_frame;
                let mut left = original.clone();
                let mut right = original.clone();
                left.id = format!("clip-{}", uuid::Uuid::new_v4());
                right.id = format!("clip-{}", uuid::Uuid::new_v4());
                left.duration_frames = left_duration;
                right.start_frame = frame;
                right.duration_frames -= left_duration;
                right.source_offset_frames += left_duration;
                // Retain only outer fades. A split does not introduce a new fade at the cut.
                ensure!(
                    original.fade_in_frames <= left.duration_frames
                        && original.fade_out_frames <= right.duration_frames,
                    "cannot split inside a fade; shorten or remove the fade first"
                );
                left.fade_out_frames = 0;
                right.fade_in_frames = 0;
                next.clips.splice(index..=index, [left, right]);
            }
            "duplicateClip" => {
                let clip = next
                    .find_clip_mut(required_string(operation, "id")?)?
                    .clone();
                let index = next.clips.iter().position(|c| c.id == clip.id).unwrap();
                let mut duplicate = clip;
                duplicate.id = format!("clip-{}", uuid::Uuid::new_v4());
                next.clips.insert(index + 1, duplicate);
            }
            "deleteClip" => {
                let id = required_string(operation, "id")?;
                let index = next
                    .clips
                    .iter()
                    .position(|c| c.id == id)
                    .context("clip not found")?;
                next.clips.remove(index);
            }
            "addClip" => next.clips.push(serde_json::from_value(
                operation.get("clip").context("clip is required")?.clone(),
            )?),
            "addTrack" => next.tracks.push(serde_json::from_value(
                operation.get("track").context("track is required")?.clone(),
            )?),
            "updateTrack" => {
                let id = required_string(operation, "id")?;
                let track = next
                    .tracks
                    .iter_mut()
                    .find(|t| t.id == id)
                    .context("track not found")?;
                let changes = operation
                    .get("changes")
                    .and_then(Value::as_object)
                    .context("changes must be an object")?;
                ensure!(
                    changes
                        .keys()
                        .all(|k| matches!(k.as_str(), "hidden" | "muted" | "name")),
                    "updateTrack can change only hidden, muted and name"
                );
                let mut value = serde_json::to_value(&*track)?;
                merge_object(&mut value, changes)?;
                *track = serde_json::from_value(value)?;
            }
            "updateProject" => {
                let changes = operation
                    .get("changes")
                    .and_then(Value::as_object)
                    .context("changes must be an object")?;
                ensure!(
                    changes.keys().all(|k| matches!(
                        k.as_str(),
                        "name"
                            | "width"
                            | "height"
                            | "fps"
                            | "durationFrames"
                            | "background"
                            | "font"
                            | "tracks"
                    )),
                    "unsupported project change"
                );
                let mut value = serde_json::to_value(&next)?;
                merge_object(&mut value, changes)?;
                next = serde_json::from_value(value)?;
            }
            _ => bail!("unknown edit operation {kind}"),
        }
        next.validate()?;
        Ok(next)
    }

    fn find_clip_mut(&mut self, id: &str) -> Result<&mut Clip> {
        self.clips
            .iter_mut()
            .find(|c| c.id == id)
            .with_context(|| format!("clip {id} not found"))
    }

    pub fn schema() -> Value {
        serde_json::to_value(schemars::schema_for!(Manifest)).expect("serializable JSON schema")
    }
}

fn required_string<'a>(value: &'a Value, key: &str) -> Result<&'a str> {
    value
        .get(key)
        .and_then(Value::as_str)
        .with_context(|| format!("{key} is required"))
}

fn merge_object(target: &mut Value, changes: &Map<String, Value>) -> Result<()> {
    let object = target.as_object_mut().context("expected object")?;
    for (key, value) in changes {
        // Props are a complete instance map. Transform may be edited one coordinate at a time.
        if key == "transform"
            && let Some(fields) = value.as_object()
        {
            merge_object(object.get_mut(key).context("missing transform")?, fields)?;
        } else {
            object.insert(key.clone(), value.clone());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    pub fn fixture() -> Manifest {
        serde_json::from_value(json!({"version":1,"width":1920,"height":1080,"fps":{"num":30,"den":1},"durationFrames":120,
            "tracks":[{"id":"visuals","kind":"visual"},{"id":"overlay","kind":"visual"}],
            "clips":[{"id":"one","type":"scene","src":"scenes/one.html","track":"visuals","startFrame":0,"durationFrames":60,"sourceOffsetFrames":15},
                     {"id":"two","type":"scene","src":"scenes/two.html","track":"visuals","startFrame":60,"durationFrames":30},
                     {"id":"overlay","type":"image","src":"assets/image.png","track":"overlay","startFrame":30,"durationFrames":20}]})).unwrap()
    }

    #[test]
    fn moving_trimming_and_splitting_preserve_source_time() {
        // The source frame a clip shows at a timeline frame, as the player works it out.
        let source = |clip: &Clip, frame: u64| {
            (clip.start_frame..clip.end_frame())
                .contains(&frame)
                .then(|| frame - clip.start_frame + clip.source_offset_frames)
        };
        let manifest = fixture();
        let moved = manifest
            .apply_operation(&json!({"type":"updateClip","id":"one","changes":{"startFrame":10}}))
            .unwrap();
        assert_eq!(source(&moved.clips[0], 10), Some(15));
        let trimmed = manifest.apply_operation(&json!({"type":"updateClip","id":"one","changes":{"startFrame":10,"durationFrames":40,"sourceOffsetFrames":25}})).unwrap();
        assert_eq!(source(&trimmed.clips[0], 10), Some(25));
        assert_eq!(source(&trimmed.clips[0], 49), Some(64));
        let split = trimmed
            .apply_operation(&json!({"type":"splitClip","id":"one","frame":30}))
            .unwrap();
        assert_ne!(split.clips[0].id, "one");
        assert_ne!(split.clips[0].id, split.clips[1].id);
        assert_eq!(source(&split.clips[0], 29), Some(44));
        assert_eq!(source(&split.clips[1], 30), Some(45));
        assert_eq!(source(&split.clips[1], 49), Some(64));
        assert_eq!(manifest.clips[0].start_frame, 0);
        for frame in [0, 60] {
            assert!(
                manifest
                    .apply_operation(&json!({"type":"splitClip","id":"one","frame":frame}))
                    .is_err()
            );
        }
    }

    #[test]
    fn rational_clock_and_sample_positions_do_not_accumulate_drift() {
        assert_eq!(Fps { num: 30, den: 1 }.seconds(30), 1.0);
        assert_eq!(Fps { num: 60, den: 1 }.seconds(60), 1.0);
        let ntsc = Fps {
            num: 30_000,
            den: 1001,
        };
        assert_eq!(ntsc.seconds(30_000), 1001.0);
        assert_eq!(ntsc.sample_at(1, 48_000).unwrap(), 1602);
        assert_eq!(ntsc.sample_at(2, 48_000).unwrap(), 3203);
        assert_eq!(ntsc.sample_at(30_000, 48_000).unwrap(), 48_048_000);
    }

    #[test]
    fn invalid_edits_do_not_mutate_and_unsafe_paths_are_rejected() {
        let manifest = fixture();
        assert!(
            manifest
                .apply_operation(
                    &json!({"type":"updateClip","id":"one","changes":{"durationFrames":121}})
                )
                .is_err()
        );
        assert_eq!(manifest.clips[0].duration_frames, 60);
        for path in [
            "../secret",
            "/secret",
            "C:/secret",
            "assets/../secret",
            "assets\\secret",
            "assets/NUL.txt",
            "assets/CONIN$",
            "assets/COM¹.txt",
            "assets/file:stream",
            "assets/file.",
            "https://remote/a.png",
        ] {
            assert!(validate_relative_path(path).is_err(), "accepted {path}");
        }
        validate_relative_path("assets/München clip.png").unwrap();
        let mut bad = manifest;
        bad.clips[0].opacity = f64::NAN;
        assert!(bad.validate().is_err());
    }

    #[test]
    fn editing_one_property_preserves_other_fields_and_rejects_unknown_keys() {
        let mut manifest = fixture();
        manifest.clips[0].transform.scale = 1.5;
        manifest.clips[0].transform.y = 42.0;
        let edited = manifest
            .apply_operation(
                &json!({"type":"updateClip","id":"one","changes":{"transform":{"x":80}}}),
            )
            .unwrap();
        assert_eq!(edited.clips[0].transform.x, 80.0);
        assert_eq!(edited.clips[0].transform.y, 42.0);
        assert_eq!(edited.clips[0].transform.scale, 1.5);
        assert_eq!(edited.clips[0].source_offset_frames, 15);
        assert!(
            manifest
                .apply_operation(
                    &json!({"type":"updateClip","id":"one","changes":{"sourceOffestFrames":20}})
                )
                .is_err()
        );
        assert!(
            manifest
                .apply_operation(
                    &json!({"type":"updateClip","id":"one","changes":{"id":"different"}})
                )
                .is_err()
        );
        let hidden = manifest
            .apply_operation(
                &json!({"type":"updateTrack","id":"visuals","changes":{"hidden":true}}),
            )
            .unwrap();
        assert!(hidden.tracks[0].hidden);
        let mut future_version = manifest;
        future_version.version = 2;
        assert!(
            future_version
                .validate()
                .unwrap_err()
                .to_string()
                .contains("unsupported manifest version 2")
        );
    }
}
