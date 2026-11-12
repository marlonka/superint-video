/**
 * Places: buildings, factories, the state treasury, server racks, cranes, containers, ships,
 * trucks, robot arms and skylines. Built once in local units, base centre at 0,0 unless noted.
 */
import { el, shade, random } from '../../kit/kit.js';
import { g, shape, block, rr, circ, ell, poly, roundPoly, text, glow, T, INK } from './draw.js';

/** Grid of windows on a facade; returns the window paths (for lighting them). */
function windows(parent, x, y, cols, rows, w, h, gx, gy, { fill = '#bfefff', frame = '#ffffff', seed = 'win' } = {}) {
  const list = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const wx = x + c * (w + gx), wy = y + r * (h + gy);
    el('path', { d: rr(wx - 3, wy - 3, w + 6, h + 6, 4), fill: frame }, parent);
    list.push(el('path', { d: rr(wx, wy, w, h, 3), fill }, parent));
    el('path', { d: `M${wx + w * 0.15},${wy + h * 0.6}L${wx + w * 0.55},${wy + h * 0.15}L${wx + w * 0.7},${wy + h * 0.15}L${wx + w * 0.3},${wy + h * 0.6}Z`, fill: '#ffffff', opacity: 0.35 }, parent);
  }
  return list;
}

/** A town building: walls, roof, windows, door, optional awning and sign. Base centre at 0,0. */
export function house(parent, w, h, { wall = '#ffd28a', roof = '#ff5d5d', roofType = 'gable', windowsFill = '#bfefff', cols = 3, rows = 2, awning = null, sign = null, signFill = '#6a3df0', door = '#8f4a22', seed = 'house' } = {}) {
  const gg = g(parent);
  block(gg, rr(-w / 2, -h, w, h, 6), wall, { depth: 10, dir: [1, 0.15], size: w * 0.25 });
  if (roofType === 'gable') block(gg, roundPoly([[-w * 0.56, -h + 4], [0, -h - w * 0.36], [w * 0.56, -h + 4]], 10), roof, { depth: 8, dir: [1, 0.2], size: w * 0.2 });
  else if (roofType === 'flat') block(gg, rr(-w * 0.53, -h - 18, w * 1.06, 22, 6), roof, { depth: 6, size: 20 });
  const ww = w * 0.16, wh = h * 0.16;
  const gx = (w * 0.8 - cols * ww) / Math.max(1, cols - 1);
  const list = windows(gg, -w * 0.4, -h * 0.86, cols, rows, ww, wh, gx, h * 0.1, { fill: windowsFill, seed });
  shape(gg, rr(-w * 0.09, -h * 0.3, w * 0.18, h * 0.3, 6), door, { size: 20 });
  el('circle', { cx: w * 0.05, cy: -h * 0.15, r: 3.5, fill: '#ffc83d' }, gg);
  if (awning) {
    const aw = g(gg, { transform: `translate(0 ${-h * 0.36})` });
    for (let i = 0; i < 8; i++) el('path', { d: `M${-w * 0.48 + i * w * 0.12},0h${w * 0.12}l${-w * 0.01},${h * 0.1}a${w * 0.055},${w * 0.04} 0 0 1 ${-w * 0.1},0Z`, fill: i % 2 ? '#ffffff' : awning }, aw);
  }
  if (sign) {
    const sg = g(gg, { transform: `translate(0 ${-h * 0.5})` });
    const t = text(sg, sign, { size: Math.min(34, w * 0.1), fill: '#ffffff' });
    const tw = t.getComputedTextLength() + 30;
    const b = el('path', { d: rr(-tw / 2, -24, tw, 48, 10), fill: signFill }, sg);
    sg.insertBefore(b, t);
  }
  return { g: gg, windows: list };
}

/** Factory hall with a saw-tooth roof and a chimney. Base centre at 0,0. Returns {g, steam(t)}. */
export function factory(parent, w, h, { wall = '#9fd3ff', roof = '#2856d8', trim = '#ffffff', chimney = '#ff8a3d', sign = null, signFill = '#ff5d5d' } = {}) {
  const gg = g(parent);
  const ch = g(gg, { transform: `translate(${w * 0.32} ${-h})` });
  block(ch, rr(-w * 0.05, -h * 0.75, w * 0.1, h * 0.8, 6), chimney, { depth: 8, dir: [1, 0.2], size: 20 });
  el('path', { d: rr(-w * 0.05, -h * 0.6, w * 0.1, h * 0.06, 2), fill: '#ffffff' }, ch);
  const steam = [0, 1, 2].map(i => el('circle', { fill: '#ffffff', opacity: 0.85 }, ch));
  block(gg, rr(-w / 2, -h, w, h, 6), wall, { depth: 10, dir: [1, 0.15], size: w * 0.2 });
  const teeth = 5;
  for (let i = 0; i < teeth; i++) {
    const x0 = -w / 2 + (i * w) / teeth;
    block(gg, poly([[x0, -h], [x0, -h - h * 0.28], [x0 + w / teeth, -h]]), roof, { depth: 6, dir: [1, 0.2], size: 20 });
    el('path', { d: poly([[x0 + 6, -h - 6], [x0 + 6, -h - h * 0.22], [x0 + w / teeth * 0.55, -h - h * 0.1]]), fill: '#bfefff' }, gg);
  }
  windows(gg, -w * 0.42, -h * 0.75, 4, 1, w * 0.16, h * 0.22, w * 0.053, 0, { fill: '#bfefff' });
  shape(gg, rr(-w * 0.14, -h * 0.42, w * 0.28, h * 0.42, 4), shade(wall, -0.25), { size: 20 });
  for (let i = 1; i < 6; i++) el('path', { d: `M${-w * 0.14},${-h * 0.42 + i * h * 0.07}h${w * 0.28}`, stroke: shade(wall, -0.38), 'stroke-width': 3 }, gg);
  if (sign) {
    const sg = g(gg, { transform: `translate(${-w * 0.3} ${-h * 0.9})` });
    const t = text(sg, sign, { size: 30, fill: '#ffffff' });
    const tw = t.getComputedTextLength() + 28;
    sg.insertBefore(el('path', { d: rr(-tw / 2, -22, tw, 44, 10), fill: signFill }), t);
  }
  return {
    g: gg,
    steam(t) {
      steam.forEach((c, i) => {
        const ph = (t * 0.5 + i / 3) % 1;
        c.setAttribute('cx', Math.sin(ph * 6 + i) * 10 + ph * 30);
        c.setAttribute('cy', -h * 0.8 - ph * 120);
        c.setAttribute('r', 14 + ph * 34);
        c.setAttribute('opacity', 0.9 * (1 - ph));
      });
    },
  };
}

/** The state treasury: a columned building with a violet roof. Base centre at 0,0. */
export function treasury(parent, w, h, { wall = '#ece6ff', roof = '#6a3df0', label = 'Staatskasse' } = {}) {
  const gg = g(parent);
  block(gg, rr(-w * 0.55, -h * 0.08, w * 1.1, h * 0.08, 4), shade(wall, -0.1), { depth: 6, size: 20 });
  block(gg, rr(-w * 0.5, -h * 0.16, w, h * 0.08, 4), shade(wall, -0.05), { depth: 6, size: 20 });
  shape(gg, rr(-w * 0.46, -h * 0.82, w * 0.92, h * 0.66, 4), shade(wall, -0.08), { size: 40 });
  const n = 6;
  for (let i = 0; i < n; i++) {
    const x = -w * 0.4 + (i * w * 0.8) / (n - 1);
    shape(gg, rr(x - w * 0.035, -h * 0.8, w * 0.07, h * 0.64, 6), wall, { size: 14 });
    el('path', { d: rr(x - w * 0.05, -h * 0.82, w * 0.1, h * 0.04, 3), fill: shade(wall, 0.2) }, gg);
  }
  block(gg, rr(-w * 0.52, -h * 0.9, w * 1.04, h * 0.09, 4), shade(wall, 0.05), { depth: 5, size: 20 });
  block(gg, roundPoly([[-w * 0.56, -h * 0.9], [0, -h * 1.18], [w * 0.56, -h * 0.9]], 8), roof, { depth: 8, size: 30 });
  if (label) text(gg, label, { y: -h * 0.98, size: Math.min(34, w * 0.075), fill: '#ffffff' });
  return gg;
}

/** Server rack with blinking LEDs; returns {g, blink(t)}. Base centre at 0,0. */
export function serverRack(parent, w, h, { body = '#2b3f86', seed = 'rack', leds = ['#7ff0c0', '#ff7eb6', '#45b8ff', '#ffc83d'] } = {}) {
  const gg = g(parent);
  block(gg, rr(-w / 2, -h, w, h, 8), body, { depth: 6, dir: [1, 0.1], size: w * 0.3 });
  const units = Math.max(4, Math.round(h / (w * 0.22)));
  const list = [];
  for (let i = 0; i < units; i++) {
    const y = -h + 12 + i * ((h - 24) / units);
    el('path', { d: rr(-w * 0.42, y, w * 0.84, (h - 24) / units - 6, 4), fill: shade(body, -0.25) }, gg);
    for (let k = 0; k < 3; k++) {
      const led = el('circle', { cx: -w * 0.32 + k * w * 0.1, cy: y + ((h - 24) / units - 6) / 2, r: Math.max(2.4, w * 0.03), fill: leds[(i + k) % leds.length] }, gg);
      led.dataset.f = 0.6 + random(seed, i * 3 + k) * 2.4;
      led.dataset.p = random(seed, i * 3 + k + 99) * 6;
      list.push(led);
    }
    el('path', { d: rr(w * 0.05, y + 4, w * 0.3, 3, 1.5), fill: shade(body, 0.2) }, gg);
  }
  return { g: gg, blink(t) { list.forEach(l => l.setAttribute('opacity', Math.sin(t * l.dataset.f * 6.28 + Number(l.dataset.p)) > -0.2 ? 1 : 0.25)); } };
}

/** Tower crane: mast, jib, counter-jib, cable and hook; returns {g, hook(len)} . Base at 0,0. */
export function towerCrane(parent, h, { fill = '#ffc83d', jib = 1.0 } = {}) {
  const gg = g(parent);
  const mw = h * 0.05;
  shape(gg, rr(-mw, -h, mw * 2, h, 3), fill, { size: mw });
  for (let i = 0; i < 12; i++) el('path', { d: `M${-mw},${-h + (i * h) / 12}L${mw},${-h + ((i + 1) * h) / 12}`, stroke: shade(fill, -0.3), 'stroke-width': 3 }, gg);
  shape(gg, rr(-h * 0.28, -h - mw * 1.6, h * 0.95 * jib + h * 0.28, mw * 1.4, 3), fill, { size: mw });
  block(gg, rr(-h * 0.26, -h - mw * 0.4, h * 0.14, mw * 1.6, 3), '#3a3f5c', { depth: 4, size: 10 });
  shape(gg, rr(-mw * 1.4, -h - mw * 4.2, mw * 2.8, mw * 2.6, 4), '#ffffff', { size: 10 });
  el('path', { d: rr(-mw * 1.05, -h - mw * 3.85, mw * 2.1, mw * 1.25, 3), fill: '#9be3ff' }, gg);
  el('path', { d: `M${-mw * 0.7},${-h - mw * 2.75}L${-mw * 0.2},${-h - mw * 3.7}`, stroke: '#ffffff', 'stroke-width': 4, opacity: 0.7 }, gg);
  const cable = el('path', { stroke: '#3a3f5c', 'stroke-width': 3 }, gg);
  const hook = g(gg);
  shape(hook, rr(-10, -6, 20, 12, 3), '#3a3f5c', { flat: true });
  el('path', { d: 'M0,6C0,20 -10,20 -10,12', stroke: '#3a3f5c', 'stroke-width': 4, fill: 'none' }, hook);
  return {
    g: gg,
    hook(x, len) {
      cable.setAttribute('d', `M${x},${-h - mw * 0.4}L${x},${-h - mw * 0.4 + len}`);
      hook.setAttribute('transform', `translate(${x} ${-h - mw * 0.4 + len})`);
    },
  };
}

/** Shipping container from the side. Top-left at 0,0. */
export function container(parent, w, h, fill) {
  const gg = g(parent);
  block(gg, rr(0, 0, w, h, 4), fill, { depth: 5, dir: [1, 0.3], size: 20 });
  for (let i = 1; i < 10; i++) el('path', { d: `M${(i * w) / 10},${h * 0.1}V${h * 0.9}`, stroke: shade(fill, -0.22), 'stroke-width': 3 }, gg);
  return gg;
}

/** Cargo ship hull with a bridge, bow to the right. Waterline centre at 0,0. */
export function ship(parent, len, { hull = '#ff5d5d', deck = '#ffffff' } = {}) {
  const gg = g(parent);
  block(gg, poly([[-len / 2, -len * 0.12], [len * 0.42, -len * 0.12], [len / 2, -len * 0.2], [len * 0.4, len * 0.04], [-len * 0.46, len * 0.04]]), hull, { depth: 6, size: 30 });
  el('path', { d: rr(-len * 0.48, -len * 0.025, len * 0.9, len * 0.02, 3), fill: '#ffffff', opacity: 0.6 }, gg);
  const br = g(gg, { transform: `translate(${-len * 0.38} ${-len * 0.12})` });
  block(br, rr(-len * 0.06, -len * 0.16, len * 0.12, len * 0.16, 4), deck, { depth: 4, size: 20 });
  for (let i = 0; i < 3; i++) el('path', { d: rr(-len * 0.05 + i * len * 0.035, -len * 0.14, len * 0.025, len * 0.025, 2), fill: '#45b8ff' }, br);
  el('path', { d: rr(-len * 0.02, -len * 0.23, len * 0.04, len * 0.08, 3), fill: '#ffc83d' }, br);
  return gg;
}

/** Delivery truck, cab to the right. Ground centre at 0,0; returns {g, cargo, wheels}. */
export function truck(parent, len, { body = '#ffffff', cab = '#ff8a3d' } = {}) {
  const gg = g(parent);
  const h = len * 0.42;
  const cargo = g(gg);
  block(cargo, rr(-len / 2, -h - len * 0.08, len * 0.68, h, 8), body, { depth: 6, size: 30 });
  const cabG = g(gg, { transform: `translate(${len * 0.2} 0)` });
  block(cabG, roundPoly([[0, -len * 0.08], [0, -h * 0.85 - len * 0.08], [len * 0.18, -h * 0.85 - len * 0.08], [len * 0.3, -h * 0.4], [len * 0.3, -len * 0.08]], 10), cab, { depth: 6, size: 30 });
  el('path', { d: roundPoly([[len * 0.03, -h * 0.75], [len * 0.16, -h * 0.75], [len * 0.25, -h * 0.4], [len * 0.03, -h * 0.4]], 6), fill: '#bfefff' }, cabG);
  const wheels = [-len * 0.32, -len * 0.12, len * 0.38].map(x => {
    const w = g(gg, { transform: `translate(${x} ${-len * 0.06})` });
    el('circle', { r: len * 0.07, fill: INK }, w);
    el('circle', { r: len * 0.03, fill: '#9aa3c7' }, w);
    el('path', { d: `M0,${-len * 0.03}V${len * 0.03}`, stroke: INK, 'stroke-width': 3 }, w);
    return w;
  });
  return { g: gg, cargo, wheels };
}

/** Industrial robot arm: base, two segments, a gripper. Base at 0,0; returns {g, set(a1, a2, a3)}. */
export function robotArm(parent, s, { fill = '#ffc83d', joint = '#3a3f5c' } = {}) {
  const gg = g(parent);
  block(gg, rr(-s * 0.32, -s * 0.16, s * 0.64, s * 0.16, 8), joint, { depth: 6, size: 20 });
  const seg1 = g(gg, { transform: `translate(0 ${-s * 0.16})` });
  shape(seg1, rr(-s * 0.09, -s * 0.62, s * 0.18, s * 0.66, s * 0.09), fill, { size: s * 0.09 });
  el('circle', { r: s * 0.12, fill: joint }, seg1);
  const seg2 = g(seg1, { transform: `translate(0 ${-s * 0.58})` });
  shape(seg2, rr(-s * 0.075, -s * 0.52, s * 0.15, s * 0.56, s * 0.075), fill, { size: s * 0.075 });
  el('circle', { r: s * 0.1, fill: joint }, seg2);
  const head = g(seg2, { transform: `translate(0 ${-s * 0.5})` });
  el('circle', { r: s * 0.08, fill: joint }, head);
  shape(head, rr(-s * 0.06, -s * 0.2, s * 0.12, s * 0.16, 4), shade(fill, -0.1), { size: 10 });
  const tip = g(head, { transform: `translate(0 ${-s * 0.2})` });
  el('path', { d: `M${-s * 0.06},0L${-s * 0.09},${-s * 0.1}M${s * 0.06},0L${s * 0.09},${-s * 0.1}`, stroke: joint, 'stroke-width': s * 0.03, 'stroke-linecap': 'round' }, tip);
  return {
    g: gg, tip,
    set(a1, a2, a3) {
      seg1.setAttribute('transform', `translate(0 ${-s * 0.16}) rotate(${a1})`);
      seg2.setAttribute('transform', `translate(0 ${-s * 0.58}) rotate(${a2})`);
      head.setAttribute('transform', `translate(0 ${-s * 0.5}) rotate(${a3})`);
    },
  };
}

/** A row of skyline buildings with lit windows. Ground at y = 0, from x0 over width w. */
export function skyline(parent, x0, w, { seed = 'sky', colors = ['#8a6cff', '#6a3df0', '#45b8ff', '#2856d8'], minH = 120, maxH = 420, windowFill = '#ffe17a', step = 90 } = {}) {
  const gg = g(parent);
  let x = x0;
  let i = 0;
  while (x < x0 + w) {
    const bw = step * (0.7 + random(seed, i) * 0.6);
    const bh = minH + random(seed, i + 50) * (maxH - minH);
    const fill = colors[i % colors.length];
    block(gg, rr(x, -bh, bw - 8, bh, 4), fill, { depth: 6, dir: [1, 0.1], size: 20 });
    for (let r = 0; r < Math.floor(bh / 46); r++) for (let c = 0; c < Math.floor((bw - 20) / 30); c++) {
      if (random(seed, i * 100 + r * 10 + c) > 0.55) el('path', { d: rr(x + 10 + c * 30, -bh + 16 + r * 46, 16, 22, 3), fill: windowFill, opacity: 0.9 }, gg);
    }
    x += bw;
    i++;
  }
  return gg;
}
