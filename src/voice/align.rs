//! Words of the voice text against a transcript: normalisation, number words, and an
//! edit-distance alignment that also accepts split and joined words ("Chat GPT" = "ChatGPT").
use crate::providers::Word;
use serde::{Deserialize, Serialize};
use std::ops::Range;

/// How inline directions are written for the chosen TTS model.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Syntax {
    /// Gemini TTS: `<short pause>`.
    Gemini,
    /// ElevenLabs: `[warm]`, IPA between slashes.
    ElevenLabs,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Segment {
    Text(String),
    Tag(String),
    Ipa(String),
}

/// Splits text into spoken text, tags and IPA, following the model's syntax.
pub fn segments(text: &str, syntax: Syntax) -> Vec<Segment> {
    let open = match syntax {
        Syntax::Gemini => '<',
        Syntax::ElevenLabs => '[',
    };
    let close = match syntax {
        Syntax::Gemini => '>',
        Syntax::ElevenLabs => ']',
    };
    let chars: Vec<char> = text.chars().collect();
    let mut out = Vec::new();
    let mut plain = String::new();
    let mut i = 0;
    let find = |from: usize, target: char| {
        chars[from..]
            .iter()
            .take(80)
            .position(|&c| c == target || c == '\n')
            .map(|p| from + p)
            .filter(|&p| chars[p] == target)
    };
    while i < chars.len() {
        let c = chars[i];
        let end = if c == open {
            find(i + 1, close)
        } else if c == '/' && syntax == Syntax::ElevenLabs {
            find(i + 1, '/')
                .filter(|&end| end > i + 1 && !chars[i + 1..end].iter().any(|c| c.is_whitespace()))
        } else {
            None
        };
        match end {
            Some(end) => {
                if !plain.is_empty() {
                    out.push(Segment::Text(std::mem::take(&mut plain)));
                }
                let inner: String = chars[i + 1..end].iter().collect();
                out.push(if c == '/' {
                    Segment::Ipa(inner)
                } else {
                    Segment::Tag(inner.trim().to_string())
                });
                i = end + 1;
            }
            None => {
                plain.push(c);
                i += 1;
            }
        }
    }
    if !plain.is_empty() {
        out.push(Segment::Text(plain));
    }
    out
}

#[derive(Debug, Clone)]
pub struct RefToken {
    pub surface: String,
    pub norm: String,
    /// IPA stands in for a word whose spelling we cannot predict.
    pub wildcard: bool,
    pub sentence_end: bool,
}

#[derive(Debug, Clone)]
pub struct HypToken {
    pub surface: String,
    pub norm: String,
    /// Other ways the same word may be written, e.g. a year read as hundreds.
    pub alts: Vec<String>,
    pub start: f64,
    pub end: f64,
}

/// Lower case, `ß` as `ss`, letters and digits only. A leading "ein" before "hundert" or
/// "tausend" is dropped, since both forms are said.
pub fn normalize(word: &str) -> String {
    let text: String = word
        .to_lowercase()
        .replace('ß', "ss")
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect();
    if (text.starts_with("einhundert") || text.starts_with("eintausend")) && text.len() > 3 {
        return text[3..].to_string();
    }
    text
}

fn parts(word: &str) -> impl Iterator<Item = &str> {
    word.split(['-', '–', '—', '/', '‑'])
        .filter(|p| !p.is_empty())
}

fn ends_sentence(word: &str) -> bool {
    word.trim_end_matches(['"', '\'', '“', '”', '»', '«', ')', '’'])
        .ends_with(['.', '!', '?', '…'])
}

/// Tokens of the voice text as they should be heard.
pub fn reference(text: &str, syntax: Syntax) -> Vec<RefToken> {
    let mut tokens = Vec::new();
    for segment in segments(text, syntax) {
        match segment {
            Segment::Text(text) => {
                for word in text.split_whitespace() {
                    for piece in parts(word) {
                        let norm = normalize(piece);
                        if norm.is_empty() {
                            continue;
                        }
                        let surface = piece
                            .trim_matches(|c: char| !c.is_alphanumeric())
                            .to_string();
                        tokens.push(RefToken {
                            surface,
                            norm,
                            wildcard: false,
                            sentence_end: false,
                        });
                    }
                    if ends_sentence(word)
                        && let Some(last) = tokens.last_mut()
                    {
                        last.sentence_end = true;
                    }
                }
            }
            Segment::Ipa(ipa) => tokens.push(RefToken {
                surface: format!("/{ipa}/"),
                norm: String::new(),
                wildcard: true,
                sentence_end: false,
            }),
            Segment::Tag(_) => {}
        }
    }
    tokens
}

/// Tokens of a transcript. Each word's time span is shared among its tokens by length.
pub fn hypothesis(words: &[Word], language: &str) -> Vec<HypToken> {
    let mut tokens = Vec::new();
    for word in words {
        let expanded = expand(&word.text, language);
        let total: usize = expanded.iter().map(|(n, _)| n.chars().count().max(1)).sum();
        let mut at = word.start;
        let span = (word.end - word.start).max(0.0);
        for (norm, alts) in expanded {
            let share = span * norm.chars().count().max(1) as f64 / total.max(1) as f64;
            tokens.push(HypToken {
                surface: word.text.clone(),
                norm,
                alts,
                start: at,
                end: at + share,
            });
            at += share;
        }
    }
    tokens
}

/// Tokens of plain text without timings.
pub fn hypothesis_text(text: &str, language: &str) -> Vec<HypToken> {
    let words: Vec<Word> = text
        .split_whitespace()
        .map(|w| Word {
            text: w.to_string(),
            start: 0.0,
            end: 0.0,
        })
        .collect();
    hypothesis(&words, language)
}

fn expand(word: &str, language: &str) -> Vec<(String, Vec<String>)> {
    let mut out = Vec::new();
    for piece in parts(word) {
        if piece.chars().any(|c| c.is_ascii_digit())
            && let Some(numbers) = number_tokens(piece, language)
        {
            out.extend(numbers);
            continue;
        }
        let norm = normalize(piece);
        if norm.is_empty() {
            if piece.contains('%') {
                out.push((percent(language).into(), Vec::new()));
            }
            continue;
        }
        out.push((norm, Vec::new()));
        if piece.ends_with('%') {
            out.push((percent(language).into(), Vec::new()));
        }
    }
    out
}

fn german(language: &str) -> bool {
    language.to_ascii_lowercase().starts_with("de")
}

fn percent(language: &str) -> &'static str {
    if german(language) {
        "prozent"
    } else {
        "percent"
    }
}

/// Digits as number words: "30" → "dreissig", "2,5" → "zwei komma fuenf", "1997" also as a year.
fn number_tokens(piece: &str, language: &str) -> Option<Vec<(String, Vec<String>)>> {
    let de = german(language);
    let trimmed = piece.trim_matches(|c: char| !c.is_ascii_digit() && c != '%');
    let (body, has_percent) = match trimmed.strip_suffix('%') {
        Some(body) => (body.trim(), true),
        None => (trimmed, false),
    };
    let (thousands, decimal) = if de { ('.', ',') } else { (',', '.') };
    let (integer, fraction) = match body.split_once(decimal) {
        Some((i, f)) => (i, Some(f)),
        None => (body, None),
    };
    let digits: String = integer.chars().filter(|&c| c != thousands).collect();
    if digits.is_empty() || !digits.chars().all(|c| c.is_ascii_digit()) || digits.len() > 12 {
        return None;
    }
    let value: u64 = digits.parse().ok()?;
    let mut out: Vec<(String, Vec<String>)> = Vec::new();
    let words = if de {
        german_words(value)
    } else {
        english_words(value)
    };
    let count = words.split_whitespace().count();
    for (index, word) in words.split_whitespace().enumerate() {
        let mut alts = Vec::new();
        if de && fraction.is_none() && count == 1 && (1100..2000).contains(&value) && index == 0 {
            alts.push(normalize(&format!(
                "{}hundert{}",
                german_below_100(value / 100, false),
                if value.is_multiple_of(100) {
                    String::new()
                } else {
                    german_below_100(value % 100, false)
                }
            )));
        }
        out.push((normalize(word), alts));
    }
    if let Some(fraction) = fraction.filter(|f| !f.is_empty()) {
        if !fraction.chars().all(|c| c.is_ascii_digit()) {
            return None;
        }
        out.push((if de { "komma" } else { "point" }.into(), Vec::new()));
        for digit in fraction.chars() {
            let d = u64::from(digit.to_digit(10)?);
            out.push((
                normalize(&if de {
                    german_words(d)
                } else {
                    english_words(d)
                }),
                Vec::new(),
            ));
        }
    }
    if has_percent {
        out.push((percent(language).into(), Vec::new()));
    }
    Some(out)
}

const DE_ONES: [&str; 20] = [
    "null",
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
];
const DE_TENS: [&str; 10] = [
    "", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig",
];

/// `compound`: "ein" instead of "eins" before a larger unit.
fn german_below_100(n: u64, compound: bool) -> String {
    match n {
        1 if compound => "ein".into(),
        0..=19 => DE_ONES[n as usize].into(),
        _ => {
            let (tens, ones) = (n / 10, n % 10);
            if ones == 0 {
                DE_TENS[tens as usize].into()
            } else {
                let unit = if ones == 1 {
                    "ein"
                } else {
                    DE_ONES[ones as usize]
                };
                format!("{unit}und{}", DE_TENS[tens as usize])
            }
        }
    }
}

fn german_below_1000(n: u64, compound: bool) -> String {
    let (hundreds, rest) = (n / 100, n % 100);
    let mut text = String::new();
    if hundreds > 0 {
        text.push_str(if hundreds == 1 {
            "ein"
        } else {
            DE_ONES[hundreds as usize]
        });
        text.push_str("hundert");
    }
    if rest > 0 || hundreds == 0 {
        text.push_str(&german_below_100(rest, compound));
    }
    text
}

pub fn german_words(n: u64) -> String {
    if n == 0 {
        return "null".into();
    }
    let mut words = Vec::new();
    let (billions, rest) = (n / 1_000_000_000, n % 1_000_000_000);
    if billions > 0 {
        words.push(if billions == 1 {
            "eine milliarde".to_string()
        } else {
            format!("{} milliarden", german_below_1000(billions, false))
        });
    }
    let (millions, rest) = (rest / 1_000_000, rest % 1_000_000);
    if millions > 0 {
        words.push(if millions == 1 {
            "eine million".to_string()
        } else {
            format!("{} millionen", german_below_1000(millions, false))
        });
    }
    let (thousands, rest) = (rest / 1000, rest % 1000);
    let mut tail = String::new();
    if thousands > 0 {
        tail.push_str(&german_below_1000(thousands, true));
        tail.push_str("tausend");
    }
    if rest > 0 {
        tail.push_str(&german_below_1000(rest, false));
    }
    if !tail.is_empty() {
        words.push(tail);
    }
    words.join(" ")
}

const EN_ONES: [&str; 20] = [
    "zero",
    "one",
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
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
];
const EN_TENS: [&str; 10] = [
    "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
];

fn english_below_1000(n: u64) -> String {
    let (hundreds, rest) = (n / 100, n % 100);
    let mut words = Vec::new();
    if hundreds > 0 {
        words.push(format!("{} hundred", EN_ONES[hundreds as usize]));
    }
    if rest > 0 || hundreds == 0 {
        words.push(if rest < 20 {
            EN_ONES[rest as usize].to_string()
        } else if rest % 10 == 0 {
            EN_TENS[(rest / 10) as usize].to_string()
        } else {
            format!(
                "{} {}",
                EN_TENS[(rest / 10) as usize],
                EN_ONES[(rest % 10) as usize]
            )
        });
    }
    words.join(" ")
}

pub fn english_words(n: u64) -> String {
    if n == 0 {
        return "zero".into();
    }
    let mut words = Vec::new();
    let mut rest = n;
    for (unit, name) in [
        (1_000_000_000, "billion"),
        (1_000_000, "million"),
        (1000, "thousand"),
    ] {
        if rest >= unit {
            words.push(format!("{} {name}", english_below_1000(rest / unit)));
            rest %= unit;
        }
    }
    if rest > 0 {
        words.push(english_below_1000(rest));
    }
    words.join(" ")
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Op {
    Match,
    Sub,
    Del,
}

#[derive(Debug, Clone)]
pub struct Pair {
    pub op: Op,
    pub hyp: Option<Range<usize>>,
    /// Position and size of a group of reference tokens heard as one word.
    pub part: (usize, usize),
}

#[derive(Debug, Clone)]
pub struct Alignment {
    pub errors: usize,
    pub pairs: Vec<Pair>,
    pub inserted: Vec<usize>,
    words: usize,
}

impl Alignment {
    /// Word error rate: substitutions, deletions and insertions over the reference words.
    pub fn wer(&self) -> f64 {
        self.errors as f64 / self.words.max(1) as f64
    }
}

#[derive(Clone, Copy)]
enum Back {
    None,
    Match,
    Sub,
    Merge(usize),
    Split(usize),
    Del,
    Ins,
}

fn equal(r: &RefToken, h: &HypToken) -> bool {
    r.wildcard || r.norm == h.norm || h.alts.contains(&r.norm)
}

pub fn align(reference: &[RefToken], hyp: &[HypToken]) -> Alignment {
    let (n, m) = (reference.len(), hyp.len());
    let width = m + 1;
    let mut cost = vec![u32::MAX; (n + 1) * width];
    let mut back = vec![Back::None; (n + 1) * width];
    cost[0] = 0;
    for i in 0..=n {
        for j in 0..=m {
            if i == 0 && j == 0 {
                continue;
            }
            let mut best = (u32::MAX, Back::None);
            let mut consider = |from: u32, add: u32, step: Back| {
                let total = from.saturating_add(add);
                if total < best.0 {
                    best = (total, step);
                }
            };
            if i > 0 && j > 0 {
                let same = equal(&reference[i - 1], &hyp[j - 1]);
                consider(
                    cost[(i - 1) * width + j - 1],
                    u32::from(!same),
                    if same { Back::Match } else { Back::Sub },
                );
            }
            for k in 2..=3 {
                if i > 0 && j >= k && !reference[i - 1].wildcard {
                    let joined: String = hyp[j - k..j].iter().map(|h| h.norm.as_str()).collect();
                    if joined == reference[i - 1].norm {
                        consider(cost[(i - 1) * width + j - k], 0, Back::Merge(k));
                    }
                }
                if j > 0 && i >= k && reference[i - k..i].iter().all(|r| !r.wildcard) {
                    let joined: String = reference[i - k..i]
                        .iter()
                        .map(|r| r.norm.as_str())
                        .collect();
                    let h = &hyp[j - 1];
                    if joined == h.norm || h.alts.contains(&joined) {
                        consider(cost[(i - k) * width + j - 1], 0, Back::Split(k));
                    }
                }
            }
            if i > 0 {
                consider(
                    cost[(i - 1) * width + j],
                    u32::from(!reference[i - 1].wildcard),
                    Back::Del,
                );
            }
            if j > 0 {
                consider(cost[i * width + j - 1], 1, Back::Ins);
            }
            cost[i * width + j] = best.0;
            back[i * width + j] = best.1;
        }
    }
    let mut pairs = vec![
        Pair {
            op: Op::Del,
            hyp: None,
            part: (0, 1)
        };
        n
    ];
    let mut inserted = Vec::new();
    let (mut i, mut j) = (n, m);
    while i > 0 || j > 0 {
        match back[i * width + j] {
            Back::Match | Back::Sub => {
                let op = if matches!(back[i * width + j], Back::Match) {
                    Op::Match
                } else {
                    Op::Sub
                };
                pairs[i - 1] = Pair {
                    op,
                    hyp: Some(j - 1..j),
                    part: (0, 1),
                };
                i -= 1;
                j -= 1;
            }
            Back::Merge(k) => {
                pairs[i - 1] = Pair {
                    op: Op::Match,
                    hyp: Some(j - k..j),
                    part: (0, 1),
                };
                i -= 1;
                j -= k;
            }
            Back::Split(k) => {
                for q in 0..k {
                    pairs[i - k + q] = Pair {
                        op: Op::Match,
                        hyp: Some(j - 1..j),
                        part: (q, k),
                    };
                }
                i -= k;
                j -= 1;
            }
            Back::Del => {
                i -= 1;
            }
            Back::Ins => {
                inserted.push(j - 1);
                j -= 1;
            }
            Back::None => break,
        }
    }
    inserted.reverse();
    Alignment {
        errors: cost[n * width + m] as usize,
        pairs,
        inserted,
        words: reference.iter().filter(|r| !r.wildcard).count(),
    }
}

/// Start and end of each reference token from the aligned transcript words, `None` if unheard.
pub fn times(
    reference: &[RefToken],
    hyp: &[HypToken],
    alignment: &Alignment,
) -> Vec<Option<(f64, f64)>> {
    let mut out = vec![None; reference.len()];
    let mut i = 0;
    while i < reference.len() {
        let pair = &alignment.pairs[i];
        let Some(range) = pair.hyp.clone() else {
            i += 1;
            continue;
        };
        let (start, end) = (hyp[range.start].start, hyp[range.end - 1].end);
        let (_, size) = pair.part;
        if size > 1 {
            // Several reference words heard as one: share its span by length.
            let group = &reference[i..i + size];
            let total: usize = group.iter().map(|r| r.norm.chars().count().max(1)).sum();
            let mut at = start;
            for (q, token) in group.iter().enumerate() {
                let share = (end - start) * token.norm.chars().count().max(1) as f64 / total as f64;
                out[i + q] = Some((at, at + share));
                at += share;
            }
            i += size;
        } else {
            out[i] = Some((start, end));
            i += 1;
        }
    }
    out
}

/// Fills unheard words evenly between their neighbours.
pub fn fill(times: &[Option<(f64, f64)>]) -> Vec<(f64, f64)> {
    let mut out = Vec::with_capacity(times.len());
    let mut i = 0;
    while i < times.len() {
        if let Some(t) = times[i] {
            out.push(t);
            i += 1;
            continue;
        }
        let run_end = (i..times.len())
            .find(|&k| times[k].is_some())
            .unwrap_or(times.len());
        let from = out.last().map(|t: &(f64, f64)| t.1).unwrap_or(0.0);
        let count = run_end - i;
        let to = times
            .get(run_end)
            .and_then(|t| t.map(|t| t.0))
            .unwrap_or(from + 0.3 * count as f64)
            .max(from);
        let step = (to - from) / count as f64;
        for k in 0..count {
            out.push((from + step * k as f64, from + step * (k + 1) as f64));
        }
        i = run_end;
    }
    out
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Difference {
    pub expected: String,
    pub heard: String,
    pub at: f64,
}

/// What was said differently, for listening checks. `times` are the reference words' times
/// (from `fill`), so passes without timings still point to a moment in the take.
pub fn differences(
    reference: &[RefToken],
    hyp: &[HypToken],
    alignment: &Alignment,
    times: &[(f64, f64)],
) -> Vec<Difference> {
    let at = |index: usize| times.get(index).map(|t| t.0).unwrap_or(0.0);
    let heard = |range: &Range<usize>| {
        let mut words: Vec<&str> = Vec::new();
        for h in &hyp[range.clone()] {
            if words.last() != Some(&h.surface.as_str()) {
                words.push(&h.surface);
            }
        }
        words.join(" ")
    };
    let mut out = Vec::new();
    for (index, (token, pair)) in reference.iter().zip(&alignment.pairs).enumerate() {
        match pair.op {
            Op::Sub => out.push(Difference {
                expected: token.surface.clone(),
                heard: pair.hyp.as_ref().map(heard).unwrap_or_default(),
                at: at(index),
            }),
            Op::Del if !token.wildcard => out.push(Difference {
                expected: token.surface.clone(),
                heard: String::new(),
                at: at(index),
            }),
            _ => {}
        }
    }
    for &inserted in &alignment.inserted {
        let next = alignment
            .pairs
            .iter()
            .position(|p| p.hyp.as_ref().is_some_and(|r| r.start > inserted));
        out.push(Difference {
            expected: String::new(),
            heard: hyp[inserted].surface.clone(),
            at: next
                .map(at)
                .unwrap_or_else(|| times.last().map(|t| t.1).unwrap_or(0.0)),
        });
    }
    out.sort_by(|a, b| a.at.total_cmp(&b.at));
    for difference in &mut out {
        difference.at = (difference.at * 1000.0).round() / 1000.0;
    }
    out
}

/// Terms the reference contains more often than the transcript.
pub fn missing_terms(terms: &[String], reference: &[RefToken], hyp: &[HypToken]) -> Vec<String> {
    let count = |norms: &[&str], term: &str| {
        let mut found = 0;
        for start in 0..norms.len() {
            let mut joined = String::new();
            for norm in norms.iter().skip(start).take(4) {
                joined.push_str(norm);
                if joined == term {
                    found += 1;
                    break;
                }
                if joined.len() >= term.len() {
                    break;
                }
            }
        }
        found
    };
    let r: Vec<&str> = reference.iter().map(|t| t.norm.as_str()).collect();
    let h: Vec<&str> = hyp.iter().map(|t| t.norm.as_str()).collect();
    terms
        .iter()
        .filter(|term| {
            let norm: String = parts(term)
                .flat_map(|p| p.split_whitespace())
                .map(normalize)
                .collect();
            !norm.is_empty() && count(&h, &norm) < count(&r, &norm)
        })
        .cloned()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn words(list: &[(&str, f64, f64)]) -> Vec<Word> {
        list.iter()
            .map(|&(text, start, end)| Word {
                text: text.into(),
                start,
                end,
            })
            .collect()
    }

    #[test]
    fn german_numbers() {
        assert_eq!(german_words(1), "eins");
        assert_eq!(german_words(21), "einundzwanzig");
        assert_eq!(german_words(30), "dreißig");
        assert_eq!(german_words(101), "einhunderteins");
        assert_eq!(german_words(1997), "eintausendneunhundertsiebenundneunzig");
        assert_eq!(german_words(31_000), "einunddreißigtausend");
        assert_eq!(german_words(2_500_000), "zwei millionen fünfhunderttausend");
        assert_eq!(
            english_words(1997),
            "one thousand nine hundred ninety seven"
        );
    }

    #[test]
    fn digits_match_spoken_numbers_and_years() {
        let reference = reference(
            "In dreißig Sekunden, seit neunzehnhundertsiebenundneunzig.",
            Syntax::Gemini,
        );
        let hyp = hypothesis(
            &words(&[
                ("In", 0.0, 0.1),
                ("30", 0.1, 0.5),
                ("Sekunden,", 0.5, 0.9),
                ("seit", 0.9, 1.0),
                ("1997.", 1.0, 1.8),
            ]),
            "de",
        );
        let alignment = align(&reference, &hyp);
        assert_eq!(
            alignment.errors,
            0,
            "{:?}",
            differences(&reference, &hyp, &alignment, &[])
        );
        assert!(reference.last().unwrap().sentence_end);
    }

    #[test]
    fn split_and_joined_words_cost_nothing() {
        let reference = reference("ChatGPT und Co Pilot nutzen KI-Tools.", Syntax::Gemini);
        let hyp = hypothesis(
            &words(&[
                ("Chat", 0.0, 0.2),
                ("GPT", 0.2, 0.5),
                ("und", 0.5, 0.6),
                ("Copilot", 0.6, 1.0),
                ("nutzen", 1.0, 1.3),
                ("KI", 1.3, 1.5),
                ("Tools", 1.5, 1.9),
            ]),
            "de",
        );
        let alignment = align(&reference, &hyp);
        assert_eq!(alignment.errors, 0);
        let times = times(&reference, &hyp, &alignment);
        // "Co" and "Pilot" share the span of "Copilot".
        let (co, pilot) = (times[2].unwrap(), times[3].unwrap());
        assert!((co.0 - 0.6).abs() < 1e-9 && (pilot.1 - 1.0).abs() < 1e-9);
        assert!(co.1 <= pilot.0 + 1e-9);
    }

    #[test]
    fn errors_are_counted_and_reported() {
        let reference = reference("Claude kennt viele Skills.", Syntax::Gemini);
        let hyp = hypothesis(
            &words(&[
                ("Clod", 0.0, 0.3),
                ("kennt", 0.3, 0.6),
                ("Skills", 0.6, 1.0),
                ("ja", 1.0, 1.1),
            ]),
            "de",
        );
        let alignment = align(&reference, &hyp);
        assert_eq!(alignment.errors, 3);
        assert!((alignment.wer() - 0.75).abs() < 1e-9);
        let filled = fill(&times(&reference, &hyp, &alignment));
        let diff = differences(&reference, &hyp, &alignment, &filled);
        assert_eq!(diff.len(), 3);
        assert_eq!(diff[0].expected, "Claude");
        assert_eq!(diff[0].heard, "Clod");
        assert_eq!(diff[1].expected, "viele");
        assert_eq!(diff[2].heard, "ja");
        assert!(filled[2].0 >= filled[1].1 - 1e-9 && filled[2].1 <= filled[3].0 + 1e-9);
        assert_eq!(
            missing_terms(&["Claude".into(), "Skills".into()], &reference, &hyp),
            ["Claude"]
        );
    }

    #[test]
    fn tags_and_ipa_follow_the_model_syntax() {
        let gemini = reference(
            "Stell dir vor, <short pause> du hast KEINE Zeit.",
            Syntax::Gemini,
        );
        assert_eq!(gemini.len(), 7);
        assert_eq!(gemini[5].norm, "keine");
        let eleven = reference("[warm] Hallo /klɔːd/ Claude.", Syntax::ElevenLabs);
        assert_eq!(eleven.len(), 3);
        assert!(eleven[1].wildcard);
        // IPA before or instead of the word both align without errors.
        let hyp = hypothesis_text("Hallo Claude", "de");
        assert_eq!(align(&eleven, &hyp).errors, 0);
        assert_eq!(
            segments("a <b> c", Syntax::Gemini),
            [
                Segment::Text("a ".into()),
                Segment::Tag("b".into()),
                Segment::Text(" c".into())
            ]
        );
    }

    #[test]
    fn percent_and_decimals() {
        let reference = reference("zwei Komma fünf Prozent", Syntax::Gemini);
        let hyp = hypothesis_text("2,5 %", "de");
        assert_eq!(align(&reference, &hyp).errors, 0);
        let hyp = hypothesis_text("2,5%", "de");
        assert_eq!(align(&reference, &hyp).errors, 0);
    }
}
