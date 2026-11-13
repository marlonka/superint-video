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
    let mut command = process::command(env!("CARGO_BIN_EXE_superint-video"));
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
