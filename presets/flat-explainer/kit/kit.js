/**
 * flat-explainer scene kit. Every function is a pure function of time/frame and its
 * arguments, so seeking backwards or jumping gives the same picture as playback.
 */
import { interpolate, ease, spring, random } from '/runtime/scene.js';

export { interpolate, ease, spring, random };

/** Await in defineScene({ready}) so the first frame never shows a fallback font. */
export const fontsReady = document.fonts.load('900 1em Nunito').then(() => document.fonts.ready);

const css = getComputedStyle(document.documentElement);
/** Theme colors from theme.css, e.g. color('sun'). */
export const color = name => css.getPropertyValue(`--${name}`).trim() || name;

export const clamp01 = v => Math.max(0, Math.min(1, v));

// ---------------------------------------------------------------- review

/**
 * Check camera for close-ups with `superint-video review --camera x,y,zoom`. Spread into the
 * scene's props; `checkCamera(props)` is null for the film camera, else {x, y, z}: the scene
 * point that lands in the frame centre, and the magnification.
 */
export const checkCameraProps = {
  camX: { type: 'number', default: 0, label: 'Check camera x' },
  camY: { type: 'number', default: 0, label: 'Check camera y' },
  camZ: { type: 'number', default: 0, min: 0, label: 'Check camera zoom (0 = film camera)' },
};
export const checkCamera = props => props.camZ > 0 ? { x: props.camX, y: props.camY, z: props.camZ } : null;

/** The check camera for DOM and SVG scenes: moves the whole body. Call last in render. */
export function frameCheckCamera(props, width, height) {
  const cam = checkCamera(props);
  document.body.style.transformOrigin = '0 0';
  document.body.style.transform = cam ? `translate(${width / 2 - cam.x * cam.z}px, ${height / 2 - cam.y * cam.z}px) scale(${cam.z})` : '';
}

// ---------------------------------------------------------------- motion

/** Spring progress 0→1 starting `at` seconds. Overshoots slightly; use clamp01 for opacity. */
export const enter = (time, at = 0, { stiffness = 120, damping = 16 } = {}) =>
  spring(time - at, { stiffness, damping });

/** Smooth 0→1 between two times (seconds), eased. */
export const between = (time, from, to, easing = ease.inOutCubic) =>
  interpolate(time, [from, to], [0, 1], { ease: easing });

/** Fade in after `inAt`, out before `outAt` (seconds). Omit outAt to stay visible. */
export const visible = (time, inAt, outAt = Infinity, length = 0.35) =>
  Math.min(between(time, inAt, inAt + length, ease.outCubic),
    outAt === Infinity ? 1 : 1 - between(time, outAt - length, outAt, ease.inCubic));

/** Rise into place: sets opacity and a vertical offset (in vmin) from a 0→1 progress. */
export function rise(el, p, distance = 4) {
  el.style.opacity = clamp01(p);
  el.style.transform = `translateY(${(1 - p) * distance}vmin)`;
}

/** Pop in from a point: scale with spring overshoot. */
export function pop(el, p, origin = '50% 50%') {
  el.style.opacity = clamp01(p * 3);
  el.style.transformOrigin = origin;
  el.style.transform = `scale(${Math.max(0, p)})`;
}

/** Slow, continuous camera drift for a .stage element. Keeps still frames alive. */
export function drift(el, time, { zoom = 0.012, x = 0, y = -0.15, start = 1 } = {}) {
  el.style.transform = `translate(${x * time}vmin, ${y * time}vmin) scale(${start + zoom * time})`;
}

/** Gentle deterministic floating offset in vmin; each seed has its own phase. */
export function bob(seed, time, amplitude = 0.8, period = 4) {
  const phase = random(seed, 1) * Math.PI * 2;
  const w = (Math.PI * 2) / period;
  return [Math.sin(time * w * 0.7 + phase) * amplitude * 0.6, Math.sin(time * w + phase) * amplitude];
}

// ---------------------------------------------------------------- text

const escapeHtml = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Text with *emphasis* → HTML with <em>. Everything else is escaped. */
export const markup = text => escapeHtml(text).replace(/\*([^*]+)\*/g, '<em>$1</em>');

/**
 * Renders text into `el` as per-word spans (once per distinct text) and returns them.
 * Emphasized words keep their <em>.
 */
export function splitWords(el, text) {
  if (el.dataset.source === text) return [...el.querySelectorAll('.word')];
  el.dataset.source = text;
  el.innerHTML = markup(text)
    .split(/(<em>.*?<\/em>)/)
    .map(part => part.startsWith('<em>')
      ? part.slice(4, -5).split(/(\s+)/).filter(Boolean).map(w => /^\s+$/.test(w) ? w : `<em class="word">${w}</em>`).join('')
      : part.split(/(\s+)/).filter(Boolean).map(w => /^\s+$/.test(w) ? w : `<span class="word">${w}</span>`).join(''))
    .join('');
  return [...el.querySelectorAll('.word')];
}

/** Staggered word reveal starting at `at` seconds, `gap` seconds apart. */
export function revealWords(words, time, at = 0, gap = 0.07, distance = 2.4) {
  words.forEach((word, i) => rise(word, enter(time, at + i * gap, { stiffness: 160, damping: 18 }), distance));
}

/** Shrinks font-size until `el` fits its box (call after setting text). */
export function fitText(el, { max, min = max * 0.5, width = el.parentElement.clientWidth * 0.92, lines = 3 } = {}) {
  let size = max;
  el.style.fontSize = `${size}vmin`;
  const lineHeight = () => parseFloat(getComputedStyle(el).lineHeight) || el.offsetHeight;
  while (size > min && (el.scrollWidth > width || el.offsetHeight > lineHeight() * lines + 1)) {
    size -= 0.25;
    el.style.fontSize = `${size}vmin`;
  }
  return size;
}

/** Locale-formatted count from `from` to `to` driven by progress p. */
export function count(p, from, to, { decimals = 0, locale = document.documentElement.lang || 'de' } = {}) {
  const value = from + (to - from) * clamp01(p);
  return value.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ---------------------------------------------------------------- SVG

const NS = 'http://www.w3.org/2000/svg';
/** Creates an SVG element: el('circle', {r: 10}, parent). */
export function el(tag, attrs = {}, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

/**
 * Sets viewBox to the composition size so SVG units equal output pixels. Pass the render
 * context's width/height: the document may not be laid out when the module first runs.
 * `u` is 1vmin in pixels.
 */
export function fitSvg(svg, w, h) {
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  return { w, h, u: Math.min(w, h) / 100, portrait: h > w };
}

/**
 * Builds a scene's layout once, on the first frame, from the composition size:
 * `const layout = once(ctx => {...})` then `const L = layout(context)` in render.
 */
export function once(build) {
  let built = null;
  return context => (built ??= build(context));
}

/** Mixes a hex color toward black (amount<0) or white (amount>0). */
export function shade(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const target = amount < 0 ? 0 : 255, t = Math.abs(amount);
  const ch = s => Math.round(((n >> s) & 255) * (1 - t) + target * t);
  return `#${[16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

let clipSerial = 0;
/**
 * Flat-shaded sphere: base, a shadow crescent toward the lower right and a soft highlight.
 * Returns the <g>; position it with transform="translate(x y)".
 */
export function orb(parent, { r, fill, ring = false, ringColor, highlight = true, glow = false, bands = 0 } = {}) {
  const g = el('g', {}, parent);
  const id = `orb-clip-${clipSerial++}`;
  const clip = el('clipPath', { id }, el('defs', {}, g));
  el('circle', { r }, clip);
  // Soft atmosphere: two translucent halos instead of a blur filter (cheap and exact).
  if (glow) for (const [k, o] of [[1.2, 0.07], [1.09, 0.11]]) el('circle', { r: r * k, fill: shade(fill, 0.45), opacity: o }, g);
  // A ring is two half-ellipses: the back half behind the sphere, the front half over it.
  const rx = r * 1.62, ry = r * 0.34;
  const ringHalf = sweep => el('path', {
    d: `M${-rx},0 A${rx},${ry} 0 0 ${sweep} ${rx},0`,
    fill: 'none', stroke: ringColor || shade(fill, 0.35), 'stroke-width': r * 0.075,
    'stroke-linecap': 'round', transform: 'rotate(-14)',
  }, g);
  if (ring) ringHalf(1);
  const body = el('g', { 'clip-path': `url(#${id})` }, g);
  el('circle', { r, fill }, body);
  // Surface bands follow the sphere's curvature; flat tone steps, no gradients.
  for (let i = 0; i < bands; i++) {
    const y = -r * 0.55 + (i * r * 1.1) / Math.max(1, bands - 1);
    el('ellipse', { cx: 0, cy: y, rx: r * 1.3, ry: r * 0.075, fill: shade(fill, i % 2 ? 0.12 : -0.1), transform: `rotate(-10)` }, body);
  }
  // Terminator: a dark crescent toward the lower right.
  el('path', {
    d: `M${-r * 2},${-r * 2} H${r * 2} V${r * 2} H${-r * 2} Z M${-r * 0.2 + r * 0.97},${-r * 0.18} A${r * 0.97},${r * 0.97} 0 1 0 ${-r * 0.2 - r * 0.97},${-r * 0.18} A${r * 0.97},${r * 0.97} 0 1 0 ${-r * 0.2 + r * 0.97},${-r * 0.18} Z`,
    fill: shade(fill, -0.32), 'fill-rule': 'evenodd',
  }, body);
  // Rim light: a thin crescent along the upper-left edge.
  if (highlight) el('path', {
    d: `M${r},0 A${r},${r} 0 1 0 ${-r},0 A${r},${r} 0 1 0 ${r},0 Z M${r * 1.06},${r * 0.06} A${r},${r} 0 1 1 ${-r * 0.94},${r * 0.06} A${r},${r} 0 1 1 ${r * 1.06},${r * 0.06} Z`,
    fill: shade(fill, 0.3), 'fill-rule': 'evenodd',
  }, body);
  if (ring) ringHalf(0);
  return g;
}

/**
 * Cel-shades any closed path the way orb() shades spheres: base tone, a hard shadow side away
 * from the key light and a thin rim light toward it. `size` is roughly the shape's radius and
 * scales both bands; `light` points toward the key light. Returns {g, set}: call set(d) to
 * animate the shape.
 */
export function cel(parent, d, { fill, size, shadow = shade(fill, -0.32), rim = shade(fill, 0.3), light = [-0.7, -0.7], shadowWidth = 0.28, rimWidth = 0.06 } = {}) {
  const g = el('g', {}, parent);
  const defs = el('defs', {}, g);
  const outer = `cel-clip-${clipSerial++}`, inner = `cel-clip-${clipSerial++}`;
  const len = Math.hypot(light[0], light[1]) || 1;
  const toward = k => `translate(${(light[0] / len) * k * size} ${(light[1] / len) * k * size})`;
  const paths = [
    el('path', {}, el('clipPath', { id: outer }, defs)),
    // The shape moved away from the light; the strip it uncovers on the lit edge is the rim.
    el('path', { transform: toward(-rimWidth) }, el('clipPath', { id: inner }, defs)),
  ];
  const body = el('g', { 'clip-path': `url(#${outer})` }, g);
  paths.push(el('path', { fill: rim }, body));
  const lit = el('g', { 'clip-path': `url(#${inner})` }, body);
  paths.push(el('path', { fill: shadow }, lit));
  // The base moved toward the light leaves a shadow band along the far edge.
  paths.push(el('path', { fill, transform: toward(shadowWidth) }, lit));
  const set = path => paths.forEach(p => p.setAttribute('d', path));
  set(d);
  return { g, set };
}

/**
 * Organic closed blob path (cells, clouds, islands). `wobble` 0..0.4, `t` animates the shape
 * deterministically. Returns an SVG path `d` string centered on 0,0.
 */
export function blob(seed, r, { points = 7, wobble = 0.18, t = 0 } = {}) {
  const pts = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const k = 1 + wobble * (random(seed, i) - 0.5) * 2 + wobble * 0.35 * Math.sin(t * 1.3 + random(seed, i + 50) * 6.28);
    pts.push([Math.cos(a) * r * k, Math.sin(a) * r * k]);
  }
  // Closed Catmull-Rom → cubic Bézier
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < points; i++) {
    const p0 = pts[(i - 1 + points) % points], p1 = pts[i], p2 = pts[(i + 1) % points], p3 = pts[(i + 2) % points];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d + 'Z';
}

/** Star field in a <g>; call twinkle(stars, time) every frame. */
export function starField(parent, { w, h, seed = 'stars', count = 120 }) {
  const g = el('g', {}, parent);
  const u = Math.min(w, h) / 100;
  return Array.from({ length: count }, (_, i) => {
    const big = random(seed, i * 4 + 3) > 0.92;
    const star = el('circle', {
      cx: random(seed, i * 4) * w,
      cy: random(seed, i * 4 + 1) * h,
      r: (big ? 0.32 : 0.12 + random(seed, i * 4 + 2) * 0.14) * u,
      fill: big ? color('sun') : color('paper'),
    }, g);
    star.dataset.phase = random(seed, i * 4 + 2) * 6.28;
    return star;
  });
}
export function twinkle(stars, time) {
  for (const s of stars) s.setAttribute('opacity', 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(time * 1.6 + Number(s.dataset.phase))));
}

/** Prepares a path for drawing; then draw(path, p) reveals it from 0 to 1. */
export function drawable(path) {
  const length = path.getTotalLength();
  path.style.strokeDasharray = `${length} ${length}`;
  path.dataset.length = length;
  return path;
}
export function draw(path, p) {
  path.style.strokeDashoffset = Number(path.dataset.length) * (1 - clamp01(p));
}
