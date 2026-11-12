//! The user's own voice. They read `voice.md` aloud, paragraph by paragraph, in Studio or
//! into a file they bring; the tool cleans each recording lightly and keeps it in `audio/own/`.
//! `voice assemble` then cuts the accepted recordings like TTS takes. With a key for a
//! transcription model the word times are measured; without one they are estimated from the
//! syllables of the text and the pauses in the recording, and marked as estimated.
//! A recording spoken over the finished picture is kept here too, with the frame it starts on.
use super::{Paragraph, VoiceDoc, align, read_doc, tighten};
use crate::{
    audio::{self, round},
    env::Keys,
    model::{Manifest, TrackKind},
    project::atomic_write,
    providers::{Generators, Transcript},
};
use anyhow::{Context, Result, bail, ensure};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

pub const DIR: &str = "audio/own";
const STATE: &str = "audio/own/takes.json";
/// Rumble under a voice: desk bumps, traffic, the hum of a computer.
const HIGH_PASS: &str = "highpass=f=80";
/// Level of the speech in a cleaned recording (RMS over the spoken parts), and its highest peak.
const TARGET_DB: f64 = -20.0;
const CEILING_DB: f64 = -1.0;
/// Room kept before the first and after the last sound of a paragraph.
const HEAD: f64 = 0.2;
const TAIL: f64 = 0.3;
/// Shortest silence that separates two paragraphs of one long file.
const PARAGRAPH_GAP: f64 = 0.3;
/// Shortest silence inside a paragraph that a word boundary is put on.
const WORD_GAP: f64 = 0.16;

/// One cleaned recording and the text it was spoken for.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Take {
    pub file: String,
    pub text: String,
    pub seconds: f64,
    pub peak_db: f64,
    /// What was done to the level, so a very quiet or very loud recording shows.
    pub gain_db: f64,
    /// `clipped`, `quiet` or `noisy`: what the user may want to record again for.
    #[serde(default)]
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Entry {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    accepted: Option<Take>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    draft: Option<Take>,
}

/// A take spoken over the picture, from `start_frame` on.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Over {
    pub start_frame: u64,
    #[serde(flatten)]
    pub take: Take,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct State {
    #[serde(default)]
    paragraphs: BTreeMap<usize, Entry>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    over: Option<Over>,
}

impl State {
    fn load(root: &Path) -> Self {
        fs::read(root.join(STATE))
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default()
    }

    fn save(&self, root: &Path) -> Result<()> {
        atomic_write(&root.join(STATE), &serde_json::to_vec_pretty(self)?)
    }

    /// Loads, changes and saves the state as one step. Studio answers requests side by side;
    /// without the lock, one that loaded earlier would save over what another just changed.
    fn update<T>(root: &Path, change: impl FnOnce(&mut Self) -> Result<T>) -> Result<T> {
        static LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
        let _held = LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let mut state = Self::load(root);
        let result = change(&mut state)?;
        state.save(root)?;
        Ok(result)
    }
}

fn take_file(number: usize, draft: bool) -> String {
    let mark = if draft { ".draft" } else { "" };
    format!("{DIR}/p{number:02}{mark}.wav")
}

/// A recording after the light clean-up every own take gets.
struct Cleaned {
    samples: Vec<f32>,
    peak_db: f64,
    gain_db: f64,
    notes: Vec<String>,
}

/// Trims the silence at the edges, brings the speech to the level the mix expects and keeps
/// the peaks under the ceiling. Nothing that changes how the voice sounds: no gate, no
/// compressor, no noise removal. `keep_head` leaves the start alone, for a take whose first
/// sample belongs to a frame of the film.
fn clean(raw: &[f32], rate: u32, keep_head: bool) -> Result<Cleaned> {
    let analysis = tighten::Analysis::new(raw, rate);
    let active = analysis.active_rms();
    let per_second = f64::from(rate);
    let speech = analysis
        .speech()
        .filter(|(a, b)| (b - a) as f64 / per_second >= 0.25 && audio::db(active) > -55.0);
    let Some((first, last)) = speech else {
        bail!(
            "Nothing was heard in this recording. Check that the right microphone is chosen and speak closer to it"
        );
    };
    let mut notes = Vec::new();
    if raw.iter().any(|s| s.abs() >= 0.999) {
        notes.push("clipped".to_string());
    }
    if audio::db(active) < -40.0 {
        notes.push("quiet".to_string());
    }
    // The quietest tenth of the recording is the room: the edges, the breaths, the gaps
    // between syllables. A room less than 20 dB under the voice is heard in every pause. (A
    // sound with no quieter tenth at all has no room to judge.)
    let mut floor = audio::window_db(raw, (rate / 100).max(1) as usize);
    floor.sort_by(f64::total_cmp);
    let room = floor[floor.len() / 10];
    if room > -50.0 && (3.0..20.0).contains(&(audio::db(active) - room)) {
        notes.push("noisy".to_string());
    }
    let start = if keep_head {
        0
    } else {
        first.saturating_sub((HEAD * per_second) as usize)
    };
    let end = (last + (TAIL * per_second) as usize).min(raw.len());
    let mut samples = raw[start..end].to_vec();
    let mut gain = 10f64
        .powf((TARGET_DB - audio::db(active)) / 20.0)
        .clamp(0.25, 16.0);
    let peak = samples.iter().fold(0f32, |m, s| m.max(s.abs()));
    let ceiling = 10f64.powf(CEILING_DB / 20.0);
    if f64::from(peak) * gain > ceiling {
        gain = ceiling / f64::from(peak);
    }
    // Five milliseconds in and out, so a cut in room tone does not click.
    let fade = ((0.005 * per_second) as usize)
        .min(samples.len() / 2)
        .max(1);
    let length = samples.len();
    for (index, sample) in samples.iter_mut().enumerate() {
        let edge = index.min(length - 1 - index);
        let ramp = if edge < fade {
            (edge as f32 + 0.5) / fade as f32
        } else {
            1.0
        };
        *sample *= gain as f32 * ramp;
    }
    Ok(Cleaned {
        peak_db: round(audio::db(f64::from(peak) * gain), 2),
        gain_db: round(audio::db(gain), 2),
        samples,
        notes,
    })
}

/// Any audio FFmpeg reads (WAV, MP3, M4A, Ogg, WebM, FLAC), as mono samples without rumble.
async fn decode(bytes: &[u8]) -> Result<Vec<f32>> {
    ensure!(!bytes.is_empty(), "The recording is empty");
    let mut file = tempfile::NamedTempFile::new()?;
    std::io::Write::write_all(&mut file, bytes)?;
    audio::decode_filtered(file.path(), audio::RATE, HIGH_PASS)
        .await
        .context("This file could not be read as audio (WAV, MP3, M4A, Ogg, WebM or FLAC)")
}

/// The transcript of what was recorded at `file` before, now of no use.
fn forget_transcript(root: &Path, file: &str) {
    let _ = fs::remove_file(root.join(file).with_extension("json"));
}

fn keep(root: &Path, file: &str, text: &str, cleaned: &Cleaned) -> Result<Take> {
    forget_transcript(root, file);
    audio::write_wav(&root.join(file), &cleaned.samples, audio::RATE)?;
    Ok(Take {
        file: file.to_string(),
        text: text.to_string(),
        // Rounded down: a clip made from this length must not reach past the file.
        seconds: (cleaned.samples.len() as f64 / f64::from(audio::RATE) * 100.0).floor() / 100.0,
        peak_db: cleaned.peak_db,
        gain_db: cleaned.gain_db,
        notes: cleaned.notes.clone(),
    })
}

fn paragraph(doc: &VoiceDoc, number: usize) -> Result<&Paragraph> {
    doc.paragraphs
        .iter()
        .find(|p| p.number == number)
        .with_context(|| {
            format!(
                "voice.md has no paragraph {number} (1–{})",
                doc.paragraphs.len()
            )
        })
}

/// One paragraph's recording, cleaned. As a draft it waits for the user to listen and accept;
/// accepted at once, it replaces what was there.
pub async fn record(root: &Path, number: usize, bytes: &[u8], accept: bool) -> Result<()> {
    let doc = read_doc(root)?;
    let text = paragraph(&doc, number)?.text.clone();
    let cleaned = clean(&decode(bytes).await?, audio::RATE, false)?;
    State::update(root, |state| {
        let take = keep(root, &take_file(number, !accept), &text, &cleaned)?;
        let entry = state.paragraphs.entry(number).or_default();
        if accept {
            entry.accepted = Some(take);
            entry.draft = None;
        } else {
            entry.draft = Some(take);
        }
        Ok(())
    })
}

/// The draft becomes the paragraph's recording, as long as it was spoken for its current text.
pub fn accept(root: &Path, number: usize) -> Result<()> {
    let doc = read_doc(root)?;
    let text = &paragraph(&doc, number)?.text;
    State::update(root, |state| {
        let entry = state.paragraphs.entry(number).or_default();
        let mut take = entry
            .draft
            .take_if(|take| take.text == *text)
            .with_context(|| {
                format!("Paragraph {number} has no new recording of its current text to accept")
            })?;
        let file = take_file(number, false);
        forget_transcript(root, &file);
        fs::rename(root.join(&take.file), root.join(&file))
            .with_context(|| format!("Keeping {}", take.file))?;
        take.file = file;
        entry.accepted = Some(take);
        Ok(())
    })
}

/// Throws a paragraph's draft away; its accepted recording stays.
pub fn discard(root: &Path, number: usize) -> Result<()> {
    State::update(root, |state| {
        if let Some(draft) = state
            .paragraphs
            .get_mut(&number)
            .and_then(|entry| entry.draft.take())
        {
            let _ = fs::remove_file(root.join(draft.file));
        }
        Ok(())
    })
}

/// The file of a paragraph's draft or accepted recording, for listening back.
pub fn audio_file(root: &Path, number: usize, draft: bool) -> Option<PathBuf> {
    let state = State::load(root);
    let entry = state.paragraphs.get(&number)?;
    let take = if draft { &entry.draft } else { &entry.accepted };
    take.as_ref().map(|take| root.join(&take.file))
}

/// The generators, when a key reaches the transcription model of this film.
pub(super) fn transcriber(root: &Path, doc: &VoiceDoc) -> Result<Option<Generators>> {
    let generators = Generators::new(Keys::load(root)?, root.join(".superint/cache"))?;
    Ok(generators
        .reachable(&doc.transcription)
        .is_ok()
        .then_some(generators))
}

/// The whole narration in one file, split into the paragraphs of `voice.md`: where the
/// transcript says a paragraph ends when a key can transcribe it, else at the longest pauses.
pub async fn whole(root: &Path, bytes: &[u8]) -> Result<()> {
    let doc = read_doc(root)?;
    ensure!(
        !doc.paragraphs.is_empty(),
        "voice.md has no paragraphs to speak"
    );
    let raw = decode(bytes).await?;
    let rate = audio::RATE;
    let analysis = tighten::Analysis::new(&raw, rate);
    let count = doc.paragraphs.len();
    let cuts = match transcriber(root, &doc)? {
        Some(generators) => {
            let mut file = tempfile::Builder::new().suffix(".wav").tempfile()?;
            std::io::Write::write_all(&mut file, &audio::wav_bytes(&raw, rate, 16))?;
            let (transcript, _) = generators
                .transcribe_first(file.path(), &doc.transcribers())
                .await?;
            cuts_from_transcript(&doc, &transcript, &analysis, rate)?
        }
        None => {
            let pauses = analysis.pauses((PARAGRAPH_GAP * f64::from(rate)) as usize);
            let cuts = cuts_at_pauses(&pauses, count).with_context(|| {
                format!(
                    "This file has {} clear pauses, but voice.md has {count} paragraphs. Leave a pause of about a second between paragraphs, or record paragraph by paragraph",
                    pauses.len()
                )
            })?;
            let weights: Vec<f64> = doc
                .paragraphs
                .iter()
                .map(|p| text_weight(&doc, p))
                .collect();
            let spoken = pieces(&cuts, raw.len())
                .map(|(a, b)| spoken_seconds(&raw[a..b], rate))
                .collect::<Vec<_>>();
            plausible(&spoken, &weights)?;
            cuts
        }
    };
    let mut cleaned = Vec::new();
    for ((a, b), paragraph) in pieces(&cuts, raw.len()).zip(&doc.paragraphs) {
        cleaned.push(
            clean(&raw[a..b], rate, false)
                .with_context(|| format!("Paragraph {} of the file", paragraph.number))?,
        );
    }
    State::update(root, |state| {
        for (paragraph, cleaned) in doc.paragraphs.iter().zip(&cleaned) {
            let take = keep(
                root,
                &take_file(paragraph.number, false),
                &paragraph.text,
                cleaned,
            )?;
            let entry = state.paragraphs.entry(paragraph.number).or_default();
            if let Some(draft) = entry.draft.take() {
                let _ = fs::remove_file(root.join(draft.file));
            }
            entry.accepted = Some(take);
        }
        Ok(())
    })
}

fn text_weight(doc: &VoiceDoc, paragraph: &Paragraph) -> f64 {
    align::reference(&paragraph.text, doc.syntax())
        .iter()
        .map(|token| weight(&token.surface))
        .sum()
}

fn spoken_seconds(samples: &[f32], rate: u32) -> f64 {
    let analysis = tighten::Analysis::new(samples, rate);
    let Some((a, b)) = analysis.speech() else {
        return 0.0;
    };
    let silent: usize = analysis
        .pauses((WORD_GAP * f64::from(rate)) as usize)
        .iter()
        .map(|(a, b)| b - a)
        .sum();
    (b - a - silent) as f64 / f64::from(rate)
}

/// The sample ranges between the cuts.
fn pieces(cuts: &[usize], length: usize) -> impl Iterator<Item = (usize, usize)> + '_ {
    let starts = std::iter::once(0).chain(cuts.iter().copied());
    let ends = cuts.iter().copied().chain(std::iter::once(length));
    starts.zip(ends)
}

/// Cuts in the middle of the `count − 1` longest pauses, in order. None when the recording
/// has fewer pauses than that.
fn cuts_at_pauses(pauses: &[(usize, usize)], count: usize) -> Option<Vec<usize>> {
    let needed = count.checked_sub(1)?;
    if pauses.len() < needed {
        return None;
    }
    let mut longest = pauses.to_vec();
    longest.sort_by_key(|(a, b)| std::cmp::Reverse(b - a));
    let mut cuts: Vec<usize> = longest[..needed].iter().map(|(a, b)| (a + b) / 2).collect();
    cuts.sort_unstable();
    Some(cuts)
}

/// A split is plausible when every paragraph is spoken at roughly the pace of the whole: a
/// cut inside a paragraph makes one piece far too fast for its text and its neighbour too slow.
fn plausible(spoken: &[f64], weights: &[f64]) -> Result<()> {
    let overall = spoken.iter().sum::<f64>() / weights.iter().sum::<f64>().max(1e-9);
    for (index, (seconds, weight)) in spoken.iter().zip(weights).enumerate() {
        let pace = seconds / weight.max(1e-9) / overall.max(1e-9);
        // Short paragraphs vary more: three words can be said in one breath or three.
        let reach = if *weight < 12.0 { 3.0 } else { 1.8 };
        if !(1.0 / reach..=reach).contains(&pace) {
            bail!(
                "The pauses of this file do not fit the paragraphs of voice.md: paragraph {} would be spoken {} than the rest. Record paragraph by paragraph, or add an API key so the words can be measured",
                index + 1,
                if pace < 1.0 {
                    format!("{:.1} times faster", 1.0 / pace)
                } else {
                    format!("{pace:.1} times slower")
                }
            );
        }
    }
    Ok(())
}

/// Cuts between the last heard word of one paragraph and the first of the next: in the
/// middle of the longest pause there, else halfway.
fn cuts_from_transcript(
    doc: &VoiceDoc,
    transcript: &Transcript,
    analysis: &tighten::Analysis,
    rate: u32,
) -> Result<Vec<usize>> {
    let mut reference = Vec::new();
    let mut last_of = Vec::new();
    for paragraph in &doc.paragraphs {
        let words = align::reference(&paragraph.text, doc.syntax());
        ensure!(
            !words.is_empty(),
            "Paragraph {} of voice.md has no words to speak",
            paragraph.number
        );
        reference.extend(words);
        last_of.push(reference.len());
    }
    let heard = align::hypothesis(&transcript.words, &doc.language);
    let alignment = align::align(&reference, &heard);
    ensure!(
        alignment.wer() < 0.5,
        "This file does not say the text of voice.md (more than half the words differ). Check that it is the right file"
    );
    let times = align::fill(&align::times(&reference, &heard, &alignment));
    let per_second = f64::from(rate);
    let pauses = analysis.pauses((0.1 * per_second) as usize);
    let mut cuts = Vec::new();
    for &index in &last_of[..last_of.len() - 1] {
        let (from, to) = (times[index - 1].1, times[index].0);
        let (lo, hi) = (
            ((from - 0.3).max(0.0) * per_second) as usize,
            ((to + 0.3) * per_second) as usize,
        );
        let cut = pauses
            .iter()
            .filter(|(a, b)| *b > lo && *a < hi)
            .max_by_key(|(a, b)| b - a)
            .map(|(a, b)| (a + b) / 2)
            .unwrap_or(((from + to) / 2.0 * per_second) as usize);
        cuts.push(cut.max(cuts.last().copied().unwrap_or(0)));
    }
    Ok(cuts)
}

/// How a paragraph stands: `empty`, `draft` (recorded, not yet accepted), `accepted`, or
/// `stale` when its text changed after the recording.
fn state_of(entry: Option<&Entry>, text: &str) -> &'static str {
    match entry {
        Some(Entry {
            accepted: Some(take),
            ..
        }) if take.text == text => "accepted",
        // A draft for a text that changed since is of no use.
        Some(Entry {
            draft: Some(take), ..
        }) if take.text == text => "draft",
        Some(Entry {
            accepted: Some(_), ..
        }) => "stale",
        _ => "empty",
    }
}

/// Everything the recording view and `voice own` show: every paragraph with its recordings,
/// and how the word times will be found.
pub fn status(root: &Path) -> Result<Value> {
    status_with(root, None)
}

/// `status`, told whether a key measures the word times; asked of the keys when `None`. A
/// loop that waits for the user knows it from its first round and reads no keys after that.
pub fn status_with(root: &Path, measured: Option<bool>) -> Result<Value> {
    let doc = &read_doc(root)?;
    let state = State::load(root);
    let paragraphs: Vec<Value> = doc
        .paragraphs
        .iter()
        .map(|p| {
            let entry = state.paragraphs.get(&p.number);
            let draft = entry
                .and_then(|e| e.draft.as_ref())
                .filter(|take| take.text == p.text);
            json!({
                "paragraph": p.number,
                "scene": p.scene,
                "text": p.text,
                "state": state_of(entry, &p.text),
                "accepted": entry.and_then(|e| e.accepted.as_ref()).filter(|take| take.text == p.text),
                "draft": draft,
            })
        })
        .collect();
    let recorded = paragraphs
        .iter()
        .filter(|p| p["state"] == "accepted")
        .count();
    let measured = match measured {
        Some(measured) => measured,
        None => transcriber(root, doc)?.is_some(),
    };
    Ok(json!({
        "source": doc.source,
        "paragraphs": paragraphs,
        "recorded": recorded,
        "total": paragraphs.len(),
        "complete": recorded == paragraphs.len() && recorded > 0,
        // Measured word times need a transcription model, which hears the recordings.
        "timing": if measured { "measured" } else { "estimated" },
        "transcription": measured.then(|| doc.transcription.clone()),
    }))
}

/// The accepted recording of every paragraph, or which ones are missing.
pub(super) fn accepted(root: &Path, doc: &VoiceDoc) -> Result<Vec<Take>> {
    let state = State::load(root);
    let mut takes = Vec::new();
    let mut missing = Vec::new();
    for paragraph in &doc.paragraphs {
        match state
            .paragraphs
            .get(&paragraph.number)
            .and_then(|e| e.accepted.clone())
            .filter(|take| take.text == paragraph.text && root.join(&take.file).is_file())
        {
            Some(take) => takes.push(take),
            None => missing.push(paragraph.number),
        }
    }
    ensure!(
        missing.is_empty(),
        "Paragraphs {missing:?} have no accepted recording of their current text; run `superint-video voice own --wait` and let the user record them"
    );
    Ok(takes)
}

/// The transcript of an accepted recording, when a key reaches the transcription model. A
/// transcript written after the recording is used again: each costs a request of a daily quota.
pub(super) async fn transcript(
    root: &Path,
    doc: &VoiceDoc,
    generators: &Generators,
    take: &Take,
) -> Result<Transcript> {
    let audio = root.join(&take.file);
    let saved = audio.with_extension("json");
    let modified = |path: &Path| fs::metadata(path).and_then(|m| m.modified()).ok();
    if modified(&saved) >= modified(&audio)
        && let Some(transcript) = fs::read(&saved)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
    {
        return Ok(transcript);
    }
    let (transcript, _) = generators
        .transcribe_first(&audio, &doc.transcribers())
        .await?;
    atomic_write(&saved, &serde_json::to_vec_pretty(&transcript)?)?;
    Ok(transcript)
}

const VOWELS: &str = "aeiouyäöüáàâãåæéèêëíìîïóòôõøœúùûýÿ";

/// How long a word takes to say, in rough syllables: its vowel groups, a little for every
/// letter, and two per digit. Scripts without Latin vowels count their characters.
fn weight(word: &str) -> f64 {
    let lower = word.to_lowercase();
    let letters: Vec<char> = lower.chars().filter(|c| c.is_alphanumeric()).collect();
    if letters.is_empty() {
        return 0.5;
    }
    let digits = letters.iter().filter(|c| c.is_ascii_digit()).count();
    let mut groups = 0;
    let mut inside = false;
    for c in &letters {
        let vowel = VOWELS.contains(*c);
        if vowel && !inside {
            groups += 1;
        }
        inside = vowel;
    }
    if groups == 0 && digits == 0 {
        return (letters.len() as f64 * 0.6).max(1.0);
    }
    groups.max(1) as f64 + 0.12 * letters.len() as f64 + 2.0 * digits as f64
}

/// How much a pause likes to sit after this word, in syllables: people breathe at full stops
/// and commas, not in the middle of a clause.
fn stop_after(token: &align::RefToken) -> f64 {
    if token.sentence_end {
        2.5
    } else if token
        .surface
        .trim_end_matches(['"', '”', '“', '»', '«', ')'])
        .ends_with([',', ';', ':', '–', '—'])
    {
        1.2
    } else {
        0.0
    }
}

/// Word times inside one recording that nothing measured: the words share the spoken time by
/// their syllables, and every pause in the audio sits between two words, at the word boundary
/// nearest to it (a boundary at a full stop or comma is preferred). Seconds within the take.
pub(super) fn estimate(
    tokens: &[align::RefToken],
    analysis: &tighten::Analysis,
    rate: u32,
) -> Vec<(f64, f64)> {
    let per_second = f64::from(rate);
    let seconds = |(a, b): (usize, usize)| (a as f64 / per_second, b as f64 / per_second);
    let Some(speech) = analysis.speech().map(seconds) else {
        return vec![(0.0, 0.0); tokens.len()];
    };
    let pauses: Vec<(f64, f64)> = analysis
        .pauses((WORD_GAP * per_second) as usize)
        .into_iter()
        .map(seconds)
        .collect();
    let weights: Vec<f64> = tokens.iter().map(|t| weight(&t.surface)).collect();
    let stops: Vec<f64> = tokens.iter().map(stop_after).collect();
    spread(&weights, &stops, speech, &pauses)
}

/// See `estimate`. `stops[i]` is how much a pause likes to sit after word `i`.
fn spread(
    weights: &[f64],
    stops: &[f64],
    speech: (f64, f64),
    pauses: &[(f64, f64)],
) -> Vec<(f64, f64)> {
    let count = weights.len();
    if count == 0 {
        return Vec::new();
    }
    // More pauses than gaps between words: the shortest are hesitations inside a word.
    let mut kept = pauses.to_vec();
    if kept.len() > count - 1 {
        kept.sort_by(|a, b| (b.1 - b.0).total_cmp(&(a.1 - a.0)));
        kept.truncate(count - 1);
        kept.sort_by(|a, b| a.0.total_cmp(&b.0));
    }
    let silent: f64 = kept.iter().map(|(a, b)| b - a).sum();
    let voiced = (speech.1 - speech.0 - silent).max(1e-6);
    let total: f64 = weights.iter().sum::<f64>().max(1e-9);
    let mut before = vec![0.0; count + 1];
    for (index, weight) in weights.iter().enumerate() {
        before[index + 1] = before[index] + weight;
    }
    // The word each pause comes after.
    let mut boundaries = Vec::with_capacity(kept.len());
    let mut passed = 0.0;
    let mut least = 1;
    for (index, pause) in kept.iter().enumerate() {
        let wanted = (pause.0 - speech.0 - passed) / voiced * total;
        passed += pause.1 - pause.0;
        let most = count - (kept.len() - index);
        let boundary = (least..=most)
            .min_by(|&a, &b| {
                let cost = |j: usize| (before[j] - wanted).abs() - stops[j - 1];
                cost(a).total_cmp(&cost(b))
            })
            .unwrap_or(least);
        boundaries.push(boundary);
        least = boundary + 1;
    }
    // Between two pauses the words share the stretch by weight.
    let mut out = Vec::with_capacity(count);
    let starts = std::iter::once(speech.0).chain(kept.iter().map(|p| p.1));
    let ends = kept.iter().map(|p| p.0).chain(std::iter::once(speech.1));
    let firsts = std::iter::once(0).chain(boundaries.iter().copied());
    let lasts = boundaries.iter().copied().chain(std::iter::once(count));
    for (((from, to), first), last) in starts.zip(ends).zip(firsts).zip(lasts) {
        let share = (before[last] - before[first]).max(1e-9);
        for word in first..last {
            let a = from + (to - from) * (before[word] - before[first]) / share;
            let b = from + (to - from) * (before[word + 1] - before[first]) / share;
            out.push((a, b));
        }
    }
    out
}

const OVER_DRAFT: &str = "audio/own/over.draft.wav";

/// A kept take's file: new for every take, even one from the same frame, because an undo in
/// Studio brings back the clip of an earlier take, and it must still play that take.
fn kept_over_file(root: &Path, start_frame: u64) -> String {
    (1..)
        .map(|n| match n {
            1 => format!("{DIR}/over-{start_frame:06}.wav"),
            n => format!("{DIR}/over-{start_frame:06}-{n}.wav"),
        })
        .find(|file| !root.join(file).exists())
        .unwrap_or_default()
}

/// A take spoken over the picture, cleaned without touching its start: its first sample
/// belongs to `start_frame`. It waits as a draft until the user keeps it.
pub async fn over_record(root: &Path, start_frame: u64, bytes: &[u8]) -> Result<Over> {
    let cleaned = clean(&decode(bytes).await?, audio::RATE, true)?;
    State::update(root, |state| {
        let take = keep(root, OVER_DRAFT, "", &cleaned)?;
        let over = Over { start_frame, take };
        state.over = Some(over.clone());
        Ok(over)
    })
}

/// The draft spoken over the picture, if there is one.
pub fn over_draft(root: &Path) -> Option<Over> {
    State::load(root)
        .over
        .filter(|over| root.join(&over.take.file).is_file())
}

/// The draft becomes a file of its own, ready to be placed on the voice track.
pub fn over_keep(root: &Path) -> Result<Over> {
    State::update(root, |state| {
        let mut over = state.over.take().context("There is no recording to keep")?;
        let file = kept_over_file(root, over.start_frame);
        fs::rename(root.join(&over.take.file), root.join(&file))
            .with_context(|| format!("Keeping {}", over.take.file))?;
        over.take.file = file;
        Ok(over)
    })
}

pub fn over_discard(root: &Path) -> Result<()> {
    State::update(root, |state| {
        if let Some(over) = state.over.take() {
            let _ = fs::remove_file(root.join(over.take.file));
        }
        Ok(())
    })
}

/// The track the voice sits on, as the mix knows it.
const VOICE_TRACK: &str = "voice";

/// The paragraphs of the script as cues for someone speaking over the picture: each with the
/// second of the film it begins at, where a placed narration with word times says so.
pub fn cues(root: &Path, manifest: &Manifest) -> Vec<Value> {
    let Ok(doc) = read_doc(root) else {
        return Vec::new();
    };
    let words: Vec<Value> = fs::read(root.join("audio/words.json"))
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default();
    let narration: Vec<_> = manifest
        .clips
        .iter()
        .filter(|clip| clip.src == "audio/voice.wav" && !clip.hidden)
        .collect();
    doc.paragraphs
        .iter()
        .map(|paragraph| {
            let spoken = words
                .iter()
                .find(|word| word["paragraph"] == paragraph.number)
                .and_then(|word| word["start"].as_f64());
            let seconds = spoken.and_then(|at| {
                narration.iter().find_map(|clip| {
                    let offset = manifest.fps.seconds(clip.source_offset_frames);
                    let length = manifest.fps.seconds(clip.duration_frames);
                    (at >= offset && at < offset + length)
                        .then(|| round(manifest.fps.seconds(clip.start_frame) + at - offset, 2))
                })
            });
            json!({"paragraph": paragraph.number, "text": paragraph.text, "seconds": seconds})
        })
        .collect()
}

/// The edit that makes a kept take the voice from its frame on: what the voice track held
/// from there is cut away, and the take is placed. One step, so one undo brings it back.
pub fn over_operations(manifest: &Manifest, over: &Over) -> Result<Vec<Value>> {
    let start = over.start_frame;
    ensure!(
        start < manifest.duration_frames,
        "The recording starts after the end of the film"
    );
    let fps = f64::from(manifest.fps.num) / f64::from(manifest.fps.den.max(1));
    let frames =
        ((over.take.seconds * fps).floor() as u64).clamp(1, manifest.duration_frames - start);
    let mut operations = Vec::new();
    match manifest.tracks.iter().find(|t| t.id == VOICE_TRACK) {
        Some(track) => ensure!(
            track.kind == TrackKind::Audio,
            "The track `voice` is not an audio track"
        ),
        None => operations.push(json!({
            "type": "addTrack",
            "track": {"id": VOICE_TRACK, "name": "Voice", "kind": "audio"},
        })),
    }
    for clip in manifest.clips.iter().filter(|c| c.track == VOICE_TRACK) {
        if clip.start_frame >= start {
            operations.push(json!({"type": "deleteClip", "id": clip.id}));
        } else if clip.end_frame() > start {
            let kept = start - clip.start_frame;
            operations.push(json!({
                "type": "updateClip",
                "id": clip.id,
                "changes": {
                    "durationFrames": kept,
                    "fadeInFrames": clip.fade_in_frames.min(kept),
                    "fadeOutFrames": clip.fade_out_frames.min(kept),
                },
            }));
        }
    }
    operations.push(json!({
        "type": "addClip",
        "clip": {
            "id": format!("voice-over-{start}"),
            "type": "audio",
            "src": over.take.file,
            "track": VOICE_TRACK,
            "startFrame": start,
            "durationFrames": frames,
        },
    }));
    Ok(operations)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::voice::{Defaults, Source};

    #[test]
    fn a_kept_take_becomes_the_voice_from_its_frame() {
        let manifest: Manifest = serde_json::from_value(json!({
            "version":1,"width":2,"height":2,"fps":{"num":30,"den":1},"durationFrames":300,
            "tracks":[{"id":"main","kind":"visual"},{"id":"voice","kind":"audio"}],
            "clips":[
                {"id":"early","type":"audio","src":"audio/voice.wav","track":"voice","startFrame":0,"durationFrames":120,"fadeOutFrames":60},
                {"id":"late","type":"audio","src":"audio/b.wav","track":"voice","startFrame":150,"durationFrames":60}
            ]
        }))
        .unwrap();
        let over = Over {
            start_frame: 90,
            take: Take {
                file: "audio/own/over-000090.wav".into(),
                text: String::new(),
                seconds: 20.0,
                peak_db: -3.0,
                gain_db: 0.0,
                notes: Vec::new(),
            },
        };
        let operations = over_operations(&manifest, &over).unwrap();
        let mut edited = manifest.clone();
        for operation in &operations {
            edited = edited.apply_operation(operation).unwrap();
        }
        let ids: Vec<&str> = edited.clips.iter().map(|c| c.id.as_str()).collect();
        assert_eq!(ids, ["early", "voice-over-90"]);
        assert_eq!(edited.clips[0].duration_frames, 90);
        assert_eq!(edited.clips[0].fade_out_frames, 60);
        // Twenty seconds do not fit after frame 90 of a ten-second film.
        assert_eq!(edited.clips[1].duration_frames, 210);

        // A film that never had a voice gets the track.
        let mut bare = manifest.clone();
        bare.tracks.pop();
        bare.clips.clear();
        let operations = over_operations(&bare, &over).unwrap();
        assert_eq!(operations[0]["type"], "addTrack");
        let late = Over {
            start_frame: 300,
            ..over
        };
        assert!(over_operations(&bare, &late).is_err());
    }

    const RATE: u32 = 1000;

    /// `pattern` in 10 ms steps: '#' tone, '.' silence, '-' a quiet room.
    fn sound(pattern: &str, level: f32) -> Vec<f32> {
        pattern
            .chars()
            .flat_map(|c| {
                (0..10).map(move |i| {
                    let sign = if i % 2 == 0 { 1.0 } else { -1.0 };
                    match c {
                        '#' => level * sign,
                        '-' => 0.004 * sign,
                        _ => 0.0,
                    }
                })
            })
            .collect()
    }

    fn close(times: &[(f64, f64)], expected: &[(f64, f64)]) {
        assert_eq!(times.len(), expected.len());
        for (got, want) in times.iter().zip(expected) {
            assert!(
                (got.0 - want.0).abs() < 1e-6 && (got.1 - want.1).abs() < 1e-6,
                "{times:?} is not {expected:?}"
            );
        }
    }

    #[test]
    fn words_share_the_spoken_time_by_weight() {
        let times = spread(&[1.0, 3.0], &[0.0, 0.0], (1.0, 5.0), &[]);
        close(&times, &[(1.0, 2.0), (2.0, 5.0)]);
        assert!(spread(&[], &[], (0.0, 1.0), &[]).is_empty());
    }

    #[test]
    fn a_pause_sits_between_two_words() {
        // Four equal words, four seconds of speech, one second of silence after the first.
        let times = spread(&[1.0; 4], &[0.0; 4], (0.0, 5.0), &[(1.0, 2.0)]);
        close(&times, &[(0.0, 1.0), (2.0, 3.0), (3.0, 4.0), (4.0, 5.0)]);
        // No word runs through the pause, also when the pause falls inside a word by weight.
        let times = spread(&[1.0; 4], &[0.0; 4], (0.0, 5.0), &[(1.4, 2.4)]);
        assert_eq!(times[0], (0.0, 1.4));
        assert_eq!(times[1].0, 2.4);
    }

    #[test]
    fn a_pause_prefers_the_full_stop() {
        // The pause is nearer the gap after word 2, but word 3 ends the sentence.
        let stops = [0.0, 0.0, 2.5, 0.0, 0.0, 0.0];
        let times = spread(&[1.0; 6], &stops, (0.0, 7.0), &[(2.4, 3.4)]);
        assert_eq!(times[2].1, 2.4);
        assert_eq!(times[3].0, 3.4);
    }

    #[test]
    fn more_pauses_than_gaps_keeps_the_longest() {
        let times = spread(
            &[1.0, 1.0],
            &[0.0, 0.0],
            (0.0, 4.0),
            &[(0.5, 0.7), (1.5, 2.5)],
        );
        close(&times, &[(0.0, 1.5), (2.5, 4.0)]);
    }

    #[test]
    fn weights_follow_syllables() {
        assert!(weight("Geschwindigkeit") > 2.0 * weight("Zeit"));
        assert!(weight("2026") > weight("zwei"));
        assert!(weight("日本語") >= 1.0);
        assert_eq!(weight("—"), 0.5);
    }

    #[test]
    fn estimate_puts_the_sentence_break_on_the_pause() {
        let samples = sound("..########....................############..", 0.3);
        let analysis = tighten::Analysis::new(&samples, RATE);
        let tokens = align::reference("Eins zwei. Drei vier fünf.", align::Syntax::Gemini);
        let times = estimate(&tokens, &analysis, RATE);
        assert_eq!(times.len(), 5);
        assert!((times[0].0 - 0.02).abs() < 0.011);
        assert!((times[1].1 - 0.10).abs() < 0.011, "{times:?}");
        assert!((times[2].0 - 0.30).abs() < 0.011, "{times:?}");
        assert!((times[4].1 - 0.42).abs() < 0.011);
    }

    #[test]
    fn a_long_file_is_cut_at_its_longest_pauses() {
        let pauses = [(100, 150), (300, 700), (900, 960), (1200, 1900)];
        assert_eq!(cuts_at_pauses(&pauses, 3), Some(vec![500, 1550]));
        assert_eq!(cuts_at_pauses(&pauses, 1), Some(vec![]));
        assert_eq!(cuts_at_pauses(&pauses, 6), None);
        assert_eq!(
            pieces(&[500, 1550], 2000).collect::<Vec<_>>(),
            [(0, 500), (500, 1550), (1550, 2000)]
        );
    }

    #[test]
    fn a_split_against_the_text_is_refused() {
        assert!(plausible(&[10.0, 12.0, 9.0], &[40.0, 44.0, 38.0]).is_ok());
        // A cut inside the first paragraph: its first half is far too short for its text.
        let error = plausible(&[2.0, 18.0, 9.0], &[40.0, 44.0, 38.0]).unwrap_err();
        assert!(error.to_string().contains("paragraph 1"), "{error}");
        assert!(error.to_string().contains("faster"));
        // Short paragraphs are given more room.
        assert!(plausible(&[1.0, 10.0], &[6.0, 30.0]).is_ok());
    }

    #[test]
    fn cleaning_trims_levels_and_notes() {
        let raw = sound(
            &format!("{}{}{}", ".".repeat(100), "#".repeat(100), ".".repeat(100)),
            0.02,
        );
        let cleaned = clean(&raw, RATE, false).unwrap();
        // 0.2 s before the speech, 0.3 s after it.
        assert_eq!(cleaned.samples.len(), 200 + 1000 + 300);
        assert!(cleaned.gain_db > 10.0);
        let level = tighten::Analysis::new(&cleaned.samples, RATE).active_rms();
        assert!((audio::db(level) - TARGET_DB).abs() < 0.5);
        assert!(cleaned.notes.is_empty());
        // A take over the picture keeps its start, so it stays on its frame.
        assert_eq!(
            clean(&raw, RATE, true).unwrap().samples.len(),
            1000 + 1000 + 300
        );

        let loud = sound(&"#".repeat(100), 1.0);
        let cleaned = clean(&loud, RATE, false).unwrap();
        assert_eq!(cleaned.notes, ["clipped"]);
        assert!(cleaned.peak_db <= CEILING_DB + 0.01);

        let room = sound(&format!("{}{}", "-".repeat(100), "#".repeat(100)), 0.02);
        assert_eq!(clean(&room, RATE, false).unwrap().notes, ["noisy"]);
        let silence = sound(&".".repeat(200), 0.0);
        assert!(clean(&silence, RATE, false).is_err());
    }

    fn doc(text: &str) -> VoiceDoc {
        VoiceDoc::parse(text, &Defaults::builtin()).unwrap()
    }

    #[test]
    fn a_recording_counts_only_for_the_text_it_was_spoken_for() {
        let take = |text: &str| Take {
            file: String::new(),
            text: text.into(),
            seconds: 1.0,
            peak_db: -3.0,
            gain_db: 0.0,
            notes: Vec::new(),
        };
        let accepted = Entry {
            accepted: Some(take("Hallo.")),
            draft: None,
        };
        assert_eq!(state_of(Some(&accepted), "Hallo."), "accepted");
        assert_eq!(state_of(Some(&accepted), "Hallo, Welt."), "stale");
        let redo = Entry {
            accepted: Some(take("Alt.")),
            draft: Some(take("Neu.")),
        };
        assert_eq!(state_of(Some(&redo), "Neu."), "draft");
        assert_eq!(state_of(None, "Hallo."), "empty");
        assert_eq!(doc("---\nsource: own\n---\nHallo.").source, Source::Own);
        assert_eq!(doc("Hallo.").source, Source::Ai);
    }

    #[test]
    fn accepting_and_discarding_moves_the_files() {
        let folder = tempfile::tempdir().unwrap();
        let root = folder.path();
        fs::create_dir_all(root.join(DIR)).unwrap();
        fs::write(
            root.join("voice.md"),
            "---\nsource: own\n---\nEins.\n\nZwei.\n",
        )
        .unwrap();
        let cleaned = Cleaned {
            samples: vec![0.1; 480],
            peak_db: -20.0,
            gain_db: 0.0,
            notes: Vec::new(),
        };
        let mut state = State::default();
        state.paragraphs.entry(1).or_default().draft =
            Some(keep(root, &take_file(1, true), "Eins.", &cleaned).unwrap());
        state.save(root).unwrap();
        assert!(audio_file(root, 1, true).unwrap().is_file());
        assert!(audio_file(root, 1, false).is_none());
        let doc = doc(&fs::read_to_string(root.join("voice.md")).unwrap());
        assert!(accepted(root, &doc).is_err());

        accept(root, 1).unwrap();
        assert!(!root.join(take_file(1, true)).exists());
        assert!(audio_file(root, 1, false).unwrap().is_file());
        assert!(accept(root, 1).is_err(), "nothing new to accept");
        let error = accepted(root, &doc).unwrap_err().to_string();
        assert!(error.contains("[2]"), "{error}");

        // A new draft thrown away leaves the accepted recording alone.
        let mut state = State::load(root);
        state.paragraphs.entry(1).or_default().draft =
            Some(keep(root, &take_file(1, true), "Eins.", &cleaned).unwrap());
        state.save(root).unwrap();
        discard(root, 1).unwrap();
        assert!(!root.join(take_file(1, true)).exists());
        assert!(audio_file(root, 1, true).is_none());
        assert!(audio_file(root, 1, false).unwrap().is_file());

        // A draft spoken for a text that changed since is neither shown nor accepted.
        let mut state = State::load(root);
        state.paragraphs.entry(2).or_default().draft =
            Some(keep(root, &take_file(2, true), "Old words.", &cleaned).unwrap());
        state.save(root).unwrap();
        assert_eq!(
            state_of(State::load(root).paragraphs.get(&2), "New words."),
            "empty"
        );
        assert!(accept(root, 2).is_err());
    }

    #[test]
    fn every_kept_take_over_the_picture_has_a_file_of_its_own() {
        let folder = tempfile::tempdir().unwrap();
        let root = folder.path();
        fs::create_dir_all(root.join(DIR)).unwrap();
        let first = kept_over_file(root, 90);
        assert_eq!(first, "audio/own/over-000090.wav");
        fs::write(root.join(&first), b"").unwrap();
        assert_eq!(kept_over_file(root, 90), "audio/own/over-000090-2.wav");
    }
}
