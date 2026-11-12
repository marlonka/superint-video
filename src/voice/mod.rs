//! Narration. Claude writes `voice.md`; the tool checks it against the rules, sends each
//! paragraph unchanged to the TTS model, measures every take, and cuts the chosen takes into
//! `audio/voice.wav` with word timings in `audio/words.json`.
pub mod align;
pub mod check;
pub mod tighten;

use crate::{
    audio::{self, round},
    env::Keys,
    frontmatter,
    model::Manifest,
    preset::{self, PresetConfig},
    project::{atomic_write, display_path},
    providers::{
        self, AI_STUDIO, Generators, OPENROUTER, Provider, SpeechRequest, TranscribeRequest,
        Transcript,
    },
};
use align::Syntax;
use anyhow::{Context, Result, bail, ensure};
use check::Level;
use futures::{StreamExt, stream};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

pub const FILE: &str = "voice.md";
/// How far from a pause edge a transcribed word edge may be to snap onto it.
const SNAP_REACH: f64 = 0.12;
/// Take and final word starts further apart than one 0.1 s transcriber step plus a frame.
const OUTLIER_SECONDS: f64 = 0.134;
const TAKES_DIR: &str = "audio/takes";
const REPORT: &str = "audio/takes/report.json";
const KEYS: &[&str] = &[
    "model",
    "voice",
    "style",
    "language",
    "terms",
    "takes",
    "sentencePause",
    "paragraphPause",
    "tighten",
    "transcription",
    "transcriptionFallback",
];

/// Values `voice.md` falls back to: the models the user chose in Setup, the project's preset
/// and brief, then the AI Studio route.
#[derive(Debug, Clone)]
pub struct Defaults {
    pub model: String,
    pub voice: String,
    pub transcription: String,
    pub language: String,
    pub words_per_minute: u32,
}

impl Defaults {
    pub fn builtin() -> Self {
        Self {
            model: AI_STUDIO.speech.into(),
            voice: AI_STUDIO.voice.into(),
            transcription: AI_STUDIO.transcription.into(),
            language: "de".into(),
            words_per_minute: 140,
        }
    }

    pub fn for_project(root: &Path) -> Self {
        Self::for_project_with(root, &crate::home::Settings::current())
    }

    /// `for_project` with the user's settings given. A model the user chose in Setup beats the
    /// preset's: the preset names the usual model, the user named one on purpose.
    pub fn for_project_with(root: &Path, settings: &crate::home::Settings) -> Self {
        let mut defaults = Self::builtin();
        let preset = fs::read(root.join(preset::CONFIG))
            .ok()
            .and_then(|bytes| PresetConfig::parse(&bytes).ok());
        if let Some(preset) = &preset {
            if let Some(model) = &preset.narration.model {
                defaults.model = model.clone();
                defaults.voice = route_voice(model).into();
            }
            if let Some(voice) = &preset.narration.voice {
                defaults.voice = voice.clone();
            }
            if let Some(transcription) = &preset.transcription {
                defaults.transcription = transcription.model.clone();
            }
            defaults.language = preset.defaults.language.clone();
        }
        if let Some(model) = &settings.narration_model {
            defaults.model = model.clone();
            defaults.voice = route_voice(model).into();
        }
        if let Some(voice) = &settings.narration_voice {
            defaults.voice = voice.clone();
        }
        if let Some(model) = &settings.transcription_model {
            defaults.transcription = model.clone();
        }
        if let Some(language) = fs::read_to_string(root.join("brief.md"))
            .ok()
            .and_then(|text| {
                frontmatter::split(&text)
                    .values
                    .get("language")
                    .map(|v| frontmatter::string(v))
            })
            .filter(|l| !l.is_empty())
        {
            defaults.language = language;
        }
        if let Some(preset) = &preset {
            defaults.words_per_minute = preset.narration.rate(&defaults.language);
        }
        defaults
    }

    fn voice_for(&self, model: &str) -> String {
        if Provider::of(model) == Provider::of(&self.model) {
            self.voice.clone()
        } else {
            route_voice(model).into()
        }
    }
}

fn route_voice(model: &str) -> &'static str {
    match Provider::of(model) {
        Provider::OpenRouter => OPENROUTER.voice,
        Provider::AiStudio | Provider::GoogleCloud | Provider::OpenAi => AI_STUDIO.voice,
    }
}

#[derive(Debug, Clone)]
pub struct VoiceDoc {
    pub model: String,
    pub voice: String,
    pub style: Option<String>,
    pub language: String,
    pub terms: Vec<String>,
    pub takes: u32,
    pub sentence_pause: f64,
    pub paragraph_pause: f64,
    pub tighten: bool,
    pub transcription: String,
    /// Used when `transcription` fails (a rate limit, say); its cached transcripts count too.
    pub transcription_fallback: Option<String>,
    pub words_per_minute: u32,
    pub paragraphs: Vec<Paragraph>,
    pub unknown_keys: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct Paragraph {
    pub number: usize,
    pub line: usize,
    pub scene: Option<String>,
    /// Exactly what is sent to the TTS model: the paragraph's lines joined with spaces.
    pub text: String,
}

impl VoiceDoc {
    pub fn parse(text: &str, defaults: &Defaults) -> Result<Self> {
        let front = frontmatter::split(text);
        let get = |key: &str| {
            front
                .values
                .get(key)
                .map(|v| frontmatter::string(v))
                .filter(|v| !v.is_empty())
        };
        let seconds = |key: &str, default: f64| -> Result<f64> {
            let value = match get(key) {
                Some(v) => v
                    .trim_end_matches('s')
                    .parse::<f64>()
                    .with_context(|| format!("{key} must be a number of seconds"))?,
                None => default,
            };
            ensure!(
                (0.05..=3.0).contains(&value),
                "{key} must be between 0.05 and 3 seconds"
            );
            Ok(value)
        };
        let model = get("model").unwrap_or_else(|| defaults.model.clone());
        let takes = match get("takes") {
            Some(v) => v.parse().context("takes must be a whole number")?,
            None => 3,
        };
        ensure!((1..=5).contains(&takes), "takes must be between 1 and 5");
        let tighten = match get("tighten").as_deref() {
            None | Some("true" | "yes") => true,
            Some("false" | "no") => false,
            Some(other) => bail!("tighten must be true or false, not {other}"),
        };
        Ok(Self {
            voice: get("voice").unwrap_or_else(|| defaults.voice_for(&model)),
            style: get("style"),
            language: get("language").unwrap_or_else(|| defaults.language.clone()),
            terms: front
                .values
                .get("terms")
                .map(|v| frontmatter::list(v))
                .unwrap_or_default(),
            takes,
            sentence_pause: seconds("sentencePause", 0.24)?,
            paragraph_pause: seconds("paragraphPause", 0.36)?,
            tighten,
            transcription: get("transcription").unwrap_or_else(|| defaults.transcription.clone()),
            transcription_fallback: get("transcriptionFallback"),
            words_per_minute: defaults.words_per_minute,
            paragraphs: paragraphs(&front.body, front.body_line),
            unknown_keys: front
                .values
                .keys()
                .filter(|k| !KEYS.contains(&k.as_str()))
                .cloned()
                .collect(),
            model,
        })
    }

    pub fn provider(&self) -> Provider {
        Provider::of(&self.model)
    }

    /// The transcription model, then the fallback.
    fn transcribers(&self) -> Vec<TranscribeRequest<'_>> {
        std::iter::once(&self.transcription)
            .chain(&self.transcription_fallback)
            .map(|model| TranscribeRequest {
                model,
                language: Some(&self.language),
                terms: &self.terms,
            })
            .collect()
    }

    /// The tag syntax follows the model, not the route: Gemini TTS through OpenRouter still
    /// reads angle brackets.
    pub fn syntax(&self) -> Syntax {
        match self.provider() {
            Provider::OpenRouter if self.model.contains("gemini") => Syntax::Gemini,
            Provider::OpenRouter => Syntax::ElevenLabs,
            Provider::AiStudio | Provider::GoogleCloud | Provider::OpenAi => Syntax::Gemini,
        }
    }

    fn words(&self) -> usize {
        self.paragraphs
            .iter()
            .map(|p| spoken_words(&align::reference(&p.text, self.syntax())))
            .sum()
    }
}

fn spoken_words(tokens: &[align::RefToken]) -> usize {
    tokens.iter().filter(|t| !t.wildcard).count()
}

/// Removes `<!-- … -->`, keeping the line breaks inside so line numbers stay right.
pub fn strip_comments(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(start) = rest.find("<!--") {
        out.push_str(&rest[..start]);
        match rest[start..].find("-->") {
            Some(end) => {
                out.extend(rest[start..start + end].chars().filter(|&c| c == '\n'));
                rest = &rest[start + end + 3..];
            }
            None => {
                rest = "";
            }
        }
    }
    out.push_str(rest);
    out
}

/// Paragraphs are separated by blank lines; `[[scene:id]]` lines name the scene of what follows;
/// lines starting with `#` are notes.
fn paragraphs(body: &str, first_line: usize) -> Vec<Paragraph> {
    let body = strip_comments(body);
    let mut out: Vec<Paragraph> = Vec::new();
    let mut scene: Option<String> = None;
    let mut lines: Vec<&str> = Vec::new();
    let mut start = first_line;
    let flush = |lines: &mut Vec<&str>, out: &mut Vec<Paragraph>, scene: &Option<String>, start| {
        if !lines.is_empty() {
            out.push(Paragraph {
                number: out.len() + 1,
                line: start,
                scene: scene.clone(),
                text: lines.join(" "),
            });
            lines.clear();
        }
    };
    for (index, raw) in body.lines().enumerate() {
        let line = raw.trim();
        if let Some(id) = line
            .strip_prefix("[[scene:")
            .and_then(|rest| rest.strip_suffix("]]"))
        {
            flush(&mut lines, &mut out, &scene, start);
            scene = Some(id.trim().to_string());
        } else if line.is_empty() {
            flush(&mut lines, &mut out, &scene, start);
        } else if !line.starts_with('#') {
            if lines.is_empty() {
                start = first_line + index;
            }
            lines.push(line);
        }
    }
    flush(&mut lines, &mut out, &scene, start);
    out
}

fn read_doc(root: &Path) -> Result<VoiceDoc> {
    let path = root.join(FILE);
    let text = fs::read_to_string(&path).with_context(|| {
        format!(
            "{} not found. Write the voice text first (rules: skills/superint-video/references/models.md)",
            path.display()
        )
    })?;
    VoiceDoc::parse(&text, &Defaults::for_project(root))
}

fn script(root: &Path, explicit: Option<&Path>) -> Result<Option<(PathBuf, String)>> {
    let path = match explicit {
        Some(path) => path.to_path_buf(),
        None => root.join("script.md"),
    };
    if explicit.is_none() && !path.is_file() {
        return Ok(None);
    }
    let text = fs::read_to_string(&path).with_context(|| format!("Reading {}", path.display()))?;
    Ok(Some((path, text)))
}

/// `voice check`: the rules for the voice text, with an estimate of the read's length.
pub fn check_project(root: &Path, explicit_script: Option<&Path>) -> Result<Value> {
    let doc = read_doc(root)?;
    let script = script(root, explicit_script)?;
    let issues = check::check(&doc, script.as_ref().map(|(_, text)| text.as_str()));
    let errors = issues.iter().filter(|i| i.level == Level::Error).count();
    let words = doc.words();
    let seconds = words as f64 * 60.0 / f64::from(doc.words_per_minute.max(1))
        + doc.paragraph_pause * doc.paragraphs.len().saturating_sub(1) as f64;
    Ok(json!({
        "ok": errors == 0,
        "errors": errors,
        "file": FILE,
        "model": doc.model,
        "provider": doc.provider(),
        "voice": doc.voice,
        "transcription": doc.transcription,
        "language": doc.language,
        "paragraphs": doc.paragraphs.len(),
        "words": words,
        "estimatedSeconds": round(seconds, 1),
        "script": script.map(|(path, _)| path.display().to_string()),
        "issues": issues,
    }))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TakeReport {
    pub take: u32,
    /// The route that really made it: AI Studio models switch to OpenRouter at their limit.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub route: Option<Provider>,
    pub file: String,
    pub transcript: String,
    pub cached: bool,
    pub seconds: f64,
    pub speech_seconds: f64,
    pub words_per_minute: f64,
    pub peak_db: f64,
    pub rms_db: f64,
    pub clipped: usize,
    pub longest_pause: f64,
    pub pauses: Vec<f64>,
    /// Word error rate of the pass with the vocabulary (the timed pass where there is only one).
    pub wer: f64,
    pub wer_timed: f64,
    pub missing_terms: Vec<String>,
    pub differences: Vec<align::Difference>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParagraphReport {
    pub paragraph: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scene: Option<String>,
    pub text: String,
    pub words: usize,
    pub takes: Vec<TakeReport>,
    pub recommended: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TakesReport {
    pub model: String,
    pub voice: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub style: Option<String>,
    pub transcription: String,
    pub language: String,
    pub paragraphs: Vec<ParagraphReport>,
    /// The recommended picks as `paragraph=take` pairs, ready for `voice assemble --pick`.
    pub pick: String,
}

pub struct TakesOptions {
    pub takes: Option<u32>,
    pub paragraphs: Option<Vec<usize>>,
    pub dry_run: bool,
}

/// `voice takes`: generate, transcribe and measure takes per paragraph.
pub async fn takes(root: &Path, options: &TakesOptions) -> Result<Value> {
    let doc = read_doc(root)?;
    let script = script(root, None)?;
    let errors: Vec<String> = check::check(&doc, script.as_ref().map(|(_, t)| t.as_str()))
        .into_iter()
        .filter(|i| i.level == Level::Error)
        .map(|i| match i.paragraph {
            Some(p) => format!("{} paragraph {p}: {}", i.code, i.message),
            None => format!("{}: {}", i.code, i.message),
        })
        .collect();
    if !errors.is_empty() {
        bail!(
            "voice.md breaks {} rule(s); fix the text and run again:\n{}",
            errors.len(),
            errors.join("\n")
        );
    }
    let count = options.takes.unwrap_or(doc.takes);
    ensure!((1..=5).contains(&count), "--takes must be between 1 and 5");
    let selected: Vec<&Paragraph> = match &options.paragraphs {
        Some(numbers) => {
            for &n in numbers {
                ensure!(
                    (1..=doc.paragraphs.len()).contains(&n),
                    "voice.md has no paragraph {n} (1–{})",
                    doc.paragraphs.len()
                );
            }
            doc.paragraphs
                .iter()
                .filter(|p| numbers.contains(&p.number))
                .collect()
        }
        None => doc.paragraphs.iter().collect(),
    };
    let generators = Generators::new(Keys::load(root)?, root.join(".superint/cache"))?;
    if options.dry_run {
        return dry_run(&generators, &doc, &selected, count).await;
    }
    generators.reachable(&doc.model)?;
    generators.reachable(&doc.transcription)?;

    let jobs: Vec<(&Paragraph, u32)> = selected
        .iter()
        .flat_map(|&p| (1..=count).map(move |t| (p, t)))
        .collect();
    let results: Vec<Result<(usize, TakeReport)>> = stream::iter(jobs)
        .map(|(paragraph, take)| {
            let (generators, doc) = (&generators, &doc);
            async move {
                take_job(generators, doc, root, paragraph, take)
                    .await
                    .map(|report| (paragraph.number, report))
                    .with_context(|| format!("Paragraph {} take {take}", paragraph.number))
            }
        })
        .buffer_unordered(3)
        .collect()
        .await;
    // A failed take is reported, not fatal: a paragraph needs one measured take.
    let mut fresh: BTreeMap<usize, Vec<TakeReport>> = BTreeMap::new();
    let mut failed = Vec::new();
    for result in results {
        match result {
            Ok((number, report)) => fresh.entry(number).or_default().push(report),
            Err(error) => failed.push(error),
        }
    }
    if fresh.is_empty()
        && let Some(error) = failed.pop()
    {
        return Err(error);
    }
    let failed: Vec<String> = failed.iter().map(|e| format!("{e:#}")).collect();

    // Keep earlier takes of paragraphs that were not regenerated and have not changed.
    let previous: Option<TakesReport> = fs::read(root.join(REPORT))
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .filter(|r: &TakesReport| {
            // The transcription model only measures a take; changing it keeps the takes.
            r.model == doc.model && r.voice == doc.voice && r.style == doc.style
        });
    let mut paragraphs = Vec::new();
    for paragraph in &doc.paragraphs {
        if let Some(mut takes) = fresh.remove(&paragraph.number) {
            takes.sort_by_key(|t| t.take);
            let reference = align::reference(&paragraph.text, doc.syntax());
            paragraphs.push(ParagraphReport {
                paragraph: paragraph.number,
                scene: paragraph.scene.clone(),
                text: paragraph.text.clone(),
                words: spoken_words(&reference),
                recommended: recommend(&takes, doc.words_per_minute),
                takes,
            });
        } else if let Some(old) = previous.as_ref().and_then(|r| {
            r.paragraphs
                .iter()
                .find(|p| p.paragraph == paragraph.number && p.text == paragraph.text)
        }) {
            paragraphs.push(old.clone());
        }
    }
    let pick = paragraphs
        .iter()
        .map(|p| format!("{}={}", p.paragraph, p.recommended))
        .collect::<Vec<_>>()
        .join(",");
    let report = TakesReport {
        model: doc.model.clone(),
        voice: doc.voice.clone(),
        style: doc.style.clone(),
        transcription: doc.transcription.clone(),
        language: doc.language.clone(),
        paragraphs,
        pick: pick.clone(),
    };
    atomic_write(&root.join(REPORT), &serde_json::to_vec_pretty(&report)?)?;
    let missing: Vec<usize> = doc
        .paragraphs
        .iter()
        .map(|p| p.number)
        .filter(|n| !report.paragraphs.iter().any(|r| r.paragraph == *n))
        .collect();
    Ok(json!({
        "report": REPORT,
        "model": doc.model,
        "voice": doc.voice,
        "transcription": doc.transcription,
        "paragraphs": report.paragraphs.iter().map(|p| json!({
            "paragraph": p.paragraph,
            "recommended": p.recommended,
            "takes": p.takes.iter().map(|t| json!({
                "take": t.take,
                "file": t.file,
                "cached": t.cached,
                "wer": t.wer,
                "werTimed": t.wer_timed,
                "missingTerms": t.missing_terms,
                "speechSeconds": t.speech_seconds,
                "wordsPerMinute": t.words_per_minute,
                "peakDb": t.peak_db,
                "clipped": t.clipped,
                "longestPause": t.longest_pause,
                "differences": t.differences.iter().take(8).collect::<Vec<_>>(),
            })).collect::<Vec<_>>(),
        })).collect::<Vec<_>>(),
        "pick": pick,
        "failedTakes": failed,
        "missingParagraphs": missing,
        "next": if missing.is_empty() {
            "Listen to the recommended takes, then run `superint-video voice assemble --pick <paragraph=take,...>` (or --pick auto)".to_string()
        } else {
            format!("Paragraphs {missing:?} have no takes yet; run `superint-video voice takes --paragraphs ...`")
        },
    }))
}

async fn take_job(
    generators: &Generators,
    doc: &VoiceDoc,
    root: &Path,
    paragraph: &Paragraph,
    take: u32,
) -> Result<TakeReport> {
    let request = SpeechRequest {
        model: &doc.model,
        voice: &doc.voice,
        style: doc.style.as_deref(),
        text: &paragraph.text,
    };
    let generated = generators.speech(&request, take).await?;
    let extension = providers::sniff(&generated.bytes);
    if extension == "bin" {
        bail!("The TTS model returned data that is not audio");
    }
    let name = format!("p{:02}-t{take}", paragraph.number);
    let relative = format!("{TAKES_DIR}/{name}.{extension}");
    let path = root.join(&relative);
    atomic_write(&path, &generated.bytes)?;
    eprintln!(
        "voice: paragraph {} take {take} {}",
        paragraph.number,
        if generated.cached {
            "from cache"
        } else {
            "generated"
        }
    );
    let (transcript, _) = generators
        .transcribe_first(&path, &doc.transcribers())
        .await?;
    let transcript_file = format!("{TAKES_DIR}/{name}.json");
    atomic_write(
        &root.join(&transcript_file),
        &serde_json::to_vec_pretty(&transcript)?,
    )?;
    let samples = audio::decode(&path, audio::RATE).await?;
    Ok(measure(
        doc,
        paragraph,
        take,
        relative,
        transcript_file,
        generated.cached,
        generated.route,
        &samples,
        &transcript,
    ))
}

#[allow(clippy::too_many_arguments)]
fn measure(
    doc: &VoiceDoc,
    paragraph: &Paragraph,
    take: u32,
    file: String,
    transcript_file: String,
    cached: bool,
    route: Provider,
    samples: &[f32],
    transcript: &Transcript,
) -> TakeReport {
    let reference = align::reference(&paragraph.text, doc.syntax());
    let timed = align::hypothesis(&transcript.words, &doc.language);
    let timed_alignment = align::align(&reference, &timed);
    let filled = align::fill(&align::times(&reference, &timed, &timed_alignment));
    let (scored, scored_alignment) = match &transcript.biased {
        Some(text) => {
            let hyp = align::hypothesis_text(text, &doc.language);
            let alignment = align::align(&reference, &hyp);
            (hyp, alignment)
        }
        None => (timed.clone(), timed_alignment.clone()),
    };
    let levels = audio::levels(samples, audio::RATE);
    let analysis = tighten::Analysis::new(samples, audio::RATE);
    let rate = f64::from(audio::RATE);
    let speech_seconds = analysis
        .speech()
        .map(|(a, b)| (b - a) as f64 / rate)
        .unwrap_or(0.0);
    let pauses: Vec<f64> = analysis
        .pauses((0.15 * rate) as usize)
        .iter()
        .map(|(a, b)| round((b - a) as f64 / rate, 2))
        .collect();
    let words = spoken_words(&reference);
    TakeReport {
        route: Some(route),
        take,
        file,
        transcript: transcript_file,
        cached,
        seconds: levels.seconds,
        speech_seconds: round(speech_seconds, 2),
        words_per_minute: if speech_seconds > 0.0 {
            round(words as f64 * 60.0 / speech_seconds, 1)
        } else {
            0.0
        },
        peak_db: levels.peak_db,
        rms_db: levels.rms_db,
        clipped: levels.clipped,
        longest_pause: pauses.iter().copied().fold(0.0, f64::max),
        pauses,
        wer: round(scored_alignment.wer(), 4),
        wer_timed: round(timed_alignment.wer(), 4),
        missing_terms: align::missing_terms(&doc.terms, &reference, &scored),
        differences: align::differences(&reference, &scored, &scored_alignment, &filled),
    }
}

/// Fewest wrong words, then all terms heard, then no clipping, then the pace nearest the preset.
fn recommend(takes: &[TakeReport], words_per_minute: u32) -> u32 {
    takes
        .iter()
        .min_by(|a, b| {
            let key = |t: &TakeReport| {
                (
                    (t.wer * 1000.0).round() as i64,
                    t.missing_terms.len(),
                    t.clipped > 0,
                )
            };
            key(a).cmp(&key(b)).then_with(|| {
                let pace =
                    |t: &TakeReport| (t.words_per_minute - f64::from(words_per_minute)).abs();
                pace(a).total_cmp(&pace(b))
            })
        })
        .map(|t| t.take)
        .unwrap_or(1)
}

async fn dry_run(
    generators: &Generators,
    doc: &VoiceDoc,
    selected: &[&Paragraph],
    count: u32,
) -> Result<Value> {
    let mut requests = 0;
    let mut cached = 0;
    let mut characters = 0;
    let mut words = 0;
    for paragraph in selected {
        let request = SpeechRequest {
            model: &doc.model,
            voice: &doc.voice,
            style: doc.style.as_deref(),
            text: &paragraph.text,
        };
        for take in 1..=count {
            if generators.is_cached(&Generators::speech_key(&request, take)) {
                cached += 1;
            } else {
                requests += 1;
                characters += paragraph.text.chars().count();
                words += spoken_words(&align::reference(&paragraph.text, doc.syntax()));
            }
        }
    }
    let seconds = words as f64 * 60.0 / f64::from(doc.words_per_minute.max(1));
    let passes = if Provider::of(&doc.transcription) == Provider::AiStudio && !doc.terms.is_empty()
    {
        2
    } else {
        1
    };
    let pricing = price(generators, &doc.model, characters).await;
    Ok(json!({
        "dryRun": true,
        "model": doc.model,
        "provider": doc.provider(),
        "voice": doc.voice,
        "transcription": doc.transcription,
        "paragraphs": selected.iter().map(|p| p.number).collect::<Vec<_>>(),
        "takesPerParagraph": count,
        "speechRequests": requests,
        "cachedTakes": cached,
        "characters": characters,
        "estimatedAudioSeconds": round(seconds, 1),
        "transcriptionRequests": requests * passes,
        "keys": generators.keys.status(),
        "pricing": pricing,
    }))
}

/// Live prices from OpenRouter's catalog. AI Studio models are looked up as `google/<id>`
/// for reference; Google's own price list is not available through the API.
async fn price(generators: &Generators, model: &str, characters: usize) -> Value {
    let id = match Provider::of(model) {
        Provider::OpenRouter | Provider::OpenAi => model.to_string(),
        Provider::AiStudio | Provider::GoogleCloud => format!("google/{model}"),
    };
    let Ok(catalog) = providers::openrouter::catalog(generators).await else {
        return json!({"available": false});
    };
    let Some(entry) = catalog.iter().find(|m| m["id"] == id.as_str()) else {
        return json!({"available": false, "lookedUp": id});
    };
    let pricing = &entry["pricing"];
    let per_character = entry["architecture"]["tokenizer"] == "Other"
        && entry["architecture"]["modality"] == "text->speech";
    let estimate = per_character
        .then(|| pricing["prompt"].as_str()?.parse::<f64>().ok())
        .flatten()
        .map(|price| round(price * characters as f64, 4));
    json!({
        "available": true,
        "source": format!("OpenRouter catalog, {id}"),
        "pricing": pricing,
        "estimatedUsd": estimate,
        "estimateBasis": estimate.map(|_| "characters × prompt price"),
    })
}

/// Which take to use per paragraph: `auto`, or `1=2,3=1` on top of the recommendations.
fn picks(report: &TakesReport, pick: &str) -> Result<BTreeMap<usize, u32>> {
    let mut choices: BTreeMap<usize, u32> = report
        .paragraphs
        .iter()
        .map(|p| (p.paragraph, p.recommended))
        .collect();
    if pick.trim() != "auto" {
        for pair in pick.split(',').map(str::trim).filter(|p| !p.is_empty()) {
            let (paragraph, take) = pair
                .split_once('=')
                .with_context(|| format!("--pick expects paragraph=take pairs, got `{pair}`"))?;
            let paragraph: usize = paragraph.trim().parse().context("paragraph number")?;
            let take: u32 = take.trim().parse().context("take number")?;
            let known = report
                .paragraphs
                .iter()
                .find(|p| p.paragraph == paragraph)
                .with_context(|| format!("No takes for paragraph {paragraph}"))?;
            ensure!(
                known.takes.iter().any(|t| t.take == take),
                "Paragraph {paragraph} has no take {take}"
            );
            choices.insert(paragraph, take);
        }
    }
    Ok(choices)
}

fn frames_per_second(root: &Path) -> f64 {
    fs::read(root.join("video.json"))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Manifest>(&bytes).ok())
        .map(|m| f64::from(m.fps.num) / f64::from(m.fps.den.max(1)))
        .unwrap_or(30.0)
}

/// `voice assemble`: cut the chosen takes into `audio/voice.wav` and write `audio/words.json`.
pub async fn assemble(root: &Path, pick: &str, verify: bool) -> Result<Value> {
    let doc = read_doc(root)?;
    let report: TakesReport = serde_json::from_slice(
        &fs::read(root.join(REPORT))
            .context("No takes yet; run `superint-video voice takes` first")?,
    )?;
    ensure!(
        report.model == doc.model && report.voice == doc.voice && report.style == doc.style,
        "Model, voice or style in voice.md changed since the takes; run `voice takes` again"
    );
    let choices = picks(&report, pick)?;
    let syntax = doc.syntax();
    let mut chosen = Vec::new();
    for paragraph in &doc.paragraphs {
        let entry = report
            .paragraphs
            .iter()
            .find(|p| p.paragraph == paragraph.number && p.text == paragraph.text)
            .with_context(|| {
                format!(
                    "Paragraph {} changed since its takes; run `voice takes --paragraphs {}`",
                    paragraph.number, paragraph.number
                )
            })?;
        let number = choices[&paragraph.number];
        let take = entry
            .takes
            .iter()
            .find(|t| t.take == number)
            .context("Missing take")?;
        chosen.push((paragraph, take.clone()));
    }
    let routes: std::collections::BTreeSet<&str> = chosen
        .iter()
        .filter_map(|(_, t)| t.route.map(Provider::label))
        .collect();
    if routes.len() > 1 {
        eprintln!(
            "voice: this film mixes two routes ({}), which can be heard side by side. Listen to the joins; if they stand out, record the few odd paragraphs through the other route",
            routes.iter().copied().collect::<Vec<_>>().join(", ")
        );
    }

    let rate = audio::RATE;
    let mut takes = Vec::new();
    for (_, take) in &chosen {
        takes.push(audio::decode(&root.join(&take.file), rate).await?);
    }
    // Match the speech level of every paragraph to the median, within ±6 dB.
    let levels: Vec<f64> = takes
        .iter()
        .map(|t| tighten::Analysis::new(t, rate).active_rms())
        .collect();
    let mut sorted: Vec<f64> = levels.iter().copied().filter(|l| *l > 0.0).collect();
    sorted.sort_by(f64::total_cmp);
    let target = sorted.get(sorted.len() / 2).copied().unwrap_or(0.1);
    let gains: Vec<f64> = levels
        .iter()
        .map(|&l| {
            if l > 0.0 {
                (target / l).clamp(0.5, 2.0)
            } else {
                1.0
            }
        })
        .collect();
    for (samples, &gain) in takes.iter_mut().zip(&gains) {
        for s in samples.iter_mut() {
            *s *= gain as f32;
        }
    }
    let analyses: Vec<tighten::Analysis> = takes
        .iter()
        .map(|t| tighten::Analysis::new(t, rate))
        .collect();
    let plan = tighten::Plan {
        lead: 0.1,
        tail: 0.4,
        sentence: doc.sentence_pause,
        paragraph: doc.paragraph_pause,
        crossfade: 0.015,
        tighten: doc.tighten,
    };
    let (segments, shortened) = tighten::segments(&analyses, rate, &plan);
    let crossfade = (plan.crossfade * f64::from(rate)).round() as usize;
    let (mut voice, placed) = tighten::render(&takes, &segments, crossfade);
    let peak = voice.iter().fold(0f32, |m, s| m.max(s.abs()));
    let ceiling = 10f32.powf(-1.0 / 20.0);
    if peak > ceiling {
        for s in &mut voice {
            *s *= ceiling / peak;
        }
    }
    let voice_file = root.join("audio/voice.wav");
    audio::write_wav(&voice_file, &voice, rate)?;

    // Word times from each take, moved to where the take landed in voice.wav.
    let mut tokens = Vec::new();
    let mut from_takes: Vec<Option<(f64, f64)>> = Vec::new();
    for (index, (paragraph, take)) in chosen.iter().enumerate() {
        let transcript: Transcript =
            serde_json::from_slice(&fs::read(root.join(&take.transcript))?)
                .with_context(|| format!("Reading {}", take.transcript))?;
        let reference = align::reference(&paragraph.text, syntax);
        let hyp = align::hypothesis(&transcript.words, &doc.language);
        let alignment = align::align(&reference, &hyp);
        for time in align::times(&reference, &hyp, &alignment) {
            from_takes.push(time.map(|(start, end)| {
                (
                    tighten::remap(&placed, index, start, rate),
                    tighten::remap(&placed, index, end, rate),
                )
            }));
        }
        tokens.extend(
            reference
                .into_iter()
                .map(|t| (t, paragraph.number, paragraph.scene.clone())),
        );
    }

    // A fresh transcription of the finished file is the reference for the timings.
    let mut verification = Value::Null;
    let mut from_final: Vec<Option<(f64, f64)>> = vec![None; tokens.len()];
    if verify {
        let generators = Generators::new(Keys::load(root)?, root.join(".superint/cache"))?;
        let (transcript, cached) = generators
            .transcribe_first(&voice_file, &doc.transcribers())
            .await?;
        atomic_write(
            &root.join("audio/voice.transcript.json"),
            &serde_json::to_vec_pretty(&transcript)?,
        )?;
        let reference: Vec<align::RefToken> = tokens.iter().map(|(t, _, _)| t.clone()).collect();
        let hyp = align::hypothesis(&transcript.words, &doc.language);
        let alignment = align::align(&reference, &hyp);
        from_final = align::times(&reference, &hyp, &alignment);
        let wer = match &transcript.biased {
            Some(text) => {
                align::align(&reference, &align::hypothesis_text(text, &doc.language)).wer()
            }
            None => alignment.wer(),
        };
        verification = json!({
            "model": transcript.model,
            "cached": cached,
            "wer": round(wer, 4),
            "werTimed": round(alignment.wer(), 4),
            "transcript": "audio/voice.transcript.json",
        });
    }

    let fps = frames_per_second(root);
    let chosen_times: Vec<Option<(f64, f64)>> = from_final
        .iter()
        .zip(&from_takes)
        .map(|(a, b)| a.or(*b))
        .collect();
    let mut filled = align::fill(&chosen_times);
    // Tags have no sound of their own; only spoken words take part in snapping.
    let spoken: Vec<usize> = (0..tokens.len())
        .filter(|&i| !tokens[i].0.wildcard)
        .collect();
    let mut edges: Vec<(f64, f64)> = spoken.iter().map(|&i| filled[i]).collect();
    let moved = tighten::snap(
        &mut edges,
        &tighten::Analysis::new(&voice, rate),
        rate,
        SNAP_REACH,
    );
    for (&i, edge) in spoken.iter().zip(edges) {
        filled[i] = edge;
    }
    let mut shifts: Vec<f64> = moved.iter().map(|m| m.abs() * fps).collect();
    shifts.sort_by(f64::total_cmp);
    let mut deviations = Vec::new();
    let mut words = Vec::new();
    for (index, ((token, paragraph, scene), (start, end))) in tokens.iter().zip(&filled).enumerate()
    {
        if token.wildcard {
            continue;
        }
        let timing = if from_final[index].is_some() {
            "final"
        } else if from_takes[index].is_some() {
            "take"
        } else {
            "interpolated"
        };
        if let (Some(a), Some(b)) = (from_final[index], from_takes[index]) {
            deviations.push(((a.0 - b.0).abs() * fps, token.surface.clone(), a.0));
        }
        words.push(json!({
            "word": token.surface,
            "start": round(*start, 3),
            "end": round(*end, 3),
            "startFrame": (start * fps).round() as u64,
            "endFrame": (end * fps).round() as u64,
            "paragraph": paragraph,
            "scene": scene,
            "timing": timing,
        }));
    }
    atomic_write(
        &root.join("audio/words.json"),
        &serde_json::to_vec_pretty(&words)?,
    )?;
    deviations.sort_by(|a, b| b.0.total_cmp(&a.0));
    let mut frames: Vec<f64> = deviations.iter().map(|d| d.0).collect();
    frames.sort_by(f64::total_cmp);
    let levels = audio::levels(&voice, rate);
    let interpolated = words
        .iter()
        .filter(|w| w["timing"] == "interpolated")
        .count();
    Ok(json!({
        "voice": display_path(&voice_file)?.display().to_string(),
        "words": "audio/words.json",
        "seconds": levels.seconds,
        "peakDb": levels.peak_db,
        "rmsDb": levels.rms_db,
        "fps": fps,
        "picks": chosen.iter().map(|(p, t)| format!("{}={}", p.number, t.take)).collect::<Vec<_>>().join(","),
        "gainsDb": gains.iter().map(|g| round(audio::db(*g), 2)).collect::<Vec<_>>(),
        "pausesShortened": shortened,
        "sentencePause": doc.sentence_pause,
        "paragraphPause": doc.paragraph_pause,
        "wordCount": words.len(),
        "interpolatedWords": interpolated,
        "verification": verification,
        "timingCheck": {
            // Word edges at pauses, moved onto the measured speech: how far off the transcriber was.
            "snappedEdges": shifts.len(),
            "snapMedianFrames": shifts.get(shifts.len() / 2).map(|f| round(*f, 2)),
            "snapMaxFrames": shifts.last().map(|f| round(*f, 2)),
            // Word starts from the takes against the final transcription, before snapping.
            "comparedWords": frames.len(),
            "medianFrames": frames.get(frames.len() / 2).map(|f| round(*f, 2)),
            "maxFrames": frames.last().map(|f| round(*f, 2)),
            "outliers": deviations.iter().filter(|d| d.0 > OUTLIER_SECONDS * fps).take(12).map(|d| json!({"word": d.1, "at": round(d.2, 3), "frames": round(d.0, 1)})).collect::<Vec<_>>(),
        },
    }))
}

pub struct TranscribeOptions<'a> {
    pub audio: &'a Path,
    pub model: Option<&'a str>,
    pub language: Option<&'a str>,
    pub terms: Vec<String>,
    /// The text that should have been said: `voice.md` or plain text.
    pub reference: Option<&'a Path>,
    pub output: Option<&'a Path>,
}

/// `transcribe`: one audio file, with word times, and the errors against a reference if given.
pub async fn transcribe_file(options: &TranscribeOptions<'_>) -> Result<Value> {
    ensure!(
        options.audio.is_file(),
        "{} does not exist",
        options.audio.display()
    );
    let folder = options
        .audio
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let reference = match options.reference {
        Some(path) => Some(VoiceDoc::parse(
            &fs::read_to_string(path).with_context(|| format!("Reading {}", path.display()))?,
            &Defaults::builtin(),
        )?),
        None => None,
    };
    let defaults = Defaults::builtin();
    let model = options.model.unwrap_or(&defaults.transcription);
    let language = options
        .language
        .map(str::to_string)
        .or_else(|| reference.as_ref().map(|r| r.language.clone()))
        .unwrap_or(defaults.language.clone());
    let mut terms = options.terms.clone();
    if let Some(doc) = &reference {
        terms.extend(
            doc.terms
                .iter()
                .filter(|t| !options.terms.contains(t))
                .cloned(),
        );
    }
    let generators = Generators::new(Keys::load(folder)?, folder.join(".superint/cache"))?;
    generators.reachable(model)?;
    let (transcript, cached) = generators
        .transcribe(
            options.audio,
            &TranscribeRequest {
                model,
                language: Some(&language),
                terms: &terms,
            },
        )
        .await?;
    if let Some(output) = options.output {
        atomic_write(output, &serde_json::to_vec_pretty(&transcript)?)?;
    }
    let comparison = reference.map(|doc| {
        let text: Vec<&str> = doc.paragraphs.iter().map(|p| p.text.as_str()).collect();
        let reference = align::reference(&text.join(" "), doc.syntax());
        let timed = align::hypothesis(&transcript.words, &language);
        let timed_alignment = align::align(&reference, &timed);
        let filled = align::fill(&align::times(&reference, &timed, &timed_alignment));
        let (scored, alignment) = match &transcript.biased {
            Some(text) => {
                let hyp = align::hypothesis_text(text, &language);
                let alignment = align::align(&reference, &hyp);
                (hyp, alignment)
            }
            None => (timed.clone(), timed_alignment.clone()),
        };
        json!({
            "words": spoken_words(&reference),
            "wer": round(alignment.wer(), 4),
            "werTimed": round(timed_alignment.wer(), 4),
            "missingTerms": align::missing_terms(&terms, &reference, &scored),
            "differences": align::differences(&reference, &scored, &alignment, &filled),
        })
    });
    Ok(json!({
        "model": model,
        "cached": cached,
        "language": language,
        "output": options.output.map(|p| p.display().to_string()),
        "text": transcript.text,
        "biased": transcript.biased,
        "wordCount": transcript.words.len(),
        "words": if options.output.is_some() { Value::Null } else { serde_json::to_value(&transcript.words)? },
        "comparison": comparison,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_front_matter_paragraphs_and_scenes() {
        let doc = VoiceDoc::parse(
            "---\nvoice: Sadaltager\nstyle: calm, warm and curious\nterms: [Claude, ChatGPT]\nparagraphPause: 0.5\n---\n\n[[scene:hook]]\nStell dir vor,\ndu hast Zeit.\n\n<!-- Notiz\nüber zwei Zeilen -->\n# Hinweis\nZweiter Absatz.\n",
            &Defaults::builtin(),
        )
        .unwrap();
        assert_eq!(doc.model, AI_STUDIO.speech);
        assert_eq!(doc.voice, "Sadaltager");
        assert_eq!(doc.style.as_deref(), Some("calm, warm and curious"));
        assert_eq!(doc.terms, ["Claude", "ChatGPT"]);
        assert_eq!(doc.paragraph_pause, 0.5);
        assert_eq!(doc.sentence_pause, 0.24);
        assert_eq!(doc.paragraphs.len(), 2);
        assert_eq!(doc.paragraphs[0].text, "Stell dir vor, du hast Zeit.");
        assert_eq!(doc.paragraphs[0].scene.as_deref(), Some("hook"));
        assert_eq!(doc.paragraphs[0].line, 9);
        assert_eq!(doc.paragraphs[1].text, "Zweiter Absatz.");
        assert_eq!(doc.paragraphs[1].line, 15);
        assert!(doc.unknown_keys.is_empty());
    }

    #[test]
    fn an_openrouter_model_gets_an_elevenlabs_voice() {
        let doc = VoiceDoc::parse(
            "---\nmodel: elevenlabs/eleven-v4-turbo\n---\nHallo.",
            &Defaults::builtin(),
        )
        .unwrap();
        assert_eq!(doc.voice, OPENROUTER.voice);
        assert_eq!(doc.syntax(), Syntax::ElevenLabs);
        assert!(VoiceDoc::parse("---\ntakes: 9\n---\nHallo.", &Defaults::builtin()).is_err());
    }

    fn take(number: u32, wer: f64, missing: usize, wpm: f64) -> TakeReport {
        TakeReport {
            route: None,
            take: number,
            file: String::new(),
            transcript: String::new(),
            cached: false,
            seconds: 1.0,
            speech_seconds: 1.0,
            words_per_minute: wpm,
            peak_db: -3.0,
            rms_db: -20.0,
            clipped: 0,
            longest_pause: 0.2,
            pauses: Vec::new(),
            wer,
            wer_timed: wer,
            missing_terms: vec!["Claude".into(); missing],
            differences: Vec::new(),
        }
    }

    #[test]
    fn recommends_accuracy_first_then_pace() {
        let takes = [
            take(1, 0.05, 0, 140.0),
            take(2, 0.0, 1, 140.0),
            take(3, 0.0, 0, 170.0),
            take(4, 0.0, 0, 145.0),
        ];
        assert_eq!(recommend(&takes, 140), 4);
        let report = TakesReport {
            model: String::new(),
            voice: String::new(),
            style: None,
            transcription: String::new(),
            language: "de".into(),
            paragraphs: vec![ParagraphReport {
                paragraph: 1,
                scene: None,
                text: String::new(),
                words: 1,
                takes: takes.to_vec(),
                recommended: 4,
            }],
            pick: "1=4".into(),
        };
        assert_eq!(picks(&report, "auto").unwrap()[&1], 4);
        assert_eq!(picks(&report, "1=2").unwrap()[&1], 2);
        assert!(picks(&report, "1=9").is_err());
        assert!(picks(&report, "2=1").is_err());
    }
}
