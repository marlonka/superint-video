//! OpenAI: speech to text for dictations (`gpt-transcribe`). Films do not use OpenAI: its speech
//! models end on 2027-01-06, their successor is a conversation model that does not promise to
//! read a text word for word, and only whisper-1 (ending 2027-02-26) gives word timings
//! (checked 2026-11-12).
use super::{Generators, Provider};
use crate::env;
use anyhow::Result;
use reqwest::multipart::{Form, Part};
use serde_json::Value;
use std::time::Duration;

/// The regions a request can be served in, with their address. A project with European data
/// residency is reached through `eu.api.openai.com`; any key can ask for processing there.
pub const REGIONS: &[(&str, &str)] = &[
    ("global", "https://api.openai.com/v1"),
    ("eu", "https://eu.api.openai.com/v1"),
];

/// The address for a region; unknown or unset is global.
pub fn base(region: Option<&str>) -> &'static str {
    REGIONS
        .iter()
        .find(|(name, _)| Some(*name) == region)
        .unwrap_or(&REGIONS[0])
        .1
}

/// A dictation, the text alone. The language is detected.
pub(super) async fn dictate(g: &Generators, wav: &[u8], model: &str) -> Result<String> {
    let key = g.keys.require(env::OPENAI)?;
    let url = format!("{}/audio/transcriptions", g.openai);
    let value: Value = g
        .send(Provider::OpenAi, || {
            let file = Part::bytes(wav.to_vec()).file_name("dictation.wav");
            let form = Form::new()
                .text("model", model.to_string())
                .text("response_format", "json")
                .part("file", file);
            g.http
                .post(&url)
                .bearer_auth(key.expose())
                .multipart(form)
                .timeout(Duration::from_secs(120))
        })
        .await?
        .json()
        .await
        .map_err(|e| g.transport(e))?;
    Ok(value["text"]
        .as_str()
        .unwrap_or_default()
        .trim()
        .to_string())
}

/// Whether this key sees a model (`GET /models/{model}`).
pub async fn visible(g: &Generators, model: &str) -> Result<bool> {
    let key = g.keys.require(env::OPENAI)?;
    let response = g
        .http
        .get(format!("{}/models/{model}", g.openai))
        .bearer_auth(key.expose())
        .timeout(Duration::from_secs(20))
        .send()
        .await
        .map_err(|e| g.transport(e))?;
    match response.status().as_u16() {
        200 => Ok(true),
        404 => Ok(false),
        _ => Err(g.failure(Provider::OpenAi, response).await),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn regions_have_their_own_address() {
        assert_eq!(base(None), "https://api.openai.com/v1");
        assert_eq!(base(Some("eu")), "https://eu.api.openai.com/v1");
        assert_eq!(base(Some("mars")), "https://api.openai.com/v1");
    }
}
