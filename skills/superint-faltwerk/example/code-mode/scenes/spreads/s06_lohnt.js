// Spread 6, "Wann es sich lohnt": a test room at night. On a test frame under a work lamp stand two context windows of
// the same make, the direct way left of the gutter, Code Mode right of it. A brass slider runs along a printed scale
// from one call to many steps; both stacks grow, the direct one faster, and it overtakes the other at a third of the rail.
import { Spread } from '../popup.js';
import { layer, inside, stroke, text, textWidth, rect, rrect, circle, ellipse, poly, tone, rgba, rnd, TAU, wash } from '../paper.js';
import { C, SERVICE, miniCard, ease } from '../techkit.js';
import { makeWindow, LAYER, tokenChip, standUp, inOrder } from '../hall.js';

// Printed words. The two numbers of the plates: research.md AN19/PR38 (a single simple call costs about 8 % more) and
// AN19/PR36 (with 10 to 49 tools mostly 20 to 40 % less). "laut Anthropic" is only spoken; no source in the picture.
const TX = {
  title: 'Wann es sich lohnt', frage: 'Wie ist das Wetter in Berlin?', scale: ['ein einfacher Aufruf', 'viele Werkzeuge'], win: ['direkt', 'Code Mode'],
  t1: ['Ein Aufruf:', 'rund 8 % mehr'], t2: ['10 bis 49 Werkzeuge:', 'meist 20 bis 40 % weniger'],
  esd: 'ESD-Schutzzone', boxes: ['KABEL', 'STECKER', 'KLEMMEN', 'RELAIS', 'SCHRAUBEN', 'MUTTERN', 'SCHALTER', 'BUCHSEN', 'DÜBEL', 'LÖTZINN', 'SICHERUNGEN', 'TÜLLEN'],
};
// The question as tokens in the stack, three rows (the cut is an illustration, as on spread 2).
const Q_TOKENS = [['Wie', ' ist', ' das'], [' Wetter', ' in'], [' Berlin', '?']];

const mm = v => v / 1000, PI = Math.PI;
const HOST = 'pruefraum', FOLD = { z: -.1, alpha: 80, wL: .285, wR: .285, h: .19 };
const SA = Math.sin(FOLD.alpha * PI / 180), CA = Math.cos(FOLD.alpha * PI / 180), TURN = (90 - FOLD.alpha) * PI / 180;
// Where on a panel a stand must sit so that its reference point lands at world (x, z): { u, off }.
const onPanel = (side, x, z) => { const d = z - FOLD.z; return side === 'L' ? { u: SA * x - CA * d, off: CA * x + SA * d } : { u: SA * x + CA * d, off: -CA * x + SA * d }; };
// The two windows (same make as on 2 to 5, smaller): left edge u, width and height in mm, distance from the wall.
const WIN = { w: 28, h: 128, off: .05, base: 8, L: -.047, R: .019 };
// The test frame with the lamp: it faces the viewer square, centred on the gutter, a few mm in front of the windows.
const FRAME = { w: 132, h: 172, z: -.027, rim: 118 };
// The brass rail on the right page (page mm): the scale runs from x0 (one call) over `travel` mm to many steps.
const RAIL = { a: 22, y: 128, len: 150, x0: 33, travel: 128 };

// Stack heights in mm over the slider position s, piecewise linear with the kink at s = 1/3 (buchplan, Zuglasche).
// They show a ratio, not a measurement: direct 30 -> 52 -> 100, Code Mode 32.5 -> 52 -> 70.
const lin3 = (a, b, c) => s => s <= 1 / 3 ? a + (b - a) * s * 3 : b + (c - b) * (s - 1 / 3) * 1.5;
const STACK = {
  L: [['anw', 5], ['beschr', lin3(8, 15, 25)], ['frage', 9], ['ruf', 1], ['erg', 7], ['mehr', lin3(0, 15, 53)]],
  R: [['anw', 5], ['mini', 3], ['frage', 9], ['ruf', 1], ['ts', lin3(4, 7, 14)], ['prog', lin3(7, 10, 16)], ['erg', lin3(3.5, 17, 22)]],
};

// Colours of the room (direction.md, colour script 6).
const SKY = ['#2a2034', '#3d2f45'], OLIVE = '#5a6346', HARD = '#c9a46a', MAT = '#4f7a5f', WARM = '#ffd98a', BOARD = '#7d5b40';
const STEEL = '#8d9599', IRON = '#3a3e3b', RED = '#a8463a', YEL = '#d9b24f';

// ---------------------------------------------------------------- what lies in the windows (W wide, H high, mm)
function feed(x, a, y, w, h, seed = 0) {
  const n = Math.max(1, Math.round(h / 1.1));
  for (let i = n - 1; i >= 0; i--) {
    const yy = y + i * h / n, th = h / n - .1, alt = (seed + i) % 2;
    layer(x, alt ? C.listing : tone(C.stripe, .25), rect(a + (alt ? .5 : 0), yy, w - (alt ? 1 : 0), th), { lift: .14, sh: .26 });
    for (const ex of [a + 1.6, a + w - 1.6]) { x.fillStyle = 'rgba(46,38,30,.4)'; x.fillRect(ex - .3, yy + th * .25, .6, th * .5); }
  }
}
function questionLayer(x, W, H) {
  layer(x, '#3b342e', rect(0, 0, W, H), { lift: 0, tooth: false });
  let size = H / 3 / 1.22; const gap = .45;
  const widths = sz => Q_TOKENS.map(row => row.map(s => textWidth(x, s.trim(), sz, { weight: 600 }) + 1.4 + (s[0] === ' ' ? .6 : 0)));
  const widest = Math.max(...widths(size).map(r => r.reduce((p, c) => p + c, 0) + gap * (r.length - 1)));
  if (widest > W - .4) size *= (W - .4) / widest;
  const ws = widths(size), rh = H / 3; let i = 0;
  Q_TOKENS.forEach((row, r) => { let px = (W - ws[r].reduce((p, c) => p + c, 0) - gap * (row.length - 1)) / 2; row.forEach((s, k) => { tokenChip(x, { s, w: ws[r][k], h: rh - .35 }, px, r * rh, size, i++); px += ws[r][k] + gap; }); });
}
const PAINT = {
  L: {
    anw: LAYER.anw, beschr: LAYER.beschr, frage: questionLayer, ruf: LAYER.slab(C.manila),
    erg: (x, W, H) => feed(x, 0, 0, W, H, 1),
    // More calls and what comes back: a manila call card, then the listing paper it brings, again and again.
    mehr(x, W, H) { let y = 0, k = 0; while (y < H) { layer(x, tone(C.manila, (rnd(81, k) - .5) * .08), rect(0, y, W, .95), { lift: .14, sh: .3 }); x.fillStyle = 'rgba(0,0,0,.16)'; x.fillRect(0, y + .75, W, .2); y += 1.05; const n = 2.6 + rnd(82, k) * 5.2; feed(x, 0, y, W, Math.min(n, H - y + 1), k); y += n; k++; } },
  },
  R: {
    anw: LAYER.anw, frage: questionLayer, ruf: LAYER.slab(C.manila),
    mini(x, W, H) { miniCard(x, .4, .2, W / 2 - .8, H - .3, 'nachschlagen'); miniCard(x, W / 2 + .4, .2, W / 2 - .8, H - .3, 'code_ausfuehren'); },
    // The descriptions it looked up: cream sheets, each with the rider of its service.
    ts(x, W, H) { const n = Math.max(2, Math.round(H / 1.4)), SV = Object.values(SERVICE); for (let i = n - 1; i >= 0; i--) { const y = i * H / n; layer(x, tone(C.cream, (rnd(57, i) - .5) * .06), rect((rnd(58, i) - .5) * .8, y, W, H / n - .1), { lift: .12, sh: .25 }); layer(x, SV[Math.floor(rnd(59, i) * SV.length)].c, rrect(2 + rnd(60, i) * (W - 9), y - .45, 5, 1, .3), { lift: .08, sh: .2 }); } },
    // The programs: cobalt edges with a hint of their lines.
    prog(x, W, H) { const n = Math.max(1, Math.round(H / 2)); for (let i = n - 1; i >= 0; i--) { const y = i * H / n, th = H / n - .12; layer(x, C.cobaltDark, rect(0, y, W, th), { lift: .15, sh: .3 }); layer(x, C.cobalt, rect(.4, y, W - .8, th - .35), { lift: 0 }); x.fillStyle = 'rgba(243,236,216,.5)'; for (let k = 0; k < 3; k++) x.fillRect(1.4 + (k % 2) * .8, y + .3 + k * (th - .8) / 3, (W - 4) * (.45 + rnd(61 + i, k) * .4), .16); } },
    // What the programs hand back: cream slips with the cobalt edge.
    erg(x, W, H) { const n = Math.max(1, Math.round(H / 1.5)); for (let i = n - 1; i >= 0; i--) { const y = i * H / n, th = H / n - .1, dx = (rnd(63, i) - .5) * .8; layer(x, tone(C.cream, (rnd(64, i) - .5) * .05), rect(dx, y, W, th), { lift: .12, sh: .25 }); x.fillStyle = C.cobalt; x.fillRect(dx, y, 1.5, th); x.fillStyle = 'rgba(43,36,32,.35)'; x.fillRect(dx + 3, y + th * .4, (W - 6) * (.4 + rnd(65, i) * .4), Math.min(.2, th * .2)); } },
  },
};

// ---------------------------------------------------------------- the tools of the room (millimetres)
function peg(x, cx, cy) { stroke(x, [[cx, cy - 1.4], [cx, cy + .4]], '#4d5154', .65, { lift: .15 }); }
// A reel of wire on its peg, seen face on.
function reel(x, cx, cy, r, c, seed) {
  peg(x, cx, cy - r * .2);
  layer(x, '#34373a', circle(cx, cy, r), { lift: .55 });
  layer(x, c, circle(cx, cy, r * .8), { lift: .1 });
  x.save(); x.strokeStyle = rgba(tone(c, -.5), .32); x.lineWidth = .12; for (let k = 0; k < 7; k++) { x.beginPath(); x.arc(cx, cy, r * (.44 + k * .052), 0, TAU); x.stroke(); } x.restore();
  layer(x, '#2a2c2e', circle(cx, cy, r * .4), { lift: .15 }); layer(x, tone(HARD, -.45), circle(cx, cy, r * .13), { lift: 0, tooth: false });
  x.fillStyle = 'rgba(255,255,255,.16)'; x.beginPath(); x.arc(cx, cy, r * .95, PI * 1.05, PI * 1.5); x.arc(cx, cy, r * .86, PI * 1.5, PI * 1.05, true); x.fill();
  stroke(x, [[cx + r * .76, cy + r * .2], [cx + r * 1.08, cy + r * .95], [cx + r * .75 + (rnd(seed, 1) - .5) * 3, cy + r * 1.7]], c, .6, { smooth: true, lift: .15 });
}
// Pliers hanging by the jaws from a peg at (px, py). kind 0 combination, 1 side cutter, 2 long nose.
function pliers(x, px, py, L, c, kind = 0) {
  const jawL = kind === 2 ? L * .4 : kind === 1 ? L * .22 : L * .3, jw = kind === 2 ? L * .05 : L * .09, hy = py + jawL;
  peg(x, px, py);
  layer(x, STEEL, poly([[px - jw, hy + 1], [px - jw * .85, hy - jawL * .55], [px - .35, hy - jawL], [px + .35, hy - jawL], [px + jw * .85, hy - jawL * .55], [px + jw, hy + 1]]), { lift: .45 });
  x.fillStyle = 'rgba(30,34,36,.55)'; x.fillRect(px - .12, hy - jawL * .92, .24, jawL * .78);
  if (kind === 0) { x.fillStyle = 'rgba(30,34,36,.35)'; for (let k = 0; k < 4; k++) x.fillRect(px - jw * .5, hy - jawL * (.75 - k * .08), jw, .14); }
  for (const sd of [-1, 1]) {
    const p0 = [px + sd * jw * .6, hy], p1 = [px + sd * L * .085, hy + L * .22], p2 = [px + sd * L * .13, hy + L * .66];
    stroke(x, [p0, p1, p2], STEEL, L * .06, { smooth: true, lift: .35 });
    stroke(x, [[p1[0] + sd * .2, p1[1] + 1], p2], c, L * .095, { lift: .3 });
    x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(p2[0] - sd * L * .03 - .2, p1[1] + 2, .4, (p2[1] - p1[1]) * .7);
  }
  layer(x, '#646c6f', circle(px, hy, L * .05), { lift: .2, tooth: false }); x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.arc(px - .3, hy - .3, L * .018, 0, TAU); x.fill();
}
// A screwdriver hanging handle up in a rack.
function driver(x, cx, top, L, c) {
  const hl = L * .4;
  layer(x, c, rrect(cx - 1.7, top, 3.4, hl, 1.3), { lift: .4 });
  x.fillStyle = rgba(tone(c, -.45), .5); for (let k = 0; k < 3; k++) x.fillRect(cx - 1.15 + k * 1.05, top + 1.5, .32, hl - 3);
  x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(cx - 1.35, top + 1, .4, hl - 2);
  layer(x, '#b9bec0', rect(cx - 1, top + hl, 2, 1.1), { lift: .2 });
  layer(x, STEEL, rect(cx - .38, top + hl + 1.1, .76, L - hl - 1.1), { lift: .3 });
  layer(x, tone(STEEL, -.3), poly([[cx - .38, top + L], [cx + .38, top + L], [cx + .12, top + L + 1], [cx - .12, top + L + 1]]), { lift: .2, tooth: false });
}
// An open-end spanner hanging from its ring: the board shows through ring and jaw.
function spanner(x, cx, top, L, bg) {
  const r = 1.7 + L * .05, w = r * .75;
  layer(x, STEEL, xx => { circle(cx, top + r, r)(xx); xx.rect(cx - w / 2, top + r, w, L - 2 * r); circle(cx, top + L - r, r * 1.18)(xx); }, { lift: .4 });
  layer(x, bg, circle(cx, top + r, r * .52), { lift: 0, tooth: false });
  layer(x, bg, rect(cx - r * .42, top + L - r * .95, r * .84, r * 1.5), { lift: 0, tooth: false });
  x.fillStyle = 'rgba(255,255,255,.28)'; x.fillRect(cx - w / 2 + .2, top + r * 1.4, .3, L - r * 3);
  peg(x, cx, top + r * .5);
}
// The meter with a needle: an analog multimeter in its holster, test leads hanging below.
function meter(x, a, b, w, h) {
  peg(x, a + w / 2, b - 1);
  layer(x, '#c8902e', rrect(a, b, w, h, 2.2), { lift: .65 });
  layer(x, '#2f322f', rrect(a + 1.6, b + 1.6, w - 3.2, h - 3.2, 1.2), { lift: .2 });
  const dw = w - 5.4, dh = h * .42, dx = a + 2.7, dy = b + 2.7, cx = a + w / 2, cy = dy + dh + 3.4, R = dw * .5;
  layer(x, '#efe8d6', rrect(dx, dy, dw, dh, .8), { lift: .1 });
  inside(x, rrect(dx, dy, dw, dh, .8), () => {
    x.save(); x.strokeStyle = C.ink; x.lineWidth = .18; x.beginPath(); x.arc(cx, cy, R * .86, PI * 1.2, PI * 1.8); x.stroke();
    x.strokeStyle = 'rgba(150,158,160,.8)'; x.lineWidth = .5; x.beginPath(); x.arc(cx, cy, R * .7, PI * 1.24, PI * 1.76); x.stroke();
    for (let k = 0; k <= 20; k++) { const an = PI * (1.2 + k * .03), l = k % 5 ? .8 : 1.6; x.strokeStyle = C.ink; x.lineWidth = k % 5 ? .12 : .2; x.beginPath(); x.moveTo(cx + Math.cos(an) * R * .86, cy + Math.sin(an) * R * .86); x.lineTo(cx + Math.cos(an) * (R * .86 + l), cy + Math.sin(an) * (R * .86 + l)); x.stroke(); }
    x.strokeStyle = C.stamp; x.lineWidth = .5; x.beginPath(); x.arc(cx, cy, R * .78, PI * 1.7, PI * 1.8); x.stroke();
    const an = PI * 1.37; x.strokeStyle = '#141414'; x.lineWidth = .22; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(an) * R * .98, cy + Math.sin(an) * R * .98); x.stroke();
    x.restore();
  });
  x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(dx + .6, dy + .5, dw * .5, .25);
  const kx = cx, ky = b + h * .68, kr = w * .17;
  x.fillStyle = 'rgba(233,228,214,.75)'; for (let k = 0; k < 12; k++) { const an = PI * (.8 + k * .12); x.fillRect(kx + Math.cos(an) * kr * 1.45 - .15, ky + Math.sin(an) * kr * 1.45 - .15, .3, .3); }
  layer(x, '#1b1c1b', circle(kx, ky, kr), { lift: .3 }); layer(x, '#2e302e', circle(kx, ky, kr * .72), { lift: .1 });
  x.save(); x.translate(kx, ky); x.rotate(-.6); x.fillStyle = '#e9e4d6'; x.fillRect(-.25, -kr * .95, .5, kr * .7); x.restore();
  const jy = b + h - 4.4;
  for (const [jx, c] of [[a + w * .3, '#b8433a'], [a + w * .7, '#1b1b1b']]) {
    layer(x, '#111', circle(jx, jy, 1.3), { lift: .15, tooth: false }); layer(x, c, circle(jx, jy, .9), { lift: .1, tooth: false });
    stroke(x, [[jx, jy], [jx + (c === '#1b1b1b' ? 2 : -2), b + h + 6], [jx + (c === '#1b1b1b' ? 6 : -1), b + h + 12], [jx + (c === '#1b1b1b' ? 9 : 3), b + h + 9]], c, .7, { smooth: true, lift: .2 });
  }
}
function hammer(x, cx, top, L) {
  peg(x, cx - 4, top - .4); peg(x, cx + 4, top - .4);
  layer(x, C.oak, rrect(cx - 1.4, top + 3.6, 2.8, L - 3.6, 1.1), { lift: .35 });
  inside(x, rrect(cx - 1.4, top + 3.6, 2.8, L - 3.6, 1.1), () => { for (let k = 0; k < 5; k++) { x.fillStyle = 'rgba(90,56,26,.25)'; x.fillRect(cx - 1 + k * .45, top + 4, .12, L - 5); } });
  layer(x, '#4b5053', poly([[cx - 7, top + .6], [cx + 4.5, top], [cx + 6.5, top + 1.4], [cx + 6.5, top + 3.6], [cx + 4.5, top + 4.6], [cx - 7, top + 4]]), { lift: .45 });
  x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(cx - 6.6, top + .9, 11, .3);
}
function tape(x, cx, cy, r) {
  peg(x, cx, cy - r);
  layer(x, YEL, rrect(cx - r, cy - r, 2 * r, 2 * r, r * .45), { lift: .45 });
  layer(x, '#2a2a2a', rrect(cx - r * .6, cy - r * .6, r * 1.2, r * 1.2, r * .3), { lift: .12 });
  layer(x, '#e3dccb', rect(cx + r - .4, cy + r * .5, 2.2, 1.2), { lift: .15 });
}

// ---------------------------------------------------------------- the wall: sky over the cut roof, olive, the pegboard
function wall(x, W, H) {
  const cx = W / 2, ceil = 26.4;
  layer(x, SKY[1], xx => { xx.moveTo(0, H); xx.lineTo(0, 16); xx.bezierCurveTo(W * .25, -3, W * .75, -3, W, 16); xx.lineTo(W, H); xx.closePath(); }, { lift: 0, shade: wash(0, 0, 0, 16, rgba(SKY[0], 1), rgba(SKY[0], .25)) });
  for (let i = 0; i < 46; i++) { const sx = rnd(101, i) * W, sy = 1.5 + rnd(102, i) * 11; x.fillStyle = rgba('#f3ecd8', .45 + rnd(103, i) * .5); x.beginPath(); x.arc(sx, sy, .22 + rnd(104, i) * .38, 0, TAU); x.fill(); }
  // The roof in section: gravel and felt, insulation, the concrete slab.
  layer(x, '#2b2723', rect(0, 12.6, W, 2.4), { lift: .45 });
  for (let i = 0; i < 140; i++) { x.fillStyle = `rgba(150,140,125,${.3 + rnd(105, i) * .3})`; x.beginPath(); x.arc(rnd(106, i) * W, 12.9 + rnd(107, i) * .6, .25 + rnd(108, i) * .3, 0, TAU); x.fill(); }
  layer(x, '#8f7a4c', rect(0, 15, W, 4.2), { lift: .2 });
  x.save(); x.strokeStyle = 'rgba(60,46,20,.55)'; x.lineWidth = .18; x.beginPath(); for (let px = 0; px < W; px += 2.4) { x.moveTo(px, 15.2); x.lineTo(px + 1.2, 19); x.lineTo(px + 2.4, 15.2); } x.stroke(); x.restore();
  layer(x, '#625f58', rect(0, 19.2, W, ceil - 19.2), { lift: .3 });
  for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(${rnd(109, i) > .5 ? '40,38,34' : '200,195,185'},.3)`; x.beginPath(); x.arc(rnd(110, i) * W, 19.6 + rnd(111, i) * 6.4, .18 + rnd(112, i) * .3, 0, TAU); x.fill(); }
  // The olive wall: plaster, a little uneven.
  layer(x, OLIVE, rect(0, ceil, W, H - ceil), { lift: .35 });
  inside(x, rect(0, ceil, W, H - ceil), () => {
    for (let i = 0; i < 70; i++) { x.fillStyle = rnd(113, i) > .5 ? 'rgba(255,250,230,.025)' : 'rgba(20,24,12,.035)'; x.beginPath(); x.arc(rnd(114, i) * W, ceil + rnd(115, i) * (H - ceil), 6 + rnd(116, i) * 26, 0, TAU); x.fill(); }
    wash(0, ceil, 0, ceil + 26, 'rgba(10,8,6,.35)', 'rgba(10,8,6,0)')(x);
  });
  // A cable duct under the ceiling, the skirting at the floor.
  layer(x, '#85877c', rect(0, 34, W, 5), { lift: .4 }); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 36.2, W, .25);
  for (let k = 0; k < 8; k++) { x.fillStyle = 'rgba(60,60,55,.3)'; x.fillRect(20 + k * 74, 34, .3, 5); }
  layer(x, '#3b3d32', rect(0, H - 4, W, 4), { lift: .3 });

  // ---- left: the pegboard with its tools, a first-aid box, the ESD sign
  const pa = 28, pb = 48, pw = 224, ph = 76;
  layer(x, tone(HARD, -.42), rrect(pa - 2.2, pb - 2.2, pw + 4.4, ph + 4.4, .6), { lift: .45 });
  layer(x, HARD, rect(pa, pb, pw, ph), { lift: .2, shade: wash(pa, pb, pa, pb + ph, 'rgba(255,240,200,.05)', 'rgba(40,25,10,.14)') });
  for (let i = 0; i * 5 < pw - 2; i++) for (let j = 0; j * 5 < ph - 2; j++) { x.fillStyle = 'rgba(46,32,16,.55)'; x.beginPath(); x.arc(pa + 2.5 + i * 5, pb + 2.5 + j * 5, .42, 0, TAU); x.fill(); }
  // Reels of wire.
  [['#a8382e', 44, 63, 9], ['#2a2a2a', 66, 61, 8], [YEL, 87, 64, 8.6]].forEach(([c, rx, ry, r], k) => reel(x, rx, ry, r, c, k + 3));
  // Spanners, largest first.
  for (let k = 0; k < 6; k++) spanner(x, 107 + k * 5.2, 54, 34 - k * 3.2, HARD);
  // The screwdriver rack.
  layer(x, tone(C.oak, -.1), rrect(140, 54, 46, 4, .6), { lift: .45 }); peg(x, 143, 54); peg(x, 183, 54);
  [['#b8433a', 30], [YEL, 34], ['#2a2a2a', 26], ['#4f7a52', 36], ['#c8702e', 28], ['#b8433a', 24], ['#2a2a2a', 32]].forEach(([c, L], k) => driver(x, 144.5 + k * 6.1, 56, L, c));
  // The meter with its needle and leads.
  meter(x, 196, 54, 26, 36);
  // Pliers, a hammer, a tape measure.
  pliers(x, 46, 88, 30, '#b8433a', 0); pliers(x, 58, 87, 27, YEL, 1); pliers(x, 71, 86, 32, '#c8702e', 2);
  hammer(x, 150, 96, 22); tape(x, 232, 104, 5.4);
  // A coil of patch cable on a hook.
  peg(x, 92, 88); x.save(); x.strokeStyle = '#3c3f3a'; x.lineWidth = .7; for (let k = 0; k < 4; k++) { x.beginPath(); x.ellipse(92, 96 + k * .5, 5.5 - k * .3, 8 - k * .2, .1, 0, TAU); x.stroke(); } x.restore();
  // First aid box and the ESD sign at the far end.
  layer(x, '#3f7a52', rrect(6, 58, 16, 15, 1.2), { lift: .5 }); layer(x, '#f3ecd8', rect(12.6, 61, 2.8, 9), { lift: 0 }); layer(x, '#f3ecd8', rect(9.5, 64.1, 9, 2.8), { lift: 0 }); layer(x, '#2f3437', rrect(11, 56.6, 6, 1.8, .6), { lift: .2 });
  layer(x, YEL, rrect(4, 80, 21, 9, .6), { lift: .3 }); x.save(); x.strokeStyle = '#1b1b1b'; x.lineWidth = .35; x.strokeRect(4.7, 80.7, 19.6, 7.6); x.restore();
  text(x, TX.esd, 14.5, 84.6, 2.05, { font: 'Jost', weight: 700, color: '#1b1b1b' });

  // ---- right: the fuse box with its conduits, a socket strip
  const fa = 352, fb = 48;
  for (const px of [fa + 10, fa + 22, fa + 34]) { layer(x, '#8a8e88', rect(px - 1.4, 30, 2.8, fb - 30), { lift: .4 }); for (const cy of [40, 44]) { x.fillStyle = '#5d625d'; x.fillRect(px - 2, cy, 4, 1.1); } }
  layer(x, '#9a9d95', rrect(fa, fb, 44, 40, 1), { lift: .6 }); layer(x, '#b2b4ac', rrect(fa + 1.5, fb + 1.5, 41, 37, .6), { lift: .2 });
  layer(x, '#2b2e2c', rect(fa + 5, fb + 11, 34, 9), { lift: 0, tooth: false });
  for (let k = 0; k < 9; k++) { layer(x, '#ece8de', rect(fa + 6.2 + k * 3.6, fb + 12, 2.8, 7), { lift: .1, tooth: false }); x.fillStyle = k === 3 ? C.stamp : '#3a3a3a'; x.fillRect(fa + 6.9 + k * 3.6, fb + 14 + (k % 3 === 1 ? 2 : 0), 1.4, 1.6); }
  layer(x, YEL, poly([[fa + 22, fb + 25], [fa + 27, fb + 34], [fa + 17, fb + 34]]), { lift: .1 }); stroke(x, [[fa + 22.6, fb + 27.5], [fa + 21, fb + 30.4], [fa + 23, fb + 30.4], [fa + 21.4, fb + 33]], '#1b1b1b', .4);
  layer(x, '#7d8079', rrect(fa + 39, fb + 18, 1.6, 6, .5), { lift: .15 });
  layer(x, '#e6e1d4', rrect(372, 104, 44, 6.5, 1), { lift: .4 });
  for (let k = 0; k < 4; k++) { layer(x, '#cfc9ba', circle(379 + k * 9, 107.2, 2.3), { lift: 0 }); x.fillStyle = '#3a3a3a'; x.beginPath(); x.arc(378.2 + k * 9, 107.2, .4, 0, TAU); x.arc(379.8 + k * 9, 107.2, .4, 0, TAU); x.fill(); }
  layer(x, '#b8433a', rrect(409, 105.2, 4.4, 4, .6), { lift: .15 });
  stroke(x, [[372, 108], [366, 112], [364, 130], [366, 150]], '#2a2a2a', .9, { smooth: true, lift: .2 });

  // ---- the lamp's light: an island round the gutter, the ends of the room in the dark
  inside(x, rect(0, ceil, W, H - ceil), () => {
    const g = x.createRadialGradient(cx, 128, 0, cx, 128, 190); g.addColorStop(0, 'rgba(255,214,140,.36)'); g.addColorStop(.45, 'rgba(255,214,140,.12)'); g.addColorStop(1, 'rgba(255,214,140,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (const [x0, x1] of [[0, 170], [W, W - 170]]) { const d = x.createLinearGradient(x0, 0, x1, 0); d.addColorStop(0, 'rgba(8,10,6,.5)'); d.addColorStop(1, 'rgba(8,10,6,0)'); x.fillStyle = d; x.fillRect(0, 0, W, H); }
  });
}

// ---------------------------------------------------------------- the workbench (a front, its top at 72 mm)
// o: { inner: 'R' | 'L' (the end towards the lamp), drawers: [a, w], items(x, top) }
function bench(x, W, H, o = {}) {
  const top = H - 72, legs = [2, W - 5];
  // The back panel under the top, then the legs, the drawers, the top with its green mat.
  // Tongue-and-groove boards behind the legs, in the bench's own shade: dark, but wood, not a hole.
  layer(x, '#4a4438', rect(3, top + 4, W - 6, 68), { lift: .25, shade: wash(0, top + 4, 0, H, 'rgba(0,0,0,.3)', 'rgba(0,0,0,.04)') });
  inside(x, rect(3, top + 4, W - 6, 68), () => { for (let bx = 3 + 9; bx < W - 3; bx += 9) { x.fillStyle = 'rgba(15,12,8,.4)'; x.fillRect(bx, top + 4, .35, 68); x.fillStyle = 'rgba(255,240,210,.05)'; x.fillRect(bx + .35, top + 4, .3, 68); } for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(20,14,8,${.06 + rnd(126, k) * .08})`; x.fillRect(3 + rnd(127, k) * (W - 6), top + 4 + rnd(128, k) * 68, .14, 4 + rnd(129, k) * 12); } });
  for (const lx of legs) { layer(x, '#454a45', rect(lx, top + 4, 3, 68), { lift: .4 }); layer(x, '#2c2f2c', rect(lx - .6, H - 1.6, 4.2, 1.6), { lift: .2, tooth: false }); x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(lx + .3, top + 5, .35, 66); }
  layer(x, '#454a45', rect(2, H - 16, W - 4, 2.4), { lift: .3 });
  // What stands under the bench stands in front of its stretcher.
  if (o.under) o.under(x, top);
  if (o.drawers) {
    const [da, dw] = o.drawers;
    layer(x, '#6f7468', rect(da, top + 5, dw, 66), { lift: .45 });
    for (let k = 0; k < 4; k++) {
      const dy = top + 7 + k * 15.8;
      layer(x, tone('#7c8275', (rnd(121, k) - .5) * .08), rect(da + 1.6, dy, dw - 3.2, 14.2), { lift: .25 });
      layer(x, C.brass, rrect(da + dw / 2 - 5, dy + 8.5, 10, 2, .8), { lift: .2 });
      layer(x, '#e9e2cf', rect(da + dw / 2 - 4.5, dy + 2.6, 9, 4), { lift: 0 }); x.save(); x.strokeStyle = C.brass; x.lineWidth = .35; x.strokeRect(da + dw / 2 - 4.8, dy + 2.3, 9.6, 4.6); x.restore();
      x.fillStyle = 'rgba(43,36,32,.5)'; x.fillRect(da + dw / 2 - 3.4, dy + 4.4, 6.8 - k * .8, .35);
    }
  }
  layer(x, tone(C.oak, -.12), rect(0, top + 2.4, W, 4), { lift: .45 });
  inside(x, rect(0, top + 2.4, W, 4), () => { for (let k = 0; k < 30; k++) { x.fillStyle = `rgba(90,56,26,${.08 + rnd(122, k) * .12})`; x.fillRect(rnd(123, k) * W, top + 2.6 + rnd(124, k) * 3.6, 6 + rnd(125, k) * 20, .14); } });
  // The mat as seen from the front and a little from above: a green band, its front lip, the earthing cord.
  layer(x, MAT, rect(0, top - 4.6, W, 7.2), { lift: .3 });
  inside(x, rect(0, top - 4.6, W, 7.2), () => { x.fillStyle = 'rgba(20,40,28,.18)'; for (let px = 1; px < W; px += 3) x.fillRect(px, top - 4.6, .15, 7.2); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(0, top + 1.6, W, .5); });
  const cordX = o.inner === 'R' ? W - 24 : 22;
  layer(x, '#c9ccc9', circle(cordX, top + 1.4, .9), { lift: .2, tooth: false });
  stroke(x, [[cordX, top + 1.6], [cordX + 1.5, top + 10], [cordX - 1.5, top + 18], [cordX + 1.5, top + 26], [cordX, top + 34]], '#3e6a4c', .55, { smooth: true, lift: .2 });
  if (o.items) o.items(x, top - 1.4);
  // The lamp's light falls on the inner end; the outer end is in the dark.
  x.save(); x.globalCompositeOperation = 'source-atop';
  const lx = o.inner === 'R' ? W + 18 : -18, g = x.createRadialGradient(lx, top - 20, 0, lx, top - 20, 120); g.addColorStop(0, 'rgba(255,214,140,.42)'); g.addColorStop(.5, 'rgba(255,214,140,.1)'); g.addColorStop(1, 'rgba(255,214,140,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const d = x.createLinearGradient(o.inner === 'R' ? 0 : W, 0, o.inner === 'R' ? W * .6 : W * .4, 0); d.addColorStop(0, 'rgba(8,10,6,.4)'); d.addColorStop(1, 'rgba(8,10,6,0)'); x.fillStyle = d; x.fillRect(0, 0, W, H);
  x.restore();
}
function vise(x, a, base) {
  layer(x, '#3d4a44', poly([[a, base], [a + 3, base - 6], [a + 3, base - 13], [a + 15, base - 13], [a + 15, base - 6], [a + 18, base]]), { lift: .5 });
  layer(x, '#56645c', rect(a + 1.5, base - 16, 15, 3.6), { lift: .4 }); layer(x, '#8d9599', rect(a + 2, base - 16.6, 14, 1), { lift: .2 });
  x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(a + 8.8, base - 16.6, .5, 4);
  stroke(x, [[a - 4, base - 9.5], [a + 22, base - 9.5]], STEEL, .9, { lift: .3 }); for (const ex of [a - 4.4, a + 22.4]) layer(x, '#2a2a2a', circle(ex, base - 9.5, 1), { lift: .2, tooth: false });
}
function organizer(x, a, base, w, h) {
  layer(x, '#6f7a6a', rrect(a, base - h, w, h, .8), { lift: .5 });
  const cols = 4, rows = 4, cw = (w - 2) / cols, ch = (h - 2) / rows, tints = ['#c9a46a', '#b8433a', '#d9b24f', '#8d9599', '#4f7a52', '#e9e4d6'];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const px = a + 1 + i * cw, py = base - h + 1 + j * ch;
    layer(x, '#d8d3c3', rect(px + .3, py + .3, cw - .6, ch - .6), { lift: .15 });
    x.fillStyle = rgba(tints[Math.floor(rnd(131, i * 4 + j) * tints.length)], .75); for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(px + 1 + rnd(132, i * 20 + j * 5 + k) * (cw - 2), py + ch * .55 + rnd(133, i * 20 + j * 5 + k) * ch * .3, .4, 0, TAU); x.fill(); }
    x.fillStyle = '#5a5f57'; x.fillRect(px + cw / 2 - .8, py + ch * .25, 1.6, .45);
  }
}
// The oscilloscope: its picture is a sheet of its own that glows. Returns the screen rectangle.
const SCOPE = { a: 92, w: 44, h: 30 };
function scope(x, a, base, w, h) {
  stroke(x, [[a + 6, base - h], [a + 8, base - h - 4], [a + w - 8, base - h - 4], [a + w - 6, base - h]], '#3a3d3a', 1, { lift: .3 });
  layer(x, '#c9c4b4', rrect(a, base - h, w, h, 1.4), { lift: .6 });
  layer(x, '#a9a495', rect(a, base - h + 2, w, 1.2), { lift: 0 });
  layer(x, '#222523', rrect(a + 3, base - h + 4.6, 25, 19.4, 1), { lift: .2 });
  for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) { layer(x, '#2c2e2c', circle(a + 32.5 + i * 6, base - h + 6.6 + j * 5.2, 1.6), { lift: .25 }); x.fillStyle = '#e9e4d6'; x.fillRect(a + 32.3 + i * 6, base - h + 5.2 + j * 5.2, .4, 1.1); }
  for (let k = 0; k < 4; k++) { layer(x, '#e3dccb', rect(a + 4 + k * 5, base - 4.4, 3.4, 1.6), { lift: .15 }); }
  for (const [jx, c] of [[a + 26, '#2a2a2a'], [a + 31, '#b8433a']]) { layer(x, '#111', circle(jx, base - 3.6, 1.1), { lift: .1, tooth: false }); layer(x, c, circle(jx, base - 3.6, .7), { lift: 0, tooth: false }); }
  for (const fx of [a + 2, a + w - 5]) layer(x, '#2a2a2a', rect(fx, base - .8, 3, .8), { lift: 0, tooth: false });
  return [a + 4, base - h + 5.6, 23, 17.4];
}
function scopePicture(x, W, H) {
  x.fillStyle = '#0c1a12'; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(127,209,138,.22)'; for (let k = 1; k < 8; k++) x.fillRect(k * W / 8, 0, .12, H); for (let k = 1; k < 6; k++) x.fillRect(0, k * H / 6, W, .12);
  x.save(); x.strokeStyle = '#9ff0a8'; x.lineWidth = .32; x.beginPath(); for (let i = 0; i <= 120; i++) { const u = i / 120, y = H * .5 - Math.sin(u * TAU * 2.5) * H * .26 * (1 - .25 * Math.sin(u * 7)); i ? x.lineTo(u * W, y) : x.moveTo(0, y); } x.stroke(); x.restore();
}
function solderStation(x, a, base) {
  layer(x, '#34383a', rrect(a, base - 12, 18, 12, 1), { lift: .5 });
  layer(x, '#efe8d6', circle(a + 6, base - 6, 3.2), { lift: .15 }); layer(x, '#2a2a2a', circle(a + 6, base - 6, 1.9), { lift: .1 }); x.fillStyle = '#e9e4d6'; x.fillRect(a + 5.8, base - 8.4, .4, 1.6);
  x.fillStyle = '#e8743a'; x.beginPath(); x.arc(a + 14, base - 8, .7, 0, TAU); x.fill();
  layer(x, '#9aa3a6', poly([[a + 20, base], [a + 28, base], [a + 26, base - 3], [a + 22, base - 3]]), { lift: .3 });
  layer(x, YEL, rect(a + 21, base - 3.2, 6, 1.2), { lift: .1 });
  x.save(); x.translate(a + 27, base - 3); x.rotate(-.9);
  x.strokeStyle = '#b9bec0'; x.lineWidth = .3; for (let k = 0; k < 7; k++) { x.beginPath(); x.ellipse(k * 1.5, 0, .7, 2, 0, 0, TAU); x.stroke(); }
  layer(x, '#2a2a2a', rrect(9, -1.4, 10, 2.8, 1.2), { lift: .3 }); layer(x, STEEL, rect(3, -.4, 6, .8), { lift: .2 });
  x.restore();
  stroke(x, [[a + 18, base - 5], [a + 24, base - 10], [a + 36, base - 16]], '#2a2a2a', .55, { smooth: true, lift: .2 });
}
function solderReel(x, cx, base) { layer(x, '#7d8582', rect(cx - 4, base - 7, 8, 7), { lift: .35 }); layer(x, '#c9ccc9', rect(cx - 3, base - 6.4, 6, 5.8), { lift: 0 }); x.fillStyle = 'rgba(80,86,88,.45)'; for (let k = 0; k < 6; k++) x.fillRect(cx - 3, base - 6 + k, 6, .2); layer(x, '#5d6461', rect(cx - 4.6, base - 7.4, 9.2, .9), { lift: .2 }); }
function powerSupply(x, a, base, w, h) {
  layer(x, '#c9c4b4', rrect(a, base - h, w, h, 1.2), { lift: .6 });
  for (let i = 0; i < 2; i++) {
    const dx = a + 2.4 + i * (w / 2 - 1), dw = w / 2 - 3.8, dy = base - h + 2.4, dh = 8.4;
    layer(x, '#efe8d6', rrect(dx, dy, dw, dh, .6), { lift: .15 });
    x.save(); x.strokeStyle = C.ink; x.lineWidth = .15; x.beginPath(); x.arc(dx + dw / 2, dy + dh + 1, dw * .42, PI * 1.2, PI * 1.8); x.stroke();
    const an = PI * (1.34 + i * .22); x.strokeStyle = '#141414'; x.lineWidth = .22; x.beginPath(); x.moveTo(dx + dw / 2, dy + dh + 1); x.lineTo(dx + dw / 2 + Math.cos(an) * dw * .48, dy + dh + 1 + Math.sin(an) * dw * .48); x.stroke(); x.restore();
    layer(x, '#2a2c2a', circle(dx + dw / 2, base - h + 15.4, 2), { lift: .3 }); x.fillStyle = '#e9e4d6'; x.fillRect(dx + dw / 2 - .2, base - h + 13.8, .4, 1.2);
  }
  [['#b8433a', .3], ['#1b1b1b', .5], ['#4f7a52', .7]].forEach(([c, k]) => { layer(x, '#111', circle(a + w * k, base - 3.4, 1.3), { lift: .2, tooth: false }); layer(x, c, circle(a + w * k, base - 3.4, .85), { lift: .1, tooth: false }); });
}
// A cable drum under the bench, seen from its socket side: the tube frame with its carrying bar, the black drum,
// the red hub with four sockets, the crank, the cable running out along the floor.
function drum(x, cx, base, r) {
  const cy = base - r - 2;
  stroke(x, [[cx - r * .8, cy + r * .2], [cx - r * .72, cy - r * 1.18], [cx + r * .72, cy - r * 1.18], [cx + r * .8, cy + r * .2]], '#8a908c', 1.3, { lift: .3 });
  for (const [a, b] of [[cx - r * .95, base], [cx + r * .95, base]]) stroke(x, [[cx + (a - cx) * .3, cy], [a, b]], '#8a908c', 1.2, { lift: .3 });
  stroke(x, [[cx + r * .6, cy + r * .5], [cx + r * 1.4, base - .6], [cx + r * 3.2, base - .5]], '#1b1b1b', 1.1, { smooth: true, lift: .15 });
  layer(x, '#4a4d4a', circle(cx, cy, r), { lift: .5 });
  layer(x, '#3a3d3a', circle(cx, cy, r * .86), { lift: .1 });
  x.save(); x.strokeStyle = 'rgba(255,255,255,.2)'; x.lineWidth = .35; x.beginPath(); x.arc(cx, cy, r * .95, PI * 1.05, PI * 1.6); x.stroke(); x.strokeStyle = 'rgba(0,0,0,.3)'; x.lineWidth = .15; for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(cx, cy, r * (.62 + k * .05), 0, TAU); x.stroke(); } x.restore();
  layer(x, '#a8382e', rrect(cx - r * .5, cy - r * .5, r, r, r * .18), { lift: .3 });
  for (let k = 0; k < 4; k++) {
    const sx = cx + (k % 2 ? .24 : -.24) * r, sy = cy + (k < 2 ? -.24 : .24) * r;
    layer(x, '#7e2a22', circle(sx, sy, r * .17), { lift: .05, tooth: false }); layer(x, '#2a2422', circle(sx, sy, r * .11), { lift: 0, tooth: false });
    x.fillStyle = '#d9d4c4'; x.beginPath(); x.arc(sx - r * .045, sy, .25, 0, TAU); x.arc(sx + r * .045, sy, .25, 0, TAU); x.fill();
  }
  stroke(x, [[cx + r * .5, cy - r * .1], [cx + r * 1.0, cy - r * .55]], '#8a908c', .9, { lift: .3 }); layer(x, '#1b1b1b', rrect(cx + r * .95, cy - r * .85, 2, 3.4, .8), { lift: .3 });
}
function toolbox(x, a, base, w, h) {
  // Pressed sheet steel in red enamel: lit along the lid from the lamp, darker towards the floor, the paint worn through
  // to grey on the corners where it is carried and set down.
  layer(x, RED, rrect(a, base - h, w, h, 1), { lift: .5, shade: wash(0, base - h, 0, base, 'rgba(255,230,210,.16)', 'rgba(40,8,6,.22)') });
  layer(x, tone(RED, -.15), rect(a, base - h + h * .35, w, 1.2), { lift: .15 });
  x.fillStyle = 'rgba(255,236,220,.35)'; x.fillRect(a + .8, base - h + .3, w - 1.6, .3);
  for (let k = 0; k < 9; k++) { const cx = k % 2 ? a + .6 + rnd(161, k) * 2 : a + w - .6 - rnd(161, k) * 2, cy = base - h + .6 + rnd(162, k) * (h - 1.2); if (rnd(163, k) > .4) { x.fillStyle = 'rgba(150,152,150,.75)'; x.beginPath(); x.ellipse(cx, cy, .25 + rnd(164, k) * .45, .18 + rnd(165, k) * .25, rnd(166, k) * 3, 0, TAU); x.fill(); } }
  // The handle on its two mounts, the latches with their pins, a paper label on the front.
  for (const px of [a + w * .3, a + w * .7]) layer(x, '#2a2a2a', rect(px - .9, base - h - .6, 1.8, .9), { lift: .15, tooth: false });
  stroke(x, [[a + w * .3, base - h], [a + w * .32, base - h - 3], [a + w * .68, base - h - 3], [a + w * .7, base - h]], '#2a2a2a', .9, { lift: .3 });
  for (const px of [a + 3, a + w - 5]) { layer(x, '#c9ccc9', rect(px, base - h + h * .3, 2, 2.4), { lift: .15 }); x.fillStyle = 'rgba(60,60,60,.6)'; x.beginPath(); x.arc(px + 1, base - h + h * .3 + 1.2, .28, 0, TAU); x.fill(); }
  layer(x, '#efe8d6', rect(a + w * .38, base - h * .45, w * .24, h * .22), { lift: .05, tooth: false }); x.fillStyle = 'rgba(43,36,32,.45)'; x.fillRect(a + w * .41, base - h * .45 + h * .07, w * .17, .25); x.fillRect(a + w * .41, base - h * .45 + h * .14, w * .12, .2);
}

// ---------------------------------------------------------------- the shelf with labelled boxes
function shelf(x, W, H) {
  const boards = [3, 38, 73, 108, 143], post = '#454b44';
  for (const px of [0, W - 3.4]) { layer(x, post, rect(px, H - boards[4] - 4, 3.4, boards[4] + 4), { lift: .5 }); x.fillStyle = 'rgba(0,0,0,.45)'; for (let y = H - boards[4]; y < H - 2; y += 4.4) x.fillRect(px + 1.2, y, 1, 2.2); x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(px + .3, H - boards[4], .35, boards[4]); }
  let n = 0;
  boards.forEach((b, j) => {
    const y = H - b;
    if (j < 4) {
      let a = 4.6, k = 0;
      while (a < W - 10) {
        const kind = rnd(141 + j, k), bw = kind < .45 ? 15 + rnd(142 + j, k) * 7 : 18 + rnd(143 + j, k) * 9, bh = 20 + rnd(144 + j, k) * 10;
        if (a + bw > W - 4.6) break;
        const c = kind < .45 ? [RED, YEL, '#8a8f8c', '#4f7a52', '#2f3332'][Math.floor(rnd(145 + j, k) * 5)] : tone('#b08d62', (rnd(146 + j, k) - .5) * .16);
        if (kind < .45) {
          // An open bin: the front is cut low, what it holds shows.
          layer(x, c, poly([[a, y - 2.6], [a, y - bh], [a + bw * .35, y - bh], [a + bw * .55, y - bh * .62], [a + bw, y - bh * .62], [a + bw, y - 2.6]]), { lift: .45 });
          x.fillStyle = 'rgba(160,165,160,.8)'; for (let q = 0; q < 9; q++) { x.beginPath(); x.arc(a + bw * .45 + rnd(147, n * 9 + q) * bw * .5, y - bh * .64 - rnd(148, n * 9 + q) * 1.3, .45, 0, TAU); x.fill(); }
          layer(x, '#f4eedd', rect(a + bw * .5, y - bh * .5, bw * .42, 4), { lift: 0 });
          text(x, TX.boxes[n % TX.boxes.length], a + bw * .71, y - bh * .5 + 2.1, Math.min(1.7, bw * .42 / (TX.boxes[n % TX.boxes.length].length * .62)), { font: 'Jost', weight: 700, color: C.ink });
        } else {
          layer(x, c, rect(a, y - 2.6 - bh, bw, bh), { lift: .45 });
          x.fillStyle = 'rgba(80,56,30,.25)'; x.fillRect(a, y - 2.6 - bh + 2.2, bw, .3);
          layer(x, '#f4eedd', rect(a + bw * .14, y - 2.6 - bh * .55, bw * .72, 4.4), { lift: 0 });
          text(x, TX.boxes[n % TX.boxes.length], a + bw / 2, y - 2.6 - bh * .55 + 2.3, Math.min(1.9, bw * .66 / (TX.boxes[n % TX.boxes.length].length * .62)), { font: 'Jost', weight: 700, color: C.ink });
        }
        a += bw + 1.4 + rnd(149 + j, k) * 1.6; k++; n++;
      }
    }
    layer(x, '#5c635a', rect(0, y - 2.6, W, 2.6), { lift: .45 }); x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(0, y - 2.6, W, .35);
  });
  // On top: a coil of cable and a box.
  const ty = H - boards[4] - 2.6;
  // A coil of yellow cable lying flat: seen from the front a low ring with its hole.
  layer(x, tone(YEL, -.25), ellipse(24, ty - 2.6, 13, 2.6), { lift: .4 }); layer(x, YEL, ellipse(24, ty - 3.6, 13, 2.8), { lift: .15 });
  layer(x, tone(YEL, -.45), ellipse(24, ty - 3.9, 6.5, 1.2), { lift: 0 });
  x.save(); x.strokeStyle = rgba(tone(YEL, -.5), .45); x.lineWidth = .14; for (let k = 0; k < 4; k++) { x.beginPath(); x.ellipse(24, ty - 3.6, 8 + k * 1.4, 1.7 + k * .3, 0, 0, TAU); x.stroke(); } x.restore();
  toolbox(x, 54, ty, 30, 12);
  // Light: the end towards the lamp lit, the far end dark.
  x.save(); x.globalCompositeOperation = 'source-atop';
  const g = x.createRadialGradient(-60, H - 70, 0, -60, H - 70, 170); g.addColorStop(0, 'rgba(255,214,140,.22)'); g.addColorStop(1, 'rgba(255,214,140,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const d = x.createLinearGradient(W, 0, 0, 0); d.addColorStop(0, 'rgba(8,10,6,.45)'); d.addColorStop(1, 'rgba(8,10,6,.05)'); x.fillStyle = d; x.fillRect(0, 0, W, H);
  x.restore();
}

// ---------------------------------------------------------------- the test frame and its lamp
// Aluminium profiles standing on the floor, a cross beam, the lamp on a short chain. Its shade hides the upper ends of
// both windows: they have no visible end.
function testFrame(x, W, H) {
  const pw = 4.6, beam = 6.4, rimY = H - FRAME.rim, prof = (a, b, w, h, vert) => {
    layer(x, '#3b403d', rect(a, b, w, h), { lift: .55 });
    x.fillStyle = 'rgba(10,12,11,.6)'; if (vert) x.fillRect(a + w / 2 - .4, b + 1, .8, h - 2); else x.fillRect(a + 1, b + h / 2 - .4, w - 2, .8);
    x.fillStyle = 'rgba(255,255,255,.16)'; if (vert) x.fillRect(a + .35, b, .3, h); else x.fillRect(a, b + .35, w, .3);
  };
  for (const a of [1, W - 1 - pw]) { prof(a, beam - 1, pw, H - beam - 1.6, true); layer(x, '#2c2f2d', rect(a - 3, H - 2, pw + 6, 2), { lift: .3 }); for (const fx of [a - 2, a + pw + 1]) layer(x, '#1b1b1b', rect(fx, H - .8, 2, .8), { lift: 0, tooth: false }); }
  prof(0, 1, W, beam, false);
  for (const [a, sd] of [[1 + pw, 1], [W - 1 - pw, -1]]) { layer(x, '#4a4f4b', poly([[a, beam + 1], [a + sd * 9, beam + 1], [a, beam + 10]]), { lift: .35 }); x.fillStyle = 'rgba(200,200,190,.5)'; x.beginPath(); x.arc(a + sd * 2.4, beam + 3.4, .45, 0, TAU); x.fill(); }
  // The chain from the beam to the lamp.
  const cx = W / 2, crown = H - 152;
  layer(x, '#2c2f2d', rrect(cx - 3, beam + .5, 6, 2.6, .6), { lift: .3 });
  for (let y = beam + 3; y < crown - 3; y += 2.1) { x.save(); x.strokeStyle = '#3a3d3a'; x.lineWidth = .4; x.beginPath(); x.ellipse(cx, y + 1, .7, 1.05, 0, 0, TAU); x.stroke(); x.restore(); }
  stroke(x, [[cx + 1.6, beam + 3], [cx + 2.4, crown - 8], [cx + 1, crown - 2]], '#2a2a2a', .5, { smooth: true, lift: .2 });
  // The shade: a deep enamel bell, dark green outside, a rolled rim.
  const prof2 = [[0, 52], [3, 51.4], [10, 49], [16, 45.5], [22, 39], [27, 30], [30.5, 20], [32.5, 13]].map(([h, half]) => [h, half]);
  const pts = []; prof2.forEach(([h, half]) => pts.push([cx - half, rimY - h])); prof2.slice().reverse().forEach(([h, half]) => pts.push([cx + half, rimY - h]));
  layer(x, '#2b3a31', poly(pts), { lift: .7 });
  inside(x, poly(pts), () => {
    const g = x.createLinearGradient(cx - 52, 0, cx + 52, 0); g.addColorStop(0, 'rgba(255,240,200,.1)'); g.addColorStop(.35, 'rgba(255,240,200,.03)'); g.addColorStop(.7, 'rgba(0,0,0,.14)'); g.addColorStop(1, 'rgba(0,0,0,.32)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    const h = x.createRadialGradient(cx - 24, rimY - 20, 0, cx - 24, rimY - 20, 16); h.addColorStop(0, 'rgba(255,248,225,.26)'); h.addColorStop(1, 'rgba(255,248,225,0)'); x.fillStyle = h; x.fillRect(0, 0, W, H);
    // The warm light from inside reaches the lower edge of the enamel.
    const w = x.createLinearGradient(0, rimY - 9, 0, rimY); w.addColorStop(0, 'rgba(255,214,140,0)'); w.addColorStop(1, 'rgba(255,214,140,.22)'); x.fillStyle = w; x.fillRect(0, 0, W, H);
  });
  layer(x, '#d9d4c4', rrect(cx - 53, rimY - 2.2, 106, 3, 1.4), { lift: .35 }); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(cx - 52, rimY - .2, 104, .6);
  layer(x, '#2b3a31', rrect(cx - 8, crown - 5.5, 16, 6, 1.4), { lift: .4 }); layer(x, C.brass, rrect(cx - 4.4, crown - 9, 8.8, 4, .8), { lift: .3 });
}
// What glows under the rim: the bulb and the lit inside of the shade.
function lampGlow(x, W, H) {
  const g = x.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * .5); g.addColorStop(0, '#fff6dc'); g.addColorStop(.35, WARM); g.addColorStop(1, 'rgba(255,217,138,.0)');
  x.fillStyle = g; x.beginPath(); x.ellipse(W / 2, 0, W * .49, 3.4, 0, 0, PI); x.fill();
  layer(x, '#fff3d2', xx => { xx.moveTo(W / 2 - 6.4, 0); xx.arc(W / 2, 0, 6.4, PI, 0, true); xx.closePath(); }, { lift: 0, tooth: false });
  x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.arc(W / 2 - 2, 2.4, 1.4, 0, TAU); x.fill();
}

// ---------------------------------------------------------------- pieces in front
function tafel(lines, sizes) {
  return (x, W, H) => {
    layer(x, tone(C.oak, -.25), rrect(0, 0, W, H, 1.4), { lift: .5 });
    inside(x, rrect(0, 0, W, H, 1.4), () => { for (let k = 0; k < 24; k++) { x.fillStyle = `rgba(60,36,16,${.1 + rnd(151, k) * .12})`; x.fillRect(rnd(152, k) * W, rnd(153, k) * H, 4 + rnd(154, k) * 16, .14); } });
    layer(x, C.cream, rrect(1.6, 1.6, W - 3.2, H - 3.2, .8), { lift: .2 });
    text(x, lines[0], W / 2, 9.2, sizes[0], { weight: 600, color: 'rgba(43,36,32,.86)' });
    const big = Math.min(sizes[1], sizes[1] * (W - 11) / textWidth(x, lines[1], sizes[1], { weight: 900 }));
    text(x, lines[1], W / 2, H - 10.6, big, { weight: 900, color: C.ink });
    for (const [px, py] of [[4, 4], [W - 4, 4], [4, H - 4], [W - 4, H - 4]]) { x.fillStyle = C.brass; x.beginPath(); x.arc(px, py, .8, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,.4)'; x.beginPath(); x.arc(px - .25, py - .25, .3, 0, TAU); x.fill(); }
  };
}
function stool(x, W, H) {
  const cx = W / 2;
  for (const [a, b] of [[cx - 3, cx - 14], [cx + 3, cx + 14]]) layer(x, '#454a45', poly([[a - 1.1, 7], [a + 1.1, 7], [b + 1.4, H], [b - 1.4, H]]), { lift: .4 });
  layer(x, '#3a3e3b', poly([[cx - .9, 7], [cx + .9, 7], [cx + 1.2, H - 2], [cx - 1.2, H - 2]]), { lift: .2 });
  layer(x, '#5a5f59', rect(cx - 11.5, H - 18, 23, 1.6), { lift: .35 });
  layer(x, '#2f2c28', rrect(cx - 15, 1.4, 30, 5.6, 2.4), { lift: .55 }); layer(x, '#5a4430', rrect(cx - 14, 0, 28, 3, 1.4), { lift: .3 });
  x.fillStyle = 'rgba(255,255,255,.15)'; x.fillRect(cx - 12, .6, 18, .4);
  for (const fx of [cx - 15.6, cx + 12.8]) layer(x, '#1f1f1f', rect(fx, H - 1, 2.8, 1), { lift: 0, tooth: false });
}
function slider(x, W, H) {
  // Seen from above: the carriage round the rail, a knurled knob, the index tongue that points at the scale.
  const cy = 13;
  layer(x, tone(C.brass, -.12), rrect(W / 2 - 1.6, .4, 3.2, cy - 4, .8), { lift: .3 });
  x.fillStyle = C.ink; x.fillRect(W / 2 - .15, .8, .3, cy - 5);
  layer(x, C.brass, rrect(1, cy - 6, W - 2, 12, 1.6), { lift: .55 });
  inside(x, rrect(1, cy - 6, W - 2, 12, 1.6), wash(0, cy - 6, 0, cy + 6, 'rgba(255,245,210,.35)', 'rgba(60,40,10,.25)'));
  for (const sx of [3.2, W - 3.2]) for (const sy of [cy - 4, cy + 4]) { x.fillStyle = 'rgba(70,50,20,.7)'; x.beginPath(); x.arc(sx, sy, .45, 0, TAU); x.fill(); }
  layer(x, '#2a2a2a', circle(W / 2, cy + 1.2, 4), { lift: .6 });
  x.save(); x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = .2; for (let k = 0; k < 24; k++) { const an = k * TAU / 24; x.beginPath(); x.moveTo(W / 2 + Math.cos(an) * 3.1, cy + 1.2 + Math.sin(an) * 3.1); x.lineTo(W / 2 + Math.cos(an) * 3.9, cy + 1.2 + Math.sin(an) * 3.9); x.stroke(); } x.restore();
  layer(x, '#454745', circle(W / 2, cy + 1.2, 2.4), { lift: .15 }); x.fillStyle = 'rgba(255,255,255,.3)'; x.beginPath(); x.arc(W / 2 - .8, cy + .4, .7, 0, TAU); x.fill();
}

export function lohnt(s) {
  const S = new Spread(s); S.plan = 20;
  // Seconds after the spread lies open (beats.md); the voice's word times replace them.
  S.t = { einfach: 1.8, acht: 5.6, viele: 9.1, zwanzig: 11.8, schluss: 14.2 };
  S.setup = t => {
    const pos = tt => ease((tt - t.viele) / 3);
    const settle = i => tt => ease((tt - t.einfach - i * .25) / .3);

    // ---- the wall of the test room
    S.vfold(HOST, { ...FOLD, dir: 1, lock: 0, color: OLIVE, draw: wall });
    // Where the two panels meet, a strip of the same wall a hair in front closes the seam: the corner of the room.
    S.stand('ecke', { host: HOST, side: 'R', u: -.003, off: .002, w: .006, h: FOLD.h, lock: 0, amp: 0, color: OLIVE, draw(x, W, H) {
      x.save(); x.translate(-(FOLD.wL * 1000 - W / 2), 0); wall(x, (FOLD.wL + FOLD.wR) * 1000, H); x.restore();
      const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(10,12,8,0)'); g.addColorStop(.5, 'rgba(10,12,8,.14)'); g.addColorStop(1, 'rgba(10,12,8,0)'); x.fillStyle = g; x.fillRect(0, 26.4, W, H - 30.4);
    } });

    // ---- the bench in two parts, the shelf, a stool
    const BL = { u: -.272, w: 206, off: .024, h: 108 }, BR = { u: .066, w: 92, off: .024, h: 108 };
    S.stand('werkbankL', { host: HOST, side: 'L', u: BL.u, off: BL.off, w: mm(BL.w), h: mm(BL.h), lock: .06, amp: .05, color: '#2f2c26', draw(x, W, H) {
      bench(x, W, H, { inner: 'R', drawers: [9, 46], under: (xx, top) => { drum(xx, 124, H, 13); toolbox(xx, 164, H, 26, 14); },
        items: (xx, base) => { vise(xx, 8, base); organizer(xx, 34, base, 26, 24); scope(xx, SCOPE.a, base, SCOPE.w, SCOPE.h); solderStation(xx, 144, base); solderReel(xx, 188, base); } });
    } });
    const scr = [SCOPE.a + 4, BL.h - 72 - 1.4 - SCOPE.h + 5.6, 23, 17.4];
    S.stand('schirm', { host: HOST, side: 'L', u: BL.u + mm(scr[0]), v: mm(BL.h - scr[1] - scr[3]), off: BL.off + .0007, w: mm(scr[2]), h: mm(scr[3]), e: .45, lock: .06, amp: .05, color: '#0c1a12', draw: scopePicture, life: () => ({ glow: .8 }) });
    S.stand('werkbankR', { host: HOST, side: 'R', u: BR.u, off: BR.off, w: mm(BR.w), h: mm(BR.h), lock: .06, amp: .05, color: '#2f2c26', draw(x, W, H) {
      bench(x, W, H, { inner: 'L', drawers: [W - 50, 44], under: (xx) => { toolbox(xx, 8, H, 30, 16); },
        items: (xx, base) => { powerSupply(xx, 14, base, 30, 22); xx.save(); xx.strokeStyle = '#a8382e'; xx.lineWidth = .8; for (let k = 0; k < 4; k++) { xx.beginPath(); xx.ellipse(60, base - 2, 9 - k * .5, 2 - k * .2, 0, 0, TAU); xx.stroke(); } xx.restore(); solderReel(xx, 80, base); } });
    } });
    S.stand('regal', { host: HOST, side: 'R', u: .166, off: .02, w: .112, h: .162, lock: .08, amp: .05, color: '#454b44', draw: shelf });
    S.stand('hocker', { host: HOST, side: 'L', u: -.232, off: .07, w: .034, h: .052, lock: .12, amp: .07, color: '#2f2c28', draw: stool });

    // ---- the two windows and what lies in them
    const wins = {};
    ['L', 'R'].forEach(side => {
      // The question's tokens rise from 13-22 mm to 30-39 mm in the direct window as the slider moves: no glint in the
      // lowest pane, the second pane's glint above where they come to rest.
      const win = wins[side] = makeWindow(S, { host: HOST, side, u: WIN[side], off: WIN.off, w: WIN.w, h: WIN.h, id: 'fenster' + side, base: WIN.base, glints: [null, [58.4, 50]] });
      STACK[side].forEach(([name, h], i) => {
        const f = typeof h === 'function' ? h : () => h, H = f(1), st = settle(i);
        win.add(name, H, PAINT[side][name], tt => st(tt) * f(pos(tt)) / H);
      });
      win.finish();
      // Below the stack's base the window is closed: a layer that grows from the inlet stays out of sight there.
      S.stand('fuss' + side, { host: HOST, side, u: WIN[side] + .0032, off: WIN.off - .0021, w: mm(WIN.w - 6.4), h: mm(WIN.base), lock: .08, amp: .05, color: '#3b342e', draw(x, W, H) { layer(x, '#3b342e', rect(0, 0, W, H), { lift: 0 }); inside(x, rect(0, 0, W, H), wash(0, 0, W, 0, 'rgba(0,0,0,.28)', 'rgba(255,240,220,.07)')); } });
      // The sign at its foot: ink for the direct way, cobalt for Code Mode.
      const c = side === 'L' ? C.ink : C.cobalt, word = TX.win[side === 'L' ? 0 : 1];
      S.stand('schild' + side, { host: HOST, side, u: WIN[side] + .0015, off: WIN.off + .0135, w: .025, h: .0078, res: 1.6, lock: .12, amp: .06, color: c, draw(x, W, H) {
        for (const fx of [3, W - 5]) layer(x, C.brass, rect(fx, H - 1.4, 2, 1.4), { lift: .2 });
        layer(x, c, rrect(0, 0, W, H - 1.2, .8), { lift: .4 });
        x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(.6, .5, W - 1.2, .3);
        text(x, word, W / 2, (H - 1.2) / 2 + .25, 3.7, { font: 'Jost', weight: 700, track: .12, color: '#f3ecd8' });
      } });
    });

    // ---- the test frame and the lamp, square to the viewer
    const fr = onPanel('R', 0, FRAME.z), lg = onPanel('R', 0, FRAME.z + .0007);
    S.stand('rahmen', { host: HOST, side: 'R', u: fr.u - mm(FRAME.w) / 2, off: fr.off, w: mm(FRAME.w), h: mm(FRAME.h), pivot: [mm(FRAME.w) / 2, 0], lock: .1, amp: .04, color: '#3b403d', draw: testFrame, life: () => ({ ry: TURN }) });
    // Only the lamp's light lives once the picture holds: it breathes a little.
    const breathe = tt => 1 - .14 * ease((tt - t.schluss) / 1.2) * (.5 - .5 * Math.cos((tt - t.schluss) * 1.9));
    S.stand('lampe', { host: HOST, side: 'R', u: lg.u - .051, v: mm(FRAME.rim - 8.6), off: lg.off, w: .102, h: .0086, pivot: [.051, 0], e: 1, lock: .1, amp: .04, color: WARM, draw: lampGlow, life: tt => ({ ry: TURN, glow: breathe(tt) }) });

    // ---- the slider on its rail
    S.flat('schieber', { side: 'R', x: RAIL.x0 - 9, y: RAIL.y - 13, w: .018, h: .022, res: 1.6, color: C.brass, draw: slider, life: tt => ({ dx: RAIL.travel * pos(tt) }) });

    // ---- the plates, standing up on their numbers
    const p1 = onPanel('L', -.106, .016), p2 = onPanel('R', .186, -.002);
    S.stand('tafel1', { host: HOST, side: 'L', u: p1.u, off: p1.off, w: .066, h: .033, res: 1.6, pivot: [0, 0], lock: .3, amp: 0, color: C.cream, draw: tafel(TX.t1, [4.7, 8.6]), life: standUp(t.acht) });
    S.stand('tafel2', { host: HOST, side: 'R', u: p2.u, off: p2.off, w: .106, h: .033, res: 1.6, pivot: [0, 0], lock: .3, amp: 0, color: C.cream, draw: tafel(TX.t2, [4.7, 8.2]), life: standUp(t.zwanzig) });

    // ---- the floor: boards, the lamp's island, the mat, the rail, the strip, the chapter's name
    const floor = (x, W, H, side) => {
      const L = side === 'L', Q = (a, b) => S.spot(HOST, side, mm(L ? -a : a), mm(b)), quad = (a0, b0, a1, b1) => poly([Q(a0, b0), Q(a1, b0), Q(a1, b1), Q(a0, b1)]);
      x.fillStyle = '#3b2a1e'; x.fillRect(0, 0, W, H);
      const bw = 13;
      for (let j = -2; j < 22; j++) {
        let a = -12 - rnd(171 + j, 0) * 80, k = 0;
        while (a < 345) {
          const len = 62 + rnd(172 + j, k) * 110, b0 = j * bw, sh = quad(a + .35, b0 + .3, a + len - .35, b0 + bw - .3);
          x.fillStyle = tone(BOARD, (rnd(173 + j, k) - .5) * .24); x.beginPath(); sh(x); x.fill();
          x.save(); x.beginPath(); sh(x); x.clip();
          for (let g = 0; g < 6; g++) { const bb = b0 + 1 + rnd(174 + j, k * 9 + g) * (bw - 2), p0 = Q(a, bb), p1 = Q(a + len * .5, bb + (rnd(175 + j, k * 9 + g) - .5) * 1.6), p2 = Q(a + len, bb + (rnd(176 + j, k * 9 + g) - .5) * .8); x.strokeStyle = `rgba(40,22,10,${.08 + rnd(177 + j, k * 9 + g) * .12})`; x.lineWidth = .22; x.beginPath(); x.moveTo(p0[0], p0[1]); x.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]); x.stroke(); }
          if (rnd(178 + j, k) > .8) { const p = Q(a + len * rnd(179 + j, k), b0 + bw * .5); x.fillStyle = 'rgba(50,28,12,.3)'; x.beginPath(); x.ellipse(p[0], p[1], 1.8, .9, 0, 0, TAU); x.fill(); }
          const hl = x.createLinearGradient(...Q(a, b0), ...Q(a, b0 + bw)); hl.addColorStop(0, 'rgba(255,240,210,.06)'); hl.addColorStop(1, 'rgba(0,0,0,.08)'); x.fillStyle = hl; x.fillRect(0, 0, W, H);
          x.restore();
          for (const aa of [a + 3.2, a + len - 3.2]) for (const bb of [b0 + 3.2, b0 + bw - 3.2]) { const p = Q(aa, bb); x.fillStyle = 'rgba(30,18,10,.6)'; x.beginPath(); x.arc(p[0], p[1], .36, 0, TAU); x.fill(); }
          a += len; k++;
        }
      }
      // The anti-static floor mat in front of the left bench, with its yellow edge.
      if (L) { x.fillStyle = '#323a34'; x.beginPath(); quad(70, 30, 262, 76)(x); x.fill(); x.save(); x.beginPath(); quad(70, 30, 262, 76)(x); x.clip(); for (let r = 0; r < 24; r++) { const p0 = Q(70, 31 + r * 1.9), p1 = Q(262, 31 + r * 1.9); x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = .4; x.beginPath(); x.moveTo(...p0); x.lineTo(...p1); x.stroke(); } x.restore(); for (const bb of [30, 74.6]) { x.fillStyle = YEL; x.beginPath(); quad(70, bb, 262, bb + 1.4)(x); x.fill(); } }
      // Where things stand, the floor is darker.
      const foot = (a0, a1, b, k = 1) => { for (const [d, al] of [[3.4, .06], [1.8, .1], [.8, .14]]) { x.fillStyle = `rgba(20,12,6,${al * k})`; x.beginPath(); quad(a0, b - d * .3, a1, b + d)(x); x.fill(); } };
      const bl = L ? BL : BR, a0 = L ? -(bl.u * 1000 + bl.w) : bl.u * 1000; foot(a0, a0 + bl.w, bl.off * 1000, 1.3);
      if (!L) foot(166, 278, 20, 1.3); else foot(222, 256, 70);
      foot(L ? -(WIN.L * 1000 + WIN.w) : WIN.R * 1000, L ? -WIN.L * 1000 : WIN.R * 1000 + WIN.w, WIN.off * 1000 + 9, 1.5);
      // The frame's foot, straight across the gutter.
      for (const [d, al] of [[4, .08], [2, .12]]) { x.fillStyle = `rgba(20,12,6,${al})`; const fx = L ? 300 - 62 : 62, fy = (FRAME.z + .118) * 1000; x.beginPath(); x.ellipse(fx, fy + 1, 8 + d, 1.6 + d * .4, 0, 0, TAU); x.fill(); }
      // The lamp's island of light; the rest of the room falls away into the dark.
      const c0 = Q(0, 55), g = x.createRadialGradient(c0[0], c0[1], 0, c0[0], c0[1], 175); g.addColorStop(0, 'rgba(255,214,140,.34)'); g.addColorStop(.5, 'rgba(255,214,140,.1)'); g.addColorStop(1, 'rgba(255,214,140,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      const v = x.createRadialGradient(c0[0], c0[1], 100, c0[0], c0[1], 330); v.addColorStop(0, 'rgba(10,6,3,0)'); v.addColorStop(1, 'rgba(10,6,3,.58)'); x.fillStyle = v; x.fillRect(0, 0, W, H);
      // The gutter's shade.
      const hx = L ? W : 0, gg = x.createLinearGradient(hx, 0, hx + (L ? -22 : 22), 0); gg.addColorStop(0, 'rgba(20,12,6,.45)'); gg.addColorStop(1, 'rgba(20,12,6,0)'); x.fillStyle = gg; x.fillRect(0, 0, W, H);
      if (L) {
        const tw = textWidth(x, TX.title, 13, { weight: 900 }); layer(x, tone(C.page, -.02), rrect(30, 197, tw + 14, 21, 1.2), { lift: .4 }); text(x, TX.title, 37, 208, 13, { weight: 900, color: C.ink, align: 'left' });
      } else {
        // The scale on the far side of the rail: ticks without numbers, a word at each end.
        const { a, y, len, x0, travel } = RAIL;
        layer(x, rgba('#f3ecd8', .9), rrect(a - 2, y - 21, len + 4, 15.6, 1), { lift: .3 });
        x.fillStyle = rgba(C.ink, .8); x.fillRect(x0, y - 8.2, travel, .3);
        for (let i = 0; i <= 32; i++) { const px = x0 + i * travel / 32, major = i % 8 === 0; x.fillRect(px - (major ? .2 : .13), y - 8.2 - (major ? 3.6 : 1.8), major ? .4 : .26, major ? 3.6 : 1.8); }
        text(x, TX.scale[0], x0 - .3, y - 15.6, 4.4, { font: 'Jost', weight: 500, align: 'left', color: C.ink });
        text(x, TX.scale[1], x0 + travel + .3, y - 15.6, 4.4, { font: 'Jost', weight: 500, align: 'right', color: C.ink });
        // The rail: a brass bar in a groove, its slot, the end blocks.
        x.fillStyle = 'rgba(20,12,6,.35)'; x.fillRect(a - 1, y - 4.2, len + 2, 8.4);
        layer(x, C.brass, rrect(a, y - 3.4, len, 6.8, 1), { lift: .35 });
        inside(x, rrect(a, y - 3.4, len, 6.8, 1), wash(0, y - 3.4, 0, y + 3.4, 'rgba(255,245,210,.32)', 'rgba(60,40,10,.22)'));
        layer(x, '#2a2418', rect(a + 7, y - .9, len - 14, 1.8), { lift: 0, tooth: false });
        for (const ex of [a - 1.2, a + len - 6.8]) { layer(x, tone(C.brass, -.22), rrect(ex, y - 5, 8, 10, 1), { lift: .5 }); for (const sy of [y - 2.6, y + 2.6]) { x.fillStyle = 'rgba(60,40,12,.8)'; x.beginPath(); x.arc(ex + 4, sy, .7, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(ex + 3.4, sy - .1, 1.2, .2); } }
        // The question, on a strip of paper at the end of one call.
        const sw = textWidth(x, TX.frage, 5.4, { weight: 600 }) + 9;
        x.save(); x.translate(a + sw / 2 - 4, y + 16.5); x.rotate(-.03);
        layer(x, C.cream, poly([[-sw / 2, -5.4], [sw / 2 - .4, -5.7], [sw / 2, 5.3], [-sw / 2 + .3, 5.6]]), { lift: .4 });
        text(x, TX.frage, 0, .4, 5.4, { weight: 600, color: C.ink });
        x.restore();
      }
    };
    S.page('L', (x, W, H) => floor(x, W, H, 'L'));
    S.page('R', (x, W, H) => floor(x, W, H, 'R'));
  };
  // 1 wide, 2 both windows with the strip and plate 1, 3 along with the slider (windows, rail and plate 2 in one
  // picture), 4 plate 2 close, 5 wide again until the leaf turns.
  S.cam = t => inOrder([
    [-1.7, [0, .52, .68], [0, .03, -.02], .52, .0024],
    [.4, [0, .45, .62], [0, .045, -.02], .5, .0026],
    [t.einfach + 1.0, [0, .215, .35], [0, .055, -.015], .39, .0024],
    [t.viele - .1, [.002, .213, .348], [.002, .055, -.015], .39, .0024],
    [t.viele + 2.4, [.1, .24, .43], [.1, .058, -.008], .44, .0024],
    [t.zwanzig + 1.3, [.19, .115, .335], [.198, .03, .006], .36, .0024],
    [t.zwanzig + 3.7, [.191, .114, .333], [.199, .03, .006], .355, .0024],
    [Math.max(t.schluss + 2.8, t.zwanzig + 5.2), [0, .4, .6], [0, .048, -.012], .52, .0026],
    [S.plan - .4, [0, .402, .602], [0, .048, -.012], .52, .0026],
  ]);
  return S;
}
