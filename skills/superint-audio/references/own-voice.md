# Who speaks the film: AI voice, the user's own voice, or no voice

A film needs a coding agent, Chrome and FFmpeg. API keys are optional. They add the AI voice, measured word times, generated music, dictation and styles from pictures. Never stop a film to wait for a key, and never ask for one in the chat.

## Find the route

1. The prompt or `brief.md` names it in plain words: "an AI voice narrates it", "I narrate it myself", or "no narration". That decides.
2. Otherwise `superint-video doctor --json` → `capabilities`:

   | Field | True means |
   | --- | --- |
   | `aiVoice` | A key reaches a TTS model: `voice takes` works |
   | `transcription` | Word times are measured, for TTS takes and for the user's recordings |
   | `music` | `music` can generate a track |
   | `ownVoice` | Always true: the user can record or bring a file |
   | `soundEffects` | Earshot is installed: `sfx kit`, `sfx place` |
   | `narration` | The route to take when the prompt names none: `ai` or `own` |

3. `narration: own` without a word from the user about speaking: ask once, "Do you want to speak it yourself, or should the film go without a voice?" Recording takes the user's time; do not assume it.

| Route | Voice | Word times | Music |
| --- | --- | --- | --- |
| AI voice | `voice takes`, `voice assemble` ([workflow.md](workflow.md)) | Measured | If `music` |
| Own voice, with `transcription` | The user records; `voice assemble` | Measured | If `music` |
| Own voice, no key | The user records; `voice assemble` | Estimated | None, or a track the user supplies |
| No voice | None | None: the picture follows reading time and beats | If `music`, else none |

Without `music` the film has no music. Do not fake a bed from sound effects or synthesise one in code. A licensed track the user supplies goes into `assets/` and onto the `music` track, with its licence in `report.md`.

## The user's own voice, read from the script

The voice comes first, as with TTS: the picture follows `audio/words.json`.

1. Write `voice.md` as in [workflow.md](workflow.md), with `source: own` in the front matter and nothing of a TTS model:

   ```markdown
   ---
   source: own
   terms: [Claude, ChatGPT]
   ---

   [[scene:hook]]
   Stell dir vor, dein Assistent kann plötzlich …
   ```

   - A person reads this aloud. No tags (`<short pause>`, `[whispers]`), no `voice`, `style`, `model` or `takes`. A direction for the reader goes into a `#` line, which the recording view does not show.
   - Paragraphs of one to three sentences: each is one take, and a slip costs only that paragraph.
   - Write numbers and units as they are said. A person can read digits, but written out the word times are better.
   - `tighten` is off for an own voice (a person's pauses are how they speak); `tighten: true` shortens long pauses inside a paragraph as for TTS.
2. `superint-video voice check <dir>`: for `source: own` it checks only what applies to a reader.
3. Tell the user what happens, in a sentence: Studio shows the text paragraph by paragraph, Space starts and stops a take, Enter accepts it. Then run

   ```
   superint-video voice own <dir> --wait
   ```

   It opens the recording view in Studio and returns when every paragraph has an accepted recording. It waits 9 minutes (`--timeout <seconds>`), then exits with code 3 and `complete: false`: run it again and keep waiting. Never go on without the voice, and never fall back to TTS on your own.
   - A file instead of the microphone: the user can drop one in the recording view, or you run `voice own <dir> --file narration.mp3` (the whole text, split into the paragraphs) or `--file p3.wav --paragraph 3`. WAV, MP3, M4A, Ogg, WebM and FLAC work.
   - A whole file is split where the transcript says a paragraph ends when `transcription` is there, else at its longest pauses. When the pauses do not fit the paragraphs, the command says so; ask the user to record paragraph by paragraph.
   - Each recording is cleaned lightly: rumble under 80 Hz removed, silence at the edges trimmed, speech brought to −20 dBFS RMS with peaks under −1 dBFS. No noise removal, no compressor. `notes` on a take (`clipped`, `quiet`, `noisy`) are shown to the user, who decides whether to record again.
   - Recordings live in `audio/own/` (`p01.wav` …, state in `takes.json`). They stay on the computer; only with `transcription` are they sent to that model, and the recording view says so.
   - When the user changes their mind about a text, change the paragraph in `voice.md`; its recording goes `stale` and `voice own --wait` asks for that paragraph again.
4. `superint-video voice assemble <dir>` cuts the recordings into `audio/voice.wav` and writes `audio/words.json`, as for TTS takes. Its result says `"timing": "measured"` or `"estimated"`.
5. Then exactly as in [workflow.md](workflow.md): timing into clips and `scenes/cues.js`, music if there is any, SFX, `mix`, `render --audio audio/master.wav`. The mix ducks the music under an own voice like under TTS.

### Estimated word times

Without `transcription`, every word in `words.json` has `"timing": "estimated"`:

- The start and end of each paragraph and every pause of 0.16 s or more are measured from the audio. They are exact.
- Between two pauses the words share the time by their syllables. Each pause is put on the nearest word boundary, preferring a full stop or a comma. A word inside a long sentence can be off by a few frames, more when the reader stretches or swallows a word.

So cue the picture on paragraph starts and on words next to a pause (the first word of a sentence, the word before a full stop). Do not hang a hard cut, a counter or a single-frame hit on a word in the middle of a sentence. When a cue must sit on such a word, check it in a draft render against the sound, or ask the user for an API key, after which `voice assemble` measures the same recordings. Say in `report.md` that the times were estimated.

`listen` and `transcribe` need a key. Without one, quote the measurements you have (`voice assemble`, `mix`, `render`) and say that nobody but the user has heard the film.

## Speaking over the finished picture

For a film made without a voice, or to replace the voice from some point on. Nothing to prepare; tell the user:

- In Studio, "Voice" → "Speak over the film". Choose where to begin, press Space, speak while the film plays without sound, Space to stop. Listen with the film, do it again, or keep it.
- A kept take is the voice from its frame to the end of the film: clips on the `voice` track are cut there, the take is placed as its own clip (`audio/own/over-<frame>.wav`), and one undo in Studio brings the old voice back.
- With a `voice.md` in the project its paragraphs stand beside the picture as cues, with their times where a narration is placed.

Afterwards run `mix` and `render --audio audio/master.wav` again. The mix finds where such a take speaks from the audio itself and ducks the music there. It has no word times; `transcribe audio/own/over-<frame>.wav` gives them when a key is there and a cue needs them.

## A film without a voice

- Time the picture by reading and by beats. On-screen text stands for about a second per three words after it has finished appearing, and at least 1.5 s. A picture without text holds as long as its action takes. With music, cuts go on bars and downbeats (the launch workflow measures them); without music, on the action and on the sound effect that marks it.
- What a narrator would have said has to be seen or read. Budget more on-screen text than in a narrated film, in lines of at most seven words, one thought per card.
- Do not write `voice.md`. `beats.md` carries the timing: frame ranges per beat instead of trigger words.
- Sound effects carry more than under a voice: one sound per visible action, and silence between them is fine. Without music set their levels by ear against each other, the loudest hit well under the master's ceiling.
- `mix` and `render` work with whatever is there: only sound effects, only music, or nothing. A film with nothing to hear gets a silent stereo track, because some upload forms, editors and television sets refuse or flag a file without an audio stream; `mix` then reports `"silent": true`. Say in `report.md` which of voice, music and sound effects the film has and why.
