---
name: superint-miniature
description: Make films in the code-rendered miniature look with Superint Video - a photographic world computed entirely in code by its own WebGL2 renderer, with true depth of field, motion blur, soft shadows, reflections and film grain; rooms of a cut-open building at night, objects that act by themselves, no people, one continuous camera journey synced to the voice's word times. Use with the superint-video and superint-explainer skills when the user wants a film like "Videos aus Code", a 3D, photoreal, miniature or model-set look, or the preset miniature-3d. Holds the renderer's API, modelling and light recipes for photographic close-ups, the production order, render times and every known trap.
---

# Code-rendered miniature

Read the `superint-video` skill first, then the workflow skill (usually `superint-explainer`), then this one. This skill replaces the 2D drawing part of a production: the scenes are one WebGL2 canvas and a world built in code, with a camera that travels through it. Research, message, concepts, script, beats and review work as in the workflow skill.

The film this comes from is in [example/videos-aus-code/](example/videos-aus-code/): every room, the voice, the sound tools. Read a room there before building something similar. It shows how things were solved; it is not a template for the next film's ideas.

## Start

```sh
superint-video new --preset miniature-3d --workflow superint-explainer --topic "<topic>" --message "<the one sentence>" --seconds 180 --language de
```

The project starts with one finished room: a study with a desk, a photographic coffee cup, a metronome, a pull-back from close-up to room (`scenes/set.js`, `scenes/camera.js`). It renders right away, so you can see the quality bar before you change anything. Replace the room, the hero and the camera with what the film needs. Keep `engine.js`, `shaders.js`, `geo.js`, `m.js`, `kit.js`, `props.js` and `paint.js`, and extend them when a film needs more; a project owns its copy.

The look contract is the project's `STYLE.md`, the yardstick is `references/`.

## Which file for which step

| Step | Read |
| --- | --- |
| Concept, script, beats, sound, order of work, render | [references/film-recipe.md](references/film-recipe.md) |
| Building anything: engine, geometry, materials, lights, mirrors, screens | [references/renderer.md](references/renderer.md) |
| Making it look real: hero shots, props, light, what went wrong before | [references/craft.md](references/craft.md) |
| A concrete solution: typewriter, neon sign, rain, film strip, card index, self-showing monitor | [references/film-recipe.md](references/film-recipe.md#what-is-where-in-the-example), then that file in the example |

## What makes this look work

1. **One place, one journey.** Rooms of one building (or ship, or machine) that the camera travels through. Each room is a real trade or step of the topic, with its own colour. That gives the film a map the viewer learns.
2. **The opening holds up as a photograph.** Viewers decide in the first seconds. Build the first close-up against a real photo of such an object, at full size, and work down the differences. If the user sends a reference image, it is the measure. The recipe is in `craft.md`.
3. **Everything happens on a word.** The voice comes first; every camera key and every mechanical action is `cue(paragraph, 'word')`, never a typed second. A wrong word time shows immediately, so fix it there, not in the scene.
4. **The world acts, nobody is in it.** No people drawn in code. Typewriters, valves, stamps, lamps and rails do the work, and they are built so a viewer can see how they would work.
5. **Real things in real units.** Metres. A desk top at .76. A cup 8 cm high. If the numbers are real, the light and the depth of field behave.
6. **Detail with a reason.** A room earns wow through what stands in it and why: every prop belongs to that trade. Dim and calm behind, sharp where the voice points.

## Rules from the people who watched the films

These came from feedback on real renders. They hold unless the brief says otherwise.

- Never put the user's prompts, dictated words, feedback, audience description, working hours or rate limits into a film: not in the voice, not on screen, not in on-screen source code, not in baked contact sheets. Anything baked from an earlier render can carry old text, so rebake and search before the final render. Saying that the user spoke a brief into a microphone, and what the task was in your own words, is fine.
- Nothing that looks like style sheets from other channels' films.
- No people or faces in code, and the cast stays open. Images of people quoted from older films follow the same casting rules as new ones.
- Music and SFX far under the voice. The mix is judged by `listen`, not by feel.
- Lines look joined, objects grounded, cards readable. A cable leaves through the back of a plug. A diagram shows every part the sentence names. Nothing on screen anticipates a metaphor the voice has not made yet.
- Spoken bridges at chapter turns, real pauses, no kids' feel, no source footnotes in the picture.
- End on the message, then an end card.
- A real company's logo (Claude's mark is Anthropic's) may refer to that product where the film talks about it; it never suggests an endorsement. The preset ships no logos.
- After the render, hand over and stop: report, thumbnail and cleanup wait until the user has watched and accepted.

## Production time, so you can plan

| Item | Number |
| --- | --- |
| One film frame at 64 samples, measured on nine frames of "Videos aus Code", 1 browser, without capture | .13–.33 s, on average .21 s, 3.3× faster than 256 |
| Full film as measured on "Videos aus Code": 6:25, 11 550 frames, 64 samples, x264, `--workers 2` on an RTX 5070 Ti | 33 min (1973 s), on average 0.17 s per frame |
| One film frame at 256 samples, simple room, 2 browsers | .3–.5 s |
| One film frame at 256 samples, heaviest shots (64+ lights, picture in picture) | 1–2 s |
| Full film as measured on "Videos aus Code": 6:18.5, 11 355 frames, 256 samples, x264, `--workers 2` on an RTX 5070 Ti | 1 h 50 min (6586 s), on average 0.58 s per frame, 348 MB. More browsers only cost memory, 3.3 GB each |
| `check` over a film at 32 samples | about 4 min for a 6-minute film |
| `snapshot` of two frames at 128–256 samples | about 8 s |
| Rooms | a room with action takes a long session of code (200–500 lines); plan chapter rooms before writing them |

Develop at 32 samples, judge looks and render at 64. Time is almost proportional to the sample count. What 64 gives up is small: a few glints on polished metal and very fast motion differ from 256. Keep the machine awake during a long render (see `film-recipe.md`), and never change `scenes/`, `video.json` or `audio/` while it runs: there is no resume.
