//! The one-click update of a copy the installer put on this computer.
//!
//! The app downloads the release's installer into the user folder and checks its SHA-256
//! against the one GitHub keeps for it. Then it hands over to a helper: a copy of this program
//! in the same folder, started apart from the app. Ending a server ends its whole process tree,
//! and the installer must outlive the app it replaces. The helper ends the app and the Studios,
//! waits until the program files are free, runs the installer silently, notes how it went and
//! starts the app again at its old address. The open start page finds it there and reloads.

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use anyhow::{Context, Result, bail};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

use super::{
    Asset, FOLDER, Kind, Outcome, PRETEND, Pending, Release, SETUP, SUMS, Source, State, busy,
    is_sha256, kind, now_ms, running_version,
};

/// The installer's log, kept after an update for when it failed.
pub const LOG: &str = "setup.log";
/// The helper's name in the update folder.
const HELPER: &str = if cfg!(windows) {
    "superint-video-update.exe"
} else {
    "superint-video-update"
};
/// The installer is about 12 MB; anything far larger is not ours.
const MOST_BYTES: u64 = 400 * 1024 * 1024;
/// For tests, with a test server as the source only: what the stand-in installer is given
/// instead of the installer's switches.
const SETUP_ARGS: &str = "SUPERINT_UPDATE_SETUP_ARGS";

/// What stands in the way of an update, with the code the start page has words for.
#[derive(Debug)]
pub struct Refused {
    pub code: &'static str,
    pub message: String,
    /// Work is running that the update would end: try again later.
    pub conflict: bool,
}

impl Refused {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            conflict: false,
        }
    }
}

impl std::fmt::Display for Refused {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for Refused {}

/// The update that is going on in this process, for the start page.
static PROGRESS: Mutex<Option<Value>> = Mutex::new(None);

fn set_progress(value: Option<Value>) {
    *PROGRESS
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = value;
}

pub fn progress() -> Option<Value> {
    PROGRESS
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .clone()
}

/// An update that may start: the release, its installer and the checksum it must have.
pub struct Ready {
    release: Release,
    asset: Asset,
    sha256: String,
    source: Source,
}

impl Ready {
    pub fn version(&self) -> &str {
        &self.release.version
    }
}

/// Everything that is checked before anything is downloaded. On success this process counts
/// as updating until `run` ends, so a second click does not start a second download.
pub async fn prepare(home: &Path) -> Result<Ready, Refused> {
    if kind() != Kind::Installed {
        return Err(Refused::new(
            "update-not-installable",
            "Only the installed app updates itself. Download the new version from the release page.",
        ));
    }
    let busy = busy(home);
    if !busy.is_empty() {
        let names: Vec<&str> = busy
            .iter()
            .filter_map(|film| film["name"].as_str())
            .collect();
        return Err(Refused {
            conflict: true,
            ..Refused::new(
                "update-busy",
                format!(
                    "Work is running in {}; update when it is done.",
                    names.join(", ")
                ),
            )
        });
    }
    if State::load(home).installing(now_ms()) || !claim() {
        return Err(Refused::new(
            "update-running",
            "An update is already running.",
        ));
    }
    let ready = ready(home).await;
    if ready.is_err() {
        set_progress(None);
    }
    ready
}

/// Takes the one update this process may run at a time.
fn claim() -> bool {
    let mut progress = PROGRESS
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if progress.is_some() {
        return false;
    }
    *progress = Some(json!({"phase": "preparing"}));
    true
}

async fn ready(home: &Path) -> Result<Ready, Refused> {
    let source = Source::current();
    let failed = |error: anyhow::Error| Refused::new("update-check", format!("{error:#}"));
    // The release as it is now: a file replaced since the last look must not be checked
    // against the old checksum.
    let release = super::fresh(home, &source).await.map_err(failed)?;
    let newer = release.filter(|release| {
        release
            .version()
            .zip(running_version())
            .is_some_and(|(release, running)| release > running)
    });
    let Some(release) = newer else {
        return Err(Refused::new("update-none", "This is the newest version."));
    };
    let Some(asset) = release.asset(SETUP).cloned() else {
        return Err(Refused::new(
            "update-verify",
            format!("Version {} has no installer yet.", release.version),
        ));
    };
    if asset.size == 0 || asset.size > MOST_BYTES {
        return Err(Refused::new(
            "update-verify",
            "The installer of the release has an unexpected size.",
        ));
    }
    let sha256 = match &asset.sha256 {
        Some(sha256) => sha256.clone(),
        None => listed_sha256(&source, &release)
            .await
            .map_err(failed)?
            .ok_or_else(|| {
                Refused::new(
                    "update-verify",
                    "The release has no checksum for its installer, so it is not installed.",
                )
            })?,
    };
    Ok(Ready {
        release,
        asset,
        sha256,
        source,
    })
}

/// The installer's line in the release's `SHA256SUMS.txt`, for a file GitHub keeps no digest
/// of. `None` when the release has no such list or the list has no such line.
async fn listed_sha256(source: &Source, release: &Release) -> Result<Option<String>> {
    let Some(sums) = release.asset(SUMS) else {
        return Ok(None);
    };
    let client = source.client(Duration::from_secs(30))?;
    let response = client.get(&sums.url).send().await?.error_for_status()?;
    let text = String::from_utf8(super::read_capped(response, 64 * 1024).await?)?;
    Ok(sums_line(&text, SETUP))
}

fn sums_line(text: &str, name: &str) -> Option<String> {
    text.lines().find_map(|line| {
        let (hash, file) = line.trim().split_once(char::is_whitespace)?;
        let file = file.trim_start().trim_start_matches('*');
        (file == name && is_sha256(hash)).then(|| hash.to_ascii_lowercase())
    })
}

/// Downloads and checks the installer, then starts the helper that installs it. `told` hears
/// how much has arrived. When this returns the helper is at work; it ends this process soon.
pub async fn run(home: &Path, ready: Ready, mut told: impl FnMut(u64, u64)) -> Result<Value> {
    let version = ready.release.version.clone();
    let result = install(home, &ready, &mut told).await;
    match &result {
        Ok(_) => set_progress(Some(json!({"phase": "installing", "version": version}))),
        Err(error) => {
            set_progress(None);
            let reason = if error.downcast_ref::<Unverified>().is_some() {
                "verify"
            } else if error.downcast_ref::<NoHelper>().is_some() {
                "helper"
            } else {
                "download"
            };
            let _ = State::change(home, |state| {
                state.outcome = Some(Outcome::failed(&version, reason));
            });
        }
    }
    result
}

/// The download is not the file the release names.
#[derive(Debug)]
struct Unverified(String);

impl std::fmt::Display for Unverified {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for Unverified {}

/// The helper could not be started.
#[derive(Debug)]
struct NoHelper(String);

impl std::fmt::Display for NoHelper {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for NoHelper {}

async fn install(home: &Path, ready: &Ready, told: &mut impl FnMut(u64, u64)) -> Result<Value> {
    let version = &ready.release.version;
    let folder = home.join(FOLDER);
    let setup = folder.join(&ready.release.tag).join(SETUP);
    let total = ready.asset.size;
    set_progress(Some(
        json!({"phase": "downloading", "version": version, "received": 0, "total": total}),
    ));
    download(
        &ready.source,
        &ready.asset,
        &ready.sha256,
        &setup,
        |received| {
            set_progress(Some(json!({
                "phase": "downloading", "version": version, "received": received, "total": total,
            })));
            told(received, total);
        },
    )
    .await?;
    let exe = std::env::current_exe().context("Own program not found")?;
    let app_dir = exe.parent().context("Own folder not found")?.to_path_buf();
    let helper = folder.join(HELPER);
    std::fs::copy(&exe, &helper)
        .map_err(|error| NoHelper(format!("The helper could not be put in place: {error}")))?;
    let from = running_version().map(|v| v.to_string()).unwrap_or_default();
    State::change(home, |state| {
        state.pending = Some(Pending {
            to: version.clone(),
            from: from.clone(),
            started_at: now_ms(),
        });
        state.outcome = None;
    })?;
    let arguments: Vec<OsString> = vec![
        "update".into(),
        "--finish".into(),
        "--setup".into(),
        setup.clone().into(),
        "--sha256".into(),
        ready.sha256.clone().into(),
        "--to".into(),
        version.into(),
        "--app-dir".into(),
        app_dir.into(),
    ];
    let arguments: Vec<&std::ffi::OsStr> = arguments.iter().map(OsString::as_os_str).collect();
    if let Err(error) = spawn_apart(&helper, &arguments) {
        let _ = State::change(home, |state| state.pending = None);
        return Err(NoHelper(format!("The helper did not start: {error}")).into());
    }
    Ok(json!({
        "installing": version,
        "from": from,
        "log": folder.join(LOG),
        "next": "The app closes, installs the update and comes back by itself. Run `superint-video update` in about a minute to confirm.",
    }))
}

#[cfg(windows)]
fn spawn_apart(program: &Path, arguments: &[&std::ffi::OsStr]) -> Result<()> {
    crate::live::spawn_apart(program, arguments)
}

#[cfg(not(windows))]
fn spawn_apart(_program: &Path, _arguments: &[&std::ffi::OsStr]) -> Result<()> {
    bail!("Only Windows installs updates by itself")
}

/// Streams the file to `to`, counting and hashing as it comes. Only a file of the size and
/// checksum the release names ends up there.
async fn download(
    source: &Source,
    asset: &Asset,
    sha256: &str,
    to: &Path,
    mut told: impl FnMut(u64),
) -> Result<()> {
    use tokio::io::AsyncWriteExt;
    let folder = to.parent().context("No folder for the download")?;
    tokio::fs::create_dir_all(folder).await?;
    let part = to.with_extension("exe.part");
    let client = source.client(Duration::from_secs(30 * 60))?;
    let mut response = client
        .get(&asset.url)
        .send()
        .await
        .context("The download did not start")?
        .error_for_status()
        .context("The download did not start")?;
    if response
        .content_length()
        .is_some_and(|length| length != asset.size)
    {
        bail!(Unverified(
            "The download has another size than the release names.".into()
        ));
    }
    let mut file = tokio::fs::File::create(&part).await?;
    let mut hasher = Sha256::new();
    let mut received = 0u64;
    let mut last_told = 0u64;
    while let Some(chunk) = response.chunk().await.context("The download broke off")? {
        received += chunk.len() as u64;
        if received > asset.size {
            drop(file);
            let _ = tokio::fs::remove_file(&part).await;
            bail!(Unverified(
                "The download is larger than the release names.".into()
            ));
        }
        hasher.update(&chunk);
        file.write_all(&chunk).await?;
        if received - last_told >= 256 * 1024 || received == asset.size {
            last_told = received;
            told(received);
        }
    }
    file.flush().await?;
    file.sync_all().await?;
    drop(file);
    let got = hex::encode(hasher.finalize());
    if received != asset.size || got != sha256 {
        let _ = tokio::fs::remove_file(&part).await;
        bail!(Unverified(
            "The download is not the file the release names, so it is not installed.".into()
        ));
    }
    tokio::fs::rename(&part, to).await?;
    Ok(())
}

fn file_sha256(path: &Path) -> Result<String> {
    use std::io::Read;
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 256 * 1024];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hex::encode(hasher.finalize()))
}

// ------------------------------------------------------------------------------------ the helper

/// What the helper is told by the app that starts it.
pub struct Finish {
    pub setup: PathBuf,
    pub sha256: String,
    pub to: String,
    pub app_dir: PathBuf,
}

/// The helper's work, after the app that started it is gone or about to be.
pub async fn finish(home: &Path, job: Finish) -> Result<Value> {
    // The address the app had, so the page that is still open finds the new one there.
    let port = crate::live::Server::app(home).last_port();
    let verified = file_sha256(&job.setup).is_ok_and(|got| got == job.sha256.to_ascii_lowercase());
    let (app, studios) = match verified {
        true => crate::live::stop_all(home).await,
        false => (false, 0),
    };
    let result = if !verified {
        Err("verify".to_string())
    } else if !free(&job.app_dir).await {
        Err("in-use".to_string())
    } else {
        run_setup(home, &job.setup).await
    };
    let outcome = match &result {
        Ok(()) => Outcome {
            status: "updated".into(),
            version: job.to.clone(),
            reason: None,
            at: now_ms(),
        },
        Err(reason) => Outcome::failed(&job.to, reason),
    };
    State::change(home, |state| {
        state.pending = None;
        state.outcome = Some(outcome.clone());
    })?;
    // Back after a failure too: nobody should find the app gone.
    let restarted = (app || studios > 0) && start_app(&job.app_dir, port).await;
    Ok(json!({
        "status": outcome.status,
        "version": outcome.version,
        "reason": outcome.reason,
        "restarted": restarted,
    }))
}

/// Whether both programs can be written: nothing runs from them any more. A running program
/// refuses to be opened for writing on Windows. The installer would stop halfway at a file in
/// use, so it does not start then.
async fn free(app_dir: &Path) -> bool {
    let files = ["superint-video.exe", "Superint Video.exe"].map(|name| app_dir.join(name));
    for _ in 0..30 {
        let writable = files.iter().all(|file| {
            !file.exists() || std::fs::OpenOptions::new().write(true).open(file).is_ok()
        });
        if writable {
            return true;
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    false
}

/// Runs the installer without a window and waits for it, five minutes at most. It finds the
/// installed folder and the user's earlier choices itself.
async fn run_setup(home: &Path, setup: &Path) -> Result<(), String> {
    let mut command = crate::process::command(setup);
    match setup_args() {
        Some(arguments) => {
            command.args(arguments);
        }
        None => {
            command
                .args([
                    "/VERYSILENT",
                    "/SUPPRESSMSGBOXES",
                    "/NORESTART",
                    "/NOCANCEL",
                    "/SP-",
                    "/NOCLOSEAPPLICATIONS",
                    "/NORESTARTAPPLICATIONS",
                ])
                .arg(format!("/LOG={}", home.join(FOLDER).join(LOG).display()));
        }
    }
    command
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    let mut child = command.spawn().map_err(|_| "setup-start".to_string())?;
    match tokio::time::timeout(Duration::from_secs(5 * 60), child.wait()).await {
        Ok(Ok(status)) if status.success() => Ok(()),
        Ok(Ok(status)) => Err(format!("setup-{}", status.code().unwrap_or(-1))),
        Ok(Err(_)) => Err("setup-wait".into()),
        Err(_) => {
            let _ = child.kill().await;
            Err("setup-timeout".into())
        }
    }
}

/// The stand-in installer's arguments, only ever with a test server as the source.
fn setup_args() -> Option<Vec<String>> {
    if !Source::current().local() {
        return None;
    }
    let arguments = std::env::var(SETUP_ARGS).ok()?;
    Some(arguments.split_whitespace().map(str::to_owned).collect())
}

/// Starts the app from the installed folder at its old address, without a window: the page
/// that is open reconnects by itself. Without the pretend version, which lasts one run.
async fn start_app(app_dir: &Path, port: Option<u16>) -> bool {
    let name = if cfg!(windows) {
        "superint-video.exe"
    } else {
        "superint-video"
    };
    let mut command = crate::process::command(app_dir.join(name));
    command.args(["app", "--no-open"]);
    if let Some(port) = port {
        command.args(["--port", &port.to_string()]);
    }
    command
        .env_remove(PRETEND)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    matches!(
        tokio::time::timeout(Duration::from_secs(60), command.status()).await,
        Ok(Ok(status)) if status.success()
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_checksum_list_gives_the_installers_line_only() {
        let a = "a".repeat(64);
        let b = "B".repeat(64);
        let text = format!(
            "{a}  superint-video.exe\n{b} *{SETUP}\nnot a line\n{a}  Superint-Video-Setup.exe.bak\n"
        );
        assert_eq!(sums_line(&text, SETUP), Some("b".repeat(64)));
        assert_eq!(sums_line("short  Superint-Video-Setup.exe", SETUP), None);
        assert_eq!(sums_line("", SETUP), None);
    }

    #[test]
    fn a_file_is_hashed_as_a_whole() {
        let folder = tempfile::tempdir().unwrap();
        let file = folder.path().join("x");
        std::fs::write(&file, b"abc").unwrap();
        assert_eq!(
            file_sha256(&file).unwrap(),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
}
