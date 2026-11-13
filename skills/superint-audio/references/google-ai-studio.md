# Google AI Studio: Gemini TTS, Gemini Transcribe, Lyria

Provider file for the superint-audio skill. Researched 2026-10-31, updated 2026-11-04 from Google's current docs. Key: `GEMINI_API_KEY`. Model IDs without a `/` go through this provider. Superint Video sends Claude's text unchanged; Claude writes every prompt. Re-check a section when a call fails with 400 or 404, or when Google renames a model.

The tool's checks follow the rules below: `voice check` for the voice text, `music` for the Lyria prompt. The rules here are the reason for each check; when a check and this page disagree, this page wins and the check is a bug.

## Prices and tiers (Standard tier, checked 2026-11-04)

| Model | Price | In practice | Free tier |
| --- | --- | --- | --- |
| `gemini-3.8-flash-tts` | $0.50 / 1M text tokens in, $9.00 / 1M audio tokens out (25 audio tokens per second) | ≈ $0.00225 per 10 s of speech | yes |
| `gemini-3.5-transcribe` | $2.00 / 1M audio in, $12.00 / 1M text out | ≈ $0.005 per minute | yes |
| `lyria-3.5` | $0.08 per song | | no |
| `lyria-3-clip-preview` | $0.04 per 30 s clip | | no |

TTS prices double on 1 January 2027. Batch and Flex tiers cost half for TTS when a job may wait. Voice remixing and replication need a paid project (Tier 1+). A 60 s film with three takes per paragraph costs about $0.04 in voice, under $0.01 in transcription and $0.24 for three music variants: never skip takes or variants to save money.

## Gemini 3.8 Flash TTS (narration, default)

**Access through AI Studio** (Interactions API)
- `POST https://generativelanguage.googleapis.com/v1beta/interactions` with header `x-goog-api-key`.
- Body:
  - `model: "gemini-3.8-flash-tts"`, the only TTS model we use.
  - `input: [{type: "user_input", content: [{type: "text", text, annotations: [{type: "speech_metadata", style}]}]}]`
  - `response_format: {type: "audio"}`, optionally with `mime_type` (`audio/wav` default, `audio/l16`, `audio/mulaw`, `audio/alaw`) and `sample_rate` (24000, 16000 or 8000)
  - `generation_config: {speech_config: [{voice: "Charon"}]}` for one speaker. Two speakers: `{speakers: [{speaker, voice}]}`, prebuilt voices only.
- Output: a WAV file, 24 kHz mono 16-bit, base64 in the last `steps[type=model_output].content[type=audio].data`. Streaming returns headerless PCM.
- Limits: 8,192 input tokens and 16,384 output tokens per request (model page). Text in, audio out only.
- 30 prebuilt voices with a descriptor each:
  - Zephyr (bright), Puck (upbeat), Charon (informative), Kore (firm), Fenrir (excitable), Leda (youthful), Orus (firm), Aoede (breezy)
  - Callirrhoe (easy-going), Autonoe (bright), Enceladus (breathy), Iapetus (clear), Umbriel (easy-going), Algieba (smooth), Despina (smooth), Erinome (clear)
  - Algenib (gravelly), Rasalgethi (informative), Laomedeia (upbeat), Achernar (soft), Alnilam (firm), Schedar (even), Gacrux (mature), Pulcherrima (forward)
  - Achird (friendly), Zubenelgenubi (casual), Vindemiatrix (gentle), Sadachbia (lively), Sadaltager (knowledgeable), Sulafat (warm)

- German is supported; the language is detected from the text (130+ languages).
- Google Cloud's migration guide calls the 3.8 TTS models Gemini-Enterprise-only, while the Gemini API docs list them. `doctor --online` checks which models the key sees.

**Model:** always `gemini-3.8-flash-tts` (best fidelity and acting, difficult pronunciation, dialects, long-form stability). Not Flash-Lite, not even for drafts.

**Choosing the voice** (five ways, all usable as `voice:` in `voice.md`)
1. One of the 30 prebuilt voices above.
2. The Extended Voice Library: hundreds of voices by language, accent, gender, pitch, persona and context (`GET /v1beta/voices?language_code=de-DE&context=Narrator`). Look here first for a German narrator with a regional colour.
3. Voice design: a new `voice_…` persona from a description (below).
4. Voice remixing: a new `voice_…` from an existing voice plus a relative change (below).
5. Voice replication: the user's own voice from a recording, with their consent (below).

**Prompting** (Google's speech-generation guide)
- The `text` field is read as a verbatim transcript. Any direction written into it is spoken aloud.
- Google's workflow: build the character once (a voice that already sounds right), synthesize with an **empty `style` first**, and add a short `style` only for the turns that need a change. Reuse the exact same short string where you want one consistent baseline. Most requests need no style at all.
- `speech_metadata.style` is for sustained delivery across a turn: emotion, pace, prosody, pitch, volume ("calm, warm and curious, measured pace", "speaking slowly", "high pitch, excited inflection"). When the mood shifts inside a passage, split it into separate paragraphs with their own style rather than writing a longer style.
- Never put age, gender, names or a permanent accent into `style`; that is the voice's job (choose, design or remix one). Never add meta-instructions such as "keep the same timbre" or "do not switch speaker identity": extra prompt text causes drift. Long "Audio Profile" or "Director's Notes" blocks from older models are the most common cause of drift.
- Point-in-time events go inline in angle brackets, **in English even in a German text**, and only human vocalisations, never sound effects: `<short pause>`, `<long pause>`, `<breath>`, `<heavy breath>`, `<exhales>`, `<sigh>`, `<laugh>`, `<chuckle>`, `<giggle>`, `<gasp>`, `<cough>`, `<throat-clearing>`, `<whispers>`, `<yawn>`, `<phew>`, `<tsk>` and more (`voice check` knows the full list).
- Pauses also come from commas, dashes (`--`) and ellipses. Emphasis comes from CAPITALS on a single word ("This is a VERY important point"), combined with punctuation.
- Natural disfluencies ("uh", "hm", "I think... so") make conversational speech sound real. For a narrator, write clean spoken sentences instead; use disfluencies only for characters.
- Two speakers in one request: prebuilt voices only, at most two, one `content` item per turn with `speech_metadata.speaker`. Designed or replicated voices in a dialogue: one request per turn, then join the turns (request `audio/l16` or strip the 44-byte WAV header before concatenating).
- Normalise numbers, dates, units and abbreviations into words, as for ElevenLabs in [openrouter.md](openrouter.md).
- The guide gives no pronunciation syntax. Test names such as "Claude" per voice and fall back to respelling.

**House rules**
- One `user_input` item per paragraph. The `style` stays the same for the whole film unless the concept calls for a change.
- Request WAV 24 kHz. Generate 2–3 takes per paragraph and keep the best.
- Voice: decided once per house style after a listening test. The house voice is **Sadaltager** (listening test 2026-10-31 with Charon, Sadaltager, Iapetus and Schedar on the same German text). Charon was as good but is heard more often. The test takes are in `superint-projekte/hoertest-stimme/`. A brand or a character that needs its own voice gets a designed or remixed one, auditioned the same way.

## Voice design, remixing and replication (Voices API)

All three create a stored `voice_…` ID in the Google project (200 per project, deleted after one year without use) that works with both 3.8 TTS models. Superint Video has no command for them yet: create the voice in Google AI Studio (Generate speech → Voice design) or with one `POST /v1beta/voices` request, then write the ID into `voice.md` (`voice: voice_abc123`). Record the ID, the description and the preview in `audio/voices/<name>.md` so the voice can be recreated.

**Design** a new persona when no prebuilt or library voice fits (a brand voice, a character).
- `{"store": true, "voice": {"model": "gemini-3.8-flash-tts", "type": "prompted", "display_name": "…", "gender": "male", "language_code": "de-DE", "prompted": {"input": "<description>"}}}`. The response holds `id` and a WAV `sample_audio` preview: listen before using it.
- The description holds the permanent traits: age, gender, timbre, texture, regional accent, baseline delivery. One or two clear sentences ("A warm, thoughtful astronomer in his late 60s with a gentle British accent, speaking with quiet wonder."); long or contradictory paragraphs give less consistent voices.
- Situational emotion stays in `style` per paragraph.

**Remix** an existing voice when it is close but not right.
- Same request with `prompted.base_voice` (a prebuilt name such as `Sadaltager`, a library ID or a `voice_…`) and `prompted.input` describing only the **relative change**: "Make the voice sound 20 years older with a deeper, slightly gravelly timbre while keeping the friendly warmth."
- Language and accent of the base voice stay unless the input changes them. Change one or two traits per step, listen to each preview, then chain the next remix on the new ID. The base voice is never modified.

**Replicate** a real voice only for the user's own voice (or a speaker who gives consent themselves), never to imitate anyone else.
- Needs two real recordings of the same adult speaker on the same microphone, 24 kHz mono 16-bit WAV: 10–30 s of clean natural speech (`source_audio`) and the consent sentence in their language (`consent_audio`), German: "Ich bin der Eigentümer dieser Stimme und bin damit einverstanden, dass Google diese Stimme zur Erstellung eines synthetischen Stimmmodells verwendet."
- Synthetic speech or audio with a SynthID or C2PA watermark is rejected. `store: false` returns a `voicekey_…` valid for 7 days instead of a stored voice.
- Recordings and IDs are personal data: keep them out of Git and out of the report.

## Gemini 3.5 Transcribe (word timings, default)

**Access through AI Studio** (Interactions API)
- Upload the audio with the Files API first, then reference it:
  - `POST https://generativelanguage.googleapis.com/upload/v1beta/files` (resumable upload: `start`, then `upload, finalize`) returns `file.uri`.
  - `POST /v1beta/interactions` with `model: "gemini-3.5-transcribe"`, `input: [{type: "audio", uri, mime_type: "audio/wav"}]`.
- `generation_config.transcription_config`:
  - `language_codes: ["de-DE"]`. Empty means auto-detect.
  - `mode: {type: "verbatim", timestamp_granularities: ["word"]}` for word timings. `diarization_mode: "speaker"` adds speaker labels.
  - `mode: "smart"` cleans up the text but cannot give timestamps or speakers.
  - `custom_vocabulary: [...]`: up to 1,000 terms, best at ≤ 100. **Not allowed together with word timestamps or diarization.**
- Response: `steps[type=model_output].content[type=text]` holds the transcript. Its `annotations` hold `{type: "word_info", text, speaker, start_offset: "0.100s", end_offset: "0.400s"}`. Offsets are duration strings in seconds. There is no confidence value.
- Limits: up to 1 hour per request, 30 minutes with timestamps or diarization. Formats include WAV, MP3, FLAC, OGG, AAC, M4A, L16 and WebM.
- Google marks word timestamps as experimental: they "may degrade overall transcription accuracy".
- Measured 2026-10-31 on Gemini TTS takes: word offsets come in 0.1 s steps (3 frames at 30 fps), and each word ends where the next begins, with no gaps. At pauses they were up to 0.15 s off the level curve (median 0.6–1.8 frames over four voices). `voice assemble` snaps those edges to the measured speech.
- In the same test, a take's timed pass heard "landet" where the final file's pass heard the scripted "lernt": a single difference can come from the transcriber. Check it against a second pass (the final transcription) or by ear before rewriting the text.
- `gemini-3.5-transcribe-live` streams but has no word timestamps.
- Price: about $0.005 per minute of audio; free tier available.

**House rules**
- Give `language_codes` from the brief's language (`de-DE`): a known language transcribes more accurately than auto-detect.
- `custom_vocabulary` only for distinct names, brands and terms, not everyday words; best results with up to 100.
- Two passes per take:
  - one with `custom_vocabulary` (names, technical terms) for the word error rate
  - one with word timestamps for the timings
- Align the timed words to the script with edit distance. Word times are taken from the timed pass only.

## Lyria 3.5 (music)

**Access through Google AI Studio** (Gemini API, key `GEMINI_API_KEY`; the default route)
- The API is changing. The current English documentation (checked again 2026-10-31) lists two models:
  - `lyria-3-clip-preview`: always 30 s, MP3.
  - `lyria-3.5`: "a couple of minutes", length set in the prompt; the page calls it "the Pro model".

  Both are called with `POST https://generativelanguage.googleapis.com/v1beta/interactions`, header `x-goog-api-key` and body `{model, input}`. For WAV, add `response_format: {type: "audio"}` (3.5 only). The response is a list of `steps`. Audio is base64 at `steps[type=model_output].content[type=audio].data`; text blocks may hold a song structure. Output is 44.1 kHz stereo.
- `input` may be a list: the text prompt plus up to 10 `{type: "image", mime_type, data}` blocks as a mood reference.
- There are no parameters for duration, BPM, seed or negative prompt. All of it goes into the prompt.
- Older copies of the same page list `lyria-3-pro-preview` through `models/lyria-3-pro-preview:generateContent` with `responseModalities: ["AUDIO", "TEXT"]`.
- Treat the model ID and endpoint as configuration, and check availability before a run.
- Output is 44.1 kHz stereo with a SynthID watermark.
- Generation is single-turn, and results vary between calls with the same prompt.

**Prompting** (Google's Lyria prompt guide plus our runs)
- **Order:** lead with the genre (eras and regional variants work: "early 1990s boom-bap", "Berlin minimal techno"; hybrids too), then mood, instrumentation and how the instruments sound together, tempo and key, structure and dynamics. Short phrases and detailed paragraphs both work; specific beats vague.
- **Vocabulary the model knows** (from Google's lists): genres such as Chillout, Lo-Fi Hip Hop, Synthpop, Trip Hop, Orchestral Score, Piano Ballad, Indie Folk, Bossa Nova, Minimal Techno; instruments such as Rhodes Piano, Synth Pads, Mellotron, Moog Oscillations, Glockenspiel, Kalimba, Marimba, Vibraphone, Celesta-like Music Box, Cello, Harp, Warm Acoustic Guitar, TR-909 Drum Machine; moods such as Ambient, Bright, Dreamy, Ethereal, Euphoric, Melancholic, Nostalgic, Ominous, Triumphant, Upbeat, Whimsical.
- **Texture sentences** beat instrument lists: "warm analog synth pads swelling beneath a dry, intimate acoustic guitar".
- **Parameters:** "84 BPM", "in D major", "Create a 34-second instrumental track". There are no API fields for length, BPM, seed or a negative prompt; everything goes into the prompt. Ask for a few seconds more than you need and trim.
- **Structure:** section tags or arrows (`[Intro] -> [Build] -> [Lift] -> [Outro]`), energy directions ("gradual crescendo, adding one instrument per section", "drop to near silence, then the full theme"), or timestamps. For films use a timeline with one line per section, derived from the real word timings: `[0:00 - 0:06] Intro: solo celesta, sparse. Intensity: 2/10`. Specific markers work too: "the full theme enters at 22 seconds".
- **Vocals:** Lyria sings by default. For a bed under narration write "Instrumental only, no vocals." (`music` refuses a prompt without it). For a launch film with a sung or chanted hook: put lyrics under a `Lyrics:` header with `[Verse]`, `[Chorus]` tags, backing vocals in parentheses, and a singer profile ("Female alto, warm, husky lower range"); lyrics come out in the prompt's language, so write the prompt in the film's language.
- **Images:** up to 10 images may go along as inspiration. Style frames from `renders/frames/` or the project's references can set the mood; they never carry the film's topic words.
- **Iterate on Clip, finish on 3.5:** test a prompt on `lyria-3-clip-preview` (30 s, $0.04), then generate the variants on `lyria-3.5`.
- Results vary between calls with the same prompt; generate variants and pick by ear and measurement. Editing a generated track by a follow-up prompt is not possible.
- Artist names and copyrighted lyrics are blocked. In our runs, topic words have triggered PROHIBITED_CONTENT, so describe only the music, never the film's topic.
- `negative_prompt` exists on Vertex AI only. Through OpenRouter or AI Studio, write exclusions as a sentence ("No vocals, no drums before 0:08").

**House rules**
- Starting point for Claude's prompt: `<mood> <genre> bed for <the kind of film>, <instruments with texture>, <BPM> BPM, <key>, <timeline with intensities>, instrumental only, no vocals, leaves room for narration, <length> seconds`.
- Measure the key with chroma analysis so pitched SFX play in the music's key.
- The last cue is end-aligned so the music ends on the title. Join cues with 5 s equal-power crossfades.
- Level: music about 22 dB under the voice, plus a 3 dB duck while words play. 15 dB was rejected as much too loud; the reference film measured a median voice-to-music distance of 21.9 dB.
- One piece stops at about three minutes, whatever the prompt asks, often well before (113 to 154 s for a longer ask), and a variant can come back longer than its timeline (a 124 s timeline: 125, 128 and 156 s). Two cues of one film can come back in different keys even when both prompts name one: measure each (`earshot measure <file> --music`) and put the change at a chapter break or under a pause. Write a longer film as several cues, take the real length from the report and place the last one by `film end - length`. The silences between cues can tell something: ours fall on a white flash and on "I forget everything".
- Lyria makes music, not ambience: a prompt for rain or room tone still comes back as music. Make room tone and rain another way.

## Sources

- Google, Gemini API speech generation: https://ai.google.dev/gemini-api/docs/speech-generation
- Google, Gemini 3.8 Flash TTS model page: https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash-tts
- Google Cloud, Gemini 3.8 TTS migration guide: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/text-to-speech/migration-guide
- Google, Gemini API audio transcription: https://ai.google.dev/gemini-api/docs/transcribe
- Google Cloud, Gemini 3.5 Transcribe: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-transcribe
- Google, Gemini API music generation: https://ai.google.dev/gemini-api/docs/music-generation
- Google Cloud, Lyria prompt guide: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/music/music-gen-prompt-guide
- Google, voice design: https://aistudio.google.com/docs/voice-design
- Google, voice remixing: https://aistudio.google.com/docs/voice-remixing
- Google, voice replication: https://aistudio.google.com/docs/voice-replication
- Google, Lyria prompt guide: https://aistudio.google.com/docs/lyria-prompt-guide
- Google, Gemini API pricing: https://aistudio.google.com/docs/pricing
