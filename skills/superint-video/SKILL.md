---
name: superint-video
description: Make and edit videos with the local Superint Video tool - any kind (explainers, launch films, update videos, promos, title cards, loops) in any style, built from HTML scenes and a JSON timeline and rendered to MP4 by the superint-video CLI, with a browser Studio for editing. Read this first for any Superint Video work, when a brief.md or video.json from Superint Video is present, or when the user asks for a video with Superint Video or one of its style presets (blank, flat-explainer, miniature-3d, launch, or their own). Workflow skills (superint-explainer, superint-launch) plan specific kinds of film on top of it; superint-audio adds voice, music and sound.
---

# Superint Video

Superint Video is a local tool, not an agent. You are the director and the whole studio. The `superint-video` CLI scaffolds projects, checks frames, takes snapshots and review sheets, runs Studio and renders through Chromium and FFmpeg. Everything stays in the project folder. Rendering needs no accounts and no network.

The tool itself has no taste. Three things decide what a film becomes, and each comes from somewhere else:

| Layer | Answers | Comes from |
| --- | --- | --- |
| **Workflow** | What kind of film, how it is planned, written, composed and reviewed | A workflow skill: `superint-explainer`, `superint-launch`, or your own |
| **Look** | Palette, type, shapes, light, characters, motion vocabulary | A style preset: `STYLE.md`, `kit/`, `scenes/lib/`, `blocks/` |
| **References** | What "good" looks like for this film | Stills, screenshots or clips in the project's `references/` |

Audio (narration, music, sound effects from [Earshot](https://github.com/Leonxlnx/earshot), mix and master) lives in the `superint-audio` skill. Use it whenever the brief wants sound: a finished film has sound.

API keys are optional. A film needs a coding agent, Chrome and FFmpeg; a key adds the AI voice, measured word times, generated music, dictation and styles from pictures. Who speaks is one of three routes, named in the prompt or the brief ("an AI voice narrates it", "I narrate it myself", "no narration"): an AI voice, the user's own voice recorded in Studio or brought as a file, or no voice. When neither names one, `doctor --json` → `capabilities.narration` says which fits what is set up. Never stall a film to wait for a key; `superint-audio` has each route in [own-voice.md](../superint-audio/references/own-voice.md).

## The rules are a floor, not a ceiling

Everything in these skills and in a preset's `STYLE.md` is the accumulated experience of what made earlier films good and what spoiled them. Treat it as defaults and a minimum bar, never as a limit on what you may do. If you see a better way to serve the user's intent (a stronger idea, a better structure, a technique no rule mentions, a tool you can write in a few lines), do it, check it against the references and the rubric, and say in `report.md` what you did differently and why. Only three things are hard: the user's brief and brand, the truth of what the film claims, and the technical rules below that keep rendering correct.

## Start: as little as the user wants to say

The user should only have to say **what** and **in which style**, and roughly **how long** ("a 60 s flat-vector explainer about sleep", "a 25 s launch film for Acme in our brand"). Length is a direction, never a cut. Everything else you decide.

**The user's default style.** The app keeps one default style and the films folder; `superint-video settings` prints them, and `new` takes them when the request names neither (`fromSettings` in its result lists which). With a default style, `superint-video new --topic "…" --message "…"` is a complete command. Length, format and language come from the request: the start page's prompt names the format and the language every time. "Choose the style that suits the topic" means you pick the preset; "choose the length that suits the topic" means you decide how long the topic needs and pass it as `--seconds`. What the user says always wins; tell them which style you took and why.

**Where the film goes.** Leave the folder out. `new` then puts the film into the user's films folder (`filmsFolder` in `superint-video settings`: `Superint Video` in their Videos folder unless they chose another), in a folder named after the topic, and prints its path as `project`. Use that path for every later command. Give a folder only when the user names one. Never create a film inside the tool's own folder or inside a code repository: a film is large and is not source code.

1. **Style → preset.** If the user named no style and `settings` shows a default preset, take it. Otherwise run `superint-video preset list --json` and map the user's words to a preset ("flat explainer", "animated science-channel look", "cartoon explainer" → `flat-explainer`; a launch, update, product or feature film that shows the product → `launch` (plus the brand kit); "our brand", "clean", "Apple-like" without the product on screen → `blank` plus brand kit or references; "3D", "photoreal", "miniature", "like Videos aus Code" → `miniature-3d`, and read the `superint-miniature` skill). The preset's default `workflow` usually settles the kind of film too.
2. **Kind of film → workflow skill**, if the preset or the request does not already say it: explainer → `superint-explainer`, launch, update, product or feature film → `superint-launch`. No fitting workflow: plan it with this skill alone.
3. **Ask only for what you cannot decide well yourself**, in one short round: which preset if the style is ambiguous; the product's material or brand kit for a product film; screenshots of the look when the preset has no references and the user named a style you cannot see. Never ask for what has a sensible default.

```sh
superint-video new --preset <preset> --workflow <skill> --topic "<topic>" --message "<the one sentence>" --seconds 60 --format 16:9 --language de --reference a.png,b.jpg
```

More options: `--audience`, `--must "<text>"`, `--avoid "<text>"`, `--stop <names>` (the workflow skill names its stops), `--script <file>` (kept verbatim). `new` refuses to run without a preset from the request or the user's defaults, so the look is always a choice. It prints JSON with the project path, size, frame count, narration word budget and the number of references, and writes `brief.md`.

Then read the workflow skill and follow it. To edit an existing project (a folder with `video.json`), read [references/editing.md](references/editing.md) and change only what was asked.

**Starting from another film.** When the user names one of their films as the base ("Nimm meinen Film … als Vorlage", "like my sleep film, but about dreams"), do not run `new`. Run `superint-video duplicate "<film folder>" --topic "<new topic>"`: it copies brief, scenes, kit, references, blocks and sound into a new folder in the films folder, names the copy, opens Studio and prints the new `project`; renders, `report.md`, `process/` (status, reviews, polish) and Studio's state stay behind. Work only in the copy. Rewrite `brief.md` for the new film first (topic, message, audience, length, language), then change only what the new topic needs and keep what still fits: the style, the world, the kit, the music if it suits. The copy needs its own polish pass and render.

## Let the user watch

Studio shows the production live: the brief, the preset and skills in use, the references, your current step, the working documents, the latest changes, and the preview, which reloads whenever a scene or `video.json` changes.

- `new` starts Studio in the background, opens it in the browser and prints its address as `studio`. Name that URL in your reply, so the user can watch from the first minute. `superint-video studio <dir>` brings it back, for an existing project too; `--stop` ends it. It ends by itself after two hours without a viewer or a render. Started again it takes the address it had, so a window the user still has open connects again by itself. Pass `--no-studio` to `new` or `render` only if the user asks.
- The app is the user's window on everything: `superint-video app` opens its start page (setup, a prompt builder, every film on this computer, the defaults) in a window of its own and returns at once. While that page is open it goes to a new film by itself, so `new` opens no second window. In a film's Studio the logo leads back to it.
- Studio's Progress panel shows the polish pass live: how many pictures are looked at, what is to fix, and every row with its picture, finding and fix. Fill the worksheet in as you look, not at the end, so the user sees the critique happen.
- `render` shows itself there, whoever started it: the picture fills with the frame being rendered, with percent, frames per second, time left and a film strip of what is done, and the finished film plays in the same place. Never leave the user guessing whether a render is still running: name the URL again when you start one.
- Long commands (`check`, `snapshot`, `review`, `polish`, `voice takes`, `music`, `mix`, `listen` and so on) appear under "Running now", and the newest contact sheet under "Looked at last", without you doing anything.
- Keep `process/status.json` current at every step change and whenever you start something that takes a while:

  ```json
  {"step": "Beats", "note": "Timing the hook to the word timestamps", "steps": [
    {"name": "Research", "state": "done"}, {"name": "Beats", "state": "active"}, {"name": "Build"}]}
  ```

  `steps` are the workflow's steps in order (`state`: `done`, `active`, or omitted for not yet); `note` is one plain sentence about what you are doing right now. Write step names and the note in the language the user writes to you in, even when the film speaks another: the start page and Studio show them to the user as they are.
- Put scenes on the timeline early, even rough, so the user sees the film grow instead of a blank preview until the end.

## Looks, references and the yardstick

- The project's `STYLE.md` is the look contract. The workflow skill's `direction.md` makes it concrete for one film; it may narrow `STYLE.md` but not break it unless the brief says so.
- `references/` is the yardstick. Before style frames, look at every reference and write into `direction.md` what you take from each (palette, type, light, composition, motion) and what not. Put your style frames and every review contact sheet next to them at the same size. Anything that looks emptier, flatter, cheaper or less finished beside them is a defect.
- Without references, ask once. Without any, judge against `STYLE.md` and the workflow's rubric, and say in the report that no references were given.
- References show a look; they are never content. Never copy their scenes, characters, logos or layouts. Reference files of other people's films stay out of version control.

Presets, their layout, where they live and how to make your own: [references/styles.md](references/styles.md).

## How you work

- **Look at what you made.** Judge only frames you rendered and looked at: `snapshot` for single frames, `review` for a pass over the whole film. See [references/review.md](references/review.md).
- **Critique loops.** First drafts are raw material. Every creative step the workflow names runs at least two rounds of draft → critique → revise. A critique is a list of concrete defects (what, where, why it hurts), not a score. If your host can start a sub-agent, let one critique cold, without your reasoning.
- **Polish before every render.** Without being asked, and before any delivery render, the film gets a last look by eyes that did not build it. `superint-video polish` lays out a still every 5 s, close-ups, both sides of every cut and the fastest moves; the polisher (a cold sub-agent on the most capable model the host offers, if it can start one) fixes what a viewer would spot at once, pass after pass, until one is clean and `polish --accept` records it. The user sets 1 to 3 rounds in advance (`polishRounds`); each round is a new cold polisher after the one before, and `polish` says which round is running. `render` refuses a film with a brief until the last round is accepted. See [references/polish.md](references/polish.md).
- **Hand over at the render.** The accepted polish pass is the last check. When the render is done, give the user the MP4 and the Studio address and stop: they watch before anything else happens. Thumbnail, report, making-of and cleanup follow once they accept.
- **Stops.** `brief.md` lists where the user wants to be asked. With none, decide like a director, never ask, and justify the decisions in `report.md`. Outside the stops, ask only when blocked.
- **Making-of.** Every accepted film gets a short making-of in `report.md` (`## Making-of`, in the brief's language), ready to paste under the video: what the user gave (topic, direction, feedback), what you did step by step, and which models and tools made which part, through which provider, with the real numbers from the project (claims in the register, scenes, frames rendered, takes, music variants, sound effects placed). Only what actually happened; count, don't estimate. Example of the tone: "Das Video ist komplett mit KI gemacht. Ich habe Thema, Richtung und Feedback gegeben …".
- **Clean up** after a render is accepted: keep the delivered MP4, thumbnail, worksheets and contact sheets; move frame dumps, superseded test renders and comparison encodes to the trash (never delete for good) and name what you moved in `process/review.md`.

## Rules that always apply

- `video.json` is the timing authority. Placement, trims, fades and offsets are integer frames there; scene HTML owns only composition and animation. At 30 fps, 1 s = 30 frames. Format: [references/project.md](references/project.md).
- Animation is a pure function of `time`/`frame`: no CSS animations, `Math.random()`, wall clock or state accumulated between frames. Seeking backward must look identical to playing forward. See [references/scene-api.md](references/scene-api.md).
- Timed audio and video belong in the manifest, never as `<audio>`/`<video>` in a scene. Everything a scene loads is local (`../kit/`, `../assets/`).
- Text, interfaces and documents stay real HTML, also where they need an effect CSS cannot do (a screen in space with depth of field, glass, a shader transition, a page as a lit texture in a 3D world): a canvas draws its `drawable` children through a shader. Never redraw type or an interface by hand in a canvas for that. See [references/html-in-canvas.md](references/html-in-canvas.md); it needs Chrome 157 or newer.
- No invented facts, statistics, quotes, product features or customer names. What the film claims comes from the brief, the user's material or sources the workflow skill records.
- Emulate a style through craft: shape, light, colour, motion, pacing. Never copy names, logos, characters or footage of other channels or brands; brand material only from the user for their own brand.
- Secrets (`GEMINI_API_KEY`, `OPENROUTER_API_KEY`) belong to the user. They add them under Setup in the app, which keeps them encrypted on their computer and never shows them again; a `.env` file works too. Only the tool reads them. Never ask for a key in the chat, never print, log, commit or paste one, and never write one into a file yourself. When a command says a key is missing, take the route that needs none (the user's own voice, no voice, no music) and say once that a key under Setup in the app (`superint-video app`) would add the rest. `doctor --json` shows names only.
- Preserve the user's work: clip IDs, source offsets, assets, edits made in Studio. Re-read `video.json` before writing if time has passed since you read it.
- Change an existing timeline with `edit`, the same operations Studio's buttons send, rather than by rewriting `video.json`: a text or other scene prop, timing, position, opacity, fades, gain, hiding or muting, splitting, duplicating, deleting. It checks the change like Studio does and writes it as one step; with the film's Studio open it goes through Studio, so the user sees it at once and can take it back with Ctrl+Z. Writing `video.json` yourself stays right for building the timeline in the first place. Sizes and layout live in the scene's HTML/CSS: change them there, or declare a prop (a `number` for a size, a `color`) when the user should be able to change it in Studio too.
- The film's main font is a setting the user changes in Studio (Film → Font) and you with `fonts`. Every scene takes it: set the main text in `font-family: var(--font)` (the style's `--font` on `:root` is the default), and text you draw into a canvas, WebGL or an SVG attribute in `fontFamily('<the style font>, sans-serif')` from `/runtime/scene.js`. Fonts for a deliberate second role (code, handwriting, a sign) keep their own family. Before a frame, the runtime loads every face of the chosen font, so measure text in `render`, not in `ready`.

## CLI

| Command | Use |
| --- | --- |
| `doctor --json [--online]` | Chrome/Chromium, FFmpeg, Earshot and API keys present, plus the user's folder and defaults? `capabilities` says what works now: `aiVoice`, `transcription`, `music`, `dictation`, `style`, `ownVoice`, `soundEffects`, and `narration` (`ai` or `own`). `--online` also checks which models the keys reach, with live prices. |
| `app [--no-open] [--stop]` | The app's start page: setup (coding agent with skills, tools, keys), prompt builder, films, defaults; in German or English. Starts in the background and returns its address at once |
| `settings`, `settings set <key> <value>` | The user's choices: the default style `preset`, the films folder `projectsDir`, `window` and `follow`, the models, and `polishRounds` (1 to 3 rounds of polish before a render). An empty value clears one |
| `new [<dir>] [--preset <p>] … [--polish-rounds 1-3] [--no-studio]` | Project from a style preset plus `brief.md`, with the chosen workflow and references; opens Studio. Without `--preset` it takes the user's default style. Without `<dir>`, the usual case, the film gets a folder named after the topic in the user's films folder. `--polish-rounds` only when the user names a number for this film; otherwise the setting holds. Reports the rounds under `polish` |
| `duplicate <film> [--topic "…"] [--name "…"] [--to <dir>] [--no-studio]` | A new film from a copy of another: sources, scenes and sound, without renders, report, status and reviews. Lands in the films folder named after the topic, opens Studio, prints `project` |
| `preset list [--json]` | Presets with description, formats, default workflow and number of references |
| `preset show <name>` | A preset's configuration, files and references |
| `preset new <name> --from <preset> [--reference …]` | Fork a preset into the user folder, with new references |
| `preset reference <name> <files…>` | Add references to a preset; every new project gets a copy |
| `preset create --reference a.png,b.jpg [--describe "…"] [--name "…"] [--language de]` | A new style of the user's own: a vision model of the user's API key looks at up to 12 pictures (PNG, JPEG, WebP) and the description and writes `STYLE.md` and the kit's colours and type; the pictures become its references. One of the two is enough. Takes a minute or two, prints `preset`, `path`, `styleMd`. Read [references/styles.md](references/styles.md) first |
| `preset from-film <film> [--name "…"] [--describe "…"]` | A style from a finished film: its `STYLE.md`, `direction.md`, kit, references and stills, generalised by the same model so nothing of the film's topic stays. The film is not changed |
| `inspect <dir> --json` | Manifest, revision, clip overview |
| `edit <dir> --clip <id> --prop title="…" --set opacity=0.8` | What Studio does, from the command line: `--prop key=value` for scene props (a text stays text), `--set field=value` for `startFrame`, `durationFrames`, `opacity`, `gain`, `fadeInFrames`, `fadeOutFrames`, `hidden`, `muted`, `transform.x/y/scale/rotation`. Any operation as JSON too, one or a list, or `@file`/`-` (stdin; best on Windows PowerShell, which strips quotes): `updateClip`, `splitClip {id, frame}`, `duplicateClip`, `deleteClip`, `addClip`, `addTrack`, `updateTrack {hidden, muted, name}`, `updateProject {name, width, height, fps, durationFrames, background}`. `--dry-run` checks and prints without writing. Prints the clips it changed and whether it went through Studio |
| `fonts <dir> [<family>] [--reset]` | The film's main font: the one set, the style's, the families the film's files declare and the tool's library (Geist, Nunito, Jost, Fraunces, Courier Prime, JetBrains Mono, Caveat), and whether its scenes take it. With a family it switches every scene that takes it, through Studio when open; `--reset` goes back to the style's |
| `models`, `models check <id> --job <job>`, `models set <job> <id>` | Which model does which job (`narration`, `voice`, `timings`, `music`, `dictation`, `style`) for new films, through which provider now, and the known alternatives. `check` asks for free whether the keys reach a model; `set` checks, then saves it for every new film (empty: back to the usual one). When the user asks for another model, check it first |
| `check <dir> --json` | Validates manifest and sampled frames of every scene |
| `snapshot <dir> --frames 0,45,90 --output renders/snapshots` | PNG frames plus a contact sheet |
| `review <dir> [--offset 1.5] [--every 3] [--frames …] [--strip a-b] [--camera x,y,zoom] [--crop x,y,w,h]` | One polish pass into `renders/review/<n>/`: contact sheet, worksheet, strips and close-ups; measures static stretches, actors cut to a sliver and highlights off their target |
| `polish <dir> [--every 5] [--accept]` | The last look before a render, into `renders/polish/<n>/`: stills, close-ups at native resolution, both sides of every cut, strips over the fastest moves and a worksheet. A later pass lists only what changed or stayed open; `--accept` records a clean pass and says in `next` whether another round is due. After an accepted round, the next pass starts the next round over the whole film. Reports `round` and `rounds` |
| `studio <dir> [--no-open] [--stop]` | Local editor and live view in the browser. Reuses an instance already running for the project (foreground process otherwise; `new` and `render` start it detached) |
| `render <dir> --output renders/video.mp4 [--audio audio/master.wav] [--codec x265\|x264] [--workers N] [--quality draft] [--unpolished]` | Final MP4 with AAC; x265/HEVC by default (half the size) or x264/H.264 (plays everywhere); with `--audio` the master is muxed and measured on the MP4. A film with a brief needs its last polish round accepted: `--quality draft` for test renders, `--unpolished` only on the user's word |
| `voice …`, `transcribe …`, `music …`, `sfx …`, `listen …`, `mix …` | Audio: see the `superint-audio` skill |

`init <dir>` creates a minimal one-scene project without a preset. Every command prints JSON on success and `{"error", "message"}` on failure.

## Boundaries

Supported: HTML/CSS/SVG/JS scenes (including canvas, WebGL and real HTML drawn by a canvas through a shader, see [references/html-in-canvas.md](references/html-in-canvas.md)), images, SDR video, audio clips, frame-exact timing, transforms, opacity, fades, gain, mute, typed scene props, PNG snapshots, MP4 with HEVC (x265) or H.264 (x264) and AAC.

Not supported: hosted rendering, accounts, telemetry, speed ramps, optical flow, HDR, alpha video, built-in motion blur. Identical pixels across different browsers, operating systems and font installs are not guaranteed; fonts shipped in the preset keep text stable.
