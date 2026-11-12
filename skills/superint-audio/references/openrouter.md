# OpenRouter: Gemini TTS, Gemini Transcribe, ElevenLabs v4 Turbo, MAI-Transcribe-2, Lyria

Provider file for the superint-audio skill. Researched 2026-10-31. Key: `OPENROUTER_API_KEY`. Model IDs with a `/` (such as `elevenlabs/eleven-v4-turbo`) go through OpenRouter. Superint Video sends Claude's text unchanged; Claude writes every prompt.

The tool's checks follow the rules below; when a check and this page disagree, this page wins and the check is a bug.

## Gemini through OpenRouter (when the AI Studio quota is used up)

The same Google models are reachable with the OpenRouter key when AI Studio's daily limits are reached (`gemini-3.8-flash-tts` about 100 a day, `gemini-3.5-transcribe` also about 100, both reset at midnight Pacific, 09:00 in Germany). Measured 2026-11-06:

- **`google/gemini-3.8-flash-tts`** on `POST /api/v1/audio/speech`:
  - Only `response_format: "pcm"` works (anything else answers `Gemini TTS only supports response_format="pcm"`). It is 24 kHz mono s16le; the tool wraps it into a WAV.
  - `instructions` carries the style and works: a slow style gave 66 words per minute against 138 without it. The tool sends `style:` from `voice.md` there.
  - Voice names and angle-bracket tags are the same as on AI Studio.
- **`google/gemini-3.5-transcribe`** on `POST /api/v1/audio/transcriptions` works like MAI-Transcribe-2 and gives word times in 100 ms steps.
- **At AI Studio's limit the tool switches by itself.** A final 429 from AI Studio (after the retries) sends this request and the rest of the run to the same model on OpenRouter (`gemini-3.8-flash-tts` → `google/gemini-3.8-flash-tts`, `gemini-3.5-transcribe` → `google/gemini-3.5-transcribe`, `lyria-3.5` → `google/lyria-3-pro-preview`). It says so on stderr, the takes report records each take's `route`, and a later run finds the take in the cache. Don't wait for the reset. Without an OpenRouter key the 429 stays an error.
- **Listen to mixed routes.** Same text and voice through both routes, side by side: The OpenRouter take has about 2 dB less at 60–120 Hz, and the audio critic heard it as thinner and more forward at 1.5–3 kHz. `voice assemble` warns when one film uses both. If the joins stand out, record the few odd paragraphs through the other route (`model:` in `voice.md`), so the film has one sound. Transcription has no such problem: changing `transcription:` keeps the takes.
- A 402 with "would exceed your available credits given your current in-flight requests" can hit parallel transcriptions while credits are low, although each request alone would pass. Run `voice takes <dir> --paragraphs <n>` again: the TTS result is cached and the retry goes through alone.

## ElevenLabs Eleven v4 Turbo (narration, OpenRouter)

**Access through OpenRouter**
- `POST https://openrouter.ai/api/v1/audio/speech` with `Authorization: Bearer $OPENROUTER_API_KEY`.
- Body:
  - `model: "elevenlabs/eleven-v4-turbo"`
  - `input`: a string, or a list of turns `{text, voice}`
  - `voice`
  - `response_format: "mp3" | "pcm"`. The default is `pcm` (16-bit little-endian), but its sample rate is not documented. Use `mp3` until the PCM rate has been measured once.
- Voices: george, sarah, adam, alice, bella, bill, brian, callum, charlie, chris, daniel, eric, harry, jessica, laura, liam, lily, matilda, river, roger, will. Custom voice IDs are not documented.
- Don't send `speed`. Only some models honour it; others ignore it or return 400. Steer pace through the text instead.
- ElevenLabs-only settings go in `provider.options.elevenlabs`. The accepted keys are not documented and unknown keys are dropped silently. Before relying on a setting such as `voice_settings.stability`, A/B-test that it changes the output.
- The response is raw audio bytes. `Content-Type` gives the encoding and `X-Generation-Id` the billed generation.
- At most 10,000 characters per request.
- The launch price was $20 per 1M characters, and the launch discount ended on 2026-10-19. On 2026-10-31 the live price was $40 per 1M characters (`pricing.prompt` = 0.00004 per character). Read the current price from `GET https://openrouter.ai/api/v1/models?output_modalities=all`; the list without that parameter leaves out audio models. `voice takes --dry-run` does this.

**Prompting** (ElevenLabs' guide; v4 uses the same techniques as v3)
- Write audio tags in square brackets, before or after the words they shape: `[warm]`, `[curious]`, `[short pause]`.
- Tags describe the voice, never a sound. Words that sound like noises can come out as sound effects.
- A tag works best when the voice can already deliver it; a calm narrator underplays shouting. Test tags on the chosen voice.
- A narrative tag such as `[Quiet, reflective narration]` sets the tone for a longer passage.
- v4 has no SSML `<break>` tags. Make pauses with `[short pause]` or `[long pause]`, ellipses and sentence structure.
- Emphasis:
  - CAPITALS on one word
  - ellipses for weight
  - an em dash for a cut-off

  Otherwise keep the wording as written: change only punctuation, capitals and tags.
- The speed range is 0.7–1.2, default 1.0. Extreme values cost quality.
- Normalise the text before it is spoken: numbers, currency, decimals, dates, times, units, symbols, percentages, abbreviations and URLs. Expand abbreviations unless they are part of a name. Write it out in the text you send; don't leave it to the TTS model.
- Pronunciation:
  - Put IPA between slashes inline, e.g. `/klɔːd/`, with stress marks, only on words that need it. Check it per voice.
  - Respelling with capitals or hyphens is the fallback.
  - Pronunciation dictionaries are an ElevenLabs feature that OpenRouter's documented fields don't expose.
- Send whole paragraphs, not single sentences: v4 reads better with context.
- Generate 2–3 takes and keep the best. Tagging every sentence makes the voice overact (third-party finding), so keep tags rare.

**House rules** (from the reference films)
- Voice:
  - `daniel`: British and calm.
  - `brian` read as American and was rejected.
  - `george` and `eric` are alternatives.
- German runs at about 140 words per minute. Word budget ≈ length in seconds × 2.3.
- About one tag per 40–50 words, and never inside a sentence with a number or a name.
- Pauses:
  - Short film that must hit an exact length: tighten silences to 0.24 s between sentences and 0.36 s before the reveal.
  - Long form: 0.5 s between sentences, 0.85 s between paragraphs, 0.22 s at commas, and a breath of 1.0–1.6 s after a reveal.
- Pickups: 12–15 ms crossfades, matched RMS, room tone under every cut.

## MAI-Transcribe-2 (word timings)

**Access through OpenRouter**
- `POST https://openrouter.ai/api/v1/audio/transcriptions` with a JSON body:
  - `model: "microsoft/mai-transcribe-2"`
  - `input_audio: {data: <raw base64, no data URI>, format: "wav"}`. Other formats are mp3, flac, m4a, ogg, webm and aac; `pcm` means headerless 16 kHz mono s16le.
- Options:
  - `language: "de"` (ISO-639-1; auto-detected if omitted)
  - `temperature` 0–1
  - `response_format: "verbose_json"`
  - `timestamp_granularities: ["word", "segment"]` (verbose_json only)
  - `keyterms: [...]`: 1–100 characters each, up to 1,000 terms, provider-dependent
  - `diarize`
- Response:
  - `words[]` with `word`, and `start` and `end` in seconds, plus optional `confidence` and `type` (`word` or `audio_event`)
  - `segments[]`
  - `usage.cost` and `usage.seconds`
- Multipart uploads are limited to 25 MB. Base64 JSON has no stated limit and returns 413 when too large.
- The model handles 60 languages, word timestamps, diarization, keyword biasing, and verbatim or clean transcription. OpenRouter documents no switch for verbatim mode.
- Price: $0.10 per audio hour through the end of 2026.

**House rules**
- Send 16 kHz mono WAV.
- `keyterms` is documented, but on 2026-10-31 OpenRouter's MAI provider rejected it with 400 ("does not support keyterms"), so the tool doesn't send it. Terms are only checked against the transcript.
- Measured 2026-10-31: word times in 10–20 ms steps, with gaps between words. A word with an initial plosive started at the vowel (0.22 s after the measured /k/ burst of "Claude").
- Align the transcript to the script word by word: normalise the text, then use edit distance. Every mismatch is a pickup candidate. Snap all times to frames.

## Lyria 3 Pro (music, `google/lyria-3-pro-preview`)

**Access through OpenRouter**
- `POST https://openrouter.ai/api/v1/chat/completions` with:
  - `model: "google/lyria-3-pro-preview"`
  - `modalities: ["text", "audio"]`
  - `stream: true`, which is required
  - `messages: [{role: "user", content: <prompt>}]`
- Audio arrives as base64 in the SSE chunks `choices[0].delta.audio.data`. Concatenate the chunks, then decode.
- About $0.08 per piece.

Prompting and house rules are the same as on Google AI Studio: see [google-ai-studio.md](google-ai-studio.md#lyria-3-pro-music).

## Sources

- OpenRouter, Gemini 3.8 Flash TTS: https://openrouter.ai/google/gemini-3.8-flash-tts
- ElevenLabs, TTS best practices: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices
- ElevenLabs, audio tags list: https://elevenlabs.io/blog/elevenlabs-audio-tags-list
- OpenRouter, create speech: https://openrouter.ai/docs/api/api-reference/tts/create-speech
- OpenRouter, Eleven v4 Turbo: https://openrouter.ai/elevenlabs/eleven-v4-turbo
- OpenRouter, ElevenLabs announcement: https://openrouter.ai/blog/announcements/elevenlabs-on-openrouter/
- OpenRouter, create transcription: https://openrouter.ai/docs/api/api-reference/stt/create-transcription
- OpenRouter, MAI-Transcribe-2: https://openrouter.ai/microsoft/mai-transcribe-2
- Micdrop, audio tags in a voice agent: https://micdrop.dev/blog/elevenlabs-audio-tags-voice-agent
