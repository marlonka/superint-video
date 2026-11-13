# Polish: the last look before a render

A film is not rendered for delivery until someone who did not build it has walked through it and made it better: fixed what a viewer would spot at once, and added the detail that makes a picture rich. `superint-video polish` runs that walk one picture at a time, and `render` refuses a film that has a brief until the walk is on record. Nobody has to ask for this step: it runs before every delivery render and again after every change to the picture. The user sets in advance how many rounds of it the film gets, one to three ([Rounds](#rounds)).

Review passes ([review.md](review.md)) are the author's tool while the film is being built: composition, flow, timing against the words, measured flags. Polish comes after them and asks two other questions: what would a viewer spot as wrong at a glance, and what is this picture still missing? Authors miss both, because they know what each shape is meant to be.

## Quick by design

The walk is short, and it stays short.

- **One still every 10 seconds**, every 5 in a film of up to a minute (`--every` for another step). A four-minute film is 28 stills, not hundreds of images.
- **One picture at a time.** Each `polish` call takes exactly the next still, from the picture as it is at that moment. Nothing else is laid out: no contact sheet in advance, no sets of close-ups, no strips.
- **Two looks per still at most:** the still as it is, and once more with your changes in it. The tool does not take a still a third time.
- **Change at once.** What you see in a still you fix and improve before the next still is taken, so every later still already shows it.
- No `review`, no extra `snapshot` runs, no second walk to check the first. A walk takes minutes, not hours.

## Fresh eyes

The walk belongs to someone who has not watched the film being made.

- If your host can start a sub-agent, start one cold for the walk and wait for it. Give it the brief below and none of your reasoning. If the host lets you choose the sub-agent's model, take the most capable one it offers for looking at pictures and writing code, unless the user named one: this is the step where a stronger model pays off most, because it redraws and adds.
- The polisher changes the film itself. A list of findings handed back to the author loses most of its value.
- Without sub-agents, do the walk yourself after other work (the mix, for example), and read the film as a stranger would: name each thing before you judge it.

**Brief for the polisher** (fill in the path; add nothing about how the film was built, and nothing an earlier round found):

> You are the polish director for the film in `<dir>`. You did not build it. Read `references/polish.md` of the `superint-video` skill, then the project's `brief.md`, `STYLE.md` and `direction.md`, and look once at the pictures in `references/` (the six that show the look best, when there are more). Then walk the film with `superint-video polish <dir>`: each call shows you one still. Fix what is wrong in it and add the detail it lacks, in the scene code; run `polish` once to see the changed still; write its row; run `polish` again for the next still. Look at no other pictures and at no still more than twice. Leave the script, the voice, the timing of the words, `video.json` and the sound as they are. When no row is left, run `check` and `polish --accept`. Report in a few lines: what you fixed, what you added, what you left and why, and what `polish --accept` says comes next.

## The walk

1. `superint-video polish <dir>` starts the round: it writes the worksheet `renders/polish/<n>/polish.md` with one row per still, takes the first still and prints it as `next.image`, with `next.words` (what the voice says there), `done` and `left`.
2. Open that one picture at full size. Name each thing in it, then decide two things: what is wrong ([What a viewer spots at once](#what-a-viewer-spots-at-once)) and what the picture would gain from ([What to add](#what-to-add)).
3. Do both now, in the scene code. Fix an object where it lives (the shared library), so every scene gets it. Redraw rather than nudge when something is built wrong. Do everything for this still in one go.
4. Run `polish` once more. The row is still empty, so the same still is taken again with your changes in it (`next.taken` is `again`). Look at it once.
5. Write the row:
   - under Finding, what was wrong or missing, in a few words
   - under Fix, what you did, beginning with `fixed:` or `added:` (both in one cell is fine: `fixed: lid as wide as its base; added: brushed metal`); say there too what is still not right, if anything
   - `kept: <reason>` under Fix for something left on purpose
   - `ok` plus a few words under Finding for a picture that needs nothing and holds up beside the references as it is

   A row whose Fix does not begin with one of those words stays open.
6. Run `polish` again: it takes the next still. Go on until `next` is null.
7. Run `superint-video check <dir>`, then `superint-video polish <dir> --accept`. It records the walk for the picture as your changes left it, writes `contact-sheet.png` of the walked film into the pass folder, and says in `next` whether another round is due. It refuses while a row is empty or names a finding without `fixed:`, `added:` or `kept:`, and for a still that was never taken.
8. Log the round in `process/polish.md`: what was fixed, what was added, what was kept and why.

A walk that was interrupted goes on where it stopped: `polish` finds the first empty row. Studio's Progress panel shows the walk live, with the still being looked at and every row's finding and fix, so write each row when its still is done, not at the end.

## Rounds

The user chooses in advance how many rounds of polish a film gets: 1 (the default), 2 or 3. One round is one polisher, a new cold sub-agent, walking the film once. Rounds run one after another, never side by side; each starts from the picture the round before left. More rounds give more detail and fewer faults, and cost time and usage, which the user has weighed. Run exactly as many as are set: do not ask for the number, do not cut rounds to save time, do not add any.

- **Where the number comes from.** `polishRounds` in the front matter of the film's `brief.md` (`new --polish-rounds 2` writes it), else the user's setting (Setup → "Polish before the render", `superint-video settings set polishRounds 3`). `new` reports it under `polish`, every `polish` run under `round` and `rounds`, `settings` and `doctor --json` under `polishRounds`.
- **Between rounds.** When `polish --accept` closes a round and another is due, its `next` says so. Start a new cold polisher with the same brief; never hand the round to the polisher that just finished, and add none of its findings to the brief: the next worksheet lists them itself.
- **What a later round sees.** It walks the film again, with stills between those of the earlier rounds (round 2 half a step on, round 3 a quarter). Its worksheet lists what the earlier rounds fixed and asks its own questions: round 2 checks that the fixes hold and looks for the same kind of fault elsewhere, behind the hero and in the words on screen; round 3 follows each thing through the film and looks at light, depth, materials and composition.
- **The gate.** `render` refuses until the last round is accepted for the picture as it is; a clean earlier round shows as `next-round`. Studio shows "Round 2 of 3" beside the pass.
- **After the last round.** A change to the picture (feedback after watching, for example) gets a short pass in the last round: `polish` takes the stills once and lists only those that no longer show what somebody looked at. Walk those the same way.

## What a viewer spots at once

These are faults a person sees in the first second and an author stops seeing. They are about how things are made, not about a style; the workflow's rubric and the references say what good looks like.

**Every object.** Name it, then ask how it is built and from where we see it.

- **Construction.** Parts that belong together fit: a laptop lid as wide as its base, a book's pages inside its cover and equally thick on every side, an envelope's flaps meeting at the seams with nothing of the letter showing while it is closed, drawers inside a body under the desktop, a shelf resting on brackets, a handle joined to its cup.
- **One viewpoint.** Everything on a surface is seen from the same side. A lamp drawn from the side on a desk seen from above is wrong, however good the lamp. Thick things show the same faces everywhere.
- **One light, real contact.** Shadows fall one way. Each thing touches its surface with a tight shadow, nothing floats, and no shadow stays behind when its object changes shape.
- **Meaning.** Cover the label: would a stranger still say what it is? A body named after the stars looks like stars, not like a pale ball. Size and colour alone do not carry a name.
- **Finish.** The smallest icon gets the care of the hero object, because viewers pause on lists. A plain disc, bar or blob that stands for a real thing is a placeholder: give it the few details that make it that thing (craters, continents and clouds, flames, a spine and pages).
- **Same thing, same look.** What you saw in an earlier still is recognisably the same thing here.

**Every still.**

- Nothing sticks out of what holds it, covers a label or a face, or is cut to a sliver by the frame edge.
- Lines end on what they join, a wire leaves its plug in line with it, and a pointer touches what it points at.
- Text is spelled right, in the film's language, inside its box, and large enough to read.
- Nothing is left over from an earlier beat: an empty pill, a half-faded word, a glow without its source.
- A still that catches a move or a cut mid-way: layers keep their order, nothing passes through something solid, nothing pops in.
- No quarter of the picture is empty, dark or unfinished beside the references.

## What to add

A walk that only removes faults leaves the film as plain as it was. In every still, find the place that is flat, empty or generic beside the references and give it what the real thing has. One good detail per still is enough; made in a shared library, it reaches every scene.

- **Material.** Grain, weave, brushed metal, paper fibre, a gloss where the light hits.
- **Small parts.** Seams, screws, stitches, labels, buttons, edges with thickness.
- **Light.** A contact shadow, a rim of light, a little colour bounced from a neighbour.
- **Depth.** Something in front, an overlap, a background that is not one flat colour.
- **Life.** Something small that moves or settles, kept quiet so it never pulls the eye from what the voice speaks about.

Stay inside the film's look (`STYLE.md`, `direction.md`, its palette). Add nothing that states a fact, and change no word on screen. Something plainly weaker than the references is a reason to add even when it breaks no rule: write down what the reference has that this picture lacks, and add it.

## Then render and hand over

- `superint-video render <dir> --output renders/<slug>.mp4 …` runs once the last round is accepted, and its JSON reports the pass and round under `polish`. Without that it stops and says what is due. `--quality draft` is for test renders (to listen to the mix against the picture, for example); `--unpolished` is only for when the user says to skip the walk. A project without `brief.md` is never held up.
- Everything that needs checking is checked before this render: the picture by the walk, the sound by `listen` on a draft (see the `superint-audio` skill).
- When the render is done, read the numbers it reports (frames, size, and loudness and true peak with audio), give the user the MP4 path and the Studio address where the film now plays, and stop. The user watches first. Thumbnail, report, making-of and cleanup wait until they accept the film or ask for them.
- Feedback after watching is a change like any other: fix it, run `polish` (it lists the stills that changed), accept, and render under a new name.
