# Superint Video for developers

How Superint Video is built, how your coding agent drives it and how to build it yourself. The [README](../README.en.md) covers installing and the first film; the app and Studio are described in the (German) [manual](HANDBUCH.md). *Deutsch: [ENTWICKLER.md](ENTWICKLER.md).*

## How a film is made

One sentence to the coding agent is enough:

```text
Use the superint-video skill: a flat-vector explainer, 60 seconds,
topic "Why sleep cleans the brain".
```

The agent only asks about what it cannot decide well itself, such as screenshots of the look you want. Then it works in steps that each leave a file in the project: research with sources, three concepts, script, beats, style frames, scenes, sound, review, polish and render. The polish pass runs by itself before every render: fresh eyes walk the film one still at a time (one every 10 seconds), fix what stands out and add detail, in one to three rounds. After you accept the film, a report follows with a making-of.

- **One world instead of slides.** Every picture is a pure function of time, and every movement hangs on a word of the voice.
- **Research that holds.** Every claim in the film has a source in the claim register. Three concepts and three script drafts compete.
- **Sound that sits.** Several takes per paragraph, transcribed and measured against the script. The music follows the real word times, the master is at −14 LUFS.

## Three parts, one tool

| Part | Decides | Included |
| --- | --- | --- |
| **Workflow skill** | What kind of film, how it is planned, written and checked | [`superint-explainer`](../skills/superint-explainer/SKILL.md) for explainers, [`superint-launch`](../skills/superint-launch/SKILL.md) for launch, update and product films (built on [cinetic](https://github.com/Leonxlnx/cinetic)) |
| **Style preset** | The look: colour, light, type, shapes, characters, motion | `flat-explainer`, `miniature-3d` (with its own skill [`superint-miniature`](../skills/superint-miniature/SKILL.md)), `launch`, `blank` |
| **References** | What the agent measures its pictures against | Your stills and screenshots, on the preset or in the project |

On top come the tool skill [`superint-video`](../skills/superint-video/SKILL.md) and the sound skill [`superint-audio`](../skills/superint-audio/SKILL.md). The rules in skills and presets are a floor, not a ceiling: a stronger model may do better and explains why in the report. A style travels as one file (`<name>.superint-style.zip`).

## The command line

Every step is a command, and every command prints JSON. The CLI never writes text itself: your agent writes every prompt for voice or music.

```powershell
superint-video new .\sleep --preset flat-explainer --topic "Why sleep cleans the brain" --seconds 60
superint-video studio .\sleep                 # brings Studio back
superint-video voice takes .\sleep            # takes per paragraph, transcribed and measured
superint-video voice own .\sleep --wait       # or: your own voice, recorded in Studio
superint-video music .\sleep                  # music variants, measured
superint-video sfx kit .\sleep                # sounds from Earshot, placed on frames with sfx place
superint-video mix .\sleep                    # ducking, master at −14 LUFS
superint-video review .\sleep                 # contact sheet and worksheet for the review round
superint-video polish .\sleep                 # last look before the render: the next still
superint-video polish .\sleep --accept        # record the finished walk
superint-video render .\sleep --audio audio/master.wav --output renders/video.mp4
superint-video listen .\sleep\renders\video.mp4 --project .\sleep   # listen back
superint-video doctor --json                  # finds Chrome, FFmpeg, Earshot and the API keys
```

Without a folder, a new film goes into the films folder. Every command and option is in `superint-video <command> --help` and in the [manual](HANDBUCH.md).

## Where things are

| What | Where |
| --- | --- |
| Program (setup) | `%LOCALAPPDATA%\Programs\Superint Video`; this folder is on the user's PATH |
| Program (ZIP) | wherever you unpacked it |
| Settings, film list, own styles | `%USERPROFILE%\.superint-video` (`SUPERINT_HOME`) |
| API keys saved in the app | `%USERPROFILE%\.superint-video\keys.dat`, encrypted for your Windows account with DPAPI |
| Films | `Videos\Superint Video` (`SUPERINT_FILMS` or Setup) |
| The agent's skills | `%USERPROFILE%\.claude\skills\`, `%USERPROFILE%\.codex\skills\` or `%USERPROFILE%\.gemini\config\skills\` |

`superint-video.exe` is the Rust CLI with the embedded Studio (Svelte 5), scene runtime and presets. `Superint Video.exe` is only a small launcher without a console window that runs `superint-video app` from its own folder. Both belong in the same folder.

## API keys while developing

The app stores keys encrypted. A `.env` file (template: [`.env.example`](https://github.com/marlonka/superint-video/blob/main/.env.example)) or environment variables still work and win: environment before `.env` before the app. The tool looks at `SUPERINT_ENV`, else the first `.env` above the project, the working folder or the program. The file is in `.gitignore` but lies there unencrypted, and any coding agent in the repository can read it. When keys come from a `.env`, Setup offers "Move into the app": the keys go into the app encrypted, and a file that held nothing but keys goes to the recycle bin. `doctor --json` shows names and sources, never values.

## Building from source

You need Windows x64, Rust 1.100 with the MSVC build tools, Node.js 26.13.1 LTS and npm 12.2.2. For the installer also [Inno Setup 6](https://jrsoftware.org/isinfo.php):

```powershell
winget install --id JRSoftware.InnoSetup --exact --scope user
git clone https://github.com/marlonka/superint-video
cd superint-video
.\scripts\build.ps1
```

`build.ps1` builds Studio, checks types, formatting, the schema and every test, and puts into `dist\`:

| File | For |
| --- | --- |
| `Superint-Video-Setup.exe` | the installer the README links to (only with Inno Setup) |
| `superint-video-<version>-windows-x64.zip` | the same to unpack, without installing |
| `Superint Video.exe`, `superint-video.exe` | the launcher and the CLI, to try straight from `dist\` |
| `SHA256SUMS.txt` | checksums |

The build clears older packages out of `dist\`; they are on the releases page. While the app runs from `dist\`, Windows locks the EXE: run `.\dist\superint-video.exe app --stop` first. The installer script is [`packaging/setup.iss`](https://github.com/marlonka/superint-video/blob/main/packaging/setup.iss). Tests, the project format and releases are covered in [CONTRIBUTING.md](../CONTRIBUTING.md), the format in [FORMAT.md](FORMAT.md), the interfaces in [INTERFACES.md](INTERFACES.md).
