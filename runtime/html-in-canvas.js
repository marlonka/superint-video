/**
 * Real HTML inside a canvas (HTML-in-Canvas, Chrome 157 and newer). The children of
 * `<canvas content="drawable">` that carry `drawable` are laid out like any HTML, but they appear
 * only where the scene draws them: with `drawElementImage` on a 2D canvas, or as a WebGL texture
 * that a shader bends, lights, blurs and cuts. Text, layout, fonts and CSS stay the browser's work.
 *
 *   const stage = htmlCanvas(document.querySelector('canvas'));
 *   const glass = stage.shader(`uniform sampler2D page; void main() { color = texture(page, uv); }`);
 *   defineScene({ ready: stage.ready, async render({ time }) {
 *     title.textContent = …;                           // 1. change the HTML for this frame
 *     await stage.paint(() => glass.draw({ page }));   // 2. draw it as it stands now
 *   } });
 */
import { previewing, reportMissing } from './scene.js';

/** Whether this browser draws HTML into a canvas. */
export const supported = typeof HTMLCanvasElement !== 'undefined' && 'content' in HTMLCanvasElement.prototype;

const NEEDS = 'This scene draws HTML into a canvas (HTML-in-Canvas), which needs Chrome 157 or newer. Update Chrome, or point SUPERINT_CHROME at a newer one.';
const IMAGE_PROPERTIES = ['background-image', 'mask-image', 'border-image-source', 'list-style-image'];
const XLINK = 'http://www.w3.org/1999/xlink';
const local = url => /^(data|blob):/.test(url);

/**
 * Project files as blob addresses. A scene is a sandbox without an origin of its own, so its
 * project files count as foreign, and a canvas leaves foreign pictures out of what it draws.
 * A blob the scene made itself is its own. Each picture stays decoded, so it is there at once.
 */
const blobs = new Map();
function asBlob(url) {
  if (!blobs.has(url)) {
    blobs.set(url, (async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Image failed: ${url} (${response.status})`);
      const kept = new Image();
      kept.src = URL.createObjectURL(await response.blob());
      await kept.decode().catch(() => { throw new Error(`Image failed: ${url}`); });
      return kept;
    })());
  }
  return blobs.get(url).then(kept => kept.src);
}

/** Without HTML-in-Canvas the HTML shows as it is, where the canvas stands, without the effect. */
function showPlain(canvas) {
  const holder = document.createElement('div');
  holder.style.cssText = `position:absolute;left:${canvas.offsetLeft}px;top:${canvas.offsetTop}px;width:${canvas.offsetWidth}px;height:${canvas.offsetHeight}px;overflow:hidden`;
  holder.append(...[...canvas.children].filter(child => child.hasAttribute('drawable')));
  canvas.after(holder);
}

// One triangle over the whole canvas. `uv` starts at the top left, like the HTML it samples.
const VERTEX = `#version 300 es
out vec2 uv;
void main() {
  vec2 corner = vec2(gl_VertexID == 1 ? 3. : -1., gl_VertexID == 2 ? 3. : -1.);
  uv = vec2(corner.x, -corner.y) * .5 + .5;
  gl_Position = vec4(corner, 0., 1.);
}`;
const FRAGMENT_HEAD = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 color;
#line 1
`;

function compile(gl, vertex, fragment) {
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
    const part = gl.createShader(type);
    gl.shaderSource(part, source);
    gl.compileShader(part);
    if (!gl.getShaderParameter(part, gl.COMPILE_STATUS)) throw new Error(`Shader does not compile:\n${gl.getShaderInfoLog(part)}`);
    gl.attachShader(program, part);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Shader does not link:\n${gl.getProgramInfoLog(program)}`);
  return program;
}

/**
 * Takes a `<canvas>` whose `drawable` children are the HTML to draw. A canvas without a `width`
 * gets one pixel per CSS pixel, which in a scene is one per film pixel. In a browser without
 * HTML-in-Canvas the preview shows the HTML as it is; a snapshot, check or render stops there
 * and says which Chrome it needs.
 */
export function htmlCanvas(canvas) {
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('htmlCanvas(canvas) needs a <canvas> element');
  if (supported) canvas.setAttribute('content', 'drawable');
  else reportMissing(NEEDS);
  if (!canvas.hasAttribute('width')) { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; }

  let gl = null, draw = null;
  const waiting = [];
  const settle = error => { for (const frame of waiting.splice(0)) frame(error); };
  canvas.addEventListener('paint', () => {
    if (!draw) return;
    try {
      if (gl) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
      draw();
    } catch (error) {
      if (!waiting.length) throw error;
      return settle(error);
    }
    settle();
  });
  // A hidden preview paints nothing. It draws its last frame when someone looks again.
  document.addEventListener('visibilitychange', () => {
    if (draw && document.visibilityState === 'visible') canvas.requestPaint();
  });

  /** Pictures and fonts of the HTML as it stands now are loaded before the canvas takes it. */
  async function current() {
    for (const image of canvas.querySelectorAll('img:not([crossorigin])')) {
      if (!local(image.getAttribute('src') || '')) image.crossOrigin = 'anonymous';
    }
    // A layout read starts the fonts the text needs.
    canvas.getBoundingClientRect();
    await document.fonts.ready;
    await Promise.all([...canvas.querySelectorAll('img')].map(image => image.complete || image.decode().catch(() => {
      throw new Error(`Image failed: ${image.getAttribute('src') || ''}`);
    })));
  }

  /**
   * Makes every picture below `root` one the canvas draws: an `<img>` is asked for with CORS,
   * a CSS image (background, mask, border, list marker) and an SVG `<image>` become blobs.
   * `ready` does it once for the HTML the scene starts with; call it again for HTML built
   * later. A picture set in a stylesheet for `::before` or `::after` is not reached.
   */
  async function adopt(root = canvas) {
    if (!supported) return;
    const jobs = [];
    for (const element of [root, ...root.querySelectorAll('*')]) {
      if (element.localName === 'image') {
        const href = element.getAttribute('href') ?? element.getAttributeNS(XLINK, 'href');
        if (href && !local(href)) jobs.push(asBlob(new URL(href, document.baseURI).href).then(url => element.setAttribute('href', url)));
        continue;
      }
      const style = getComputedStyle(element);
      for (const property of IMAGE_PROPERTIES) {
        const value = style.getPropertyValue(property);
        const urls = [...value.matchAll(/url\("([^"]+)"\)/g)].map(match => match[1]).filter(url => !local(url));
        if (!urls.length) continue;
        jobs.push(Promise.all(urls.map(asBlob)).then(made => {
          element.style.setProperty(property, urls.reduce((text, url, index) => text.replace(`url("${url}")`, `url("${made[index]}")`), value));
        }));
      }
    }
    await Promise.all(jobs);
    await current();
  }

  /**
   * Draws the HTML as it stands now. Change the HTML first, then await this: `draw` runs once
   * the browser has laid the HTML out, and the frame is finished when the promise resolves.
   * Everything that reads the HTML (`drawElementImage`, `texture`, a shader's `draw`) belongs
   * inside `draw`. The same `draw` runs again whenever the browser repaints the HTML by itself.
   */
  async function paint(drawing) {
    if (typeof drawing !== 'function') throw new Error('paint(draw) needs the function that draws the canvas');
    if (!supported) return;
    draw = drawing;
    if (previewing() && document.visibilityState === 'hidden') return;
    await current();
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('The browser did not paint the canvas within 10 s. A canvas without a size or outside the picture is never painted.')), 10000);
      waiting.push(error => { clearTimeout(timer); if (error) reject(error); else resolve(); });
      canvas.requestPaint();
    });
  }

  function context() {
    gl ??= canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true });
    if (!gl) throw new Error('This canvas has no WebGL2 context. A 2D canvas draws HTML with drawElementImage instead.');
    return gl;
  }

  /**
   * A drawable element as a WebGL texture with the picture it has now, bound to the active
   * unit. Call it inside `paint`. The picture is the element's border box: a shadow or a child
   * that reaches outside is cut off. `scale` 2 gives twice the pixels of the CSS size, drawn
   * sharp, for HTML the camera gets close to. `srgb` stores it so a shader reads linear light.
   * The first row is the top of the element; colours are premultiplied by alpha.
   */
  const textures = new WeakMap();
  function texture(element, { scale = 1, srgb = false, mipmaps = true } = {}) {
    const gl = context();
    if (!(element instanceof Element) || !element.hasAttribute('drawable') || !canvas.contains(element)) {
      throw new Error('texture(element) needs an element inside the canvas that carries the attribute `drawable`');
    }
    const width = Math.max(1, Math.round(element.offsetWidth * scale)), height = Math.max(1, Math.round(element.offsetHeight * scale));
    const kinds = textures.get(element) ?? textures.set(element, new Map()).get(element);
    const kind = `${scale}/${srgb}/${mipmaps}`;
    const held = kinds.get(kind) ?? kinds.set(kind, { texture: gl.createTexture() }).get(kind);
    gl.bindTexture(gl.TEXTURE_2D, held.texture);
    // Storage that can change its size: the element may grow with its text.
    if (held.width !== width || held.height !== height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      Object.assign(held, { width, height });
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, element, { width, height });
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
    return held.texture;
  }

  /**
   * A fragment shader over the whole canvas. The source declares its own uniforms and writes
   * `color`, premultiplied by alpha; it gets `uv` (0,0 at the top left, like the HTML).
   * `draw({name: value})` sets every uniform: a number, an array for a vector or matrix, and
   * for a `sampler2D` a drawable element (its picture now) or a texture from `texture()`.
   * A uniform `vec2 resolution` gets the canvas size in pixels by itself. Each `draw` lies
   * over what was drawn before it in this frame.
   */
  function shader(fragment) {
    const gl = context();
    const program = compile(gl, VERTEX, FRAGMENT_HEAD + fragment);
    const uniforms = Array.from({ length: gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) }, (_, index) => {
      const { name, type } = gl.getActiveUniform(program, index);
      return { name: name.replace(/\[0\]$/, ''), type, at: gl.getUniformLocation(program, name) };
    });
    const vectors = { [gl.FLOAT_VEC2]: 'uniform2fv', [gl.FLOAT_VEC3]: 'uniform3fv', [gl.FLOAT_VEC4]: 'uniform4fv' };
    const matrices = { [gl.FLOAT_MAT3]: 'uniformMatrix3fv', [gl.FLOAT_MAT4]: 'uniformMatrix4fv' };
    return {
      draw(values = {}) {
        gl.useProgram(program);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        let unit = 0;
        for (const { name, type, at } of uniforms) {
          const value = values[name] ?? (name === 'resolution' ? [gl.drawingBufferWidth, gl.drawingBufferHeight] : undefined);
          if (value === undefined) throw new Error(`The shader's uniform \`${name}\` got no value in draw({…})`);
          if (type === gl.SAMPLER_2D) {
            gl.activeTexture(gl.TEXTURE0 + unit);
            if (value instanceof WebGLTexture) gl.bindTexture(gl.TEXTURE_2D, value); else texture(value);
            gl.uniform1i(at, unit++);
          } else if (type === gl.FLOAT) gl.uniform1fv(at, [value].flat());
          else if (type === gl.INT || type === gl.BOOL) gl.uniform1iv(at, [value].flat().map(Number));
          else if (vectors[type]) gl[vectors[type]](at, value);
          else if (matrices[type]) gl[matrices[type]](at, false, value);
          else throw new Error(`The shader's uniform \`${name}\` has a type draw() does not set`);
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
  }

  const ready = supported ? adopt() : Promise.resolve(showPlain(canvas));
  return { canvas, supported, ready, adopt, paint, texture, shader, get gl() { return context(); } };
}
