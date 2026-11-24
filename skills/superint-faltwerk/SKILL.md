---
name: superint-faltwerk
description: Films in the Faltwerk pop-up book look with Superint Video - a leather-bound pop-up book on a desk, computed by its own WebGL2 renderer, one spread per chapter, cut-paper pictures that stand up as the pages open and act on the voice's words. Use with superint-video when the user wants a pop-up book, a paper or cut-paper look, a film told chapter by chapter in a book, "Faltwerk", or the preset faltwerk.
---

# Faltwerk: the pop-up book

Read the `superint-video` skill first, then the workflow skill (usually `superint-explainer`), then this one. This skill replaces the drawing part of a production: the film is one WebGL2 scene, a book on a desk that opens leaf by leaf, and every chapter is a spread whose paper stands up by itself. Research, message, concepts, script, review and polish work as in the workflow skill.

The film this comes from is in [example/code-mode/](example/code-mode/): its seven spreads, the title page with a pop-up, the timing tools with the film's moments, the sound script, script, voice, beats and direction. Read a spread there before building something similar. It shows how things were solved; it is not a template for the next film's ideas. It is a record of one real production (German, November 2026): names and products in its script are as they were then. A new film never puts the user's own words, feedback or limits on screen.

## Start

```sh
superint-video new --preset faltwerk --workflow superint-explainer --topic "<topic>" --message "<the one sentence>" --seconds 180 --language de
```

The project starts with a finished small book: cover, title page, two sample spreads ("Die Stadt" and "Der Fluss") and the back cover, on test seconds until the voice exists. It renders right away, so you see the quality bar before you change anything. Replace the sample spreads with the film's chapters, the words in `scenes/texts.js`, the binding in `scenes/look.js`. Keep `engine.js`, `shaders.js`, `geo.js`, `m.js`, `book.js`, `popup.js`, `paper.js`, `paperkit.js`, `world.js` and the desk; extend them when a film needs more. A project owns its copy.

The look contract is the project's `STYLE.md`, the yardstick is `references/`.

## Which file for which step

| Step | Read |
| --- | --- |
| Concept, book plan, script, beats, order of work, render | [references/film-recipe.md](references/film-recipe.md) |
| Building a spread: book, folds, stands, flats, the paper kit, the camera, test frames | [references/mechanics.md](references/mechanics.md) |
| The voice decides: pauses, moments, turns, the timeline, sound effects | [references/timing.md](references/timing.md) |
| Making it hold up: what went wrong before and how it was fixed | [references/craft.md](references/craft.md) |

## What makes this look work

1. **A book is a structure the viewer already knows.** One spread is one chapter, the turn of a leaf is the chapter change, the chapter's name is printed on its near left page. Nobody needs a map.
2. **Paper engineering, not animation.** Every piece is a fold, a layer on tabs or a token on a pull-tab, and it stands up because the pages open. Build it so a paper engineer could cut it: nothing floats, nothing passes through anything, nothing sticks through the facing page when the book shuts.
3. **Everything happens on a word.** Moments are words of the voice (`tools/after_voice.py`); leaves turn in the pause after their paragraph. A piece stands up, slides or glows on its word, never on a typed second.
4. **One idea per spread, readable as a picture.** Places in section on the folds, the hero piece at the front of the page, at most two things moving clearly at once. A viewer who mutes the film can still tell the chapter.
5. **Real things in real units.** The page is 300 × 236 mm, figures 20 to 37 mm, a monitor 96 mm wide. If the numbers are real, the shadows and the depth of field behave.
6. **Light as a colour of the chapter.** The lamp and the desk stay; each spread's sky and walls carry its own time of day, from a golden afternoon into the night.

## Rules from the people who watched the films

- Never put the user's prompts, dictated words, feedback, audience description, working hours or limits into a film.
- Text only in the book, printed or on a paper sign; nothing printed before the voice says it; what is to be read stands for its read-aloud time plus a second.
- The opening answers the film's question early. In the example the book opens under the running voice and the title page already shows both ways in one small pop-up; a long, slow opening about the book itself was the first thing to be cut.
- The last sentence states the message and answers the opening question; then the book shuts and the back cover is the end card.
- Music and sound effects far under the voice; paper sounds, nothing tinkly, no tuned effects.
- After the render, hand over and stop: report, thumbnail and cleanup wait until the user has watched and accepted.

## Production time, so you can plan

| Item | Number |
| --- | --- |
| Full film as measured on "Code Mode": 3:57, 7 108 frames, 64 samples, x264, `--workers 2` | about 18 min (1 075 s), on average .15 s per frame |
| `snapshot` of a handful of frames at 32 to 64 samples | 10 to 30 s |
| A spread with a story | a long session of code (300 to 1 500 lines); plan the book before writing spreads |
| The title page's pop-up in the example | one spread's worth of work; leave it out when the opening does not need it |

Develop at 32 samples, judge looks and render at 64. Keep the machine awake during the render (`tools/render_awake.py`) and change nothing in `scenes/`, `video.json` or `audio/` while it runs.
