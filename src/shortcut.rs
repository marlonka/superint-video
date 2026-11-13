//! The app on the desktop and in the Start menu, where people look for a program. The installer
//! puts both shortcuts there; for a copy unpacked from the ZIP or built from source, Setup has a
//! button that does the same.
use crate::process;
use anyhow::{Context, Result, bail};
use serde::Serialize;
use std::{
    path::{Path, PathBuf},
    time::Duration,
};
use tokio_util::sync::CancellationToken;

/// The name of both shortcuts, as the installer names them too.
const LINK: &str = "Superint Video.lnk";
/// What a shortcut starts: the app, without a console window.
const APP: &str = "Superint Video.exe";
/// PowerShell starts in well under a second; a slow disk or a virus scanner may take longer.
const WAIT: Duration = Duration::from_secs(20);

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    /// The program the shortcuts start; none where there is no app to start, as in a build that
    /// is not packaged or on another system than Windows.
    pub app: Option<PathBuf>,
    pub desktop: Place,
    pub start_menu: Place,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Place {
    /// No shortcut there.
    Missing,
    /// A shortcut that starts this app.
    Here,
    /// A shortcut that starts another copy, such as an older one unpacked elsewhere.
    Elsewhere,
}

/// The app beside this program, if it is there.
fn app() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?.canonicalize().ok()?;
    let app = exe.parent()?.join(APP);
    app.is_file()
        .then(|| crate::project::without_verbatim(&app))
}

fn links() -> Option<[PathBuf; 2]> {
    let (desktop, programs) = crate::home::shortcut_dirs()?;
    Some([desktop.join(LINK), programs.join(LINK)])
}

/// Whether the shortcuts are there and start this app. Only a shortcut that exists is read.
pub async fn status() -> Status {
    let app = app();
    let missing = Status {
        app: None,
        desktop: Place::Missing,
        start_menu: Place::Missing,
    };
    let (Some(app), Some(links)) = (app, links()) else {
        return missing;
    };
    let targets = match links.iter().any(|link| link.is_file()) {
        true => read(&links).await.unwrap_or_default(),
        false => Vec::new(),
    };
    let place = |at: usize| match targets.get(at).filter(|target| !target.is_empty()) {
        None => Place::Missing,
        Some(target) if same_file(Path::new(target), &app) => Place::Here,
        Some(_) => Place::Elsewhere,
    };
    Status {
        desktop: place(0),
        start_menu: place(1),
        app: Some(app),
    }
}

/// Puts both shortcuts in place, replacing ones that start another copy.
pub async fn create() -> Result<Status> {
    let app = app().context("There is no app beside this program to start from a shortcut")?;
    let links = links().context("This computer has no desktop for shortcuts")?;
    let folder = app.parent().context("The app has no folder")?;
    let script = r#"
$ErrorActionPreference = 'Stop'
$shell = New-Object -ComObject WScript.Shell
foreach ($link in $env:SUPERINT_LINKS -split "`n") {
  [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($link)) | Out-Null
  $shortcut = $shell.CreateShortcut($link)
  $shortcut.TargetPath = $env:SUPERINT_LINK_TARGET
  $shortcut.WorkingDirectory = $env:SUPERINT_LINK_FOLDER
  $shortcut.IconLocation = "$($env:SUPERINT_LINK_TARGET),0"
  $shortcut.Description = 'Superint Video'
  $shortcut.Save()
}
"#;
    let mut command = powershell(script)?;
    command
        .env("SUPERINT_LINKS", joined(&links))
        .env("SUPERINT_LINK_TARGET", &app)
        .env("SUPERINT_LINK_FOLDER", folder);
    process::output(command, &CancellationToken::new(), WAIT)
        .await
        .context("The shortcuts could not be made")?;
    Ok(status().await)
}

/// The target of each shortcut, in order; empty where there is none.
async fn read(links: &[PathBuf]) -> Result<Vec<String>> {
    let script = r#"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$shell = New-Object -ComObject WScript.Shell
foreach ($link in $env:SUPERINT_LINKS -split "`n") {
  if (Test-Path -LiteralPath $link -PathType Leaf) { $shell.CreateShortcut($link).TargetPath } else { '' }
}
"#;
    let mut command = powershell(script)?;
    command.env("SUPERINT_LINKS", joined(links));
    let out = process::output(command, &CancellationToken::new(), WAIT).await?;
    let text = String::from_utf8_lossy(&out);
    let mut targets: Vec<String> = text.lines().map(|line| line.trim().to_string()).collect();
    targets.resize(links.len(), String::new());
    Ok(targets)
}

fn joined(links: &[PathBuf]) -> String {
    links
        .iter()
        .map(|link| link.display().to_string())
        .collect::<Vec<_>>()
        .join("\n")
}

/// Windows PowerShell, which every Windows has, running one script. The paths go in as
/// environment variables, so no name needs quoting.
fn powershell(script: &str) -> Result<tokio::process::Command> {
    if !cfg!(windows) {
        bail!("Shortcuts are made on Windows only");
    }
    let mut command = process::command("powershell.exe");
    command.args([
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
    ]);
    Ok(command)
}

/// Paths on Windows compare without regard to case, and one may be written with the other slash.
fn same_file(a: &Path, b: &Path) -> bool {
    let plain = |path: &Path| {
        let path = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        crate::project::without_verbatim(&path)
            .display()
            .to_string()
            .replace('/', "\\")
            .to_lowercase()
    };
    plain(a) == plain(b)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_path_is_the_same_in_either_case_and_slash() {
        let here = std::env::current_dir().unwrap();
        let upper = PathBuf::from(here.display().to_string().to_uppercase().replace('\\', "/"));
        if cfg!(windows) {
            assert!(same_file(&here, &upper));
        }
        assert!(!same_file(&here, &here.join("elsewhere")));
    }

    #[tokio::test]
    async fn a_test_build_has_no_app_to_link() {
        // `cargo test` runs from target/, where no `Superint Video.exe` sits beside the program.
        let status = status().await;
        assert_eq!(status.app, None);
        assert_eq!(status.desktop, Place::Missing);
    }
}
