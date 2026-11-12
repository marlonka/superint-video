//! The user's own folder, shared by every project: what a new film defaults to, the API keys
//! saved in the app, the films this computer knows, and whether a start page is open.
//! `SUPERINT_HOME`, else `%USERPROFILE%\.superint-video` (`~/.config/superint-video` elsewhere).
use crate::project::{atomic_write as write, millis, now_ms, without_verbatim};
use crate::providers::Provider;
use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

const SETTINGS: &str = "settings.json";
const KEYS: &str = "keys.dat";
const FILMS: &str = "films.json";
const VIEWER: &str = "viewer.json";
/// A start page that asked this recently is open in front of someone.
const WATCHED_MS: u64 = 8_000;
const MOST_FILMS: usize = 200;
/// Folders looked at in the films folder per reading of the list.
const MOST_SCANNED: usize = 500;

/// The folder's name where it sits among others.
const NAME: &str = "superint-video";

pub fn dir() -> Option<PathBuf> {
    if let Some(dir) = std::env::var_os("SUPERINT_HOME").filter(|d| !d.is_empty()) {
        return Some(dir.into());
    }
    user_folder()
}

/// Not `%APPDATA%`: a program started from a packaged app, such as the Claude or ChatGPT
/// desktop app, writes new files there into that package's private copy
/// (`%LOCALAPPDATA%\Packages\<package>\LocalCache\Roaming`). Each of them would keep its own
/// settings and films, and Explorer, which looks at the real folder, would not find it. The
/// user's profile is the same for every program.
#[cfg(windows)]
fn user_folder() -> Option<PathBuf> {
    Some(PathBuf::from(std::env::var_os("USERPROFILE")?).join(format!(".{NAME}")))
}

/// Run once as the program starts, before anything reads the folder: the first time, the user's
/// folder is filled from where versions up to 0.7.0 kept it. A folder `SUPERINT_HOME` names
/// is left alone.
#[cfg(windows)]
pub fn move_in() {
    if std::env::var_os("SUPERINT_HOME").is_some_and(|d| !d.is_empty()) {
        return;
    }
    let Some(home) = user_folder().filter(|home| !home.exists()) else {
        return;
    };
    if let Err(error) = gather(&home, &earlier_folders()) {
        eprintln!("Could not bring over the settings of earlier versions: {error:#}");
    }
}

#[cfg(not(windows))]
fn user_folder() -> Option<PathBuf> {
    let base = std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".config")))?;
    Some(base.join(NAME))
}

/// Where versions before 0.7.1 kept the folder: `%APPDATA%\superint-video`, and the private
/// copies packaged apps made of it.
#[cfg(windows)]
fn earlier_folders() -> Vec<PathBuf> {
    let mut found: Vec<PathBuf> = std::env::var_os("APPDATA")
        .map(|roaming| PathBuf::from(roaming).join(NAME))
        .into_iter()
        .collect();
    if let Some(local) = std::env::var_os("LOCALAPPDATA")
        && let Ok(packages) = fs::read_dir(PathBuf::from(local).join("Packages"))
    {
        found.extend(
            packages
                .flatten()
                .map(|package| package.path().join("LocalCache").join("Roaming").join(NAME)),
        );
    }
    found.retain(|folder| folder.is_dir());
    found
}

/// Brings earlier copies of the user's folder into `home` while `home` does not exist yet:
/// of each file the newest copy. The earlier copies stay where they are. Two programs starting
/// at once may both gather; the first to finish wins and the other leaves it alone.
#[cfg(any(windows, test))]
fn gather(home: &Path, earlier: &[PathBuf]) -> Result<()> {
    if home.exists() || earlier.is_empty() {
        return Ok(());
    }
    let mut newest: BTreeMap<PathBuf, (std::time::SystemTime, PathBuf)> = BTreeMap::new();
    for root in earlier {
        for entry in walkdir::WalkDir::new(root).follow_links(false) {
            let entry = entry?;
            if !entry.file_type().is_file() {
                continue;
            }
            let modified = entry.metadata()?.modified()?;
            let relative = entry.path().strip_prefix(root)?.to_path_buf();
            if newest
                .get(&relative)
                .is_none_or(|(seen, _)| modified > *seen)
            {
                newest.insert(relative, (modified, entry.into_path()));
            }
        }
    }
    let parent = home.parent().context("The user folder has no parent")?;
    let staging = parent.join(format!(".{NAME}-gathering-{}", std::process::id()));
    let moved = newest
        .iter()
        .try_for_each(|(relative, (_, source))| {
            let target = staging.join(relative);
            fs::create_dir_all(target.parent().unwrap_or(&staging))?;
            fs::copy(source, &target).with_context(|| format!("Copying {}", source.display()))?;
            Ok::<_, anyhow::Error>(())
        })
        .and_then(|()| Ok(fs::rename(&staging, home)?));
    if moved.is_err() {
        let _ = fs::remove_dir_all(&staging);
    }
    if home.exists() { Ok(()) } else { moved }
}

pub fn read_json(path: &Path) -> Option<Value> {
    serde_json::from_slice(&fs::read(path).ok()?).ok()
}

// ------------------------------------------------------------------------------------ settings

/// How Studio opens: in a window of its own, or as a tab of the default browser.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Window {
    #[default]
    App,
    Browser,
}

/// The user's choices on this computer. A film's length, format and language are not among
/// them: the prompt from the start page names them for every film. Files from older versions
/// that still hold them load; the values are dropped.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// The style a new film takes when the request names none.
    pub preset: Option<String>,
    /// Where `new` puts a film when no folder is given.
    pub projects_dir: Option<PathBuf>,
    pub window: Window,
    /// The start page goes to a film as soon as the coding agent begins one.
    pub follow: bool,
    /// The language of the app itself; unset follows the system. Not the film's language.
    pub ui_language: Option<String>,
    /// Models a pro chose, as IDs exactly as the provider writes them; the ID says the
    /// provider (`Provider::of`). Unset follows the style, then the usual Google models. A
    /// film's own `voice.md` or `music-prompt.md` still wins.
    pub narration_model: Option<String>,
    pub narration_voice: Option<String>,
    pub transcription_model: Option<String>,
    pub music_model: Option<String>,
    /// What writes down what the user says into the start page; unset, the first provider
    /// with a key.
    pub dictation_model: Option<String>,
    /// What looks at reference pictures and writes a new style's rules; unset, the first
    /// provider with a key.
    pub style_model: Option<String>,
    /// Google Cloud: the project a standard key belongs to. Unset is express mode.
    pub google_cloud_project: Option<String>,
    /// Google Cloud: `eu` (unset), `us` or `global`. Applies with a project.
    pub google_cloud_location: Option<String>,
    /// OpenAI: `global` (unset) or `eu`, for a project with European data residency.
    pub open_ai_region: Option<String>,
    /// Rounds of polish before a render, 1 to 3, one after the other: each is a new pair of
    /// eyes over the whole film (`polish`). A film's `brief.md` can set its own.
    pub polish_rounds: u8,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            preset: None,
            projects_dir: None,
            window: Window::App,
            follow: true,
            ui_language: None,
            narration_model: None,
            narration_voice: None,
            transcription_model: None,
            music_model: None,
            dictation_model: None,
            style_model: None,
            google_cloud_project: None,
            google_cloud_location: None,
            open_ai_region: None,
            polish_rounds: crate::polish::DEFAULT_ROUNDS,
        }
    }
}

/// The names `set` takes: the fields of the settings file.
pub fn setting_keys() -> Vec<String> {
    match serde_json::to_value(Settings::default()) {
        Ok(Value::Object(fields)) => fields.keys().cloned().collect(),
        _ => Vec::new(),
    }
}

/// The languages the app itself speaks.
pub const UI_LANGUAGES: &[&str] = &["de", "en"];

impl Settings {
    /// A missing file is the defaults; a broken one is an error that names it.
    pub fn load(home: &Path) -> Result<Self> {
        let path = home.join(SETTINGS);
        match fs::read(&path) {
            Ok(bytes) => serde_json::from_slice(&bytes)
                .with_context(|| format!("{} is not valid; fix or delete it", path.display())),
            Err(_) => Ok(Self::default()),
        }
    }

    /// The settings of this computer; defaults when there is no user folder.
    pub fn current() -> Self {
        dir()
            .and_then(|home| Self::load(&home).ok())
            .unwrap_or_default()
    }

    /// The values as they are meant: no spaces around them, nothing for an empty one, model IDs
    /// without the `models/` Google puts in front, the Google Cloud project and the regions in
    /// lower case. Values come typed, pasted and from the command line; `set` and `save` both
    /// clean them here.
    pub fn normalize(&mut self) {
        for value in [
            &mut self.preset,
            &mut self.ui_language,
            &mut self.narration_voice,
            &mut self.google_cloud_project,
            &mut self.google_cloud_location,
            &mut self.open_ai_region,
            &mut self.narration_model,
            &mut self.transcription_model,
            &mut self.music_model,
            &mut self.dictation_model,
            &mut self.style_model,
        ] {
            *value = value
                .take()
                .map(|text| text.trim().to_string())
                .filter(|text| !text.is_empty());
        }
        for model in [
            &mut self.narration_model,
            &mut self.transcription_model,
            &mut self.music_model,
            &mut self.dictation_model,
            &mut self.style_model,
        ] {
            *model = model
                .take()
                .map(|id| model_id(&id))
                .filter(|id| !id.is_empty());
        }
        for value in [
            &mut self.google_cloud_project,
            &mut self.google_cloud_location,
            &mut self.open_ai_region,
        ] {
            *value = value.take().map(|text| text.to_lowercase());
        }
    }

    pub fn save(&self, home: &Path) -> Result<()> {
        let mut clean = self.clone();
        clean.normalize();
        clean.validate()?;
        let mut bytes = serde_json::to_vec_pretty(&clean)?;
        bytes.push(b'\n');
        write(&home.join(SETTINGS), &bytes)
    }

    pub fn validate(&self) -> Result<()> {
        if let Some(preset) = &self.preset {
            crate::preset::Preset::resolve(preset)
                .with_context(|| format!("Default style {preset}"))?;
        }
        if let Some(folder) = &self.projects_dir
            && !folder.is_absolute()
        {
            bail!("The films folder must be a full path");
        }
        if let Some(language) = &self.ui_language
            && !UI_LANGUAGES.contains(&language.as_str())
        {
            bail!("The app speaks: {}", UI_LANGUAGES.join(", "));
        }
        for (model, film) in [
            (&self.narration_model, true),
            (&self.transcription_model, true),
            (&self.music_model, true),
            (&self.dictation_model, false),
            (&self.style_model, false),
        ] {
            if let Some(model) = model {
                check_model(model, film)?;
            }
        }
        if let Some(voice) = &self.narration_voice {
            let plain = (1..=80).contains(&voice.len())
                && voice
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || "-_.".contains(c));
            if !plain {
                bail!("{voice} is not a voice name: letters, digits and - _ . only");
            }
        }
        if let Some(project) = &self.google_cloud_project {
            // Google's rule for project IDs: 6 to 30 lowercase letters, digits and hyphens.
            let plain = (6..=30).contains(&project.len())
                && project
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
                && !project.starts_with('-')
                && !project.ends_with('-');
            if !plain {
                bail!(
                    "{project} is not a Google Cloud project ID: 6 to 30 lowercase letters, digits and hyphens, as in my-films-123"
                );
            }
        }
        if let Some(location) = &self.google_cloud_location
            && !crate::providers::cloud::LOCATIONS.contains(&location.as_str())
        {
            bail!(
                "Google Cloud location is one of: {}",
                crate::providers::cloud::LOCATIONS.join(", ")
            );
        }
        if let Some(region) = &self.open_ai_region
            && !crate::providers::openai::REGIONS
                .iter()
                .any(|(name, _)| name == region)
        {
            bail!("OpenAI region is global or eu");
        }
        if !(1..=crate::polish::MOST_ROUNDS).contains(&self.polish_rounds) {
            bail!("polishRounds is 1, 2 or 3, not {}", self.polish_rounds);
        }
        Ok(())
    }

    /// The models the user chose, for the coding agent (`doctor`).
    pub fn models(&self) -> Value {
        json!({
            "narration": self.narration_model,
            "voice": self.narration_voice,
            "transcription": self.transcription_model,
            "music": self.music_model,
            "dictation": self.dictation_model,
            "style": self.style_model,
            "rule": "Chosen in Setup for new films; they beat the style's preset, and voice.md or music-prompt.md beat them. Unset follows the preset, then the usual Google models",
        })
    }

    /// One value by its JSON name; an empty value clears it.
    pub fn set(&mut self, key: &str, value: &str) -> Result<()> {
        let value = value.trim();
        let text = (!value.is_empty()).then(|| value.to_string());
        match key {
            "preset" => self.preset = text,
            "projectsDir" => self.projects_dir = text.map(PathBuf::from),
            "window" => {
                self.window = match value {
                    "" | "app" => Window::App,
                    "browser" => Window::Browser,
                    _ => bail!("window is app or browser"),
                }
            }
            "follow" => {
                self.follow = match value {
                    "" | "true" | "yes" | "on" => true,
                    "false" | "no" | "off" => false,
                    _ => bail!("follow is true or false"),
                }
            }
            "uiLanguage" => self.ui_language = text,
            "narrationModel" => self.narration_model = text,
            "narrationVoice" => self.narration_voice = text,
            "transcriptionModel" => self.transcription_model = text,
            "musicModel" => self.music_model = text,
            "dictationModel" => self.dictation_model = text,
            "styleModel" => self.style_model = text,
            "googleCloudProject" => self.google_cloud_project = text,
            "googleCloudLocation" => self.google_cloud_location = text,
            "openAiRegion" => self.open_ai_region = text,
            "polishRounds" => {
                self.polish_rounds = match text {
                    None => crate::polish::DEFAULT_ROUNDS,
                    Some(text) => crate::polish::parse_rounds(&text)?,
                }
            }
            _ => bail!(
                "Unknown setting {key}. Known: {}",
                setting_keys().join(", ")
            ),
        }
        self.normalize();
        self.validate()
    }
}

/// A model ID as it is pasted: without spaces, and without the `models/` Google puts in front.
pub fn model_id(text: &str) -> String {
    let text = text.trim().trim_matches(['"', '\'']).trim();
    text.strip_prefix("models/").unwrap_or(text).to_string()
}

/// A model ID a provider could know, with no characters a request would have to escape. A film
/// cannot use OpenAI (see `providers::openai_for_film`); a dictation can use any provider.
pub fn check_model(model: &str, film: bool) -> Result<()> {
    let plain = (1..=120).contains(&model.len())
        && model
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "-._:/@".contains(c));
    if !plain {
        bail!("{model} is not a model ID: letters, digits and - . _ : / @ only");
    }
    if model.starts_with('/') || model.ends_with('/') {
        bail!("{model} is not a model ID. OpenRouter IDs look like microsoft/mai-transcribe-2");
    }
    if film && Provider::of(model) == Provider::OpenAi {
        return Err(crate::providers::openai_for_film(model));
    }
    Ok(())
}

// -------------------------------------------------------------------------------------- places

/// The folder films go to unless the user chose another: `SUPERINT_FILMS`, else
/// `Superint Video` in the user's Videos folder. Films are large and belong with the user's
/// videos, never inside the tool or a code repository.
pub fn default_films_dir() -> Option<PathBuf> {
    if let Some(dir) = std::env::var_os("SUPERINT_FILMS").filter(|d| !d.is_empty()) {
        return Some(dir.into());
    }
    Some(known::videos()?.join("Superint Video"))
}

/// Where a new film goes when the request names no folder: the user's choice, else the default.
pub fn films_dir(settings: &Settings) -> Option<PathBuf> {
    settings.projects_dir.clone().or_else(default_films_dir)
}

/// Where a file the user wants to pass on is put: `SUPERINT_DOWNLOADS`, else Downloads.
pub fn downloads_dir() -> Option<PathBuf> {
    if let Some(dir) = std::env::var_os("SUPERINT_DOWNLOADS").filter(|d| !d.is_empty()) {
        return Some(dir.into());
    }
    known::downloads()
}

/// The user's Videos and Downloads folders, asked from Windows because either may have been
/// moved to another drive.
#[cfg(windows)]
mod known {
    use std::{ffi::c_void, path::PathBuf};

    #[repr(C)]
    struct Guid(u32, u16, u16, [u8; 8]);
    const VIDEOS: Guid = Guid(
        0x1898_9B1D,
        0x99B5,
        0x455B,
        [0x84, 0x1C, 0xAB, 0x7C, 0x74, 0xE4, 0xDD, 0xFC],
    );
    const DOWNLOADS: Guid = Guid(
        0x374D_E290,
        0x123F,
        0x4565,
        [0x91, 0x64, 0x39, 0xC4, 0x92, 0x5E, 0x46, 0x7B],
    );

    #[link(name = "shell32")]
    unsafe extern "system" {
        fn SHGetKnownFolderPath(
            id: *const Guid,
            flags: u32,
            token: *mut c_void,
            path: *mut *mut u16,
        ) -> i32;
    }
    #[link(name = "ole32")]
    unsafe extern "system" {
        fn CoTaskMemFree(memory: *mut c_void);
    }

    fn folder(id: &Guid) -> Option<PathBuf> {
        use std::os::windows::ffi::OsStringExt;
        let mut path: *mut u16 = std::ptr::null_mut();
        // SAFETY: on success Windows hands back a NUL-terminated string, which is read up to
        // its end and then freed the way the function asks for; on failure the pointer is null.
        unsafe {
            let status = SHGetKnownFolderPath(id, 0, std::ptr::null_mut(), &mut path);
            let found = (status == 0 && !path.is_null()).then(|| {
                let len = (0..).take_while(|&at| *path.add(at) != 0).count();
                PathBuf::from(std::ffi::OsString::from_wide(std::slice::from_raw_parts(
                    path, len,
                )))
            });
            CoTaskMemFree(path.cast());
            found
        }
    }

    fn in_profile(name: &str) -> Option<PathBuf> {
        std::env::var_os("USERPROFILE").map(|user| PathBuf::from(user).join(name))
    }
    pub fn videos() -> Option<PathBuf> {
        folder(&VIDEOS).or_else(|| in_profile("Videos"))
    }
    pub fn downloads() -> Option<PathBuf> {
        folder(&DOWNLOADS).or_else(|| in_profile("Downloads"))
    }
}
#[cfg(not(windows))]
mod known {
    use std::path::PathBuf;

    fn in_home(name: &str) -> Option<PathBuf> {
        std::env::var_os("HOME").map(|home| PathBuf::from(home).join(name))
    }
    pub fn videos() -> Option<PathBuf> {
        if let Some(dir) = std::env::var_os("XDG_VIDEOS_DIR").filter(|d| !d.is_empty()) {
            return Some(dir.into());
        }
        in_home(if cfg!(target_os = "macos") {
            "Movies"
        } else {
            "Videos"
        })
    }
    pub fn downloads() -> Option<PathBuf> {
        if let Some(dir) = std::env::var_os("XDG_DOWNLOAD_DIR").filter(|d| !d.is_empty()) {
            return Some(dir.into());
        }
        in_home("Downloads")
    }
}

// ---------------------------------------------------------------------------------------- keys

/// API keys saved in the app. On Windows the file is encrypted for the signed-in user, so it
/// reads as noise to anything that opens it; elsewhere it is a file only the user can read.
pub struct KeyStore {
    path: PathBuf,
}

impl KeyStore {
    pub fn at(home: &Path) -> Self {
        Self {
            path: home.join(KEYS),
        }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Every saved key. A file that cannot be read back counts as empty: the user saves again.
    pub fn read(&self) -> BTreeMap<String, String> {
        fs::read(&self.path)
            .ok()
            .and_then(|sealed| unseal(&sealed).ok())
            .and_then(|plain| serde_json::from_slice(&plain).ok())
            .unwrap_or_default()
    }

    pub fn set(&self, name: &str, value: &str) -> Result<()> {
        let value = clean_key(value)?;
        let mut keys = self.read();
        keys.insert(name.to_string(), value);
        self.store(&keys)
    }

    /// Returns whether the key was there.
    pub fn remove(&self, name: &str) -> Result<bool> {
        let mut keys = self.read();
        let was = keys.remove(name).is_some();
        if was {
            self.store(&keys)?;
        }
        Ok(was)
    }

    fn store(&self, keys: &BTreeMap<String, String>) -> Result<()> {
        if keys.is_empty() {
            let _ = fs::remove_file(&self.path);
            return Ok(());
        }
        write(&self.path, &seal(&serde_json::to_vec(keys)?)?)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&self.path, fs::Permissions::from_mode(0o600))?;
        }
        Ok(())
    }
}

/// A pasted key without the quotes, spaces or line ends that come along with it.
fn clean_key(value: &str) -> Result<String> {
    let value = value.trim().trim_matches(['"', '\'']).trim();
    if value.is_empty() {
        bail!("The key is empty");
    }
    if value.len() > 512 || !value.chars().all(|c| c.is_ascii_graphic()) {
        bail!("This does not look like a key: it has spaces, line breaks or is too long");
    }
    Ok(value.to_string())
}

#[cfg(windows)]
mod dpapi {
    use anyhow::{Result, bail};
    use std::ffi::c_void;

    #[repr(C)]
    struct Blob {
        len: u32,
        data: *mut u8,
    }
    #[link(name = "crypt32")]
    unsafe extern "system" {
        fn CryptProtectData(
            input: *const Blob,
            description: *const u16,
            entropy: *const Blob,
            reserved: *mut c_void,
            prompt: *const c_void,
            flags: u32,
            output: *mut Blob,
        ) -> i32;
        fn CryptUnprotectData(
            input: *const Blob,
            description: *mut *mut u16,
            entropy: *const Blob,
            reserved: *mut c_void,
            prompt: *const c_void,
            flags: u32,
            output: *mut Blob,
        ) -> i32;
    }
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn LocalFree(memory: *mut c_void) -> *mut c_void;
    }
    /// Never show a dialog: this runs in background processes.
    const UI_FORBIDDEN: u32 = 1;

    pub fn run(input: &[u8], protect: bool) -> Result<Vec<u8>> {
        let source = Blob {
            len: u32::try_from(input.len())?,
            data: input.as_ptr().cast_mut(),
        };
        let mut out = Blob {
            len: 0,
            data: std::ptr::null_mut(),
        };
        // SAFETY: `source` points at `input` for the whole call and is only read; `out` is
        // filled by Windows with memory it allocated, which is copied and freed below.
        let ok = unsafe {
            if protect {
                CryptProtectData(
                    &source,
                    std::ptr::null(),
                    std::ptr::null(),
                    std::ptr::null_mut(),
                    std::ptr::null(),
                    UI_FORBIDDEN,
                    &mut out,
                )
            } else {
                CryptUnprotectData(
                    &source,
                    std::ptr::null_mut(),
                    std::ptr::null(),
                    std::ptr::null_mut(),
                    std::ptr::null(),
                    UI_FORBIDDEN,
                    &mut out,
                )
            }
        };
        if ok == 0 || out.data.is_null() {
            bail!("Windows could not protect the saved keys for this user");
        }
        // SAFETY: on success `out.data` holds `out.len` bytes owned by this process until freed.
        let bytes = unsafe { std::slice::from_raw_parts(out.data, out.len as usize).to_vec() };
        // SAFETY: the buffer came from the call above and is not used after this.
        unsafe { LocalFree(out.data.cast()) };
        Ok(bytes)
    }
}

#[cfg(windows)]
fn seal(plain: &[u8]) -> Result<Vec<u8>> {
    dpapi::run(plain, true)
}
#[cfg(windows)]
fn unseal(sealed: &[u8]) -> Result<Vec<u8>> {
    dpapi::run(sealed, false)
}
#[cfg(not(windows))]
fn seal(plain: &[u8]) -> Result<Vec<u8>> {
    Ok(plain.to_vec())
}
#[cfg(not(windows))]
fn unseal(sealed: &[u8]) -> Result<Vec<u8>> {
    Ok(sealed.to_vec())
}

// --------------------------------------------------------------------------------------- films

/// A film this computer has worked on.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Film {
    pub path: PathBuf,
    pub name: String,
    /// When `new` created it; 0 for a project that was only opened.
    #[serde(default)]
    pub created_at: u64,
    pub seen_at: u64,
    /// Taken off the list by the user while its folder still exists, so the films folder does
    /// not bring it back.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub hidden: bool,
}

/// One spelling per folder: Windows paths differ in case, slashes and the verbatim prefix.
pub fn folder_key(path: &Path) -> String {
    let text = without_verbatim(path).to_string_lossy().replace('\\', "/");
    if cfg!(windows) {
        text.to_lowercase()
    } else {
        text
    }
}

fn by_recency(films: &mut [Film]) {
    films.sort_by_key(|f| std::cmp::Reverse(f.seen_at.max(f.created_at)));
}

/// Everything in the file, hidden films included.
fn listed(home: &Path) -> Vec<Film> {
    let mut films: Vec<Film> = fs::read(home.join(FILMS))
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default();
    by_recency(&mut films);
    films
}

fn store(home: &Path, mut films: Vec<Film>) -> Result<()> {
    films.retain(|f| !f.hidden || f.path.join("video.json").is_file());
    by_recency(&mut films);
    films.truncate(MOST_FILMS);
    write(&home.join(FILMS), &serde_json::to_vec_pretty(&films)?)
}

/// Most recent first.
pub fn films(home: &Path) -> Vec<Film> {
    listed(home).into_iter().filter(|f| !f.hidden).collect()
}

/// Puts the films of the films folder on the list: every folder one level down with a
/// `video.json` that is not listed yet. Films made before the app, or copied in, show up this
/// way. Best effort, and cheap enough to run whenever the list is read.
pub fn adopt(home: &Path, folder: &Path) {
    let Ok(entries) = fs::read_dir(folder) else {
        return;
    };
    let mut films = listed(home);
    let mut known: std::collections::HashSet<String> =
        films.iter().map(|f| folder_key(&f.path)).collect();
    let before = films.len();
    for entry in entries.flatten().take(MOST_SCANNED) {
        let root = entry.path();
        let manifest = root.join("video.json");
        let Some(changed) = fs::metadata(&manifest)
            .ok()
            .filter(|m| m.is_file())
            .and_then(|m| m.modified().ok())
        else {
            continue;
        };
        if known.contains(&folder_key(&root)) {
            continue;
        }
        let root = without_verbatim(&root.canonicalize().unwrap_or(root));
        if !known.insert(folder_key(&root)) {
            continue;
        }
        let name = read_json(&manifest)
            .and_then(|m| m["name"].as_str().map(str::to_owned))
            .filter(|name| !name.trim().is_empty())
            .unwrap_or_else(|| entry.file_name().to_string_lossy().into_owned());
        films.push(Film {
            path: root,
            name,
            created_at: 0,
            seen_at: millis(changed),
            hidden: false,
        });
    }
    if films.len() > before {
        let _ = store(home, films);
    }
}

/// Puts a film at the top of the list. Best effort: the list is a convenience. Projects in the
/// system's temporary folder are test runs and stay off it.
pub fn remember(home: &Path, root: &Path, name: &str, created: bool) {
    let root = without_verbatim(root);
    // Compared resolved: the same folder can be spelled short (C:\Users\RUNNER~1) or long.
    let resolved = |path: &Path| folder_key(&path.canonicalize().unwrap_or(path.to_path_buf()));
    let temporary = resolved(&std::env::temp_dir());
    let key = folder_key(&root);
    if resolved(&root).starts_with(&temporary) && !resolved(home).starts_with(&temporary) {
        return;
    }
    let now = now_ms();
    let mut films = listed(home);
    let created_at = films
        .iter()
        .find(|f| folder_key(&f.path) == key)
        .map(|f| f.created_at)
        .filter(|at| *at > 0)
        .unwrap_or(if created { now } else { 0 });
    films.retain(|f| folder_key(&f.path) != key);
    films.insert(
        0,
        Film {
            path: root,
            name: name.to_string(),
            created_at,
            seen_at: now,
            hidden: false,
        },
    );
    let _ = store(home, films);
}

/// Takes a film off the list; its folder stays. While the folder exists the film is kept as
/// hidden, so the films folder does not put it back; opening it again shows it again. Returns
/// whether it was listed.
pub fn forget(home: &Path, root: &Path) -> Result<bool> {
    let mut films = listed(home);
    let key = folder_key(root);
    let Some(at) = films
        .iter()
        .position(|f| !f.hidden && folder_key(&f.path) == key)
    else {
        return Ok(false);
    };
    if films[at].path.join("video.json").is_file() {
        films[at].hidden = true;
    } else {
        films.remove(at);
    }
    store(home, films)?;
    Ok(true)
}

/// A folder name from a topic: `Why the sky is blue!` → `why-the-sky-is-blue`.
pub fn slug(topic: &str) -> String {
    let mut slug = String::new();
    for c in topic.chars().flat_map(char::to_lowercase) {
        let c = match c {
            'ä' => "ae",
            'ö' => "oe",
            'ü' => "ue",
            'ß' => "ss",
            c if c.is_ascii_alphanumeric() => {
                slug.push(c);
                continue;
            }
            _ => "-",
        };
        if c != "-" || !(slug.is_empty() || slug.ends_with('-')) {
            slug.push_str(c);
        }
    }
    let slug: String = slug.trim_matches('-').chars().take(48).collect();
    let slug = slug.trim_matches('-');
    if slug.is_empty() {
        "film".into()
    } else {
        slug.into()
    }
}

/// A film's name as `video.json` and the list keep it: without asterisks, which Markdown would
/// read, trimmed, at most 120 characters. None when nothing is left.
pub fn film_name(text: &str) -> Option<String> {
    let name: String = text.replace('*', "").trim().chars().take(120).collect();
    let name = name.trim_end();
    (!name.is_empty()).then(|| name.to_string())
}

/// What a copy of a film leaves behind: what was made from it (renders, the report, the agent's
/// status, reviews and polish passes) and Studio's own state. The sources stay, so the copy
/// plays at once and only what differs has to be made again.
const NOT_COPIED: &[&str] = &["renders", "process", ".superint", "report.md"];

/// Copies a film into `to`, a folder that does not exist yet, as the start of another film, and
/// gives the copy its name. Returns the copy's folder. A copy that fails halfway is removed.
pub fn duplicate(from: &Path, to: &Path, name: &str) -> Result<PathBuf> {
    let from = from
        .canonicalize()
        .with_context(|| format!("Cannot open the film {}", from.display()))?;
    anyhow::ensure!(
        from.join("video.json").is_file(),
        "{} is not a film: it has no video.json",
        from.display()
    );
    anyhow::ensure!(!to.exists(), "{} exists already", to.display());
    let parent = to.parent().context("The copy needs a folder to go into")?;
    fs::create_dir_all(parent)?;
    anyhow::ensure!(
        !parent.canonicalize()?.starts_with(&from),
        "A film cannot be copied into itself"
    );
    let copied = (|| -> Result<PathBuf> {
        let left_out = |entry: &walkdir::DirEntry| {
            entry.depth() == 1
                && NOT_COPIED
                    .iter()
                    .any(|name| entry.file_name().eq_ignore_ascii_case(name))
        };
        for entry in walkdir::WalkDir::new(&from)
            .follow_links(false)
            .into_iter()
            .filter_entry(|entry| !left_out(entry))
        {
            let entry = entry?;
            let target = to.join(entry.path().strip_prefix(&from)?);
            if entry.file_type().is_dir() {
                fs::create_dir_all(&target)?;
            } else if entry.file_type().is_file() {
                fs::copy(entry.path(), &target)
                    .with_context(|| format!("Copying {}", entry.path().display()))?;
            }
        }
        let mut store = crate::project::ProjectStore::open(to)?;
        let revision = store.revision.clone();
        store.edit(
            &revision,
            &json!({"type": "updateProject", "changes": {"name": name}}),
        )?;
        Ok(without_verbatim(&store.root))
    })();
    if copied.is_err() {
        let _ = fs::remove_dir_all(to);
    }
    copied
}

/// A folder for a new film in the films folder that does not exist yet.
pub fn new_film_dir(folder: &Path, topic: &str) -> PathBuf {
    let base = slug(topic);
    let mut candidate = folder.join(&base);
    let mut n = 2;
    while candidate.exists() {
        candidate = folder.join(format!("{base}-{n}"));
        n += 1;
    }
    candidate
}

// ------------------------------------------------------------------------------- the start page

/// A start page is open and visible right now: it will show a new film by itself.
pub fn watched(home: &Path) -> bool {
    read_json(&home.join(VIEWER))
        .and_then(|v| v["seenAt"].as_u64())
        .is_some_and(|seen| now_ms().saturating_sub(seen) < WATCHED_MS)
}

/// Written every few seconds and read only for a moment: a plain write, never flushed.
pub fn mark_watched(home: &Path) {
    let _ = fs::write(home.join(VIEWER), json!({"seenAt": now_ms()}).to_string());
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn earlier_folders_are_gathered_once_with_the_newest_copy_of_each_file() {
        let root = TempDir::new().unwrap();
        let roaming = root.path().join("roaming");
        let package = root.path().join("package");
        let write_at = |path: &Path, text: &str, seconds: u64| {
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, text).unwrap();
            let time = std::time::UNIX_EPOCH + std::time::Duration::from_secs(seconds);
            let file = fs::File::options().write(true).open(path).unwrap();
            file.set_modified(time).unwrap();
        };
        write_at(&roaming.join(SETTINGS), "old", 1_000);
        write_at(&roaming.join("presets/mine/preset.json"), "mine", 1_000);
        write_at(&package.join(SETTINGS), "new", 2_000);
        write_at(&package.join(FILMS), "films", 2_000);

        let nothing = root.path().join("nothing");
        gather(&nothing, &[]).unwrap();
        assert!(!nothing.exists());

        let home = root.path().join(".superint-video");
        gather(&home, &[roaming.clone(), package.clone()]).unwrap();
        let read = |path: PathBuf| fs::read_to_string(path).unwrap();
        assert_eq!(read(home.join(SETTINGS)), "new");
        assert_eq!(read(home.join(FILMS)), "films");
        assert_eq!(read(home.join("presets/mine/preset.json")), "mine");
        // The earlier copies stay, and a folder that exists is never gathered into again.
        assert_eq!(read(roaming.join(SETTINGS)), "old");
        write_at(&package.join(SETTINGS), "newest", 3_000);
        gather(&home, &[package]).unwrap();
        assert_eq!(read(home.join(SETTINGS)), "new");
        // Nothing is left over from gathering.
        let mut names: Vec<_> = fs::read_dir(root.path())
            .unwrap()
            .map(|entry| entry.unwrap().file_name())
            .collect();
        names.sort();
        assert_eq!(names, [".superint-video", "package", "roaming"]);
    }

    #[test]
    fn settings_round_trip_and_reject_nonsense() {
        let home = TempDir::new().unwrap();
        assert_eq!(Settings::load(home.path()).unwrap(), Settings::default());
        // Files from before 0.4.0 still hold a length, format and language: they load.
        std::fs::write(
            home.path().join(SETTINGS),
            r#"{"preset":"blank","seconds":90,"format":"9:16","language":"de"}"#,
        )
        .unwrap();
        let old = Settings::load(home.path()).unwrap();
        assert_eq!(old.preset.as_deref(), Some("blank"));
        // Files from before rounds of polish get one round.
        assert_eq!(old.polish_rounds, 1);
        let mut settings = Settings::default();
        settings.set("preset", "flat-explainer").unwrap();
        settings.set("follow", "off").unwrap();
        settings.set("uiLanguage", "de").unwrap();
        settings
            .set("dictationModel", " models/gemini-4-transcribe ")
            .unwrap();
        settings
            .set("musicModel", "google/lyria-3-pro-preview")
            .unwrap();
        settings.set("narrationVoice", "Charon").unwrap();
        settings.set("googleCloudProject", "my-films-123").unwrap();
        settings.set("googleCloudLocation", "US").unwrap();
        settings.set("openAiRegion", "eu").unwrap();
        settings.set("polishRounds", " 3 ").unwrap();
        settings.save(home.path()).unwrap();
        let loaded = Settings::load(home.path()).unwrap();
        assert_eq!(loaded.preset.as_deref(), Some("flat-explainer"));
        assert!(!loaded.follow);
        assert_eq!(loaded.ui_language.as_deref(), Some("de"));
        assert_eq!(
            loaded.dictation_model.as_deref(),
            Some("gemini-4-transcribe")
        );
        assert_eq!(
            loaded.music_model.as_deref(),
            Some("google/lyria-3-pro-preview")
        );
        assert_eq!(loaded.google_cloud_location.as_deref(), Some("us"));
        assert_eq!(loaded.models()["voice"], "Charon");
        assert_eq!(loaded.polish_rounds, 3);

        // A film's length, format and language are named in each prompt, not kept here.
        assert!(settings.clone().set("seconds", "90").is_err());
        assert!(settings.clone().set("language", "de").is_err());
        assert!(settings.clone().set("preset", "no-such-style").is_err());
        assert!(settings.clone().set("projectsDir", "films").is_err());
        assert!(settings.clone().set("colour", "red").is_err());
        assert!(settings.clone().set("uiLanguage", "tlh").is_err());
        assert!(settings.clone().set("dictationModel", "gemini 4").is_err());
        assert!(settings.clone().set("musicModel", "google/").is_err());
        // OpenAI writes down dictations, but speaks and times no film.
        settings
            .clone()
            .set("dictationModel", "gpt-transcribe")
            .unwrap();
        assert!(
            settings
                .clone()
                .set("narrationModel", "gpt-4o-mini-tts")
                .is_err()
        );
        assert!(
            settings
                .clone()
                .set("transcriptionModel", "whisper-1")
                .is_err()
        );
        // A style can be written by any provider's model.
        for model in [
            "gpt-6.1-sol",
            "gemini-4-hydrogen",
            "google/gemini-4-hydrogen",
        ] {
            settings.clone().set("styleModel", model).unwrap();
        }
        assert!(settings.clone().set("styleModel", "gemini 4").is_err());
        assert!(settings.clone().set("narrationVoice", "Kore!").is_err());
        assert!(
            settings
                .clone()
                .set("googleCloudProject", "My_Project")
                .is_err()
        );
        assert!(
            settings
                .clone()
                .set("googleCloudLocation", "europe-west4")
                .is_err()
        );
        assert!(settings.clone().set("openAiRegion", "jp").is_err());
        for rounds in ["0", "4", "two"] {
            assert!(settings.clone().set("polishRounds", rounds).is_err());
        }
        let more = Settings {
            polish_rounds: 4,
            ..Settings::default()
        };
        assert!(more.save(home.path()).is_err());
        settings.set("polishRounds", "").unwrap();
        assert_eq!(settings.polish_rounds, 1);
        settings.set("preset", "").unwrap();
        assert_eq!(settings.preset, None);
        // Every field of the file is set by its name, so none can be left out of `set`.
        let keys = setting_keys();
        assert_eq!(keys.len(), 15);
        for key in keys {
            Settings::default().set(&key, "").unwrap();
        }

        fs::write(home.path().join(SETTINGS), b"{broken").unwrap();
        assert!(Settings::load(home.path()).is_err());
    }

    #[test]
    fn saved_keys_come_back_and_are_not_readable_in_the_file() {
        let home = TempDir::new().unwrap();
        let store = KeyStore::at(home.path());
        assert!(store.read().is_empty());
        store
            .set("GEMINI_API_KEY", "  \"test-key-0123456789\"\n")
            .unwrap();
        store.set("OPENROUTER_API_KEY", "second-test-key").unwrap();
        assert_eq!(store.read()["GEMINI_API_KEY"], "test-key-0123456789");
        #[cfg(windows)]
        {
            let raw = fs::read(store.path()).unwrap();
            let needle = b"test-key-0123456789";
            assert!(!raw.windows(needle.len()).any(|w| w == needle));
        }
        assert!(store.set("GEMINI_API_KEY", "two words").is_err());
        assert!(store.set("GEMINI_API_KEY", "  ").is_err());
        assert!(store.remove("GEMINI_API_KEY").unwrap());
        assert!(!store.remove("GEMINI_API_KEY").unwrap());
        assert!(store.remove("OPENROUTER_API_KEY").unwrap());
        assert!(!store.path().exists());
    }

    #[test]
    fn films_are_listed_newest_first_and_keep_their_birthday() {
        let home = TempDir::new().unwrap();
        let (a, b) = (home.path().join("a"), home.path().join("b"));
        remember(home.path(), &a, "A", true);
        std::thread::sleep(std::time::Duration::from_millis(5));
        remember(home.path(), &b, "B", false);
        std::thread::sleep(std::time::Duration::from_millis(5));
        remember(home.path(), &a, "A again", false);
        let films = films(home.path());
        assert_eq!(films.len(), 2);
        assert_eq!(films[0].name, "A again");
        assert!(films[0].created_at > 0);
        assert_eq!(films[1].created_at, 0);
        assert_eq!(films[1].path, b);
        assert!(forget(home.path(), &b).unwrap());
        assert!(!forget(home.path(), &b).unwrap());
    }

    #[test]
    fn films_in_the_films_folder_are_listed_and_a_removed_one_stays_away() {
        let home = TempDir::new().unwrap();
        let folder = TempDir::new().unwrap();
        for name in ["moon", "sleep", "notes"] {
            fs::create_dir(folder.path().join(name)).unwrap();
        }
        fs::write(
            folder.path().join("moon").join("video.json"),
            br#"{"name":"The Moon"}"#,
        )
        .unwrap();
        fs::write(folder.path().join("sleep").join("video.json"), b"{}").unwrap();
        adopt(home.path(), folder.path());
        adopt(home.path(), folder.path());
        let mut names: Vec<String> = films(home.path()).into_iter().map(|f| f.name).collect();
        names.sort();
        assert_eq!(names, ["The Moon", "sleep"]);
        let moon = films(home.path())
            .into_iter()
            .find(|f| f.name == "The Moon")
            .unwrap();
        assert!(forget(home.path(), &moon.path).unwrap());
        adopt(home.path(), folder.path());
        assert_eq!(films(home.path()).len(), 1, "a removed film stays away");
        remember(home.path(), &moon.path, "The Moon", false);
        adopt(home.path(), folder.path());
        assert_eq!(
            films(home.path()).len(),
            2,
            "opening it again shows it again"
        );
    }

    #[test]
    fn slugs_are_folder_names() {
        assert_eq!(slug("Why the sky is blue!"), "why-the-sky-is-blue");
        assert_eq!(
            slug("  Größe wählen: Öl & Maß "),
            "groesse-waehlen-oel-mass"
        );
        assert_eq!(slug("***"), "film");
        let home = TempDir::new().unwrap();
        fs::create_dir(home.path().join("sleep")).unwrap();
        assert_eq!(
            new_film_dir(home.path(), "Sleep"),
            home.path().join("sleep-2")
        );
    }

    #[test]
    fn film_names_lose_asterisks_and_stay_short() {
        assert_eq!(film_name("  **Schlaf** ").as_deref(), Some("Schlaf"));
        assert_eq!(film_name(" * "), None);
        assert_eq!(film_name(&"ä".repeat(200)).unwrap().chars().count(), 120);
    }

    #[test]
    fn a_duplicate_keeps_the_sources_and_leaves_what_was_made() {
        let films = TempDir::new().unwrap();
        let film = films.path().join("sleep");
        let starter = Path::new(env!("CARGO_MANIFEST_DIR")).join("examples/starter");
        for entry in walkdir::WalkDir::new(&starter) {
            let entry = entry.unwrap();
            let target = film.join(entry.path().strip_prefix(&starter).unwrap());
            if entry.file_type().is_dir() {
                fs::create_dir_all(&target).unwrap();
            } else {
                fs::copy(entry.path(), &target).unwrap();
            }
        }
        for (path, text) in [
            ("brief.md", "# Brief"),
            ("audio/voice.wav", "RIFF"),
            ("renders/sleep.mp4", "film"),
            ("process/status.json", "{}"),
            ("report.md", "# Report"),
            (".superint/studio.json", "{}"),
        ] {
            fs::create_dir_all(film.join(path).parent().unwrap()).unwrap();
            fs::write(film.join(path), text).unwrap();
        }

        let to = new_film_dir(films.path(), "Dreams");
        let copy = duplicate(&film, &to, "Dreams").unwrap();
        assert_eq!(folder_key(&copy), folder_key(&to.canonicalize().unwrap()));
        assert!(copy.join("brief.md").is_file());
        assert!(copy.join("audio/voice.wav").is_file());
        assert!(copy.join("scenes").is_dir());
        for left in ["renders", "process", "report.md", ".superint"] {
            assert!(!copy.join(left).exists(), "{left} is not copied");
        }
        let manifest = read_json(&copy.join("video.json")).unwrap();
        assert_eq!(manifest["name"], "Dreams");
        // The original keeps its name and everything it made.
        assert_ne!(
            read_json(&film.join("video.json")).unwrap()["name"],
            "Dreams"
        );
        assert!(film.join("renders/sleep.mp4").is_file());

        // Never over an existing folder, never into the film itself, nothing left behind.
        assert!(duplicate(&film, &copy, "Again").is_err());
        assert!(duplicate(&film, &film.join("inner"), "Inner").is_err());
        assert!(!film.join("inner").exists());
        assert!(duplicate(films.path(), &films.path().join("x"), "X").is_err());
    }

    #[test]
    fn a_start_page_counts_as_watched_only_for_a_moment() {
        let home = TempDir::new().unwrap();
        assert!(!watched(home.path()));
        mark_watched(home.path());
        assert!(watched(home.path()));
        fs::write(
            home.path().join(VIEWER),
            json!({"seenAt": now_ms() - WATCHED_MS - 1}).to_string(),
        )
        .unwrap();
        assert!(!watched(home.path()));
    }
}
