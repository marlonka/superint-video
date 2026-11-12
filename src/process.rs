use anyhow::{Context, Result, bail};
use std::{
    ffi::OsStr,
    path::{Path, PathBuf},
    process::Stdio,
    time::Duration,
};
use tokio::{
    io::{AsyncRead, AsyncReadExt},
    process::Command,
};
use tokio_util::sync::CancellationToken;

pub fn command(program: impl AsRef<OsStr>) -> Command {
    let mut cmd = Command::new(program);
    cmd.kill_on_drop(true).stdin(Stdio::null());
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    cmd
}

/// A path the way the file manager reads it. Explorer opens some other folder when a path
/// mixes both kinds of slashes, as one from a setting or an environment variable may.
fn for_file_manager(path: &Path) -> String {
    let text = crate::project::without_verbatim(path).display().to_string();
    if cfg!(windows) {
        text.replace('/', "\\")
    } else {
        text
    }
}

/// Opens a file or a folder the way a double-click would.
pub fn open_path(path: &Path) -> Result<()> {
    let program = if cfg!(windows) {
        "explorer.exe"
    } else if cfg!(target_os = "macos") {
        "open"
    } else {
        "xdg-open"
    };
    command(program)
        .arg(for_file_manager(path))
        .kill_on_drop(false)
        .spawn()?;
    Ok(())
}

/// Shows a file selected in its folder; where the file manager cannot select, opens the folder.
pub fn reveal_file(path: &Path) -> Result<()> {
    // Explorer reads `/select,<path>` as one argument of its own making.
    #[cfg(windows)]
    command("explorer.exe")
        .raw_arg(format!("/select,\"{}\"", for_file_manager(path)))
        .kill_on_drop(false)
        .spawn()?;
    #[cfg(target_os = "macos")]
    command("open")
        .arg("-R")
        .arg(for_file_manager(path))
        .kill_on_drop(false)
        .spawn()?;
    #[cfg(all(not(windows), not(target_os = "macos")))]
    open_path(path.parent().context("The file has no folder")?)?;
    Ok(())
}

/// Where a tool such as `ffmpeg` is started from: `SUPERINT_<NAME>`, else the search path.
/// On Windows a tool installed while this program runs is found right away, although this
/// process still has the search path it started with: through winget's links, the folder of
/// uv and pipx, and the search path as Windows has saved it since.
pub fn binary(name: &str) -> PathBuf {
    if let Some(path) = std::env::var_os(format!("SUPERINT_{}", name.to_uppercase())) {
        return PathBuf::from(path);
    }
    #[cfg(windows)]
    if !on_search_path(name)
        && let Some(found) = elsewhere(name)
    {
        return found;
    }
    PathBuf::from(name)
}

/// Whether a command can be started now, wherever it was installed.
#[cfg(windows)]
pub fn installed(name: &str) -> bool {
    on_search_path(name) || elsewhere(name).is_some()
}

#[cfg(windows)]
fn elsewhere(name: &str) -> Option<PathBuf> {
    winget_link(name)
        .or_else(|| tool_link(name))
        .or_else(|| on_saved_path(name))
}

/// The search path a program started now would get: the machine's and the user's, as Windows
/// keeps them. winget adds a tool's folder there when it cannot make a link, and installers
/// add theirs; this process, started before, still has the old one.
#[cfg(windows)]
fn on_saved_path(name: &str) -> Option<PathBuf> {
    [
        (
            registry::MACHINE,
            r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment",
        ),
        (registry::USER, "Environment"),
    ]
    .into_iter()
    .filter_map(|(root, key)| registry::string(root, key, "Path"))
    .flat_map(|value| {
        expand(&value)
            .split(';')
            .map(|folder| PathBuf::from(folder.trim()))
            .collect::<Vec<_>>()
    })
    .filter(|folder| !folder.as_os_str().is_empty())
    .map(|folder| folder.join(format!("{name}.exe")))
    .find(|file| file.is_file())
}

/// `%NAME%` replaced by the variable's value, as Windows does for a saved search path.
#[cfg(windows)]
fn expand(text: &str) -> String {
    let mut out = String::new();
    let mut rest = text;
    while let Some(start) = rest.find('%') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        match after.find('%') {
            Some(end) => {
                let name = &after[..end];
                match std::env::var(name) {
                    Ok(value) if !name.is_empty() => out.push_str(&value),
                    _ => {
                        out.push('%');
                        out.push_str(name);
                        out.push('%');
                    }
                }
                rest = &after[end + 1..];
            }
            None => {
                out.push_str(&rest[start..]);
                rest = "";
            }
        }
    }
    out.push_str(rest);
    out
}

/// Reads one text value from the registry.
#[cfg(windows)]
mod registry {
    use std::ffi::c_void;

    pub const USER: isize = 0x8000_0001_u32 as i32 as isize;
    pub const MACHINE: isize = 0x8000_0002_u32 as i32 as isize;
    /// REG_SZ or REG_EXPAND_SZ, as stored: the variables are expanded by the caller.
    const TEXT: u32 = 0x0000_0002 | 0x0000_0004 | 0x1000_0000;

    #[link(name = "advapi32")]
    unsafe extern "system" {
        fn RegGetValueW(
            key: isize,
            sub_key: *const u16,
            value: *const u16,
            flags: u32,
            kind: *mut u32,
            data: *mut c_void,
            size: *mut u32,
        ) -> i32;
    }

    fn wide(text: &str) -> Vec<u16> {
        text.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn string(root: isize, key: &str, value: &str) -> Option<String> {
        let (key, value) = (wide(key), wide(value));
        let mut size = 0u32;
        // SAFETY: the names are NUL-terminated and outlive the call; a null buffer asks for
        // the size only.
        let found = unsafe {
            RegGetValueW(
                root,
                key.as_ptr(),
                value.as_ptr(),
                TEXT,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                &mut size,
            )
        };
        if found != 0 || size == 0 {
            return None;
        }
        let mut buffer = vec![0u16; (size as usize).div_ceil(2)];
        // SAFETY: `buffer` holds `size` bytes, as the call above asked for.
        let read = unsafe {
            RegGetValueW(
                root,
                key.as_ptr(),
                value.as_ptr(),
                TEXT,
                std::ptr::null_mut(),
                buffer.as_mut_ptr().cast(),
                &mut size,
            )
        };
        if read != 0 {
            return None;
        }
        let text = String::from_utf16_lossy(&buffer);
        Some(text.trim_end_matches('\0').to_string())
    }
}

/// uv and pipx put the commands they install into one folder of the user. A program started
/// before the installation does not have that folder on its PATH yet, so it is asked directly.
#[cfg(windows)]
fn tool_link(name: &str) -> Option<PathBuf> {
    let folders = [
        std::env::var_os("UV_TOOL_BIN_DIR").map(PathBuf::from),
        std::env::var_os("XDG_BIN_HOME").map(PathBuf::from),
        std::env::var_os("USERPROFILE").map(|home| PathBuf::from(home).join(".local/bin")),
    ];
    folders
        .into_iter()
        .flatten()
        .map(|folder| folder.join(format!("{name}.exe")))
        .find(|link| link.is_file())
}

/// Asks without following links: the aliases Windows keeps for Store apps, winget among them,
/// cannot be opened like files.
#[cfg(windows)]
fn on_search_path(name: &str) -> bool {
    std::env::var_os("PATH").is_some_and(|path| {
        std::env::split_paths(&path).any(|folder| {
            folder
                .join(format!("{name}.exe"))
                .symlink_metadata()
                .is_ok()
        })
    })
}

/// winget puts a link to every command-line tool it installs into one folder of the user.
#[cfg(windows)]
fn winget_link(name: &str) -> Option<PathBuf> {
    let link = PathBuf::from(std::env::var_os("LOCALAPPDATA")?)
        .join("Microsoft/WinGet/Links")
        .join(format!("{name}.exe"));
    link.is_file().then_some(link)
}

/// Whether winget, the package manager that ships with Windows, can be asked to install a tool.
#[cfg(windows)]
pub fn winget() -> bool {
    on_search_path("winget")
}
#[cfg(not(windows))]
pub fn winget() -> bool {
    false
}

pub fn chrome() -> Result<PathBuf> {
    if let Some(path) = std::env::var_os("SUPERINT_CHROME") {
        let path = PathBuf::from(path);
        if path.is_file() {
            return Ok(path);
        }
        bail!("SUPERINT_CHROME does not point to a browser executable");
    }
    // Chrome first, also where it installs for one user only; Edge ships with Windows.
    let mut candidates: Vec<PathBuf> = [
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    ]
    .iter()
    .map(PathBuf::from)
    .collect();
    candidates.extend(
        std::env::var_os("LOCALAPPDATA")
            .map(|folder| PathBuf::from(folder).join("Google/Chrome/Application/chrome.exe")),
    );
    candidates.extend(
        [
            "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
            "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/usr/bin/google-chrome",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
        ]
        .iter()
        .map(PathBuf::from),
    );
    candidates.into_iter().find(|path| path.is_file()).context(
        "Chromium was not found. Set SUPERINT_CHROME to a supported Chrome/Chromium executable.",
    )
}

pub async fn kill_tree(pid: u32) {
    #[cfg(windows)]
    {
        let _ = tokio::time::timeout(
            Duration::from_secs(10),
            command("taskkill")
                .args(["/PID", &pid.to_string(), "/T", "/F"])
                .output(),
        )
        .await;
    }
    #[cfg(not(windows))]
    {
        let _ = tokio::time::timeout(
            Duration::from_secs(10),
            command("kill").args(["-TERM", &pid.to_string()]).output(),
        )
        .await;
    }
}

// Large enough for a decoded 8192×8192 RGB PNG; never collect an entire raw movie.
const MAX_STDOUT_BYTES: usize = 256 * 1024 * 1024;
const MAX_STDERR_BYTES: usize = 64 * 1024;

async fn read_output(mut reader: impl AsyncRead + Unpin) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    let mut chunk = [0u8; 16 * 1024];
    loop {
        let read = reader.read(&mut chunk).await?;
        if read == 0 {
            return Ok(bytes);
        }
        if bytes.len() + read > MAX_STDOUT_BYTES {
            bail!("Media tool output exceeds 256 MiB; trim the source or reduce its dimensions");
        }
        bytes.extend_from_slice(&chunk[..read]);
    }
}

pub(crate) async fn read_diagnostics(mut reader: impl AsyncRead + Unpin) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    let mut chunk = [0u8; 8192];
    loop {
        let read = reader.read(&mut chunk).await?;
        if read == 0 {
            return Ok(bytes);
        }
        // Keep draining after the diagnostic budget is exhausted: closing stderr
        // or blocking its reader can deadlock an otherwise valid encoder.
        // Retain the tail, where FFmpeg normally reports the final failure.
        let overflow = (bytes.len() + read).saturating_sub(MAX_STDERR_BYTES);
        if overflow > 0 {
            bytes.drain(..overflow);
        }
        bytes.extend_from_slice(&chunk[..read]);
    }
}

/// Bound process lifetime, buffered output, and pipe completion together.
/// Only this application's owned child PID is ever terminated.
pub async fn output(
    mut cmd: Command,
    cancel: &CancellationToken,
    timeout: Duration,
) -> Result<Vec<u8>> {
    if cancel.is_cancelled() {
        bail!("cancelled");
    }
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = cmd
        .spawn()
        .context("Could not start media tool; run superint-video doctor")?;
    let pid = child.id();
    let stdout = child.stdout.take().context("Missing stdout")?;
    let stderr = child.stderr.take().context("Missing stderr")?;
    let result = tokio::select! {
        biased;
        _ = cancel.cancelled() => Err(anyhow::anyhow!("cancelled")),
        _ = tokio::time::sleep(timeout) => Err(anyhow::anyhow!("Media tool timed out after {} seconds", timeout.as_secs())),
        result = async {
            tokio::try_join!(
                read_output(stdout),
                read_diagnostics(stderr),
                async { child.wait().await.context("Media process wait failed") }
            )
        } => result,
    };
    if result.is_err() {
        if let Some(pid) = pid {
            kill_tree(pid).await;
        }
        let _ = tokio::time::timeout(Duration::from_secs(3), child.kill()).await;
    }
    let (out, err, status) = result?;
    if !status.success() {
        let diagnostic = String::from_utf8_lossy(&err);
        let start = diagnostic
            .char_indices()
            .rev()
            .nth(3999)
            .map(|(offset, _)| offset)
            .unwrap_or(0);
        bail!("Media tool failed: {}", &diagnostic[start..]);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    #[cfg(windows)]
    #[test]
    fn a_saved_search_path_is_read_and_expanded() {
        // SAFETY: no other test reads this variable.
        unsafe { std::env::set_var("SUPERINT_TEST_FOLDER", r"C:\tools") };
        assert_eq!(
            super::expand(r"%SUPERINT_TEST_FOLDER%\bin;%NOT_SET_9%;x"),
            r"C:\tools\bin;%NOT_SET_9%;x"
        );
        assert_eq!(super::expand("50%"), "50%");
        // The machine's search path holds Windows' own folder, and cmd with it.
        assert!(super::on_saved_path("cmd").is_some());
    }

    #[cfg(windows)]
    #[test]
    fn the_file_manager_gets_one_kind_of_slash() {
        assert_eq!(
            super::for_file_manager(std::path::Path::new("C:/Users/me/Downloads\\a style.zip")),
            "C:\\Users\\me\\Downloads\\a style.zip"
        );
    }
}
