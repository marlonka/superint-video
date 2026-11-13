# The renderer

No three.js, no assets. `scenes/engine.js` and `scenes/shaders.js` are a small WebGL2 renderer that works like film rendering before GPUs were fast: every film frame is rendered N times (N = the clip prop `samples`). Each subframe moves the lens on a disc (depth of field), each lamp to a different point of its area (soft shadows), the clock inside the shutter (motion blur), and the ambient light to one direction (ambient occlusion). The average gives the picture.

## One film frame

```text
E.renderFrame(t, story, {samples, shutter = .5/30})
  story.frame(t, E)                 once: powers, grade, mirrors, inner pictures, canvases
  aoEnabled = samples >= 24
  renderProbe(t, story)             if samples >= 24: a 256² cube per frame for reflections
  renderView(view, t, story, N, shutter)
    for s in 0..N:
      ts = t + ((s + .5)/N - .5) * shutter
      story.sub(ts, E, s, N, view)  set camera, move parts
      _renderSub                    shadows, AO depth, world, haze, add to the sum
  resolve(view, N, t)               bloom, film curve, grain, optional text mask
```

- `story.sub` also runs once with `N = 1` for the probe and once per subframe of every mirror or inner picture. Check `view` when something must differ there.
- Frame contract: a pure function of `time`. No state across frames except caches keyed by what they show (`if (key !== last) repaint`).
- A scene frame has a 15 s deadline and a render does not resume, so a slow frame kills the whole run.

## A project's skeleton

| File | Job |
| --- | --- |
| `film.html` | Canvas and `@font-face` rules |
| `main.js` | `defineScene`, prop `samples`, awaits fonts and `makeWorld`, then `W.render(time, props.samples)` |
| `story.js` | Creates the `Engine`, `rooms`, `lights`, room modules, `story`, mirrors |
| `set.js` or one file per room | `buildX(ctx)` builds geometry once and returns `{frame(t), sub(ts, s, N, t, eye, at)}` |
| `camera.js` | `K(t, eye, at, fov, aperture, focusOffset)` keys, `camAt(ts)` |
| `cues.js` | Generated: `WORDS`, `SCENES`, `PARAS`, `DURATION`, `FRAMES`, `FPS` |
| `kit.js` | `cue`, `cueE`, `lettersOf`, `rise`, `pulse`, `bump`, `part`, `many`, `pinUV`, `canvas`, `paperGround`, `wrap`, `neonText`, `textWidth`, `softDoc` |
| `props.js`, `paint.js` | Furniture and painted canvases |

`ctx` carries `{E, rooms, lights, add, light, softTex, ...}`. Rooms talk to each other through `ctx` (`ctx.pageBusy = t => ...`) and the camera imports their coordinates.

## Geometry (`Geo`)

State applies to everything that follows: `g.s({c, r, m, mat, tex, room, e, ao, grain, flag})`; `g.with(state, fn)` restores it afterwards; `g.at(pos, [rx, ry, rz], fn, scale)` nests transforms.

| State | Meaning |
| --- | --- |
| `c` | Hex (sRGB) or linear `[r, g, b]`. Stored square-root encoded, so dark tones keep precision |
| `r`, `m` | Roughness, metalness, 0..1 |
| `mat` | Material number, table below |
| `tex` | Texture layer from `E.addDoc`, or 200–203 for live textures |
| `room` | Room id. Lit only by that room's lights and ambient |
| `e` | Emission 0..64 (`c` × `e` × room power) |
| `ao` | Vertex multiplier for ambient light |
| `grain` | Wood grain axis 0 x, 1 y, 2 z; with flag 16 a pattern seed instead |
| `flag` | Bits below |

Flags: `1` alpha from texture, albedo becomes the texture's rgb where alpha > 0. `2` emission scaled by texture luminance. `4` multiply texture with `c`. `8` textured emission (screens, signs). `16` pattern in local coordinates, needed on anything that moves, or the grain flows through it. `32` shell: receives AO but does not occlude (walls, floors, ceilings). `64` clearcoat, a calm second specular layer on the smooth normal. `128` plank seams on wood.

Shapes, all around the local origin, normals outward:

| Call | Result |
| --- | --- |
| `box(w, h, d, faces = 63)` | Sharp box; `faces` bitmask front 1, back 2, top 4, bottom 8, right 16, left 32 |
| `rbox(w, h, d, bevel = .01, seg = 2)` | Rounded box. Use this for every thing near the lens: edges catch light |
| `lathe(profile, n = 32, a0, a1, crease = .6)` | Turned body from `[radius, y]` points; a kink above `crease` radians stays hard |
| `cyl(r, h, n, r2)`, `rcyl(r, h, bevel, n)` | Cylinders along Y, the second with rounded edges |
| `sphere(r, nu, nv)`, `torus(R, r, nu, nv, a0, a1)` | |
| `tube(points, r | r[], n = 10)` | Cables, pipes, lamp arms |
| `surf((u, v) => [x, y, z], nu, nv, uvf)` | Free surface, normals by finite differences (e = 1e-3); `uvf(u, v)` sets UVs |
| `sheet(w, d, nx, nz, uv)` | Flat grid in XZ, +Y normal |
| `card(w, h, uv)` | Upright quad in XY facing +Z, for what must be read |
| `rect(a, b, c, d, n, uv)`, `quad`, `tri`, `v` | Raw |
| `prism(outline, depth)` | Extruded counter-clockwise outline, no holes |

`smoothPts(P, k)` in `props.js` is a Catmull-Rom through points.

Upload:

- `E.addStatic(geo, room)` for what never moves. Culled per batch against the frustum, so build one `Geo` per room or area.
- `E.addDynamic(geo, room = -1)` returns `{set(m), visible, roomOv}`, one matrix per subframe. `part(E, room, fn)` is the shortcut and sets flag 16. A part with `room = -1` shadows in every room; `roomOv` moves it into another room while it travels.
- `E.addInstanced(geo, cap)` returns `{begin(), push(m, a, b, c), end(), visible, shadowRoom}`. `many(E, room, cap, fn)` is the shortcut. `a = [bendK, anchorX, waveAmp, wavePhase]` bends sheets into a cylinder piece, `b = [su, sv, ou, ov]` scales and shifts UVs (one atlas for all), `c = [texLayer | -1, room | -1, brightness, opacity]`. Call `begin … end` in `sub`.
- A `visible` that depends on the subframe gives real partial coverage: `part.visible = (s + .5) / N <= level` dims a neon letter or a lamp bulb without blending.

`M` in `m.js`: `M.trs(pos, [rx, ry, rz], [sx, sy, sz])` = T·RY·RX·RZ·S, `M.mul`, `M.T`, `M.RX/RY/RZ`, `M.lookAt`, `M.persp`, `M.invert`. Also `v3`, `lin(hex)`, `smooth`, `smoother`, `mix`, `clamp`, `hash`, `spring`, `sampleKeys(keys, t)` (monotone cubic, never overshoots).

## Materials

`MAT` in `geo.js`, code in `shaders.js` (the `if(mat==…)` chain in `FS_MAIN`). Every one is a formula on the world position, or the local one with flag 16.

| Name | What it does | Notes |
| --- | --- | --- |
| `plain` 0 | Colour only | |
| `wood` 1 | Boards from one log, rings as arches, pores | `grain` picks the axis. Keep `r` around .34–.42, add flag 64 for lacquer and 128 for planks |
| `parquet` 2 | Herringbone | |
| `paper` 3 | Fibre, slight bump, translucent to light from behind | `s.tr` |
| `checker` 4 | Marble chessboard | With a mirror plane at the floor |
| `foam` 5 | Acoustic wedges | |
| `brushed` 6 | Brushed metal | Set `m: 1`; `grain` picks the axis |
| `velvet` 7 | Sheen at grazing angles | |
| `poche` 8 | Black section hatch | For cut walls |
| `glass` 9 | Reflection and a tint; transparency by per-subframe dither, no sorting | |
| `fabric` 10, `plaster` 11, `leather` 16, `rug` 17, `brick` 21 | As named | |
| `screen` 12 | RGB pixel grid over a texture | Combine with a live layer and flag 8 |
| `wallA/B/C` 13–15 | Scallops, stripes, diamonds | Wallpaper |
| `street` 18 | Wet cobbles; reflects `E.live[3]` when `E.refl > 0` | |
| `sky` 19 | Night, moon, clouds, distant city | One card far behind everything, `flag: 32` |
| `drawer` 22 | Fine mottling for repeated fronts | Index cards, drawers |
| `fineWood` 23 | Wood at 6× the scale, for small things like instruments | |
| `steam` 24 | Veils that twist and thin out as they rise | A card that faces the lens; `v = 0` at the source |
| `pages` 25 | Edge of a book block | |
| `glaze` 26, `saucer` 28, `steel` 27 | Hero close-up: wavy coat, reflected cards, near-field hits (see `craft.md`) | Tied to `E.hero` |

New material: add a number in `MAT`, a function `matX(inout S s, vec3 p)` and a branch. `S` has `a` (albedo), `r`, `m`, `N`, `alpha`, `e`, `tr`, `sheen`. `bump(N, height, k)` turns any height formula into a normal.

## Textures: anything to read

- `E.addDoc(canvas)` returns the layer for `tex`. Canvases up to 1024 go into a stack of 62 small layers, larger ones into 48 big layers of 2048². **Every layer is square.** A non-square canvas is stretched to square and the UVs undo it on the card; paint at the card's aspect.
- Call `E.finishDocs()` once after all rooms are built; it creates the mipmaps. Add docs only before that.
- Text paint helpers: `canvas(w, h, fn)`, `paperGround(x, w, h, colour, seed)`, `wrap(x, text, maxW)`. Fonts must be awaited in `main.js`.
- Images: the scene runs in a sandboxed iframe, so an image from a URL taints the canvas and WebGL refuses it. Bake images as `data:` URIs into a module (`tools/bake_images.py` in the example) and load them with `new Image()`.
- Live textures change per frame: `E.makeLive(slot, w, h, srgb)` and `E.updateLive(slot, canvas)`, used through layers 200–203. Slot 0 is the picture in picture (undoes the film curve), slot 3 the mirror. Mipmaps are rebuilt per update, so repaint only when the content's key changed.
- **Real HTML in the world** (a screen, a letter, a newspaper, a sign): write it as HTML and let the browser set the type, instead of painting it into a canvas by hand. Put it into the film's canvas in `film.html` as a child that carries `drawable`, with its size in CSS pixels, and hand it to a live texture. Needs Chrome 157 or newer; the rules for such HTML (project pictures, what is cut off) are in `references/html-in-canvas.md` of the superint-video skill.

  ```html
  <canvas id="film">
    <div drawable id="screen" style="width:1280px;height:800px">…the page, with fonts, layout, <img>…</div>
  </canvas>
  ```

  ```js
  E.makeLive(1, 1280, 800);                       // once, while the room is built; the element's size
  g.with({ c: '#ffffff', mat: MAT.screen, tex: 201, flag: 8, e: 1.5 }, () => g.at(pos, () => g.card(.576, .36)));       // a screen that glows
  g.with({ c: '#ffffff', mat: MAT.paper, r: .85, tex: 201, flag: 4 }, () => g.at(pos, [0, a, 0], () => g.sheet(.32, .2)));   // paper lit by the room
  // in the room's frame(t): the HTML of this moment, then its picture
  clock.textContent = t.toFixed(1); E.updateLive(1, document.getElementById('screen'));
  ```

  `main.js` sees the `drawable` child and draws each frame once the browser has laid the HTML out; nothing else changes. Use slots 1 and 2 (0 and 3 are taken, see above). The card has the element's aspect. The HTML is flat colour: the world's light, the pixel grid of `screen`, depth of field and grain come from the renderer.

## Lights

`light(room, R, options)` in `story.js` adds a spot limited to the room's box. `add(l)` adds one without a box.

| Option | Meaning |
| --- | --- |
| `pos`, `dir` | Unit `dir`. A spot is a perspective shadow map, so `angle` ≤ ~1.45 |
| `angle`, `inner` | Outer and inner half angle in radians |
| `color` | Linear, any size: intensity falls off with distance², so a pendant at 1 m is about `[21, 16, 10]` |
| `range` | Far plane and fade |
| `size` | Radius of the lamp in metres. This is what makes shadows soft |
| `near`, `bias` | Shadow near plane, offset. Raise `bias` (.003) for small hero lights if acne appears, lower it (.0012) to keep contact |
| `haze` | Volumetric density, .001–.004. The room haze is one extra pass |
| `power`, `base`, `manual` | `setPowers` writes `power = base × roomPower` unless `manual`. A module's `frame(t)` runs after it, so `pendantL.power *= k` works there |

Limits: 8 lights per subframe. With more, each subframe takes the next 8 in turn with weight `count/8`. That works but costs samples: rooms that matter stay at 5–6 lights, and at least 256 samples for a shot with 30+. Shadow atlas 4 × 2 tiles of 2048. Lights only affect their own room; shadows come only from geometry in that room or with `room = -1`.

Rooms: `rooms[id] = {up, dn, fill, power, gloss, min, max}`. `up`, `dn` are ambient from above and below, `fill` a soft light from the front, `gloss` scales reflections. Ids run to 23. **Room 1 is special**, it is "outside" to the probe: rooms must have it. `E.setRooms(rooms)` once; `E.updateRooms()` after a power change.

## Reflections

Four kinds:

1. **Probe:** one cube per frame in the room the camera looks at, at `mix(cam.at, cam.eye, .35)`, box-projected. All glossy things read it. Needs `samples >= 24`. Rendered with highlights capped (`maxCol: 8`, uniform `uMaxCol`), because a lamp in the small cube is a few very bright texels that make polished metal pulse.
2. **Mirror plane** (lacquered desk, marble floor): render the world into a target with a mirrored camera, then let the surface read it. In `story.prepare`: `E.liveBusy = target.t; E.renderInto(mirrorView, target, t, story, 8); E.liveBusy = null; E.live[3] = target.t; E.plane.on = true; E.plane.y = Y; E.plane.soft = 1;`. In `sub`, `E.camera.mirrorY = view === mirrorView ? Y : undefined` and no aperture. A surface takes it only if its normal is up and it lies within 4 mm of `Y`, so give that surface exact height. `soft` .55 polished, 1 satin. Enable it only when the camera is near and above, since it costs a second pass.
3. **Wet street:** the same with `E.refl = k` and `MAT.street`, 5 subframes are enough.
4. **Hero near field:** analytic hits in `heroEnv`, for objects too close for a probe to see. See `craft.md`.

## Pictures inside the picture

`E._view(w, h)` and `E.makeTarget(w, h)`, then `E.renderInto(view, target, t, story, N)`. Set `E.liveBusy = target.t` during it so a surface doesn't read what is being written. `target.noVig = true` removes the vignette. For a world that shows itself, use two targets in turn. The film does 7 levels of itself at 8 subframes. Far views need more subframes when they hold transparent things: rain fell apart into dots at 16 and is fine at 72.

## Grading and final pass

`E.grade = {exp, sat, lift, gain, bloom, vig, fade, grain, ca}`, set per frame. Starting values: `exp 1, sat 1.06, bloom .055, vig .36, grain .02, ca 1.2`. A close-up of bright paper wants `bloom .012` and `exp .8`, or ink turns brown through the veil. `fade` goes to black.

`E.text = {mask, geo, cell, scroll}` with `E.setGlyphs(canvas)` and `E.setCode(bytes, cols, rows)` turns the picture into glyphs of the film's own code behind a moving edge: the device for "this is code". See `story.js` in the example.

## Other handles

`E.camera = {eye, at, up, fov, focus, aperture, near, far}`; `mirrorY`; set them in `sub`. Depth precision: keep `near` as far out as possible in wide shots: `E.camera.near = min(3, max(.02, (eye.z - 9) * .1))`. A 2 cm near plane at 60 m gave black zigzags in fine patterns. `E.hazeK` scales all haze (it should be near 0 right after a cut). `far` 340.

## Debugging

- `superint-video snapshot . --frames 45,200 --output renders/dev/x` is the main loop. Look at PNGs at full size.
- Set samples in `video.json` for the clip `film` (`tools/set_samples.py <n>`).
- `samples < 24` turns AO and the probe off: glossy things look wrong. Use 32 at least when judging.
- A black frame with `check` errors is usually a shader compile error: the message contains the log. Texture units: 0 shadow, 1–2 doc stacks, 3–6 live, 7 AO, 8 probe.
- An exception while building a room usually means `cue()` found no such word: `cue` throws on purpose.
