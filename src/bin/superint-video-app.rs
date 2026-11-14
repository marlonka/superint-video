//! `Superint Video.exe`: opens the app by double-click, with no console window. All it does is
//! run `superint-video app` from its own folder; the command-line tool stays the one program.
#![cfg_attr(windows, windows_subsystem = "windows")]

use std::{
    io::Read,
    process::{Command, Stdio},
    sync::mpsc,
    time::Duration,
};

fn main() {
    let name = if cfg!(windows) {
        "superint-video.exe"
    } else {
        "superint-video"
    };
    let tool = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|folder| folder.join(name)))
        .filter(|tool| tool.is_file());
    let Some(tool) = tool else {
        return fail(&format!(
            "{name} is missing. Keep it in the same folder as this app."
        ));
    };
    let mut command = Command::new(tool);
    command
        .arg("app")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => return fail(&format!("Superint Video could not start: {error}")),
    };
    // The program is waited for, not the end of its output: a browser it opens could hold a
    // copy of the pipe for as long as it runs, and this launcher would stay with it.
    let (said, heard) = mpsc::channel();
    if let Some(mut stderr) = child.stderr.take() {
        std::thread::spawn(move || {
            let mut text = String::new();
            let _ = stderr.read_to_string(&mut text);
            let _ = said.send(text);
        });
    }
    match child.wait() {
        Ok(status) if status.success() => {}
        Ok(_) => {
            let text = heard
                .recv_timeout(Duration::from_secs(2))
                .unwrap_or_default();
            fail(&format!(
                "Superint Video could not start.\n\n{}",
                text.trim()
            ))
        }
        Err(error) => fail(&format!("Superint Video could not start: {error}")),
    }
}

#[cfg(windows)]
fn fail(message: &str) {
    use std::ffi::c_void;
    #[link(name = "user32")]
    unsafe extern "system" {
        fn MessageBoxW(owner: *mut c_void, text: *const u16, title: *const u16, kind: u32) -> i32;
    }
    const ICON_ERROR: u32 = 0x10;
    let wide = |text: &str| text.encode_utf16().chain([0]).collect::<Vec<u16>>();
    let (text, title) = (wide(message), wide("Superint Video"));
    // SAFETY: both strings are NUL-terminated and live until the call returns.
    unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            text.as_ptr(),
            title.as_ptr(),
            ICON_ERROR,
        );
    }
}

/// An app opened from the Finder has no terminal to print to: the message comes as an alert.
#[cfg(target_os = "macos")]
fn fail(message: &str) {
    eprintln!("{message}");
    // AppleScript reads the text as a string of its own: backslashes and quotes are escaped.
    let text = message.replace('\\', "\\\\").replace('"', "\\\"");
    let _ = Command::new("osascript")
        .arg("-e")
        .arg(format!(
            "display alert \"Superint Video\" message \"{text}\" as critical"
        ))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
    std::process::exit(1);
}

#[cfg(all(not(windows), not(target_os = "macos")))]
fn fail(message: &str) {
    eprintln!("{message}");
    std::process::exit(1);
}
