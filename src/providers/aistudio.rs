//! Google AI Studio (Gemini API, Interactions endpoint): Gemini TTS, Gemini Transcribe and Lyria.
//! Request shapes follow models.md; responses are searched by block type, so small changes in
//! nesting between API versions do not break parsing.
use super::{
    Generators, Provider, SpeechRequest, TranscribeRequest, Transcript, Word, language_tag, mime,
    pcm_wav, sniff,
};
use crate::env;
use anyhow::{Context, Result, bail};
use base64::{Engine, engine::general_purpose::STANDARD as B64};
use serde_json::{Value, json};
use std::{
    path::Path,
    time::{Duration, Instant},
};

const BASE: &str = "https://generativelanguage.googleapis.com";

pub(super) async fn speech(g: &Generators, request: &SpeechRequest<'_>) -> Result<Vec<u8>> {
    let mut text = json!({"type": "text", "text": request.text});
    if let Some(style) = request.style.map(str::trim).filter(|s| !s.is_empty()) {
        text["annotations"] = json!([{"type": "speech_metadata", "style": style}]);
    }
    let body = json!({
        "model": request.model,
        "input": [{"type": "user_input", "content": [text]}],
        "response_format": {"type": "audio"},
        "generation_config": {"speech_config": [{"voice": request.voice}]},
    });
    audio(&interact(g, &body, Duration::from_secs(300)).await?)
}

pub(super) async fn transcribe(
    g: &Generators,
    path: &Path,
    bytes: Vec<u8>,
    request: &TranscribeRequest<'_>,
) -> Result<Transcript> {
    let mime = mime(path);
    let uri = upload(g, bytes, mime).await?;
    let input = json!([{"type": "audio", "uri": uri, "mime_type": mime}]);
    let language = request.language.map(language_tag);
    let config = |mode: Value, vocabulary: Option<&[String]>| {
        let mut config = json!({"mode": mode});
        if let Some(language) = &language {
            config["language_codes"] = json!([language]);
        }
        if let Some(terms) = vocabulary {
            config["custom_vocabulary"] = json!(terms);
        }
        json!({
            "model": request.model, "input": input,
            "generation_config": {"transcription_config": config},
        })
    };
    let timeout = Duration::from_secs(900);
    // Google does not allow a vocabulary together with word timestamps: two passes.
    let timed = interact(
        g,
        &config(
            json!({"type": "verbatim", "timestamp_granularities": ["word"]}),
            None,
        ),
        timeout,
    )
    .await?;
    let (text, words) = transcript(&timed);
    if words.is_empty() {
        bail!("AI Studio returned no word timings for {}", path.display());
    }
    let biased = if request.terms.is_empty() {
        None
    } else {
        let response = interact(
            g,
            &config(json!({"type": "verbatim"}), Some(request.terms)),
            timeout,
        )
        .await?;
        Some(transcript(&response).0)
    };
    Ok(Transcript {
        model: request.model.into(),
        text,
        words,
        biased,
    })
}

/// A dictation in `smart` mode: the text as it is meant to be read, without fillers, stutters
/// and false starts, with the speaker's own corrections applied. The language is detected,
/// so a German sentence with English terms comes out as spoken.
pub(super) async fn dictate(g: &Generators, wav: Vec<u8>, model: &str) -> Result<String> {
    let uri = upload(g, wav, "audio/wav").await?;
    let body = json!({
        "model": model,
        "input": [{"type": "audio", "uri": uri, "mime_type": "audio/wav"}],
        "generation_config": {"transcription_config": {"mode": "smart"}},
    });
    Ok(transcript(&interact(g, &body, Duration::from_secs(120)).await?).0)
}

pub(super) async fn music(g: &Generators, model: &str, prompt: &str) -> Result<Vec<u8>> {
    let mut body = json!({"model": model, "input": prompt});
    // The 30-second clip model only returns MP3.
    if !model.contains("clip") {
        body["response_format"] = json!({"type": "audio"});
    }
    audio(&interact(g, &body, Duration::from_secs(900)).await?)
}

/// Whether this key sees a model (`GET /v1beta/models/{model}`).
pub async fn visible(g: &Generators, model: &str) -> Result<bool> {
    let key = g.keys.require(env::GEMINI)?;
    let response = g
        .http
        .get(format!("{BASE}/v1beta/models/{model}"))
        .header("x-goog-api-key", key.expose())
        .timeout(Duration::from_secs(20))
        .send()
        .await
        .map_err(|e| g.transport(e))?;
    match response.status().as_u16() {
        200 => Ok(true),
        404 => Ok(false),
        _ => Err(g.failure(Provider::AiStudio, response).await),
    }
}

async fn interact(g: &Generators, body: &Value, timeout: Duration) -> Result<Value> {
    let key = g.keys.require(env::GEMINI)?;
    let url = format!("{BASE}/v1beta/interactions");
    let auth = [("x-goog-api-key", key.expose().to_string())];
    interact_at(g, Provider::AiStudio, &url, &auth, body, timeout).await
}

/// Creates an interaction at `url` and polls it until it settles. Google Cloud's Interactions
/// API works the same way under its own address; `auth` are the headers that say who asks.
pub(super) async fn interact_at(
    g: &Generators,
    provider: Provider,
    url: &str,
    auth: &[(&str, String)],
    body: &Value,
    timeout: Duration,
) -> Result<Value> {
    let label = provider.label();
    let with_auth = |mut request: reqwest::RequestBuilder| {
        for (name, value) in auth {
            request = request.header(*name, value);
        }
        request
    };
    let response = g
        .send(provider, || {
            with_auth(g.http.post(url)).json(body).timeout(timeout)
        })
        .await?;
    let mut value: Value = response.json().await.map_err(|e| g.transport(e))?;
    let started = Instant::now();
    // Long jobs can come back unfinished; poll the interaction until it settles.
    while status(&value).is_some_and(pending) {
        if started.elapsed() > timeout {
            bail!(
                "{label} did not finish within {} seconds",
                timeout.as_secs()
            );
        }
        let id = value["id"]
            .as_str()
            .or(value["name"].as_str())
            .context("Unfinished interaction without an id")?;
        // The id may come as `interactions/<id>` or as the whole resource name.
        let poll = format!("{url}/{}", id.rsplit('/').next().unwrap_or(id));
        tokio::time::sleep(Duration::from_secs(2)).await;
        value = g
            .send(provider, || {
                with_auth(g.http.get(&poll)).timeout(Duration::from_secs(60))
            })
            .await?
            .json()
            .await
            .map_err(|e| g.transport(e))?;
    }
    if let Some(state) = status(&value).filter(|s| failed(s.as_str())) {
        let detail = value["error"]["message"]
            .as_str()
            .or(value["error"].as_str())
            .unwrap_or("no details");
        bail!("{label} interaction {state}: {}", g.keys.redact(detail));
    }
    Ok(value)
}

fn status(value: &Value) -> Option<String> {
    value["status"]
        .as_str()
        .or(value["state"].as_str())
        .map(str::to_ascii_lowercase)
}
fn pending(status: String) -> bool {
    matches!(
        status.as_str(),
        "in_progress" | "queued" | "pending" | "running" | "processing" | "created"
    )
}
fn failed(status: &str) -> bool {
    matches!(
        status,
        "failed" | "cancelled" | "canceled" | "expired" | "error"
    )
}

/// Resumable upload to the Files API; returns the file URI for an interaction.
async fn upload(g: &Generators, bytes: Vec<u8>, mime: &str) -> Result<String> {
    let key = g.keys.require(env::GEMINI)?;
    let url = format!("{BASE}/upload/v1beta/files");
    let length = bytes.len().to_string();
    let start = g
        .send(Provider::AiStudio, || {
            g.http
                .post(&url)
                .header("x-goog-api-key", key.expose())
                .header("X-Goog-Upload-Protocol", "resumable")
                .header("X-Goog-Upload-Command", "start")
                .header("X-Goog-Upload-Header-Content-Length", &length)
                .header("X-Goog-Upload-Header-Content-Type", mime)
                .json(&json!({"file": {"display_name": "superint-audio"}}))
                .timeout(Duration::from_secs(60))
        })
        .await?;
    let target = start
        .headers()
        .get("x-goog-upload-url")
        .and_then(|v| v.to_str().ok())
        .context("AI Studio did not return an upload URL")?
        .to_string();
    let done: Value = g
        .send(Provider::AiStudio, || {
            g.http
                .post(&target)
                .header("x-goog-api-key", key.expose())
                .header("X-Goog-Upload-Offset", "0")
                .header("X-Goog-Upload-Command", "upload, finalize")
                .body(bytes.clone())
                .timeout(Duration::from_secs(300))
        })
        .await?
        .json()
        .await
        .map_err(|e| g.transport(e))?;
    let file = &done["file"];
    let uri = file["uri"]
        .as_str()
        .context("Upload response has no file URI")?
        .to_string();
    // Audio is usually ACTIVE at once; wait briefly when it is still processing.
    if let Some(name) = file["name"].as_str() {
        let mut state = file["state"].as_str().unwrap_or("ACTIVE").to_string();
        for _ in 0..60 {
            match state.as_str() {
                "PROCESSING" => {}
                "FAILED" => bail!("AI Studio could not process the uploaded audio"),
                _ => break,
            }
            tokio::time::sleep(Duration::from_secs(1)).await;
            let info: Value = g
                .send(Provider::AiStudio, || {
                    g.http
                        .get(format!("{BASE}/v1beta/{name}"))
                        .header("x-goog-api-key", key.expose())
                        .timeout(Duration::from_secs(30))
                })
                .await?
                .json()
                .await
                .map_err(|e| g.transport(e))?;
            state = info["state"].as_str().unwrap_or("ACTIVE").to_string();
        }
    }
    Ok(uri)
}

/// The model's part of a response: `model_output` steps, else `outputs`, else everything.
fn outputs(value: &Value) -> Vec<&Value> {
    let mut steps = Vec::new();
    collect(value, &|v| v["type"] == "model_output", &mut steps);
    if !steps.is_empty() {
        return steps;
    }
    match value.get("outputs") {
        Some(outputs) => vec![outputs],
        None => vec![value],
    }
}

fn collect<'a>(value: &'a Value, matches: &dyn Fn(&Value) -> bool, out: &mut Vec<&'a Value>) {
    match value {
        Value::Object(map) => {
            if matches(value) {
                out.push(value);
            }
            for child in map.values() {
                collect(child, matches, out);
            }
        }
        Value::Array(items) => {
            for item in items {
                collect(item, matches, out);
            }
        }
        _ => {}
    }
}

pub(super) fn audio(response: &Value) -> Result<Vec<u8>> {
    let mut blocks = Vec::new();
    for scope in outputs(response) {
        collect(
            scope,
            &|v| v["type"] == "audio" && v["data"].is_string(),
            &mut blocks,
        );
    }
    let block = blocks.last().context(
        "Google returned no audio. Check the model ID and the text against the provider file",
    )?;
    let mime = block["mime_type"]
        .as_str()
        .or(block["mimeType"].as_str())
        .unwrap_or_default();
    decode(block["data"].as_str().unwrap_or_default(), mime)
}

/// Base64 audio as a file: as it came when it has a header, else headerless PCM (audio/l16)
/// wrapped at the rate its MIME type names.
pub(super) fn decode(data: &str, mime: &str) -> Result<Vec<u8>> {
    let bytes = B64
        .decode(data)
        .context("Google's audio is not valid base64")?;
    if sniff(&bytes) != "bin" {
        return Ok(bytes);
    }
    let rate = mime
        .split(';')
        .find_map(|part| part.trim().strip_prefix("rate="))
        .and_then(|rate| rate.parse().ok())
        .unwrap_or(24_000);
    Ok(pcm_wav(&bytes, rate, 1))
}

fn transcript(response: &Value) -> (String, Vec<Word>) {
    let scopes = outputs(response);
    let mut texts = Vec::new();
    let mut infos = Vec::new();
    for scope in &scopes {
        collect(
            scope,
            &|v| v["type"] == "text" && v["text"].is_string(),
            &mut texts,
        );
        collect(scope, &|v| v["type"] == "word_info", &mut infos);
    }
    let text = texts
        .iter()
        .filter_map(|v| v["text"].as_str())
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string();
    let words = infos
        .iter()
        .filter_map(|info| {
            Some(Word {
                text: info["text"].as_str().or(info["word"].as_str())?.to_string(),
                start: offset(&info["start_offset"]).or(offset(&info["startOffset"]))?,
                end: offset(&info["end_offset"]).or(offset(&info["endOffset"]))?,
            })
        })
        .collect();
    (text, words)
}

/// Durations come as "0.100s", as numbers or as {seconds, nanos}.
pub(super) fn offset(value: &Value) -> Option<f64> {
    match value {
        Value::String(text) => text.trim().trim_end_matches('s').parse().ok(),
        Value::Number(number) => number.as_f64(),
        Value::Object(map) => {
            let seconds = map.get("seconds").and_then(|s| {
                s.as_f64()
                    .or_else(|| s.as_str().and_then(|s| s.parse().ok()))
            });
            let nanos = map.get("nanos").and_then(Value::as_f64).unwrap_or(0.0);
            Some(seconds.unwrap_or(0.0) + nanos / 1e9)
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_word_timings_from_model_output_only() {
        let response = json!({
            "id": "abc",
            "status": "completed",
            "steps": [
                {"type": "user_input", "content": [{"type": "text", "text": "ignored input"}]},
                {"type": "model_output", "content": [{
                    "type": "text",
                    "text": "Stell dir vor",
                    "annotations": [
                        {"type": "word_info", "text": "Stell", "speaker": "1", "start_offset": "0.100s", "end_offset": "0.300s"},
                        {"type": "word_info", "text": "dir", "start_offset": {"seconds": 0, "nanos": 300000000}, "end_offset": "0.45s"},
                        {"type": "word_info", "text": "vor", "start_offset": 0.45, "end_offset": "0.8s"}
                    ]
                }]}
            ]
        });
        let (text, words) = transcript(&response);
        assert_eq!(text, "Stell dir vor");
        assert_eq!(words.len(), 3);
        assert_eq!(words[0].start, 0.1);
        assert!((words[1].start - 0.3).abs() < 1e-9);
        assert_eq!(words[2].end, 0.8);
    }

    #[test]
    fn takes_the_last_audio_block_and_wraps_pcm() {
        let wav = pcm_wav(&[1, 0, 2, 0], 24_000, 1);
        let response = json!({"steps": [{"type": "model_output", "content": [
            {"type": "audio", "data": B64.encode(b"old")},
            {"type": "audio", "mime_type": "audio/wav", "data": B64.encode(&wav)}
        ]}]});
        assert_eq!(audio(&response).unwrap(), wav);
        let pcm = json!({"outputs": [{"type": "audio", "mime_type": "audio/l16;rate=16000", "data": B64.encode([1u8, 0, 2, 0])}]});
        let wrapped = audio(&pcm).unwrap();
        let reader = hound::WavReader::new(std::io::Cursor::new(wrapped)).unwrap();
        assert_eq!(reader.spec().sample_rate, 16_000);
        assert!(audio(&json!({"steps": []})).is_err());
    }

    #[test]
    fn interaction_states() {
        assert!(pending("in_progress".into()));
        assert!(!pending("completed".into()));
        assert!(failed("failed"));
        assert_eq!(
            status(&json!({"status": "IN_PROGRESS"})).as_deref(),
            Some("in_progress")
        );
    }
}
