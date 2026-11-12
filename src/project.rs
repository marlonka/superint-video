//! Filesystem boundaries, revision-checked editing and frozen render inputs.
use crate::model::{Manifest, validate_relative_path};
use anyhow::{Context, Result, bail, ensure};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tempfile::TempDir;
use walkdir::WalkDir;

const HISTORY_LIMIT: usize = 100;
const EXCLUDED_DIRECTORIES: &[&str] = &[".superint", "renders", ".git", "node_modules", "target"];

pub struct ProjectStore {
    pub root: PathBuf,
    pub manifest: Manifest,
    pub revision: String,
    undo: Vec<Manifest>,
    redo: Vec<Manifest>,
}

/// Keep this value alive throughout rendering: dropping it removes the frozen input directory.
pub struct ProjectSnapshot {
    pub root: PathBuf,
    pub manifest: Manifest,
    pub revision: String,
    _directory: TempDir,
}

impl ProjectStore {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let path = path.as_ref();
        let directory = if path.is_file() {
            ensure!(
                path.file_name().and_then(|n| n.to_str()) == Some("video.json"),
                "project manifest must be named video.json"
            );
            path.parent().context("manifest has no directory")?
        } else {
            path
        };
        let root = directory
            .canonicalize()
            .with_context(|| format!("cannot open project {}", directory.display()))?;
        ensure!(root.is_dir(), "project path is not a directory");
        let (manifest, revision) = read_state(&root)?;
        Ok(Self {
            root,
            manifest,
            revision,
            undo: Vec::new(),
            redo: Vec::new(),
        })
    }

    pub fn can_undo(&self) -> bool {
        !self.undo.is_empty()
    }
    pub fn can_redo(&self) -> bool {
        !self.redo.is_empty()
    }

    /// External changes replace the in-memory model and invalidate edit history.
    /// Invalid external content never replaces the last valid in-memory manifest.
    pub fn reload(&mut self) -> Result<bool> {
        let revision = content_revision(&self.root)?;
        if revision == self.revision {
            return Ok(false);
        }
        self.undo.clear();
        self.redo.clear();
        let (manifest, revision) = read_state(&self.root)?;
        self.manifest = manifest;
        self.revision = revision;
        Ok(true)
    }

    pub fn edit(&mut self, expected: &str, operation: &Value) -> Result<()> {
        self.ensure_current(expected)?;
        let next = self.manifest.apply_operation(operation)?;
        self.persist(expected, &next)?;
        let previous = std::mem::replace(&mut self.manifest, next);
        self.undo.push(previous);
        if self.undo.len() > HISTORY_LIMIT {
            self.undo.remove(0);
        }
        self.redo.clear();
        Ok(())
    }

    /// Several operations as one edit: validated and written once, one undo step. Each write checks
    /// the project against the disk, which takes seconds once scenes are large.
    pub fn edit_many(&mut self, expected: &str, operations: &[Value]) -> Result<()> {
        self.ensure_current(expected)?;
        let mut next = self.manifest.clone();
        for operation in operations {
            next = next.apply_operation(operation)?;
        }
        self.persist(expected, &next)?;
        let previous = std::mem::replace(&mut self.manifest, next);
        self.undo.push(previous);
        if self.undo.len() > HISTORY_LIMIT {
            self.undo.remove(0);
        }
        self.redo.clear();
        Ok(())
    }

    pub fn undo(&mut self, expected: &str) -> Result<()> {
        self.ensure_current(expected)?;
        let next = self.undo.last().context("nothing to undo")?.clone();
        self.persist(expected, &next)?;
        self.undo.pop();
        self.redo.push(std::mem::replace(&mut self.manifest, next));
        Ok(())
    }

    pub fn redo(&mut self, expected: &str) -> Result<()> {
        self.ensure_current(expected)?;
        let next = self.redo.last().context("nothing to redo")?.clone();
        self.persist(expected, &next)?;
        self.redo.pop();
        self.undo.push(std::mem::replace(&mut self.manifest, next));
        Ok(())
    }

    fn ensure_current(&mut self, expected: &str) -> Result<()> {
        ensure!(
            expected == self.revision,
            "stale revision: reload project before editing"
        );
        if content_revision(&self.root)? != self.revision {
            self.undo.clear();
            self.redo.clear();
            // Preserve an invalid external file; never overwrite it with the previous valid model.
            let _ = self.reload();
            bail!("stale revision: project files changed externally; reload before editing");
        }
        Ok(())
    }

    fn persist(&mut self, expected: &str, manifest: &Manifest) -> Result<()> {
        manifest.validate()?;
        let mut bytes = serde_json::to_vec_pretty(manifest)?;
        bytes.push(b'\n');
        // The final check narrows the unavoidable race with uncooperative external writers.
        self.ensure_current(expected)?;
        let target = safe_path(&self.root, "video.json")?;
        atomic_write(&target, &bytes)?;
        let (persisted, revision) = read_state(&self.root)?;
        if persisted != *manifest {
            self.undo.clear();
            self.redo.clear();
            self.manifest = persisted;
            self.revision = revision;
            bail!(
                "stale revision: another writer replaced the saved manifest; reload before editing"
            );
        }
        self.revision = revision;
        Ok(())
    }

    /// Copy immutable render inputs and verify both source and destination content hashes.
    pub fn snapshot(&self) -> Result<ProjectSnapshot> {
        let before = project_files(&self.root)?;
        let before_revision = hash_files(&before)?;
        ensure!(
            before_revision == self.revision,
            "stale revision: reload before taking a snapshot"
        );
        let directory = tempfile::Builder::new()
            .prefix("superint-render-")
            .tempdir()?;
        let root = directory.path().canonicalize()?;
        for (relative, source) in &before {
            let target = safe_path(&root, relative)?;
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(source, &target)
                .with_context(|| format!("snapshot copy failed: {relative}"))?;
        }
        let copied_revision = content_revision(&root)?;
        let after_revision = content_revision(&self.root)?;
        ensure!(
            before_revision == after_revision && before_revision == copied_revision,
            "project changed while preparing render snapshot; retry"
        );
        // Parse the frozen bytes so renderer and copied manifest cannot diverge.
        let manifest: Manifest = serde_json::from_slice(&fs::read(root.join("video.json"))?)?;
        manifest.validate()?;
        Ok(ProjectSnapshot {
            root,
            manifest,
            revision: before_revision,
            _directory: directory,
        })
    }
}

/// Resolve a portable relative path while rejecting traversal and symlink/junction escapes.
/// Missing final components are allowed, so callers can safely create new local assets.
pub fn safe_path(root: &Path, relative: &str) -> Result<PathBuf> {
    validate_relative_path(relative)?;
    let canonical_root = root
        .canonicalize()
        .with_context(|| format!("cannot resolve project root {}", root.display()))?;
    let mut resolved = canonical_root.clone();
    for component in relative.split('/') {
        resolved.push(component);
        match fs::symlink_metadata(&resolved) {
            Ok(_) => {
                resolved = resolved
                    .canonicalize()
                    .with_context(|| format!("cannot resolve project path {relative}"))?;
                ensure!(
                    resolved.starts_with(&canonical_root),
                    "path escapes project through symlink: {relative}"
                );
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                return Err(error)
                    .with_context(|| format!("cannot inspect project path {relative}"));
            }
        }
    }
    ensure!(
        resolved.starts_with(&canonical_root),
        "path escapes project: {relative}"
    );
    Ok(resolved)
}

/// Same-directory temp file + synced atomic replacement. No delete-then-rename gap on Windows.
pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    let parent = path.parent().context("output path has no parent")?;
    fs::create_dir_all(parent)?;
    let mut temporary = tempfile::Builder::new()
        .prefix(".superint-write-")
        .tempfile_in(parent)?;
    temporary.write_all(bytes)?;
    temporary.as_file().sync_all()?;
    temporary
        .persist(path)
        .map_err(|e| e.error)
        .with_context(|| format!("cannot atomically replace {}", path.display()))?;
    #[cfg(unix)]
    fs::File::open(parent)?.sync_all()?;
    Ok(())
}

/// Canonical path without the Windows verbatim prefix (`\\?\C:\…`), for paths shown to people
/// and pasted into agent prompts.
pub fn display_path(path: &Path) -> Result<PathBuf> {
    Ok(without_verbatim(&fs::canonicalize(path)?))
}

/// Drops the verbatim prefix from an already resolved path; UNC paths keep it.
pub fn without_verbatim(path: &Path) -> PathBuf {
    match path.to_string_lossy().strip_prefix(r"\\?\") {
        Some(rest) if !rest.starts_with("UNC\\") => PathBuf::from(rest),
        _ => path.to_path_buf(),
    }
}

/// Milliseconds since 1970, the way every record of the tool keeps time.
pub fn millis(time: SystemTime) -> u64 {
    time.duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as u64)
}

pub fn now_ms() -> u64 {
    millis(SystemTime::now())
}

/// When a file was last written; 0 when that cannot be read.
pub fn modified_ms(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .map_or(0, millis)
}

fn read_state(root: &Path) -> Result<(Manifest, String)> {
    let before = content_revision(root)?;
    let manifest_path = safe_path(root, "video.json")?;
    let bytes = fs::read(&manifest_path)
        .with_context(|| format!("cannot read {}", manifest_path.display()))?;
    let manifest: Manifest = serde_json::from_slice(&bytes).context("invalid video.json")?;
    manifest.validate().context("invalid video.json")?;
    for clip in &manifest.clips {
        safe_path(root, &clip.src).with_context(|| format!("clip {}", clip.id))?;
    }
    let after = content_revision(root)?;
    ensure!(before == after, "project changed while reading; retry");
    Ok((manifest, after))
}

/// Content-derived revision includes scene/asset edits, not just video.json changes.
pub fn content_revision(root: &Path) -> Result<String> {
    hash_files(&project_files(root)?)
}

/// Top-level folders that never change a pixel.
const NOT_PICTURE: &[&str] = &["process", "references", "audio"];

/// Revision of everything that can change a frame: like `content_revision`, but without notes,
/// references, audio with its recipes, and the audio clips of `video.json`. A polish pass stays
/// valid while this stands, whatever is logged, mixed or reported afterwards.
pub fn picture_revision(root: &Path) -> Result<String> {
    let mut files = project_files(root)?;
    files.retain(|relative, _| match relative.split_once('/') {
        Some((top, _)) => !NOT_PICTURE
            .iter()
            .any(|name| top.eq_ignore_ascii_case(name)),
        None => {
            !(relative.ends_with(".md")
                || matches!(relative.as_str(), "video.json" | "sfx.json" | "mix.json"))
        }
    });
    let mut manifest: Value = serde_json::from_slice(&fs::read(safe_path(root, "video.json")?)?)
        .context("invalid video.json")?;
    if let Some(clips) = manifest.get_mut("clips").and_then(Value::as_array_mut) {
        clips.retain(|clip| clip["type"] != "audio");
    }
    if let Some(tracks) = manifest.get_mut("tracks").and_then(Value::as_array_mut) {
        tracks.retain(|track| track["kind"] != "audio");
    }
    let mut hash = Sha256::new();
    hash.update(hash_files(&files)?);
    hash.update(serde_json::to_vec(&manifest)?);
    Ok(hex::encode(hash.finalize()))
}

fn project_files(root: &Path) -> Result<BTreeMap<String, PathBuf>> {
    let canonical_root = root.canonicalize()?;
    let mut files = BTreeMap::new();
    // An explicitly referenced source directory is input even if named `renders`.
    let referenced_roots: BTreeSet<String> = fs::read(canonical_root.join("video.json"))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
        .and_then(|manifest| manifest.get("clips").and_then(Value::as_array).cloned())
        .unwrap_or_default()
        .iter()
        .filter_map(|clip| clip.get("src").and_then(Value::as_str))
        .filter_map(|path| path.split('/').next())
        .map(str::to_owned)
        .collect();
    let walker = WalkDir::new(&canonical_root)
        .follow_links(true)
        .into_iter()
        .filter_entry(|entry| {
            !(entry.depth() == 1
                && entry.file_type().is_dir()
                && EXCLUDED_DIRECTORIES
                    .iter()
                    .any(|name| entry.file_name().eq_ignore_ascii_case(name))
                && !referenced_roots
                    .iter()
                    .any(|name| entry.file_name().eq_ignore_ascii_case(name)))
                && !entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with(".superint-write-")
        });
    for entry in walker {
        let entry = entry.context("cannot enumerate project files")?;
        if entry.depth() == 0 {
            continue;
        }
        let relative = entry
            .path()
            .strip_prefix(&canonical_root)?
            .to_str()
            .context("project paths must be valid Unicode")?
            .replace('\\', "/");
        let resolved = safe_path(&canonical_root, &relative)?;
        if entry.file_type().is_file() {
            files.insert(relative, resolved);
        }
    }
    ensure!(
        files.contains_key("video.json"),
        "project is missing video.json"
    );
    Ok(files)
}

fn hash_files(files: &BTreeMap<String, PathBuf>) -> Result<String> {
    let mut hash = Sha256::new();
    let mut buffer = [0_u8; 65_536];
    for (relative, path) in files {
        hash.update((relative.len() as u64).to_le_bytes());
        hash.update(relative.as_bytes());
        let mut file =
            fs::File::open(path).with_context(|| format!("cannot read project file {relative}"))?;
        // Include a per-file digest so file concatenations cannot have ambiguous boundaries.
        let mut file_hash = Sha256::new();
        loop {
            let count = file.read(&mut buffer)?;
            if count == 0 {
                break;
            }
            file_hash.update(&buffer[..count]);
        }
        hash.update(file_hash.finalize());
    }
    Ok(hex::encode(hash.finalize()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn fixture() -> TempDir {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join("scenes")).unwrap();
        fs::write(dir.path().join("scenes/one.html"), "<p>Original scene</p>").unwrap();
        fs::write(dir.path().join("video.json"), serde_json::to_vec_pretty(&json!({"version":1,"width":1280,"height":720,
            "fps":{"num":30,"den":1},"durationFrames":90,"tracks":[{"id":"visuals","kind":"visual"}],
            "clips":[{"id":"intro","type":"scene","src":"scenes/one.html","track":"visuals","startFrame":0,"durationFrames":90}]})).unwrap()).unwrap();
        dir
    }

    #[test]
    fn edits_undo_redo_and_reopening_preserve_user_work() {
        let dir = fixture();
        let mut store = ProjectStore::open(dir.path()).unwrap();
        let original_revision = store.revision.clone();
        store
            .edit(
                &original_revision,
                &json!({"type":"updateClip","id":"intro","changes":{"props":{"title":"Edited"}}}),
            )
            .unwrap();
        assert_eq!(
            ProjectStore::open(dir.path()).unwrap().manifest.clips[0].props["title"],
            "Edited"
        );
        assert!(store.can_undo());
        store.undo(&store.revision.clone()).unwrap();
        assert!(store.manifest.clips[0].props.is_empty());
        assert!(store.can_redo());
        store.redo(&store.revision.clone()).unwrap();
        assert_eq!(store.manifest.clips[0].props["title"], "Edited");
        assert!(
            store
                .edit(
                    &original_revision,
                    &json!({"type":"deleteClip","id":"intro"})
                )
                .unwrap_err()
                .to_string()
                .starts_with("stale revision:")
        );
        assert_eq!(
            ProjectStore::open(dir.path()).unwrap().manifest.clips.len(),
            1
        );
    }

    #[test]
    fn computed_gains_survive_the_saved_manifest_check() {
        // Gains from loudness measurements are arbitrary f64s; reading one back must give the
        // same value, or every save looks like an external writer.
        let dir = fixture();
        let mut store = ProjectStore::open(dir.path()).unwrap();
        for step in 0..400 {
            let gain = 10f64.powf(-(step as f64) * 0.0731 / 20.0);
            let revision = store.revision.clone();
            store
                .edit(
                    &revision,
                    &json!({"type":"updateClip","id":"intro","changes":{"gain":gain}}),
                )
                .unwrap_or_else(|error| panic!("gain {gain:?}: {error}"));
        }
    }

    #[test]
    fn external_edits_invalidate_history_and_cannot_be_overwritten() {
        let dir = fixture();
        let mut store = ProjectStore::open(dir.path()).unwrap();
        store
            .edit(
                &store.revision.clone(),
                &json!({"type":"updateProject","changes":{"name":"Studio edit"}}),
            )
            .unwrap();
        let revision = store.revision.clone();
        let mut external = store.manifest.clone();
        external.name = "Agent edit".into();
        atomic_write(
            &dir.path().join("video.json"),
            &serde_json::to_vec(&external).unwrap(),
        )
        .unwrap();
        assert!(
            store
                .undo(&revision)
                .unwrap_err()
                .to_string()
                .starts_with("stale revision:")
        );
        assert_eq!(store.manifest.name, "Agent edit");
        assert!(!store.can_undo());
        assert!(!store.can_redo());
        let revision = store.revision.clone();
        fs::write(dir.path().join("video.json"), "{broken").unwrap();
        assert!(
            store
                .edit(
                    &revision,
                    &json!({"type":"updateProject","changes":{"name":"Lost external edit"}})
                )
                .is_err()
        );
        assert_eq!(
            fs::read_to_string(dir.path().join("video.json")).unwrap(),
            "{broken"
        );
    }

    #[test]
    fn snapshots_freeze_assets_and_source_edits_change_revision() {
        let dir = fixture();
        let mut store = ProjectStore::open(dir.path()).unwrap();
        let snapshot = store.snapshot().unwrap();
        let revision = store.revision.clone();
        fs::write(
            dir.path().join("scenes/one.html"),
            "<p>Agent replacement</p>",
        )
        .unwrap();
        assert_eq!(
            fs::read_to_string(snapshot.root.join("scenes/one.html")).unwrap(),
            "<p>Original scene</p>"
        );
        assert_eq!(snapshot.revision, revision);
        assert!(store.snapshot().is_err());
        assert!(store.reload().unwrap());
        assert_ne!(store.revision, revision);
        assert!(!store.reload().unwrap());
    }

    #[test]
    fn output_and_cache_changes_do_not_invalidate_a_project() {
        let dir = fixture();
        let mut store = ProjectStore::open(dir.path()).unwrap();
        for name in ["renders", ".superint"] {
            fs::create_dir(dir.path().join(name)).unwrap();
            fs::write(dir.path().join(name).join("output.bin"), "ignored").unwrap();
        }
        assert!(!store.reload().unwrap());
        let snapshot = store.snapshot().unwrap();
        assert!(!snapshot.root.join("renders").exists());
        assert!(!snapshot.root.join(".superint").exists());
    }

    #[test]
    fn explicitly_referenced_output_is_frozen_as_input() {
        let dir = fixture();
        fs::create_dir(dir.path().join("renders")).unwrap();
        fs::write(
            dir.path().join("renders/source.png"),
            "synthetic image fixture",
        )
        .unwrap();
        let mut manifest: Manifest =
            serde_json::from_slice(&fs::read(dir.path().join("video.json")).unwrap()).unwrap();
        manifest.clips[0].clip_type = crate::model::ClipType::Image;
        manifest.clips[0].src = "renders/source.png".into();
        atomic_write(
            &dir.path().join("video.json"),
            &serde_json::to_vec(&manifest).unwrap(),
        )
        .unwrap();
        let store = ProjectStore::open(dir.path()).unwrap();
        let snapshot = store.snapshot().unwrap();
        assert_eq!(
            fs::read_to_string(snapshot.root.join("renders/source.png")).unwrap(),
            "synthetic image fixture"
        );
    }

    #[test]
    fn confinement_rejects_traversal_and_allows_unicode_new_paths() {
        let dir = fixture();
        for relative in [
            "../outside",
            "/outside",
            "assets/../../outside",
            "C:/Windows/win.ini",
        ] {
            assert!(safe_path(dir.path(), relative).is_err());
        }
        let resolved = safe_path(dir.path(), "assets/München clip.png").unwrap();
        assert!(resolved.starts_with(dir.path().canonicalize().unwrap()));
    }

    #[cfg(unix)]
    #[test]
    fn confinement_rejects_symlink_escape() {
        let dir = fixture();
        let outside = tempfile::tempdir().unwrap();
        fs::write(outside.path().join("secret"), "not project data").unwrap();
        std::os::unix::fs::symlink(outside.path(), dir.path().join("escape")).unwrap();
        assert!(safe_path(dir.path(), "escape/secret").is_err());
        assert!(ProjectStore::open(dir.path()).is_err());
    }

    #[cfg(windows)]
    #[test]
    fn confinement_rejects_windows_junction_escape() {
        use std::os::windows::process::CommandExt;
        let dir = fixture();
        let outside = tempfile::tempdir().unwrap();
        fs::write(outside.path().join("secret"), "not project data").unwrap();
        let output = std::process::Command::new("cmd.exe")
            .args(["/d", "/c", "mklink", "/J"])
            .arg(dir.path().join("escape"))
            .arg(outside.path())
            .creation_flags(0x08000000)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "junction fixture failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(safe_path(dir.path(), "escape/secret").is_err());
        assert!(safe_path(dir.path(), "escape/new-file").is_err());
        assert!(ProjectStore::open(dir.path()).is_err());
        // Remove only the junction entry, never traverse or remove its target.
        fs::remove_dir(dir.path().join("escape")).unwrap();
        assert!(outside.path().join("secret").is_file());
    }
}
