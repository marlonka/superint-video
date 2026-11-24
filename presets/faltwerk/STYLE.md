# faltwerk: a pop-up book, computed in code

A pop-up book lies on a paper maker's desk in the evening, under a brass lamp. It opens, leaf by leaf, and every spread is one chapter of the film: as the pages part, a picture of cut paper stands up by itself, the pieces on it slide, rise, turn and glow on the voice's words, and in the pause after the chapter the next leaf turns. The film never leaves the desk and never cuts: one camera journey, and the turns of the leaves are the chapter changes. The book closes at the end; its back cover is the end card.

Everything is computed in code. The project's own WebGL2 renderer (`scenes/engine.js`, `scenes/shaders.js`) renders every film frame 32 to 64 times with a camera, lamps and time a little apart, so shadows are soft, the depth of field is that of a macro lens and moving paper blurs. Every sheet of paper is painted in code in millimetres (`scenes/paper.js`, `scenes/paperkit.js`) and becomes a texture; what stays transparent is cut away.

The `superint-faltwerk` skill holds the mechanics, the timing pipeline, the craft and a finished film as an example. Read it before the first spread.

## The book

- **Anatomy** (`scenes/book.js`, `scenes/plan.js`): a book of N spreads has N - 1 leaves: the cover (heavy, leather with gold), the thin title leaf, boards (card, 2 mm), the back cover. Spread 0 is the shut book, spread 1 the title page with the marbled pastedown on its left, the last spread the back cover. `LEAVES` in `plan.js` is the number of spreads minus one.
- **Binding** (`scenes/look.js`, `scenes/spreads/s00_book.js`): pebbled leather with blind tooling and gold foil, corner tools, fillets, the title set in Fraunces 900. Each film binds its own volume: a leather colour (`hide`, `leather`, `edge`), the gold, the marble of the endpaper, a bookplate line. The highlights and the wear of the leather in `leather()` are tinted to the leather colour: change them together.
- **Title page**: laid paper, an engraved double frame, the title in the signal colour, a line below. It may carry a small pop-up of its own (stands on an invisible fold, see the example).
- **Spreads** (`scenes/spreads/`): one file per chapter, registered in `spreads/index.js` in reading order.

## A spread's grammar

- **Four to six depth planes**, glued from the back to the front: a sky or back wall fold, a far fold, the main fold, stands in front, print on the page. Shadows between planes are real; never paint a cast shadow on the page.
- **vfold**: a wall of two panels glued along lines through one point of the gutter; it stands up by itself as the book opens. `alpha` 74 to 84 degrees (below 90, always); folds of one spread differ by 1 to 3 degrees.
- **stand**: a layer on tabs, parallel to a panel of its host fold, a set distance in front of it. Everything smaller than a wall is a stand: people, a van, a tree, a sign, a window that glows.
- **flat**: a token lying on the page that slides on a pull-tab: a boat on a printed river, a card in a slot.
- **Nothing floats.** Every stand has a host, and where it meets the page there is ground printed for it (`S.spot` gives the exact place). Nothing slides across the crease; nothing passes under or through a piece that stands; nothing sticks through the facing page while the book shuts.
- **Detail with a reason**: a house has windows, sills, a door, a roof edge; a figure has clothes of its time; a shop has goods. Vary colour, size and pose; one element repeated identically reads as low effort.
- **Ground the print**: where the camera looks at the near page there is something worth seeing (paving, grass with flowers, water, a path), never bare paper.
- **Two scales, each thing in one**: places in section on the folds (buildings, halls, rooms), and hero pieces at the front of the page (a monitor, a card, a sign to read). A hero piece never stands in a room whose scale it breaks.

## Light and colour

- Key light: the desk lamp, warm, from the back left; shadows fall to the front right. Fill large, cool, from above the front. Rim cool from the back right.
- The desk, the lamp and the binding stay the same through the film. Each spread brings its own light as a colour of the chapter, painted into its sky and walls (golden afternoon, sunset, dusk, night): write the colour script in `direction.md`, in hex values, per spread.
- One **signal colour** (`LOOK.signal`) belongs to the film's one idea: the title, and only the things on the spreads that are that idea. Nothing else in the book takes it.
- Things that glow (screens, windows, lamps, LEDs) are sheets of their own with `e` and `life().glow`.

## Type

| Face | For | Size (cap height feel, mm on the paper) |
| --- | --- | --- |
| Fraunces 900 | Chapter labels on the near left page, the title | labels 11 to 15, title 18 to 30 |
| Fraunces 600 | Book text, tables of numbers | 4.5 to 8 |
| Jost 700 caps, tracked 0.15 to 0.3 | Signs, plates, labels on machines | 2.4 to 4 |
| Jost 500 | Screens, scales | 2.4 to 3 |
| Caveat 700 | Pencil, handwriting | 3.5 |
| JetBrains Mono 400/700, Courier Prime 400/700 | Code, typed paper, JSON | 1.6 to 2.2 |

No other faces. Text lives only in the book, printed on a page or on a paper sign: at most seven words a line, in the film's language with real umlauts and ß. Every spread keeps its printed words in a `const TX` at the top of its file, each fact with its claim ID from `research.md`. What is to be read stands at least as long as it takes to read it aloud plus a second.

## Motion and time

- The voice decides: every leaf turns in the pause after its paragraph (`voice.md` has one paragraph per spread, the first over the shut cover). Moments of a spread happen on words (`tools/after_voice.py`).
- At most two things move clearly at a time; the rest sways gently. Typical: something slides on a pull-tab, something stands up on its word, a window lights up, birds lift off.
- Every piece springs once as it locks (13 rad/s, damping 5.2), the front ones a moment later.
- Every `life(t)` is a pure function of time: no state, no `Math.random()`.

## Camera

`S.cam` keys `[tau, eye, at, fov, aperture]`, tau in seconds after the spread lies open (negative while it rises). Start wide as it lands (fov about .52), move in slowly to what the chapter tells (fov .38 to .46, distance .3 to .5 m), visit one or two more places, and return wide before the leaf turns. Eye height never below 0.11 m. Five to seven keys per spread; calm, no whip pans.

## Sound

Paper, not machines: the cover lifting off the block, each leaf turning, each fold locking open with a soft card snap, small slides and clicks of pull-tabs. Sound effects sit on the frames of `process/turns.json` and on the moments; the music stays far under the voice.

## Rendering

32 samples while developing, 64 to judge a look and to render (`python tools/set_samples.py 64`). Render with `--workers 2` through `python tools/render_awake.py`, which keeps the computer awake. Expect about a fifth of a second per frame on a desktop GPU, so roughly 25 minutes for a three-minute film.

## Don'ts

- No stock picture, no photograph, no drawn cast shadow, no text set outside the book.
- No piece on the crease that must be read (a face, a sign, a door).
- No blue sky and no blue thing unless blue is the film's signal colour.
- No brand mark, logo or figure of anyone else's unless the brief brings it for their own brand.
- References show a look, never content: do not reuse the example's buildings, machines or compositions in another film.
