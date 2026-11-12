//! Content-addressed cache for generator responses. A request hashes to a file name;
//! keys never enter the hash, so the cache can be shared and inspected safely.
use crate::project::atomic_write;
use anyhow::Result;
use serde::{Serialize, de::DeserializeOwned};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{fs, path::PathBuf};

pub struct Cache {
    dir: PathBuf,
}

impl Cache {
    pub fn new(dir: impl Into<PathBuf>) -> Self {
        Self { dir: dir.into() }
    }

    pub fn key(request: &Value) -> String {
        let mut text = String::new();
        canonical(request, &mut text);
        hex::encode(Sha256::digest(text.as_bytes()))
    }

    fn path(&self, key: &str, extension: &str) -> PathBuf {
        self.dir.join(format!("{key}.{extension}"))
    }

    pub fn bytes(&self, key: &str) -> Option<Vec<u8>> {
        fs::read(self.path(key, "bin"))
            .ok()
            .filter(|b| !b.is_empty())
    }

    pub fn put_bytes(&self, key: &str, bytes: &[u8]) -> Result<()> {
        atomic_write(&self.path(key, "bin"), bytes)
    }

    pub fn json<T: DeserializeOwned>(&self, key: &str) -> Option<T> {
        let bytes = fs::read(self.path(key, "json")).ok()?;
        serde_json::from_slice(&bytes).ok()
    }

    pub fn put_json<T: Serialize>(&self, key: &str, value: &T) -> Result<()> {
        atomic_write(&self.path(key, "json"), &serde_json::to_vec_pretty(value)?)
    }

    pub fn contains(&self, key: &str) -> bool {
        self.path(key, "bin").is_file() || self.path(key, "json").is_file()
    }
}

/// JSON with object keys sorted, so equal requests hash equally whatever the map order.
fn canonical(value: &Value, out: &mut String) {
    match value {
        Value::Object(map) => {
            let mut entries: Vec<_> = map.iter().collect();
            entries.sort_by(|a, b| a.0.cmp(b.0));
            out.push('{');
            for (index, (key, value)) in entries.into_iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                out.push_str(&Value::String(key.clone()).to_string());
                out.push(':');
                canonical(value, out);
            }
            out.push('}');
        }
        Value::Array(items) => {
            out.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                canonical(item, out);
            }
            out.push(']');
        }
        other => out.push_str(&other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn same_request_same_key_and_round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let cache = Cache::new(dir.path());
        let a = Cache::key(&json!({"model": "m", "text": "Hallo", "take": 1}));
        let b = Cache::key(&json!({"take": 1, "text": "Hallo", "model": "m"}));
        let c = Cache::key(&json!({"model": "m", "text": "Hallo", "take": 2}));
        assert_eq!(a, b);
        assert_ne!(a, c);
        assert!(cache.bytes(&a).is_none());
        cache.put_bytes(&a, b"RIFF").unwrap();
        assert_eq!(cache.bytes(&a).unwrap(), b"RIFF");
        cache.put_json(&c, &json!({"x": 1})).unwrap();
        assert_eq!(cache.json::<Value>(&c).unwrap()["x"], 1);
        assert!(cache.contains(&a) && cache.contains(&c));
    }
}
