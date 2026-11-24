# From brief to render

The workflow skill's steps hold (research, concepts, script, beats, style frames, build, review, polish, deliver). This file says what changes in a pop-up book, and the order that keeps the voice, the spreads and the sound in step.

## Concept

- **The book is the frame, the spreads are the worlds.** Three concepts differ in what stands in the book: the places, the key image of each spread, the colour script. The binding, the desk and the lamp are the same in every concept.
- **One recurring place carries the argument.** In the example the gutter is the border to the model on four spreads in a row: left the agent and its services, right only the model and its context window, so the viewer learns the map once and then sees only what changes. Keep the place and change the light and what happens in it.
- **Real things, cut open.** A building in section with its roof cut away, the sky above it; data as printed paper; the mechanism of the book shows what the subject does (a tab pushes a card through a channel, a stack grows behind a window).
- **The title page may carry the answer.** A small pop-up from shrunk parts of the later spreads lets the opening show the film's answer before the explanation starts; the viewer meets those parts again large and learns nothing twice.

## The book plan

Before the script, write `process/buchplan.md`: one row per spread with its chapter, the place on its folds, the hero piece at the front, what moves on which kind of word, the light, and the planned seconds. Seven spreads between cover and back carried a four-minute film; a spread holds 20 to 50 s. Critique the plan cold at least twice: it decides more than any single spread.

## Script and voice

- One paragraph of `voice.md` per spread, the first over the shut cover. A chapter that needs more words gets a second spread, not a longer paragraph.
- Write for what paper can do: "Der Stapel wächst." can be shown; "Die Kosten explodieren." cannot.
- A spoken bridge at the end of each paragraph leads into the next spread, so the turn never comes as a surprise.
- Name every moment's trigger word in `beats.md` while writing, and check that it occurs once and early enough in its paragraph.

## Beats

`beats.md` lists, per spread: what stands as it lands, each moment with its trigger word and what happens (stands up, slides, glows, lies down), the camera's stops, and the sounds. Two clear movements at a time at most; a moment every 3 to 6 s; nothing printed before its word.

## Order of work

1. Book plan, script and voice (`voice takes`, `voice assemble`, `python tools/after_voice.py --fresh`). With the voice the spreads have their real lengths and moments from the start.
2. Binding and title page (`look.js`, `texts.js`, `s00_book.js`), then the spreads in reading order, each tested on its development reel (mechanics.md) at its rise, its landing, every moment, every camera key and its close.
3. The whole film at test frames: `check` and a `review` pass at 32 samples.
4. Sound: `audio/make_sfx.py` from `process/turns.json` and `process/timing.json`, `sfx place`, the music cut to the turns, `mix`, `listen`.
5. Polish at 64 samples, as the `superint-video` skill says, then the render.

When the voice changes after the spreads exist (a new take, a rewritten paragraph), run `after_voice.py` again: every moment, turn and camera key follows, and the sound script must be run again too.

## Review

- Put every spread's wide frame next to the references at full size: as full, as detailed, as clean, light that belongs to its chapter.
- Walk each spread at its moments and check the craft list (`craft.md`): lifts, parts behind parents, nothing floating, nothing crossing, the near page grounded, text readable and not early.
- Watch every turn: the leaving spread wide, the new one rising without anything flying through the paper.

## Render and hand over

```sh
python tools/set_samples.py 64
python tools/render_awake.py renders/render.log renders/render-result.json render . --output renders/<slug>.mp4 --audio audio/master.wav --codec x264 --workers 2
```

About .15 s per frame on a desktop GPU. Name the Studio address when it starts; hand over the MP4 when it is done and stop until the user has watched it.
