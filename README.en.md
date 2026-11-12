<p align="right"><a href="README.md">Deutsch</a></p>

<h1 align="center">Superint Video</h1>

<p align="center">
  <b>Your coding agent makes videos: explainers, launch films, loops, in any style.</b><br>
  HTML scenes, a timeline in JSON, a Studio in the browser and an MP4 at the end.<br>
  Local on your machine, no account, no credits, no cloud render service.
</p>

<p align="center">
  <img alt="Rust" src="https://img.shields.io/badge/Rust-CLI%20%2B%20Studio-b7410e?style=flat-square&logo=rust">
  <img alt="Windows x64" src="https://img.shields.io/badge/Windows-x64-2f7bf5?style=flat-square">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-3a3a3a?style=flat-square">
  <a href="https://github.com/marlonka/superint-video/releases/tag/v0.7.1"><img alt="Release: v0.7.1" src="https://img.shields.io/badge/Release-v0.7.1-2e8b57?style=flat-square"></a>
</p>

<br>

<p align="center">
  <img src="docs/images/studio.jpg" alt="Superint Video's Studio: the preview of a finished explainer on the left, the coding agent's progress on the right, the timeline with scenes, voice, music and sound effects below" width="100%">
  <br>
  <sub>Studio with a finished film. You see what your coding agent is doing and change whatever you like yourself.</sub>
</p>

> [!NOTE]
> The app and Studio speak English and German. The manual, changelog and contribution guide are in German for now; the skills your agent reads are in English. Issues and pull requests in English are welcome.

## How a film is made

Say what you want, in which style and roughly how long. One sentence is enough:

```text
Use the superint-video skill: a flat-vector explainer, 60 seconds,
topic "Why sleep cleans the brain".
```

The agent only asks about what it cannot decide well itself, such as screenshots of the look you want. Then it works in steps that each leave a file in the project: research with sources, three concepts, script, beats, style frames, scenes, sound, review, polish and render. The polish pass runs by itself before every render: fresh eyes look at every still, cut and movement and fix things until nothing stands out. You choose the number of rounds in Setup beforehand: one, two or three, each with new eyes and a closer look at the detail. After you accept the film, a report follows with a making-of to paste under the video.

- **One world instead of slides.** Every picture is a pure function of time, and every movement hangs on a word of the voice, so picture and word meet on the exact frame.
- **Research that holds.** Every claim in the film has a source in the claim register. Three concepts and three script drafts compete; the best goes through rounds of critique.
- **Sound that sits.** Several takes per paragraph, transcribed and measured against the script. The music follows a timeline built from the real word times, sounds sit on their frames, the master is at −14 LUFS.
- **Take over yourself.** Change text, timing and media on a timeline in Studio, with undo, shortcuts and export. Your agent sees the changes at once.

<p align="center">
  <a href="https://github.com/marlonka/superint-video/releases/download/v0.3.0/superint-video-launch.mp4"><img src="docs/images/launch-film.jpg" alt="A frame from the launch film: a line of text over the softly blurred Studio" width="100%"></a>
  <br>
  <sub><a href="https://github.com/marlonka/superint-video/releases/download/v0.3.0/superint-video-launch.mp4">Watch the launch film</a> (32 s, German, with sound). Superint Video made it itself, in the <code>launch</code> style.</sub>
</p>

## The app

Double-click `Superint Video.exe` to open the start page. Type a topic, pick style, length, format and language, press "Copy prompt" and paste it into Claude Code or ChatGPT Codex. Your films appear below with their status while they are being made.

- **Setup nobody misses.** While something is missing, the app shows only that: a coding agent with the skills, Chrome and FFmpeg. An API key is optional, and Setup says what works without one and what it adds. Every row has the one button that does it.
- **Skills kept current.** One click copies the skills into your agent's folder. After an app update it offers "Update the skills"; whatever is replaced stays on your machine.
- **Films in one place.** Every film is a folder with everything that belongs to it, in `Videos\Superint Video`. You can choose another one in Setup under "Where films are saved".
- **Styles as files.** Choose a default style, add your own reference images, duplicate a style, or share it as a single `<name>.superint-style.zip`.

## Three parts, one tool

| Part | Decides | Included |
| --- | --- | --- |
| **Workflow skill** | What kind of film, how it is planned, written and checked | [`superint-explainer`](skills/superint-explainer/SKILL.md) for explainers, [`superint-launch`](skills/superint-launch/SKILL.md) for launch, update and product films (built on [cinetic](https://github.com/Leonxlnx/cinetic)) |
| **Style preset** | The look: colour, light, type, shapes, characters, motion | `flat-explainer` (flat vector art, characters, bright colour worlds), `miniature-3d` (a photographic miniature world computed entirely in code, with its own skill [`superint-miniature`](skills/superint-miniature/SKILL.md)), `launch` (your product's real interface rebuilt in code, for music-led launch films), `blank` (no house look, for your brand) |
| **References** | What the agent measures its pictures against | Your stills and screenshots, on the preset or in the project |

On top come the tool skill [`superint-video`](skills/superint-video/SKILL.md) and the sound skill [`superint-audio`](skills/superint-audio/SKILL.md). The rules in skills and presets are a floor, not a ceiling: a stronger model may do better and explains why in the report.

## Built for agents

Every step is a command, and every command prints JSON. The CLI never writes text itself: your agent writes every prompt for voice or music.

```powershell
superint-video new .\sleep --preset flat-explainer --topic "Why sleep cleans the brain" --seconds 60
superint-video voice takes .\sleep     # takes per paragraph, transcribed and measured
superint-video voice own .\sleep --wait   # or: your own voice, recorded in Studio
superint-video music .\sleep           # music variants, measured
superint-video sfx kit .\sleep         # sounds from Earshot, placed on frames with sfx place
superint-video mix .\sleep             # ducking, master at −14 LUFS
superint-video review .\sleep          # contact sheet and worksheet for the review round
superint-video polish .\sleep          # last look before the render
superint-video render .\sleep --audio audio/master.wav --output renders/video.mp4
```

Every command and option is in `superint-video <command> --help` and in the (German) [manual](docs/HANDBUCH.md).

## Under the hood

- **One EXE and a launcher:** `superint-video.exe` is the Rust CLI with the embedded Studio (Svelte 5), scene runtime and presets; `Superint Video.exe` opens the app.
- **Scenes are HTML:** every frame looks the same whether played forwards, backwards or after a jump. `video.json` stores all times as whole frames.
- **Rendering:** Chrome captures the frames, several browsers in parallel; FFmpeg encodes HEVC or H.264 and checks the result.
- **Sound:** the provider is configuration: Google AI Studio (`gemini-3.8-flash-tts`, `gemini-3.5-transcribe`, `lyria-3.5`) or OpenRouter. Every request is cached, and API keys are stored encrypted in the app or in a `.env`. Without an API key: your own voice with estimated word times, sound effects from Earshot, and every MP4 has an audio track, a silent one if need be.
- **Tested:** over 100 tests; `scripts/build.ps1` builds and checks everything locally, and CI runs it on every pull request.

## Get started

1. Download the ZIP from [Releases](https://github.com/marlonka/superint-video/releases/latest) and unpack it.
2. Start **`Superint Video.exe`**. Setup shows what is missing, with one button per row:
   - **Coding agent:** Claude Code or ChatGPT Codex. One click copies the Superint skills into it. By hand, the folders from `skills/` go into `%USERPROFILE%\.claude\skills\` or `%USERPROFILE%\.codex\skills\`.
   - **Chrome** (or Edge) and **FFmpeg:** "Install" runs winget in a visible terminal window and agrees to nothing on your behalf.
   - **An API key** from Google AI Studio or OpenRouter is optional. Without one you get picture, on-screen text and sound effects, and you narrate the film yourself or leave it without a voice. With one come the AI voice with exact word times, generated music, dictation and styles from pictures. It stays encrypted on your machine.
   - [Earshot](https://github.com/Leonxlnx/earshot) for sound effects is optional.
3. Describe your film under "New film", copy the prompt and paste it into your coding agent.

Check the installation from the command line with `.\superint-video.exe doctor --json`. To build from source: `git clone`, then `.\scripts\build.ps1` (Rust 1.100, Node.js 26.13.1 LTS and npm 12.2.2).

> [!IMPORTANT]
> **Status:** v0.7.1. Only Windows x64 is tested. Short SDR films work well; long projects, HDR and ripple editing do not. Reports from macOS and Linux are welcome.

## Privacy and AI content

Superint Video collects no usage data and needs no account. Picture, Studio and render stay on your machine, and so does your own voice as long as no API key measures its word times. For the AI voice, transcription and music, the texts and recordings your agent writes for them go to the provider you set up (Google AI Studio or OpenRouter), under its terms. On the free tier of the Gemini API, Google may use them to improve its products. What your coding agent does with your files is governed by its provider.

Voice and music usually come from generative models. Every exported MP4 says so in its metadata. When you publish a film, label it visibly as AI-assisted too, and only recreate a real voice with that person's consent.

## Contributing, security, license

- Bugs and ideas: [issues](https://github.com/marlonka/superint-video/issues/new/choose). How to build and test: [CONTRIBUTING.md](CONTRIBUTING.md).
- Security issues: privately, as described in [SECURITY.md](SECURITY.md).
- Superint Video is under the [MIT License](LICENSE). The launch workflow builds on [cinetic](https://github.com/Leonxlnx/cinetic), sound effects and hearing come from [Earshot](https://github.com/Leonxlnx/earshot), both by Leonxlnx under MIT. The fonts Nunito, Geist and those of the miniature preset are under the SIL Open Font License. All dependencies and their licenses are in the [third-party notices](THIRD_PARTY_NOTICES.md).
