//! `superint-video edit`: change a film the way Studio does, for the coding agent. The same
//! operations Studio sends (texts and other scene props, timing, position, opacity, fades, gain,
//! tracks; split, duplicate, delete, add), checked the same way and written in one step. With the
//! film's Studio open the change goes through it: the user sees it at once and takes it back with
//! Ctrl+Z, and nothing the user just did there is overwritten.
use crate::{live, model::Manifest, project::ProjectStore};
use anyhow::{Context, Result, bail, ensure};
use serde_json::{Map, Value, json};
use std::{
    collections::{BTreeMap, BTreeSet},
    io::Read,
    path::Path,
    time::Duration,
};

/// What `edit` is given: operations as JSON, and the shorthand for one clip.
pub struct Request<'a> {
    /// One operation or a list, as JSON; `-` reads it from stdin, `@file` from a file.
    pub operations: Option<&'a str>,
    pub clip: Option<&'a str>,
    /// `key=value` for the clip's scene props.
    pub props: &'a [String],
    /// `field=value` for the clip itself; `transform.x=40` for one coordinate.
    pub sets: &'a [String],
    /// Check only; nothing is written.
    pub dry_run: bool,
}

/// Checks the operations against the film, then applies them as one step.
pub async fn run(project: &Path, request: &Request<'_>) -> Result<Value> {
    let mut store = ProjectStore::open(project)?;
    let operations = operations(request, &store.manifest)?;
    // Checked here first, so a mistake names its operation and nothing is touched.
    let mut next = store.manifest.clone();
    for (index, operation) in operations.iter().enumerate() {
        next = next
            .apply_operation(operation)
            .with_context(|| format!("operation {} of {}", index + 1, operations.len()))?;
    }
    let mut answer = difference(&store.manifest, &next);
    if request.dry_run {
        answer["dryRun"] = json!(true);
        return Ok(answer);
    }
    let studio = live::Server::studio(&store.root).running().await;
    answer["revision"] = json!(match &studio {
        Some(url) => through_studio(url, &operations).await?,
        None => {
            let revision = store.revision.clone();
            store.edit_many(&revision, &operations)?;
            store.revision.clone()
        }
    });
    answer["through"] = json!(if studio.is_some() { "studio" } else { "file" });
    if studio.is_some() {
        answer["undo"] = json!("The user takes it back with Ctrl+Z in Studio");
    }
    Ok(answer)
}

fn operations(request: &Request, film: &Manifest) -> Result<Vec<Value>> {
    let mut operations = Vec::new();
    if let Some(text) = request.operations {
        let source = match text {
            "-" => {
                let mut source = String::new();
                std::io::stdin().read_to_string(&mut source)?;
                source
            }
            _ if text.starts_with('@') => std::fs::read_to_string(&text[1..])
                .with_context(|| format!("cannot read {}", &text[1..]))?,
            _ => text.to_string(),
        };
        let value: Value = serde_json::from_str(source.trim_start_matches('\u{feff}'))
            .context("Operations are JSON: one operation or a list of them")?;
        match value {
            Value::Array(list) => operations.extend(list),
            single => operations.push(single),
        }
    }
    if request.props.is_empty() && request.sets.is_empty() {
        ensure!(request.clip.is_none(), "--clip goes with --prop or --set");
    } else {
        let id = request.clip.context("--prop and --set need --clip <id>")?;
        let clip = film
            .clips
            .iter()
            .find(|clip| clip.id == id)
            .with_context(|| format!("No clip {id}; `inspect <dir> --json` lists the clips"))?;
        let mut changes = Map::new();
        for pair in request.sets {
            let (path, text) = pair_of(pair)?;
            match path.split_once('.') {
                Some(("transform", field)) => {
                    let transform = changes
                        .entry("transform")
                        .or_insert_with(|| json!({}))
                        .as_object_mut()
                        .expect("transform is an object");
                    transform.insert(field.to_string(), value_of(text, None));
                }
                Some(_) => bail!("Only transform has fields of its own: --set transform.x=40"),
                None if path == "props" => bail!("Scene props go with --prop key=value"),
                None => {
                    changes.insert(path.to_string(), value_of(text, None));
                }
            }
        }
        if !request.props.is_empty() {
            // Studio keeps a clip's props whole, so the others stay as they are.
            let mut props = clip.props.clone();
            for pair in request.props {
                let (key, text) = pair_of(pair)?;
                props.insert(key.to_string(), value_of(text, clip.props.get(key)));
            }
            changes.insert("props".into(), Value::Object(props));
        }
        operations.push(json!({"type": "updateClip", "id": id, "changes": changes}));
    }
    ensure!(
        !operations.is_empty(),
        "Nothing to change: give operations as JSON, or --clip <id> with --prop or --set"
    );
    Ok(operations)
}

fn pair_of(pair: &str) -> Result<(&str, &str)> {
    pair.split_once('=')
        .filter(|(key, _)| !key.is_empty())
        .with_context(|| format!("{pair} is not key=value"))
}

/// A value as typed: a text stays text where the prop holds text now; otherwise JSON when it
/// reads as JSON (96, true, "1984"), else text.
fn value_of(text: &str, now: Option<&Value>) -> Value {
    if matches!(now, Some(Value::String(_))) {
        return json!(text);
    }
    serde_json::from_str(text).unwrap_or_else(|_| json!(text))
}

/// The clips an edit changed or added, the ones it removed and, when they changed, the film's
/// own fields.
fn difference(before: &Manifest, after: &Manifest) -> Value {
    let old: BTreeMap<&str, Value> = before
        .clips
        .iter()
        .map(|clip| (clip.id.as_str(), json!(clip)))
        .collect();
    let changed: Vec<Value> = after
        .clips
        .iter()
        .map(|clip| (clip.id.as_str(), json!(clip)))
        .filter(|(id, clip)| old.get(id) != Some(clip))
        .map(|(_, clip)| clip)
        .collect();
    let kept: BTreeSet<&str> = after.clips.iter().map(|clip| clip.id.as_str()).collect();
    let removed: Vec<&str> = old
        .keys()
        .filter(|id| !kept.contains(*id))
        .copied()
        .collect();
    let without_clips = |film: &Manifest| {
        let mut value = json!(film);
        value.as_object_mut().map(|fields| fields.remove("clips"));
        value
    };
    let mut answer = json!({"changed": changed, "removed": removed});
    let film = without_clips(after);
    if without_clips(before) != film {
        answer["film"] = film;
    }
    answer
}

/// Hands the operations to the film's open Studio, which writes them as one undo step.
async fn through_studio(url: &str, operations: &[Value]) -> Result<String> {
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(120))
        .build()?;
    let project: Value = client
        .get(format!("{url}/api/project"))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    let response = client
        .post(format!("{url}/api/edit"))
        .header(
            "X-Superint-Token",
            project["token"].as_str().context("Studio gave no token")?,
        )
        .json(&json!({"revision": project["revision"], "operation": operations}))
        .send()
        .await?;
    let status = response.status();
    let answer: Value = response.json().await.unwrap_or_default();
    if !status.is_success() {
        bail!(
            "Studio did not take the change: {}",
            answer["message"].as_str().unwrap_or(status.as_str())
        );
    }
    Ok(answer["revision"].as_str().unwrap_or_default().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn film() -> Manifest {
        serde_json::from_value(json!({"version":1,"width":1920,"height":1080,"fps":{"num":30,"den":1},"durationFrames":120,
            "tracks":[{"id":"visuals","kind":"visual"}],
            "clips":[{"id":"intro","type":"scene","src":"scenes/intro.html","track":"visuals","startFrame":0,"durationFrames":120,
                "props":{"title":"Hello","size":96}}]}))
        .unwrap()
    }

    fn request<'a>(clip: &'a str, props: &'a [String], sets: &'a [String]) -> Request<'a> {
        Request {
            operations: None,
            clip: Some(clip),
            props,
            sets,
            dry_run: true,
        }
    }

    #[test]
    fn the_shorthand_keeps_the_other_props_and_their_kinds() {
        let props = ["title=1984".to_string(), "size=120".to_string()];
        let sets = ["opacity=0.5".to_string(), "transform.x=40".to_string()];
        let operations = operations(&request("intro", &props, &sets), &film()).unwrap();
        assert_eq!(
            operations,
            vec![json!({"type":"updateClip","id":"intro","changes":{
                "opacity":0.5, "transform":{"x":40}, "props":{"title":"1984","size":120}}})]
        );
        let next = film().apply_operation(&operations[0]).unwrap();
        let answer = difference(&film(), &next);
        assert_eq!(answer["changed"][0]["props"]["title"], "1984");
        assert_eq!(answer["changed"][0]["transform"]["x"], 40.0);
        assert!(answer.get("film").is_none());
    }

    #[test]
    fn mistakes_say_what_to_write() {
        let props = ["title".to_string()];
        assert!(operations(&request("intro", &props, &[]), &film()).is_err());
        let sets = ["props.title=x".to_string()];
        assert!(operations(&request("intro", &[], &sets), &film()).is_err());
        assert!(operations(&request("missing", &props, &[]), &film()).is_err());
    }

    #[test]
    fn a_list_of_operations_reports_what_it_changed() {
        let text = r#"[{"type":"splitClip","id":"intro","frame":60},{"type":"updateProject","changes":{"name":"Neu"}}]"#;
        let request = Request {
            operations: Some(text),
            clip: None,
            props: &[],
            sets: &[],
            dry_run: true,
        };
        let list = operations(&request, &film()).unwrap();
        let mut next = film();
        for operation in &list {
            next = next.apply_operation(operation).unwrap();
        }
        let answer = difference(&film(), &next);
        assert_eq!(answer["changed"].as_array().unwrap().len(), 2);
        assert_eq!(answer["removed"], json!(["intro"]));
        assert_eq!(answer["film"]["name"], "Neu");
    }
}
