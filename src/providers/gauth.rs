//! Google sign-in for Google Cloud: Application Default Credentials (ADC), Google's recommended
//! way instead of an API key. The user signs in once with the Google Cloud CLI
//! (`gcloud auth application-default login`); this tool then gets short-lived access tokens for
//! that account. No secret is typed into the app, and nothing is saved by it.
//!
//! The credentials are looked up as Google's libraries do (checked 2026-11-12):
//! `GOOGLE_APPLICATION_CREDENTIALS`, else the file the CLI writes,
//! `%APPDATA%\gcloud\application_default_credentials.json` (`~/.config/gcloud/…` elsewhere).
//! A user sign-in (`authorized_user`) is refreshed here directly; every other kind (workload or
//! workforce identity federation, impersonation, a service account key) is left to the CLI.
use anyhow::{Context, Result, anyhow, bail};
use serde_json::Value;
use std::{
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, Instant},
};

const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
/// A token is used until this long before it expires.
const MARGIN: Duration = Duration::from_secs(120);

/// The Google sign-in this computer has, without its secrets.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Adc {
    pub file: PathBuf,
    /// `authorized_user` for a person's sign-in; other kinds go through the CLI.
    pub kind: String,
    /// The project the sign-in bills to by default (`gcloud auth application-default
    /// set-quota-project`); the place's project when none is chosen.
    pub quota_project: Option<String>,
}

/// The sign-in file Google's libraries would use, when there is one.
pub fn find() -> Option<Adc> {
    let file = std::env::var_os("GOOGLE_APPLICATION_CREDENTIALS")
        .filter(|path| !path.is_empty())
        .map(PathBuf::from)
        .or_else(default_file)?;
    read(&file)
}

fn default_file() -> Option<PathBuf> {
    let base = if cfg!(windows) {
        PathBuf::from(std::env::var_os("APPDATA")?)
    } else {
        PathBuf::from(std::env::var_os("HOME")?).join(".config")
    };
    Some(
        base.join("gcloud")
            .join("application_default_credentials.json"),
    )
}

fn read(file: &Path) -> Option<Adc> {
    let value: Value = serde_json::from_slice(&std::fs::read(file).ok()?).ok()?;
    let kind = value["type"].as_str()?.to_string();
    Some(Adc {
        file: file.to_path_buf(),
        kind,
        quota_project: value["quota_project_id"]
            .as_str()
            .filter(|project| !project.is_empty())
            .map(str::to_string),
    })
}

/// The access token last fetched, for the file it came from.
static TOKEN: Mutex<Option<(PathBuf, String, Instant)>> = Mutex::new(None);

/// A current access token for the sign-in, from the cache while it lasts.
pub async fn token(http: &reqwest::Client, adc: &Adc) -> Result<String> {
    if let Ok(cached) = TOKEN.lock()
        && let Some((file, token, until)) = cached.as_ref()
        && *file == adc.file
        && Instant::now() + MARGIN < *until
    {
        return Ok(token.clone());
    }
    let (token, lasts) = if adc.kind == "authorized_user" {
        refresh(http, &adc.file).await?
    } else {
        // The CLI knows every other kind; its tokens last an hour.
        (cli_token().await?, Duration::from_secs(3600))
    };
    if let Ok(mut cached) = TOKEN.lock() {
        *cached = Some((adc.file.clone(), token.clone(), Instant::now() + lasts));
    }
    Ok(token)
}

/// A person's sign-in: its refresh token buys an access token at Google's OAuth endpoint.
async fn refresh(http: &reqwest::Client, file: &Path) -> Result<(String, Duration)> {
    let value: Value = serde_json::from_slice(&std::fs::read(file)?)
        .context("The Google sign-in file is not valid JSON")?;
    let field = |name: &str| {
        value[name]
            .as_str()
            .filter(|text| !text.is_empty())
            .with_context(|| format!("The Google sign-in file has no {name}"))
    };
    let body = [
        ("grant_type", "refresh_token"),
        ("client_id", field("client_id")?),
        ("client_secret", field("client_secret")?),
        ("refresh_token", field("refresh_token")?),
    ]
    .iter()
    .map(|(name, value)| format!("{name}={}", encode(value)))
    .collect::<Vec<_>>()
    .join("&");
    let response = http
        .post(TOKEN_URL)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(body)
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|error| anyhow!("Google sign-in: {}", error.without_url()))?;
    let status = response.status();
    let answer: Value = response.json().await.unwrap_or_default();
    if !status.is_success() {
        // `invalid_grant`: signed out, revoked or expired. The answer holds no secret.
        let reason = answer["error_description"]
            .as_str()
            .or(answer["error"].as_str())
            .unwrap_or("no details");
        bail!(
            "Google did not accept the sign-in ({status}: {reason}). Sign in again from Setup, or run: gcloud auth application-default login"
        );
    }
    let token = answer["access_token"]
        .as_str()
        .context("Google returned no access token")?
        .to_string();
    let lasts = answer["expires_in"].as_u64().unwrap_or(3600);
    Ok((token, Duration::from_secs(lasts)))
}

async fn cli_token() -> Result<String> {
    let cli = cli().context(
        "This kind of Google sign-in needs the Google Cloud CLI (gcloud), which is not installed",
    )?;
    let mut command = crate::process::command(&cli);
    command.args(["auth", "application-default", "print-access-token"]);
    let output = tokio::time::timeout(Duration::from_secs(60), command.output())
        .await
        .context("gcloud did not answer within a minute")??;
    if !output.status.success() {
        let reason = String::from_utf8_lossy(&output.stderr);
        bail!(
            "gcloud could not give a token: {}",
            reason.lines().last().unwrap_or("").trim()
        );
    }
    let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if token.is_empty() {
        bail!("gcloud gave no token");
    }
    Ok(token)
}

/// The Google Cloud CLI: on the search path, or where its installer puts it on Windows.
pub fn cli() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        if let Some(found) = crate::process::find_command("gcloud.cmd") {
            return Some(found);
        }
        let folders = [
            std::env::var_os("LOCALAPPDATA").map(|dir| PathBuf::from(dir).join("Google")),
            std::env::var_os("ProgramFiles(x86)").map(|dir| PathBuf::from(dir).join("Google")),
            std::env::var_os("ProgramFiles").map(|dir| PathBuf::from(dir).join("Google")),
        ];
        folders
            .into_iter()
            .flatten()
            .map(|dir| dir.join(r"Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"))
            .find(|file| file.is_file())
    }
    #[cfg(not(windows))]
    {
        std::env::var_os("PATH").and_then(|path| {
            std::env::split_paths(&path)
                .map(|dir| dir.join("gcloud"))
                .find(|file| file.is_file())
        })
    }
}

/// Percent-encoding for a form body.
fn encode(text: &str) -> String {
    text.bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (byte as char).to_string()
            }
            _ => format!("%{byte:02X}"),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_sign_in_file_is_read_without_its_secrets() {
        let folder = tempfile::TempDir::new().unwrap();
        let file = folder.path().join("adc.json");
        std::fs::write(
            &file,
            r#"{"type":"authorized_user","client_id":"id","client_secret":"secret-0001","refresh_token":"1//refresh-0002","quota_project_id":"my-films-123"}"#,
        )
        .unwrap();
        let adc = read(&file).unwrap();
        assert_eq!(adc.kind, "authorized_user");
        assert_eq!(adc.quota_project.as_deref(), Some("my-films-123"));
        assert!(!format!("{adc:?}").contains("secret-0001"));
        assert!(!format!("{adc:?}").contains("refresh-0002"));
        std::fs::write(&file, "not json").unwrap();
        assert!(read(&file).is_none());
        assert_eq!(encode("1//a b+c"), "1%2F%2Fa%20b%2Bc");
    }
}
