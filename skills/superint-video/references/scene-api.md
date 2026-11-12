# Scene API

```js
import {defineScene, interpolate, ease, spring, random} from '/runtime/scene.js';
```

`defineScene({props?, ready?, render(context)})` registers once per document.
`ready` is a promise for setup. `render` may be synchronous or return a promise.
Initialization and per-frame work have finite deadlines; keep these operations bounded.

Context:

```js
{
  frame: 42,                 // local frame INCLUDING sourceOffsetFrames
  time: 1.4,                 // frame * fps.den / fps.num
  fps: {num: 30, den: 1},
  preview: false,            // true in Studio's preview and false in snapshots, review and render: only for lowering sample counts while the user watches, never for changing what the film shows
  width: 1920,
  height: 1080,
  props: {title: 'Example'}   // defaults merged with clip instance values
}
```

Props:

```js
props: {
  title: {type:'text', default:'Scene', label:'Title'},
  size: {type:'number', default:120, label:'Type size', min:24, max:240},
  accent: {type:'color', default:'#c8ff5f', label:'Accent'},
  showValue: {type:'boolean', default:true, label:'Show value'}
}
```

A text prop the user sees on screen becomes clickable in Studio's preview: the user clicks it and types a new text, which goes into the clip's `props`. Mark the element that shows it with `data-prop`, so it is found even when the scene changes the words on the way (uppercase, a counter, a typewriter):

```html
<h1 id="title" data-prop="title"></h1>
```

```js
render({props}) { title.textContent = props.title; }
```

Without the mark, an element whose text is exactly the prop's value is found too. Text drawn into a canvas or WebGL cannot be clicked; it stays editable on the right of Studio.

**The film's font.** The user can give the whole film another main font (Studio: Film → Font; `superint-video fonts <dir> <family>`): one the film's files declare with `@font-face`, or one of the tool's library, which every scene gets through `/runtime/fonts/fonts.css` (Geist, Nunito, Jost, Fraunces, Courier Prime, JetBrains Mono, Caveat). Before each frame the runtime puts it into the `--font` CSS variable on `<html>`, ahead of the style's own `--font` as fallback, and loads all its faces; `context.font` names it (null while the style's applies). So:

```css
:root { --font: 'Geist', system-ui, sans-serif; }   /* the style's main font */
body { font-family: var(--font); }                 /* main text follows the film's choice */
code { font-family: 'JetBrains Mono', monospace; } /* a deliberate second role keeps its own */
```

```js
import {fontFamily} from '/runtime/scene.js';
ctx.font = `700 64px ${fontFamily('"Geist", sans-serif')}`;  // canvas, WebGL, SVG attributes
```

Measure and fit text inside `render`: a font change rebuilds the scene, and the new font is loaded before `render` runs, but not yet in `ready`.

`interpolate(value, inputStops, outputStops, {clamp=true,ease=ease.linear})` interpolates
between corresponding numeric arrays. Input stops must be strictly increasing.
Arrays must have the same length, at least two. Outside values clamp by default.

```js
const y = interpolate(frame, [0,24,100,120], [80,0,0,-40]);
const opacity = interpolate(frame, [0,16], [0,1], {ease:ease.outCubic});
```

`ease` exposes `linear`, `inCubic`, `outCubic`, `inOutCubic`, `outQuint`.
Easing functions take progress from 0 to 1.

`spring(time, {mass=1,stiffness=140,damping=22})` returns displacement toward 1 from 0.
Time is seconds, not frames. Time at or below zero returns zero.
Mass/stiffness must be positive; damping must be nonnegative.
The analytic solution handles underdamped, critically damped, and overdamped motion.
An underdamped spring can overshoot. Clamp values used for opacity when appropriate.

```js
const reveal = spring(time - 0.2, {stiffness:100,damping:20});
element.style.transform = `translateX(${(1-reveal)*100}px)`;
```

`random(seed, index=0)` returns a stable float in `[0,1)`.
It is stateless: asking for index 9 before index 2 changes neither value.
Use the same seed for repeatable arrangements; include frame in the index only for intended noise.

```js
const x = random('particle-x', particleIndex) * width;
```

**Review data.** `render` may return `{actors: [{id, x, y, w, h, target?}]}`: boxes in scene pixels for what `superint-video review` should check. Report every character, hero object and highlight on screen in that frame; `target` names the actor a highlight (frame, lens, ring) must enclose. The player maps the boxes through the clip transform. `review` flags an actor the frame edge cuts to a sliver (on screen, but less than 35 % of its box) and a highlight that leaves its target more than 2 px outside. A scene that returns no actors is not measured, and `review` says so.

```js
render({time}) {
  // ... draw ...
  return {actors: [
    {id: 'robot', x: 820, y: 400, w: 180, h: 220},
    {id: 'ring', x: 800, y: 380, w: 220, h: 260, target: 'robot'},
  ]};
}
```

Report a highlight from the moment it arrives until it leaves, not during its fly-in, and use the box as drawn (with its current scale).

**Check camera.** A scene that declares the number props `camX`, `camY` and `camZ` (`checkCameraProps` in the flat-explainer kit) can be shot in close-up with `review --camera x,y,zoom`: while `camZ` is above 0, the scene centres the point (`camX`, `camY`) at zoom `camZ` instead of following its own camera; at 0 it plays as authored. The point is in the scene's own coordinates: world units for a canvas world that draws through a camera, scene pixels for DOM and SVG scenes, which call `frameCheckCamera(props, width, height)` last in `render`.

Scenes run in opaque sandboxed iframes on the read-only preview server.
They cannot access Studio's document or mutation token.
Relative images resolve from the scene directory: `../assets/photo.png`.
Use `/runtime/scene.js` for the API module; no external CDN is required.

CSS transitions and animations must not run independently of the frame callback.
Paused Web Animations API animations may be set explicitly with `animation.currentTime`.
Do not use a second animation clock. Scene `<video>`/`<audio>` elements are rejected.

Player automation, after loading `/player.html?capture=1`:

```js
await window.__superint.ready;
await window.__superint.seek(42);
window.__superint.getState(); // frame, playing, durationFrames, propDefinitions, actors, errors
```

`actors` are the boxes the visible scenes reported for the current frame, in stage pixels, each with its `clipId`.

`seek` clamps to the project's first/last frame and pauses playback.
It awaits scene callbacks, assets, exact video decoding, and composition paint.
Use one completed seek per screenshot. Rapid interactive requests coalesce to the newest target.
Export uses the same function; it never skips requested output frames.
