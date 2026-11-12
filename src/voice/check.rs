//! Rules for Claude's voice text. The tool reports problems; it never rewrites the text.
use super::{
    VoiceDoc,
    align::{self, Segment, Syntax},
};
use crate::frontmatter;
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Level {
    Error,
    Warning,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Issue {
    pub level: Level,
    pub code: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paragraph: Option<usize>,
    pub message: String,
}

/// Google's recommended inline tags for Gemini 3.8 TTS (speech-generation guide, 2026-11-04).
pub const GEMINI_TAGS: &[&str] = &[
    "short pause",
    "long pause",
    "argh",
    "breath",
    "heavy breath",
    "exhales",
    "cackle",
    "cheer",
    "chuckle",
    "chuckles",
    "cough",
    "cry",
    "gasp",
    "giggle",
    "groan",
    "growl",
    "grunt",
    "grr",
    "hiss",
    "laugh",
    "laughter",
    "moan",
    "pant",
    "pff",
    "phew",
    "scream",
    "shout",
    "shriek",
    "sigh",
    "sighs",
    "sneeze",
    "snicker",
    "snort",
    "sob",
    "throat-clearing",
    "tsk",
    "whimper",
    "whispers",
    "whispering",
    "yawn",
];
/// The 30 featured Gemini voices, each with the word Google describes it by.
pub const GEMINI_VOICES: &[(&str, &str)] = &[
    ("Zephyr", "bright"),
    ("Puck", "upbeat"),
    ("Charon", "informative"),
    ("Kore", "firm"),
    ("Fenrir", "excitable"),
    ("Leda", "youthful"),
    ("Orus", "firm"),
    ("Aoede", "breezy"),
    ("Callirrhoe", "easy-going"),
    ("Autonoe", "bright"),
    ("Enceladus", "breathy"),
    ("Iapetus", "clear"),
    ("Umbriel", "easy-going"),
    ("Algieba", "smooth"),
    ("Despina", "smooth"),
    ("Erinome", "clear"),
    ("Algenib", "gravelly"),
    ("Rasalgethi", "informative"),
    ("Laomedeia", "upbeat"),
    ("Achernar", "soft"),
    ("Alnilam", "firm"),
    ("Schedar", "even"),
    ("Gacrux", "mature"),
    ("Pulcherrima", "forward"),
    ("Achird", "friendly"),
    ("Zubenelgenubi", "casual"),
    ("Vindemiatrix", "gentle"),
    ("Sadachbia", "lively"),
    ("Sadaltager", "knowledgeable"),
    ("Sulafat", "warm"),
];
pub const ELEVENLABS_VOICES: &[&str] = &[
    "george", "sarah", "adam", "alice", "bella", "bill", "brian", "callum", "charlie", "chris",
    "daniel", "eric", "harry", "jessica", "laura", "liam", "lily", "matilda", "river", "roger",
    "will",
];
const ABBREVIATIONS: &[&str] = &[
    "z.b.", "bzw.", "usw.", "d.h.", "ca.", "evtl.", "ggf.", "inkl.", "zzgl.", "u.a.", "o.ä.",
    "u.ä.", "mio.", "mrd.", "tsd.", "nr.", "dr.", "prof.", "etc.", "bspw.", "vgl.", "s.o.", "s.u.",
    "z.t.", "mind.", "max.", "min.", "sek.", "std.", "jh.", "e.g.", "i.e.", "vs.", "approx.",
];
const UNITS: &[&str] = &[
    "km", "kg", "mg", "cm", "mm", "ms", "kwh", "kw", "mb", "gb", "tb", "kb", "ghz", "mhz", "hz",
];
const NUMBER_STEMS: &[&str] = &[
    "zwanzig", "dreissig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig",
    "hundert", "tausend", "million", "milliard", "prozent", "twenty", "thirty", "forty", "fifty",
    "sixty", "seventy", "eighty", "ninety", "hundred", "thousand", "billion", "percent",
];
const NUMBER_WORDS: &[&str] = &[
    "eins",
    "zwei",
    "drei",
    "vier",
    "fünf",
    "sechs",
    "sieben",
    "acht",
    "neun",
    "zehn",
    "elf",
    "zwölf",
    "dreizehn",
    "vierzehn",
    "fünfzehn",
    "sechzehn",
    "siebzehn",
    "achtzehn",
    "neunzehn",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
];
const IDENTITY_WORDS: &[&str] = &[
    "male", "female", "man", "woman", "boy", "girl", "old", "young", "accent", "british",
    "american", "german", "mann", "frau", "jung", "akzent",
];
const PAUSE_TAGS: &[&str] = &["short pause", "long pause", "breath", "pause"];

fn issue(level: Level, code: &'static str, paragraph: Option<usize>, message: String) -> Issue {
    Issue {
        level,
        code,
        paragraph,
        message,
    }
}

pub fn check(doc: &VoiceDoc, script: Option<&str>) -> Vec<Issue> {
    use Level::{Error, Warning};
    let syntax = doc.syntax();
    let mut issues = Vec::new();
    for key in &doc.unknown_keys {
        issues.push(issue(
            Warning,
            "V15",
            None,
            format!("Unknown front matter key `{key}`; it is ignored"),
        ));
    }
    if doc.paragraphs.is_empty() {
        issues.push(issue(
            Error,
            "V14",
            None,
            "voice.md has no paragraphs to speak".into(),
        ));
        return issues;
    }
    let terms: Vec<String> = doc.terms.iter().map(|t| align::normalize(t)).collect();
    let mut tags = 0;
    let mut words = 0;
    let mut capitals = Vec::new();
    for paragraph in &doc.paragraphs {
        let at = Some(paragraph.number);
        let segments = align::segments(&paragraph.text, syntax);
        let plain: String = segments
            .iter()
            .filter_map(|s| match s {
                Segment::Text(text) => Some(text.as_str()),
                _ => None,
            })
            .collect::<Vec<_>>()
            .join(" ");
        words += align::reference(&paragraph.text, syntax).len();

        let digits: String = plain.chars().filter(|c| c.is_ascii_digit()).collect();
        if !digits.is_empty() {
            issues.push(issue(
                Error,
                "V1",
                at,
                format!("Digits left ({digits}); write numbers as they are said"),
            ));
        }
        let mut symbols: Vec<char> = plain
            .chars()
            .filter(|&c| {
                "%€$£¥&§+=@#°*~_|^\\{}".contains(c) || (c == '/' && syntax == Syntax::Gemini)
            })
            .collect();
        symbols.sort_unstable();
        symbols.dedup();
        let symbols: String = symbols.into_iter().collect();
        if !symbols.is_empty() {
            issues.push(issue(
                Error,
                "V2",
                at,
                format!("Symbols left ({symbols}); write them as words"),
            ));
        }
        let wrong = match syntax {
            Syntax::Gemini => plain.contains(['[', ']']),
            Syntax::ElevenLabs => plain.contains(['<', '>']),
        };
        if wrong {
            issues.push(issue(
                Error,
                "V6",
                at,
                match syntax {
                    Syntax::Gemini => "Square brackets are ElevenLabs syntax; Gemini TTS takes tags in angle brackets, e.g. <short pause>".into(),
                    Syntax::ElevenLabs => "Angle brackets are Gemini syntax; ElevenLabs takes tags in square brackets, e.g. [short pause]".into(),
                },
            ));
        }
        let mut abbreviations = Vec::new();
        for word in plain.split_whitespace() {
            let lower = word
                .trim_start_matches(|c: char| !c.is_alphanumeric())
                .trim_end_matches([',', ';', ':', '!', '?', ')', '"', '”', '“', '»', '«'])
                .to_lowercase();
            let bare = lower.trim_end_matches('.');
            let dotted = {
                let chars: Vec<char> = lower.chars().collect();
                chars.len() >= 4
                    && chars[0].is_alphabetic()
                    && chars[1] == '.'
                    && chars[2].is_alphabetic()
                    && chars[3] == '.'
            };
            if ABBREVIATIONS.contains(&lower.as_str()) || UNITS.contains(&bare) || dotted {
                abbreviations.push(word.to_string());
            }
            let letters: Vec<char> = word.chars().filter(|c| c.is_alphabetic()).collect();
            if letters.len() >= 2 && letters.iter().all(|c| c.is_uppercase()) {
                capitals.push(
                    word.trim_matches(|c: char| !c.is_alphanumeric())
                        .to_string(),
                );
            }
        }
        if !abbreviations.is_empty() {
            issues.push(issue(
                Error,
                "V3",
                at,
                format!(
                    "Abbreviations or units left ({}); write them out",
                    abbreviations.join(", ")
                ),
            ));
        }
        let limit = match syntax {
            Syntax::Gemini => 20_000,
            Syntax::ElevenLabs => 10_000,
        };
        let length = paragraph.text.chars().count();
        if length > limit {
            issues.push(issue(
                Error,
                "V8",
                at,
                format!(
                    "{length} characters; one request takes at most {limit}. Split the paragraph"
                ),
            ));
        }

        // Tags: syntax, known names, and never in a sentence with a number or a name.
        for sentence in sentences(&segments) {
            let mut sentence_tags = Vec::new();
            let mut has_number_or_name = false;
            for segment in &sentence {
                match segment {
                    Segment::Tag(tag) => sentence_tags.push(tag.clone()),
                    Segment::Text(text) => {
                        for word in text.split_whitespace() {
                            let norm = align::normalize(word);
                            if norm.is_empty() {
                                continue;
                            }
                            if terms.contains(&norm)
                                || NUMBER_WORDS.contains(&norm.as_str())
                                || NUMBER_STEMS.iter().any(|stem| norm.contains(stem))
                            {
                                has_number_or_name = true;
                            }
                        }
                    }
                    Segment::Ipa(_) => has_number_or_name = true,
                }
            }
            tags += sentence_tags.len();
            for tag in &sentence_tags {
                let lower = tag.to_lowercase();
                if syntax == Syntax::Gemini && !GEMINI_TAGS.contains(&lower.as_str()) {
                    issues.push(issue(
                        Warning,
                        "V7",
                        at,
                        format!(
                            "<{tag}> is not in Google's tag list (human vocalisations such as <breath>, <sigh>, <chuckle>, <short pause>; tags stay English in any language, never sound effects); listen whether it works"
                        ),
                    ));
                }
                if has_number_or_name && !PAUSE_TAGS.contains(&lower.as_str()) {
                    issues.push(issue(Error, "V5", at, format!("Tag `{tag}` sits in a sentence with a number or a name; move it to another sentence")));
                }
            }
        }
    }
    if tags * 40 > words.max(40) {
        issues.push(issue(
            Error,
            "V4",
            None,
            format!("{tags} tags for {words} words; at most one per 40 words"),
        ));
    }
    if !capitals.is_empty() {
        capitals.dedup();
        issues.push(issue(
            Warning,
            "V12",
            None,
            format!(
                "Words in capitals ({}): Gemini reads them as emphasis. Check acronyms in the take",
                capitals.join(", ")
            ),
        ));
    }
    let style = doc.style.as_deref().unwrap_or_default().to_lowercase();
    match syntax {
        Syntax::Gemini => {
            let found: Vec<&str> = style
                .split(|c: char| !c.is_alphanumeric() && c != '-')
                .filter(|w| IDENTITY_WORDS.contains(w))
                .collect();
            if !found.is_empty() {
                issues.push(issue(
                    Warning,
                    "V9",
                    None,
                    format!(
                        "style mentions {}: choose the voice for age, gender and accent instead",
                        found.join(", ")
                    ),
                ));
            }
            if !GEMINI_VOICES
                .iter()
                .any(|(v, _)| v.eq_ignore_ascii_case(&doc.voice))
                && !doc.voice.starts_with("voice_")
                && !doc.voice.starts_with("voicekey_")
            {
                issues.push(issue(
                    Warning,
                    "V10",
                    None,
                    format!(
                        "Voice `{}` is not one of the 30 featured Gemini voices or a `voice_`/`voicekey_` ID; fine if it is an Extended Voice Library ID (GET /v1beta/voices), otherwise check the spelling",
                        doc.voice
                    ),
                ));
            }
        }
        Syntax::ElevenLabs => {
            if !style.is_empty() {
                issues.push(issue(Warning, "V9", None, "ElevenLabs ignores `style`; set the tone with a narrative tag such as [Quiet, reflective narration]".into()));
            }
            if !ELEVENLABS_VOICES.contains(&doc.voice.to_lowercase().as_str()) {
                issues.push(issue(
                    Warning,
                    "V10",
                    None,
                    format!(
                        "Voice `{}` is not in OpenRouter's ElevenLabs list",
                        doc.voice
                    ),
                ));
            }
        }
    }
    let all: Vec<align::RefToken> = doc
        .paragraphs
        .iter()
        .flat_map(|p| align::reference(&p.text, syntax))
        .collect();
    let present: Vec<&str> = all.iter().map(|t| t.norm.as_str()).collect();
    for (term, norm) in doc.terms.iter().zip(&terms) {
        let joined: String = present.concat();
        if !norm.is_empty() && !present.contains(&norm.as_str()) && !joined.contains(norm.as_str())
        {
            issues.push(issue(
                Warning,
                "V11",
                None,
                format!("Term `{term}` does not occur in the text"),
            ));
        }
    }
    if let Some(script) = script {
        let expected = align::reference(&narration(script), Syntax::Gemini);
        let heard = align::hypothesis_text(
            &all.iter()
                .map(|t| t.surface.as_str())
                .collect::<Vec<_>>()
                .join(" "),
            &doc.language,
        );
        let alignment = align::align(&expected, &heard);
        if alignment.errors > 0 {
            let changes: Vec<String> = align::differences(&expected, &heard, &alignment, &[])
                .into_iter()
                .take(20)
                .map(|d| match (d.expected.is_empty(), d.heard.is_empty()) {
                    (true, _) => format!("+{}", d.heard),
                    (_, true) => format!("-{}", d.expected),
                    _ => format!("{} → {}", d.expected, d.heard),
                })
                .collect();
            issues.push(issue(Warning, "V13", None, format!("{} word changes against script.md: {}. Only punctuation, capitals, tags and pronunciation may differ", alignment.errors, changes.join("; "))));
        }
    }
    issues
}

/// Segments grouped into sentences at `.`, `!`, `?` and `…`.
fn sentences(segments: &[Segment]) -> Vec<Vec<Segment>> {
    let mut out = vec![Vec::new()];
    for segment in segments {
        match segment {
            Segment::Text(text) => {
                let mut current = String::new();
                for c in text.chars() {
                    current.push(c);
                    if matches!(c, '.' | '!' | '?' | '…') {
                        out.last_mut()
                            .unwrap()
                            .push(Segment::Text(std::mem::take(&mut current)));
                        out.push(Vec::new());
                    }
                }
                if !current.is_empty() {
                    out.last_mut().unwrap().push(Segment::Text(current));
                }
            }
            other => out.last_mut().unwrap().push(other.clone()),
        }
    }
    out.retain(|s| !s.is_empty());
    out
}

/// The spoken lines of `script.md`: no headings, scene markers, `>` notes, claim tags or comments.
pub fn narration(script: &str) -> String {
    let body = frontmatter::split(script).body;
    let body = super::strip_comments(&body);
    let mut lines = Vec::new();
    for line in body.lines() {
        let line = line.trim();
        if line.is_empty()
            || line.starts_with('#')
            || line.starts_with('>')
            || line.starts_with("[[")
        {
            continue;
        }
        let mut text = String::new();
        let mut depth = 0;
        for c in line.chars() {
            match c {
                '{' => depth += 1,
                '}' if depth > 0 => depth -= 1,
                _ if depth == 0 => text.push(c),
                _ => {}
            }
        }
        lines.push(text);
    }
    lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::super::{Defaults, VoiceDoc};
    use super::*;

    fn doc(text: &str) -> VoiceDoc {
        VoiceDoc::parse(text, &Defaults::builtin()).unwrap()
    }

    fn codes(issues: &[Issue]) -> Vec<&'static str> {
        issues.iter().map(|i| i.code).collect()
    }

    #[test]
    fn clean_text_passes() {
        let voice = doc(
            "---\nvoice: Charon\nstyle: calm and curious\nterms: [Claude]\n---\n\nStell dir vor, Claude kennt dreißig Handgriffe.\n\nUnd jetzt <short pause> wird es spannend.\n",
        );
        let issues = check(
            &voice,
            Some(
                "[[scene:hook]]\nStell dir vor, Claude kennt dreißig Handgriffe. {C1}\n> on screen: Skills\n\nUnd jetzt wird es spannend.",
            ),
        );
        assert!(issues.is_empty(), "{issues:?}");
    }

    #[test]
    fn finds_digits_symbols_abbreviations_and_tags() {
        let voice = doc(
            "---\nvoice: Charon\nterms: [Claude]\n---\n\nClaude kennt 30 Skills, z.B. 5 % aller [warm] Fälle. <sigh> Claude sagt dreißig. <laugh> Gut.\n",
        );
        let found = codes(&check(&voice, None));
        for code in ["V1", "V2", "V3", "V5", "V6", "V4"] {
            assert!(found.contains(&code), "{code} missing in {found:?}");
        }
    }

    #[test]
    fn script_changes_and_style_identity_are_warnings() {
        let voice = doc("---\nvoice: Nobody\nstyle: old British man\n---\n\nKI kann heute viel.\n");
        let issues = check(&voice, Some("KI kann viel."));
        let found = codes(&issues);
        assert!(
            found.contains(&"V9")
                && found.contains(&"V10")
                && found.contains(&"V12")
                && found.contains(&"V13")
        );
        assert!(issues.iter().all(|i| i.level == Level::Warning));
    }

    #[test]
    fn narration_skips_markup() {
        let script = "# Script: Test\n\n[[scene:hook]]\nErster Satz. {C1}\n> visual: Bild\n<!-- Notiz -->\nZweiter {C2, C3} Satz.";
        assert_eq!(narration(script), "Erster Satz. \nZweiter  Satz.");
    }
}
