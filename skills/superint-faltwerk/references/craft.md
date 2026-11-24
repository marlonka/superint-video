# Craft: what made the spreads hold up, and what broke

Each point below came from a frame that looked wrong in a real production. Check a new spread against all of them before the review.

## Paper that behaves like paper

- **Fold angles.** `alpha` below 90 always, 74 to 84 in practice, and never equal for two folds of one spread: equal folds lie parallel and read as one flat picture. The title page's invisible host in the example uses 83.
- **Lifts on the page.** Printed ground is `lift: 0`. A flat token sits .0005 m above the page by default; a channel or a printed strip that is itself a flat needs about .0009, and a token that travels over it .0016. With the same lift, the traveller vanishes under the strip.
- **Parts of a piece.** A plate, a lamp or a plug on a machine is a stand of its own in front of the machine: give it the machine's `off` plus .0007 to .002, computed from the machine's `u`, not its own. Computed from its own `u` on a slanted fold it slides behind its parent and disappears.
- **A row on one line.** On a slanted fold, stands at the same `off` stand at different depths; use `OFF(u, zb)` (mechanics.md) to put a row on one line of the page, and print its ground there with `S.spot`.
- **Nothing floats, nothing crosses.** Every stand has a host and printed ground under its foot. Nothing slides over the crease: a token runs to the gutter, hides (`show: false`), and its twin appears a quarter of a second later on the other side. A piece that moves never passes under or through one that stands.
- **Lying and standing.** What stands, stands from the opening to the closing; what should stand up on its word lies flat until then (`rx` π/2 - .02 or `lie`) and springs up with a small overshoot. Nothing lies horizontal in the air, nothing sticks through the facing page while the book shuts: check the close at about 1 s into the turn.
- **The thin title leaf bends.** It turns with a lead and a lag (`THIN_LEAD`, `THIN_LAG` in `book.js`). A pop-up on the title page must follow that bend while the leaf turns, or its pieces stab through the paper: the example's `s01_titel.js` overrides `S.place` to use the bent chord angle, and only while the leaf is turning (`tau > 0 && psiR > .03`). Applied all the time, with a starting tilt, it tipped the page plane and the flats on it vanished.

## Pictures that read

- **Size things for the camera.** The first title pop-up was built too small and read as crumbs from the wide shot; the pieces were made clearly larger and the type moved up to make room. Judge every spread at the camera's widest key, not only at its close-ups.
- **The camera must not crop the point.** A camera key that cuts the title or the printed question was the most common defect after a change of layout. After moving anything, re-render every key of that spread.
- **Two scales, never mixed.** Places in section on the folds, hero pieces at the front of the page. A monitor in a room whose doors are 20 mm high breaks the room.
- **One thing at a time.** At most two clear movements at once; the rest sways (`rot` of a tree ±.02, a slow `du` of a figure). Three things moving read as noise.
- **Light the chapter.** Painted skies and walls carry the time of day; the lamp, the desk and the binding stay. A sky that is just white paper looks unfinished next to the references.
- **The near page is never empty.** Grass with flowers, paving with joints, water with ripples, a path, the chapter label. The camera looks at it more than at anything else.
- **Readable text.** Printed words at least about 2.4 mm cap height for signs, 4.5 mm for text to read, Courier Prime and JetBrains Mono not below 1.6 mm, and only on hero pieces the camera gets close to (`res` 1.6). Nothing is printed before the voice says it: a question appears as a flat on its word, not on the page from the start.

## Time

- **Turn in a wide shot.** A spread that turned while the camera was still close looked like a crash. The cure was a pause in the voice at the end of the paragraph, a matching `HOLD` for the leaf and a camera key that pulls back before the turn.
- **Reading time.** A sign or card that is to be read stays for as long as it takes to read it aloud plus a second, never under 3.5 s. When the voice is too fast for that, add a pause, do not shorten the card.
- **Sound where the picture is.** When a piece starts before its word, its sound starts with it. A card that rises 1.2 s before "Ende" with its click on "Ende" sounded late.
- **Moments come from words.** When a moment is wrong, fix its phrase in `after_voice.py`; never type a second into a spread.

## The opening and the end

- The first thing to go in the example was an opening that talked about the book and about agents in general while the real question came after 45 s. The fix: the cover lifts under the running voice on a word of the first sentence, the title page answers in one sentence and shows the answer as a small pop-up, and the question of the film is printed on its word.
- The end answers the opening question in its last sentence, the message card stands alone for about five seconds, then the book falls shut on the music's final chord.

## The render

- Develop at 32 samples, judge and render at 64 (`python tools/set_samples.py 64`). Render with `python tools/render_awake.py render.log render-result.json render . --output renders/<slug>.mp4 --audio audio/master.wav --codec x264 --workers 2`.
- The texture budget is per spread (20 layers of 2048 px). A spread that hits it gets smaller sheets or a lower `res` on pieces the camera never comes near.
