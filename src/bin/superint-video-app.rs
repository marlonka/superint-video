//! `Superint Video.exe`: opens the app by double-click, with no console window. All it does is
//! run `superint-video app` from its own folder; the command-line tool stays the one program.
#![cfg_attr(windows, windows_subsystem = "windows")]

use std::process::Command;

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
    command.arg("app");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    match command.output() {
        Ok(output) if output.status.success() => {}
        Ok(output) => fail(&format!(
            "Superint Video could not start.\n\n{}",
            String::from_utf8_lossy(&output.stderr).trim()
        )),
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

#[cfg(not(windows))]
fn fail(message: &str) {
    eprintln!("{message}");
    std::process::exit(1);
}
