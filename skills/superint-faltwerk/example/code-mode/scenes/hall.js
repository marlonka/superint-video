// The place of spreads 3 to 5, and the mechanisms spreads 2 and 6 share with it: one building in section, the gutter
// its dividing wall. Left the hall of the services with the agent, right the model and its context window.
// What crosses the gutter through the brass hatch goes to the model, and costs tokens.
import { layer, inside, stroke, text, textWidth, rect, rrect, circle, poly, tone, rgba, rnd, TAU, wash, blend } from './paper.js';
import { bricks } from './paperkit.js';
import { C, SERVICE, plate, clamp, ease, rise, on, between } from './techkit.js';
import { cage, mcpPlug, agentBox, agentDisplay, fan, instrSheet, cardStack, listingStack } from './machines.js';

export const WALL = { z: -.1, alpha: 80, wL: .285, wR: .285, h: .19 };
// Where things stand: u in metres from the gutter (left negative), off in front of the wall, w and h in mm.
export const CAGES = [['RECHNUNGEN', -.063, 45, 120, .03], ['TABELLE', -.107, 40, 104, .024], ['MAIL', -.143, 32, 112, .032], ['KALENDER', -.177, 30, 82, .022], ['DATEIEN', -.217, 36, 124, .03], ['CHAT', -.251, 30, 94, .024], ['WETTER', -.279, 24, 72, .033]];
export const AGENT = { u: -.064, w: 44, h: 52, off: .07 }, RACK = { u: .018, w: 74, h: 150, off: .03 }, WIN = { u: .024, w: 40, h: 176, off: .061 };
export const PASS = { off: .084, half: 15, d: 12 }, TRUNK = .05, PLATE_Y = 62;
const mm = v => v / 1000;

// ---------------------------------------------------------------- the model's rack and the window in front of it
// The front rack of the model: GPU drawers behind glass on the left (the window stands in front of them), and on the
// right the column where it speaks: lamp, round counter, the brass slot. Returns where those sit (mm in the sheet).
export function rackModel(x, a, base, w, h, o = {}) {
  const top = base - h, cw = 27, x0 = a + 3, x1 = a + w - cw - 1.5, n = 9, uh = (h - 13.5) / n;
  layer(x, '#1b1e20', rrect(a, top, w, h, 1.3), { lift: .7 });
  layer(x, '#282c30', rect(a + 1.6, top + 9, w - 3.2, h - 12.6), { lift: 0 });
  for (const fx of [a + 3, a + w - 6]) layer(x, '#0f1112', rect(fx, base - 1.6, 3, 1.6), { lift: 0, tooth: false });
  for (let i = 0; i < n; i++) {
    const y = top + 9.6 + i * uh, f = i % 2, fr = (uh - 1) * .34, cy = y + (uh - 1) / 2;
    layer(x, tone('#3b4246', (rnd(51, i) - .5) * .12), rrect(x0, y, x1 - x0, uh - 1, .5), { lift: .25, sh: .4 });
    fan(x, f ? x1 - fr - 1.5 : x0 + fr + 1.5, cy, fr, i * .7);
    const g0 = f ? x0 + 2 : x0 + fr * 2 + 3.4, g1 = f ? x1 - fr * 2 - 3.4 : x1 - 2, fins = 13 + (i % 3) * 3;
    for (let k = 0; k < fins; k++) { x.fillStyle = k % 2 ? 'rgba(170,180,184,.5)' : 'rgba(18,20,22,.55)'; x.fillRect(g0 + k * (g1 - g0) / fins, y + 1.1, (g1 - g0) / fins * .55, uh - 3.2); }
    x.fillStyle = i % 4 === 1 ? C.amber : C.green; x.fillRect(f ? x0 + .7 : x1 - 1.6, y + 1.3, .9, .6);
  }
  x.save(); x.strokeStyle = '#596166'; x.lineWidth = .7; x.strokeRect(a + 2, top + 9.2, x1 - a - 1.2, h - 13); x.restore();
  // The column: brushed steel, the lamp on top, the counter, the slot at chest height.
  const cx = a + w - cw, lampC = [cx + cw / 2 - .8, top + 25], counter = [cx + cw / 2 - 5.3, base - 106, 9, 11], slot = [cx + 1.6, base - 86, cw - 5.2, 2.6];
  layer(x, '#454b4f', rect(cx - 1, top + 9, cw - .6, h - 12.6), { lift: .35 });
  inside(x, rect(cx - 1, top + 9, cw - .6, h - 12.6), wash(cx, 0, cx + cw, 0, 'rgba(255,255,255,.08)', 'rgba(0,0,0,.14)'));
  layer(x, '#101214', circle(lampC[0], lampC[1], 3.1), { lift: .2, tooth: false }); layer(x, tone(C.amber, -.6), circle(lampC[0], lampC[1], 2.3), { lift: 0, tooth: false });
  text(x, 'RECHNET', lampC[0], lampC[1] + 6.2, 1.9, { font: 'Jost', weight: 700, track: .22, color: 'rgba(233,236,234,.8)' });
  layer(x, C.brass, rrect(counter[0] - 1, counter[1] - 1, counter[2] + 2, counter[3] + 2, .9), { lift: .25 });
  layer(x, '#0f1011', rrect(counter[0], counter[1], counter[2], counter[3], .4), { lift: 0, tooth: false });
  layer(x, C.brass, rrect(slot[0] - 1.1, slot[1] - 1.1, slot[2] + 2.2, slot[3] + 2.2, 1), { lift: .25 });
  layer(x, '#0a0b0c', rrect(slot[0], slot[1], slot[2], slot[3], .5), { lift: 0, tooth: false });
  text(x, 'AUSGABE', slot[0] + slot[2] / 2, slot[1] + 7.4, 1.9, { font: 'Jost', weight: 700, track: .24, color: 'rgba(233,236,234,.8)' });
  // Below the slot: a ventilation grille and the maker's blank plate.
  x.fillStyle = 'rgba(0,0,0,.42)'; for (let r = 0; r < 14; r++) x.fillRect(cx + 2, base - 62 + r * 2.2, cw - 6.4, .8);
  { const px = cx + 4, py = base - 24, pw = cw - 10.4, ph = 6;
    layer(x, '#8a9296', rrect(px, py, pw, ph, .6), { lift: .15 });
    inside(x, rect(px, py, pw, ph), wash(px, py, px, py + ph, 'rgba(255,255,255,.16)', 'rgba(0,0,0,.12)'));
    x.strokeStyle = 'rgba(30,34,36,.45)'; x.lineWidth = .14; x.strokeRect(px + .7, py + .7, pw - 1.4, ph - 1.4);
    for (const sx of [px + 1.4, px + pw - 1.4]) { x.fillStyle = '#5d6468'; x.beginPath(); x.arc(sx, py + ph / 2, .42, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,.4)'; x.beginPath(); x.arc(sx - .12, py + ph / 2 - .12, .15, 0, TAU); x.fill(); }
    // An asset tag: a white label with a barcode.
    layer(x, '#eef0ec', rect(px + 3, py + 1.5, pw - 6, ph - 3), { lift: .05, tooth: false });
    x.fillStyle = '#1d2022'; for (let i = 0, bx = px + 3.6; bx < px + pw - 3.8; i++) { const bw = .14 + rnd(91, i) * .3; x.fillRect(bx, py + 1.9, bw, ph - 3.8); bx += bw + .14 + rnd(92, i) * .22; } }
  x.fillStyle = 'rgba(0,0,0,.45)'; for (let i = 0; i < 16; i++) x.fillRect(a + 4 + i * (w - 8) / 16, top + 1.6, (w - 8) / 16 - .6, .6);
  return { lamp: lampC, counter, slot, signAt: [cx + cw / 2 - .8, top + 13.4], top };
}
// One of the plain GPU racks behind it: drawers, lights, a copper and a black line down from the header.
export function gpuRack(x, a, base, w, h, seed = 0) {
  const top = base - h, n = 8, uh = (h - 8) / n;
  for (const [px, c] of [[a + w * .3, '#b87333'], [a + w * .7, '#141618']]) { layer(x, c, rect(px - .8, top - 30, 1.6, 34), { lift: .2, sh: .3 }); x.fillStyle = '#9aa3a6'; x.fillRect(px - 1.2, top - 4, 2.4, 1); }
  layer(x, '#1f2225', rrect(a, top, w, h, 1), { lift: .5 });
  for (let i = 0; i < n; i++) { const y = top + 4.4 + i * uh; layer(x, tone('#343a3e', (rnd(seed + 3, i) - .5) * .12), rect(a + 2, y, w - 4, uh - 1), { lift: .15, sh: .3 }); for (let k = 0; k < 11; k++) { x.fillStyle = k % 2 ? 'rgba(150,160,164,.4)' : 'rgba(10,12,14,.5)'; x.fillRect(a + 7 + k * (w - 13) / 11, y + 1, (w - 13) / 11 * .55, uh - 3); } x.fillStyle = (i + seed) % 5 === 2 ? C.amber : C.green; x.fillRect(a + 3, y + 1.2, 1.6, .8); x.fillRect(a + 3, y + 2.8, 1.6, .8);
    // A steel pull handle at the drawer's end and a small asset label under its lights.
    layer(x, '#7d868a', rrect(a + w - 5.3, y + 1.2, 1.5, uh - 3.4, .6), { lift: .3, sh: .35, shade: wash(a + w - 5.3, 0, a + w - 3.8, 0, 'rgba(255,255,255,.35)', 'rgba(0,0,0,.2)') });
    layer(x, '#e4e6e1', rect(a + 2.7, y + 4.6, 3.4, 1.7), { lift: .05, tooth: false }); x.fillStyle = 'rgba(30,32,34,.6)'; x.fillRect(a + 3.1, y + 5.1, 2.2 + rnd(seed + 5, i) * .5, .25); x.fillRect(a + 3.1, y + 5.65, 1.4 + rnd(seed + 6, i) * .8, .25); }
}
// The context window: an oak frame with brass fittings and glass, no upper end. Back: the dark wall behind the pane
// with its ticks; front: stiles, a glazing bar every 30 mm, reflections, and at the foot the inlet with its knife.
export function windowBack(x, W, H) {
  layer(x, '#3b342e', rect(0, 0, W, H), { lift: 0 });
  inside(x, rect(0, 0, W, H), () => {
    wash(0, 0, W, 0, 'rgba(0,0,0,.28)', 'rgba(255,240,220,.07)')(x);
    // A back of stained oak: long grain running up, a few darker streaks, the light a little stronger towards the top.
    x.lineCap = 'round';
    for (let k = 0; k < 300; k++) {
      const px = rnd(301, k) * W, py = rnd(302, k) * H, l = 8 + rnd(303, k) * 46, lt = rnd(304, k) > .45, wob = (rnd(305, k) - .5) * 1.2;
      x.strokeStyle = lt ? `rgba(236,206,168,${.035 + rnd(306, k) * .05})` : `rgba(10,6,3,${.08 + rnd(306, k) * .12})`; x.lineWidth = .1 + rnd(307, k) * .26;
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + wob, py - l / 2, px + wob * .4, py - l); x.stroke();
    }
    { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,236,200,.06)'); g.addColorStop(1, 'rgba(0,0,0,.1)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
    // The frame stands in front of it: the stiles and every glazing bar leave a soft shade on the back.
    for (const [a, b] of [[0, 5.5], [W, W - 5.5]]) { const g = x.createLinearGradient(a, 0, b, 0); g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(Math.min(a, b), 0, 5.5, H); }
    for (let y = H - 8 - 30; y > 4; y -= 30) { const g = x.createLinearGradient(0, y + .8, 0, y + 5.5); g.addColorStop(0, 'rgba(0,0,0,.3)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, y + .8, W, 4.7); }
  });
  x.fillStyle = 'rgba(243,236,216,.5)'; for (let y = H - 8, k = 0; y > 0; y -= 5, k++) x.fillRect(3.4, y - .1, k % 5 === 0 ? 3.6 : 2, .22);
}
export function windowFront(x, W, H, o = {}) {
  const oak = o.oak || C.oak, sw = 3;
  for (const px of [0, W - sw]) { layer(x, oak, rect(px, 0, sw, H), { lift: .5 }); inside(x, rect(px, 0, sw, H), () => { for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(90,56,26,${.06 + rnd(13 + px, k) * .1})`; x.fillRect(px + rnd(14, k) * sw, rnd(15 + px, k) * H, .14, 6 + rnd(16, k) * 22); } }); x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(px + .3, 0, .3, H); }
  for (let y = H - 8 - 30; y > 4; y -= 30) { layer(x, tone(oak, -.08), rect(sw, y - .8, W - 2 * sw, 1.6), { lift: .3 }); for (const px of [sw + .2, W - sw - 1.6]) { x.fillStyle = C.brass; x.fillRect(px, y - 1.4, 1.4, 2.8); } }
  // Glass: in every pane two short slanting glints of silvered paper, a broad and a fine one, close to the right stile.
  // A pale wash would be cut away with the clear parts of the sheet, so the glints are solid and small, and they keep
  // clear of the bands where the question's tokens lie (5-20 mm above the sill on spreads 2 and 5, 50-62 mm on 3 and 4).
  inside(x, rect(sw, 0, W - 2 * sw, H - 8), () => {
    const sill = H - 8, r = W - sw;
    for (let k = 0; sill - 30 * k > 4; k++) {
      // [top, bottom] of the glint in mm above the sill; old glass is never quite flat, so they differ a little.
      // A window whose stack moves differently passes its own: o.glints[k] = [top, bottom], or null for no glint there.
      const own = o.glints && k in o.glints ? o.glints[k] : undefined;
      if (own === null) continue;
      const [hT, hB] = own || (k === 0 ? [29.2, 23.4] : k === 1 ? [47.6, 38.6] : [30 * (k + 1) - 1.2 - (k % 3) * 1.1, 30 * (k + 1) - 1.2 - (k % 3) * 1.1 - (11.9 - (k % 2) * 3.2)]);
      const t = sill - hT, l = hT - hB, s = l / 1.43;
      for (const [d, bw, c] of [[0, 1.1, '#d9dfdb'], [2.1, .45, '#c8cfcb']]) {
        x.fillStyle = c; x.beginPath(); x.moveTo(r - 2.2 - s + d, t); x.lineTo(r - 2.2 - s + d + bw, t); x.lineTo(r - 2.2 + d + bw, t + l); x.lineTo(r - 2.2 + d, t + l); x.closePath(); x.fill();
      }
    }
  });
  // The sill and the inlet: a brass flap with a steel knife edge.
  layer(x, tone(oak, -.16), rect(0, H - 8, W, 8), { lift: .5 });
  layer(x, C.brass, rrect(W * .2, H - 6.4, W * .6, 4.6, .7), { lift: .3 });
  layer(x, '#101112', rect(W * .25, H - 4.6, W * .5, 1.1), { lift: 0, tooth: false });
  layer(x, '#dfe3e2', poly([[W * .25, H - 4.9], [W * .75, H - 5.5], [W * .75, H - 4.6], [W * .25, H - 4.6]]), { lift: .12, tooth: false });
  for (const px of [W * .22, W * .78]) { x.fillStyle = 'rgba(70,50,20,.7)'; x.beginPath(); x.arc(px, H - 2.6, .4, 0, TAU); x.fill(); }
}
// The question as the model reads it: fourteen tokens in four rows. Leading spaces stay with their word.
export const TOKENS = ['Trag', ' alle', ' offenen', ' Rech', 'nungen', ' in', ' eine', ' Tabelle', ' und', ' schreib', ' die', ' Summe', ' darunter', '.'];
export const TOKEN_ROWS = [[0, 1, 2], [3, 4, 5, 6], [7, 8, 9], [10, 11, 12, 13]];
// Lays the tokens out in a field W wide; returns [{s, x, y, w, h}] (mm, top left of each snippet).
export function tokenLayout(x, W, size = 2.5) {
  const out = [], rh = size * 1.22, gap = .3;   // the rows stay clear of the window's posts, also seen from the side
  TOKEN_ROWS.forEach((row, r) => { const ws = row.map(i => textWidth(x, TOKENS[i].trim(), size, { weight: 600 }) + 1.0 + (TOKENS[i][0] === ' ' ? .4 : 0)); let px = (W - ws.reduce((p, c) => p + c, 0) - gap * (row.length - 1)) / 2; row.forEach((i, k) => { out[i] = { s: TOKENS[i], x: px, y: r * rh, w: ws[k], h: rh - .35 }; px += ws[k] + gap; }); });
  return out;
}
export function tokenChip(x, t, a = 0, b = 0, size = 2.5, i = 0) {
  const sk = (rnd(91, i) - .5) * .5;
  layer(x, C.cream, poly([[a + sk, b], [a + t.w, b], [a + t.w - sk, b + t.h], [a, b + t.h]]), { lift: .25, sh: .3 });
  text(x, t.s.trim(), a + t.w / 2 + (t.s[0] === ' ' ? .2 : 0), b + t.h / 2 + .1, size, { weight: 600, color: C.ink });
}
// The question as one layer of the stack (spreads 3 to 5): the four rows on the dark of the window.
export function questionLayer(x, W, H) {
  layer(x, '#3b342e', rect(0, 0, W, H), { lift: 0, tooth: false });
  const L = tokenLayout(x, W, H / 4 / 1.22); L.forEach((t, i) => tokenChip(x, t, t.x, t.y, H / 4 / 1.22, i));
}

// A window with its stack. o: { host, side, u, off, w, h (mm), id, base (mm above the floor where the stack starts) }.
// add(name, H, paint, grow): a layer H mm high; grow(t) says how much of it is there (0..1). Layers are listed from
// the bottom up. A layer that grows rises from below behind the layers under it and lifts everything above it.
export function makeWindow(S, o) {
  const id = o.id || 'win', base = o.base ?? 8, layers = [], runs = [];
  S.stand(id + 'Back', { host: o.host, side: o.side, u: o.u, off: o.off - .009, w: mm(o.w), h: mm(o.h), lock: .08, amp: .05, color: '#3b342e', draw: (x, W, H) => windowBack(x, W, H) });
  const api = {
    layers, base,
    add(name, H, paint, grow = () => 1, extra = {}) {
      const i = layers.length; layers.push({ name, H, grow });
      S.stand(`${id}_${name}`, { host: o.host, side: o.side, u: o.u + .0032, v: mm(base), off: o.off - .0025 - i * .0004, w: mm(o.w - 6.4), h: mm(H), lock: .08, amp: .05, color: '#3b342e', draw: (x, W, HH) => paint(x, W, HH), ...extra,
        life: t => { const g = grow(t); return { show: t > .2 && g > .002, dv: mm(api.topOf(i, t) - H), ...(extra.also ? extra.also(t) : {}) }; } });
      return api;
    },
    // The height of the stack's top above its base at t, up to and including layer i (all layers by default).
    topOf(i, t) { let y = 0; for (let j = 0; j <= i; j++) y += layers[j].H * clamp(layers[j].grow(t)); return y; },
    top(t) { return api.topOf(layers.length - 1, t); },
    // The reading light runs once from the very bottom to the top of the stack, 40 mm a second. Returns when it is done.
    read(t0, height) { const d = Math.max(.35, (height ?? api.top(t0 + .01)) / 40); runs.push([t0, d]); return t0 + d; },
    // Something that glows on layer i (the red marks, say): the same place, a hair in front. glow(t) 0..1.
    overlay(name, i, paint, glow) {
      const H = layers[i].H;
      S.stand(`${id}_${name}`, { host: o.host, side: o.side, u: o.u + .0032, v: mm(base), off: o.off - .0023 - i * .0004, w: mm(o.w - 6.4), h: mm(H), e: 1, lock: .08, amp: .05, color: C.stamp, draw: (x, W, HH) => paint(x, W, HH),
        life: t => { const g = glow(t); return { show: g > .02, glow: g, dv: mm(api.topOf(i, t) - H) }; } });
      return api;
    },
    finish() {
      S.stand(id + 'Light', { host: o.host, side: o.side, u: o.u + .0032, v: mm(base), off: o.off + .0012, w: mm(o.w - 6.4), h: .0022, e: .8, lock: .08, amp: .05, color: '#fff3c8', draw: (x, W, H) => { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,243,200,.0)'); g.addColorStop(.5, '#fff6d6'); g.addColorStop(1, 'rgba(255,243,200,.0)'); x.fillStyle = '#ffe9a8'; x.fillRect(0, H * .25, W, H * .5); x.fillStyle = g; x.fillRect(0, 0, W, H); },
        life: t => { const r = runs.find(r => t >= r[0] && t <= r[0] + r[1] + .12); if (!r) return { show: false }; const k = clamp((t - r[0]) / r[1]); return { show: true, dv: mm(k * r[1] * 40), glow: Math.min(1, (t - r[0]) * 8) * (1 - clamp((t - r[0] - r[1]) / .12)) }; } });
      S.stand(id + 'Front', { host: o.host, side: o.side, u: o.u, off: o.off + .009, w: mm(o.w), h: mm(o.h), lock: .1, amp: .05, color: C.oak, draw: (x, W, H) => windowFront(x, W, H, o) });
      return api;
    },
  };
  return api;
}

// ---------------------------------------------------------------- ways on the floor
// A way through the cable channels on one page. pts: [[u, off], ...] in metres. at(k), k 0..1, gives page millimetres.
export function way(S, side, pts, host = 'halle') { return wayP(pts.map(([u, o]) => S.spot(host, side, u, o)), side); }
// The same way walked the other way round.
export const back = w => wayP([...w.P].reverse(), w.side);
function wayP(P, side) {
  const L = [0];
  for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const len = L[L.length - 1];
  return { P, len, side, at(k) { const d = clamp(k) * len; let i = 1; while (i < P.length - 1 && L[i] < d) i++; const f = (d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]); return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * f, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f]; } };
}
// The printed channel under a way: a dark slot with brass edges.
export function channel(x, w, width = 3.4) {
  const line = (c, lw) => { x.save(); x.strokeStyle = c; x.lineWidth = lw; x.lineJoin = 'round'; x.lineCap = 'butt'; x.beginPath(); w.P.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke(); x.restore(); };
  line('rgba(40,30,16,.22)', width + 1.6); line(C.brass, width + .9); line('#2a2520', width); line('rgba(0,0,0,.35)', width * .4);
}
// A piece that travels the channels: a flat sheet that follows ways one after the other. legs: [{ way, t0, t1 }]
// (seconds after landing; same page as `side`). Between legs it waits where it is; before the first and after the last
// it is not there, unless o.stay keeps it at its last place.
export function traveller(S, name, o) {
  const legs = o.legs, w = o.w, h = o.h, p0 = legs[0].way.at(0), x0 = p0[0] - w / 2, y0 = p0[1] - h / 2;
  return S.flat(name, { side: o.side, x: x0, y: y0, w: mm(w), h: mm(h), res: o.res, e: o.e, color: o.color || C.manila, lift: o.lift || .0007, draw: o.draw,
    life: t => {
      if (t < legs[0].t0 || (!o.stay && t > legs[legs.length - 1].t1)) return { show: false };
      let L = legs[0]; for (const l of legs) if (t >= l.t0) L = l;
      const k = ease((t - L.t0) / (L.t1 - L.t0)), p = L.way.at(k);
      return { show: true, dx: p[0] - w / 2 - x0, dy: p[1] - h / 2 - y0, hop: Math.sin(clamp((t - L.t0) / (L.t1 - L.t0)) * Math.PI) * .0006, ...(o.also ? o.also(t) : {}) };
    } });
}

// ---------------------------------------------------------------- the three machines, wherever they stand
// The agent with its display. o.signs === false leaves the brass plate off (it then stands up on its word).
export function addAgent(S, host, o = {}) {
  S.stand('agent', { host, side: 'L', u: AGENT.u, off: AGENT.off, w: mm(AGENT.w), h: mm(AGENT.h), lock: .16, amp: .1, color: '#b9ad95', draw(x, W, HH) { agentBox(x, 0, HH, W, HH, { sign: o.signs !== false }); } });
  S.stand('agentDisp', { host, side: 'L', u: AGENT.u + .004, v: mm(AGENT.h * .8 - 10), off: AGENT.off + .0007, w: mm(AGENT.w * .52), h: mm(AGENT.h * .2), e: .5, lock: .16, amp: .1, color: '#0f1513', draw(x, W, HH) { agentDisplay(x, W, HH); }, life: t => ({ glow: .35 + .65 * (o.agentLit ? o.agentLit(t) : .5 + .5 * Math.sin(t * 2.2)) }) });
}
// The model's front rack with lamp, counter and flap. o: { counter: { open, steps, max }, lampOn, signs }. Returns the counter.
export function addModel(S, host, o = {}) {
  let RK = null;
  S.stand('rack', { host, side: 'R', u: RACK.u, off: RACK.off, w: mm(RACK.w), h: mm(RACK.h), lock: .1, amp: .06, color: '#1b1e20', draw(x, W, HH) { RK = rackModel(x, 0, HH, W, HH); if (o.signs !== false) plate(x, 'MODELL', RK.signAt[0], RK.signAt[1], 3, { c: '#e9ecea' }); } });
  const colU = RACK.u + mm(RACK.w - 27), cnt = { open: null, steps: [], ...(o.counter || {}) };
  S.stand('lampe', { host, side: 'R', u: colU + mm(27 / 2 - .8 - 2.3), v: mm(RACK.h - 25 - 2.3), off: RACK.off + .0008, w: .0046, h: .0046, e: .9, lock: .1, amp: .06, color: C.amber, draw(x, W, HH) { layer(x, C.amber, circle(W / 2, HH / 2, W * .46), { lift: 0, tooth: false }); layer(x, '#ffe6ae', circle(W * .42, HH * .4, W * .16), { lift: 0, tooth: false }); }, life: t => { const g = o.lampOn ? o.lampOn(t) : 0; return { show: g > .02, glow: g }; } });
  // The counter: the digit that is on, and the flap over it that opens on "Runde".
  for (let d = 0; d <= (cnt.max ?? cnt.steps.length); d++) S.stand('ziffer' + d, { host, side: 'R', u: colU + mm(27 / 2 - 5.3), v: .095, off: RACK.off + .0006, w: .009, h: .011, e: .25, lock: .1, amp: .06, color: '#f6f3ea', draw(x, W, HH) { layer(x, '#f6f3ea', rect(0, 0, W, HH), { lift: 0, tooth: false }); text(x, String(d), W / 2, HH / 2 + .3, 8.4, { font: 'Jost', weight: 700, color: '#141414' }); x.fillStyle = 'rgba(0,0,0,.15)'; x.fillRect(0, 0, W, 1.2); x.fillRect(0, HH - 1.4, W, 1.4); },
    life: t => { const a = d ? cnt.steps[d - 1] : -1e9, b = d < cnt.steps.length ? cnt.steps[d] : 1e9; return { show: cnt.open !== null && t >= cnt.open - .01 && t >= a && t < b, glow: .6 }; } });
  // The flap is plain brass with a finger grip and its hinge pins: the word "Runde" is not printed before it is spoken.
  S.stand('klappe', { host, side: 'R', u: colU + mm(27 / 2 - 6.3), v: .094, off: RACK.off + .0011, w: .011, h: .013, pivot: [0, 0], lock: .1, amp: .06, color: '#8a6a2a', draw(x, W, HH) { layer(x, C.brass, rrect(0, 0, W, HH, .8), { lift: .2 }); layer(x, tone(C.brass, -.12), rrect(W * .3, HH * .44, W * .4, 1.2, .5), { lift: 0, tooth: false }); x.fillStyle = 'rgba(255,240,200,.35)'; x.fillRect(W * .32, HH * .44 + 1.05, W * .36, .2); for (const yy of [1.6, HH - 1.6]) { x.fillStyle = 'rgba(60,40,10,.6)'; x.beginPath(); x.arc(1.3, yy, .4, 0, TAU); x.fill(); } },
    life: t => ({ ry: cnt.open === null ? 0 : -2.05 * ease((t - cnt.open) / .5) }) });
  // Its sign stands up over the counter on the word, as every sign does, and stays.
  S.stand('rundeSchild', { host, side: 'R', u: colU + mm(12.7 - 6.5), v: .1083, off: RACK.off + .0009, w: .013, h: .0042, res: 1.6, pivot: [0, 0], lock: .1, amp: .06, color: '#e9ecea', draw(x, W, HH) { plate(x, 'RUNDE', W / 2, HH / 2, 2.1, { c: '#e9ecea', screws: false, w: W - .4, h: HH - .4 }); },
    life: t => cnt.open === null ? { show: false } : standUp(cnt.open)(t) });
  return cnt;
}
// The hatch at the gutter. hatchPrint: half of the brass cover on a page (cy: its centre in page millimetres, from
// S.spot(host, side, 0, PASS.off)[1]). hatchLamps: the lamp under its slits, glow(t) 0..1.
export function hatchPrint(x, W, side, cy) {
  const L = side === 'L', hx = L ? W : 0, sgn = L ? -1 : 1;
  layer(x, C.brass, rrect(L ? hx - PASS.half : hx - 2, cy - PASS.d / 2, PASS.half + 2, PASS.d, 1.4), { lift: .35 });
  for (let k = 0; k < 4; k++) { x.fillStyle = '#17120a'; x.fillRect(hx + sgn * (2.2 + k * 3) - (L ? 1.6 : 0), cy - 3.6, 1.6, 7.2); }
  for (const yy of [-4.6, 4.6]) { x.fillStyle = 'rgba(70,50,20,.7)'; x.beginPath(); x.arc(hx + sgn * 13, cy + yy, .5, 0, TAU); x.fill(); }
}
export function hatchLamps(S, host, glow) {
  ['L', 'R'].forEach(side => { const c = S.spot(host, side, 0, PASS.off), L = side === 'L'; S.flat('pass' + side, { side, x: L ? c[0] - 12 : 1, y: c[1] - 3.6, w: .011, h: .0072, e: 1, lift: .0006, color: '#17120a', draw(x, W, HH) { for (let k = 0; k < 4; k++) { x.fillStyle = '#ffc45a'; x.fillRect(L ? W - 3.8 - k * 3 : 1.2 + k * 3, 0, 1.6, HH); } }, life: t => { const g = glow ? glow(t) : 0; return { show: g > .02, glow: g }; } }); });
}

// ---------------------------------------------------------------- the hall
// pal: { sky: [top, horizon], sun: [x mm, y mm, r, colour] | null, stars, wallL, wallR, floorA, floorB, floorR, lamps (0..1), dim (0..1 for the cages), lit: names of cages in the light }
// o: { title, plugs: t => seconds when cage k plugs in (omit: all plugged), counter: { open: seconds or -1, steps: [seconds...] }, lampOn: t => 0..1, pass: t => 0..1, agentLit: t => [a, b, c] }
// Returns the ways and the window, so a spread can send things along them.
export function buildHall(S, pal, o = {}) {
  const Wl = WALL.wL * 1000, Wr = WALL.wR * 1000, H = WALL.h * 1000;
  // ---- the wall: sky over the cut roof, the block wall of the services, the dark hall of the model
  S.vfold('halle', { ...WALL, dir: 1, lock: 0, color: pal.wallL, draw(x, W, HH) {
    const roofL = 46, roofR = 7, cx = Wl;
    layer(x, pal.sky[1], xx => { xx.moveTo(0, HH); xx.lineTo(0, 30); xx.bezierCurveTo(W * .2, -4, W * .8, -4, W, 30); xx.lineTo(W, HH); xx.closePath(); }, { lift: 0, shade: wash(0, 0, 0, 62, rgba(pal.sky[0], .95), rgba(pal.sky[0], 0)) });
    if (pal.sun) { layer(x, tone(pal.sun[3], .35), circle(pal.sun[0], pal.sun[1], pal.sun[2] * 1.5), { lift: .3 }); layer(x, pal.sun[3], circle(pal.sun[0], pal.sun[1], pal.sun[2]), { lift: .4 }); }
    if (pal.stars) for (let i = 0; i < 70; i++) { x.fillStyle = rgba('#f3ecd8', .5 + rnd(3, i) * .5); x.beginPath(); x.arc(rnd(1, i) * W, 2 + rnd(2, i) * 34, .25 + rnd(4, i) * .4, 0, TAU); x.fill(); }
    // Left: the services' hall. Roof slab, trusses in red primer, limewashed blocks.
    layer(x, '#4a4540', rect(0, roofL - 5, cx + 2, 5), { lift: .5 });
    layer(x, pal.wallL, rect(0, roofL, cx, HH - roofL), { lift: .4 });
    bricks(x, 0, roofL, cx, HH - roofL, rgba(tone(pal.wallL, -.5), .2), 6.2, 15);
    inside(x, rect(0, roofL, cx, HH - roofL), wash(0, roofL, 0, HH, 'rgba(30,20,12,.22)', 'rgba(30,20,12,0)'));
    for (let k = 0; k < 7; k++) { const tx = 18 + k * 41; layer(x, '#9a4a35', poly([[tx, roofL], [tx + 20.5, roofL + 10], [tx + 41, roofL], [tx + 41, roofL + 2.4], [tx + 20.5, roofL + 12.4], [tx, roofL + 2.4]]), { lift: .3 }); }
    layer(x, '#9a4a35', rect(0, roofL + 11, cx, 3), { lift: .35 }); for (let k = 0; k < 36; k++) { x.fillStyle = 'rgba(60,24,16,.6)'; x.beginPath(); x.arc(4 + k * 8, roofL + 12.5, .45, 0, TAU); x.fill(); }
    // The sprinkler pipe and the yellow fibre tray under the ceiling, lamps between them.
    layer(x, '#a8382e', rect(0, roofL + 19, cx, 1.8), { lift: .4 }); for (let k = 0; k < 6; k++) { layer(x, '#a8382e', rect(22 + k * 46, roofL + 20, 1, 3), { lift: .2 }); layer(x, '#c9ccc9', circle(22.5 + k * 46, roofL + 23.6, .9), { lift: .15, tooth: false }); }
    layer(x, tone(C.yellow, -.12), rect(0, roofL + 28, cx, 5), { lift: .5 }); layer(x, C.yellow, rect(0, roofL + 28, cx, 1.5), { lift: 0 });
    for (let k = 0; k < 12; k++) { x.fillStyle = 'rgba(80,60,10,.35)'; x.fillRect(10 + k * 24, roofL + 28, .5, 5); }
    for (let k = 0; k < 4; k++) { const lx = 30 + k * 66; layer(x, '#55595c', rect(lx + 18, roofL + 14, .5, 6), { lift: 0 }); layer(x, '#55595c', rect(lx + 4, roofL + 14, .5, 6), { lift: 0 }); layer(x, blend('#6a6660', '#fff0bf', pal.lamps), rrect(lx, roofL + 20.6, 23, 2.6, 1), { lift: .3 }); }
    // An extinguisher and a sign at the far end, the dividing wall at the fold.
    layer(x, '#b8433a', rrect(5, HH - 26, 5, 14, 1.4), { lift: .4 }); layer(x, '#2a2a2a', rect(6.6, HH - 29.4, 1.8, 3.4), { lift: .2 }); layer(x, '#f4eedd', rect(5.4, HH - 21, 4.2, 4.6), { lift: 0 });
    layer(x, '#cfc6b4', rect(cx - 3, roofL - 8, 6, HH - roofL + 8), { lift: .6 });
    // Right: the model's hall. Heavier roof, dark wall, the coolant header with its drops.
    layer(x, pal.wallR, rect(cx + 3, 0, Wr - 3, HH), { lift: .4 });
    layer(x, '#2c2926', rect(cx + 2, 0, Wr, roofR), { lift: .5 });
    inside(x, rect(cx + 3, roofR, Wr - 3, HH - roofR), () => {
      // Cast concrete: the tone uneven from pour to pour, a lighter line where each pour ends, the holes of the
      // formwork ties in a grid, and the panel joints.
      for (let i = 0; i < 40; i++) { const px = cx + 3 + rnd(311, i) * Wr, py = roofR + rnd(312, i) * HH, r = 6 + rnd(313, i) * 22, lt = rnd(314, i) > .5, g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, lt ? 'rgba(255,240,220,.08)' : 'rgba(0,0,0,.09)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, 2 * r, 2 * r); }
      for (let y = roofR + 30; y < HH; y += 38) { x.fillStyle = 'rgba(255,240,220,.1)'; x.fillRect(cx + 3, y, Wr, .35); x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(cx + 3, y + .35, Wr, .3); }
      for (let k = 0; k < 9; k++) { x.fillStyle = 'rgba(0,0,0,.1)'; x.fillRect(cx + 3 + k * 33, roofR, .5, HH); }
      for (let k = 0; k < 9; k++) for (let y = roofR + 12; y < HH; y += 19) for (const d of [8.5, 24.5]) { const px = cx + 3 + k * 33 + d; x.fillStyle = 'rgba(0,0,0,.32)'; x.beginPath(); x.arc(px, y, .55, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,240,220,.13)'; x.beginPath(); x.arc(px + .15, y + .2, .55, 0, Math.PI); x.fill(); }
      wash(0, roofR, 0, HH, 'rgba(0,0,0,.25)', 'rgba(0,0,0,0)')(x);
    });
    layer(x, '#b87333', rect(cx + 3, roofR + 10, Wr - 3, 2.6), { lift: .4 }); layer(x, '#141618', rect(cx + 3, roofR + 15, Wr - 3, 2.2), { lift: .35 });
    for (let k = 0; k < 9; k++) { x.fillStyle = '#9aa3a6'; x.fillRect(cx + 14 + k * 31, roofR + 9.4, 1.4, 8.4); }
    // The cooling distributor at the end of the row.
    layer(x, '#5d6164', rrect(W - 20, HH - 74, 16, 74, 1.2), { lift: .5 }); for (let k = 0; k < 4; k++) { layer(x, '#b87333', circle(W - 12, HH - 62 + k * 15, 3.2), { lift: .25 }); layer(x, '#3a3632', circle(W - 12, HH - 62 + k * 15, 1.2), { lift: 0, tooth: false }); }
  } });
  // The fibre tray crosses the dividing wall and hangs in front of the window's upper end.
  S.stand('rinne', { host: 'halle', side: 'R', u: 0, v: .164, off: .074, w: .272, h: .02, lock: .12, amp: .06, color: C.yellow, draw(x, W, HH) { for (let k = 0; k < 9; k++) layer(x, '#55595c', rect(12 + k * 31, 0, .9, 9), { lift: .1 }); layer(x, tone(C.yellow, -.14), rect(0, 8, W, HH - 8), { lift: .4 }); layer(x, C.yellow, rect(0, 8, W, 2.6), { lift: 0 }); for (let k = 0; k < 13; k++) { x.fillStyle = 'rgba(80,60,10,.4)'; x.fillRect(6 + k * 22, 8, .5, HH); }
    // The tray ends in a bolted steel end plate, so it reads as ending at the hall's last rack.
    layer(x, '#55595c', rect(W - 2.2, 7.2, 2.2, HH - 7.2), { lift: .3, shade: wash(W - 2.2, 0, W, 0, 'rgba(255,255,255,.25)', 'rgba(0,0,0,.2)') }); for (const yy of [10, HH - 2.5]) { x.fillStyle = '#c9ccc9'; x.beginPath(); x.arc(W - 1.1, yy, .4, 0, TAU); x.fill(); } } });

  // ---- cages, plugs, the agent
  const lit = pal.lit || CAGES.map(c => c[0]), plugT = o.plugs, doorWay = {};
  CAGES.forEach(([name, u, w, h, off], k) => {
    const sv = SERVICE[name], dim = lit.includes(name) ? 0 : pal.dim || 0, py = Math.min(PLATE_Y, h - 16);
    S.stand('kaefig' + k, { host: 'halle', side: 'L', u, off, w: mm(w), h: mm(h), lock: .05 + k * .03, amp: .07, color: tone(sv.c, -.3), draw(x, W, HH) { const g = cage(x, 0, HH, W, HH, sv.kind, name, { c: sv.c, dim, plate: false, signSize: Math.min(2.7, (W - 6) / (name.length * .8)) }); mcpPlateAt(x, W - 7, HH - py); } });
    // The plug on its cable: it lies in the channel, stands up and seats itself in the plate.
    const t0 = plugT ? plugT(k) : -9;
    S.stand('stecker' + k, { host: 'halle', side: 'L', u: u + mm(w) - .022, off: off + .002, w: .017, h: mm(py + 3), pivot: [.0085, 0], lock: .1, amp: 0, res: 1.5, color: tone(sv.cable, -.2), draw(x, W, HH) {
        // The cable drops straight from the plug's tail and its tag hangs on it, both well inside even the narrowest cage
        // (the plug stands a little in front of the door, so seen from the side they shift towards the cage's edge).
        stroke(x, [[6, HH], [6, 12], [6, 6.2], [6.5, 3.6], [7.4, 3]], sv.cable, 1.2, { smooth: true, lift: .2 }); mcpPlug(x, 11, 3, 1, 1, 'rgba(0,0,0,0)');
        layer(x, '#f4eedd', rrect(2.8, 17, 6.4, 3.2, .5), { lift: .2 }); x.fillStyle = 'rgba(40,30,20,.5)'; x.beginPath(); x.arc(6, 17.55, .28, 0, TAU); x.fill(); text(x, 'MCP', 6, 18.85, 1.7, { font: 'Jost', weight: 700, color: C.ink }); },
      life: t => { const k2 = t - t0; if (t0 < 0) return {}; const up = k2 <= 0 ? 0 : Math.min(1, 1 - Math.exp(-k2 * 5) * Math.cos(k2 * 6)); return { show: t > .5, lie: 1 - up, du: -.0034 * (1 - ease((k2 - .45) / .25)) }; } });
    S.stand('led' + k, { host: 'halle', side: 'L', u: u + mm(w) - .0108, v: mm(py + 2.3), off: off + .0008, w: .0016, h: .0016, e: .9, lock: .05 + k * .03, amp: .07, color: C.green, draw(x, W, HH) { layer(x, C.green, circle(W / 2, HH / 2, W * .42), { lift: 0, tooth: false }); }, life: t => ({ glow: t0 < 0 ? .7 : .7 * on(t, t0 + .7, .2), show: t0 < 0 || t > t0 + .7 }) });
    doorWay[name] = way(S, 'L', [[u + mm(w) * .3, off + .006], [u + mm(w) * .3, TRUNK], [AGENT.u + mm(AGENT.w) * .5, TRUNK], [AGENT.u + mm(AGENT.w) * .5, AGENT.off - .004]]);
  });
  addAgent(S, 'halle', o);
  // The parts trolley, where a spread parks it: o.trolley = [u, off] (metres; u its left end).
  if (o.trolley) S.stand('wagen', { host: 'halle', side: 'L', u: o.trolley[0], off: o.trolley[1], w: .038, h: .036, res: 1.5, lock: .22, amp: .08, color: '#8f969a', draw: (x, W, HH) => trolley(x, W, HH) });

  // ---- the model: plain racks behind, the front rack with its column, lamp, counter
  S.stand('gpus', { host: 'halle', side: 'R', u: .1, off: .022, w: .16, h: .168, lock: .08, amp: .06, color: '#1f2225', draw(x, W, HH) { for (let k = 0; k < 4; k++) gpuRack(x, 2 + k * 40, HH, 34, 132 - (k % 2) * 6, k * 7); } });
  const cnt = addModel(S, 'halle', o);
  const win = makeWindow(S, { host: 'halle', side: 'R', ...WIN, id: 'fenster' });

  // ---- the floor: ways first, so the print and the travellers share them
  const aU = AGENT.u + mm(AGENT.w) * .5, inU = WIN.u + mm(WIN.w) * .5, slU = RACK.u + mm(RACK.w - 13);
  const ways = {
    door: doorWay,
    agentPass: way(S, 'L', [[aU, AGENT.off + .003], [aU, PASS.off], [-.004, PASS.off]]),
    passAgent: way(S, 'L', [[-.004, PASS.off], [aU, PASS.off], [aU, AGENT.off + .003]]),
    passInlet: way(S, 'R', [[.004, PASS.off], [inU, PASS.off], [inU, WIN.off + .012]]),
    slotPass: way(S, 'R', [[slU, RACK.off + .008], [slU, PASS.off + .018], [.012, PASS.off + .018], [.004, PASS.off + .004]]),
  };
  ways.toAgent = name => doorWay[name];
  ways.fromAgent = name => { const w = doorWay[name]; return way(S, 'L', [[AGENT.u + mm(AGENT.w) * .5, AGENT.off - .004], [AGENT.u + mm(AGENT.w) * .5, TRUNK], [CAGES.find(c => c[0] === name)[1] + mm(CAGES.find(c => c[0] === name)[2]) * .3, TRUNK], [CAGES.find(c => c[0] === name)[1] + mm(CAGES.find(c => c[0] === name)[2]) * .3, CAGES.find(c => c[0] === name)[4] + .006]]); };
  const extra = o.ways ? o.ways((side, pts) => way(S, side, pts)) : {};   // { name: way } more channels of this spread, printed with the others
  Object.assign(ways, extra);
  const floor = (x, W, HH, side) => {
    const L = side === 'L', Q = (a, b) => S.spot('halle', side, mm(L ? -a : a), mm(b)), quad = (a0, b0, a1, b1) => poly([Q(a0, b0), Q(a1, b0), Q(a1, b1), Q(a0, b1)]);
    const A = L ? pal.floorA : pal.floorR, B = L ? pal.floorB : tone(pal.floorR, -.12);
    x.fillStyle = tone(A, -.2); x.fillRect(0, 0, W, HH);
    // Raised floor: 24 mm tiles in two tones, every fourth one perforated; behind the wall line the plain slab.
    for (let i = -1; i < 14; i++) for (let j = 0; j < 9; j++) {
      const k = rnd(61 + j, i + 9), a0 = i * 24, b0 = j * 24;
      x.fillStyle = tone((i + j) % 2 ? A : blend(A, B, .35), (k - .5) * .07); x.beginPath(); quad(a0 + .3, b0 + .3, a0 + 23.7, b0 + 23.7)(x); x.fill();
      // Every tile has a pressed rim: its back edge catches the light, its front edge lies in a hair of shade.
      x.fillStyle = 'rgba(255,250,238,.16)'; x.beginPath(); quad(a0 + .3, b0 + .3, a0 + 23.7, b0 + .8)(x); x.fill();
      x.fillStyle = 'rgba(30,22,14,.09)'; x.beginPath(); quad(a0 + .3, b0 + 23.2, a0 + 23.7, b0 + 23.7)(x); x.fill();
      if ((i + j * 2) % 4 === 1) { x.fillStyle = rgba(tone(B, -.35), .5); for (let p = 0; p < 6; p++) for (let q = 0; q < 6; q++) { const c = Q(a0 + 3.4 + p * 3.5, b0 + 3.4 + q * 3.5); x.beginPath(); x.arc(c[0], c[1], .55, 0, TAU); x.fill(); } }
      if (k > .9) { x.fillStyle = 'rgba(40,30,20,.07)'; x.beginPath(); quad(a0 + 4, b0 + 6, a0 + 15, b0 + 17)(x); x.fill(); }
    }
    // The cold aisle in front of the GPU racks: a row of grille tiles, their louvres lit along the back edge, the dark
    // void showing between them, a rim screw in each corner.
    if (!L) for (let i = 4; i < 11; i++) {
      const a0 = i * 24, b0 = 24;
      x.fillStyle = 'rgba(16,14,12,.62)'; x.beginPath(); quad(a0 + 2, b0 + 2, a0 + 22, b0 + 22)(x); x.fill();
      for (let s = 0; s < 9; s++) { const bb = b0 + 2.7 + s * 2.2; x.fillStyle = rgba(tone(B, .25), .55); x.beginPath(); quad(a0 + 2.5, bb, a0 + 21.5, bb + .8)(x); x.fill(); x.fillStyle = 'rgba(255,250,238,.22)'; x.beginPath(); quad(a0 + 2.5, bb, a0 + 21.5, bb + .22)(x); x.fill(); }
      for (const [p, q] of [[3.2, 3.2], [20.8, 3.2], [3.2, 20.8], [20.8, 20.8]]) { const c = Q(a0 + p, b0 + q); x.fillStyle = 'rgba(200,200,196,.5)'; x.beginPath(); x.arc(c[0], c[1], .45, 0, TAU); x.fill(); }
    }
    // Wheel tracks of the parts trolley, worn faintly into the tiles along the cages.
    if (L) { x.save(); x.strokeStyle = 'rgba(60,48,36,.06)'; x.lineWidth = .7; for (const d of [0, 9]) { x.beginPath(); for (let a = 20; a <= 280; a += 10) { const c = Q(a, 132 + d - 14 * Math.sin(a / 90)); a === 20 ? x.moveTo(c[0], c[1]) : x.lineTo(c[0], c[1]); } x.stroke(); } x.restore(); }
    // Light from the hall's lamps lies on the floor in pools; at night only where the work is.
    for (const [a, b, r, al] of (L ? pal.poolsL : pal.poolsR) || []) { const c = Q(a, b), g = x.createRadialGradient(c[0], c[1], 0, c[0], c[1], r); g.addColorStop(0, `rgba(${pal.pool || '255,236,180'},${al})`); g.addColorStop(1, `rgba(${pal.pool || '255,236,180'},0)`); x.fillStyle = g; x.fillRect(c[0] - r, c[1] - r, 2 * r, 2 * r); }
    if (L) {
      // Hazard stripes in front of every cage door, the trunk channel and its branches.
      CAGES.forEach(([name, u, w, h, off]) => { const a1 = -u * 1000, a0 = a1 - w, b0 = off * 1000 + 1.5; for (let s = 0; s < w; s += 4) { x.fillStyle = (s / 4) % 2 ? '#2a2a2a' : C.yellow; x.beginPath(); quad(a0 + s, b0, Math.min(a1, a0 + s + 4), b0 + 2.4)(x); x.fill(); } });
      Object.values(doorWay).forEach(w => channel(x, w));
      channel(x, ways.agentPass);
    } else { channel(x, ways.passInlet); channel(x, ways.slotPass); }
    Object.values(extra).filter(w => w.side === side).forEach(w => channel(x, w));
    // Where things stand, the floor is darker.
    const foot = (a0, a1, b, k = 1) => { for (const [d, al] of [[3, .05], [1.6, .08], [.7, .12]]) { x.fillStyle = `rgba(30,22,14,${al * k})`; x.beginPath(); quad(a0, b - d * .3, a1, b + d)(x); x.fill(); } };
    if (L) { CAGES.forEach(([n, u, w, h, off]) => foot(-u * 1000 - w, -u * 1000, off * 1000)); foot(-AGENT.u * 1000 - AGENT.w, -AGENT.u * 1000, AGENT.off * 1000, 1.3); if (o.trolley) foot(-o.trolley[0] * 1000 - 38, -o.trolley[0] * 1000, o.trolley[1] * 1000, .9); }
    // The tile lifter; a spread whose chapter card lies there parks it elsewhere: o.lifterAt = [mm from the gutter, mm off the wall].
    if (L) { const [la, lb] = o.lifterAt || [252, 152], c0 = Q(la, lb), c1 = Q(la + 20, lb); tileLifter(x, c0, Math.atan2(c1[1] - c0[1], c1[0] - c0[0]) - .38); }
    else { foot(RACK.u * 1000, (RACK.u * 1000 + RACK.w), RACK.off * 1000); foot(WIN.u * 1000, WIN.u * 1000 + WIN.w, WIN.off * 1000 + 9, 1.3); foot(100, 260, 22); }
    // The hatch: half of the brass cover on each page, slits over the lamp.
    const hx = L ? W : 0, c = Q(0, PASS.off * 1000), sgn = L ? -1 : 1;
    hatchPrint(x, W, side, c[1]);
    // The gutter's shade, and on the left page the chapter's name.
    const g = x.createLinearGradient(hx, 0, hx + (L ? -22 : 22), 0); g.addColorStop(0, 'rgba(30,20,12,.4)'); g.addColorStop(1, 'rgba(30,20,12,0)'); x.fillStyle = g; x.fillRect(0, 0, W, HH);
    // Set in from the page's outer edge, so the medium shots do not cut the name to a fragment.
    // A spread whose shots frame the floor differently passes its own place: o.titleAt = [x, y, height, end] in page
    // mm; with `end` the card's right end is set there instead of its left end at x.
    if (L && o.title) { const tw = textWidth(x, o.title, 13, { weight: 900 }), [tx0, ty, th, te] = o.titleAt || [58, 197, 21], tx = te ? te - tw - 14 : tx0; layer(x, tone(C.page, -.02), rrect(tx, ty, tw + 14, th, 1.2), { lift: .4 }); text(x, o.title, tx + 7, ty + th / 2 + .5, 13, { weight: 900, color: C.ink, align: 'left' }); }
  };
  S.page('L', (x, W, HH) => floor(x, W, HH, 'L'));
  S.page('R', (x, W, HH) => floor(x, W, HH, 'R'));
  // The lamp under the hatch: amber through the slits when something goes to the model or comes from it.
  hatchLamps(S, 'halle', o.pass);
  return { ways, win, counter: cnt, way: (side, pts) => way(S, side, pts) };
}
// A card well let into the floor along a hero card's foot (u0..u1 along the wall, the foot at `off`): a brass-rimmed
// slot with screws and a lit lip, out of which the card stands up and into which it lies back. Call after buildHall.
export function cardWell(S, side, u0, u1, off, host = 'halle') {
  const page = S.pages[side];
  S.page(side, (x, W, HH) => {
    page(x, W, HH);
    const q = [S.spot(host, side, u0, off - .0058), S.spot(host, side, u1, off - .0058), S.spot(host, side, u1, off + .0012), S.spot(host, side, u0, off + .0012)];
    layer(x, C.brass, poly(q), { lift: .3, sh: .3 });
    const inset = (p, c, k) => [p[0] + (c[0] - p[0]) * k, p[1] + (c[1] - p[1]) * k], mid = [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2];
    const iq = q.map(p => [p[0] + Math.sign(mid[0] - p[0]) * .9, p[1] + Math.sign(mid[1] - p[1]) * .9]);
    layer(x, '#211c17', poly(iq), { lift: 0, tooth: false });
    x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); poly([iq[0], iq[1], inset(iq[1], iq[2], .35), inset(iq[0], iq[3], .35)])(x); x.fill();
    x.strokeStyle = 'rgba(255,236,180,.55)'; x.lineWidth = .18; x.beginPath(); x.moveTo(q[3][0] + .4, q[3][1] - .15); x.lineTo(q[2][0] - .4, q[2][1] - .15); x.stroke();
    for (const p of [inset(q[0], q[1], .03), inset(q[1], q[0], .03), inset(q[3], q[2], .03), inset(q[2], q[3], .03)]) { const c = inset(p, mid, .06); x.fillStyle = 'rgba(70,50,20,.75)'; x.beginPath(); x.arc(c[0], c[1], .32, 0, TAU); x.fill(); }
  });
}
// The MCP plate as cage() would draw it, at a place the hall chooses.
function mcpPlateAt(x, cx, cy) {
  layer(x, C.alu, rrect(cx - 4.5, cy - 3, 9, 6, .7), { lift: .3 });
  for (const sx of [-1, 1]) { x.fillStyle = 'rgba(50,54,56,.6)'; x.beginPath(); x.arc(cx + sx * 3.5, cy - 2, .32, 0, TAU); x.fill(); }
  layer(x, '#16181a', rrect(cx - 2.4, cy - .7, 4.8, 2.5, .5), { lift: 0, tooth: false });
  x.fillStyle = C.brass; for (let k = 0; k < 4; k++) x.fillRect(cx - 1.8 + k, cy + .1, .55, 1);
  // No word on the plate: "MCP" is the plug's label, and it comes with the plug on its word.
  x.strokeStyle = 'rgba(40,44,46,.45)'; x.lineWidth = .14; x.strokeRect(cx - 3.1, cy - 1.4, 6.2, 3.9);
}
// The parts trolley of the services' hall, seen from the front: steel frame on castors, a push handle at one end,
// spare drive caddies on the top shelf, a carton and a coil of cable below. W 38, H 36 mm.
export function trolley(x, W, H) {
  const steel = '#8f969a', sh = (a, b) => wash(0, a, 0, b, 'rgba(255,255,255,.3)', 'rgba(0,0,0,.2)');
  // Below: a carton with tape and a label, a coil of black cable.
  layer(x, '#b8925c', rect(5, H - 19.5, 15, 10.6), { lift: .4, shade: wash(5, 0, 20, 0, 'rgba(255,240,210,.18)', 'rgba(60,40,20,.18)') });
  layer(x, '#c9a873', rect(5, H - 19.5, 15, 1.2), { lift: 0, tooth: false }); layer(x, 'rgba(214,196,160,1)', rect(11.4, H - 19.5, 2.2, 10.6), { lift: 0, tooth: false });
  layer(x, '#f1ede3', rect(14.6, H - 16.4, 4.2, 2.8), { lift: .05, tooth: false }); x.fillStyle = 'rgba(30,30,30,.55)'; for (let k = 0; k < 3; k++) x.fillRect(15, H - 15.8 + k * .8, 3.4 - k * .7, .28);
  layer(x, '#1c1e20', circle(27, H - 13.6, 4.6), { lift: .4 }); layer(x, '#3a3e41', circle(27, H - 13.6, 2.4), { lift: 0, tooth: false });
  x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = .22; for (const r of [3.1, 3.8]) { x.beginPath(); x.arc(27, H - 13.6, r, Math.PI * 1.1, Math.PI * 1.7); x.stroke(); }
  // Above: five drive caddies standing in a row, each with its latch and a lit window, then an empty slot.
  for (let k = 0; k < 5; k++) { const a = 3.6 + k * 5.1; layer(x, '#3b4044', rrect(a, 5.2, 4.5, 8.4, .4), { lift: .35, sh: .35, shade: sh(5.2, 13.6) }); layer(x, '#b9bec0', rect(a + .5, 6, 3.5, 1.2), { lift: .05, tooth: false }); x.fillStyle = k === 2 ? C.amber : C.green; x.fillRect(a + 1.9, 11.4, .7, .5); x.fillStyle = 'rgba(255,255,255,.1)'; for (let r = 0; r < 4; r++) x.fillRect(a + .6, 8 + r * .75, 3.3, .22); }
  // The frame: two shelves with folded lips, the posts, the handle with a black grip, four castors.
  for (const y of [13.4, H - 9]) { layer(x, steel, rect(1.2, y, W - 2.4, 2.6), { lift: .45, shade: sh(y, y + 2.6) }); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(1.4, y + .2, W - 2.8, .25); }
  for (const px of [1.2, W - 2.6]) layer(x, tone(steel, -.08), rect(px, 6.5, 1.4, H - 12.6), { lift: .5, shade: wash(px, 0, px + 1.4, 0, 'rgba(255,255,255,.3)', 'rgba(0,0,0,.2)') });
  layer(x, tone(steel, -.08), rect(W - 2.6, 1.2, 1.4, 6), { lift: .5 }); layer(x, '#1e2022', rrect(W - 3.1, .3, 2.4, 6.4, 1), { lift: .3 });
  for (const px of [4.2, W - 4.6]) {
    layer(x, '#6d7376', rect(px - 1.2, H - 6.4, 2.4, 2.2), { lift: .3 });
    layer(x, '#1a1c1e', circle(px, H - 2.4, 2.3), { lift: .35 }); layer(x, '#9aa0a3', circle(px, H - 2.4, .8), { lift: 0, tooth: false });
  }
}
// A tile lifter left on the raised floor: two suction cups on an aluminium bar with a black grip, seen from above.
function tileLifter(x, c, a) {
  x.save(); x.translate(c[0], c[1]); x.rotate(a);
  // Two rubber cups, each under a round metal plate with a red release lever; between them a cast aluminium handle
  // with a ribbed black grip.
  for (const sx of [-1, 1]) {
    const cx = sx * 11.5;
    layer(x, '#232628', circle(cx, 0, 4.4), { lift: .45, sh: .38 });
    x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = .3; x.beginPath(); x.arc(cx, 0, 3.9, Math.PI * 1.05, Math.PI * 1.6); x.stroke();
    layer(x, '#a7adb0', circle(cx, 0, 2.9), { lift: .25, shade: wash(cx - 2.9, -2.9, cx + 2.9, 2.9, 'rgba(255,255,255,.35)', 'rgba(0,0,0,.2)') });
    for (let k = 0; k < 3; k++) { const an = k * TAU / 3 + .5; x.fillStyle = 'rgba(40,44,46,.55)'; x.beginPath(); x.arc(cx + Math.cos(an) * 2.1, Math.sin(an) * 2.1, .3, 0, TAU); x.fill(); }
    layer(x, '#b8433a', rrect(cx + sx * 1.2 - 1, -5.6, 2, 4.2, .9), { lift: .35, shade: wash(0, -5.6, 0, -1.4, 'rgba(255,230,210,.25)', 'rgba(60,10,6,.2)') });
  }
  layer(x, '#c4c9cb', rrect(-9.6, -2.1, 19.2, 4.2, 1.8), { lift: .6, sh: .4, shade: wash(0, -2.1, 0, 2.1, 'rgba(255,255,255,.4)', 'rgba(0,0,0,.22)') });
  layer(x, '#1e2022', rrect(-5, -2.5, 10, 5, 2.2), { lift: .3 });
  x.fillStyle = 'rgba(255,255,255,.13)'; for (let k = -3; k <= 3; k++) x.fillRect(k * 1.25 - .15, -2.1, .3, 4.2);
  x.restore();
}

// The standard palettes of the three hall spreads.
export const PAL = {
  sunset: { sky: ['#e58f72', '#f4c08e'], sun: [118, 31, 9, '#f6d48a'], wallL: '#e6ddcc', wallR: '#4a4440', floorA: '#d2cabb', floorB: '#bdb5a6', floorR: '#6a625a', lamps: .25, dim: 0, poolsL: [[60, 60, 70, .12], [200, 70, 80, .1]], poolsR: [[60, 70, 70, .1]] },
  dusk: { sky: ['#7d5f80', '#cf9488'], sun: null, wallL: '#d8ccb4', wallR: '#403a36', floorA: '#c7bca8', floorB: '#b0a591', floorR: '#5c544c', lamps: 1, dim: .22, lit: ['RECHNUNGEN', 'TABELLE'], poolsL: [[55, 62, 80, .3], [150, 60, 50, .12]], poolsR: [[55, 72, 80, .26]] },
  night: { sky: ['#2a2034', '#3d2f45'], sun: null, stars: true, wallL: '#a99f90', wallR: '#3a3532', floorA: '#9d9384', floorB: '#8a8072', floorR: '#4c4640', lamps: .3, dim: .34, pool: '214,228,255', lit: ['RECHNUNGEN', 'TABELLE'], poolsL: [[70, 80, 95, .34]], poolsR: [[50, 74, 70, .22]] },
};

// ---------------------------------------------------------------- what lies in the window, and pieces that stand up
// Painters for the layers of a stack: (x, W, H) with H the layer's height in millimetres.
export const LAYER = {
  anw(x, W, H) { instrSheet(x, 0, 0, W, H); text(x, 'Anweisungen', W / 2, H / 2 + .1, Math.min(2.5, H * .5), { font: 'Jost', weight: 700, track: .12, color: 'rgba(244,238,221,.92)' }); },
  beschr(x, W, H) { cardStack(x, 0, 1.2, W, H - 1.2, 3); },
  frage: questionLayer,
  rechnungen(x, W, H) { listingStack(x, 0, 0, W, H, 0); },
  // A thin layer of one colour with a darker lower edge: a call card, a slip, the program.
  slab: (c, mark) => (x, W, H) => { layer(x, c, rect(0, 0, W, H), { lift: .15, sh: .25 }); x.fillStyle = 'rgba(0,0,0,.16)'; x.fillRect(0, H - Math.min(.3, H * .2), W, Math.min(.3, H * .2)); if (mark) mark(x, W, H); },
  // The copied rows: cream, every one with the red mark of an open invoice.
  zeilen(x, W, H) { const n = Math.max(2, Math.round(H / 1)); for (let i = 0; i < n; i++) { layer(x, tone(C.page, (rnd(47, i) - .5) * .05), rect((rnd(48, i) - .5) * .6, i * H / n, W, H / n - .08), { lift: .1, sh: .2 }); x.fillStyle = C.stamp; x.fillRect(W * (.2 + rnd(49, i) * .6), i * H / n + H / n * .15, 2.4, H / n * .6); } },
};
// A piece that lies flat on the page, stands up at `at` and, if `down` is given, lies down again. Not there before.
export const standUp = (at, down = 1e9, gone = false) => t => {
  if (t < at - .02 || (gone && t > down + .6)) return { show: false };
  const k = t - at, up = Math.min(1.03, 1 - Math.exp(-k * 4.5) * Math.cos(k * 5.5));
  return { show: true, lie: t <= down ? 1 - up : ease((t - down) / .55) };
};

// ---------------------------------------------------------------- things under way
// Small pieces as they travel the channels (flat sheets, millimetres).
export const PIECE = {
  call(x, W, H) { layer(x, C.manila, rrect(.5, .5, W - 1, H - 1, .6), { lift: .3, sh: .3 }); x.fillStyle = tone(C.manila, -.14); x.fillRect(.5, .5, W - 1, H * .26); x.fillStyle = 'rgba(43,36,32,.6)'; for (let k = 0; k < 2; k++) x.fillRect(1.6, H * (.44 + k * .24), (W - 3.4) * (k ? .7 : 1), H * .09); },
  listing(x, W, H) { for (let i = 3; i >= 0; i--) { layer(x, i % 2 ? C.listing : tone(C.stripe, .25), rect(.5 + i * .5, .5 + i * .45, W - 2.6, H - 2.4), { lift: .2, sh: .3 }); } inside(x, rect(.5, .5, W - 2.6, H - 2.4), () => { for (let r = 0; r < 4; r += 2) { x.fillStyle = C.stripe; x.fillRect(.5, .9 + r * (H - 2.4) / 4, W, (H - 2.4) / 4); } for (let y = 1.3; y < H - 2; y += 1.5) { x.fillStyle = 'rgba(46,38,30,.55)'; x.beginPath(); x.arc(1.4, y, .3, 0, TAU); x.arc(W - 3, y, .3, 0, TAU); x.fill(); } x.fillStyle = C.stamp; x.fillRect(W * .5, H * .3, 2.2, .8); }); },
  rows(x, W, H) { layer(x, C.page, rrect(.5, .5, W - 1, H - 1, .5), { lift: .3, sh: .3 }); for (let r = 0; r < 3; r++) { x.fillStyle = 'rgba(43,36,32,.5)'; x.fillRect(2.4, 1.3 + r * (H - 2) / 3, W - 4.4, (H - 2) / 3 * .32); x.fillStyle = C.stamp; x.fillRect(1.2, 1.3 + r * (H - 2) / 3, .7, (H - 2) / 3 * .32); } },
  slip: (c = C.cobalt) => (x, W, H) => { layer(x, C.cream, rrect(.5, .5, W - 1, H - 1, .5), { lift: .3, sh: .3 }); x.fillStyle = c; x.fillRect(.5, .5, 1.3, H - 1); x.fillStyle = 'rgba(43,36,32,.55)'; x.fillRect(2.8, H * .32, W - 5, H * .12); x.fillRect(2.8, H * .58, (W - 5) * .6, H * .12); },
  cobalt(x, W, H) { layer(x, C.cobaltDark, rrect(.4, .4, W - .8, H - .8, .7), { lift: .3, sh: .3 }); layer(x, C.cobalt, rrect(.8, .8, W - 1.6, H - 1.6, .5), { lift: 0 }); x.fillStyle = 'rgba(243,236,216,.7)'; for (let k = 0; k < 4; k++) x.fillRect(1.8 + (k % 2) * .9, 1.8 + k * (H - 3.4) / 4, (W - 4.6) * (.9 - (k % 3) * .2), (H - 3.4) / 4 * .3); },
  cards: (c = C.manila, n = 3) => (x, W, H) => { for (let i = n - 1; i >= 0; i--) layer(x, tone(c, -.05 * i), rrect(.5 + i * .5, 1.4 + i * .45, W - 1 - n * .5, H - 1.9 - n * .45, .6), { lift: .25, sh: .3 }); for (let k = 0; k < 3; k++) { x.fillStyle = 'rgba(43,36,32,.4)'; x.fillRect(1.6, 3 + k * .9, (W - 4.4) * (.9 - k * .2), .28); } },
};
// One piece on its journey: hops [[way, seconds, wait before = 0], ...] one after the other from o.t0. Where the page
// changes it goes through the hatch: gone for a quarter of a second. Returns { end, pass: [the seconds it crosses] }.
export function journey(S, name, o) {
  let t = o.t0; const groups = [], pass = [];
  for (const [w, d, wait = 0] of o.hops) {
    const last = groups[groups.length - 1];
    if (last && last.side !== w.side) { pass.push(t); t += .25; }
    t += wait;
    const leg = { way: w, t0: t, t1: t + d }; t += d;
    if (last && last.side === w.side) last.legs.push(leg); else groups.push({ side: w.side, legs: [leg] });
  }
  groups.forEach((g, i) => traveller(S, name + '_' + i, { side: g.side, w: o.w, h: o.h, legs: g.legs, draw: o.draw, color: o.color }));
  if (o.glow) o.glow.push(...pass);
  return { t0: o.t0, end: t, pass };
}
// 0..1 around each of the seconds in `times`: the hatch's lamp, a plate that answers.
export const pulse = (times, t, before = .3, after = .55) => { let g = 0; for (const T of times) g = Math.max(g, between(t, T - before, T + after, .2)); return g; };
// 0..1 inside any of the spans [[from, to], ...].
export const spans = (list, t) => { let g = 0; for (const [a, b] of list) g = Math.max(g, between(t, a, b, .25)); return g; };
// The plate of a cage answers: an amber frame around it at each of the seconds in `times`.
export function plateGlow(S, name, times) {
  const [, u, w, h, off] = CAGES.find(c => c[0] === name), py = Math.min(PLATE_Y, h - 16);
  S.stand('glimmt' + name, { host: 'halle', side: 'L', u: u + mm(w - 7 - 6), v: mm(py - 4.5), off: off + .0046, w: .012, h: .009, e: 1, lock: .2, amp: 0, color: C.amber, draw(x, W, H) { x.strokeStyle = '#ffc45a'; x.lineWidth = 1.1; x.beginPath(); rrect(.8, .8, W - 1.6, H - 1.6, 1.2)(x); x.stroke(); }, life: t => { const g = pulse(times, t, .1, .8); return { show: g > .02, glow: g }; } });
}
// The table as the server TABELLE shows it on its cage: head line, rows that fill between fill[0] and fill[1], the sum at `sum`.
export function tableDisplay(S, o) {
  const [, u, , , off] = CAGES.find(c => c[0] === 'TABELLE'), du = u + .004, dv = .069, W0 = 31, H0 = 23, n = 7, rh = 2.1, top = 5.2;
  S.stand('tabBild', { host: 'halle', side: 'L', u: du, v: dv, off: off + .003, w: mm(W0), h: mm(H0), e: .45, lock: .2, amp: 0, res: 1.6, color: '#f4f1e8', draw(x, W, H) {
    layer(x, '#22262a', rrect(0, 0, W, H, 1), { lift: .4 }); layer(x, '#f4f1e8', rect(1.2, 1.2, W - 2.4, H - 2.4), { lift: 0, tooth: false });
    x.fillStyle = '#2e5c48'; x.fillRect(1.2, 1.2, W - 2.4, 3.2);
    ['Nr', 'Kunde', 'Status', 'Betrag'].forEach((s, i) => text(x, s, 2 + [0, 5, 14.5, 21][i], 2.9, 1.7, { font: 'Jost', weight: 700, align: 'left', color: '#f4f1e8' }));
    // An empty sheet still looks like a spreadsheet: every other row faintly tinted, a visible grid, the active cell framed.
    x.fillStyle = 'rgba(46,92,72,.06)'; for (let r = 1; r <= n + 1; r += 2) x.fillRect(1.2, top + r * rh - .35, W - 2.4, rh);
    x.fillStyle = 'rgba(43,36,32,.3)'; for (let r = 0; r <= n + 1; r++) x.fillRect(1.2, top + r * rh - .35, W - 2.4, .1); for (const cx of [6.6, 16, 22.6]) x.fillRect(cx, 4.4, .1, H - 5.6);
    x.strokeStyle = '#2e5c48'; x.lineWidth = .3; x.strokeRect(1.45, top - .2, 6.6 - 1.6, rh - .3); x.fillStyle = '#2e5c48'; x.fillRect(6.6 - .55, top + rh - .9, .5, .5);
  }, life: () => ({ glow: .8 }) });
  for (let r = 0; r < n; r++) S.stand('tabZeile' + r, { host: 'halle', side: 'L', u: du + .0018, v: dv + mm(H0 - top - (r + 1) * rh + .25), off: off + .0034, w: mm(W0 - 3.6), h: mm(rh - .6), e: .45, lock: .2, amp: 0, color: '#f4f1e8', draw(x, W, H) {
    layer(x, '#f4f1e8', rect(0, 0, W, H), { lift: 0, tooth: false }); x.fillStyle = 'rgba(43,36,32,.72)';
    for (const [a, w] of [[.3, 3.6], [5.2, 6 + rnd(55, r) * 2.4], [20.6, 5.6]]) x.fillRect(a, H * .3, w, H * .42);
    x.fillStyle = C.stamp; x.fillRect(14.6, H * .3, 3.6, H * .42);
  }, life: t => ({ show: t >= o.fill[0] + (o.fill[1] - o.fill[0]) * r / n, glow: .8 }) });
  S.stand('tabSumme', { host: 'halle', side: 'L', u: du + .0018, v: dv + .0014, off: off + .0036, w: mm(W0 - 3.6), h: .0028, e: .6, lock: .2, amp: 0, res: 1.6, color: '#f4f1e8', draw(x, W, H) {
    layer(x, '#e3ecd9', rect(0, 0, W, H), { lift: 0, tooth: false }); text(x, 'Summe', .5, H / 2 + .1, 2, { font: 'Jost', weight: 700, align: 'left', color: C.ink }); text(x, '23.874,60 €', W - .5, H / 2 + .1, 2, { font: 'Jost', weight: 700, align: 'right', color: C.ink });
  }, life: t => ({ show: t >= o.sum, glow: .75 + .25 * between(t, o.sum, o.sum + 1.2, .25) }) });
}
// Only the red marks of the listing layer and of the copied rows, where the layers print them: for the overlay that glows.
export const MARKS = {
  rechnungen(x, W, H) { const n = Math.max(1, Math.round(H / 1.1)); x.fillStyle = '#ff5a4a'; for (let i = 0; i < n; i++) if (i % 12 === 5) x.fillRect(W * (.3 + rnd(71, i) * .45), i * H / n + (H / n - .1) * .12, 2.6, (H / n - .1) * .76); },
  zeilen(x, W, H) { const n = Math.max(2, Math.round(H / 1)); x.fillStyle = '#ff5a4a'; for (let i = 0; i < n; i++) x.fillRect(W * (.2 + rnd(49, i) * .6), i * H / n + H / n * .15, 2.4, H / n * .6); },
};

// Camera keys in time order: a key that would not come after the one before it is left out.
export const inOrder = keys => { const out = []; for (const k of keys) if (!out.length || k[0] > out[out.length - 1][0] + .25) out.push(k); return out; };
