# Mechanics: the book, a spread and the paper kit

Everything here is in the project's `scenes/`. Read `popup.js`, `paper.js` and the sample spreads (`spreads/s02_stadt.js`, `spreads/s03_fluss.js`) once completely before the first spread of a film.

## The world

Metres, y up. The book lies on the desk, the gutter runs along z through x = 0. A page is 0.30 wide (x) and 0.236 deep (z); the far edge is z = -0.118, the near edge (towards the viewer) z = +0.118. The camera sits at +z and looks down at 25 to 40 degrees. The key light, a desk lamp, comes from the back left; shadows fall to the front right.

`world.js` builds the desk (`desk.js`, `deskprops.js`), the book (`book.js`) and the spreads (`spreads/index.js`), runs the camera and hands every subframe to the renderer. One film frame is 32 to 64 subframes with the camera, the lamps and the time a little apart: soft shadows, depth of field and motion blur come from that, not from post effects.

## The book

- `plan.js`: `LEAVES`, the number of leaves that turn. A book of N spreads has N - 1 leaves: the cover, the thin title leaf, boards, the back cover. `spreads/index.js` lists the spreads in order and checks the count.
- Spread 0 is the shut book (`cover()` in `s00_book.js`: leather picture on page 'R', its gold foil on page 'L', `S.raw = { L: true }`), spread 1 the title page with the marbled pastedown, the last spread the back cover (`back()`), which is the end card.
- `book.js` turns each leaf around the gutter line; the two stacks lean so both meet there. The thin title leaf bends while it turns (`THIN_LEAD`, `THIN_LAG`); boards turn stiff. Nothing in a spread is animated by hand: the opening angle of the pages drives every fold.
- A spread is painted when it comes into view and its sheets go into one of two texture banks of 20 layers of 2048 px; only two neighbouring spreads are ever in view. Pages take two layers, a fold panel of .29 × .19 m fills about one, small stands share. If `build` throws "needs N layers", make sheets smaller or lower their `res`.

## A spread

```js
import { Spread } from '../popup.js';
export function chapter(s, T) {
  const S = new Spread(s);
  S.plan = 20;                       // seconds it is planned to lie open; the voice replaces it with the real stay
  S.t = { haus: 4, wagen: 9 };       // named moments, seconds after it lies open; tools/after_voice.py sets them from words
  S.page('L', (x, W, H) => { ... }); // printed page, W = 300, H = 236 mm; the gutter is x = W on 'L', x = 0 on 'R'
  S.page('R', (x, W, H) => { ... });
  S.vfold(name, { ... });
  S.stand(name, { ... });
  S.flat(name, { ... });
  S.cam = t => [[tau, eye, at, fov, aperture], ...];
  return S;
}
```

`S.t` is one object that `world.js` updates in place once the voice exists, so closures that read `t.haus` see the voice's time. A spread whose sheets depend on its moments (a stack that grows to a word) builds them in `S.setup = t => { ... }`, which runs after the moments are known. `S.cam` may be a function of `t` for the same reason.

All painting is in millimetres with a 2D context `x`; y points down, (0, 0) is the sheet's top left. What stays transparent is cut away: the outline of what you paint is the outline of the paper. Only pixels above about 60 % opacity count as paper, so soft shadows a layer throws past its outline never become paper.

### vfold: a wall that stands up by itself

`S.vfold(name, { z, alpha, dir, wL, wR, h, beta, lock, amp, color, draw(x, W, H) })`: two panels glued to the two pages along lines through one point of the gutter. Flat when the book is shut, upright when it lies open.

- `z`: where on the gutter the fold's point lies (-0.105 far to +0.09 near).
- `alpha`: degrees between gutter and glue line, 74 to 84, always below 90 (at 90 and above the fold cannot stand). Larger is a flatter wall facing the viewer. Folds of one spread differ by 1 to 3 degrees, never equal.
- `dir`: +1 the arms come towards the viewer (a backdrop, concave); -1 they run away (a corner pointing at the viewer).
- `wL`, `wR`: panel widths in metres (at most .29), `h` height (at most .2; above .19 it touches the facing page when shut).
- `draw(x, W, H)`: W = (wL + wR) × 1000, H = h × 1000; the crease is at x = wL × 1000. Keep faces, signs and doors off the crease.
- `lock`: delay of its spring in seconds; `amp`: swing in radians (.07). `color`: the paper of its back.
- An invisible host (`draw() {}`, `h` .0016) carries stands that should stand on the page without a wall behind them: the example's title page does this.

### stand: a layer on tabs

`S.stand(name, { host, side, u, v, off, w, h, pivot, lock, amp, e, res, color, draw(x, W, H), life(t) })`: a flat piece parallel to one panel of its host fold, a set distance in front of it. Everything smaller than a wall is a stand.

- `host`: a vfold; `side` 'L' or 'R'. `u`: metres along the panel from the crease to the piece's left edge (negative on the left panel). `v`: metres above the page. `off`: metres in front of the panel (.0006 glued on, .03 to .12 a layer of its own).
- `w`, `h` in metres; `draw` gets them in millimetres. `res` 1.6 for hero pieces the camera gets close to. `e` makes it glow (.3 to .9), `life().glow` scales that.
- `life(t)`, t in seconds since the spread lies open (planned time), returns any of: `du`, `dv`, `doff` (slide along the panel, up, forward, metres); `rot` (in its plane around `pivot`, metres from its lower left, default bottom centre); `rx` (tilt around a horizontal axis at the height `pivot[1]`); `ry` (swing around a vertical hinge at `pivot[0]`); `lie` (1 lays it flat on the page in front of the host, face down; -1 back towards the host, face up; measured against the page, so it stays lying while the spread opens and shuts); `scale`; `glow`; `show`. It must be a pure function of t.
- A piece that stands up on its word lies flat until then (`rx` = π/2 - .02, or `lie`) and springs up: see `rise()` and `standUp()` in the example's `techkit.js` and `hall.js`.

### flat: a token on a pull-tab

`S.flat(name, { side, x, y, w, h, lift, pivot, e, color, draw(x, W, H), life(t) })`: a piece that lies on a page (`lift` .0005 m above it by default) and slides on it. `x`, `y` are page millimetres of its top left; its drawing is in page orientation. `life(t)` may return `dx`, `dy` (page millimetres), `rot` (around `pivot`, default its centre), `hop` (metres up), `show`, `glow`. A token that crosses other flats needs a higher `lift` than they have.

`S.spot(host, side, u, off)` returns `[x, y]` in page millimetres where a point of a fold or stand meets the page. Use it to print the ground exactly under what stands there: a street under a row of houses, a slot under a piece that rises, the channel a token runs in.

### A row on a slanted fold

On a fold with `alpha` below 90 the panel runs away at an angle, so a row of stands at one `off` would stand at different depths. To stand a row on one line of the page (z = `zb`), give each stand `off = (zb - fold.z - u · cos α) / sin α` (`OFF(u, zb)` in the example's `s01_titel.js`). Parts of one piece (a lamp, a plate, a plug on a machine) take the parent's `off` plus a hair, never their own: computed from their own `u` they slide behind the parent.

## The paper kit

`paper.js`: `layer(x, colour, shape, { lift, sh, shade, tooth, rule })` is one glued sheet; `lift` in mm (0 printed, .2 to .8 glued on, throws a small shadow). Shapes: `rect`, `rrect`, `circle`, `ellipse`, `poly`, `curve`, `blob`, `arch`, `ridge`; a shape with a hole uses `rule: 'evenodd'`. Also `inside(x, shape, fn)` to print inside a sheet, `stroke`, `text`, `para`, `textWidth`, `pageGround`, `wash`, `tone(hex, k)`, `blend`, `rgba`, `rnd(seed, i)`, `glueTab`.

`paperkit.js`: `person` (+ `bag`, `basket`), `tree`, `conifer`, `bush`, `cloud`, `bird`, `house`, `windowAt`, `bricks`, `awning`, `lampPost`, `wheel`, `van`, `bikeWheel`, `bicycle`. Things only one film needs belong in that film's own files (the example has `techkit.js`, `machines.js`, `hall.js`); things every film could use belong in the kit.

Fonts: Fraunces 600/900, Jost 500/700, Caveat 700, JetBrains Mono 400/700, Courier Prime 400/700, all loaded in `film.html` and awaited in `main.js`. A face drawn into a canvas must be loaded there, or the first frame shows a fallback.

## The camera

Keys `[tau, eye, at, fov, aperture, focusOffset]`:

- The cover and the title page: `CAM` in `timeline.js`, in film seconds (`T0(j)` is when leaf j starts to turn, `LAND(j)` when it has landed). A title page with a pop-up adds keys on its moments (`TIMING.moments['1']`).
- Every spread from 2 on: its own `S.cam`, tau in seconds after it lies open (negative while it rises). Without keys a spread gets a calm wide default.
- The end: `CAM_END` in `timeline.js` follows the book shut onto the back cover.

Start wide as a spread lands (`[0, .5, .68] → [0, .03, -.02]`, fov .52), move in to what the chapter tells (fov .38 to .46, aperture .003, distance .3 to .5 m), visit one or two more places on their words, return wide before the leaf turns. Eye height never below .11. Five to seven keys. A key that would run backwards is dropped, so keep keys in order (the example's `inOrder()`).

## Test frames

The film's own timeline runs on test seconds until the voice exists (the title page 4 s, every spread 20 s), so `snapshot` works from the first minute. For a spread on its own, `world.js` has development reels far after the film's end:

| Reel | Spread s opens at | Lands | Starts to close | Frame of second x after landing |
| --- | --- | --- | --- | --- |
| 1 | 1000 + 20 s | 2.7 s later | 16.5 s after opening | (1000 + 20 s + 2.7 + x) × 30 |
| 2 | 2000 + 40 s | 2.7 s later | 36.5 s | (2000 + 40 s + 2.7 + x) × 30 |
| 3 | 3000 + 60 s | 2.7 s later | 56.5 s | (3000 + 60 s + 2.7 + x) × 30 |

On the reels a spread's moments are its planned seconds. Check the rise (about 1.2 and 2.2 s after opening), the spread wide, every camera stop, every moment, and the close. A black frame or an error in the result usually names an exception in a `draw`.

Spread 2 on reel 1, rising, wide and 9 s after landing:

```sh
superint-video snapshot . --frames 31236,31350,31551 --output renders/dev/s02-a
```
