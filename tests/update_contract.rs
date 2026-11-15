//! The installed app updates itself: it finds a newer release, checks the download, and hands
//! over to a helper that ends it, runs the installer and starts it again at its old address.
//! A release server in the test stands in for GitHub, and this program stands in for the
//! installer (`schema` leaves everything as it is).
#![cfg(windows)]
use anyhow::{Context, Result, ensure};
use axum::{Json, Router, http::header, routing::get};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{path::PathBuf, time::Duration};
use superint_video::process;
use tempfile::TempDir;

const VERSION: &str = env!("CARGO_PKG_VERSION");

/// A copy of the program in a folder that looks installed, and a user folder of its own.
struct Installed {
    _folder: TempDir,
    home: TempDir,
    exe: PathBuf,
    port: u16,
}

impl Installed {
    fn new() -> Result<Self> {
        let folder = tempfile::Builder::new()
            .prefix("superint-update-install-")
            .tempdir()?;
        let exe = folder.path().join("superint-video.exe");
        std::fs::copy(env!("CARGO_BIN_EXE_superint-video"), &exe)?;
        std::fs::write(folder.path().join("unins000.exe"), b"")?;
        let home = tempfile::Builder::new()
            .prefix("superint-update-home-")
            .tempdir()?;
        std::fs::write(home.path().join("none.env"), "")?;
        let port = std::net::TcpListener::bind("127.0.0.1:0")?
            .local_addr()?
            .port();
        Ok(Self {
            _folder: folder,
            home,
            exe,
            port,
        })
    }

    /// The program, told to take releases from `origin` and to count as a version from long ago.
    fn tool(&self, origin: &str) -> tokio::process::Command {
        let mut command = process::command(&self.exe);
        command
            .env("SUPERINT_HOME", self.home.path())
            .env("SUPERINT_ENV", self.home.path().join("none.env"))
            .env("SUPERINT_FILMS", self.home.path().join("films"))
            .env("SUPERINT_NO_STUDIO", "1")
            .env("SUPERINT_UPDATE_SOURCE", origin)
            .env("SUPERINT_UPDATE_SETUP_ARGS", "schema")
            .env("SUPERINT_PRETEND_VERSION", "0.0.1");
        command
    }

    async fn start(&self, origin: &str) -> Result<()> {
        let started = self
            .tool(origin)
            .args(["app", "--port", &self.port.to_string(), "--no-open"])
            .output()
            .await?;
        ensure!(started.status.success(), "the app did not start");
        Ok(())
    }

    async fn stop(&self, origin: &str) {
        let _ = self.tool(origin).args(["app", "--stop"]).output().await;
    }

    fn url(&self, path: &str) -> String {
        format!("http://127.0.0.1:{}{path}", self.port)
    }

    async fn overview(&self) -> Result<Value> {
        Ok(client()?
            .get(self.url("/api/app"))
            .send()
            .await?
            .json()
            .await?)
    }

    /// Asks the app to install the update; gives the status and the answer.
    async fn install(&self) -> Result<(u16, Value)> {
        let overview = self.overview().await?;
        let token = overview["token"]
            .as_str()
            .with_context(|| format!("no token in {overview}"))?
            .to_owned();
        let answer = client()?
            .post(self.url("/api/app/update/install"))
            .header("X-Superint-Token", token)
            .header("Origin", self.url(""))
            .send()
            .await?;
        Ok((answer.status().as_u16(), answer.json().await?))
    }

    /// How the update went, once the record says.
    async fn outcome(&self) -> Result<Value> {
        let record = self.home.path().join("update.json");
        for _ in 0..240 {
            if let Ok(bytes) = std::fs::read(&record)
                && let Ok(state) = serde_json::from_slice::<Value>(&bytes)
                && state["outcome"].is_object()
            {
                return Ok(state["outcome"].clone());
            }
            tokio::time::sleep(Duration::from_millis(250)).await;
        }
        anyhow::bail!("the update never said how it went")
    }

    /// What the app answers at its address, once it answers.
    async fn ping(&self) -> Result<Value> {
        for _ in 0..120 {
            if let Ok(answer) = client()?.get(self.url("/api/app/ping")).send().await {
                return Ok(answer.json().await?);
            }
            tokio::time::sleep(Duration::from_millis(250)).await;
        }
        anyhow::bail!("the app did not come back at its address")
    }
}

fn client() -> Result<reqwest::Client> {
    Ok(reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(5))
        .build()?)
}

/// Serves a release of this version with `setup` as its installer and `digest` as its checksum.
async fn release(setup: Vec<u8>, digest: String) -> Result<String> {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let origin = format!("http://{}", listener.local_addr()?);
    let tag = format!("v{VERSION}");
    let answer = json!({
        "tag_name": tag,
        "draft": false,
        "prerelease": false,
        "published_at": "2026-11-20T10:00:00Z",
        "body": "### Neu\n\n- Something new.",
        "assets": [{
            "name": "Superint-Video-Setup.exe",
            "size": setup.len(),
            "digest": format!("sha256:{digest}"),
            "browser_download_url": format!("{origin}/download/{tag}/Superint-Video-Setup.exe"),
        }],
    });
    let app = Router::new()
        .route(
            "/repos/marlonka/superint-video/releases/latest",
            get(move || {
                let answer = answer.clone();
                async move { Json(answer) }
            }),
        )
        .route(
            &format!("/download/{tag}/Superint-Video-Setup.exe"),
            get(move || {
                let setup = setup.clone();
                async move { ([(header::CONTENT_TYPE, "application/octet-stream")], setup) }
            }),
        );
    tokio::spawn(async move { axum::serve(listener, app).await });
    Ok(origin)
}

fn sha256(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

#[tokio::test]
#[ignore = "requires a Windows desktop session"]
async fn the_installed_app_updates_itself_and_comes_back_at_its_address() -> Result<()> {
    let installed = Installed::new()?;
    let program = std::fs::read(&installed.exe)?;
    let digest = sha256(&program);
    let origin = release(program, digest).await?;

    let offered: Value =
        serde_json::from_slice(&installed.tool(&origin).arg("update").output().await?.stdout)?;
    ensure!(
        offered["available"]["version"] == VERSION && offered["canInstall"] == true,
        "the release was not offered: {offered}"
    );

    installed.start(&origin).await?;
    let before = installed.ping().await?;
    let (status, answer) = installed.install().await?;
    ensure!(status == 202, "the update did not start: {status} {answer}");
    let outcome = installed.outcome().await?;
    ensure!(
        outcome["status"] == "updated",
        "the update failed: {outcome}"
    );
    let after = installed.ping().await?;
    let overview = installed.overview().await?;
    installed.stop(&origin).await;
    ensure!(after["app"] == true, "something else answered: {after}");
    ensure!(before["exe"] == after["exe"], "another program came back");
    // The app came back without the pretend version: it runs the version it updated to.
    ensure!(
        overview["update"]["outcome"]["status"] == "updated"
            && overview["update"]["current"] == VERSION,
        "the page does not say that it was updated: {}",
        overview["update"]
    );
    Ok(())
}

#[tokio::test]
#[ignore = "requires a Windows desktop session"]
async fn a_download_that_is_not_the_release_is_never_installed() -> Result<()> {
    let installed = Installed::new()?;
    let origin = release(b"not the installer".to_vec(), sha256(b"the installer")).await?;
    installed.start(&origin).await?;
    let record = installed.home.path().join("app.json");
    let before: Value = serde_json::from_slice(&std::fs::read(&record)?)?;
    let (status, _) = installed.install().await?;
    ensure!(status == 202, "the update did not start: {status}");
    let outcome = installed.outcome().await?;
    installed.ping().await?;
    let after: Value = serde_json::from_slice(&std::fs::read(&record)?)?;
    installed.stop(&origin).await;
    ensure!(
        outcome["status"] == "failed" && outcome["reason"] == "verify",
        "a wrong download was not refused: {outcome}"
    );
    ensure!(
        before["pid"] == after["pid"],
        "the app was stopped although nothing was installed"
    );
    Ok(())
}

#[tokio::test]
#[ignore = "requires a Windows desktop session"]
async fn no_update_while_a_film_renders() -> Result<()> {
    let installed = Installed::new()?;
    let program = std::fs::read(&installed.exe)?;
    let digest = sha256(&program);
    let origin = release(program, digest).await?;
    // A film in the films folder whose render is running.
    let film = installed.home.path().join("films").join("Rendering");
    std::fs::create_dir_all(film.join(".superint/live"))?;
    std::fs::write(film.join("video.json"), "{}")?;
    installed.start(&origin).await?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_millis();
    std::fs::write(
        film.join(".superint/live/render.json"),
        json!({"status": "running", "updatedAt": now as u64}).to_string(),
    )?;
    installed
        .overview()
        .await
        .context("the app did not answer")?;
    let (status, answer) = installed.install().await?;
    installed.stop(&origin).await;
    ensure!(
        status == 409 && answer["code"] == "update-busy",
        "an update started during a render: {status} {answer}"
    );
    Ok(())
}
