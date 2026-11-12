# flat-explainer: art direction

Rich, colourful flat-vector illustration in the spirit of the best animated science channels: real places and things, characters who act, cel-shaded shapes, bright colour worlds. The picture explains; text only labels it.

This file is the look contract for this project: shapes, light, colour, characters, type and motion. How the film is planned, paced and cut comes from the workflow skill (for explainers `superint-explainer`, whose `composition.md` was written for this look). Read this file before writing scenes, and follow it unless `brief.md` says otherwise. `direction.md` makes it concrete for one film: the set pieces, the colour script, the cast and the numbers, within these rules.

## The frame test

Every frame has to hold up next to the stills in the project's `references/`: as full, as colourful, as clearly drawn and as obviously about something. A frame that would look empty, dark, abstract or unfinished beside them is a defect, however clean it is. Without references, ask the user for some (screenshots of the films whose look they want).

## Shots

- **Grounded.** Everything that does not fly stands on something: houses on their ground, people on floors, machines on tables, a skyline on its horizon. Nothing floats in empty space unless the scene is in space or under water.
- **Readable subjects.** A subject that carries a statement is at least 6 vmin (60 px at 1080p) tall; otherwise move the camera in or open an inset. Counting icons are at least 2.5 vmin, grouped in blocks of 10 or 100 on a bright, contrasting ground, with a legend.
- **Full frames.** Every set piece is dressed in foreground, middle ground and background: props, windows, plants, papers, tools, small background stories. Hero objects get 3–6 meaningful details and secondary motion; background details are smaller and calmer, but present. An empty area is a decision (open sky, space), never a leftover.

## Colour

- **One art direction, a colour script along it.** The whole film shares one look: the same ground and horizon style, light direction, shading, characters and palette backbone (`theme.css`). Each world has its dominant hue family, chosen for its place and mood: sunny yellow for numbers and diagrams, warm orange interiors, green land, cyan water, a pink-to-gold sunset, red alarm, violet night.
  - Colour shifts with the story: gradually within a world (day turns to sunset while the camera travels) and clearly between chapters.
  - It never jumps to a new palette every few seconds.
  - Write the colour script into `direction.md`: world → dominant hue, background hex values, accents, and how it shifts.
- **Bright by default.** Most set pieces have light or saturated backgrounds (sky, sun, walls, paper). Dark set pieces are the exception, used only where the place is dark (night, space, deep sea, inside a machine). There, saturated light sources and neon accents carry the frame, and a lit area shows the subject.
- **Accents.** Two to four saturated accents per frame are fine, as long as the focal object has the highest contrast. A recurring concept (the money, the tax, a company) keeps its colour across the whole film.
- **Theme worlds.** `kit/theme.css` ships backgrounds for the `.sky` layer: `.sky.day`, `.sky.sunshine`, `.sky.sunset`, `.sky.warm`, `.sky.meadow`, `.sky.sea`, `.sky.mint`, `.sky.alarm`, and the plain `.sky` for night. Bright set pieces use `.vignette.soft`; the strong `.vignette` belongs to dark ones.

## Shapes and light

- **Shapes:** rounded geometric primitives, rounded blobs (`blob`) and thick rounded strokes. Zero outlines around filled shapes, no gradients on objects, no drop shadows, no photos, no emoji, no AI images, no stock assets: everything is drawn in code. Organic edges are smooth curves, never raw polygons. Clouds are clusters of circles on a flat base, not capsules.
- **Light and shading:** one key light per set piece from a motivated source, by default upper left. Every solid object has three tones: base, a hard-edged shadow side away from the light, and a thin rim light on the lit side. `orb()` does this for spheres and `cel()` for any other shape; use them on everything.
- **Glow:** only real light sources glow (sun, lamps, screens, fire, neon, bioluminescence), plus the faint atmosphere halo of `orb({glow: true})`. Glow is tight stacked translucent discs, never blur filters, boxes or bloom that washes out small lights.
- **Focus:** one clear focal point per frame, and it is the highest-contrast thing in it.
- **Depth:** 3–4 layers per set piece: far background, mid scenery, the focal subject, and a foreground (props, leaves, dust, bubbles) that frames it. Parallax by moving layers at different speeds.

## Characters

- Most shots have someone in them: people for human topics (workers, a minister, founders, an official, customers), animals or small creatures for natural ones. They are original and built from rounded shapes with cel shading: shoulders, two arms with hands, a face with eye highlights that blink and look at what matters, a mouth that shows the mood. They act on their word: point, carry, sign, pack, run, react. Squash and stretch on every pose change, and an idle breath or bob.
- Build people with `scenes/lib/people.js` (`person(parent, opts)` → `update(state)` returns `{hands, head, box}`), never with new ad-hoc stick figures. It already holds the bar the user set ("they must not look drawn by children"):
  - **Proportions:** stylised, not stock avatars. The head is about 1.3× a realistic head, legs are short, the torso is pear-shaped. Children use `child: true`, their own build, not shrunken adults.
  - **Face:** organic skull with jaw, ears and neck; dot eyes with catch lights; brows; a soft nose wedge; blush; a mouth that shows the mood.
  - **Head turn:** `turn` shifts the features and narrows the far eye.
  - **Hair and hands:** big hair masses; mitten hands with fingers.
  - **Clothes and light:** clothes carry details (collar, tie, lapels, hood strings, reflective vest, apron, pen, soles). A form band shades every part, plus a fringe shadow on the forehead and a contact shadow at the feet.
- Give every character an identity in `opts` (hair style and colour, skin, top, headwear, glasses, moustache, apron or vest) that fits their job, and keep it the same character across scenes.
- Start the cast in `blocks/cast.html`: the film's characters lined up, plus their poses, heads and walk. Judge it at full size against the reference stills before any scene uses them.
- Props a character holds hang on `update().hands`; things at the face use `head`. Never place them by guessed coordinates.
- Staging with furniture: a person behind a counter or table has the top at hip height and the hands on it (`type`, `hold`), never under it. A pose whose hands disappear behind furniture is the wrong pose.
- In a 3/4 turn the far arm goes behind the body when it hangs or reaches out to its own side; hands that come to the face or chest stay in front. The rig does this; don't override it with layering of your own.
- A pose change needs at least 0.5 s on screen before the next cut. A gesture that starts a few frames before a cut reads as a twitch: let the face react instead.
- Never characters, mascots or logos from existing channels or brands. Brand characters only on the user's explicit request.

## Type and labels

- Nunito 800–1000 only, accent word marked `*word*`. Labels ≤ 4 words; captions and headlines ≤ 7 words; at most one statement sentence (≤ 10 words) per set piece, and at most two labels at once. No full stop at the end of on-screen text, no paragraphs, no bullet lists, no all-caps sentences (kicker labels only). Text never repeats the narration word for word.
- Names of places, groups and things sit in saturated tags (`.tag`, magenta or `.tag.violet`) with white type, on or next to what they name. Values stick to their object or to a counter in a fixed corner.
- Numbers carry a unit and count up (`count`). Sources stay out of the picture: the full list goes into the report and the video description, mapped to claim IDs. On screen a number gets at most a short tag when the viewer must know what kind of number it is ("Szenario", "Schätzung", "Bitkom 2026").

## Motion

- Nothing pops on hard. Everything enters with `enter()` (spring) or `between()` (eased), and staggered by 0.05–0.12 s. Text reveals word by word or line by line; it never fades in as a whole.
- Every shot moves: the camera drifts or travels, characters act, and ambient motion (wind, water, steam, blinking, machines) never stops, so no frame is frozen for more than 0.5 s. Text itself holds still for at least 1.5 s after it lands.
- One motion idea per beat: reveal, then hold. Events happen on their word (±2 frames once word timestamps exist).
- Camera moves ease in and out; zooms interpolate in log space (`zoom.html` shows how). Anything crossing the frame (a front, a wave, a beam) speeds up toward its target so no sweep drags.
- Every element has an exit: when its beat is over it leaves, and nothing lingers into the next idea.
- Every animated value comes from `time` or `frame`. No CSS animations, no `Math.random()`, no state that accumulates between frames.

## Blocks

Copy a block from `blocks/` into `scenes/` under a meaningful name, then adapt its props or its code. Blocks are mechanics, not looks: re-skin each one into its set piece's colour world and dress it. `scenes/title.html` and `blocks/outro.html` default to a space look; replace that with the film's own first and last set piece. Every block works at 16:9, 9:16 and 1:1.

| Block | Use for | Key props |
| --- | --- | --- |
| `scenes/title.html` | Hook / title card with a ringed planet | `kicker`, `title` |
| `blocks/statement.html` | One key sentence, accent word underlined | `kicker`, `text`, `accent` |
| `blocks/number.html` | One striking number counting up inside a dot ring | `value`, `decimals`, `prefix`, `suffix`, `label`, `source`, `accent` |
| `blocks/compare.html` | Two quantities as spheres with honest areas | `caption`, `leftLabel`, `leftValue`, `rightLabel`, `rightValue`, `unit`, colors |
| `blocks/steps.html` | A process in 2–4 steps along a drawn path | `caption`, `step1`…`step4`, `stepSeconds` |
| `blocks/zoom.html` | Zoom through 2–4 levels of scale | `level1`…`level4` as `Name \| detail`, `hold`, `travel` |
| `blocks/swarm.html` | One among many: particles with one highlighted | `caption`, `label`, `count`, `accent`, `highlightAt` |
| `blocks/chart.html` | A trend drawn as a line with the end value | `caption`, `values`, `startLabel`, `endLabel`, `unit`, `zeroBased` |
| `blocks/outro.html` | End card: takeaway over a rising horizon | `kicker`, `text`, `sign` |

Text props accept `*word*` for the accent color. Times inside a block are seconds from the clip start (`time`), so retiming a clip in Studio never breaks its choreography.

## Kit (`kit/kit.js`)

| Function | Purpose |
| --- | --- |
| `fontsReady` | Pass as `ready` so the first frame uses Nunito |
| `once(build)` | Build layout on the first frame from `context.width/height` |
| `fitSvg(svg, w, h)` | viewBox in output pixels; returns `{w, h, u, portrait}` (`u` = 1 vmin) |
| `enter(time, at)` | Spring 0→1 starting at `at` s (overshoots) |
| `between(time, from, to)` | Eased 0→1 |
| `visible(time, in, out)` | Fade in and out |
| `rise(el, p)`, `pop(el, p)` | Apply a progress to an element |
| `drift(stage, time)`, `bob(seed, time)` | Camera drift and floating |
| `splitWords`, `revealWords` | Per-word text reveal with `*accent*` |
| `fitText(el, {max, width, lines})` | Shrink long text to fit (vmin) |
| `count(p, from, to)` | Locale-formatted counting number |
| `el(tag, attrs, parent)` | Create SVG elements |
| `orb(parent, {r, fill, ring, glow, bands})` | Flat-shaded sphere / planet |
| `cel(parent, d, {fill, size, light})` | Shadow side and rim light for any path; returns `{g, set(d)}` |
| `blob(seed, r, {wobble, t})` | Organic shape path (cells, islands, clouds) |
| `starField`, `twinkle` | Background stars |
| `drawable(path)`, `draw(path, p)` | Draw a stroke progressively |
| `color(name)`, `shade(hex, amount)` | Theme colors and tone steps |
| `checkCameraProps`, `checkCamera(props)`, `frameCheckCamera(props, w, h)` | Check camera for `review --camera` close-ups: spread the props into `defineScene`, draw through `checkCamera` (canvas worlds) or call `frameCheckCamera` last in `render` (DOM and SVG) |

## Don't

- One palette for the whole film, or a film that stays dark because its first scene was.
- Unexplained shapes: a pale disc that reads as a ball, a band with a dashed centre line that reads as a road, houses floating without ground.
- Source lines, footnotes and lists of assumptions in the picture.
- Stock-photo realism, 3D renders, glossy gradients, glassmorphism, lens flares.
- Decorative effects or static infographic strips that explain nothing.
- Text that repeats the narration word for word. Show the idea; label it with a few words.
- Changing a recurring concept's colour mid-video.
- Faces or mascots copied from existing channels. Invent your own characters.

## Pitfalls

Each of these has spoiled real frames. Check them in every review.

- **Misread shapes:** check every shape at thumbnail size: does it read as what it is? A dashed line inside a band reads as lane markings, a plain disc as a ball, a thick stroke as a stick.
- **Floating:** an object whose ground disappears into the background (houses on dark hills against a dark sky) floats. Give it a lit ground or a contrasting silhouette.
- **Tiny statements:** a subject under 6 vmin, or a field of dots too small to read, carries no statement.
- **Grey haze:** large semi-transparent or blurred shapes read as grey blotches. Use crisp flat shapes and tight glows.
- **Mud:** two saturated hues blended or overlapping at low opacity (coral over green) turn brown. Blend through a related hue, such as violet dusk.
- **Greyed highlights:** a normal-blend dark overlay dulls bright colors. The `.vignette` multiplies; keep it that way.
- **Hooks on light sources:** loops, prominences or thin details on the edge of a glowing body read as white hooks. Keep glowing edges clean.
- **Collisions:** labels or icons placed by angle land on the light source, the focal object or other text. Check positions in screen space, at every format.
- **Leftovers:** elements from an earlier beat still visible, or empty pills after the text left. Shrink containers away within 0.35 s of their text.
- **Mid-motion ugliness:** endpoint frames look fine while the transition midpoint overlaps or clips. Review transition midpoints, not only settled frames.
- **Slivers:** a camera move leaves a character as a thin strip at the frame edge, which reads as a mistake. Keep it fully in, let it peek with a readable part, or move it out. Report actors so `review` measures this.
- **Covered signs:** a sign at head height of people walking past is hidden half the time. Signs that carry the message stand above heads, like a gate.
- **Hands under the table:** characters behind furniture with their hands below the top look like they are hiding them. Raise the character or change the pose.
- **Attached arms:** after a rig or pose change, check close-ups (`review --camera`) of turned figures: a far arm whose shoulder cap sits on the torso looks stuck on.
- **Missed targets:** a frame, lens or ring a few pixels off its label reads as sloppy. Report highlights with their `target`.
