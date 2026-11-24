# Timing: the voice decides

A Faltwerk film has no cuts and no typed seconds. The voice is recorded first; its word times decide when each leaf turns, when each spread lies open, how long it stays and when every piece on it acts. The pipeline lives in the project's `tools/` and `scenes/timeline.js`.

## voice.md and the spreads

`voice.md` has one paragraph per spread before the back cover: paragraph 1 is spoken over the shut cover, paragraph 2 over the title page, paragraph n over spread n - 1. Leaf j turns in the pause after paragraph j + 1; the back cover falls shut 5.2 s after the last word, and the film ends 2.6 s after it has landed. A spread that needs to stay open after its paragraph (something is still being read) gets a hold.

## After `voice assemble`

```sh
superint-video voice assemble . --pick 1=2,2=1,...
python tools/after_voice.py --fresh
```

`after_voice.py` does everything the voice decides, in one run:

1. `tools/pauses.py` puts real pauses into `audio/voice.wav` (`voice assemble` shortens every pause to the sentence pause) and shifts the word times with them. It keeps the freshly assembled voice as `audio/voice.assembled.wav` and always starts from that copy, so it can run again and again; `--fresh` takes a new assembly. It writes `scenes/cues.js` and the voice clip and length into `video.json`.
   - `LEAD`: silence before the first word (the shut book stands a moment; .5 in the example, where the book opens under the running voice).
   - `PAUSES`: `(paragraph, last words before the pause, extra seconds)`: room for the picture where beats.md asks for it.
   - `GAPS`: `{paragraph: seconds}` sets the silence after a paragraph exactly; it may be shorter than the assembly's.
   - `END_CARD`: seconds after the last word that the film needs at least.
2. It writes `process/timing.json`: start, end and text of every paragraph, and the named moments of every spread, each on the start of a word of its trigger phrase.
   - `MOMENTS = { spread: [(name, phrase, word of the phrase, occurrence in the paragraph[, paragraph]), ...] }`. The paragraph defaults to spread + 1; a moment on the title spread may hear the cover's paragraph too (the example's `('stecker', 'MCP', 0, 1, 1)`).
   - `TURN_AT = { leaf: (paragraph, phrase, word, occurrence) }`: a leaf that turns on a word while the voice goes on, instead of in the pause after its paragraph. The example's cover lifts on "sparsamer" in the first sentence.
3. `tools/make_timing.py` writes `scenes/timing.js` and `process/turns.json` (when each leaf turns and lands, the film's end and frame count). `HOLD = { leaf: seconds }` keeps a leaf open longer after its paragraph; give the voice the same pause at the end of that paragraph in `PAUSES`, or the next paragraph starts while the page is still turning.
4. `video.json` gets the film's real length.

It prints, per spread, when it lands, each moment in spread seconds and the distances between them. A distance below about .6 s means two things act at once; a moment missing from the list means its phrase was not found ("NICHT GEFUNDEN"): fix the phrase, never the time.

## How the scenes read it

- `timeline.js` computes the turns from `TIMING` (the same rule as `make_timing.py`: keep both in step if you change one) and exports `TURNS`, `END`, the opening camera `CAM` and the end camera `CAM_END`.
- `world.js` turns each spread's moments into its own time: `S.t[name] = moment - landing`, and `S.plan` becomes the real time the spread lies open, so `life(t)` and the camera keys are in real seconds. Before the voice exists, `S.t` and `S.plan` are the spread's planned values.
- `S.setup(t)` and `S.cam(t)` run after that, so a spread can build sheets and camera keys from its moments.
- A moment in `life()` is a start, not a duration: a piece that rises on `t.x` takes its own .4 to .8 s; a piece that must be up when the word is spoken starts before it (the example's message card stands up 1.2 s before "Ende").

## Turns and the camera

- A leaf turns 2.3 s (the cover 2.2, the thin title leaf 1.9, the back cover 2.5). The camera of the spread that is leaving should be wide by then: the last key of every `S.cam` is at `S.plan - .2` to `- .6`, wide. A turn under a close camera shows the paper flying through the frame.
- The title page in the example turns .4 s after its last word ("Zukunft?") so the printed question is not lost in the moving paper: `HOLD = {1: .25}`.

## Sound effects on the same clock

The example's `audio/make_sfx.py` writes `sfx.json` from `process/turns.json` (each leaf: lift-off at `t0 + .12`, the landing thud at `lands`, the folds of the new spread locking open) and from `process/timing.json` (each moment, with the delay its piece needs: a plug is seated .68 s after its moment). Place a sound where the picture's event really happens, not where the word is: when a piece starts early, its sound starts early. Then `superint-video sfx place`, `mix` and `listen`, as the `superint-audio` skill says.

The music is cut on bar lines to the film after the voice is final: `audio/score.py` in the example reorders whole bars of one Lyria variant so swells land on the turns and the final chord on the back cover.
