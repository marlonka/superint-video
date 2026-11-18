//! Whether a newer Superint Video is out, and the one click that installs it.
//!
//! The app asks GitHub for the latest release once, a few seconds after it starts, and keeps the
//! answer in the user folder (`update.json`). The
//! file holds only what the release is. Whether it is newer is decided by whoever reads it,
//! against its own version: a copy built from the code and an installed one share the file.
//!
//! Only a copy the installer put on this computer updates itself, and only when someone asks
//! for it: see `install`. Every other copy, and the Mac app, is shown the release page.

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tokio_util::sync::CancellationToken;

use crate::home::Settings;

pub mod install;

/// The repository every release comes from. Nothing is downloaded from anywhere else.
pub const REPO: &str = "marlonka/superint-video";
/// The installer an installed copy updates itself with.
pub const SETUP: &str = "Superint-Video-Setup.exe";
/// The Mac app, zipped.
pub const MAC_ZIP: &str = "Superint-Video-macOS.zip";
/// The release's list of checksums, for files GitHub keeps none for.
const SUMS: &str = "SHA256SUMS.txt";
/// The file in the user folder that holds the last look.
const STATE: &str = "update.json";
/// The folder in the user folder for the download, the helper and the installer's log.
pub const FOLDER: &str = "update";

/// How long after the app starts it asks GitHub, so the look does not hold up the start.
const LOOK_AFTER: Duration = Duration::from_secs(5);
/// Someone asking twice within this gets the first answer.
const ASKED_FLOOR_MS: u64 = 60 * 1000;
/// An update that has not said how it went after this long is taken as failed.
const PENDING_FOR_MS: u64 = 10 * 60 * 1000;
/// How long "Updated to X" stays on the start page.
const UPDATED_FOR_MS: u64 = 24 * 60 * 60 * 1000;
/// GitHub's answer for a release is a few kilobytes; a larger one is not GitHub's.
const ANSWER_CAP: usize = 1024 * 1024;
/// What of the release notes the start page shows; the release page has all of it.
const NOTE_BLOCKS: usize = 16;
const NOTE_CHARS: usize = 1500;

/// Makes this program count as another version, to try an update against a release that is
/// already out. It lasts one run: the app the update starts again goes without it.
pub const PRETEND: &str = "SUPERINT_PRETEND_VERSION";
/// Set, the app never asks GitHub by itself.
const NO_CHECK: &str = "SUPERINT_NO_UPDATE_CHECK";
/// For tests: releases come from a server on this computer, `http://127.0.0.1:<port>`.
const SOURCE: &str = "SUPERINT_UPDATE_SOURCE";

// ------------------------------------------------------------------------------------ versions

/// A release number: three plain numbers. A tag with more after them (`-rc.1`, `+build`) is not
/// a release anyone is offered.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct Version(pub u64, pub u64, pub u64);

impl Version {
    /// `0.12.0` or `v0.12.0`.
    pub fn parse(text: &str) -> Option<Self> {
        let text = text.trim();
        let text = text.strip_prefix('v').unwrap_or(text);
        let numbers = text
            .split('.')
            .map(|part| {
                let plain =
                    !part.is_empty() && part.len() <= 9 && part.bytes().all(|b| b.is_ascii_digit());
                plain.then(|| part.parse::<u64>().ok()).flatten()
            })
            .collect::<Option<Vec<_>>>()?;
        match numbers[..] {
            [major, minor, patch] => Some(Self(major, minor, patch)),
            _ => None,
        }
    }
}

impl std::fmt::Display for Version {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}.{}.{}", self.0, self.1, self.2)
    }
}

/// The version this program counts as: its own, or the one `SUPERINT_PRETEND_VERSION` names.
pub fn running_version() -> Option<Version> {
    std::env::var(PRETEND)
        .ok()
        .and_then(|text| Version::parse(&text))
        .or_else(|| Version::parse(env!("CARGO_PKG_VERSION")))
}

// --------------------------------------------------------------------------------- install kind

/// How this copy came onto the computer, which decides whether it can update itself.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    /// Put there by `Superint-Video-Setup.exe`: updates itself.
    Installed,
    /// Unpacked from the zip, or a bare program: shown the release page.
    Portable,
    /// Built from the code, as in `dist` or `target`: shown the release page.
    Dev,
    /// The Mac app: shown the release page.
    Mac,
}

/// The kind of the program that runs.
pub fn kind() -> Kind {
    std::env::current_exe().map_or(Kind::Portable, |exe| kind_of(&exe))
}

/// The installer always leaves its uninstaller beside the program; a build from the code has
/// the repository's `Cargo.toml` a few folders up.
pub fn kind_of(exe: &Path) -> Kind {
    if cfg!(target_os = "macos") {
        return Kind::Mac;
    }
    if cfg!(windows) && exe.with_file_name("unins000.exe").is_file() {
        return Kind::Installed;
    }
    if exe
        .ancestors()
        .skip(1)
        .take(4)
        .any(|folder| folder.join("Cargo.toml").is_file())
    {
        return Kind::Dev;
    }
    Kind::Portable
}

/// The file a release must carry for this computer before anyone here hears of it. The Mac zip
/// comes from CI after the Windows files, so a Mac is told only once it is there.
fn platform_asset() -> Option<&'static str> {
    if cfg!(windows) {
        Some(SETUP)
    } else if cfg!(target_os = "macos") {
        Some(MAC_ZIP)
    } else {
        None
    }
}

// ------------------------------------------------------------------------------------- releases

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Release {
    pub tag: String,
    /// The tag's number, `0.12.0`.
    pub version: String,
    pub published_at: Option<String>,
    /// The release page, built from the tag and never taken from the answer.
    pub url: String,
    pub notes: Vec<Note>,
    pub assets: Vec<Asset>,
}

impl Release {
    pub fn version(&self) -> Option<Version> {
        Version::parse(&self.version)
    }

    pub fn asset(&self, name: &str) -> Option<&Asset> {
        self.assets.iter().find(|asset| asset.name == name)
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Asset {
    pub name: String,
    pub url: String,
    pub size: u64,
    /// Lower-case hex from GitHub's `digest`; none for a file GitHub keeps no digest of.
    pub sha256: Option<String>,
}

/// One block of the release notes as plain text. The start page shows it as text, never as
/// markup, so nothing in the notes can do anything there.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Note {
    pub kind: NoteKind,
    pub text: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NoteKind {
    Heading,
    Text,
    Item,
}

/// Where releases are asked for and downloaded from: GitHub, or for tests the server on this
/// computer that `SUPERINT_UPDATE_SOURCE` names. Nothing else is taken.
#[derive(Clone, Debug)]
pub struct Source {
    api: String,
    downloads: String,
    local: bool,
}

impl Source {
    pub fn current() -> Self {
        if let Some(origin) = std::env::var(SOURCE).ok().as_deref().and_then(local_origin) {
            return Self {
                downloads: format!("{origin}/download"),
                api: origin,
                local: true,
            };
        }
        Self {
            api: "https://api.github.com".into(),
            downloads: format!("https://github.com/{REPO}/releases/download"),
            local: false,
        }
    }

    /// A test server stands in for GitHub.
    pub fn local(&self) -> bool {
        self.local
    }

    fn latest(&self) -> String {
        format!("{}/repos/{REPO}/releases/latest", self.api)
    }

    /// What every download of this release begins with.
    fn download_prefix(&self, tag: &str) -> String {
        format!("{}/{tag}/", self.downloads)
    }

    /// A client of its own: unlike the ones that ask this computer's servers, it goes through
    /// the system's proxy. It follows redirects only to GitHub over HTTPS, where release files
    /// are stored.
    pub fn client(&self, timeout: Duration) -> Result<reqwest::Client> {
        let local = self.local;
        let policy = reqwest::redirect::Policy::custom(move |attempt| {
            if attempt.previous().len() > 5 {
                return attempt.error("too many redirects");
            }
            let url = attempt.url();
            let github = url.scheme() == "https"
                && url.host_str().is_some_and(|host| {
                    host == "github.com" || host.ends_with(".githubusercontent.com")
                });
            let test = local && url.scheme() == "http" && url.host_str() == Some("127.0.0.1");
            if github || test {
                attempt.follow()
            } else {
                attempt.error("a redirect away from GitHub")
            }
        });
        let mut builder = reqwest::Client::builder()
            .user_agent(concat!("superint-video/", env!("CARGO_PKG_VERSION")))
            .connect_timeout(Duration::from_secs(10))
            .timeout(timeout)
            .redirect(policy);
        if local {
            builder = builder.no_proxy();
        }
        Ok(builder.build()?)
    }
}

fn local_origin(url: &str) -> Option<String> {
    let port: u16 = url
        .trim_end_matches('/')
        .strip_prefix("http://127.0.0.1:")?
        .parse()
        .ok()?;
    Some(format!("http://127.0.0.1:{port}"))
}

fn is_sha256(hex: &str) -> bool {
    hex.len() == 64 && hex.bytes().all(|b| b.is_ascii_hexdigit())
}

/// The release in GitHub's answer, if it is one to offer: published, not a pre-release, with a
/// plain version as its tag. Only files at this release's own download address are kept.
pub fn parse_release(answer: &Value, source: &Source) -> Option<Release> {
    if answer["draft"] == true || answer["prerelease"] == true {
        return None;
    }
    let tag = answer["tag_name"].as_str()?;
    let version = Version::parse(tag)?;
    let prefix = source.download_prefix(tag);
    let assets = answer["assets"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|asset| {
            let name = asset["name"].as_str()?;
            let url = asset["browser_download_url"].as_str()?;
            let plain = !name.is_empty()
                && name
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"-_.".contains(&b));
            if !plain || url != format!("{prefix}{name}") {
                return None;
            }
            let sha256 = asset["digest"]
                .as_str()
                .and_then(|digest| digest.strip_prefix("sha256:"))
                .filter(|hex| is_sha256(hex))
                .map(str::to_ascii_lowercase);
            Some(Asset {
                name: name.into(),
                url: url.into(),
                size: asset["size"].as_u64()?,
                sha256,
            })
        })
        .collect();
    Some(Release {
        tag: tag.into(),
        version: version.to_string(),
        published_at: answer["published_at"].as_str().map(str::to_owned),
        url: format!("https://github.com/{REPO}/releases/tag/{tag}"),
        notes: notes(answer["body"].as_str().unwrap_or_default()),
        assets,
    })
}

/// The first part of the release notes, what is new, as plain blocks. Their next part, how to
/// download, is for the release page.
pub fn notes(body: &str) -> Vec<Note> {
    fn push(blocks: &mut Vec<Note>, kind: NoteKind, text: &str) {
        let text = plain(text);
        if !text.is_empty() {
            blocks.push(Note { kind, text });
        }
    }
    let mut blocks = Vec::new();
    let mut paragraph = String::new();
    for line in body.lines() {
        let line = line.trim();
        let item = line.strip_prefix("- ").or_else(|| line.strip_prefix("* "));
        let heading = line.starts_with('#');
        if line.is_empty() || heading || item.is_some() {
            push(&mut blocks, NoteKind::Text, &paragraph);
            paragraph.clear();
        }
        if heading {
            let level = line.bytes().take_while(|&b| b == b'#').count();
            if level <= 2 {
                if blocks.is_empty() {
                    continue;
                }
                break;
            }
            push(&mut blocks, NoteKind::Heading, &line[level..]);
        } else if let Some(item) = item {
            push(&mut blocks, NoteKind::Item, item);
        } else if !line.is_empty() {
            if !paragraph.is_empty() {
                paragraph.push(' ');
            }
            paragraph.push_str(line);
        }
    }
    push(&mut blocks, NoteKind::Text, &paragraph);
    let mut used = 0;
    let mut shown: Vec<Note> = blocks
        .into_iter()
        .take(NOTE_BLOCKS)
        .take_while(|block| {
            used += block.text.chars().count();
            used <= NOTE_CHARS
        })
        .collect();
    while shown
        .last()
        .is_some_and(|block| block.kind == NoteKind::Heading)
    {
        shown.pop();
    }
    shown
}

/// Markdown's marks taken out: a link keeps its words, emphasis and code their text.
fn plain(text: &str) -> String {
    let mut out = String::new();
    let mut rest = text.trim();
    while let Some(open) = rest.find('[') {
        out.push_str(&rest[..open]);
        let after = &rest[open + 1..];
        let link = after.find(']').and_then(|close| {
            let target = after[close + 1..].strip_prefix('(')?;
            let end = target.find(')')?;
            Some((close, &target[end + 1..]))
        });
        match link {
            Some((close, next)) => {
                out.push_str(&after[..close]);
                rest = next;
            }
            None => {
                out.push('[');
                rest = after;
            }
        }
    }
    out.push_str(rest);
    out.replace("**", "")
        .replace("__", "")
        .replace('`', "")
        .trim()
        .to_string()
}

// ---------------------------------------------------------------------------------- the record

/// What `update.json` holds: the last look, and what the user and the last update left there.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct State {
    pub checked_at: Option<u64>,
    pub etag: Option<String>,
    pub release: Option<Release>,
    /// The version the user chose to skip.
    pub skipped: Option<String>,
    pub pending: Option<Pending>,
    pub outcome: Option<Outcome>,
    /// GitHub's request limit was reached: no look by itself before this.
    pub retry_after: Option<u64>,
}

/// An update the helper is installing.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pending {
    pub to: String,
    pub from: String,
    pub started_at: u64,
}

/// How the last update went.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Outcome {
    /// `updated` or `failed`.
    pub status: String,
    pub version: String,
    /// Why it failed: `download`, `verify`, `helper`, `in-use`, `setup-<exit code>` or `lost`.
    #[serde(default)]
    pub reason: Option<String>,
    pub at: u64,
}

impl Outcome {
    pub fn failed(version: &str, reason: &str) -> Self {
        Self {
            status: "failed".into(),
            version: version.into(),
            reason: Some(reason.into()),
            at: now_ms(),
        }
    }
}

/// Two requests of one process change the file one after the other.
static LOCK: Mutex<()> = Mutex::new(());

impl State {
    pub fn load(home: &Path) -> Self {
        crate::home::read_json(&home.join(STATE))
            .and_then(|value| serde_json::from_value(value).ok())
            .unwrap_or_default()
    }

    fn save(&self, home: &Path) -> Result<()> {
        let mut bytes = serde_json::to_vec_pretty(self)?;
        bytes.push(b'\n');
        crate::project::atomic_write(&home.join(STATE), &bytes)
    }

    /// Reads the file, changes it and writes it back.
    pub fn change<T>(home: &Path, change: impl FnOnce(&mut State) -> T) -> Result<T> {
        let _held = LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let mut state = Self::load(home);
        let result = change(&mut state);
        state.save(home)?;
        Ok(result)
    }

    /// An update was started less than ten minutes ago and has not said how it went.
    fn installing(&self, now: u64) -> bool {
        self.pending
            .as_ref()
            .is_some_and(|pending| now.saturating_sub(pending.started_at) <= PENDING_FOR_MS)
    }
}

pub fn now_ms() -> u64 {
    crate::project::now_ms()
}

// ------------------------------------------------------------------------------------- looking

/// Whether the app asks GitHub by itself: the setting, unless `SUPERINT_NO_UPDATE_CHECK` is set
/// or this is a CI machine. Asked by someone, it always looks.
pub fn enabled(settings: &Settings) -> bool {
    if Source::current().local() {
        return settings.check_for_updates;
    }
    settings.check_for_updates
        && std::env::var_os(NO_CHECK).is_none()
        && std::env::var_os("CI").is_none()
}

enum Answer {
    Unchanged,
    Latest {
        release: Option<Release>,
        etag: Option<String>,
    },
    Limited(u64),
}

async fn fetch(source: &Source, etag: Option<&str>) -> Result<Answer> {
    let client = source.client(Duration::from_secs(15))?;
    let mut request = client
        .get(source.latest())
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28");
    if let Some(etag) = etag {
        request = request.header("If-None-Match", etag);
    }
    let response = request.send().await.context("GitHub did not answer")?;
    let status = response.status();
    let header = |name: &str| {
        response
            .headers()
            .get(name)
            .and_then(|value| value.to_str().ok())
            .map(str::to_owned)
    };
    match status.as_u16() {
        304 => Ok(Answer::Unchanged),
        // No release yet.
        404 => Ok(Answer::Latest {
            release: None,
            etag: None,
        }),
        // GitHub's request limit: 429, or 403 with nothing left. Any other 403 is an error.
        403 if header("x-ratelimit-remaining").as_deref() != Some("0") => {
            bail!("GitHub answered {status}")
        }
        403 | 429 => {
            let now = now_ms();
            let until = header("x-ratelimit-reset")
                .and_then(|reset| reset.parse::<u64>().ok())
                .map(|seconds| seconds * 1000)
                .or_else(|| {
                    header("retry-after")
                        .and_then(|after| after.parse::<u64>().ok())
                        .map(|seconds| now + seconds * 1000)
                })
                .filter(|&until| until > now)
                .unwrap_or(now + 60 * 60 * 1000);
            Ok(Answer::Limited(until))
        }
        200 => {
            let etag = header("etag");
            let bytes = read_capped(response, ANSWER_CAP).await?;
            let answer: Value =
                serde_json::from_slice(&bytes).context("GitHub's answer is not JSON")?;
            Ok(Answer::Latest {
                release: parse_release(&answer, source),
                etag,
            })
        }
        _ => bail!("GitHub answered {status}"),
    }
}

/// The whole body, unless it is larger than `cap`.
pub(crate) async fn read_capped(mut response: reqwest::Response, cap: usize) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await? {
        if bytes.len() + chunk.len() > cap {
            bail!("the answer is larger than expected");
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

/// Asks GitHub for the latest release and keeps the answer. `asked`: someone waits for it.
/// They hear of a failure, and a look from the last minute is answer enough; the app looking
/// by itself fails quietly and keeps what it knew.
pub async fn check(home: &Path, asked: bool) -> Result<State> {
    let now = now_ms();
    let before = State::load(home);
    if asked
        && before
            .checked_at
            .is_some_and(|at| now.saturating_sub(at) < ASKED_FLOOR_MS)
    {
        return Ok(before);
    }
    if before.retry_after.is_some_and(|until| until > now) {
        if asked {
            bail!("GitHub's limit for requests is reached; try again in an hour");
        }
        return Ok(before);
    }
    let source = Source::current();
    let etag = before.etag.as_deref().filter(|_| before.release.is_some());
    let answer = fetch(&source, etag).await;
    let now = now_ms();
    let state = State::change(home, |state| {
        match &answer {
            Ok(Answer::Unchanged) => {
                state.checked_at = Some(now);
                state.retry_after = None;
            }
            Ok(Answer::Latest { release, etag }) => {
                state.release = release.clone();
                state.etag = etag.clone();
                state.checked_at = Some(now);
                state.retry_after = None;
            }
            Ok(Answer::Limited(until)) => state.retry_after = Some(*until),
            Err(_) => {}
        }
        state.clone()
    })?;
    match answer {
        Ok(Answer::Limited(_)) if asked => {
            bail!("GitHub's limit for requests is reached; try again in an hour")
        }
        Err(error) if asked => Err(error),
        _ => Ok(state),
    }
}

/// The latest release as GitHub has it now, without the cache: what an update installs. It is
/// kept as the last look, too.
pub(crate) async fn fresh(home: &Path, source: &Source) -> Result<Option<Release>> {
    let release = match fetch(source, None).await? {
        Answer::Latest { release, etag } => {
            let now = now_ms();
            let kept = release.clone();
            State::change(home, |state| {
                state.release = kept;
                state.etag = etag;
                state.checked_at = Some(now);
                state.retry_after = None;
            })?;
            release
        }
        Answer::Limited(_) => bail!("GitHub's limit for requests is reached; try again in an hour"),
        Answer::Unchanged => bail!("GitHub answered without a release"),
    };
    Ok(release)
}

/// Looks for a new version once, a few seconds after the app starts, however recent the last
/// look is; the next look by itself is at the next start. While GitHub says to wait, `check`
/// keeps what it knew. Only the app does this, never a film's Studio.
pub async fn watch(home: PathBuf, closing: CancellationToken) {
    tokio::select! {
        _ = closing.cancelled() => return,
        _ = tokio::time::sleep(LOOK_AFTER) => {}
    }
    let settings = Settings::load(&home).unwrap_or_default();
    if enabled(&settings) {
        let _ = check(&home, false).await;
    }
}

// --------------------------------------------------------------------------------- what to say

/// The release to offer a copy running `running`: a newer one with this computer's download.
pub fn offered(state: &State, running: Option<Version>) -> Option<&Release> {
    let release = state.release.as_ref()?;
    let newer = release
        .version()
        .zip(running)
        .is_some_and(|(release, running)| release > running);
    let here = platform_asset().is_some_and(|name| release.asset(name).is_some());
    (newer && here).then_some(release)
}

/// How the last update went, while that is worth saying: "updated" for a day on the version it
/// brought, "failed" until the user has seen it or runs that version after all. An update
/// whose helper never said how it went counts as failed after ten minutes.
fn outcome(state: &State, running: Option<Version>, now: u64) -> Option<Outcome> {
    let on = |version: &str| running.is_some() && Version::parse(version) == running;
    if let Some(outcome) = &state.outcome {
        let shown = match outcome.status.as_str() {
            "updated" => on(&outcome.version) && now.saturating_sub(outcome.at) < UPDATED_FOR_MS,
            _ => !on(&outcome.version),
        };
        return shown.then(|| outcome.clone());
    }
    let pending = state.pending.as_ref()?;
    if state.installing(now) {
        return None;
    }
    let arrived = on(&pending.to);
    Some(Outcome {
        status: if arrived { "updated" } else { "failed" }.into(),
        version: pending.to.clone(),
        reason: (!arrived).then(|| "lost".into()),
        at: pending.started_at,
    })
}

/// Films whose work an update would end: a render, or a command of the coding agent.
pub fn busy(home: &Path) -> Vec<Value> {
    crate::home::films(home)
        .into_iter()
        .filter_map(|film| {
            let live = crate::live::read(&film.path);
            let what = if live["render"]["status"] == "running" {
                Some(json!("render"))
            } else {
                live["running"]
                    .as_array()
                    .and_then(|running| running.first())
                    .map(|running| running["label"].clone())
            };
            what.map(|what| json!({"name": film.name, "what": what}))
        })
        .collect()
}

/// The same, from the rows of the start page's film list, which have read it already.
pub fn busy_in(films: &[Value]) -> Vec<Value> {
    films
        .iter()
        .filter_map(|film| {
            let what = if film["render"]["status"] == "running" {
                json!("render")
            } else if film["running"].is_null() {
                return None;
            } else {
                film["running"].clone()
            };
            Some(json!({"name": film["name"], "what": what}))
        })
        .collect()
}

/// Everything the start page shows about updates.
pub fn status(home: &Path, settings: &Settings) -> Value {
    status_with(home, settings, busy(home))
}

/// The same, with the films whose work an update would end already known.
pub fn status_with(home: &Path, settings: &Settings, busy: Vec<Value>) -> Value {
    let state = State::load(home);
    let running = running_version();
    let now = now_ms();
    let kind = kind();
    let outcome = outcome(&state, running, now);
    let available = offered(&state, running).map(|release| {
        let failed = outcome
            .as_ref()
            .is_some_and(|o| o.status == "failed" && o.version == release.version);
        json!({
            "version": release.version,
            "tag": release.tag,
            "publishedAt": release.published_at,
            "url": release.url,
            "notes": release.notes,
            "size": platform_asset().and_then(|name| release.asset(name)).map(|asset| asset.size),
            "skipped": state.skipped.as_deref() == Some(release.version.as_str()),
            "failed": failed,
        })
    });
    // The helper ends this process before it installs; while the record says it has not
    // finished, the update is being installed.
    let installing = state.installing(now);
    let progress = install::progress()
        .filter(|progress| progress["phase"] != "installing" || installing)
        .or_else(|| {
            installing.then(
                || json!({"phase": "installing", "version": state.pending.as_ref().map(|p| &p.to)}),
            )
        });
    let log = home.join(FOLDER).join(install::LOG);
    json!({
        "current": running.map_or_else(|| env!("CARGO_PKG_VERSION").to_string(), |v| v.to_string()),
        "kind": kind,
        "canInstall": kind == Kind::Installed,
        "checks": enabled(settings),
        "checkedAt": state.checked_at,
        "available": available,
        "progress": progress,
        "busy": busy,
        "outcome": outcome.map(|outcome| json!({
            "status": outcome.status,
            "version": outcome.version,
            "reason": outcome.reason,
            "at": outcome.at,
            "log": outcome.status == "failed" && log.is_file(),
        })),
    })
}

/// What `superint-video update` prints: the same as the start page, with the next step.
pub fn report(home: &Path) -> Value {
    let settings = Settings::load(home).unwrap_or_default();
    let mut report = status(home, &settings);
    report["next"] = json!(match (&report["available"], report["canInstall"] == true) {
        (Value::Null, _) => "This is the newest version.".to_string(),
        (available, true) => format!(
            "Version {} is out. Install it only when the user asks for it and no film is rendering: `superint-video update --install`.",
            available["version"].as_str().unwrap_or_default()
        ),
        (available, false) => format!(
            "Version {} is out. This copy does not update itself: the user downloads it from {}.",
            available["version"].as_str().unwrap_or_default(),
            available["url"].as_str().unwrap_or_default()
        ),
    });
    report
}

/// The user does not want to hear of this version again; the next one is offered as usual.
pub fn skip(home: &Path, version: &str) -> Result<()> {
    let version = Version::parse(version).context("not a version")?;
    State::change(home, |state| state.skipped = Some(version.to_string()))
}

/// The user has read how the last update went.
pub fn seen(home: &Path) -> Result<()> {
    let now = now_ms();
    State::change(home, |state| {
        state.outcome = None;
        if !state.installing(now) {
            state.pending = None;
        }
    })
}

/// What an earlier update left in the user folder, apart from the installer's log. Not while an
/// update runs, and nothing from the last ten minutes: a download or the helper may still be
/// at work on it.
pub fn tidy(home: &Path) {
    if State::load(home).installing(now_ms()) {
        return;
    }
    let folder = home.join(FOLDER);
    let recent = |entry: &std::fs::DirEntry| {
        entry
            .metadata()
            .and_then(|meta| meta.modified())
            .is_ok_and(|at| {
                at.elapsed()
                    .is_ok_and(|age| age.as_millis() < u128::from(PENDING_FOR_MS))
            })
    };
    for entry in std::fs::read_dir(&folder).into_iter().flatten().flatten() {
        let path = entry.path();
        if entry.file_name() == install::LOG || recent(&entry) {
            continue;
        }
        let _ = if path.is_dir() {
            std::fs::remove_dir_all(&path)
        } else {
            std::fs::remove_file(&path)
        };
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn github() -> Source {
        Source {
            api: "https://api.github.com".into(),
            downloads: format!("https://github.com/{REPO}/releases/download"),
            local: false,
        }
    }

    fn answer(tag: &str) -> Value {
        let download =
            |name: &str| format!("https://github.com/{REPO}/releases/download/{tag}/{name}");
        json!({
            "tag_name": tag,
            "draft": false,
            "prerelease": false,
            "published_at": "2026-11-20T10:00:00Z",
            "html_url": "https://example.com/elsewhere",
            "body": "## Windows und macOS\n\nWhat is new.\n\n### Neu\n\n- A **button** for [updates](https://x.y).\n\n## Download und Start\n\n1. Download.",
            "assets": [
                {"name": SETUP, "size": 10, "browser_download_url": download(SETUP),
                 "digest": format!("sha256:{}", "A".repeat(64))},
                {"name": MAC_ZIP, "size": 20, "browser_download_url": download(MAC_ZIP)},
                {"name": "evil.exe", "size": 5, "browser_download_url": "https://evil.example/evil.exe"},
            ],
        })
    }

    #[test]
    fn versions_compare_as_numbers_and_suffixes_are_no_release() {
        assert!(Version::parse("v0.12.0") > Version::parse("0.11.3"));
        assert!(Version::parse("0.10.0") > Version::parse("0.9.9"));
        assert_eq!(Version::parse("v1.2.3"), Some(Version(1, 2, 3)));
        assert_eq!(Version::parse("0.12.0").unwrap().to_string(), "0.12.0");
        for no in [
            "0.12.0-rc.1",
            "0.12.0+build",
            "0.12",
            "1.2.3.4",
            "",
            "v",
            "x.y.z",
            "1..2",
        ] {
            assert_eq!(Version::parse(no), None, "{no}");
        }
    }

    #[test]
    fn a_release_keeps_only_its_own_files_and_its_page_comes_from_the_tag() {
        let release = parse_release(&answer("v0.12.0"), &github()).unwrap();
        assert_eq!(release.version, "0.12.0");
        assert_eq!(
            release.url,
            format!("https://github.com/{REPO}/releases/tag/v0.12.0")
        );
        let names: Vec<_> = release.assets.iter().map(|a| a.name.as_str()).collect();
        assert_eq!(names, [SETUP, MAC_ZIP]);
        assert_eq!(
            release.asset(SETUP).unwrap().sha256.as_deref(),
            Some("a".repeat(64).as_str())
        );
        assert_eq!(release.asset(MAC_ZIP).unwrap().sha256, None);
    }

    #[test]
    fn drafts_pre_releases_and_odd_tags_are_not_offered() {
        let mut draft = answer("v0.12.0");
        draft["draft"] = json!(true);
        assert!(parse_release(&draft, &github()).is_none());
        let mut pre = answer("v0.12.0");
        pre["prerelease"] = json!(true);
        assert!(parse_release(&pre, &github()).is_none());
        assert!(parse_release(&answer("v0.12.0-rc.1"), &github()).is_none());
        assert!(parse_release(&answer("nightly"), &github()).is_none());
    }

    #[test]
    fn the_notes_are_the_first_part_as_plain_text() {
        let release = parse_release(&answer("v0.12.0"), &github()).unwrap();
        let blocks: Vec<_> = release
            .notes
            .iter()
            .map(|n| (n.kind, n.text.as_str()))
            .collect();
        assert_eq!(
            blocks,
            [
                (NoteKind::Text, "What is new."),
                (NoteKind::Heading, "Neu"),
                (NoteKind::Item, "A button for updates."),
            ]
        );
        assert_eq!(plain("[a] and [b](c) `d`"), "[a] and b d");
        let long: String = (0..40)
            .map(|i| format!("- item {i} {}\n", "x".repeat(60)))
            .collect();
        let shown = notes(&format!("### Neu\n{long}"));
        assert!(
            shown.len() < 30 && shown.iter().map(|n| n.text.len()).sum::<usize>() <= NOTE_CHARS
        );
    }

    #[test]
    fn only_a_newer_release_with_this_computers_download_is_offered() {
        let release = parse_release(&answer("v0.12.0"), &github()).unwrap();
        let state = State {
            release: Some(release.clone()),
            ..State::default()
        };
        assert!(offered(&state, Version::parse("0.11.3")).is_some() == platform_asset().is_some());
        assert!(offered(&state, Version::parse("0.12.0")).is_none());
        assert!(offered(&state, Version::parse("0.13.0")).is_none());
        assert!(offered(&state, None).is_none());
        let bare = State {
            release: Some(Release {
                assets: Vec::new(),
                ..release
            }),
            ..State::default()
        };
        assert!(offered(&bare, Version::parse("0.11.3")).is_none());
    }

    #[test]
    fn how_an_update_went_is_said_while_it_matters() {
        let now = 100 * UPDATED_FOR_MS;
        let at = |status: &str, version: &str, at: u64| State {
            outcome: Some(Outcome {
                status: status.into(),
                version: version.into(),
                reason: None,
                at,
            }),
            ..State::default()
        };
        let v = Version::parse;
        assert!(outcome(&at("updated", "0.12.0", now), v("0.12.0"), now).is_some());
        assert!(
            outcome(
                &at("updated", "0.12.0", now - UPDATED_FOR_MS),
                v("0.12.0"),
                now
            )
            .is_none()
        );
        assert!(outcome(&at("updated", "0.12.0", now), v("0.11.3"), now).is_none());
        assert!(outcome(&at("failed", "0.12.0", 0), v("0.11.3"), now).is_some());
        assert!(outcome(&at("failed", "0.12.0", 0), v("0.12.0"), now).is_none());
        let pending = |started_at| State {
            pending: Some(Pending {
                to: "0.12.0".into(),
                from: "0.11.3".into(),
                started_at,
            }),
            ..State::default()
        };
        assert!(outcome(&pending(now - 1000), v("0.11.3"), now).is_none());
        let lost = outcome(&pending(now - 2 * PENDING_FOR_MS), v("0.11.3"), now).unwrap();
        assert_eq!(
            (lost.status.as_str(), lost.reason.as_deref()),
            ("failed", Some("lost"))
        );
        let arrived = outcome(&pending(now - 2 * PENDING_FOR_MS), v("0.12.0"), now).unwrap();
        assert_eq!(arrived.status, "updated");
    }

    #[test]
    fn only_a_test_server_on_this_computer_stands_in_for_github() {
        assert_eq!(
            local_origin("http://127.0.0.1:4100/").as_deref(),
            Some("http://127.0.0.1:4100")
        );
        for no in [
            "https://127.0.0.1:4100",
            "http://localhost:4100",
            "http://127.0.0.1:4100/x",
            "http://evil/",
        ] {
            assert_eq!(local_origin(no), None, "{no}");
        }
    }

    #[test]
    fn the_kind_follows_the_files_beside_the_program() {
        let folder = tempfile::tempdir().unwrap();
        let exe = folder.path().join("app").join("superint-video.exe");
        std::fs::create_dir_all(exe.parent().unwrap()).unwrap();
        if cfg!(target_os = "macos") {
            assert_eq!(kind_of(&exe), Kind::Mac);
            return;
        }
        assert_eq!(kind_of(&exe), Kind::Portable);
        std::fs::write(folder.path().join("Cargo.toml"), "").unwrap();
        assert_eq!(kind_of(&exe), Kind::Dev);
        std::fs::write(exe.with_file_name("unins000.exe"), "").unwrap();
        let installed = if cfg!(windows) {
            Kind::Installed
        } else {
            Kind::Dev
        };
        assert_eq!(kind_of(&exe), installed);
    }
}
