//! A server started in the background belongs to nobody: it outlives whoever started it.
#![cfg(windows)]
use anyhow::{Context, Result, ensure};
use serde_json::Value;
use std::time::Duration;
use superint_video::process;
use tempfile::TempDir;

/// Puts PowerShell into a job that ends every process in it when PowerShell ends, the way the
/// job of a desktop app does when the app closes or updates itself, and starts the app from
/// inside it.
const START_IN_A_JOB: &str = r#"
Add-Type -Namespace Superint -Name Job -MemberDefinition @'
[DllImport("kernel32.dll")] public static extern IntPtr CreateJobObjectW(IntPtr attributes, string name);
[DllImport("kernel32.dll")] public static extern bool SetInformationJobObject(IntPtr job, int kind, byte[] limits, int size);
[DllImport("kernel32.dll")] public static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
[DllImport("kernel32.dll")] public static extern IntPtr GetCurrentProcess();
'@
$job = [Superint.Job]::CreateJobObjectW([IntPtr]::Zero, $null)
$limits = New-Object byte[] 144
[BitConverter]::GetBytes([uint32]0x2000).CopyTo($limits, 16)
if (-not [Superint.Job]::SetInformationJobObject($job, 9, $limits, 144)) { exit 2 }
if (-not [Superint.Job]::AssignProcessToJobObject($job, [Superint.Job]::GetCurrentProcess())) { exit 3 }
& $env:SUPERINT_TEST_TOOL app --port $env:SUPERINT_TEST_PORT --no-open | Out-Null
exit $LASTEXITCODE
"#;

fn tool(home: &TempDir) -> tokio::process::Command {
    tool_at(env!("CARGO_BIN_EXE_superint-video").as_ref(), home)
}

fn tool_at(program: &std::path::Path, home: &TempDir) -> tokio::process::Command {
    let mut command = process::command(program);
    command
        .env("SUPERINT_HOME", home.path())
        .env("SUPERINT_ENV", home.path().join("none.env"))
        .env("SUPERINT_FILMS", home.path().join("films"))
        .env("SUPERINT_NO_STUDIO", "1");
    command
}

#[tokio::test]
#[ignore = "requires a Windows desktop session"]
async fn the_app_outlives_the_job_of_the_program_that_started_it() -> Result<()> {
    let home = tempfile::Builder::new()
        .prefix("superint-background-contract-")
        .tempdir()?;
    let port = std::net::TcpListener::bind("127.0.0.1:0")?
        .local_addr()?
        .port();
    let mut shell = process::command("powershell");
    shell
        .args(["-NoProfile", "-NonInteractive", "-Command", START_IN_A_JOB])
        .env("SUPERINT_TEST_TOOL", env!("CARGO_BIN_EXE_superint-video"))
        .env("SUPERINT_TEST_PORT", port.to_string())
        .env("SUPERINT_HOME", home.path())
        .env("SUPERINT_ENV", home.path().join("none.env"))
        .env("SUPERINT_FILMS", home.path().join("films"))
        .env("SUPERINT_NO_STUDIO", "1");
    let started = shell.status().await?;
    ensure!(started.success(), "the app did not start: {started}");

    // PowerShell has ended and its job with it. The app is still there.
    tokio::time::sleep(Duration::from_secs(2)).await;
    let asked = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(3))
        .build()?
        .get(format!("http://127.0.0.1:{port}/api/app/ping"))
        .send()
        .await;
    let stopped = tool(&home)
        .args(["app", "--port", &port.to_string(), "--stop"])
        .output()
        .await?;
    let answer: Value = asked
        .context("the app ended with the job of the program that started it")?
        .json()
        .await?;
    ensure!(answer["app"] == true, "something else answered: {answer}");
    let stopped: Value = serde_json::from_slice(&stopped.stdout)?;
    ensure!(stopped["stopped"] == true, "the app was not stopped");
    Ok(())
}

#[tokio::test]
#[ignore = "requires a Windows desktop session"]
async fn the_app_started_from_another_copy_takes_over() -> Result<()> {
    let home = tempfile::Builder::new()
        .prefix("superint-background-contract-")
        .tempdir()?;
    let port = std::net::TcpListener::bind("127.0.0.1:0")?
        .local_addr()?
        .port()
        .to_string();
    let first = tool(&home)
        .args(["app", "--port", &port, "--no-open"])
        .output()
        .await?;
    ensure!(first.status.success(), "the first app did not start");

    // The same program in another folder, as a newer version unpacked elsewhere would be.
    let folder = tempfile::Builder::new()
        .prefix("superint-other-copy-")
        .tempdir()?;
    let copy = folder.path().join("superint-video.exe");
    std::fs::copy(env!("CARGO_BIN_EXE_superint-video"), &copy)?;
    let second = tool_at(&copy, &home)
        .args(["app", "--port", &port, "--no-open"])
        .output()
        .await?;
    let started: Value = serde_json::from_slice(&second.stdout)?;
    let ping: Value = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(3))
        .build()?
        .get(format!("{}/api/app/ping", started["url"].as_str().unwrap_or_default()))
        .send()
        .await?
        .json()
        .await?;
    // Asked again from the copy, the app it runs is its own.
    let again: Value = serde_json::from_slice(
        &tool_at(&copy, &home)
            .args(["app", "--port", &port, "--no-open"])
            .output()
            .await?
            .stdout,
    )?;
    tool_at(&copy, &home).args(["app", "--stop"]).output().await?;
    ensure!(
        started["replaced"]["exe"].is_string(),
        "the copy did not take over: {started}"
    );
    let runs = ping["exe"].as_str().unwrap_or_default().to_lowercase();
    ensure!(
        runs.ends_with("superint-video.exe") && runs.contains("superint-other-copy-"),
        "the app runs from {runs}, not from the copy"
    );
    ensure!(again["alreadyRunning"] == true, "the copy replaced itself: {again}");
    // The stopped program lets go of its file a moment later; the folder may then go.
    tokio::time::sleep(Duration::from_secs(1)).await;
    Ok(())
}
