# Narration, timing and sound: the workflow

Superint Video generates narration and music, places sound effects from Earshot, and mixes and masters the result with the commands below. This file is the route with an AI voice. The user's own voice, a film without a voice and a film without any key are in [own-voice.md](own-voice.md); everything after `voice assemble` is the same for all of them.

- Claude writes every text a generator gets: `voice.md` and `music-prompt.md`. The tool checks it against the model's rules, sends it unchanged, then measures and cuts the result. It never rewrites a word.
- Keys: `GEMINI_API_KEY` (Google AI Studio, the default) and `OPENROUTER_API_KEY`. The user adds them under Setup in the app (`superint-video app`), which keeps them encrypted on their computer; a `.env` at the project or repository root works too and wins over the app, and `SUPERINT_ENV` names another file. Only the tool reads them. Never ask for a key in the chat, and never print, log, commit or paste one, not even in an error message. `doctor --online --json` shows which keys exist (names only), which models they reach, live OpenRouter prices and the remaining credit.
- Every generator call is cached under `.superint/cache` by its exact request, so unchanged text costs nothing twice. `--dry-run` counts requests, cached takes and the live price before anything is paid.
- Keys are optional. Without one that reaches a TTS model (`doctor --json` → `capabilities.aiVoice`) the voice is the user's own or the film has none; without a music route it has no generated music. Take that route ([own-voice.md](own-voice.md)); never wait for a key. A licensed track the user supplies goes into `assets/` and onto the `music` track.

Model IDs and the default voice are in `preset.json` (`narration`, `transcription`, `music`); `voice.md` and `music-prompt.md` override them per project. Prompting rules per model are in the provider file of its route: [google-ai-studio.md](google-ai-studio.md) for IDs without a `/`, [openrouter.md](openrouter.md) for IDs with one. Read it before writing either file.

## Voice → `audio/voice.wav`, `audio/words.json`

1. **Write `voice.md`** from the narration in `script.md`. Keep the words; change only punctuation, tags and numbers written out as they are said.

   ```markdown
   ---
   voice: Sadaltager
   style: calm, warm and curious, measured pace
   terms: [Claude, ChatGPT, Copilot]
   ---

   [[scene:hook]]
   Stell dir vor, dein Assistent kann plötzlich …

   [[scene:mechanism]]
   Ein Skill ist …
   ```

   - Front matter, all optional: `model`, `voice`, `style` (Gemini only: delivery, never age, gender or accent), `language`, `terms` (names and technical terms for the transcription), `takes` (1–5, default 3), `sentencePause` (0.24), `paragraphPause` (0.36), `tighten` (true), `transcription`.
   - Blank lines separate paragraphs. Each paragraph is one TTS request and one unit for takes.
   - `[[scene:id]]` tags the paragraphs that follow; the tag ends up in `words.json`. `#` lines and `<!-- -->` are notes and are not sent.
2. **`superint-video voice check <dir>`** checks the text against the model's syntax and estimates the length of the read. Errors exit 2 and must be fixed:

   | Code | Error |
   |---|---|
   | V1 | digits |
   | V2 | symbols |
   | V3 | abbreviations and units |
   | V4 | more than one tag per 40 words |
   | V5 | a tag in a sentence with a number, a term or IPA |
   | V6 | the wrong tag syntax for the model (`<tag>` for Gemini, `[tag]` for ElevenLabs) |
   | V8 | over the model's length limit |
   | V14 | no paragraphs |

   Warnings: unknown tag (V7) or voice (V10), identity words in `style` (V9), a term missing from the text (V11), all-caps words (V12), words that differ from `script.md` (V13), unknown keys (V15).
3. **`superint-video voice takes <dir> [--dry-run] [--takes N] [--paragraphs 2,4]`** generates N takes per paragraph into `audio/takes/pNN-tT.*`, then transcribes and measures each one.
   - `audio/takes/report.json` lists per take:
     - the word error rate: `wer` from the pass with vocabulary, `werTimed` from the timed pass
     - missing terms, and every difference with its time
     - pace, peak, clipping and pauses
   - It recommends one take per paragraph: fewest wrong words, then all terms heard, then no clipping, then the pace closest to the preset.
   - `--paragraphs` regenerates only the paragraphs you changed; the others keep their takes.
4. **Listen** (see the skill's Ears section) to the recommended takes, and to the alternatives where the WER is close, for stress and tone that the numbers can't show: `superint-video listen <take> --question "<the paragraph's intended delivery>: does it sound like that? Where not? Timestamps."`. A wrong name or number makes a pickup: rewrite the passage (respelling, punctuation), then run `voice takes --paragraphs N` again.
5. **`superint-video voice assemble <dir> [--pick auto|1=2,3=1]`** cuts the chosen takes:
   - matches levels to the median, within ±6 dB
   - shortens pauses inside a paragraph that are longer than `sentencePause` to exactly that, and joins paragraphs with exactly `paragraphPause`
   - 15 ms crossfades, 0.1 s lead, 0.4 s tail, peaks limited to −1 dBFS
   - never pads the voice to fit the visuals; fit the visuals to the voice

   It writes `audio/voice.wav` (48 kHz mono 24-bit) and `audio/words.json`. Then it transcribes the finished file once more and reports the WER. Word edges next to a pause (at least 0.1 s of silence) are moved onto the measured start or end of the speech, because transcribers put them up to 0.1 s off. `timingCheck` reports, in frames:
   - `snappedEdges`, `snapMedianFrames`, `snapMaxFrames`: how many edges moved and how far
   - `medianFrames`, `maxFrames`, `outliers`: word starts from the takes against the final transcript. An outlier differs by more than one transcriber step (0.1 s) plus a frame.

   ```json
   [{"word": "Stell", "start": 0.12, "end": 0.31, "startFrame": 4, "endFrame": 9, "paragraph": 1, "scene": "hook", "timing": "final"}]
   ```

   `timing` is `final` (from the last transcription), `take` (from the take's transcript, moved through the cuts), `interpolated` (no transcript matched; spread between neighbours) or `estimated` (the user's own voice without a transcription route: [own-voice.md](own-voice.md#estimated-word-times)). Frames use the fps in `video.json`.
   **Acceptance:** WER ≤ 2 %, no `interpolated` term or number, and every outlier checked. An outlier that a cue depends on gets a look at the level curve or a snapshot at that frame.
6. If `voice.wav` runs longer than the target length + 3 s, cut script words and regenerate. Typical pace: German about 140 words/min, English about 165.

`superint-video transcribe <file> [--reference voice.md] [--terms a,b] [--output t.json]` transcribes any file and compares it with the reference in the same way. Narration the user speaks or brings as a file goes through `voice own`, not onto the track by hand.

## Timing from words

All story timing comes from `words.json`; never hard-code seconds that the voice decides.

- **Scene clips:** a scene starts a few frames (about 4–8) before the first word of its section: `startFrame` of that word minus the lead. The `scene` field in `words.json` says where a section begins. The last scene runs to the end of the music or the title hold.
- **Inside scenes:** generate `scenes/cues.js` from `words.json` with times relative to each scene's clip start, and use them in scene code:

```js
// scenes/cues.js (generated - do not edit by hand)
export const cues = { hook: { verschwunden: 1.40, acht: 3.18 }, 'mechanism-1': { signal: 0.52 } };
```

```js
import { cues } from './cues.js';
const T = cues.hook;
const collapse = between(time, T.verschwunden, T.verschwunden + 0.33);
```

- Regenerate `cues.js` and the clip frames whenever the voice changes. Every trigger lands within ±2 frames of its word; check this in the review snapshots.
- **Voice clip:** one audio clip on the `voice` track at frame 0 (or where narration starts), `gain` 1.

## Music → `audio/music/`

1. **Write `music-prompt.md`.** The front matter holds `model` (default from the preset: `lyria-3.5`) and `seconds`: the whole film including the end card, so the track can resolve after the last word. The body is the whole Lyria prompt and is sent unchanged; `<!-- -->` notes are removed. Its timeline puts the final chord on the end card, after the narration. Rules and a prompt skeleton are in [google-ai-studio.md](google-ai-studio.md#lyria-3-pro-music).
2. **`superint-video music <dir> [--variants 3] [--dry-run]`** checks the prompt first:
   - "Instrumental, no vocals" (M2, error)
   - no topic words from `brief.md` or the voice terms (M3, error; they have triggered Lyria's content filter)
   - a length in the prompt that matches `seconds` (M4, M5)
   - the clip model's fixed 30 s (M6)

   Then it generates the variants into `audio/music/vN.*` and measures length, peak, RMS and the ending (`fades` or `cut`) into `audio/music/report.json`.
3. Listen and pick one: `superint-video listen` on each variant, asking whether it fits the prompt's mood and leaves room for a voice. An original score in the concept's sound world: instrumentation and tempo fit the tone, chord changes land on section beats, and the natural ending lands on the end card. Place it as one clip on the `music` track so its ending lands on the end card; `mix` does the rest.
- Level: about 22 dB quieter than the voice while words play, ducked another 3 dB under the words, swelling up to about 8 dB over the end card. 15 dB was rejected as much too loud, although it measured well and the critic approved. `mix` measures and sets this; house rules and the reference measurement are in [google-ai-studio.md](google-ai-studio.md#lyria-3-pro-music).

## SFX → `audio/sfx/`

Sound effects come from Earshot (local, MIT, no models for these commands); never write synth voices of your own. Without Earshot, `sfx` stops with a clear message; there is no fallback synthesis.

1. **Kit.** `earshot kit init --preset calm -o audio/kit.json`, then edit it. Use one role per event type (tick, pop, whoosh.short, bell …), so the same action always sounds the same. Match the material of what moves, such as glass, metal, paper or water. `superint-video sfx list [--category <c>]` shows each sound's length, onset, peak, loudness, knobs and pitch range. Tonal roles take their notes from the key of the music under them (`edits.pitch` or `pitches`; `earshot measure music.wav --music` measures the key). The `fit/*` sounds are derived from CC0 recordings; every other sound is pure code.
2. **`superint-video sfx kit <dir>`** runs `earshot kit render` and `kit check` into `audio/sfx/` (takes plus `kit.lock.json`) and exits 2 when the audit finds problems. Swap any sound or knob that gets a warning rather than keeping the take. A pitch out of range is an error: shift it by octaves.
3. **Write `sfx.json`**: which frame gets which role, and how far under the voice.
   ```json
   {"under": 24, "cues": [
     {"frame": 252, "role": "pop", "under": 22, "note": "Skills pill"},
     {"frame": 990, "role": "bell", "pitch": "D5", "under": 16, "note": "title"}
   ]}
   ```
   `frame` is the frame the sound's sync point lands on, taken from `words.json` or the scene's own beat, never from hand-typed seconds. The role's `align` picks the sync point: onset for hits and touches, peak for whooshes, end for risers. `take` (1-based) or `pitch` pick a take; otherwise the role rotates through its takes. Levels: big hits 14–18 dB under the voice, accents 20–26 dB, textures and repeated sounds (keys, ticks, drops) 27–37 dB. About 10 dB was rejected as much too loud.
4. **`superint-video sfx place <dir>`** reads the lock and puts every cue on the `sfx` track: `startFrame = frame − round(syncPoint × fps)`, gain from the take's `lufs_m_max` against the voice's integrated loudness, or the music's in a film without a voice (a music-led launch film). It replaces the clips it placed before (id prefix `sfx-`), keeps everything else, and warns about cues closer than 3 frames, more than 4 cues in one second, and levels outside 12–40 dB.

## Mix, master and verification

Targets for the delivered file: **−14 LUFS integrated, true peak ≤ −2.2 dBTP measured on the final MP4.**

1. **`superint-video mix <dir>`** decodes every audible clip of `video.json`, applies gain and fades, ducks the `music` track under the words of `audio/words.json` (mapped through the `audio/voice.wav` clip) and under any other clip on the `voice` track (a take spoken over the film: where it speaks is measured from the audio), sets the music its distance under the voice while words play, sums everything and masters it: gain to −14 LUFS (BS.1770), then a lookahead limiter on a 4× oversampled peak estimate to −3.4 dBTP, repeated until both hold. It writes `audio/master.wav` (48 kHz, stereo, 24-bit) and `audio/master.json` with every measurement. It takes what is there: without a voice nothing is ducked and `musicUnder` does not apply; with no audible clip at all it writes a silent master and reports `"silent": true`.
2. Optional `mix.json` tunes it:
   ```json
   {"loudness": -14, "ceiling": -3.4, "musicUnder": 22, "duckDb": 3,
    "rides": [{"from": 990, "to": 1110, "db": 5, "rampFrames": 15, "note": "title swell"}]}
   ```
   `musicUnder: null` keeps the music clip's own gain.
3. **`superint-video render <dir> --output renders/<slug>.mp4 --audio audio/master.wav`** muxes the master as AAC 256k instead of summing the clips and reports the loudness and true peak measured on the finished MP4 (`audio`). Without `--audio`, `render` sums the clips without a limiter, which is fine for drafts. Every MP4 has an audio stream: a film with nothing to hear gets a silent stereo track, because some upload forms, editors and television sets refuse or flag a file without one.
4. Report integrated loudness and true peak from the render output.

Listen-check rounds on a draft render, before the polish pass and the final render: `superint-video render <dir> --quality draft --audio audio/master.wav --output renders/draft.mp4`, then `superint-video listen renders/draft.mp4 --question "…"` (it gets the picture-cut times too), `--start/--end` for a passage, plus the loudness numbers from `mix` and `render`. Check voice clarity, SFX too loud or too sparse, music masking words, does the title moment hit.
