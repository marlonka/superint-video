/**
 * Drawing primitives for this film, on top of the preset kit: path builders, cel-shaded and
 * extruded shapes, SVG text and tags, glows and clouds. Everything is built once and moved with
 * transforms, so every frame stays a pure function of time.
 */
import { el, cel, shade, random } from '../../kit/kit.js';

export const INK = '#1b1f3b';
export const FONT = 'Nunito, system-ui, sans-serif';

const f = v => (Math.abs(v) < 1e-6 ? 0 : +v.toFixed(2));

/** Rounded rectangle path. */
export function rr(x, y, w, h, r = 0) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M${f(x + r)},${f(y)}H${f(x + w - r)}A${f(r)},${f(r)} 0 0 1 ${f(x + w)},${f(y + r)}V${f(y + h - r)}A${f(r)},${f(r)} 0 0 1 ${f(x + w - r)},${f(y + h)}H${f(x + r)}A${f(r)},${f(r)} 0 0 1 ${f(x)},${f(y + h - r)}V${f(y + r)}A${f(r)},${f(r)} 0 0 1 ${f(x + r)},${f(y)}Z`;
}
export const circ = (cx, cy, r) => `M${f(cx - r)},${f(cy)}A${f(r)},${f(r)} 0 1 0 ${f(cx + r)},${f(cy)}A${f(r)},${f(r)} 0 1 0 ${f(cx - r)},${f(cy)}Z`;
export const ell = (cx, cy, rx, ry) => `M${f(cx - rx)},${f(cy)}A${f(rx)},${f(ry)} 0 1 0 ${f(cx + rx)},${f(cy)}A${f(rx)},${f(ry)} 0 1 0 ${f(cx - rx)},${f(cy)}Z`;
export const poly = pts => `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join('L')}Z`;

/** Polygon with rounded corners (radius r, clamped per corner). */
export function roundPoly(pts, r) {
  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const v1 = [p0[0] - p1[0], p0[1] - p1[1]], v2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(...v1), l2 = Math.hypot(...v2);
    const k = Math.min(r, l1 / 2, l2 / 2);
    const a = [p1[0] + (v1[0] / l1) * k, p1[1] + (v1[1] / l1) * k];
    const b = [p1[0] + (v2[0] / l2) * k, p1[1] + (v2[1] / l2) * k];
    d += `${i ? 'L' : 'M'}${f(a[0])},${f(a[1])}Q${f(p1[0])},${f(p1[1])} ${f(b[0])},${f(b[1])}`;
  }
  return d + 'Z';
}

export const g = (parent, attrs = {}) => el('g', attrs, parent);

/** Sets translate/rotate/scale on a node. */
export function T(node, x = 0, y = 0, s = 1, r = 0, sy = null) {
  let t = `translate(${f(x)} ${f(y)})`;
  if (r) t += ` rotate(${f(r)})`;
  if (s !== 1 || (sy !== null && sy !== 1)) t += ` scale(${+s.toFixed(4)} ${+(sy ?? s).toFixed(4)})`;
  node.setAttribute('transform', t);
}

/** A filled shape, cel-shaded unless flat. `size` ≈ the shape's radius. */
export function shape(parent, d, fill, { flat = false, size = 20, light, shadowWidth = 0.28, rimWidth = 0.06, attrs = {} } = {}) {
  if (flat) return el('path', { d, fill, ...attrs }, parent);
  return cel(parent, d, { fill, size, light, shadowWidth, rimWidth }).g;
}

/** A shape with a darker extruded side face toward `dir` (default down and a bit right). */
export function block(parent, d, fill, { depth = 6, dir = [0.3, 1], size = 20, flat = false, side } = {}) {
  const gg = g(parent);
  const sideFill = side || shade(fill, -0.36);
  const steps = Math.max(3, Math.ceil(depth / 2));
  for (let k = steps; k >= 1; k--) el('path', { d, fill: sideFill, transform: `translate(${f((dir[0] * depth * k) / steps)} ${f((dir[1] * depth * k) / steps)})` }, gg);
  shape(gg, d, fill, { size, flat });
  return gg;
}

/** SVG text in Nunito. */
export function text(parent, str, { x = 0, y = 0, size = 30, weight = 900, fill = INK, anchor = 'middle', ls = 0, baseline = 'central' } = {}) {
  const t = el('text', { x, y, 'font-family': FONT, 'font-weight': weight, 'font-size': size, fill, 'text-anchor': anchor, 'dominant-baseline': baseline, 'letter-spacing': ls }, parent);
  t.textContent = str;
  return t;
}

/** Saturated name tag: white text on a rounded pill. Returns {g, w, h}, centred on 0,0. */
export function tag(parent, str, { fill = '#6a3df0', color = '#ffffff', size = 30, padX = 0.62, padY = 0.36, radius = 0.32 } = {}) {
  const gg = g(parent);
  const rect = el('path', { fill }, gg);
  const t = text(gg, str, { size, fill: color });
  const w = t.getComputedTextLength() + size * padX * 2, h = size * (1 + padY * 2);
  rect.setAttribute('d', rr(-w / 2, -h / 2, w, h, size * radius));
  return { g: gg, w, h, text: t };
}

/** Tight stacked glow: translucent discs, never a blur. */
export function glow(parent, r, fill, { layers = 4, opacity = 0.16, spread = 1.9 } = {}) {
  const gg = g(parent);
  for (let i = layers; i >= 1; i--) el('circle', { r: r * (1 + ((spread - 1) * i) / layers), fill, opacity: opacity * (1 - (i - 1) / (layers + 1)) }, gg);
  return gg;
}

/** Camera-flash or sparkle starburst centred on 0,0. */
export function starburst(parent, r, fill = '#fff8d6', points = 8) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const k = i % 2 ? 0.28 : 1;
    pts.push([Math.cos(a) * r * k, Math.sin(a) * r * k]);
  }
  const gg = g(parent);
  glow(gg, r * 0.45, fill, { layers: 3, opacity: 0.22, spread: 2.2 });
  el('path', { d: poly(pts), fill }, gg);
  el('circle', { r: r * 0.22, fill: '#ffffff' }, gg);
  return gg;
}

/** Cloud: a cluster of circles on a flat base, with a soft shadow band below. */
export function cloud(parent, w, { seed = 'cloud', fill = '#ffffff', shadow } = {}) {
  const gg = g(parent);
  const h = w * 0.36;
  const bumps = [[-0.32, -0.05, 0.2], [-0.1, -0.22, 0.27], [0.16, -0.14, 0.23], [0.34, 0.0, 0.16]];
  const sh = shadow || shade(fill, -0.12);
  const draw = (fill2, dy) => {
    el('path', { d: rr(-w / 2, -h * 0.1 + dy, w, h * 0.32, h * 0.16), fill: fill2 }, gg);
    bumps.forEach(([x, y, r], i) => {
      const k = 0.85 + random(seed, i) * 0.3;
      el('circle', { cx: x * w, cy: y * w + h * 0.06 + dy, r: r * w * 0.5 * k, fill: fill2 }, gg);
    });
  };
  draw(sh, h * 0.07);
  draw(fill, 0);
  return gg;
}

/** Simple tree: trunk and a cel-shaded blob crown. Base at 0,0. */
export function tree(parent, h, { seed = 'tree', crown = '#2fbf71', trunk = '#9a5a34' } = {}) {
  const gg = g(parent);
  shape(gg, rr(-h * 0.05, -h * 0.45, h * 0.1, h * 0.45, h * 0.03), trunk, { size: h * 0.05 });
  const c = g(gg, { transform: `translate(0 ${-h * 0.62})` });
  shape(c, blobPath(seed, h * 0.34), crown, { size: h * 0.3 });
  return gg;
}

/** Organic blob path (re-export of kit blob without importing twice in scenes). */
export function blobPath(seed, r, points = 8, wobble = 0.14) {
  const pts = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const k = 1 + wobble * (random(seed, i) - 0.5) * 2;
    pts.push([Math.cos(a) * r * k, Math.sin(a) * r * k]);
  }
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < points; i++) {
    const p0 = pts[(i - 1 + points) % points], p1 = pts[i], p2 = pts[(i + 1) % points], p3 = pts[(i + 2) % points];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + 'Z';
}

/** Potted plant with a few rounded leaves. Base at 0,0, height h. */
export function plant(parent, h, { seed = 'plant', pot = '#ff8a3d', leaf = '#2fbf71' } = {}) {
  const gg = g(parent);
  const leaves = 6;
  for (let i = 0; i < leaves; i++) {
    const a = -70 + (i / (leaves - 1)) * 140 + (random(seed, i) - 0.5) * 16;
    const len = h * (0.55 + random(seed, i + 9) * 0.3);
    const lg = g(gg, { transform: `translate(0 ${-h * 0.32}) rotate(${a})` });
    shape(lg, `M0,0C${len * 0.28},${-len * 0.3} ${len * 0.22},${-len * 0.85} 0,${-len}C${-len * 0.22},${-len * 0.85} ${-len * 0.28},${-len * 0.3} 0,0Z`, shade(leaf, (random(seed, i + 3) - 0.5) * 0.25), { size: len * 0.2 });
  }
  shape(gg, roundPoly([[-h * 0.2, -h * 0.36], [h * 0.2, -h * 0.36], [h * 0.15, 0], [-h * 0.15, 0]], h * 0.03), pot, { size: h * 0.18 });
  return gg;
}
