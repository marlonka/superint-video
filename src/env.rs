//! API keys from the process environment, a `.env` file or the app's own store, in that order.
//! Values leave this module only through `Secret::expose` at the HTTP boundary;
//! they never appear in output, logs or error messages.
use anyhow::{Context, Result};
use serde::Serialize;
use std::{
    collections::BTreeMap,
    fmt, fs,
    path::{Path, PathBuf},
};

pub const GEMINI: &str = "GEMINI_API_KEY";
pub const OPENROUTER: &str = "OPENROUTER_API_KEY";
pub const KNOWN: &[&str] = &[GEMINI, OPENROUTER];
/// Other names the same key is commonly stored under, as (alias, canonical name).
const ALIASES: &[(&str, &str)] = &[("GOOGLE_API_KEY", GEMINI)];

#[derive(Clone)]
pub struct Secret(String);
impl Secret {
    pub fn expose(&self) -> &str {
        &self.0
    }
}
impl fmt::Debug for Secret {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("[redacted]")
    }
}

/// Where a key was found, with the name it was found under.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Source {
    Environment(&'static str),
    File(&'static str),
    App,
}

impl Source {
    /// The kind of place, as the app's Setup names it.
    pub fn kind(&self) -> &'static str {
        match self {
            Self::Environment(_) => "environment",
            Self::File(_) => "file",
            Self::App => "app",
        }
    }
}

impl fmt::Display for Source {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Environment(name) => write!(f, "environment ({name})"),
            Self::File(name) => write!(f, ".env ({name})"),
            Self::App => f.write_str("app"),
        }
    }
}

impl Serialize for Source {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.collect_str(self)
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyStatus {
    pub name: &'static str,
    pub present: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<Source>,
}

#[derive(Debug, Clone, Default)]
pub struct Keys {
    values: BTreeMap<&'static str, (Secret, Source)>,
    /// The `.env` file that was read, if any.
    pub file: Option<PathBuf>,
    /// The app's key store, when this computer has a user folder.
    pub store: Option<PathBuf>,
}

impl Keys {
    /// Reads `SUPERINT_ENV`, else the first `.env` above `start`, the working directory or the
    /// executable, then the keys saved in the app. Process variables win over the file, and the
    /// file over the app.
    pub fn load(start: &Path) -> Result<Self> {
        Self::load_with(start, crate::home::dir().as_deref())
    }

    /// `load` with the user folder given, so tests never touch the real one.
    pub fn load_with(start: &Path, home: Option<&Path>) -> Result<Self> {
        let store = home.map(crate::home::KeyStore::at);
        // Opening the store means decrypting it: only when a key is still missing.
        let saved = std::cell::OnceCell::new();
        let saved = || saved.get_or_init(|| store.as_ref().map(|s| s.read()).unwrap_or_default());
        let file = find_file(start);
        let from_file = match &file {
            Some(path) => parse(
                &fs::read_to_string(path)
                    .with_context(|| format!("Cannot read {}", path.display()))?,
            ),
            None => BTreeMap::new(),
        };
        let mut values = BTreeMap::new();
        for &name in KNOWN {
            let names: Vec<&'static str> = std::iter::once(name)
                .chain(
                    ALIASES
                        .iter()
                        .filter(|(_, canonical)| *canonical == name)
                        .map(|(alias, _)| *alias),
                )
                .collect();
            let given = |value: Option<&String>| value.filter(|v| !v.trim().is_empty()).cloned();
            let found = names
                .iter()
                .find_map(|&n| {
                    given(std::env::var(n).ok().as_ref()).map(|v| (v, Source::Environment(n)))
                })
                .or_else(|| {
                    names
                        .iter()
                        .find_map(|&n| given(from_file.get(n)).map(|v| (v, Source::File(n))))
                })
                .or_else(|| given(saved().get(name)).map(|v| (v, Source::App)));
            if let Some((value, source)) = found {
                values.insert(name, (Secret(value.trim().to_string()), source));
            }
        }
        Ok(Self {
            values,
            file,
            store: store.map(|s| s.path().to_path_buf()),
        })
    }

    pub fn get(&self, name: &str) -> Option<&Secret> {
        self.values.get(name).map(|(secret, _)| secret)
    }

    /// The message tells a coding agent where the key goes: into the app, typed by the user.
    pub fn require(&self, name: &str) -> Result<&Secret> {
        self.get(name).with_context(|| {
            let place = match &self.file {
                Some(path) => format!("to {}", path.display()),
                None => "to a .env file in the project or repository root".into(),
            };
            format!(
                "{name} is missing. The user adds it under Setup in the app (`superint-video app` opens it); a key never goes through the chat. A line `{name}=<key>` added {place} works too"
            )
        })
    }

    pub fn status(&self) -> Vec<KeyStatus> {
        KNOWN
            .iter()
            .map(|&name| KeyStatus {
                name,
                present: self.values.contains_key(name),
                source: self.values.get(name).map(|(_, source)| *source),
            })
            .collect()
    }

    /// Removes every key value from text that might echo a request, such as a provider error.
    pub fn redact(&self, text: &str) -> String {
        let mut text = text.to_string();
        for (secret, _) in self.values.values() {
            if secret.0.len() >= 8 {
                text = text.replace(&secret.0, "[redacted]");
            }
        }
        text
    }
}

fn find_file(start: &Path) -> Option<PathBuf> {
    if let Some(path) = std::env::var_os("SUPERINT_ENV") {
        return Some(PathBuf::from(path));
    }
    let mut roots = vec![start.to_path_buf()];
    if let Ok(cwd) = std::env::current_dir() {
        roots.push(cwd);
    }
    if let Some(dir) = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(Path::to_path_buf))
    {
        roots.push(dir);
    }
    roots.into_iter().find_map(|root| {
        let root = root
            .canonicalize()
            .map(|path| crate::project::without_verbatim(&path))
            .unwrap_or(root);
        root.ancestors()
            .map(|dir| dir.join(".env"))
            .find(|candidate| candidate.is_file())
    })
}

/// `KEY=value` lines with optional `export`, quotes and `#` comments.
fn parse(text: &str) -> BTreeMap<String, String> {
    let mut values = BTreeMap::new();
    for line in text.lines() {
        let line = line.trim().trim_start_matches('\u{feff}');
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let line = line.strip_prefix("export ").unwrap_or(line);
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let value = value.trim();
        let value = ['"', '\'']
            .iter()
            .find_map(|&quote| {
                value
                    .strip_prefix(quote)
                    .and_then(|rest| rest.split_once(quote))
                    .map(|(inner, _)| inner)
            })
            .unwrap_or_else(|| value.split(" #").next().unwrap_or_default().trim());
        values.insert(key.trim().to_string(), value.to_string());
    }
    values
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_quotes_comments_and_export() {
        let values = parse(
            "\u{feff}# keys\nexport GEMINI_API_KEY=\"abc def\" # note\nOPENROUTER_API_KEY=xyz # comment\nEMPTY=\nBROKEN\nQUOTED='a#b'\n",
        );
        assert_eq!(values["GEMINI_API_KEY"], "abc def");
        assert_eq!(values["OPENROUTER_API_KEY"], "xyz");
        assert_eq!(values["EMPTY"], "");
        assert_eq!(values["QUOTED"], "a#b");
        assert!(!values.contains_key("BROKEN"));
    }

    #[test]
    fn secrets_never_print() {
        let mut keys = Keys::default();
        keys.values.insert(
            GEMINI,
            (Secret("very-secret-value".into()), Source::File(GEMINI)),
        );
        assert_eq!(format!("{:?}", keys.get(GEMINI).unwrap()), "[redacted]");
        assert!(!format!("{keys:?}").contains("very-secret-value"));
        assert_eq!(
            keys.redact("bad key very-secret-value here"),
            "bad key [redacted] here"
        );
        let status = serde_json::to_string(&keys.status()).unwrap();
        assert!(!status.contains("very-secret-value"));
        assert!(status.contains("\"present\":true"));
    }

    #[test]
    fn missing_key_names_the_file_without_values() {
        let keys = Keys {
            file: Some(PathBuf::from("C:/project/.env")),
            ..Keys::default()
        };
        let message = keys.require(GEMINI).unwrap_err().to_string();
        assert!(message.contains("GEMINI_API_KEY"));
        assert!(message.contains(".env"));
        assert!(message.contains("superint-video app"));
    }

    #[test]
    fn a_key_saved_in_the_app_is_found_and_a_file_wins_over_it() {
        // The variables would win over both; skip on a machine that has them set.
        if KNOWN.iter().any(|name| std::env::var_os(name).is_some())
            || std::env::var_os("GOOGLE_API_KEY").is_some()
            || std::env::var_os("SUPERINT_ENV").is_some()
        {
            return;
        }
        let home = tempfile::TempDir::new().unwrap();
        let project = tempfile::TempDir::new().unwrap();
        crate::home::KeyStore::at(home.path())
            .set(OPENROUTER, "saved-in-the-app-0001")
            .unwrap();
        fs::write(
            project.path().join(".env"),
            "OPENROUTER_API_KEY=
",
        )
        .unwrap();
        let keys = Keys::load_with(project.path(), Some(home.path())).unwrap();
        assert_eq!(
            keys.get(OPENROUTER).unwrap().expose(),
            "saved-in-the-app-0001"
        );
        let status = keys.status();
        let entry = status.iter().find(|s| s.name == OPENROUTER).unwrap();
        assert_eq!(entry.source, Some(Source::App));
        assert!(keys.get(GEMINI).is_none());

        fs::write(
            project.path().join(".env"),
            "OPENROUTER_API_KEY=from-the-file-0002
",
        )
        .unwrap();
        let keys = Keys::load_with(project.path(), Some(home.path())).unwrap();
        assert_eq!(keys.get(OPENROUTER).unwrap().expose(), "from-the-file-0002");
    }
}
