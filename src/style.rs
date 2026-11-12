//! Making a style. A vision model, asked with the user's own key, looks at pictures the user
//! likes and at what they say about the look, or at a finished film, and writes the look
//! contract. The tool turns the answer into a user preset: `STYLE.md`, `preset.json`, the kit's
//! tokens and the pictures as references. The model writes rules and values only; no code of
//! its making ends up in a style, and what it names (colours, a font, a voice) is checked
//! against what the tool has before it is written.
//!
//! The instructions the model follows are `prompts/style.md`.
use crate::{
    home, live, polish,
    preset::{self, CONFIG, Music, Preset, PresetConfig, REFERENCES, Translation},
    production,
    providers::{self, Generators, Picture, Provider, StyleRequest, Written},
};
use anyhow::{Context, Result, bail, ensure};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

pub const PROMPT: &str = include_str!("../prompts/style.md");
/// The line between the two parts of the model's answer.
const DIVIDER: &str = "=== STYLE.md ===";
/// A file whose text stands in for the model's answer, so the way from an answer to a style
/// can be tried and tested without asking a model.
const ANSWER_FILE: &str = "SUPERINT_STYLE_ANSWER";
/// The most reference pictures one style is made from, and the largest one of them.
pub const MOST_PICTURES: usize = 12;
pub const MOST_PICTURE_BYTES: usize = 20 * 1024 * 1024;
/// The longest description of a look.
pub const MOST_WORDS: usize = 6000;
/// A model sees a picture no larger than this on its longer side: enough for colour, shape and
/// type, and small enough that a dozen fit in one request.
const SEEN_SIZE: u32 = 1568;
/// A still of a film is kept as a reference no larger than this.
const STILL_SIZE: u32 = 1920;
/// How much of a film's documents the model reads.
const MOST_DOCUMENT: usize = 28_000;
/// The files of a film that are its look in code and travel with a style made from it.
const FILM_CODE: &[&str] = &["kit/", "scenes/lib/", "blocks/", "tools/"];
const MOST_CODE_BYTES: usize = 256 * 1024 * 1024;

/// The fonts a style can take: the tool's library, with the weights each has and what stands
/// in while it loads. A range is a variable font.
const FONTS: &[(&str, Weights, &str)] = &[
    ("Geist", Weights::Range(100, 900), "system-ui, sans-serif"),
    ("Nunito", Weights::Range(200, 1000), "system-ui, sans-serif"),
    ("Jost", Weights::Of(&[500, 700]), "system-ui, sans-serif"),
    ("Fraunces", Weights::Of(&[600, 900]), "Georgia, serif"),
    ("Courier Prime", Weights::Of(&[400, 700]), "monospace"),
    ("JetBrains Mono", Weights::Of(&[400, 700]), "monospace"),
    ("Caveat", Weights::Of(&[700]), "cursive"),
];
#[derive(Clone, Copy)]
enum Weights {
    Range(u32, u32),
    Of(&'static [u32]),
}
impl Weights {
    /// The weight the font has that is nearest to the one asked for.
    fn nearest(self, wanted: u32) -> u32 {
        match self {
            Self::Range(low, high) => wanted.clamp(low, high),
            Self::Of(weights) => weights
                .iter()
                .copied()
                .min_by_key(|weight| weight.abs_diff(wanted))
                .unwrap_or(wanted),
        }
    }
}
/// The colours every style from pictures names, in the order the kit lists them.
const TOKENS: &[&str] = &["ground", "surface", "line", "ink", "muted", "accent"];
/// Names in the kit's `:root` that a further colour must not take.
const TAKEN_TOKENS: &[&str] = &["font", "safe", "weight-display", "weight-text", "tracking"];
const VOICES: &[&str] = &["Sadaltager", "Charon", "Kore", "Puck"];
const WORKFLOWS: &[&str] = &["superint-explainer", "superint-launch"];

/// A picture the user gave, as it came.
pub struct Reference {
    pub name: String,
    pub bytes: Vec<u8>,
}

/// What the user wants a style from: pictures they like, what they say about the look, and
/// the name it should have. Either of the first two is enough.
#[derive(Default)]
pub struct Wish {
    pub name: Option<String>,
    pub describe: String,
    pub references: Vec<Reference>,
    /// The language films in this style speak unless a film says otherwise ("de"): the
    /// user's own.
    pub language: Option<String>,
}

/// A style that was made.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Made {
    pub name: String,
    pub title: String,
    pub path: PathBuf,
    /// The model that wrote it and the way that carried the request.
    pub model: String,
    pub route: Option<Provider>,
    pub references: usize,
}

// --------------------------------------------------------------------------------- the answer

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
struct Words {
    en: String,
    de: String,
}
#[derive(Debug, Default, Deserialize)]
#[serde(default)]
struct Colour {
    name: String,
    hex: String,
    #[serde(rename = "use")]
    used: String,
}
/// The first part of the answer. Everything is optional here; `checked` says what is missing.
#[derive(Debug, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct Sheet {
    title: Words,
    description: Words,
    essence: String,
    palette: BTreeMap<String, String>,
    more: Vec<Colour>,
    uses: BTreeMap<String, String>,
    font: Option<String>,
    display_weight: Option<f64>,
    text_weight: Option<f64>,
    tracking: Option<f64>,
    seconds: Option<f64>,
    workflow: Option<String>,
    voice: Option<String>,
    music: Option<String>,
}

/// One line of plain text: no line breaks, no markdown marks around it.
fn line(text: &str, most: usize) -> String {
    let joined = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let plain = joined.trim_matches(['"', '\'', '`', '*', '#', ' ', '„', '“', '”']);
    plain.chars().take(most).collect::<String>().trim().into()
}

/// `#rgb` or `#rrggbb` as lower-case `#rrggbb`.
fn hex(text: &str) -> Option<String> {
    let digits = text.trim().strip_prefix('#')?;
    if !digits.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    match digits.len() {
        3 => Some(format!(
            "#{}",
            digits
                .chars()
                .flat_map(|c| [c, c])
                .collect::<String>()
                .to_ascii_lowercase()
        )),
        6 => Some(format!("#{}", digits.to_ascii_lowercase())),
        _ => None,
    }
}

/// The two parts of an answer: the sheet and the body of the look contract.
fn parse(answer: &str) -> Result<(Sheet, String)> {
    let at = answer
        .find(DIVIDER)
        .or_else(|| answer.find("=== STYLE.md"))
        .context(
            "The model's answer has no look contract (the line === STYLE.md === is missing)",
        )?;
    let (head, rest) = answer.split_at(at);
    let json = head
        .find('{')
        .zip(head.rfind('}'))
        .filter(|(from, to)| from < to)
        .map(|(from, to)| &head[from..=to])
        .context("The model's answer has no JSON part")?;
    let sheet: Sheet =
        serde_json::from_str(json).context("The JSON part of the model's answer is not valid")?;
    // The contract starts at its first section: the tool writes the title and the opening.
    let body = rest
        .lines()
        .skip(1)
        .skip_while(|line| !line.starts_with("## "))
        .collect::<Vec<_>>()
        .join("\n");
    ensure!(
        !body.is_empty(),
        "The look contract in the model's answer has no sections"
    );
    let body = body.trim().trim_end_matches("```").trim_end();
    ensure!(
        body.len() >= 600,
        "The look contract in the model's answer is too short to be one"
    );
    Ok((sheet, body.to_string()))
}

/// What a sheet says once it is checked: the parts every style has.
struct Identity {
    title: String,
    title_de: Option<String>,
    description: String,
    description_de: Option<String>,
    essence: String,
    seconds: u32,
    workflow: Option<String>,
    voice: Option<String>,
    music: Option<String>,
}

impl Identity {
    fn of(sheet: &Sheet, given: Option<&str>) -> Result<Self> {
        let given = given.map(|name| line(name, 60)).filter(|n| !n.is_empty());
        let title = given.clone().unwrap_or_else(|| line(&sheet.title.en, 60));
        ensure!(!title.is_empty(), "The model's answer names no title");
        let description = line(&sheet.description.en, 320);
        ensure!(
            !description.is_empty(),
            "The model's answer has no description"
        );
        let essence = sheet.essence.trim().to_string();
        ensure!(
            essence.len() >= 40,
            "The model's answer does not say what the look is"
        );
        let other = |text: &str, most| Some(line(text, most)).filter(|t| !t.is_empty());
        let known = |value: &Option<String>, among: &[&str]| {
            value
                .as_deref()
                .map(str::trim)
                .and_then(|v| among.iter().find(|known| known.eq_ignore_ascii_case(v)))
                .map(|known| known.to_string())
        };
        Ok(Self {
            // A name the user gave is the same in every language.
            title_de: if given.is_some() {
                None
            } else {
                other(&sheet.title.de, 60).filter(|de| *de != title)
            },
            title,
            description_de: other(&sheet.description.de, 320),
            description,
            essence,
            seconds: sheet
                .seconds
                .map_or(45, |s| s.clamp(15.0, 600.0).round() as u32),
            workflow: known(&sheet.workflow, WORKFLOWS),
            voice: known(&sheet.voice, VOICES),
            music: sheet
                .music
                .as_deref()
                .map(|m| line(m, 600))
                .filter(|m| m.len() >= 20),
        })
    }

    /// Writes the identity into a preset's configuration, under a name no style has yet.
    fn name(&self, config: &mut PresetConfig, styles: &Path) {
        let base = match home::slug(&self.title) {
            slug if slug == "film" => "style".to_string(),
            slug => slug,
        };
        let (name, copy) = preset::free_name(&base, styles);
        let numbered = |title: &str| {
            if copy > 1 {
                format!("{title} ({copy})")
            } else {
                title.to_string()
            }
        };
        config.name = name;
        config.title = numbered(&self.title);
        config.description = self.description.clone();
        config.translations = BTreeMap::new();
        if self.title_de.is_some() || self.description_de.is_some() {
            config.translations.insert(
                "de".into(),
                Translation {
                    title: self.title_de.as_deref().map(numbered),
                    description: self.description_de.clone(),
                },
            );
        }
        config.defaults.seconds = self.seconds;
    }
}

/// The tokens of a style from pictures.
struct Look {
    /// The six colours of `TOKENS`, in that order, then the further ones: name, hex, use.
    colours: Vec<(String, String, String)>,
    font: &'static str,
    fallback: &'static str,
    display_weight: u32,
    text_weight: u32,
    tracking: f64,
}

impl Look {
    fn of(sheet: &Sheet) -> Result<Self> {
        let mut colours = Vec::new();
        for token in TOKENS {
            let value = sheet
                .palette
                .get(*token)
                .and_then(|value| hex(value))
                .with_context(|| format!("The model's answer has no colour for {token}"))?;
            let used = sheet.uses.get(*token).map(|u| line(u, 140));
            colours.push((token.to_string(), value, used.unwrap_or_default()));
        }
        for colour in sheet.more.iter().take(6) {
            let name = colour
                .name
                .trim()
                .to_ascii_lowercase()
                .replace([' ', '_'], "-");
            let plain = !name.is_empty()
                && name.len() <= 24
                && name.starts_with(|c: char| c.is_ascii_lowercase())
                && name
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
            let free = !TAKEN_TOKENS.contains(&name.as_str())
                && colours.iter().all(|(taken, _, _)| *taken != name);
            if let (true, true, Some(value)) = (plain, free, hex(&colour.hex)) {
                colours.push((name, value, line(&colour.used, 140)));
            }
        }
        let wanted = sheet.font.as_deref().unwrap_or_default().trim();
        let (font, weights, fallback) = FONTS
            .iter()
            .find(|(family, _, _)| family.eq_ignore_ascii_case(wanted))
            .copied()
            .unwrap_or(FONTS[0]);
        let weight = |asked: Option<f64>, usual: u32| {
            weights.nearest(asked.map_or(usual, |w| w.clamp(100.0, 1000.0).round() as u32))
        };
        Ok(Self {
            colours,
            font,
            fallback,
            display_weight: weight(sheet.display_weight, 700),
            text_weight: weight(sheet.text_weight, 500),
            tracking: (sheet.tracking.unwrap_or(-0.02).clamp(-0.05, 0.1) * 1000.0).round() / 1000.0,
        })
    }

    fn colour(&self, token: &str) -> &str {
        self.colours
            .iter()
            .find(|(name, _, _)| name == token)
            .map_or("#000000", |(_, value, _)| value)
    }

    /// The kit's `:root` with this look's tokens.
    fn root(&self) -> String {
        let mut root = String::from(":root {\n");
        for (name, value, _) in &self.colours {
            root.push_str(&format!("  --{name}: {value};\n"));
        }
        root.push_str(&format!(
            "\n  --font: '{}', {};\n  --weight-display: {};\n  --weight-text: {};\n  --tracking: {}em;\n  --safe: 7vmin;\n}}",
            self.font, self.fallback, self.display_weight, self.text_weight, self.tracking
        ));
        root
    }

    /// The tokens as the look contract lists them.
    fn table(&self) -> String {
        let mut table = String::from("| Token | Value | Use |\n| --- | --- | --- |\n");
        for (name, value, used) in &self.colours {
            table.push_str(&format!(
                "| `--{name}` | `{value}` | {} |\n",
                used.replace('|', "/")
            ));
        }
        table.push_str(&format!(
            "| `--font` | {} | The main font. Display weight {} (`--weight-display`), text weight {} (`--weight-text`), headline tracking {}em (`--tracking`) |\n",
            self.font, self.display_weight, self.text_weight, self.tracking
        ));
        table
    }
}

// ------------------------------------------------------------------------------ the contract

fn opening(title: &str, essence: &str) -> String {
    format!(
        "# {title}: art direction\n\n{essence}\n\n\
This file is the look contract for every film in this style: colour, shapes, light, type, composition and motion. How a film is planned, paced and cut comes from its workflow skill. Read this file before writing scenes and follow it unless `brief.md` says otherwise. `direction.md` makes it concrete for one film, within these rules.\n\n"
    )
}

const KIT: &str = "## Kit (`kit/kit.js`)

This style starts from the neutral kit: helpers for motion and text, and no drawing library of its own yet.

| Function | Purpose |
| --- | --- |
| `fontsReady` | Pass as `ready` so the first frame is set in the style's font |
| `enter(time, at)` | Spring 0→1 starting at `at` s (overshoots) |
| `between(time, from, to)` | Eased 0→1 |
| `visible(time, in, out)` | Fade in and out |
| `rise(el, p)`, `pop(el, p)` | Apply a progress to an element |
| `drift(stage, time)`, `bob(seed, time)` | Camera drift and floating |
| `splitWords`, `revealWords` | Per-word text reveal with `*accent*` |
| `fitText(el, {max, width, lines})` | Shrink long text to fit (vmin) |
| `count(p, from, to)` | Locale-formatted counting number |
| `el(tag, attrs, parent)`, `fitSvg(svg, w, h)` | Create SVG elements; viewBox in output pixels |
| `once(build)` | Build a layout on the first frame from `context.width/height` |
| `drawable(path)`, `draw(path, p)` | Draw a stroke progressively |
| `color(name)`, `shade(hex, amount)` | Theme colours and tone steps |
| `checkCameraProps`, `checkCamera(props)`, `frameCheckCamera(props, w, h)` | Check camera for `review --camera` close-ups |

When a film in this style builds something worth keeping (a character rig, a drawing library, a block), copy it into this style's folder (`scenes/lib/`, `blocks/`) and describe it here, so the next film starts with it.
";

/// The whole `STYLE.md` of a style from pictures.
fn contract_from_references(
    identity: &Identity,
    look: &Look,
    body: &str,
    pictures: usize,
) -> String {
    let references = if pictures == 0 {
        "This style was written from a description alone. Add pictures of the look to `references/` (in the app: Styles, the style's menu) so style frames and contact sheets have something to be judged against.".to_string()
    } else {
        format!(
            "This style was written from the {pictures} picture{} in `references/`. They show the look, never content: no film copies their subjects, characters, logos or layouts. Judge every style frame and contact sheet next to them.",
            if pictures == 1 { "" } else { "s" }
        )
    };
    format!(
        "{}{body}\n\n## Tokens (`kit/theme.css`)\n\n{}\nScenes read them as `var(--accent)` in CSS or `color('accent')` from the kit. Change a value here and in `kit/theme.css` together.\n\n{KIT}\n## References\n\n{references}\n",
        opening(&identity.title, &identity.essence),
        look.table(),
    )
}

/// The whole `STYLE.md` of a style from a finished film.
fn contract_from_film(identity: &Identity, body: &str, code: &[String]) -> String {
    let came_along = if code.is_empty() {
        "The pictures in `references/` are stills of that film and the references it was measured against.".to_string()
    } else {
        let folders: Vec<String> = FILM_CODE
            .iter()
            .filter(|folder| code.iter().any(|file| file.starts_with(*folder)))
            .map(|folder| format!("`{folder}`"))
            .collect();
        format!(
            "Its look in code ({}) came along as it was; the pictures in `references/` are stills of that film and the references it was measured against.",
            folders.join(", ")
        )
    };
    format!(
        "{}{body}\n\n## Where this style comes from\n\nThis style was generalised from a finished film. {came_along} They show the look, never content: a new film takes the look and brings its own subject, cast and places.\n",
        opening(&identity.title, &identity.essence),
    )
}

// --------------------------------------------------------------------------------- pictures

/// A picture as the model is shown it: PNG and JPEG no larger than `SEEN_SIZE`, as JPEG on
/// white where it was transparent; WebP as it is.
fn seen(name: &str, bytes: &[u8]) -> Result<Picture> {
    use image::ImageFormat;
    match image::guess_format(bytes).ok() {
        Some(ImageFormat::Png | ImageFormat::Jpeg) => {
            let picture = image::load_from_memory(bytes)
                .with_context(|| format!("{name} cannot be read as a picture"))?;
            let jpeg = image::guess_format(bytes).ok() == Some(ImageFormat::Jpeg);
            if jpeg && picture.width() <= SEEN_SIZE && picture.height() <= SEEN_SIZE {
                return Ok(Picture {
                    mime: "image/jpeg",
                    bytes: bytes.to_vec(),
                });
            }
            let small = if picture.width() > SEEN_SIZE || picture.height() > SEEN_SIZE {
                picture.thumbnail(SEEN_SIZE, SEEN_SIZE)
            } else {
                picture
            };
            let mut flat = image::RgbImage::new(small.width(), small.height());
            for (x, y, pixel) in small.to_rgba8().enumerate_pixels() {
                let [r, g, b, a] = pixel.0;
                let over = |c: u8| {
                    ((u32::from(c) * u32::from(a) + 255 * (255 - u32::from(a))) / 255) as u8
                };
                flat.put_pixel(x, y, image::Rgb([over(r), over(g), over(b)]));
            }
            let mut out = Vec::new();
            image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 88).encode_image(&flat)?;
            Ok(Picture {
                mime: "image/jpeg",
                bytes: out,
            })
        }
        Some(ImageFormat::WebP) => Ok(Picture {
            mime: "image/webp",
            bytes: bytes.to_vec(),
        }),
        _ => bail!("{name} is not a picture the model can read: use PNG, JPEG or WebP"),
    }
}

/// The name a reference picture is kept under: its place in the row and a plain form of its
/// own name, with the ending its content has.
fn reference_name(index: usize, name: &str, bytes: &[u8]) -> String {
    let ending = match image::guess_format(bytes).ok() {
        Some(image::ImageFormat::Png) => "png",
        Some(image::ImageFormat::WebP) => "webp",
        _ => "jpg",
    };
    let stem = Path::new(name)
        .file_stem()
        .map(|stem| stem.to_string_lossy().to_string())
        .unwrap_or_default();
    // A name that is numbered already keeps its own words only.
    let plain = match home::slug(
        stem.trim_start_matches(|c: char| c.is_ascii_digit() || c == '-' || c == '_' || c == ' '),
    ) {
        slug if slug == "film" => "picture".to_string(),
        slug => slug,
    };
    format!("{:02}-{plain}.{ending}", index + 1)
}

/// Up to `count` of a list, spread evenly from its first to its last.
fn spread<T: Clone>(all: &[T], count: usize) -> Vec<T> {
    if all.len() <= count {
        return all.to_vec();
    }
    (0..count)
        .map(|slot| all[slot * (all.len() - 1) / (count - 1).max(1)].clone())
        .collect()
}

// ------------------------------------------------------------------------------ from pictures

fn check_wish(wish: &Wish) -> Result<()> {
    ensure!(
        !wish.references.is_empty() || wish.describe.trim().len() >= 12,
        "A style needs something to go on: reference pictures, a description of the look, or both"
    );
    ensure!(
        wish.references.len() <= MOST_PICTURES,
        "A style is made from at most {MOST_PICTURES} pictures; pick the ones that show the look best"
    );
    ensure!(
        wish.describe.chars().count() <= MOST_WORDS,
        "The description is longer than {MOST_WORDS} characters"
    );
    for reference in &wish.references {
        ensure!(
            reference.bytes.len() <= MOST_PICTURE_BYTES,
            "{} is larger than 20 MB",
            reference.name
        );
    }
    Ok(())
}

fn name_line(name: Option<&str>) -> String {
    match name.map(|n| line(n, 60)).filter(|n| !n.is_empty()) {
        Some(name) => format!("The name the user gave the style: \"{name}\". Use it unchanged."),
        None => "The user gave the style no name: propose one.".into(),
    }
}

fn words_block(describe: &str) -> String {
    match describe.trim() {
        "" => "The user said nothing about the look.".into(),
        words => format!(
            "What the user says about the look, in their own words (possibly dictated, possibly German):\n\"\"\"\n{words}\n\"\"\""
        ),
    }
}

fn material_from_references(wish: &Wish) -> String {
    let pictures = match wish.references.len() {
        0 => "No pictures: write the style from the description alone, and choose every colour so that it fits what is described.".to_string(),
        1 => "One picture is attached.".to_string(),
        count => format!("{count} pictures are attached, in the order the user gave them."),
    };
    format!(
        "Task: a style from pictures.\n\n{}\n\n{}\n\n{pictures}",
        name_line(wish.name.as_deref()),
        words_block(&wish.describe),
    )
}

/// The files of a style from pictures: the neutral preset with the look's tokens, the look
/// contract and the pictures as references.
fn files_from_references(
    sheet: &Sheet,
    body: &str,
    wish: &Wish,
    styles: &Path,
) -> Result<(Preset, Identity)> {
    let identity = Identity::of(sheet, wish.name.as_deref())?;
    let look = Look::of(sheet)?;
    let mut style = Preset::builtin("blank")?;
    // References the user added to the neutral style belong to it, not to this one.
    style
        .files
        .retain(|file, _| !file.starts_with("references/"));

    identity.name(&mut style.config, styles);
    style.config.defaults.workflow = identity.workflow.clone();
    if let Some(language) = wish.language.as_deref().map(str::trim).filter(|tag| {
        (2..=12).contains(&tag.len()) && tag.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
    }) {
        style.config.defaults.language = language.to_string();
    }
    style.config.narration.words_per_minute =
        BTreeMap::from([("de".into(), 140), ("en".into(), 165), ("*".into(), 150)]);
    if let Some(voice) = &identity.voice {
        style.config.narration.model = Some(providers::AI_STUDIO.speech.into());
        style.config.narration.voice = Some(voice.clone());
    }
    style.config.music = identity.music.clone().map(|prompt| Music {
        model: providers::AI_STUDIO.music.into(),
        prompt,
    });
    style.keep_config()?;

    let text = |style: &Preset, file: &str| -> Result<String> {
        Ok(String::from_utf8(
            style
                .files
                .get(file)
                .with_context(|| format!("The neutral style has no {file}"))?
                .clone(),
        )?)
    };
    let theme = text(&style, "kit/theme.css")?;
    let from = theme.find(":root {").context("theme.css has no :root")?;
    let to = from + theme[from..].find('}').context("theme.css has no :root")? + 1;
    let top = format!(
        "/* {}: the tokens of this style, written from its references. STYLE.md is the look\n   contract. Sizes use vmin so every format shares one layout scale. */",
        style.config.title.replace("*/", "")
    );
    let rest = match theme[..from].find("*/") {
        Some(end) if theme.trim_start().starts_with("/*") => &theme[end + 2..from],
        _ => &theme[..from],
    };
    let themed = format!("{top}{rest}{}{}", look.root(), &theme[to..]);
    style.files.insert("kit/theme.css".into(), themed.into());

    // The first frame waits for the style's font, in the weight its headline has.
    let kit = text(&style, "kit/kit.js")?;
    let waits = "'700 1em Geist'";
    ensure!(kit.contains(waits), "kit.js does not wait for its font");
    let kit = kit.replace(
        waits,
        &format!("'{} 1em \"{}\"'", look.display_weight, look.font),
    );
    style.files.insert("kit/kit.js".into(), kit.into());

    let mut starter: serde_json::Value = serde_json::from_slice(&style.files["video.json"])?;
    starter["background"] = look.colour("ground").into();
    let mut starter = serde_json::to_vec_pretty(&starter)?;
    starter.push(b'\n');
    style.files.insert("video.json".into(), starter);

    for (index, reference) in wish.references.iter().enumerate() {
        style.files.insert(
            format!(
                "{REFERENCES}/{}",
                reference_name(index, &reference.name, &reference.bytes)
            ),
            reference.bytes.clone(),
        );
    }
    let contract = contract_from_references(&identity, &look, body, wish.references.len());
    style.files.insert("STYLE.md".into(), contract.into());
    let location = style.config.name.clone();
    Ok((Preset::from_files(style.files, &location)?, identity))
}

// --------------------------------------------------------------------------------- from a film

/// What a finished film brings to a style.
struct Film {
    /// What the film was about: named to the model so it can leave it out.
    topic: Option<String>,
    workflow: Option<String>,
    /// The preset the film was made from, as the film holds it.
    config: Option<PresetConfig>,
    style: String,
    direction: String,
    tokens: String,
    /// Kit, drawing libraries, blocks and tools, by their path in the film.
    code: BTreeMap<String, Vec<u8>>,
    /// Stills of the film, as JPEG, and what each is.
    stills: Vec<(String, Vec<u8>)>,
    /// The references the film was measured against, as they are.
    references: Vec<Reference>,
}

fn is_picture(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)
        .is_some_and(|e| ["png", "jpg", "jpeg", "webp"].contains(&e.as_str()))
}

fn pictures_in(folder: &Path, prefix: &str) -> Vec<PathBuf> {
    let mut found: Vec<PathBuf> = fs::read_dir(folder)
        .into_iter()
        .flatten()
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && is_picture(path)
                && path
                    .file_name()
                    .is_some_and(|name| name.to_string_lossy().starts_with(prefix))
        })
        .collect();
    found.sort();
    found
}

fn document(root: &Path, file: &str) -> String {
    let text = fs::read_to_string(root.join(file)).unwrap_or_default();
    match text.char_indices().nth(MOST_DOCUMENT) {
        Some((cut, _)) => format!("{}\n[… shortened]", &text[..cut]),
        None => text,
    }
}

impl Film {
    fn read(root: &Path) -> Result<Self> {
        ensure!(
            root.join("video.json").is_file(),
            "{} is not a film: it has no video.json",
            root.display()
        );
        let summary = production::summary(root);
        let said = |key: &str| summary["brief"][key].as_str().map(str::to_owned);
        let named = home::read_json(&root.join("video.json"))
            .and_then(|manifest| manifest["name"].as_str().map(str::to_owned));
        let config = fs::read(root.join(CONFIG))
            .ok()
            .and_then(|bytes| PresetConfig::parse(&bytes).ok());

        let mut code = BTreeMap::new();
        let mut size = 0;
        for folder in FILM_CODE {
            for entry in walkdir::WalkDir::new(root.join(folder))
                .follow_links(false)
                .sort_by_file_name()
                .into_iter()
                .flatten()
                .filter(|entry| entry.file_type().is_file())
            {
                let relative = entry
                    .path()
                    .strip_prefix(root)?
                    .components()
                    .map(|c| c.as_os_str().to_string_lossy())
                    .collect::<Vec<_>>()
                    .join("/");
                let bytes = fs::read(entry.path())?;
                size += bytes.len();
                ensure!(
                    size <= MOST_CODE_BYTES,
                    "The film's kit is larger than 256 MB; a style is far smaller"
                );
                code.insert(relative, bytes);
            }
        }

        // The thumbnail, the style frames, then stills from across the latest polish pass; a
        // film with none of these gives the frame its last render showed.
        let mut chosen: Vec<(String, PathBuf)> = Vec::new();
        let thumbnail = root.join("renders/thumbnail.png");
        if thumbnail.is_file() {
            chosen.push(("the film's thumbnail".into(), thumbnail));
        }
        for frame in spread(&pictures_in(&root.join("renders/frames"), ""), 3) {
            chosen.push(("a style frame of the film".into(), frame));
        }
        if let Some(pass) = polish::latest_pass(root) {
            for still in spread(&pictures_in(&pass, "frame-"), 4) {
                chosen.push(("a still of the finished film".into(), still));
            }
        }
        if chosen.is_empty() {
            let latest = root.join(live::DIR).join(live::LATEST);
            if latest.is_file() {
                chosen.push(("the frame the film's last render showed".into(), latest));
            }
        }
        let mut stills = Vec::new();
        for (what, path) in chosen {
            if let Ok(jpeg) = fs::read(&path)
                .map_err(anyhow::Error::from)
                .and_then(|bytes| live::jpeg_thumbnail(&bytes, STILL_SIZE))
            {
                stills.push((what, jpeg));
            }
        }
        let references = pictures_in(&root.join(REFERENCES), "")
            .into_iter()
            .filter_map(|path| {
                let bytes = fs::read(&path).ok()?;
                (bytes.len() <= MOST_PICTURE_BYTES).then(|| Reference {
                    name: path.file_name().unwrap().to_string_lossy().to_string(),
                    bytes,
                })
            })
            .take(MOST_PICTURES)
            .collect();

        let theme = document(root, "kit/theme.css");
        let tokens = theme
            .find(":root")
            .and_then(|from| {
                let to = from + theme[from..].find('}')? + 1;
                Some(theme[from..to].to_string())
            })
            .unwrap_or_default();
        let film = Self {
            topic: said("topic")
                .or(named)
                .filter(|topic| !topic.trim().is_empty() && topic != "Untitled"),
            workflow: said("workflow"),
            config,
            style: document(root, "STYLE.md"),
            direction: document(root, "direction.md"),
            tokens,
            code,
            stills,
            references,
        };
        ensure!(
            !film.style.trim().is_empty()
                || !film.direction.trim().is_empty()
                || !film.stills.is_empty(),
            "This film has nothing a style could be made from yet: no STYLE.md, no direction.md and no stills. Make its style frames or render it first"
        );
        Ok(film)
    }

    /// The pictures the model sees, each with what it is: the film's stills, then a few of the
    /// references it was measured against.
    fn shown(&self) -> Result<(Vec<Picture>, Vec<String>)> {
        let mut pictures = Vec::new();
        let mut captions = Vec::new();
        for (what, jpeg) in &self.stills {
            pictures.push(seen(what, jpeg)?);
            captions.push(what.clone());
        }
        let room = MOST_PICTURES.saturating_sub(pictures.len()).min(4);
        for reference in self.references.iter().take(room) {
            if let Ok(picture) = seen(&reference.name, &reference.bytes) {
                pictures.push(picture);
                captions.push("a reference the film was measured against".into());
            }
        }
        Ok((pictures, captions))
    }

    fn material(&self, name: Option<&str>, describe: &str, captions: &[String]) -> String {
        let mut text = format!(
            "Task: a style from a finished film.\n\n{}\n\n{}\n",
            name_line(name),
            match describe.trim() {
                "" => "The user said nothing more about it.".to_string(),
                _ => words_block(describe),
            }
        );
        if let Some(topic) = &self.topic {
            text.push_str(&format!(
                "\nThe film was about: \"{topic}\". That is what to recognise and leave out.\n"
            ));
        }
        if !self.code.is_empty() {
            text.push_str(&format!(
                "\nFiles that travel with the style unchanged:\n{}\n",
                self.code
                    .keys()
                    .filter(|file| !file.contains("/fonts/"))
                    .map(|file| format!("- {file}"))
                    .collect::<Vec<_>>()
                    .join("\n")
            ));
        }
        for (title, document) in [
            ("The film's look contract (STYLE.md)", &self.style),
            ("The film's direction (direction.md)", &self.direction),
            ("The film's tokens (kit/theme.css)", &self.tokens),
        ] {
            if !document.trim().is_empty() {
                text.push_str(&format!(
                    "\n----- {title} -----\n{document}\n----- end -----\n"
                ));
            }
        }
        if captions.is_empty() {
            text.push_str("\nNo pictures of the film are there: go by its documents.\n");
        } else {
            text.push_str("\nPictures attached, in order:\n");
            for (index, caption) in captions.iter().enumerate() {
                text.push_str(&format!("{}. {caption}\n", index + 1));
            }
        }
        text
    }
}

/// The files of a style from a film: the preset the film was made from, with the film's own
/// kit, libraries and blocks over it, the generalised look contract, and the film's stills and
/// references as references.
fn files_from_film(
    sheet: &Sheet,
    body: &str,
    film: Film,
    name: Option<&str>,
    styles: &Path,
) -> Result<(Preset, Identity)> {
    let identity = Identity::of(sheet, name)?;
    // The starter timeline and its scenes come from the preset the film began as; a film from
    // a preset that is gone starts from the neutral one, whose opening card needs its own kit.
    let base = film
        .config
        .as_ref()
        .and_then(|config| Preset::resolve(&config.name).ok());
    let neutral = base.is_none();
    let mut style = match base {
        Some(base) => base,
        None => Preset::builtin("blank")?,
    };
    style
        .files
        .retain(|file, _| !file.starts_with("references/"));
    let code: Vec<String> = film.code.keys().cloned().collect();
    for (file, bytes) in film.code {
        if neutral && (file == "kit/kit.js" || file == "kit/theme.css") {
            // Kept beside the neutral kit the opening card is written for.
            style
                .files
                .insert(file.replacen("kit/", "kit/film-", 1), bytes);
        } else {
            style.files.insert(file, bytes);
        }
    }
    if let Some(config) = film.config {
        style.config = config;
    }
    identity.name(&mut style.config, styles);
    if let Some(workflow) = identity.workflow.clone().or(film.workflow) {
        if preset::valid_word(&workflow, "Workflow").is_ok() {
            style.config.defaults.workflow = Some(workflow);
        }
    }
    if let Some(voice) = &identity.voice
        && style.config.narration.voice.is_none()
    {
        style.config.narration.voice = Some(voice.clone());
    }
    if let Some(prompt) = identity.music.clone() {
        style.config.music = Some(Music {
            model: style
                .config
                .music
                .take()
                .map_or(providers::AI_STUDIO.music.into(), |music| music.model),
            prompt,
        });
    }
    style.keep_config()?;

    let mut count = 0;
    for (_, jpeg) in &film.stills {
        count += 1;
        style
            .files
            .insert(format!("{REFERENCES}/film-{count:02}.jpg"), jpeg.clone());
    }
    for reference in &film.references {
        let file = format!("{REFERENCES}/{}", reference.name);
        if preset::reference_file_name(&reference.name) && !style.files.contains_key(&file) {
            style.files.insert(file, reference.bytes.clone());
        }
    }
    let contract = contract_from_film(&identity, body, &code);
    style.files.insert("STYLE.md".into(), contract.into());
    let location = style.config.name.clone();
    Ok((Preset::from_files(style.files, &location)?, identity))
}

// --------------------------------------------------------------------------------- making it

/// The model and the way a style would be written with now, or the error that names the
/// missing key. Asked before anything is read or sent.
pub fn writer(g: &Generators, chosen: Option<&str>) -> Result<(Provider, String)> {
    if let Some(model) = chosen {
        home::check_model(model, false)?;
    }
    let (route, model) = g
        .style_tries(chosen)
        .into_iter()
        .next()
        .context("No way to reach a style model")?;
    if !g.ready(route) {
        g.keys.require(route.key())?;
    }
    Ok((route, model))
}

/// The file that stands in for the model, when one is set.
fn stand_in() -> Option<std::ffi::OsString> {
    std::env::var_os(ANSWER_FILE).filter(|file| !file.is_empty())
}

/// Asks the model, or reads the answer a test put in a file.
async fn ask(
    g: &Generators,
    chosen: Option<&str>,
    material: &str,
    pictures: &[Picture],
) -> Result<Written> {
    if let Some(file) = stand_in() {
        return Ok(Written {
            text: fs::read_to_string(&file).with_context(|| format!("Reading {ANSWER_FILE}"))?,
            model: "file".into(),
            route: Provider::AiStudio,
        });
    }
    let request = StyleRequest {
        instructions: PROMPT,
        material,
        pictures,
    };
    g.write_style(&request, chosen).await
}

/// Asks until an answer can be read, twice at most: a model now and then forgets a part.
async fn answer(
    g: &Generators,
    chosen: Option<&str>,
    material: &str,
    pictures: &[Picture],
) -> Result<(Sheet, String, Written)> {
    let first = ask(g, chosen, material, pictures).await?;
    match parse(&first.text) {
        Ok((sheet, body)) => Ok((sheet, body, first)),
        Err(error) if stand_in().is_none() => {
            eprintln!("style: {error:#}; asking {} once more", first.model);
            let second = ask(g, chosen, material, pictures).await?;
            let (sheet, body) = parse(&second.text)?;
            Ok((sheet, body, second))
        }
        Err(error) => Err(error),
    }
}

/// Writes a finished style into the user's styles; nothing stays behind when that fails.
fn save(style: &Preset, written: &Written, styles: &Path) -> Result<Made> {
    let path = styles.join(&style.config.name);
    if let Err(error) = style.write_to(&path) {
        let _ = fs::remove_dir_all(&path);
        return Err(error);
    }
    Ok(Made {
        name: style.config.name.clone(),
        title: style.config.title.clone(),
        path,
        model: written.model.clone(),
        route: stand_in().is_none().then_some(written.route),
        references: style.references().len(),
    })
}

/// A new style from reference pictures and a description, saved into `styles`.
pub async fn from_references(
    g: &Generators,
    chosen: Option<&str>,
    wish: Wish,
    styles: &Path,
) -> Result<Made> {
    check_wish(&wish)?;
    if stand_in().is_none() {
        writer(g, chosen)?;
    }
    let pictures = tokio::task::block_in_place(|| {
        wish.references
            .iter()
            .map(|reference| seen(&reference.name, &reference.bytes))
            .collect::<Result<Vec<_>>>()
    })?;
    let material = material_from_references(&wish);
    let (sheet, body, written) = answer(g, chosen, &material, &pictures).await?;
    tokio::task::block_in_place(|| {
        let (style, _) = files_from_references(&sheet, &body, &wish, styles)?;
        save(&style, &written, styles)
    })
}

/// A style generalised from a finished film, saved into `styles`.
pub async fn from_film(
    g: &Generators,
    chosen: Option<&str>,
    root: &Path,
    name: Option<&str>,
    describe: &str,
    styles: &Path,
) -> Result<Made> {
    ensure!(
        describe.chars().count() <= MOST_WORDS,
        "The description is longer than {MOST_WORDS} characters"
    );
    if stand_in().is_none() {
        writer(g, chosen)?;
    }
    let (film, pictures, captions) = tokio::task::block_in_place(|| {
        let film = Film::read(root)?;
        let (pictures, captions) = film.shown()?;
        anyhow::Ok((film, pictures, captions))
    })?;
    let material = film.material(name, describe, &captions);
    let (sheet, body, written) = answer(g, chosen, &material, &pictures).await?;
    tokio::task::block_in_place(|| {
        let (style, _) = files_from_film(&sheet, &body, film, name, styles)?;
        save(&style, &written, styles)
    })
}

/// The fonts the prompt offers are the ones the tool ships.
pub fn offered_fonts() -> Vec<&'static str> {
    FONTS.iter().map(|(family, _, _)| *family).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fonts;
    use tempfile::TempDir;

    /// An answer as a model gives it, with the slips a real one makes: a fence around the
    /// JSON, a heading before the first section, a colour in short form, a font in lower case.
    fn answer_text(sheet: &str) -> String {
        format!(
            "```json\n{sheet}\n```\n\n{DIVIDER}\n# Paper Cut: art direction\n\nAn opening the tool replaces.\n\n## The frame test\n\n- Is the ground a warm paper tone (`ground`), never white?\n- Does every shape have a cut edge with a 0.3 vmin shadow under it?\n- Is there exactly one `accent` shape in the frame?\n\n## Colour\n\n`ground` fills at least 55 % of every frame. `accent` marks the one thing that matters and takes at most 8 %. `sun` is light only.\n\n## Shapes and materials\n\nLayered cut paper: flat fills, corners of 0.6 vmin, a faint grain of 4 % noise, no outlines and no gradients.\n\n## Light and depth\n\nOne light from the upper left. Every layer drops a soft shadow 0.4 vmin down and right at 18 % black. Three to five layers per frame.\n\n## Type\n\nFraunces 900 for headlines at 9 vmin, 600 for labels at 3.2 vmin, sentence case, at most six words a line.\n\n## Composition\n\nMargins of 7 vmin. The subject sits on a third, never in the centre.\n\n## Motion\n\nDerived from the look: layers slide in from below over 0.5 s with an ease-out and settle with a 2 % overshoot; staggers of 0.08 s.\n\n## Do\n\n- Stack layers so each overlaps the one behind it.\n- Keep one accent per frame.\n\n## Don't\n\n- No outlines, gradients, glows or glass.\n- No pure white and no pure black.\n\n## Pitfalls\n\n- Shadows that point different ways: check that every layer's shadow falls down and right.\n"
        )
    }

    const SHEET: &str = r##"{
      "title": {"en": "Paper Cut", "de": "Scherenschnitt"},
      "description": {"en": "Layered cut paper in warm tones with one strong accent.", "de": "Geschichtetes Papier in warmen Tönen mit einem kräftigen Akzent."},
      "essence": "Everything is cut from paper and stacked: flat shapes with a cut edge, a soft shadow under each layer and a warm ground.",
      "palette": {"ground": "#F4ECDF", "surface": "#e9dcc6", "line": "#cdbb9d", "ink": "#221", "muted": "#6b5d4a", "accent": "#E4572E"},
      "more": [{"name": "Sun", "hex": "#ffc857", "use": "Light | only"}, {"name": "font", "hex": "#000000", "use": "taken"}, {"name": "bad", "hex": "red", "use": "no hex"}],
      "uses": {"ground": "The paper every frame stands on", "accent": "The one thing that matters"},
      "font": "fraunces", "displayWeight": 800, "textWeight": 500, "tracking": -0.2,
      "seconds": 4000, "workflow": "superint-explainer", "voice": "kore", "music": "Warm felt piano and soft brushes, 84 BPM, building slowly. Instrumental, no vocals."
    }"##;

    fn png(width: u32, height: u32) -> Vec<u8> {
        let picture = image::RgbaImage::from_pixel(width, height, image::Rgba([228, 87, 46, 0]));
        let mut bytes = Vec::new();
        image::DynamicImage::ImageRgba8(picture)
            .write_to(
                &mut std::io::Cursor::new(&mut bytes),
                image::ImageFormat::Png,
            )
            .unwrap();
        bytes
    }

    #[test]
    fn an_answer_becomes_a_style_from_pictures() {
        let styles = TempDir::new().unwrap();
        let (sheet, body) = parse(&answer_text(SHEET)).unwrap();
        assert!(body.starts_with("## The frame test"));
        let wish = Wish {
            name: None,
            describe: "Wie aus Papier geschnitten".into(),
            language: Some("de".into()),
            references: vec![
                Reference {
                    name: "Mein Bild (1).PNG".into(),
                    bytes: png(8, 8),
                },
                Reference {
                    name: "***.jpg".into(),
                    bytes: png(8, 8),
                },
            ],
        };
        let (style, _) = files_from_references(&sheet, &body, &wish, styles.path()).unwrap();
        let written = Written {
            text: String::new(),
            model: "gemini-4-hydrogen".into(),
            route: Provider::AiStudio,
        };
        let made = save(&style, &written, styles.path()).unwrap();
        assert_eq!(made.name, "paper-cut");
        assert_eq!(made.title, "Paper Cut");
        assert_eq!(made.references, 2);

        // It loads as a preset like any other and starts a film.
        let loaded = Preset::resolve(&made.path.to_string_lossy()).unwrap();
        let config = &loaded.config;
        assert_eq!(
            config.translations["de"].title.as_deref(),
            Some("Scherenschnitt")
        );
        assert_eq!(config.defaults.seconds, 600);
        assert_eq!(config.defaults.language, "de");
        assert_eq!(
            config.defaults.workflow.as_deref(),
            Some("superint-explainer")
        );
        assert_eq!(config.narration.voice.as_deref(), Some("Kore"));
        assert_eq!(config.narration.rate("de"), 140);
        assert!(config.music.as_ref().unwrap().prompt.contains("84 BPM"));
        assert!(loaded.files.contains_key("references/01-mein-bild-1.png"));
        assert!(loaded.files.contains_key("references/02-picture.png"));
        let film = styles.path().join("a film");
        preset::create_project(
            &loaded,
            &film,
            &preset::Brief {
                workflow: None,
                topic: Some("Paper"),
                message: None,
                seconds: Some(5),
                format: Some("9:16"),
                language: None,
                audience: None,
                must: None,
                avoid: None,
                stops: None,
                script: None,
                references: Vec::new(),
            },
        )
        .unwrap();

        // The kit carries the look: colours as the model named them, cleaned, a font the tool
        // has in a weight that font has, and nothing the model made up.
        let theme = fs::read_to_string(made.path.join("kit/theme.css")).unwrap();
        for token in [
            "--ground: #f4ecdf;",
            "--ink: #222211;",
            "--accent: #e4572e;",
            "--sun: #ffc857;",
            "--font: 'Fraunces', Georgia, serif;",
            "--weight-display: 900;",
            "--weight-text: 600;",
            "--tracking: -0.05em;",
            "--safe: 7vmin;",
        ] {
            assert!(theme.contains(token), "{token} in {theme}");
        }
        assert!(!theme.contains("--bad") && !theme.contains("--font: #"));
        assert!(theme.starts_with("/* Paper Cut:") && theme.contains("@font-face"));
        assert!(theme.contains("font-weight: var(--weight-display, 700);"));
        let kit = fs::read_to_string(made.path.join("kit/kit.js")).unwrap();
        assert!(kit.contains(r#"document.fonts.load('900 1em "Fraunces"')"#));
        let starter = home::read_json(&made.path.join("video.json")).unwrap();
        assert_eq!(starter["background"], "#f4ecdf");
        assert_eq!(starter["clips"][0]["props"]["title"], "{{topic}}");

        // The look contract: the tool's opening, the model's sections, then tokens and kit.
        let contract = fs::read_to_string(made.path.join("STYLE.md")).unwrap();
        assert!(contract.starts_with("# Paper Cut: art direction\n\nEverything is cut from paper"));
        assert!(!contract.contains("An opening the tool replaces"));
        assert!(contract.contains("## Pitfalls"));
        assert!(contract.contains("| `--sun` | `#ffc857` | Light / only |"));
        assert!(contract.contains("## Kit (`kit/kit.js`)"));
        assert!(contract.contains("from the 2 pictures in `references/`"));
        assert_eq!(contract.matches("\n# ").count(), 0);

        // The same name again gets a number, in the title too.
        let (again, _) = files_from_references(&sheet, &body, &wish, styles.path()).unwrap();
        let second = save(&again, &written, styles.path()).unwrap();
        assert_eq!(
            (second.name.as_str(), second.title.as_str()),
            ("paper-cut-2", "Paper Cut (2)")
        );
    }

    #[test]
    fn the_user_s_name_wins_and_a_description_alone_is_enough() {
        let styles = TempDir::new().unwrap();
        let (sheet, body) = parse(&answer_text(SHEET)).unwrap();
        let wish = Wish {
            name: Some("  „Mein Papierstil“ ".into()),
            describe: "Warm, ruhig, wie aus Papier geschnitten.".into(),
            references: Vec::new(),
            language: Some("not a language".into()),
        };
        check_wish(&wish).unwrap();
        let (style, _) = files_from_references(&sheet, &body, &wish, styles.path()).unwrap();
        assert_eq!(style.config.name, "mein-papierstil");
        assert_eq!(style.config.title, "Mein Papierstil");
        assert_eq!(style.config.defaults.language, "en");
        // The user's name is not translated; the description is.
        assert_eq!(style.config.translations["de"].title, None);
        assert!(style.config.translations["de"].description.is_some());
        let contract = String::from_utf8(style.files["STYLE.md"].clone()).unwrap();
        assert!(contract.contains("written from a description alone"));
        let material = material_from_references(&wish);
        assert!(material.contains("\"Mein Papierstil\". Use it unchanged"));
        assert!(material.contains("wie aus Papier geschnitten"));

        // Nothing to go on, too much, or not a picture.
        assert!(check_wish(&Wish::default()).is_err());
        let many = Wish {
            references: (0..13)
                .map(|_| Reference {
                    name: "a.png".into(),
                    bytes: Vec::new(),
                })
                .collect(),
            ..Wish::default()
        };
        assert!(check_wish(&many).unwrap_err().to_string().contains("12"));
        assert!(
            seen("notes.txt", b"just text")
                .unwrap_err()
                .to_string()
                .contains("PNG")
        );
    }

    #[test]
    fn an_answer_that_misses_a_part_is_refused_and_writes_nothing() {
        let styles = TempDir::new().unwrap();
        let good = answer_text(SHEET);
        assert!(parse("Here is your style!").is_err());
        assert!(parse(&good.replace(DIVIDER, "---")).is_err());
        assert!(parse(&format!("{{}}\n{DIVIDER}\nno sections here")).is_err());
        assert!(parse(&good.replace("\"title\"", "title")).is_err());
        let wish = Wish {
            describe: "Wie aus Papier geschnitten".into(),
            ..Wish::default()
        };
        for broken in [
            SHEET.replace("#E4572E", "orange"),
            SHEET.replace(
                "\"essence\": \"Everything",
                "\"essence\": \"\", \"x\": \"Everything",
            ),
            SHEET.replace("\"en\": \"Paper Cut\"", "\"en\": \"\""),
        ] {
            let (sheet, body) = parse(&answer_text(&broken)).unwrap();
            assert!(files_from_references(&sheet, &body, &wish, styles.path()).is_err());
        }
        assert_eq!(fs::read_dir(styles.path()).unwrap().count(), 0);
        // What the model may leave out or get wrong falls back to something the tool has.
        let plain = SHEET
            .replace("\"fraunces\"", "\"Helvetica\"")
            .replace("\"kore\"", "\"Zephyr\"")
            .replace("\"superint-explainer\"", "null");
        let (sheet, body) = parse(&answer_text(&plain)).unwrap();
        let (style, _) = files_from_references(&sheet, &body, &wish, styles.path()).unwrap();
        assert!(style.config.narration.voice.is_none());
        assert!(style.config.defaults.workflow.is_none());
        let theme = String::from_utf8(style.files["kit/theme.css"].clone()).unwrap();
        assert!(theme.contains("--font: 'Geist', system-ui, sans-serif;"));
        assert!(theme.contains("--weight-display: 800;"));
    }

    #[test]
    fn pictures_reach_the_model_small_and_opaque() {
        let large = seen("large.png", &png(3200, 400)).unwrap();
        assert_eq!(large.mime, "image/jpeg");
        let decoded = image::load_from_memory(&large.bytes).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (SEEN_SIZE, 196));
        // A transparent picture stands on white, not on black.
        let pixel = decoded.to_rgb8().get_pixel(10, 10).0;
        assert!(pixel.iter().all(|channel| *channel > 240), "{pixel:?}");
        assert_eq!(spread(&[1, 2, 3, 4, 5, 6, 7], 3), [1, 4, 7]);
        assert_eq!(spread(&[1, 2], 4), [1, 2]);
        assert_eq!(hex("#AbC").as_deref(), Some("#aabbcc"));
        assert_eq!(hex("#12345"), None);
        assert_eq!(hex("rgb(0,0,0)"), None);
    }

    #[test]
    fn the_fonts_the_prompt_offers_are_the_ones_the_tool_ships() {
        let library = fonts::library();
        assert_eq!(
            offered_fonts(),
            library.iter().map(String::as_str).collect::<Vec<_>>()
        );
        for family in offered_fonts() {
            assert!(PROMPT.contains(&format!("| `{family}` |")), "{family}");
        }
        for voice in VOICES {
            assert!(PROMPT.contains(&format!("`{voice}`")), "{voice}");
        }
        for token in TOKENS {
            assert!(PROMPT.contains(&format!("| `{token}` |")), "{token}");
        }
        assert!(PROMPT.contains(DIVIDER));
        // No model is named in the prompt, and it asks for originals.
        let lower = PROMPT.to_ascii_lowercase();
        for name in ["claude", "gemini", "gpt"] {
            assert!(!lower.contains(name), "{name}");
        }
        assert!(PROMPT.contains("Never name an artist"));
    }

    const FILM_SHEET: &str = r#"{
      "title": {"en": "Night Workshop", "de": "Nachtwerkstatt"},
      "description": {"en": "A dark workshop lit by warm practical lights.", "de": "Eine dunkle Werkstatt im warmen Licht echter Lampen."},
      "essence": "A dark room in which every light is a real lamp: warm pools on cold surfaces, and nothing that glows without a source.",
      "seconds": 60, "workflow": null, "voice": null,
      "music": "Low felt piano over a warm analogue pad, 72 BPM, sparse. Instrumental, no vocals."
    }"#;

    fn film(root: &Path) {
        let starter = Path::new(env!("CARGO_MANIFEST_DIR")).join("examples/starter");
        for entry in walkdir::WalkDir::new(&starter) {
            let entry = entry.unwrap();
            let target = root.join(entry.path().strip_prefix(&starter).unwrap());
            if entry.file_type().is_dir() {
                fs::create_dir_all(&target).unwrap();
            } else {
                fs::copy(entry.path(), &target).unwrap();
            }
        }
        let flat = Preset::builtin("flat-explainer").unwrap();
        for (path, bytes) in [
            ("preset.json", flat.files[CONFIG].clone()),
            ("STYLE.md", b"# The sleep film\n\nLamps are warm.".to_vec()),
            ("direction.md", b"Scene 3: the lamp in the study is warm.".to_vec()),
            ("brief.md", b"---\ntopic: \"Why sleep cleans the brain\"\nworkflow: superint-explainer\n---\n\n# Brief\n".to_vec()),
            ("kit/kit.js", b"export const film = true;\n".to_vec()),
            ("kit/theme.css", b":root {\n  --ground: #101418;\n}\nbody { margin: 0; }\n".to_vec()),
            ("scenes/lib/lamp.js", b"export const lamp = 1;\n".to_vec()),
            ("scenes/sleep-01.html", b"<p>sleep</p>".to_vec()),
            ("blocks/room.html", b"<p>room</p>".to_vec()),
            ("renders/thumbnail.png", png(64, 36)),
            ("renders/frames/01.png", png(64, 36)),
            ("renders/sleep.mp4", b"film".to_vec()),
            ("references/look.png", png(8, 8)),
            ("script.md", b"Sleep cleans the brain.".to_vec()),
        ] {
            fs::create_dir_all(root.join(path).parent().unwrap()).unwrap();
            fs::write(root.join(path), bytes).unwrap();
        }
    }

    #[test]
    fn a_finished_film_becomes_a_style_without_its_topic() {
        let home = TempDir::new().unwrap();
        let root = home.path().join("sleep");
        film(&root);
        let read = Film::read(&root).unwrap();
        assert_eq!(read.topic.as_deref(), Some("Why sleep cleans the brain"));
        assert_eq!(read.stills.len(), 2);
        assert_eq!(read.references.len(), 1);
        let (pictures, captions) = read.shown().unwrap();
        assert_eq!(pictures.len(), 3);
        let material = read.material(None, "Behalte das Lampenlicht", &captions);
        assert!(material.contains("Task: a style from a finished film"));
        assert!(material.contains("Why sleep cleans the brain"));
        assert!(
            material.contains("- scenes/lib/lamp.js") && material.contains("- blocks/room.html")
        );
        assert!(material.contains("--ground: #101418"));
        assert!(material.contains("Scene 3: the lamp in the study is warm."));
        assert!(material.contains("1. the film's thumbnail"));
        assert!(material.contains("3. a reference the film was measured against"));
        // The film's scenes and script are not the model's business.
        assert!(!material.contains("sleep-01.html") && !material.contains("cleans the brain.\n"));

        let styles = home.path().join("styles");
        let (sheet, body) = parse(&answer_text(FILM_SHEET)).unwrap();
        let (style, _) = files_from_film(&sheet, &body, read, None, &styles).unwrap();
        let written = Written {
            text: String::new(),
            model: "gpt-6.1-sol".into(),
            route: Provider::OpenAi,
        };
        let made = save(&style, &written, &styles).unwrap();
        assert_eq!(made.name, "night-workshop");
        assert_eq!(made.references, 3);
        let loaded = Preset::resolve(&made.path.to_string_lossy()).unwrap();
        // The film's own kit, libraries and blocks, over the starter of the preset it began as.
        assert_eq!(loaded.files["kit/kit.js"], b"export const film = true;\n");
        assert!(loaded.files.contains_key("scenes/lib/lamp.js"));
        assert!(loaded.files.contains_key("blocks/room.html"));
        assert!(loaded.files.contains_key("scenes/title.html"));
        assert!(loaded.files.contains_key("references/film-01.jpg"));
        assert!(loaded.files.contains_key("references/look.png"));
        // Nothing of the film itself.
        for left in [
            "scenes/sleep-01.html",
            "script.md",
            "brief.md",
            "direction.md",
            "renders/sleep.mp4",
        ] {
            assert!(!loaded.files.contains_key(left), "{left}");
        }
        // The film's preset settings stay; the identity is new.
        assert_eq!(
            loaded.config.defaults.workflow.as_deref(),
            Some("superint-explainer")
        );
        assert_eq!(loaded.config.narration.voice.as_deref(), Some("Sadaltager"));
        assert_eq!(loaded.config.music.as_ref().unwrap().model, "lyria-3.5");
        assert!(
            loaded
                .config
                .music
                .as_ref()
                .unwrap()
                .prompt
                .contains("72 BPM")
        );
        assert_eq!(
            loaded.config.translations["de"].title.as_deref(),
            Some("Nachtwerkstatt")
        );
        assert!(loaded.config.formats.contains_key("9:16"));
        let contract = String::from_utf8(loaded.files["STYLE.md"].clone()).unwrap();
        assert!(contract.starts_with("# Night Workshop: art direction\n\nA dark room"));
        assert!(contract.contains("(`kit/`, `scenes/lib/`, `blocks/`)"));
        assert!(!contract.contains("sleep") && !contract.contains("## Tokens"));

        // A folder that is no film, or a film with nothing to go on.
        assert!(Film::read(home.path()).is_err());
        let bare = home.path().join("bare");
        fs::create_dir_all(&bare).unwrap();
        fs::write(bare.join("video.json"), "{}").unwrap();
        let error = Film::read(&bare).err().unwrap().to_string();
        assert!(error.contains("nothing a style"), "{error}");
    }
}
