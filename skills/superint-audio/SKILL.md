---
name: superint-audio
description: Voice, music, sound effects and mix for Superint Video projects - narration takes with measured word timings, generated music, Earshot SFX placed on frames, and a mastered -14 LUFS mix, through the superint-video CLI (voice, transcribe, music, sfx, mix). Use when a Superint Video project needs narration, a music bed, sound design or a final mix, or when switching TTS, transcription or music providers (Google AI Studio or OpenRouter). Read the superint-video skill first.
---

# Superint Video audio

The CLI does every API call, keeps the keys, caches each request, measures every take and cuts and mixes the result. You write every text a generator gets (`voice.md`, `music-prompt.md`, `audio/kit.json`, `sfx.json`, optionally `mix.json`), and the tool never changes a word.

Generate audio only when the brief or the user asks for it and the key is present (`superint-video doctor --json`); otherwise render silent and say so in `report.md`. User-supplied audio (a voice recording, a licensed track) goes into `assets/` and onto the audio tracks; `transcribe` gives it word timings too.

## Providers are configuration, not code you write

| Job | Google AI Studio (`GEMINI_API_KEY`, default) | OpenRouter (`OPENROUTER_API_KEY`) |
| --- | --- | --- |
| Narration | `gemini-3.8-flash-tts` | `elevenlabs/eleven-v4-turbo`, or `google/gemini-3.8-flash-tts` |
| Word timings | `gemini-3.5-transcribe` | `microsoft/mai-transcribe-2`, or `google/gemini-3.5-transcribe` |
| Music | `lyria-3.5` | `google/lyria-3-pro-preview` |

- The route follows the model ID: an ID with a `/` goes through OpenRouter, any other is Google's. Google's models go through Google Cloud (Gemini Enterprise Agent Platform: the user's Google sign-in or `GOOGLE_CLOUD_API_KEY`) when that is set up, else through Google AI Studio; same IDs, same prompting, except that Lyria 3.5 runs as `lyria-3-pro-preview` there. OpenAI's models (`gpt-…`) only write down the user's dictations in the app; the tool refuses them for a film.
- `superint-video models` says which model does which job for new films, through which provider now, and what else is known to fit. When the user asks for another model or voice, run `models check <id> --job <job>` first (it costs nothing and says whether the keys reach it); for this film only, name it in `voice.md` or `music-prompt.md`; for every new film, `models set <job> <id>` after the user agrees.
- Defaults come from the models the user chose in Setup (`doctor --json` → `chosen`), then the project's `preset.json` (`narration`, `transcription`, `music`); `voice.md` and `music-prompt.md` override both per project with `model:` (and `transcription:` in `voice.md`). Respect the user's choice: name another model in `voice.md` only when the film needs it, and say why in the report. Without a voice for the other route, the tool takes that route's default voice (Sadaltager or daniel).
- To switch provider, change the model IDs there; nothing else changes. Then read that provider's file before writing a prompt, because tag syntax, voices, limits and prompting differ:
  - [references/google-ai-studio.md](references/google-ai-studio.md): Gemini TTS, Gemini Transcribe, Lyria
  - [references/openrouter.md](references/openrouter.md): ElevenLabs v4 Turbo, MAI-Transcribe-2, Lyria
- AI Studio is the default because the OpenRouter credits are limited. At a daily limit the tool switches by itself, Google Cloud → AI Studio → the same model on OpenRouter, as far as the keys reach, and says so; never wait for the reset. When OpenRouter answers 402, switch the route rather than retrying.
- One key is enough. With only `OPENROUTER_API_KEY`, the AI Studio models (`gemini-…`, `lyria-…`) run through OpenRouter by themselves; with only `GEMINI_API_KEY`, OpenRouter-only models such as ElevenLabs are out of reach, and the command says so before it costs anything.
- A new provider needs an adapter in the CLI (`src/providers/`) and its own provider file here with access, prompting and house rules.
- A voice of its own (a brand voice, a character, the user's own voice) comes from Google's Voices API: design, remix or, with consent, replicate it; the provider file says how. Its `voice_…` ID then goes into `voice.md` like a prebuilt name.
- The provider file is Google's and our best practice, not a script. A model or prompt that sounds better by ear and by measurement wins; write down what you changed in the report.

## Ears

You cannot hear. Three tools listen for you, and every take, music pick and finished film goes through them before you call a sound good. Quote what they said in `process/` and the report; never write "sounds good" without it.

| Question | Tool |
| --- | --- |
| Were the right words spoken, and when? | `voice takes` / `transcribe` (`gemini-3.5-transcribe`): word error rate against the script and word timings |
| How loud, how peaky, which key? | `earshot measure <file>` (`--music` for the key); `mix` and `render` report loudness and true peak |
| How does it sound? Natural or rushed, does the music mask words, does a hit land on the cut, does the ending work? | `superint-video listen <file> --question "…"` |

`listen` runs Earshot's audio critic (`earshot llm`): the audio goes to Gemini with the project's `GEMINI_API_KEY`, and the answer comes back with scores, strengths and issues with start and end seconds plus a fix each, saved to `process/listen/<file>.json`. It costs a few cents per film and needs no download.

- Ask in the film's language and ask for timestamps: "Klingt die Stimme natürlich? Wo wirkt sie gehetzt oder flach? Mit Zeitstempeln."
- Takes: listen to the recommended take of each paragraph, and to the alternative when the word error rates are close.
- Music: listen to each variant with the question whether it fits the prompt's mood and leaves room for a voice.
- Film with picture (a draft render is enough: `render --quality draft`): `listen renders/<film>.mp4 --question "…"` hears the soundtrack and gets the picture-cut times (no frames are sent), so it can judge sound against cuts. Use `--start/--end` to zoom into a passage.
- A verdict is evidence, not an order. It knows the voice is synthetic on purpose (`--synth-intended`), but it still tends to call TTS "a little flat": weigh that against the transcript and your own reading of the script, and say in the report what you changed because of it.
- Earshot also has local listening models (`describe`, `match`, `ab`, `rank`, `timeline --cues audio/sfx/cues.json`, `sheet`, `critique`). They need a one-time 1.1 GB download, so they are not part of the workflow; use them only when `earshot doctor` shows them cached.
- Generate voice and music with `voice takes` and `music`, not with other CLIs: they do the takes, checks and caching.

## Workflow

Read [references/workflow.md](references/workflow.md): voice (`voice check`, `voice takes`, `voice assemble`), timing from `audio/words.json` into clips and `scenes/cues.js`, music (`music`), SFX (`sfx kit`, `sfx place`) and the mix (`mix`, then `render --audio audio/master.wav`).

The workflow skill decides whether the film is voice-led (explainer) or music-led (launch film: the picture is cut to the track, with no voice or a short one). The rules here hold for both.

## CLI

| Command | Use |
| --- | --- |
| `voice check <dir>` | Rules for `voice.md`; exit 2 on errors |
| `voice takes <dir> [--dry-run] [--takes N] [--paragraphs 2,4]` | Takes per paragraph, transcribed and measured, into `audio/takes/report.json` |
| `voice assemble <dir> [--pick auto]` | `audio/voice.wav` and `audio/words.json` with seconds and frames |
| `transcribe <file> [--reference voice.md] [--terms a,b]` | Word times and errors for any audio file |
| `music <dir> [--variants 3] [--dry-run]` | Checks `music-prompt.md`, generates and measures variants |
| `sfx list [--category <c>]` | The Earshot bank: timing, loudness, pitch range per sound |
| `sfx kit <dir>` | Renders `audio/kit.json` through Earshot into `audio/sfx/` and audits every take; exit 2 on problems |
| `sfx place <dir>` | Puts the cues of `sfx.json` on the `sfx` track by each take's measured sync point |
| `listen <file> [--project <dir>] [--question …] [--video <mp4>] [--start s --end s]` | A hosted audio model listens through Earshot; answer in `process/listen/` |
| `mix <dir>` | Ducking, music under the voice, −14 LUFS and a true-peak limiter into `audio/master.wav` |

Earshot must be on PATH (or `SUPERINT_EARSHOT`); `doctor` reports it. Keys come from the app's Setup (`superint-video app`) or a `.env`; never ask for one in the chat, and never print, log, commit or paste them.
