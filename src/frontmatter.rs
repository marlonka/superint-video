//! Minimal `---` front matter: `key: value` lines, `[a, b]` lists and quoted strings.
use std::collections::BTreeMap;

pub struct FrontMatter {
    pub values: BTreeMap<String, String>,
    pub body: String,
    /// 1-based line number of the first body line in the original text.
    pub body_line: usize,
}

pub fn split(text: &str) -> FrontMatter {
    let text = text.trim_start_matches('\u{feff}');
    let lines: Vec<&str> = text.lines().collect();
    if lines.first().map(|l| l.trim()) == Some("---")
        && let Some(end) = lines.iter().skip(1).position(|l| l.trim() == "---")
    {
        let end = end + 1;
        let values = lines[1..end]
            .iter()
            .filter(|line| !line.trim_start().starts_with('#'))
            .filter_map(|line| line.split_once(':'))
            .map(|(key, value)| (key.trim().to_string(), value.trim().to_string()))
            .filter(|(key, _)| !key.is_empty())
            .collect();
        return FrontMatter {
            values,
            body: lines[end + 1..].join("\n"),
            body_line: end + 2,
        };
    }
    FrontMatter {
        values: BTreeMap::new(),
        body: text.to_string(),
        body_line: 1,
    }
}

/// A scalar without its quotes; JSON-style double quotes are unescaped.
pub fn string(value: &str) -> String {
    let value = value.trim();
    if value.starts_with('"') {
        if let Ok(text) = serde_json::from_str::<String>(value) {
            return text;
        }
        return value.trim_matches('"').to_string();
    }
    if value.len() >= 2 && value.starts_with('\'') && value.ends_with('\'') {
        return value[1..value.len() - 1].to_string();
    }
    value.to_string()
}

/// `[a, "b c"]` or `a, b`.
pub fn list(value: &str) -> Vec<String> {
    let value = value.trim();
    let inner = value
        .strip_prefix('[')
        .and_then(|v| v.strip_suffix(']'))
        .unwrap_or(value);
    inner
        .split(',')
        .map(string)
        .filter(|item| !item.is_empty())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_values_and_body() {
        let doc = split(
            "---\nvoice: Charon\nstyle: \"calm, warm\"\nterms: [Claude, \"Chat GPT\", Copilot]\n# note\n---\n\nErster Absatz.\n",
        );
        assert_eq!(doc.values["voice"], "Charon");
        assert_eq!(string(&doc.values["style"]), "calm, warm");
        assert_eq!(
            list(&doc.values["terms"]),
            ["Claude", "Chat GPT", "Copilot"]
        );
        assert_eq!(doc.body.trim(), "Erster Absatz.");
        assert_eq!(doc.body_line, 7);
        let plain = split("Nur Text");
        assert!(plain.values.is_empty());
        assert_eq!(plain.body, "Nur Text");
    }
}
