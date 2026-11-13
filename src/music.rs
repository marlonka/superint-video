//! Music. Claude writes the whole Lyria prompt in `music-prompt.md`; the tool checks it against
//! the rules, sends it unchanged for a few variants and measures each one.
use crate::{
    audio::{self, round},
    env::Keys,
    frontmatter,
    project::atomic_write,
    providers::{self, AI_STUDIO, Generators, Provider},
    voice::{self, Defaults, VoiceDoc},
};
use anyhow::{Context, Result, bail, ensure};
use futures::{StreamExt, stream};
use serde::Serialize;
use serde_json::{Value, json};
use std::{fs, path::Path};

pub const FILE: &str = "music-prompt.md";
const DIR: &str = "audio/music";
const KEYS: &[&str] = &["model", "seconds"];
/// The clip model always returns 30 seconds.
const CLIP_SECONDS: f64 = 30.0;
/// Words of the topic that say nothing about it; everything else must stay out of the prompt.
const STOP_WORDS: &[&str] = &[
    "aber", "auch", "dass", "dein", "deine", "eine", "einem", "einen", "einer", "eines", "from",
    "gibt", "haben", "into", "kann", "mehr", "nicht", "oder", "sein", "sind", "that", "their",
    "this", "under", "unter", "warum", "what", "when", "wenn", "werden", "which", "wird", "with",
    "your",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Level {
    Error,
    Warning,
}

#[derive(Debug, Clone, Serialize)]
pub struct Issue {
    pub level: Level,
    pub code: &'static str,
    pub message: String,
}

pub struct MusicDoc {
    pub model: String,
    pub seconds: Option<f64>,
    pub prompt: String,
    pub unknown_keys: Vec<String>,
}

impl MusicDoc {
    pub fn parse(text: &str, default_model: &str) -> Result<Self> {
        let front = frontmatter::split(text);
        let get = |key: &str| {
            front
                .values
                .get(key)
                .map(|v| frontmatter::string(v))
                .filter(|v| !v.is_empty())
        };
        let seconds = match get("seconds") {
            Some(v) => {
                let s: f64 = v
                    .trim_end_matches('s')
                    .parse()
                    .context("seconds must be a number")?;
                ensure!(
                    (5.0..=600.0).contains(&s),
                    "seconds must be between 5 and 600"
                );
                Some(s)
            }
            None => None,
        };
        Ok(Self {
            model: get("model").unwrap_or_else(|| default_model.to_string()),
            seconds,
            prompt: voice::strip_comments(&front.body).trim().to_string(),
            unknown_keys: front
                .values
                .keys()
                .filter(|k| !KEYS.contains(&k.as_str()))
                .cloned()
                .collect(),
        })
    }

    fn clip(&self) -> bool {
        self.model.contains("clip")
    }
}

fn words(text: &str) -> Vec<String> {
    text.split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty())
        .map(str::to_lowercase)
        .collect()
}

/// The words that would pull the music toward the topic: the brief's topic and the voice terms.
fn topic_words(topic: &str, terms: &[String]) -> Vec<String> {
    let mut out: Vec<String> = words(topic)
        .into_iter()
        .filter(|w| w.chars().count() >= 4 && !STOP_WORDS.contains(&w.as_str()))
        .collect();
    for term in terms {
        out.extend(words(term).into_iter().filter(|w| w.chars().count() >= 2));
    }
    out.sort();
    out.dedup();
    out
}

/// Seconds named in the prompt: "34-second", "34 seconds", "2 minutes", "1:30 long".
fn lengths(prompt: &str) -> Vec<f64> {
    let tokens: Vec<String> = prompt
        .split(|c: char| c.is_whitespace() || c == '-' || c == ',' || c == '.' || c == '(')
        .filter(|t| !t.is_empty())
        .map(str::to_lowercase)
        .collect();
    let mut out = Vec::new();
    for pair in tokens.windows(2) {
        let Ok(number) = pair[0].parse::<f64>() else {
            continue;
        };
        let unit = pair[1].trim_end_matches([')', ';', ':']);
        if unit.starts_with("sec") || unit == "s" {
            out.push(number);
        } else if unit.starts_with("min") {
            out.push(number * 60.0);
        }
    }
    out
}

pub fn check(doc: &MusicDoc, topic: &str, terms: &[String]) -> Vec<Issue> {
    let mut issues = Vec::new();
    let mut push = |level, code, message: String| {
        issues.push(Issue {
            level,
            code,
            message,
        })
    };
    if doc.prompt.is_empty() {
        push(
            Level::Error,
            "M1",
            "The prompt is empty; write it under the front matter".into(),
        );
        return issues;
    }
    let lower = doc.prompt.to_lowercase();
    if !(lower.contains("instrumental")
        && (lower.contains("no vocals") || lower.contains("no singing")))
    {
        push(
            Level::Error,
            "M2",
            "Say \"Instrumental, no vocals.\" so Lyria leaves out singing".into(),
        );
    }
    let prompt_words = words(&doc.prompt);
    let found: Vec<String> = topic_words(topic, terms)
        .into_iter()
        .filter(|w| prompt_words.contains(w))
        .collect();
    if !found.is_empty() {
        push(
            Level::Error,
            "M3",
            format!(
                "Topic words in the prompt ({}); describe the music, not the film's subject",
                found.join(", ")
            ),
        );
    }
    let named = lengths(&doc.prompt);
    if named.is_empty() {
        push(
            Level::Warning,
            "M4",
            "The prompt names no length; ask for a few seconds more than the film needs".into(),
        );
    } else if let Some(seconds) = doc.seconds
        && !named.iter().any(|n| (n - seconds).abs() < 0.5)
    {
        push(
            Level::Warning,
            "M5",
            format!("Front matter says {seconds} s, the prompt names {named:?} s"),
        );
    }
    if doc.clip() && doc.seconds.is_some_and(|s| s > CLIP_SECONDS) {
        push(
            Level::Error,
            "M6",
            format!(
                "{} always returns 30 s; use {} for longer music",
                doc.model, AI_STUDIO.music
            ),
        );
    }
    for key in &doc.unknown_keys {
        push(
            Level::Warning,
            "M7",
            format!("Unknown front-matter key `{key}` (known: model, seconds)"),
        );
    }
    issues
}

fn read(root: &Path) -> Result<(MusicDoc, String, Vec<String>)> {
    let path = root.join(FILE);
    let text = fs::read_to_string(&path).with_context(|| {
        format!(
            "{} not found. Write the Lyria prompt first (rules: the superint-audio skill)",
            path.display()
        )
    })?;
    let settings = crate::home::Settings::current();
    // The model the user chose in Setup, else the preset's, else the usual one.
    let default_model = settings
        .music_model
        .clone()
        .or_else(|| {
            fs::read(root.join(crate::preset::CONFIG))
                .ok()
                .and_then(|bytes| crate::preset::PresetConfig::parse(&bytes).ok())
                .and_then(|preset| preset.music.map(|m| m.model))
        })
        .unwrap_or_else(|| AI_STUDIO.music.to_string());
    let doc = MusicDoc::parse(&text, &default_model)?;
    let topic = fs::read_to_string(root.join("brief.md"))
        .ok()
        .and_then(|text| {
            frontmatter::split(&text)
                .values
                .get("topic")
                .map(|v| frontmatter::string(v))
        })
        .unwrap_or_default();
    let terms = fs::read_to_string(root.join(voice::FILE))
        .ok()
        .and_then(|text| VoiceDoc::parse(&text, &Defaults::for_project_with(root, &settings)).ok())
        .map(|doc| doc.terms)
        .unwrap_or_default();
    Ok((doc, topic, terms))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Variant {
    variant: u32,
    file: String,
    cached: bool,
    seconds: f64,
    peak_db: f64,
    rms_db: f64,
    clipped: usize,
    /// Level of the last 250 ms against the music's average, in dB.
    end_db: f64,
    /// `fades` when the last 250 ms are at least 20 dB under the average, otherwise `cut`.
    ending: &'static str,
    long_enough: Option<bool>,
}

fn measure(samples: &[f32], rate: u32) -> (audio::Levels, f64) {
    let levels = audio::levels(samples, rate);
    let tail = (0.25 * f64::from(rate)) as usize;
    let end = &samples[samples.len().saturating_sub(tail)..];
    let end_rms = if end.is_empty() {
        0.0
    } else {
        (end.iter().map(|s| f64::from(*s).powi(2)).sum::<f64>() / end.len() as f64).sqrt()
    };
    let end_db = round(audio::db(end_rms) - levels.rms_db, 1);
    (levels, end_db)
}

/// `music`: check the prompt, then generate and measure the variants.
pub async fn generate(root: &Path, variants: u32, dry_run: bool) -> Result<Value> {
    ensure!(
        (1..=5).contains(&variants),
        "--variants must be between 1 and 5"
    );
    let (doc, topic, terms) = read(root)?;
    let issues = check(&doc, &topic, &terms);
    let errors: Vec<String> = issues
        .iter()
        .filter(|i| i.level == Level::Error)
        .map(|i| format!("{}: {}", i.code, i.message))
        .collect();
    let generators = Generators::new(Keys::load(root)?, root.join(".superint/cache"))?;
    if dry_run {
        let cached = (1..=variants)
            .filter(|&v| generators.is_cached(&Generators::music_key(&doc.model, &doc.prompt, v)))
            .count();
        return Ok(json!({
            "dryRun": true,
            "ok": errors.is_empty(),
            "model": doc.model,
            // The way the real run asks first; without a key, the model's own.
            "provider": generators
                .reachable(&doc.model)
                .unwrap_or_else(|_| Provider::of(&doc.model)),
            "variants": variants,
            "requests": variants as usize - cached,
            "cached": cached,
            "promptCharacters": doc.prompt.chars().count(),
            "keys": generators.keys.status(),
            "issues": issues,
        }));
    }
    if !errors.is_empty() {
        bail!(
            "music-prompt.md breaks {} rule(s); fix the prompt and run again:\n{}",
            errors.len(),
            errors.join("\n")
        );
    }
    generators.reachable(&doc.model)?;
    let results: Vec<Result<Variant>> = stream::iter(1..=variants)
        .map(|variant| {
            let (generators, doc) = (&generators, &doc);
            async move {
                let generated = generators
                    .music(&doc.model, &doc.prompt, variant)
                    .await
                    .with_context(|| format!("Variant {variant}"))?;
                let extension = providers::sniff(&generated.bytes);
                if extension == "bin" {
                    bail!("Variant {variant}: the music model returned data that is not audio");
                }
                let file = format!("{DIR}/v{variant}.{extension}");
                let path = root.join(&file);
                atomic_write(&path, &generated.bytes)?;
                eprintln!(
                    "music: variant {variant} {}",
                    if generated.cached {
                        "from cache"
                    } else {
                        "generated"
                    }
                );
                let samples = audio::decode(&path, audio::RATE).await?;
                let (levels, end_db) = measure(&samples, audio::RATE);
                Ok(Variant {
                    variant,
                    file,
                    cached: generated.cached,
                    seconds: levels.seconds,
                    peak_db: levels.peak_db,
                    rms_db: levels.rms_db,
                    clipped: levels.clipped,
                    end_db,
                    ending: if end_db <= -20.0 { "fades" } else { "cut" },
                    long_enough: doc.seconds.map(|s| levels.seconds + 0.05 >= s),
                })
            }
        })
        .buffer_unordered(2)
        .collect()
        .await;
    let mut measured = results.into_iter().collect::<Result<Vec<_>>>()?;
    measured.sort_by_key(|v| v.variant);
    let report = json!({
        "model": doc.model,
        "seconds": doc.seconds,
        "prompt": doc.prompt,
        "variants": measured,
        "issues": issues,
    });
    atomic_write(
        &root.join(DIR).join("report.json"),
        &serde_json::to_vec_pretty(&report)?,
    )?;
    Ok(json!({
        "report": format!("{DIR}/report.json"),
        "model": doc.model,
        "variants": report["variants"],
        "issues": issues,
        "next": "Listen to the variants and pick one; the mix step trims it to the film",
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn doc(text: &str) -> MusicDoc {
        MusicDoc::parse(text, AI_STUDIO.music).unwrap()
    }

    fn codes(issues: &[Issue]) -> Vec<&'static str> {
        issues.iter().map(|i| i.code).collect()
    }

    #[test]
    fn a_clean_prompt_passes() {
        let doc = doc(
            "---\nseconds: 34\n---\n<!-- note -->\nCalm ambient electronic bed, soft marimba and warm pads, 84 BPM, D major. Create a 34-second track. Instrumental, no vocals.",
        );
        assert_eq!(doc.prompt.lines().count(), 1);
        assert!(
            check(
                &doc,
                "Was sind Skills bei KI-Tools wie Claude",
                &["ChatGPT".into()]
            )
            .is_empty()
        );
    }

    #[test]
    fn topic_words_vocals_length_and_clip_limits() {
        let doc = doc(
            "---\nmodel: lyria-3-clip-preview\nseconds: 40\n---\nUpbeat music about Skills and Claude, 2 minutes long.",
        );
        let issues = check(&doc, "Was sind Skills bei KI-Tools wie Claude", &[]);
        assert_eq!(codes(&issues), ["M2", "M3", "M5", "M6"]);
        assert!(issues[1].message.contains("claude, skills"));
        let none = MusicDoc::parse(
            "---\nmood: calm\n---\nInstrumental, no vocals.",
            AI_STUDIO.music,
        )
        .unwrap();
        assert_eq!(codes(&check(&none, "", &[])), ["M4", "M7"]);
    }

    #[test]
    fn reads_lengths_in_seconds_and_minutes() {
        assert_eq!(lengths("Create a 34-second track"), [34.0]);
        assert_eq!(lengths("about 2 minutes (90 seconds) long"), [120.0, 90.0]);
    }
}
