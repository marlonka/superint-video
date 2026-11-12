//! Presets bundle a visual style, scene kit, starter timeline, reference stills and defaults.
//! A project copies its preset completely, so it never depends on the preset afterwards.
//! How a film is planned (explainer, launch film …) lives in workflow skills, not here.
use crate::{
    model::Manifest,
    project::{atomic_write, display_path},
};
use anyhow::{Context, Result, bail};
use include_dir::{Dir, include_dir};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};
use walkdir::WalkDir;

static BUILTIN: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/presets");
pub const CONFIG: &str = "preset.json";
/// How a style file ends: `flat-explainer.superint-style.zip`.
pub const STYLE_FILE: &str = ".superint-style.zip";
const MOST_IMPORT_FILES: usize = 4000;
const MOST_IMPORT_BYTES: u64 = 512 * 1024 * 1024;
/// Folder of reference stills in a preset and in a project.
pub const REFERENCES: &str = "references";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PresetConfig {
    pub version: u32,
    pub name: String,
    pub title: String,
    pub description: String,
    /// Title and description in other languages, by language code ("de"). The app shows the
    /// one of its language; everything else reads `title` and `description`.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub translations: BTreeMap<String, Translation>,
    /// Output sizes by aspect name, e.g. "16:9". The first entry is the default.
    pub formats: BTreeMap<String, Size>,
    pub default_format: String,
    pub defaults: Defaults,
    #[serde(default)]
    pub narration: Narration,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transcription: Option<ModelChoice>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub music: Option<Music>,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Translation {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Size {
    pub width: u32,
    pub height: u32,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Defaults {
    pub seconds: u32,
    pub language: String,
    /// Where the agent waits for the user. The workflow skill defines what each stop means.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub stops: Vec<String>,
    /// How many concepts or directions the agent drafts before choosing one.
    #[serde(default = "default_concepts")]
    pub concepts: u8,
    /// Workflow skill for projects from this preset unless `new --workflow` names another.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workflow: Option<String>,
}
fn default_concepts() -> u8 {
    3
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Narration {
    /// Speaking rate per language tag; `*` is the fallback.
    #[serde(default = "default_rates")]
    pub words_per_minute: BTreeMap<String, u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub voice: Option<String>,
}
fn default_rates() -> BTreeMap<String, u32> {
    BTreeMap::from([("*".to_string(), 150)])
}
impl Default for Narration {
    fn default() -> Self {
        Self {
            words_per_minute: default_rates(),
            model: None,
            voice: None,
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ModelChoice {
    pub model: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Music {
    pub model: String,
    pub prompt: String,
}

impl PresetConfig {
    pub fn parse(bytes: &[u8]) -> Result<Self> {
        let config: Self = serde_json::from_slice(bytes).context("Invalid preset.json")?;
        if config.version != 1 {
            bail!("Unsupported preset version {}", config.version);
        }
        valid_name(&config.name)?;
        if !config.formats.contains_key(&config.default_format) {
            bail!("defaultFormat must name an entry in formats");
        }
        for size in config.formats.values() {
            if size.width == 0 || size.height == 0 || size.width % 2 == 1 || size.height % 2 == 1 {
                bail!("Preset formats require positive even dimensions");
            }
        }
        let rates = &config.narration.words_per_minute;
        if !rates.contains_key("*") || rates.values().any(|&r| r == 0) {
            bail!("narration.wordsPerMinute needs a \"*\" entry and positive rates");
        }
        if config.defaults.seconds == 0 {
            bail!("Preset default length must be positive");
        }
        for stop in &config.defaults.stops {
            valid_word(stop, "Stop")?;
        }
        if let Some(workflow) = &config.defaults.workflow {
            valid_word(workflow, "Workflow")?;
        }
        Ok(config)
    }
}

impl Narration {
    /// Rate for a language: exact tag, then its primary subtag (`de-AT` → `de`), then `*`.
    pub fn rate(&self, language: &str) -> u32 {
        let tag = language.trim().to_ascii_lowercase();
        let primary = tag.split(['-', '_']).next().unwrap_or_default();
        let rates = &self.words_per_minute;
        rates
            .get(&tag)
            .or_else(|| rates.get(primary))
            .or_else(|| rates.get("*"))
            .copied()
            .unwrap_or(150)
    }
}

pub fn valid_name(name: &str) -> Result<()> {
    if name.is_empty()
        || name.len() > 64
        || !name
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    {
        bail!("Preset names use 1-64 lowercase letters, digits and hyphens: {name}");
    }
    Ok(())
}

/// Stop and workflow names: lowercase letters, digits and hyphens, like skill names.
pub fn valid_word(word: &str, what: &str) -> Result<()> {
    if word.is_empty()
        || word.len() > 64
        || !word
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    {
        bail!("{what} names use 1-64 lowercase letters, digits and hyphens: {word}");
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    Builtin,
    User,
    Path,
}

/// A resolved preset with all of its files loaded.
pub struct Preset {
    pub config: PresetConfig,
    pub source: Source,
    pub location: String,
    /// Forward-slash relative path to contents, including preset.json.
    pub files: BTreeMap<String, Vec<u8>>,
}

impl Preset {
    fn load(files: BTreeMap<String, Vec<u8>>, source: Source, location: String) -> Result<Self> {
        let config = PresetConfig::parse(
            files
                .get(CONFIG)
                .with_context(|| format!("{location} has no {CONFIG}"))?,
        )
        .with_context(|| format!("Preset at {location}"))?;
        let manifest = files
            .get("video.json")
            .with_context(|| format!("{location} has no starter video.json"))?;
        serde_json::from_slice::<Manifest>(manifest)
            .context("Preset video.json")?
            .validate()
            .context("Preset video.json")?;
        Ok(Self {
            config,
            source,
            location,
            files,
        })
    }

    /// Resolves a filesystem path, then the user preset directory, then built-in presets.
    pub fn resolve(name: &str) -> Result<Self> {
        let path = Path::new(name);
        if name.contains(['/', '\\']) || path.is_absolute() {
            return Self::from_dir(path, Source::Path);
        }
        valid_name(name)?;
        if let Some(dir) = user_dir().map(|d| d.join(name))
            && dir.is_dir()
        {
            return Self::from_dir(&dir, Source::User);
        }
        if BUILTIN.get_dir(name).is_none() {
            bail!(
                "Unknown preset {name}. Available: {}",
                list()
                    .unwrap_or_default()
                    .iter()
                    .map(|p| p.name.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            );
        }
        Self::builtin(name)
    }

    /// A preset from files that are not on disk yet, checked like any other.
    pub(crate) fn from_files(files: BTreeMap<String, Vec<u8>>, location: &str) -> Result<Self> {
        Self::load(files, Source::User, location.into())
    }

    pub(crate) fn builtin(name: &str) -> Result<Self> {
        let dir = BUILTIN.get_dir(name).context("Missing built-in preset")?;
        let mut files = BTreeMap::new();
        collect_builtin(dir, dir.path(), &mut files);
        // References the user added to a built-in preset live outside the executable.
        if let Some(extra) = builtin_references_dir(name).filter(|d| d.is_dir()) {
            for entry in fs::read_dir(extra)? {
                let path = entry?.path();
                if path.is_file()
                    && let Some(file) = path.file_name()
                {
                    files.insert(
                        format!("{REFERENCES}/{}", file.to_string_lossy()),
                        fs::read(&path)?,
                    );
                }
            }
        }
        Self::load(files, Source::Builtin, format!("builtin:{name}"))
    }

    /// Reference stills and clips the agent compares its frames against.
    pub fn references(&self) -> Vec<&str> {
        let prefix = format!("{REFERENCES}/");
        self.files
            .keys()
            .filter(|k| k.starts_with(&prefix) && !k.ends_with("README.md"))
            .map(String::as_str)
            .collect()
    }

    /// File names in a folder, sorted; empty when it does not exist.
    fn from_dir_files(dir: &Path) -> Result<Vec<String>> {
        if !dir.is_dir() {
            return Ok(Vec::new());
        }
        let mut names = Vec::new();
        for entry in fs::read_dir(dir)? {
            let path = entry?.path();
            if path.is_file()
                && let Some(name) = path.file_name().map(|n| n.to_string_lossy().to_string())
                && name != "README.md"
            {
                names.push(name);
            }
        }
        names.sort();
        Ok(names)
    }

    fn from_dir(dir: &Path, source: Source) -> Result<Self> {
        let mut files = BTreeMap::new();
        for entry in WalkDir::new(dir).follow_links(false) {
            let entry = entry?;
            if !entry.file_type().is_file() {
                continue;
            }
            let relative = entry
                .path()
                .strip_prefix(dir)?
                .components()
                .map(|c| c.as_os_str().to_string_lossy())
                .collect::<Vec<_>>()
                .join("/");
            files.insert(relative, fs::read(entry.path())?);
        }
        Self::load(files, source, dir.display().to_string())
    }

    pub fn size(&self, format: Option<&str>) -> Result<(String, Size)> {
        let name = format.unwrap_or(&self.config.default_format);
        let size = self.config.formats.get(name).with_context(|| {
            format!(
                "Preset {} has no format {name}. Available: {}",
                self.config.name,
                self.config
                    .formats
                    .keys()
                    .cloned()
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        })?;
        Ok((name.to_string(), *size))
    }

    /// Puts a changed configuration back among the files, as `preset.json`.
    pub(crate) fn keep_config(&mut self) -> Result<()> {
        let mut config = serde_json::to_vec_pretty(&self.config)?;
        config.push(b'\n');
        self.files.insert(CONFIG.into(), config);
        Ok(())
    }

    /// Writes every preset file below `root`. Existing files are an error.
    pub fn write_to(&self, root: &Path) -> Result<()> {
        for (relative, bytes) in &self.files {
            let target = root.join(relative);
            if target.exists() {
                bail!("Refusing to overwrite {}", target.display());
            }
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::write(&target, bytes)?;
        }
        Ok(())
    }
}

fn collect_builtin(dir: &Dir<'_>, base: &Path, files: &mut BTreeMap<String, Vec<u8>>) {
    for file in dir.files() {
        let relative = file.path().strip_prefix(base).unwrap_or(file.path());
        files.insert(
            relative.to_string_lossy().replace('\\', "/"),
            file.contents().to_vec(),
        );
    }
    for child in dir.dirs() {
        collect_builtin(child, base, files);
    }
}

/// References added to a built-in preset: `<user presets>/_references/<name>`. The leading
/// underscore can never be a preset name.
fn builtin_references_dir(name: &str) -> Option<PathBuf> {
    user_dir().map(|d| d.join("_references").join(name))
}

/// Copies reference files into a preset: a user preset's own `references/`, or the
/// side folder of a built-in one. Returns the written paths.
pub fn add_references(name: &str, sources: &[PathBuf]) -> Result<Vec<PathBuf>> {
    copy_references(sources, &references_folder(name)?)
}

/// Copies files into `target`, refusing to overwrite. Returns the written paths.
pub fn copy_references(sources: &[PathBuf], target: &Path) -> Result<Vec<PathBuf>> {
    if sources.is_empty() {
        return Ok(Vec::new());
    }
    fs::create_dir_all(target)?;
    let mut written = Vec::new();
    for source in sources {
        if !source.is_file() {
            bail!("Reference is not a file: {}", source.display());
        }
        let name = source
            .file_name()
            .with_context(|| format!("Reference has no file name: {}", source.display()))?;
        let destination = target.join(name);
        if destination.exists() {
            bail!("Refusing to overwrite {}", destination.display());
        }
        fs::copy(source, &destination)
            .with_context(|| format!("Copying reference {}", source.display()))?;
        written.push(destination);
    }
    Ok(written)
}

/// `SUPERINT_PRESETS`, else the per-user configuration directory.
pub fn user_dir() -> Option<PathBuf> {
    if let Some(dir) = std::env::var_os("SUPERINT_PRESETS") {
        return Some(dir.into());
    }
    Some(crate::home::dir()?.join("presets"))
}

#[derive(Debug, Serialize)]
pub struct Summary {
    pub name: String,
    pub title: String,
    pub description: String,
    pub formats: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workflow: Option<String>,
    pub references: usize,
    pub source: Source,
    pub location: String,
}

/// Whether a name can be a file in a preset's references folder: one plain file name.
pub fn reference_file_name(file: &str) -> bool {
    !(file.is_empty() || file.starts_with('.') || file.contains(['/', '\\', ':']))
}

/// One reference picture of a preset, without loading the rest of it.
pub fn reference(name: &str, file: &str) -> Result<Vec<u8>> {
    valid_name(name)?;
    if !reference_file_name(file) {
        bail!("Not a reference file name");
    }
    // The same order as `resolve` and `builtin`: the user's style, else what the user added to
    // a built-in one, else the built-in picture.
    let added = match user_dir().map(|d| d.join(name)).filter(|d| d.is_dir()) {
        Some(own) => Some(own.join(REFERENCES)),
        None => builtin_references_dir(name),
    };
    if let Some(path) = added.map(|d| d.join(file)).filter(|p| p.is_file()) {
        return Ok(fs::read(path)?);
    }
    BUILTIN
        .get_file(format!("{name}/{REFERENCES}/{file}"))
        .map(|found| found.contents().to_vec())
        .context("No such reference")
}

/// The folder where the user adds reference pictures to a preset; created if missing.
pub fn references_folder(name: &str) -> Result<PathBuf> {
    let preset = Preset::resolve(name)?;
    let folder = match preset.source {
        Source::Builtin => builtin_references_dir(&preset.config.name)
            .context("No user preset directory; set SUPERINT_PRESETS")?,
        Source::User | Source::Path => PathBuf::from(&preset.location).join(REFERENCES),
    };
    fs::create_dir_all(&folder)?;
    Ok(folder)
}

/// Every preset, loaded. User presets shadow built-in presets of the same name.
pub fn all() -> Result<Vec<Preset>> {
    let mut found = BTreeMap::new();
    for dir in BUILTIN.dirs() {
        let name = dir.path().to_string_lossy().to_string();
        found.insert(name.clone(), Preset::builtin(&name)?);
    }
    if let Some(root) = user_dir().filter(|d| d.is_dir()) {
        for entry in fs::read_dir(root)? {
            let path = entry?.path();
            if path.join(CONFIG).is_file() {
                let preset = Preset::from_dir(&path, Source::User)?;
                found.insert(preset.config.name.clone(), preset);
            }
        }
    }
    Ok(found.into_values().collect())
}

/// User presets shadow built-in presets of the same name.
pub fn list() -> Result<Vec<Summary>> {
    Ok(all()?
        .into_iter()
        .map(|p| Summary {
            references: p.references().len(),
            workflow: p.config.defaults.workflow.clone(),
            name: p.config.name,
            title: p.config.title,
            description: p.config.description,
            formats: p.config.formats.into_keys().collect(),
            source: p.source,
            location: p.location,
        })
        .collect())
}

/// Copies a preset into the user directory under a new name for customization, plus any
/// reference files given.
pub fn fork(from: &str, name: &str, references: &[PathBuf]) -> Result<PathBuf> {
    valid_name(name)?;
    let mut preset = Preset::resolve(from)?;
    let root = user_dir()
        .context("No user preset directory; set SUPERINT_PRESETS")?
        .join(name);
    if root.exists() {
        bail!("Preset directory already exists: {}", root.display());
    }
    preset.config.name = name.to_string();
    preset.keep_config()?;
    preset.write_to(&root)?;
    copy_references(references, &root.join(REFERENCES))?;
    Ok(root)
}

// ------------------------------------------------------------------------------- style files

/// A style as one file to pass on: a zip of everything in it, `preset.json` at the top.
fn pack(files: &BTreeMap<String, Vec<u8>>) -> Result<Vec<u8>> {
    use std::io::Write;
    let mut zip = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    for (name, bytes) in files {
        zip.start_file(name.as_str(), options)?;
        zip.write_all(bytes)?;
    }
    Ok(zip.finish()?.into_inner())
}

/// Writes a style into `folder` as `<name>.superint-style.zip`, under a name that is free there.
pub fn export_to(name: &str, folder: &Path) -> Result<PathBuf> {
    let preset = Preset::resolve(name)?;
    let bytes = pack(&preset.files)?;
    fs::create_dir_all(folder)?;
    let base = &preset.config.name;
    let mut file = folder.join(format!("{base}{STYLE_FILE}"));
    let mut copy = 1;
    while file.exists() {
        copy += 1;
        file = folder.join(format!("{base} ({copy}){STYLE_FILE}"));
    }
    fs::write(&file, bytes).with_context(|| format!("Writing {}", file.display()))?;
    Ok(file)
}

/// A path inside a style file that every system can hold and that stays inside the style: a
/// project path, short enough for Windows to place below the styles folder.
fn portable_path(name: &str) -> Result<()> {
    crate::model::validate_relative_path(name)
        .ok()
        .filter(|_| {
            name.len() <= 240
                && name
                    .split('/')
                    .all(|part| part.len() <= 120 && !part.starts_with(' '))
        })
        .with_context(|| format!("The style file holds a path that cannot be used: {name}"))
}

/// The files of a style file by their path. Nothing is written: sizes are capped while reading,
/// because what an archive says about itself is not to be trusted.
fn unpack(bytes: &[u8]) -> Result<BTreeMap<String, Vec<u8>>> {
    use std::io::Read;
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(bytes))
        .context("This is not a style file: it cannot be read as a zip archive")?;
    if archive.len() > MOST_IMPORT_FILES {
        bail!("This file holds more than {MOST_IMPORT_FILES} entries; a style has far fewer");
    }
    let mut files = BTreeMap::new();
    let mut left = MOST_IMPORT_BYTES;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index)?;
        if entry.is_dir() {
            continue;
        }
        let name = entry.name()?.replace('\\', "/");
        // What file managers add on their own (`.DS_Store`, `__MACOSX`), and anything hidden.
        if name
            .split('/')
            .any(|part| part == "__MACOSX" || (part.starts_with('.') && part != ".."))
        {
            continue;
        }
        if entry.is_symlink() {
            bail!("The style file holds a link ({name}); a style is made of files only");
        }
        portable_path(&name)?;
        let mut data = Vec::new();
        entry
            .by_ref()
            .take(left + 1)
            .read_to_end(&mut data)
            .with_context(|| format!("Reading {name} from the style file"))?;
        left = left
            .checked_sub(data.len() as u64)
            .context("The style file unpacks to more than 512 MB")?;
        if files.insert(name.clone(), data).is_some() {
            bail!("The style file holds {name} twice");
        }
    }
    if files.contains_key(CONFIG) {
        return Ok(files);
    }
    // Someone zipped the folder instead of what is in it: everything sits one level down.
    let folder = files
        .keys()
        .next()
        .and_then(|name| name.split_once('/'))
        .map(|(first, _)| format!("{first}/"))
        .filter(|prefix| {
            files.keys().all(|name| name.starts_with(prefix))
                && files.contains_key(&format!("{prefix}{CONFIG}"))
        })
        .with_context(|| format!("This is not a style file: it has no {CONFIG}"))?;
    Ok(files
        .into_iter()
        .map(|(name, data)| (name[folder.len()..].to_string(), data))
        .collect())
}

/// A style that came in from a file.
#[derive(Debug, Serialize)]
pub struct Imported {
    pub name: String,
    pub title: String,
    pub path: PathBuf,
}

/// Adds the style in a style file to the user's styles.
pub fn import(bytes: &[u8]) -> Result<Imported> {
    let styles = user_dir().context("No user preset directory; set SUPERINT_PRESETS")?;
    import_into(bytes, &styles)
}

/// A name for a new style in `styles` that no style has: `base`, else `base-2`, `base-3` … and
/// the number it got (1 for `base` itself). A built-in name counts as taken, so nothing is
/// replaced or hidden.
pub fn free_name(base: &str, styles: &Path) -> (String, u32) {
    let taken = |name: &str| styles.join(name).exists() || BUILTIN.get_dir(name).is_some();
    let mut name = base.to_string();
    let mut copy = 1;
    while taken(&name) {
        copy += 1;
        let number = format!("-{copy}");
        name = format!("{}{number}", &base[..base.len().min(64 - number.len())]);
    }
    (name, copy)
}

/// Adds the style in a style file to `styles`. A name that is taken, by one of the user's
/// styles or a built-in one, gets a number, in the title too, so nothing is replaced or hidden.
pub fn import_into(bytes: &[u8], styles: &Path) -> Result<Imported> {
    let mut preset = Preset::load(unpack(bytes)?, Source::User, "the style file".into())?;
    let (name, copy) = free_name(&preset.config.name, styles);
    if copy > 1 {
        let numbered = |title: &str| format!("{title} ({copy})");
        preset.config.name = name.clone();
        preset.config.title = numbered(&preset.config.title);
        for translation in preset.config.translations.values_mut() {
            translation.title = translation.title.as_deref().map(numbered);
        }
        preset.keep_config()?;
    }
    let path = styles.join(&name);
    if let Err(error) = preset.write_to(&path) {
        let _ = fs::remove_dir_all(&path);
        return Err(error);
    }
    Ok(Imported {
        name,
        title: preset.config.title,
        path,
    })
}

pub struct Brief<'a> {
    pub workflow: Option<&'a str>,
    pub topic: Option<&'a str>,
    pub message: Option<&'a str>,
    pub seconds: Option<u32>,
    pub format: Option<&'a str>,
    pub language: Option<&'a str>,
    pub audience: Option<&'a str>,
    pub must: Option<&'a str>,
    pub avoid: Option<&'a str>,
    pub stops: Option<Vec<String>>,
    pub script: Option<String>,
    /// Stills or clips that show the look the user wants; copied into `references/`.
    pub references: Vec<PathBuf>,
    /// Rounds of polish for this film; unset, it follows the user's setting.
    pub polish_rounds: Option<u8>,
}

/// Creates a project from a preset and writes `brief.md` for the agent.
pub fn create_project(
    preset: &Preset,
    directory: &Path,
    brief: &Brief,
) -> Result<serde_json::Value> {
    if directory.exists() && fs::read_dir(directory)?.next().is_some() {
        bail!("Project directory is not empty");
    }
    let config = &preset.config;
    let (format, size) = preset.size(brief.format)?;
    let seconds = brief.seconds.unwrap_or(config.defaults.seconds);
    if seconds == 0 || seconds > 3600 {
        bail!("--seconds must be between 1 and 3600");
    }
    let language = brief.language.unwrap_or(&config.defaults.language);
    // Stops keep the order given; the workflow skill knows when each comes.
    let mut stops: Vec<String> = Vec::new();
    for stop in brief
        .stops
        .clone()
        .unwrap_or_else(|| config.defaults.stops.clone())
    {
        valid_word(&stop, "Stop")?;
        if !stops.contains(&stop) {
            stops.push(stop);
        }
    }
    let workflow = brief
        .workflow
        .map(str::trim)
        .filter(|w| !w.is_empty())
        .or(config.defaults.workflow.as_deref());
    if let Some(workflow) = workflow {
        valid_word(workflow, "Workflow")?;
    }
    let topic = brief.topic.map(str::trim).filter(|t| !t.is_empty());
    if let Some(rounds) = brief.polish_rounds {
        crate::polish::parse_rounds(&rounds.to_string())?;
    }
    for source in &brief.references {
        if !source.is_file() {
            bail!("Reference is not a file: {}", source.display());
        }
    }

    fs::create_dir_all(directory)?;
    preset.write_to(directory)?;
    copy_references(&brief.references, &directory.join(REFERENCES))?;
    let references = Preset::from_dir_files(&directory.join(REFERENCES))?;
    for folder in ["assets", "renders"] {
        fs::create_dir_all(directory.join(folder))?;
    }
    fs::write(directory.join(".gitignore"), ".superint/\nrenders/\n")?;

    // The starter timeline may contain {{topic}}; values are JSON-escaped before parsing.
    let title = topic.unwrap_or("Untitled");
    let escaped = serde_json::to_string(title)?;
    let template =
        String::from_utf8(preset.files["video.json"].clone())?.replace("\"{{topic}}\"", &escaped);
    let mut manifest: Manifest = serde_json::from_str(&template)?;
    manifest.name = crate::home::film_name(title).unwrap_or_else(|| "Untitled".into());
    manifest.width = size.width;
    manifest.height = size.height;
    manifest.duration_frames =
        (u64::from(seconds) * u64::from(manifest.fps.num)).div_ceil(u64::from(manifest.fps.den));
    let end = manifest.duration_frames;
    manifest.clips.retain(|clip| clip.start_frame < end);
    for clip in &mut manifest.clips {
        clip.duration_frames = clip.duration_frames.min(end - clip.start_frame);
    }
    manifest.validate()?;
    let mut bytes = serde_json::to_vec_pretty(&manifest)?;
    bytes.push(b'\n');
    atomic_write(&directory.join("video.json"), &bytes)?;

    let words = u64::from(seconds) * u64::from(config.narration.rate(language)) / 60;
    let fps = if manifest.fps.den == 1 {
        manifest.fps.num.to_string()
    } else {
        format!("{}/{}", manifest.fps.num, manifest.fps.den)
    };
    let script_note = if let Some(script) = &brief.script {
        fs::write(directory.join("script.md"), script)?;
        "The user supplied `script.md`. Keep its wording; add scene markers and fix only obvious errors."
    } else {
        "Not supplied. The workflow skill says when and how to write `script.md`."
    };
    let stops_note = if stops.is_empty() {
        "none: work through to the final render without asking. Decide like a director and justify the decisions in report.md.".to_string()
    } else {
        let mut note = stops
            .iter()
            .map(|stop| format!("- {stop}"))
            .collect::<Vec<_>>()
            .join("\n");
        note.push_str("\n\nAt each stop, show the result briefly and wait for the user. The workflow skill says where each stop falls.");
        note
    };
    let workflow_note = match workflow {
        Some(name) => format!(
            "`{name}`: read that skill after the superint-video skill and follow its steps."
        ),
        None => "None chosen. Ask the user what kind of video this is (an explainer, a launch film …) and name the workflow skill here, or plan it with the superint-video skill alone.".to_string(),
    };
    let references_note = if references.is_empty() {
        "None yet. Ask the user for stills, screenshots or clips of the look they want and put them in `references/`.".to_string()
    } else {
        format!(
            "{}\n\nCompare every style frame and contact sheet with these.",
            references
                .iter()
                .map(|r| format!("- `{REFERENCES}/{r}`"))
                .collect::<Vec<_>>()
                .join("\n")
        )
    };
    let brief_text = format!(
        "---\npreset: {preset}\nworkflow: {workflow_name}\ntopic: {topic_json}\nseconds: {seconds}\nformat: \"{format}\"\nsize: {w}x{h}\nfps: {fps}\nlanguage: {language}\nstops: [{stop_names}]\nconcepts: {concepts}\nnarrationWords: {words}\n{polish_line}---\n\n\
# Brief\n\n\
## Topic\n\n{topic_text}\n\n\
## Message\n\n{message}\n\n\
## Audience\n\n{audience}\n\n\
## Must include\n\n{must}\n\n\
## Avoid\n\n{avoid}\n\n\
## Workflow\n\n{workflow_note}\n\n\
## Look\n\n\
Style preset `{preset}`: its rules are in `STYLE.md`.\n\n\
## References\n\n{references_note}\n\n\
## Script\n\n{script_note}\n\n\
## Stops\n\n{stops_note}\n\n\
## Notes\n\n\
- Add sources, examples, constraints or style wishes here.\n",
        preset = config.name,
        workflow_name = workflow.unwrap_or("none"),
        topic_json = escaped,
        w = size.width,
        h = size.height,
        stop_names = stops.join(", "),
        concepts = config.defaults.concepts,
        polish_line = brief
            .polish_rounds
            .map(|rounds| format!("{}: {rounds}\n", crate::polish::BRIEF_KEY))
            .unwrap_or_default(),
        topic_text = topic.unwrap_or(
            "TODO: what the video is about: the topic, product, release or occasion, and its angle."
        ),
        message = brief.message.map(str::trim).filter(|m| !m.is_empty()).unwrap_or(
            "TODO: the one sentence the viewer should leave with: the argument, the promise or the news."
        ),
        audience = brief.audience.unwrap_or(
            "Curious general audience. Assume no prior knowledge; respect their intelligence."
        ),
        must = brief.must.unwrap_or("Nothing specified."),
        avoid = brief.avoid.unwrap_or("Nothing beyond STYLE.md."),
    );
    fs::write(directory.join("brief.md"), brief_text)?;

    let project = display_path(directory)?;
    let skills = match workflow {
        Some(name) => format!("read the superint-video skill, then the {name} skill"),
        None => "read the superint-video skill".to_string(),
    };
    Ok(serde_json::json!({
        "project": project,
        "preset": config.name,
        "workflow": workflow,
        "format": format,
        "width": size.width,
        "height": size.height,
        "durationFrames": manifest.duration_frames,
        "narrationWords": words,
        "references": references.len(),
        "brief": "brief.md",
        "prompt": format!(
            "Use Superint Video ({skills}). Produce the video in \"{}\" as specified in brief.md.",
            project.display()
        ),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn a_style_travels_as_one_file() {
        let styles = tempfile::tempdir().unwrap();
        let blank = Preset::builtin("blank").unwrap();
        let file = pack(&blank.files).unwrap();
        // `blank` is a built-in name, so the copy that comes in gets a number.
        let first = import_into(&file, styles.path()).unwrap();
        assert_eq!(first.name, "blank-2");
        assert_eq!(first.title, format!("{} (2)", blank.config.title));
        let again = import_into(&file, styles.path()).unwrap();
        assert_eq!(again.name, "blank-3");
        let arrived = Preset::from_dir(&first.path, Source::User).unwrap();
        assert_eq!(arrived.config.name, "blank-2");
        assert_eq!(arrived.files.len(), blank.files.len());
        for (name, bytes) in &blank.files {
            if name != CONFIG {
                assert_eq!(&arrived.files[name], bytes, "{name}");
            }
        }
        // A zip of the folder itself, with what a Mac adds, is the same style.
        let mut wrapped: BTreeMap<String, Vec<u8>> = blank
            .files
            .iter()
            .map(|(name, bytes)| (format!("my style/{name}"), bytes.clone()))
            .collect();
        wrapped.insert("__MACOSX/my style/._preset.json".into(), vec![1]);
        wrapped.insert("my style/.DS_Store".into(), vec![1]);
        let third = import_into(&pack(&wrapped).unwrap(), styles.path()).unwrap();
        assert_eq!(third.name, "blank-4");
        assert!(!third.path.join(".DS_Store").exists());
    }

    #[test]
    fn a_style_file_cannot_reach_outside_its_folder() {
        let styles = tempfile::tempdir().unwrap();
        let blank = Preset::builtin("blank").unwrap();
        let long = format!("kit/{}.js", "a".repeat(120));
        for path in [
            "../outside.txt",
            "..\\outside.txt",
            "kit\\..\\..\\outside.txt",
            "kit/../../outside.txt",
            "/absolute.txt",
            "C:/drive.txt",
            "C:\\drive.txt",
            "kit/con.js",
            "kit/LPT¹.js",
            "kit/trailing.",
            "kit/ leading.js",
            "kit/what?.js",
            &long,
        ] {
            assert!(portable_path(path).is_err(), "{path}");
            let mut files = blank.files.clone();
            files.insert(path.into(), b"x".to_vec());
            assert!(
                import_into(&pack(&files).unwrap(), styles.path()).is_err(),
                "{path}"
            );
        }
        assert!(portable_path("scenes/lib/camera.js").is_ok());
        // Nothing was written, not even a folder for the style.
        assert_eq!(fs::read_dir(styles.path()).unwrap().count(), 0);
        assert!(!styles.path().parent().unwrap().join("outside.txt").exists());
        // No preset.json, or not a zip at all.
        let mut bare = blank.files.clone();
        bare.remove(CONFIG);
        assert!(import_into(&pack(&bare).unwrap(), styles.path()).is_err());
        assert!(import_into(b"not a zip", styles.path()).is_err());
    }

    #[test]
    fn a_style_file_with_a_link_is_refused() {
        use std::io::Write;
        let styles = tempfile::tempdir().unwrap();
        let mut zip = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
        let options = zip::write::SimpleFileOptions::default();
        for (name, bytes) in &Preset::builtin("blank").unwrap().files {
            zip.start_file(name.as_str(), options).unwrap();
            zip.write_all(bytes).unwrap();
        }
        zip.add_symlink("kit/elsewhere", "../../outside", options)
            .unwrap();
        let file = zip.finish().unwrap().into_inner();
        let error = import_into(&file, styles.path()).unwrap_err().to_string();
        assert!(error.contains("link"), "{error}");
        assert_eq!(fs::read_dir(styles.path()).unwrap().count(), 0);
    }

    #[test]
    fn builtin_presets_are_valid() {
        let presets = list().unwrap();
        assert!(presets.iter().any(|p| p.name == "flat-explainer"));
        assert!(presets.iter().any(|p| p.name == "miniature-3d"));
        assert!(presets.iter().any(|p| p.name == "launch"));
        for summary in presets {
            Preset::resolve(&summary.name).unwrap();
        }
    }

    #[test]
    fn new_project_applies_format_length_and_topic() {
        let dir = TempDir::new().unwrap();
        let root = dir.path().join("Projekt mit Ümlaut");
        let preset = Preset::resolve("flat-explainer").unwrap();
        let reference = dir.path().join("look.png");
        fs::write(&reference, b"png").unwrap();
        let result = create_project(
            &preset,
            &root,
            &Brief {
                workflow: Some("superint-explainer"),
                topic: Some("Warum \"Schlaf\" wichtig ist"),
                message: Some("Wer zu wenig schläft, räumt sein Gehirn nicht auf"),
                seconds: Some(3),
                format: Some("9:16"),
                language: None,
                audience: None,
                must: Some("Die Glymphatik"),
                avoid: None,
                stops: Some(vec!["script".into(), "concept".into(), "script".into()]),
                script: Some("Hallo".into()),
                references: vec![reference.clone()],
                polish_rounds: Some(2),
            },
        )
        .unwrap();
        assert_eq!(result["width"], 1080);
        let manifest: Manifest =
            serde_json::from_slice(&fs::read(root.join("video.json")).unwrap()).unwrap();
        assert_eq!(manifest.duration_frames, 90);
        assert!(manifest.clips.iter().all(|c| c.end_frame() <= 90));
        assert_eq!(manifest.name, "Warum \"Schlaf\" wichtig ist");
        assert!(!result["project"].as_str().unwrap().starts_with(r"\\?\"));
        let brief = fs::read_to_string(root.join("brief.md")).unwrap();
        assert!(brief.contains("stops: [script, concept]"));
        assert!(brief.contains("workflow: superint-explainer"));
        assert!(brief.contains("- `references/look.png`"));
        // The user may have added references to the built-in preset; ours is among them.
        assert!(result["references"].as_u64().unwrap() >= 1);
        assert!(root.join("references/look.png").is_file());
        assert!(brief.contains("## Must include\n\nDie Glymphatik"));
        assert!(brief.contains("## Message\n\nWer zu wenig schläft, räumt sein Gehirn nicht auf"));
        // 3 s of German narration at 140 words per minute.
        assert!(brief.contains("narrationWords: 7"));
        // The rounds chosen for this film are in its brief, and the brief wins over the setting.
        assert!(brief.contains(
            "narrationWords: 7
polishRounds: 2
---"
        ));
        assert_eq!(crate::polish::rounds(&root).unwrap(), (2, "brief"));
        assert_eq!(fs::read_to_string(root.join("script.md")).unwrap(), "Hallo");
        assert!(root.join("STYLE.md").is_file() && root.join("kit/kit.js").is_file());
        assert!(
            create_project(
                &preset,
                &root,
                &Brief {
                    workflow: None,
                    topic: None,
                    message: None,
                    seconds: None,
                    format: None,
                    language: None,
                    audience: None,
                    must: None,
                    avoid: None,
                    stops: None,
                    script: None,
                    references: Vec::new(),
                    polish_rounds: None,
                }
            )
            .is_err()
        );
    }

    #[test]
    fn blank_preset_needs_no_narration_settings() {
        let preset = Preset::resolve("blank").unwrap();
        assert_eq!(preset.config.narration.rate("de"), 150);
        assert_eq!(preset.config.defaults.concepts, 3);
        assert!(preset.config.defaults.workflow.is_none());
    }

    #[test]
    fn bad_stop_and_workflow_names_fail() {
        let dir = TempDir::new().unwrap();
        let preset = Preset::resolve("blank").unwrap();
        let brief = |workflow, stops| Brief {
            workflow,
            topic: None,
            message: None,
            seconds: Some(1),
            format: None,
            language: None,
            audience: None,
            must: None,
            avoid: None,
            stops,
            script: None,
            references: Vec::new(),
            polish_rounds: None,
        };
        assert!(
            create_project(
                &preset,
                &dir.path().join("a"),
                &brief(Some("Launch Film"), None)
            )
            .is_err()
        );
        assert!(
            create_project(
                &preset,
                &dir.path().join("b"),
                &brief(None, Some(vec!["after script".into()]))
            )
            .is_err()
        );
        assert!(
            create_project(
                &preset,
                &dir.path().join("c"),
                &brief(Some("superint-launch"), None)
            )
            .is_ok()
        );
    }

    #[test]
    fn unknown_format_and_bad_names_fail() {
        let preset = Preset::resolve("flat-explainer").unwrap();
        assert!(preset.size(Some("4:3")).is_err());
        assert!(valid_name("Flat Explainer").is_err());
        assert!(Preset::resolve("does-not-exist").is_err());
    }

    #[test]
    fn narration_rate_falls_back_by_language() {
        let preset = Preset::resolve("flat-explainer").unwrap();
        let narration = &preset.config.narration;
        assert_eq!(narration.rate("de-AT"), narration.rate("de"));
        assert_eq!(narration.rate("xx"), narration.words_per_minute["*"]);
    }
}
