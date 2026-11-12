//! OpenRouter: ElevenLabs TTS, MAI-Transcribe and Lyria, plus the live catalog and credits.
use super::{
    Generators, Provider, SpeechRequest, TranscribeRequest, Transcript, Word, language_code,
    text_of,
};
use crate::env;
use anyhow::{Context, Result, bail};
use base64::{Engine, engine::general_purpose::STANDARD as B64};
use futures::StreamExt;
use serde_json::{Value, json};
use std::{path::Path, time::Duration};

const BASE: &str = "https://openrouter.ai/api/v1";

fn post(g: &Generators, path: &str, key: &env::Secret) -> reqwest::RequestBuilder {
    g.http
        .post(format!("{BASE}{path}"))
        .bearer_auth(key.expose())
        .header("X-Title", "Superint Video")
}

pub(super) async fn speech(g: &Generators, request: &SpeechRequest<'_>) -> Result<Vec<u8>> {
    let key = g.keys.require(env::OPENROUTER)?;
    // Gemini TTS answers only in PCM (24 kHz mono s16le, measured 2026-11-06) and reads its style
    // from `instructions`. Everything else stays MP3 until the rate of its PCM has been measured.
    let gemini = request.model.contains("gemini");
    let mut body = json!({
        "model": request.model,
        "input": request.text,
        "voice": request.voice,
        "response_format": if gemini { "pcm" } else { "mp3" },
    });
    if gemini && let Some(style) = request.style {
        body["instructions"] = json!(style);
    }
    let response = g
        .send(Provider::OpenRouter, || {
            post(g, "/audio/speech", key)
                .json(&body)
                .timeout(Duration::from_secs(300))
        })
        .await?;
    let bytes = response.bytes().await.map_err(|e| g.transport(e))?.to_vec();
    Ok(if gemini {
        super::pcm_wav(&bytes, 24_000, 1)
    } else {
        bytes
    })
}

pub(super) async fn transcribe(
    g: &Generators,
    path: &Path,
    request: &TranscribeRequest<'_>,
) -> Result<Transcript> {
    let key = g.keys.require(env::OPENROUTER)?;
    let wav = crate::audio::wav_16k(path).await?;
    let mut body = json!({
        "model": request.model,
        "input_audio": {"data": B64.encode(&wav), "format": "wav"},
        "response_format": "verbose_json",
        "timestamp_granularities": ["word", "segment"],
    });
    if let Some(language) = request.language {
        body["language"] = json!(language_code(language));
    }
    // OpenRouter documents `keyterms`, but the MAI provider rejected it with 400 on 2026-10-31,
    // so terms are only checked against the transcript.
    let value: Value = g
        .send(Provider::OpenRouter, || {
            post(g, "/audio/transcriptions", key)
                .json(&body)
                .timeout(Duration::from_secs(900))
        })
        .await?
        .json()
        .await
        .map_err(|e| g.transport(e))?;
    let words: Vec<Word> = value["words"]
        .as_array()
        .context("OpenRouter returned no word timings")?
        .iter()
        .filter(|w| w["type"].as_str().is_none_or(|t| t == "word"))
        .filter_map(|w| {
            Some(Word {
                text: w["word"].as_str().or(w["text"].as_str())?.to_string(),
                start: w["start"].as_f64()?,
                end: w["end"].as_f64()?,
            })
        })
        .collect();
    Ok(Transcript {
        model: request.model.into(),
        text: text_of(&value),
        words,
        biased: None,
    })
}

/// A dictation: the text alone, no timings. The language is detected.
pub(super) async fn dictate(g: &Generators, wav: &[u8], model: &str) -> Result<String> {
    let key = g.keys.require(env::OPENROUTER)?;
    let body = json!({
        "model": model,
        "input_audio": {"data": B64.encode(wav), "format": "wav"},
    });
    let value: Value = g
        .send(Provider::OpenRouter, || {
            post(g, "/audio/transcriptions", key)
                .json(&body)
                .timeout(Duration::from_secs(120))
        })
        .await?
        .json()
        .await
        .map_err(|e| g.transport(e))?;
    Ok(text_of(&value))
}

/// Lyria through chat completions: audio arrives as base64 pieces in the SSE deltas.
pub(super) async fn music(g: &Generators, model: &str, prompt: &str) -> Result<Vec<u8>> {
    let key = g.keys.require(env::OPENROUTER)?;
    let body = json!({
        "model": model,
        "modalities": ["text", "audio"],
        "stream": true,
        "messages": [{"role": "user", "content": prompt}],
    });
    let response = g
        .send(Provider::OpenRouter, || {
            post(g, "/chat/completions", key)
                .json(&body)
                .timeout(Duration::from_secs(900))
        })
        .await?;
    let mut stream = response.bytes_stream();
    let mut buffer = Vec::new();
    let mut audio = Vec::new();
    let mut text = String::new();
    'stream: while let Some(chunk) = stream.next().await {
        buffer.extend_from_slice(&chunk.map_err(|e| g.transport(e))?);
        while let Some(end) = buffer.iter().position(|&b| b == b'\n') {
            let line: Vec<u8> = buffer.drain(..=end).collect();
            let line = String::from_utf8_lossy(&line);
            let Some(data) = line.trim().strip_prefix("data:") else {
                continue;
            };
            let data = data.trim();
            if data == "[DONE]" {
                break 'stream;
            }
            let Ok(event) = serde_json::from_str::<Value>(data) else {
                continue;
            };
            if let Some(error) = event.get("error") {
                let message = error["message"].as_str().unwrap_or("no details");
                bail!("OpenRouter music error: {}", g.keys.redact(message));
            }
            for choice in event["choices"].as_array().into_iter().flatten() {
                let delta = &choice["delta"];
                // Each piece is encoded on its own; decode before joining.
                if let Some(piece) = delta["audio"]["data"].as_str() {
                    audio.extend(
                        B64.decode(piece)
                            .context("Music audio is not valid base64")?,
                    );
                }
                if let Some(content) = delta["content"].as_str() {
                    text.push_str(content);
                }
            }
        }
    }
    if audio.is_empty() {
        let text: String = text.chars().take(300).collect();
        bail!("OpenRouter returned no music audio. Model text: {text}");
    }
    Ok(audio)
}

/// All models including audio ones, with live prices. Public; no key needed.
pub async fn catalog(g: &Generators) -> Result<Vec<Value>> {
    let value: Value = g
        .send(Provider::OpenRouter, || {
            g.http
                .get(format!("{BASE}/models?output_modalities=all"))
                .timeout(Duration::from_secs(30))
        })
        .await?
        .json()
        .await
        .map_err(|e| g.transport(e))?;
    Ok(value["data"].as_array().cloned().unwrap_or_default())
}

/// Usage and remaining limit of the key. The key's label is never read: it can show part of the key.
pub async fn credits(g: &Generators) -> Result<Value> {
    let key = g.keys.require(env::OPENROUTER)?;
    let value: Value = g
        .send(Provider::OpenRouter, || {
            g.http
                .get(format!("{BASE}/key"))
                .bearer_auth(key.expose())
                .timeout(Duration::from_secs(30))
        })
        .await?
        .json()
        .await
        .map_err(|e| g.transport(e))?;
    let data = &value["data"];
    Ok(json!({
        "usage": data["usage"],
        "limit": data["limit"],
        "limitRemaining": data["limit_remaining"],
    }))
}
