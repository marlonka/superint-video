/**
 * launch kit: helpers for music-led product films. Every function is a pure function of its
 * arguments, so seeking backwards or jumping gives the same picture as playback.
 *
 * - grid: times from the measured beat grid of the track
 * - span, keyed, cameraAt: eased progress, keyframes and a camera with log-scale zoom
 * - toScreen, morphBox, place: boxes for handovers (one element carried from screen to screen)
 * - soft: depth of field (read on a soft picture, act on a sharp one)
 * - lineIn / lineOut: the ways a line enters and leaves, so no two lines in a row arrive alike
 */
import { interpolate, ease, random } from '/runtime/scene.js';

export { interpolate, ease, random };

/** Await in defineScene({ready}) so no frame shows a fallback font. */
export const fontsReady = Promise.all(
  ['400 16px Geist', '500 16px Geist', '600 16px Geist', '700 16px Geist', '400 16px "JetBrains Mono"', '700 16px "JetBrains Mono"']
    .map(font => document.fonts.load(font)),
).then(() => document.fonts.ready);

export const clamp01 = v => Math.max(0, Math.min(1, v));
export const lerp = (a, b, p) => a + (b - a) * p;

/** Eases from 0 to 1: `out` for entrances, `inOut` for moves and cameras, `in` for exits. */
export const eases = {
  out: p => 1 - (1 - p) ** 4,
  inOut: p => (p < 0.5 ? 8 * p ** 4 : 1 - (-2 * p + 2) ** 4 / 2),
  in: p => p ** 3,
  snap: p => 1 - (1 - p) ** 6,
  linear: p => p,
};

/** The track's grid: `beat(n)` and `bar(n)` in seconds from the bar length and the first downbeat. */
export const grid = ({ bar, offset = 0 }) => ({
  beat: n => offset + (n * bar) / 4,
  bar: n => offset + n * bar,
});

/** Progress from 0 to 1 of `time` between `from` and `to`, eased. */
export function span(time, from, to, easing = eases.inOut) {
  if (to <= from) return time >= to ? 1 : 0;
  return easing(clamp01((time - from) / (to - from)));
}

/** A value from keyframes `[[time, value], …]`, eased between neighbours, held outside. */
export function keyed(keys, time, easing = eases.inOut) {
  if (time <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (time <= t1) {
      const [t0, v0] = keys[i - 1];
      return lerp(v0, v1, span(time, t0, t1, easing));
    }
  }
  return keys[keys.length - 1][1];
}

/**
 * A camera from keyframes `[[time, {x, y, z}], …]`: the world point (x, y) sits in the frame's
 * centre at zoom z. Zoom moves on a log scale, so a push feels even from wide to close.
 */
export function cameraAt(keys, time, easing = eases.inOut) {
  if (time <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, b] = keys[i];
    if (time <= t1) {
      const [t0, a] = keys[i - 1];
      const p = span(time, t0, t1, easing);
      return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), z: a.z * (b.z / a.z) ** p };
    }
  }
  return keys[keys.length - 1][1];
}

/** Points a world element through the camera (its transform-origin must be 0 0). */
export function applyCamera(el, cam, width, height) {
  el.style.transform = `translate(${width / 2 - cam.x * cam.z}px, ${height / 2 - cam.y * cam.z}px) scale(${cam.z})`;
}

/** A world box as the camera shows it on screen. */
export const toScreen = (box, cam, width, height) => ({
  x: width / 2 + (box.x - cam.x) * cam.z,
  y: height / 2 + (box.y - cam.y) * cam.z,
  w: box.w * cam.z,
  h: box.h * cam.z,
});

/**
 * The box between `a` and `b` at progress p: its centre on a straight line or an arc lifted by
 * `arc` pixels at the middle, its size on a log scale so small and large meet at an even pace.
 */
export function morphBox(a, b, p, { arc = 0 } = {}) {
  const w = a.w * (b.w / a.w) ** p;
  const h = a.h * (b.h / a.h) ** p;
  const cx = lerp(a.x + a.w / 2, b.x + b.w / 2, p);
  const cy = lerp(a.y + a.h / 2, b.y + b.h / 2, p) - arc * 4 * p * (1 - p);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** Puts an absolutely positioned element (left/top 0) on a box. */
export function place(el, box) {
  el.style.transform = `translate(${box.x}px, ${box.y}px)`;
  el.style.width = `${box.w}px`;
  el.style.height = `${box.h}px`;
}

/** Depth of field: 0 is sharp, 1 is soft (blurred and dimmed) for a line to read on. */
export function soft(el, amount, { blur = 14, dim = 0.45 } = {}) {
  el.style.filter = amount > 0.002 ? `blur(${(amount * blur).toFixed(2)}px) brightness(${(1 - amount * dim).toFixed(3)})` : 'none';
}

/** The first characters of `text` typed at `cps` characters a second from `at`. */
export const typed = (text, time, at, cps) => text.slice(0, Math.max(0, Math.floor((time - at) * cps)));

/**
 * Line entrances, each driven by a progress p from 0 to 1. The line keeps its centred layout at
 * every frame; only opacity, blur, mask and a small offset move.
 * - blur: out of focus into place (use on chunks for a line in two or three pieces)
 * - mask: rises from under a mask (the element needs one child span; see .mask in launch.css)
 * - wipe: revealed from left to right behind a soft edge
 * - scale: settles from 106 % and out of focus
 */
export const lineIn = {
  blur(el, p) {
    el.style.opacity = clamp01(p * 1.4);
    el.style.filter = p < 1 ? `blur(${((1 - p) * 18).toFixed(2)}px)` : 'none';
    el.style.transform = `translateY(${(1 - p) * 14}px)`;
  },
  mask(el, p) {
    el.style.opacity = 1;
    el.firstElementChild.style.transform = `translateY(${(1 - p) * 110}%)`;
  },
  wipe(el, p) {
    const edge = lerp(-14, 100, p);
    const mask = p >= 1 ? 'none' : `linear-gradient(90deg, #000 ${edge}%, transparent ${edge + 14}%)`;
    el.style.opacity = 1;
    el.style.maskImage = mask;
    el.style.webkitMaskImage = mask;
  },
  scale(el, p) {
    el.style.opacity = clamp01(p * 1.6);
    el.style.filter = p < 1 ? `blur(${((1 - p) * 14).toFixed(2)}px)` : 'none';
    el.style.transform = `scale(${lerp(1.06, 1, p)})`;
  },
};

/** Line exits, p from 0 (on screen) to 1 (gone). */
export const lineOut = {
  blur(el, p) {
    el.style.opacity = 1 - p;
    el.style.filter = p > 0 ? `blur(${(p * 16).toFixed(2)}px)` : 'none';
  },
  rise(el, p) {
    lineOut.blur(el, p);
    el.style.transform = `translateY(${-p * 24}px)`;
  },
  mask(el, p) {
    el.firstElementChild.style.transform = `translateY(${p * 110}%)`;
  },
};

/** The pointer arrow; its tip is the element's top-left corner. */
export const cursorSvg = `<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true"><path d="M3 2.5 19.5 13l-7.4 1.3 4.3 7.6-2.9 1.6-4.3-7.6L3.6 21Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
