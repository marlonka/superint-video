//! Voice-led mix and master in Rust. Every audio clip of `video.json` is decoded, trimmed,
//! faded and placed; the music ducks under the words of `audio/words.json` and sits a fixed
//! distance under the voice; the sum goes to −14 LUFS (BS.1770) through a true-peak limiter.
//! Claude may tune it in `mix.json`; the tool never changes a clip. A film can go without a
//! voice, without music, or without any sound: then the master is what is left, or silence.
use crate::{
    audio::{self, Loudness, RATE, round},
    model::{Clip, ClipType, Manifest},
    project::{ProjectStore, atomic_write, safe_path},
    voice::tighten,
};
use anyhow::{Context, Result, bail};
use serde::Deserialize;
use serde_json::{Value, json};
use std::{collections::BTreeMap, fs, path::Path};

pub const SETTINGS: &str = "mix.json";
pub const MASTER: &str = "audio/master.wav";
/// What the meter reads when nothing is to be heard.
pub const SILENCE_LUFS: f64 = -70.0;
/// The narration `voice assemble` cuts, whose words are in `audio/words.json`.
const NARRATION: &str = "audio/voice.wav";
/// The track the voice is placed on: the narration, or takes spoken over the picture.
const VOICE_TRACK: &str = "voice";
const CHANNELS: usize = 2;
/// Seconds on the film timeline, start and end.
type Intervals = Vec<(f64, f64)>;
/// Control rate of the gain envelopes: 10 ms.
const STEP: usize = RATE as usize / 100;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Settings {
    #[serde(default = "loudness")]
    pub loudness: f64,
    /// True-peak ceiling of the WAV; AAC adds about a decibel on top.
    #[serde(default = "ceiling")]
    pub ceiling: f64,
    /// Music this many dB under the voice while words are spoken; null keeps the clip gains.
    #[serde(default = "music_under")]
    pub music_under: Option<f64>,
    #[serde(default = "duck")]
    pub duck_db: f64,
    /// Gain changes on the music, such as a swell under the title.
    #[serde(default)]
    pub rides: Vec<Ride>,
}
fn loudness() -> f64 {
    -14.0
}
fn ceiling() -> f64 {
    -3.4
}
fn music_under() -> Option<f64> {
    Some(22.0)
}
fn duck() -> f64 {
    3.0
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Ride {
    pub from: u64,
    pub to: u64,
    pub db: f64,
    #[serde(default = "ramp")]
    pub ramp_frames: u64,
    #[serde(default)]
    pub note: String,
}
fn ramp() -> u64 {
    15
}

fn settings(root: &Path) -> Result<Settings> {
    let path = root.join(SETTINGS);
    let bytes = if path.is_file() {
        fs::read(&path)?
    } else {
        b"{}".to_vec()
    };
    serde_json::from_slice(&bytes).with_context(|| format!("{SETTINGS} is invalid"))
}

/// Mix the project into `audio/master.wav` and report what was measured.
pub async fn mix(root: &Path) -> Result<Value> {
    let store = ProjectStore::open(root)?;
    let manifest = &store.manifest;
    let settings = settings(&store.root)?;
    let frames = manifest.fps.sample_at(manifest.duration_frames, RATE)? as usize;
    let mut buses: BTreeMap<String, Vec<f32>> = BTreeMap::new();
    let mut clips = 0;
    for clip in audible(manifest) {
        let samples = decode_clip(&store.root, manifest, clip).await?;
        let start = manifest.fps.sample_at(clip.start_frame, RATE)? as usize * CHANNELS;
        let bus = buses
            .entry(clip.track.clone())
            .or_insert_with(|| vec![0.0; frames * CHANNELS]);
        for (target, sample) in bus.iter_mut().skip(start).zip(samples) {
            *target += sample;
        }
        clips += 1;
    }
    let output = store.root.join(MASTER);
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    if clips == 0 {
        return silent(&store.root, &output, frames);
    }
    let (speech, mut warnings) = speech(&store.root, manifest).await?;

    let mut music_report = Value::Null;
    if let Some(music) = buses.get_mut("music") {
        let mut envelope = duck_envelope(frames, &speech, settings.duck_db);
        for ride in &settings.rides {
            add_ride(&mut envelope, manifest, ride);
        }
        apply_envelope(music, &envelope);
        let mut gain_db = 0.0;
        if let (Some(under), Some(voice)) = (settings.music_under, buses.get("voice")) {
            if speech.is_empty() {
                warnings.push(
                    "no words to measure the music against; music keeps its clip gains".into(),
                );
            } else {
                let voice_db = during(voice, &speech)?.integrated_lufs;
                let music = buses.get_mut("music").unwrap();
                let music_db = during(music, &speech)?.integrated_lufs;
                if music_db > -70.0 {
                    gain_db = voice_db - under - music_db;
                    scale(music, gain_db);
                }
            }
        }
        let music = &buses["music"];
        let under = match buses.get("voice") {
            Some(voice) if !speech.is_empty() => Some(round(
                during(voice, &speech)?.integrated_lufs - during(music, &speech)?.integrated_lufs,
                2,
            )),
            _ => None,
        };
        music_report = json!({
            "gainDb": round(gain_db, 2),
            "duckDb": settings.duck_db,
            "underVoiceDuringWords": under,
            "rides": settings.rides.len(),
        });
    }

    let mut sum = vec![0f32; frames * CHANNELS];
    let mut levels = BTreeMap::new();
    for (track, bus) in &buses {
        levels.insert(track.clone(), audio::loudness(bus, RATE, CHANNELS as u32)?);
        for (target, sample) in sum.iter_mut().zip(bus) {
            *target += sample;
        }
    }
    let (master, measured, reduction) = master(&sum, settings.loudness, settings.ceiling)?;
    let bytes = audio::wav_bytes_channels(&master, RATE, 24, CHANNELS as u16);
    atomic_write(&output, &bytes)?;
    if (measured.integrated_lufs - settings.loudness).abs() > 0.5 {
        warnings.push(format!(
            "master reads {} LUFS, more than 0.5 LU from {}",
            measured.integrated_lufs, settings.loudness
        ));
    }
    if measured.true_peak_db > settings.ceiling {
        warnings.push(format!(
            "true peak {} dBTP is over the {} dBTP ceiling",
            measured.true_peak_db, settings.ceiling
        ));
    }
    let report = json!({
        "ok": warnings.is_empty(),
        "output": MASTER,
        "seconds": round(frames as f64 / f64::from(RATE), 3),
        "clips": clips,
        "master": measured,
        "limiterMaxReductionDb": round(reduction, 2),
        "buses": levels,
        "music": music_report,
        "speechIntervals": speech.len(),
        "warnings": warnings,
    });
    write_report(&store.root, &report)?;
    Ok(report)
}

fn write_report(root: &Path, report: &Value) -> Result<()> {
    atomic_write(
        &root.join("audio/master.json"),
        serde_json::to_string_pretty(report)?.as_bytes(),
    )
}

/// The master of a film with nothing to hear: silence of the film's length, so the render
/// has a soundtrack to carry (see `renderer::mix` for why a film is never without one).
fn silent(root: &Path, output: &Path, frames: usize) -> Result<Value> {
    let samples = vec![0f32; frames * CHANNELS];
    atomic_write(
        output,
        &audio::wav_bytes_channels(&samples, RATE, 24, CHANNELS as u16),
    )?;
    let report = json!({
        "ok": true,
        "silent": true,
        "output": MASTER,
        "seconds": round(frames as f64 / f64::from(RATE), 3),
        "clips": 0,
        "note": "No audible audio clips: the master is silence, and the film gets a silent soundtrack.",
        "warnings": [],
    });
    write_report(root, &report)?;
    Ok(report)
}

/// Loudness of an audio or video file's soundtrack, for checking the finished MP4.
pub async fn measure(path: &Path) -> Result<Loudness> {
    let samples = audio::decode_channels(path, RATE, CHANNELS as u32).await?;
    audio::loudness(&samples, RATE, CHANNELS as u32)
}

fn audible(manifest: &Manifest) -> impl Iterator<Item = &Clip> {
    manifest.clips.iter().filter(|clip| {
        let track = manifest.tracks.iter().find(|t| t.id == clip.track);
        !clip.hidden
            && !clip.muted
            && track.is_some_and(|t| !t.hidden && !t.muted)
            && (clip.clip_type == ClipType::Audio
                || (clip.clip_type == ClipType::Video && clip.include_audio))
    })
}

/// The clip's trimmed, faded stereo samples, gain applied.
async fn decode_clip(root: &Path, manifest: &Manifest, clip: &Clip) -> Result<Vec<f32>> {
    let path = safe_path(root, &clip.src)?;
    let source = audio::decode_channels(&path, RATE, CHANNELS as u32).await?;
    let offset = manifest.fps.sample_at(clip.source_offset_frames, RATE)? as usize;
    let length = manifest.fps.sample_at(clip.duration_frames, RATE)? as usize;
    let mut samples = vec![0f32; length * CHANNELS];
    let available = source.get(offset * CHANNELS..).unwrap_or_default();
    let copied = available.len().min(samples.len());
    samples[..copied].copy_from_slice(&available[..copied]);
    let fade_in = manifest.fps.sample_at(clip.fade_in_frames, RATE)? as usize;
    let fade_out = manifest.fps.sample_at(clip.fade_out_frames, RATE)? as usize;
    for (frame, pair) in samples.as_chunks_mut::<CHANNELS>().0.iter_mut().enumerate() {
        let mut gain = clip.gain as f32;
        if frame < fade_in {
            gain *= frame as f32 / fade_in as f32;
        }
        if fade_out > 0 && frame + fade_out > length {
            gain *= (length - frame) as f32 / fade_out as f32;
        }
        for sample in pair {
            *sample *= gain;
        }
    }
    Ok(samples)
}

#[derive(Deserialize)]
struct Word {
    start: f64,
    end: f64,
}

/// Seconds on the film's timeline in which someone speaks. The narration brings its words
/// (`audio/words.json`, mapped through every narration clip; it may be split, e.g. around a
/// title card). Any other clip on the voice track, such as a take the user spoke over the
/// picture, and a narration without words, is listened to: it speaks where it is not silent.
/// Gaps under 0.3 s count as speech.
async fn speech(root: &Path, manifest: &Manifest) -> Result<(Intervals, Vec<String>)> {
    let mut clips: Vec<_> = audible(manifest)
        .filter(|c| c.src == NARRATION || c.track == VOICE_TRACK)
        .collect();
    if clips.is_empty() {
        // A film without narration is fine; only a cut one left off the timeline is a slip.
        let unplaced = root.join(NARRATION).is_file();
        let warning = "audio/voice.wav is not placed; the music does not duck";
        return Ok((
            Vec::new(),
            unplaced.then(|| warning.into()).into_iter().collect(),
        ));
    }
    let path = root.join("audio/words.json");
    let words: Option<Vec<Word>> = match path.is_file() {
        true => {
            Some(serde_json::from_slice(&fs::read(&path)?).context("audio/words.json is invalid")?)
        }
        false => None,
    };
    clips.sort_by_key(|c| c.start_frame);
    let mut spans: Vec<(f64, f64)> = Vec::new();
    for clip in clips {
        let offset = manifest.fps.seconds(clip.source_offset_frames);
        let start = manifest.fps.seconds(clip.start_frame);
        let end = manifest.fps.seconds(clip.end_frame());
        let spoken = match &words {
            Some(words) if clip.src == NARRATION => {
                words.iter().map(|word| (word.start, word.end)).collect()
            }
            _ => spoken(&audio::decode(&safe_path(root, &clip.src)?, RATE).await?),
        };
        for (from, to) in spoken {
            let (a, b) = (start + from - offset, start + to - offset);
            if b > start && a < end {
                spans.push((a.max(start), b.min(end)));
            }
        }
    }
    spans.sort_by(|x, y| x.0.total_cmp(&y.0));
    let mut intervals: Vec<(f64, f64)> = Vec::new();
    for (a, b) in spans {
        match intervals.last_mut() {
            Some(last) if a - last.1 < 0.3 => last.1 = last.1.max(b),
            _ => intervals.push((a, b)),
        }
    }
    Ok((intervals, Vec::new()))
}

/// Where a voice recording is not silent, in seconds of the file.
fn spoken(samples: &[f32]) -> Intervals {
    let analysis = tighten::Analysis::new(samples, RATE);
    let Some((first, last)) = analysis.speech() else {
        return Vec::new();
    };
    let seconds = |sample: usize| sample as f64 / f64::from(RATE);
    let pauses = analysis.pauses((0.3 * f64::from(RATE)) as usize);
    let starts = std::iter::once(first).chain(pauses.iter().map(|p| p.1));
    let ends = pauses.iter().map(|p| p.0).chain(std::iter::once(last));
    starts
        .zip(ends)
        .map(|(a, b)| (seconds(a), seconds(b)))
        .collect()
}

/// Gain in dB per 10 ms step: `depth` under the words, reached about 80 ms before a word and
/// released over 150 ms from about 180 ms after it.
fn duck_envelope(frames: usize, speech: &[(f64, f64)], depth: f64) -> Vec<f64> {
    let steps = frames.div_ceil(STEP) + 1;
    let mut target = vec![0f64; steps];
    for &(a, b) in speech {
        let from = ((a - 0.15) * 100.0).floor().max(0.0) as usize;
        let to = (((b + 0.25) * 100.0).ceil() as usize).min(steps);
        for value in target.iter_mut().take(to).skip(from) {
            *value = -depth;
        }
    }
    // A centered 150 ms box filter turns the steps into linear ramps.
    let half = 7usize;
    (0..steps)
        .map(|i| {
            let lo = i.saturating_sub(half);
            let hi = (i + half + 1).min(steps);
            target[lo..hi].iter().sum::<f64>() / (hi - lo) as f64
        })
        .collect()
}

fn add_ride(envelope: &mut [f64], manifest: &Manifest, ride: &Ride) {
    let from = manifest.fps.seconds(ride.from);
    let to = manifest.fps.seconds(ride.to);
    let ramp = manifest.fps.seconds(ride.ramp_frames).max(0.01);
    for (i, value) in envelope.iter_mut().enumerate() {
        let t = i as f64 / 100.0;
        let weight = if t < from - ramp || t > to + ramp {
            0.0
        } else if t < from {
            (t - (from - ramp)) / ramp
        } else if t > to {
            1.0 - (t - to) / ramp
        } else {
            1.0
        };
        *value += ride.db * weight;
    }
}

fn apply_envelope(samples: &mut [f32], envelope: &[f64]) {
    for (frame, pair) in samples.as_chunks_mut::<CHANNELS>().0.iter_mut().enumerate() {
        let position = frame as f64 / STEP as f64;
        let i = position.floor() as usize;
        let fraction = position - i as f64;
        let a = envelope.get(i).copied().unwrap_or(0.0);
        let b = envelope.get(i + 1).copied().unwrap_or(a);
        let gain = 10f64.powf((a + (b - a) * fraction) / 20.0) as f32;
        for sample in pair {
            *sample *= gain;
        }
    }
}

fn scale(samples: &mut [f32], db: f64) {
    let gain = 10f64.powf(db / 20.0) as f32;
    for sample in samples {
        *sample *= gain;
    }
}

/// Loudness of a bus over the given intervals only.
fn during(samples: &[f32], intervals: &[(f64, f64)]) -> Result<Loudness> {
    let mut joined = Vec::new();
    for &(a, b) in intervals {
        let from = (a * f64::from(RATE)) as usize * CHANNELS;
        let to = ((b * f64::from(RATE)) as usize * CHANNELS).min(samples.len());
        if from < to {
            joined.extend_from_slice(&samples[from..to]);
        }
    }
    audio::loudness(&joined, RATE, CHANNELS as u32)
}

/// Gain to the target loudness, then the limiter; repeated until both targets hold, because
/// the limiter lowers the loudness and the meter's true peak can exceed the limiter's estimate.
fn master(sum: &[f32], target: f64, ceiling: f64) -> Result<(Vec<f32>, Loudness, f64)> {
    let start = audio::loudness(sum, RATE, CHANNELS as u32)?;
    if start.integrated_lufs <= SILENCE_LUFS {
        bail!("the mix is silent although clips are placed; check their gains and files");
    }
    let mut gain = target - start.integrated_lufs;
    let mut internal = ceiling - 0.3;
    let mut best = None;
    for _ in 0..6 {
        let mut out = sum.to_vec();
        scale(&mut out, gain);
        let reduction = limit(&mut out, internal);
        let measured = audio::loudness(&out, RATE, CHANNELS as u32)?;
        let done =
            (measured.integrated_lufs - target).abs() <= 0.1 && measured.true_peak_db <= ceiling;
        best = Some((out, measured, reduction));
        if done {
            break;
        }
        gain += target - measured.integrated_lufs;
        if measured.true_peak_db > ceiling {
            internal -= measured.true_peak_db - ceiling + 0.05;
        }
    }
    Ok(best.unwrap())
}

/// Lookahead peak limiter on an oversampled peak estimate. Returns the deepest gain reduction
/// in dB. Gain never exceeds what the loudest point within the next 5 ms allows, and recovers
/// over about 80 ms.
fn limit(samples: &mut [f32], ceiling_db: f64) -> f64 {
    let frames = samples.len() / CHANNELS;
    if frames == 0 {
        return 0.0;
    }
    let ceiling = 10f64.powf(ceiling_db / 20.0);
    let at = |frame: isize, channel: usize| -> f64 {
        let frame = frame.clamp(0, frames as isize - 1) as usize;
        f64::from(samples[frame * CHANNELS + channel])
    };
    let required: Vec<f64> = (0..frames as isize)
        .map(|n| {
            let mut peak = 0f64;
            for channel in 0..CHANNELS {
                let (p0, p1, p2, p3) = (
                    at(n - 1, channel),
                    at(n, channel),
                    at(n + 1, channel),
                    at(n + 2, channel),
                );
                peak = peak.max(p1.abs());
                // Catmull-Rom between n and n+1 at four times the rate.
                for t in [0.25, 0.5, 0.75] {
                    let value = 0.5
                        * (2.0 * p1
                            + (p2 - p0) * t
                            + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t * t
                            + (3.0 * p1 - p0 - 3.0 * p2 + p3) * t * t * t);
                    peak = peak.max(value.abs());
                }
            }
            if peak > ceiling { ceiling / peak } else { 1.0 }
        })
        .collect();
    let look = (0.005 * f64::from(RATE)) as usize;
    // Minimum over the next `look` frames (monotonic deque).
    let mut hold = vec![1f64; frames];
    let mut window: std::collections::VecDeque<usize> = std::collections::VecDeque::new();
    for i in (0..frames).rev() {
        while window.back().is_some_and(|&j| required[j] >= required[i]) {
            window.pop_back();
        }
        window.push_back(i);
        while window.front().is_some_and(|&j| j > i + look) {
            window.pop_front();
        }
        hold[i] = required[*window.front().unwrap()];
    }
    // Averaging the held minimum over the previous `look` frames ramps the gain down before a
    // peak and still keeps it at or under what the peak requires.
    let release = 1.0 - (-1.0 / (0.08 * f64::from(RATE))).exp();
    // Before the first frame the window repeats frame 0.
    let held = |k: isize| hold[k.max(0) as usize];
    let mut sum = hold[0] * (look + 1) as f64;
    let mut previous = 1f64;
    let mut deepest = 1f64;
    for n in 0..frames {
        if n > 0 {
            sum += hold[n] - held(n as isize - look as isize - 1);
        }
        let average = sum / (look + 1) as f64;
        let gain = average.min(previous + (1.0 - previous) * release);
        previous = gain;
        deepest = deepest.min(gain);
        for channel in 0..CHANNELS {
            samples[n * CHANNELS + channel] =
                (f64::from(samples[n * CHANNELS + channel]) * gain) as f32;
        }
    }
    -audio::db(deepest)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn duck_reaches_depth_before_a_word_and_releases_after() {
        let frames = RATE as usize * 3;
        let envelope = duck_envelope(frames, &[(1.0, 1.5)], 3.0);
        assert!(envelope[50].abs() < 1e-9);
        assert!(
            (envelope[93] + 3.0).abs() < 1e-9,
            "ducked 70 ms before the word"
        );
        assert!((envelope[150] + 3.0).abs() < 1e-9);
        assert!(envelope[175] > -3.0 && envelope[175] < 0.0, "releasing");
        assert!(envelope[190].abs() < 1e-9);
    }

    #[test]
    fn a_recording_speaks_where_it_is_not_silent() {
        let tone = |seconds: f64| {
            (0..(seconds * f64::from(RATE)) as usize).map(|i| 0.3 * (i as f32 * 0.05).sin())
        };
        let quiet = |seconds: f64| std::iter::repeat_n(0f32, (seconds * f64::from(RATE)) as usize);
        let samples: Vec<f32> = quiet(0.5)
            .chain(tone(1.0))
            .chain(quiet(0.6))
            .chain(tone(0.5))
            .chain(quiet(0.2))
            .chain(tone(0.5))
            .chain(quiet(0.4))
            .collect();
        let heard = spoken(&samples);
        // The 0.2 s gap is a breath inside a sentence, the 0.6 s gap a pause.
        assert_eq!(heard.len(), 2);
        assert!((heard[0].0 - 0.5).abs() < 0.02 && (heard[0].1 - 1.5).abs() < 0.02);
        assert!((heard[1].0 - 2.1).abs() < 0.02 && (heard[1].1 - 3.3).abs() < 0.02);
        assert!(spoken(&quiet(1.0).collect::<Vec<_>>()).is_empty());
    }

    #[test]
    fn a_film_with_nothing_to_hear_gets_a_silent_master() {
        let folder = tempfile::tempdir().unwrap();
        let output = folder.path().join("audio/master.wav");
        fs::create_dir_all(output.parent().unwrap()).unwrap();
        let report = silent(folder.path(), &output, RATE as usize / 2).unwrap();
        assert_eq!(report["silent"], true);
        assert_eq!(report["seconds"], 0.5);
        let reader = hound::WavReader::open(&output).unwrap();
        assert_eq!(reader.spec().channels, 2);
        assert_eq!(reader.duration(), RATE / 2);
        assert!(folder.path().join("audio/master.json").is_file());
    }

    #[test]
    fn limiter_holds_the_ceiling_on_a_spike() {
        let mut samples: Vec<f32> = (0..RATE as usize)
            .flat_map(|i| {
                let s = if (24_000..24_010).contains(&i) {
                    0.99
                } else {
                    0.1 * (i as f32 * 0.05).sin()
                };
                [s, s]
            })
            .collect();
        let reduction = limit(&mut samples, -6.0);
        let peak = samples.iter().fold(0f32, |m, s| m.max(s.abs()));
        assert!(audio::db(f64::from(peak)) <= -6.0 + 0.01);
        assert!(reduction > 5.0);
        // Far from the spike the signal is untouched.
        assert!((samples[2 * 1000] - 0.1 * (1000f32 * 0.05).sin()).abs() < 1e-6);
    }

    #[test]
    fn rides_ramp_in_and_out() {
        let manifest: Manifest = serde_json::from_value(json!({
            "version":1,"width":2,"height":2,"fps":{"num":30,"den":1},"durationFrames":300,
            "tracks":[{"id":"music","kind":"audio"}],"clips":[]
        }))
        .unwrap();
        let mut envelope = vec![0f64; 1000];
        let ride: Ride =
            serde_json::from_value(json!({"from":90,"to":150,"db":5,"rampFrames":30})).unwrap();
        add_ride(&mut envelope, &manifest, &ride);
        assert!(envelope[150].abs() < 1e-9);
        assert!((envelope[250] - 2.5).abs() < 1e-9);
        assert!((envelope[400] - 5.0).abs() < 1e-9);
        assert!(envelope[700].abs() < 1e-9);
    }
}
