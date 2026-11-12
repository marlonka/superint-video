use anyhow::{Context, Result, bail};
use clap::{Parser, Subcommand};
use include_dir::{Dir, include_dir};
use serde_json::{Value, json};
use std::{
    path::{Path, PathBuf},
    sync::Arc,
};
use superint_video::{
    app, earshot,
    home::{self, Settings},
    live, mix,
    model::Manifest,
    music, polish,
    preset::{self, Brief, Preset},
    project::{self, ProjectStore, display_path},
    providers, renderer, review, server, sfx,
    voice::{self, TakesOptions, TranscribeOptions},
};
use tokio_util::sync::CancellationToken;

/// Where the app listens unless told otherwise.
const APP_PORT: u16 = 47800;
static STARTER: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/examples/starter");

#[derive(Parser)]
#[command(version, about = "Local HTML video authoring, Studio and rendering")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}
#[derive(Subcommand)]
enum Commands {
    /// Open the app: setup (coding agent with skills, tools, API keys), defaults for new films, styles
    /// and the films on this computer. Returns at once; the app keeps running in the background.
    App {
        #[arg(long, default_value_t = APP_PORT)]
        port: u16,
        /// Don't open a window.
        #[arg(long)]
        no_open: bool,
        /// Stop the running app.
        #[arg(long)]
        stop: bool,
        /// The background process itself: it ends after long without anyone looking.
        #[arg(long, hide = true)]
        detached: bool,
    },
    /// The user's choices on this computer: the default style, the films folder, how the app
    /// opens, the models. Without a subcommand: print them.
    Settings {
        #[command(subcommand)]
        command: Option<SettingsCommand>,
    },
    /// Which model does which job (narration, voice, timings, music, dictation), through which
    /// provider, what else is known to fit, and how to change it. Without a subcommand: print it.
    Models {
        #[command(subcommand)]
        command: Option<ModelsCommand>,
    },
    /// Create a minimal project with a working HTML scene.
    Init { directory: PathBuf },
    /// Start a new film from a copy of another: brief, scenes, kit, references and sound come
    /// along, so it plays at once; renders, the report, the status and reviews stay behind.
    /// Without --to the copy goes into the user's films folder, named after the new film.
    Duplicate {
        /// The film to copy (its folder or its video.json).
        film: PathBuf,
        /// What the new film is about. Names the copy and its folder unless --name says.
        #[arg(long)]
        topic: Option<String>,
        /// The copy's name (else the topic, else "<name> (copy)").
        #[arg(long)]
        name: Option<String>,
        /// Folder for the copy; it must not exist yet.
        #[arg(long)]
        to: Option<PathBuf>,
        /// Don't start Studio. Normally it opens so the user can watch.
        #[arg(long)]
        no_studio: bool,
    },
    /// Create a project from a style preset and write brief.md for the agent.
    New {
        /// Folder for the film. Without one it goes into the user's films folder, named after
        /// the topic.
        directory: Option<PathBuf>,
        /// Style preset (name or folder); the user's default style otherwise. List them with
        /// `preset list`.
        #[arg(long)]
        preset: Option<String>,
        /// Workflow skill that plans the film, e.g. superint-explainer or superint-launch
        /// (the preset's default otherwise).
        #[arg(long)]
        workflow: Option<String>,
        /// Stills, screenshots or clips of the look you want; copied into references/.
        #[arg(long = "reference", value_delimiter = ',')]
        references: Vec<PathBuf>,
        /// Topic, angle or working title.
        #[arg(long)]
        topic: Option<String>,
        /// The one sentence the film argues; the viewer should repeat it afterwards.
        #[arg(long)]
        message: Option<String>,
        /// Target length in seconds (else the preset's).
        #[arg(long)]
        seconds: Option<u32>,
        /// Aspect name from the preset, e.g. 16:9 or 9:16 (else the preset's).
        #[arg(long)]
        format: Option<String>,
        /// Don't start Studio. Normally it opens in the browser so the user can watch the work.
        #[arg(long)]
        no_studio: bool,
        /// Narration and on-screen language, e.g. de or en (else the preset's).
        #[arg(long)]
        language: Option<String>,
        #[arg(long)]
        audience: Option<String>,
        /// Facts, examples or points the video has to contain.
        #[arg(long)]
        must: Option<String>,
        /// Things the video must not contain or do.
        #[arg(long)]
        avoid: Option<String>,
        /// Existing script file; copied to script.md and kept verbatim.
        #[arg(long)]
        script: Option<PathBuf>,
        /// Where the agent waits for you, comma-separated; the workflow skill names its stops
        /// (explainer: concept, script, frames, contact). Omit to run through to the render.
        #[arg(long, value_delimiter = ',')]
        stop: Option<Vec<String>>,
    },
    /// List, show or copy presets.
    Preset {
        #[command(subcommand)]
        command: PresetCommand,
    },
    /// Open the local editor server. Ctrl+C stops its processes.
    Studio {
        #[arg(default_value = ".")]
        project: PathBuf,
        #[arg(long, default_value_t = 0)]
        port: u16,
        /// Don't open the browser.
        #[arg(long)]
        no_open: bool,
        /// Stop this project's running Studio.
        #[arg(long)]
        stop: bool,
        /// Started by another command: no console, and it ends itself after long without a viewer.
        #[arg(long, hide = true)]
        detached: bool,
    },
    /// Change the film the way Studio does: scene props (texts, numbers, colours), timing,
    /// position, opacity, fades, gain, tracks; split, duplicate, delete, add. Checked like a
    /// Studio edit and written as one step; with the film's Studio open it goes through Studio,
    /// so the user sees it and can undo it there.
    Edit {
        project: PathBuf,
        /// Operations as JSON, one or a list ({"type":"updateClip","id":…,"changes":{…}},
        /// splitClip, duplicateClip, deleteClip, addClip, addTrack, updateTrack, updateProject).
        /// `-` reads them from stdin, `@file` from a file.
        operations: Option<String>,
        /// The clip that --prop and --set change.
        #[arg(long)]
        clip: Option<String>,
        /// A scene prop of the clip, key=value; repeatable.
        #[arg(long = "prop")]
        props: Vec<String>,
        /// A field of the clip, field=value (startFrame, durationFrames, opacity, gain,
        /// fadeInFrames, fadeOutFrames, hidden, muted, transform.x/y/scale/rotation); repeatable.
        #[arg(long = "set")]
        sets: Vec<String>,
        /// Check the change and print it without writing.
        #[arg(long)]
        dry_run: bool,
    },
    /// The film's main font: the one it has, the ones it can take (its own and the tool's), and
    /// with a family, the switch to it, through Studio when it is open.
    Fonts {
        project: PathBuf,
        family: Option<String>,
        /// Back to the style's own font.
        #[arg(long)]
        reset: bool,
    },
    /// Read the project, revision and timeline.
    Inspect {
        #[arg(default_value = ".")]
        project: PathBuf,
        #[arg(long)]
        json: bool,
    },
    /// Validate sources and render sampled frames in the real browser.
    Check {
        #[arg(default_value = ".")]
        project: PathBuf,
        #[arg(long)]
        json: bool,
    },
    /// Capture exact frames and a contact sheet.
    Snapshot {
        #[arg(default_value = ".")]
        project: PathBuf,
        #[arg(long, value_delimiter = ',', required = true)]
        frames: Vec<u64>,
        #[arg(long, default_value = "renders/snapshots")]
        output: PathBuf,
    },
    /// Frames for the critique loop: a grid every few seconds with a worksheet, frame-by-frame
    /// strips and check-camera close-ups, plus measured static stretches, edge slivers and
    /// highlights off their target.
    Review {
        #[arg(default_value = ".")]
        project: PathBuf,
        /// Seconds between grid frames (default 3; the grid is skipped when only --frames or
        /// --strip is given).
        #[arg(long)]
        every: Option<f64>,
        /// Start of the grid in seconds; half the interval samples between an earlier pass.
        #[arg(long, default_value_t = 0.0)]
        offset: f64,
        /// Extra exact frames, comma-separated.
        #[arg(long, value_delimiter = ',')]
        frames: Vec<u64>,
        /// Every frame of a range, e.g. 600-615; comma-separated for several.
        #[arg(long, value_delimiter = ',', value_parser = review::parse_range)]
        strip: Vec<(u64, u64)>,
        /// Check camera x,y,zoom for scenes that declare the camX, camY and camZ props.
        #[arg(long, value_delimiter = ',', allow_hyphen_values = true)]
        camera: Option<Vec<f64>>,
        /// Also save a native-resolution crop x,y,w,h of every still.
        #[arg(long, value_delimiter = ',')]
        crop: Option<Vec<u32>>,
        /// Skip sampling the whole film for static stretches and edge slivers.
        #[arg(long)]
        no_motion: bool,
        /// Output folder (default renders/review/<next number>).
        #[arg(long)]
        output: Option<PathBuf>,
    },
    /// The last look before a render, for eyes that did not build the film: a still every few
    /// seconds, close-ups at native resolution, both sides of every cut and strips over the
    /// fastest moves, on a worksheet. A later pass lists only what changed or stayed open.
    Polish {
        #[arg(default_value = ".")]
        project: PathBuf,
        /// Seconds between stills (default 5).
        #[arg(long)]
        every: Option<f64>,
        /// Record the latest pass as clean: every row says ok or kept and nothing changed since.
        #[arg(long)]
        accept: bool,
    },
    /// Render a verified MP4. Existing output requires --overwrite. A film with a brief needs an
    /// accepted polish pass for its picture, unless --quality draft or --unpolished.
    Render {
        #[arg(default_value = ".")]
        project: PathBuf,
        #[arg(long)]
        output: PathBuf,
        #[arg(long,default_value="final",value_parser=["draft","final"])]
        quality: String,
        /// Video codec: x265 (HEVC, smaller files) or x264 (H.264, plays everywhere).
        #[arg(long, default_value = renderer::DEFAULT_CODEC, value_parser = renderer::CODECS)]
        codec: String,
        #[arg(long)]
        overwrite: bool,
        /// A finished master (from `mix`) muxed as AAC 256k instead of mixing the clips.
        #[arg(long)]
        audio: Option<PathBuf>,
        /// Browsers that capture frames in parallel (default: half the CPU threads, at most 8).
        #[arg(long, value_parser = clap::value_parser!(u16).range(1..=32))]
        workers: Option<u16>,
        /// Don't start Studio. Normally it opens so the user can watch the film being rendered.
        #[arg(long)]
        no_studio: bool,
        /// Render at final quality although no polish pass is accepted for this picture.
        #[arg(long)]
        unpolished: bool,
    },
    /// Narration: check voice.md, generate and measure takes, cut voice.wav and words.json.
    Voice {
        #[command(subcommand)]
        command: VoiceCommand,
    },
    /// Transcribe one audio file with word times; compare with a reference text if given.
    Transcribe {
        audio: PathBuf,
        /// Transcription model (default gemini-3.5-transcribe; a/b ids go through OpenRouter).
        #[arg(long)]
        model: Option<String>,
        #[arg(long)]
        language: Option<String>,
        /// Words to listen for, comma-separated.
        #[arg(long, value_delimiter = ',')]
        terms: Vec<String>,
        /// voice.md or a plain text file with what should have been said.
        #[arg(long)]
        reference: Option<PathBuf>,
        /// Write the transcript JSON here instead of printing every word.
        #[arg(long)]
        output: Option<PathBuf>,
    },
    /// Check music-prompt.md, then generate and measure variants with Lyria.
    Music {
        #[arg(default_value = ".")]
        project: PathBuf,
        #[arg(long, default_value_t = 3)]
        variants: u32,
        /// Check and count requests without calling the model.
        #[arg(long)]
        dry_run: bool,
    },
    /// Sound effects through Earshot: the bank, the kit, and cues from sfx.json.
    Sfx {
        #[command(subcommand)]
        command: SfxCommand,
    },
    /// Let a hosted audio model listen to a take, the mix or the film through Earshot
    /// (`earshot llm`, audio uploaded to Google with GEMINI_API_KEY). Saved to process/listen/.
    Listen {
        file: PathBuf,
        /// The project whose .env holds the key and whose process/ gets the answer.
        #[arg(long, default_value = ".")]
        project: PathBuf,
        /// A specific question, answered next to Earshot's film-sound rubric.
        #[arg(long)]
        question: Option<String>,
        /// The film the soundtrack belongs to, for its picture-cut times (no frames are sent).
        #[arg(long)]
        video: Option<PathBuf>,
        #[arg(long)]
        start: Option<f64>,
        #[arg(long)]
        end: Option<f64>,
    },
    /// Mix every audio clip, duck the music under the words and master to audio/master.wav.
    Mix {
        #[arg(default_value = ".")]
        project: PathBuf,
    },
    /// Inspect local dependencies and API keys (names only, never values).
    Doctor {
        #[arg(long)]
        json: bool,
        /// Also ask the providers which route models the keys can reach, with live prices.
        #[arg(long)]
        online: bool,
    },
    /// Print the versioned project JSON Schema.
    Schema,
}

#[derive(Subcommand)]
enum SettingsCommand {
    /// Set one value by its name in `settings` (window is app or browser, follow is true or
    /// false). An empty value clears it.
    Set { key: String, value: String },
}

#[derive(Subcommand)]
enum ModelsCommand {
    /// Whether a model can do a job: its form, its provider, the way it would go now and,
    /// unless --offline, whether the keys reach it. Costs nothing.
    Check {
        model: String,
        /// narration, timings, music or dictation.
        #[arg(long, default_value = "narration")]
        job: String,
        #[arg(long)]
        offline: bool,
    },
    /// Use a model for a job in every new film (or for dictation), after checking it. An empty
    /// model goes back to the usual one. `voice` takes a voice name.
    Set {
        job: String,
        model: String,
        /// Save it even when the check says the keys do not reach it.
        #[arg(long)]
        force: bool,
    },
}

#[derive(Subcommand)]
enum VoiceCommand {
    /// Check voice.md against the rules of its TTS model. Exit 2 on errors.
    Check {
        #[arg(default_value = ".")]
        project: PathBuf,
        /// Script to compare the words with (default script.md in the project).
        #[arg(long)]
        script: Option<PathBuf>,
    },
    /// Generate takes per paragraph, transcribe and measure them, and recommend one each.
    Takes {
        #[arg(default_value = ".")]
        project: PathBuf,
        /// Takes per paragraph (default from voice.md, else 3).
        #[arg(long)]
        takes: Option<u32>,
        /// Only these paragraphs, comma-separated.
        #[arg(long, value_delimiter = ',')]
        paragraphs: Option<Vec<usize>>,
        /// Check and count requests and cost without calling the model.
        #[arg(long)]
        dry_run: bool,
    },
    /// Cut the chosen takes into audio/voice.wav and write audio/words.json.
    Assemble {
        #[arg(default_value = ".")]
        project: PathBuf,
        /// `auto` for the recommended takes, or paragraph=take pairs like 1=2,3=1.
        #[arg(long, default_value = "auto")]
        pick: String,
        /// Skip the final transcription of voice.wav.
        #[arg(long)]
        no_verify: bool,
    },
}

#[derive(Subcommand)]
enum SfxCommand {
    /// The Earshot bank: timing, loudness and pitch range per sound.
    List {
        #[arg(long)]
        category: Option<String>,
    },
    /// Render audio/kit.json into audio/sfx/ and audit every take. Exit 2 on problems.
    Kit {
        #[arg(default_value = ".")]
        project: PathBuf,
    },
    /// Place the cues of sfx.json on the sfx track, each take on its frame by its sync point.
    Place {
        #[arg(default_value = ".")]
        project: PathBuf,
    },
}

#[derive(Subcommand)]
enum PresetCommand {
    /// Built-in and user presets. User presets shadow built-ins of the same name.
    List {
        #[arg(long)]
        json: bool,
    },
    /// Print a preset's configuration, location, files and references.
    Show { name: String },
    /// Copy a preset into the user preset directory under a new name.
    New {
        name: String,
        #[arg(long, default_value = "blank")]
        from: String,
        /// Reference stills or clips for the new style, comma-separated or repeated.
        #[arg(long = "reference", value_delimiter = ',')]
        references: Vec<PathBuf>,
    },
    /// Add reference stills or clips to a preset; every new project gets a copy.
    Reference {
        name: String,
        #[arg(required = true)]
        files: Vec<PathBuf>,
    },
    /// Write a preset as one file to pass on: `<name>.superint-style.zip`.
    Export {
        name: String,
        /// Folder for the file; the current folder otherwise.
        #[arg(long, default_value = ".")]
        output: PathBuf,
    },
    /// Add the preset in a style file to the user's presets. A taken name gets a number.
    Import { file: PathBuf },
}

/// Generator jobs keep large async state on the stack, and Windows gives the main thread
/// only 1 MiB, so the runtime runs on a thread with room to spare.
const STACK: usize = 32 * 1024 * 1024;

fn main() {
    let result = std::thread::Builder::new()
        .stack_size(STACK)
        .spawn(|| {
            tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .thread_stack_size(STACK)
                .build()?
                .block_on(run())
        })
        .map_err(anyhow::Error::from)
        .and_then(|thread| {
            thread
                .join()
                .unwrap_or_else(|_| Err(anyhow::anyhow!("the command panicked")))
        });
    if let Err(error) = result {
        eprintln!(
            "{}",
            json!({"error":"operation_failed","message":format!("{error:#}")})
        );
        std::process::exit(1);
    }
}
/// What a long command tells Studio while it runs.
fn running(command: &Commands) -> Option<live::Running> {
    let (project, label) = match command {
        Commands::Check { project, .. } => (project, "Checking every scene"),
        Commands::Snapshot { project, .. } => (project, "Taking snapshots"),
        Commands::Review { project, .. } => (project, "Review pass over the film"),
        Commands::Polish {
            project,
            accept: false,
            ..
        } => (project, "Polish pass: looking at every part of the film"),
        Commands::Music { project, .. } => (project, "Generating music"),
        Commands::Mix { project } => (project, "Mixing"),
        Commands::Listen { project, .. } => (project, "Listening"),
        Commands::Voice {
            command: VoiceCommand::Takes { project, .. },
        } => (project, "Recording voice takes"),
        Commands::Voice {
            command: VoiceCommand::Assemble { project, .. },
        } => (project, "Assembling the voice"),
        Commands::Sfx {
            command: SfxCommand::Kit { project },
        } => (project, "Rendering sound effects"),
        Commands::Sfx {
            command: SfxCommand::Place { project, .. },
        } => (project, "Placing sound effects"),
        _ => return None,
    };
    live::Running::start(project, label)
}

/// True when this process has a console window all to itself: it was started by a double-click,
/// not from a shell.
fn started_by_double_click() -> bool {
    #[cfg(windows)]
    {
        unsafe extern "system" {
            fn GetConsoleProcessList(list: *mut u32, count: u32) -> u32;
        }
        let mut list = [0u32; 2];
        // SAFETY: the buffer holds the two entries the call is told about.
        unsafe { GetConsoleProcessList(list.as_mut_ptr(), 2) == 1 }
    }
    #[cfg(not(windows))]
    {
        false
    }
}

/// The app's address, starting it in the background when it is not running.
async fn open_app(home: &std::path::Path, port: u16, open: bool) -> Result<Value> {
    let app = live::Server::app(home);
    if let Some(url) = app.running().await {
        if open {
            live::open_browser(&url);
        }
        return Ok(json!({"url": url, "home": home, "alreadyRunning": true}));
    }
    let port = port.to_string();
    let url = app
        .launch(&["app".as_ref(), "--port".as_ref(), port.as_ref()], open)
        .await
        .context("The app did not start")?;
    Ok(json!({"url": url, "home": home, "alreadyRunning": false}))
}

fn user_home() -> Result<PathBuf> {
    home::dir().context("No user folder on this computer; set SUPERINT_HOME")
}

fn settings_report(home: &std::path::Path) -> Result<Value> {
    let settings = Settings::load(home)?;
    Ok(json!({
        "filmsFolder": home::films_dir(&settings),
        "settings": settings,
        "file": home.join("settings.json"),
        "keys": home::setting_keys(),
        "note": "`preset` is the style `new` takes when none is given; `filmsFolder` is where `new` puts a film when no folder is given (projectsDir, else Superint Video in the user's Videos folder). The user changes these in the app (`superint-video app`) or with `settings set <key> <value>`. For the models, `superint-video models` says what each job uses and checks a model before `models set`.",
    }))
}

async fn run() -> Result<()> {
    let cli = Cli::parse();
    let Some(command) = cli.command else {
        // Opened like an app, by a double-click: show the app instead of a console of help.
        if started_by_double_click() {
            open_app(&user_home()?, APP_PORT, true).await?;
            return Ok(());
        }
        use clap::CommandFactory;
        Cli::command().print_help()?;
        return Ok(());
    };
    let _running = running(&command);
    match command {
        Commands::App {
            port,
            no_open,
            stop,
            detached,
        } => {
            let home = user_home()?;
            if stop {
                print_json(json!({"stopped": live::Server::app(&home).stop().await}));
            } else if detached {
                server::app(
                    home,
                    port,
                    server::StudioOptions {
                        open: !no_open,
                        detached: true,
                    },
                )
                .await?;
            } else {
                print_json(open_app(&home, port, !no_open).await?);
            }
        }
        Commands::Settings { command } => {
            let home = user_home()?;
            if let Some(SettingsCommand::Set { key, value }) = command {
                let mut settings = Settings::load(&home)?;
                settings.set(&key, &value)?;
                settings.save(&home)?;
            }
            print_json(settings_report(&home)?);
        }
        Commands::Models { command } => {
            let start = std::env::current_dir()?;
            print_json(match command {
                None => superint_video::models::report(&start)?,
                Some(ModelsCommand::Check {
                    model,
                    job,
                    offline,
                }) => superint_video::models::check(&start, &model, &job, !offline).await?,
                Some(ModelsCommand::Set { job, model, force }) => {
                    superint_video::models::set(&start, &user_home()?, &job, &model, force).await?
                }
            });
        }
        Commands::Init { directory } => {
            if directory.exists() && std::fs::read_dir(&directory)?.next().is_some() {
                bail!("Project directory is not empty");
            }
            std::fs::create_dir_all(&directory)?;
            STARTER.extract(&directory)?;
            std::fs::create_dir_all(directory.join("assets"))?;
            std::fs::create_dir_all(directory.join("renders"))?;
            std::fs::write(directory.join(".gitignore"), ".superint/\nrenders/\n")?;
            print_json(json!({
                "project": display_path(&directory)?,
                "manifest": "video.json",
                "next": format!("superint-video studio \"{}\"", directory.display()),
            }));
        }
        Commands::Duplicate {
            film,
            topic,
            name,
            to,
            no_studio,
        } => {
            let source = ProjectStore::open(&film)?;
            let name = name
                .or(topic)
                .map(|text| text.trim().replace('*', ""))
                .filter(|text| !text.is_empty())
                .unwrap_or_else(|| format!("{} (copy)", source.manifest.name));
            let directory = match to {
                Some(directory) => directory,
                None => {
                    let folder = home::films_dir(&Settings::current())
                        .context("No films folder on this computer: give a folder with --to")?;
                    home::new_film_dir(&folder, &name)
                }
            };
            let root = home::duplicate(&source.root, &directory, &name)?;
            if let Some(home) = home::dir() {
                home::remember(&home, &root, &name, true);
            }
            let mut copied = json!({
                "project": root,
                "from": display_path(&source.root)?,
                "name": name,
                "next": "Rewrite brief.md for the new film (topic, message, audience, length), then change only what it needs. Renders, report, status and reviews stayed behind: polish and render run fresh.",
            });
            if !no_studio {
                copied["studio"] = json!(live::ensure_studio(&root).await);
            }
            print_json(copied);
        }
        Commands::New {
            directory,
            preset,
            workflow,
            references,
            topic,
            message,
            seconds,
            format,
            language,
            audience,
            must,
            avoid,
            script,
            stop,
            no_studio,
        } => {
            // The style comes from the request, else the user's default; what else the request
            // leaves open comes from the preset.
            let settings = Settings::current();
            let mut from_settings = Vec::new();
            let Some(preset) = preset.or_else(|| {
                settings
                    .preset
                    .clone()
                    .inspect(|_| from_settings.push("preset"))
            }) else {
                let names = preset::list()?
                    .into_iter()
                    .map(|p| p.name)
                    .collect::<Vec<_>>()
                    .join(", ");
                bail!(
                    "Choose a style preset with --preset: the one that suits the topic best, or ask the user when the look is unclear. A default style can be set in the app (`superint-video app`). Available: {names}"
                );
            };
            let preset = Preset::resolve(&preset)?;
            // Without a folder the film goes to the user's films folder: the one they chose,
            // else `Superint Video` in their Videos folder.
            let directory = match directory {
                Some(directory) => directory,
                None => {
                    let folder = home::films_dir(&settings)
                        .context("No films folder on this computer: give a folder for the film")?;
                    let topic = topic
                        .as_deref()
                        .context("Without a folder the film is named after --topic")?;
                    if settings.projects_dir.is_some() {
                        from_settings.push("projectsDir");
                    }
                    std::fs::create_dir_all(&folder).with_context(|| {
                        format!("Creating the films folder {}", folder.display())
                    })?;
                    home::new_film_dir(&folder, topic)
                }
            };
            let script = script
                .map(|path| {
                    std::fs::read_to_string(&path)
                        .with_context(|| format!("Reading script {}", path.display()))
                })
                .transpose()?;
            let mut created = preset::create_project(
                &preset,
                &directory,
                &Brief {
                    workflow: workflow.as_deref(),
                    topic: topic.as_deref(),
                    message: message.as_deref(),
                    seconds,
                    format: format.as_deref(),
                    language: language.as_deref(),
                    audience: audience.as_deref(),
                    must: must.as_deref(),
                    avoid: avoid.as_deref(),
                    stops: stop,
                    script,
                    references,
                },
            )?;
            created["fromSettings"] = json!(from_settings);
            let root = ProjectStore::open(&directory)?.root;
            if let Some(home) = home::dir() {
                let name = topic.as_deref().unwrap_or("Untitled").replace('*', "");
                home::remember(&home, &root, &name, true);
            }
            // The user watches from the first minute: Studio opens right away, or the app's
            // start page goes to the new film by itself when it is open in front of them.
            if !no_studio {
                created["studio"] = json!(live::ensure_studio(&root).await);
            }
            print_json(created);
        }
        Commands::Preset { command } => match command {
            PresetCommand::List { json: machine } => {
                let presets = preset::list()?;
                if machine {
                    print_json(serde_json::to_value(presets)?);
                } else {
                    for p in presets {
                        println!(
                            "{}  {}  [{}]  {}",
                            p.name,
                            p.title,
                            p.formats.join(", "),
                            p.description
                        );
                    }
                }
            }
            PresetCommand::Show { name } => {
                let preset = Preset::resolve(&name)?;
                print_json(json!({
                    "config": preset.config,
                    "source": preset.source,
                    "location": preset.location,
                    "references": preset.references(),
                    "files": preset.files.keys().collect::<Vec<_>>(),
                }));
            }
            PresetCommand::New {
                name,
                from,
                references,
            } => {
                print_json(
                    json!({"preset": name, "path": preset::fork(&from, &name, &references)?}),
                );
            }
            PresetCommand::Reference { name, files } => {
                let written = preset::add_references(&name, &files)?;
                print_json(json!({"preset": name, "added": written}));
            }
            PresetCommand::Export { name, output } => {
                let file = preset::export_to(&name, &output)?;
                print_json(json!({"preset": name, "file": file}));
            }
            PresetCommand::Import { file } => {
                let bytes =
                    std::fs::read(&file).with_context(|| format!("Reading {}", file.display()))?;
                print_json(serde_json::to_value(preset::import(&bytes)?)?);
            }
        },
        Commands::Studio {
            project,
            port,
            no_open,
            stop,
            detached,
        } => {
            let root = ProjectStore::open(&project)?.root;
            if stop {
                print_json(json!({"stopped": live::Server::studio(&root).stop().await}));
            } else if let Some(url) = live::Server::studio(&root).running().await {
                if !no_open {
                    live::open_browser(&url);
                }
                print_json(json!({"url": url, "project": root, "alreadyRunning": true}));
            } else {
                server::studio(
                    root,
                    port,
                    server::StudioOptions {
                        open: !no_open,
                        detached,
                    },
                )
                .await?;
            }
        }
        Commands::Edit {
            project,
            operations,
            clip,
            props,
            sets,
            dry_run,
        } => {
            let request = superint_video::edit::Request {
                operations: operations.as_deref(),
                clip: clip.as_deref(),
                props: &props,
                sets: &sets,
                dry_run,
            };
            print_json(superint_video::edit::run(&project, &request).await?);
        }
        Commands::Fonts {
            project,
            family,
            reset,
        } => print_json(superint_video::fonts::run(&project, family.as_deref(), reset).await?),
        Commands::Inspect {
            project,
            json: machine,
        } => {
            let store = ProjectStore::open(project)?;
            let result = json!({
                "manifest": store.manifest, "revision": store.revision, "projectPath": store.root,
            });
            if machine {
                print_json(result);
            } else {
                println!(
                    "{} · {} × {} · {}/{} fps · {} frames",
                    store.manifest.name,
                    store.manifest.width,
                    store.manifest.height,
                    store.manifest.fps.num,
                    store.manifest.fps.den,
                    store.manifest.duration_frames
                );
                for clip in &store.manifest.clips {
                    println!(
                        "{}  {}–{}  {}",
                        clip.id,
                        clip.start_frame,
                        clip.start_frame + clip.duration_frames,
                        clip.src
                    );
                }
            }
        }
        Commands::Check {
            project,
            json: machine,
        } => {
            let store = ProjectStore::open(project)?;
            let result = renderer::check(store.snapshot()?).await?;
            if machine {
                print_json(result.clone());
            } else {
                println!(
                    "{} · {} frames checked",
                    if result["ok"] == true {
                        "Passed"
                    } else {
                        "Failed"
                    },
                    result["sampledFrames"]
                );
                for issue in result["diagnostics"]
                    .as_array()
                    .context("Missing diagnostics")?
                {
                    println!("{}: {}", issue["code"], issue["message"]);
                }
            }
            if result["ok"] != true {
                std::process::exit(2);
            }
        }
        Commands::Snapshot {
            project,
            frames,
            output,
        } => {
            let store = ProjectStore::open(project)?;
            let output = relative_output(&store.root, output);
            print_json(renderer::snapshots(store.snapshot()?, &frames, &output).await?);
        }
        Commands::Review {
            project,
            every,
            offset,
            frames,
            strip,
            camera,
            crop,
            no_motion,
            output,
        } => {
            let store = ProjectStore::open(project)?;
            let output = output.map_or_else(
                || review::next_output(&store.root),
                |path| relative_output(&store.root, path),
            );
            let camera = camera
                .map(|v| {
                    <[f64; 3]>::try_from(v).map_err(|_| anyhow::anyhow!("--camera takes x,y,zoom"))
                })
                .transpose()?;
            let crop = crop
                .map(|v| {
                    <[u32; 4]>::try_from(v)
                        .map_err(|_| anyhow::anyhow!("--crop takes x,y,width,height"))
                })
                .transpose()?;
            let every = every.or((frames.is_empty() && strip.is_empty()).then_some(3.0));
            let options = review::Options {
                every,
                offset,
                frames,
                strips: strip,
                camera,
                crop,
                motion: every.is_some() && !no_motion,
            };
            print_json(review::review(store.snapshot()?, &options, &output).await?);
        }
        Commands::Polish {
            project,
            every,
            accept,
        } => {
            let store = ProjectStore::open(project)?;
            let picture = project::picture_revision(&store.root)?;
            if accept {
                print_json(polish::accept(&store.root, &picture)?);
            } else {
                let (output, pass, previous) = polish::next_output(&store.root);
                print_json(
                    polish::polish(
                        store.snapshot()?,
                        &picture,
                        every.unwrap_or(polish::EVERY_SECONDS),
                        &output,
                        pass,
                        previous.as_deref(),
                    )
                    .await?,
                );
            }
        }
        Commands::Render {
            project,
            output,
            quality,
            codec,
            overwrite,
            audio,
            workers,
            no_studio,
            unpolished,
        } => {
            let store = ProjectStore::open(project)?;
            // A film made from a brief is polished before its final render; a bare project is not held up.
            let polished = polish::state(&store.root)?;
            if quality == "final"
                && !unpolished
                && polished["state"] != "accepted"
                && store.root.join("brief.md").is_file()
            {
                bail!(
                    "No polish pass is accepted for this picture ({}). Run `superint-video polish <dir>`, fix what it lists, run it again until a pass is clean, then `polish --accept`. For a test render pass --quality draft; to render at final quality anyway pass --unpolished.",
                    polished["state"].as_str().unwrap_or("missing")
                );
            }
            let output = relative_output(&store.root, output);
            let audio = audio.map(|path| relative_output(&store.root, path));
            if output.extension().and_then(|s| s.to_str()) != Some("mp4") {
                bail!("Output must have .mp4 extension");
            }
            let cancel = CancellationToken::new();
            let signal = cancel.clone();
            tokio::spawn(async move {
                let _ = tokio::signal::ctrl_c().await;
                signal.cancel();
            });
            let snapshot = store.snapshot()?;
            let reporter = live::LiveRender::start(
                &store.root,
                &output,
                snapshot.manifest.duration_frames,
                snapshot.manifest.fps.num as f64 / snapshot.manifest.fps.den as f64,
            );
            if !no_studio && let Some(url) = live::ensure_studio(&store.root).await {
                eprintln!("Watch it in Studio: {url}");
            }
            let progress = reporter.clone();
            let callback: renderer::ProgressFn = Arc::new(move |stage, done, total| {
                progress.progress(stage, done, total);
                if done == 0 || done == total || done % 30 == 0 {
                    eprintln!("{}", progress.line(stage, done, total));
                }
            });
            let watcher = reporter.clone();
            let watch: renderer::FrameFn = Arc::new(move |frame, png| watcher.frame(frame, png));
            let finished = cancel.clone();
            let result = renderer::render_watched(
                snapshot,
                output,
                &quality,
                &codec,
                overwrite,
                audio,
                workers.map(usize::from),
                cancel,
                callback,
                Some(watch),
            )
            .await;
            reporter.finish(&result, finished.is_cancelled());
            let mut result = result?;
            result["polish"] = polished;
            print_json(result);
        }
        Commands::Voice { command } => match command {
            VoiceCommand::Check { project, script } => {
                let result = voice::check_project(&project, script.as_deref())?;
                print_json(result.clone());
                if result["ok"] != true {
                    std::process::exit(2);
                }
            }
            VoiceCommand::Takes {
                project,
                takes,
                paragraphs,
                dry_run,
            } => print_json(
                voice::takes(
                    &project,
                    &TakesOptions {
                        takes,
                        paragraphs,
                        dry_run,
                    },
                )
                .await?,
            ),
            VoiceCommand::Assemble {
                project,
                pick,
                no_verify,
            } => print_json(voice::assemble(&project, &pick, !no_verify).await?),
        },
        Commands::Transcribe {
            audio,
            model,
            language,
            terms,
            reference,
            output,
        } => print_json(
            voice::transcribe_file(&TranscribeOptions {
                audio: &audio,
                model: model.as_deref(),
                language: language.as_deref(),
                terms,
                reference: reference.as_deref(),
                output: output.as_deref(),
            })
            .await?,
        ),
        Commands::Music {
            project,
            variants,
            dry_run,
        } => print_json(music::generate(&project, variants, dry_run).await?),
        Commands::Sfx { command } => match command {
            SfxCommand::List { category } => print_json(earshot::list(category.as_deref()).await?),
            SfxCommand::Kit { project } => {
                let result = sfx::kit(&project).await?;
                print_json(result.clone());
                if result["ok"] != true {
                    std::process::exit(2);
                }
            }
            SfxCommand::Place { project } => print_json(sfx::place(&project).await?),
        },
        Commands::Listen {
            file,
            project,
            question,
            video,
            start,
            end,
        } => print_json(
            earshot::listen(
                &project,
                earshot::Listen {
                    file: &file,
                    question: question.as_deref(),
                    video: video.as_deref(),
                    start,
                    end,
                },
            )
            .await?,
        ),
        Commands::Mix { project } => print_json(mix::mix(&project).await?),
        Commands::Doctor {
            json: machine,
            online,
        } => {
            let dependencies = app::dependencies().await;
            let (generators, reachable) =
                providers::doctor(&std::env::current_dir()?, online).await?;
            // Earshot is needed for sfx only, so it does not fail the doctor.
            let ok = dependencies
                .iter()
                .all(|d| d["ok"] == true || d["optional"] == true)
                && reachable;
            let result = json!({
                "ok": ok,
                "version": env!("CARGO_PKG_VERSION"),
                "dependencies": dependencies,
                "generators": generators,
                "home": home::dir(),
                "settings": Settings::current(),
                "configuration": [
                    "SUPERINT_CHROME", "SUPERINT_FFMPEG", "SUPERINT_FFPROBE", "SUPERINT_EARSHOT",
                    "SUPERINT_ENV", "SUPERINT_HOME", "SUPERINT_FILMS", "SUPERINT_PRESETS",
                    "SUPERINT_DOWNLOADS",
                ],
            });
            if machine {
                print_json(result);
            } else {
                for dependency in dependencies {
                    println!(
                        "{}: {}",
                        dependency["name"],
                        dependency
                            .get("version")
                            .or(dependency.get("path"))
                            .or(dependency.get("error"))
                            .unwrap()
                    );
                }
                for key in result["generators"]["keys"]
                    .as_array()
                    .into_iter()
                    .flatten()
                {
                    println!(
                        "{}: {}",
                        key["name"],
                        if key["present"] == true {
                            "present"
                        } else {
                            "missing"
                        }
                    );
                }
            }
            if !ok {
                std::process::exit(2);
            }
        }
        Commands::Schema => print_json(Manifest::schema()),
    }
    Ok(())
}
fn relative_output(root: &Path, output: PathBuf) -> PathBuf {
    if output.is_absolute() {
        output
    } else {
        root.join(output)
    }
}
fn print_json(value: Value) {
    println!("{}", serde_json::to_string_pretty(&value).unwrap());
}
