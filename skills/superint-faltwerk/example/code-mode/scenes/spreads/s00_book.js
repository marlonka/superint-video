// The book as an object: the leather binding and its gold, the inside of the board (turn-ins, marbled
// endpaper, bookplate), the title page, the last page and the back cover, which is the film's end card.
//
// Where things lie: the cover's leather picture (page 'R' of spread 0) is stretched over the whole board,
// 304 x 244 mm, while its gold (page 'L') covers the 300 x 236 mm of a page and starts 4 mm inside the head.
// Everything that must sit exactly under the gold (the pressed rim round every letter, the blind lines) is
// therefore drawn on the leather in the gold's coordinates: see onFoil().
// The title is set type (Fraunces 900) in gold; the film's own mark is a pair of braces holding a folded sheet.
import { Spread } from '../popup.js';
import { pageGround, layer, inside, stroke, text, para, textWidth, rect, rrect, circle, poly, tone, rgba, rnd, TAU } from '../paper.js';
import { LOOK } from '../look.js';
import { titlePopup } from './s01_titel.js';

const RED = LOOK.signal, INK = LOOK.ink;
const GOLD = LOOK.gold;                    // the foil; the metal takes its colour from this picture
const HIDE = LOOK.hide;                    // the goatskin
const PIT = LOOK.pit;                      // a tool pressed into the leather without gold
const kpx = x => { const m = x.getTransform(); return Math.hypot(m.a, m.b) || 6.6; };

// The board as seen in the gold's coordinates: front from the joint to the fore-edge, back mirrored.
const BOARD = { front: { x0: 7, x1: 304, cx: 155.5, off: 0 }, back: { x0: -4, x1: 293, cx: 144.5, off: 4 } };
const Y0 = -4, Y1 = 240, CY = 118;
// Draw on the leather picture in the gold's coordinates.
function onFoil(x, side, fn) { x.save(); x.scale(300 / 304, 236 / 244); x.translate(BOARD[side].off, 4); fn(); x.restore(); }

// ---------------------------------------------------------------- ornaments (used in gold, in blind and in ink)
// A corner tool: a fan of petals opening from the corner of the frame, a fine arc and a row of pearls round it.
function cornerTool(x, cx, cy, sx, sy, ink, s = 1) {
  x.save(); x.translate(cx, cy); x.scale(sx * s, sy * s); x.fillStyle = ink; x.strokeStyle = ink; x.lineCap = 'round';
  const N = 5;
  for (let i = 0; i < N; i++) {
    const a = (i + .5) / N * Math.PI / 2, c = Math.cos(a), sn = Math.sin(a), px = -sn, py = c, w = .95;
    x.beginPath(); x.moveTo(c * 1.6, sn * 1.6);
    x.quadraticCurveTo(c * 5 + px * w, sn * 5 + py * w, c * 8.2, sn * 8.2);
    x.quadraticCurveTo(c * 5 - px * w, sn * 5 - py * w, c * 1.6, sn * 1.6); x.fill();
  }
  x.lineWidth = .32; x.beginPath(); x.arc(0, 0, 9.6, .05, Math.PI / 2 - .05); x.stroke();
  for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2; x.beginPath(); x.arc(Math.cos(a) * 11.3, Math.sin(a) * 11.3, .48, 0, TAU); x.fill(); }
  x.beginPath(); x.arc(0, 0, 1.05, 0, TAU); x.fill();
  x.restore();
}
// A fine rule that swells to a lozenge in the middle, with two pearls.
function rule(x, cx, cy, w, ink, t = .5) {
  x.save(); x.fillStyle = ink;
  for (const s of [-1, 1]) {
    x.beginPath(); x.moveTo(cx + s * 7.2, cy - t / 2); x.quadraticCurveTo(cx + s * w * .3, cy - t * .32, cx + s * w / 2, cy - .04); x.lineTo(cx + s * w / 2, cy + .04); x.quadraticCurveTo(cx + s * w * .3, cy + t * .32, cx + s * 7.2, cy + t / 2); x.closePath(); x.fill();
    x.beginPath(); x.arc(cx + s * 4.8, cy, .62, 0, TAU); x.fill();
  }
  x.beginPath(); x.moveTo(cx, cy - 2); x.quadraticCurveTo(cx + .9, cy - .7, cx + 2.6, cy); x.quadraticCurveTo(cx + .9, cy + .7, cx, cy + 2); x.quadraticCurveTo(cx - .9, cy + .7, cx - 2.6, cy); x.quadraticCurveTo(cx - .9, cy - .7, cx, cy - 2); x.fill();
  x.restore();
}
// A printer's flower: two leaves back to back on a stem, a pearl between them.
function fleuron(x, cx, cy, s, ink) {
  x.save(); x.translate(cx, cy); x.scale(s, s); x.fillStyle = ink; x.strokeStyle = ink; x.lineCap = 'round';
  for (const f of [-1, 1]) {
    x.beginPath(); x.moveTo(f * 1.2, 0); x.bezierCurveTo(f * 2.6, -2.8, f * 6.4, -3.2, f * 8.6, -.4); x.bezierCurveTo(f * 6.2, -1.2, f * 3.4, -.6, f * 1.2, 0); x.fill();
    x.beginPath(); x.moveTo(f * 1.2, 0); x.bezierCurveTo(f * 2.8, 1.9, f * 5.6, 2.2, f * 7.2, .9); x.bezierCurveTo(f * 5.2, 1.0, f * 3.0, .7, f * 1.2, 0); x.fill();
    x.lineWidth = .32; x.beginPath(); x.moveTo(f * 8.4, -.3); x.quadraticCurveTo(f * 10.4, 1.4, f * 9.4, 2.6); x.stroke();
  }
  x.beginPath(); x.arc(0, 0, .95, 0, TAU); x.fill();
  x.restore();
}
// A rule frame of two fillets, a broad one outside and a hairline inside.
function fillets(x, a, b, c, d, ink, t1 = .8, gap = 2.1, t2 = .3) {
  x.save(); x.strokeStyle = ink; x.lineJoin = 'miter';
  x.lineWidth = t1; x.strokeRect(a, b, c - a, d - b);
  x.lineWidth = t2; x.strokeRect(a + gap, b + gap, c - a - 2 * gap, d - b - 2 * gap);
  x.restore();
}

// The book's name: Fraunces 900, widely set, the way a binder sets a short title. Returns its width.
function nameMark(x, s, cx, cy, size, ink) {
  const tr = size * .09;
  return text(x, s, cx, cy, size, { weight: 900, color: ink, track: tr });
}
// The film's own mark: two braces holding a sheet with a folded corner and three lines of code.
export function mark(x, cx, cy, h, ink = INK, paper = null) {
  x.save(); x.translate(cx, cy);
  const w = h * .5, t = h * .5;
  for (const f of [-1, 1]) text(x, f < 0 ? '{' : '}', f * h * .62, -h * .04, h * 1.02, { weight: 600, color: ink });
  x.fillStyle = paper || 'rgba(0,0,0,0)'; x.strokeStyle = ink; x.lineWidth = h * .035; x.lineJoin = 'round';
  x.beginPath(); x.moveTo(-w / 2, -t); x.lineTo(w / 2 - h * .16, -t); x.lineTo(w / 2, -t + h * .16); x.lineTo(w / 2, t); x.lineTo(-w / 2, t); x.closePath(); if (paper) x.fill(); x.stroke();
  x.beginPath(); x.moveTo(w / 2 - h * .16, -t); x.lineTo(w / 2 - h * .16, -t + h * .16); x.lineTo(w / 2, -t + h * .16); x.stroke();
  x.fillStyle = ink; [[.62, -.16], [.78, .06], [.46, .28]].forEach(([k, yy], i) => x.fillRect(-w / 2 + h * .09 + (i === 1 ? h * .07 : 0), yy * h - h * .028, (w - h * .18) * k - (i === 1 ? h * .07 : 0), h * .056));
  x.restore();
}

// ---------------------------------------------------------------- what is tooled on each board
// mode 'gold' draws the foil, 'blind' the same tools pressed without gold (the rim the gold sits in).
function boardArt(x, side, ink, T) {
  const B = BOARD[side], cx = B.cx, i0 = 12.5;
  const a = B.x0 + i0, c = B.x1 - i0, b = Y0 + i0, d = Y1 - i0;
  fillets(x, a, b, c, d, ink);
  const k = 2.1;
  cornerTool(x, a + k, b + k, 1, 1, ink); cornerTool(x, c - k, b + k, -1, 1, ink); cornerTool(x, a + k, d - k, 1, -1, ink); cornerTool(x, c - k, d - k, -1, -1, ink);
  if (side === 'front') {
    // The title set to the width of the word mark: the block stays square even when the camera looks along it.
    const mw = nameMark(x, T.coverName, cx, 100, 31, ink), n = [...T.coverTop].length, tw = textWidth(x, T.coverTop, 8.2, { weight: 700 });
    text(x, T.coverTop, cx, 57, 8.2, { weight: 700, color: ink, track: (mw - tw) / (n - 1) });
    rule(x, cx, 128, 128, ink);
    text(x, T.coverSub, cx, 144, 8.2, { weight: 600, color: ink, track: .55 });
    text(x, T.coverFoot, cx, d - 19, 5.2, { weight: 600, color: ink, track: 2.7 });
  } else {
    nameMark(x, T.backName, cx, 119, 24, ink);
    rule(x, cx, 145, 112, ink, .45);
    text(x, T.backSub, cx, 159, 6.8, { weight: 600, color: ink, track: 2.7 });
  }
}

// ---------------------------------------------------------------- the leather
// A pebbled goatskin: dark creases in a loose net, the tops of the pebbles a little lighter.
function grain(x, W, H, seed) {
  x.save(); x.lineCap = 'round';
  const n = 15000;
  for (let q = 0; q < 4; q++) {
    x.beginPath();
    for (let i = 0; i < n; i++) {
      const j = q * n + i, px = rnd(seed, j) * W, py = rnd(seed + 1, j) * H, a = rnd(seed + 2, j) * TAU, l = .28 + rnd(seed + 3, j) * .7, bend = (rnd(seed + 4, j) - .5) * 1.8;
      x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + bend) * l * .5, py + Math.sin(a + bend) * l * .5, px + Math.cos(a) * l, py + Math.sin(a) * l);
    }
    x.strokeStyle = `rgba(3,12,9,${.08 + q * .045})`; x.lineWidth = .06 + q * .022; x.stroke();
  }
  x.beginPath();
  for (let i = 0; i < 18000; i++) { const px = rnd(seed + 7, i) * W, py = rnd(seed + 8, i) * H, r = .07 + rnd(seed + 9, i) * .12; x.moveTo(px + r, py); x.arc(px, py, r, 0, TAU); }
  x.fillStyle = 'rgba(182,238,219,.045)'; x.fill();
  x.restore();
}
function leather(side, T) {
  return (x, W, H) => {
    const front = side === 'front', S = front ? 0 : W, F = front ? W : 0, dirIn = front ? -1 : 1, seed = front ? 3 : 17;
    x.fillStyle = HIDE; x.fillRect(-1, -1, W + 2, H + 2);
    // The skin took the dye unevenly: soft patches, darker along the backbone line of the hide.
    for (let i = 0; i < 80; i++) {
      const cx = rnd(seed, i) * W, cy = rnd(seed + 1, i) * H, r = 8 + rnd(seed + 2, i) * 40, dark = rnd(seed + 3, i) > .42;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, dark ? `rgba(5,16,12,${.05 + rnd(seed + 4, i) * .09})` : `rgba(64,130,108,${.03 + rnd(seed + 4, i) * .05})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    }
    grain(x, W, H, seed + 20);
    // Where hands hold the book: the fore-edge is a little darker and smoother.
    { const g = x.createLinearGradient(F, 0, F + dirIn * 60, 0); g.addColorStop(0, 'rgba(6,20,15,.16)'); g.addColorStop(1, 'rgba(6,20,15,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
    // The joint: the board bends here, a groove runs parallel to the spine.
    { const jx = S - dirIn * 6.6, g = x.createLinearGradient(S, 0, jx, 0); g.addColorStop(0, 'rgba(2,10,7,.5)'); g.addColorStop(1, 'rgba(2,10,7,.08)'); x.fillStyle = g; x.fillRect(Math.min(S, jx), 0, 6.6, H);
      x.fillStyle = 'rgba(2,8,6,.55)'; x.fillRect(jx - .35, 0, .7, H); x.fillStyle = 'rgba(194,241,225,.07)'; x.fillRect(jx - dirIn * .5 - .15, 0, .3, H); }
    // Worn edges and corners: the grain is rubbed flat, the dye lighter; at the tips the board shows.
    x.save();
    // A strip along one edge (x0, y0) -> (x1, y1) is the direction inwards; it covers the whole edge.
    const band = (x0, y0, x1, y1) => {
      const g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(66,116,99,.4)'); g.addColorStop(.35, 'rgba(60,106,91,.14)'); g.addColorStop(1, 'rgba(60,106,91,0)'); x.fillStyle = g;
      if (y0 === y1) x.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), H); else x.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));
    };
    band(F, 0, F + dirIn * 2.6, 0); band(0, 0, 0, 2.4); band(0, H, 0, H - 2.4);
    for (const cy of [0, H]) {
      const g = x.createRadialGradient(F, cy, 0, F, cy, 8); g.addColorStop(0, 'rgba(146,90,66,.62)'); g.addColorStop(.3, 'rgba(66,114,98,.3)'); g.addColorStop(1, 'rgba(62,106,91,0)'); x.fillStyle = g; x.fillRect(F - 9, cy - 9, 18, 18);
      x.fillStyle = 'rgba(168,124,92,.75)'; x.beginPath(); x.moveTo(F, cy); x.lineTo(F + dirIn * (1.4 + rnd(seed, cy) * .8), cy); x.quadraticCurveTo(F + dirIn * .7, cy + (cy ? -1 : 1) * .7, F, cy + (cy ? -1 : 1) * (1.2 + rnd(seed + 1, cy) * .7)); x.closePath(); x.fill();
      const g2 = x.createRadialGradient(S, cy, 0, S, cy, 6); g2.addColorStop(0, 'rgba(72,124,107,.45)'); g2.addColorStop(1, 'rgba(62,106,91,0)'); x.fillStyle = g2; x.fillRect(S - 7, cy - 7, 14, 14);
    }
    // Scuffs along the edges.
    x.lineCap = 'round';
    for (let i = 0; i < 140; i++) {
      const e = rnd(seed + 30, i), t = rnd(seed + 31, i), l = .5 + rnd(seed + 32, i) * 2.4, dd = rnd(seed + 33, i) * 3.2;
      const [px, py, ax, ay] = e < .4 ? [F + dirIn * dd, t * H, 0, 1] : e < .7 ? [t * W, dd, 1, 0] : [t * W, H - dd, 1, 0];
      x.strokeStyle = `rgba(87,135,119,${.12 + rnd(seed + 34, i) * .22})`; x.lineWidth = .08 + rnd(seed + 35, i) * .14;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + ax * l, py + ay * l); x.stroke();
    }
    x.restore();
    // Blind tooling: two fillets pressed without gold outside the gilt frame, and the rim every gold tool sits in.
    onFoil(x, side, () => {
      const B = BOARD[side];
      x.save(); x.strokeStyle = PIT; x.lineWidth = .62; x.strokeRect(B.x0 + 7, Y0 + 7, B.x1 - B.x0 - 14, Y1 - Y0 - 14);
      x.lineWidth = .32; x.strokeRect(B.x0 + 8.7, Y0 + 8.7, B.x1 - B.x0 - 17.4, Y1 - Y0 - 17.4);
      x.strokeStyle = 'rgba(194,241,225,.06)'; x.lineWidth = .25; x.strokeRect(B.x0 + 7.55, Y0 + 7.55, B.x1 - B.x0 - 15.1, Y1 - Y0 - 15.1);
      x.restore();
      // The pressed rim: the same tools, dark, a hair wider and soft at the edge.
      const k = kpx(x);
      x.save(); x.shadowColor = 'rgba(2,8,6,.7)'; x.shadowBlur = .45 * k;
      for (const [dx, dy] of [[.16, 0], [-.16, 0], [0, .16], [0, -.16]]) { x.save(); x.translate(dx, dy); boardArt(x, side, 'rgba(4,13,10,.55)', T); x.restore(); }
      x.restore();
    });
    // The light falls off towards the edges of the board.
    const v = x.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .72); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(4,16,12,.3)'); x.fillStyle = v; x.fillRect(0, 0, W, H);
  };
}
// The gold: the tools in foil, a little uneven, with specks where the foil did not take.
function foil(side, T) {
  return (x, W, H) => {
    boardArt(x, side, GOLD, T);
    x.save(); x.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 90; i++) {
      const cx = rnd(41, i) * W, cy = rnd(42, i) * H, r = 3 + rnd(43, i) * 16, lt = rnd(44, i) > .5;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, lt ? 'rgba(246,222,150,.22)' : 'rgba(120,82,30,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    }
    x.globalCompositeOperation = 'destination-out';
    x.beginPath(); for (let i = 0; i < 700; i++) { const px = rnd(45, i) * W, py = rnd(46, i) * H, r = .09 + rnd(47, i) * .12; x.moveTo(px + r, py); x.arc(px, py, r, 0, TAU); }
    x.fillStyle = 'rgba(0,0,0,.85)'; x.fill();
    x.restore();
  };
}

export function cover(s, T) {
  const S = new Spread(s); S.raw = { L: true };
  S.page('R', leather('front', T));
  S.page('L', foil('front', T));
  return S;
}

// ---------------------------------------------------------------- the inside of the front board
// Marbled paper, a stone marble ("Steinmarmor"): rounded cells of colour pressed against each other, a fine
// cream vein between them and a darker rim inside each cell, the whole pattern drawn a little through the size.
// Cells are an additively weighted Voronoi diagram on a jittered grid (round, unequal), seen through a soft warp.
let MARBLE = null;
function marble() {
  if (MARBLE) return MARBLE;
  const K = 4, Wm = 300, Hm = 236, w = Math.round(Wm * K), h = Math.round(Hm * K);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const cx2 = c.getContext('2d'), im = cx2.createImageData(w, h), d = im.data;
  // The colours of a bound book's marble: wine and madder reds, a little slate and old gold, never a bright yellow.
  const CELL = LOOK.marble.cell, RIM = LOOK.marble.rim, CREAM = LOOK.marble.cream;
  // Drops of very unequal size, as they spread on the size bath: a few large, many small.
  const G = 7.4, NX = Math.ceil(Wm / G) + 2, NY = Math.ceil(Hm / G) + 2, P = [];
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const k = j * NX + i, big = rnd(85, k); P.push([(i - .5 + .1 + rnd(81, k) * .8) * G, (j - .5 + .1 + rnd(82, k) * .8) * G, big * big * 5.2, Math.floor(rnd(84, k) * CELL.length)]); }
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    let X = (px + .5) / K, Y = (py + .5) / K;
    const wx = X + 2.4 * Math.sin(Y * .19 + 1.6 * Math.sin(X * .07)) + .9 * Math.sin((X + Y) * .41), wy = Y + 2 * Math.sin(X * .17 + 1.3 * Math.sin(Y * .09)) + .9 * Math.sin((X - Y) * .37);
    const gi = Math.floor(wx / G) + 1, gj = Math.floor(wy / G) + 1;
    let d1 = 1e9, d2 = 1e9, best = 0;
    for (let jj = gj - 1; jj <= gj + 1; jj++) for (let ii = gi - 1; ii <= gi + 1; ii++) {
      if (ii < 0 || jj < 0 || ii >= NX || jj >= NY) continue;
      const q = P[jj * NX + ii], dd = Math.hypot(wx - q[0], wy - q[1]) - q[2];
      if (dd < d1) { d2 = d1; d1 = dd; best = q[3]; } else if (dd < d2) d2 = dd;
    }
    // The cream veins are fine and uneven: thick where the drops met slowly, a hair where they pressed hard.
    const e = d2 - d1, cell = CELL[best], vw = .16 + .2 * (.5 + .5 * Math.sin(wx * .23 + wy * .11 + Math.sin(wy * .07) * 3));
    const rimW = 1.5 + .8 * Math.sin(wx * .13 - wy * .19);
    let col = e < vw ? CREAM : e < vw + rimW ? mix3(RIM[best], cell, (e - vw) / rimW * .55) : mix3(cell, [255, 236, 220], .06 * Math.min(1, (e - vw - rimW) / 5));
    if (e >= vw && e < vw + .18) col = mix3(mix3(CREAM, RIM[best], .35), col, (e - vw) / .18);
    // The colour lies unevenly on the bath: soft clouds inside every cell.
    const m = Math.sin(X * .83 + Math.sin(Y * .61) * 2.2) * Math.sin(Y * .97 + Math.sin(X * .47) * 2.4);
    if (e >= vw) col = mix3(col, m > 0 ? [6, 22, 16] : [226, 240, 226], Math.abs(m) * .07);
    const o = (py * w + px) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
  }
  cx2.putImageData(im, 0, 0);
  // Sprinkled last with a brush: dark specks of the deepest colour and a few of the cream, the way a stone marble is finished.
  cx2.save(); cx2.scale(K, K);
  for (const [n, col, r0, r1, seed] of [[5200, 'rgba(15,39,31,.55)', .08, .3, 61], [900, 'rgba(230,214,186,.5)', .06, .18, 62], [500, 'rgba(30,34,52,.45)', .1, .34, 63]]) {
    cx2.fillStyle = col; cx2.beginPath();
    for (let i = 0; i < n; i++) { const px = rnd(seed, i) * Wm, py = rnd(seed + 9, i) * Hm, r = r0 + rnd(seed + 17, i) * (r1 - r0); cx2.moveTo(px + r, py); cx2.arc(px, py, r, 0, TAU); }
    cx2.fill();
  }
  cx2.restore();
  return MARBLE = c;
}
// The inside of the board: leather turned in at head, tail and fore-edge, the marbled pastedown over it.
function boardInside(x, W, H) {
  const T0 = 5.6;
  // Turn-ins: the same goatskin, pared thin, mitred at the corners.
  x.fillStyle = HIDE; x.fillRect(-1, -1, W + 2, H + 2);
  grain(x, W, H, 51);
  x.save(); x.strokeStyle = 'rgba(2,10,7,.4)'; x.lineWidth = .3;
  for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [0, H, 1, -1]]) { x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + sx * T0 * 1.2, cy + sy * T0 * 1.2); x.stroke(); }
  x.restore();
  { const g = x.createLinearGradient(0, 0, 3, 0); g.addColorStop(0, 'rgba(74,124,107,.4)'); g.addColorStop(1, 'rgba(74,124,107,0)'); x.fillStyle = g; x.fillRect(0, 0, 3, H); }
  // The pastedown: marbled paper with a cut edge, glued over the turn-ins.
  const pd = rect(T0, T0, W - T0 + 2, H - 2 * T0);
  x.save(); x.shadowColor = 'rgba(2,8,6,.55)'; x.shadowBlur = .7 * kpx(x); x.shadowOffsetX = -.15 * kpx(x); x.fillStyle = '#d6dccb'; x.beginPath(); pd(x); x.fill(); x.restore();
  inside(x, pd, () => {
    x.imageSmoothingQuality = 'high'; x.drawImage(marble(), 0, 0, W, H);
    // Size and burnish: the marbled sheet has a soft sheen, darker where the glue soaked in near the joint.
    const g = x.createLinearGradient(W, 0, W - 30, 0); g.addColorStop(0, 'rgba(18,42,34,.42)'); g.addColorStop(1, 'rgba(18,42,34,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  });
  layer(x, 'rgba(0,0,0,0)', pd, { lift: 0 });
  { x.save(); x.globalCompositeOperation = 'multiply'; const v = x.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, W * .7); v.addColorStop(0, 'rgba(255,255,255,1)'); v.addColorStop(1, 'rgba(200,180,160,1)'); x.fillStyle = v; x.fillRect(0, 0, W, H); x.restore(); }
}
// Laid paper: the wires of the mould show as fine lines.
function laid(x, a, b, w, h, seed) {
  x.save(); x.strokeStyle = 'rgba(120,96,60,.07)'; x.lineWidth = .12; x.beginPath();
  for (let y = b + .5; y < b + h; y += .95) { x.moveTo(a, y); x.lineTo(a + w, y); } x.stroke();
  x.strokeStyle = 'rgba(120,96,60,.08)'; x.lineWidth = .3; x.beginPath();
  for (let xx = a + 6 + rnd(seed, 1) * 6; xx < a + w; xx += 24) { x.moveTo(xx, b); x.lineTo(xx, b + h); } x.stroke();
  x.restore();
}
// A line cut in copper and printed: crisp, swelling a little along its length.
function engraved(x, x0, y0, x1, y1, w, ink, seed = 1) {
  const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, nx = -uy, ny = ux, n = Math.max(8, Math.ceil(L / 1.2)), P = [], Q = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, sw = w * (.9 + .16 * Math.sin(t * 9.3 + seed) * Math.sin(t * 3.1 + seed * 2) + .06 * (rnd(seed, i) - .5));
    const px = x0 + ux * L * t, py = y0 + uy * L * t; P.push([px + nx * sw / 2, py + ny * sw / 2]); Q.push([px - nx * sw / 2, py - ny * sw / 2]);
  }
  x.save(); x.fillStyle = ink; x.beginPath(); x.moveTo(P[0][0], P[0][1]); for (const p of P) x.lineTo(p[0], p[1]); for (let i = Q.length - 1; i >= 0; i--) x.lineTo(Q[i][0], Q[i][1]); x.closePath(); x.fill(); x.restore();
}
function engravedFrame(x, a, b, c, d, ink, t1, gap, t2, seed) {
  for (const [o, t, k] of [[0, t1, 0], [gap, t2, 7]]) {
    const A = a + o, B = b + o, C = c - o, D = d - o;
    engraved(x, A - t / 2, B, C + t / 2, B, t, ink, seed + k); engraved(x, A - t / 2, D, C + t / 2, D, t, ink, seed + k + 1);
    engraved(x, A, B, A, D, t, ink, seed + k + 2); engraved(x, C, B, C, D, t, ink, seed + k + 3);
  }
}
// The bookplate, glued on the pastedown.
function bookplate(x, cx, cy, T) {
  const w = 104, h = 80, a = cx - w / 2, b = cy - h / 2;
  layer(x, '#f2ead6', rrect(a, b, w, h, .8), { lift: .5, sh: .42 });
  inside(x, rect(a, b, w, h), () => {
    laid(x, a, b, w, h, 5);
    const g = x.createRadialGradient(cx, cy, 10, cx, cy, w * .7); g.addColorStop(0, 'rgba(120,90,50,0)'); g.addColorStop(1, 'rgba(120,90,50,.12)'); x.fillStyle = g; x.fillRect(a, b, w, h);
  });
  // Printed in the binding's green: the endpapers carry no signal colour, cobalt is kept for the title.
  const PL = HIDE;
  engravedFrame(x, a + 4.5, b + 4.5, a + w - 4.5, b + h - 4.5, PL, .7, 1.7, .22, 3);
  for (const [px, py] of [[a + 4.5, b + 4.5], [a + w - 4.5, b + 4.5], [a + 4.5, b + h - 4.5], [a + w - 4.5, b + h - 4.5]]) { layer(x, '#f2ead6', rect(px - 1.9, py - 1.9, 3.8, 3.8), { lift: 0, tooth: false }); x.strokeStyle = PL; x.lineWidth = .3; x.strokeRect(px - 1.5, py - 1.5, 3, 3); x.fillStyle = PL; x.beginPath(); x.arc(px, py, .55, 0, TAU); x.fill(); }
  mark(x, cx, b + 25, 21, PL);
  rule(x, cx, b + 44, 56, rgba(INK, .85), .32);
  para(x, T.plate, a + 10, b + 56, w - 20, 6.4, { align: 'center', lead: 1.45, color: INK });
}

// The title page: thin laid paper, an engraved double frame, the word mark in red.
function titlePage(x, W, H, T) {
  pageGround(x, W, H, 'R', '#ece2c8', 4);
  laid(x, 0, 0, W, H, 9);
  const cx = W / 2 + 4, a = 19, b = 14, c = W - 12, d = H - 14;
  engravedFrame(x, a, b, c, d, rgba(INK, .9), .95, 2.3, .26, 11);
  for (const [px, py, sx, sy] of [[a, b, 1, 1], [c, b, -1, 1], [a, d, 1, -1], [c, d, -1, -1]]) cornerTool(x, px + 4.4 * sx, py + 4.4 * sy, sx, sy, rgba(INK, .85), .62);
  // Set high on the page: below the rule the question comes up on its word, and the pop-up stands in the lower half.
  text(x, T.titleTop, cx, 40, 8.4, { weight: 600, track: 3, color: INK });
  text(x, T.titleName, cx, 65, 30, { weight: 900, color: RED, track: 2.2 });
  rule(x, cx, 89, 150, rgba(INK, .9), .42);
  // Under the rule the question comes up on its word, and below it the pop-up stands (s01_titel.js) down to the foot:
  // the imprint is on the binding.
}

export function title(s, T) {
  const S = new Spread(s);
  S.page('L', (x, W, H) => { boardInside(x, W, H); bookplate(x, 154, 118, T); });
  S.page('R', (x, W, H) => titlePage(x, W, H, T));
  return titlePopup(S, T);
}

// The last page and the inside of the back cover (not in the film's book at the moment; kept in step).
export function lastPage(s, T) {
  const S = new Spread(s);
  S.page('L', (x, W, H) => {
    pageGround(x, W, H, 'L', '#eadfc4', 6);
    const cx = W / 2 - 4;
    engravedFrame(x, 14, 14, W - 20, H - 14, rgba(INK, .9), .9, 2.3, .26, 21);
    mark(x, cx, 52, 24, RED);
    para(x, T.endLine, 34, 96, W - 76, 11.6, { align: 'center', weight: 900, lead: 1.3, color: INK });
    rule(x, cx, 150, 64, INK, .35);
    text(x, T.endSub, cx, 164, 7.6, { weight: 600, color: tone(INK, .2), track: .8 });
  });
  S.page('R', (x, W, H) => { x.save(); x.translate(W, 0); x.scale(-1, 1); boardInside(x, W, H); x.restore(); });
  return S;
}

// The back cover: the end card. Calm: the word mark in gold, a rule, the year.
export function back(s, T) {
  const S = new Spread(s); S.raw = { L: true };
  S.page('R', leather('back', T));
  S.page('L', foil('back', T));
  return S;
}
