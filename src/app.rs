//! The app around the films: what is set up, what a new film defaults to, the styles and the
//! films this computer knows. Every Studio serves these routes next to its project, and
//! `superint-video app` serves them without one, so the start page is the same everywhere.
use crate::{
    earshot,
    env::{self, Keys},
    home::{self, KeyStore, Settings},
    live, polish, preset, process, production,
    project::{modified_ms, without_verbatim},
    providers::{self, Provider},
    server::{ApiError, ApiResult, bytes_response},
    skills::{self, Agent},
    style,
};
use anyhow::{Context, Result, bail};
use axum::{
    Json, Router,
    body::Bytes,
    extract::{DefaultBodyLimit, Multipart, Path as RoutePath, Query, State},
    http::StatusCode,
    response::Response,
    routing::{get, post, put},
};
use serde::Deserialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio_util::sync::CancellationToken;

/// Tools are asked for their version at most this often; the start page asks every few seconds.
const TOOLS_FOR: Duration = Duration::from_secs(90);
const STYLES_FOR: Duration = Duration::from_secs(20);
/// Comparing the installed skills with the app's reads every file of both.
const AGENTS_FOR: Duration = Duration::from_secs(20);
const MOST_FILMS: usize = 60;
const PICTURE_WIDTH: u32 = 640;
/// The largest style file the start page may send.
const MOST_STYLE_BYTES: usize = 256 * 1024 * 1024;
/// The largest dictation: ten minutes of 16 kHz mono 16-bit WAV, and room for its header.
const MOST_DICTATION_BYTES: usize = 20 * 1024 * 1024;
/// The most a new style's reference pictures weigh together, with room for the form around them.
const MOST_REFERENCES_BYTES: usize = 96 * 1024 * 1024;
/// Where the skills an update replaced are kept, below the user folder.
const REPLACED_SKILLS: &str = "replaced-skills";

/// An answer kept for a while, because working it out starts programs or reads many files.
#[derive(Clone, Default)]
struct Cache(Arc<Mutex<Option<(Instant, Value)>>>);

impl Cache {
    fn get(&self, lasts: Duration) -> Option<Value> {
        let kept = self.0.lock().unwrap();
        kept.as_ref()
            .filter(|(at, _)| at.elapsed() < lasts)
            .map(|(_, value)| value.clone())
    }

    fn put(&self, value: Value) -> Value {
        *self.0.lock().unwrap() = Some((Instant::now(), value.clone()));
        value
    }

    fn clear(&self) {
        *self.0.lock().unwrap() = None;
    }
}

/// Small pictures of the films by id, each with the time its source was written.
type Pictures = Arc<Mutex<HashMap<String, (u64, Vec<u8>)>>>;

#[derive(Clone)]
pub struct AppState {
    pub home: PathBuf,
    /// The project this server belongs to; none for the app itself.
    pub project: Option<PathBuf>,
    pub token: String,
    /// When a start page last asked: the app ends itself after long without one.
    pub seen: Arc<Mutex<Instant>>,
    tools: Cache,
    styles: Cache,
    agents: Cache,
    pictures: Pictures,
}

impl AppState {
    pub fn new(home: PathBuf, project: Option<PathBuf>, token: String) -> Self {
        Self {
            home,
            project,
            token,
            seen: Arc::new(Mutex::new(Instant::now())),
            tools: Cache::default(),
            styles: Cache::default(),
            agents: Cache::default(),
            pictures: Default::default(),
        }
    }

    /// Where keys are looked for: the project's folder, else the user folder.
    fn start(&self) -> &Path {
        self.project.as_deref().unwrap_or(&self.home)
    }
}

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/api/app", get(overview))
        .route("/api/app/ping", get(ping))
        .route("/api/app/settings", put(save_settings))
        .route("/api/app/keys/{name}", post(save_key).delete(remove_key))
        .route("/api/app/keys/{name}/test", post(test_key))
        .route(
            "/api/app/dictate",
            post(dictate).layer(DefaultBodyLimit::max(MOST_DICTATION_BYTES)),
        )
        .route("/api/app/films/{id}/open", post(open_film))
        .route("/api/app/films/{id}/forget", post(forget_film))
        .route("/api/app/films/{id}/duplicate", post(duplicate_film))
        .route("/api/app/films/{id}/reveal", post(reveal_film))
        .route("/api/app/films/{id}/picture", get(film_picture))
        .route("/api/app/films/{id}/style", post(style_from_film))
        .route("/api/app/styles", post(copy_style))
        .route(
            "/api/app/styles/create",
            post(create_style).layer(DefaultBodyLimit::max(MOST_REFERENCES_BYTES)),
        )
        .route(
            "/api/app/styles/import",
            post(import_style).layer(DefaultBodyLimit::max(MOST_STYLE_BYTES)),
        )
        .route("/api/app/styles/{name}/export", post(export_style))
        .route("/api/app/styles/{name}/reveal", post(reveal_style))
        .route(
            "/api/app/styles/{name}/reference/{file}",
            get(style_reference),
        )
        .route("/api/app/agents/{id}/skills", post(install_skills))
        .route("/api/app/tools/{id}/install", post(install_tool))
        .route("/api/app/google/sign-in", post(google_sign_in))
        .route("/api/app/reveal/{what}", post(reveal_place))
        .with_state(state)
}

async fn ping(State(state): State<AppState>) -> Json<Value> {
    Json(json!({"app": true, "project": state.project}))
}

// ------------------------------------------------------------------------------------ overview

#[derive(Deserialize)]
struct OverviewQuery {
    /// The page is in front of the user right now.
    #[serde(default)]
    visible: Option<u8>,
    /// Ask the tools again instead of answering from memory.
    #[serde(default)]
    fresh: Option<u8>,
}

async fn overview(
    State(state): State<AppState>,
    Query(query): Query<OverviewQuery>,
) -> ApiResult<Json<Value>> {
    *state.seen.lock().unwrap() = Instant::now();
    if query.visible == Some(1) {
        home::mark_watched(&state.home);
    }
    Ok(Json(payload(&state, query.fresh == Some(1)).await?))
}

async fn payload(state: &AppState, fresh: bool) -> Result<Value> {
    let tools = tools(state, fresh).await;
    let state = state.clone();
    // Keys, settings, styles, skills and films are all read from disk.
    tokio::task::spawn_blocking(move || {
        let Access {
            keys,
            settings,
            sign_in,
            place,
        } = Access::load(&state)?;
        let reaches = |route| providers::ready(&keys, sign_in.as_ref(), &place, route);
        // OpenAI writes down dictations and styles; a film needs one of the others.
        let film_key = [
            Provider::AiStudio,
            Provider::GoogleCloud,
            Provider::OpenRouter,
        ]
        .into_iter()
        .any(reaches);
        let any_key = film_key || reaches(Provider::OpenAi);
        let setup_keys = key_rows(&keys, &settings, sign_in.as_ref(), &place);
        let models = usual_models(reaches);
        // The model a style would be written with now, and the provider it would go to.
        let style_model = settings.style_model.clone();
        let generators = providers::Generators::with(
            keys,
            std::env::temp_dir().join("superint-video-style"),
            &settings,
            sign_in,
        )?;
        let writes = generators
            .style_tries(style_model.as_deref())
            .into_iter()
            .next();
        let project = state.project.as_ref().map(|root| {
            let manifest = home::read_json(&root.join("video.json"));
            json!({"name": manifest.and_then(|m| m["name"].as_str().map(str::to_owned))})
        });
        Ok(json!({
            "version": env!("CARGO_PKG_VERSION"),
            "home": state.home,
            "project": project,
            "token": state.token,
            "setup": {
                "can": {
                    "picture": ready(&tools, "chrome") && ready(&tools, "ffmpeg"),
                    "voice": film_key,
                    "music": film_key,
                    "soundEffects": ready(&tools, "earshot"),
                    "dictate": any_key,
                    "style": writes.as_ref().is_some_and(|(route, _)| generators.ready(*route)),
                },
                "tools": tools,
                "keys": setup_keys,
                "models": models,
                // Whose model it is: Google on either of its ways, as one of them steps in
                // for the other.
                "style": writes.map(|(route, model)| json!({
                    "model": model,
                    "provider": if route.google() { "Google" } else { route.label() },
                })),
                "agents": agents(&state, fresh),
            },
            "cli": cli(),
            "filmsFolder": home::films_dir(&settings),
            "films": films(&state, &settings),
            "settings": settings,
            "styles": styles(&state)?,
        }))
    })
    .await?
}

/// Where this program is, and whether a coding agent's shell finds this very one by its name.
/// When it does not, the prompt says where it is.
fn cli() -> Value {
    let exe = std::env::current_exe()
        .and_then(|exe| exe.canonicalize())
        .ok();
    let name = if cfg!(windows) {
        "superint-video.exe"
    } else {
        "superint-video"
    };
    let found = process::find_command(name).and_then(|found| found.canonicalize().ok());
    json!({
        "path": exe.as_deref().map(without_verbatim),
        "onPath": exe.is_some() && found == exe,
    })
}

fn ready(tools: &Value, id: &str) -> bool {
    tools
        .as_array()
        .into_iter()
        .flatten()
        .any(|tool| tool["id"] == id && tool["ok"] == true)
}

/// ffmpeg, ffprobe, the browser and Earshot, as `doctor` reports them. The programs are asked
/// at the same time.
pub async fn dependencies() -> Vec<Value> {
    let version = |name: &'static str| async move {
        let mut command = process::command(process::binary(name));
        command.arg("-version");
        match process::output(command, &CancellationToken::new(), Duration::from_secs(10)).await {
            Ok(data) => json!({
                "name": name, "ok": true,
                "version": String::from_utf8_lossy(&data).lines().next().unwrap_or(""),
            }),
            Err(error) => json!({"name": name, "ok": false, "error": error.to_string()}),
        }
    };
    let (ffmpeg, ffprobe, earshot) =
        tokio::join!(version("ffmpeg"), version("ffprobe"), earshot::version());
    let chromium = match process::chrome() {
        Ok(path) => json!({"name": "Chromium", "ok": true, "path": path}),
        Err(error) => json!({"name": "Chromium", "ok": false, "error": error.to_string()}),
    };
    // Earshot is needed for sound effects and listening only.
    let earshot = match earshot {
        Some(found) => json!({
            "name": "earshot", "ok": true, "optional": true,
            "version": found["version"], "sounds": found["sounds"],
        }),
        None => json!({
            "name": "earshot", "ok": false, "optional": true,
            "error": "not reachable; needed for sfx",
        }),
    };
    vec![ffmpeg, ffprobe, chromium, earshot]
}

/// A tool the start page shows in Setup. What it is for is the page's text, in its language.
struct Tool {
    id: &'static str,
    title: &'static str,
    /// The names `dependencies` reports it under; all of them have to be there.
    parts: &'static [&'static str],
    optional: bool,
    get: &'static str,
    /// What winget calls it, when winget can install it.
    winget: Option<&'static str>,
    /// The command that installs it outside winget, for the user or a coding agent to run.
    command: Option<&'static str>,
    /// A script that installs it in a window of its own.
    script: Option<Script>,
}

/// An installer the app writes into its folder and runs in a terminal window. It needs one
/// command first, which it fetches through winget when it is missing.
#[derive(Clone, Copy)]
struct Script {
    file: &'static str,
    text: &'static str,
    needs: &'static str,
}

/// Writes an installer script into the app's folder, with Windows line ends, and gives its path.
fn write_script(home: &Path, file: &str, text: &str) -> Result<String> {
    std::fs::create_dir_all(home)?;
    let path = home.join(file);
    std::fs::write(&path, text.replace('\n', "\r\n"))?;
    Ok(path.display().to_string())
}

/// Earshot as its README installs it (checked 2026-11-12): from GitHub with uv, which brings
/// its own Python. `pip install earshot` would fetch another project of the same name.
macro_rules! earshot_source {
    () => {
        r#""earshot[mcp,llm] @ git+https://github.com/Leonxlnx/earshot""#
    };
}
pub(crate) const EARSHOT_INSTALL: &str = concat!("uv tool install ", earshot_source!());
/// The window that installs Earshot: uv first through winget when it is missing, then
/// Earshot. Nothing is agreed to for the user; winget asks in the window.
const EARSHOT_SCRIPT: &str = concat!(
    r#"@echo off
echo Superint Video installs Earshot, the sound effects tool (github.com/Leonxlnx/earshot).
echo.
call :find
if not defined UV (
  echo First uv, which installs Python tools:
  winget install --id astral-sh.uv --exact --source winget
  call :find
)
if not defined UV (
  echo uv could not be installed. See https://docs.astral.sh/uv/
  exit /b 1
)
"%UV%" tool install --force "#,
    earshot_source!(),
    r#"
if errorlevel 1 exit /b 1
echo.
echo Done. Close this window and choose "Check again" in Superint Video.
exit /b 0

rem uv on the search path, in winget's links, in winget's package folder (where winget leaves
rem it when Windows lets it make no link), or where uv's own installer puts it.
:find
set "UV="
where uv >nul 2>nul && set "UV=uv"
if not defined UV if exist "%LOCALAPPDATA%\Microsoft\WinGet\Links\uv.exe" set "UV=%LOCALAPPDATA%\Microsoft\WinGet\Links\uv.exe"
if not defined UV if exist "%USERPROFILE%\.local\bin\uv.exe" set "UV=%USERPROFILE%\.local\bin\uv.exe"
if not defined UV for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\astral-sh.uv_*") do if exist "%%D\uv.exe" set "UV=%%D\uv.exe"
exit /b 0
"#
);

const TOOLS: &[Tool] = &[
    Tool {
        id: "chrome",
        title: "Chrome",
        parts: &["Chromium"],
        optional: false,
        get: "https://www.google.com/chrome/",
        winget: Some("Google.Chrome"),
        command: None,
        script: None,
    },
    Tool {
        id: "ffmpeg",
        title: "FFmpeg",
        parts: &["ffmpeg", "ffprobe"],
        optional: false,
        get: "https://ffmpeg.org/download.html",
        winget: Some("Gyan.FFmpeg"),
        command: None,
        script: None,
    },
    Tool {
        id: "earshot",
        title: "Earshot",
        parts: &["earshot"],
        optional: true,
        get: "https://github.com/Leonxlnx/earshot",
        winget: None,
        command: Some(EARSHOT_INSTALL),
        script: Some(Script {
            file: "install-earshot.cmd",
            text: EARSHOT_SCRIPT,
            needs: "uv",
        }),
    },
];

/// The tools as the start page shows them: found or not, and how to get a missing one.
async fn tools(state: &AppState, fresh: bool) -> Value {
    if let Some(tools) = state.tools.get(TOOLS_FOR).filter(|_| !fresh) {
        return tools;
    }
    let found = dependencies().await;
    let part = |name: &str| found.iter().find(|d| d["name"] == name);
    let winget = process::winget();
    let tools: Vec<Value> = TOOLS
        .iter()
        .map(|tool| {
            let first = part(tool.parts[0]);
            json!({
                "id": tool.id,
                "title": tool.title,
                "ok": tool.parts.iter().all(|name| part(name).is_some_and(|d| d["ok"] == true)),
                "optional": tool.optional,
                "sounds": first.and_then(|d| d["sounds"].as_u64()),
                "get": tool.get,
                // A script brings what it needs through winget when that is missing.
                "install": match tool.script {
                    Some(script) => winget || process::installed(script.needs),
                    None => winget && tool.winget.is_some(),
                },
                "command": tool.command,
            })
        })
        .collect();
    state.tools.put(json!(tools))
}

/// The command line that installs a tool through winget. No agreement is accepted for the
/// user: winget asks in its own window.
fn install_command(tool: &Tool) -> Option<String> {
    tool.winget
        .map(|id| format!("winget install --id {id} --exact --source winget"))
}

/// Starts the installation in a terminal window of its own, so the user sees what happens and
/// answers winget's questions there.
async fn install_tool(
    State(state): State<AppState>,
    RoutePath(id): RoutePath<String>,
) -> ApiResult<Json<Value>> {
    let tool = TOOLS
        .iter()
        .find(|tool| tool.id == id)
        .ok_or_else(|| ApiError::bad("Unknown tool"))?;
    let command = match tool.script {
        Some(script) => Some(write_script(&state.home, script.file, script.text)?),
        None => install_command(tool).filter(|_| process::winget()),
    }
    .ok_or_else(|| ApiError::bad("This tool cannot be installed from here"))?;
    if ready(&tools(&state, true).await, tool.id) {
        return Err(ApiError::bad("This tool is already installed"));
    }
    open_terminal(&format!("Superint Video: {}", tool.title), &command)?;
    // The next question about the tools is answered fresh.
    state.tools.clear();
    Ok(Json(json!({"started": true, "command": command})))
}

/// Runs one fixed command in a new, visible terminal window that stays open afterwards.
#[cfg(windows)]
fn open_terminal(title: &str, command: &str) -> Result<()> {
    // `start` gives the new window a console of its own; this process has none. The line is
    // handed to cmd as written, because cmd does not read arguments the way other programs do.
    process::command("cmd.exe")
        .raw_arg(format!(r#"/d /c start "{title}" cmd.exe /k "{command}""#))
        .kill_on_drop(false)
        .spawn()
        .context("The terminal window did not open")?;
    Ok(())
}
#[cfg(not(windows))]
fn open_terminal(_title: &str, _command: &str) -> Result<()> {
    bail!("Installing from the app works on Windows only")
}

/// What this computer can reach, read once per request: the keys, the settings, the user's
/// Google sign-in and where Google Cloud requests go.
struct Access {
    keys: Keys,
    settings: Settings,
    sign_in: Option<providers::gauth::Adc>,
    place: providers::cloud::Place,
}

impl Access {
    fn load(state: &AppState) -> Result<Self> {
        let keys = Keys::load(state.start())?;
        let settings = Settings::load(&state.home)?;
        let sign_in = providers::gauth::find();
        let place = providers::cloud::Place::of(&keys, &settings, sign_in.as_ref());
        Ok(Self {
            keys,
            settings,
            sign_in,
            place,
        })
    }

    fn key_rows(&self) -> Vec<Value> {
        key_rows(
            &self.keys,
            &self.settings,
            self.sign_in.as_ref(),
            &self.place,
        )
    }
}

/// One row per provider. Never a value: only whether a key is there, where it comes from and
/// the models it is used with unless the user, a style or a film names others. With an
/// OpenRouter key alone, Google's models are reached through OpenRouter, and Google Cloud
/// reaches the same models as AI Studio; OpenAI writes down dictations only. Google Cloud and
/// OpenAI are for few users and are folded away in Setup (`more`) until they hold a key.
fn key_rows(
    keys: &Keys,
    settings: &Settings,
    sign_in: Option<&providers::gauth::Adc>,
    place: &providers::cloud::Place,
) -> Vec<Value> {
    let status = keys.status();
    let row = |route: Provider, title: &str, get: &str| {
        let name = route.key();
        let found = status.iter().find(|s| s.name == name);
        let models: serde_json::Map<String, Value> = providers::usual_models(route)
            .into_iter()
            .map(|(job, model)| (job.to_string(), json!(model)))
            .collect();
        json!({
            "name": name, "title": title, "recommended": route == Provider::AiStudio, "get": get,
            "more": matches!(route, Provider::GoogleCloud | Provider::OpenAi),
            "present": found.is_some_and(|s| s.present),
            "source": found.and_then(|s| s.source.as_ref()).map(env::Source::kind),
            "models": models,
        })
    };
    let mut cloud = row(
        Provider::GoogleCloud,
        "Google Cloud",
        "https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/start/api-keys",
    );
    cloud["place"] = json!({
        "project": place.project, "location": place.location, "servedIn": place.served_in(),
        // Set outside the app (GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION), so Setup shows it.
        "fixed": keys.cloud_project.is_some() || keys.cloud_location.is_some(),
    });
    // Google's recommended way in is the user's Google sign-in. A saved key stays the user's
    // choice and wins; without one, the sign-in counts as the key.
    if keys.get(env::GOOGLE_CLOUD).is_none() && sign_in.is_some() {
        cloud["present"] = json!(true);
        cloud["source"] = json!("google");
    }
    cloud["ready"] = json!(providers::ready(
        keys,
        sign_in,
        place,
        Provider::GoogleCloud
    ));
    let mut openai = row(
        Provider::OpenAi,
        "OpenAI",
        "https://platform.openai.com/api-keys",
    );
    openai["region"] = json!(settings.open_ai_region.as_deref().unwrap_or("global"));
    vec![
        row(
            Provider::AiStudio,
            "Google AI Studio",
            "https://aistudio.google.com/apikey",
        ),
        row(
            Provider::OpenRouter,
            "OpenRouter",
            "https://openrouter.ai/settings/keys",
        ),
        cloud,
        openai,
    ]
}

/// The models a film and a dictation use when the user names none, for Setup's models form.
fn usual_models(ready: impl Fn(Provider) -> bool) -> Value {
    let usual = providers::AI_STUDIO;
    json!({
        "narration": usual.speech, "voice": usual.voice, "transcription": usual.transcription,
        "music": usual.music, "dictation": providers::usual_dictation(&ready),
        "style": providers::usual_style(&ready),
    })
}

/// The window that signs the user in to Google Cloud: the Google Cloud CLI first through winget
/// when it is missing, then `gcloud auth application-default login`, which opens the browser.
/// Nothing is agreed to for the user; winget and Google ask in their own windows.
const GOOGLE_SIGN_IN_SCRIPT: &str = r#"@echo off
echo Superint Video signs you in to Google Cloud with your Google account.
echo Google calls this Application Default Credentials: no API key, no secret to copy.
echo.
call :find
if not defined GCLOUD (
  echo First the Google Cloud CLI, which does the sign-in. This takes a minute or two.
  echo Windows may ask for administrator rights: if nothing shows up, look for a
  echo flashing shield in the taskbar.
  winget install --id Google.CloudSDK --exact --source winget
  call :find
)
if not defined GCLOUD (
  echo The Google Cloud CLI could not be installed. See https://cloud.google.com/sdk/docs/install
  exit /b 1
)
echo Your browser opens for the sign-in.
call "%GCLOUD%" auth application-default login
if errorlevel 1 exit /b 1
echo.
echo Done. Close this window; Superint Video sees the sign-in by itself.
exit /b 0

rem The Google Cloud CLI on the search path, or where its installer puts it (as gauth::cli).
:find
set "GCLOUD="
for %%G in (gcloud.cmd) do if not "%%~$PATH:G"=="" set "GCLOUD=%%~$PATH:G"
if not defined GCLOUD if exist "%LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" set "GCLOUD=%LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
if not defined GCLOUD if exist "%ProgramFiles(x86)%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" set "GCLOUD=%ProgramFiles(x86)%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
if not defined GCLOUD if exist "%ProgramFiles%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" set "GCLOUD=%ProgramFiles%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
exit /b 0
"#;

/// Opens the sign-in window. Google's own CLI keeps the sign-in; the app saves nothing of it.
async fn google_sign_in(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    let script = write_script(&state.home, "google-sign-in.cmd", GOOGLE_SIGN_IN_SCRIPT)?;
    open_terminal("Superint Video: Google sign-in", &script)?;
    Ok(Json(json!({"started": true})))
}

// ---------------------------------------------------------------------------------------- keys

fn known_key(name: &str) -> ApiResult<&'static str> {
    env::KNOWN
        .iter()
        .copied()
        .find(|known| *known == name)
        .ok_or_else(|| ApiError::bad("Unknown key name"))
}

#[derive(Deserialize)]
struct KeyBody {
    value: String,
}

async fn save_key(
    State(state): State<AppState>,
    RoutePath(name): RoutePath<String>,
    Json(body): Json<KeyBody>,
) -> ApiResult<Json<Value>> {
    let name = known_key(&name)?;
    KeyStore::at(&state.home).set(name, &body.value)?;
    Ok(Json(json!({"keys": Access::load(&state)?.key_rows()})))
}

async fn remove_key(
    State(state): State<AppState>,
    RoutePath(name): RoutePath<String>,
) -> ApiResult<Json<Value>> {
    let name = known_key(&name)?;
    KeyStore::at(&state.home).remove(name)?;
    Ok(Json(json!({"keys": Access::load(&state)?.key_rows()})))
}

async fn test_key(
    State(state): State<AppState>,
    RoutePath(name): RoutePath<String>,
) -> ApiResult<Json<Value>> {
    let name = known_key(&name)?;
    let settings = Settings::load(&state.home)?;
    Ok(Json(
        providers::try_key(
            state.start(),
            name,
            settings.dictation_model.as_deref(),
            settings.style_model.as_deref(),
        )
        .await?,
    ))
}

// ----------------------------------------------------------------------------------- dictation

/// Writes down what the user said into the start page. The page records and sends a WAV
/// file; the answer is the text, the model and the route that wrote it. The recording is
/// kept nowhere but in the request to the provider.
async fn dictate(State(state): State<AppState>, body: Bytes) -> ApiResult<Json<Value>> {
    let seconds = providers::wav_seconds(&body).map_err(|e| ApiError::bad(&e.to_string()))?;
    if seconds < 0.2 {
        return Err(ApiError::bad("The recording is too short"));
    }
    if seconds > providers::MOST_DICTATION_SECONDS {
        return Err(ApiError::bad("The recording is longer than ten minutes"));
    }
    let Access {
        keys,
        settings,
        sign_in,
        place,
    } = Access::load(&state)?;
    // The same answer the start page gave when it showed the microphone.
    let any = [
        Provider::AiStudio,
        Provider::GoogleCloud,
        Provider::OpenAi,
        Provider::OpenRouter,
    ]
    .into_iter()
    .any(|route| providers::ready(&keys, sign_in.as_ref(), &place, route));
    if !any {
        return Err(ApiError::bad(
            "Dictation needs an API key: add one under Setup",
        ));
    }
    let generators = providers::Generators::with(
        keys,
        std::env::temp_dir().join("superint-video-dictation"),
        &settings,
        sign_in,
    )?;
    let dictation = generators
        .dictate(&body, settings.dictation_model.as_deref())
        .await?;
    Ok(Json(json!(dictation)))
}

// ------------------------------------------------------------------------------------ settings

async fn save_settings(
    State(state): State<AppState>,
    Json(mut settings): Json<Settings>,
) -> ApiResult<Json<Value>> {
    settings.normalize();
    settings.save(&state.home)?;
    Ok(Json(json!({"settings": settings})))
}

// -------------------------------------------------------------------------------------- styles

fn styles(state: &AppState) -> Result<Value> {
    if let Some(styles) = state.styles.get(STYLES_FOR) {
        return Ok(styles);
    }
    let styles: Vec<Value> = preset::all()?
        .into_iter()
        .map(|p| {
            let references: Vec<String> = p
                .references()
                .into_iter()
                .filter_map(|r| r.rsplit('/').next().map(str::to_owned))
                .filter(|r| is_picture(r))
                .collect();
            json!({
                "name": p.config.name,
                "title": p.config.title,
                "description": p.config.description,
                "translations": p.config.translations,
                "formats": p.config.formats.keys().collect::<Vec<_>>(),
                "defaultFormat": p.config.default_format,
                "seconds": p.config.defaults.seconds,
                "language": p.config.defaults.language,
                "voice": p.config.narration.voice,
                "music": p.config.music.is_some(),
                "own": matches!(p.source, preset::Source::User),
                "references": references,
            })
        })
        .collect();
    Ok(state.styles.put(json!(styles)))
}

fn is_picture(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    ["png", "jpg", "jpeg", "webp", "gif", "avif"]
        .iter()
        .any(|ext| name.ends_with(&format!(".{ext}")))
}

async fn style_reference(
    RoutePath((name, file)): RoutePath<(String, String)>,
) -> ApiResult<Response> {
    if !is_picture(&file) {
        return Err(ApiError::bad("Only pictures are shown"));
    }
    let bytes = preset::reference(&name, &file)
        .map_err(|_| ApiError::new(StatusCode::NOT_FOUND, "No such reference"))?;
    Ok(bytes_response(
        bytes,
        mime_guess::from_path(&file)
            .first_or_octet_stream()
            .as_ref(),
    ))
}

#[derive(Deserialize)]
struct CopyStyle {
    from: String,
    name: String,
}

async fn copy_style(
    State(state): State<AppState>,
    Json(body): Json<CopyStyle>,
) -> ApiResult<Json<Value>> {
    let path = preset::fork(&body.from, body.name.trim(), &[])?;
    state.styles.clear();
    Ok(Json(
        json!({"name": body.name.trim(), "path": path, "styles": styles(&state)?}),
    ))
}

async fn reveal_style(
    State(state): State<AppState>,
    RoutePath(name): RoutePath<String>,
) -> ApiResult<Json<Value>> {
    let folder = preset::references_folder(&name)?;
    state.styles.clear();
    reveal(&folder)?;
    Ok(Json(json!({"opened": folder})))
}

/// Writes a style as one file into the user's Downloads folder and shows it there.
async fn export_style(RoutePath(name): RoutePath<String>) -> ApiResult<Json<Value>> {
    preset::valid_name(&name)?;
    let folder = home::downloads_dir().context("No Downloads folder on this computer")?;
    let file = preset::export_to(&name, &folder)?;
    // The file is written either way; showing it is a courtesy.
    let _ = process::reveal_file(&file);
    Ok(Json(json!({"file": file})))
}

/// Takes a style file the user picked and adds it to their styles under a free name.
async fn import_style(State(state): State<AppState>, body: Bytes) -> ApiResult<Json<Value>> {
    let imported = tokio::task::spawn_blocking(move || preset::import(&body))
        .await
        .context("Reading the style file")??;
    state.styles.clear();
    Ok(Json(json!({
        "name": imported.name,
        "title": imported.title,
        "styles": styles(&state)?,
    })))
}

/// What a style is written with: the generators with the user's keys, the model they chose, if
/// any, and the folder their styles live in.
fn style_maker(state: &AppState) -> Result<(providers::Generators, Option<String>, PathBuf)> {
    let Access {
        keys,
        settings,
        sign_in,
        ..
    } = Access::load(state)?;
    let generators = providers::Generators::with(
        keys,
        std::env::temp_dir().join("superint-video-style"),
        &settings,
        sign_in,
    )?;
    let styles = preset::user_dir().context("No user folder for styles")?;
    std::fs::create_dir_all(&styles)?;
    Ok((generators, settings.style_model, styles))
}

/// The answer to a style that was made: what it is called, who wrote it, and every style.
fn made_style(state: &AppState, made: style::Made) -> Result<Json<Value>> {
    state.styles.clear();
    Ok(Json(json!({
        "name": made.name,
        "title": made.title,
        "model": made.model,
        "route": made.route,
        "styles": styles(state)?,
    })))
}

/// Makes a style from the pictures and the description the start page sends as a form:
/// `name` and `describe` as text, each picture as a `reference` file. The pictures and the
/// words go to the provider whose key the user saved, and nowhere else.
async fn create_style(
    State(state): State<AppState>,
    mut form: Multipart,
) -> ApiResult<Json<Value>> {
    let mut wish = style::Wish::default();
    while let Some(field) = form.next_field().await? {
        match field.name() {
            Some("name") => wish.name = Some(field.text().await?),
            Some("describe") => wish.describe = field.text().await?,
            Some("language") => wish.language = Some(field.text().await?),
            Some("reference") => {
                if wish.references.len() >= style::MOST_PICTURES {
                    return Err(ApiError::bad("A style is made from at most 12 pictures"));
                }
                let name = field.file_name().unwrap_or("picture").to_string();
                let bytes = field.bytes().await?.to_vec();
                wish.references.push(style::Reference { name, bytes });
            }
            _ => {}
        }
    }
    let (generators, model, styles) = style_maker(&state)?;
    let made = style::from_references(&generators, model.as_deref(), wish, &styles).await?;
    Ok(made_style(&state, made)?)
}

#[derive(Deserialize)]
struct FilmStyle {
    #[serde(default)]
    name: String,
    #[serde(default)]
    describe: String,
}

/// Makes a style from a film on the list: its look contract, kit, references and stills,
/// generalised by the model so nothing of the film's topic stays.
async fn style_from_film(
    State(state): State<AppState>,
    RoutePath(id): RoutePath<String>,
    Json(body): Json<FilmStyle>,
) -> ApiResult<Json<Value>> {
    let root = film_root(&state, &id)?;
    if !root.join("video.json").is_file() {
        return Err(ApiError::bad("The folder of this film is gone"));
    }
    let (generators, model, styles) = style_maker(&state)?;
    let name = Some(body.name.trim()).filter(|name| !name.is_empty());
    let made = style::from_film(
        &generators,
        model.as_deref(),
        &root,
        name,
        &body.describe,
        &styles,
    )
    .await?;
    Ok(made_style(&state, made)?)
}

// --------------------------------------------------------------------------------------- films

/// A short name for a film in addresses, so no folder path travels in a URL.
fn film_id(root: &Path) -> String {
    hex::encode(&Sha256::digest(home::folder_key(root).as_bytes())[..8])
}

fn film_root(state: &AppState, id: &str) -> ApiResult<PathBuf> {
    home::films(&state.home)
        .into_iter()
        .map(|film| film.path)
        .chain(state.project.clone())
        .find(|path| film_id(path) == id)
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "This film is not on the list"))
}

/// The picture that stands for a film: its thumbnail, else a style frame, else a still from the
/// middle of the latest polish pass, else the frame a render showed last.
fn picture_file(root: &Path) -> Option<PathBuf> {
    let pictures = |folder: PathBuf, prefix: &str| {
        let mut found: Vec<PathBuf> = std::fs::read_dir(folder)
            .into_iter()
            .flatten()
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| {
                path.extension().is_some_and(|ext| ext == "png")
                    && path
                        .file_name()
                        .is_some_and(|name| name.to_string_lossy().starts_with(prefix))
            })
            .collect();
        found.sort();
        found
    };
    let file = |path: PathBuf| path.is_file().then_some(path);
    file(root.join("renders/thumbnail.png"))
        .or_else(|| pictures(root.join("renders/frames"), "").into_iter().next())
        .or_else(|| {
            let stills = pictures(polish::latest_pass(root)?, "frame-");
            stills.get(stills.len() / 3).cloned()
        })
        .or_else(|| file(root.join(live::DIR).join(live::LATEST)))
}

fn films(state: &AppState, settings: &Settings) -> Vec<Value> {
    // Films already in the films folder belong on the list, whoever made them and when.
    if let Some(folder) = home::films_dir(settings) {
        home::adopt(&state.home, &folder);
    }
    let current = state.project.as_deref().map(film_id);
    home::films(&state.home)
        .into_iter()
        .take(MOST_FILMS)
        .map(|film| {
            let root = &film.path;
            let id = film_id(root);
            let exists = root.join("video.json").is_file();
            let mut entry = json!({
                "current": current.as_ref() == Some(&id),
                "id": id,
                "name": film.name,
                "path": root,
                "createdAt": film.created_at,
                "seenAt": film.seen_at,
                "exists": exists,
            });
            if !exists {
                return entry;
            }
            let live = live::read(root);
            let render = &live["render"];
            if render.is_object() {
                entry["render"] = json!({
                    "status": render["status"],
                    "completed": render["completed"],
                    "total": render["total"],
                });
            }
            entry["running"] = live["running"]
                .as_array()
                .and_then(|r| r.first())
                .map(|r| r["label"].clone())
                .unwrap_or(Value::Null);
            let status = production::status(root).unwrap_or_default();
            // Ready: rendered, and the agent is at the last step of its plan or has no plan.
            let last = status["steps"].as_array().and_then(|steps| steps.last());
            entry["ready"] = json!(
                render["status"] == "completed"
                    && last.is_none_or(
                        |step| step["name"] == status["step"] || step["state"] == "done"
                    )
            );
            entry["step"] = status["step"].clone();
            entry["note"] = status["note"].clone();
            entry["picture"] = json!(picture_file(root).map(|path| modified_ms(&path)));
            entry
        })
        .collect()
}

async fn film_picture(
    State(state): State<AppState>,
    RoutePath(id): RoutePath<String>,
) -> ApiResult<Response> {
    let root = film_root(&state, &id)?;
    let path = picture_file(&root)
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "No picture yet"))?;
    let modified = modified_ms(&path);
    if let Some((at, bytes)) = state.pictures.lock().unwrap().get(&id)
        && *at == modified
    {
        return Ok(bytes_response(bytes.clone(), "image/jpeg"));
    }
    let jpeg = tokio::task::spawn_blocking(move || {
        live::jpeg_thumbnail(&std::fs::read(&path)?, PICTURE_WIDTH)
    })
    .await??;
    let mut pictures = state.pictures.lock().unwrap();
    if pictures.len() > 128 {
        pictures.clear();
    }
    pictures.insert(id, (modified, jpeg.clone()));
    Ok(bytes_response(jpeg, "image/jpeg"))
}

async fn open_film(
    State(state): State<AppState>,
    RoutePath(id): RoutePath<String>,
) -> ApiResult<Json<Value>> {
    let root = film_root(&state, &id)?;
    if !root.join("video.json").is_file() {
        return Err(ApiError::bad("The folder of this film is gone"));
    }
    let root = crate::project::ProjectStore::open(&root)?.root;
    let url = live::start_studio(&root, false)
        .await
        .context("Studio did not start for this film")?;
    Ok(Json(json!({"url": url})))
}

#[derive(Deserialize)]
struct DuplicateFilm {
    /// The copy's name, in the language of the start page.
    name: String,
}

/// Copies a film as the start of another one, into the films folder, and puts it on the list.
async fn duplicate_film(
    State(state): State<AppState>,
    RoutePath(id): RoutePath<String>,
    Json(body): Json<DuplicateFilm>,
) -> ApiResult<Json<Value>> {
    let root = film_root(&state, &id)?;
    if !root.join("video.json").is_file() {
        return Err(ApiError::bad("The folder of this film is gone"));
    }
    let name = body.name.trim().replace('*', "");
    if name.is_empty() {
        return Err(ApiError::bad("The copy needs a name"));
    }
    let settings = Settings::load(&state.home)?;
    let folder = home::films_dir(&settings).context("No films folder is set")?;
    let target = home::new_film_dir(&folder, &name);
    let named = name.clone();
    let copy = tokio::task::spawn_blocking(move || home::duplicate(&root, &target, &named))
        .await
        .context("Copying the film stopped")??;
    // Listed like a film that was opened, not one the agent began: the start page opens it
    // itself instead of following it.
    home::remember(&state.home, &copy, &name, false);
    Ok(Json(
        json!({"id": film_id(&copy), "films": films(&state, &settings)}),
    ))
}

async fn forget_film(
    State(state): State<AppState>,
    RoutePath(id): RoutePath<String>,
) -> ApiResult<Json<Value>> {
    let root = film_root(&state, &id)?;
    home::forget(&state.home, &root)?;
    Ok(Json(
        json!({"films": films(&state, &Settings::load(&state.home)?)}),
    ))
}

async fn reveal_film(
    State(state): State<AppState>,
    RoutePath(id): RoutePath<String>,
) -> ApiResult<Json<Value>> {
    let root = film_root(&state, &id)?;
    reveal(&root)?;
    Ok(Json(json!({"opened": root})))
}

// --------------------------------------------------------------------------------------- agents

/// The coding agents and their skills, remembered for a moment: comparing reads many files and
/// the start page asks every few seconds.
fn agents(state: &AppState, fresh: bool) -> Value {
    match state.agents.get(AGENTS_FOR).filter(|_| !fresh) {
        Some(agents) => agents,
        None => state.agents.put(json!(skills::describe())),
    }
}

/// Brings an agent's skills to the app's version: adds the missing ones and replaces the ones
/// that differ. What it replaces is kept in the user folder.
async fn install_skills(
    State(state): State<AppState>,
    RoutePath(id): RoutePath<String>,
) -> ApiResult<Json<Value>> {
    let agent = Agent::find(&id).ok_or_else(|| ApiError::bad("Unknown coding agent"))?;
    if !agent.installed() {
        return Err(ApiError::bad(
            "This coding agent is not installed on this computer",
        ));
    }
    let shipped = skills::shipped().context("The skills folder is not next to superint-video")?;
    let installed = agent.skills_dir().context("No user folder")?;
    let replaced = state.home.join(REPLACED_SKILLS).join(agent.id);
    let done = tokio::task::spawn_blocking(move || skills::sync(&shipped, &installed, &replaced))
        .await??;
    Ok(Json(json!({
        "copied": done.added,
        "updated": done.updated,
        "agents": agents(&state, true),
    })))
}

// -------------------------------------------------------------------------------------- reveal

/// Opens a folder in the file manager.
fn reveal(path: &Path) -> Result<()> {
    if !path.is_dir() {
        bail!("Folder not found: {}", path.display());
    }
    process::open_path(path)
}

async fn reveal_place(
    State(state): State<AppState>,
    RoutePath(what): RoutePath<String>,
) -> ApiResult<Json<Value>> {
    let folder = match what.as_str() {
        "home" => state.home.clone(),
        "films" => {
            let folder =
                home::films_dir(&Settings::load(&state.home)?).context("No films folder is set")?;
            std::fs::create_dir_all(&folder)?;
            folder
        }
        "styles" => {
            let folder = preset::user_dir().context("No user folder")?;
            std::fs::create_dir_all(&folder)?;
            folder
        }
        _ => return Err(ApiError::bad("Unknown place")),
    };
    reveal(&folder)?;
    Ok(Json(json!({"opened": folder})))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn a_film_keeps_its_id_and_two_films_differ() {
        let a = film_id(Path::new("C:/Films/Sleep"));
        if cfg!(windows) {
            assert_eq!(a, film_id(Path::new(r"c:\films\sleep")));
        }
        assert_ne!(a, film_id(Path::new("C:/Films/Sleep-2")));
        assert_eq!(a.len(), 16);
    }

    #[test]
    fn the_list_shows_what_each_film_is_doing() {
        let home = TempDir::new().unwrap();
        let film = home.path().join("sleep");
        std::fs::create_dir_all(film.join("process")).unwrap();
        std::fs::write(film.join("video.json"), b"{}").unwrap();
        std::fs::write(
            film.join(production::STATUS),
            br#"{"step":"Beats","note":"Timing the hook"}"#,
        )
        .unwrap();
        home::remember(home.path(), &film, "Sleep", true);
        home::remember(home.path(), &home.path().join("gone"), "Gone", false);
        // An empty films folder of its own, so nothing of this computer's films comes in.
        let settings = Settings {
            projects_dir: Some(home.path().join("films")),
            ..Settings::default()
        };
        let state = AppState::new(home.path().to_path_buf(), Some(film.clone()), "t".into());
        let list = films(&state, &settings);
        let sleep = list.iter().find(|f| f["name"] == "Sleep").unwrap();
        assert_eq!(sleep["step"], "Beats");
        assert_eq!(sleep["exists"], true);
        assert_eq!(sleep["current"], true);
        assert!(sleep["picture"].is_null());
        let gone = list.iter().find(|f| f["name"] == "Gone").unwrap();
        assert_eq!(gone["exists"], false);
        assert!(film_root(&state, sleep["id"].as_str().unwrap()).is_ok());
        assert!(film_root(&state, "0000000000000000").is_err());
    }

    #[test]
    fn tools_are_installed_by_a_fixed_command_only() {
        let command = |id: &str| install_command(TOOLS.iter().find(|t| t.id == id).unwrap());
        assert_eq!(
            command("ffmpeg").as_deref(),
            Some("winget install --id Gyan.FFmpeg --exact --source winget")
        );
        assert!(command("chrome").unwrap().contains("Google.Chrome"));
        // Earshot is not in winget: the page shows its command to copy instead.
        assert_eq!(command("earshot"), None);
        // No agreement is accepted on the user's behalf.
        assert!(
            TOOLS
                .iter()
                .filter_map(install_command)
                .all(|c| !c.contains("accept"))
        );
        // The sign-in agrees to nothing for the user either.
        assert!(!GOOGLE_SIGN_IN_SCRIPT.contains("accept"));
        assert!(GOOGLE_SIGN_IN_SCRIPT.contains("auth application-default login"));
        // Earshot comes from GitHub: the PyPI package of that name is another project.
        let source = r#""earshot[mcp,llm] @ git+https://github.com/Leonxlnx/earshot""#;
        assert!(EARSHOT_INSTALL.ends_with(source) && EARSHOT_SCRIPT.contains(source));
        assert!(!EARSHOT_SCRIPT.contains("accept") && !EARSHOT_SCRIPT.contains("pip install"));
    }

    #[test]
    fn key_rows_never_carry_a_value() {
        let home = TempDir::new().unwrap();
        let project = TempDir::new().unwrap();
        std::fs::write(project.path().join(".env"), "").unwrap();
        KeyStore::at(home.path())
            .set(env::GEMINI, "value-that-must-not-leak-01")
            .unwrap();
        let keys = Keys::load_with(project.path(), Some(home.path())).unwrap();
        let mut settings = Settings::default();
        settings.set("openAiRegion", "eu").unwrap();
        let place = providers::cloud::Place::of(&keys, &settings, None);
        let rows = json!(key_rows(&keys, &settings, None, &place)).to_string();
        assert!(!rows.contains("value-that-must-not-leak-01"));
        assert!(rows.contains("aistudio.google.com"));
        // Each provider names the models its key is used with by default.
        assert!(rows.contains(r#""voice":"gemini-3.8-flash-tts""#));
        assert!(rows.contains(r#""voice":"google/gemini-3.8-flash-tts""#));
        assert!(rows.contains(r#""music":"google/lyria-3-pro-preview""#));
        assert!(rows.contains(r#""music":"lyria-3-pro-preview""#));
        assert!(rows.contains(r#""dictation":"microsoft/mai-transcribe-2""#));
        // OpenAI only writes down dictations; it and Google Cloud are folded away.
        assert!(rows.contains(r#""models":{"dictation":"gpt-transcribe","style":"gpt-6.1-sol"}"#));
        // A style is written by the same model whichever way reaches Google.
        assert!(rows.contains(r#""style":"gemini-4-hydrogen""#));
        assert!(rows.contains(r#""style":"google/gemini-4-hydrogen""#));
        assert!(rows.contains(r#""region":"eu""#));
        assert_eq!(rows.matches(r#""more":true"#).count(), 2);
    }
}
