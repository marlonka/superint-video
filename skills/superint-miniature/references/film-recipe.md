# From brief to render

The workflow skill's steps hold (research, concepts, script, beats, style frames, build, review, deliver). This file says what changes in this look, and the order that keeps the many baked things consistent.

## Concept

- One connected place the audience understands without explanation: a studio, a ship, a factory, a clockwork, a hospital. Each room is a real step or trade of the topic, shown doing it. Three concepts should differ in the place, the key image and the colour script.
- A single material world over several minutes tires ("one table", "type foundry" looked noble and were rejected for having no rooms). Rooms give the film chapters and a map.
- Plan the return: the opening object and room come back at the end. The first film pulled back from a cup to the whole house, and finally the house stood as a model on that same desk.
- Key images, four or five: the opening pull-back, one aha that shows the idea itself (a monitor showing itself; every lamp coming on word by word), the title moment.
- Keep the title for last when it needs the whole film to land. The sign on the roof lights up on that sentence.
- Real things from the topic stand in each room: real file names, real numbers of this very film (frame counter, word times, the voice's own envelope on a chart recorder). It makes the film prove itself.

## Script

- First person works when the film is about the maker. Dry, adult, no jokes that wink. Short declarative sentences; a line that lands gets a pause (`tools/pauses.py`).
- Write for mechanical stagings: "Ändere ich eine Zeile, ändert sich genau diese eine Sache." can be shown literally.
- Spoken bridges at chapter turns, so a new room never comes as a surprise.
- Length follows the voice. Six minutes held in the first film because each room had a new idea.

## Picture plan

Beats table with time, words, room, picture. A new picture every 2–4 s from camera travel and action inside the room; a new room only at chapter turns. Reading time for every card: about a second per 3 words, after it stands. Nothing on screen before the voice has named it.

Write the house plan first: rooms as boxes in `house.js` with their section walls (`R`), so the camera has real paths between floors. Rooms are at `z0 = -3.6 … z1 = 0` with an open front. The camera outside moves freely; black section walls wipe by when it changes floors.

## Build order

1. House plan and shell, every room as a `placeholder()`.
2. The opening hero to photo quality, because it sets the bar. Then the first full room.
3. Rough voice with one take per paragraph (`takes: 1`), so `cue()` works and the camera can be timed. Replace takes later and word times follow. With the user's own voice there is no rough pass: the script is final before `voice own --wait`, because every re-recording costs their time and moves the cues.
4. Room after room, each as a module: geometry, lights, then `frame` and `sub`. Rooms can talk through `ctx`.
5. Full camera path, then sound, then the bakes.

## Word sync

`voice takes` (or `voice own --wait` for the user's own voice) and `voice assemble` give `audio/words.json`; `tools/pauses.py` adds silences after chosen phrases and writes `scenes/cues.js` plus the film's length into `video.json`. In code:

```js
K(cue(4, 'Trotzdem'), eye, at, .44, .0004);   // a camera key on a word
const hit = cue(14, 'DIESEM');                 // a mechanism lands on a word
for (const l of lettersOf(4)) ...             // a typewriter types the spoken letters
```

`cue(paragraph, word, n)` takes the n-th occurrence, `cueE` its end, and both throw if the word is gone, so a script change breaks loudly instead of silently drifting. Never type a second the voice decides. A wrong word time from the transcription shows as a shot that hangs: check the wave and fix `words.json` if needed.

## Sound

- Voice: `gemini-3.8-flash-tts`, one voice for the whole film, one route (AI Studio or OpenRouter, not mixed). Keep takes at 3 or fewer, and listen with `listen`. Or the user's own voice (`source: own`), recorded in one sitting so the room and the distance to the microphone stay the same.
- Music: only with a music route (`doctor --json` → `capabilities.music`); without one the film runs on mechanics, room tone and rain. Lyria writes about 3 minutes per piece and no pure ambience. Plan 3–4 pieces whose breaks carry meaning: the music stops dead on the word that matters and returns after the aha. Prompt with key, tempo, instruments and a timeline. `tools/place_audio.py` places them from word times.
- SFX: everything is mechanics, so paper, keys, relays, valves, wood. `audio/kit.json` for roles, `tools/make_sfx.py` writes `sfx.json` from word times (never typed seconds), typing sound from the same `lettersOf` timing as the picture.
- Room tone and rain: filtered noise (`tools/make_ambience.py`), since neither Earshot nor Lyria has them. Meant to be missed rather than heard.
- Levels: music 22 dB under the voice with 3 dB ducking; SFX big hits 14–18 dB under, accents 20–26, textures 27–37. Master -14 LUFS, ceiling -3.4 dBTP. `mix.json` rides in the piano-alone stretches and the end credits.
- `listen` over the whole film and each passage with timestamps; a critic's score is evidence, weigh it. Change only what you can hear a reason for.
- At AI Studio's daily limit the tool switches to OpenRouter by itself.

## Order of the bakes

Some picture content depends on the voice and on earlier renders of this film. This order avoids chasing your own tail, and it matters after any script change:

1. `voice takes`, `listen`, pick (the user's own voice: `voice own --wait`)
2. `voice assemble --pick … --no-verify`
3. `python tools/pauses.py --fresh`, then check the word times
4. `python tools/bake_env.py` (voice envelope)
5. `place_audio.py`, `make_sfx.py`
6. `superint-video mix .`, `listen`
7. Update `script.md`, `beats.md`
8. `bake_source.py` (the film's own code as a texture, if it shows that)
9. `thumb_frames.py`, a thumbnail pass at low samples, `bake_thumbs.py`, `bake_bogen.py` (contact sheets, film strips inside the film)
10. `bake_images.py` (everything as `data:` URIs)
11. **Search for leaks:** voice, scenes, baked sheets by eye, baked source by text, for words of the prompt, audience, names of other channels
12. `check` at low samples
13. Samples 64, look at frames
14. Render

## Review

- `review` as in the superint-video skill, plus: stills every 2 s with the spoken word printed under each, across the whole film at a new offset per pass. Write faults down first, then fix them.
- Contact sheet next to `references/` at full size and at thumbnail size.
- Scan at 8 samples and 6 fps for dark or still stretches.
- Hero frames at 64 samples, the count the film renders at: the only true judge of a close-up.
- Last, the polish pass of the superint-video skill (`references/polish.md`): `superint-video polish .` for fresh eyes, then `polish --accept`. It draws its frames with the film renderer, about 600 of them for three minutes of film, so plan the time; `--every 8` halves the stills. With two or three rounds (`polishRounds`) every round draws its own frames, and a later round adds close-ups of every still: plan each round at least as long as the first, and keep the same `--every` in every round, so the later stills fall between the earlier ones. `render` asks for the last round's accepted pass.

## Render

```sh
superint-video render . --output renders/<slug>.mp4 --audio audio/master.wav --codec x264 --workers 2
```

- H.264 for showing on work computers without an HEVC extension. `--workers 2`: the GPU limits, not PNG encoding. 3 or 4 browsers give the same speed and cost memory.
- Studio shows it live: the frame being rendered, time left and the strip of what is done. At this length the render is the longest wait of the whole film, so name the URL when you start it.
- Windows must not sleep during it. `tools/render_awake.py <log> <result> render . --output …` asks the OS for that for its own process only and changes no settings.
- There is no resume. Don't edit `scenes/`, `video.json` or `audio/` until it is done, and keep the GPU otherwise free.
- Verify: frames from the MP4 at a few points, loudness (`earshot measure`), length, then hand over. Report, thumbnail and cleanup after the user has accepted.

## What is where in the example

`example/videos-aus-code/`, the complete film without baked images:

| File | Solves |
| --- | --- |
| `scenes/story.js` | Rooms switching on by chapter, three kinds of mirror, a world showing itself, a whole wide shot inside a screen, code-wall mask |
| `scenes/house.js` | Building plan and section walls |
| `scenes/camera.js` | A 6-minute camera path on words, moves through floors, hard cut, gong shake |
| `scenes/schreib.js` | Typewriter synced to the voice, letter by letter; keys, typebars, carriage, return; a credits page; a stamped seal |
| `scenes/exterior.js` | Sky, wet street, rain, neon sign per letter, a factory of voxels that falls apart into pixels and stands again differently |
| `scenes/foyer.js` | Marble mirror, microphone, a golf-ball typewriter, a code page with one line overwritten and only the walls changing, pneumatic capsule flight |
| `scenes/buehne.js` | Flip book with this film's frames, split-flap counter, browser on a monitor with a live clock, a monitor that shows itself, camera on rails, flash, a paper tower, a film strip through the room, lamps coming on word by word |
| `scenes/zeichen.js` | Drawing board, stamp arm, poster wall, three scripts with trap doors |
| `scenes/ton.js` | Mic with no one at it, paper roll with the text, chart recorder writing the voice, meters, marble run and gong, self-playing piano |
| `scenes/schnitt.js` | Light table lit from below, magnifier, hanging film strips, red pen writing corrections |
| `scenes/archiv.js` | Wall of drawers that open one by one, a card typewriter, chalkboard, moon through roof lights |
| `scenes/kino.js` | Rows of seats, gold frame and curtain, chat and app UI on the screen, the ending with the house as a model on the desk |
| `scenes/kit.js`, `paint.js` | Claude's mark as a path (`claudeMark`, Anthropic's mark, reference use only), neon strokes, spine atlas, crema, cane |
| `tools/` | All bake and sound scripts of the order above |
| `voice.md`, `beats.md`, `direction.md`, `music-prompt.md`, `mix.json` | The script with its settings, the shot list, the colour script, one music prompt, the mix rides |

Don't reuse its ideas in the next film unless asked: the point is the methods. Its own `.superint`, renders, audio and baked images are not part of the example, so it does not run from this folder: copy parts of it into a project.
