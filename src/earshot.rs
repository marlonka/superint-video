//! Bridge to Earshot (MIT, a separate Python tool): the sound bank, kit rendering, the
//! model-free audit and `listen`. Only `listen` sends anything anywhere: the audio, to Google.
use crate::process;
use anyhow::{Context, Result, bail};
use serde_json::Value;
use std::{ffi::OsStr, path::Path, time::Duration};
use tokio_util::sync::CancellationToken;

/// Why Earshot cannot be started, and how the user gets it.
fn missing() -> anyhow::Error {
    anyhow::anyhow!(
        "Earshot is not reachable. The user installs it from Setup in the app (`superint-video app`), or: {} (not `pip install earshot`, a different package of the same name). SUPERINT_EARSHOT may point at its executable; superint-video has no fallback synthesis",
        crate::app::EARSHOT_INSTALL
    )
}

/// Run earshot with `args` and parse its JSON output.
pub async fn json<I, S>(args: I, timeout: Duration) -> Result<Value>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let mut cmd = process::command(process::binary("earshot"));
    cmd.args(args);
    let bytes = match process::output(cmd, &CancellationToken::new(), timeout).await {
        Ok(bytes) => bytes,
        Err(error) if error.to_string().starts_with("Could not start") => return Err(missing()),
        Err(error) => return Err(error.context("earshot failed")),
    };
    serde_json::from_slice(&bytes).context("earshot did not print JSON")
}

/// Version and bank for doctor; `None` when earshot cannot be started.
pub async fn version() -> Option<Value> {
    let list = json(["sfx", "list", "--json"], Duration::from_secs(60))
        .await
        .ok()?;
    Some(serde_json::json!({
        "version": list["version"],
        "sounds": list["sounds"].as_array().map_or(0, Vec::len),
    }))
}

/// The bank, optionally narrowed to one category. Claude picks sounds from this list.
pub async fn list(category: Option<&str>) -> Result<Value> {
    let mut list = json(["sfx", "list", "--json"], Duration::from_secs(60)).await?;
    if let Some(category) = category
        && let Some(sounds) = list["sounds"].as_array_mut()
    {
        sounds.retain(|sound| sound["category"] == category);
    }
    Ok(list)
}

/// Render every take of `kit` into `out` (cached by Earshot) and audit them. The audit
/// result comes back next to the lock; problems are reported, not hidden.
pub async fn kit(kit: &Path, out: &Path) -> Result<(Value, Value)> {
    let timeout = Duration::from_secs(600);
    let render = json(
        [
            OsStr::new("kit"),
            OsStr::new("render"),
            kit.as_os_str(),
            OsStr::new("--out"),
            out.as_os_str(),
            OsStr::new("--json"),
        ],
        timeout,
    )
    .await?;
    let check = json(
        [
            OsStr::new("kit"),
            OsStr::new("check"),
            kit.as_os_str(),
            OsStr::new("--out"),
            out.as_os_str(),
            OsStr::new("--json"),
        ],
        timeout,
    )
    .await?;
    Ok((render, check))
}

/// What to ask Earshot's audio-LLM critic about one file.
pub struct Listen<'a> {
    pub file: &'a Path,
    pub question: Option<&'a str>,
    pub video: Option<&'a Path>,
    pub start: Option<f64>,
    pub end: Option<f64>,
}

/// `earshot llm`: a hosted audio model listens to `file` (only its audio is uploaded, to Google
/// with the project's `GEMINI_API_KEY`) and answers Earshot's film-sound rubric plus the
/// question. Our voices, music and SFX are generated on purpose, so synthesis is not a flaw.
/// The answer is saved to `process/listen/<file stem>.json` so the Studio shows it; a passage
/// gets a file of its own.
pub async fn listen(root: &Path, request: Listen<'_>) -> Result<Value> {
    let keys = crate::env::Keys::load(root)?;
    let key = keys.require(crate::env::GEMINI)?;
    let mut cmd = process::command(process::binary("earshot"));
    cmd.arg("llm")
        .arg(request.file)
        .args(["--yes-upload", "--synth-intended", "--json"])
        .env(crate::env::GEMINI, key.expose());
    if let Some(question) = request.question {
        cmd.arg("--prompt").arg(question);
    }
    if let Some(video) = request.video {
        cmd.arg("--video").arg(video);
    }
    if let Some(start) = request.start {
        cmd.arg("--start").arg(start.to_string());
    }
    if let Some(end) = request.end {
        cmd.arg("--end").arg(end.to_string());
    }
    let bytes =
        match process::output(cmd, &CancellationToken::new(), Duration::from_secs(900)).await {
            Ok(bytes) => bytes,
            Err(error) if error.to_string().starts_with("Could not start") => return Err(missing()),
            Err(error) => bail!("earshot llm failed: {}", keys.redact(&format!("{error:#}"))),
        };
    let answer: Value = serde_json::from_slice(&bytes).context("earshot llm did not print JSON")?;
    let stem = request
        .file
        .file_stem()
        .and_then(OsStr::to_str)
        .unwrap_or("audio");
    let name = answer_name(stem, request.start, request.end);
    let out = root.join(LISTEN).join(&name);
    std::fs::create_dir_all(out.parent().context("listen path has no parent")?)?;
    crate::project::atomic_write(&out, &serde_json::to_vec_pretty(&answer)?)?;
    Ok(serde_json::json!({
        "saved": format!("{LISTEN}/{name}"),
        "answer": answer,
    }))
}

/// The file an answer is kept in. A passage (`--start`, `--end`) gets a name of its own, so it
/// does not replace what was said about the whole file: `master.json`, `master-150-155s.json`.
fn answer_name(stem: &str, start: Option<f64>, end: Option<f64>) -> String {
    let seconds = |value: f64| format!("{}", (value * 10.0).round() / 10.0).replace('.', "_");
    match (start, end) {
        (None, None) => format!("{stem}.json"),
        (start, end) => format!(
            "{stem}-{}-{}s.json",
            seconds(start.unwrap_or(0.0)),
            end.map_or_else(|| "end".to_string(), seconds)
        ),
    }
}

/// Where `listen` keeps its answers inside a project.
pub const LISTEN: &str = "process/listen";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_passage_keeps_its_answer_apart_from_the_whole_file() {
        assert_eq!(answer_name("master", None, None), "master.json");
        assert_eq!(
            answer_name("master", Some(150.0), Some(155.5)),
            "master-150-155_5s.json"
        );
        assert_eq!(answer_name("film", None, Some(12.0)), "film-0-12s.json");
        assert_eq!(answer_name("film", Some(240.0), None), "film-240-ends.json");
    }
}
