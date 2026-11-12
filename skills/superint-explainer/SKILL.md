---
name: superint-explainer
description: Workflow for narrated explainer films with Superint Video - research with a claim register, a message the film argues, three concepts, scripts, beats, style frames, build, review passes and delivery with thumbnail and YouTube package; 30 s shorts to 10-minute films. Use with the superint-video skill when the user wants an explainer, an "Erklärvideo", a science or concept video, or a film that argues a position ("why X is not a good idea"), in any style preset (flat-explainer is made for it).
---

# Explainer workflow

Read the `superint-video` skill first: it covers the tool, presets, references, the CLI, the live status for Studio and the making-of. Its rule holds here too: everything below is a floor, not a ceiling. This skill plans the film. The look comes from the project's `STYLE.md` and `references/`; how an explainer is staged, paced and cut is in [references/composition.md](references/composition.md).

## The bar

The standard is a film a top explainer studio would publish: it makes one idea click, it argues its message with true reasons, and every frame is a finished picture. Priorities, in order: **understood → surprising → beautiful → polished.**

Every frame shows, in a full and grounded picture, exactly what the voice says at that moment: the real people, places and things of the topic, in a few connected worlds that the camera travels through smoothly, with one art direction across the film and a new world only when the argument moves on (never a new design every few seconds). The stills in `references/` are the yardstick: put your contact sheet next to them. Anything that would look empty, dark, abstract or unfinished beside them is not done.

## Message

The film argues one message: the sentence under `## Message` in `brief.md`, from `new --message` or written there from the user's request before research. When the request takes a position ("why X is not a good idea"), that position is the message: research looks for the strongest supported reasons for it and for the strongest objection; the film gives those reasons, answers the objection in a line, and ends on the message. Never swap the message for a side question that seems more surprising. If the evidence cannot carry the message, tell the user before writing the script.

## Steps

Every step writes files in the project and ends at a gate. Do not start a step before the previous gate passes. If a step's file already exists, the user or an earlier run wrote it: read it, keep it, and continue from the first missing or failing step.

| # | Step | Writes | Gate |
| --- | --- | --- | --- |
| 0 | Brief | `brief.md` with its message, project skeleton | Brief, message, `STYLE.md` and every reference read |
| 1 | Research | `research.md` | Topic memo holds up; the message's reasons and every load-bearing claim are in the claim register as supported or conditional |
| 2 | Concept | `concepts.md`, `direction.md` | Three concepts that differ in their set pieces and key images, one chosen with reasons; direction spec with a colour script, in numbers, and what it takes from each reference |
| 3 | Script | `script.md` | Best of three drafts, three revision passes, word budget met, every claim tagged, the last sentence states the message |
| 4 | Beats | `beats.md` | The picture develops every 2–4 s through camera travel and action inside one world; a cut to another world only at chapter changes (typically every 10–30 s); the aha has the strongest image; an end card after the last word |
| 5 | Style frames | hook, aha and title scenes, `renders/frames/` | Three frames hold up next to the references at full size and thumbnail size |
| 6 | Build | `scenes/*.html`, `video.json` | `check` passes; every beat is on screen |
| 7 | Review | `renders/review/<n>/`, `process/review.md` | A pass at a new grid offset finds nothing left to fix; the contact sheet holds up next to the references; every measured flag fixed (only the end card may stand still) |
| 8 | Polish | `renders/polish/<n>/`, `process/polish.md` | Fresh eyes have looked at every still, close-up, cut and move and fixed what they found, in as many rounds as `polishRounds` sets; the last round is clean and `polish --accept` has recorded it |
| 9 | Render and hand over | `renders/<slug>.mp4` | The render's own numbers check out; the user has the MP4 and the Studio address and watches before anything else happens |
| 10 | After acceptance | `renders/thumbnail.png`, `report.md` | Thumbnail made; report written in the brief's language; working files cleaned up |

Read for each step:

- [references/production.md](references/production.md): file formats, checks and rubrics for every step.
- [references/storytelling.md](references/storytelling.md): editorial angle, claims, teaching design, narrative architectures, language and rubrics. Read before steps 1–4.
- [references/composition.md](references/composition.md): shots, worlds, transitions, pacing. Read before steps 2 and 4–7.
- [references/visual-devices.md](references/visual-devices.md): devices from reference films. Read before steps 2 and 4.
- The project's `STYLE.md` and `references/`: the look. Read before steps 2 and 5–7.
- The `superint-audio` skill: narration, timing from word timestamps, music, SFX and mastering. An explainer is voice-led: the picture follows the words.
- With the preset `miniature-3d`: the `superint-miniature` skill. Its scenes are one WebGL2 world with a camera instead of HTML scenes per shot; the steps stay the same.

**Critique loops.** Concept, script, beats, style frames and review each run at least two rounds, a third when the second still changed something substantial, at most five. Log each round briefly in `process/<step>.md`.

**Stops** this workflow knows (`new --stop concept,script,frames,contact`): `concept` after `concepts.md`, `script` after `script.md`, `frames` after the style frames, `contact` after the first review contact sheet. At each, show the result briefly and wait.

## Rules for explainers

- Facts come from the claim register in `research.md`. No invented statistics, quotes, sources or expert reviews.
- Sources stay out of the picture; they go into `report.md` and the video description, mapped to claim IDs.
- Length follows the voice. The target is a guide: never cut a film to hit it, never speed up the voice.
- The film ends on its message, then an end card while the music resolves.
