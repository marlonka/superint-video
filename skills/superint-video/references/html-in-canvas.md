# HTML in a canvas

A canvas can draw real HTML. The children of a `<canvas>` that carry `drawable` are laid out by the browser like any HTML (text, fonts, flex and grid, SVG, form controls, CSS filters and masks), but they appear only where the scene draws them: in a 2D canvas, or as a WebGL texture that a shader bends, lights, blurs and cuts. So a scene no longer chooses between real type and layout on one side and shader effects on the other.

**Use it when** a picture needs both: the product's interface on a plane in space with true perspective and depth of field, light or a lens passing over a page, a shader transition between two real screens, a ripple, a shatter, a pixel sort, the same card drawn twenty times, a real screen, letter or newspaper inside a 3D world.

**Do not use it** for what CSS does by itself (move, scale, rotate, fade, `filter: blur()` on an element). Plain HTML is simpler, costs nothing per frame, and its text props stay clickable in Studio's preview.

It needs Chrome 157 or newer, where it works without a flag. `check`, `snapshot` and `render` stop with a message that says so when the rendering Chrome is older; Studio's preview in an older browser shows the HTML plain, without the effect.

## The pattern

```html
<canvas id="stage">
  <section drawable id="page">
    <h1>Real HTML</h1><p>Frame <span id="count"></span></p>
    <img src="../assets/photo.jpg" alt="">
  </section>
</canvas>

<script type="module">
  import {defineScene, interpolate} from '/runtime/scene.js';
  import {htmlCanvas} from '/runtime/html-in-canvas.js';

  const stage = htmlCanvas(document.querySelector('#stage'));
  const page = document.querySelector('#page');
  const ripple = stage.shader(`
    uniform sampler2D page;
    uniform float strength;
    void main() { color = texture(page, uv + vec2(0., strength * sin(uv.x * 40.))); }`);

  defineScene({
    ready: stage.ready,
    async render({frame}) {
      document.querySelector('#count').textContent = frame;       // 1. the HTML of this frame
      const strength = interpolate(frame, [0, 30], [.02, 0]);
      await stage.paint(() => ripple.draw({page, strength}));     // 2. draw it as it stands now
    },
  });
</script>
```

```css
#stage { position: absolute; inset: 0; width: 100%; height: 100%; }
#page { width: 100%; height: 100%; }      /* as large as the canvas; any CSS size works */
```

Three rules make every frame right:

1. **Change the HTML first, then `await stage.paint(draw)`.** The browser lays the HTML out, takes its picture and then calls `draw`. The frame is finished when the promise resolves, so `render` must await it (and may return `{actors}` after it).
2. **Everything that reads the HTML happens inside `draw`**: `drawElementImage`, `stage.texture`, a shader's `draw`. Outside it there is no current picture.
3. **`ready: stage.ready`** (with other promises: `Promise.all([stage.ready, fonts])`). It makes the pictures of the HTML drawable, see below.

The frame stays a pure function of time: set every text, class and style from `frame` in each `render`, never add to what the last frame left.

## API (`/runtime/html-in-canvas.js`)

`htmlCanvas(canvas)` returns the stage. A canvas without a `width` attribute gets one pixel per film pixel.

| Member | Use |
| --- | --- |
| `ready` | Promise for `defineScene({ready})` |
| `paint(draw)` | Draws the HTML as it stands now; await it in `render` |
| `shader(fragment)` | A fragment shader (GLSL ES 3.00) over the whole canvas. It declares its uniforms and writes `color`; `uv` is given, (0, 0) at the top left like the HTML. Returns `{draw(values)}` |
| `shader.draw({name: value})` | Sets every uniform by name and draws. A number, an array for `vec2/3/4`, `mat3/4` or a uniform array, and for a `sampler2D` a drawable element (its picture now) or a texture from `texture()`. A `uniform vec2 resolution` gets the canvas size by itself. A uniform without a value is an error. Several `draw` calls in one frame lie over each other |
| `texture(element, {scale, srgb, mipmaps})` | The element as a WebGL texture, for more control: `scale: 2` holds twice the pixels and is drawn sharp at that size (for HTML the camera gets close to), `srgb: true` lets the shader read linear light (opaque HTML only), `mipmaps: false` saves time when nothing is blurred or shrunk |
| `adopt(root)` | Makes the pictures of HTML you built after `ready` drawable |
| `gl`, `canvas`, `supported` | The WebGL2 context for your own drawing, the canvas, and whether the browser can do it |

A 2D canvas needs only `paint`: take `stage.canvas.getContext('2d')` and call `ctx.drawElementImage(element, x, y)` inside `draw`, after `ctx.reset()`. One canvas has one kind of context: 2D or WebGL.

## What a picture of an element holds

- **A WebGL texture is the element's border box.** A `box-shadow`, an outline or a child that reaches outside is cut off: give the drawable padding, or draw the shadow in the shader. Rounded corners come out transparent. A 2D `drawElementImage` draws shadows and overflow too.
- **Do not put a CSS `transform` on the drawable itself.** In a texture it turns the content inside the unturned box and cuts it. Transform its children, or move the picture in the shader or with `ctx.translate/rotate/scale`.
- **The first row of the texture is the top of the element**, so `texture(page, uv)` shows it upright. Colours from `stage.texture` are premultiplied by alpha; write premultiplied colours to `color` too (`color = c * alpha`), and the canvas lies correctly over whatever is behind it.
- **Blur costs one line.** Textures have mipmaps: `textureLod(page, uv, 3.)` reads a copy an eighth the size, which is a soft picture. Depth of field is a level that grows with the distance from the sharp plane.
- A drawable inside another drawable is its own picture and is left out of its parent's.
- A drawable without a CSS width is only as wide as its content. Give it one: pixels, or `100%` for the width of the canvas. Where a drawable sits in the layout does not matter; only its size and content do.
- `backdrop-filter`, `mix-blend-mode`, `filter`, `clip-path`, `mask`, inline SVG, a nested 2D `<canvas>`, inputs and buttons are all drawn. `<video>` and `<audio>` stay forbidden in scenes.
- Text props shown inside a canvas cannot be clicked in the preview, because the scene decides where they appear; they stay editable on the right of Studio. Report `actors` from the place you draw them.

## Pictures from the project

A scene runs without an origin of its own, so its project files count as foreign, and a canvas leaves foreign pictures out of what it draws: a plain `<img src="../assets/x.png">` inside a drawable would be an empty box. `stage.ready` repairs this for the HTML the scene starts with: an `<img>` is loaded with CORS, a CSS image (`background-image`, `mask-image`, `border-image`, list markers) and an SVG `<image>` are replaced by a blob of the same file. Fonts need nothing.

- HTML you build later (a list filled in `render`, a new `<img>`): `await stage.adopt(element)` once after building it, before the frame that shows it. An `<img>` added later is taken care of by `paint` itself.
- A picture set for `::before` or `::after` in a stylesheet is not reached. Use a real element.
- Pictures from other sites cannot be drawn at all; a scene loads only local files anyway.

## Recipes

Tested in Chrome 157; write your own effects from them.

**The same card several times, soft in the distance (2D):**

```js
const ctx = stage.canvas.getContext('2d');
await stage.paint(() => {
  ctx.reset();
  for (let depth = 3; depth >= 1; depth--) {
    ctx.save();
    ctx.translate(width / 2 + depth * 190, height / 2 - depth * 70);
    ctx.scale(1 - depth * .14, 1 - depth * .14);
    ctx.filter = `blur(${depth * 3}px)`;
    ctx.globalAlpha = 1 - depth * .22;
    ctx.drawElementImage(card, -card.offsetWidth / 2, -card.offsetHeight / 2);
    ctx.restore();
  }
});
```

**From one real screen to the next with a wave that splits the colours:**

```js
const wave = stage.shader(`
  uniform sampler2D before, after;
  uniform float progress;                                  // 0 the first screen, 1 the second
  void main() {
    float front = mix(-.3, 1.3, progress) + .06 * sin(uv.y * 14.);
    float near = 1. - smoothstep(0., .22, abs(uv.x - front));
    vec2 push = vec2(near * .05 * sign(uv.x - front), 0.);
    vec4 one = vec4(texture(before, uv + push * 1.4).r, texture(before, uv + push).g, texture(before, uv + push * .6).ba);
    vec4 two = vec4(texture(after, uv + push * 1.4).r, texture(after, uv + push).g, texture(after, uv + push * .6).ba);
    color = mix(two, one, smoothstep(-.01, .01, uv.x - front));
  }`);
await stage.paint(() => wave.draw({before: screenA, after: screenB, progress}));
```

**A page in space, with perspective, depth of field and light.** Every pixel sends a ray from the camera and reads the page where the ray lands:

```js
const space = stage.shader(`
  uniform sampler2D page;
  uniform vec2 resolution;
  uniform vec2 size;       // of the page in CSS pixels
  uniform vec3 turn;       // tilt, swing and roll of the page in radians
  uniform float away;      // how far the page is, in page heights
  uniform float focus;     // the distance that is sharp
  mat3 rotate(vec3 a) {
    vec3 s = sin(a), c = cos(a);
    return mat3(c.y * c.z, c.y * s.z, -s.y,
                s.x * s.y * c.z - c.x * s.z, s.x * s.y * s.z + c.x * c.z, s.x * c.y,
                c.x * s.y * c.z + s.x * s.z, c.x * s.y * s.z - s.x * c.z, c.x * c.y);
  }
  void main() {
    vec2 p = (uv - .5) * vec2(resolution.x / resolution.y, 1.);
    vec3 ray = normalize(vec3(p, 1.4));                    // 1.4 is the lens: larger is longer
    mat3 r = rotate(turn);
    vec3 normal = r[2], centre = vec3(0., 0., away);
    float t = dot(centre, normal) / dot(ray, normal);
    vec2 q = (transpose(r) * (ray * t - centre)).xy / vec2(size.x / size.y, 1.) + .5;
    vec4 c = textureLod(page, q, abs(t * ray.z - focus) * 9.);   // further from the sharp plane: softer
    vec2 border = min(q, 1. - q) / fwidth(q);                    // a clean edge instead of stairs
    float inside = t > 0. ? clamp(min(border.x, border.y), 0., 1.) : 0.;
    c.rgb *= .8 + .25 * dot(-normal, normalize(vec3(-.5, -.6, -1.)));
    color = c * inside;
  }`);
await stage.paint(() => space.draw({
  page: stage.texture(page, {scale: 1.5}),
  size: [page.offsetWidth, page.offsetHeight],
  turn: [.18, swing, -.04], away: 1.75, focus: 1.75,
}));
```

A glass lens over it bends the rays before they are cast: `vec2 d = p - lensCentre; float glass = smoothstep(.26, .2, length(d)); p -= d * glass * .35 * (1. - length(d) / .26);`.

Plain HTML next to the canvas still works as always: the canvas is one element of the page, transparent wherever the shader writes no alpha, so a headline in plain HTML can lie over it and stay clickable.

## Your own renderer

`stage.paint(() => engine.draw(time))` is all a WebGL engine of your own needs: inside it, `gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, element, {width, height})` copies a drawable into a texture whose storage exists already (`texImage2D` with `null` or `texStorage2D`). It honours `UNPACK_FLIP_Y_WEBGL` and `UNPACK_PREMULTIPLY_ALPHA_WEBGL`; without them the first row is the top and the colours are not premultiplied. The `miniature-3d` renderer takes HTML this way as a live texture (see the `superint-miniature` skill).

## When it goes wrong

- **Black or empty picture:** the canvas has no size, the drawable has none, or `draw` never ran because `render` did not await `paint`.
- **An empty box where a picture should be:** the picture was added after `ready` as a CSS image; call `adopt`.
- **"Shader does not compile":** the message carries the GLSL log with the line in your source.
- **Text looks soft on a page in space:** raise `scale` in `stage.texture`; a texture drawn larger than its pixels is blurred.
- **A dark or bright rim around transparent HTML:** `color` was not premultiplied.
