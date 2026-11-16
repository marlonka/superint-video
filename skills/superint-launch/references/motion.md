# Motion: principles, invention and the pre-flight check

Adapted from [motion-library-skill](https://github.com/ronkenx9/motion-library-skill) (the motion-library-skill contributors, MIT; snapshot `c743be7`): its principles, remix operators, technique families, sound measurements and pre-flight checklist. They come from breakdowns of 82 brand motion films (ffmpeg scene detection, EBU R128 loudness, onset analysis; the sound was measured, not judged by ear), rewritten here for HTML scenes and a `video.json` timeline.

Use this file twice: while you write the storyboard in `direction.md` (step 3), to choose each beat's move, and as the [pre-flight check](#the-pre-flight-check) before the style frames and again before the render.

## Ten principles, each with a test

| Principle | What it asks | The test | Measured |
| --- | --- | --- | --- |
| Continuity | Keep one thing constant (an object, a ground, the type, the camera) while the rest changes; the change becomes the message | What stays the same across this cut? If nothing, add a constant | 23 of 82 films cut at most 0.5 times per 10 s; they change content by moves and morphs |
| Clarity | One word, one control, one number on screen at a time | Can a viewer with the sound off say in three words what this shot is about? | |
| Restraint | Fewer things, held longer: small palettes, quiet mixes, long holds read as confidence | Remove one element. Is the shot worse? If not, leave it out | Median 1.85 cuts per 10 s (quartiles 0.5–3.9) |
| Contrast | The hero is the odd one out in colour, scale or light | Squint: is the brightest or most saturated thing the hero? | |
| Anticipation → payoff | Half a sentence, a delay, a cursor set up a question; the reveal answers it | What is the viewer waiting for at second 2, and when do they get it? | |
| Rhythm | A fixed template with one changing element; the break of the pattern is the payoff | Name the pattern. Where does it break, and is that break the point? | Fast montages (8–15 cuts per 10 s) only work under one type system and a strong grid |
| Character | Give the action an actor (a cursor, a status ring, a face) instead of letting the UI change by itself | Who is doing this? If the answer is "the UI", give it to an actor | |
| Concrete metaphor | An abstract benefit becomes a thing that acts | Is there a progress bar, spinner or plain check mark? Replace it with an object doing something | |
| Proof | Show the output, not the claim: real results, real typing, one number that moves | What in this frame would convince a sceptic? | |
| Sound on the key actions | Hit the 3–5 hero actions exactly; let the rest breathe | List the moments that must land on a hit. Does each have a real, designed sound? | 52.4 % of 1,710 cuts land within 70 ms of an audio onset, against 50.8 % by chance: brand edits do not lock every cut to the music |

## Invent, do not copy

References and the [directions](directions.md) show why a move works. Change every borrowed move with at least one of these before it goes into the storyboard, and write which one you used:

| Operator | What changes | Example |
| --- | --- | --- |
| Swap the actor | Who performs the move | A typed prompt is typed by a status ring instead of a hand |
| Swap the scale | Tiny and huge, inline and full frame | An icon inside a sentence grows to fill the frame |
| Make it literal | The metaphor becomes a prop | "Done" is a stamp landing, not a check mark |
| Reverse it | Run it backwards or end first | Open on the result, then take it apart to show how it was made |
| Constrain it | One take, one colour, one word | The whole film in one camera move; only the hero in colour |
| Combine two | Two families on the same beat | A pull back that is also the reveal of a gag |
| Move the medium | A UI move done by an object, or the reverse | A reply prints out of the laptop like a receipt |
| Give it a cost | Struggle before success | The pile wobbles before it sorts itself |

## Moves by use

Name each beat's use first (hook, feature, explainer, proof, end card), then take one or two families and run the operators.

**Hook.** Works by a question, a contrast or an unexpected actor in the first 1–3 s.
- *Typed text:* the cursor promises something; type at reading speed (2–3 frames a character), with a caret that blinks only while it waits.
- *Pull back to reveal the frame:* the content first, the context second (a world that turns out to be on a screen); one strong ease-out over 1–1.5 s.
- *Macro:* too close to name; the object is a landscape before it is a product. A long lens, shallow depth, a slow track.
- *Dark → light release:* a long dark hold, then the light; drive it by exposure (brightness), not by opacity.
- *Fixed line, one swapping word:* the fixed part teaches the pattern, the swap is the news; the line stays one layout and only the word changes on the beat.

**Feature.** Isolate one control or one result and give it a reward.
- *One UI element as the hero:* strip the app away; one control large on a quiet ground.
- *Push in until one item fills the frame:* the camera chooses; a scene-changing push runs at least 20 frames.
- *Match cut, one object through contexts:* the object stays, the world around it changes.
- *Inline object:* the object sits in the line at cap height, then grows to near full frame at an angle, sharp at both sizes.
- *UI on tilted planes:* 15–30° about the vertical axis over a soft ground; limit the tilt so type stays readable.
- *Confirmation as an act:* a small reward on completion that is an object doing something, never a bare check mark.

**Explainer.** One constant (a character, a shape, a layout), claim and proof alternating.
- *Continuous camera flight:* no cuts, eased through points of interest, the camera following an actor rather than a path.
- *Transition made from a scene element:* a shape already in the shot grows to cover the frame and reveals the next scene.
- *Exploded view:* parts lift apart along depth to show the one layer that does the work, then snap back whole.
- *Hold before the payoff:* 12–30 frames of a settled pose, the music a little lower, before the key reveal.

**Proof.** Volume or one moving number, never a claim.
- *Wall of real outputs:* many real results at once; one of them is the case the film followed.
- *Data beat:* one number that moves and lands on a round, true figure.

**End card.** Quiet and in steps; the last beat of the film, not a sticker.
- *Logo from the motif:* the shape the viewer has followed becomes the mark.
- *Bookend:* end where the film started, changed by what happened.
- *End-card steps:* name, then one fact, each with its own read, the mark held at least 1.5 s.

## Sound that holds up

Generic, dry, repeated sound effects are the clearest tell of generated motion. What 39 brand mixes measure like, and what to build:

| Measure | Brand median (middle half) | What to do |
| --- | --- | --- |
| Integrated loudness | −15.8 LUFS (−20.4 to −13.2) | A music-led film is mastered calmer than −14: `mix.json` with `"loudness": -16` |
| Peak to loudness | 14.6 dB (12.4 to 16.1) | Leave the hits their transients: a ceiling of about −1.5 dBTP; read `peakToLoudnessDb` in the `mix` report |
| Strong hits per 10 s | 8.6 (4.5 to 14.2) | Calm product films sit at 1–3, with long tails |
| A hit over what came just before | 12–15 dB | Duck the music 3–6 dB around hero hits (a `ride` with negative `db`) |
| Decay of a hit by 10 dB | 128 ms; calm films 400–1,100 ms | Hero tails of 300 ms or more; never cut a tail short unless the next sound covers it |
| A silence mid-film | One in three films; often right before the reveal | One real silence of 0.3–1 s before the biggest reveal |

- **Layer every hero hit** on the same frame: a transient (a click or snap, 0–10 ms), a body with pitch and weight (30–200 ms) and a tail (room, shimmer, 0.3–1.5 s). A low layer under 80 Hz only on the 3–5 biggest moments. In `sfx.json` the second and third cue of a hit carry `"layer": true`.
- **One room for all of them:** a shared room on the sound-effect track (`"room"` in `mix.json`), so every effect sounds recorded in the same place.
- **Vary what repeats:** 3–6 takes for any repeated action, rotated; one take used at most about four times in 30 s.
- **Tune the tonal hits** to the key of the music under them.

## The pre-flight check

Run it on the storyboard before the style frames, and again on the review sheet before the render. Every item is a yes or a no.

- [ ] **Hook:** frame 0 shows content, and the first second has one signature move (anticipation, fast action, overshoot, settle); nothing fades in from an empty ground.
- [ ] **One constant:** every change carries something you can name.
- [ ] **One idea per beat**, and the beat's use named.
- [ ] **The hero is the odd one out** in each frame (squint test).
- [ ] **Setup and payoff:** the viewer waits for something by second 2 and gets it.
- [ ] **Actors drive the UI:** every press, send or choice is made by a visible actor or user; an action that sends something shows the approval first.
- [ ] **No progress UI as a story beat:** no bare progress bar, spinner or check mark; a result or an object doing something instead.
- [ ] **New hero objects enter inline** or at the centre of attention with space around them, and grow at an angle; never as a speck in a corner.
- [ ] **Readable:** each line holds at least 0.8 s after it has landed; a scene-changing push runs at least 20 frames; a beat that cannot be read gets whole bars more, never a squeeze.
- [ ] **Safe zones:** nothing moving crosses a line while it is read.
- [ ] **Depth is real where things move in depth:** a card that turns has thickness, light that changes with its angle and a shadow that follows it; nothing flat pretends to be 3D at full size.
- [ ] **Sound:** the 3–5 hero actions have layered sounds on the exact frame; one silence before the biggest reveal; one shared room; repeated sounds vary; the mix report shows 12–16 dB peak to loudness.
- [ ] **Originality:** each borrowed move is changed by a named operator.
