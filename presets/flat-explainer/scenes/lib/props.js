/**
 * Props for this film, each built once in local units and returned with handles to animate.
 * Sizes are in px at 1080p unless a function takes its own size argument.
 */
import { el, shade, random } from '../../kit/kit.js';
import { g, shape, block, rr, circ, ell, poly, roundPoly, text, tag, glow, T, INK, FONT } from './draw.js';

export const GOLD = '#ffc83d', GOLD_EDGE = '#e0a21f', GOLD_DARK = '#c98a12';
export const TAX = '#e8327c', STATE = '#6a3df0', SOCIAL = '#2856d8', GERMANY = '#ff5d5d';

/** Wraps `str` into lines no wider than maxW at `size`; returns the <text> with tspans. */
export function wrapText(parent, str, { maxW, size = 40, weight = 900, fill = INK, anchor = 'middle', lineHeight = 1.15, x = 0, y = 0 } = {}) {
  const t = el('text', { x, y, 'font-family': FONT, 'font-weight': weight, 'font-size': size, fill, 'text-anchor': anchor }, parent);
  const words = str.split(/\s+/);
  const lines = [];
  let line = '';
  const probe = el('tspan', {}, t);
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    probe.textContent = test;
    if (probe.getComputedTextLength() > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  probe.remove();
  lines.forEach((l, i) => {
    const ts = el('tspan', { x, dy: i ? size * lineHeight : 0 }, t);
    ts.textContent = l;
  });
  t.dataset.lines = lines.length;
  t.setAttribute('transform', `translate(0 ${(-(lines.length - 1) * size * lineHeight) / 2 + size * 0.35})`);
  return t;
}

/** White quote card with a tail toward (tx, ty) relative to the card centre. */
export function quoteCard(parent, str, { w = 680, size = 46, tail = [-0.3, 1], fill = '#ffffff', ink = INK, quoteMark = TAX } = {}) {
  const gg = g(parent);
  const body = g(gg);
  const t = wrapText(body, str, { maxW: w - size * 1.6, size, fill: ink });
  const lines = Number(t.dataset.lines);
  const h = lines * size * 1.15 + size * 1.25;
  const tailX = tail[0] * w * 0.5, tailDir = tail[1] > 0 ? 1 : -1;
  const ty = tailDir * h / 2;
  const back = el('path', { d: `${rr(-w / 2, -h / 2, w, h, size * 0.5)} M${tailX - size * 0.6},${ty - tailDir * 2} L${tailX + tail[0] * size * 0.9},${ty + tailDir * size * 0.95} L${tailX + size * 0.6},${ty - tailDir * 2} Z`, fill }, gg);
  gg.insertBefore(back, body);
  text(gg, '“', { x: -w / 2 + size * 0.62, y: -h / 2 + size * 0.62, size: size * 1.7, fill: quoteMark });
  return { g: gg, w, h };
}

/** Number plate in the house style: white number on a saturated rounded box. */
export function plate(parent, str, { size = 64, fill = '#ff5d5d', color = '#ffffff', padX = 0.5, padY = 0.24 } = {}) {
  const gg = g(parent);
  const t = text(gg, str, { size, fill: color });
  const w = t.getComputedTextLength() + size * padX * 2, h = size * (1 + padY * 2);
  const r = el('path', { d: rr(-w / 2, -h / 2, w, h, size * 0.16), fill }, gg);
  el('path', { d: rr(-w / 2, -h / 2 + h * 0.86, w, h * 0.14, size * 0.08), fill: shade(fill, -0.22) }, gg);
  gg.insertBefore(r, t);
  return { g: gg, w, h, text: t, set(v) { t.textContent = v; } };
}

/** Coin seen from the front: gold disc, inner ring, euro sign. Centre 0,0. */
export function coin(parent, r, { sign = '€', fill = GOLD } = {}) {
  const gg = g(parent);
  el('circle', { cx: r * 0.12, cy: r * 0.16, r, fill: GOLD_DARK }, gg);
  el('circle', { r, fill }, gg);
  el('path', { d: `${circ(0, 0, r)}${circ(r * 0.08, r * 0.1, r)}`, fill: GOLD_EDGE, 'fill-rule': 'evenodd' }, gg);
  el('circle', { r: r * 0.72, fill: 'none', stroke: GOLD_EDGE, 'stroke-width': r * 0.1 }, gg);
  el('path', { d: `M${-r * 0.62},${-r * 0.42}A${r * 0.76},${r * 0.76} 0 0 1 ${r * 0.1},${-r * 0.74}`, stroke: '#fff1b8', 'stroke-width': r * 0.12, fill: 'none', 'stroke-linecap': 'round' }, gg);
  if (sign) text(gg, sign, { size: r * 1.05, fill: GOLD_DARK, y: r * 0.04 });
  return gg;
}

/** Coin seen edge-on, for stacks: an ellipse on a short cylinder. Centre of the top face at 0,0. */
export function flatCoin(parent, r, h = r * 0.28) {
  const gg = g(parent);
  el('path', { d: `M${-r},0V${h}A${r},${r * 0.36} 0 0 0 ${r},${h}V0Z`, fill: GOLD_EDGE }, gg);
  el('path', { d: ell(0, h, r, r * 0.36), fill: GOLD_DARK }, gg).remove();
  el('path', { d: ell(0, 0, r, r * 0.36), fill: GOLD }, gg);
  el('path', { d: ell(0, 0, r * 0.66, r * 0.22), fill: 'none', stroke: GOLD_EDGE, 'stroke-width': r * 0.08 }, gg);
  return gg;
}

/** A stack of n edge-on coins growing upward from 0,0 (bottom). */
export function coinStack(parent, n, r) {
  const gg = g(parent);
  const step = r * 0.3;
  const coins = [];
  for (let i = 0; i < n; i++) coins.push(T(flatCoin(gg, r), (random('stack', i) - 0.5) * r * 0.12, -i * step - step) || gg.lastChild);
  return gg;
}

/** Lectern with a front panel and a reading slope. Base centre at 0,0, height h. */
export function lectern(parent, w, h, { wood = '#b8673a', panel = '#8f4a22', front = true } = {}) {
  const gg = g(parent);
  block(gg, roundPoly([[-w * 0.42, -h], [w * 0.42, -h], [w * 0.36, 0], [-w * 0.36, 0]], w * 0.04), wood, { depth: w * 0.04, dir: [0.4, 0.4], size: w * 0.3 });
  if (front) shape(gg, rr(-w * 0.26, -h * 0.78, w * 0.52, h * 0.5, w * 0.04), panel, { size: w * 0.2 });
  shape(gg, roundPoly([[-w * 0.5, -h * 1.08], [w * 0.5, -h * 1.08], [w * 0.46, -h * 0.97], [-w * 0.46, -h * 0.97]], w * 0.02), shade(wood, 0.08), { size: w * 0.1 });
  return gg;
}

/** Fan of microphones on stalks rising from 0,0. Returns the group. */
export function micFan(parent, n, len, { colors = [INK, TAX, '#45b8ff', '#ffc83d', '#7ff0c0', '#ff8a3d', '#8a6cff'], spread = 70, seed = 'mic' } = {}) {
  const gg = g(parent);
  for (let i = 0; i < n; i++) {
    const a = -spread / 2 + (spread * i) / Math.max(1, n - 1) + (random(seed, i) - 0.5) * 8;
    const l = len * (0.8 + random(seed, i + 20) * 0.35);
    const mg = g(gg, { transform: `rotate(${a})` });
    el('path', { d: `M0,0L0,${-l}`, stroke: '#3a3f5c', 'stroke-width': len * 0.035, 'stroke-linecap': 'round' }, mg);
    const col = colors[i % colors.length];
    const cube = random(seed, i + 40) > 0.6;
    if (cube) shape(mg, rr(-len * 0.09, -l - len * 0.02, len * 0.18, len * 0.13, len * 0.025), col, { size: len * 0.08 });
    shape(mg, ell(0, -l - len * 0.1, len * 0.075, len * 0.11), cube ? INK : col, { size: len * 0.07 });
  }
  return gg;
}

/** TV camera on a tripod, lens toward +x (flip with a negative scale). Feet at 0,0. */
export function tvCamera(parent, w, { body = '#3a3f5c', accent = '#ff5d5d' } = {}) {
  const gg = g(parent);
  const h = w * 1.25;
  for (const dx of [-0.38, 0, 0.38]) el('path', { d: `M0,${-h * 0.62}L${dx * w},0`, stroke: '#2a2e46', 'stroke-width': w * 0.05, 'stroke-linecap': 'round' }, gg);
  block(gg, rr(-w * 0.45, -h * 0.95, w * 0.8, w * 0.42, w * 0.06), body, { depth: w * 0.05, size: w * 0.25 });
  shape(gg, rr(w * 0.32, -h * 0.9, w * 0.36, w * 0.3, w * 0.05), shade(body, -0.15), { size: w * 0.15 });
  el('circle', { cx: w * 0.68, cy: -h * 0.9 + w * 0.15, r: w * 0.11, fill: '#7fd8ff' }, gg);
  el('circle', { cx: w * 0.66, cy: -h * 0.9 + w * 0.12, r: w * 0.04, fill: '#ffffff' }, gg);
  el('circle', { cx: -w * 0.3, cy: -h * 0.9, r: w * 0.04, fill: accent }, gg);
  shape(gg, rr(-w * 0.32, -h * 1.04, w * 0.32, w * 0.1, w * 0.04), shade(body, 0.15), { flat: true });
  return gg;
}

/** Laptop seen from the front. Base centre at 0,0. Returns {g, screen} (screen group in screen coords: 0..sw, 0..sh). */
export function laptop(parent, w, { shell = '#d7dcef', screenFill = '#ffffff' } = {}) {
  const gg = g(parent);
  const sw = w * 0.86, sh = w * 0.56;
  block(gg, rr(-w * 0.47, -sh - w * 0.07, w * 0.94, sh + w * 0.06, w * 0.03), shell, { depth: w * 0.012, size: w * 0.2 });
  el('path', { d: rr(-sw / 2, -sh - w * 0.03, sw, sh, w * 0.012), fill: screenFill }, gg);
  const screen = g(gg, { transform: `translate(${-sw / 2} ${-sh - w * 0.03})` });
  shape(gg, roundPoly([[-w * 0.55, -w * 0.012], [w * 0.55, -w * 0.012], [w * 0.6, w * 0.04], [-w * 0.6, w * 0.04]], w * 0.012), shade(shell, -0.05), { size: w * 0.1 });
  return { g: gg, screen, sw, sh };
}

/** Sheet of paper with header bar and ruled lines. Top-left at 0,0. Returns {g, lines, w, h}. */
export function paper(parent, w, h, { fill = '#fffaf0', line = '#e7dcc0', header = null, headerSize = 40, rows = 8, ink = INK } = {}) {
  const gg = g(parent);
  el('path', { d: rr(w * 0.02, h * 0.02, w, h, w * 0.025), fill: shade(fill, -0.18) }, gg);
  el('path', { d: rr(0, 0, w, h, w * 0.025), fill }, gg);
  const lines = [];
  if (header) text(gg, header, { x: w * 0.08, y: h * 0.1, size: headerSize, anchor: 'start', fill: ink });
  const top = header ? h * 0.22 : h * 0.1;
  for (let i = 0; i < rows; i++) {
    const y = top + i * ((h * 0.82 - top) / Math.max(1, rows - 1));
    const lw = w * (0.5 + random('paper', i) * 0.32);
    lines.push(el('path', { d: rr(w * 0.08, y, lw, h * 0.018, h * 0.009), fill: line }, gg));
  }
  return { g: gg, lines, w, h };
}

/** Rubber stamp: wooden handle and a rubber plate. Plate bottom centre at 0,0. */
export function stamp(parent, w, { wood = '#b8673a', rubber = TAX } = {}) {
  const gg = g(parent);
  shape(gg, rr(-w * 0.5, -w * 0.16, w, w * 0.16, w * 0.03), shade(rubber, -0.2), { flat: true });
  block(gg, rr(-w * 0.46, -w * 0.3, w * 0.92, w * 0.16, w * 0.04), wood, { depth: w * 0.03, size: w * 0.2 });
  shape(gg, rr(-w * 0.08, -w * 0.62, w * 0.16, w * 0.34, w * 0.06), shade(wood, 0.05), { size: w * 0.08 });
  shape(gg, circ(0, -w * 0.72, w * 0.16), shade(wood, 0.12), { size: w * 0.14 });
  return gg;
}

/** Window with sky, frame and sill. Top-left at 0,0. */
export function windowPane(parent, w, h, { frame = '#ffffff', sky = '#9be3ff', cross = true } = {}) {
  const gg = g(parent);
  el('path', { d: rr(0, 0, w, h, w * 0.04), fill: frame }, gg);
  el('path', { d: rr(w * 0.07, h * 0.07, w * 0.86, h * 0.86, w * 0.02), fill: sky }, gg);
  el('path', { d: `M${w * 0.15},${h * 0.55}L${w * 0.45},${h * 0.2}L${w * 0.55},${h * 0.2}L${w * 0.25},${h * 0.55}Z`, fill: '#ffffff', opacity: 0.35 }, gg);
  if (cross) el('path', { d: `M${w / 2},${h * 0.07}V${h * 0.93}M${w * 0.07},${h / 2}H${w * 0.93}`, stroke: frame, 'stroke-width': w * 0.05 }, gg);
  el('path', { d: rr(-w * 0.05, h - h * 0.02, w * 1.1, h * 0.06, h * 0.02), fill: shade(frame, -0.12) }, gg);
  return gg;
}

/** Wall clock; returns {g, set(t)} spinning the hands at `speed` turns per second. */
export function wallClock(parent, r, { face = '#ffffff', rim = '#6a3df0' } = {}) {
  const gg = g(parent);
  el('circle', { r: r * 1.12, fill: rim }, gg);
  el('circle', { r, fill: face }, gg);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    el('circle', { cx: Math.cos(a) * r * 0.8, cy: Math.sin(a) * r * 0.8, r: r * 0.05, fill: INK }, gg);
  }
  const hh = el('path', { d: `M0,0L0,${-r * 0.5}`, stroke: INK, 'stroke-width': r * 0.1, 'stroke-linecap': 'round' }, gg);
  const mh = el('path', { d: `M0,0L0,${-r * 0.74}`, stroke: TAX, 'stroke-width': r * 0.07, 'stroke-linecap': 'round' }, gg);
  el('circle', { r: r * 0.08, fill: INK }, gg);
  return { g: gg, set(turns) { mh.setAttribute('transform', `rotate(${turns * 360})`); hh.setAttribute('transform', `rotate(${turns * 30})`); } };
}

/** Desk: top slab with an extruded edge and two legs. Top surface centre at 0,0. */
export function desk(parent, w, { top = '#ffd28a', legs = '#b8673a', h = w * 0.42 } = {}) {
  const gg = g(parent);
  for (const s of [-1, 1]) shape(gg, rr(s * w * 0.42 - w * 0.025, 0, w * 0.05, h, w * 0.012), legs, { size: w * 0.03 });
  block(gg, rr(-w / 2, -w * 0.03, w, w * 0.045, w * 0.012), top, { depth: w * 0.022, dir: [0, 1], size: w * 0.06 });
  return gg;
}

/** Steaming mug; returns {g, steam(t)}. Base at 0,0. */
export function mug(parent, s, { fill = '#ff7eb6' } = {}) {
  const gg = g(parent);
  el('path', { d: `M${s * 0.32},${-s * 0.7}C${s * 0.62},${-s * 0.7} ${s * 0.62},${-s * 0.28} ${s * 0.3},${-s * 0.28}`, stroke: shade(fill, -0.2), 'stroke-width': s * 0.1, fill: 'none' }, gg);
  shape(gg, rr(-s * 0.34, -s * 0.9, s * 0.68, s * 0.9, s * 0.12), fill, { size: s * 0.3 });
  const steam = [0, 1, 2].map(i => el('path', { fill: 'none', stroke: '#ffffff', 'stroke-width': s * 0.07, 'stroke-linecap': 'round', opacity: 0.8 }, gg));
  return {
    g: gg,
    steam(t) {
      steam.forEach((p, i) => {
        const x = (i - 1) * s * 0.18, ph = t * 2 + i * 2;
        p.setAttribute('d', `M${x},${-s * 1.0}C${x + Math.sin(ph) * s * 0.12},${-s * 1.2} ${x - Math.sin(ph) * s * 0.12},${-s * 1.35} ${x},${-s * 1.55}`);
        p.setAttribute('opacity', 0.55 + 0.25 * Math.sin(ph * 0.7));
      });
    },
  };
}

let printerCount = 0;
/** Small office printer; `sheet` rises out of the top slot with set(p). Base centre at 0,0. */
export function printer(parent, w, { body = '#e7e9f4', sheetW = w * 0.72, sheetH = w * 0.95 } = {}) {
  const gg = g(parent);
  const h = w * 0.46;
  const id = `printer${printerCount++}`;
  const clip = el('clipPath', { id }, gg);
  el('rect', { x: -w, y: -h - w * 4, width: w * 2, height: w * 4 + 6 }, clip);
  const sheet = g(g(gg, { 'clip-path': `url(#${id})` }));
  el('path', { d: rr(-sheetW / 2, 0, sheetW, sheetH, 8), fill: '#ffffff' }, sheet);
  block(gg, rr(-w / 2, -h, w, h, 14), body, { depth: 6, size: 30 });
  el('path', { d: rr(-w * 0.42, -h + 2, w * 0.84, 12, 6), fill: shade(body, -0.5) }, gg);
  el('path', { d: rr(-w * 0.34, -h * 0.5, w * 0.44, h * 0.12, 5), fill: shade(body, -0.16) }, gg);
  el('circle', { cx: w * 0.34, cy: -h * 0.44, r: w * 0.035, fill: '#7ff0c0' }, gg);
  return { g: gg, sheet, sheetW, sheetH, set(p) { T(sheet, 0, -h + 6 - p * sheetH); } };
}

/** Fills a printer sheet as an invoice: header, grey rows and a highlighted line at the bottom. */
export function invoiceSheet(sheet, w, h, { header = 'Rechnung', line = '+ 5 %', lineFill = STATE, size = 34 } = {}) {
  text(sheet, header, { y: h * 0.13, size, fill: INK });
  for (let i = 0; i < 3; i++) el('path', { d: rr(-w * 0.36, h * 0.27 + i * h * 0.12, w * 0.72 - (i % 2) * w * 0.2, h * 0.045, h * 0.022), fill: '#e7dcc0' }, sheet);
  const hl = g(sheet, { transform: `translate(0 ${h * 0.8})` });
  const t = tag(hl, line, { fill: lineFill, size: size * 0.95 });
  return { line: hl, w: t.w };
}

/** A loose invoice on a soft shadow: header, rows and the highlighted line. Top centre at 0,0. */
export function invoiceCard(parent, w, h, opts = {}) {
  const gg = g(parent);
  el('path', { d: rr(-w / 2 + 10, 12, w, h, 10), fill: '#1b1f3b', opacity: 0.14 }, gg);
  el('path', { d: rr(-w / 2, 0, w, h, 10), fill: '#ffffff' }, gg);
  const inv = invoiceSheet(gg, w, h, opts);
  return { g: gg, line: inv.line };
}
