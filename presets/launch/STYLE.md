# launch: the product, rebuilt in code

The look of a product film that shows the real product: its interface rebuilt in code at its own pixel sizes, a dark ground around it, large plain lines, and an end card made from the film's last shape. Colour comes from the brand or from what the product shows; the frame around it stays quiet. The `superint-launch` skill plans the film; this file is only the look. A brand kit in `assets/brand/` wins over every token here.

## Palette

- Tokens live in `kit/theme.css`. The defaults are a grey ramp (ground `#0b0b0b`, page `#0e0e0e`, surface `#171717`, raised `#222`, lines `#303030`, borders `#777`, secondary text `#b4b4b4`, ink `#eee`) with ink as the only action colour.
- Replace them with the product's own: read its CSS or measure its screenshots. One accent at most, the brand's.
- Colour in the frame comes from the product's content (pictures, charts, the user's work in it), not from washes, gradients or glows added around it.
- The ground carries one soft light from above (`#181818` at the top centre falling to the ground colour); nothing else is lit.

## Type

- Geist for everything, JetBrains Mono for code, commands and file names. Another face only from the brand kit, shipped in `kit/fonts/` with its licence.
- A line alone: 104 px at 1080 p (`--line-size`), weight 640, line height 1.04, tracking −0.02 em, centred, at most 1500 px wide with balanced wrapping. Never under 70 px.
- The product's own text keeps the product's sizes (15, 14, 13 px …); the camera makes it readable. Push in until body text reads at 20 px or more on screen whenever the viewer must read it.
- End card: the name at 112 px, weight 650; one fact under it at 38 px in the secondary colour.

## The product on screen

- Rebuild each screen in a `.screen > .world` pair: the world is the product at 1920 × 1080 of its own pixels, positioned absolutely from measurements (the product's CSS, its DOM in a browser, or its screenshots), and a camera from `cameraAt` frames it. Real strings only; icons as simple strokes in the product's weight.
- Windows the film adds (a terminal, a dialog) carry a 1 px border in the line colour, 14 px corners and a soft shadow (`0 40px 120px rgb(0 0 0 / 55%)`).
- Show the product's real content in quantity: real files, real timelines, real numbers from real runs, pictures the product made. Nothing that stands in for content (grey boxes, lorem, sample numbers).
- What the product shows from other brands stays unreadable: hold a frame, crop or push past it.

## Depth

- Two planes: the plane that acts is sharp; a line is read over a soft picture. `soft(el, 1)` is 14 px blur and 45 % less light; a `.scrim` (a dark pool behind the line) keeps 3:1 contrast over bright content.
- Read soft, act sharp: the picture goes soft as a line arrives, and sharp again as it leaves, before the product acts.

## Motion

- Eases from `kit/launch.js`: `out` (quart) for entrances, `inOut` for moves and cameras, `in` (cubic) for exits, `snap` for presses and landings. No bounce, no overshoot on text or UI.
- Lines enter in 0.5–0.65 s and leave in 0.3 s; each line enters differently from the one before (`lineIn.blur` in pieces, `mask`, `wipe`, `scale`).
- A press is 0.12 s down to 97 % (a button that opens into a window squeezes to 88 %); release eases back.
- Cameras zoom on a log scale, one move per shot, front-loaded and landing. Holds creep at most 1.2 % a second; the end card creeps to the last frame.
- Handovers use `morphBox`: size on a log scale, the centre on a straight line or an arc; content never scales with its box (old content fades out over the first third, new content in over the last 40 %).
- Every time comes from the track's beat grid (`grid({bar})`), never from typed seconds.

## Don'ts

- No gradient washes, glows, glass panels, neon, sparkles or confetti; no decorative mono captions, fake metrics or version strings nobody reads.
- No accent bar beside a card, no outline boxes around lines, no underline unless it is the film's one signature.
- No other product's logo or rebuilt interface as a picture; a neutral terminal is fine, another app's chrome is not.
- No two scenes cross-faded; one scene leaves before the next arrives, or one element carries the change.

## Kit

| File | Holds |
| --- | --- |
| `kit/theme.css` | Tokens, Geist, the base page |
| `kit/launch.css` | JetBrains Mono, `.screen`/`.world` layers, `.free` elements, `.lines`/`.line`/`.mask`, `.scrim` |
| `kit/launch.js` | `fontsReady`, `eases`, `grid`, `span`, `keyed`, `cameraAt`, `applyCamera`, `toScreen`, `morphBox`, `place`, `soft`, `typed`, `lineIn`, `lineOut`, `cursorSvg` |
| `scenes/film.html` | A starter: the first line in pieces on the beat and the end card on the final chord |

The film this preset comes from, the launch film of Superint Video, is in the `superint-launch` skill's `example/` folder: the whole scene, its direction and beat grid, and how its music was cut to the film.
