# Polish: the last look before a render

A film is not rendered for delivery until someone who did not build it has looked at every part of it and found nothing left to fix. `superint-video polish` prepares that look, a later pass shows only what changed, and `render` refuses a film that has a brief until a clean pass is on record. Nobody has to ask for this step: it runs before every delivery render and again after every change to the picture. The user sets in advance how many rounds of it the film gets, one to three ([Rounds](#rounds)).

Review passes ([review.md](review.md)) are the author's tool while the film is being built: composition, flow, timing against the words. Polish comes after them and asks a different question: what would a viewer spot as wrong at a glance? Authors miss exactly that, because they know what each shape is meant to be.

## Fresh eyes

The pass belongs to someone who has not watched the film being made.

- If your host can start a sub-agent, start one cold for the pass and wait for it. Give it the brief below and none of your reasoning. If the host lets you choose the sub-agent's model, take the most capable one it offers for looking at pictures and writing code, unless the user named one: this is the step where a stronger model pays off most, because it redraws what it finds.
- The polisher finds and fixes. A list of defects handed back to the author loses most of its value.
- Without sub-agents, do the pass yourself after other work (the mix, for example), and read the film as a stranger would: name each thing before you judge it.
- A user who wants to look themself gets the same folder: the stills and sheets are made for human eyes too.

**Brief for the polisher** (fill in the path; add nothing about how the film was built, and nothing an earlier round found):

> You are the polish director for the film in `<dir>`. You did not build it. Read the `superint-video` skill and its `references/polish.md`, then the project's `brief.md`, `STYLE.md`, `direction.md` and every image in `references/`. Run `superint-video polish <dir>`: its worksheet says which round this is and what to look for in it. Look at every image it lists, fill in its worksheet, then fix every defect in the scene code: redraw what is built wrong, add the detail that is missing, smooth the cuts and the moves. Run `check`, run `polish` again, and repeat until a pass is clean; then run `polish --accept`. Leave the script, the voice, the timing of the words and the message as they are. Report what you changed, what you kept on purpose, and what `polish --accept` says comes next.

## Rounds

The user chooses in advance how many rounds of polish a film gets: 1 (the default), 2 or 3. One round is one polisher, a new cold sub-agent, working pass after pass until one is clean and accepted. Rounds run one after another, never side by side; each starts from the picture the round before left. More rounds give more detail and fewer visual faults, and cost time and usage, which the user has weighed. Run exactly as many as are set: do not ask for the number, do not cut rounds to save time, do not add any.

- **Where the number comes from.** `polishRounds` in the front matter of the film's `brief.md` (`new --polish-rounds 2` writes it), else the user's setting (Setup → "Polish before the render", `superint-video settings set polishRounds 3`). `new` reports it under `polish`, every `polish` run under `round` and `rounds`, `settings` and `doctor --json` under `polishRounds`.
- **Between rounds.** When `polish --accept` closes a round and another is due, its `next` says so. Start a new cold polisher with the same brief; never hand the round to the polisher that just finished, and add none of its findings to the brief: the next worksheet lists them itself.
- **What a later round sees.** Its first pass starts over the whole film. The stills fall between the earlier rounds' stills (round 2 at half the interval, round 3 at a quarter), every still gets close-ups of its four quarters, the strips show fast moves no earlier round showed, and cuts are shown again. The worksheet lists what the earlier rounds found and fixed, and asks its round's own questions: round 2 checks that the fixes hold, looks for the same kind of fault elsewhere, behind the hero, between the stills, against the references and in the words on screen; round 3 follows each thing through the whole film and looks at light and depth, materials and small parts, motion, composition and the end. Later passes of the round list only what changed or stayed open, as in round 1.
- **The gate.** `render` refuses until the last round is accepted for the picture as it is; a clean earlier round shows as `next-round`. Studio shows "Round 2 of 3" beside the pass.
- **After the last round.** A change to the picture (feedback after watching, for example) is polished in the last round: a pass over what changed, not every round again.
- **Time.** A later round looks at more images than the first, so plan each round at about the time of the first or more. A miniature film renders every pass's frames with the film renderer: there the rounds add up most (see its `film-recipe.md`).

## One pass

1. `superint-video polish <dir>` writes `renders/polish/<n>/`:
   - `frame-<f>.png`: a still every 5 s (`--every`) plus the last frame
   - `close-<f>-<a–d>.png`: the four quarters of every still that shows a new view, at native resolution
   - `cut-<f>.png`: the last frame before each cut beside the first frame after it
   - `motion-<f>.png`: the fastest moves of every scene, eight frames three apart
   - `polish.md`, the worksheet with one row per image, and `contact-sheet.png`, the map
2. Look at the contact sheet next to the references, then open **every** listed image at full size. A 150 s film has about 130; looking at all of them is the job.
3. For each image, name every thing in it, then go through the questions below. Write the defect and its fix into the row before changing anything. Write `ok` plus a few words when the image holds up, and `kept: <reason>` for something left on purpose.
4. Fix everything. Fix an object where it lives (the shared library), so every scene gets the fix. Redraw rather than nudge when something is built wrong. For another close look: `superint-video review <dir> --frames <f> --crop x,y,w,h`.
5. Run `check`, then `polish` again. The next pass lists only the images whose pixels changed, with close-ups of the quarters that changed, plus every row the pass before left open. Look at those the same way: a fix can break what was right.
6. When a pass holds only `ok` and `kept`, run `superint-video polish <dir> --accept`. It refuses while a row is empty or names a defect, or when the picture changed after the pass. Its `next` says whether another round is due.
7. Log each pass in `process/polish.md` under its round: what was found, what changed, what was kept and why.

A round has no fixed number of passes. Stop when a pass is clean, then start the next round if one is due.

## What a viewer spots at once

These are faults a person sees in the first second and an author stops seeing. They are about how things are made, not about a style; the workflow's rubric and the references say what good looks like.

**Every object.** Name it, then ask how it is built and from where we see it.

- **Construction.** Parts that belong together fit: a laptop lid as wide as its base, a book's pages inside its cover and equally thick on every side, an envelope's flaps meeting at the seams with nothing of the letter showing while it is closed, drawers inside a body under the desktop, a shelf resting on brackets, a handle joined to its cup.
- **One viewpoint.** Everything on a surface is seen from the same side. A lamp drawn from the side on a desk seen from above is wrong, however good the lamp. Thick things show the same faces everywhere.
- **One light, real contact.** Shadows fall one way. Each thing touches its surface with a tight shadow, nothing floats, and no shadow stays behind when its object changes shape.
- **Meaning.** Cover the label: would a stranger still say what it is? A body named after the stars looks like stars, not like a pale ball. Size and colour alone do not carry a name.
- **Finish.** The smallest icon gets the care of the hero object, because viewers pause on lists. A plain disc, bar or blob that stands for a real thing is a placeholder: give it the few details that make it that thing (craters, continents and clouds, flames, a spine and pages).
- **Same thing, same look.** What appears twice, large and as an icon or in two scenes, is recognisably the same thing.

**Every frame.**

- Nothing sticks out of what holds it, covers a label or a face, or is cut to a sliver by the frame edge.
- Lines end on what they join, a wire leaves its plug in line with it, and a pointer touches what it points at.
- Text is spelled right, in the film's language, inside its box, and on screen long enough to read.
- Nothing is left over from an earlier beat: an empty pill, a half-faded word, a glow without its source.
- No quarter of the frame is empty, dark or unfinished beside the references.

**Every cut** (`cut-<f>.png`).

- What is on screen before the cut and gone after it pops: a glow, a shadow, a field of stars. Carry it across and fade it after the cut, or let it go before.
- On a match cut the matched thing has the same size, place and look on both sides.
- Things that grow with a zoom (stars, dots, strokes) do not swell into discs just before the cut.

**Every move** (`motion-<f>.png`).

- Things ease in and out and come from a place that makes sense. Nothing appears or vanishes inside one frame.
- Layers keep their order mid-move, and nothing passes through something solid.
- Read-outs and labels travel with what they belong to.
- A move that looks wrong in the strip is redesigned (path, timing, overshoot, follow-through), not merely slowed down.

Something plainly weaker than the references is a defect even when it breaks no rule: write down what the reference does that this frame does not, and add it.

## Then render and hand over

- `superint-video render <dir> --output renders/<slug>.mp4 …` runs once the last round is accepted, and its JSON reports the pass and round under `polish`. Without that it stops and says what is due. `--quality draft` is for test renders (to listen to the mix against the picture, for example); `--unpolished` is only for when the user says to skip the pass. A project without `brief.md` is never held up.
- Everything that needs checking is checked before this render: the picture by the polish pass, the sound by `listen` on a draft (see the `superint-audio` skill).
- When the render is done, read the numbers it reports (frames, size, and loudness and true peak with audio), give the user the MP4 path and the Studio address where the film now plays, and stop. The user watches first. Thumbnail, report, making-of and cleanup wait until they accept the film or ask for them.
- Feedback after watching is a change like any other: fix it, run `polish` (it lists what changed, in the last round), accept, and render under a new name.
