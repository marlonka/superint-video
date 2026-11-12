# Production steps

File formats and checks for each step of the workflow in `SKILL.md`. Write working files in the brief's `language`; keep file names and section headings as shown so a later run (or another agent) can resume. Critique rounds go to `process/<step>.md`: what you found, what you changed.

## 0. Brief

`superint-video new` writes `brief.md`: frontmatter (preset, workflow, topic, seconds, format, size, fps, language, stops, concepts, narrationWords) and sections for topic, message, audience, must include, avoid, workflow, look, references, script, stops and notes. The user may edit it before you start. Read all of it, then the project's `STYLE.md` and every file in `references/`, so research and concepts already think in pictures this style can draw. Without references, ask the user once for stills of the look they want. If `## Message` still says TODO, write the message there from the user's request before research: one sentence, the position or insight the film argues (see `SKILL.md`, Message).

## 1. Research → `research.md`

Search the web and the material the user provided. Rules and rejection criteria: [storytelling.md](storytelling.md#evidence-rules).

```markdown
# Research: <topic>

## Topic memo
- Message the film argues (from the brief):
- Strongest supported reasons for it, strongest first:
- Main question the film actually answers:
- What an unprepared viewer probably assumes:
- The contradiction or unknown mechanism to explain:
- Best-supported answer:
- Decisive conditions and uncertainties:
- Strongest relevant counter-evidence:
- Why it matters to this audience:
- What stays explicitly outside the film:

## Claim register
| ID | Claim exactly as used | Source + location | Type | Scope | Uncertainty / counter-evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | … | Author, title, year, URL, page/table | measurement / experiment / model / review / opinion | population, place, period, metric, baseline | … | supported / conditional / open / cut |

## Teaching design
- One sentence to remember:
- Misconception and where the film breaks it:
- Aha and the image that triggers it:
- Order of ideas:
- Metaphors: maps correctly / false carry-over / where the film translates back

## Visual handles
- <the real people, places, objects and documents the film can show; scales, comparisons and processes that can be drawn>
```

Gate: the angle survives the rejection test, and every claim the film will use is `supported` or `conditional` (with the condition kept in the script). `open` and `cut` claims stay out of the film.

## 2. Concept → `concepts.md`, `direction.md`

Write the number of concepts in the brief (default 3). They must differ in how they stage the film, not in wording: different set pieces, key images and colour scripts. All of them show the real subject (its people, places, objects, money, maps); none is a symbol world the viewer has to decode, such as a river for wages or a dam for a tax. Each concept:

```markdown
## A: <name>
- Worlds: 2–4 per minute in order, one per chapter of the argument (a street of shops, an office floor, a port and its town, a map that becomes a landscape …). For each: how the camera travels through it, what the viewer sees on the way, which sentences play there and how the film moves into the next world.
- Key images: the 2–3 pictures that carry the message and the aha
- Colour script: one art direction for the film, the dominant hue family of each world and how it shifts (day to sunset, say); dark worlds only where the place is dark
- Cast: original characters who act in most shots (people, animals or creatures), with personality
- Tone and pacing: playful, epic, intimate or urgent
- Music and sound world: instruments and materials that fit the film
- Title treatment: how the title reveal looks and feels
- Risk: what could make it weak
```

Then `## Choice`: the winner (a grafted hybrid is allowed) and why it best serves understanding, surprise and the audience. Run the concept rubric from [storytelling.md](storytelling.md#rubrics) through the critique loop. With stop `concept`, present the concepts in a few lines each and wait.

**`direction.md`** is the production spec for the chosen concept, precise enough that another animator could build the film without asking. It opens with the colour script (set piece → theme world or background hex values, dominant hue, accents) and the cast sheet (each character with proportions, colours and how they move). No vague words ("nice glow", "pretty colors"); every element gets numbers: hex colors, sizes in vmin or px at the output size, counts, positions, gradient stops, parallax depths, rotation speeds, spring values, key light direction and idle motion. Example of the required precision (a film about coffee; yours will differ):

> Colour script: 1 farm at sunrise `.sky.sunset` · 2 hands at the bush, close-up, leaf green #1f9a64 on cream #fff6dc · 3 roastery `.sky.warm` · 4 counting ground `.sky.sunshine` · 5 port at night `.sky` with sodium lamps #ffc83d. Farm: three bush rows at parallax .35/.62/1.0, bushes r = 7 vmin from `blob`, red cherries r = 0.9 vmin, 40 per row; picker 22 vmin tall at (36 %, 64 %), basket on the hip, blinks every 3–4 s, reaches on "pflücken" (spring 120/14); key light upper left; foreground leaves at parallax 1.3 sway ±3° at 0.4 Hz.

The spec is revised together with the style frames in step 5.

## 3. Script → `script.md`

With a supplied script, keep its narration verbatim: add scene markers, beats and claim IDs, and ask before changing spoken words. Otherwise:

1. Choose a narrative architecture from [storytelling.md](storytelling.md#narrative-architectures) and write **three full drafts** in different architectures or angles, all fitting the chosen concept (keep them in `process/script.md`).
2. Pick the best, graft in the strongest lines of the others, then run the teacher, ear and cut-and-truth passes.
3. Fact-check every line against the claim register.

```markdown
# Script: <title>

[[scene:hook]]
<narration, spoken sentences only> {C1}
> on screen: <≤ 4 words, or nothing>
> visual: <what the viewer sees, one line>

[[scene:mechanism-1]]
...
```

- One `[[scene:<id>]]` per scene, ids in lowercase with hyphens. They become clip ids in `video.json`.
- `{C1}` tags link lines to claims; strip them before voice generation.
- Narration is written to be spoken: numbers, units and abbreviations written as they are said.
- Length: the spoken words match `narrationWords` from the brief ±10 %. Once a voice take exists, its duration decides: if it runs over the target length + 3 s, cut words; never speed up the voice to fit.

Gate: word count, section function test, every claim tagged. With stop `script`, show the narration and wait.

## 4. Beats → `beats.md`

One entry per sentence or visual event, as a precise timeline:

```markdown
## hook (0.0–5.2 s)
- 0.0 s: coffee farm at sunrise (`.sky.sunset`), pickers between the rows, slow push from 1.0× to 1.1×
- on "Bohne" (1.4 s): cut to a close-up of a hand opening a red cherry; two beans drop into the palm
- 3.0 s: whip pan to a café counter (`.sky.warm`); a cup slides into frame; on screen "Rohkaffee"
- SFX: soft pluck on the cherry, whoosh on the pan · Music: first chord on "Bohne"
```

Each entry names the trigger word, the set piece and its colour world, the camera, duration, on-screen text (≤ 4 words or none), SFX and music moment. Before narration timing exists, estimate times from the word budget; replace them with word timestamps once audio exists (the `superint-audio` skill).

Critique until:

- the picture develops every 2–4 s through camera travel, action and new subjects inside the world (not a new label in the same picture), while text holds still long enough to read;
- the picture shows what each sentence names, literally and in that sentence, and no object needs an explanation the film does not give;
- a world holds for a chapter, typically 10–30 s. Cuts to another world come only at chapter changes, and consecutive worlds differ in place and dominant colour. Never a new design every 5–10 s;
- the aha gets the most screen time and the strongest image;
- every change of world is motivated: camera travel into the next place, a character walking over, a match cut, a dive through a window, screen or document, a wipe or a soft crossfade (10–20 frames);
- every element has a planned entrance and exit;
- the last sentence states the message over its own image, and an end card holds 3–6 s after the last word while the music resolves;
- the picture adds what the voice can't (where and at what scale, how a state changes, the shared frame of a comparison, what is only a model, who is who across scenes) and does not spell out what the voice says.

Camera grammar that often works: the event happens on its word; pull back to show scale; dive in to make it personal; a live counter shows the consequence; escalate; a light character beat where the subject allows it; a visual callback to the opening; the end card. If a passage only works thanks to music or spectacle, rework its explanation.

## 5. Style frames

Build the look before animating everything. First the cast:

1. Copy `blocks/cast.html` into `scenes/` and fill in the film's characters from `direction.md`. Use `scenes/lib/people.js` (or the preset's own character library), never new stick figures.
2. Point a temporary `video.json` clip at the sheet, or use a separate lab project.
3. Snapshot one frame per page and judge them at full size next to the reference stills: proportions, faces, hair, hands, clothing details and turned heads. Fix the library before any scene uses a character.

Then build the hook, aha and title scenes first (custom scenes with `kit.js`, following `direction.md`), place them in `video.json`, and snapshot one settled frame of each to `renders/frames/`. Look at them at full size and scaled to 320 px wide, each next to the stills in `references/` at the same scale. Critique against the frame rubric, the `STYLE.md` frame test and pitfalls, and [composition.md](composition.md), as if pitching to the best studio you know; fix scene and `direction.md` together. With stop `frames`, show the three frames and wait.

## 6. Build → `scenes/`, `video.json`

1. Lay out the timeline: one clip per scene marker on the `scenes` track, `id` = marker, `startFrame`/`durationFrames` from the narration (word timestamps if available, otherwise the word budget). The clips fill `durationFrames` of the project without gaps unless a gap is intended. The project ends 3–6 s after the last spoken word: the message image, then an end card (`blocks/outro.html` re-skinned, or your own), with the music's final chord landing on it. A looping 9:16 short instead runs about 1 s past the last word into its first image.
2. For the remaining scenes, copy a block from `blocks/` (table in `STYLE.md`) under a meaningful name and change props, layout and drawing to match `direction.md`, or write a new scene. A film made of unmodified blocks looks generic.
3. Put on-screen texts and values into clip `props` so they can be edited in Studio, and mark the element that shows each text with `data-prop="<key>"`: the user can then click it in the preview and type a new one (`references/scene-api.md` in the superint-video skill). Sources do not go into scenes; they go into `report.md` (see `STYLE.md`, Type and labels).
4. Place audio clips if audio exists (the `superint-audio` skill).
5. Make the scenes measurable: `render` returns actors for every character, hero object and highlight (a highlight names its `target`), and scenes with a camera of their own declare the check camera (`checkCameraProps`). See `references/scene-api.md` in the superint-video skill.
6. `superint-video check <dir> --json`; fix every error before looking at frames.

## 7. Review → `renders/review/<n>/`, `process/review.md`

The first full build is a draft. Work on it in passes, going through the film every few seconds the way a top studio's director would, until a pass finds nothing. The CLI captures frames from the live project, so no render is needed until step 9.

**Passes:** run review passes as described in `references/review.md` of the superint-video skill (`superint-video review`, the worksheet, close-ups with `--camera`/`--crop`, strips with `--strip`, alternating `--offset`). For this workflow:

- Look at the contact sheet next to two references at the same size, then at every frame at full size. For every frame, ask: what would make this moment more beautiful, and does the picture explain what the voice says right now?
- Check every character and hero object while it is settled (staging: hands on tables rather than under them, props in the hands, signs above heads, far arms of turned figures).
- A sliver may stay only as a deliberate peek, written down with its reason. A static stretch may stay only on the end card; anywhere else it gets motion or a new shot, never a written justification.
- Run at least two passes and at most five. With stop `contact`, show the first contact sheet and its worksheet, then wait.

**Rubric:**

- **Reference test:** the contact sheet holds up next to the stills in `references/`: as full, as colourful, as clearly about something.
- **Real things:** every object reads as what it is at thumbnail size, nothing needs a legend to be understood, and nothing floats.
- **Flow and variety:** the picture develops every 2–4 s; the camera travels smoothly through a few worlds with one art direction; cuts come at chapter changes, not every few seconds. Check the contact sheet for channel-surfing: neighbouring stills from one chapter clearly belong to the same place.
- **Wow in every sequence:** each sequence has a moment that is beautiful to look at, with care in its details (secondary motion, small surprises, motivated light).
- **Nothing low-effort:** nothing looks copied or repeated. Repeated objects such as islands, shelves or crowds each get their own shape, details and motion.
- **Appealing characters:** clear silhouettes and expressive eyes that blink and look at what matters. Nothing looks spooky or broken. Poses and gaze lead the viewer to the focal point.
- **Highlights on target:** frames, lenses, rings and labels land exactly on what they mark and stay there until they leave.
- **No slivers at the edge:** an element is fully in the frame, peeks in on purpose with a readable part showing, or is out.
- **Clean exits:** nothing is left over from a previous beat, with no empty pills or half-faded text.
- **Thumbnail test:** every frame would pass as a top-studio frame at thumbnail size.
- **Light:** every solid object is shaded from one consistent light direction.
- **Clean colour:** no grey haze, blotchy blurs, glow boxes, washed-out bloom or muddy colour bands.
- **Composition:** no unintended overlaps, everything inside the safe area, one clear focal point.
- **Text:** legible at phone size, at most 4 words per label, no full stops.
- **Explanation:** the picture explains what the voice says at that moment.
- **Motion:** something moves in every frame; only the end card holds still.
- **Ending:** the message lands over its own image, and the end card holds 3–6 s while the music resolves.

These passes are yours as the author: composition, flow and the picture against the words. The cold look at how every object, cut and move is made comes next.

## 8. Polish → `renders/polish/<n>/`, `process/polish.md`

Before any delivery render, fresh eyes go through the film once more: every still at full size, close-ups, both sides of every cut and the fastest moves. They do it in as many rounds as the user set (`polishRounds`, 1 to 3), each round a new cold polisher after the one before. Follow `references/polish.md` of the superint-video skill; nobody has to ask for this step. For this workflow:

- The polisher redraws what is built wrong and adds the detail that is missing, in the scene libraries, so one fix reaches every scene. The script, the voice and the timing of the words stay.
- Judge against the stills in `references/` at the same size: a prop, an icon or a background that is simpler than theirs is a defect even when nothing in it is wrong.
- Check characters and hero objects settled and mid-move; the strips show the frames in between.
- With audio, listen to the mix against the picture on a draft render before this step (`render --quality draft`, then `superint-video listen`; see the `superint-audio` skill), so that nothing is left to check after the final render.
- The gate is `superint-video polish <dir> --accept` of the last round. To polish a film that is already delivered, run the same loop, then render under a new name.

## 9. Render and hand over

```sh
superint-video render <dir> --output renders/<slug>.mp4
```

- Do not overwrite an existing export unless asked; choose a new name.
- Read what the render reports: size, fps, frames, and with audio the loudness and true peak of the MP4.
- Then give the user the MP4 path and the Studio address, where the finished film plays (`superint-video studio <dir>` brings it back), and stop. They watch first: no thumbnail, report or cleanup yet.
- What they say after watching is a change like any other: fix it, run `polish` again (it lists only what changed), accept, render under a new name.

## 10. After the user has accepted

- **Thumbnail** `renders/thumbnail.png`: a hero frame readable at 160 px wide; actor, situation, scale or conflict recognizable at a glance; text (2–3 words) only if it adds a concrete piece of information. Take it from a snapshot of the strongest frame, or from a check-camera close-up of it (`review <dir> --frames <f> --camera x,y,zoom` saves the full-size frame in `renders/review/<n>/`), or build a dedicated `scenes/thumbnail.html` placed briefly at the end of a copy of the project and snapshot that.

**`report.md`**, in the brief's language:

- the message and the reasons the film gives for it;
- the chosen concept and why it beat the others; the winning script and why;
- key design decisions;
- for audio: measured integrated loudness and true peak;
- a YouTube title plus three alternatives that differ in substance (a precise question, a concrete consequence, a comprehensible contradiction), each with the question it raises, the moment the film answers it, and the risk of misreading;
- a description with the source list mapped to claim IDs;
- verification: what was checked (and how) and what remains unverified or not done;
- `## Making-of`: the paste-ready text described in the superint-video skill, with the real counts (claims in the register, scenes, frames, takes, music variants, SFX cues) and every model with its provider.

Then clean up as the superint-video skill describes, and tell the user the thumbnail and report paths.
