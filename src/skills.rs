//! The coding agents on this computer and the Superint skills in their folders: which are
//! there, which differ from the ones this app ships, and bringing them to the app's version.
use anyhow::{Context, Result};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
};
use walkdir::WalkDir;

pub const SKILLS: &[&str] = &[
    "superint-video",
    "superint-explainer",
    "superint-launch",
    "superint-audio",
    "superint-miniature",
];

/// A coding agent that can operate Superint Video once it has the skills.
pub struct Agent {
    pub id: &'static str,
    pub title: &'static str,
    /// Its folder in the user's home; its skills are in `skills` there.
    folder: &'static str,
    /// Folders in the user's home that are there once it is installed.
    found_by: &'static [&'static str],
    /// Files in the user's home where it keeps the MCP servers of every project.
    mcp_files: &'static [&'static str],
    pub get: &'static str,
}

/// The MCP server that lets a coding agent open web pages and take screenshots of them, as
/// its package is named in the agents' settings (github.com/ChromeDevTools/chrome-devtools-mcp).
pub const BROWSER_SERVER: &str = "chrome-devtools-mcp";
/// Claude Code's file of its own settings, which also holds each project's MCP servers.
const CLAUDE_FILE: &str = ".claude.json";

pub const AGENTS: &[Agent] = &[
    Agent {
        id: "claude",
        title: "Claude Code",
        folder: ".claude",
        found_by: &[".claude"],
        // Its own servers, and the plugin that brings the server with skills.
        mcp_files: &[CLAUDE_FILE, ".claude/plugins/installed_plugins.json"],
        get: "https://claude.com/product/claude-code",
    },
    Agent {
        id: "codex",
        title: "ChatGPT Codex",
        folder: ".codex",
        found_by: &[".codex"],
        mcp_files: &[".codex/config.toml"],
        get: "https://openai.com/codex/",
    },
    // Global skills live in `~/.gemini/config/skills`, shared by the Antigravity app and its
    // CLI; the app also still reads the older `~/.gemini/antigravity/skills` (checked
    // 2026-11-12, antigravity.google/docs/skills).
    Agent {
        id: "antigravity",
        title: "Google Antigravity",
        folder: ".gemini/config",
        found_by: &[
            ".gemini/antigravity",
            ".gemini/antigravity-cli",
            ".gemini/config",
        ],
        // The global MCP servers (antigravity.google/docs/mcp, checked 2026-11-12), and where
        // the app kept them before.
        mcp_files: &[
            ".gemini/config/mcp_config.json",
            ".gemini/antigravity/mcp_config.json",
        ],
        get: "https://antigravity.google/",
    },
];

impl Agent {
    pub fn find(id: &str) -> Option<&'static Agent> {
        AGENTS.iter().find(|agent| agent.id == id)
    }

    fn user() -> Option<PathBuf> {
        std::env::var_os("USERPROFILE")
            .or_else(|| std::env::var_os("HOME"))
            .map(PathBuf::from)
    }

    pub fn home(&self) -> Option<PathBuf> {
        Some(Self::user()?.join(self.folder))
    }

    pub fn installed(&self) -> bool {
        Self::user().is_some_and(|user| self.found_by.iter().any(|dir| user.join(dir).is_dir()))
    }

    pub fn skills_dir(&self) -> Option<PathBuf> {
        Some(self.home()?.join("skills"))
    }

    /// Whether the agent can open web pages through the Chrome DevTools MCP server in every
    /// project. Its settings are read, never changed.
    pub fn has_browser(&self) -> bool {
        Self::user().is_some_and(|user| self.has_browser_in(&user))
    }

    fn has_browser_in(&self, user: &Path) -> bool {
        self.mcp_files.iter().any(|file| {
            let Ok(text) = fs::read_to_string(user.join(file)) else {
                return false;
            };
            // Claude Code keeps every project's servers in the same file: only its own count.
            if *file == CLAUDE_FILE {
                return serde_json::from_str::<Value>(&text).is_ok_and(|settings| {
                    settings["mcpServers"].to_string().contains(BROWSER_SERVER)
                });
            }
            text.contains(BROWSER_SERVER)
        })
    }
}

/// The skills that ship next to the executable (`dist/skills`), in a Mac app's resources
/// (`Superint Video.app/Contents/Resources/skills`) or in the repository it was built in.
pub fn shipped() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    exe.ancestors()
        .skip(1)
        .take(4)
        .flat_map(|dir| [dir.join("skills"), dir.join("Resources").join("skills")])
        .find(|dir| dir.join("superint-video/SKILL.md").is_file())
}

/// How a skill in an agent's folder compares to the one this app ships.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum State {
    Missing,
    /// The same files as the app's.
    Current,
    /// Other files than the app's: an earlier version, or one the user changed.
    Differs,
    /// A link, as developers set up to work on a skill. It counts as there and is never touched.
    Linked,
}

type Fingerprint = [u8; 32];

/// One number for a skill: the path and bytes of every file in it. None without a `SKILL.md`.
fn fingerprint(skill: &Path) -> Option<Fingerprint> {
    if !skill.join("SKILL.md").is_file() {
        return None;
    }
    let mut files: Vec<(String, PathBuf)> = WalkDir::new(skill)
        .follow_links(false)
        .into_iter()
        .flatten()
        .filter(|entry| entry.file_type().is_file())
        .filter_map(|entry| {
            let name = entry
                .path()
                .strip_prefix(skill)
                .ok()?
                .to_string_lossy()
                .replace('\\', "/");
            Some((name, entry.into_path()))
        })
        .collect();
    files.sort();
    let mut hash = Sha256::new();
    for (name, path) in files {
        let bytes = fs::read(path).ok()?;
        hash.update(name.as_bytes());
        hash.update([0]);
        hash.update((bytes.len() as u64).to_le_bytes());
        hash.update(bytes);
    }
    Some(hash.finalize().into())
}

fn compare(shipped: Option<Fingerprint>, installed: &Path) -> State {
    let Ok(found) = installed.symlink_metadata() else {
        return State::Missing;
    };
    if found.file_type().is_symlink() {
        return State::Linked;
    }
    match (fingerprint(installed), shipped) {
        (None, _) => State::Missing,
        (Some(have), Some(want)) if have != want => State::Differs,
        _ => State::Current,
    }
}

/// What each of the app's skills should be, in the order of `SKILLS`.
fn wanted(shipped: Option<&Path>) -> Vec<Option<Fingerprint>> {
    SKILLS
        .iter()
        .map(|name| shipped.and_then(|root| fingerprint(&root.join(name))))
        .collect()
}

/// The state of every skill in one folder of installed skills.
fn states(wanted: &[Option<Fingerprint>], installed: &Path) -> Vec<(&'static str, State)> {
    SKILLS
        .iter()
        .zip(wanted)
        .map(|(name, want)| (*name, compare(*want, &installed.join(name))))
        .collect()
}

/// Which coding agents are on this computer, and whether their skills are there and are the
/// app's own.
pub fn describe() -> Vec<Value> {
    let shipped = shipped();
    // Read once for every agent: the app's skills are the same for all of them.
    let wanted = wanted(shipped.as_deref());
    AGENTS
        .iter()
        .map(|agent| {
            let found = agent
                .skills_dir()
                .map(|dir| states(&wanted, &dir))
                .unwrap_or_else(|| SKILLS.iter().map(|name| (*name, State::Missing)).collect());
            let named = |wanted: State| -> Vec<&str> {
                found
                    .iter()
                    .filter(|(_, state)| *state == wanted)
                    .map(|(name, _)| *name)
                    .collect()
            };
            let missing = named(State::Missing);
            json!({
                "id": agent.id,
                "title": agent.title,
                "found": agent.installed(),
                "browser": agent.installed() && agent.has_browser(),
                "ready": missing.is_empty(),
                "missing": missing,
                "outdated": named(State::Differs),
                "skills": SKILLS.len(),
                "canInstall": shipped.is_some(),
                "get": agent.get,
            })
        })
        .collect()
}

/// What `sync` did, by skill name.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Synced {
    pub added: Vec<&'static str>,
    pub updated: Vec<&'static str>,
}

fn copy_folder(from: &Path, to: &Path) -> Result<()> {
    for entry in WalkDir::new(from).follow_links(false) {
        let entry = entry?;
        let target = to.join(entry.path().strip_prefix(from)?);
        if entry.file_type().is_dir() {
            fs::create_dir_all(&target)?;
        } else if entry.file_type().is_file() {
            fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

/// Moves a folder, across drives too.
fn move_folder(from: &Path, to: &Path) -> Result<()> {
    if fs::rename(from, to).is_ok() {
        return Ok(());
    }
    if from.is_dir() {
        copy_folder(from, to)?;
        fs::remove_dir_all(from)?;
    } else {
        fs::copy(from, to)?;
        fs::remove_file(from)?;
    }
    Ok(())
}

/// Brings the skills in `installed` to the app's version: adds the missing ones and replaces
/// the ones that differ. What gets replaced is kept in `replaced`, one earlier version per
/// skill, so a change the user made to a skill is never lost. Linked skills stay as they are.
pub fn sync(shipped: &Path, installed: &Path, replaced: &Path) -> Result<Synced> {
    let mut done = Synced::default();
    for (name, state) in states(&wanted(Some(shipped)), installed) {
        let from = shipped.join(name);
        if matches!(state, State::Current | State::Linked) || !from.join("SKILL.md").is_file() {
            continue;
        }
        fs::create_dir_all(installed)?;
        let target = installed.join(name);
        // The new copy is complete before the old one moves away.
        let fresh = installed.join(format!(".{name}.incoming"));
        let _ = fs::remove_dir_all(&fresh);
        copy_folder(&from, &fresh).with_context(|| format!("Copying the skill {name}"))?;
        if target.symlink_metadata().is_ok() {
            let kept = replaced.join(name);
            let _ = fs::remove_dir_all(&kept);
            fs::create_dir_all(replaced)?;
            move_folder(&target, &kept)
                .with_context(|| format!("Keeping the earlier version of {name}"))?;
        }
        fs::rename(&fresh, &target)
            .with_context(|| format!("Putting the skill {name} in place"))?;
        match state {
            State::Differs => done.updated.push(name),
            _ => done.added.push(name),
        }
    }
    Ok(done)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn write(path: PathBuf, text: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, text).unwrap();
    }

    #[test]
    fn skills_are_added_updated_and_what_was_there_is_kept() {
        let root = TempDir::new().unwrap();
        let (shipped, installed, replaced) = (
            root.path().join("shipped"),
            root.path().join("agent/skills"),
            root.path().join("replaced"),
        );
        for name in SKILLS {
            write(shipped.join(name).join("SKILL.md"), &format!("# {name} v2"));
            write(shipped.join(name).join("references/a.md"), "a");
        }
        // One skill is the app's, one is an earlier version, one folder is broken, two are missing.
        copy_folder(&shipped.join(SKILLS[0]), &installed.join(SKILLS[0])).unwrap();
        write(installed.join(SKILLS[1]).join("SKILL.md"), "# my own notes");
        write(
            installed.join(SKILLS[2]).join("stray.txt"),
            "no SKILL.md here",
        );

        let before = states(&wanted(Some(&shipped)), &installed);
        assert_eq!(before[0].1, State::Current);
        assert_eq!(before[1].1, State::Differs);
        assert_eq!(before[2].1, State::Missing);
        assert_eq!(before[3].1, State::Missing);

        let done = sync(&shipped, &installed, &replaced).unwrap();
        assert_eq!(done.updated, vec![SKILLS[1]]);
        assert_eq!(done.added, vec![SKILLS[2], SKILLS[3], SKILLS[4]]);
        assert!(
            states(&wanted(Some(&shipped)), &installed)
                .iter()
                .all(|(_, state)| *state == State::Current)
        );
        // The user's version of the replaced skill is still on the computer.
        assert_eq!(
            fs::read_to_string(replaced.join(SKILLS[1]).join("SKILL.md")).unwrap(),
            "# my own notes"
        );
        assert!(replaced.join(SKILLS[2]).join("stray.txt").is_file());
        // Nothing is left over next to the skills, and a second run has nothing to do.
        assert_eq!(fs::read_dir(&installed).unwrap().count(), SKILLS.len());
        assert_eq!(
            sync(&shipped, &installed, &replaced).unwrap(),
            Synced::default()
        );
    }

    /// A skill folder the user linked in, as a working copy of these skills is, stays theirs.
    #[cfg(windows)]
    #[test]
    fn a_linked_skill_is_never_touched() {
        use std::os::windows::process::CommandExt;
        let root = TempDir::new().unwrap();
        let (shipped, installed, replaced, own) = (
            root.path().join("shipped"),
            // mklink reads a forward slash as the start of an option.
            root.path().join("agent").join("skills"),
            root.path().join("replaced"),
            root.path().join("own"),
        );
        for name in SKILLS {
            write(shipped.join(name).join("SKILL.md"), &format!("# {name} v2"));
        }
        write(own.join("SKILL.md"), "# my working copy");
        fs::create_dir_all(&installed).unwrap();
        let link = installed.join(SKILLS[0]);
        let made = std::process::Command::new("cmd.exe")
            .args(["/d", "/c", "mklink", "/J"])
            .arg(&link)
            .arg(&own)
            .creation_flags(0x08000000)
            .output()
            .unwrap();
        assert!(
            made.status.success(),
            "{}",
            String::from_utf8_lossy(&made.stderr)
        );
        assert_eq!(
            states(&wanted(Some(&shipped)), &installed)[0].1,
            State::Linked
        );

        let done = sync(&shipped, &installed, &replaced).unwrap();
        assert!(!done.added.contains(&SKILLS[0]) && !done.updated.contains(&SKILLS[0]));
        assert_eq!(
            fs::read_to_string(link.join("SKILL.md")).unwrap(),
            "# my working copy"
        );
        assert!(!replaced.join(SKILLS[0]).exists());
    }

    #[test]
    fn without_the_apps_skills_an_installed_one_counts_as_current() {
        let root = TempDir::new().unwrap();
        write(root.path().join(SKILLS[0]).join("SKILL.md"), "# here");
        let found = states(&wanted(None), root.path());
        assert_eq!(found[0].1, State::Current);
        assert_eq!(found[1].1, State::Missing);
    }

    #[test]
    fn agents_are_described_without_guessing() {
        let listed = describe();
        assert_eq!(listed.len(), AGENTS.len());
        for agent in &listed {
            assert_eq!(agent["skills"], SKILLS.len());
            assert!(agent["get"].as_str().unwrap().starts_with("https://"));
            let missing = agent["missing"].as_array().unwrap().len();
            assert_eq!(agent["ready"], missing == 0);
            assert!(agent["outdated"].is_array());
        }
    }

    #[test]
    fn the_browser_server_is_found_where_each_agent_keeps_its_own() {
        let user = TempDir::new().unwrap();
        let agent = |id| Agent::find(id).unwrap();
        for id in ["claude", "codex", "antigravity"] {
            assert!(!agent(id).has_browser_in(user.path()), "{id}");
        }
        // Claude Code: a server of one project is not the agent's own; its own is.
        write(
            user.path().join(CLAUDE_FILE),
            r#"{"projects": {"C:/x": {"mcpServers": {"chrome-devtools": {"command": "npx", "args": ["chrome-devtools-mcp@latest"]}}}}}"#,
        );
        assert!(!agent("claude").has_browser_in(user.path()));
        write(
            user.path().join(CLAUDE_FILE),
            r#"{"mcpServers": {"chrome-devtools": {"command": "cmd", "args": ["/c", "npx", "-y", "chrome-devtools-mcp@latest"]}}}"#,
        );
        assert!(agent("claude").has_browser_in(user.path()));
        write(
            user.path().join(".codex/config.toml"),
            "[mcp_servers.chrome-devtools]
command = \"cmd\"
args = [\"/c\", \"npx\", \"-y\", \"chrome-devtools-mcp@latest\"]
",
        );
        assert!(agent("codex").has_browser_in(user.path()));
        write(
            user.path().join(".gemini/config/mcp_config.json"),
            r#"{"mcpServers": {"chrome-devtools": {"command": "npx", "args": ["-y", "chrome-devtools-mcp@latest"]}}}"#,
        );
        assert!(agent("antigravity").has_browser_in(user.path()));
    }
}
