//! Media generators behind Google AI Studio and OpenRouter. Claude writes every text and prompt;
//! these calls send it unchanged and add only the transport fields each API needs.
pub mod aistudio;
pub mod cache;
pub mod openrouter;

use crate::env::{self, Keys};
use anyhow::{Result, anyhow};
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Provider {
    AiStudio,
    OpenRouter,
}
impl Provider {
    /// OpenRouter IDs name their vendor (`vendor/model`); AI Studio IDs do not.
    pub fn of(model: &str) -> Self {
        if model.contains('/') {
            Self::OpenRouter
        } else {
            Self::AiStudio
        }
    }
    pub fn key(self) -> &'static str {
        match self {
            Self::AiStudio => env::GEMINI,
            Self::OpenRouter => env::OPENROUTER,
        }
    }
    pub fn label(self) -> &'static str {
        match self {
            Self::AiStudio => "Google AI Studio",
            Self::OpenRouter => "OpenRouter",
        }
    }
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

pub struct Generated {
    pub bytes: Vec<u8>,
    pub cached: bool,
    /// The route that made it. OpenRouter for an AI Studio model that was at its limit.
    pub route: Provider,
}

/// The same model through OpenRouter, for when AI Studio is at its daily limit.
pub fn openrouter_twin(model: &str) -> Option<String> {
    if Provider::of(model) == Provider::OpenRouter {
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

pub struct Generators {
    http: reqwest::Client,
    pub keys: Keys,
    cache: Cache,
    /// AI Studio models that hit their limit in this run: The next requests skip AI Studio.
    limited: Mutex<BTreeSet<String>>,
}

impl Generators {
    pub fn new(keys: Keys, cache_dir: impl Into<PathBuf>) -> Result<Self> {
        let http = reqwest::Client::builder()
            .user_agent(concat!("superint-video/", env!("CARGO_PKG_VERSION")))
            .connect_timeout(Duration::from_secs(20))
            .build()?;
        Ok(Self {
            http,
            keys,
            cache: Cache::new(cache_dir),
            limited: Mutex::new(BTreeSet::new()),
        })
    }

    /// AI Studio models that were at their limit in this run.
    pub fn limited(&self) -> Vec<String> {
        self.limited
            .lock()
            .map(|set| set.iter().cloned().collect())
            .unwrap_or_default()
    }

    /// Whether to ask AI Studio at all: only for its own models, not once they hit the limit,
    /// and not without its key when OpenRouter's key can reach the same model.
    fn try_ai_studio(&self, model: &str) -> bool {
        Provider::of(model) == Provider::AiStudio
            && !self.limited.lock().is_ok_and(|set| set.contains(model))
            && (self.keys.get(env::GEMINI).is_some() || self.keys.get(env::OPENROUTER).is_none())
    }

    /// The route that will carry this model with the keys there are, or the error that says
    /// which key is missing. Asked before any request, so a job fails before it costs anything.
    pub fn reachable(&self, model: &str) -> Result<Provider> {
        let provider = Provider::of(model);
        if self.keys.get(provider.key()).is_some() {
            return Ok(provider);
        }
        if openrouter_twin(model).is_some() && self.keys.get(env::OPENROUTER).is_some() {
            return Ok(Provider::OpenRouter);
        }
        self.keys.require(provider.key())?;
        Ok(provider)
    }

    /// True when the failure was AI Studio's rate limit and OpenRouter can step in. After the
    /// retries in `send`, a 429 means the day's quota, so waiting would only stop the film.
    fn switch_after(&self, model: &str, error: &anyhow::Error) -> bool {
        if !is_rate_limit(error) || self.keys.get(env::OPENROUTER).is_none() {
            return false;
        }
        let Some(twin) = openrouter_twin(model) else {
            return false;
        };
        if let Ok(mut set) = self.limited.lock()
            && set.insert(model.to_string())
        {
            eprintln!(
                "Google AI Studio: {model} is at its limit, using {twin} through OpenRouter for the rest of this run"
            );
        }
        true
    }

    /// The model to ask on OpenRouter: the given one, or the AI Studio model's twin.
    fn on_openrouter(model: &str) -> String {
        openrouter_twin(model).unwrap_or_else(|| model.to_string())
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
        let key = Self::speech_key(request, take);
        if let Some(bytes) = self.cache.bytes(&key) {
            return Ok(Generated {
                bytes,
                cached: true,
                route: Provider::of(request.model),
            });
        }
        let model = Self::on_openrouter(request.model);
        let elsewhere = SpeechRequest {
            model: &model,
            voice: request.voice,
            style: request.style,
            text: request.text,
        };
        let elsewhere_key = Self::speech_key(&elsewhere, take);
        if let Some(bytes) = self.cache.bytes(&elsewhere_key) {
            return Ok(Generated {
                bytes,
                cached: true,
                route: Provider::OpenRouter,
            });
        }
        if self.try_ai_studio(request.model) {
            match aistudio::speech(self, request).await {
                Ok(bytes) => {
                    self.cache.put_bytes(&key, &bytes)?;
                    return Ok(Generated {
                        bytes,
                        cached: false,
                        route: Provider::AiStudio,
                    });
                }
                Err(error) if !self.switch_after(request.model, &error) => return Err(error),
                Err(_) => {}
            }
        }
        let bytes = openrouter::speech(self, &elsewhere).await?;
        self.cache.put_bytes(&elsewhere_key, &bytes)?;
        Ok(Generated {
            bytes,
            cached: false,
            route: Provider::OpenRouter,
        })
    }

    pub async fn transcribe(
        &self,
        audio: &Path,
        request: &TranscribeRequest<'_>,
    ) -> Result<(Transcript, bool)> {
        let bytes = std::fs::read(audio)?;
        let key = Self::transcribe_key(request, &bytes);
        if let Some(transcript) = self.cache.json(&key) {
            return Ok((transcript, true));
        }
        let model = Self::on_openrouter(request.model);
        let elsewhere = TranscribeRequest {
            model: &model,
            language: request.language,
            terms: request.terms,
        };
        let elsewhere_key = Self::transcribe_key(&elsewhere, &bytes);
        if let Some(transcript) = self.cache.json(&elsewhere_key) {
            return Ok((transcript, true));
        }
        if self.try_ai_studio(request.model) {
            match aistudio::transcribe(self, audio, bytes.clone(), request).await {
                Ok(transcript) => {
                    self.cache.put_json(&key, &transcript)?;
                    return Ok((transcript, false));
                }
                Err(error) if !self.switch_after(request.model, &error) => return Err(error),
                Err(_) => {}
            }
        }
        let transcript = openrouter::transcribe(self, audio, &elsewhere).await?;
        self.cache.put_json(&elsewhere_key, &transcript)?;
        Ok((transcript, false))
    }

    fn transcribe_key(request: &TranscribeRequest<'_>, bytes: &[u8]) -> String {
        Cache::key(&json!({
            "job": "transcribe",
            "model": request.model,
            "language": request.language,
            "terms": request.terms,
            "audio": hex::encode(Sha256::digest(bytes)),
        }))
    }

    /// The first transcript any of the models can give: a cached one from any model first,
    /// then each model in order, so a fallback steps in when the first hits a rate limit.
    pub async fn transcribe_first(
        &self,
        audio: &Path,
        requests: &[TranscribeRequest<'_>],
    ) -> Result<(Transcript, bool)> {
        let bytes = std::fs::read(audio)?;
        for request in requests {
            if let Some(transcript) = self.cache.json(&Self::transcribe_key(request, &bytes)) {
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

    pub fn music_key(model: &str, prompt: &str, variant: u32) -> String {
        Cache::key(&json!({"job": "music", "model": model, "prompt": prompt, "variant": variant}))
    }

    /// One variant of Claude's music prompt, sent unchanged.
    pub async fn music(&self, model: &str, prompt: &str, variant: u32) -> Result<Generated> {
        let key = Self::music_key(model, prompt, variant);
        if let Some(bytes) = self.cache.bytes(&key) {
            return Ok(Generated {
                bytes,
                cached: true,
                route: Provider::of(model),
            });
        }
        let other = Self::on_openrouter(model);
        let other_key = Self::music_key(&other, prompt, variant);
        if let Some(bytes) = self.cache.bytes(&other_key) {
            return Ok(Generated {
                bytes,
                cached: true,
                route: Provider::OpenRouter,
            });
        }
        if self.try_ai_studio(model) {
            match aistudio::music(self, model, prompt).await {
                Ok(bytes) => {
                    self.cache.put_bytes(&key, &bytes)?;
                    return Ok(Generated {
                        bytes,
                        cached: false,
                        route: Provider::AiStudio,
                    });
                }
                Err(error) if !self.switch_after(model, &error) => return Err(error),
                Err(_) => {}
            }
        }
        let bytes = openrouter::music(self, &other, prompt).await?;
        self.cache.put_bytes(&other_key, &bytes)?;
        Ok(Generated {
            bytes,
            cached: false,
            route: Provider::OpenRouter,
        })
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

/// Keys (names only) and, with `online`, which route models each key can reach, with live
/// OpenRouter prices. Returns the report and whether every check that ran passed.
pub async fn doctor(start: &Path, online: bool) -> Result<(Value, bool)> {
    let keys = Keys::load(start)?;
    let file = keys.file.as_ref().map(|p| p.display().to_string());
    let status = keys.status();
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
    for (name, route) in [("aiStudio", AI_STUDIO), ("openRouter", OPENROUTER)] {
        let provider = Provider::of(route.speech);
        let present = generators.keys.get(provider.key()).is_some();
        let mut models = Vec::new();
        for model in [route.speech, route.transcription, route.music] {
            let mut entry = json!({"model": model});
            if online && present {
                match provider {
                    Provider::AiStudio => match aistudio::visible(&generators, model).await {
                        Ok(visible) => {
                            ok &= visible;
                            entry["visible"] = json!(visible);
                        }
                        Err(error) => {
                            ok = false;
                            entry["error"] = json!(error.to_string());
                        }
                    },
                    Provider::OpenRouter => {
                        if let Ok(catalog) = &catalog {
                            let found = catalog.iter().find(|m| m["id"] == model);
                            ok &= found.is_some();
                            entry["listed"] = json!(found.is_some());
                            if let Some(found) = found {
                                entry["pricing"] = found["pricing"].clone();
                            }
                        }
                    }
                }
            }
            models.push(entry);
        }
        let mut report = json!({
            "route": name,
            "provider": provider,
            "key": provider.key(),
            "keyPresent": present,
            "voice": route.voice,
            "models": models,
        });
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
        }),
        ok,
    ))
}

/// Asks the provider whether a saved key works, for the `Check` button in Setup. The answer
/// is facts, not a sentence: the page words it in its own language.
/// `state`: `none` (no key), `works`, `partial` (works, but the `missing` models are out of
/// reach) or `refused` (with the provider's answer as `detail`).
pub async fn try_key(start: &Path, name: &str) -> Result<Value> {
    let keys = Keys::load(start)?;
    if keys.get(name).is_none() {
        return Ok(json!({"ok": false, "state": "none"}));
    }
    let generators = Generators::new(keys, std::env::temp_dir().join("superint-video-doctor"))?;
    let refused = |error: anyhow::Error| json!({"ok": false, "state": "refused", "detail": error.to_string()});
    if name == env::GEMINI {
        let mut missing = Vec::new();
        for model in [AI_STUDIO.speech, AI_STUDIO.transcription, AI_STUDIO.music] {
            match aistudio::visible(&generators, model).await {
                Ok(true) => {}
                Ok(false) => missing.push(model),
                Err(error) => return Ok(refused(error)),
            }
        }
        return Ok(if missing.is_empty() {
            json!({"ok": true, "state": "works"})
        } else {
            json!({"ok": true, "state": "partial", "missing": missing})
        });
    }
    Ok(match openrouter::credits(&generators).await {
        Ok(credits) => json!({
            "ok": true,
            "state": "works",
            "creditLeft": credits["limitRemaining"].as_f64(),
        }),
        Err(error) => refused(error),
    })
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
            Generators::new(keys, home.path().join("cache")).unwrap()
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
        assert!(!only_openrouter.try_ai_studio(AI_STUDIO.speech));
        let only_google = with(Some(env::GEMINI));
        assert_eq!(
            only_google.reachable(AI_STUDIO.music).unwrap(),
            Provider::AiStudio
        );
        assert!(only_google.reachable(OPENROUTER.speech).is_err());
        let none = with(None);
        let message = none.reachable(AI_STUDIO.speech).unwrap_err().to_string();
        assert!(message.contains(env::GEMINI) && message.contains("Setup"));
        assert!(none.try_ai_studio(AI_STUDIO.speech));
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
