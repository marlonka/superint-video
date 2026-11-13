use crate::{
    app::{self, AppState},
    home, live,
    media::{self, MediaService},
    model::Manifest,
    process, production,
    project::{ProjectStore, safe_path},
    renderer::{self, Progress},
    voice::{self, own},
};
use anyhow::{Context, Result};
use axum::{
    Json, Router,
    body::{Body, Bytes},
    extract::{DefaultBodyLimit, Path as RoutePath, Query, Request, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    middleware::{self, Next},
    response::{IntoResponse, Response, Sse, sse::Event},
    routing::{delete, get, post},
};
use futures::StreamExt;
use include_dir::{Dir, include_dir};
use serde::Deserialize;
use serde_json::{Value, json};
use std::{
    collections::HashMap,
    convert::Infallible,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::Duration,
};
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tokio_stream::wrappers::BroadcastStream;
use tokio_util::sync::CancellationToken;

static RUNTIME: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/runtime");
static STUDIO: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/studio/dist");

#[derive(Clone)]
struct PreviewState {
    root: PathBuf,
    frozen: Option<Manifest>,
    studio_origin: Option<String>,
    origin: String,
    media: MediaService,
}
pub struct PreviewHandle {
    pub url: String,
    shutdown: CancellationToken,
}
impl PreviewHandle {
    pub fn stop(&self) {
        self.shutdown.cancel();
    }
}
impl Drop for PreviewHandle {
    fn drop(&mut self) {
        self.shutdown.cancel();
    }
}

pub async fn start_preview(
    root: PathBuf,
    frozen: Option<Manifest>,
    studio_origin: Option<String>,
) -> Result<PreviewHandle> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let url = format!("http://{}", listener.local_addr()?);
    let state = PreviewState {
        media: MediaService::new(root.clone()),
        root,
        frozen,
        studio_origin,
        origin: url.clone(),
    };
    let app = Router::new()
        .route("/manifest", get(preview_manifest))
        .route("/player.html", get(player_html))
        .route("/runtime/{*path}", get(runtime_file))
        .route("/asset/{*path}", get(asset_file))
        .route("/frame/{id}/{frame}", get(video_frame))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            preview_security,
        ))
        .with_state(state);
    let shutdown = CancellationToken::new();
    let signal = shutdown.clone();
    tokio::spawn(async move {
        let _ = axum::serve(listener, app)
            .with_graceful_shutdown(signal.cancelled_owned())
            .await;
    });
    Ok(PreviewHandle { url, shutdown })
}
fn get_manifest(state: &PreviewState) -> Result<Manifest> {
    if let Some(m) = &state.frozen {
        return Ok(m.clone());
    }
    let manifest: Manifest =
        serde_json::from_slice(&std::fs::read(state.root.join("video.json"))?)?;
    manifest.validate()?;
    Ok(manifest)
}
async fn preview_manifest(State(state): State<PreviewState>) -> ApiResult<Json<Manifest>> {
    Ok(Json(get_manifest(&state)?))
}
async fn player_html(State(state): State<PreviewState>) -> ApiResult<Response> {
    let html = RUNTIME
        .get_file("player.html")
        .context("Player missing from build")?
        .contents_utf8()
        .context("Player encoding")?;
    let config = format!(
        "<script>window.SUPERINT_STUDIO_ORIGIN={};</script>",
        serde_json::to_string(&state.studio_origin)?
    );
    Ok(bytes_response(
        html.replace("<head>", &format!("<head>{config}"))
            .into_bytes(),
        "text/html; charset=utf-8",
    ))
}
async fn runtime_file(RoutePath(path): RoutePath<String>) -> ApiResult<Response> {
    let file = RUNTIME.get_file(&path).context("Runtime file not found")?;
    Ok(bytes_response(
        file.contents().to_vec(),
        mime_guess::from_path(&path)
            .first_or_octet_stream()
            .as_ref(),
    ))
}
async fn asset_file(
    State(state): State<PreviewState>,
    RoutePath(path): RoutePath<String>,
) -> ApiResult<Response> {
    if path.split(['/', '\\']).any(|p| p.starts_with('.')) {
        return Err(ApiError::forbidden("Hidden project files are not served"));
    }
    let source = safe_path(&state.root, &path)?;
    if !source.is_file() {
        return Err(ApiError::new(StatusCode::NOT_FOUND, "Asset not found"));
    }
    let mut bytes = tokio::fs::read(&source).await?;
    if media::kind(&source) == "scene" {
        let html = String::from_utf8(bytes).context("Scene must be UTF-8 HTML")?;
        // The tool's fonts come with every scene; a face loads only when a scene uses it.
        let bootstrap = "<link rel=\"stylesheet\" href=\"/runtime/fonts/fonts.css\"><script type=\"module\" src=\"/runtime/scene.js\"></script>";
        let lower = html.to_ascii_lowercase();
        bytes = if let Some(start) = lower
            .find("<head")
            .and_then(|i| lower[i..].find('>').map(|j| i + j + 1))
        {
            format!("{}{bootstrap}{}", &html[..start], &html[start..]).into_bytes()
        } else {
            format!("{bootstrap}{html}").into_bytes()
        };
    }
    Ok(bytes_response(
        bytes,
        mime_guess::from_path(&source)
            .first_or_octet_stream()
            .as_ref(),
    ))
}
async fn video_frame(
    State(state): State<PreviewState>,
    RoutePath((id, frame)): RoutePath<(String, String)>,
) -> ApiResult<Response> {
    let frame = frame
        .strip_suffix(".png")
        .context("Frame extension must be png")?
        .parse::<u64>()?;
    let manifest = get_manifest(&state)?;
    Ok(bytes_response(
        state.media.frame(&manifest, &id, frame).await?,
        "image/png",
    ))
}
fn valid_host(headers: &HeaderMap, origin: &str) -> bool {
    headers.get(header::HOST).and_then(|v| v.to_str().ok()) == origin.strip_prefix("http://")
}
async fn preview_security(State(state): State<PreviewState>, req: Request, next: Next) -> Response {
    if !valid_host(req.headers(), &state.origin) {
        return ApiError::forbidden("Invalid Host").into_response();
    }
    if let Some(origin) = req
        .headers()
        .get(header::ORIGIN)
        .and_then(|v| v.to_str().ok())
        && origin != "null"
        && origin != state.origin
        && state.studio_origin.as_deref() != Some(origin)
    {
        return ApiError::forbidden("Foreign preview Origin").into_response();
    }
    let mut response = next.run(req).await;
    let headers = response.headers_mut();
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_ORIGIN,
        HeaderValue::from_static("*"),
    );
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    let policy = format!(
        "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self'; frame-src 'self'; frame-ancestors 'self' {}; base-uri 'none'; form-action 'none'",
        state.studio_origin.as_deref().unwrap_or("")
    );
    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_str(&policy).expect("local CSP"),
    );
    response
}

#[derive(Clone)]
struct StudioState {
    store: Arc<Mutex<ProjectStore>>,
    root: PathBuf,
    preview_url: String,
    origin: String,
    token: String,
    events: broadcast::Sender<Value>,
    media: MediaService,
    jobs: Arc<Mutex<HashMap<String, Job>>>,
    shutdown: CancellationToken,
}
struct Job {
    progress: Progress,
    cancel: CancellationToken,
}

/// A companion Studio without a viewer and without a render ends itself after this long.
const IDLE_LIMIT: Duration = Duration::from_secs(2 * 60 * 60);

/// How long nobody has been watching, in time the computer was awake. A night in standby is
/// not hours without a viewer: an open page asks again the moment the computer wakes.
struct Unwatched {
    awake: Duration,
    looked: std::time::Instant,
}
impl Unwatched {
    /// More than this between two looks means the computer slept in between.
    const LONGEST_LOOK: Duration = Duration::from_secs(5 * 60);

    fn new() -> Self {
        Self {
            awake: Duration::ZERO,
            looked: std::time::Instant::now(),
        }
    }
    /// Takes note of one look and says how long nobody has been watching.
    fn look(&mut self, watched: bool) -> Duration {
        let passed = self.looked.elapsed();
        self.looked = std::time::Instant::now();
        self.count(watched, passed)
    }
    fn count(&mut self, watched: bool, passed: Duration) -> Duration {
        if watched {
            self.awake = Duration::ZERO;
        } else if passed <= Self::LONGEST_LOOK {
            self.awake += passed;
        }
        self.awake
    }
}

pub struct StudioOptions {
    pub open: bool,
    pub detached: bool,
}

pub async fn studio(root: PathBuf, port: u16, options: StudioOptions) -> Result<()> {
    let store = ProjectStore::open(&root)?;
    let root = store.root.clone();
    let name = store.manifest.name.clone();
    let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, port)).await?;
    let origin = format!("http://{}", listener.local_addr()?);
    let preview = start_preview(root.clone(), None, Some(origin.clone())).await?;
    let (event_sender, _) = broadcast::channel(64);
    let shutdown = CancellationToken::new();
    let state = StudioState {
        store: Arc::new(Mutex::new(store)),
        media: MediaService::new(root.clone()),
        root,
        preview_url: preview.url.clone(),
        origin: origin.clone(),
        token: uuid::Uuid::new_v4().to_string(),
        events: event_sender,
        jobs: Default::default(),
        shutdown: shutdown.clone(),
    };
    let app = Router::new()
        .route("/api/project", get(project_payload))
        .route("/api/edit", post(edit))
        .route("/api/history", post(history))
        .route("/api/events", get(events))
        .route("/api/import", post(import))
        .route("/api/media", get(metadata))
        .route("/api/doc", get(document))
        .route("/api/check", get(check))
        .route("/api/render", post(start_render))
        .route("/api/render/{id}", get(render_status))
        .route("/api/render/{id}/cancel", post(cancel_render))
        .route("/api/render/{id}/open", post(open_render))
        .route("/api/ping", get(ping))
        .route("/api/live", get(live_state))
        .route("/api/live/latest", get(live_latest))
        .route("/api/live/strip/{frame}", get(live_strip))
        .route("/api/live/video", get(live_video))
        .route("/api/live/open", post(live_open))
        .route("/api/voice", get(voice_state))
        .route("/api/voice/whole", post(voice_whole))
        .route(
            "/api/voice/paragraph/{number}",
            post(voice_record).delete(voice_discard),
        )
        .route("/api/voice/paragraph/{number}/accept", post(voice_accept))
        .route("/api/voice/paragraph/{number}/audio", get(voice_audio))
        .route("/api/voice/over", post(over_record))
        .route("/api/voice/over", delete(over_discard))
        .route("/api/voice/over/audio", get(over_audio))
        .route("/api/voice/over/keep", post(over_keep))
        .fallback(get(studio_file))
        .with_state(state.clone());
    // The start page (setup, defaults, styles, films) is the same in every Studio.
    let app = match home::dir() {
        Some(home) => {
            home::remember(&home, &state.root, &name, false);
            app.merge(app::routes(AppState::new(
                home,
                Some(state.root.clone()),
                state.token.clone(),
            )))
        }
        None => app,
    };
    let app =
        app.layer(DefaultBodyLimit::max(512 * 1024 * 1024))
            .layer(middleware::from_fn_with_state(
                Guard {
                    origin: state.origin.clone(),
                    token: state.token.clone(),
                    preview: Some(state.preview_url.clone()),
                },
                guard,
            ));
    let watcher = state.clone();
    let detached = options.detached;
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_millis(900));
        let mut last_error = String::new();
        let mut last_live = String::new();
        let mut last_production = String::new();
        let mut last_render_start = live::read(&watcher.root)["render"]["startedAt"].as_u64();
        let mut last_asked = None;
        let mut unwatched = Unwatched::new();
        let mut tick = 0u32;
        loop {
            tokio::select! {
                _ = watcher.shutdown.cancelled() => break,
                _ = interval.tick() => {}
            }
            tick = tick.wrapping_add(1);
            let current = live::read(&watcher.root);
            let rendering = current["render"]["status"] == "running";
            // A render that starts while nobody watches brings the view back, and so does a
            // command that waits for the user to record their voice.
            let start = current["render"]["startedAt"].as_u64();
            let asked = current["running"]
                .as_array()
                .into_iter()
                .flatten()
                .find(|command| !command["asks"].is_null())
                .and_then(|command| command["startedAt"].as_u64());
            if ((rendering && start != last_render_start)
                || (asked.is_some() && asked != last_asked))
                && watcher.events.receiver_count() == 0
                && !live::studio_disabled()
            {
                live::open_browser(&watcher.origin);
            }
            last_render_start = start;
            last_asked = asked;
            let alone = unwatched.look(rendering || watcher.events.receiver_count() > 0);
            if detached && alone > IDLE_LIMIT {
                watcher.shutdown.cancel();
                break;
            }
            let text = current.to_string();
            if text != last_live {
                last_live = text;
                let _ = watcher.events.send(json!({"type":"live","live":current}));
            }
            if tick.is_multiple_of(3) {
                let mut summary = production::summary(&watcher.root);
                let text = {
                    summary["now"] = json!(0);
                    summary.to_string()
                };
                if text != last_production {
                    let first = last_production.is_empty();
                    last_production = text;
                    if !first {
                        summary["now"] = json!(crate::project::now_ms());
                        let event = json!({"type": "production", "production": summary});
                        let _ = watcher.events.send(event);
                    }
                }
            }
            let event = {
                let mut store = watcher.store.lock().unwrap();
                match store.reload() {
                    Ok(true) => {
                        last_error.clear();
                        Some(json!({"type": "changed", "revision": store.revision}))
                    }
                    Ok(false) => None,
                    Err(e) if e.to_string() == last_error => None,
                    Err(e) => {
                        last_error = e.to_string();
                        Some(json!({"type": "invalid", "message": last_error}))
                    }
                }
            };
            if let Some(event) = event {
                let _ = watcher.events.send(event);
            }
        }
    });
    println!(
        "{}",
        json!({"url":origin,"project":state.root,"previewUrl":state.preview_url})
    );
    eprintln!("Superint Video Studio: {origin}  ·  Ctrl+C to stop");
    let studio = live::Server::studio(&state.root);
    studio.register(&origin);
    if options.open {
        live::open_browser(&origin);
    }
    let signal = shutdown.clone();
    let jobs = state.jobs.clone();
    let served = axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            tokio::select! {
                _ = tokio::signal::ctrl_c() => {}
                _ = signal.cancelled() => {}
            }
            signal.cancel();
            for job in jobs.lock().unwrap().values() {
                job.cancel.cancel();
            }
        })
        .await;
    studio.unregister();
    preview.stop();
    served?;
    Ok(())
}

/// The app without a project: the start page with setup, defaults, styles and films.
pub async fn app(home: PathBuf, port: u16, options: StudioOptions) -> Result<()> {
    std::fs::create_dir_all(&home)?;
    let local = std::net::Ipv4Addr::LOCALHOST;
    let listener = match TcpListener::bind((local, port)).await {
        Ok(listener) => listener,
        // The usual port is taken by something else: any free one will do.
        Err(_) if port != 0 => TcpListener::bind((local, 0)).await?,
        Err(error) => return Err(error.into()),
    };
    let origin = format!("http://{}", listener.local_addr()?);
    let token = uuid::Uuid::new_v4().to_string();
    let state = AppState::new(home.clone(), None, token.clone());
    let router = Router::new()
        .fallback(get(studio_file))
        .merge(app::routes(state.clone()))
        .layer(DefaultBodyLimit::max(1024 * 1024))
        .layer(middleware::from_fn_with_state(
            Guard {
                origin: origin.clone(),
                token,
                preview: None,
            },
            guard,
        ));
    let shutdown = CancellationToken::new();
    if options.detached {
        let (seen, stop) = (state.seen.clone(), shutdown.clone());
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60));
            let mut unwatched = Unwatched::new();
            loop {
                interval.tick().await;
                // The start page asks every few seconds while it is open.
                let watched = seen.lock().unwrap().elapsed() < Duration::from_secs(90);
                if unwatched.look(watched) > IDLE_LIMIT {
                    stop.cancel();
                    break;
                }
            }
        });
    }
    println!("{}", json!({"url": origin, "home": home}));
    eprintln!("Superint Video: {origin}  ·  Ctrl+C to stop");
    let record = live::Server::app(&home);
    record.register(&origin);
    if options.open {
        live::open_browser(&origin);
    }
    let signal = shutdown.clone();
    let served = axum::serve(listener, router)
        .with_graceful_shutdown(async move {
            tokio::select! {
                _ = tokio::signal::ctrl_c() => {}
                _ = signal.cancelled() => {}
            }
        })
        .await;
    record.unregister();
    served?;
    Ok(())
}

fn payload(state: &StudioState) -> Result<Value> {
    let mut store = state.store.lock().unwrap();
    store.reload()?;
    let assets: Vec<Value> = walkdir::WalkDir::new(&state.root)
        .into_iter()
        .filter_entry(|e| {
            !e.file_name().to_string_lossy().starts_with('.') && e.file_name() != "renders"
        })
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file() && media::kind(e.path()) != "file")
        .map(|e| {
            let path = e.path().strip_prefix(&state.root).unwrap_or(e.path());
            json!({
                "path": path.to_string_lossy().replace('\\', "/"),
                "name": e.file_name().to_string_lossy(),
                "kind": media::kind(e.path()),
                "size": e.metadata().map_or(0, |m| m.len()),
            })
        })
        .collect();
    Ok(json!({
        "manifest": store.manifest,
        "revision": store.revision,
        "name": store.manifest.name,
        "projectPath": state.root,
        "previewUrl": state.preview_url,
        "token": state.token,
        "assets": assets,
        "canUndo": store.can_undo(),
        "canRedo": store.can_redo(),
        "fonts": crate::fonts::Choices::of(&state.root).json(),
        "production": crate::production::summary(&state.root),
    }))
}
async fn project_payload(State(state): State<StudioState>) -> ApiResult<Json<Value>> {
    Ok(Json(payload(&state)?))
}
#[derive(Deserialize)]
struct EditBody {
    revision: String,
    /// One operation, or a list applied as one step (`superint-video edit`).
    operation: Value,
}
async fn edit(
    State(state): State<StudioState>,
    Json(body): Json<EditBody>,
) -> ApiResult<Json<Value>> {
    {
        let mut store = state.store.lock().unwrap();
        match &body.operation {
            Value::Array(operations) => store.edit_many(&body.revision, operations)?,
            operation => store.edit(&body.revision, operation)?,
        }
    }
    let result = payload(&state)?;
    let _ = state
        .events
        .send(json!({"type":"changed","revision":result["revision"]}));
    Ok(Json(result))
}
#[derive(Deserialize)]
struct HistoryBody {
    revision: String,
    action: String,
}
async fn history(
    State(state): State<StudioState>,
    Json(body): Json<HistoryBody>,
) -> ApiResult<Json<Value>> {
    {
        let mut store = state.store.lock().unwrap();
        match body.action.as_str() {
            "undo" => store.undo(&body.revision)?,
            "redo" => store.redo(&body.revision)?,
            _ => return Err(ApiError::bad("Unknown history action")),
        }
    }
    let result = payload(&state)?;
    let _ = state
        .events
        .send(json!({"type":"changed","revision":result["revision"]}));
    Ok(Json(result))
}
async fn events(
    State(state): State<StudioState>,
) -> Sse<impl futures::Stream<Item = Result<Event, Infallible>>> {
    let stream = BroadcastStream::new(state.events.subscribe())
        .take_until(state.shutdown.cancelled_owned())
        .filter_map(|result| async move {
            result
                .ok()
                .map(|data| Ok(Event::default().data(data.to_string())))
        });
    Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default())
}
#[derive(Deserialize)]
struct DocumentQuery {
    path: String,
}
async fn document(
    State(state): State<StudioState>,
    Query(query): Query<DocumentQuery>,
) -> ApiResult<Json<Value>> {
    let text = crate::production::document(&state.root, &query.path)
        .map_err(|e| ApiError::bad(&e.to_string()))?;
    Ok(Json(json!({"path": query.path, "text": text})))
}
#[derive(Deserialize)]
struct AssetQuery {
    path: String,
}
async fn metadata(
    State(state): State<StudioState>,
    Query(query): Query<AssetQuery>,
) -> ApiResult<Json<Value>> {
    Ok(Json(state.media.metadata(&query.path).await?))
}
#[derive(Deserialize)]
struct ImportQuery {
    name: String,
}
async fn import(
    State(state): State<StudioState>,
    Query(query): Query<ImportQuery>,
    bytes: Bytes,
) -> ApiResult<Json<Value>> {
    let name = Path::new(&query.name)
        .file_name()
        .and_then(|v| v.to_str())
        .context("Invalid filename")?;
    if name != query.name || name.starts_with('.') || name.contains(':') {
        return Err(ApiError::bad("Use a filename without directories"));
    }
    let input_kind = media::kind(Path::new(name));
    if input_kind == "file" {
        return Err(ApiError::bad("Unsupported file type"));
    }
    let mut relative = format!("assets/{name}");
    let mut i = 1;
    while safe_path(&state.root, &relative)?.exists() {
        relative = format!(
            "assets/{}-{i}.{}",
            Path::new(name).file_stem().unwrap().to_string_lossy(),
            Path::new(name)
                .extension()
                .unwrap_or_default()
                .to_string_lossy()
        );
        i += 1;
    }
    let path = safe_path(&state.root, &relative)?;
    std::fs::create_dir_all(path.parent().unwrap())?;
    crate::project::atomic_write(&path, &bytes)?;
    let mut store = state.store.lock().unwrap();
    store.reload()?;
    let _ = state
        .events
        .send(json!({"type":"changed","revision":store.revision}));
    Ok(Json(json!({"path":relative,"kind":input_kind})))
}
async fn check(State(state): State<StudioState>) -> ApiResult<Json<Value>> {
    let snapshot = { state.store.lock().unwrap().snapshot()? };
    Ok(Json(renderer::check(snapshot).await?))
}
#[derive(Deserialize)]
struct RenderBody {
    output: String,
    #[serde(default = "quality_default")]
    quality: String,
    #[serde(default = "codec_default")]
    codec: String,
    #[serde(default)]
    overwrite: bool,
}
fn quality_default() -> String {
    "final".into()
}
fn codec_default() -> String {
    renderer::DEFAULT_CODEC.into()
}
async fn start_render(
    State(state): State<StudioState>,
    Json(body): Json<RenderBody>,
) -> ApiResult<Json<Value>> {
    if body.quality != "draft" && body.quality != "final" {
        return Err(ApiError::bad("Quality must be draft or final"));
    }
    if !renderer::CODECS.contains(&body.codec.as_str()) {
        return Err(ApiError::bad("Codec must be x265 or x264"));
    }
    let output = safe_path(&state.root, &body.output)?;
    if output.extension().and_then(|v| v.to_str()) != Some("mp4") {
        return Err(ApiError::bad("Export path must end in .mp4"));
    }
    if output.exists() && !body.overwrite {
        return Err(ApiError::bad(
            "Output exists; choose another path or enable overwrite",
        ));
    }
    {
        let jobs = state.jobs.lock().unwrap();
        if jobs.values().any(|j| j.progress.status == "running") {
            return Err(ApiError::bad("A render is already running"));
        }
    }
    let snapshot = {
        let mut store = state.store.lock().unwrap();
        store.reload()?;
        store.snapshot()?
    };
    let id = uuid::Uuid::new_v4().to_string();
    let cancel = CancellationToken::new();
    let progress = Progress {
        id: id.clone(),
        status: "running".into(),
        stage: "Preparing".into(),
        completed: 0,
        total: snapshot.manifest.duration_frames,
        output: crate::project::without_verbatim(&output)
            .display()
            .to_string(),
        error: None,
    };
    {
        let mut jobs = state.jobs.lock().unwrap();
        if jobs.values().any(|j| j.progress.status == "running") {
            return Err(ApiError::bad("A render is already running"));
        }
        if jobs.len() >= 32 {
            jobs.retain(|_, j| j.progress.status == "running");
        }
        jobs.insert(
            id.clone(),
            Job {
                progress,
                cancel: cancel.clone(),
            },
        );
    }
    let job_id = id.clone();
    let state_clone = state.clone();
    let reporter = live::LiveRender::start(
        &state.root,
        &output,
        snapshot.manifest.duration_frames,
        snapshot.manifest.fps.num as f64 / snapshot.manifest.fps.den as f64,
    );
    tokio::spawn(async move {
        let progress_state = state_clone.clone();
        let progress_id = job_id.clone();
        let progress_live = reporter.clone();
        let callback: renderer::ProgressFn = Arc::new(move |stage, completed, total| {
            progress_live.progress(stage, completed, total);
            if let Some(job) = progress_state.jobs.lock().unwrap().get_mut(&progress_id) {
                job.progress.stage = stage.into();
                job.progress.completed = completed;
                job.progress.total = total;
            }
        });
        let watcher = reporter.clone();
        let watch: renderer::FrameFn = Arc::new(move |frame, png| watcher.frame(frame, png));
        let result = renderer::render_watched(
            snapshot,
            output,
            &body.quality,
            &body.codec,
            body.overwrite,
            None,
            None,
            cancel.clone(),
            callback,
            Some(watch),
        )
        .await;
        reporter.finish(&result, cancel.is_cancelled());
        if let Some(job) = state_clone.jobs.lock().unwrap().get_mut(&job_id) {
            match result {
                Ok(_) => {
                    job.progress.status = "completed".into();
                    job.progress.stage = "Export ready".into();
                }
                Err(e) => {
                    job.progress.status = if cancel.is_cancelled() {
                        "cancelled"
                    } else {
                        "failed"
                    }
                    .into();
                    job.progress.stage = job.progress.status.clone();
                    job.progress.error = Some(format!("{e:#}"));
                }
            }
        }
    });
    Ok(Json(json!({"id":id})))
}
async fn render_status(
    State(state): State<StudioState>,
    RoutePath(id): RoutePath<String>,
) -> ApiResult<Json<Progress>> {
    Ok(Json(
        state
            .jobs
            .lock()
            .unwrap()
            .get(&id)
            .context("Render not found")?
            .progress
            .clone(),
    ))
}
async fn cancel_render(
    State(state): State<StudioState>,
    RoutePath(id): RoutePath<String>,
) -> ApiResult<Json<Value>> {
    state
        .jobs
        .lock()
        .unwrap()
        .get(&id)
        .context("Render not found")?
        .cancel
        .cancel();
    Ok(Json(json!({"ok":true})))
}
async fn open_render(
    State(state): State<StudioState>,
    RoutePath(id): RoutePath<String>,
) -> ApiResult<Json<Value>> {
    let path = {
        let jobs = state.jobs.lock().unwrap();
        let job = jobs.get(&id).context("Render not found")?;
        if job.progress.status != "completed" {
            return Err(ApiError::bad("Render is not complete"));
        }
        job.progress.output.clone()
    };
    process::open_path(path.as_ref())?;
    Ok(Json(json!({"ok":true})))
}
async fn ping(State(state): State<StudioState>) -> Json<Value> {
    Json(json!({"project": state.root}))
}
async fn live_state(State(state): State<StudioState>) -> Json<Value> {
    Json(live::read(&state.root))
}
async fn live_latest(State(state): State<StudioState>) -> ApiResult<Response> {
    let bytes = live::latest_picture(&state.root)
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "No frame yet"))?;
    Ok(bytes_response(bytes, "image/png"))
}
async fn live_strip(
    State(state): State<StudioState>,
    RoutePath(frame): RoutePath<u64>,
) -> ApiResult<Response> {
    let bytes = live::strip_picture(&state.root, frame)
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "No such thumbnail"))?;
    Ok(bytes_response(bytes, "image/jpeg"))
}
/// Reads a `Range: bytes=a-b` header against a file length; None serves the whole file.
fn parse_range(header: Option<&str>, length: u64) -> Option<(u64, u64)> {
    let (start, end) = header?.strip_prefix("bytes=")?.split_once('-')?;
    let start = start.parse::<u64>().ok()?;
    let end = end
        .parse::<u64>()
        .unwrap_or(u64::MAX)
        .min(length.saturating_sub(1));
    (start <= end).then_some((start, end))
}
/// The finished film, with ranges, so the player in Studio can seek in a large file.
async fn live_video(State(state): State<StudioState>, headers: HeaderMap) -> ApiResult<Response> {
    use tokio::io::{AsyncReadExt, AsyncSeekExt};
    let path = live::finished_video(&state.root)
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "No finished film"))?;
    let mut file = tokio::fs::File::open(&path).await?;
    let length = file.metadata().await?.len();
    let range = parse_range(
        headers.get(header::RANGE).and_then(|v| v.to_str().ok()),
        length,
    );
    let (start, end) = range.unwrap_or((0, length.saturating_sub(1)));
    file.seek(std::io::SeekFrom::Start(start)).await?;
    let stream = tokio_util::io::ReaderStream::new(file.take(end + 1 - start));
    let mut response = Response::new(Body::from_stream(stream));
    let headers = response.headers_mut();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("video/mp4"));
    headers.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
    headers.insert(header::CONTENT_LENGTH, HeaderValue::from(end + 1 - start));
    if range.is_some() {
        *response.status_mut() = StatusCode::PARTIAL_CONTENT;
        response.headers_mut().insert(
            header::CONTENT_RANGE,
            HeaderValue::from_str(&format!("bytes {start}-{end}/{length}")).context("Range")?,
        );
    }
    Ok(response)
}
async fn live_open(State(state): State<StudioState>) -> ApiResult<Json<Value>> {
    let path = live::finished_video(&state.root)
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "No finished film"))?;
    process::open_path(&path)?;
    Ok(Json(json!({"ok":true})))
}
/// The user's own voice: what the recording view shows. `script` is every paragraph of
/// `voice.md` with its recordings (null without a `voice.md`, with `problem` when it cannot be
/// read), `over` the take spoken over the picture that waits to be kept, `cues` the script's
/// paragraphs with the second of the film they begin at, where the narration places them.
async fn voice_payload(state: &StudioState) -> ApiResult<Json<Value>> {
    let root = state.root.clone();
    let manifest = state.store.lock().unwrap().manifest.clone();
    let payload = tokio::task::spawn_blocking(move || {
        let (script, problem) = match root.join(voice::FILE).is_file().then(|| own::status(&root)) {
            Some(Ok(status)) => (Some(status), None),
            Some(Err(error)) => (None, Some(format!("{error:#}"))),
            None => (None, None),
        };
        json!({
            "script": script,
            "problem": problem,
            "over": own::over_draft(&root),
            "cues": own::cues(&root, &manifest),
        })
    })
    .await?;
    Ok(Json(payload))
}
async fn voice_state(State(state): State<StudioState>) -> ApiResult<Json<Value>> {
    voice_payload(&state).await
}
async fn voice_record(
    State(state): State<StudioState>,
    RoutePath(number): RoutePath<usize>,
    bytes: Bytes,
) -> ApiResult<Json<Value>> {
    own::record(&state.root, number, &bytes, false).await?;
    voice_payload(&state).await
}
async fn voice_accept(
    State(state): State<StudioState>,
    RoutePath(number): RoutePath<usize>,
) -> ApiResult<Json<Value>> {
    own::accept(&state.root, number)?;
    voice_payload(&state).await
}
async fn voice_discard(
    State(state): State<StudioState>,
    RoutePath(number): RoutePath<usize>,
) -> ApiResult<Json<Value>> {
    own::discard(&state.root, number)?;
    voice_payload(&state).await
}
async fn voice_whole(State(state): State<StudioState>, bytes: Bytes) -> ApiResult<Json<Value>> {
    own::whole(&state.root, &bytes).await?;
    voice_payload(&state).await
}
#[derive(Deserialize)]
struct TakeQuery {
    /// The recording that waits to be accepted, not the accepted one.
    #[serde(default)]
    draft: Option<u8>,
}
fn wav_response(path: Option<PathBuf>) -> ApiResult<Response> {
    let path = path.ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "No recording"))?;
    Ok(bytes_response(std::fs::read(path)?, "audio/wav"))
}
async fn voice_audio(
    State(state): State<StudioState>,
    RoutePath(number): RoutePath<usize>,
    Query(query): Query<TakeQuery>,
) -> ApiResult<Response> {
    wav_response(own::audio_file(&state.root, number, query.draft == Some(1)))
}
#[derive(Deserialize)]
struct OverQuery {
    /// The frame of the film the recording began on.
    frame: u64,
}
async fn over_record(
    State(state): State<StudioState>,
    Query(query): Query<OverQuery>,
    bytes: Bytes,
) -> ApiResult<Json<Value>> {
    own::over_record(&state.root, query.frame, &bytes).await?;
    voice_payload(&state).await
}
async fn over_audio(State(state): State<StudioState>) -> ApiResult<Response> {
    wav_response(own::over_draft(&state.root).map(|over| state.root.join(over.take.file)))
}
async fn over_discard(State(state): State<StudioState>) -> ApiResult<Json<Value>> {
    own::over_discard(&state.root)?;
    voice_payload(&state).await
}
/// The take becomes the voice from its frame on, as one edit the user can undo.
async fn over_keep(State(state): State<StudioState>) -> ApiResult<Json<Value>> {
    let revision = {
        let mut store = state.store.lock().unwrap();
        // Checked before the file is moved, so a take that cannot be placed stays a draft.
        let draft = own::over_draft(&state.root).context("There is no recording to keep")?;
        own::over_operations(&store.manifest, &draft)?;
        let kept = own::over_keep(&state.root)?;
        // The kept file is new on disk: the edit starts from the project as it is now.
        store.reload()?;
        let operations = own::over_operations(&store.manifest, &kept)?;
        let revision = store.revision.clone();
        store.edit_many(&revision, &operations)?;
        store.revision.clone()
    };
    let _ = state
        .events
        .send(json!({"type":"changed","revision":revision}));
    voice_payload(&state).await
}
async fn studio_file(req: Request) -> Response {
    let path = req.uri().path().trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };
    match STUDIO.get_file(path) {
        Some(file) => bytes_response(
            file.contents().to_vec(),
            mime_guess::from_path(path).first_or_octet_stream().as_ref(),
        ),
        None => ApiError::new(
            StatusCode::NOT_FOUND,
            "Studio asset not found; build studio before compiling Rust",
        )
        .into_response(),
    }
}
/// What every request to a Studio must match: its own address, and for anything that changes
/// something the token only its own page knows.
#[derive(Clone)]
struct Guard {
    origin: String,
    token: String,
    preview: Option<String>,
}
async fn guard(State(state): State<Guard>, req: Request, next: Next) -> Response {
    if !valid_host(req.headers(), &state.origin) {
        return ApiError::forbidden("Invalid Host").into_response();
    }
    if let Some(origin) = req.headers().get(header::ORIGIN)
        && origin.to_str().ok() != Some(state.origin.as_str())
    {
        return ApiError::forbidden("Foreign Origin").into_response();
    }
    if req.method() != axum::http::Method::GET
        && req.method() != axum::http::Method::HEAD
        && req
            .headers()
            .get("X-Superint-Token")
            .and_then(|h| h.to_str().ok())
            != Some(&state.token)
    {
        return ApiError::forbidden("Missing session capability").into_response();
    }
    let mut response = next.run(req).await;
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response.headers_mut().insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    let preview = state.preview.as_deref().unwrap_or("");
    let frames = state.preview.as_deref().unwrap_or("'none'");
    response.headers_mut().insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_str(&format!(
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' {preview} data: blob:; frame-src {frames}; connect-src 'self' {preview}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
        ))
        .unwrap(),
    );
    response
}
pub(crate) fn bytes_response(bytes: Vec<u8>, mime: &str) -> Response {
    Response::builder()
        .header(header::CONTENT_TYPE, mime)
        .body(Body::from(bytes))
        .unwrap()
}
pub(crate) type ApiResult<T> = std::result::Result<T, ApiError>;
pub struct ApiError(StatusCode, String, Option<&'static str>);
impl ApiError {
    pub(crate) fn new(status: StatusCode, message: &str) -> Self {
        Self(status, message.into(), None)
    }
    pub(crate) fn bad(message: &str) -> Self {
        Self::new(StatusCode::BAD_REQUEST, message)
    }
    fn forbidden(message: &str) -> Self {
        Self::new(StatusCode::FORBIDDEN, message)
    }
    /// A failure the user can cause from the app. `code` names it, so the app says it in the
    /// user's language (`error.<code>` in its catalogs); `message` is the same in English for
    /// everyone else.
    pub(crate) fn told(code: &'static str, message: &str) -> Self {
        Self(StatusCode::BAD_REQUEST, message.into(), Some(code))
    }
}
impl<E: Into<anyhow::Error>> From<E> for ApiError {
    fn from(error: E) -> Self {
        let error = error.into();
        let message = format!("{error:#}");
        let status = if message.contains("stale revision") {
            StatusCode::CONFLICT
        } else {
            StatusCode::BAD_REQUEST
        };
        Self(status, message, None)
    }
}
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let mut body = json!({"error":self.0.as_u16(),"message":self.1});
        if let Some(code) = self.2 {
            body["code"] = json!(code);
        }
        (self.0, Json(body)).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn standby_is_not_time_without_a_viewer() {
        let minute = Duration::from_secs(60);
        let mut unwatched = Unwatched::new();
        assert_eq!(unwatched.count(false, minute), minute);
        assert_eq!(unwatched.count(false, minute), 2 * minute);
        // The computer slept for three hours: nobody could have looked, so they do not count.
        assert_eq!(unwatched.count(false, 180 * minute), 2 * minute);
        assert_eq!(unwatched.count(false, minute), 3 * minute);
        // Someone looks: the time starts again.
        assert_eq!(unwatched.count(true, minute), Duration::ZERO);
        // Two hours awake and alone add up.
        let mut alone = Duration::ZERO;
        for _ in 0..121 {
            alone = unwatched.count(false, minute);
        }
        assert!(alone > IDLE_LIMIT);
    }
}
