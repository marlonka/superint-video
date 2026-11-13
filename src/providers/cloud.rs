//! Google Cloud: Gemini Enterprise Agent Platform, formerly Vertex AI. The same Gemini TTS,
//! Gemini Transcribe and Lyria as AI Studio, billed to a Google Cloud project under Google
//! Cloud's terms. Speech and transcription answer on `generateContent` there (they are not on
//! its Interactions API), Lyria 3 on the Interactions API (checked 2026-11-12).
//!
//! Who asks: a Google Cloud API key the user saved (`x-goog-api-key`), else the user's Google
//! sign-in (Application Default Credentials, see `gauth`): a short-lived token, billed to the
//! project. With a project (from Setup, `GOOGLE_CLOUD_PROJECT` or the sign-in's quota project)
//! the requests go to the project in its location, `eu` unless another is chosen, so the data
//! stay there. Without one, an express-mode key reaches the global endpoints, the only ones
//! Google documents for express mode; a sign-in needs a project. Lyria 3 is served in `global`
//! only, so music goes there.
use super::{
    Generators, Provider, SpeechRequest, TranscribeRequest, Transcript, Word, aistudio, gauth,
    language_tag, with_headers,
};
use crate::{
    env::{self, Keys},
    home::Settings,
};
use anyhow::{Context, Result, bail};
use base64::{Engine, engine::general_purpose::STANDARD as B64};
use serde::Serialize;
use serde_json::{Value, json};
use std::{path::Path, time::Duration};

const HOST: &str = "aiplatform.googleapis.com";
/// Where the speech and transcription models are served: the EU or US multi-region, or
/// anywhere. The first is the default.
pub const LOCATIONS: &[&str] = &["eu", "us", "global"];

/// Where requests go: a project and its location, or no project for express mode.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Place {
    pub project: Option<String>,
    pub location: String,
}

impl Place {
    /// `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION` from the environment or `.env`, as
    /// Google's SDKs read them, else what Setup saved, else the sign-in's quota project, else
    /// express mode; the EU unless a location is named.
    pub fn of(keys: &Keys, settings: &Settings, sign_in: Option<&gauth::Adc>) -> Self {
        let given = |value: &Option<String>| value.clone().filter(|v| !v.trim().is_empty());
        Self {
            project: given(&keys.cloud_project)
                .or_else(|| given(&settings.google_cloud_project))
                .or_else(|| sign_in.and_then(|adc| adc.quota_project.clone())),
            location: given(&keys.cloud_location)
                .or_else(|| given(&settings.google_cloud_location))
                .unwrap_or_else(|| LOCATIONS[0].into()),
        }
    }

    /// The service address of the location: the multi-regions have their own, a single region
    /// its prefixed one. Express mode is served globally.
    fn host(&self) -> String {
        match self.location.as_str() {
            _ if self.project.is_none() => HOST.into(),
            "global" => HOST.into(),
            "eu" | "us" => format!("aiplatform.{}.rep.googleapis.com", self.location),
            region => format!("{region}-{HOST}"),
        }
    }

    /// A method of one of Google's models, such as `generateContent`.
    pub fn model_url(&self, model: &str, method: &str) -> String {
        match &self.project {
            Some(project) => format!(
                "https://{}/v1/projects/{project}/locations/{}/publishers/google/models/{model}:{method}",
                self.host(),
                self.location
            ),
            None => format!("https://{HOST}/v1/publishers/google/models/{model}:{method}"),
        }
    }

    /// Express mode, or a project's location: where the speech and words are made.
    pub fn served_in(&self) -> &str {
        if self.project.is_some() {
            &self.location
        } else {
            "global"
        }
    }

    /// The Interactions API in `global`, where Lyria 3 is served. `v1beta1`: on 2026-11-12 the
    /// `v1` address answered Lyria with a completed interaction that carried no audio.
    pub fn interactions_url(&self) -> String {
        match &self.project {
            Some(project) => {
                format!("https://{HOST}/v1beta1/projects/{project}/locations/global/interactions")
            }
            None => format!("https://{HOST}/v1beta1/locations/global/interactions"),
        }
    }
}

/// The model's name on Google Cloud. Lyria 3.5 is not offered there (2026-11-12); Lyria 3 Pro
/// is, as on OpenRouter.
pub fn model(model: &str) -> &str {
    if model == "lyria-3.5" {
        "lyria-3-pro-preview"
    } else {
        model
    }
}

/// The headers that say who asks: the saved key, else a token of the user's Google sign-in
/// with the project it bills to.
pub(super) async fn auth(g: &Generators) -> Result<Vec<(&'static str, String)>> {
    if let Some(key) = g.keys.get(env::GOOGLE_CLOUD) {
        return Ok(vec![("x-goog-api-key", key.expose().to_string())]);
    }
    let Some(sign_in) = &g.google else {
        g.keys.require(env::GOOGLE_CLOUD)?;
        unreachable!("require fails without the key");
    };
    let Some(project) = &g.cloud.project else {
        bail!(
            "The Google sign-in needs a project: the user enters its ID in Setup under Google Cloud, Project and region (or sets GOOGLE_CLOUD_PROJECT)"
        );
    };
    let token = gauth::token(&g.http, sign_in).await?;
    Ok(vec![
        ("Authorization", format!("Bearer {token}")),
        ("x-goog-user-project", project.clone()),
    ])
}

async fn generate(g: &Generators, model: &str, body: &Value, timeout: Duration) -> Result<Value> {
    let auth = auth(g).await?;
    let url = g.cloud.model_url(model, "generateContent");
    let value: Value = g
        .send(Provider::GoogleCloud, || {
            with_headers(g.http.post(&url), &auth)
                .json(body)
                .timeout(timeout)
        })
        .await?
        .json()
        .await
        .map_err(|e| g.transport(e))?;
    if let Some(reason) = value["promptFeedback"]["blockReason"].as_str() {
        bail!("Google Cloud blocked the request: {reason}");
    }
    Ok(value)
}

/// A style: the model looks at the pictures and writes.
pub(super) async fn write(
    g: &Generators,
    model: &str,
    request: &super::StyleRequest<'_>,
) -> Result<String> {
    let body = super::gemini_style_body(request);
    let value = generate(g, model, &body, super::STYLE_TIMEOUT).await?;
    super::gemini_text(Provider::GoogleCloud, &value)
}

/// The parts of the first candidate.
fn parts(value: &Value) -> Vec<&Value> {
    value["candidates"][0]["content"]["parts"]
        .as_array()
        .map(|parts| parts.iter().collect())
        .unwrap_or_default()
}

/// Why a candidate ended, when it was not the usual stop.
fn ended(value: &Value) -> String {
    match value["candidates"][0]["finishReason"].as_str() {
        Some(reason) if reason != "STOP" => format!(" (finish reason {reason})"),
        _ => String::new(),
    }
}

fn audio_part(mime: &str, bytes: &[u8]) -> Value {
    json!({"inlineData": {"mimeType": mime, "data": B64.encode(bytes)}})
}

pub(super) async fn speech(g: &Generators, request: &SpeechRequest<'_>) -> Result<Vec<u8>> {
    let mut part = json!({"text": request.text});
    if let Some(style) = request.style.map(str::trim).filter(|s| !s.is_empty()) {
        part["speechMetadata"] = json!({"style": style});
    }
    let body = json!({
        "contents": [{"role": "user", "parts": [part]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": request.voice}}},
        },
    });
    let value = generate(g, request.model, &body, Duration::from_secs(300)).await?;
    let inline = parts(&value)
        .into_iter()
        .rev()
        .find_map(|part| {
            part.get("inlineData")
                .or(part.get("inline_data"))
                .filter(|data| data["data"].is_string())
        })
        .with_context(|| format!("Google Cloud returned no audio{}", ended(&value)))?;
    let mime = inline["mimeType"]
        .as_str()
        .or(inline["mime_type"].as_str())
        .unwrap_or_default();
    aistudio::decode(inline["data"].as_str().unwrap_or_default(), mime)
}

/// Word timings, then, with terms, a second pass biased to them: as on AI Studio, Google does
/// not take a vocabulary together with word timestamps. The audio goes inline as 16 kHz WAV.
pub(super) async fn transcribe(
    g: &Generators,
    path: &Path,
    request: &TranscribeRequest<'_>,
) -> Result<Transcript> {
    let wav = crate::audio::wav_16k(path).await?;
    let mut config = json!({"mode": "VERBATIM", "wordTimestamp": true});
    if let Some(language) = request.language.map(language_tag) {
        config["languageCodes"] = json!([language]);
    }
    let timed_body = json!({
        "contents": [{"role": "user", "parts": [audio_part("audio/wav", &wav)]}],
        "generationConfig": {"audioTranscriptionConfig": config},
    });
    let timeout = Duration::from_secs(900);
    // The biased pass needs nothing from the timed one: both run at once.
    let biased_pass = async {
        if request.terms.is_empty() {
            return Ok(None);
        }
        let mut body = timed_body.clone();
        let config = &mut body["generationConfig"]["audioTranscriptionConfig"];
        config
            .as_object_mut()
            .map(|config| config.remove("wordTimestamp"));
        config["customVocabulary"] = json!(request.terms);
        let response = generate(g, request.model, &body, timeout).await?;
        Ok(Some(transcript(&response).0))
    };
    let (timed, biased) = tokio::try_join!(
        generate(g, request.model, &timed_body, timeout),
        biased_pass
    )?;
    let (text, words) = transcript(&timed);
    if words.is_empty() {
        bail!(
            "Google Cloud returned no word timings for {}{}",
            path.display(),
            ended(&timed)
        );
    }
    Ok(Transcript {
        model: request.model.into(),
        text,
        words,
        biased,
    })
}

/// A dictation in `SMART` mode: without fillers and false starts, the speaker's corrections
/// applied, the language detected.
pub(super) async fn dictate(g: &Generators, wav: &[u8], model: &str) -> Result<String> {
    let body = json!({
        "contents": [{"role": "user", "parts": [audio_part("audio/wav", wav)]}],
        "generationConfig": {"audioTranscriptionConfig": {"mode": "SMART"}},
    });
    Ok(transcript(&generate(g, model, &body, Duration::from_secs(120)).await?).0)
}

pub(super) async fn music(g: &Generators, model: &str, prompt: &str) -> Result<Vec<u8>> {
    let auth = auth(g).await?;
    let body = json!({
        "model": model,
        "input": [{"type": "user_input", "content": [{"type": "text", "text": prompt}]}],
    });
    let response = aistudio::interact_at(
        g,
        Provider::GoogleCloud,
        &g.cloud.interactions_url(),
        &auth,
        &body,
        Duration::from_secs(900),
    )
    .await?;
    aistudio::audio(&response)
}

/// Whether this key reaches a model, asked with an empty request, so nothing is generated or
/// billed: Google answers 400 to the empty request when key and model are fine, 404 for a
/// model it does not have, and 401 or 403 (or 400 naming the key) for a key it does not take.
pub async fn visible(g: &Generators, model: &str) -> Result<bool> {
    let auth = auth(g).await?;
    let response = with_headers(
        g.http.post(g.cloud.model_url(model, "generateContent")),
        &auth,
    )
    .json(&json!({"contents": []}))
    .timeout(Duration::from_secs(20))
    .send()
    .await
    .map_err(|e| g.transport(e))?;
    match response.status().as_u16() {
        200..=299 | 429 => Ok(true),
        404 => Ok(false),
        400 => {
            let error = g.failure(Provider::GoogleCloud, response).await;
            if error.to_string().to_ascii_lowercase().contains("api key") {
                Err(error)
            } else {
                Ok(true)
            }
        }
        status => {
            let code = response.status();
            let body = response.text().await.unwrap_or_default();
            Err(Refusal {
                status,
                reason: reason(&body),
                error: g.failed(Provider::GoogleCloud, code, &body),
            }
            .into())
        }
    }
}

/// Google Cloud turning a request away, with the `reason` of its error details: for example
/// `CONSUMER_INVALID` (the account cannot use the project, seen 2026-11-13 for a sign-in's
/// quota project the account no longer reaches) or `SERVICE_DISABLED` (the project has the
/// Agent Platform API switched off).
#[derive(Debug)]
pub struct Refusal {
    pub status: u16,
    pub reason: Option<String>,
    error: anyhow::Error,
}

impl std::fmt::Display for Refusal {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.error.fmt(f)
    }
}

impl std::error::Error for Refusal {}

/// The first `reason` in the details of a Google error answer.
fn reason(body: &str) -> Option<String> {
    let value: Value = serde_json::from_str(body).ok()?;
    value["error"]["details"]
        .as_array()?
        .iter()
        .find_map(|detail| detail["reason"].as_str())
        .map(str::to_string)
}

/// The active projects the user's Google sign-in can see, for a check whose project was
/// turned away. Empty with a key, or when the list cannot be read.
pub async fn projects(g: &Generators) -> Vec<String> {
    let Some(sign_in) = &g.google else {
        return Vec::new();
    };
    let Ok(token) = gauth::token(&g.http, sign_in).await else {
        return Vec::new();
    };
    let answer = g
        .http
        .get("https://cloudresourcemanager.googleapis.com/v1/projects?filter=lifecycleState%3AACTIVE&pageSize=50")
        .bearer_auth(token)
        .timeout(Duration::from_secs(20))
        .send()
        .await;
    let Ok(answer) = answer else {
        return Vec::new();
    };
    if !answer.status().is_success() {
        return Vec::new();
    }
    let value: Value = answer.json().await.unwrap_or_default();
    value["projects"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|project| project["projectId"].as_str())
        .map(str::to_string)
        .collect()
}

/// The text of the parts, and the words with their times when they were asked for.
fn transcript(value: &Value) -> (String, Vec<Word>) {
    let parts = parts(value);
    let text = parts
        .iter()
        .filter_map(|part| part["text"].as_str())
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string();
    let words = parts
        .iter()
        .filter_map(|part| {
            part.get("audioTranscription")
                .or(part.get("audio_transcription"))
        })
        .flat_map(|found| found["words"].as_array().into_iter().flatten())
        .filter_map(|word| {
            Some(Word {
                text: word["word"].as_str().or(word["text"].as_str())?.to_string(),
                start: aistudio::offset(&word["startOffset"])
                    .or(aistudio::offset(&word["start_offset"]))?,
                end: aistudio::offset(&word["endOffset"])
                    .or(aistudio::offset(&word["end_offset"]))?,
            })
        })
        .collect();
    (text, words)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_refusal_keeps_googles_reason() {
        // Google's answer of 2026-11-13 for a sign-in's quota project the account cannot use.
        let body = r#"{"error": {"code": 403, "status": "PERMISSION_DENIED",
            "message": "Permission denied on resource project p.",
            "details": [{"@type": "type.googleapis.com/google.rpc.ErrorInfo",
                "reason": "CONSUMER_INVALID", "domain": "googleapis.com"},
                {"@type": "type.googleapis.com/google.rpc.Help", "links": []}]}}"#;
        assert_eq!(reason(body).as_deref(), Some("CONSUMER_INVALID"));
        assert_eq!(reason(r#"{"error": {"code": 403}}"#), None);
        assert_eq!(reason("not json"), None);
    }

    fn place(project: Option<&str>, location: &str) -> Place {
        Place {
            project: project.map(str::to_string),
            location: location.into(),
        }
    }

    #[test]
    fn addresses_follow_project_and_location() {
        assert_eq!(
            place(None, "eu").model_url("gemini-3.8-flash-tts", "generateContent"),
            "https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.8-flash-tts:generateContent"
        );
        assert_eq!(
            place(None, "global").interactions_url(),
            "https://aiplatform.googleapis.com/v1beta1/locations/global/interactions"
        );
        assert_eq!(
            place(Some("films-1"), "global").model_url("gemini-3.5-transcribe", "generateContent"),
            "https://aiplatform.googleapis.com/v1/projects/films-1/locations/global/publishers/google/models/gemini-3.5-transcribe:generateContent"
        );
        assert_eq!(
            place(Some("films-1"), "eu").model_url("gemini-3.8-flash-tts", "generateContent"),
            "https://aiplatform.eu.rep.googleapis.com/v1/projects/films-1/locations/eu/publishers/google/models/gemini-3.8-flash-tts:generateContent"
        );
        // Lyria 3 is served globally only.
        assert_eq!(
            place(Some("films-1"), "eu").interactions_url(),
            "https://aiplatform.googleapis.com/v1beta1/projects/films-1/locations/global/interactions"
        );
        assert_eq!(place(Some("films-1"), "us").served_in(), "us");
        assert_eq!(place(None, "eu").served_in(), "global");
        assert_eq!(
            place(Some("films-1"), "europe-west4").model_url("m", "generateContent"),
            "https://europe-west4-aiplatform.googleapis.com/v1/projects/films-1/locations/europe-west4/publishers/google/models/m:generateContent"
        );
        assert_eq!(model("lyria-3.5"), "lyria-3-pro-preview");
        assert_eq!(model("gemini-3.8-flash-tts"), "gemini-3.8-flash-tts");
    }

    #[test]
    fn the_environment_wins_over_setup() {
        let mut keys = Keys::default();
        keys.cloud_project = Some("from-env-1".into());
        let settings = Settings {
            google_cloud_project: Some("from-setup-1".into()),
            google_cloud_location: Some("eu".into()),
            ..Settings::default()
        };
        assert_eq!(
            Place::of(&keys, &settings, None),
            place(Some("from-env-1"), "eu")
        );
        assert_eq!(
            Place::of(&Keys::default(), &Settings::default(), None),
            place(None, "eu")
        );
        // A sign-in brings its quota project when none is chosen.
        let sign_in = gauth::Adc {
            file: "adc.json".into(),
            kind: "authorized_user".into(),
            quota_project: Some("from-sign-in-1".into()),
        };
        assert_eq!(
            Place::of(&Keys::default(), &Settings::default(), Some(&sign_in)),
            place(Some("from-sign-in-1"), "eu")
        );
    }

    #[test]
    fn reads_words_and_text_from_the_candidate() {
        let response = json!({"candidates": [{"finishReason": "STOP", "content": {"role": "model", "parts": [
            {"text": "Stell dir vor", "audioTranscription": {"words": [
                {"word": "Stell", "startOffset": "0.100s", "endOffset": "0.300s"},
                {"word": "dir", "startOffset": "0.300s", "endOffset": "0.450s"},
                {"word": "vor", "startOffset": {"seconds": 0, "nanos": 450000000}, "endOffset": "0.8s"}
            ]}}
        ]}}]});
        let (text, words) = transcript(&response);
        assert_eq!(text, "Stell dir vor");
        assert_eq!(words.len(), 3);
        assert_eq!(words[0].start, 0.1);
        assert!((words[2].start - 0.45).abs() < 1e-9);
        assert_eq!(ended(&response), "");
        assert_eq!(
            ended(&json!({"candidates": [{"finishReason": "SAFETY"}]})),
            " (finish reason SAFETY)"
        );
        assert!(transcript(&json!({})).1.is_empty());
    }
}
