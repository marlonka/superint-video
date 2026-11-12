/**
 * blank scene kit (style-neutral helpers). Every function is a pure function of time/frame and its
 * arguments, so seeking backwards or jumping gives the same picture as playback.
 */
import { interpolate, ease, spring, random } from '/runtime/scene.js';

export { interpolate, ease, spring, random };

/** Await in defineScene({ready}) so the first frame never shows a fallback font. */
export const fontsReady = document.fonts.load('700 1em Geist').then(() => document.fonts.ready);

const css = getComputedStyle(document.documentElement);
/** Theme colors from theme.css, e.g. color('accent'). */
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


// ---------------------------------------------------------------- strokes

/** Prepares a path for draw(): dash length = path length. */
export function drawable(path) {
  const length = path.getTotalLength();
  path.style.strokeDasharray = `${length} ${length}`;
  path.dataset.length = length;
  return path;
}
export function draw(path, p) {
  path.style.strokeDashoffset = Number(path.dataset.length) * (1 - clamp01(p));
}
