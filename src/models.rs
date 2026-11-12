//! `superint-video models`: which model does which job, through which provider, and how to
//! change it. For the coding agent as much as for the user: when someone asks for another voice
//! or transcription model, this says what is possible with the keys there are, checks a model
//! before it is used, and sets it for every new film.
//!
//! A film's own `voice.md` (`model:`, `transcription:`, `voice:`) and `music-prompt.md`
//! (`model:`) beat these settings; the settings beat the style's preset.
use crate::{
    env::Keys,
    home::{self, Settings},
    providers::{
        self, AI_STUDIO, DICTATION_GOOGLE, DICTATION_OPENAI, DICTATION_OPENROUTER, Generators,
        OPENROUTER, Provider,
    },
};
use anyhow::{Result, bail};
use serde_json::{Value, json};
use std::path::Path;

/// One job a model does, with the setting that names it and the models known to fit
/// (checked 2026-11-12; any other ID the provider offers works too).
struct Job {
    name: &'static str,
    setting: &'static str,
    /// Part of a film; OpenAI only writes down dictations.
    film: bool,
    usual: &'static str,
    known: &'static [(&'static str, &'static str)],
}

const JOBS: &[Job] = &[
    Job {
        name: "narration",
        setting: "narrationModel",
        film: true,
        usual: AI_STUDIO.speech,
        known: &[
            (
                AI_STUDIO.speech,
                "Gemini TTS, the default: 30 voices, style through `style:`, tags in <angle brackets>",
            ),
            (
                "gemini-3.8-flash-lite-tts",
                "Gemini TTS Lite: faster and cheaper, same voices and tags",
            ),
            (
                OPENROUTER.speech,
                "ElevenLabs v4 Turbo through OpenRouter: its own voices (daniel, george…), tags in [square brackets]",
            ),
            (
                "google/gemini-3.8-flash-tts",
                "Gemini TTS through OpenRouter, when AI Studio is out of reach",
            ),
        ],
    },
    Job {
        name: "voice",
        setting: "narrationVoice",
        film: true,
        usual: AI_STUDIO.voice,
        known: &[
            (
                AI_STUDIO.voice,
                "the house voice for Gemini TTS; Charon, Kore, Puck and the other Gemini voices work too",
            ),
            (
                OPENROUTER.voice,
                "the house voice for ElevenLabs; george and eric are alternatives",
            ),
        ],
    },
    Job {
        name: "timings",
        setting: "transcriptionModel",
        film: true,
        usual: AI_STUDIO.transcription,
        known: &[
            (
                AI_STUDIO.transcription,
                "Gemini Transcribe, the default: word times in 0.1 s steps, a vocabulary in a second pass",
            ),
            (
                OPENROUTER.transcription,
                "MAI-Transcribe-2 through OpenRouter: word times",
            ),
            (
                "google/gemini-3.5-transcribe",
                "Gemini Transcribe through OpenRouter",
            ),
        ],
    },
    Job {
        name: "music",
        setting: "musicModel",
        film: true,
        usual: AI_STUDIO.music,
        known: &[
            (
                AI_STUDIO.music,
                "Lyria 3.5, the default: whole pieces with an ending (on Google Cloud: lyria-3-pro-preview)",
            ),
            (
                "lyria-3-clip-preview",
                "Lyria 3 Clip: always 30 seconds, MP3",
            ),
            (OPENROUTER.music, "Lyria 3 Pro through OpenRouter"),
        ],
    },
    Job {
        name: "dictation",
        setting: "dictationModel",
        film: false,
        usual: DICTATION_GOOGLE,
        known: &[
            (
                DICTATION_GOOGLE,
                "Gemini Transcribe in smart mode: no fillers, the speaker's corrections applied",
            ),
            (DICTATION_OPENAI, "OpenAI's transcription model"),
            (DICTATION_OPENROUTER, "MAI-Transcribe-2 through OpenRouter"),
        ],
    },
];

fn job(name: &str) -> Result<&'static Job> {
    JOBS.iter().find(|job| job.name == name).ok_or_else(|| {
        anyhow::anyhow!(
            "Unknown job {name}. Jobs: {}",
            JOBS.iter()
                .map(|job| job.name)
                .collect::<Vec<_>>()
                .join(", ")
        )
    })
}

fn generators(start: &Path) -> Result<Generators> {
    Generators::new(
        Keys::load(start)?,
        std::env::temp_dir().join("superint-video-models"),
    )
}

fn chosen(settings: &Settings, job: &Job) -> Option<String> {
    let value = serde_json::to_value(settings).ok()?;
    value[job.setting].as_str().map(str::to_string)
}

/// The way a model of a job would go now, or why it cannot.
fn route(g: &Generators, job: &Job, model: &str) -> Result<(Provider, String)> {
    if job.name == "voice" {
        bail!("a voice is a name, not a model");
    }
    if job.film {
        g.reachable(model)?;
    }
    let ways = g.dictation_tries(Some(model));
    let (route, name) = ways.into_iter().next().expect("a model has a way");
    if !g.ready(route) {
        g.keys.require(route.key())?;
    }
    Ok((route, name))
}

/// Every job: the model it uses, why, the provider that carries it now, and the known ones.
pub fn report(start: &Path) -> Result<Value> {
    let settings = Settings::current();
    let g = generators(start)?;
    let ready = |route| g.ready(route);
    let jobs: serde_json::Map<String, Value> = JOBS
        .iter()
        .map(|job| {
            let chosen = chosen(&settings, job);
            let usual = if job.name == "dictation" {
                providers::usual_dictation(ready)
            } else {
                job.usual
            };
            let uses = chosen.clone().unwrap_or_else(|| usual.to_string());
            let mut entry = json!({
                "setting": job.setting,
                "chosen": chosen,
                "usual": usual,
                "uses": uses,
                "known": job.known.iter().map(|(model, about)| json!({"model": model, "about": about})).collect::<Vec<_>>(),
            });
            if job.name != "voice" {
                match route(&g, job, &uses) {
                    Ok((route, name)) => {
                        entry["route"] = json!(route);
                        entry["nameOnRoute"] = json!(name);
                    }
                    Err(error) => entry["problem"] = json!(error.to_string()),
                }
            }
            (job.name.to_string(), entry)
        })
        .collect();
    let routes: serde_json::Map<String, Value> = [
        Provider::AiStudio,
        Provider::GoogleCloud,
        Provider::OpenRouter,
        Provider::OpenAi,
    ]
    .into_iter()
    .map(|route| {
        (
            serde_json::to_value(route)
                .ok()
                .and_then(|v| v.as_str().map(str::to_string))
                .unwrap_or_default(),
            json!(ready(route)),
        )
    })
    .collect();
    Ok(json!({
        "jobs": jobs,
        "ready": routes,
        "googleCloud": g.cloud,
        "rule": "For new films: these settings beat the style's preset; a film's voice.md (model:, transcription:, voice:) and music-prompt.md (model:) beat both. Dictation is the start page's microphone.",
        "change": {
            "allFilms": "superint-video models set <job> <model> (checks the model first; an empty model goes back to the usual one)",
            "oneFilm": "model: / transcription: / voice: in voice.md, model: in music-prompt.md",
            "check": "superint-video models check <model> --job <job>",
        },
        "providers": "The ID says the provider: vendor/model is OpenRouter, gpt-… whisper-… tts-… are OpenAI (dictation only), any other is Google (Google Cloud when its key or the user's Google sign-in is there, else AI Studio). Read the superint-audio provider file before writing for another TTS model.",
        "keys": "Keys and the Google sign-in are the user's: they add them in the app's Setup (superint-video app). Never ask for a key in the chat.",
    }))
}

/// Whether a model can do a job: its form, the provider it belongs to, the way it would go,
/// and, online, whether the keys reach it.
pub async fn check(start: &Path, model: &str, job_name: &str, online: bool) -> Result<Value> {
    let job = job(job_name)?;
    let model = home::model_id(model);
    if job.name == "voice" {
        bail!("A voice is a name, not a model: superint-video models set voice <name>");
    }
    home::check_model(&model, job.film)?;
    let g = generators(start)?;
    let mut answer = json!({
        "model": model,
        "job": job.name,
        // The family the ID belongs to; `route` says which way it goes now.
        "provider": match Provider::of(&model) {
            Provider::AiStudio | Provider::GoogleCloud => json!("google"),
            family => json!(family),
        },
    });
    match route(&g, job, &model) {
        Ok((route, name)) => {
            answer["route"] = json!(route);
            answer["nameOnRoute"] = json!(name);
            if online {
                answer["reachable"] = match providers::probe(&g, route, &name).await {
                    Some(Ok(seen)) => json!(seen),
                    Some(Err(error)) => {
                        answer["detail"] = json!(error.to_string());
                        json!(false)
                    }
                    None => {
                        answer["detail"] =
                            json!("This model is only asked when it makes something");
                        Value::Null
                    }
                };
            }
        }
        Err(error) => {
            answer["reachable"] = json!(false);
            answer["detail"] = json!(error.to_string());
        }
    }
    Ok(answer)
}

/// Checks the model, then saves it for the job. An empty model goes back to the usual one.
pub async fn set(
    start: &Path,
    home: &Path,
    job_name: &str,
    model: &str,
    force: bool,
) -> Result<Value> {
    let job = job(job_name)?;
    let model = model.trim();
    if !model.is_empty() && job.name != "voice" && !force {
        let checked = check(start, model, job.name, true).await?;
        if checked["reachable"] == false {
            bail!(
                "{model} cannot do {} now: {}. Pass --force to save it anyway",
                job.name,
                checked["detail"]
                    .as_str()
                    .unwrap_or("the provider does not offer it")
            );
        }
    }
    let mut settings = Settings::load(home)?;
    settings.set(job.setting, model)?;
    settings.save(home)?;
    report(start)
}
