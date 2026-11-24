// Spread 2, "Die Frage": a golden late afternoon. Left a brick office in section with one lit window, right a flat
// data centre; between them open meadow. In front the monitor with the request, the agent at the gutter, the model's
// rack and the context window behind a tree. The request travels as a paper strip through an orange fibre conduit,
// through the brass hatch, and the knife at the inlet cuts it into fourteen tokens that rise behind the glass.
import { Spread } from '../popup.js';
import { THIN_LEAD, THIN_LAG } from '../book.js';
import { layer, inside, stroke, text, textWidth, rect, rrect, circle, ellipse, poly, blob, tone, rgba, rnd, TAU, wash } from '../paper.js';
import { tree, conifer, bush, cloud, bird, lampPost, bricks } from '../paperkit.js';
import { C, plate, clamp, ease, easeOut, between } from '../techkit.js';
import { instrSheet } from '../machines.js';
import { WALL, AGENT, RACK, WIN, PASS, addAgent, addModel, makeWindow, tokenLayout, tokenChip, hatchPrint, hatchLamps, standUp, pulse, inOrder, LAYER } from '../hall.js';

// Printed words. The request is the film's example task (process/buchplan.md); the terms: research.md PR1, PR3, PR4, PR7, PR31.
const TX = {
  title: 'Die Frage', app: 'Agent',
  msg: ['Trag alle offenen Rechnungen in eine Tabelle', 'und schreib die Summe darunter.'],
  strip: ['Trag alle offenen Rechnungen', 'in eine Tabelle und schreib', 'die Summe darunter.'],
  agent: 'AGENT', modell: 'MODELL', fenster: 'KONTEXTFENSTER', anw: 'Anweisungen',
};
const mm = v => v / 1000;
// The colours of the place (direction.md, colour script, spread 2).
const K = { skyTop: '#eec58f', skyLow: '#f7e4bf', brick: '#b9785a', oat: '#d9c7a8', stone: '#bdb3a3', tar: '#4a4540', meadow: '#a9b77f', roofs: '#8a7a6a', earth: '#8a6a4a', pipe: '#d9823a', anth: '#2f3437', leaf: '#6f8f4a' };
// Where the hero pieces stand (u, off in metres; w, h in millimetres). Agent, rack and window: hall.js, as on spread 3.
const MON = { u: -.21, off: .108, w: 96, h: 62, neck: 9.5 };
const DESK = { u0: -.222, u1: -.084, o0: .086, o1: .146 };
const SUN = [52, 106, 9.5];
const HORIZON = 146;

// ---------------------------------------------------------------- small drawing helpers of this spread
// A polyline path in page millimetres; at(k), k 0..1, walks it at even speed.
function path(P) {
  const L = [0];
  for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const len = L[L.length - 1];
  return { P, len, at(k) { const d = clamp(k) * len; let i = 1; while (i < P.length - 1 && L[i] < d) i++; const f = (d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]); return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * f, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f]; } };
}
const polyline = (x, P, c, w, cap = 'round') => { x.save(); x.strokeStyle = c; x.lineWidth = w; x.lineJoin = 'round'; x.lineCap = cap; x.beginPath(); P.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke(); x.restore(); };
// Points every `step` millimetres along a polyline, with the direction there.
function along(P, step) {
  const out = [];
  for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / l, dy = (b[1] - a[1]) / l; for (let d = 0; d < l; d += step) out.push([a[0] + dx * d, a[1] + dy * d, dx, dy]); }
  return out;
}

// The meadow as printed ground: a warm green, soft patches, short blades, a scatter of flowers.
function meadow(x, W, H, seed) {
  layer(x, K.meadow, rect(0, 0, W, H), { lift: 0 });
  for (let i = 0; i < 70; i++) {
    const cx = rnd(seed, i) * W, cy = rnd(seed + 1, i) * H, r = 8 + rnd(seed + 2, i) * 30, c = rnd(seed + 3, i) > .5 ? '96,120,58' : '226,214,150';
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(${c},.16)`); g.addColorStop(1, `rgba(${c},0)`); x.fillStyle = g; x.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  }
  x.save(); x.lineCap = 'round';
  for (let i = 0; i < 3400; i++) {
    const px = rnd(seed + 5, i) * W, py = rnd(seed + 6, i) * H, l = .7 + rnd(seed + 7, i) * 1.5, a = rnd(seed + 8, i) * TAU;
    x.strokeStyle = rnd(seed + 9, i) > .52 ? 'rgba(66,88,36,.34)' : 'rgba(236,230,170,.34)'; x.lineWidth = .2 + rnd(seed + 10, i) * .22;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  x.restore();
  // Mown in broad lanes, clover in darker patches.
  for (let k = -4; k < 14; k++) { x.save(); x.translate(k * 34, 0); x.rotate(-.5); x.fillStyle = k % 2 ? 'rgba(250,240,190,.11)' : 'rgba(60,80,30,.08)'; x.fillRect(0, -60, 17, H + 260); x.restore(); }
  for (let i = 0; i < 40; i++) { const cx = rnd(seed + 15, i) * W, cy = rnd(seed + 16, i) * H; for (let j = 0; j < 14; j++) { const a = rnd(seed + 17, i * 20 + j) * TAU, d = rnd(seed + 18, i * 20 + j) * 4.5, px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d * .8; x.fillStyle = 'rgba(78,104,48,.5)'; for (let l = 0; l < 3; l++) { const b = l * TAU / 3 + a; x.beginPath(); x.arc(px + Math.cos(b) * .32, py + Math.sin(b) * .32, .3, 0, TAU); x.fill(); } } }
  // Daisies, buttercups, a little clover in flower.
  for (let i = 0; i < 260; i++) {
    const g = Math.floor(rnd(seed + 19, i) * 30), cx = rnd(seed + 20, g) * W, cy = rnd(seed + 21, g) * H, px = rnd(seed + 22, i) > .45 ? cx + (rnd(seed + 23, i) - .5) * 26 : rnd(seed + 11, i) * W, py = rnd(seed + 22, i) > .45 ? cy + (rnd(seed + 24, i) - .5) * 18 : rnd(seed + 12, i) * H;
    flower(x, px, py, FL[Math.floor(rnd(seed + 14, i) * FL.length)], .45 + rnd(seed + 13, i) * .45);
  }
}
const FL = ['#f4eedd', '#f3d35a', '#f4eedd', '#e9b9b0', '#f4eedd'];
function flower(x, px, py, c, r) {
  if (c === '#f4eedd') { x.fillStyle = c; for (let p = 0; p < 7; p++) { const b = p * TAU / 7; x.beginPath(); x.ellipse(px + Math.cos(b) * r * .75, py + Math.sin(b) * r * .75, r * .52, r * .26, b, 0, TAU); x.fill(); } x.fillStyle = '#e8b83a'; x.beginPath(); x.arc(px, py, r * .36, 0, TAU); x.fill(); }
  else { x.fillStyle = c; x.beginPath(); x.arc(px, py, r * .7, 0, TAU); x.fill(); x.fillStyle = 'rgba(120,80,20,.35)'; x.beginPath(); x.arc(px + r * .15, py + r * .15, r * .25, 0, TAU); x.fill(); }
}
// A patch of the meadow in flower: darker lush grass, daisies and buttercups close together, a few tufts in it.
function patch(x, cx, cy, rx, ry, seed) {
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry)); g.addColorStop(0, 'rgba(84,108,48,.3)'); g.addColorStop(1, 'rgba(84,108,48,0)'); x.save(); x.translate(cx, cy); x.scale(1, ry / rx); x.translate(-cx, -cy); x.fillStyle = g; x.fillRect(cx - rx, cy - rx, 2 * rx, 2 * rx); x.restore();
  for (let i = 0; i < 70; i++) { const a = rnd(seed, i) * TAU, d = Math.sqrt(rnd(seed + 1, i)); flower(x, cx + Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry, FL[Math.floor(rnd(seed + 2, i) * FL.length)], .55 + rnd(seed + 3, i) * .5); }
  for (let k = 0; k < 3; k++) tuft(x, cx + (rnd(seed + 4, k) - .5) * rx * 1.2, cy + (rnd(seed + 5, k) - .5) * ry, 5 + rnd(seed + 6, k) * 3, seed * 7 + k);
}
// A path of flagstones laid in the meadow: a worn track of bare earth, each stone cut on its own, set a little askew.
function footpath(x, P, w, seed) {
  polyline(x, P, 'rgba(90,80,44,.22)', w * 1.7);
  polyline(x, P, 'rgba(150,130,84,.28)', w * 1.1);
  along(P, w * 1.05).forEach(([px, py, dx, dy], i) => {
    const sw = w * (.78 + rnd(seed, i) * .22), sh = w * (.5 + rnd(seed + 1, i) * .14), a = Math.atan2(dy, dx) + (rnd(seed + 2, i) - .5) * .5, s = (rnd(seed + 3, i) - .5) * w * .18;
    const cx = px - dy * s, cy = py + dx * s, c = tone('#cfc3a8', (rnd(seed + 4, i) - .5) * .14);
    const stone = xx => { const n = 7; for (let k = 0; k < n; k++) { const b = k / n * TAU, r = 1 + (rnd(seed + 5, i * 9 + k) - .5) * .22, ex = Math.cos(b) * sh / 2 * r, ey = Math.sin(b) * sw / 2 * r; const qx = cx + ex * Math.cos(a) - ey * Math.sin(a), qy = cy + ex * Math.sin(a) + ey * Math.cos(a); k ? xx.lineTo(qx, qy) : xx.moveTo(qx, qy); } xx.closePath(); };
    layer(x, c, stone, { lift: .32 });
    inside(x, stone, () => { for (let k = 0; k < 22; k++) { x.fillStyle = rnd(seed + 6, i * 30 + k) > .5 ? 'rgba(90,80,60,.22)' : 'rgba(255,250,235,.32)'; x.beginPath(); x.arc(cx + (rnd(seed + 7, i * 30 + k) - .5) * w, cy + (rnd(seed + 8, i * 30 + k) - .5) * w, .14 + rnd(seed + 9, i * 30 + k) * .3, 0, TAU); x.fill(); } });
  });
}
// A tuft of long grass, cut from paper: a few blades leaning in the evening wind.
function tuft(x, cx, cy, s, seed) {
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI / 2 + (rnd(seed, k) - .5) * 1.3, l = s * (.6 + rnd(seed + 1, k) * .6), bx = cx + (rnd(seed + 2, k) - .5) * s * .6, wd = s * .07;
    const tip = [bx + Math.cos(a) * l + l * .12, cy + Math.sin(a) * l];
    layer(x, tone('#6f8a46', (rnd(seed + 3, k) - .5) * .2), poly([[bx - wd, cy], [bx + wd, cy], tip]), { lift: .28, sh: .35 });
  }
}
// A trench in the meadow with the orange fibre conduit in it, from one machine to the next.
function trench(x, P, seed) {
  polyline(x, P, 'rgba(58,44,24,.22)', 17.5);
  polyline(x, P, '#6d5136', 14.6);
  polyline(x, P, K.earth, 12.8);
  // Clods, pebbles and roots in the loose earth.
  along(P, .55).forEach(([px, py, dx, dy], i) => {
    const s = (rnd(seed, i) - .5) * 11, r = .18 + rnd(seed + 1, i) * .5, k = rnd(seed + 2, i);
    x.fillStyle = k > .7 ? 'rgba(196,172,140,.75)' : k > .35 ? 'rgba(70,50,30,.55)' : 'rgba(160,120,80,.5)';
    x.beginPath(); x.arc(px - dy * s, py + dx * s, r, 0, TAU); x.fill();
  });
  // The conduit: orange, a light ridge along its top, a coupler now and then.
  stroke(x, P, '#a45a22', 6.4, { lift: .35 });
  polyline(x, P, K.pipe, 5.2);
  polyline(x, P, 'rgba(255,222,170,.6)', 1.3);
  // Printed metre marks on the pipe, as on real fibre ducts.
  along(P, 9).forEach(([px, py, dx, dy], i) => { if (!i) return; x.save(); x.translate(px, py); x.rotate(Math.atan2(dy, dx)); x.fillStyle = 'rgba(120,60,20,.45)'; x.fillRect(-.12, -2.6, .24, 1.1); x.fillRect(-.12, 1.5, .24, 1.1); x.restore(); });
}
// Where something stands, the ground is darker.
// Weathered concrete inside a pad (call within its clip): aggregate, a few hairline cracks, rain marks along the edges.
function concrete(x, pts, seed) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), W = x1 - x0, H = y1 - y0;
  for (let i = 0; i < W * H * 1.4; i++) { const r = rnd(seed, i); x.fillStyle = r > .55 ? 'rgba(255,250,238,.38)' : r > .2 ? 'rgba(80,70,58,.22)' : 'rgba(120,104,84,.3)'; x.beginPath(); x.arc(x0 + rnd(seed + 1, i) * W, y0 + rnd(seed + 2, i) * H, .1 + rnd(seed + 3, i) * .22, 0, TAU); x.fill(); }
  for (let k = 0; k < 3; k++) { let px = x0 + rnd(seed + 4, k) * W, py = y0 + rnd(seed + 5, k) * H; x.strokeStyle = 'rgba(60,50,40,.28)'; x.lineWidth = .1; x.beginPath(); x.moveTo(px, py); for (let s = 0; s < 6; s++) { px += (rnd(seed + 6, k * 9 + s) - .3) * 3.2; py += (rnd(seed + 7, k * 9 + s) - .5) * 2.4; x.lineTo(px, py); } x.stroke(); }
  for (const [a, b, c, d] of [[x0, y0, x0, y0 + 3], [x0, y1, x0, y1 - 3]]) { const g = x.createLinearGradient(a, b, c, d); g.addColorStop(0, 'rgba(70,58,40,.16)'); g.addColorStop(1, 'rgba(70,58,40,0)'); x.fillStyle = g; x.fillRect(x0, Math.min(b, d), W, 3); }
}
function foot(x, a, b, c, d, k = 1) { for (const [w, al] of [[5, .05], [2.6, .08], [1.1, .12]]) { x.save(); x.strokeStyle = `rgba(30,24,12,${al * k})`; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); x.restore(); } }

// ---------------------------------------------------------------- the place on the fold
// A window of the office: stone reveal, warm glass with the sky in it, a blind now and then.
function officeWindow(x, wx, wy, ww, wh, i) {
  layer(x, K.oat, rect(wx - 1.5, wy - 1.5, ww + 3, wh + 3), { lift: .35 });
  layer(x, tone(K.oat, -.42), rect(wx, wy, ww, wh), { lift: 0, tooth: false });
  layer(x, '#5c5048', rect(wx + .9, wy + 1, ww - 1.2, wh - 1), { lift: 0, tooth: false });
  inside(x, rect(wx + .9, wy + 1, ww - 1.2, wh - 1), () => {
    const g = x.createLinearGradient(wx + ww, wy, wx, wy + wh); g.addColorStop(0, 'rgba(240,206,150,.75)'); g.addColorStop(.55, 'rgba(200,160,110,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
    const bl = rnd(17, i); if (bl < .42) { const d = (wh - 1) * (.25 + rnd(18, i) * .45); x.fillStyle = ['#e8dcc4', '#e3cfa6', '#efe6d4'][i % 3]; x.fillRect(wx, wy, ww, d); x.fillStyle = 'rgba(80,60,30,.25)'; x.fillRect(wx, wy + d - .3, ww, .3); }
    if (rnd(19, i) > .78) { x.fillStyle = '#5f7f45'; x.beginPath(); x.arc(wx + ww * .7, wy + wh - 2.4, 1.6, 0, TAU); x.fill(); x.fillStyle = '#b8653e'; x.fillRect(wx + ww * .7 - 1, wy + wh - 1.6, 2, 1.6); }
  });
  x.fillStyle = '#efe5d0'; x.fillRect(wx + ww / 2 - .3, wy + 1, .6, wh - 1); x.fillRect(wx + .9, wy + wh * .36, ww - 1.2, .55);
  layer(x, K.oat, rect(wx - 2.1, wy + wh + .5, ww + 4.2, 1.3), { lift: .35 });
}
// The lit room in the office's top floor: lamp, desk, chair, one small figure seen from behind.
function litRoom(x, wx, wy, ww, wh) {
  const g = x.createLinearGradient(wx, wy, wx, wy + wh); g.addColorStop(0, '#ffe9b8'); g.addColorStop(1, '#f2c676');
  layer(x, '#f6d69a', rect(wx, wy, ww, wh), { lift: 0, tooth: false });
  inside(x, rect(wx, wy, ww, wh), () => {
    x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
    const lg = x.createRadialGradient(wx + ww * .76, wy + wh * .52, 0, wx + ww * .76, wy + wh * .52, ww * .6); lg.addColorStop(0, 'rgba(255,250,225,.9)'); lg.addColorStop(1, 'rgba(255,250,225,0)'); x.fillStyle = lg; x.fillRect(wx, wy, ww, wh);
    // a picture on the wall, a shelf
    x.fillStyle = '#9a6b45'; x.fillRect(wx + 1.6, wy + 2.2, 3.2, 2.4); x.fillStyle = '#d7b47c'; x.fillRect(wx + 2, wy + 2.6, 2.4, 1.6);
    // desk and its legs
    x.fillStyle = '#6b4a2e'; x.fillRect(wx, wy + wh - 4.6, ww, 1.1); x.fillStyle = '#563a22'; x.fillRect(wx + 1.2, wy + wh - 3.5, .6, 3.5); x.fillRect(wx + ww - 1.8, wy + wh - 3.5, .6, 3.5);
    // the lamp: foot, arm, shade
    x.strokeStyle = '#3a3530'; x.lineWidth = .35; x.beginPath(); x.moveTo(wx + ww - 2.6, wy + wh - 4.6); x.lineTo(wx + ww - 3.6, wy + wh - 8.4); x.lineTo(wx + ww - 5.4, wy + wh - 9.6); x.stroke();
    x.fillStyle = '#3a3530'; x.beginPath(); x.moveTo(wx + ww - 6.8, wy + wh - 8.4); x.lineTo(wx + ww - 4.2, wy + wh - 10.4); x.lineTo(wx + ww - 3.6, wy + wh - 9.4); x.lineTo(wx + ww - 5.6, wy + wh - 7.6); x.closePath(); x.fill();
    x.fillStyle = '#3a3530'; x.fillRect(wx + ww - 3.4, wy + wh - 4.9, 1.6, .4);
    // a screen on the desk, glowing pale
    x.fillStyle = '#2f3437'; x.fillRect(wx + ww * .42, wy + wh - 7.6, 3.4, 2.5); x.fillStyle = '#f4f1e8'; x.fillRect(wx + ww * .42 + .3, wy + wh - 7.3, 2.8, 1.8); x.fillStyle = '#2f3437'; x.fillRect(wx + ww * .42 + 1.4, wy + wh - 5.1, .6, .5);
    // chair and the person at the desk, back to us (6 mm)
    const cx = wx + ww * .44;
    x.fillStyle = '#3d3a36'; x.fillRect(cx - 2.2, wy + wh - 6.2, 4.4, 3.4); x.fillRect(cx - .3, wy + wh - 2.8, .6, 2.2); x.fillRect(cx - 1.8, wy + wh - .7, 3.6, .5);
    x.fillStyle = '#6f7d5c'; x.beginPath(); x.moveTo(cx - 1.9, wy + wh - 3.3); x.quadraticCurveTo(cx - 2.2, wy + wh - 6.9, cx, wy + wh - 7.1); x.quadraticCurveTo(cx + 2.2, wy + wh - 6.9, cx + 1.9, wy + wh - 3.3); x.closePath(); x.fill();
    x.fillStyle = '#d9a888'; x.fillRect(cx - .35, wy + wh - 7.6, .7, .7);
    x.fillStyle = '#4a3426'; x.beginPath(); x.arc(cx, wy + wh - 8.4, 1.05, 0, TAU); x.fill();
  });
  x.fillStyle = '#efe5d0'; x.fillRect(wx + ww / 2 - .3, wy, .6, wh * .36); x.fillRect(wx, wy + wh * .36 - .5, ww, .55);
}
// The office: three storeys of brick, the roof cut so its slab shows in section, a door with a canopy.
const OFF = { a: 92, w: 112, plinth: 7, fh: 25, nf: 3 };
OFF.top = 190 - OFF.plinth - OFF.nf * OFF.fh;
const offWin = (i, j) => [OFF.a + 9 + i * 27, OFF.top + 2.4 + j * OFF.fh + 4.2, 14, 15];
const LIT = [2, 0];
function office(x, base) {
  const { a, w, plinth, fh, nf, top } = OFF, BR = K.brick;
  // On the roof: the stair house, a cooling box, a vent.
  layer(x, tone(BR, -.06), rect(a + 72, top - 15, 22, 15), { lift: .4 });
  inside(x, rect(a + 72, top - 15, 22, 15), () => bricks(x, a + 72, top - 15, 22, 15, rgba(tone(BR, -.55), .22), 1.5, 3.8));
  layer(x, '#57514a', rect(a + 70.5, top - 17, 25, 2.2), { lift: .35 });
  layer(x, '#5c4d42', rect(a + 78, top - 11, 6, 9), { lift: .2 });
  layer(x, '#8d877c', rect(a + 16, top - 9.5, 12, 7), { lift: .4 }); x.fillStyle = 'rgba(40,36,30,.45)'; for (let k = 0; k < 5; k++) x.fillRect(a + 17.2 + k * 2.2, top - 8.4, 1, 4.6);
  layer(x, '#6d675e', rect(a + 40, top - 12, 1.4, 10), { lift: .3 }); layer(x, '#6d675e', rect(a + 38.8, top - 12.8, 3.8, 1.2), { lift: .2 });
  // The façade.
  layer(x, BR, rect(a, top, w, base - top), { lift: .55 });
  inside(x, rect(a, top, w, base - top), () => { bricks(x, a, top, w, base - top, rgba(tone(BR, -.55), .24), 1.5, 3.8); wash(a, 0, a + w, 0, 'rgba(255,226,170,.14)', 'rgba(60,28,12,.18)')(x); });
  // The roof in section: the slab hatched, the coping.
  const slab = top - 4.6;
  layer(x, '#5a534b', rect(a - 2, slab, w + 4, 4.6), { lift: .5 });
  inside(x, rect(a - 2, slab, w + 4, 4.6), () => { x.strokeStyle = 'rgba(232,220,196,.34)'; x.lineWidth = .24; for (let k = -6; k < w + 10; k += 1.5) { x.beginPath(); x.moveTo(a - 2 + k, slab + 4.6); x.lineTo(a - 2 + k + 4.6, slab); x.stroke(); } });
  layer(x, K.oat, rect(a - 2.6, slab - 1.5, w + 5.2, 1.7), { lift: .35 });
  layer(x, K.oat, rect(a, top, w, 2.2), { lift: .3 });
  for (let j = 1; j < nf; j++) layer(x, tone(K.oat, -.05), rect(a, top + 2.2 + j * fh - .7, w, 1.3), { lift: .2 });
  layer(x, '#a3978a', rect(a, base - plinth, w, plinth), { lift: .4 });
  x.fillStyle = 'rgba(40,30,20,.18)'; for (let k = 0; k < 8; k++) x.fillRect(a + k * 14, base - plinth, .25, plinth);
  // Windows: three upper rows of four, the ground floor two and the door.
  for (let j = 0; j < nf; j++) for (let i = 0; i < 4; i++) {
    if (j === nf - 1 && (i === 1 || i === 2)) continue;
    const [wx, wy, ww, wh] = offWin(i, j);
    if (i === LIT[0] && j === LIT[1]) { layer(x, K.oat, rect(wx - 1.5, wy - 1.5, ww + 3, wh + 3), { lift: .35 }); litRoom(x, wx, wy, ww, wh); layer(x, K.oat, rect(wx - 2.1, wy + wh + .5, ww + 4.2, 1.3), { lift: .35 }); }
    else officeWindow(x, wx, wy, ww, wh, i + j * 4);
  }
  // The door: frame, glass, a canopy on two brackets, two steps.
  const dx = a + w / 2 - 7, dy = base - plinth - 17;
  layer(x, K.oat, rect(dx - 1.6, dy - 1.6, 17.2, base - dy + 1.6), { lift: .35 });
  layer(x, '#4b3a2c', rect(dx, dy, 14, base - dy - 2), { lift: 0 });
  layer(x, '#7a6655', rect(dx + 1, dy + 1, 5.6, base - dy - 4.4), { lift: 0, tooth: false }); layer(x, '#7a6655', rect(dx + 7.4, dy + 1, 5.6, base - dy - 4.4), { lift: 0, tooth: false });
  inside(x, rect(dx + 1, dy + 1, 12, base - dy - 4.4), wash(dx + 14, dy, dx, base, 'rgba(240,206,150,.5)', 'rgba(0,0,0,0)'));
  x.fillStyle = '#c49846'; x.fillRect(dx + 6.2, dy + 9, .5, 3); x.fillRect(dx + 7.3, dy + 9, .5, 3);
  layer(x, tone(K.oat, -.04), rect(dx - 4, dy - 4.4, 22, 2), { lift: .5 });
  for (const bx of [dx - 2.6, dx + 16.2]) stroke(x, [[bx, dy - 2.4], [bx + (bx < dx ? 1.6 : -1.6), dy + 1.2]], '#5a5048', .4);
  layer(x, tone(K.oat, -.1), rect(dx - 3, base - 2, 20, 2), { lift: .3 }); layer(x, K.oat, rect(dx - 1.6, base - 3.4, 17.2, 1.5), { lift: .3 });
  // A downpipe at the corner.
  layer(x, '#6d675e', rect(a + w - 3, top - 1, 1.5, base - top - 2), { lift: .35 }); layer(x, '#6d675e', rect(a + w - 4.2, base - 3, 3.2, 1.2), { lift: .2 });
}
// The data centre: a long low block of warm stone, tar roof in section, cooling units on it, opened to show its racks.
const DC = { a: 322, w: 240, h: 56 };
function datacenter(x, base) {
  const { a, w, h } = DC, top = base - h, ST = K.stone;
  // Rooftop: an exhaust stack, cooling units with fans, copper lines between them.
  layer(x, '#7d776d', rect(a + w - 14, top - 34, 4.2, 34), { lift: .45 }); layer(x, '#57514a', rect(a + w - 14.6, top - 35.4, 5.4, 1.6), { lift: .3 });
  for (let k = 0; k < 4; k++) {
    const ux = a + 98 + k * 33, uw = 26, uh = 10;
    for (const f of [6, 17]) { layer(x, '#3a3632', rect(ux + f - 3.6, top - 6 - uh - 1.6, 7.2, 1.8), { lift: .25 }); }
    layer(x, '#a39d92', rect(ux, top - 6 - uh, uw, uh), { lift: .45 });
    x.fillStyle = 'rgba(40,36,32,.4)'; for (let i = 0; i < 12; i++) x.fillRect(ux + 1.4 + i * 2, top - 6 - uh + 1.6, .8, uh - 3.2);
    x.fillStyle = 'rgba(255,240,210,.25)'; x.fillRect(ux, top - 6 - uh, uw, .5);
  }
  stroke(x, [[a + 124, top - 9], [a + 131, top - 9]], '#b87333', .9); stroke(x, [[a + 157, top - 9], [a + 164, top - 9]], '#b87333', .9); stroke(x, [[a + 190, top - 9], [a + 197, top - 9]], '#b87333', .9);
  // The block.
  layer(x, ST, rect(a, top, w, h), { lift: .55 });
  inside(x, rect(a, top, w, h), () => { bricks(x, a, top, w, h, rgba(tone(ST, -.55), .2), 5.6, 17); wash(a, 0, a + w, 0, 'rgba(255,230,180,.12)', 'rgba(50,40,30,.16)')(x); });
  // Tar roof in section, the coping.
  layer(x, K.tar, rect(a - 2, top - 5.4, w + 4, 5.4), { lift: .5 });
  inside(x, rect(a - 2, top - 5.4, w + 4, 5.4), () => { x.strokeStyle = 'rgba(220,210,190,.22)'; x.lineWidth = .24; for (let k = -6; k < w + 10; k += 1.5) { x.beginPath(); x.moveTo(a - 2 + k, top); x.lineTo(a - 2 + k + 5.4, top - 5.4); x.stroke(); } });
  layer(x, '#8a8378', rect(a - 2.6, top - 6.8, w + 5.2, 1.6), { lift: .35 });
  layer(x, tone(ST, -.2), rect(a, base - 5, w, 5), { lift: .4 });
  // The left end: a steel door under a small roof, a vent.
  layer(x, '#8d9192', rect(a + 60, base - 22, 13, 17), { lift: .3 }); layer(x, '#767a7b', rect(a + 61, base - 21, 11, 15.6), { lift: 0 }); x.fillStyle = '#3a3e40'; x.fillRect(a + 70, base - 13.6, 1.2, .5);
  layer(x, '#5a534b', rect(a + 57, base - 24.4, 19, 1.8), { lift: .45 });
  layer(x, '#9a948a', rect(a + 80, base - 40, 12, 9), { lift: .3 }); x.fillStyle = 'rgba(40,36,32,.45)'; for (let i = 0; i < 6; i++) x.fillRect(a + 81, base - 39 + i * 1.4, 10, .6);
  // The cut: the wall opened like a section, racks in a row inside, cable trays and lamps under the slab.
  const ox = a + 100, ow = 124, oy = top + 7, oh = h - 12;
  layer(x, '#d8cfc0', rect(ox - 2.6, oy - 2.6, ow + 5.2, oh + 2.6), { lift: .45 });
  inside(x, rect(ox - 2.6, oy - 2.6, ow + 5.2, oh + 2.6), () => { x.strokeStyle = 'rgba(120,100,80,.35)'; x.lineWidth = .22; for (let k = -oh; k < ow + 8; k += 1.6) { x.beginPath(); x.moveTo(ox - 2.6 + k, oy + oh); x.lineTo(ox - 2.6 + k + oh + 3, oy - 2.6); x.stroke(); } });
  layer(x, '#4c4741', rect(ox, oy, ow, oh), { lift: 0 });
  inside(x, rect(ox, oy, ow, oh), () => {
    wash(0, oy, 0, oy + oh, 'rgba(0,0,0,.3)', 'rgba(255,220,170,.05)')(x);
    x.fillStyle = '#8f877b'; x.fillRect(ox, oy + oh - 3.2, ow, 3.2); x.fillStyle = 'rgba(40,30,20,.3)'; for (let k = 0; k < 20; k++) x.fillRect(ox + k * 6.4, oy + oh - 3.2, .2, 3.2);
    layer(x, '#c9a33e', rect(ox, oy + 2.4, ow, 2.2), { lift: .3 }); x.fillStyle = 'rgba(80,60,10,.4)'; for (let k = 0; k < 16; k++) x.fillRect(ox + 3 + k * 8, oy + 2.4, .3, 2.2);
    for (let k = 0; k < 5; k++) layer(x, '#f3e3b0', rect(ox + 8 + k * 25, oy + 5.6, 9, 1), { lift: .2, tooth: false });
    for (let k = 0; k < 9; k++) {
      const rx = ox + 3.6 + k * 13.4, rw = 11.4, rh = 30, ry = oy + oh - 3.2 - rh;
      layer(x, tone('#26292c', (rnd(23, k) - .5) * .2), rect(rx, ry, rw, rh), { lift: .35 });
      x.fillStyle = 'rgba(150,160,164,.3)'; for (let i = 0; i < 6; i++) x.fillRect(rx + 1.6 + i * 1.6, ry + 2, .6, rh - 4);
      for (let i = 0; i < 7; i++) { x.fillStyle = (k + i) % 5 === 2 ? C.amber : C.green; x.fillRect(rx + .9, ry + 2.4 + i * 3.8, .7, .5); }
      x.fillStyle = '#b87333'; x.fillRect(rx + rw / 2 - .3, oy + 4.6, .6, ry - oy - 4.6);
    }
  });
}
// Far away: roofs of a village, lines of trees, all in the haze of the late sun.
function distance(x, W) {
  for (let i = 0; i < 26; i++) { const cx = 6 + i * 22.6 + rnd(5, i) * 10, r = 4 + rnd(6, i) * 5; layer(x, '#9aa07a', blob(cx, HORIZON - r * .55, r, r * .6, 30 + i, 8, .2), { lift: .15, sh: .18 }); }
  const roofs = [[18, 9], [29, 6], [37, 11], [150, 7], [160, 10], [171, 6], [232, 8], [243, 12], [256, 7], [267, 9], [279, 6], [296, 10], [308, 8], [318, 6], [470, 9], [482, 7], [540, 8], [551, 11]];
  roofs.forEach(([cx, w], i) => {
    const h = w * .45, b = HORIZON + .4;
    layer(x, tone('#b2a08a', (rnd(7, i) - .5) * .12), rect(cx - w / 2 + .6, b - h * .9, w - 1.2, h * .9), { lift: .15, sh: .2 });
    layer(x, tone(K.roofs, (rnd(8, i) - .5) * .14), poly([[cx - w / 2, b - h * .82], [cx, b - h * 1.75], [cx + w / 2, b - h * .82]]), { lift: .15, sh: .2 });
  });
  // A thin steeple in the open meadow between the two buildings, far away.
  layer(x, '#b2a08a', rect(272.4, HORIZON - 12, 3.2, 12), { lift: .15, sh: .2 }); layer(x, K.roofs, poly([[272, HORIZON - 12], [274, HORIZON - 20], [276, HORIZON - 12]]), { lift: .15, sh: .2 });
}

// ---------------------------------------------------------------- hero pieces
// The monitor: bezel and dark glass; foot and column are a sheet of their own behind it.
function monitorFront(x, W, H) {
  layer(x, K.anth, rrect(0, 0, W, H, 1.6), { lift: .6 });
  inside(x, rrect(0, 0, W, H, 1.6), wash(0, 0, W, H, 'rgba(255,255,255,.07)', 'rgba(0,0,0,.12)'));
  layer(x, '#0e1012', rect(2.5, 2.5, W - 5, H - 7.1), { lift: 0, tooth: false });
  // Dark glass that still reads as glass: the warm room on its upper left, two glare bands from the lamp, a bevel.
  inside(x, rect(2.5, 2.5, W - 5, H - 7.1), () => {
    const g = x.createLinearGradient(2.5, 2.5, W * .7, H); g.addColorStop(0, 'rgba(120,96,70,.22)'); g.addColorStop(.45, 'rgba(40,40,40,.06)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (const [a, b, al] of [[.5, .68, .07], [.73, .78, .05]]) { x.fillStyle = `rgba(255,240,210,${al})`; x.beginPath(); x.moveTo(W * a, 2.5); x.lineTo(W * b, 2.5); x.lineTo(W * (b - .3), H); x.lineTo(W * (a - .3), H); x.closePath(); x.fill(); }
    x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(2.5, 2.5, W - 5, .25); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(2.5, H - 4.85, W - 5, .25);
  });
  // The maker's mark and a button row on the chin, printed small.
  x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(W / 2 - 2.2, H - 2.5, 4.4, .32);
  for (let k = 0; k < 3; k++) { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(W - 9.5 - k * 1.7, H - 2.55, .9, .42); }
  x.fillStyle = 'rgba(255,255,255,.16)'; x.fillRect(1, 1, W - 2, .3);
  x.fillStyle = C.green; x.beginPath(); x.arc(W - 5, H - 2.3, .35, 0, TAU); x.fill();
}
function monitorFoot(x, W, H) {
  layer(x, tone(K.anth, .06), rect(W / 2 - 2.4, 0, 4.8, H - 1.4), { lift: .35 });
  inside(x, rect(W / 2 - 2.4, 0, 4.8, H - 1.4), wash(W / 2 - 2.4, 0, W / 2 + 2.4, 0, 'rgba(255,255,255,.12)', 'rgba(0,0,0,.2)'));
  layer(x, K.anth, rrect(W / 2 - 18.5, H - 1.8, 37, 1.8, .8), { lift: .4 });
}
// The chat window of the agent, without the message: a bar with three dots and "Agent", the list, the input field.
function screen(x, W, H) {
  x.fillStyle = '#f4f1e8'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#e4dfd2'; x.fillRect(0, 0, W, 4.4);
  ['#c9675a', '#d9b24f', '#7fae74'].forEach((k, i) => { x.fillStyle = k; x.beginPath(); x.arc(2.8 + i * 2.5, 2.2, .75, 0, TAU); x.fill(); });
  text(x, TX.app, W / 2, 2.35, 2.5, { font: 'Jost', weight: 500, color: rgba(C.ink, .82) });
  x.fillStyle = 'rgba(43,36,32,.16)'; x.fillRect(0, 4.4, W, .16);
  const sw = W * .13; x.fillStyle = '#ebe6d8'; x.fillRect(0, 4.56, sw, H);
  x.fillStyle = 'rgba(43,36,32,.12)'; x.fillRect(sw - .14, 4.56, .14, H);
  // The list of earlier chats: a button for a new one, then entries of a title line and a fainter preview line,
  // the open one on a darker ground.
  layer(x, '#f7f4ec', rrect(1.2, 6, sw - 2.4, 3, .8), { lift: .1, sh: .15, tooth: false });
  x.fillStyle = rgba(C.ink, .6); x.fillRect(2.3, 7.37, 1.5, .26); x.fillRect(2.92, 6.75, .26, 1.5); x.fillStyle = rgba(C.ink, .3); x.fillRect(4.6, 7.3, sw - 7.4, .4);
  for (let i = 0; i < 6; i++) {
    const y = 11.6 + i * 4.6, open = i === 0;
    if (open) { x.fillStyle = '#ddd6c6'; x.beginPath(); rrect(.8, y - 1.1, sw - 1.6, 4.1, .7)(x); x.fill(); }
    x.fillStyle = `rgba(43,36,32,${open ? .55 : .3})`; x.fillRect(1.8, y, sw - 3.6 - (i % 3) * 1.3, .62);
    x.fillStyle = `rgba(43,36,32,${open ? .24 : .13})`; x.fillRect(1.8, y + 1.5, sw - 4.4 - ((i + 1) % 3) * 1.1, .42);
  }
  layer(x, '#ffffff', rrect(sw + 3, H - 8.2, W - sw - 6, 5.6, 1.6), { lift: .2, sh: .2 });
  x.fillStyle = rgba(C.ink, .7); x.fillRect(sw + 5.2, H - 7.1, .3, 3.4);
  layer(x, '#3d4a44', circle(W - 6.6, H - 5.4, 1.8), { lift: 0, tooth: false }); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(W - 7.2, H - 4.9); x.lineTo(W - 6.6, H - 6.2); x.lineTo(W - 6, H - 4.9); x.closePath(); x.fill();
}
// The keyboard and the mouse from above, the mug from the side.
function keyboard(x, W, H) {
  layer(x, '#3a4044', rrect(0, 0, W, H, 1.6), { lift: .55 });
  const kw = (W - 4) / 15, kh = (H - 4) / 6, key = (a, b, w, c = '#e3ddd0') => { layer(x, tone(c, -.3), rrect(a, b, w - .45, kh - .45, .4), { lift: .2, sh: .35, tooth: false }); layer(x, c, rrect(a + .15, b + .1, w - .75, kh - .85, .3), { lift: 0, tooth: false }); };
  // Function row, digits, three rows of letters, the space row; the wide keys where they belong.
  for (let k = 0; k < 15; k++) key(2 + k * kw, 2, kw, k === 0 ? '#c9c2b3' : '#e3ddd0');
  for (let r = 1; r < 5; r++) { const first = [1, 1.5, 1.8, 2.3][r - 1]; let a = 2; key(a, 2 + r * kh, kw * first, '#c9c2b3'); a += kw * first; const n = [13, 12, 11, 10][r - 1]; for (let k = 0; k < n; k++) { key(a, 2 + r * kh, kw); a += kw; } key(a, 2 + r * kh, W - 2 - a, '#c9c2b3'); }
  let a = 2; for (const w of [1.3, 1.3, 1.3]) { key(a, 2 + 5 * kh, kw * w, '#c9c2b3'); a += kw * w; } key(a, 2 + 5 * kh, kw * 6.4); a += kw * 6.4; while (a < W - 2 - kw * .5) { key(a, 2 + 5 * kh, kw * 1.1, '#c9c2b3'); a += kw * 1.1; }
  x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(1, .6, W - 2, .3);
}
// The mouse: an egg narrower at the front, two buttons split by a seam, the wheel between them, a dome that
// catches the lamp from the back left. Its cable leaves the front and is printed on the desk (see desk()).
function mouse(x, W, H) {
  const body = xx => { xx.moveTo(W / 2, .35); xx.bezierCurveTo(W - .9, .35, W - .3, H * .4, W - .35, H * .66); xx.bezierCurveTo(W - .4, H - .25, .4, H - .25, .35, H * .66); xx.bezierCurveTo(.3, H * .4, .9, .35, W / 2, .35); xx.closePath(); };
  layer(x, '#d9d3c5', body, { lift: .5, shade: wash(0, 0, W, H, 'rgba(255,250,236,.28)', 'rgba(60,50,40,.24)') });
  x.save(); x.beginPath(); body(x); x.clip();
  x.strokeStyle = 'rgba(40,36,30,.5)'; x.lineWidth = .16; x.beginPath(); x.moveTo(W / 2, .3); x.lineTo(W / 2, H * .44); x.stroke();
  x.strokeStyle = 'rgba(40,36,30,.28)'; x.lineWidth = .12; x.beginPath(); x.moveTo(.4, H * .46); x.quadraticCurveTo(W / 2, H * .52, W - .4, H * .46); x.stroke();
  x.fillStyle = 'rgba(255,255,255,.32)'; x.beginPath(); x.ellipse(W * .34, H * .3, W * .13, H * .17, -.3, 0, TAU); x.fill();
  x.restore();
  layer(x, '#3a4044', rrect(W / 2 - .45, H * .14, .9, 2.1, .4), { lift: .1, tooth: false });
  x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(W / 2 - .2, H * .14 + .3, .4, .25);
}
function mug(x, W, H) {
  const a = 1, w = W - 5.2, b = 1.6;
  layer(x, '#e9e1cf', xx => { xx.moveTo(a + w, b + 3); xx.bezierCurveTo(a + w + 5, b + 2.4, a + w + 5, b + 10, a + w, b + 9.6); xx.lineTo(a + w, b + 8.2); xx.bezierCurveTo(a + w + 3.4, b + 8.4, a + w + 3.4, b + 4, a + w, b + 4.4); xx.closePath(); }, { lift: .35 });
  layer(x, '#efe8d6', xx => { xx.moveTo(a, b); xx.lineTo(a + w, b); xx.lineTo(a + w - .5, H - .6); xx.quadraticCurveTo(a + w / 2, H + .2, a + .5, H - .6); xx.closePath(); }, { lift: .5, shade: wash(a, 0, a + w, 0, 'rgba(255,250,235,.25)', 'rgba(70,50,30,.22)') });
  layer(x, '#7e9a7c', rect(a + .2, b + 5.2, w - .5, 2.4), { lift: 0 });
  layer(x, '#d8cfba', ellipse(a + w / 2, b, w / 2, .9), { lift: 0, tooth: false }); layer(x, '#4a3020', ellipse(a + w / 2, b + .15, w / 2 - .6, .55), { lift: 0, tooth: false });
}
// The desk under them, from above: oak boards, a leather pad, the brass grommet where the conduit goes down.
function desk(x, P) {
  const c = [P(DESK.u0, DESK.o0), P(DESK.u1, DESK.o0), P(DESK.u1, DESK.o1), P(DESK.u0, DESK.o1)];
  layer(x, '#b48553', poly(c), { lift: .6 });
  inside(x, poly(c), () => {
    for (let k = 0; k < 46; k++) { const o = DESK.o0 + (DESK.o1 - DESK.o0) * rnd(41, k), u0 = DESK.u0 + rnd(42, k) * .1, a = P(u0, o), b = P(u0 + .02 + rnd(43, k) * .05, o + (rnd(44, k) - .5) * .001); x.strokeStyle = `rgba(90,56,26,${.08 + rnd(45, k) * .1})`; x.lineWidth = .18 + rnd(46, k) * .2; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
    for (const o of [.106, .126]) { const a = P(DESK.u0, o), b = P(DESK.u1, o); x.strokeStyle = 'rgba(70,40,18,.28)'; x.lineWidth = .3; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
    const e = [P(DESK.u0, DESK.o1 - .0025), P(DESK.u1, DESK.o1 - .0025), P(DESK.u1, DESK.o1), P(DESK.u0, DESK.o1)]; x.fillStyle = 'rgba(70,40,18,.3)'; x.beginPath(); poly(e)(x); x.fill();
  });
  layer(x, '#5b4434', poly([P(-.203, .113), P(-.12, .113), P(-.12, .141), P(-.203, .141)]), { lift: .3 });
  inside(x, poly([P(-.203, .113), P(-.12, .113), P(-.12, .141), P(-.203, .141)]), () => { const a = P(-.2005, .1155), b = P(-.1225, .1155), d = P(-.1225, .1385), e = P(-.2005, .1385); x.strokeStyle = 'rgba(230,200,160,.3)'; x.lineWidth = .2; x.setLineDash([.6, .5]); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.lineTo(d[0], d[1]); x.lineTo(e[0], e[1]); x.closePath(); x.stroke(); x.setLineDash([]); });
  const g = P(-.0905, .1);
  // The mouse's cable: out of its front, a slack curve over the oak and down through the grommet.
  { const a = P(-.104, .1215), c1 = P(-.1045, .112), c2 = P(-.0955, .1085), b = P(-.0915, .1022);
    for (const [dx, dy, col, lw] of [[.35, .5, 'rgba(40,24,10,.32)', .9], [0, 0, '#3a4044', .62], [-.08, -.1, 'rgba(255,255,255,.18)', .18]]) {
      x.save(); x.strokeStyle = col; x.lineWidth = lw; x.lineCap = 'round'; x.beginPath(); x.moveTo(a[0] + dx, a[1] + dy); x.bezierCurveTo(c1[0] + dx, c1[1] + dy, c2[0] + dx, c2[1] + dy, b[0] + dx, b[1] + dy); x.stroke(); x.restore(); } }
  layer(x, C.brass, circle(g[0], g[1], 3.9), { lift: .3 }); layer(x, '#2a2218', circle(g[0], g[1], 2.6), { lift: 0, tooth: false }); layer(x, K.pipe, circle(g[0], g[1], 2.1), { lift: .15, tooth: false }); layer(x, '#2a2218', circle(g[0], g[1], .9), { lift: 0, tooth: false });
}
// The big lime in front of the data centre: a short sturdy trunk, a broad crown in the late sun that reaches out to
// the left over the model's rack and hides the window's upper end. The crown is a few round lobes (sheet mm):
// A over the window and the rack (it keeps above the sign MODELL), D and E between, B the body round the trunk, C its top.
// The lobes keep a few millimetres below the sheet's top edge, so the crown is round everywhere; none of them reaches
// down to the sign MODELL and the lamp under it (KEEP, sheet mm).
// The tree stands 46 mm in front of the rack: seen from the left and from above, the crown shifts left and down
// over it, so the keep-out reaches further right and lower than the sign itself.
const LOBES = [[46, 21, 40, 13], [24, 17, 17, 10], [90, 20, 27, 13], [124, 42, 20, 18], [145, 56, 43, 40], [168, 30, 25, 22]];
const KEEP = [56, 45, 101, 83];
const inLobe = (px, py, m = 0) => LOBES.some(([cx, cy, rx, ry]) => ((px - cx) / (rx - m)) ** 2 + ((py - cy) / (ry - m)) ** 2 < 1);
const kept = (px, py, r) => px + r > KEEP[0] && px - r < KEEP[2] && py + r > KEEP[1] && py - r < KEEP[3];
function bigTree(x, W, H, tx) {
  const bark = '#6a523c';
  // Limbs first: they show where the crown is thin. They pass above the sign, never across it.
  stroke(x, [[tx - 1, H - 84], [tx - 10, H - 118], [tx - 22, H - 148], [tx - 50, H - 166], [tx - 84, H - 170]], bark, 3.4, { smooth: true, lift: .35 });
  stroke(x, [[tx + 1, H - 90], [tx + 14, H - 120], [tx + 34, H - 152]], bark, 2.8, { smooth: true, lift: .35 });
  stroke(x, [[tx - 8, H - 112], [tx - 18, H - 140], [tx - 22, H - 168]], bark, 1.8, { smooth: true, lift: .3 });
  // A fork low on the trunk, its limb leaning out to the right under the crown.
  stroke(x, [[tx + 3, H - 64], [tx + 15, H - 82], [tx + 27, H - 99]], bark, 2.4, { smooth: true, lift: .35 });
  // The crown's dark body: the lobes with bumpy edges.
  layer(x, '#435c2d', xx => { LOBES.forEach(([cx, cy, rx, ry], i) => blob(cx, cy, rx * .93, ry * .9, 300 + i, 16, .07)(xx)); }, { lift: .75 });
  // Clusters: each a shade underneath, a body, and a light cap where the sun from the left catches it.
  const cl = [];
  for (let i = 0; i < 1600 && cl.length < 96; i++) { const px = rnd(71, i) * W, py = rnd(72, i) * 96, r = 5.5 + rnd(73, i) * 5; if (inLobe(px, py, 4) && !kept(px, py, r) && py - r * .72 > 1.5) cl.push([px, py, r, i]); }
  cl.sort((a, b) => a[1] - b[1]);
  for (const [px, py, r, i] of cl) {
    const sun = clamp((1 - px / W) * .55 + (1 - py / 70) * .45), c = tone(K.leaf, -.2 + sun * .32 + (rnd(75, i) - .5) * .06);
    layer(x, tone(c, -.22), blob(px + .9, py + 1.1, r, r * .72, 500 + i, 11, .16), { lift: .3 });
    layer(x, c, blob(px, py, r * .92, r * .66, 600 + i, 11, .16), { lift: .25 });
    if (sun > .35) layer(x, tone(c, .2 + sun * .1), blob(px - r * .28, py - r * .26, r * .48, r * .3, 700 + i, 9, .2), { lift: .12 });
  }
  // Single leaves at the rim break the outline.
  for (let i = 0, n = 0; i < 2400 && n < 140; i++) { const px = rnd(78, i) * W, py = rnd(79, i) * 98; if (!inLobe(px, py) || inLobe(px, py, 4) || kept(px, py, 2) || py < 2) continue; n++; const a = rnd(80, i) * TAU; x.fillStyle = tone(K.leaf, -.12 + rnd(81, i) * .3); x.beginPath(); x.ellipse(px, py, 1.5, .8, a, 0, TAU); x.fill(); }
  // Where limbs cross the crown's lower edge.
  stroke(x, [[tx - 4, H - 98], [tx - 12, H - 104]], bark, 1.4, { lift: .2 }); stroke(x, [[tx + 6, H - 101], [tx + 15, H - 106]], bark, 1.2, { lift: .2 });
  // The trunk last: grey-brown bark in long plates, a little light on the left, roots into the ground.
  const trunk = xx => { xx.moveTo(tx - 10, H); xx.quadraticCurveTo(tx - 5.4, H - 2.6, tx - 5.2, H - 12); xx.lineTo(tx - 4.2, H - 80); xx.lineTo(tx - 3.8, H - 97); xx.lineTo(tx + 3.6, H - 99); xx.lineTo(tx + 4.8, H - 80); xx.lineTo(tx + 5.6, H - 12); xx.quadraticCurveTo(tx + 5.8, H - 2.6, tx + 10.6, H); xx.closePath(); };
  layer(x, bark, trunk, { lift: .55 });
  inside(x, trunk, () => { for (let k = 0; k < 110; k++) { x.fillStyle = `rgba(${rnd(61, k) > .5 ? '36,26,16' : '210,190,160'},${.12 + rnd(62, k) * .16})`; x.fillRect(tx - 5.4 + rnd(63, k) * 10.8, H - 99 + rnd(64, k) * 98, .26, 2.6 + rnd(65, k) * 8); } x.fillStyle = 'rgba(255,214,150,.2)'; x.fillRect(tx - 6, H - 99, 2.2, 99); x.fillStyle = 'rgba(30,20,10,.18)'; x.fillRect(tx + 3, H - 99, 3, 99); });
}
// The fence round the data centre.
function fence(x, W, H) {
  x.save(); x.strokeStyle = 'rgba(90,96,88,.55)'; x.lineWidth = .18; x.beginPath(); for (let d = -H; d < W + H; d += 2.2) { x.moveTo(d, 2); x.lineTo(d + H, H); x.moveTo(d + H, 2); x.lineTo(d, H); } x.stroke(); x.restore();
  layer(x, '#6a6f66', rect(0, 1.4, W, .7), { lift: .25 }); layer(x, '#6a6f66', rect(0, H - 1.6, W, .5), { lift: .2 });
  for (let px = 1; px < W; px += 15.5) if (px < 92 || px > 112) layer(x, '#5d6259', rect(px, 0, 1.1, H), { lift: .3 });
  x.strokeStyle = 'rgba(70,74,68,.7)'; x.lineWidth = .14; for (const y of [.5]) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
  // The gate where the path comes in: two strong posts, a frame with a brace.
  for (const px of [93, 111.6]) layer(x, '#51564e', rect(px, -.6, 1.6, H + .6), { lift: .35 });
  layer(x, '#666b62', xx => { xx.rect(94.8, 1.2, 16.6, H - 2.2); xx.rect(95.6, 2, 15, H - 3.8); }, { lift: .3, rule: 'evenodd' });
  stroke(x, [[95.6, H - 1.8], [110.6, 2]], '#666b62', .5, { lift: .15 });
}

export function frage(s) {
  // Seconds after the spread lies open, from the voice (scenes/timing.js); world.js sets the real ones over these.
  const S = new Spread(s); S.plan = 30.84;
  S.t = { frage: 3.6, agent: 11, modell: 14.2, tokens: 17.5, fenster: 21.8, kostet: 24.2 };
  S.setup = t => {
    const sp = (side, u, off) => S.spot('ort', side, u, off), PL = (u, off) => sp('L', u, off), PR = (u, off) => sp('R', u, off);
    // ---- times
    const aGo = t.agent + .1, aIn = t.agent + 2.1;                      // monitor to agent
    const bGo = Math.max(aIn + .3, t.modell + .05), pass = bGo + 1.0;   // agent to the hatch
    const cGo = pass + .25, cIn = cGo + 1.3;                            // hatch to the inlet
    const c0 = Math.max(t.tokens + .25, cIn + .4), chop = i => c0 + i * .22, cutEnd = chop(13) + .2;
    const lit = t.agent + 2.05;

    // ---- the place
    S.vfold('ort', { ...WALL, dir: 1, lock: 0, color: '#e4d3b0', draw(x, W, H) {
      const sky = xx => { xx.moveTo(0, H); xx.lineTo(0, 30); xx.bezierCurveTo(W * .2, -4, W * .8, -4, W, 30); xx.lineTo(W, H); xx.closePath(); };
      // The wall stands with its back to the lamp, so the sky is cut a shade richer than it should look.
      layer(x, K.skyLow, sky, { lift: 0, shade: xx => {
        const g = xx.createLinearGradient(0, 0, 0, HORIZON); g.addColorStop(0, '#e9b36c'); g.addColorStop(.45, K.skyTop); g.addColorStop(1, rgba(K.skyTop, 0)); xx.fillStyle = g; xx.fillRect(-2000, -2000, 4000, 4000);
        const r = xx.createRadialGradient(SUN[0], SUN[1], 0, SUN[0], SUN[1], 190); r.addColorStop(0, 'rgba(246,196,110,.55)'); r.addColorStop(.5, 'rgba(240,190,110,.2)'); r.addColorStop(1, 'rgba(240,190,110,0)'); xx.fillStyle = r; xx.fillRect(-2000, -2000, 4000, 4000);
        const h = xx.createLinearGradient(0, HORIZON - 26, 0, HORIZON); h.addColorStop(0, 'rgba(255,240,205,0)'); h.addColorStop(1, 'rgba(255,240,205,.55)'); xx.fillStyle = h; xx.fillRect(-2000, HORIZON - 26, 4000, 26);
      } });
      // Sun low on the left, as cut rings of paper.
      layer(x, '#f2c178', circle(SUN[0], SUN[1], SUN[2] * 2.2), { lift: .25 });
      layer(x, '#f7d692', circle(SUN[0], SUN[1], SUN[2] * 1.5), { lift: .3 });
      layer(x, '#fff1c6', circle(SUN[0], SUN[1], SUN[2]), { lift: .4 });
      // Long thin clouds lit from below by the low sun.
      const goldCloud = (cx, cy, w, seed) => { cloud(x, cx, cy, w, { c: '#f9e2bb', seed }); layer(x, '#f3c98b', xx => { ellipse(cx - w * .05, cy + w * .14, w * .44, w * .045)(xx); }, { lift: .3 }); };
      goldCloud(132, 40, 74, 3); goldCloud(236, 24, 58, 5); goldCloud(526, 34, 66, 7);
      [[196, 66, 2.4, .2], [205, 60, 2, .7], [213, 68, 1.7, .4], [384, 84, 1.8, .6]].forEach(([bx, by, bs, f]) => bird(x, bx, by, bs, '#6a5a4c', f));
      distance(x, W);
      // The meadow to a flat horizon, fields in bands, a hedge far off.
      layer(x, K.meadow, rect(0, HORIZON, W, H - HORIZON), { lift: .3 });
      inside(x, rect(0, HORIZON, W, H - HORIZON), () => {
        const g = x.createLinearGradient(0, HORIZON, 0, H); g.addColorStop(0, 'rgba(250,236,190,.45)'); g.addColorStop(1, 'rgba(250,236,190,0)'); x.fillStyle = g; x.fillRect(0, HORIZON, W, H - HORIZON);
        [[150, 3, .07], [156.5, 4, -.05], [164, 6, .06], [175, 8, -.04]].forEach(([y, h, k]) => { x.fillStyle = k > 0 ? `rgba(255,240,190,${k})` : `rgba(60,80,30,${-k})`; x.fillRect(0, y, W, h); });
        for (let i = 0; i < 900; i++) { x.fillStyle = rnd(81, i) > .5 ? 'rgba(70,90,40,.22)' : 'rgba(250,240,190,.25)'; x.fillRect(rnd(82, i) * W, HORIZON + 2 + rnd(83, i) * (H - HORIZON - 2), .3 + rnd(84, i) * .6, .25); }
      });
      for (let i = 0; i < 34; i++) layer(x, tone('#7e8f58', (rnd(85, i) - .5) * .14), blob(214 + i * 3.4, 154.4, 2.4, 1.5, 200 + i, 7, .2), { lift: .15, sh: .2 });
      // Left: trees, a lamp, the office.
      tree(x, 22, H, 64, { seed: 4, c: '#7d9a55', trunk: '#6e5238' });
      conifer(x, 66, H, 44, { c: '#5f7a4c' });
      bush(x, 84, H, 10, 7, { c: '#738f4f', seed: 5 });
      office(x, H);
      tree(x, 226, H, 82, { seed: 9, c: '#78944f', trunk: '#6e5238' });
      tree(x, 256, H, 54, { seed: 12, c: '#8aa35c', trunk: '#6e5238' });
      lampPost(x, 212, H, 34, '#4a4840');
      // Right: the data centre, bushes along it.
      datacenter(x, H);
      for (let i = 0; i < 6; i++) bush(x, 330 + i * 40 + rnd(86, i) * 8, H, 7 + rnd(87, i) * 4, 5 + rnd(88, i) * 3, { c: tone('#6f8a4a', (rnd(89, i) - .5) * .12), seed: 20 + i });
      lampPost(x, 566, H, 30, '#4a4840');
    } });
    // The lit room of the office glows: it is where the request is typed.
    const [lwx, lwy, lww, lwh] = offWin(LIT[0], LIT[1]);
    S.stand('buero', { host: 'ort', side: 'L', u: mm(lwx - 285), v: mm(190 - lwy - lwh), off: .0008, w: mm(lww), h: mm(lwh), e: .5, res: 1.6, lock: 0, amp: 0, color: '#f6d69a', draw(x, W, H) { litRoom(x, 0, 0, W, H); }, life: tt => ({ glow: .5 + .5 * ease((tt - t.frage + .4) / .6) }) });
    S.stand('zaun', { host: 'ort', side: 'R', u: .097, off: .042, w: .186, h: .013, lock: .05, amp: .06, color: '#6a6f66', draw: fence });

    // ---- the machines: the same as in the hall, at the same places
    const agentLit = tt => tt < t.agent ? .15 : tt < t.agent + .9 ? (Math.sin((tt - t.agent) * 20) > 0 ? 1 : .2) : tt < lit ? .55 : tt < lit + 1.1 ? (Math.sin((tt - lit) * 20) > 0 ? 1 : .25) : .7 + .1 * Math.sin(tt * 2);
    addAgent(S, 'ort', { signs: false, agentLit });
    addModel(S, 'ort', { signs: false, lampOn: tt => between(tt, t.kostet - .05, t.kostet + 2.6, .25) });
    // The counter's flap is shut on this spread and carries no word yet: "Runde" is spoken only on spread 4.
    S.byName.klappe.draw = (x, W, H) => { layer(x, C.brass, rrect(0, 0, W, H, .8), { lift: .2 }); layer(x, tone(C.brass, -.12), rrect(W * .3, H * .44, W * .4, 1.2, .5), { lift: 0, tooth: false }); for (const yy of [1.6, H - 1.6]) { x.fillStyle = 'rgba(60,40,10,.6)'; x.beginPath(); x.arc(1.3, yy, .4, 0, TAU); x.fill(); } };
    const win = makeWindow(S, { host: 'ort', side: 'R', ...WIN, id: 'fenster' });
    // The instructions lie at the bottom; their tab's word is printed only when it is spoken.
    win.add('anw', 5, (x, W, H) => instrSheet(x, 0, 0, W, H));
    win.read(t.kostet, 17);
    win.finish();
    // The printed layer itself, as on spreads 3 to 6 (LAYER.anw), so the word sits on slate and the pulse lights the
    // whole tab instead of blooming bare letters.
    S.stand('anwReiter', { host: 'ort', side: 'R', u: WIN.u + .0032, v: mm(win.base), off: WIN.off - .0023, w: mm(WIN.w - 6.4), h: .005, e: .14, lock: .08, amp: .05, color: C.slate, draw(x, W, H) { LAYER.anw(x, W, H); },
      // It answers 0.8 s after the window's sign, without a word of its own.
      life: tt => ({ show: tt >= t.fenster + .78 && tt > .2, glow: between(tt, t.fenster + .8, t.fenster + 3.4, .3) }) });
    // The signs: flat until their word, then they stand up.
    // A little larger than the hall's signs (3 mm), so the words read in the wider shots of this spread.
    S.stand('schildAgent', { host: 'ort', side: 'L', u: AGENT.u + mm(AGENT.w / 2 - 15), v: mm(47 - 3.3), off: AGENT.off + .0009, w: .03, h: .0066, res: 1.6, pivot: [0, 0], lock: .16, amp: .1, color: C.brass, draw(x, W, H) { plate(x, TX.agent, W / 2, H / 2, 3.6, { c: C.brass }); }, life: standUp(t.agent + .15) });
    S.stand('schildModell', { host: 'ort', side: 'R', u: RACK.u + mm(59.7 - 15), v: mm(136.6 - 3.3), off: RACK.off + .0009, w: .03, h: .0066, res: 1.6, pivot: [0, 0], lock: .1, amp: .06, color: '#e9ecea', draw(x, W, H) { plate(x, TX.modell, W / 2, H / 2, 3.6, { c: '#e9ecea' }); }, life: standUp(t.modell + .2) });
    S.stand('schildFenster', { host: 'ort', side: 'R', u: WIN.u + mm(WIN.w / 2 - 26), off: WIN.off + .0135, w: .052, h: .0068, res: 1.6, pivot: [0, 0], lock: .1, amp: .06, color: '#e9ecea', draw(x, W, H) { plate(x, TX.fenster, W / 2, H / 2, 3.6, { c: '#e9ecea', track: .3 }); }, life: standUp(t.fenster + .1) });

    // ---- the knife and the tokens
    const blade = tt => { let f = 0; for (let i = 0; i < 14; i++) { const d = tt - chop(i); if (d >= 0 && d < .17) f = Math.max(f, d < .05 ? d / .05 : 1 - (d - .05) / .12); } return f; };
    S.stand('messer', { host: 'ort', side: 'R', u: WIN.u + .0095, v: .0047, off: WIN.off + .0098, w: .021, h: .0034, res: 1.6, lock: .1, amp: .05, color: '#c9ced0', draw(x, W, H) {
      layer(x, '#aeb4b6', poly([[0, 0], [W, 0], [W, H - .9], [0, H - .2]]), { lift: .25 });
      layer(x, '#dfe3e2', poly([[0, H - 1.1], [W, H - 1.7], [W, H - .9], [0, H - .2]]), { lift: 0, tooth: false });
      layer(x, C.brass, rect(1.2, 0, 3, 1.4), { lift: .15 }); layer(x, C.brass, rect(W - 4.2, 0, 3, 1.4), { lift: .15 });
      for (const px of [2.7, W - 2.7]) { x.fillStyle = 'rgba(70,50,20,.7)'; x.beginPath(); x.arc(px, .7, .3, 0, TAU); x.fill(); }
    }, life: tt => ({ dv: -.0011 * blade(tt) }) });
    // Fourteen snippets, each a sheet of its own between the window's back and its glass. They rise from the inlet one
    // after the other into the lowest row, right on the instructions; when a new row begins, the rows above it are
    // lifted by one, as lines in a printer. At the end they lie in four rows: the question layer of spread 3.
    const TW = WIN.w - 6.4, TH = 12, TS = TH / 4 / 1.22, RH = TS * 1.22, ROW = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3], FIRST = [0, 3, 7, 10];
    const start = i => chop(i) + .03, lift = (r, tt) => { let y = 0; for (let q = r + 1; q < 4; q++) y += RH * ease((tt - start(FIRST[q]) - .06) / .3); return y; };
    let TL = null;
    for (let i = 0; i < 14; i++) {
      const dur = .8;
      S.stand('token' + i, { host: 'ort', side: 'R', u: WIN.u + .0032, v: mm(win.base + 5), off: WIN.off - .0021 + i * .00002, w: mm(TW), h: mm(TH), res: 1.6, lock: .08, amp: .05, color: C.cream,
        draw(x, W, H) { TL = tokenLayout(x, W, TS); tokenChip(x, TL[i], TL[i].x, TL[i].y, TS, i); },
        life: tt => {
          if (tt < start(i) || tt < .2) return { show: false };
          const L = TL && TL[i]; if (!L) return { show: true };
          const k = clamp((tt - start(i)) / dur), fin = TH - (L.y + L.h / 2), target = TH - (3 * RH + L.h / 2) + lift(ROW[i], tt), from = 3 - (win.base + 5);
          const v = target + (from - target) * (1 - easeOut(k)), du0 = TW / 2 - (L.x + L.w / 2);
          return { show: true, du: mm(du0 * (1 - ease(k * 1.2))), dv: mm(v - fin) };
        } });
    }

    // ---- the request on its way: a paper strip from the monitor through the agent and the hatch to the inlet
    const SW = 22, SH = 7.6, rotL = .1745, rotR = -.1745;
    const stripDraw = (x, W, H) => { layer(x, C.cream, poly([[.3, .25], [W - .2, 0], [W - .35, H - .2], [0, H]]), { lift: .3, sh: .3 }); TX.strip.forEach((s, i) => text(x, s, 1.3, 1.95 + i * 1.85, 1.3, { weight: 600, align: 'left', color: C.ink })); x.fillStyle = 'rgba(43,36,32,.1)'; x.fillRect(.4, H - .7, W - .8, .3); };
    const wA = path([PL(-.15, .1), PL(-.056, .1), PL(-.056, .058)]);
    const wB = path([PL(-.034, .058), PL(-.034, PASS.off), PL(-.025, PASS.off)]);
    const r0 = PR(.044, PASS.off), cStart = [7, r0[1] - (r0[0] - 7) * .176];
    const wC = path([cStart, r0, PR(.044, .073)]);
    const wD = path([PR(.044, .073), PR(.044, .0595)]);
    const feed = tt => { let f = 0; for (let i = 0; i < 14; i++) f += ease((tt - chop(i) + .17) / .12); return f / 14; };
    const hop = k => Math.sin(clamp(k) * Math.PI) * .0005;
    S.flat('streifenL', { side: 'L', x: wA.P[0][0] - SW / 2, y: wA.P[0][1] - SH / 2, w: mm(SW), h: mm(SH), res: 1.6, color: C.cream, lift: .0008, draw: stripDraw,
      life: tt => {
        let p, k;
        if (tt >= aGo && tt <= aIn) { k = ease((tt - aGo) / (aIn - aGo)); p = wA.at(k); }
        else if (tt >= bGo && tt <= pass) { k = ease((tt - bGo) / (pass - bGo)); p = wB.at(k); }
        else return { show: false };
        return { show: true, dx: p[0] - wA.P[0][0], dy: p[1] - wA.P[0][1], rot: rotL, hop: hop(k) };
      } });
    S.flat('streifenR', { side: 'R', x: wC.P[0][0] - SW / 2, y: wC.P[0][1] - SH / 2, w: mm(SW), h: mm(SH), res: 1.6, color: C.cream, lift: .0008, draw: stripDraw,
      life: tt => {
        if (tt < cGo || tt > cutEnd) return { show: false };
        const p = tt <= cIn ? wC.at(ease((tt - cGo) / (cIn - cGo))) : wD.at(feed(tt));
        return { show: true, dx: p[0] - wC.P[0][0], dy: p[1] - wC.P[0][1], rot: rotR, hop: tt <= cIn ? hop((tt - cGo) / (cIn - cGo)) : 0 };
      } });
    hatchLamps(S, 'ort', tt => pulse([pass], tt, .35, .6));

    // ---- in front: the monitor on the desk, keyboard, mouse, mug
    const mu = MON.u, mo = MON.off;
    S.stand('monFuss', { host: 'ort', side: 'L', u: mu + mm(MON.w / 2 - 20), off: mo - .003, w: .04, h: mm(MON.neck + 3), res: 1.6, lock: .2, amp: .08, color: K.anth, draw: monitorFoot });
    S.stand('monitor', { host: 'ort', side: 'L', u: mu, v: mm(MON.neck), off: mo, w: mm(MON.w), h: mm(MON.h), res: 1.6, lock: .2, amp: .08, color: K.anth, draw: monitorFront });
    S.stand('monBild', { host: 'ort', side: 'L', u: mu + .0025, v: mm(MON.neck + 4.6), off: mo + .0006, w: mm(MON.w - 5), h: mm(MON.h - 7.1), e: .45, res: 1.6, lock: .2, amp: .08, color: '#f4f1e8', draw: screen,
      life: tt => ({ show: tt >= t.frage, glow: .35 + .65 * ease((tt - t.frage) / .5) + .25 * between(tt, aGo - .2, aGo + .5, .15) }) });
    // The message: a light bubble in two lines, right in the chat.
    const BW = 74, BH = 12.4, bU = mu + .0025 + mm(MON.w - 5 - 3 - BW), bV = mm(MON.neck + 4.6 + (MON.h - 7.1) - 15 - BH);
    S.stand('monBlase', { host: 'ort', side: 'L', u: bU, v: bV, off: mo + .0011, w: mm(BW), h: mm(BH), e: .45, res: 1.6, lock: .2, amp: .08, color: '#dfe7d6', draw(x, W, H) {
      const s = 3, tw = Math.max(...TX.msg.map(l => textWidth(x, l, s, { font: 'Jost', weight: 500 }))), bw = Math.min(W - .4, tw + 5), bx = W - bw - .2;
      layer(x, '#dfe7d6', rrect(bx, .2, bw, H - .6, 1.8), { lift: .25, sh: .22 });
      TX.msg.forEach((l, i) => text(x, l, bx + 2.5, 1.9 + s * .78 + i * s * 1.42, s, { font: 'Jost', weight: 500, align: 'left', color: C.ink }));
    }, life: tt => { const k = ease((tt - t.frage - .55) / .35); return { show: tt >= t.frage + .55, dv: -.0018 * (1 - k), glow: .9 }; } });
    // Once the request has reached the agent, the chat shows that it is working on it: three dots on the left.
    S.stand('monArbeit', { host: 'ort', side: 'L', u: mu + .0025 + mm((MON.w - 5) * .13 + 3), v: bV - .0082, off: mo + .0011, w: .0118, h: .0058, e: .45, res: 1.6, lock: .2, amp: .08, color: '#ffffff', draw(x, W, H) {
      layer(x, '#ffffff', rrect(.2, .2, W - .4, H - .4, 1.8), { lift: .25, sh: .22 });
      for (let k = 0; k < 3; k++) { x.fillStyle = rgba(C.ink, .55 - k * .12); x.beginPath(); x.arc(W / 2 - 2.6 + k * 2.6, H / 2, .75, 0, TAU); x.fill(); }
    }, life: tt => { const k = ease((tt - aIn + .1) / .3); return { show: tt >= aIn - .1, dv: -.0012 * (1 - k), glow: .9 }; } });
    const kb = PL(-.162, .127), ms = PL(-.104, .127);
    S.flat('tastatur', { side: 'L', x: kb[0] - 37, y: kb[1] - 11, w: .074, h: .022, res: 1.6, color: K.anth, lift: .0006, draw: keyboard, life: () => ({ rot: rotL }) });
    S.flat('maus', { side: 'L', x: ms[0] - 3.6, y: ms[1] - 5.6, w: .0072, h: .0112, res: 1.6, color: K.anth, lift: .0006, draw: mouse, life: () => ({ rot: rotL }) });
    S.stand('becher', { host: 'ort', side: 'L', u: -.218, off: .134, w: .0155, h: .0148, res: 1.6, lock: .24, amp: .08, color: '#efe8d6', draw: mug });

    // ---- the big tree: its crown hides the window's upper end
    const TU = .004, TTX = (.124 - TU) * 1000;
    // 196 mm tall: the crown's top stays well above the window's upper end, which also from high up never shows.
    S.stand('baum', { host: 'ort', side: 'R', u: TU, off: .077, w: .2, h: .196, lock: .12, amp: .06, color: '#46602f', draw(x, W, H) { bigTree(x, W, H, TTX); } });

    // ---- the pages
    const trA = [PL(-.0895, .1), PL(-.056, .1), PL(-.056, .067)], trB = [PL(-.034, .067), PL(-.034, PASS.off), PL(-.019, PASS.off)];
    const trC = [[2, cStart[1] - .9], r0, PR(.044, .07)];
    S.page('L', (x, W, H) => {
      meadow(x, W, H, 3);
      // Behind the wall's line the ground lies in its shade.
      const q = [PL(-.29, -.02), PL(0, -.02), PL(0, .006), PL(-.29, .006)]; x.fillStyle = 'rgba(60,50,30,.16)'; x.beginPath(); poly(q)(x); x.fill();
      // A concrete pad under the agent, in the meadow.
      const pad = [PL(-.071, .062), PL(-.013, .062), PL(-.013, .079), PL(-.071, .079)];
      layer(x, '#cbc2b1', poly(pad), { lift: .3 }); inside(x, poly(pad), () => { x.fillStyle = 'rgba(60,50,40,.18)'; const a = PL(-.042, .062), b = PL(-.042, .079); x.fillRect(Math.min(a[0], b[0]) - .1, Math.min(a[1], b[1]), .25, Math.abs(b[1] - a[1])); concrete(x, pad, 72); });
      // The path from the meadow's edge to the office door.
      [[22, 226, 16, 7, 31], [168, 222, 20, 8, 32], [274, 214, 14, 7, 33], [40, 168, 12, 6, 34], [214, 92, 12, 5, 35]].forEach(([a, b, c, d, e]) => patch(x, a, b, c, d, e));
      footpath(x, [[-4, 152], [36, 132], [86, 104], [128, 76], [150, 56], PL(-.137, .004)], 8.5, 5);
      trench(x, trA, 7); trench(x, trB, 9);
      [[8, 196, 6], [128, 232, 7], [206, 208, 5.5], [252, 190, 6], [288, 232, 6.5], [12, 140, 5], [74, 150, 5.5], [268, 152, 5], [276, 178, 4.5], [160, 112, 5]].forEach(([a, b, c], i) => tuft(x, a, b, c, 40 + i));
      desk(x, PL);
      const ag0 = PL(AGENT.u, AGENT.off), ag1 = PL(AGENT.u + mm(AGENT.w), AGENT.off); foot(x, ag0[0], ag0[1], ag1[0], ag1[1], 1.3);
      const mf0 = PL(MON.u + mm(MON.w / 2 - 18), mo - .003), mf1 = PL(MON.u + mm(MON.w / 2 + 18), mo - .003); foot(x, mf0[0], mf0[1], mf1[0], mf1[1], 1.1);
      const mg0 = PL(-.217, .134), mg1 = PL(-.205, .134); foot(x, mg0[0], mg0[1], mg1[0], mg1[1]);
      hatchPrint(x, W, 'L', PL(0, PASS.off)[1]);
      const g = x.createLinearGradient(W, 0, W - 22, 0); g.addColorStop(0, 'rgba(30,20,12,.36)'); g.addColorStop(1, 'rgba(30,20,12,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      // Set to the front edge: in the close shot on the monitor the frame's lower edge passes behind it, in the wide shots it stays whole.
      const tw = textWidth(x, TX.title, 13, { weight: 900 }); layer(x, tone(C.page, -.02), rrect(37, 208, tw + 14, 21, 1.2), { lift: .4 }); text(x, TX.title, 44, 219, 13, { weight: 900, color: C.ink, align: 'left' });
    });
    S.page('R', (x, W, H) => {
      meadow(x, W, H, 17);
      const q = [PR(0, -.02), PR(.29, -.02), PR(.29, .006), PR(0, .006)]; x.fillStyle = 'rgba(60,50,30,.16)'; x.beginPath(); poly(q)(x); x.fill();
      // Gravel along the fence of the data centre, a concrete pad under the model's rack and the window.
      const gr = [PR(.094, .03), PR(.29, .03), PR(.29, .052), PR(.094, .052)];
      layer(x, '#cbbfa8', poly(gr), { lift: .2 }); inside(x, poly(gr), () => { for (let i = 0; i < 700; i++) { x.fillStyle = rnd(91, i) > .5 ? 'rgba(90,76,56,.4)' : 'rgba(250,240,220,.5)'; x.beginPath(); x.arc(rnd(92, i) * W, rnd(93, i) * H, .2 + rnd(94, i) * .35, 0, TAU); x.fill(); } });
      const pad = [PR(.012, .022), PR(.096, .022), PR(.096, .079), PR(.012, .079)];
      layer(x, '#cbc2b1', poly(pad), { lift: .3 }); inside(x, poly(pad), () => { x.strokeStyle = 'rgba(60,50,40,.16)'; x.lineWidth = .25; for (const u of [.04, .068]) { const a = PR(u, .022), b = PR(u, .079); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); } concrete(x, pad, 71); });
      // A path across the meadow to the gate in the fence.
      [[48, 208, 18, 8, 51], [150, 186, 16, 7, 52], [278, 150, 14, 7, 53], [96, 140, 12, 6, 54], [262, 224, 12, 6, 55]].forEach(([a, b, c, d, e]) => patch(x, a, b, c, d, e));
      footpath(x, [[262, 240], [246, 200], [222, 160], [206, 126], PR(.2, .05)], 8.5, 13);
      trench(x, trC, 11);
      [[20, 200, 6], [64, 150, 5.5], [128, 226, 6.5], [190, 228, 6], [236, 142, 5], [284, 194, 6], [102, 82, 4.5], [150, 91, 5], [238, 106, 4.5], [32, 128, 5]].forEach(([a, b, c], i) => tuft(x, a, b, c, 60 + i));
      const rk0 = PR(RACK.u, RACK.off), rk1 = PR(RACK.u + mm(RACK.w), RACK.off); foot(x, rk0[0], rk0[1], rk1[0], rk1[1]);
      const w0 = PR(WIN.u, WIN.off + .009), w1 = PR(WIN.u + mm(WIN.w), WIN.off + .009); foot(x, w0[0], w0[1], w1[0], w1[1], 1.3);
      const z0 = PR(.097, .042), z1 = PR(.283, .042); foot(x, z0[0], z0[1], z1[0], z1[1], .7);
      // The tree's foot: roots, a ring of darker earth, a few leaves.
      const tf = PR(.124, .077);
      layer(x, '#7d6a4c', ellipse(tf[0], tf[1], 9, 4.2), { lift: .15 }); for (let i = 0; i < 18; i++) { x.fillStyle = rnd(95, i) > .5 ? 'rgba(160,120,50,.7)' : 'rgba(110,130,60,.6)'; x.beginPath(); x.ellipse(tf[0] + (rnd(96, i) - .5) * 26, tf[1] + (rnd(97, i) - .2) * 14, .8, .45, rnd(98, i) * 3, 0, TAU); x.fill(); }
      foot(x, tf[0] - 6, tf[1], tf[0] + 6, tf[1], 1.2);
      hatchPrint(x, W, 'R', PR(0, PASS.off)[1]);
      const g = x.createLinearGradient(0, 0, 22, 0); g.addColorStop(0, 'rgba(30,20,12,.36)'); g.addColorStop(1, 'rgba(30,20,12,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    });
  };
  S.cam = t => inOrder([
    [-1.7, [0, .52, .68], [0, .03, -.02], .52, .0024],
    [.4, [-.012, .33, .56], [-.012, .075, -.04], .5, .0026],
    [Math.max(2.4, t.frage + 1.8), [-.084, .12, .335], [-.131, .055, .037], .355, .0024],
    [t.agent - .3, [-.079, .115, .327], [-.129, .054, .036], .35, .0024],
    [t.agent + 1.1, [-.05, .085, .24], [-.065, .034, 0], .40, .0026],
    [t.agent + 2.4, [-.02, .085, .235], [-.035, .037, -.008], .40, .0026],
    // On "Modell": the gutter from a little further back, the agent, the hatch, the rack with its sign, the inlet.
    [t.modell + .35, [.008, .11, .36], [.012, .075, -.03], .44, .0026],
    [t.modell + 2.5, [.01, .108, .355], [.013, .074, -.03], .435, .0026],
    // Down to the inlet: the knife, the tokens rising behind the glass, the sign at the window's foot.
    [t.tokens - .3, [.044, .13, .2], [.031, .024, -.025], .36, .0024],
    [t.fenster + .7, [.043, .128, .195], [.031, .026, -.026], .355, .0024],
    // A slow pull back to the window and the rack, a little from below, for the tab and the reading light.
    [t.kostet - .5, [.074, .042, .325], [.045, .079, -.03], .42, .0024],
    [Math.min(t.kostet + 1.0, S.plan - 1.2), [.071, .044, .32], [.044, .08, -.031], .415, .0024],
    // "kostet" ends the paragraph: back to the whole place before the leaf turns.
    [S.plan - .2, [-.004, .335, .565], [-.004, .075, -.04], .525, .0026],
  ]);
  // This spread stands on the back of the thin title page, which bends while it turns (book.js): its gutter edge
  // leads, its fore edge lags. The pop-up is rigid; while the page turns it lies on the chord of that bend instead of
  // on the leaf's mean angle, so it never passes through the paper and lifts off it as little as a rigid piece can.
  const ET = u => { u = clamp(u); return 2.1 * u * u - 1.1 * u * u * u; };
  const unET = s => { let a = 0, b = 1; for (let i = 0; i < 32; i++) { const m = (a + b) / 2; if (ET(m) < s) a = m; else b = m; } return (a + b) / 2; };
  const place0 = S.place.bind(S), END = Math.PI + .032;
  S.place = (kin, tau) => {
    if (tau < 0) { const s = clamp((kin.psiL - kin.psiR) / (END - kin.psiR)); if (s > 0 && s < .995) { const raw = unET(s), base = ET(raw * THIN_LEAD), tip = ET((raw - THIN_LAG) / (1 - THIN_LAG)); kin = { ...kin, psiL: kin.psiR + (END - kin.psiR) * (base + tip) / 2 }; } }
    return place0(kin, tau);
  };
  return S;
}
