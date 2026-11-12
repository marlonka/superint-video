/**
 * The cast rig, version 2: flat graphic figures. Big sculpted heads with a jaw, ears and
 * characterful hair; solid eyes with a catch light, thick brows, strong blush, a small wedge nose
 * and coloured mouths; tapered limbs, big mitten hands with fingers and a thumb, shoes with soles,
 * clothes with collars, cuffs, pockets, straps and buttons. Skin is stylised toward warm coral.
 * Faces stay flat; clothes and limbs get one darker form band away from the light (upper left),
 * and a soft contact shadow grounds the feet.
 *
 * A person stands with the feet at 0,0 and the top of the skull at −100; `update` places and
 * scales it and sets pose, walk, gaze, head turn and mood. Shapes are drawn in two unit systems:
 * the head in head units (skull top −100, chin −78) and the upper body in body units (shoulder
 * joint −71.6, hip line −44). BUILD maps both onto the figure, so adults and children share
 * every shape and differ only in proportion.
 */
import { el, random, clamp01, spring } from '../../kit/kit.js';
import { g, rr, T } from './draw.js';

const RAD = Math.PI / 180;
const SHOULDER = [10.4, -71.6], UPPER = 14.5, LOWER = 13.5, CHIN = -78, HW = 9.2;
// hs: head scale; ux, uy: upper-body scale; leg: thigh = shin length; limb, hand, shoe: thickness and size.
const BUILD = {
  adult: { hs: 1.3, ux: 1.08, uy: 1, leg: 17.75, limb: 1, hand: 1.12, shoe: 1 },
  child: { hs: 1.62, ux: 0.94, uy: 0.84, leg: 12.4, limb: 0.86, hand: 1, shoe: 0.84 },
};
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const P2 = (x, y) => `${x.toFixed(2)},${y.toFixed(2)}`;

// ---------------------------------------------------------------- colour

function hsl(c) {
  const n = parseInt(c.slice(1), 16), r = ((n >> 16) & 255) / 255, gr = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, gr, b), mn = Math.min(r, gr, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (gr - b) / d + (gr < b ? 6 : 0) : mx === gr ? (b - r) / d + 2 : (r - gr) / d + 4;
  return [h * 60, s, l];
}
function hex([h, s, l]) {
  h = ((h % 360) + 360) % 360; s = clampN(s, 0, 1); l = clampN(l, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, gr, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, gr, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
/** The form shadow of a colour: darker, a little more saturated, hue pulled toward violet. */
export function deep(c, k = 1) {
  const [h, s, l] = hsl(c);
  const dh = ((262 - h + 540) % 360) - 180;
  return s < 0.06 ? hex([262, 0.16 * k, l - 0.12 * k]) : hex([h + dh * 0.1 * k, s + 0.08 * k, l - 0.13 * k]);
}
export const bright = (c, k = 1) => { const [h, s, l] = hsl(c); return hex([h, s, l + 0.1 * k]); };
/** Stylised skin from a natural skin colour: warmer and more saturated, toward coral. */
export function skinSet(c) {
  const [h, s, l] = hsl(c);
  const face = hex([h - 4 - 6 * l, Math.min(0.75, s * 0.7 + 0.15), l - 0.05 - (l > 0.7 ? 0.03 : 0)]);
  const [fh, fs, fl] = hsl(face);
  return {
    face, dark: hex([fh - 3, fs + 0.04, fl - 0.08]), nose: hex([fh - 8, fs + 0.08, fl - 0.08]), line: hex([fh - 8, fs + 0.12, fl - 0.2]),
    blush: fl > 0.45 ? '#ff5c97' : '#e8418a', lip: fl > 0.45 ? '#7c1846' : '#4d0f2a',
  };
}
const hairTone = c => { const [h, s, l] = hsl(c); return s < 0.08 ? c : hex([h, Math.min(0.85, s * 1.1 + 0.06), l]); };

// ---------------------------------------------------------------- shapes

let uid = 0;
/** A clothed or limb part with one form band away from the light; set(d) reshapes, light(±1) mirrors. */
function part(parent, fill, { size = 10, band = 0.24, shadow } = {}) {
  const gg = el('g', {}, parent);
  const id = `pp${uid++}`;
  const clip = el('path', {}, el('clipPath', { id }, el('defs', {}, gg)));
  const body = el('g', { 'clip-path': `url(#${id})` }, gg);
  const sh = el('path', { fill: shadow ?? deep(fill) }, body);
  const base = el('path', { fill }, body);
  let dir = -1;
  const place = () => base.setAttribute('transform', `translate(${(dir * 0.62 * band * size).toFixed(2)} ${(-0.78 * band * size).toFixed(2)})`);
  place();
  return {
    g: gg,
    set(d) { clip.setAttribute('d', d); sh.setAttribute('d', d); base.setAttribute('d', d); },
    light(x) { if (x !== dir) { dir = x; place(); } },
  };
}
const flat = (parent, fill, attrs = {}) => el('path', { fill, ...attrs }, parent);
/** Fills every subpath of `d` as its own path, so overlapping pieces never cancel each other out. */
function multi(parent, fill, d, attrs = {}) {
  const gg = el('g', attrs, parent);
  d.split(/(?=M)/).forEach(piece => { if (piece.trim()) el('path', { d: piece, fill }, gg); });
  return gg;
}

/** A tapered tube from p (radius r1) to q (radius r2) with round ends. */
function capsule(p, q, r1, r2) {
  const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1e-6;
  const nx = -dy / L, ny = dx / L;
  // Arc radii are space-separated so xformPath does not take them for a point.
  return `M${P2(p[0] + nx * r1, p[1] + ny * r1)}L${P2(q[0] + nx * r2, q[1] + ny * r2)}A${r2.toFixed(2)} ${r2.toFixed(2)} 0 0 0 ${P2(q[0] - nx * r2, q[1] - ny * r2)}L${P2(p[0] - nx * r1, p[1] - ny * r1)}A${r1.toFixed(2)} ${r1.toFixed(2)} 0 0 0 ${P2(p[0] + nx * r1, p[1] + ny * r1)}Z`;
}
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const circPath = (cx, cy, r) => `M${P2(cx - r, cy)}A${r},${r} 0 1 0 ${P2(cx + r, cy)}A${r},${r} 0 1 0 ${P2(cx - r, cy)}Z`;

// Hands in hand space: wrist at 0,0, fingers toward +y, thumb toward +x. Each is [fill path, detail lines].
const capH = (x1, y1, x2, y2, r) => capsule([x1, y1], [x2, y2], r, r);
const HAND = {
  relax: () => [
    'M-2.9,0.2C-3.7,2.4 -3.7,5.8 -2.7,7.6C-1.8,9.2 0.6,9.4 1.9,8.2C3.1,7.1 3.3,4.6 2.9,1.8C2.7,0.6 2.2,-0.2 1.2,-0.4L-1.6,-0.6C-2.3,-0.5 -2.7,-0.3 -2.9,0.2Z' + capH(2.2, 1.6, 4.0, 4.4, 1.15),
    'M-0.9,6.4L-0.8,8.8M0.7,6.2L0.9,8.6',
  ],
  open: () => [
    'M-2.9,0C-3.4,1.8 -3.3,3.9 -2.6,5.2L2.6,5.2C3.3,3.9 3.4,1.8 2.9,0C2.4,-0.6 -2.4,-0.6 -2.9,0Z'
      + capH(-2.1, 4.4, -3.2, 8.6, 0.95) + capH(-0.7, 4.8, -1.0, 9.6, 0.98) + capH(0.7, 4.8, 0.9, 9.4, 0.98) + capH(2.0, 4.4, 2.9, 8.2, 0.92)
      + capH(2.4, 1.4, 5.0, 3.6, 1.05),
    '',
  ],
  fist: () => [
    'M-3.0,0.4C-3.9,2.4 -3.7,5.8 -2.0,6.8C0.0,7.9 3.0,7.3 3.5,4.8C3.8,2.8 3.2,0.7 2.2,0.0L-1.8,-0.4C-2.4,-0.3 -2.8,0 -3.0,0.4Z',
    'M-2.2,4.8Q-0.4,5.6 2.4,4.6M2.6,2.0C3.8,2.6 3.4,4.4 1.4,4.4',
  ],
  point: () => [
    'M-3.0,0.4C-3.9,2.4 -3.7,5.8 -2.0,6.8C0.0,7.9 3.0,7.3 3.5,4.8C3.8,2.8 3.2,0.7 2.2,0.0L-1.8,-0.4C-2.4,-0.3 -2.8,0 -3.0,0.4Z' + capH(-0.9, 5.6, -1.2, 12.4, 1.0),
    'M0.2,5.6Q1.6,6.4 2.8,5.4',
  ],
};
/** Maps a hand-space path to figure space: wrist w, direction angle (rad, 0 = down), mirror, scale. */
function xformPath(d, w, ang, mirror, scale) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  return d.replace(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g, (_, xs, ys) => {
    const x = parseFloat(xs) * mirror * scale, y = parseFloat(ys) * scale;
    return P2(w[0] + x * ca + y * sa, w[1] - x * sa + y * ca);
  }).replace(/A(\d*\.?\d+) (\d*\.?\d+) 0 0 0/g, (_, a, b) => `A${(a * scale).toFixed(2)} ${(b * scale).toFixed(2)} 0 0 ${mirror < 0 ? 1 : 0}`);
}

// Shoe in shoe space: ankle at 0,0, toe toward +x, sole at y = 3.2.
const SHOE = 'M-2.9,-0.4C-3.2,-2.8 0.6,-3.4 2.6,-1.9C4.4,-0.8 6.0,-0.2 6.0,1.6L6.0,2.4C6.0,3.0 5.5,3.2 5.0,3.2L-2.6,3.2C-3.3,3.2 -3.5,2.6 -3.4,1.8Z';
const SOLE = 'M-3.5,2.0L6.0,2.0L6.0,2.5C6.0,3.0 5.5,3.2 5.0,3.2L-2.6,3.2C-3.2,3.2 -3.5,2.8 -3.5,2.0Z';
const shoePath = (d, at, dir, squeeze, sc) =>
  d.replace(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g, (_, xs, ys) => P2(at[0] + parseFloat(xs) * dir * squeeze * sc, at[1] + parseFloat(ys) * sc));

// ---------------------------------------------------------------- head

/** Head outline: rounded skull, wide cheeks, soft jaw; `dx` shifts the lower face for a turn. */
function headPath(hw, jaw, dx) {
  return `M0,-100C${hw * 0.61},-100 ${hw},-97.2 ${hw},-91.4C${hw},-87.4 ${hw - 0.2 + dx * 0.3},-83.4 ${jaw + 1.2 + dx},-80.8`
    + `C${jaw * 0.72 + dx},-78.6 ${jaw * 0.36 + dx},-78 ${dx},-78C${-jaw * 0.36 + dx},-78 ${-jaw * 0.72 + dx},-78.6 ${-jaw - 1.2 + dx},-80.8`
    + `C${-hw + 0.2 + dx * 0.3},-83.4 ${-hw},-87.4 ${-hw},-91.4C${-hw},-97.2 ${-hw * 0.61},-100 0,-100Z`;
}
const EAR = 'M0,-2.6C2.8,-3.0 3.9,-0.8 3.5,1.0C3.1,2.6 1.5,3.1 0,2.4Z';
const EAR_IN = 'M0.7,-1.3C2.0,-1.4 2.5,0.1 1.8,1.1';
/** A small wedge nose with its top at x,y; the tip turns toward t (−1..1). */
function nosePath(x, y, t) {
  const r = 0.95 + Math.max(0, t) * 1.3, l = 0.95 + Math.max(0, -t) * 1.3;
  return `M${P2(x, y)}C${P2(x + r * 0.5, y + 0.9)} ${P2(x + r, y + 1.6)} ${P2(x + r * 0.9, y + 2.2)}Q${P2(x, y + 2.9)} ${P2(x - l * 0.9, y + 2.2)}C${P2(x - l, y + 1.6)} ${P2(x - l * 0.5, y + 0.9)} ${P2(x, y)}Z`;
}

/** A lobed mass (curls) around an ellipse from angle a0 to a1 (deg, 0 = right, 90 = down). */
function lobes(cx, cy, rx, ry, a0, a1, n, r) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (a0 + ((a1 - a0) * (i + 0.5)) / n) * RAD;
    d += circPath(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, r + 0.6 * Math.sin(i * 2.3) ** 2);
  }
  const ex = rx * 0.92, ey = ry * 0.92;
  return d + `M${P2(cx + ex, cy)}A${ex.toFixed(2)},${ey.toFixed(2)} 0 1 0 ${P2(cx - ex, cy)}Q${P2(cx, cy + ry * 0.2)} ${P2(cx + ex, cy)}Z`;
}
const CURL_FRINGE = [[-7.7, -94.2, 2.2], [-4.7, -95.4, 2.3], [-1.6, -95.8, 2.3], [1.5, -95.8, 2.3], [4.6, -95.4, 2.3], [7.6, -94.2, 2.2]]
  .map(([x, y, r]) => circPath(x, y, r)).join('');

/** Hair in head units (head half-width 9.2). back: behind the head; front: over it; locks: in front of the shoulders. */
function hairPaths(style, view) {
  if (view === 'back') {
    const nape = 'M-9.7,-86.4C-10.6,-96.4 -6.2,-102 0,-102C6.2,-102 10.6,-96.4 9.7,-86.4C8.6,-82.4 4.6,-80.6 0,-80.6C-4.6,-80.6 -8.6,-82.4 -9.7,-86.4Z';
    switch (style) {
      case 'bald': return { front: 'M-9.5,-86.2C-9.2,-82.2 -4.8,-80.4 0,-80.4C4.8,-80.4 9.2,-82.2 9.5,-86.2C6.2,-84.6 3.2,-84.2 0,-84.2C-3.2,-84.2 -6.2,-84.6 -9.5,-86.2Z', lines: '' };
      case 'curly': return { front: lobes(0, -91.6, 11.6, 11.0, 0, 360, 15, 2.6), lines: '' };
      case 'bob': return { front: 'M-10.8,-80.2C-11.6,-92 -7.6,-103.2 0,-103.2C7.6,-103.2 11.6,-92 10.8,-80.2Q10.6,-78.6 9.0,-78.6L-9.0,-78.6Q-10.6,-78.6 -10.8,-80.2Z', lines: 'M-4.6,-100.6Q-5.6,-90 -5.0,-79.4M0,-102.6L0,-79M4.6,-100.6Q5.6,-90 5.0,-79.4' };
      case 'long': return { front: 'M-10.6,-88C-11.6,-98.6 -6.2,-103.2 0,-103.2C6.2,-103.2 11.6,-98.6 10.6,-88C11.6,-80 12.0,-70 11.0,-62.4Q8.6,-60.8 6.6,-62.4L-6.6,-62.4Q-8.6,-60.8 -11.0,-62.4C-12.0,-70 -11.6,-80 -10.6,-88Z', lines: 'M-4.8,-100Q-6.6,-82 -5.6,-64M0,-102.6L0,-63M4.8,-100Q6.6,-82 5.6,-64' };
      case 'scarf': return { front: 'M-11.2,-80C-12.6,-93 -7.6,-104 0,-104C7.6,-104 12.6,-93 11.2,-80C11.4,-75.6 6.4,-73.4 0,-73.4C-6.4,-73.4 -11.4,-75.6 -11.2,-80Z', lines: 'M-6,-99Q-2,-90 -4,-76M4,-100Q6,-90 3,-75' };
      case 'bun': return { front: 'M-9.6,-87C-10.4,-96.4 -6.2,-101.6 0,-101.6C6.2,-101.6 10.4,-96.4 9.6,-87C8.6,-84 4.6,-82.8 0,-82.8C-4.6,-82.8 -8.6,-84 -9.6,-87Z' + circPath(0, -96.6, 4.6), lines: 'M-3.2,-99.4Q0,-96 3.2,-99.4' };
      case 'ponytail': return { front: nape + 'M-2.4,-95C-3.6,-88 -2.6,-80 0.4,-74.6C2.8,-80 3.4,-88 2.4,-95Z', lines: 'M-2.6,-95.6L2.6,-95.6' };
      default: return { front: nape, lines: 'M-5.6,-99Q-6.6,-91 -5.6,-83M0,-101.6L0,-81.6M5.6,-99Q6.6,-91 5.6,-83' };
    }
  }
  switch (style) {
    case 'short': return {
      front: 'M-9.7,-88.2C-10.7,-93.8 -9.5,-98.4 -6.6,-100.8L-7.4,-103.6L-4.4,-102.2C-3.0,-104.4 -0.4,-104.9 1.3,-103.6L2.6,-105.8L3.6,-103.0C6.8,-102.6 9.6,-99.6 9.9,-95.4L11.2,-95.6L9.9,-92.6C10.1,-91.0 9.9,-89.6 9.5,-88.2'
        + 'C8.9,-90.8 7.7,-92.7 6.1,-93.6C5.5,-92.1 4.3,-91.3 2.9,-91.4C3.2,-92.5 2.9,-93.5 2.3,-94.1C1.0,-92.4 -0.8,-91.5 -2.7,-91.6C-2.1,-92.7 -2.3,-93.7 -2.9,-94.2C-4.5,-93.0 -6.3,-92.1 -7.7,-91.9C-8.5,-90.9 -9.1,-89.7 -9.7,-88.2Z',
      lines: 'M-3.8,-100.4Q-1.4,-97.6 -1.6,-95.4M3.4,-101.2Q4.6,-98.4 4.2,-96',
    };
    case 'side': return {
      front: 'M-9.6,-87.8C-10.4,-95.8 -6.8,-101.6 -0.4,-101.8C6.0,-102.2 10.4,-98.2 9.7,-88.2C9.3,-91.6 8.5,-93.6 7.0,-94.6C4.6,-96.4 1.6,-96.4 -1.0,-95.2C-3.8,-93.9 -6.6,-91.9 -8.3,-88.6C-8.7,-87.8 -9.3,-87.5 -9.6,-87.8Z',
      lines: 'M3.4,-101.6Q4.6,-98.8 5.6,-95.6M-1.6,-100.6Q-4.6,-97 -6.4,-92.6',
    };
    case 'bun': return {
      back: circPath(0.6, -103.6, 4.6),
      front: 'M-9.5,-88.4C-10.1,-96.6 -5.8,-101.6 0,-101.6C5.8,-101.6 10.1,-96.6 9.5,-88.4C8.7,-93.4 5.8,-96.7 1.2,-97.1C0.6,-96.1 -0.6,-96.1 -1.2,-97.1C-5.8,-96.7 -8.7,-93.4 -9.5,-88.4Z'
        + 'M-8.9,-90.6C-10.3,-87.4 -9.8,-84.2 -8.2,-82.4C-8.9,-85.4 -8.7,-88 -7.9,-90.2Z M8.9,-90.6C10.3,-87.4 9.8,-84.2 8.2,-82.4C8.9,-85.4 8.7,-88 7.9,-90.2Z',
      lines: 'M-2.6,-106.4Q0.6,-108.4 3.6,-105.6M-6.4,-99.2Q-3.6,-98 -1.4,-97.6M6.4,-99.2Q3.6,-98 1.4,-97.6',
      tie: 'M-2.6,-99.6Q0.6,-100.8 3.8,-99.4L3.6,-98.2Q0.6,-99.4 -2.4,-98.4Z',
    };
    case 'ponytail': return {
      back: 'M5.6,-99.8C10.6,-101.4 13.8,-96.6 13.2,-90.4C12.8,-85.6 11.6,-82.2 12.4,-78.2C9.6,-80.4 8.8,-85 9.2,-90.2C9.4,-93.6 8.2,-95.6 5.6,-96.2Z',
      front: 'M-9.5,-88.4C-10.1,-96.6 -5.8,-101.6 0,-101.6C5.8,-101.6 10.1,-96.6 9.5,-88.4C8.9,-92.6 7.0,-95.0 4.2,-95.8C2.6,-94.2 0.4,-93.4 -1.8,-93.6C-1.4,-94.4 -1.4,-95.2 -1.8,-95.8C-4.8,-95.0 -7.8,-92.6 -9.5,-88.4Z',
      lines: 'M-4.4,-99.6Q-1.6,-97.8 0.6,-97.6M3.6,-100.6Q6.2,-99.4 7.6,-97.4',
      tie: 'M5.2,-100.6Q6.6,-98.4 6.2,-95.8L7.4,-95.6Q7.8,-98.6 6.4,-101.2Z',
    };
    case 'curly': return {
      back: lobes(0, -91.4, 12.0, 11.2, 120, 420, 13, 2.9),
      front: 'M-9.8,-92.2C-10.2,-99.6 -5.6,-103.8 0,-103.8C5.6,-103.8 10.2,-99.6 9.8,-92.2C7.6,-94.6 4.0,-95.8 0,-95.8C-4.0,-95.8 -7.6,-94.6 -9.8,-92.2Z' + CURL_FRINGE,
      lines: 'M-5.8,-100.2a1.5,1.5 0 1 1 1.7,1.9M0.6,-101.6a1.5,1.5 0 1 1 1.7,1.9M5.6,-99.0a1.4,1.4 0 1 1 1.5,1.8',
    };
    case 'bob': return {
      back: 'M-10.9,-90C-11.5,-98.8 -6.3,-103.4 0,-103.4C6.3,-103.4 11.5,-98.8 10.9,-90L11.3,-80.2Q11.1,-78.6 9.5,-78.8L-9.5,-78.8Q-11.1,-78.6 -11.3,-80.2Z',
      front: 'M-10.3,-80.0C-10.9,-86.6 -10.9,-97.6 -5.1,-101.6C-1.6,-103.6 3.6,-103.4 6.7,-101.2C10.5,-98.4 11.0,-88.4 10.3,-80.0L8.1,-80.4C8.7,-85.4 8.7,-89.6 7.9,-92.0C6.6,-92.5 5.6,-92.0 4.4,-92.6C3.0,-92.1 1.6,-92.6 0.2,-92.3C-1.4,-92.7 -2.8,-92.1 -4.2,-92.6C-5.6,-92.0 -6.6,-92.6 -7.9,-92.0C-8.7,-89.6 -8.7,-85.4 -8.1,-80.4Z',
      lines: 'M-6.6,-99Q-4.6,-97 -4.4,-93.4M0.2,-101.4L0.4,-93.2M6.4,-99.2Q4.8,-97 4.6,-93.6',
    };
    case 'long': return {
      back: 'M-10.7,-90C-11.5,-99 -6.1,-103.2 0,-103.2C6.1,-103.2 11.5,-99 10.7,-90C11.7,-80 12.1,-70 11.1,-62.2Q8.7,-60.6 6.9,-62.4L-6.9,-62.4Q-8.7,-60.6 -11.1,-62.2C-12.1,-70 -11.7,-80 -10.7,-90Z',
      front: 'M-9.9,-80.6C-10.7,-90 -8.7,-100.6 -0.5,-101.8L0.5,-101.8C8.7,-100.6 10.7,-90 9.9,-80.6C9.5,-86 8.1,-92.4 4.7,-95.4C2.9,-96.8 1.1,-97.2 0,-96.4C-1.1,-97.2 -2.9,-96.8 -4.7,-95.4C-8.1,-92.4 -9.5,-86 -9.9,-80.6Z',
      locks: 'M-9.9,-84.4C-10.9,-78 -10.7,-71.4 -9.1,-65.8C-8.3,-70 -8.5,-76.6 -8.1,-82.6Z M9.9,-84.4C10.9,-78 10.7,-71.4 9.1,-65.8C8.3,-70 8.5,-76.6 8.1,-82.6Z',
      lines: 'M-2.2,-99.6Q-5.8,-96.6 -7.6,-91.4M2.2,-99.6Q5.8,-96.6 7.6,-91.4',
    };
    case 'bald': return {
      front: 'M-9.4,-84.4C-10.1,-88.4 -9.9,-91.6 -8.7,-93.6C-8.5,-91.4 -8.1,-88.6 -7.7,-84.8Z M9.4,-84.4C10.1,-88.4 9.9,-91.6 8.7,-93.6C8.5,-91.4 8.1,-88.6 7.7,-84.8Z',
      lines: '', shine: true,
    };
    case 'scarf': return {
      back: 'M-11.2,-80C-12.6,-93 -7.6,-104 0,-104C7.6,-104 12.6,-93 11.2,-80C11.4,-75.6 6.4,-73.4 0,-73.4C-6.4,-73.4 -11.4,-75.6 -11.2,-80Z',
      front: 'M-9.1,-80.0C-9.9,-90 -8.1,-100.6 0,-100.8C8.1,-100.6 9.9,-90 9.1,-80.0C8.7,-84.6 8.3,-89.6 7.1,-92.6C4.7,-95.2 -4.7,-95.2 -7.1,-92.6C-8.3,-89.6 -8.7,-84.6 -9.1,-80.0Z',
      lines: 'M-8.4,-96.4Q-2,-99.6 6.4,-97.8M-10.2,-84Q-8.8,-79 -5.6,-75.6M10.2,-84Q8.8,-79 5.6,-75.6',
      scarf: true,
    };
    default: return hairPaths('short', view);
  }
}

// ---------------------------------------------------------------- poses

/** Arm poses: [upper-arm angle from straight down, outward positive; elbow bend] per side. */
export const POSES = {
  rest: { L: [9, -7], R: [9, -7] },
  hips: { L: [46, -78], R: [46, -78] },
  hold: { L: [20, -106], R: [20, -106] },
  type: { L: [16, -98], R: [16, -98] },
  wave: { L: [9, -7], R: [148, 24] },
  point: { L: [9, -7], R: [96, -4] },
  pointUp: { L: [9, -7], R: [150, -8] },
  shrug: { L: [58, 96], R: [58, 96] },
  cheer: { L: [158, 8], R: [158, 8] },
  think: { L: [20, -106], R: [26, -152] },
  carry: { L: [150, 30], R: [150, 30] },
  present: { L: [70, 40], R: [70, 40] },
  facepalm: { L: [9, -7], R: [139.5, 113.4] },
};
const HAND_OF = {
  rest: ['relax', 'relax'], hips: ['fist', 'fist'], hold: ['fist', 'fist'], type: ['relax', 'relax'], wave: ['relax', 'open'],
  point: ['relax', 'point'], pointUp: ['relax', 'point'], shrug: ['open', 'open'], cheer: ['open', 'open'], think: ['fist', 'fist'],
  carry: ['open', 'open'], present: ['open', 'open'], facepalm: ['relax', 'open'],
};

const lerpPose = (a, b, t) => ({ L: [a.L[0] + (b.L[0] - a.L[0]) * t, a.L[1] + (b.L[1] - a.L[1]) * t], R: [a.R[0] + (b.R[0] - a.R[0]) * t, a.R[1] + (b.R[1] - a.R[1]) * t] });

/** Pose at `time` from a list of [at, poseName] keys, each change sprung. Returns {pose, squash, name}. */
export function poseTrack(time, keys) {
  let pose = POSES[keys[0][1]], squash = 0, name = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [at, nm] = keys[i];
    if (time < at) break;
    const p = spring(time - at, { stiffness: 180, damping: 14 });
    pose = lerpPose(pose, POSES[nm], Math.min(1.08, p));
    squash = Math.sin(clamp01((time - at) / 0.35) * Math.PI) * 0.06;
    name = nm;
  }
  return { pose, squash, name };
}

function armPoints(side, [a, b]) {
  const s = [SHOULDER[0] * side, SHOULDER[1]];
  const e = [s[0] + side * Math.sin(a * RAD) * UPPER, s[1] + Math.cos(a * RAD) * UPPER];
  const c = a + b;
  const w = [e[0] + side * Math.sin(c * RAD) * LOWER, e[1] + Math.cos(c * RAD) * LOWER];
  return [s, e, w];
}

// ---------------------------------------------------------------- face parts

const MOUTH = {
  smile: { line: 'M-1.8,-81.7Q0,-79.9 1.8,-81.7' },
  happy: { fill: 'M-2.3,-82.3Q0,-81.9 2.3,-82.3Q2.1,-78.9 0,-78.9Q-2.1,-78.9 -2.3,-82.3Z', tongue: [0.4, -79.8, 1.15, 0.6] },
  flat: { line: 'M-1.4,-81.3L1.4,-81.3' },
  worried: { line: 'M-1.7,-80.7Q-0.6,-82.3 0.2,-81.5Q0.9,-80.9 1.7,-81.6' },
  o: { fill: 'M-1.05,-81.1A1.05,1.3 0 1 0 1.05,-81.1A1.05,1.3 0 1 0 -1.05,-81.1Z', tongue: [0.1, -80.3, 0.7, 0.4] },
  grin: { fill: 'M-2.9,-82.5Q0,-81.7 2.9,-82.5Q2.5,-79.1 0,-79.1Q-2.5,-79.1 -2.9,-82.5Z', teeth: 'M-2.4,-82.3Q0,-81.7 2.4,-82.3L2.2,-81.4Q0,-80.9 -2.2,-81.4Z', tongue: [0.4, -79.9, 1.3, 0.55] },
};
// Brows: [inner dy, outer dy] for the left and the right brow.
const BROWS = {
  neutral: [[0, 0], [0, 0]], raised: [[-1.0, -1.1], [-1.0, -1.1]], worried: [[-1.1, 0.4], [-1.1, 0.4]],
  angry: [[0.9, -0.5], [0.9, -0.5]], skeptic: [[0, 0.1], [-1.4, -0.9]],
};
const LIDS = { worried: 0.26, skeptic: 0.0, angry: 0.3, neutral: 0, raised: 0 };

/**
 * person(parent, opts) → {root, update(state)}.
 * opts: skin, hair, hairStyle (short|side|bun|curly|bob|ponytail|long|bald|scarf), top, sleeve
 * ('long'|'short'), bottom, shoes, hat (baker|helmet|null), hatColor, glasses, moustache, tie,
 * apron, vest, hood, collar, view ('front'|'back'), seed, scarf (headscarf colour), seated,
 * chair, child, shadow.
 */
export function person(parent, o = {}) {
  const P = {
    skin: '#f2c4a0', hair: '#5a3a22', hairStyle: 'short', top: '#45b8ff', sleeve: 'long', bottom: '#2856d8',
    shoes: '#2b2340', hat: null, hatColor: '#ffffff', glasses: false, moustache: false, tie: null, apron: null,
    vest: false, hood: false, collar: null, view: 'front', seed: 'p', scarf: '#8a6cff', seated: false, chair: null,
    child: false, shadow: true, ...o,
  };
  const back = P.view === 'back';
  const B = P.child ? BUILD.child : BUILD.adult;
  const hipY = -1.9 - 2 * B.leg;
  const chinY = hipY + (CHIN + 44) * B.uy;
  const upperT = `translate(0 ${hipY.toFixed(3)}) scale(${B.ux} ${B.uy}) translate(0 44)`;
  const headT = `translate(0 ${chinY.toFixed(3)}) scale(${B.hs}) translate(0 ${-CHIN})`;
  // The head transform seen from inside the upper body, for hair that lies over the shoulders.
  const headInUpper = `translate(0 -44) scale(${(1 / B.ux).toFixed(5)} ${(1 / B.uy).toFixed(5)}) translate(0 ${(chinY - hipY).toFixed(3)}) scale(${B.hs}) translate(0 ${-CHIN})`;
  const toFig = ([x, y]) => [x * B.ux, hipY + (y + 44) * B.uy];
  const skullTop = P.hat === 'baker' ? -115.6 : P.hat === 'helmet' ? -106.8 : P.hairStyle === 'bun' ? -108.4 : P.hairStyle === 'curly' ? -104.8 : -104;
  const TOP = -(chinY + (skullTop - CHIN) * B.hs);
  const S = skinSet(P.skin);
  const hairC = hairTone(P.hair);
  const grey = hsl(hairC)[1] < 0.08;
  const hairDeep = deep(hairC, grey ? 0.9 : 0.8);
  const browC = grey ? '#6d6a80' : deep(hairC, 1.3);
  const sd = k => random(P.seed, k);
  const hw = HW * (0.94 + sd(11) * 0.12), jaw = 5.4 + sd(12) * 1.4, eyeX = 3.8 + sd(13) * 0.5;
  const parts = [];
  const add = p => (parts.push(p), p);
  const hp = hairPaths(P.hairStyle, back ? 'back' : 'front');
  // Under a hat the bun and its tie stay hidden.
  if (P.hat && P.hairStyle === 'bun') { delete hp.back; delete hp.tie; hp.lines = ''; }
  const hairX = `scale(${(hw / HW).toFixed(3)} 1)`;
  const hairFill = P.hairStyle === 'scarf' ? P.scarf : hairC;

  const root = g(parent);
  if (P.shadow && !P.seated) el('ellipse', { cx: 0, cy: 0.4, rx: 16, ry: 2.5, fill: '#1b1f3b', opacity: 0.14 }, root);
  const fig = g(root);

  // Back to front: long hair, chair, legs, pelvis and far arm, torso, head, near arms.
  if (!back && P.hairStyle === 'long') multi(g(fig, { transform: headT }), hairDeep, hp.back, { transform: hairX });
  if (P.chair) {
    const ch = g(fig, { transform: upperT });
    add(part(ch, P.chair, { size: 16, band: 0.14 })).set(rr(-16.5, -80, 33, 44, 7));
    flat(ch, bright(P.chair, 0.9), { d: rr(-16.5, -80, 33, 4, 3) });
  }
  // One group per leg and per arm, so in a 3/4 turn the near leg covers the far one and the far arm goes behind body and legs.
  const armsBack = g(fig, { transform: upperT });
  const legsG = g(fig);
  const legs = P.seated ? [] : [-1, 1].map(() => {
    const lg = g(legsG);
    const shoe = add(part(lg, P.shoes, { size: 3.4, band: 0.3 })), sole = flat(lg, '#f1eadf');
    return { g: lg, shoe, sole, thigh: add(part(lg, P.bottom, { size: 4 })), shin: add(part(lg, P.bottom, { size: 3.6 })), hem: flat(lg, deep(P.bottom, 0.8)) };
  });
  const body = g(fig, { transform: upperT });
  if (!P.seated) add(part(body, P.bottom, { size: 9 })).set('M-11.0,-45.4L11.0,-45.4L9.8,-38.0Q0,-34.8 -9.8,-38.0Z');

  // Neck, then the torso with its clothes.
  if (!back && P.hood) flat(body, deep(P.top, 0.7), { d: 'M-8.0,-74.6C-8.6,-79.4 8.6,-79.4 8.0,-74.6C4.8,-71.6 -4.8,-71.6 -8.0,-74.6Z' });
  flat(body, S.dark, { d: rr(-3.5, -82, 7, 9.6, 2.8) });
  const torso = g(body);
  add(part(torso, P.top, { size: 14, band: 0.18 })).set('M-4.2,-75.4C-7.6,-75.6 -10.9,-74.8 -11.7,-71.0C-12.3,-67.6 -11.5,-60.6 -10.9,-53.6C-10.7,-50.4 -11.1,-47.0 -11.3,-43.6Q0,-42.0 11.3,-43.6C11.1,-47.0 10.7,-50.4 10.9,-53.6C11.5,-60.6 12.3,-67.6 11.7,-71.0C10.9,-74.8 7.6,-75.6 4.2,-75.4Q0,-73.8 -4.2,-75.4Z');
  flat(torso, deep(P.top, 0.6), { d: 'M-11.3,-43.6Q0,-42.0 11.3,-43.6L11.2,-45.0Q0,-43.4 -11.2,-45.0Z' });
  const brightVest = P.vest && hsl(P.vest)[2] > 0.45;
  // Collar, tie, placket and pockets sit in `det`, which slides with a head turn; vest and apron stay put.
  const det = g(torso);
  if (back) {
    flat(det, deep(P.top, 0.5), { d: 'M-0.35,-73.6L0.35,-73.6L0.35,-44L-0.35,-44Z', opacity: 0.5 });
    if (P.collar) flat(det, P.collar, { d: 'M-4.6,-75.6Q0,-73.2 4.6,-75.6L4.4,-72.6Q0,-70.6 -4.4,-72.6Z' });
    else flat(det, deep(P.top, 0.5), { d: 'M-4.4,-75.4Q0,-73.6 4.4,-75.4L4.2,-74.0Q0,-72.4 -4.2,-74.0Z' });
  } else {
    if (P.tie) {
      flat(det, P.collar || '#ffffff', { d: 'M-4.2,-75.4L0,-62.8L4.2,-75.4Q0,-73.8 -4.2,-75.4Z' });
      flat(det, P.tie, { d: rr(-1.15, -73.6, 2.3, 2.0, 0.7) });
      add(part(det, P.tie, { size: 2.4 })).set('M-1.05,-71.9L1.05,-71.9L2.0,-57.2L0,-54.6L-2.0,-57.2Z');
      flat(det, deep(P.top, 0.55), { d: 'M-4.4,-75.4L-0.9,-63.4L-3.6,-65.6L-5.2,-64.4L-7.0,-71.8Z M4.4,-75.4L0.9,-63.4L3.6,-65.6L5.2,-64.4L7.0,-71.8Z' });
      flat(det, deep(P.top, 0.9), { d: `${circPath(0, -58.6, 0.55)}${circPath(0, -52.6, 0.55)}` });
    } else if (P.collar) {
      flat(det, deep(P.top, 0.5), { d: 'M-0.3,-72L0.3,-72L0.3,-44.4L-0.3,-44.4Z' });
      flat(det, bright(P.top, 1.2), { d: `${circPath(0, -66.4, 0.5)}${circPath(0, -59.6, 0.5)}${circPath(0, -52.8, 0.5)}` });
      if (!P.apron && !P.vest) {
        // Breast pocket with a pen.
        flat(det, '#2856d8', { d: rr(-7.7, -68.8, 1.1, 4.0, 0.5) });
        flat(det, '#1b1f3b', { d: rr(-7.7, -68.8, 1.1, 1.2, 0.5) });
        flat(det, deep(P.top, 0.45), { d: 'M-8.6,-66.2L-4.2,-66.2L-4.2,-62.4Q-6.4,-61.2 -8.6,-62.4Z' });
      }
      flat(det, P.collar, { d: 'M-4.6,-75.6L-0.4,-71.6L-3.0,-69.6L-6.0,-73.8Z M4.6,-75.6L0.4,-71.6L3.0,-69.6L6.0,-73.8Z' });
    } else if (!P.hood) {
      flat(det, bright(P.top, 1.1), { d: 'M-4.6,-75.4Q0,-72.8 4.6,-75.4Q0,-71.4 -4.6,-75.4Z' });
    }
    if (P.hood) {
      flat(det, deep(P.top, 0.4), { d: 'M-7.2,-55.4L7.2,-55.4L8.4,-47.4L-8.4,-47.4Z' });
      flat(det, bright(P.top, 0.6), { d: 'M-6.6,-55.4L6.6,-55.4L6.6,-54.6L-6.6,-54.6Z' });
      el('path', { d: 'M-2.2,-73.2L-2.6,-65.2M2.2,-73.2L2.6,-65.2', stroke: '#f6f0e4', 'stroke-width': 0.6, 'stroke-linecap': 'round', fill: 'none' }, det);
      flat(det, '#f6f0e4', { d: `${circPath(-2.6, -64.9, 0.55)}${circPath(2.6, -64.9, 0.55)}` });
      flat(det, bright(P.top, 1.1), { d: 'M-4.4,-75.4Q0,-73.2 4.4,-75.4Q0,-72.2 -4.4,-75.4Z' });
    }
    if (P.vest) {
      const vc = P.vest;
      flat(torso, vc, { d: 'M-11.7,-71.0C-11.1,-74.2 -8.4,-75.4 -5.0,-75.4L-2.6,-43.4L-11.3,-43.6C-11.1,-47.0 -10.7,-50.4 -10.9,-53.6C-11.5,-60.6 -12.3,-67.6 -11.7,-71.0Z M11.7,-71.0C11.1,-74.2 8.4,-75.4 5.0,-75.4L2.6,-43.4L11.3,-43.6C11.1,-47.0 10.7,-50.4 10.9,-53.6C11.5,-60.6 12.3,-67.6 11.7,-71.0Z' });
      if (brightVest) flat(torso, '#eef3f6', { d: 'M-11.3,-59.4L-3.4,-59.4L-3.3,-57.4L-11.2,-57.4Z M11.3,-59.4L3.4,-59.4L3.3,-57.4L11.2,-57.4Z M-10.8,-51.6L-3.0,-51.6L-2.9,-49.6L-10.8,-49.6Z M10.8,-51.6L3.0,-51.6L2.9,-49.6L10.8,-49.6Z' });
      else flat(torso, deep(vc, 0.6), { d: 'M-9.6,-52L-5,-52L-5,-50.6L-9.4,-50.6Z M9.6,-52L5,-52L5,-50.6L9.4,-50.6Z' });
    }
    if (P.apron) {
      const ac = P.apron;
      add(part(torso, ac, { size: 10, band: 0.16 })).set('M-6.0,-66.6L6.0,-66.6L6.6,-53.0L9.0,-52.6L10.0,-37.6Q0,-35.8 -10.0,-37.6L-9.0,-52.6L-6.6,-53.0Z');
      flat(torso, deep(ac, 0.45), { d: rr(-4.4, -49.2, 8.8, 5.0, 1.2) });
      el('path', { d: 'M-5.0,-66.4Q-4.4,-71.8 -3.0,-75.2M5.0,-66.4Q4.4,-71.8 3.0,-75.2', stroke: ac, 'stroke-width': 1.4, 'stroke-linecap': 'round', fill: 'none' }, torso);
      flat(torso, '#ff8a3d', { d: `${circPath(-4.8, -65.4, 0.85)}${circPath(4.8, -65.4, 0.85)}` });
    }
  }
  // Long-hair locks fall in front of the shoulders.
  if (!back && hp.locks) multi(g(body, { transform: headInUpper }), hairC, hp.locks, { transform: hairX });

  // Head.
  const headWrap = g(fig, { transform: headT });
  const head = g(headWrap);
  const ears = [-1, 1].map(() => {
    const eg = g(head);
    flat(eg, S.dark, { d: EAR });
    el('path', { d: EAR_IN, fill: 'none', stroke: S.line, 'stroke-width': 0.5, 'stroke-linecap': 'round' }, eg);
    return eg;
  });
  const hairBack = g(head);
  if (!back && hp.back && P.hairStyle !== 'long') multi(hairBack, P.hairStyle === 'scarf' ? deep(P.scarf, 0.6) : hairDeep, hp.back);
  const skull = flat(head, S.face);
  // Face features are clipped to the skull, so they wrap around it in a turn.
  const faceId = `fc${uid++}`;
  const faceClip = el('path', {}, el('clipPath', { id: faceId }, el('defs', {}, head)));
  const face = g(head, { 'clip-path': `url(#${faceId})` });
  let eyes = [], brows = [], nose = null, mouth = {}, blush = [], fringe = null;
  if (!back) {
    // The fringe and a hat brim cast a soft shadow on the forehead.
    fringe = multi(face, S.dark, hp.front);
    if (P.hat === 'helmet') flat(face, S.dark, { d: rr(-12.6, -93.4, 25.2, 2.6, 1.2) });
    blush = [0, 1].map(() => el('ellipse', { rx: 1.8, ry: 1.0, fill: S.blush }, face));
    nose = flat(face, S.nose);
    eyes = [0, 1].map(() => {
      const eg = g(face);
      const ball = g(eg);
      el('ellipse', { cx: 0, cy: 0, rx: 1.25, ry: 1.5, fill: '#2a1a38' }, ball);
      el('circle', { cx: 0.42, cy: -0.55, r: 0.4, fill: '#ffffff' }, ball);
      const lid = el('path', { fill: S.face }, eg);
      const lidLine = el('path', { fill: 'none', stroke: '#2a1a38', 'stroke-width': 0.42, 'stroke-linecap': 'round' }, eg);
      const arc = el('path', { d: 'M-1.4,0.5Q0,-1.4 1.4,0.5', fill: 'none', stroke: '#2a1a38', 'stroke-width': 0.7, 'stroke-linecap': 'round' }, eg);
      return { g: eg, ball, lid, lidLine, arc };
    });
    mouth.fill = el('path', { fill: S.lip }, face);
    mouth.tongue = el('ellipse', { fill: '#ff6f8e' }, face);
    mouth.teeth = el('path', { fill: '#ffffff' }, face);
    mouth.line = el('path', { fill: 'none', stroke: S.lip, 'stroke-width': 0.8, 'stroke-linecap': 'round' }, face);
  }
  const moustache = !back && P.moustache ? flat(face, hairC) : null;
  const hairFront = g(head);
  multi(hairFront, hairFill, hp.front);
  if (hp.lines) el('path', { d: hp.lines, fill: 'none', stroke: P.hairStyle === 'scarf' ? deep(P.scarf, 0.5) : (grey ? '#ffffff' : bright(hairC, 0.9)), 'stroke-width': 0.6, 'stroke-linecap': 'round', opacity: grey ? 0.45 : 0.55 }, hairFront);
  if (hp.tie) flat(hairFront, '#ff5c97', { d: hp.tie });
  if (hp.scarf) flat(hairFront, '#ffd43b', { d: circPath(6.4, -80.6, 0.8) });
  if (hp.shine) el('ellipse', { cx: -3.6, cy: -97.0, rx: 2.8, ry: 1.2, fill: '#ffffff', opacity: 0.35, transform: 'rotate(-18 -3.6 -97)' }, head);
  // Brows sit over the fringe so expressions stay readable.
  if (!back) brows = [0, 1].map(() => el('path', { fill: 'none', stroke: browC, 'stroke-width': 1.2, 'stroke-linecap': 'round' }, head));
  // Hats.
  if (P.hat === 'baker') {
    const hc = P.hatColor;
    const puff = circPath(-4.6, -107.6, 4.4) + circPath(0.4, -110.4, 5.0) + circPath(5.0, -107.4, 4.2) + rr(-7.4, -108.4, 14.8, 6.4, 2);
    multi(head, deep(hc, 0.45), puff, { transform: 'translate(0.9 0.7)' });
    multi(head, hc, puff);
    el('path', { d: 'M-2.6,-102.4L-2.2,-106.4M1.0,-102.4L1.2,-107.4M4.4,-102.4L4.8,-105.6', stroke: deep(hc, 0.35), 'stroke-width': 0.5, 'stroke-linecap': 'round', fill: 'none' }, head);
    add(part(head, hc, { size: 4, band: 0.2 })).set(rr(-8.2, -103.4, 16.4, 4.8, 1.8));
  } else if (P.hat === 'helmet') {
    const hc = P.hatColor;
    add(part(head, hc, { size: 10, band: 0.2 })).set('M-10.3,-93.6C-10.5,-102.6 -5.3,-106.6 0,-106.6C5.3,-106.6 10.5,-102.6 10.3,-93.6Z');
    flat(head, bright(hc, 0.8), { d: rr(-1.5, -106.2, 3.0, 11.6, 1.5) });
    add(part(head, hc, { size: 3, band: 0.3 })).set(rr(-12.6, -95.0, 25.2, 3.0, 1.5));
    el('ellipse', { cx: -5.0, cy: -101.6, rx: 2.4, ry: 1.0, fill: '#ffffff', opacity: 0.45, transform: 'rotate(-28 -5 -101.6)' }, head);
  }
  // Glasses.
  const glasses = !back && P.glasses ? el('path', { fill: 'rgba(255,255,255,0.18)', stroke: '#24203a', 'stroke-width': 0.6, 'stroke-linejoin': 'round' }, head) : null;
  const glare = glasses ? el('path', { fill: 'none', stroke: '#ffffff', 'stroke-width': 0.45, 'stroke-linecap': 'round', opacity: 0.7 }, head) : null;

  // Near arms go over the head, so a hand can reach the face.
  const armsFront = g(fig, { transform: upperT });
  const skinArm = P.sleeve === 'short';
  const arms = [-1, 1].map(side => {
    const a = { side, g: g(armsFront) };
    a.upper = add(part(a.g, skinArm ? S.face : P.top, { size: 3.6 }));
    if (skinArm) a.sleeve = add(part(a.g, P.top, { size: 4.2 }));
    a.fore = add(part(a.g, skinArm ? S.face : P.top, { size: 3.0 }));
    if (!skinArm) a.cuff = flat(a.g, deep(P.top, 0.55));
    a.hand = add(part(a.g, S.face, { size: 3.4, band: 0.22, shadow: S.dark }));
    a.lines = el('path', { fill: 'none', stroke: S.line, 'stroke-width': 0.42, 'stroke-linecap': 'round', opacity: 0.8 }, a.g);
    return a;
  });

  /**
   * state: x, y (feet), h (height in px), t (time s), pose {L,R} or name, hands ['relax'|'open'|
   * 'fist'|'point', …], walk (phase in rad or null), look [-1..1, -1..1], turn (−1..1), mood,
   * brows, blush (0..1), lean (deg), squash (0..0.1), flip (mirror), bob, headTilt (deg), closed,
   * wave, opacity. Returns {hands, head, box} in the parent's coordinates.
   */
  function update(s) {
    const t = s.t ?? 0;
    const poseName = typeof s.pose === 'string' ? s.pose : null;
    const pose = poseName ? POSES[poseName] : (s.pose || POSES.rest);
    const k = (s.h ?? 100) / 100, fs = s.flip ? -1 : 1;
    const X = s.x ?? 0, Y = s.y ?? 0;
    parts.forEach(p => p.light(s.flip ? 1 : -1));
    const breath = 1 + 0.012 * Math.sin(t * Math.PI * 0.5 + sd(7) * 6);
    const sq = s.squash ?? 0;
    T(root, X, Y, k * fs, 0, k);
    if (s.opacity !== undefined) root.setAttribute('opacity', s.opacity);

    const walking = s.walk !== null && s.walk !== undefined;
    const ph = walking ? s.walk : 0;
    const look = s.look || [0, 0];
    const turn = clampN(s.turn ?? (walking ? 0.55 : look[0] * 0.5), -1, 1);
    // In a turn toward +x the screen-right side is the far one.
    const farSide = turn >= 0 ? 1 : -1, deepTurn = Math.abs(turn) > 0.3;

    // Legs: two bones; the body bobs so the planted foot stays on the ground.
    const legPts = side => {
      const hip = [side * 5.4, hipY];
      if (!walking) return [hip, [side * 5.6, hipY + B.leg], [side * 5.4, hipY + 2 * B.leg]];
      const phase = ph + (side < 0 ? 0 : Math.PI);
      const sw = Math.sin(phase) * 24 * RAD, flex = Math.max(0, Math.sin(phase + 1.6)) * 40 * RAD;
      const knee = [hip[0] + Math.sin(sw) * B.leg, hip[1] + Math.cos(sw) * B.leg];
      const a2 = sw - flex;
      return [hip, knee, [knee[0] + Math.sin(a2) * B.leg, knee[1] + Math.cos(a2) * B.leg]];
    };
    const L2 = legs.map((_, i) => legPts(i ? 1 : -1));
    const lowest = L2.length ? Math.max(...L2.map(l => l[2][1])) : hipY + 2 * B.leg;
    const bodyBob = (walking ? hipY + 2 * B.leg - lowest : 0) + (s.bob ?? 0);
    const sway = walking ? 0 : Math.sin(t * 0.9 + sd(5) * 6) * 0.5;
    T(fig, 0, bodyBob, 1, (s.lean ?? 0) + sway);
    const lm = B.limb;
    legs.forEach((leg, i) => {
      const [hip, knee, ankle] = L2[i];
      const side = i ? 1 : -1;
      leg.thigh.set(capsule(hip, knee, 4.3 * lm, 3.6 * lm));
      leg.shin.set(capsule(knee, ankle, 3.5 * lm, 3.0 * lm));
      leg.hem.setAttribute('d', capsule(lerp2(knee, ankle, 0.84), ankle, 3.25 * lm, 3.2 * lm));
      const dir = walking ? 1 : side, squeeze = walking ? 1 : 0.78;
      const at = [ankle[0], ankle[1] + 1.9 - 3.2 * B.shoe];
      leg.shoe.set(shoePath(SHOE, at, dir, squeeze, B.shoe));
      leg.sole.setAttribute('d', shoePath(SOLE, at, dir, squeeze, B.shoe));
    });
    if (legs.length) legsG.appendChild(legs[farSide > 0 ? 0 : 1].g);
    torso.setAttribute('transform', `translate(0 -44) scale(${(1 + sq * 0.5).toFixed(4)} ${(breath * (1 - sq)).toFixed(4)}) translate(0 44)`);
    det.setAttribute('transform', `translate(${(turn * 1.4).toFixed(2)} 0)`);

    // Arms and hands, in body units.
    const handTypes = s.hands || (poseName && HAND_OF[poseName]) || ['relax', 'relax'];
    const lift = (1 - breath) * 20;
    arms.forEach((arm, i) => {
      const key = arm.side === -1 ? 'L' : 'R';
      let [a, b] = pose[key];
      // Arms swing against the legs; in screen space that is the same angle change on both sides.
      // The near arm swings across the body only a little, so its hand stays clear of the hips.
      if (walking && (s.pose === undefined || s.pose === 'rest')) {
        const sw = Math.sin(ph) * 13;
        a += arm.side * farSide < 0 && sw < 0 ? sw * 0.4 : sw;
      }
      if (s.wave && key === 'R') b += Math.sin(t * 9) * 16;
      let [sp, e, w] = armPoints(arm.side, [a, b]);
      // A far arm goes behind the body when it hangs or reaches out to its own side at shoulder height or below.
      // One that comes across the body (at the face, a fist at the chest) or rises past the head stays in front.
      const far = deepTurn && arm.side === farSide &&
        ((a < 60 && Math.abs(b) < 45) || (w[0] * arm.side > 14 && w[1] > SHOULDER[1] - 8));
      (far ? armsBack : armsFront).appendChild(arm.g);
      const inX = far ? -arm.side * 2.6 * Math.abs(turn) : 0;
      sp = [sp[0] + inX, sp[1] + lift]; e = [e[0] + inX, e[1] + lift]; w = [w[0] + inX, w[1] + lift];
      arm.upper.set(capsule(sp, e, 3.7, 3.1));
      if (arm.sleeve) arm.sleeve.set(capsule(sp, lerp2(sp, e, 0.55), 4.4, 3.9));
      arm.fore.set(capsule(e, w, 3.0, 2.5));
      if (arm.cuff) arm.cuff.setAttribute('d', capsule(lerp2(e, w, 0.8), w, 2.65, 2.55));
      const ang = Math.atan2(w[0] - e[0], w[1] - e[1]);
      const [hd, ln] = (HAND[handTypes[i]] || HAND.relax)();
      const mirror = -arm.side;
      arm.hand.set(xformPath(hd, w, ang, mirror, B.hand));
      arm.lines.setAttribute('d', ln ? xformPath(ln, w, ang, mirror, B.hand) : '');
      arm.palm = [w[0] + Math.sin(ang) * 3.6 * B.hand, w[1] + Math.cos(ang) * 3.6 * B.hand];
    });

    // Head: turn, tilt, features (head units).
    head.setAttribute('transform', `translate(0 -80) rotate(${(s.headTilt ?? 0).toFixed(2)}) translate(0 80) translate(0 ${((breath - 1) * -14).toFixed(2)})`);
    const skullD = headPath(hw, jaw, turn * 2.2);
    skull.setAttribute('d', skullD);
    faceClip.setAttribute('d', skullD);
    if (fringe) fringe.setAttribute('transform', `translate(${(turn * 0.45).toFixed(2)} 1.3) ${hairX}`);
    ears.forEach((eg, i) => {
      const side = i ? 1 : -1;
      eg.setAttribute('transform', `translate(${(side * (hw - 0.4) + turn * 1.0).toFixed(2)} -88.4) scale(${side} 1)`);
      eg.setAttribute('opacity', side * turn > 0.55 ? 0 : 1);
    });
    hairBack.setAttribute('transform', `translate(${(-turn * 0.9).toFixed(2)} 0) ${hairX}`);
    hairFront.setAttribute('transform', `translate(${(turn * 0.45).toFixed(2)} 0) ${hairX}`);
    if (!back) {
      const at = Math.abs(turn);
      const fx = x => x * (1 - 0.2 * at) + turn * 3.8 + look[0] * 0.45;
      const fy = y => y + look[1] * 0.9;
      const mood = s.mood || 'smile';
      const happyEyes = mood === 'happy' || mood === 'grin';
      const period = 3 + sd(3) * 1.5;
      const blinkT = (t + sd(4) * period) % period;
      const blink = blinkT < 0.13 || s.closed ? 0.1 : 1;
      const browKey = s.brows || 'neutral';
      let lid = LIDS[browKey] ?? 0;
      if (mood === 'flat' && browKey === 'neutral') lid = 0.18;
      eyes.forEach((eye, i) => {
        const side = i ? 1 : -1;
        const far = side * turn > 0 ? 1 - 0.3 * at : 1;
        eye.g.setAttribute('transform', `translate(${fx(side * eyeX).toFixed(2)} ${fy(-88.4).toFixed(2)}) scale(${far.toFixed(3)} ${blink})`);
        const myLid = browKey === 'skeptic' ? (i ? 0 : 0.42) : lid;
        eye.ball.setAttribute('opacity', happyEyes ? 0 : 1);
        eye.arc.setAttribute('opacity', happyEyes ? 1 : 0);
        const ly = -1.6 + myLid * 3.0;
        eye.lid.setAttribute('d', myLid > 0 && !happyEyes ? `M-1.6,-1.8L1.6,-1.8L1.6,${ly.toFixed(2)}L-1.6,${ly.toFixed(2)}Z` : '');
        eye.lidLine.setAttribute('d', myLid > 0 && !happyEyes ? `M-1.5,${ly.toFixed(2)}L1.5,${ly.toFixed(2)}` : '');
      });
      const bw = BROWS[browKey] || BROWS.neutral;
      brows.forEach((br, i) => {
        const side = i ? 1 : -1;
        const [di, dout] = bw[i];
        br.setAttribute('d', `M${P2(fx(side * 1.9), fy(-91.9 + di))}Q${P2(fx(side * 3.7), fy(-92.5 + (di + dout) / 2))} ${P2(fx(side * 5.4), fy(-91.8 + dout))}`);
      });
      // Even a front view shows the nose as a wedge to one side.
      nose.setAttribute('d', nosePath(fx(0), fy(-86.6), clampN(turn + (turn < -0.05 ? -0.45 : 0.45), -1, 1)));
      const bl = s.blush ?? ({ happy: 0.95, grin: 0.95, smile: 0.8, o: 0.7, flat: 0.5, worried: 0.55 }[mood] ?? 0.7);
      blush.forEach((b, i) => {
        const side = i ? 1 : -1;
        const far = side * turn > 0 ? 1 - 0.4 * at : 1;
        b.setAttribute('cx', fx(side * 5.9).toFixed(2));
        b.setAttribute('cy', fy(-85.1).toFixed(2));
        b.setAttribute('rx', (1.85 * far).toFixed(2));
        b.setAttribute('opacity', bl);
      });
      const M = MOUTH[mood] || MOUTH.smile;
      const tr = `translate(${(turn * 3.3 + look[0] * 0.4).toFixed(2)} ${(look[1] * 0.9 - 0.3).toFixed(2)})`;
      ['fill', 'tongue', 'teeth', 'line'].forEach(key => mouth[key].setAttribute('transform', tr));
      mouth.fill.setAttribute('d', M.fill || '');
      mouth.teeth.setAttribute('d', M.teeth || '');
      mouth.line.setAttribute('d', M.line || '');
      if (M.tongue) { const [cx, cy, rx, ry] = M.tongue; Object.entries({ cx, cy, rx, ry }).forEach(([kk, v]) => mouth.tongue.setAttribute(kk, v)); mouth.tongue.setAttribute('opacity', 1); }
      else mouth.tongue.setAttribute('opacity', 0);
      if (moustache) {
        const c = fx(0) + turn * 0.4, y0 = fy(-83.0);
        moustache.setAttribute('d', `M${P2(c - 3.2, y0 + 0.4)}C${P2(c - 2.4, y0 - 1.6)} ${P2(c - 0.7, y0 - 1.5)} ${P2(c, y0 - 0.8)}C${P2(c + 0.7, y0 - 1.5)} ${P2(c + 2.4, y0 - 1.6)} ${P2(c + 3.2, y0 + 0.4)}C${P2(c + 1.8, y0 + 0.2)} ${P2(c + 0.6, y0 - 0.1)} ${P2(c, y0 - 0.3)}C${P2(c - 0.6, y0 - 0.1)} ${P2(c - 1.8, y0 + 0.2)} ${P2(c - 3.2, y0 + 0.4)}Z`);
      }
      if (glasses) {
        const lx = fx(-eyeX), rx = fx(eyeX), y = fy(-88.4);
        const wl = 5.0 * (turn < 0 ? 1 - 0.3 * at : 1), wr = 5.0 * (turn > 0 ? 1 - 0.3 * at : 1);
        glasses.setAttribute('d', `${rr(lx - wl / 2, y - 2.1, wl, 4.2, 1.8)}${rr(rx - wr / 2, y - 2.1, wr, 4.2, 1.8)}M${P2(lx + wl / 2, y - 0.6)}Q${P2((lx + rx) / 2, y - 1.5)} ${P2(rx - wr / 2, y - 0.6)}`);
        glare.setAttribute('d', `M${P2(lx - 1.2, y + 1.0)}L${P2(lx - 0.1, y - 1.1)}M${P2(rx - 1.2, y + 1.0)}L${P2(rx - 0.1, y - 1.1)}`);
      }
    }

    const sc = Math.abs(k);
    return {
      hands: arms.map(a => { const [hx, hy] = toFig(a.palm); return [X + hx * k * fs, Y + (hy + bodyBob) * k]; }),
      head: [X, Y + (chinY - 11 * B.hs + bodyBob) * k],
      box: [X - 22 * sc, Y - TOP * sc, 44 * sc, TOP * sc],
    };
  }
  return { root, update };
}

/** A head-and-shoulders bust seen from behind (audiences, journalists). Base at 0,0, width w. */
export function backBust(parent, w, { skin = '#f2c4a0', hair = '#5a3a22', top = '#45b8ff', style = 'short', seed = 'b' } = {}) {
  const gg = g(parent);
  const b = g(gg, { transform: `scale(${w / 40})` });
  const S = skinSet(skin), hc = hairTone(hair);
  const k = 1.3 * (0.95 + random(seed, 1) * 0.1);
  part(b, top, { size: 16, band: 0.16 }).set('M-20,0C-20,-11 -15,-16.8 -7,-17.6L7,-17.6C15,-16.8 20,-11 20,0Z');
  flat(b, deep(top, 0.5), { d: 'M-6.6,-17.6Q0,-15.4 6.6,-17.6L6.2,-16.2Q0,-14.2 -6.2,-16.2Z' });
  flat(b, S.dark, { d: rr(-3.8, -23, 7.6, 7, 2.6) });
  // The head from behind, in head units, with the chin just above the collar.
  const h = g(b, { transform: `translate(0 -17.5) scale(${k.toFixed(3)}) translate(0 ${-CHIN})` });
  [-1, 1].forEach(side => flat(g(h, { transform: `translate(${side * 8.8} -88.4) scale(${side} 1)` }), S.dark, { d: EAR }));
  flat(h, S.face, { d: headPath(HW, 6, 0) });
  const hp = hairPaths(style, 'back');
  multi(h, style === 'scarf' ? '#8a6cff' : hc, hp.front);
  if (hp.lines) el('path', { d: hp.lines, fill: 'none', stroke: bright(hc, 0.9), 'stroke-width': 0.6, 'stroke-linecap': 'round', opacity: 0.45 }, h);
  return gg;
}
