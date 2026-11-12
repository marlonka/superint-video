/**
 * Multi-shot scenes: one clip holds several compositions ("shots"); cut times are clip props in
 * seconds, taken from words.json. Each shot is a <g> that is shown alone and moved by its camera.
 */
import { clamp01, ease, interpolate } from '../../kit/kit.js';

export const lerp = (a, b, t) => a + (b - a) * t;
export const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));

/** Parses "0, 3.2, 6.1" into numbers. */
export const times = s => String(s).split(',').map(Number).filter(v => Number.isFinite(v));

/** Index of the shot that is on screen at `time` for cut times [0, t1, t2, …]. */
export function shotAt(time, cuts) {
  let i = 0;
  for (let k = 0; k < cuts.length; k++) if (time >= cuts[k] - 1e-6) i = k;
  return i;
}

/** Zoom that interpolates in log space, so a push feels even. */
export const logZoom = (z0, z1, p) => Math.exp(Math.log(z0) + (Math.log(z1) - Math.log(z0)) * p);

/**
 * Applies a camera to a shot group: the scene point (x, y) lands in the frame centre at zoom z.
 * Returns toScreen(x, y, w, h) for actor boxes.
 */
export function camera(node, W, H, { x = W / 2, y = H / 2, z = 1, r = 0, dx = 0, dy = 0 } = {}) {
  node.setAttribute('transform', `translate(${(W / 2 + dx).toFixed(2)} ${(H / 2 + dy).toFixed(2)}) scale(${z.toFixed(5)})${r ? ` rotate(${r.toFixed(3)})` : ''} translate(${(-x).toFixed(2)} ${(-y).toFixed(2)})`);
  return (px, py, pw = 0, ph = 0) => ({ x: (px - x) * z + W / 2 + dx, y: (py - y) * z + H / 2 + dy, w: pw * z, h: ph * z });
}

/** Actor box in screen pixels from a box in shot coordinates. */
export function actor(toScreen, id, x, y, w, h, target) {
  const b = toScreen(x, y, w, h);
  return target ? { id, x: b.x, y: b.y, w: b.w, h: b.h, target } : { id, x: b.x, y: b.y, w: b.w, h: b.h };
}

/** Eased 0→1 between two times. */
export const ramp = (time, a, b, e = ease.inOutCubic) => interpolate(time, [a, b], [0, 1], { ease: e });

/** Whip-pan offset: 0 → 1 over `len` seconds, accelerating then decelerating hard. */
export function whip(time, at, len = 0.28) {
  return clamp01(interpolate(time, [at - len / 2, at + len / 2], [0, 1], { ease: ease.inOutCubic }));
}

/** Seconds since the last cut, and the progress of a short settle after it. */
export function sinceCut(time, cuts) {
  const i = shotAt(time, cuts);
  return { i, t: time - cuts[i], next: cuts[i + 1] ?? Infinity };
}
