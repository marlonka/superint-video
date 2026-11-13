//! What Studio shows while long commands run, whoever started them. The agent's CLI and Studio's
//! own Export report the same way, through files in `.superint/live/`, so nobody has to take a
//! render on trust. Reporting never fails the work it reports on: every write here is best effort.
use crate::{process, project::now_ms};
use anyhow::{Context, Result, bail};
use serde_json::{Value, json};
use std::{
    collections::VecDeque,
    ffi::OsStr,
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio_util::sync::CancellationToken;

pub const DIR: &str = ".superint/live";
const RENDER: &str = "render.json";
/// The frame a render showed last, in `DIR`.
pub const LATEST: &str = "latest.png";
const STRIP: &str = "strip";
const STUDIO: &str = ".superint/studio.json";
/// Without a heartbeat for this long the process is gone: Studio says so instead of spinning on.
const STALE_MS: u64 = 20_000;
const HEARTBEAT: Duration = Duration::from_secs(2);
const LATEST_EVERY: Duration = Duration::from_secs(2);
const STRIP_WIDTH: u32 = 480;
const STRIP_FRAMES: u64 = 120;
const RATE_WINDOW: Duration = Duration::from_secs(90);

fn write_atomic(path: &Path, bytes: &[u8]) {
    let temporary = path.with_extension(format!("{}.tmp", uuid::Uuid::new_v4().simple()));
    if fs::write(&temporary, bytes).is_err() || fs::rename(&temporary, path).is_err() {
        let _ = fs::remove_file(&temporary);
    }
}

/// `1 h 57 min`, `12 min`, `40 s`.
pub fn duration_text(seconds: f64) -> String {
    let total = seconds.max(0.0).round() as u64;
    match (total / 3600, (total % 3600) / 60) {
        (0, 0) => format!("{total} s"),
        (0, minutes) => format!("{minutes} min"),
        (hours, minutes) => format!("{hours} h {minutes:02} min"),
    }
}

struct State {
    status: &'static str,
    stage: String,
    completed: u64,
    total: u64,
    error: Option<String>,
    result: Option<Value>,
    latest_frame: Option<u64>,
    strip: Vec<u64>,
    finished_at: Option<u64>,
    samples: VecDeque<(Instant, u64)>,
    last_write: Option<Instant>,
    last_latest: Option<Instant>,
}

/// One render's live state.
pub struct LiveRender {
    dir: PathBuf,
    output: String,
    in_project: bool,
    started_at: u64,
    fps: f64,
    strip_every: u64,
    state: Mutex<State>,
    heartbeat: CancellationToken,
}

impl LiveRender {
    /// Starts reporting; the previous render's pictures go. Call from inside a Tokio runtime.
    pub fn start(root: &Path, output: &Path, total: u64, fps: f64) -> Arc<Self> {
        let dir = root.join(DIR);
        let _ = fs::remove_dir_all(dir.join(STRIP));
        let _ = fs::remove_file(dir.join(LATEST));
        let _ = fs::create_dir_all(dir.join(STRIP));
        let parent = output
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .unwrap_or(Path::new("."));
        let _ = fs::create_dir_all(parent);
        let full = fs::canonicalize(parent)
            .map(|p| p.join(output.file_name().unwrap_or_default()))
            .unwrap_or_else(|_| output.to_path_buf());
        let inside = fs::canonicalize(root)
            .ok()
            .and_then(|r| full.strip_prefix(r).ok().map(Path::to_path_buf));
        let in_project = inside.is_some();
        let shown = inside
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|| {
                crate::project::without_verbatim(&full)
                    .display()
                    .to_string()
            });
        let live = Arc::new(Self {
            dir,
            output: shown,
            in_project,
            started_at: now_ms(),
            fps,
            strip_every: (total / STRIP_FRAMES).max(30),
            state: Mutex::new(State {
                status: "running",
                stage: "Preparing".into(),
                completed: 0,
                total,
                error: None,
                result: None,
                latest_frame: None,
                strip: Vec::new(),
                finished_at: None,
                samples: VecDeque::new(),
                last_write: None,
                last_latest: None,
            }),
            heartbeat: CancellationToken::new(),
        });
        live.persist();
        let beat = live.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(HEARTBEAT);
            loop {
                tokio::select! {
                    _ = beat.heartbeat.cancelled() => break,
                    _ = interval.tick() => beat.persist(),
                }
            }
        });
        live
    }

    fn rate(state: &State) -> Option<f64> {
        let (first, last) = (state.samples.front()?, state.samples.back()?);
        let seconds = last.0.duration_since(first.0).as_secs_f64();
        (seconds >= 2.0 && last.1 > first.1).then(|| (last.1 - first.1) as f64 / seconds)
    }

    fn persist(&self) {
        let value = {
            let state = self.state.lock().unwrap();
            let rate = Self::rate(&state);
            json!({
                "pid": std::process::id(),
                "status": state.status,
                "stage": state.stage,
                "completed": state.completed,
                "total": state.total,
                "fps": self.fps,
                "framesPerSecond": rate,
                "etaSeconds": rate.map(|r| state.total.saturating_sub(state.completed) as f64 / r),
                "startedAt": self.started_at,
                "updatedAt": now_ms(),
                "finishedAt": state.finished_at,
                "output": self.output,
                "outputInProject": self.in_project,
                "latestFrame": state.latest_frame,
                "strip": state.strip,
                "error": state.error,
                "result": state.result,
            })
        };
        write_atomic(
            &self.dir.join(RENDER),
            serde_json::to_string(&value).unwrap_or_default().as_bytes(),
        );
    }

    pub fn progress(&self, stage: &str, completed: u64, total: u64) {
        let write = {
            let mut state = self.state.lock().unwrap();
            let now = Instant::now();
            state.stage = stage.into();
            state.completed = completed;
            state.total = total;
            state.samples.push_back((now, completed));
            while state
                .samples
                .front()
                .is_some_and(|s| now.duration_since(s.0) > RATE_WINDOW)
            {
                state.samples.pop_front();
            }
            let due = state
                .last_write
                .is_none_or(|t| now.duration_since(t) >= Duration::from_secs(1));
            if due {
                state.last_write = Some(now);
            }
            due
        };
        if write {
            self.persist();
        }
    }

    /// A line for the terminal: `1500/11355 (13 %, 1.36 frames/s, about 1 h 57 min left)`.
    pub fn line(&self, stage: &str, completed: u64, total: u64) -> String {
        let state = self.state.lock().unwrap();
        match Self::rate(&state).filter(|_| completed < total) {
            Some(rate) => format!(
                "{stage}: {completed}/{total} ({} %, {rate:.2} frames/s, about {} left)",
                completed * 100 / total.max(1),
                duration_text(total.saturating_sub(completed) as f64 / rate),
            ),
            None => format!("{stage}: {completed}/{total}"),
        }
    }

    /// A finished frame on its way to the encoder: now and then it becomes the live picture, and
    /// at even steps a thumbnail of the film strip. The encoder never waits for this.
    pub fn frame(self: &Arc<Self>, frame: u64, png: &[u8]) {
        let strip = frame.is_multiple_of(self.strip_every);
        let latest = {
            let mut state = self.state.lock().unwrap();
            let due = state
                .last_latest
                .is_none_or(|t| t.elapsed() >= LATEST_EVERY);
            if due {
                state.last_latest = Some(Instant::now());
            }
            due
        };
        if !strip && !latest {
            return;
        }
        let bytes = png.to_vec();
        let live = self.clone();
        tokio::task::spawn_blocking(move || {
            if latest {
                write_atomic(&live.dir.join(LATEST), &bytes);
                live.state.lock().unwrap().latest_frame = Some(frame);
            }
            if strip && let Ok(jpeg) = jpeg_thumbnail(&bytes, STRIP_WIDTH) {
                write_atomic(&strip_path(&live.dir, frame), &jpeg);
                let mut state = live.state.lock().unwrap();
                state.strip.push(frame);
                state.strip.sort_unstable();
            }
        });
    }

    /// Ends reporting. `result` is what the render returned.
    pub fn finish(&self, result: &Result<Value>, cancelled: bool) {
        self.heartbeat.cancel();
        {
            let mut state = self.state.lock().unwrap();
            state.finished_at = Some(now_ms());
            match result {
                Ok(value) => {
                    state.status = "completed";
                    state.stage = "Ready".into();
                    state.completed = state.total;
                    state.result = Some(value.clone());
                }
                Err(error) => {
                    state.status = if cancelled { "cancelled" } else { "failed" };
                    state.stage = state.status.into();
                    state.error = Some(format!("{error:#}"));
                }
            }
        }
        self.persist();
    }
}

fn strip_path(dir: &Path, frame: u64) -> PathBuf {
    dir.join(STRIP).join(format!("{frame:08}.jpg"))
}

/// A picture made small, as a JPEG no wider and no taller than `size`.
pub fn jpeg_thumbnail(picture: &[u8], size: u32) -> Result<Vec<u8>> {
    let small = image::load_from_memory(picture)?
        .thumbnail(size, size)
        .to_rgb8();
    let mut jpeg = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg, 82).encode_image(&small)?;
    Ok(jpeg)
}

/// Marks a long command as running for as long as this value lives.
pub struct Running {
    path: PathBuf,
    heartbeat: CancellationToken,
}

impl Running {
    /// Only inside a real project: a command in any other folder leaves nothing behind.
    pub fn start(root: &Path, label: &str) -> Option<Self> {
        Self::begin(root, label, None)
    }

    /// A command that waits for the user to do something in Studio; `asks` names it, and
    /// Studio brings the view for it to the front. `recording`: the user reads the voice text.
    pub fn asking(root: &Path, label: &str, asks: &'static str) -> Option<Self> {
        Self::begin(root, label, Some(asks))
    }

    fn begin(root: &Path, label: &str, asks: Option<&'static str>) -> Option<Self> {
        if !root.join("video.json").is_file() {
            return None;
        }
        let dir = root.join(DIR);
        fs::create_dir_all(&dir).ok()?;
        let path = dir.join(format!("cmd-{}.json", std::process::id()));
        let started = now_ms();
        let label = label.to_owned();
        let write = {
            let path = path.clone();
            move || {
                let value = json!({
                    "label": label, "asks": asks, "startedAt": started, "updatedAt": now_ms(),
                });
                write_atomic(&path, value.to_string().as_bytes());
            }
        };
        write();
        let heartbeat = CancellationToken::new();
        let stop = heartbeat.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(HEARTBEAT);
            loop {
                tokio::select! {
                    _ = stop.cancelled() => break,
                    _ = interval.tick() => write(),
                }
            }
        });
        Some(Self { path, heartbeat })
    }
}

impl Drop for Running {
    fn drop(&mut self) {
        self.heartbeat.cancel();
        let _ = fs::remove_file(&self.path);
    }
}

/// Everything Studio shows about running work. A render without a heartbeat is `lost`.
pub fn read(root: &Path) -> Value {
    let dir = root.join(DIR);
    let now = now_ms();
    let mut render = fs::read(dir.join(RENDER))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
        .filter(Value::is_object);
    if let Some(render) = &mut render
        && render["status"] == "running"
        && now.saturating_sub(render["updatedAt"].as_u64().unwrap_or(0)) > STALE_MS
    {
        render["status"] = json!("lost");
    }
    let mut running = Vec::new();
    for entry in fs::read_dir(&dir).into_iter().flatten().flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if !(name.starts_with("cmd-") && name.ends_with(".json")) {
            continue;
        }
        let Some(value) = fs::read(&path)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
        else {
            continue;
        };
        if now.saturating_sub(value["updatedAt"].as_u64().unwrap_or(0)) > STALE_MS {
            let _ = fs::remove_file(&path);
        } else {
            running.push(json!({
                "label": value["label"], "asks": value["asks"], "startedAt": value["startedAt"],
            }));
        }
    }
    running.sort_by_key(|r| r["startedAt"].as_u64());
    json!({"render": render, "running": running})
}

pub fn latest_picture(root: &Path) -> Option<Vec<u8>> {
    fs::read(root.join(DIR).join(LATEST)).ok()
}

pub fn strip_picture(root: &Path, frame: u64) -> Option<Vec<u8>> {
    fs::read(strip_path(&root.join(DIR), frame)).ok()
}

/// The finished film, when the last render succeeded and wrote inside the project.
pub fn finished_video(root: &Path) -> Option<PathBuf> {
    let render: Value =
        serde_json::from_slice(&fs::read(root.join(DIR).join(RENDER)).ok()?).ok()?;
    if render["status"] != "completed" {
        return None;
    }
    let output = Path::new(render["output"].as_str()?);
    let path = if render["outputInProject"] == true {
        crate::project::safe_path(root, render["output"].as_str()?).ok()?
    } else {
        output.to_path_buf()
    };
    path.is_file().then_some(path)
}

// ---------------------------------------------------------------- Studio as a companion process

/// `SUPERINT_NO_STUDIO` or a CI machine: nobody is there to watch.
pub fn studio_disabled() -> bool {
    std::env::var_os("SUPERINT_NO_STUDIO").is_some() || std::env::var_os("CI").is_some()
}

/// A server this executable keeps running in the background: Studio for one film, or the app.
/// Its record says where it listens; asking it says whether it still does.
pub struct Server {
    record: PathBuf,
    ping: &'static str,
    /// The field of the ping's answer that names this server, and the value it has there.
    names: (&'static str, Value),
}

impl Server {
    pub fn studio(root: &Path) -> Self {
        Self {
            record: root.join(STUDIO),
            ping: "/api/ping",
            names: ("project", json!(root)),
        }
    }

    pub fn app(home: &Path) -> Self {
        Self {
            record: home.join("app.json"),
            ping: "/api/app/ping",
            names: ("app", json!(true)),
        }
    }

    pub fn register(&self, url: &str) {
        let record = json!({"url": url, "pid": std::process::id(), "startedAt": now_ms()});
        let _ = crate::project::atomic_write(&self.record, record.to_string().as_bytes());
    }

    /// Notes that it has stopped, and keeps where it was: started again it takes the same
    /// address, and a window that is still open finds it there.
    pub fn unregister(&self) {
        match self
            .record()
            .and_then(|record| record["url"].as_str().map(str::to_owned))
        {
            Some(url) => {
                let record = json!({"url": url, "stoppedAt": now_ms()});
                let _ = crate::project::atomic_write(&self.record, record.to_string().as_bytes());
            }
            None => {
                let _ = fs::remove_file(&self.record);
            }
        }
    }

    fn record(&self) -> Option<Value> {
        serde_json::from_slice(&fs::read(&self.record).ok()?).ok()
    }

    /// The port it had the last time it ran.
    pub fn last_port(&self) -> Option<u16> {
        let url = loopback(self.record()?["url"].as_str()?)?;
        url.rsplit(':').next()?.parse().ok()
    }

    /// It was started after `since_ms`, was running and never said that it stopped: it was
    /// ended from outside, by an update of the program or of whoever started it, or by a
    /// crash. A window of it may still be open.
    pub async fn lost(&self, since_ms: u64) -> bool {
        self.record().is_some_and(|record| {
            record["pid"].is_u64()
                && record["stoppedAt"].is_null()
                && record["startedAt"]
                    .as_u64()
                    .is_some_and(|at| at >= since_ms)
        }) && self.running().await.is_none()
    }

    /// Its address, if it still answers.
    pub async fn running(&self) -> Option<String> {
        let record = self.record()?;
        // One that said it stopped is not asked: nobody answers there, and that takes a while.
        if !record["stoppedAt"].is_null() {
            return None;
        }
        let url = loopback(record["url"].as_str()?)?;
        let client = reqwest::Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(2))
            .build()
            .ok()?;
        let ping: Value = client
            .get(format!("{url}{}", self.ping))
            .send()
            .await
            .ok()?
            .json()
            .await
            .ok()?;
        (ping[self.names.0] == self.names.1).then_some(url)
    }

    /// Starts it detached with these arguments and waits until it answers.
    pub async fn launch(&self, arguments: &[&OsStr], open: bool) -> Result<String> {
        spawn_detached(arguments, open)?;
        for _ in 0..80 {
            tokio::time::sleep(Duration::from_millis(250)).await;
            if let Some(url) = self.running().await {
                return Ok(url);
            }
        }
        bail!("no answer in time")
    }

    /// Stops it. Returns whether it was running.
    pub async fn stop(&self) -> bool {
        let alive = self.end().await;
        self.unregister();
        alive
    }

    /// Ends it without a word, the way an update or a restart of the computer would: it counts
    /// as lost, and the app brings it back. Returns whether it was running.
    pub async fn end(&self) -> bool {
        let alive = self.running().await.is_some();
        if alive && let Some(pid) = self.record().and_then(|r| r["pid"].as_u64()) {
            process::kill_tree(pid as u32).await;
        }
        alive
    }
}

/// A server of this tool is always this computer's own. A record in a film folder that names
/// anything else came from somewhere else, and its address must never reach a browser or a
/// command line.
fn loopback(url: &str) -> Option<String> {
    let port: u16 = url.strip_prefix("http://127.0.0.1:")?.parse().ok()?;
    Some(format!("http://127.0.0.1:{port}"))
}

/// Keeps Studio open for this project: starts it detached, with a window, unless it runs already.
/// When the app's start page is open in front of the user it goes to the film by itself, so no
/// second window opens. A failure only costs the view, never the command that asked.
pub async fn ensure_studio(root: &Path) -> Option<String> {
    if studio_disabled() {
        return None;
    }
    let watched = crate::home::dir().is_some_and(|home| crate::home::watched(&home));
    start_studio(root, !watched).await
}

/// The address of this project's Studio, started detached if it is not running. `open` gives a
/// newly started one its own window.
pub async fn start_studio(root: &Path, open: bool) -> Option<String> {
    let studio = Server::studio(root);
    if let Some(url) = studio.running().await {
        return Some(url);
    }
    studio
        .launch(&["studio".as_ref(), root.as_os_str()], open)
        .await
        .inspect_err(|error| {
            eprintln!("Studio did not start ({error:#}); start it with `superint-video studio`")
        })
        .ok()
}

/// Starts this executable again as a background process that outlives the caller.
fn spawn_detached(arguments: &[&OsStr], open: bool) -> Result<()> {
    use std::process::{Command, Stdio};
    let exe = std::env::current_exe().context("Own executable not found")?;
    let build = || {
        let mut command = Command::new(&exe);
        command.args(arguments).arg("--detached");
        if !open {
            command.arg("--no-open");
        }
        command
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        command
    };
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
        const CREATE_BREAKAWAY_FROM_JOB: u32 = 0x0100_0000;
        keep_stdio_from_children();
        // A coding agent's desktop app keeps its commands in a job and takes the whole job with
        // it when it closes or updates itself. As a child of the desktop shell the server
        // belongs to nobody and stays for the window the user has open.
        if crate::outside::in_job() {
            let mut all = arguments.to_vec();
            all.push("--detached".as_ref());
            if !open {
                all.push("--no-open".as_ref());
            }
            if crate::outside::spawn(&exe, &all).is_ok() {
                return Ok(());
            }
        }
        // Else outside the caller's job when the job allows it.
        let flags = CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP;
        if build()
            .creation_flags(flags | CREATE_BREAKAWAY_FROM_JOB)
            .spawn()
            .is_err()
        {
            build().creation_flags(flags).spawn()?;
        }
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        build().process_group(0).spawn()?;
    }
    Ok(())
}

/// Windows children inherit every inheritable handle. If Studio held this process's output pipe,
/// whoever waits for `new` to finish would wait until Studio ends.
#[cfg(windows)]
fn keep_stdio_from_children() {
    use std::os::windows::io::AsRawHandle;
    unsafe extern "system" {
        fn SetHandleInformation(handle: *mut std::ffi::c_void, mask: u32, flags: u32) -> i32;
    }
    const HANDLE_FLAG_INHERIT: u32 = 1;
    let handles = [
        std::io::stdin().as_raw_handle(),
        std::io::stdout().as_raw_handle(),
        std::io::stderr().as_raw_handle(),
    ];
    for handle in handles {
        // SAFETY: these are this process's own standard handles; a failure leaves them as they were.
        unsafe {
            SetHandleInformation(handle, HANDLE_FLAG_INHERIT, 0);
        }
    }
}

/// Shows Studio to the user: in a window of its own, or as a tab of the default browser when
/// the user chose that or no Chromium is there. Best effort: the URL is printed anyway.
pub fn open_browser(url: &str) {
    use std::process::{Command, Stdio};
    if crate::home::Settings::current().window == crate::home::Window::App
        && let Ok(chrome) = process::chrome()
        && app_window(&chrome, url)
    {
        return;
    }
    #[cfg(windows)]
    let mut command = {
        let mut command = Command::new("rundll32");
        command.args(["url.dll,FileProtocolHandler", url]);
        command
    };
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(url);
        command
    };
    #[cfg(all(not(windows), not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(url);
        command
    };
    let _ = command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
}

/// A browser window without tabs or address bar, which is how Studio looks like an app.
fn app_window(chrome: &Path, url: &str) -> bool {
    use std::process::{Command, Stdio};
    // Through `start`, so the browser is not a child of this process: stopping Studio ends its
    // own process tree, and that must never take the user's browser with it.
    #[cfg(windows)]
    let mut command = {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let mut command = Command::new("cmd");
        command
            .args(["/c", "start", ""])
            .arg(chrome)
            .creation_flags(CREATE_NO_WINDOW);
        command
    };
    #[cfg(not(windows))]
    let mut command = Command::new(chrome);
    command
        .arg(format!("--app={url}"))
        .arg("--window-size=1480,940")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn a_server_keeps_its_address_when_it_stops_and_is_lost_only_when_it_never_said_so() {
        let root = TempDir::new().unwrap();
        // A port nobody listens on.
        let port = std::net::TcpListener::bind("127.0.0.1:0")
            .unwrap()
            .local_addr()
            .unwrap()
            .port();
        let studio = Server::studio(root.path());
        assert_eq!(studio.last_port(), None);
        assert!(!studio.lost(0).await);

        // It ran and is gone without a word: ended from outside.
        let before = now_ms();
        studio.register(&format!("http://127.0.0.1:{port}"));
        assert_eq!(studio.last_port(), Some(port));
        assert!(studio.lost(before).await);
        // Started before the user signed in: no window of it can be open.
        assert!(!studio.lost(now_ms() + 60_000).await);

        // It said that it stopped: where it was is still known, and nobody asks there.
        studio.unregister();
        assert_eq!(studio.last_port(), Some(port));
        assert!(!studio.lost(0).await);
        assert!(studio.running().await.is_none());

        // An address from somewhere else is never taken.
        fs::write(
            root.path().join(STUDIO),
            r#"{"url":"http://example.com:80","pid":1}"#,
        )
        .unwrap();
        assert_eq!(studio.last_port(), None);
    }

    #[test]
    fn durations_read_like_speech() {
        assert_eq!(duration_text(40.2), "40 s");
        assert_eq!(duration_text(720.0), "12 min");
        assert_eq!(duration_text(7020.0), "1 h 57 min");
    }

    #[tokio::test]
    async fn a_render_reports_and_finishes() {
        let dir = TempDir::new().unwrap();
        let root = dir.path();
        let live = LiveRender::start(root, &root.join("renders/film.mp4"), 100, 30.0);
        live.progress("Rendering frames", 50, 100);
        live.persist();
        let state = read(root);
        assert_eq!(state["render"]["status"], "running");
        assert_eq!(state["render"]["completed"], 50);
        assert_eq!(state["render"]["output"], "renders/film.mp4");
        assert_eq!(state["render"]["outputInProject"], true);
        assert!(finished_video(root).is_none());

        fs::write(root.join("renders/film.mp4"), b"x").unwrap();
        live.finish(&Ok(json!({"frames": 100})), false);
        let state = read(root);
        assert_eq!(state["render"]["status"], "completed");
        assert_eq!(state["render"]["result"]["frames"], 100);
        assert!(finished_video(root).is_some());
    }

    #[tokio::test]
    async fn a_failed_render_keeps_its_error_and_shows_no_video() {
        let dir = TempDir::new().unwrap();
        let live = LiveRender::start(dir.path(), &dir.path().join("a.mp4"), 10, 30.0);
        live.finish(&Err(anyhow::anyhow!("encoder stopped")), false);
        let state = read(dir.path());
        assert_eq!(state["render"]["status"], "failed");
        assert!(
            state["render"]["error"]
                .as_str()
                .unwrap()
                .contains("encoder stopped")
        );
        assert!(finished_video(dir.path()).is_none());
    }

    #[test]
    fn a_render_without_heartbeat_is_lost() {
        let dir = TempDir::new().unwrap();
        let live = dir.path().join(DIR);
        fs::create_dir_all(&live).unwrap();
        fs::write(
            live.join(RENDER),
            json!({"status": "running", "updatedAt": now_ms() - STALE_MS - 1000}).to_string(),
        )
        .unwrap();
        assert_eq!(read(dir.path())["render"]["status"], "lost");
    }

    #[tokio::test]
    async fn running_commands_appear_and_disappear() {
        let dir = TempDir::new().unwrap();
        assert!(Running::start(dir.path(), "x").is_none());
        fs::write(dir.path().join("video.json"), b"{}").unwrap();
        let running = Running::start(dir.path(), "Mixing").unwrap();
        assert_eq!(read(dir.path())["running"][0]["label"], "Mixing");
        drop(running);
        assert_eq!(read(dir.path())["running"], json!([]));
    }

    #[tokio::test]
    async fn no_studio_answers_for_a_foreign_or_missing_record() {
        let dir = TempDir::new().unwrap();
        let studio = Server::studio(dir.path());
        assert!(studio.running().await.is_none());
        studio.register("http://127.0.0.1:9");
        assert!(studio.running().await.is_none());
        assert_eq!(
            loopback("http://127.0.0.1:4317").unwrap(),
            "http://127.0.0.1:4317"
        );
        for foreign in [
            "http://example.com",
            "http://127.0.0.1:1&calc",
            "http://127.0.0.1:80/x",
        ] {
            assert!(loopback(foreign).is_none(), "{foreign}");
        }
    }
}
