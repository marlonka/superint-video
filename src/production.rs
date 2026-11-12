//! What Studio shows about a production while the agent works: the brief, the preset and
//! skills in use, the references, the agent's own status file, working documents and the
//! most recent changes. Everything is read from project files; the tool interprets nothing.
use crate::{
    frontmatter,
    project::{modified_ms, safe_path},
};
use anyhow::{Result, bail};
use serde_json::{Value, json};
use std::{fs, path::Path};
use walkdir::WalkDir;

/// The agent's status file: `{"step", "note", "steps": [{"name", "state"}]}`.
pub const STATUS: &str = "process/status.json";
const DOCUMENT_TYPES: &[&str] = &["md", "json", "txt"];
const MAX_DOCUMENT: u64 = 1024 * 1024;
const SKIPPED: &[&str] = &["renders", "node_modules", "target", "kit"];

/// The agent's status file, when it is there and reads as an object.
pub fn status(root: &Path) -> Option<Value> {
    fs::read(root.join(STATUS))
        .ok()
        .filter(|b| b.len() < 64 * 1024)
        .and_then(|b| serde_json::from_slice::<Value>(&b).ok())
        .filter(Value::is_object)
}

fn relative(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

/// The first paragraph under a `## <heading>` of a markdown body.
fn section(body: &str, heading: &str) -> Option<String> {
    let mut lines = body
        .lines()
        .skip_while(|l| l.trim() != format!("## {heading}"));
    lines.next()?;
    let text = lines
        .skip_while(|l| l.trim().is_empty())
        .take_while(|l| !l.trim().is_empty() && !l.starts_with("## "))
        .collect::<Vec<_>>()
        .join(" ");
    (!text.is_empty() && !text.starts_with("TODO")).then_some(text)
}

pub fn summary(root: &Path) -> Value {
    let brief = fs::read_to_string(root.join("brief.md")).ok().map(|text| {
        let parsed = frontmatter::split(&text);
        let get = |key: &str| parsed.values.get(key).map(|v| frontmatter::string(v));
        json!({
            "topic": get("topic"),
            "message": section(&parsed.body, "Message"),
            "seconds": get("seconds").and_then(|s| s.parse::<u32>().ok()),
            "format": get("format"),
            "language": get("language"),
            "workflow": get("workflow").filter(|w| w != "none"),
            "preset": get("preset"),
            "stops": parsed.values.get("stops").map(|v| frontmatter::list(v)).unwrap_or_default(),
        })
    });
    let preset = fs::read(root.join("preset.json"))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
        .map(|p| json!({"name": p["name"], "title": p["title"], "description": p["description"]}));

    let workflow = brief
        .as_ref()
        .and_then(|b| b["workflow"].as_str().map(str::to_owned));
    let audio = ["voice.md", "music-prompt.md", "sfx.json", "audio"]
        .iter()
        .any(|p| root.join(p).exists());
    let mut skills = vec!["superint-video".to_string()];
    skills.extend(workflow);
    if audio {
        skills.push("superint-audio".into());
    }

    let mut references: Vec<String> = fs::read_dir(root.join("references"))
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.is_file() && p.file_name().is_some_and(|n| n != "README.md"))
        .map(|p| relative(root, &p))
        .collect();
    references.sort();

    let status = status(root);

    let mut documents = Vec::new();
    let mut activity = Vec::new();
    let mut scenes = 0;
    for entry in WalkDir::new(root)
        .max_depth(3)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            e.depth() == 0
                || !(name.starts_with('.')
                    || (e.depth() == 1
                        && e.file_type().is_dir()
                        && SKIPPED.iter().any(|s| name.eq_ignore_ascii_case(s))))
        })
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let path = entry.path();
        let rel = relative(root, path);
        let modified = modified_ms(path);
        if rel.starts_with("scenes/") && rel.ends_with(".html") && !rel.contains("/lib/") {
            scenes += 1;
        }
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        let top = !rel.contains('/');
        if ext == "md" && (top || rel.starts_with("process/")) {
            documents.push(json!({"path": rel, "modified": modified}));
        }
        activity.push((modified, rel));
    }
    documents.sort_by_key(|d| std::cmp::Reverse(d["modified"].as_u64()));
    activity.sort_by_key(|a| std::cmp::Reverse(a.0));
    let activity: Vec<Value> = activity
        .into_iter()
        .take(8)
        .map(|(modified, path)| json!({"path": path, "modified": modified}))
        .collect();
    let now = crate::project::now_ms();

    // The contact sheet the agent made last: what it is looking at right now.
    let latest_look = WalkDir::new(root.join("renders"))
        .max_depth(4)
        .into_iter()
        .filter_entry(|e| !e.file_name().to_string_lossy().starts_with('.'))
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file() && e.file_name() == "contact-sheet.png")
        .map(|e| (modified_ms(e.path()), relative(root, e.path())))
        .max_by_key(|l| l.0)
        .map(|(modified, path)| json!({"path": path, "modified": modified}));

    json!({
        "brief": brief,
        "polish": crate::polish::overview(root),
        "latestLook": latest_look,
        "preset": preset,
        "skills": skills,
        "references": references,
        "status": status,
        "documents": documents,
        "activity": activity,
        "scenes": scenes,
        "now": now,
    })
}

/// A working document for Studio's read-only viewer: markdown, JSON or text inside the
/// project, never hidden files such as `.env`.
pub fn document(root: &Path, relative: &str) -> Result<String> {
    if relative.split(['/', '\\']).any(|p| p.starts_with('.')) {
        bail!("Hidden project files are not shown");
    }
    let path = safe_path(root, relative)?;
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    if !DOCUMENT_TYPES.contains(&ext.to_ascii_lowercase().as_str()) {
        bail!("Only markdown, JSON and text documents are shown");
    }
    if fs::metadata(&path)?.len() > MAX_DOCUMENT {
        bail!("Document is larger than 1 MB");
    }
    Ok(fs::read_to_string(path)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn summary_reads_brief_preset_status_and_documents() {
        let dir = TempDir::new().unwrap();
        let root = dir.path();
        fs::write(
            root.join("brief.md"),
            "---\npreset: blank\nworkflow: superint-launch\ntopic: \"Acme 2\"\nseconds: 25\nstops: [script]\n---\n\n# Brief\n\n## Message\n\nAcme ships faster.\n\n## Audience\n\nTeams\n",
        )
        .unwrap();
        fs::write(
            root.join("preset.json"),
            r#"{"name":"blank","title":"Blank","description":"d"}"#,
        )
        .unwrap();
        fs::create_dir_all(root.join("process")).unwrap();
        fs::write(
            root.join(STATUS),
            r#"{"step":"Copy","note":"writing lines"}"#,
        )
        .unwrap();
        fs::create_dir_all(root.join("references")).unwrap();
        fs::write(root.join("references/a.png"), b"x").unwrap();
        fs::write(root.join("references/README.md"), b"x").unwrap();
        fs::create_dir_all(root.join("scenes/lib")).unwrap();
        fs::write(root.join("scenes/hook.html"), b"x").unwrap();
        fs::write(root.join("scenes/lib/people.js"), b"x").unwrap();
        fs::write(root.join("script.md"), b"x").unwrap();
        fs::write(root.join(".env"), b"SECRET=1").unwrap();
        fs::write(root.join("voice.md"), b"x").unwrap();

        let s = summary(root);
        assert_eq!(s["brief"]["topic"], "Acme 2");
        assert_eq!(s["brief"]["message"], "Acme ships faster.");
        assert_eq!(s["brief"]["seconds"], 25);
        assert_eq!(s["preset"]["title"], "Blank");
        assert_eq!(
            s["skills"],
            json!(["superint-video", "superint-launch", "superint-audio"])
        );
        assert_eq!(s["references"], json!(["references/a.png"]));
        assert_eq!(s["status"]["step"], "Copy");
        assert_eq!(s["scenes"], 1);
        let docs: Vec<&str> = s["documents"]
            .as_array()
            .unwrap()
            .iter()
            .map(|d| d["path"].as_str().unwrap())
            .collect();
        assert!(docs.contains(&"script.md") && docs.contains(&"brief.md"));
        assert!(!s["activity"].to_string().contains(".env"));

        assert_eq!(document(root, "script.md").unwrap(), "x");
        assert!(document(root, ".env").is_err());
        assert!(document(root, "scenes/hook.html").is_err());
        assert!(document(root, "../outside.md").is_err());
    }

    #[test]
    fn todo_message_is_left_out() {
        assert_eq!(section("## Message\n\nTODO: write it\n", "Message"), None);
        assert_eq!(
            section("## Message\n\nLine one\nline two\n\n## Next", "Message").as_deref(),
            Some("Line one line two")
        );
    }
}
