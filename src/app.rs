//! The app around the films: what is set up, what a new film defaults to, the styles and the
//! films this computer knows. Every Studio serves these routes next to its project, and
//! `superint-video app` serves them without one, so the start page is the same everywhere.
use crate::{
    earshot,
    env::{self, Keys},
    home::{self, KeyStore, Settings},
    live, polish, preset, process, production,
    project::modified_ms,
    providers,
    server::{ApiError, ApiResult, bytes_response},
    skills::{self, Agent},
};
use anyhow::{Context, Result, bail};
use axum::{
    Json, Router,
    body::Bytes,
    extract::{DefaultBodyLimit, Path as RoutePath, Query, State},
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
        .route("/api/app/films/{id}/reveal", post(reveal_film))
        .route("/api/app/films/{id}/picture", get(film_picture))
        .route("/api/app/styles", post(copy_style))
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
        let keys = Keys::load(state.start())?;
        let settings = Settings::load(&state.home)?;
        // OpenAI's key writes down dictations only; a film needs one of the others.
        let film_key = keys.any(providers::FILM_KEYS);
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
                    "dictate": keys.any(env::KNOWN),
                },
                "tools": tools,
                "keys": key_rows(&keys, &settings),
                "models": usual_models(&keys),
                "agents": agents(&state, fresh),
            },
            "filmsFolder": home::films_dir(&settings),
            "films": films(&state, &settings),
            "settings": settings,
            "styles": styles(&state)?,
        }))
    })
    .await?
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
    /// A command for a terminal that installs it, for tools the app cannot install itself.
    command: Option<&'static str>,
}

const TOOLS: &[Tool] = &[
    Tool {
        id: "chrome",
        title: "Chrome",
        parts: &["Chromium"],
        optional: false,
        get: "https://www.google.com/chrome/",
        winget: Some("Google.Chrome"),
        command: None,
    },
    Tool {
        id: "ffmpeg",
        title: "FFmpeg",
        parts: &["ffmpeg", "ffprobe"],
        optional: false,
        get: "https://ffmpeg.org/download.html",
        winget: Some("Gyan.FFmpeg"),
        command: None,
    },
    Tool {
        id: "earshot",
        title: "Earshot",
        parts: &["earshot"],
        optional: true,
        get: "https://github.com/Leonxlnx/earshot",
        winget: None,
        command: Some("pip install earshot"),
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
                "install": winget && tool.winget.is_some(),
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
    let command = install_command(tool)
        .filter(|_| process::winget())
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

/// One row per provider. Never a value: only whether a key is there, where it comes from and
/// the models it is used with unless the user, a style or a film names others. With an
/// OpenRouter key alone, Google's models are reached through OpenRouter, and Google Cloud
/// reaches the same models as AI Studio; OpenAI writes down dictations only. Rows marked
/// `more` are for few users and are folded away in Setup until they hold a key.
fn key_rows(keys: &Keys, settings: &Settings) -> Vec<Value> {
    let status = keys.status();
    let usual = providers::AI_STUDIO;
    let row = |name: &str, title: &str, get: &str, more: bool, models: Value| {
        let found = status.iter().find(|s| s.name == name);
        json!({
            "name": name, "title": title, "recommended": name == env::GEMINI, "get": get,
            "more": more,
            "present": found.is_some_and(|s| s.present),
            "source": found.and_then(|s| s.source.as_ref()).map(env::Source::kind),
            "models": models,
        })
    };
    let twin = |model: &str| providers::openrouter_twin(model).unwrap_or_else(|| model.into());
    let place = providers::cloud::Place::of(keys, settings);
    let mut cloud = row(
        env::GOOGLE_CLOUD,
        "Google Cloud",
        "https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/start/api-keys",
        true,
        json!({
            "voice": usual.speech, "timings": usual.transcription,
            "music": providers::cloud::model(usual.music), "dictation": providers::DICTATION_GOOGLE,
        }),
    );
    cloud["place"] = json!({
        "project": place.project, "location": place.location, "servedIn": place.served_in(),
        // Set outside the app (GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION), so Setup shows it.
        "fixed": keys.cloud_project.is_some() || keys.cloud_location.is_some(),
    });
    let mut openai = row(
        env::OPENAI,
        "OpenAI",
        "https://platform.openai.com/api-keys",
        true,
        json!({"dictation": providers::DICTATION_OPENAI}),
    );
    openai["region"] = json!(settings.open_ai_region.as_deref().unwrap_or("global"));
    vec![
        row(
            env::GEMINI,
            "Google AI Studio",
            "https://aistudio.google.com/apikey",
            false,
            json!({
                "voice": usual.speech, "timings": usual.transcription, "music": usual.music,
                "dictation": providers::DICTATION_GOOGLE,
            }),
        ),
        row(
            env::OPENROUTER,
            "OpenRouter",
            "https://openrouter.ai/settings/keys",
            false,
            json!({
                "voice": twin(usual.speech), "timings": twin(usual.transcription),
                "music": twin(usual.music), "dictation": providers::DICTATION_OPENROUTER,
            }),
        ),
        cloud,
        openai,
    ]
}

/// The models a film and a dictation use when the user names none, for Setup's models form.
fn usual_models(keys: &Keys) -> Value {
    let usual = providers::AI_STUDIO;
    json!({
        "narration": usual.speech, "voice": usual.voice, "transcription": usual.transcription,
        "music": usual.music, "dictation": providers::usual_dictation(keys),
    })
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
    let settings = Settings::load(&state.home)?;
    Ok(Json(
        json!({"keys": key_rows(&Keys::load(state.start())?, &settings)}),
    ))
}

async fn remove_key(
    State(state): State<AppState>,
    RoutePath(name): RoutePath<String>,
) -> ApiResult<Json<Value>> {
    let name = known_key(&name)?;
    KeyStore::at(&state.home).remove(name)?;
    let settings = Settings::load(&state.home)?;
    Ok(Json(
        json!({"keys": key_rows(&Keys::load(state.start())?, &settings)}),
    ))
}

async fn test_key(
    State(state): State<AppState>,
    RoutePath(name): RoutePath<String>,
) -> ApiResult<Json<Value>> {
    let name = known_key(&name)?;
    let settings = Settings::load(&state.home)?;
    Ok(Json(
        providers::try_key(state.start(), name, settings.dictation_model.as_deref()).await?,
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
    let keys = Keys::load(state.start())?;
    if !env::KNOWN.iter().any(|name| keys.get(name).is_some()) {
        return Err(ApiError::bad(
            "Dictation needs an API key: add one under Setup",
        ));
    }
    let settings = Settings::load(&state.home)?;
    let generators =
        providers::Generators::new(keys, std::env::temp_dir().join("superint-video-dictation"))?;
    let dictation = generators
        .dictate(body.to_vec(), settings.dictation_model.as_deref())
        .await?;
    Ok(Json(json!(dictation)))
}

// ------------------------------------------------------------------------------------ settings

async fn save_settings(
    State(state): State<AppState>,
    Json(mut settings): Json<Settings>,
) -> ApiResult<Json<Value>> {
    // Model IDs are pasted from the provider's pages: `models/` in front and spaces come along.
    for model in [
        &mut settings.narration_model,
        &mut settings.transcription_model,
        &mut settings.music_model,
        &mut settings.dictation_model,
    ] {
        *model = model
            .take()
            .map(|m| home::model_id(&m))
            .filter(|m| !m.is_empty());
    }
    for value in [
        &mut settings.narration_voice,
        &mut settings.google_cloud_project,
        &mut settings.google_cloud_location,
        &mut settings.open_ai_region,
    ] {
        *value = value
            .take()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty());
    }
    for value in [
        &mut settings.google_cloud_location,
        &mut settings.open_ai_region,
    ] {
        *value = value.take().map(|v| v.to_lowercase());
    }
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
        let rows = json!(key_rows(&keys, &settings)).to_string();
        assert!(!rows.contains("value-that-must-not-leak-01"));
        assert!(rows.contains("aistudio.google.com"));
        // Each provider names the models its key is used with by default.
        assert!(rows.contains(r#""voice":"gemini-3.8-flash-tts""#));
        assert!(rows.contains(r#""voice":"google/gemini-3.8-flash-tts""#));
        assert!(rows.contains(r#""music":"google/lyria-3-pro-preview""#));
        assert!(rows.contains(r#""music":"lyria-3-pro-preview""#));
        assert!(rows.contains(r#""dictation":"microsoft/mai-transcribe-2""#));
        // OpenAI only writes down dictations; it and Google Cloud are folded away.
        assert!(rows.contains(r#""models":{"dictation":"gpt-transcribe"}"#));
        assert!(rows.contains(r#""region":"eu""#));
        assert_eq!(rows.matches(r#""more":true"#).count(), 2);
    }
}
