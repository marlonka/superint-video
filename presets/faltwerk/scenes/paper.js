// The cut-paper drawing kit. All measures are millimetres; x is a 2D context a sheet hands to its draw().
// A picture is built the way a paper artist builds it: coloured sheets cut to shape and glued on top of
// each other. layer() is one such sheet: it throws a small soft shadow on what lies below.
import { DENS } from './book.js';

export const TAU = Math.PI * 2;
// Pixels per millimetre of the sheet being painted.
const sc = x => { const m = x.getTransform(); return Math.hypot(m.a, m.b) || DENS; };
export const rnd = (seed, i = 0) => { const s = Math.sin(seed * 127.1 + i * 311.7 + 74.7) * 43758.5453; return s - Math.floor(s); };

// ---------------------------------------------------------------- colours
export const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
export const rgba = (h, a = 1) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; };
export function tone(h, k) {   // k < 0 darker, k > 0 lighter, -1..1
  const c = hexRgb(h).map(v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
export function blend(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------- paper tooth
let TOOTH = null;
function toothTile() {
  if (TOOTH) return TOOTH;
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  for (let i = 0; i < 2600; i++) {
    const px = rnd(1, i) * 512, py = rnd(2, i) * 512, a = rnd(3, i) * TAU, l = 2 + rnd(4, i) * 7, lightK = rnd(5, i) > .5;
    x.strokeStyle = lightK ? `rgba(255,255,255,${.015 + rnd(6, i) * .035})` : `rgba(40,25,10,${.012 + rnd(6, i) * .026})`;
    x.lineWidth = .5 + rnd(7, i) * .8; x.beginPath(); x.moveTo(px, py);
    x.quadraticCurveTo(px + Math.cos(a) * l * .5 + (rnd(8, i) - .5) * 4, py + Math.sin(a) * l * .5 + (rnd(9, i) - .5) * 4, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  for (let i = 0; i < 1400; i++) { x.fillStyle = rnd(11, i) > .5 ? 'rgba(255,255,255,.05)' : 'rgba(30,20,10,.04)'; x.fillRect(rnd(12, i) * 512, rnd(13, i) * 512, 1 + rnd(14, i), 1 + rnd(15, i)); }
  return TOOTH = c;
}
function toothFill(x) {
  const p = x.createPattern(toothTile(), 'repeat'); p.setTransform(new DOMMatrix().scale(1 / sc(x))); x.fillStyle = p; x.fillRect(-2000, -2000, 4000, 4000);
}

// ---------------------------------------------------------------- one glued sheet
// shape(x) traces the outline (no beginPath needed). o.lift: how far the sheet stands off, in mm (0: printed, no shadow).
export function layer(x, color, shape, o = {}) {
  const lift = o.lift === undefined ? .5 : o.lift;
  x.save();
  if (lift > 0) { x.shadowColor = `rgba(28,16,8,${o.sh === undefined ? .34 : o.sh})`; { const k = sc(x); x.shadowBlur = lift * 2.1 * k; x.shadowOffsetX = lift * .55 * k; x.shadowOffsetY = lift * .85 * k; } }
  x.fillStyle = color; x.beginPath(); shape(x); x.fill(o.rule || 'nonzero');
  x.restore();
  if (o.tooth !== false) { x.save(); x.beginPath(); shape(x); x.clip(o.rule || 'nonzero'); toothFill(x); if (o.shade) o.shade(x); x.restore(); }
}
// Draws inside a shape: for printed detail on a sheet.
export function inside(x, shape, fn) { x.save(); x.beginPath(); shape(x); x.clip(); fn(x); x.restore(); }
// A soft dark-to-light wash inside the current clip, for sheets that bend a little.
export const wash = (x0, y0, x1, y1, c0, c1) => x => { const g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); x.fillStyle = g; x.fillRect(-2000, -2000, 4000, 4000); };

// ---------------------------------------------------------------- outlines
export const rect = (a, b, w, h) => x => x.rect(a, b, w, h);
export const rrect = (a, b, w, h, r) => x => { r = Math.min(r, w / 2, h / 2); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); };
export const circle = (cx, cy, r) => x => { x.moveTo(cx + r, cy); x.arc(cx, cy, r, 0, TAU); };
export const ellipse = (cx, cy, rx, ry, rot = 0) => x => { x.moveTo(cx + rx * Math.cos(rot), cy + rx * Math.sin(rot)); x.ellipse(cx, cy, rx, ry, rot, 0, TAU); };
export const poly = pts => x => { x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.closePath(); };
// A closed curve through points, round like something cut freehand with scissors.
export const curve = (pts, k = .5) => x => {
  const n = pts.length; x.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; x.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  x.closePath();
};
// A lumpy round shape: tree crowns, clouds, bushes.
export const blob = (cx, cy, rx, ry, seed = 1, n = 9, jit = .16) => {
  const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, k = 1 + (rnd(seed, i) - .5) * 2 * jit; pts.push([cx + Math.cos(a) * rx * k * 1.08, cy + Math.sin(a) * ry * k * 1.08]); }
  return curve(pts);
};
// An arch: a rectangle with a round top.
export const arch = (a, b, w, h) => x => { const r = w / 2; x.moveTo(a, b + h); x.lineTo(a, b + r); x.arc(a + r, b + r, r, Math.PI, 0); x.lineTo(a + w, b + h); x.closePath(); };
// A ground or roof line: closed below at y = base. pts run left to right.
export const ridge = (pts, base, smoothK = true) => x => {
  x.moveTo(pts[0][0], base); x.lineTo(pts[0][0], pts[0][1]);
  if (smoothK) { for (let i = 1; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1]; x.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); } const l = pts[pts.length - 1]; x.lineTo(l[0], l[1]); }
  else for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
  x.lineTo(pts[pts.length - 1][0], base); x.closePath();
};
export function stroke(x, pts, color, w, o = {}) {
  x.save(); x.strokeStyle = color; x.lineWidth = w; x.lineCap = o.cap || 'round'; x.lineJoin = 'round'; if (o.dash) x.setLineDash(o.dash);
  if (o.lift) { x.shadowColor = 'rgba(28,16,8,.3)'; { const k = sc(x); x.shadowBlur = o.lift * 2.1 * k; x.shadowOffsetX = o.lift * .55 * k; x.shadowOffsetY = o.lift * .85 * k; } }
  x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
  if (o.smooth && pts.length > 2) { for (let i = 1; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1]; x.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); } const l = pts[pts.length - 1]; x.lineTo(l[0], l[1]); }
  else for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
  x.stroke(); x.restore();
}

// ---------------------------------------------------------------- lettering
// size: cap height feel in mm (font size). o: {font, weight, align, track (mm between letters), color, lift}
export function text(x, s, cx, cy, size, o = {}) {
  x.save();
  x.font = `${o.weight || 600} ${size}px ${o.font || 'Fraunces'}`; x.textBaseline = o.base || 'middle'; x.fillStyle = o.color || '#2b2420';
  if (o.lift) { x.shadowColor = 'rgba(28,16,8,.3)'; { const k = sc(x); x.shadowBlur = o.lift * 2.1 * k; x.shadowOffsetX = o.lift * .55 * k; x.shadowOffsetY = o.lift * .85 * k; } }
  const tr = o.track || 0;
  if (!tr) { x.textAlign = o.align || 'center'; x.fillText(s, cx, cy); x.restore(); return x.measureText(s).width; }
  let w = 0; for (const ch of s) w += x.measureText(ch).width + tr; w -= tr;
  let px = o.align === 'left' ? cx : o.align === 'right' ? cx - w : cx - w / 2;
  x.textAlign = 'left';
  for (const ch of s) { x.fillText(ch, px, cy); px += x.measureText(ch).width + tr; }
  x.restore(); return w;
}
export function textWidth(x, s, size, o = {}) { x.save(); x.font = `${o.weight || 600} ${size}px ${o.font || 'Fraunces'}`; let w = 0; const tr = o.track || 0; if (!tr) w = x.measureText(s).width; else { for (const ch of s) w += x.measureText(ch).width + tr; w -= tr; } x.restore(); return w; }
// Flowing text set in lines; returns the y after the last line.
export function para(x, s, x0, y0, maxW, size, o = {}) {
  x.save(); x.font = `${o.weight || 600} ${size}px ${o.font || 'Fraunces'}`; x.fillStyle = o.color || '#2b2420'; x.textBaseline = 'alphabetic'; x.textAlign = o.align || 'left';
  const lh = size * (o.lead || 1.36); let y = y0;
  for (const par of s.split('\n')) {
    let line = '';
    for (const w of par.split(' ')) { const n = line ? line + ' ' + w : w; if (x.measureText(n).width > maxW && line) { x.fillText(line, o.align === 'center' ? x0 + maxW / 2 : x0, y); y += lh; line = w; } else line = n; }
    x.fillText(line, o.align === 'center' ? x0 + maxW / 2 : x0, y); y += lh;
  }
  x.restore(); return y;
}

// ---------------------------------------------------------------- page ground
// A printed page: warm paper, a darker gutter, a hint of age at the edges.
export function pageGround(x, W, H, side, c = '#efe6d2', seed = 1) {
  x.fillStyle = c; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(${120 + 40 * rnd(seed, i)},${90 + 30 * rnd(seed + 1, i)},50,${.008 + .012 * rnd(seed + 2, i)})`; x.beginPath(); x.arc(rnd(seed + 3, i) * W, rnd(seed + 4, i) * H, 6 + rnd(seed + 5, i) * 34, 0, TAU); x.fill(); }
  x.save(); toothFill(x); x.restore();
  const gx = side === 'L' ? W : 0, g = x.createLinearGradient(gx, 0, gx + (side === 'L' ? -26 : 26), 0);
  g.addColorStop(0, 'rgba(60,38,20,.34)'); g.addColorStop(.25, 'rgba(60,38,20,.12)'); g.addColorStop(1, 'rgba(60,38,20,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const v = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .45, W / 2, H / 2, Math.max(W, H) * .78);
  v.addColorStop(0, 'rgba(90,60,30,0)'); v.addColorStop(1, 'rgba(90,60,30,.13)'); x.fillStyle = v; x.fillRect(0, 0, W, H);
}
// The slot and tab where a standing piece is glued to the page.
export function glueTab(x, cx, cy, w, ang = 0) {
  x.save(); x.translate(cx, cy); x.rotate(ang);
  x.fillStyle = 'rgba(70,45,25,.16)'; x.fillRect(-w / 2, -.25, w, .5);
  x.fillStyle = 'rgba(255,255,255,.2)'; x.fillRect(-w / 2, .25, w, .3);
  x.restore();
}
