//! Media generators behind Google AI Studio, Google Cloud, OpenRouter and OpenAI. Claude writes
//! every text and prompt; these calls send it unchanged and add only the transport fields each
//! API needs.
pub mod aistudio;
pub mod cache;
pub mod cloud;
pub mod gauth;
pub mod openai;
pub mod openrouter;

use crate::env::{self, Keys};
use anyhow::{Result, anyhow, bail};
use cache::Cache;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeSet,
    path::{Path, PathBuf},
    sync::Mutex,
    time::Duration,
};

/// A preconfigured set of models for one provider.
pub struct Route {
    pub speech: &'static str,
    pub voice: &'static str,
    pub transcription: &'static str,
    pub music: &'static str,
}
/// The default route (decided 2026-10-31: OpenRouter credits are limited).
pub const AI_STUDIO: Route = Route {
    speech: "gemini-3.8-flash-tts",
    // House voice, chosen by ear on 2026-10-31 (Charon was as good but is heard more often).
    voice: "Sadaltager",
    transcription: "gemini-3.5-transcribe",
    music: "lyria-3.5",
};
/// The alternative route; ElevenLabs is only available here.
pub const OPENROUTER: Route = Route {
    speech: "elevenlabs/eleven-v4-turbo",
    voice: "daniel",
    transcription: "microsoft/mai-transcribe-2",
    music: "google/lyria-3-pro-preview",
};

/// The models that write down what the user says into the start page when the user chose
/// none, in the order they are tried: Google's (through Google Cloud or AI Studio), OpenAI's,
/// OpenRouter's. Setup can name another (`dictationModel`).
pub const DICTATION_GOOGLE: &str = AI_STUDIO.transcription;
pub const DICTATION_OPENAI: &str = "gpt-transcribe";
pub const DICTATION_OPENROUTER: &str = OPENROUTER.transcription;
/// The longest dictation the start page sends.
pub const MOST_DICTATION_SECONDS: f64 = 600.0;

/// Model IDs that begin like this are OpenAI's.
const OPENAI_PREFIXES: &[&str] = &["gpt-", "whisper-", "tts-"];

/// Who carries a request. `of` names the provider a model ID belongs to, where Google's
/// models are `AiStudio`; `GoogleCloud` is the other way to the same models, taken when its
/// key is saved.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Provider {
    AiStudio,
    OpenRouter,
    GoogleCloud,
    OpenAi,
}
impl Provider {
    /// OpenRouter IDs name their vendor (`vendor/model`), OpenAI IDs begin with `gpt-`,
    /// `whisper-` or `tts-`, and every other ID is Google's.
    pub fn of(model: &str) -> Self {
        if model.contains('/') {
            Self::OpenRouter
        } else if OPENAI_PREFIXES
            .iter()
            .any(|prefix| model.starts_with(prefix))
        {
            Self::OpenAi
        } else {
            Self::AiStudio
        }
    }
    /// One of Google's two ways to its own models.
    pub fn google(self) -> bool {
        matches!(self, Self::AiStudio | Self::GoogleCloud)
    }
    pub fn key(self) -> &'static str {
        match self {
            Self::AiStudio => env::GEMINI,
            Self::OpenRouter => env::OPENROUTER,
            Self::GoogleCloud => env::GOOGLE_CLOUD,
            Self::OpenAi => env::OPENAI,
        }
    }
    pub fn label(self) -> &'static str {
        match self {
            Self::AiStudio => "Google AI Studio",
            Self::OpenRouter => "OpenRouter",
            Self::GoogleCloud => "Google Cloud",
            Self::OpenAi => "OpenAI",
        }
    }
}

/// Why an OpenAI model cannot speak or time a film (checked 2026-11-12).
pub fn openai_for_film(model: &str) -> anyhow::Error {
    anyhow!(
        "{model} is an OpenAI model. OpenAI only writes down dictations here: its speech models end on 2027-01-06, and only whisper-1, ending 2027-02-26, gives word timings. Use a Google or OpenRouter model for the film"
    )
}

/// Whether a way can be asked: its key is there, or for Google Cloud the user's Google sign-in
/// with a project to bill. The one answer Setup, the start page and every request share.
pub fn ready(
    keys: &Keys,
    sign_in: Option<&gauth::Adc>,
    place: &cloud::Place,
    route: Provider,
) -> bool {
    keys.get(route.key()).is_some()
        || (route == Provider::GoogleCloud && sign_in.is_some() && place.project.is_some())
}

/// The ways a dictation tries when the user chose no model, in order, with each one's model.
const DICTATION_ORDER: &[(Provider, &str)] = &[
    (Provider::GoogleCloud, DICTATION_GOOGLE),
    (Provider::AiStudio, DICTATION_GOOGLE),
    (Provider::OpenAi, DICTATION_OPENAI),
    (Provider::OpenRouter, DICTATION_OPENROUTER),
];

/// The dictation model when the user chose none: the first way that is ready.
pub fn usual_dictation(ready: impl Fn(Provider) -> bool) -> &'static str {
    DICTATION_ORDER
        .iter()
        .find(|(route, _)| ready(*route))
        .map_or(DICTATION_GOOGLE, |(_, model)| model)
}

/// The models a way is used with unless the user, a style or a film names others, by job
/// (`voice`, `timings`, `music`, `dictation`). OpenAI writes down dictations only.
pub fn usual_models(route: Provider) -> Vec<(&'static str, String)> {
    let on = |model: &str| Generators::model_on(route, model);
    let mut models = Vec::new();
    if route != Provider::OpenAi {
        models.push(("voice", on(AI_STUDIO.speech)));
        models.push(("timings", on(AI_STUDIO.transcription)));
        models.push(("music", on(AI_STUDIO.music)));
    }
    if let Some((_, model)) = DICTATION_ORDER.iter().find(|(way, _)| *way == route) {
        models.push(("dictation", on(model)));
    }
    models
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Word {
    pub text: String,
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transcript {
    pub model: String,
    /// Text of the timed pass.
    pub text: String,
    pub words: Vec<Word>,
    /// Text of a second pass biased to the terms, for providers that cannot combine
    /// a vocabulary with word timings.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub biased: Option<String>,
}

pub struct SpeechRequest<'a> {
    pub model: &'a str,
    pub voice: &'a str,
    pub style: Option<&'a str>,
    pub text: &'a str,
}

pub struct TranscribeRequest<'a> {
    pub model: &'a str,
    pub language: Option<&'a str>,
    pub terms: &'a [String],
}

/// What the user said, written out to be read: no fillers, no false starts.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Dictation {
    pub text: String,
    pub model: String,
    pub route: Provider,
}

pub struct Generated {
    pub bytes: Vec<u8>,
    pub cached: bool,
    /// The way that made it: another one than the model's own when that was at its limit.
    pub route: Provider,
}

/// The same model through OpenRouter, for when Google is at its daily limit.
pub fn openrouter_twin(model: &str) -> Option<String> {
    if Provider::of(model) != Provider::AiStudio {
        return None;
    }
    Some(if model.starts_with("lyria") {
        OPENROUTER.music.to_string()
    } else {
        format!("google/{model}")
    })
}

fn is_rate_limit(error: &anyhow::Error) -> bool {
    error.to_string().contains(" returned 429")
}

/// One HTTP client for the whole program, so its connections are reused.
fn client() -> Result<reqwest::Client> {
    static CLIENT: std::sync::OnceLock<reqwest::Client> = std::sync::OnceLock::new();
    if let Some(client) = CLIENT.get() {
        return Ok(client.clone());
    }
    let client = reqwest::Client::builder()
        .user_agent(concat!("superint-video/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(20))
        .build()?;
    Ok(CLIENT.get_or_init(|| client).clone())
}

/// Headers added to a request, such as who is asking.
pub(crate) fn with_headers(
    request: reqwest::RequestBuilder,
    headers: &[(&str, String)],
) -> reqwest::RequestBuilder {
    headers.iter().fold(request, |request, (name, value)| {
        request.header(*name, value)
    })
}

/// The `text` of a transcription answer.
fn text_of(value: &Value) -> String {
    value["text"]
        .as_str()
        .unwrap_or_default()
        .trim()
        .to_string()
}

pub struct Generators {
    http: reqwest::Client,
    pub keys: Keys,
    cache: Cache,
    /// Where requests to Google Cloud go.
    pub cloud: cloud::Place,
    /// The user's Google sign-in, used for Google Cloud when no key is saved.
    pub google: Option<gauth::Adc>,
    /// OpenAI's address for the region chosen in Setup.
    pub openai: &'static str,
    /// Ways and models (`route model`) at their limit in this run: the next requests skip them.
    limited: Mutex<BTreeSet<String>>,
}

impl Generators {
    pub fn new(keys: Keys, cache_dir: impl Into<PathBuf>) -> Result<Self> {
        Self::with(
            keys,
            cache_dir,
            &crate::home::Settings::current(),
            gauth::find(),
        )
    }

    /// `new` with the settings and the Google sign-in the caller has already read.
    pub fn with(
        keys: Keys,
        cache_dir: impl Into<PathBuf>,
        settings: &crate::home::Settings,
        google: Option<gauth::Adc>,
    ) -> Result<Self> {
        let cloud = cloud::Place::of(&keys, settings, google.as_ref());
        Ok(Self {
            http: client()?,
            keys,
            cache: Cache::new(cache_dir),
            cloud,
            google,
            openai: openai::base(settings.open_ai_region.as_deref()),
            limited: Mutex::new(BTreeSet::new()),
        })
    }

    /// Ways and models that were at their limit in this run.
    pub fn limited(&self) -> Vec<String> {
        self.limited
            .lock()
            .map(|set| set.iter().cloned().collect())
            .unwrap_or_default()
    }

    /// Whether a way can be asked (see `ready`).
    pub fn ready(&self, route: Provider) -> bool {
        ready(&self.keys, self.google.as_ref(), &self.cloud, route)
    }

    fn is_limited(&self, route: Provider, model: &str) -> bool {
        self.limited
            .lock()
            .is_ok_and(|set| set.contains(&format!("{route:?} {model}")))
    }

    /// The ways a model can go with the keys there are, best first: Google's models through
    /// Google Cloud, then AI Studio, then their twin on OpenRouter, without the ways that hit
    /// their limit in this run while another is left. Without a key, the model's own way,
    /// whose request then fails with the message that names the missing key.
    fn routes(&self, model: &str) -> Vec<Provider> {
        let provider = Provider::of(model);
        if !provider.google() {
            return vec![provider];
        }
        let mut routes: Vec<Provider> = [Provider::GoogleCloud, Provider::AiStudio]
            .into_iter()
            .filter(|&route| self.ready(route))
            .collect();
        if self.ready(Provider::OpenRouter) && openrouter_twin(model).is_some() {
            routes.push(Provider::OpenRouter);
        }
        let open: Vec<Provider> = routes
            .iter()
            .copied()
            .filter(|&route| !self.is_limited(route, model))
            .collect();
        match (open.is_empty(), routes.is_empty()) {
            (false, _) => open,
            (true, false) => routes,
            (true, true) => vec![Provider::AiStudio],
        }
    }

    /// The ways a model can go, each with the model's name there.
    fn ways(&self, model: &str) -> Vec<(Provider, String)> {
        self.routes(model)
            .into_iter()
            .map(|route| (route, Self::model_on(route, model)))
            .collect()
    }

    /// The model's ID on a way: its twin on OpenRouter, its Google Cloud name there.
    fn model_on(route: Provider, model: &str) -> String {
        match route {
            Provider::OpenRouter => openrouter_twin(model).unwrap_or_else(|| model.to_string()),
            Provider::GoogleCloud => cloud::model(model).to_string(),
            Provider::AiStudio | Provider::OpenAi => model.to_string(),
        }
    }

    /// The way that will carry this model with the keys there are, or the error that says
    /// which key is missing. Asked before any request, so a job fails before it costs anything.
    pub fn reachable(&self, model: &str) -> Result<Provider> {
        if Provider::of(model) == Provider::OpenAi {
            return Err(openai_for_film(model));
        }
        let route = self.routes(model)[0];
        if !self.ready(route) {
            self.keys.require(route.key())?;
        }
        Ok(route)
    }

    /// Asks each way in turn until one answers. A rate limit hands over to the next way and
    /// keeps the limited one out for the rest of this run; after the retries in `send`, a 429
    /// means the day's quota, so waiting would only stop the film. Any other error stops.
    async fn across<T, Fut>(
        &self,
        tries: Vec<(Provider, String)>,
        mut ask: impl FnMut(Provider, String) -> Fut,
    ) -> Result<(T, Provider, String)>
    where
        Fut: std::future::Future<Output = Result<T>>,
    {
        for (index, (route, model)) in tries.iter().enumerate() {
            match ask(*route, model.clone()).await {
                Ok(value) => return Ok((value, *route, model.clone())),
                Err(error) => match tries.get(index + 1) {
                    Some((next, other)) if is_rate_limit(&error) => {
                        if let Ok(mut set) = self.limited.lock()
                            && set.insert(format!("{route:?} {model}"))
                        {
                            eprintln!(
                                "{}: {model} is at its limit, using {other} through {} for the rest of this run",
                                route.label(),
                                next.label()
                            );
                        }
                    }
                    _ => return Err(error),
                },
            }
        }
        bail!("No way to reach the model")
    }

    /// A result cached under any of the model's names on its ways.
    fn cached<T>(model: &str, look: impl Fn(&str) -> Option<T>) -> Option<(T, Provider)> {
        let own = Provider::of(model);
        let mut names = vec![(own, model.to_string())];
        if own.google() {
            for route in [Provider::GoogleCloud, Provider::OpenRouter] {
                let name = Self::model_on(route, model);
                if names.iter().all(|(_, known)| *known != name) {
                    names.push((route, name));
                }
            }
        }
        names
            .into_iter()
            .find_map(|(route, name)| look(&name).map(|found| (found, route)))
    }

    pub fn speech_key(request: &SpeechRequest<'_>, take: u32) -> String {
        Cache::key(&json!({
            "job": "speech",
            "model": request.model,
            "voice": request.voice,
            "style": request.style,
            "text": request.text,
            "take": take,
        }))
    }

    pub fn is_cached(&self, key: &str) -> bool {
        self.cache.contains(key)
    }

    /// One take of Claude's text, sent unchanged. Different take numbers are separate requests.
    pub async fn speech(&self, request: &SpeechRequest<'_>, take: u32) -> Result<Generated> {
        let key = |model: &str| {
            let asked = SpeechRequest {
                model,
                voice: request.voice,
                style: request.style,
                text: request.text,
            };
            Self::speech_key(&asked, take)
        };
        if let Some((bytes, route)) =
            Self::cached(request.model, |name| self.cache.bytes(&key(name)))
        {
            return Ok(Generated {
                bytes,
                cached: true,
                route,
            });
        }
        if Provider::of(request.model) == Provider::OpenAi {
            return Err(openai_for_film(request.model));
        }
        let (bytes, route, model) = self
            .across(self.ways(request.model), |route, model| async move {
                let asked = SpeechRequest {
                    model: &model,
                    voice: request.voice,
                    style: request.style,
                    text: request.text,
                };
                match route {
                    Provider::GoogleCloud => cloud::speech(self, &asked).await,
                    Provider::AiStudio => aistudio::speech(self, &asked).await,
                    _ => openrouter::speech(self, &asked).await,
                }
            })
            .await?;
        self.cache.put_bytes(&key(&model), &bytes)?;
        Ok(Generated {
            bytes,
            cached: false,
            route,
        })
    }

    pub async fn transcribe(
        &self,
        audio: &Path,
        request: &TranscribeRequest<'_>,
    ) -> Result<(Transcript, bool)> {
        let bytes = std::fs::read(audio)?;
        // The audio is hashed once for every name the transcript may be cached under.
        let digest = hex::encode(Sha256::digest(&bytes));
        let key = |model: &str| {
            let asked = TranscribeRequest {
                model,
                language: request.language,
                terms: request.terms,
            };
            Self::transcribe_key(&asked, &digest)
        };
        if let Some((transcript, _)) =
            Self::cached(request.model, |name| self.cache.json(&key(name)))
        {
            return Ok((transcript, true));
        }
        if Provider::of(request.model) == Provider::OpenAi {
            return Err(openai_for_film(request.model));
        }
        let bytes = &bytes;
        let (transcript, _, model) = self
            .across(self.ways(request.model), |route, model| async move {
                let asked = TranscribeRequest {
                    model: &model,
                    language: request.language,
                    terms: request.terms,
                };
                match route {
                    Provider::GoogleCloud => cloud::transcribe(self, audio, &asked).await,
                    Provider::AiStudio => {
                        aistudio::transcribe(self, audio, bytes.to_vec(), &asked).await
                    }
                    _ => openrouter::transcribe(self, audio, &asked).await,
                }
            })
            .await?;
        self.cache.put_json(&key(&model), &transcript)?;
        Ok((transcript, false))
    }

    /// The cache key of a transcript: the request and the SHA-256 of the audio, in hex.
    fn transcribe_key(request: &TranscribeRequest<'_>, digest: &str) -> String {
        Cache::key(&json!({
            "job": "transcribe",
            "model": request.model,
            "language": request.language,
            "terms": request.terms,
            "audio": digest,
        }))
    }

    /// The first transcript any of the models can give: a cached one from any model first,
    /// then each model in order, so a fallback steps in when the first hits a rate limit.
    pub async fn transcribe_first(
        &self,
        audio: &Path,
        requests: &[TranscribeRequest<'_>],
    ) -> Result<(Transcript, bool)> {
        let digest = hex::encode(Sha256::digest(std::fs::read(audio)?));
        for request in requests {
            if let Some(transcript) = self.cache.json(&Self::transcribe_key(request, &digest)) {
                return Ok((transcript, true));
            }
        }
        let mut failure = anyhow!("No transcription model given");
        for request in requests {
            match self.transcribe(audio, request).await {
                Ok(result) => return Ok(result),
                Err(error) => {
                    eprintln!("transcribe: {} failed: {error:#}", request.model);
                    failure = error;
                }
            }
        }
        Err(failure)
    }

    /// The ways a dictation goes, best first, each with its model: the user's model on its
    /// ways, else the usual model of each way that is ready (`DICTATION_ORDER`).
    pub fn dictation_tries(&self, chosen: Option<&str>) -> Vec<(Provider, String)> {
        if let Some(model) = chosen {
            return self.ways(model);
        }
        let tries: Vec<(Provider, String)> = DICTATION_ORDER
            .iter()
            .filter(|(route, _)| self.ready(*route))
            .map(|(route, model)| (*route, Self::model_on(*route, model)))
            .collect();
        if tries.is_empty() {
            return vec![(Provider::AiStudio, DICTATION_GOOGLE.into())];
        }
        tries
    }

    /// Writes down a recording of the user, a WAV file. A rate limit hands over to the next
    /// way, as for a film. Each provider has its own model, because a dictation is only text
    /// and any transcription model will do. Nothing is cached: no two dictations are the same.
    pub async fn dictate(&self, wav: &[u8], chosen: Option<&str>) -> Result<Dictation> {
        let (text, route, model) = self
            .across(self.dictation_tries(chosen), |route, model| async move {
                match route {
                    Provider::GoogleCloud => cloud::dictate(self, wav, &model).await,
                    Provider::AiStudio => aistudio::dictate(self, wav.to_vec(), &model).await,
                    Provider::OpenAi => openai::dictate(self, wav, &model).await,
                    Provider::OpenRouter => openrouter::dictate(self, wav, &model).await,
                }
            })
            .await?;
        Ok(Dictation { text, model, route })
    }

    pub fn music_key(model: &str, prompt: &str, variant: u32) -> String {
        Cache::key(&json!({"job": "music", "model": model, "prompt": prompt, "variant": variant}))
    }

    /// One variant of Claude's music prompt, sent unchanged.
    pub async fn music(&self, model: &str, prompt: &str, variant: u32) -> Result<Generated> {
        let key = |name: &str| Self::music_key(name, prompt, variant);
        if let Some((bytes, route)) = Self::cached(model, |name| self.cache.bytes(&key(name))) {
            return Ok(Generated {
                bytes,
                cached: true,
                route,
            });
        }
        if Provider::of(model) == Provider::OpenAi {
            return Err(openai_for_film(model));
        }
        let (bytes, route, name) = self
            .across(self.ways(model), |route, name| async move {
                match route {
                    Provider::GoogleCloud => cloud::music(self, &name, prompt).await,
                    Provider::AiStudio => aistudio::music(self, &name, prompt).await,
                    _ => openrouter::music(self, &name, prompt).await,
                }
            })
            .await?;
        self.cache.put_bytes(&key(&name), &bytes)?;
        Ok(Generated {
            bytes,
            cached: false,
            route,
        })
    }

    /// Whether a key sees a model, by a lookup: 200 yes, 404 no, anything else the provider's
    /// answer as the error.
    pub(crate) async fn probe(
        &self,
        provider: Provider,
        request: reqwest::RequestBuilder,
    ) -> Result<bool> {
        let response = request
            .timeout(Duration::from_secs(20))
            .send()
            .await
            .map_err(|e| self.transport(e))?;
        match response.status().as_u16() {
            200 => Ok(true),
            404 => Ok(false),
            _ => Err(self.failure(provider, response).await),
        }
    }

    /// Sends with up to three retries on rate limits, server errors and dropped connections.
    pub(crate) async fn send(
        &self,
        provider: Provider,
        make: impl Fn() -> reqwest::RequestBuilder,
    ) -> Result<reqwest::Response> {
        let mut delay = Duration::from_secs(2);
        for attempt in 0..4 {
            let last = attempt == 3;
            match make().send().await {
                Ok(response) if response.status().is_success() => return Ok(response),
                Ok(response) => {
                    let status = response.status();
                    let retry = status.as_u16() == 429 || status.is_server_error();
                    if !retry || last {
                        return Err(self.failure(provider, response).await);
                    }
                    let retry_after = response
                        .headers()
                        .get("retry-after")
                        .and_then(|v| v.to_str().ok())
                        .and_then(|v| v.parse::<u64>().ok());
                    if let Some(seconds) = retry_after {
                        // A daily quota does not clear within a retry.
                        if seconds > 300 {
                            return Err(self.failure(provider, response).await);
                        }
                        delay = Duration::from_secs(seconds.clamp(1, 60));
                    }
                    eprintln!(
                        "{}: {status}, retrying in {} s",
                        provider.label(),
                        delay.as_secs()
                    );
                }
                Err(error) if !last && (error.is_timeout() || error.is_connect()) => {
                    eprintln!(
                        "{}: {}, retrying in {} s",
                        provider.label(),
                        self.transport(error),
                        delay.as_secs()
                    );
                }
                Err(error) => return Err(self.transport(error)),
            }
            tokio::time::sleep(delay).await;
            delay *= 2;
        }
        unreachable!("the last attempt returns")
    }

    /// Transport errors without the URL, with any key value removed.
    pub(crate) fn transport(&self, error: reqwest::Error) -> anyhow::Error {
        anyhow!(self.keys.redact(&error.without_url().to_string()))
    }

    pub(crate) async fn failure(
        &self,
        provider: Provider,
        response: reqwest::Response,
    ) -> anyhow::Error {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let message = serde_json::from_str::<Value>(&body)
            .ok()
            .and_then(|value| {
                value["error"]["message"]
                    .as_str()
                    .or(value["error"].as_str())
                    .or(value["message"].as_str())
                    .map(str::to_string)
            })
            .unwrap_or(body);
        let message: String = message.chars().take(1500).collect();
        anyhow!(
            "{} returned {status}: {}",
            provider.label(),
            self.keys.redact(message.trim())
        )
    }
}

/// Keys (names only) and, with `online`, which models each key can reach, with live
/// OpenRouter prices, and the models the user chose in Setup. Returns the report and whether
/// every check that ran passed.
pub async fn doctor(start: &Path, online: bool) -> Result<(Value, bool)> {
    let keys = Keys::load(start)?;
    let file = keys.file.as_ref().map(|p| p.display().to_string());
    let status = keys.status();
    let settings = crate::home::Settings::current();
    let generators = Generators::new(keys, std::env::temp_dir().join("superint-video-doctor"))?;
    let mut ok = true;
    let mut routes = Vec::new();
    let catalog = if online {
        openrouter::catalog(&generators)
            .await
            .map_err(|e| e.to_string())
    } else {
        Err("offline".into())
    };
    let ways = [
        (
            "aiStudio",
            Provider::AiStudio,
            vec![AI_STUDIO.speech, AI_STUDIO.transcription, AI_STUDIO.music],
            AI_STUDIO.voice,
        ),
        (
            "googleCloud",
            Provider::GoogleCloud,
            vec![
                AI_STUDIO.speech,
                AI_STUDIO.transcription,
                cloud::model(AI_STUDIO.music),
            ],
            AI_STUDIO.voice,
        ),
        (
            "openRouter",
            Provider::OpenRouter,
            vec![
                OPENROUTER.speech,
                OPENROUTER.transcription,
                OPENROUTER.music,
            ],
            OPENROUTER.voice,
        ),
        ("openAi", Provider::OpenAi, vec![DICTATION_OPENAI], ""),
    ];
    for (name, provider, models, voice) in ways {
        let present = generators.ready(provider);
        let mut entries = Vec::new();
        for model in models {
            let mut entry = json!({"model": model});
            if online && present {
                let seen = match provider {
                    Provider::AiStudio => Some(aistudio::visible(&generators, model).await),
                    // Lyria answers on the Interactions API only, which has no free probe.
                    Provider::GoogleCloud if model.starts_with("lyria") => None,
                    Provider::GoogleCloud => Some(cloud::visible(&generators, model).await),
                    Provider::OpenAi => Some(openai::visible(&generators, model).await),
                    Provider::OpenRouter => {
                        if let Ok(catalog) = &catalog {
                            let found = catalog.iter().find(|m| m["id"] == model);
                            ok &= found.is_some();
                            entry["listed"] = json!(found.is_some());
                            if let Some(found) = found {
                                entry["pricing"] = found["pricing"].clone();
                            }
                        }
                        None
                    }
                };
                match seen {
                    Some(Ok(visible)) => {
                        ok &= visible;
                        entry["visible"] = json!(visible);
                    }
                    Some(Err(error)) => {
                        ok = false;
                        entry["error"] = json!(error.to_string());
                    }
                    None => {}
                }
            }
            entries.push(entry);
        }
        let mut report = json!({
            "route": name,
            "provider": provider,
            "key": provider.key(),
            "keyPresent": present,
            "models": entries,
        });
        if !voice.is_empty() {
            report["voice"] = json!(voice);
        }
        match provider {
            Provider::OpenAi => {
                report["use"] = json!("dictation only");
                report["base"] = json!(generators.openai);
            }
            Provider::GoogleCloud => {
                report["place"] = json!(generators.cloud);
                report["servedIn"] = json!(generators.cloud.served_in());
                report["auth"] = json!(if generators.keys.get(env::GOOGLE_CLOUD).is_some() {
                    "apiKey"
                } else if generators.google.is_some() {
                    "googleSignIn"
                } else {
                    "none"
                });
            }
            _ => {}
        }
        if online && present && provider == Provider::OpenRouter {
            report["credits"] = match openrouter::credits(&generators).await {
                Ok(credits) => credits,
                Err(error) => {
                    ok = false;
                    json!({"error": error.to_string()})
                }
            };
        }
        routes.push(report);
    }
    if let Err(error) = &catalog
        && online
    {
        ok = false;
        routes.push(json!({"catalogError": error}));
    }
    Ok((
        json!({
            "envFile": file,
            "keyStore": generators.keys.store,
            "setup": "The user adds or replaces keys in the app: `superint-video app`, Setup.",
            "keys": status,
            "online": online,
            "routes": routes,
            "default": "aiStudio",
            "google": "Google's models (gemini-…, lyria-…) go through Google Cloud when GOOGLE_CLOUD_API_KEY is there, else AI Studio, else their twin on OpenRouter",
            "chosen": settings.models(),
        }),
        ok,
    ))
}

/// Asks the provider whether a saved key works, for the `Check` button in Setup. The answer
/// is facts, not a sentence: the page words it in its own language.
/// `state`: `none` (no key), `works`, `partial` (works, but the `missing` models are out of
/// reach) or `refused` (with the provider's answer as `detail`).
/// The models are those the key serves, with the dictation model the user chose when it is
/// one of this key's.
pub async fn try_key(start: &Path, name: &str, dictation: Option<&str>) -> Result<Value> {
    let keys = Keys::load(start)?;
    // Google Cloud is reached with the user's Google sign-in as well as with a key.
    let signed_in = name == env::GOOGLE_CLOUD && gauth::find().is_some();
    if keys.get(name).is_none() && !signed_in {
        return Ok(json!({"ok": false, "state": "none"}));
    }
    let generators = Generators::new(keys, std::env::temp_dir().join("superint-video-doctor"))?;
    let refused = |error: anyhow::Error| json!({"ok": false, "state": "refused", "detail": error.to_string()});
    let dictation_of = |provider: Provider, usual: &'static str| -> String {
        dictation
            .filter(|model| Provider::of(model) == provider)
            .unwrap_or(usual)
            .to_string()
    };
    let checked = |missing: Vec<String>| {
        if missing.is_empty() {
            json!({"ok": true, "state": "works"})
        } else {
            json!({"ok": true, "state": "partial", "missing": missing})
        }
    };
    if name == env::OPENROUTER {
        let credits = match openrouter::credits(&generators).await {
            Ok(credits) => credits,
            Err(error) => return Ok(refused(error)),
        };
        // The catalog is public: a model it does not list cannot be reached with any key.
        // When the catalog cannot be read, the key still works and the model is not judged.
        let model = dictation_of(Provider::OpenRouter, DICTATION_OPENROUTER);
        let listed = match openrouter::catalog(&generators).await {
            Ok(catalog) => catalog.iter().any(|m| m["id"] == model.as_str()),
            Err(_) => true,
        };
        let mut answer = json!({
            "ok": true,
            "state": if listed { "works" } else { "partial" },
            "creditLeft": credits["limitRemaining"].as_f64(),
        });
        if !listed {
            answer["missing"] = json!([model]);
        }
        return Ok(answer);
    }
    if name == env::OPENAI {
        let model = dictation_of(Provider::OpenAi, DICTATION_OPENAI);
        return Ok(match openai::visible(&generators, &model).await {
            Ok(true) => checked(Vec::new()),
            Ok(false) => checked(vec![model]),
            Err(error) => refused(error),
        });
    }
    let cloud = name == env::GOOGLE_CLOUD;
    let mut models = vec![
        AI_STUDIO.speech.to_string(),
        AI_STUDIO.transcription.to_string(),
    ];
    // Lyria on Google Cloud answers on the Interactions API only, which has no free probe.
    if !cloud {
        models.push(AI_STUDIO.music.to_string());
    }
    let own = dictation_of(Provider::AiStudio, DICTATION_GOOGLE);
    if !models.contains(&own) {
        models.push(own);
    }
    let mut missing = Vec::new();
    for model in models {
        let seen = if cloud {
            cloud::visible(&generators, &model).await
        } else {
            aistudio::visible(&generators, &model).await
        };
        match seen {
            Ok(true) => {}
            Ok(false) => missing.push(model),
            Err(error) => return Ok(refused(error)),
        }
    }
    Ok(checked(missing))
}

/// How long a WAV file plays, or why it is not one the start page could have recorded.
pub fn wav_seconds(bytes: &[u8]) -> Result<f64> {
    let reader = hound::WavReader::new(std::io::Cursor::new(bytes))
        .map_err(|_| anyhow!("The recording is not a WAV file"))?;
    let spec = reader.spec();
    if spec.sample_rate == 0 || spec.channels == 0 {
        return Err(anyhow!("The recording has no sound"));
    }
    Ok(f64::from(reader.duration()) / f64::from(spec.sample_rate))
}

/// File type from the first bytes; generators do not always say what they return.
pub fn sniff(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(b"RIFF") {
        "wav"
    } else if bytes.starts_with(b"ID3")
        || (bytes.len() > 1 && bytes[0] == 0xFF && bytes[1] & 0xE0 == 0xE0)
    {
        "mp3"
    } else if bytes.starts_with(b"fLaC") {
        "flac"
    } else if bytes.starts_with(b"OggS") {
        "ogg"
    } else {
        "bin"
    }
}

pub fn mime(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("wav") => "audio/wav",
        Some("mp3") => "audio/mp3",
        Some("flac") => "audio/flac",
        Some("ogg") => "audio/ogg",
        Some("m4a") => "audio/m4a",
        Some("aac") => "audio/aac",
        Some("webm") => "audio/webm",
        _ => "application/octet-stream",
    }
}

/// Wraps headerless 16-bit little-endian PCM in a WAV header.
pub fn pcm_wav(pcm: &[u8], rate: u32, channels: u16) -> Vec<u8> {
    let block = channels * 2;
    let mut wav = Vec::with_capacity(44 + pcm.len());
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&(36 + pcm.len() as u32).to_le_bytes());
    wav.extend_from_slice(b"WAVEfmt ");
    wav.extend_from_slice(&16u32.to_le_bytes());
    wav.extend_from_slice(&1u16.to_le_bytes());
    wav.extend_from_slice(&channels.to_le_bytes());
    wav.extend_from_slice(&rate.to_le_bytes());
    wav.extend_from_slice(&(rate * u32::from(block)).to_le_bytes());
    wav.extend_from_slice(&block.to_le_bytes());
    wav.extend_from_slice(&16u16.to_le_bytes());
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&(pcm.len() as u32).to_le_bytes());
    wav.extend_from_slice(pcm);
    wav
}

/// BCP-47 tag for Gemini (`de` → `de-DE`); tags with a region pass through.
pub fn language_tag(language: &str) -> String {
    let language = language.trim();
    if language.contains(['-', '_']) {
        return language.replace('_', "-");
    }
    let region = match language.to_ascii_lowercase().as_str() {
        "de" => "DE",
        "en" => "US",
        "fr" => "FR",
        "es" => "ES",
        "it" => "IT",
        "nl" => "NL",
        "pt" => "BR",
        "pl" => "PL",
        "ja" => "JP",
        _ => return language.to_string(),
    };
    format!("{}-{region}", language.to_ascii_lowercase())
}

/// ISO 639-1 code for OpenRouter (`de-DE` → `de`).
pub fn language_code(language: &str) -> String {
    language
        .split(['-', '_'])
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn providers_follow_model_ids() {
        assert_eq!(Provider::of(AI_STUDIO.speech), Provider::AiStudio);
        assert_eq!(Provider::of(AI_STUDIO.transcription), Provider::AiStudio);
        assert_eq!(Provider::of(AI_STUDIO.music), Provider::AiStudio);
        assert_eq!(Provider::of(OPENROUTER.speech), Provider::OpenRouter);
        assert_eq!(Provider::of(OPENROUTER.transcription), Provider::OpenRouter);
        assert_eq!(Provider::of(OPENROUTER.music), Provider::OpenRouter);
    }

    #[test]
    fn language_tags() {
        assert_eq!(language_tag("de"), "de-DE");
        assert_eq!(language_tag("de-AT"), "de-AT");
        assert_eq!(language_tag("en_GB"), "en-GB");
        assert_eq!(language_code("de-DE"), "de");
    }

    #[test]
    fn sniffs_and_wraps_audio() {
        let wav = pcm_wav(&[0, 0, 1, 0], 24_000, 1);
        assert_eq!(sniff(&wav), "wav");
        assert_eq!(wav.len(), 48);
        let reader = hound::WavReader::new(std::io::Cursor::new(wav)).unwrap();
        assert_eq!(reader.spec().sample_rate, 24_000);
        assert_eq!(reader.len(), 2);
        assert_eq!(sniff(b"ID3\x04"), "mp3");
        assert_eq!(sniff(&[0xFF, 0xFB, 0x90]), "mp3");
        assert_eq!(sniff(b"{\"error\""), "bin");
    }

    #[test]
    fn a_dictation_is_a_wav_file_of_some_length() {
        let wav = pcm_wav(&vec![0; 32_000], 16_000, 1);
        assert_eq!(wav_seconds(&wav).unwrap(), 1.0);
        assert!(wav_seconds(b"OggS not a wav").is_err());
        assert_eq!(Provider::of(DICTATION_GOOGLE), Provider::AiStudio);
        assert_eq!(Provider::of(DICTATION_OPENAI), Provider::OpenAi);
        assert_eq!(Provider::of(DICTATION_OPENROUTER), Provider::OpenRouter);
    }

    #[test]
    fn openai_ids_are_told_apart_from_google_and_openrouter_ones() {
        for model in ["gpt-transcribe", "whisper-1", "tts-1-hd", "gpt-4o-mini-tts"] {
            assert_eq!(Provider::of(model), Provider::OpenAi, "{model}");
        }
        for model in ["gemini-3.5-transcribe", "lyria-3.5", "gemma-4"] {
            assert_eq!(Provider::of(model), Provider::AiStudio, "{model}");
        }
        assert_eq!(Provider::of("openai/gpt-transcribe"), Provider::OpenRouter);
        assert!(Provider::GoogleCloud.google() && Provider::AiStudio.google());
        assert!(!Provider::OpenAi.google());
        assert_eq!(openrouter_twin("gpt-transcribe"), None);
    }
}

#[cfg(test)]
mod twin_tests {
    use super::*;

    #[test]
    fn every_ai_studio_model_has_its_twin_on_openrouter() {
        assert_eq!(
            openrouter_twin("gemini-3.8-flash-tts").as_deref(),
            Some("google/gemini-3.8-flash-tts")
        );
        assert_eq!(
            openrouter_twin("gemini-3.5-transcribe").as_deref(),
            Some("google/gemini-3.5-transcribe")
        );
        assert_eq!(
            openrouter_twin("lyria-3.5").as_deref(),
            Some(OPENROUTER.music)
        );
        assert_eq!(openrouter_twin("elevenlabs/eleven-v4-turbo"), None);
    }

    #[test]
    fn one_key_is_enough_for_the_default_models() {
        let home = tempfile::TempDir::new().unwrap();
        let project = tempfile::TempDir::new().unwrap();
        std::fs::write(project.path().join(".env"), "").unwrap();
        let with = |name: Option<&str>| {
            let store = crate::home::KeyStore::at(home.path());
            for known in env::KNOWN {
                store.remove(known).unwrap();
            }
            if let Some(name) = name {
                store.set(name, "a-key-for-this-test-01").unwrap();
            }
            let keys = Keys::load_with(project.path(), Some(home.path())).unwrap();
            let mut generators = Generators::new(keys, home.path().join("cache")).unwrap();
            // A Google sign-in on this machine would stand in for a key.
            generators.google = None;
            generators
        };
        // Variables on this machine would stand in for the store.
        if env::KNOWN
            .iter()
            .any(|name| std::env::var_os(name).is_some())
            || std::env::var_os("GOOGLE_API_KEY").is_some()
            || std::env::var_os("SUPERINT_ENV").is_some()
        {
            return;
        }
        let only_openrouter = with(Some(env::OPENROUTER));
        assert_eq!(
            only_openrouter.reachable(AI_STUDIO.speech).unwrap(),
            Provider::OpenRouter
        );
        assert_eq!(
            only_openrouter.routes(AI_STUDIO.speech),
            [Provider::OpenRouter]
        );
        let only_google = with(Some(env::GEMINI));
        assert_eq!(
            only_google.reachable(AI_STUDIO.music).unwrap(),
            Provider::AiStudio
        );
        assert!(only_google.reachable(OPENROUTER.speech).is_err());
        let only_cloud = with(Some(env::GOOGLE_CLOUD));
        assert_eq!(
            only_cloud.reachable(AI_STUDIO.speech).unwrap(),
            Provider::GoogleCloud
        );
        assert_eq!(
            only_cloud.dictation_tries(None),
            [(Provider::GoogleCloud, DICTATION_GOOGLE.to_string())]
        );
        let only_openai = with(Some(env::OPENAI));
        // OpenAI writes down dictations, but a film needs another key.
        assert!(only_openai.reachable(AI_STUDIO.speech).is_err());
        assert!(
            only_openai
                .reachable("gpt-4o-mini-tts")
                .unwrap_err()
                .to_string()
                .contains("dictations")
        );
        assert_eq!(
            only_openai.dictation_tries(None),
            [(Provider::OpenAi, DICTATION_OPENAI.to_string())]
        );
        let none = with(None);
        let message = none.reachable(AI_STUDIO.speech).unwrap_err().to_string();
        assert!(message.contains(env::GEMINI) && message.contains("Setup"));
        assert_eq!(none.routes(AI_STUDIO.speech), [Provider::AiStudio]);
    }

    #[test]
    fn google_cloud_goes_first_and_a_limit_hands_over() {
        let home = tempfile::TempDir::new().unwrap();
        let project = tempfile::TempDir::new().unwrap();
        std::fs::write(project.path().join(".env"), "").unwrap();
        if env::KNOWN
            .iter()
            .any(|name| std::env::var_os(name).is_some())
            || std::env::var_os("GOOGLE_API_KEY").is_some()
            || std::env::var_os("SUPERINT_ENV").is_some()
        {
            return;
        }
        let store = crate::home::KeyStore::at(home.path());
        for name in env::KNOWN {
            store.set(name, "a-key-for-this-test-02").unwrap();
        }
        let keys = Keys::load_with(project.path(), Some(home.path())).unwrap();
        let mut all = Generators::new(keys, home.path().join("cache")).unwrap();
        all.google = None;
        assert_eq!(
            all.routes(AI_STUDIO.music),
            [
                Provider::GoogleCloud,
                Provider::AiStudio,
                Provider::OpenRouter
            ]
        );
        assert_eq!(
            Generators::model_on(Provider::GoogleCloud, AI_STUDIO.music),
            "lyria-3-pro-preview"
        );
        assert_eq!(
            Generators::model_on(Provider::OpenRouter, AI_STUDIO.speech),
            "google/gemini-3.8-flash-tts"
        );
        // A limit hands over to the next way and keeps the limited one out of this run.
        let runtime = tokio::runtime::Runtime::new().unwrap();
        let (model, route, _) = runtime
            .block_on(
                all.across(all.ways(AI_STUDIO.speech), |route, model| async move {
                    if route == Provider::GoogleCloud {
                        Err(anyhow!(
                            "Google Cloud returned 429 Too Many Requests: quota"
                        ))
                    } else {
                        Ok(model)
                    }
                }),
            )
            .unwrap();
        assert_eq!(
            (route, model.as_str()),
            (Provider::AiStudio, AI_STUDIO.speech)
        );
        assert_eq!(
            all.routes(AI_STUDIO.speech),
            [Provider::AiStudio, Provider::OpenRouter]
        );
        // Without a way left, a limit stays the error it is.
        let last = runtime.block_on(
            all.across(vec![(Provider::OpenRouter, "x".into())], |_, _| async {
                Err::<(), _>(anyhow!("OpenRouter returned 429 Too Many Requests"))
            }),
        );
        assert!(last.is_err());
        // The user's dictation model goes its own ways; without one, every provider in turn.
        let tries: Vec<Provider> = all.dictation_tries(None).into_iter().map(|t| t.0).collect();
        assert_eq!(
            tries,
            [
                Provider::GoogleCloud,
                Provider::AiStudio,
                Provider::OpenAi,
                Provider::OpenRouter
            ]
        );
        assert_eq!(
            all.dictation_tries(Some("gpt-transcribe")),
            [(Provider::OpenAi, "gpt-transcribe".to_string())]
        );
        // A cached result counts under any of the model's names.
        assert_eq!(
            Generators::cached(AI_STUDIO.music, |name| {
                (name == "google/lyria-3-pro-preview").then_some(1)
            }),
            Some((1, Provider::OpenRouter))
        );
    }

    #[test]
    fn a_google_sign_in_with_a_project_reaches_google_cloud() {
        let home = tempfile::TempDir::new().unwrap();
        let project = tempfile::TempDir::new().unwrap();
        std::fs::write(project.path().join(".env"), "").unwrap();
        if env::KNOWN
            .iter()
            .any(|name| std::env::var_os(name).is_some())
            || std::env::var_os("GOOGLE_API_KEY").is_some()
            || std::env::var_os("SUPERINT_ENV").is_some()
        {
            return;
        }
        let keys = Keys::load_with(project.path(), Some(home.path())).unwrap();
        let mut signed = Generators::new(keys, home.path().join("cache")).unwrap();
        signed.google = Some(gauth::Adc {
            file: home.path().join("adc.json"),
            kind: "authorized_user".into(),
            quota_project: None,
        });
        signed.cloud.project = None;
        // Without a project the sign-in cannot be billed: the missing key is named.
        assert!(!signed.ready(Provider::GoogleCloud));
        assert!(signed.reachable(AI_STUDIO.speech).is_err());
        signed.cloud.project = Some("my-films-123".into());
        assert!(signed.ready(Provider::GoogleCloud));
        assert_eq!(
            signed.reachable(AI_STUDIO.speech).unwrap(),
            Provider::GoogleCloud
        );
        assert_eq!(signed.dictation_tries(None)[0].0, Provider::GoogleCloud);
    }

    #[test]
    fn only_a_429_counts_as_the_limit() {
        assert!(is_rate_limit(&anyhow!(
            "Google AI Studio returned 429 Too Many Requests: quota"
        )));
        assert!(!is_rate_limit(&anyhow!(
            "Google AI Studio returned 400 Bad Request: no"
        )));
    }
}
