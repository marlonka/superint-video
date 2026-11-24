// Spread 7, "Was kommt": the office of spread 2 from inside, deep in the night. The table is done: the monitor shows
// its last rows and the total. Three index cards stand on their names (who named it, who offers it, who switches it on
// by default); beside them a laptop has Code Mode switched on; between them lies the MCP booklet, whose cover lifts on
// the page that recommends the pattern. Then the message card stands up, its three lines come on their words, and it
// stays alone.
// Nobody is there: a jacket hangs over the chair, the mug still steams, the desk lamp burns.
// Two scales (direction.md): the room in section behind (window, pinboard, shelf, chair) and the hero pieces
// on the printed desk top in front (monitor, keyboard, mug, lamp, booklet, laptop, card).
import { Spread } from '../popup.js';
import { pageGround, layer, inside, stroke, text, textWidth, rect, rrect, circle, ellipse, poly, tone, rgba, rnd, TAU, wash } from '../paper.js';
import { C, mono, ease, rise, riseFall, openInvoices, euro } from '../techkit.js';
import { mark } from './s00_book.js';

// Every printed word of this spread. Facts: research.md, register IDs in the comments; the invoices are the
// example data of the film (direction.md, "Beispieldaten"), printed only, never spoken as a measurement.
const TX = {
  title: 'Was kommt',                                                    // buchplan, Doppelseite 7
  winTitle: 'Offene Rechnungen', tab: 'Tabelle 1',                        // the example table
  letters: ['A', 'B', 'C', 'D'], cols: ['Nr', 'Kunde', 'Status', 'Betrag'], open: 'offen',
  cell: 'D43', cellValue: '23874,6',                                     // the total sits in D43 (buchplan, "Nur gedruckt")
  sumLabel: 'Summe', sum: '23.874,60 €',                                 // buchplan, "Nur gedruckt"
  term: 'Terminal',
  cmd: ['CLAUDE_CODE_', 'EXPERIMENTAL_CODE_MODE=1', 'claude'],          // AN27 / AN28 (Q8, Q12)
  status: ['Code Mode (experimental)', 'is on'],                         // AN27 / AN28 (Q8: "Code Mode (experimental) is on")
  coverTitle: ['Model Context', 'Protocol'], coverSub: 'Client Best Practices',   // AN45 / PR55 (Q16)
  pageHead: ['Programmatic', 'Tool Calling'], pageSub: 'Code Mode',               // AN45 / PR55 (Q16)
  // Who named it, who offers it, who switches it on: three index cards, set in ink on cream, no logos (Koordinator,
  // Textkritik zu Doppelseite 7; script.md and beats.md, Doppelseite 7).
  cloudflare: ['Cloudflare', 'gab den Namen'],                          // CF1, AN7, PR68
  anthropic: ['Anthropic', 'feste Funktion'],                            // AN18, PR57
  andere: ['Andere Agenten', 'von Haus aus an'],                         // PR61, PR62, without names
  // The message, one line on each of its words (script.md, Doppelseite 7): not the end of MCP (PR80), for large tasks
  // (AN19, PR36, PR40, CF5) perhaps its future (AN18, PR57, PR61, PR62, AN45, PR55, AN27). The stressed word is inked a touch fuller.
  card: ['Nicht das Ende von MCP.', 'Bei großen Aufgaben', 'vielleicht seine Zukunft.'], stress: 'Zukunft',
};

const PI = Math.PI;
const INK = C.ink, CARD = '#f4eedd';
const WALL = '#c9b493', FLOOR = '#9c7048', DESK = '#c49d6e', PLUM = '#2e2a3c', MOON = '#efe6d2', WARM = '#ffd98a';
const ORD = ['#c99a4a', '#5d7f63', '#a8463a'];
const TERM = '#22262a', ANTH = C.anth, BRASS = C.brass;
// The office wall (a backdrop fold) and the night behind it, a little further back.
const WZ = -.104, WAL = 82, WH = 170, SZ = -.112, SAL = 83, SH = 190;
const ANG = (90 - WAL) * PI / 180;
// The desk top: its back edge (mm in front of the wall) and its two ends (mm along the wall, left negative).
const DB = 54, DL = -228, DR = 268;
// The spreadsheet on the monitor, rows from the top (mm on its 91 x 56 picture).
const SCR = { w: 91, h: 56, bar: 3.6, fx: 4, let: 3, head: 5.2, freeze: .5, row: 5.2, sum: 7.4, tabs: 3.4, X: [0, 6, 20, 47, 62, 91] };
SCR.sumY = SCR.bar + SCR.fx + SCR.let + SCR.head + SCR.freeze + 3 * SCR.row;

// ------------------------------------------------------------ the monitor's table
function rowNumber(x, n, y, h) {
  x.fillStyle = '#ebe7dc'; x.fillRect(0, y, SCR.X[1], h);
  text(x, String(n), SCR.X[1] - .9, y + h / 2 + .1, 1.8, { font: 'Jost', weight: 500, color: rgba(INK, .55), align: 'right' });
}
// Row 43: the total, bold, with the cell D43 selected (the green of the TABELLE service, never blue).
function sumRow(x, W, y) {
  const X = SCR.X, h = SCR.sum;
  x.fillStyle = '#f4ead2'; x.fillRect(X[1], y, W - X[1], h);
  rowNumber(x, 43, y, h);
  x.fillStyle = 'rgba(201,154,74,.32)'; x.fillRect(X[4], y, W - X[4], h);
  text(x, TX.sumLabel, X[2] + 1.3, y + h / 2 + .2, 4, { font: 'Jost', weight: 700, color: INK, align: 'left' });
  text(x, TX.sum, W - 1.7, y + h / 2 + .2, 4, { font: 'Jost', weight: 700, color: INK, align: 'right' });
  x.strokeStyle = '#2e5c48'; x.lineWidth = .45; x.strokeRect(X[4] + .25, y + .25, W - X[4] - .5, h - .5);
  x.fillStyle = '#2e5c48'; x.fillRect(W - 1.4, y + h - 1.4, 1.2, 1.2);
  x.fillStyle = 'rgba(43,36,32,.5)'; x.fillRect(X[1], y + h - .12, W - X[1], .12);
}
function sheet(x, W, H) {
  const X = SCR.X;
  x.fillStyle = '#fbfaf5'; x.fillRect(0, 0, W, H);
  // The window bar.
  x.fillStyle = '#e6e1d4'; x.fillRect(0, 0, W, SCR.bar);
  ['#c9675a', '#d9b24f', '#7fae74'].forEach((c, i) => { x.fillStyle = c; x.beginPath(); x.arc(2.4 + i * 2.2, SCR.bar / 2, .62, 0, TAU); x.fill(); });
  text(x, TX.winTitle, W / 2, SCR.bar / 2 + .1, 2, { font: 'Jost', weight: 500, color: rgba(INK, .78) });
  x.fillStyle = 'rgba(43,36,32,.2)'; x.fillRect(0, SCR.bar, W, .14);
  // The formula bar: which cell is selected and what it holds.
  let y = SCR.bar;
  x.fillStyle = '#f3f0e7'; x.fillRect(0, y + .14, W, SCR.fx - .14);
  x.strokeStyle = 'rgba(43,36,32,.32)'; x.lineWidth = .14; x.strokeRect(1, y + .7, 10, SCR.fx - 1.4);
  text(x, TX.cell, 6, y + SCR.fx / 2 + .1, 2.1, { font: 'Jost', weight: 500, color: INK });
  x.fillStyle = 'rgba(43,36,32,.25)'; x.fillRect(12.6, y + .8, .14, SCR.fx - 1.6);
  text(x, TX.cellValue, 14.4, y + SCR.fx / 2 + .1, 2.1, { font: 'Jost', weight: 500, color: INK, align: 'left' });
  y += SCR.fx;
  // Column letters.
  x.fillStyle = '#ebe7dc'; x.fillRect(0, y, W, SCR.let);
  TX.letters.forEach((c, i) => text(x, c, (X[i + 1] + X[i + 2]) / 2, y + SCR.let / 2 + .1, 1.8, { font: 'Jost', weight: 500, color: rgba(INK, .6) }));
  x.fillStyle = 'rgba(43,36,32,.18)'; x.fillRect(0, y + SCR.let - .12, W, .12);
  y += SCR.let;
  // Row 1: the head of the table, frozen at the top.
  x.fillStyle = '#c99a4a'; x.fillRect(X[1], y, W - X[1], SCR.head);
  rowNumber(x, 1, y, SCR.head);
  TX.cols.forEach((c, i) => text(x, c, i === 3 ? W - 1.7 : X[i + 1] + 1.3, y + SCR.head / 2 + .15, 2.5, { font: 'Jost', weight: 700, color: INK, align: i === 3 ? 'right' : 'left' }));
  y += SCR.head;
  x.fillStyle = 'rgba(43,36,32,.5)'; x.fillRect(0, y, W, SCR.freeze); y += SCR.freeze;
  // Rows 40 to 42: the last three of the 41 open invoices.
  openInvoices().slice(-3).forEach((v, i) => {
    const yy = y + i * SCR.row, m = yy + SCR.row / 2 + .15;
    if (i % 2 === 0) { x.fillStyle = 'rgba(201,154,74,.08)'; x.fillRect(X[1], yy, W - X[1], SCR.row); }
    rowNumber(x, 40 + i, yy, SCR.row);
    text(x, v.nr, X[1] + 1.3, m, 2.4, { font: 'Jost', weight: 500, color: INK, align: 'left' });
    text(x, v.kunde, X[2] + 1.3, m, 2.4, { font: 'Jost', weight: 500, color: INK, align: 'left' });
    text(x, TX.open, X[3] + 1.3, m, 2.4, { font: 'Jost', weight: 500, color: '#8a3a30', align: 'left' });
    text(x, euro(v.betrag), W - 1.7, m, 2.4, { font: 'Jost', weight: 500, color: INK, align: 'right' });
    x.fillStyle = 'rgba(43,36,32,.14)'; x.fillRect(X[1], yy + SCR.row - .1, W - X[1], .1);
  });
  y += 3 * SCR.row;
  sumRow(x, W, y);
  y += SCR.sum;
  // Empty rows below, cut by the sheet tabs.
  for (let i = 0; y + i * SCR.row < H - SCR.tabs; i++) { const yy = y + i * SCR.row; rowNumber(x, 44 + i, yy, Math.min(SCR.row, H - SCR.tabs - yy)); x.fillStyle = 'rgba(43,36,32,.12)'; x.fillRect(X[1], yy + SCR.row - .1, W - X[1], .1); }
  // Column lines through the table.
  for (const cx of X.slice(1, 5)) { x.fillStyle = 'rgba(43,36,32,.16)'; x.fillRect(cx - .05, SCR.bar + SCR.fx, .1, H - SCR.bar - SCR.fx - SCR.tabs); }
  // The sheet tab.
  x.fillStyle = '#e6e1d4'; x.fillRect(0, H - SCR.tabs, W, SCR.tabs);
  x.fillStyle = '#fbfaf5'; x.fillRect(7, H - SCR.tabs, 15, SCR.tabs - .5);
  x.fillStyle = '#2e5c48'; x.fillRect(7, H - .9, 15, .4);
  text(x, TX.tab, 14.5, H - SCR.tabs / 2 - .1, 1.8, { font: 'Jost', weight: 500, color: rgba(INK, .8) });
}

// ------------------------------------------------------------ the laptop's terminal
function terminal(x, W, H) {
  x.fillStyle = TERM; x.fillRect(0, 0, W, H);
  x.fillStyle = '#30353a'; x.fillRect(0, 0, W, 3.4);
  ['#c9675a', '#d9b24f', '#7fae74'].forEach((c, i) => { x.fillStyle = rgba(c, .85); x.beginPath(); x.arc(2.3 + i * 2.1, 1.7, .58, 0, TAU); x.fill(); });
  text(x, TX.term, W / 2, 1.8, 1.8, { font: 'Jost', weight: 500, color: rgba(C.cream, .7) });
  // The command, wrapped where the window ends.
  mono(x, ['$ ' + TX.cmd[0], '  ' + TX.cmd[1], '  ' + TX.cmd[2]], 3, 9, 2.3, { color: C.cream, bold: /(\$)/, boldColor: '#8f9a96', lead: 1.45 });
}
// What the program prints once it runs: the status line, set large, and the input line under it.
function statusLine(x, W) {
  layer(x, C.cream, rrect(0, 0, W, 12.8, 1.2), { lift: 0, tooth: false });
  mono(x, [TX.status[0]], 2.4, 5.5, 3, { color: INK, bold: /(Code Mode)/, boldColor: C.cobalt });
  mono(x, [TX.status[1]], 2.4, 5.5 + 3 * 1.42, 3, { color: INK });
  x.strokeStyle = '#8d918e'; x.lineWidth = .3; x.beginPath(); rrect(.3, 15.8, W - .6, 7.6, 1.2)(x); x.stroke();
  mono(x, ['>'], 2.4, 20.6, 2.3, { color: '#d8d4c8' });
  x.fillStyle = C.cream; x.fillRect(5.4, 18, 1.4, 3.2);
}

// ------------------------------------------------------------ the booklet
// The open page: the section of the MCP documentation that recommends the pattern. Body text is only grey lines.
function bookletPage(x) {
  layer(x, '#f6f0e1', rect(1, 0, 50, 70), { lift: .3 });
  // The page edges of the thin block, seen from the front.
  layer(x, '#e7decb', rect(1, 70, 50, 1.3), { lift: 0 });
  x.fillStyle = 'rgba(80,64,44,.35)'; for (let k = 0; k < 4; k++) x.fillRect(1, 70.2 + k * .3, 50, .07);
  // The staples of the spine show through as two short marks.
  for (const sx of [14, 38]) { x.fillStyle = 'rgba(90,92,94,.7)'; x.fillRect(sx - .2, .6, .4, 1.6); }
  // Running head.
  text(x, TX.coverSub.toUpperCase(), 5, 5, 1.35, { font: 'Jost', weight: 700, color: rgba(INK, .55), align: 'left', track: .16 });
  x.fillStyle = rgba(INK, .3); x.fillRect(5, 6.6, 42, .12);
  // The heading, then its other name.
  text(x, TX.pageHead[0], 5, 12.6, 4.4, { weight: 900, color: INK, align: 'left' });
  text(x, TX.pageHead[1], 5, 18, 4.4, { weight: 900, color: INK, align: 'left' });
  x.fillStyle = rgba(INK, .55); x.fillRect(5, 21.6, 9, .3);
  text(x, TX.pageSub, 5, 25.6, 3.7, { weight: 600, color: INK, align: 'left' });
  // Body text as lines, a code block as a grey box with indented lines, more body text.
  const bar = (y, w) => { x.fillStyle = rgba(INK, .3); x.fillRect(5, y, w, .5); };
  [40, 42, 36, 41, 22].forEach((w, i) => bar(30 + i * 2.1, w));
  layer(x, '#e8e0cc', rrect(5, 41.4, 40, 12.4, .6), { lift: 0 });
  [[0, 20], [2, 24], [4, 17], [4, 22], [2, 12], [0, 6]].forEach(([d, w], i) => { x.fillStyle = rgba(INK, .42); x.fillRect(7 + d * .9, 43.3 + i * 1.75, w * .9, .45); });
  [41, 38, 42, 30, 40, 26].forEach((w, i) => bar(56.6 + i * 2.1, w));
  // The cobalt bookmark: from the spine over the page and out at the foot.
  layer(x, C.cobalt, poly([[44.2, 0], [47.4, 0], [47.4, 81], [45.8, 79.2], [44.2, 81]]), { lift: .2 });
  x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(44.5, 0, .35, 79);
}
// The cover: cream board printed in ink, stapled at the top.
function bookletCover(x, W, H) {
  layer(x, '#ece2cb', rrect(0, 0, W, H, .8), { lift: .35 });
  inside(x, rrect(0, 0, W, H, .8), wash(0, 0, W, H, 'rgba(255,255,255,.08)', 'rgba(110,80,40,.1)'));
  // The scored hinge under the spine: a lit ridge and its shadow, so the cover reads as one that opens there.
  x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(.6, 2.4, W - 1.2, .18); x.fillStyle = 'rgba(90,66,36,.22)'; x.fillRect(.6, 2.6, W - 1.2, .16);
  // Two wire staples, steel: a bright crown, a dark slot where each enters the board.
  for (const sx of [13, 37]) { layer(x, '#b3b5b1', rect(sx - 2, .9, 4, .5), { lift: .1, tooth: false }); x.fillStyle = 'rgba(255,255,250,.75)'; x.fillRect(sx - 1.8, .95, 3.6, .14); x.fillStyle = 'rgba(40,36,30,.5)'; for (const ex of [sx - 2.1, sx + 1.9]) x.fillRect(ex, .85, .2, .6); }
  // The free corners are a little worn and toned from handling.
  inside(x, rrect(0, 0, W, H, .8), () => { for (const cx of [0, W]) { const g = x.createRadialGradient(cx, H, 0, cx, H, 7); g.addColorStop(0, 'rgba(110,80,40,.18)'); g.addColorStop(1, 'rgba(110,80,40,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); } });
  x.strokeStyle = rgba(INK, .6); x.lineWidth = .3; x.strokeRect(3, 4, W - 6, H - 7);
  x.strokeStyle = rgba(INK, .3); x.lineWidth = .14; x.strokeRect(3.8, 4.8, W - 7.6, H - 8.6);
  text(x, TX.coverTitle[0], W / 2, 24, 4.6, { weight: 900, color: INK });
  text(x, TX.coverTitle[1], W / 2, 30.2, 4.6, { weight: 900, color: INK });
  x.fillStyle = rgba(INK, .6); x.fillRect(W / 2 - 6, 34.4, 12, .3);
  text(x, TX.coverSub, W / 2, 38.8, 2.6, { weight: 600, color: INK });
  // An ornament at the foot: two rules and a lozenge.
  x.fillStyle = rgba(INK, .55); x.fillRect(W / 2 - 9, 58.5, 6.5, .2); x.fillRect(W / 2 + 2.5, 58.5, 6.5, .2);
  x.beginPath(); x.moveTo(W / 2, 57.4); x.lineTo(W / 2 + 1.2, 58.6); x.lineTo(W / 2, 59.8); x.lineTo(W / 2 - 1.2, 58.6); x.closePath(); x.fill();
}

// ------------------------------------------------------------ things of the office
// A lever-arch file seen from its spine: label pocket and finger hole. lean < 0: it leans left on its foot's left corner.
function ordner(x, a, base, w, h, c, seed, lean = 0) {
  x.save(); x.translate(a, base); x.rotate(lean);
  const cc = tone(c, (rnd(seed, 1) - .5) * .16);
  layer(x, cc, rrect(0, -h, w, h, .35), { lift: .25, sh: .3 });
  x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(.22, -h + .3, .3, h - .6);
  x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(w - .45, -h + .3, .3, h - .6);
  const lw = w * .66, lh = h * .3, lx = (w - lw) / 2, ly = -h + h * .13;
  x.fillStyle = '#efe9da'; x.fillRect(lx, ly, lw, lh);
  x.fillStyle = rgba(INK, .5); for (let k = 0; k < 2; k++) x.fillRect(lx + lw * .2, ly + lh * (.32 + k * .32), lw * (.6 - .25 * rnd(seed, k + 3)), .2);
  const hy = -h * .2, r = Math.min(w * .27, 1.1);
  x.fillStyle = tone(cc, -.35); x.beginPath(); x.arc(w / 2, hy, r, 0, TAU); x.fill();
  x.fillStyle = '#1d1915'; x.beginPath(); x.arc(w / 2, hy, r * .6, 0, TAU); x.fill();
  x.restore();
}
function book(x, a, base, w, h, c, seed) {
  layer(x, c, rect(a, base - h, w, h), { lift: .2, sh: .3 });
  x.fillStyle = 'rgba(255,240,210,.35)'; x.fillRect(a, base - h * (.72 + rnd(seed, 2) * .1), w, h * .07);
  x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(a + w - .3, base - h, .3, h);
}
// A pothos leaf: heart-shaped, with its midrib.
function leaf(x, bx, by, len, ang, c) {
  x.save(); x.translate(bx, by); x.rotate(ang);
  layer(x, c, c2 => { c2.moveTo(0, 0); c2.bezierCurveTo(len * .1, -len * .58, len * .74, -len * .36, len, 0); c2.bezierCurveTo(len * .74, len * .36, len * .1, len * .58, 0, 0); c2.closePath(); }, { lift: .25, sh: .3 });
  stroke(x, [[len * .05, 0], [len * .5, -len * .02], [len * .92, 0]], rgba(tone(c, .35), .7), .14, { smooth: true });
  x.restore();
}

// ------------------------------------------------------------ the office chair, seen from behind, a jacket over its back
function officeChair(x, W, H) {
  const cx = 27, hubY = 92.8, CH = '#2b2c2f', CH2 = '#3b3c40', J = '#5f4a38';
  // The five-star base, seen from above and behind; the chair is turned a little, so the star is too.
  const legs = [0, 1, 2, 3, 4].map(i => { const a = PI / 2 + .3 + i * TAU / 5; return [cx + Math.cos(a) * 22, hubY + Math.sin(a) * 7.4]; });
  const leg = ([lx, ly]) => {
    layer(x, CH, poly([[cx - 2.2, hubY - .8], [cx + 2.2, hubY + .8], [lx + .9, ly + .6], [lx - .9, ly - .6]]), { lift: .25 });
    layer(x, '#151617', ellipse(lx, ly + 2.4, 2.1, 1.7), { lift: .2, tooth: false });
    x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(lx - 1.2, ly + 1.6, 1.4, .3);
  };
  legs.filter(p => p[1] < hubY).forEach(leg);
  // The gas spring: chrome, with a black sleeve.
  layer(x, '#a9aeb0', rect(cx - 1.3, 62, 2.6, hubY - 62), { lift: .25 });
  x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(cx - .8, 62, .35, hubY - 76);
  layer(x, '#1c1d1f', rrect(cx - 2.2, 76, 4.4, hubY - 76, .6), { lift: .2 });
  layer(x, '#202123', ellipse(cx, hubY, 3.4, 1.6), { lift: .2 });
  legs.filter(p => p[1] >= hubY).forEach(leg);
  // Under the seat, the mechanism and its lever.
  layer(x, '#1e1f21', rrect(cx - 8, 57.5, 16, 5, 1), { lift: .25 });
  stroke(x, [[cx + 7, 60], [cx + 12, 62.5]], '#1e1f21', .7, { lift: .15 });
  // The seat: its upholstered top seen from above, its back edge below.
  layer(x, '#2a2b2e', rrect(cx - 20.5, 51.5, 41, 8, 3.8), { lift: .35 });
  layer(x, CH2, rrect(cx - 20, 50, 40, 5.4, 3.6), { lift: 0 });
  x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(cx - 17, 50.6, 34, .4);
  // Armrests: a post and a pad on each side.
  for (const sd of [-1, 1]) {
    const px = cx + sd * 17.6;
    layer(x, '#202123', rect(px - 1.1, 41.5, 2.2, 12), { lift: .25 });
    layer(x, '#18191b', rrect(px - 3.4 + sd, 39.6, 6.8, 2.6, 1.2), { lift: .3 });
  }
  // The spine bar from the seat up to the back.
  layer(x, '#1c1d1f', rrect(cx - 1.8, 38, 3.6, 16, 1), { lift: .3 });
  // The backrest shell, a little waisted.
  const back = c2 => { c2.moveTo(cx - 16, 8); c2.quadraticCurveTo(cx - 16.5, 3, cx - 11, 2.6); c2.lineTo(cx + 11, 2.6); c2.quadraticCurveTo(cx + 16.5, 3, cx + 16, 8); c2.quadraticCurveTo(cx + 14.2, 24, cx + 15, 36); c2.quadraticCurveTo(cx + 15, 42, cx + 9, 42.4); c2.lineTo(cx - 9, 42.4); c2.quadraticCurveTo(cx - 15, 42, cx - 15, 36); c2.quadraticCurveTo(cx - 14.2, 24, cx - 16, 8); c2.closePath(); };
  layer(x, '#26272a', back, { lift: .45 });
  inside(x, back, wash(cx - 16, 0, cx + 16, 0, 'rgba(255,255,255,.07)', 'rgba(0,0,0,.12)'));
  layer(x, '#3a3b3f', circle(cx, 38.6, 1.5), { lift: .15, tooth: false });
  // The jacket, hung by its collar over the backrest: the shoulders drape over its corners, the back hangs down past
  // the backrest's lower edge to just above the seat. Seen from behind: collar, centre seam, a vent, one sleeve.
  const jk = c2 => {
    c2.moveTo(cx - 20, 13); c2.quadraticCurveTo(cx - 19.8, 4, cx - 12.6, 2.2); c2.quadraticCurveTo(cx, .8, cx + 12.6, 2.2); c2.quadraticCurveTo(cx + 19.8, 4, cx + 20, 13);
    c2.quadraticCurveTo(cx + 17.2, 30, cx + 16.4, 46); c2.quadraticCurveTo(cx + 8, 47.6, cx + .4, 46.8); c2.quadraticCurveTo(cx - 8, 47.8, cx - 16.4, 45.6); c2.quadraticCurveTo(cx - 17.2, 30, cx - 20, 13); c2.closePath();
  };
  // Tweed with a windowpane check: what tells a jacket from upholstery even at a distance. The lines sag a little with the drape.
  const check = (a, b, k) => {
    x.lineWidth = .3;
    for (let i = 0, cxx = a; cxx < b; cxx += 4.4, i++) { x.strokeStyle = i % 3 === 1 ? 'rgba(160,78,56,.45)' : 'rgba(196,160,112,.32)'; x.beginPath(); x.moveTo(cxx, 0); x.quadraticCurveTo(cxx + (cxx - cx) * .04 * k, 26, cxx + (cxx - cx) * .02 * k, 54); x.stroke(); }
    for (let i = 0, y = 2.6; y < 54; y += 4.4, i++) { x.strokeStyle = i % 3 === 2 ? 'rgba(160,78,56,.42)' : 'rgba(196,160,112,.3)'; x.beginPath(); x.moveTo(a, y); x.quadraticCurveTo((a + b) / 2, y + 1.1 * k, b, y); x.stroke(); }
  };
  layer(x, J, jk, { lift: .5 });
  inside(x, jk, () => {
    check(cx - 22, cx + 22, 1);
    const g = x.createLinearGradient(cx - 20, 0, cx + 20, 0); g.addColorStop(0, 'rgba(255,235,200,.16)'); g.addColorStop(.45, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(30,18,8,.28)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    // The tops of the shoulders face up and catch the lamp; below the backrest's edge the cloth hangs free and darker.
    x.fillStyle = 'rgba(255,235,200,.12)'; x.fillRect(0, 0, W, 6);
    { const d = x.createLinearGradient(0, 42, 0, 48); d.addColorStop(0, 'rgba(30,18,8,.3)'); d.addColorStop(.25, 'rgba(30,18,8,.12)'); d.addColorStop(1, 'rgba(30,18,8,.18)'); x.fillStyle = d; x.fillRect(0, 42, W, 6); }
    // Wool: a fine twill and a few flecks.
    x.strokeStyle = 'rgba(40,26,12,.12)'; x.lineWidth = .12; for (let d = -50; d < 60; d += .8) { x.beginPath(); x.moveTo(d, 0); x.lineTo(d + 48, 48); x.stroke(); }
    for (let i = 0; i < 160; i++) { x.fillStyle = rnd(191, i) > .5 ? 'rgba(220,200,170,.16)' : 'rgba(30,20,10,.18)'; x.fillRect(cx - 20 + rnd(192, i) * 40, 1 + rnd(193, i) * 46, .35, .2); }
  });
  // Where the cloth bends round the backrest's lower edge.
  stroke(x, [[cx - 14.6, 42.2], [cx - 5, 42.8], [cx + 5, 42.7], [cx + 14.6, 42.1]], rgba(tone(J, -.5), .5), .3, { smooth: true });
  // Drape: folds run from the shoulder corners towards the middle, then hang straight.
  for (const pts of [[[cx - 17.4, 7], [cx - 13, 18], [cx - 10.6, 30], [cx - 10.8, 41.6]], [[cx - 18.4, 15], [cx - 16.6, 28], [cx - 15.4, 41]], [[cx + 17.6, 7.4], [cx + 13.4, 17], [cx + 11.4, 29], [cx + 11.8, 41.4]], [[cx + 18.2, 16], [cx + 16.4, 30], [cx + 15.2, 44.6]], [[cx - 4, 12], [cx - 5, 26], [cx - 4.4, 40]]]) stroke(x, pts, rgba(tone(J, -.5), .34), .32, { smooth: true });
  for (const pts of [[[cx - 16.6, 7.6], [cx - 12.4, 18.2], [cx - 10, 30.2]], [[cx + 18.2, 7.8], [cx + 14, 17.4], [cx + 12, 29.2]]]) stroke(x, pts, 'rgba(255,235,205,.16)', .26, { smooth: true });
  // The collar, turned down, and the shoulder seams; the centre seam and the vent.
  layer(x, tone(J, -.16), c2 => { c2.moveTo(cx - 10.4, 1.8); c2.quadraticCurveTo(cx, .5, cx + 10.4, 1.8); c2.lineTo(cx + 9.4, 5.8); c2.quadraticCurveTo(cx, 4.8, cx - 9.4, 5.8); c2.closePath(); }, { lift: .25 });
  stroke(x, [[cx - 9.4, 5.9], [cx, 4.9], [cx + 9.4, 5.9]], rgba(tone(J, -.6), .55), .2, { smooth: true });
  for (const sd of [-1, 1]) stroke(x, [[cx + sd * 10.4, 2.2], [cx + sd * 15.4, 3.4], [cx + sd * 19.2, 6.6]], rgba(tone(J, -.5), .45), .2, { smooth: true });
  stroke(x, [[cx + .2, 5.4], [cx + .3, 46.8]], rgba(tone(J, -.55), .55), .22);
  layer(x, tone(J, -.08), poly([[cx + .3, 37.4], [cx + 1.5, 37.4], [cx + 1.5, 47.1], [cx + .4, 46.8]]), { lift: .2 });
  stroke(x, [[cx + .3, 37.4], [cx + .4, 46.9]], rgba(tone(J, -.65), .8), .3);
  stroke(x, [[cx - 18.6, 45.4], [cx - 9, 47.2], [cx + .4, 46.4], [cx + 9, 47], [cx + 18.4, 45.6]], rgba(tone(J, -.4), .5), .22, { smooth: true });
  // Both sleeves hang from the shoulders outside the armrests, the right one a little forward; the lining shows at the cuffs.
  for (const sd of [-1, 1]) {
    const f = sd > 0 ? 1 : .96, X = v => cx + sd * v;
    const sl = c2 => { c2.moveTo(X(16.8), 5.4); c2.quadraticCurveTo(X(22.4), 6.2, X(23.2), 13.6); c2.lineTo(X(24.6), 50.6 * f); c2.lineTo(X(19), 51.2 * f); c2.lineTo(X(18.4), 16); c2.closePath(); };
    layer(x, tone(J, sd > 0 ? -.02 : -.1), sl, { lift: .55 });
    inside(x, sl, () => {
      check(Math.min(X(14), X(27)), Math.max(X(14), X(27)), .3);
      wash(X(17), 0, X(25), 0, 'rgba(255,235,200,.14)', 'rgba(30,18,8,.32)')(x);
      x.strokeStyle = 'rgba(40,26,12,.13)'; x.lineWidth = .12; for (let d = -10; d < 60; d += .8) { x.beginPath(); x.moveTo(X(14) + d * .2, d); x.lineTo(X(27) + d * .2, d + 12); x.stroke(); }
    });
    // Between sleeve and body a deep fold of shadow.
    stroke(x, [[X(18.5), 14], [X(18.9), 32], [X(19.2), 50 * f]], 'rgba(20,12,6,.55)', .45);
    // The sleeve seam, the elbow crease, the cuff turned back to its lining.
    stroke(x, [[X(18.7), 17], [X(19.2), 34], [X(19.4), 49 * f]], rgba(tone(J, -.6), .5), .2);
    stroke(x, [[X(19.6), 27], [X(22), 30.4], [X(20.4), 34]], rgba(tone(J, -.55), .45), .3, { smooth: true });
    layer(x, tone(J, -.22), poly([[X(18.9), 48 * f], [X(24.4), 47.6 * f], [X(24.6), 50.6 * f], [X(19), 51.2 * f]]), { lift: .1 });
    layer(x, '#6e2f2f', ellipse(X(21.8), 51 * f, 2.6, .5, -.1 * sd), { lift: 0, tooth: false });
  }
}

// ------------------------------------------------------------ the desk lamp, an arm lamp seen from the front
// Points on the lamp's sheet (mm): base joint, elbow, head joint, the centre of the shade's opening.
const LAMP = { base: [14, 88], elbow: [30, 27], head: [50, 40], open: [58, 60], rx: 8.6, ry: 3.4, ax: .348, ay: .937 };
// The open end of the shade: its warm inside and the bulb. glowOnly: drawn again on a sheet of its own that glows.
function lampOpening(x, glowOnly) {
  const [ox, oy] = LAMP.open, rot = Math.atan2(LAMP.ay, LAMP.ax) - PI / 2;
  if (!glowOnly) layer(x, '#c9a86a', ellipse(ox, oy, LAMP.rx + .5, LAMP.ry + .45, rot), { lift: 0, tooth: false });
  layer(x, '#f6e6c2', ellipse(ox, oy, LAMP.rx, LAMP.ry, rot), { lift: 0 });
  inside(x, ellipse(ox, oy, LAMP.rx, LAMP.ry, rot), () => {
    const g = x.createRadialGradient(ox + 1, oy + .4, .5, ox, oy, LAMP.rx); g.addColorStop(0, 'rgba(255,253,240,1)'); g.addColorStop(.4, 'rgba(255,240,205,.8)'); g.addColorStop(1, 'rgba(190,150,90,.6)'); x.fillStyle = g; x.fillRect(ox - 10, oy - 10, 20, 20);
  });
  layer(x, '#fffbef', ellipse(ox + .6, oy - .2, 3.2, 1.6, rot), { lift: 0, tooth: false });
}
function deskLamp(x) {
  const BLK = '#272523', ROD = '#2e2b29';
  // The heavy round base: its edge and its top face.
  layer(x, '#1c1b1a', rrect(3, 90.6, 22, 7.4, 3.2), { lift: .5 });
  layer(x, '#3b3835', ellipse(14, 91.6, 10.6, 2.2), { lift: 0 });
  x.fillStyle = 'rgba(255,240,220,.16)'; x.fillRect(6, 90.6, 9, .3);
  // The bracket on the base.
  layer(x, BLK, rrect(12, 84.6, 4.4, 6.6, .6), { lift: .3 });
  // Two arms of twin rods, each with its spring; brass joints.
  const arm = (p, q, gap, w) => { const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy), nx = -dy / l * gap, ny = dx / l * gap; for (const s of [-1, 1]) stroke(x, [[p[0] + nx * s, p[1] + ny * s], [q[0] + nx * s, q[1] + ny * s]], ROD, w, { lift: .3 }); };
  const spring = (p, q, off, n) => { const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l, pts = []; for (let i = 0; i <= n * 2; i++) { const t = i / (n * 2), s = (i % 2 ? 1 : -1) * .7; pts.push([p[0] + dx * t + nx * (off + s), p[1] + dy * t + ny * (off + s)]); } stroke(x, pts, '#8d877f', .26, { lift: .2 }); };
  const [b, e, h] = [LAMP.base, LAMP.elbow, LAMP.head];
  const at = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  arm(b, e, .85, .7);
  spring(at(b, e, .28), at(b, e, .72), 2.6, 14);
  arm(e, h, .7, .6);
  spring(at(e, h, .2), at(e, h, .55), -2, 7);
  // The cable runs from the head along the arms to the base, sagging between the joints.
  stroke(x, [[h[0] - 1, h[1] + 1.4], [(h[0] + e[0]) / 2 - 1, (h[1] + e[1]) / 2 + 4], [e[0] + .4, e[1] + 2.6], [(e[0] + b[0]) / 2 - 3, (e[1] + b[1]) / 2 + 2], [b[0] - 2.6, b[1] + 1], [b[0] - 4.2, b[1] + 3.4]], '#191817', .5, { smooth: true, lift: .15 });
  for (const [p, r] of [[b, 1.5], [e, 2.2], [h, 1.6]]) { layer(x, BRASS, circle(p[0], p[1], r), { lift: .3, tooth: false }); layer(x, tone(BRASS, -.45), circle(p[0], p[1], r * .38), { lift: 0, tooth: false }); x.fillStyle = 'rgba(255,245,215,.6)'; x.fillRect(p[0] - r * .6, p[1] - r * .7, r * .5, r * .22); }
  // The shade: a cone from the head joint, its open end turned down and towards us.
  const [ox, oy] = LAMP.open, ax = LAMP.ax, ay = LAMP.ay, px = -ay, py = ax, n0 = [h[0] + 1.4 * ax, h[1] + 1.4 * ay], rot = Math.atan2(py, px);
  const shade = c2 => {
    c2.moveTo(n0[0] + px * 3.2, n0[1] + py * 3.2);
    c2.quadraticCurveTo(n0[0] - ax * 2.6, n0[1] - ay * 2.6, n0[0] - px * 3.2, n0[1] - py * 3.2);
    c2.lineTo(ox - px * LAMP.rx, oy - py * LAMP.rx);
    c2.ellipse(ox, oy, LAMP.rx, LAMP.ry, rot, PI, 0, true);
    c2.closePath();
  };
  layer(x, '#262422', shade, { lift: .55 });
  inside(x, shade, () => { const g = x.createLinearGradient(ox + px * 9, oy + py * 9, ox - px * 9, oy - py * 9); g.addColorStop(0, 'rgba(255,240,215,.2)'); g.addColorStop(.35, 'rgba(255,240,215,0)'); g.addColorStop(1, 'rgba(0,0,0,.25)'); x.fillStyle = g; x.fillRect(30, 30, 40, 40); });
  // The switch on its back.
  layer(x, '#1a1918', rrect(n0[0] - 1.8, n0[1] - 4.4, 2.2, 2.2, .4), { lift: .2, tooth: false });
  lampOpening(x, false);
}

// ------------------------------------------------------------ the spread
export function kommt(s, T) {
  const S = new Spread(s);
  S.plan = 47;
  // Named moments, seconds after landing (beats.md, Doppelseite 7, plus .3 s: the voice starts a moment after the
  // leaf lands); the voice resets them to its words, and S.plan to the real time the spread lies open (world.js).
  // tabelle: the monitor lights, the total glows; cloudflare, anthropic, andere: an index card stands on each;
  // claude: the laptop lights, the status line appears; mcp: the booklet's cover lifts (the index cards have just lain
  // down); botschaft, gross, zukunft: the three lines of the message card, each on its word. The card itself stands up
  // shortly before botschaft, blank, while the camera comes to it; after zukunft it stands still until the leaf turns.
  S.t = { tabelle: .6, cloudflare: 4.4, anthropic: 8, claude: 13.8, andere: 21.4, mcp: 28, botschaft: 35.6, gross: 38, zukunft: 40.4 };
  // Wide at night -> the monitor and its total -> the index cards (from "Den Namen") -> the laptop and the status line
  // -> back to the three index cards (from "Einige") -> the booklet (from "Dokumentation") -> the message card, frontal
  // and filling the frame (from "Code Mode ist also"), held until the leaf turns. Every key hangs on a moment.
  S.cam = t => {
    const WIDE = [[0, .40, .64], [0, .055, -.03], .5, .0026];
    const MON = [[-.093, .168, .314], [-.137, .052, -.002], .36, .003], MON2 = [[-.089, .163, .31], [-.135, .051, -.002], .36, .003];
    // The first two index cards stand left of the gutter: the camera faces them a little from the right, as the left page turns them.
    const PASS = [[-.046, .15, .31], [-.062, .02, .06], .32, .003], PASS2 = [[-.04, .148, .306], [-.056, .02, .058], .32, .003];
    const LAP = [[.078, .153, .30], [.122, .037, -.016], .36, .003], LAP2 = [[.074, .149, .297], [.121, .036, -.016], .36, .003];
    // All three index cards, either side of the gutter, low in the frame: the page's front edge stays out of it, the
    // mug, the lamp and the booklet stand behind them.
    const TRIO = [[0, .165, .335], [-.014, .042, .074], .42, .003], TRIO2 = [[.004, .163, .331], [-.011, .042, .072], .42, .003];
    const HEFT = [[.012, .288, .238], [.042, .028, .022], .38, .003], HEFT2 = [[.014, .282, .234], [.043, .028, .021], .38, .003];
    // Square on to the message card. The right page leans it a little; seen from a touch left of square, its far end
    // rises towards the horizon and the lines read level.
    const CARDV = [[.129, .11, .286], [.157, .034, .05], .34, .003];
    const keys = [
      [-1.7, [0, .52, .68], [0, .03, -.02], .52, .0024],
      [t.tabelle - .5, ...WIDE],
      [t.tabelle + 1.1, ...MON],
      [t.cloudflare - 1.8, ...MON2],        // "Den Namen"
      [t.cloudflare + .5, ...PASS],
      [t.claude - 1, ...PASS2],             // "Funktion an"
      [t.claude + 1, ...LAP],
      [t.andere - 1.5, ...LAP2],            // the end of "einschalten", just before "Einige"
      [t.andere + .1, ...TRIO],
      [t.mcp - 1.4, ...TRIO2],              // "Die Dokumentation"
      [t.mcp - .1, ...HEFT],
      [t.botschaft - 1.8, ...HEFT2],        // "Code Mode ist also"
      [t.botschaft - .15, ...CARDV],
      [S.plan - .05, ...CARDV],              // still until the leaf turns
    ];
    for (let i = 1; i < keys.length; i++) keys[i][0] = Math.max(keys[i][0], keys[i - 1][0] + .5);
    return keys;
  };

  // The room's own frame on a page: s along the wall in mm (negative left of the gutter), b in mm in front of it.
  // Every stand stands in this frame (u = s / 1000, off = b / 1000), so the print under it lines up.
  const spot = (side, s, b) => S.spot('buero', side, s / 1000, b / 1000);
  const room = (x, side, fn) => { const o = spot(side, 0, 0); x.save(); x.translate(o[0], o[1]); x.rotate(side === 'L' ? -ANG : ANG); fn(x); x.restore(); };
  // A flat whose w x h mm canvas lies centred on the room point (s, b), turned with the wall.
  const flatAt = (name, side, s, b, w, h, o) => { const p = spot(side, s, b), life = o.life; return S.flat(name, { side, ...o, x: p[0] - w / 2, y: p[1] - h / 2, w: w / 1000, h: h / 1000, life: (t, it) => ({ rot: side === 'L' ? ANG : -ANG, ...(life ? life(t, it) : {}) }) }); };
  const stand = (name, side, s, b, w, h, o) => S.stand(name, { host: 'buero', side, u: s / 1000, off: b / 1000, w: w / 1000, h: h / 1000, ...o });
  const dim = t => 1 - .72 * ease((t - S.t.botschaft - .2) / 1.4);

  // ------------------------------------------------------------ the pages: floorboards, the desk top and what lies on it
  const floorboards = (x, side) => {
    const L = side === 'L', s0 = L ? -330 : -30, s1 = L ? 30 : 330, BW = 9.6, sd = L ? 11 : 37;
    x.fillStyle = '#5a3e26'; x.fillRect(s0, -3, s1 - s0, 300);
    for (let j = 0; j < 31; j++) {
      const b0 = -3 + j * BW; let a = s0 - rnd(sd + j, 1) * 130, i = 0;
      while (a < s1) {
        const len = 80 + rnd(sd + j, i + 7) * 130, k = rnd(sd + 3 + j, i);
        x.fillStyle = tone(FLOOR, (k - .5) * .2 + (rnd(sd + 5, j * 17 + i) - .5) * .05); x.fillRect(a + .15, b0 + .15, len - .3, BW - .3);
        x.strokeStyle = 'rgba(52,32,16,.17)'; x.lineWidth = .16;
        for (let g = 0; g < 4; g++) { const gy = b0 + 1.4 + g * 2.2 + rnd(sd + j, i * 9 + g) * .8; x.beginPath(); x.moveTo(a + .5, gy); for (let p = 1; p <= 12; p++) x.lineTo(a + .5 + p * (len - 1) / 12, gy + Math.sin(p * 1.1 + k * 9 + g) * .32); x.stroke(); }
        if (k > .84) { const kx = a + len * (.3 + rnd(sd, i + j) * .4), ky = b0 + BW / 2; x.fillStyle = 'rgba(60,36,18,.32)'; x.beginPath(); x.ellipse(kx, ky, 1.6, .8, 0, 0, TAU); x.fill(); x.strokeStyle = 'rgba(60,36,18,.2)'; x.beginPath(); x.ellipse(kx, ky, 3, 1.5, 0, 0, TAU); x.stroke(); }
        x.fillStyle = 'rgba(30,20,12,.5)'; for (const nx of [a + 1.6, a + len - 1.6]) for (const ny of [b0 + 2.4, b0 + BW - 2.4]) { x.beginPath(); x.arc(nx, ny, .2, 0, TAU); x.fill(); }
        a += len; i++;
      }
    }
    // Where the floor meets the wall's skirting.
    x.fillStyle = 'rgba(40,26,14,.35)'; x.fillRect(s0, -3, s1 - s0, 3.4);
  };
  const deskTop = (x, side) => {
    const L = side === 'L', a0 = L ? DL : -20, a1 = L ? 20 : DR, top = rect(a0, DB, a1 - a0, 260);
    layer(x, DESK, top, { lift: .5, sh: .4, shade: () => {
      // Veneer leaves, each its own shade, with long grain and the odd cathedral figure.
      for (let v = 0; v < 5; v++) {
        const b0 = DB + v * 46, k = rnd(L ? 81 : 83, v);
        x.fillStyle = tone(DESK, (k - .5) * .1); x.fillRect(a0, b0, a1 - a0, 46);
        x.fillStyle = 'rgba(90,60,30,.18)'; x.fillRect(a0, b0, a1 - a0, .12);
        x.lineWidth = .14;
        for (let g = 0; g < 44; g++) {
          const gy = b0 + 1 + g * 1.02 + rnd(91 + v, g) * .5, ph = rnd(93 + v, g) * 6;
          x.strokeStyle = `rgba(110,70,34,${.07 + rnd(95 + v, g) * .12})`; x.beginPath(); x.moveTo(a0, gy);
          for (let p = 1; p <= 40; p++) { const px = a0 + p * (a1 - a0) / 40; x.lineTo(px, gy + Math.sin(px * .018 + ph) * 1.1 + Math.sin(px * .061 + ph * 2) * .3); }
          x.stroke();
        }
        for (let q = 0; q < 2; q++) {
          const cx = a0 + (a1 - a0) * (.2 + rnd(97 + v, q) * .6), cy = b0 + 23;
          x.strokeStyle = 'rgba(110,68,30,.14)'; x.lineWidth = .2;
          for (let r = 0; r < 5; r++) { x.beginPath(); x.ellipse(cx, cy + r * 2.2, 26 + r * 9, 3.4 + r * 1.6, 0, PI * 1.05, PI * 1.95); x.stroke(); }
        }
      }
      for (let i = 0; i < 900; i++) { x.fillStyle = 'rgba(80,50,24,.12)'; x.fillRect(a0 + rnd(L ? 99 : 101, i) * (a1 - a0), DB + rnd(103, i) * 190, .5 + rnd(105, i), .12); }
    } });
    // The rounded edge catches the light; just outside it, the shade of its underside.
    x.fillStyle = 'rgba(255,240,215,.45)'; x.fillRect(a0, DB, a1 - a0, .5);
    x.fillStyle = 'rgba(40,24,10,.5)'; x.fillRect(a0, DB - .45, a1 - a0, .45);
    const ex = L ? DL : DR;
    x.fillStyle = 'rgba(255,240,215,.4)'; x.fillRect(L ? ex : ex - .5, DB, .5, 260);
    x.fillStyle = 'rgba(40,24,10,.5)'; x.fillRect(L ? ex - .45 : ex, DB, .45, 260);
  };
  // Cables on desk and floor, each from its device to the socket on the wall.
  const cable = (x, pts, w = .85) => { stroke(x, pts, '#1e1d1c', w, { smooth: true, lift: .2 }); stroke(x, pts.map(p => [p[0] - .15, p[1] - .2]), 'rgba(255,255,255,.12)', .2, { smooth: true }); };
  // Where something stands, the ground is a little darker: the light cannot get under it.
  const foot = (x, a0, a1, b, k = 1) => { for (const [d, al] of [[2.8, .05], [1.5, .08], [.6, .12]]) { x.fillStyle = `rgba(36,24,14,${al * k})`; x.fillRect(a0, b - d * .35, a1 - a0, d * 1.35); } };
  const deskThingsL = x => {
    // The desk pad under keyboard and mouse: dark leather, stitched.
    layer(x, '#3d3029', rrect(-214, 90, 116, 50, 2.2), { lift: .3 });
    x.save(); x.strokeStyle = 'rgba(220,200,170,.4)'; x.lineWidth = .2; x.setLineDash([.9, .6]); x.beginPath(); rrect(-212.4, 91.6, 112.8, 46.8, 1.6)(x); x.stroke(); x.restore();
    // A pen on the pad.
    x.save(); x.translate(-205, 132); x.rotate(.14);
    layer(x, '#1f1e22', rrect(0, -.75, 26, 1.5, .7), { lift: .3 }); layer(x, '#b9bcbd', rect(3, -1.05, 7, .45), { lift: .15, tooth: false }); layer(x, '#c9cbcc', poly([[26, -.6], [28.4, 0], [26, .6]]), { lift: .2, tooth: false });
    x.restore();
    // The cork coaster under the mug.
    layer(x, '#b48a5a', circle(-81, 108, 10.5), { lift: .3 });
    for (let i = 0; i < 70; i++) { const a = rnd(111, i) * TAU, r = Math.sqrt(rnd(113, i)) * 9.8; x.fillStyle = rnd(115, i) > .5 ? 'rgba(90,60,30,.35)' : 'rgba(255,230,190,.3)'; x.fillRect(-81 + Math.cos(a) * r, 108 + Math.sin(a) * r, .45, .3); }
    // Sticky notes with pencil marks, two paper clips, a pencil.
    x.save(); x.translate(-66, 138); x.rotate(.08);
    for (let k = 3; k >= 0; k--) layer(x, tone('#e3cf86', -k * .03), rect(k * .12, k * .12, 15, 15), { lift: .15 });
    x.strokeStyle = 'rgba(70,66,60,.55)'; x.lineWidth = .2; for (let r = 0; r < 4; r++) { x.beginPath(); x.moveTo(2, 3.4 + r * 2.6); for (let p = 1; p <= 8; p++) x.lineTo(2 + p * (r === 3 ? 6 : 10.5) / 8, 3.4 + r * 2.6 + Math.sin(p * 2.3 + r) * .35); x.stroke(); }
    x.restore();
    x.save(); x.translate(-50, 164); x.rotate(-.22); layer(x, '#e9d68e', rect(0, 0, 13, 13), { lift: .2 }); x.strokeStyle = 'rgba(70,66,60,.5)'; x.lineWidth = .2; x.beginPath(); x.moveTo(2, 4); x.lineTo(9, 4); x.moveTo(2, 6.6); x.lineTo(10.6, 6.6); x.stroke(); x.restore();
    for (const [cx, cy, r] of [[-79, 162, .4], [-73, 168, -.9]]) { x.save(); x.translate(cx, cy); x.rotate(r); x.strokeStyle = '#9aa0a2'; x.lineWidth = .3; x.beginPath(); x.moveTo(0, 0); x.lineTo(6, 0); x.arc(6, 1, 1, -PI / 2, PI / 2); x.lineTo(1, 2); x.arc(1, 1.3, .7, PI / 2, PI * 1.5); x.lineTo(5, .6); x.stroke(); x.restore(); }
    x.save(); x.translate(-122, 184); x.rotate(-.2);
    layer(x, '#d9a33a', rect(0, -.9, 34, 1.8), { lift: .3 }); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(0, -.9, 34, .45);
    layer(x, '#e4c9a0', poly([[34, -.9], [38.6, -.15], [38.6, .15], [34, .9]]), { lift: .2 }); layer(x, '#3a3836', poly([[37.4, -.35], [39.2, 0], [37.4, .35]]), { lift: .1, tooth: false });
    layer(x, '#b9bcbd', rect(-2.2, -.95, 2.2, 1.9), { lift: .2 }); layer(x, '#c27a6a', rrect(-4, -.9, 1.9, 1.8, .5), { lift: .2 });
    x.restore();
    // Cables: keyboard to monitor; monitor and lamp back over the edge to the double socket.
    cable(x, [[-158, 100.5], [-155, 92], [-151, 83]], .7);
    cable(x, [[-150, 80], [-140, 62], [-118, 46], [-88, 24], [-65, 8], [-63.5, 0]]);
    cable(x, [[-70, 61], [-66, 50], [-60, 25], [-56.5, 0]]);
    // Feet: chair, monitor, pen cup, lamp, mug, keyboard.
    for (const [a, z] of [[-286, -270], [-268, -244]]) foot(x, a, z, 120, 1.1);
    foot(x, -171, -133, 82, 1.2); foot(x, -226, -212, 90, 1.1); foot(x, -82, -58, 62, 1.2); foot(x, -88, -74, 108, 1.2); foot(x, -194, -122, 123.4, .9);
    // The index cards that stand on their words: while they lie, their own edges cover this.
    foot(x, -134, -88, 172, 1.3); foot(x, -80, -34, 182, 1.3);
  };
  const deskThingsR = x => {
    // Printouts fanned under a binder clip.
    for (let k = 0; k < 3; k++) {
      x.save(); x.translate(224, 106); x.rotate(-.05 + k * .04);
      layer(x, k === 2 ? '#f7f4ec' : tone('#f2eee4', -k * .02), rect(-25, -18, 50, 36), { lift: .2 });
      if (k === 2) { x.fillStyle = rgba(INK, .32); for (let r = 0; r < 12; r++) x.fillRect(-21, -13 + r * 2.4, r % 5 === 4 ? 18 : 34 + rnd(121, r) * 8, .45); x.fillStyle = rgba(INK, .5); x.fillRect(-21, -15.6, 16, .7); }
      x.restore();
    }
    x.save(); x.translate(224, 88.6); x.rotate(.04);
    layer(x, '#1d1c1e', rrect(-5, -1, 10, 4.4, .5), { lift: .3 }); stroke(x, [[-3.4, -1], [-2.6, -5.6], [2.6, -5.6], [3.4, -1]], '#a9aeb0', .35, { lift: .2 });
    x.restore();
    // Reading glasses, folded.
    x.save(); x.translate(100, 160); x.rotate(-.3);
    for (const dx of [-4.3, 4.3]) { layer(x, '#2e2926', ellipse(dx, 0, 4, 3.2), { lift: .3 }); layer(x, 'rgba(225,232,226,.9)', ellipse(dx, 0, 3.3, 2.5), { lift: 0, tooth: false }); x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.ellipse(dx - 1, -.9, 1.2, .4, -.4, 0, TAU); x.fill(); }
    stroke(x, [[-.8, -.6], [0, -1.2], [.8, -.6]], '#2e2926', .5);
    stroke(x, [[-8, -.8], [-2, -2.8], [6, -3.2], [8.6, -2.6]], '#2e2926', .5, { lift: .2, smooth: true });
    x.restore();
    cable(x, [[103.5, 82], [98, 71], [99.5, 56], [106, 30], [112, 0]]);
    foot(x, 104, 190, 128.4, 1); foot(x, 206, 256, 64, 1.1); foot(x, 34, 84, 156.6, .9); foot(x, 104, 190, 68, .8); foot(x, 128, 264, 6, 1);
    // The index card and the message card that stand on their words: while they lie, their own edges cover this.
    foot(x, 34, 94, 182, 1.3); foot(x, 112, 242, 131, 1.2);
  };
  // The lamp's pool of light on the desk, and the night everywhere else.
  const light = (x, W, H, side) => {
    const c = spot('L', -12, 112), cx = side === 'L' ? c[0] : c[0] - 300, cy = c[1];
    x.save(); x.globalCompositeOperation = 'multiply';
    const g = x.createRadialGradient(cx, cy, 40, cx, cy, 320); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(70,58,84,.48)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'screen';
    const p = x.createRadialGradient(cx, cy, 0, cx, cy, 95); p.addColorStop(0, 'rgba(255,214,150,.32)'); p.addColorStop(.45, 'rgba(255,206,140,.13)'); p.addColorStop(1, 'rgba(255,206,140,0)'); x.fillStyle = p; x.fillRect(0, 0, W, H);
    x.restore();
  };
  const gutter = (x, W, H, side) => { const gx = side === 'L' ? W : 0, g = x.createLinearGradient(gx, 0, gx + (side === 'L' ? -22 : 22), 0); g.addColorStop(0, 'rgba(40,26,14,.34)'); g.addColorStop(1, 'rgba(40,26,14,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); };
  S.page('L', (x, W, H) => {
    pageGround(x, W, H, 'L', '#2b2530', 71);
    room(x, 'L', x => { floorboards(x, 'L'); deskTop(x, 'L'); deskThingsL(x); });
    light(x, W, H, 'L');
    // On a card like every other chapter's name, set out by the page's outer edge: whole in the wide shot, and out of
    // the held shot on the monitor, whose lower edge used to cut it through the middle.
    { const tw = textWidth(x, TX.title, 13, { weight: 900 }); layer(x, tone(C.page, -.02), rrect(22, 203, tw + 14, 21, 1.2), { lift: .4 }); text(x, TX.title, 29, 214, 13, { weight: 900, color: INK, align: 'left' }); }
    gutter(x, W, H, 'L');
  });
  S.page('R', (x, W, H) => {
    pageGround(x, W, H, 'R', '#2b2530', 73);
    room(x, 'R', x => { floorboards(x, 'R'); deskTop(x, 'R'); deskThingsR(x); });
    light(x, W, H, 'R');
    gutter(x, W, H, 'R');
  });

  // ------------------------------------------------------------ the night behind the office: sky, moon, the houses across the street
  // The windows of the houses opposite (mm on the night fold: x from its left end, y from its top). A few are lit.
  const WIN = [];
  // The office window looks at x 90..208 of this fold, 52..152 mm above the page: the roofs stand in its lower half,
  // lower behind the right casement, where the moon is.
  const BLOCKS = [[0, 58, 96, '#221d29'], [58, 112, 106, '#272130'], [112, 150, 98, '#1f1a26'], [150, 204, 78, '#29222f'], [204, 252, 92, '#231e2a'], [252, 330, 104, '#262030'], [330, 410, 88, '#211c28'], [410, 490, 100, '#282230'], [490, 580, 84, '#221d29']];
  BLOCKS.forEach(([a, b, h], bi) => {
    for (let r = 0; r * 14 + 13 < h; r++) for (let c = 0; a + 5 + c * 11 + 6.2 < b - 3; c++) {
      const wx = a + 5 + c * 11, wy = SH - h + 8 + r * 14, k = rnd(131 + bi, r * 13 + c);
      WIN.push([wx, wy, 6.2, 8.8, k > .78 && wx > 86 && wx < 204, k]);
    }
  });
  S.vfold('nacht', { z: SZ, alpha: SAL, dir: 1, wL: .29, wR: .29, h: SH / 1000, lock: 0, amp: .05, color: '#2a2534', draw(x, W, H) {
    layer(x, PLUM, rect(0, 0, W, H), { lift: 0, shade: wash(0, 0, 0, H, 'rgba(14,10,22,.5)', 'rgba(130,100,132,.3)') });
    // The town's glow low over the roofs: the houses stand dark against it.
    { const g = x.createLinearGradient(0, H - 140, 0, H - 72); g.addColorStop(0, 'rgba(170,125,140,0)'); g.addColorStop(1, 'rgba(170,125,140,.3)'); x.fillStyle = g; x.fillRect(0, H - 140, W, 68); }
    // Stars, few and small, more high up.
    for (let i = 0; i < 60; i++) { const sx = rnd(301, i) * W, sy = Math.pow(rnd(302, i), 1.6) * 95, r = .2 + Math.pow(rnd(303, i), 4) * .55; x.fillStyle = rgba('#f3ecd8', .3 + rnd(304, i) * .55); x.beginPath(); x.arc(sx, sy, r, 0, TAU); x.fill(); }
    // A few brighter ones where the window looks out: in the top light and above the roofs, clear of the moon.
    for (const [sx, sy, r] of [[104, 46, .55], [131, 57, .4], [156, 43, .62], [199, 52, .45], [122, 66, .5], [97, 62, .35], [186, 60, .38], [140, 76, .42]]) { x.fillStyle = '#f6efdc'; x.beginPath(); x.arc(sx, sy, r, 0, TAU); x.fill(); x.fillStyle = 'rgba(246,239,220,.25)'; x.beginPath(); x.arc(sx, sy, r * 2.2, 0, TAU); x.fill(); }
    // The houses across the street: flat roofs with a cornice, one gable, chimneys, an aerial; dark windows with light sills.
    BLOCKS.forEach(([a, b, h, c], bi) => {
      if (bi === 1) layer(x, tone(c, -.06), poly([[a, H - h], [b, H - h], [b - 8, H - h - 11], [a + 8, H - h - 11]]), { lift: .4 });
      layer(x, c, rect(a, H - h, b - a, h), { lift: .45 });
      layer(x, tone(c, .14), rect(a, H - h, b - a, 1.4), { lift: .2 });
      if (bi % 2 === 0) { const ch = a + (b - a) * (.25 + rnd(311, bi) * .5); layer(x, tone(c, -.1), rect(ch, H - h - 7, 4.4, 7), { lift: .3 }); layer(x, tone(c, .1), rect(ch - .5, H - h - 7.8, 5.4, 1), { lift: .2 }); }
      if (bi === 3) { stroke(x, [[a + 34, H - h], [a + 34, H - h - 14]], '#1c1822', .35); stroke(x, [[a + 30, H - h - 11], [a + 38, H - h - 11]], '#1c1822', .3); stroke(x, [[a + 31, H - h - 8], [a + 37, H - h - 8]], '#1c1822', .3); }
    });
    for (const [wx, wy, ww, wh, , k] of WIN) {
      layer(x, k > .5 ? '#16131b' : '#1b1721', rect(wx, wy, ww, wh), { lift: 0, tooth: false });
      x.fillStyle = 'rgba(200,180,200,.14)'; x.fillRect(wx - .4, wy + wh, ww + .8, .6);
    }
  } });
  // The lit windows opposite: warm, each a little different (a blind half down, curtains, a lamp in the room).
  S.stand('lit', { host: 'nacht', side: 'L', u: -.23, v: 0, off: .0008, w: .18, h: .12, e: .55, res: 1, lock: .02, amp: .05, color: '#2a2534', draw(x) {
    for (const [wx, wy, ww, wh, lit, k] of WIN) {
      if (!lit) continue;
      const a = wx - 60, b = wy - 70;
      layer(x, tone(WARM, (k - .9) * 1.5), rect(a, b, ww, wh), { lift: 0, tooth: false });
      if (k > .95) { x.fillStyle = 'rgba(140,90,50,.55)'; x.fillRect(a, b, ww, wh * .45); for (let r = 0; r < 5; r++) { x.fillStyle = 'rgba(90,60,30,.4)'; x.fillRect(a, b + r * wh * .09, ww, .15); } }
      else if (k > .9) { x.fillStyle = 'rgba(170,100,60,.45)'; x.fillRect(a, b, ww * .32, wh); x.fillRect(a + ww * .74, b, ww * .26, wh); }
      else { x.fillStyle = 'rgba(255,250,230,.6)'; x.beginPath(); x.arc(a + ww * .3, b + wh * .45, .9, 0, TAU); x.fill(); }
      x.fillStyle = 'rgba(40,30,30,.5)'; x.fillRect(a + ww / 2 - .15, b, .3, wh);
    }
  } });
  // The moon: in the right casement of the window, a little cooler than the lamp.
  S.stand('moon', { host: 'nacht', side: 'L', u: -.12, v: .09, off: .0012, w: .024, h: .024, e: .35, lock: .02, amp: .05, color: '#2a2534', draw(x, W, H) {
    layer(x, tone(MOON, -.12), circle(W / 2, H / 2, 9.4), { lift: 0, tooth: false });
    layer(x, MOON, circle(W / 2, H / 2, 7.6), { lift: .3 });
    for (const [dx, dy, r] of [[-2.4, -1.8, 1.6], [1.8, 1.4, 2.1], [2.6, -2.6, .9], [-1.2, 3, 1.1]]) { x.fillStyle = 'rgba(160,140,120,.22)'; x.beginPath(); x.arc(W / 2 + dx, H / 2 + dy, r, 0, TAU); x.fill(); }
  } });

  // ------------------------------------------------------------ the office wall: window left, shelf right, in section
  S.vfold('buero', { z: WZ, alpha: WAL, dir: 1, wL: .29, wR: .29, h: WH / 1000, lock: .05, amp: .06, color: '#b8a382', draw(x, W, H) {
    const X = s => s + 290, Y = h => H - h;
    const op = [X(-200), Y(152), 118, 100];
    const wall = c => { c.rect(0, 0, W, H); c.rect(op[0], op[1], op[2], op[3]); };
    layer(x, WALL, wall, { lift: 0, rule: 'evenodd', shade: () => {
      for (let i = 0; i < 320; i++) { x.fillStyle = rnd(41, i) > .5 ? 'rgba(255,248,232,.05)' : 'rgba(90,70,50,.045)'; x.beginPath(); x.arc(rnd(42, i) * W, rnd(43, i) * H, 2 + rnd(44, i) * 10, 0, TAU); x.fill(); }
      const g = x.createRadialGradient(X(-28), Y(40), 8, X(-28), Y(40), 340); g.addColorStop(0, 'rgba(255,232,190,.26)'); g.addColorStop(.35, 'rgba(255,232,190,.04)'); g.addColorStop(1, 'rgba(46,34,56,.52)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      const v = x.createLinearGradient(0, 0, 0, H); v.addColorStop(0, 'rgba(46,34,56,.42)'); v.addColorStop(.55, 'rgba(46,34,56,0)'); x.fillStyle = v; x.fillRect(0, 0, W, H);
    } });
    // The cut: the wall's top and both ends in section, hatched.
    const hatch = (a, b, w, h) => { layer(x, '#4a3c33', rect(a, b, w, h), { lift: 0 }); inside(x, rect(a, b, w, h), () => { x.strokeStyle = 'rgba(214,194,164,.3)'; x.lineWidth = .22; for (let d = -h - 10; d < w + 10; d += 2.2) { x.beginPath(); x.moveTo(a + d, b + h); x.lineTo(a + d + h, b); x.stroke(); } }); };
    hatch(0, 0, W, 4.2); hatch(0, 4.2, 3, H - 4.2); hatch(W - 3, 4.2, 3, H - 4.2);
    x.fillStyle = 'rgba(255,240,215,.4)'; x.fillRect(3, 4.2, W - 6, .35);
    // Skirting board.
    layer(x, '#e2d9c7', rect(3, Y(5.5), W - 6, 5.5), { lift: .3 });
    x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(3, Y(5.5), W - 6, .35);
    // Sockets with their plugs; the cables run down to the floor and on over the page.
    const socket = (s, h, n) => {
      const w = 7 * n + 2, cx = X(s);
      layer(x, '#ebe6da', rrect(cx - w / 2, Y(h) - 4.2, w, 8.4, 1.2), { lift: .35 });
      for (let k = 0; k < n; k++) {
        const px = cx - w / 2 + 4.5 + k * 7;
        layer(x, '#ddd7c9', circle(px, Y(h), 2.7), { lift: 0 });
        stroke(x, [[px, Y(h) + 1.4], [px, H - 1]], '#1e1d1c', .85, { lift: .2 });
        layer(x, '#1f1e1d', circle(px, Y(h), 2.1), { lift: .3, tooth: false });
        x.fillStyle = 'rgba(255,255,255,.2)'; x.fillRect(px - 1.2, Y(h) - 1.3, 1.2, .3);
      }
    };
    socket(-60, 14, 2); socket(112, 14, 1);
    // A light switch by the shelf.
    layer(x, '#ebe6da', rrect(X(116) - 3.4, Y(76) - 4.2, 6.8, 8.4, 1), { lift: .35 }); layer(x, '#f4f0e6', rrect(X(116) - 2, Y(76) - 2.8, 4, 5.6, .6), { lift: .2 });
    // A framed print over the desk: an ochre circle over two bands, quiet.
    { const a = X(24), b = Y(138), w = 78, h = 46;
      layer(x, '#2a2624', rect(a, b, w, h), { lift: .6 });
      layer(x, '#efe8d8', rect(a + 1.8, b + 1.8, w - 3.6, h - 3.6), { lift: 0 });
      inside(x, rect(a + 7, b + 6.5, w - 14, h - 13), () => {
        x.fillStyle = '#d8cbb0'; x.fillRect(a, b, w, h);
        x.fillStyle = '#b5603e'; x.fillRect(a, b + 24, w, 6); x.fillStyle = '#6f7a5c'; x.fillRect(a, b + 30, w, 12);
        x.fillStyle = '#c99a4a'; x.beginPath(); x.arc(a + 46, b + 19, 7.5, 0, TAU); x.fill();
      });
      x.strokeStyle = 'rgba(60,50,40,.25)'; x.lineWidth = .14; x.strokeRect(a + 7, b + 6.5, w - 14, h - 13);
    }
  } });

  // The window: casing, transom and mullion, two casements and a top light, a sill with two books. The glass is cut
  // away, so the night fold behind shows through it.
  stand('window', 'L', -208, 1.2, 134, 108, { v: .048, res: 1.2, lock: .08, amp: .06, color: '#d9d2c4', draw(x, W) {
    const F = '#ebe6dc', SASH = '#f2eee6';
    layer(x, F, c => { c.rect(4, 0, 126, 104); c.rect(8, 4, 118, 96); }, { lift: .5, rule: 'evenodd' });
    layer(x, F, rect(8, 27.6, 118, 3.8), { lift: .45 });
    layer(x, F, rect(65.2, 31.4, 3.6, 68.6), { lift: .45 });
    const sash = (a, b, w, h) => {
      layer(x, SASH, c => { c.rect(a, b, w, h); c.rect(a + 2.6, b + 2.6, w - 5.2, h - 5.2); }, { lift: .4, rule: 'evenodd' });
      x.strokeStyle = 'rgba(150,140,124,.6)'; x.lineWidth = .2; x.strokeRect(a + 2.5, b + 2.5, w - 5, h - 5);
      x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = .18; x.beginPath(); x.moveTo(a + .3, b + h - .3); x.lineTo(a + .3, b + .3); x.lineTo(a + w - .3, b + .3); x.stroke();
    };
    sash(8.6, 4.6, 116.8, 22.4); sash(8.6, 32, 56, 67.4); sash(69.4, 32, 56, 67.4);
    // Handles: a rose and a lever pointing down; the top light has its tilt catch.
    for (const hx of [62.4, 71.6]) { layer(x, '#d6d3cc', rrect(hx - 1, 60, 2, 5.4, .8), { lift: .3 }); layer(x, '#cfccc4', rrect(hx - .55, 62.4, 1.1, 8.4, .5), { lift: .35 }); x.fillStyle = 'rgba(255,255,255,.6)'; x.fillRect(hx - .4, 62.6, .3, 7.6); }
    layer(x, '#d6d3cc', rrect(64, 5.4, 6, 1.6, .6), { lift: .3 });
    // The sill: its top face, its front edge, and on it two books.
    layer(x, '#d9d1c2', rect(0, 104, W, 3.6), { lift: .45 });
    layer(x, '#eee8dc', rect(0, 101.6, W, 2.6), { lift: .3 });
    x.fillStyle = 'rgba(255,255,255,.45)'; x.fillRect(0, 101.6, W, .3);
    layer(x, '#6d4b3a', rect(94, 98.4, 27, 3.2), { lift: .3 }); layer(x, '#55685a', rect(96, 95.6, 23, 2.8), { lift: .3 });
    x.fillStyle = 'rgba(240,220,170,.5)'; x.fillRect(99, 99.4, 6, .9); x.fillRect(110, 96.5, 5, .8);
  } });
  // A pinboard over the chair: cork in a light frame, a printout, notes, a card.
  stand('pinboard', 'L', -282, 1.5, 58, 42, { v: .08, res: 1.2, lock: .1, amp: .06, color: '#a88458', draw(x, W, H) {
    layer(x, '#d4bd96', rect(0, 0, W, H), { lift: .5 });
    layer(x, '#b48b5c', rect(1.8, 1.8, W - 3.6, H - 3.6), { lift: 0 });
    for (let i = 0; i < 260; i++) { x.fillStyle = rnd(151, i) > .5 ? 'rgba(90,60,30,.3)' : 'rgba(240,210,160,.25)'; x.fillRect(2 + rnd(152, i) * (W - 4), 2 + rnd(153, i) * (H - 4), .4, .3); }
    const pin = (px, py, c) => { layer(x, c, circle(px, py, .75), { lift: .35, tooth: false }); x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(px - .4, py - .45, .3, .25); };
    x.save(); x.translate(6, 5); x.rotate(-.04); layer(x, '#f6f3ea', rect(0, 0, 18, 25), { lift: .3 }); x.fillStyle = rgba(INK, .5); x.fillRect(2, 2.4, 10, .7); x.fillStyle = rgba(INK, .3); for (let r = 0; r < 8; r++) x.fillRect(2, 5 + r * 2.3, r % 4 === 3 ? 8 : 13, .4); x.restore(); pin(15, 6, ORD[2]);
    x.save(); x.translate(28, 7); x.rotate(.06); layer(x, '#e3cf86', rect(0, 0, 11, 11), { lift: .3 }); x.strokeStyle = 'rgba(70,66,60,.55)'; x.lineWidth = .2; x.beginPath(); x.moveTo(1.6, 3.4); x.lineTo(8, 3.4); x.moveTo(1.6, 6); x.lineTo(9, 6); x.stroke(); x.restore(); pin(33.4, 8.2, ORD[0]);
    x.save(); x.translate(41, 5); x.rotate(-.08); layer(x, '#dfe3dc', rect(0, 0, 12, 15), { lift: .3 }); layer(x, '#8aa07e', rect(1.2, 1.2, 9.6, 7), { lift: 0 }); layer(x, '#c9a86a', rect(1.2, 6, 9.6, 2.2), { lift: 0 }); x.restore(); pin(47, 6.2, ORD[1]);
    x.save(); x.translate(27, 22); x.rotate(.03); layer(x, '#f1ece0', rect(0, 0, 22, 13), { lift: .3 }); x.fillStyle = rgba(INK, .3); for (let r = 0; r < 4; r++) x.fillRect(2, 3 + r * 2.4, 15 - r * 2, .4); x.restore(); pin(38, 23.4, '#3a3836');
  } });

  // ------------------------------------------------------------ the shelf, room scale, and the plant on it
  stand('shelf', 'R', 128, 6, 136, 120, { res: 1.2, lock: .1, amp: .06, color: '#5a4230', draw(x, W, H) {
    const WOOD = '#6e5038', BACK = '#4a3a2d';
    layer(x, BACK, rect(2, 2, W - 4, H - 6), { lift: .5 });
    inside(x, rect(2, 2, W - 4, H - 6), wash(0, 0, W, 0, 'rgba(255,230,190,.06)', 'rgba(0,0,0,.18)'));
    const levels = [5, 28, 51, 74, 97], B = h => H - h, mid = W / 2;
    // What stands on each board: bay 0 left, bay 1 right.
    const fill = (lv, bay) => {
      const base = B(levels[lv]), top = lv < 4 ? B(levels[lv + 1]) + 1.8 : 2.4, rh = base - top, a0 = bay ? mid + 1.2 : 2.4, a1 = bay ? W - 2.4 : mid - 1.2, sd = 160 + lv * 7 + bay;
      x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(a0, top, a1 - a0, 1.6);
      const kind = [['boxes', 'reams'], ['ordner', 'ordnerLean'], ['ordnerBooks', 'ordner'], ['books', 'ordnerBoxes'], ['ordner', 'ordnerSmall']][lv][bay];
      let a = a0 + .4;
      const ordnerRun = (n, cols, hk = .92) => { for (let i = 0; i < n && a < a1 - 5; i++) { const w = 4.4 + rnd(sd, i) * 1.2; ordner(x, a, base, w, rh * (hk - rnd(sd + 1, i) * .05), cols[Math.floor(rnd(sd + 2, i) * cols.length)], sd * 13 + i); a += w + .15; } };
      if (kind === 'boxes') {
        for (const [w, c] of [[24, '#b8986a'], [26, '#a98a5e']]) { layer(x, c, rect(a, base - rh * .82, w, rh * .82), { lift: .3 }); layer(x, '#7a6040', rrect(a + w / 2 - 3, base - rh * .7, 6, 1.6, .8), { lift: 0 }); layer(x, '#f1ece0', rect(a + w / 2 - 5, base - rh * .45, 10, 5), { lift: .1 }); x.fillStyle = rgba(INK, .4); x.fillRect(a + w / 2 - 3.4, base - rh * .45 + 1.6, 6.8, .4); x.fillRect(a + w / 2 - 3.4, base - rh * .45 + 3, 4.6, .4); a += w + 1.4; }
      } else if (kind === 'reams') {
        for (let k = 0; k < 4; k++) { layer(x, k % 2 ? '#f3efe4' : '#e9e4d6', rect(a + k * .3, base - (k + 1) * 3.6, 30, 3.4), { lift: .2 }); x.fillStyle = rgba(ORD[k % 3], .7); x.fillRect(a + k * .3 + 10, base - (k + 1) * 3.6 + 1, 10, 1.4); }
        layer(x, '#a48760', rect(a + 34, base - rh * .7, 24, rh * .7), { lift: .3 });
      } else if (kind === 'ordner') ordnerRun(14, ORD);
      else if (kind === 'ordnerLean') {
        // Eight upright, then two that have fallen against them.
        ordnerRun(8, [ORD[2], ORD[0]]);
        const hh = rh * .9, sn = Math.sin(.2);
        ordner(x, a + hh * sn, base, 4.8, hh, ORD[1], sd + 50, -.2); ordner(x, a + hh * sn + 4.95, base, 4.6, hh * .97, ORD[0], sd + 51, -.2);
      } else if (kind === 'ordnerBooks') { ordnerRun(7, [ORD[1]]); a += 2; for (let k = 0; k < 6; k++) { const w = 2 + rnd(sd + 9, k) * 1.6, h = rh * (.62 + rnd(sd + 8, k) * .3); book(x, a, base, w, h, ['#7a4a3a', '#d8cdb4', '#55685a', '#8a6a3a', '#45403a', '#b4583e'][k], sd + k); a += w + .1; } }
      else if (kind === 'books') { for (let k = 0; k < 9; k++) { const w = 2 + rnd(sd + 9, k) * 1.8, h = rh * (.6 + rnd(sd + 8, k) * .34); book(x, a, base, w, h, ['#7a4a3a', '#d8cdb4', '#5d6a58', '#8a6a3a', '#a8463a', '#e3d9c2', '#4f5a50', '#b88a3e', '#6a5040'][k], sd + k); a += w + .12; } for (let k = 0; k < 3; k++) layer(x, ['#d8cdb4', '#6e3434', '#5d6a58'][k], rect(a + 3 + k * .6, base - (k + 1) * 2.6, 24 - k * 2, 2.4), { lift: .2 }); }
      else if (kind === 'ordnerBoxes') { ordnerRun(6, ORD); for (let k = 0; k < 3; k++) { layer(x, ['#3f3c38', '#d8d1c2', '#3f3c38'][k], poly([[a, base], [a + 6, base], [a + 6, base - rh * .8], [a, base - rh * .5]]), { lift: .3 }); a += 6.4; } }
      else if (kind === 'ordnerSmall') { ordnerRun(9, [ORD[0], ORD[1]], .74); layer(x, '#8a6a48', rect(a + 2, base - 6, 14, 6), { lift: .3 }); layer(x, BRASS, rect(a + 8, base - 4, 2, 1.2), { lift: .1 }); }
    };
    for (let lv = 0; lv < 5; lv++) for (const bay of [0, 1]) fill(lv, bay);
    // The carcass: boards, the middle divider, top, sides, plinth.
    for (const lv of levels) { layer(x, WOOD, rect(2, B(lv), W - 4, 1.8), { lift: .35 }); x.fillStyle = 'rgba(255,230,190,.25)'; x.fillRect(2, B(lv), W - 4, .3); }
    layer(x, WOOD, rect(mid - 1.2, 2, 2.4, H - 7), { lift: .4 });
    layer(x, WOOD, rect(0, 0, W, 2.4), { lift: .45 }); layer(x, WOOD, rect(0, 0, 2.4, H), { lift: .45 }); layer(x, WOOD, rect(W - 2.4, 0, 2.4, H), { lift: .45 });
    layer(x, tone(WOOD, -.2), rect(2.4, H - 5, W - 4.8, 5), { lift: .3 });
    x.strokeStyle = 'rgba(40,24,12,.25)'; x.lineWidth = .15; for (const px of [.8, W - 1.6]) { x.beginPath(); x.moveTo(px, 2); x.lineTo(px + .2, H); x.stroke(); }
  } });
  stand('plant', 'R', 124, 9.8, 54, 90, { v: .06, res: 1.4, lock: .14, amp: .1, color: '#4a5e48', draw(x, W, H) {
    const G = ['#5d7f63', '#4e6e55', '#6f8f68', '#557a5c', '#7d9a6c'];
    const potY = H - 60;   // the shelf's top is 60 mm above the foot of this sheet
    // Vines first: they hang over the shelf's left side and along its top.
    const vine = (pts, n, sd) => { stroke(x, pts, '#5a6a3e', .35, { smooth: true, lift: .2 }); for (let i = 1; i < n; i++) { const t = i / n, k = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1))), f = t * (pts.length - 1) - k, p = [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f], side = i % 2 ? 1 : -1; leaf(x, p[0], p[1], 4.2 + rnd(sd, i) * 2.2, (side > 0 ? -.3 : PI + .3) + (rnd(sd + 1, i) - .5) * .6, G[Math.floor(rnd(sd + 2, i) * G.length)]); } };
    vine([[12, potY - 6], [8, potY - 2], [5.6, potY + 10], [5, potY + 30], [5.8, potY + 52], [6.4, potY + 70]], 12, 171);
    vine([[16, potY - 5], [13, potY], [11.6, potY + 14], [12, potY + 28]], 6, 173);
    vine([[26, potY - 6], [34, potY - 4], [44, potY - 2.6], [51, potY - 1.6]], 6, 175);
    // The pot: glazed stoneware with a rim.
    const pot = c => { c.moveTo(8, potY - 13); c.lineTo(26, potY - 13); c.lineTo(24.4, potY); c.lineTo(9.6, potY); c.closePath(); };
    layer(x, '#d6cbb6', pot, { lift: .5 }); inside(x, pot, wash(8, 0, 26, 0, 'rgba(255,255,255,.18)', 'rgba(60,40,20,.2)'));
    layer(x, '#c9bda6', rect(7.4, potY - 14.6, 19.2, 2.4), { lift: .3 });
    x.fillStyle = 'rgba(110,80,50,.35)'; x.fillRect(9, potY - 7.4, 16.2, .5);
    // Leaves above the pot, each on its own stalk.
    for (let i = 0; i < 11; i++) { const a = -PI / 2 + (i - 5) * .26 + (rnd(181, i) - .5) * .2, l = 10 + rnd(182, i) * 9, bx = 17 + (i - 5) * .6, by = potY - 14, tx = bx + Math.cos(a) * l * .6, ty = by + Math.sin(a) * l * .6; stroke(x, [[bx, by], [tx, ty]], '#5a6a3e', .3); leaf(x, tx, ty, 5.4 + rnd(183, i) * 2.6, a + (rnd(184, i) - .5) * .5, G[i % G.length]); }
  } });

  // ------------------------------------------------------------ the chair with the jacket, pushed away from the desk
  stand('chair', 'L', -290, 118, 54, 104, { res: 1.6, lock: .2, amp: .1, color: '#2a2b2e', draw(x, W, H) { officeChair(x, W, H); } });

  // ------------------------------------------------------------ the monitor with the finished table
  stand('monitor', 'L', -202, 82, 100, 80, { res: 1.6, lock: .2, amp: .1, color: '#26292c', draw(x, W, H) {
    const cx = 50;
    // The foot: a flat plate, its top face seen from above; the column, with its cable hole.
    layer(x, '#25292c', rrect(cx - 21, H - 4.4, 42, 4.4, 1.6), { lift: .45 });
    layer(x, '#3d4347', rrect(cx - 20, H - 4.4, 40, 2.2, 1.1), { lift: 0 });
    x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(cx - 17, H - 4.2, 30, .25);
    layer(x, '#33383c', poly([[cx - 3.8, H - 3.6], [cx + 3.8, H - 3.6], [cx + 3.1, 59], [cx - 3.1, 59]]), { lift: .35 });
    layer(x, '#1a1c1e', rrect(cx - 1.6, H - 12.4, 3.2, 4.6, 1.4), { lift: 0, tooth: false });
    // The case and the black glass; a small light in the chin.
    layer(x, ANTH, rrect(2, .5, 96, 62, 1.6), { lift: .7 });
    x.fillStyle = 'rgba(255,255,255,.1)'; x.fillRect(3, .9, 94, .3);
    layer(x, '#0c0e10', rect(4.3, 2.8, 91.4, 56.4), { lift: 0, tooth: false });
    layer(x, C.green, circle(93.2, 61, .35), { lift: 0, tooth: false });
  } });
  const screenGlow = t => (.12 + .88 * ease((t - S.t.tabelle) / .8)) * dim(t);
  stand('monScreen', 'L', -197.5, 82.6, 91, 56, { v: .021, e: .45, res: 1.6, lock: .2, amp: .1, color: '#fbfaf5', draw(x, W, H) { sheet(x, W, H); }, life: t => ({ glow: screenGlow(t) }) });
  // The total row lies a hair in front of the screen: it lights with the screen, then glows up twice and settles.
  stand('monSum', 'L', -197.5, 83, 91, SCR.sum, { v: .021 + (56 - SCR.sumY - SCR.sum) / 1000, e: .45, res: 1.6, lock: .2, amp: .1, color: '#f4ead2', draw(x, W) { sumRow(x, W, 0); },
    life: t => { const k = t - S.t.tabelle - .9; return { glow: screenGlow(t) * (1 + (k < 0 ? 0 : .7 * ease(k / .3) * Math.exp(-k * .9) * Math.pow(Math.sin(k * 2.4 + .6), 2))) }; } });
  // The keyboard on the pad (a flat, with its front edge standing), the mouse beside it.
  flatAt('keyboard', 'L', -158, 112, 74, 24, { res: 1.6, life: () => ({ hop: .0011 }), draw(x) {
    layer(x, '#d6d7d3', rrect(1, 1, 72, 22, 1.8), { lift: .3 });
    x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(2, 1.3, 70, .3);
    const rows = [[.66, Array(14).fill(1)], [1, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5]], [1, [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]], [1, [1.8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.7]], [1, [2.3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.7]], [1, [1, 1, 1.3, 5.8, 1.3, 1, 1, 1, 1]]];
    let y = 2.4;
    rows.forEach(([hk, ws]) => { const kh = 3 * hk, tot = ws.reduce((a, b) => a + b, 0), avail = 68.8 - .5 * (ws.length - 1); let kx = 2.6; ws.forEach(w => { const kw = w * avail / tot; layer(x, '#f4f3ef', rrect(kx, y, kw, kh, .5), { lift: .18, sh: .3 }); x.fillStyle = 'rgba(120,120,116,.25)'; x.fillRect(kx + .2, y + kh - .35, kw - .4, .25); kx += kw + .5; }); y += kh + .5; });
  } });
  stand('kbdEdge', 'L', -194, 123.4, 72, 1.6, { res: 1.6, lock: .2, amp: .1, color: '#b9bab6', draw(x, W, H) { layer(x, '#c3c4c0', rrect(0, 0, W, H, .6), { lift: .2 }); x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(.6, 0, W - 1.2, .25); } });
  // The mouse: an egg narrower at the front, turned a little on the pad as a hand leaves it, so it never reads as a disc.
  flatAt('mouse', 'L', -108, 115, 11, 17, { res: 1.6, life: () => ({ hop: .0012, rot: ANG + .42 }), draw(x) {
    const m = c => { c.moveTo(5.5, .5); c.bezierCurveTo(9.2, .5, 10.4, 6, 10.3, 10.6); c.bezierCurveTo(10.2, 16.2, .8, 16.2, .7, 10.6); c.bezierCurveTo(.6, 6, 1.8, .5, 5.5, .5); c.closePath(); };
    layer(x, '#d9dad6', m, { lift: .3 }); inside(x, m, () => { wash(1, 0, 10, 0, 'rgba(255,255,255,.34)', 'rgba(60,60,60,.18)')(x); wash(0, 9, 0, 16, 'rgba(0,0,0,0)', 'rgba(60,60,60,.14)')(x);
      x.fillStyle = 'rgba(255,255,255,.4)'; x.beginPath(); x.ellipse(3.8, 5.4, 1.4, 3, -.2, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(90,90,90,.3)'; x.lineWidth = .14; x.beginPath(); x.moveTo(.8, 7.6); x.quadraticCurveTo(5.5, 8.6, 10.2, 7.6); x.stroke(); });
    x.fillStyle = 'rgba(90,90,90,.45)'; x.fillRect(5.4, .6, .2, 7.2); layer(x, '#8c8e8c', rrect(4.8, 2.6, 1.4, 2.6, .6), { lift: .1, tooth: false });
    x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(5.05, 2.9, .9, .3);
  } });
  // A pen cup left of the monitor.
  stand('pens', 'L', -226, 90, 14, 32, { res: 1.6, lock: .22, amp: .1, color: '#3d3029', draw(x, W, H) {
    for (const [px, top, c, w] of [[4, 4, '#d9a33a', 1.4], [6.6, 1.6, '#1f1e22', 1.2], [8.8, 6, '#a8463a', 1.3], [10.4, 9.6, '#b9bcbd', 2.2]]) { layer(x, c, rect(px - w / 2, top, w, H - top - 8), { lift: .25 }); if (c === '#d9a33a') layer(x, '#e4c9a0', poly([[px - .7, top], [px + .7, top], [px, top - 2]]), { lift: .1 }); }
    layer(x, '#3d3029', rrect(1.4, H - 14.6, 11.2, 14.6, 1), { lift: .45 });
    inside(x, rrect(1.4, H - 14.6, 11.2, 14.6, 1), wash(1.4, 0, 12.6, 0, 'rgba(255,230,200,.16)', 'rgba(0,0,0,.25)'));
    x.save(); x.strokeStyle = 'rgba(220,200,170,.35)'; x.lineWidth = .18; x.setLineDash([.7, .5]); x.strokeRect(2.2, H - 13.8, 9.6, 13); x.restore();
  } });
  // The mug, still steaming.
  stand('mug', 'L', -92, 108, 22, 24, { res: 1.6, lock: .24, amp: .12, color: '#3a5042', draw(x, W, H) {
    const G = '#405a4b';
    layer(x, G, c => { c.arc(18.2, 13.4, 4.6, -PI / 2, PI / 2); c.lineTo(18.2, 16); c.arc(18.2, 13.4, 2.6, PI / 2, -PI / 2, true); c.closePath(); }, { lift: .4 });
    const body = c => { c.moveTo(3, 6); c.lineTo(18.4, 6); c.lineTo(18, 23); c.quadraticCurveTo(17.8, 24, 16.8, 24); c.lineTo(4.6, 24); c.quadraticCurveTo(3.6, 24, 3.4, 23); c.closePath(); };
    layer(x, G, body, { lift: .45 });
    inside(x, body, () => { const g = x.createLinearGradient(3, 0, 18.4, 0); g.addColorStop(0, 'rgba(255,240,220,.28)'); g.addColorStop(.3, 'rgba(255,240,220,.06)'); g.addColorStop(1, 'rgba(0,0,0,.3)'); x.fillStyle = g; x.fillRect(0, 0, W, H); x.fillStyle = 'rgba(184,154,122,.9)'; x.fillRect(0, 22.8, W, 1.2); });
    layer(x, '#c6b39a', ellipse(10.7, 6, 7.7, 1.9), { lift: 0, tooth: false });
    layer(x, '#2a1a12', ellipse(10.7, 6.3, 6.9, 1.45), { lift: 0, tooth: false });
    x.fillStyle = 'rgba(255,230,190,.35)'; x.beginPath(); x.ellipse(8.4, 6.1, 2.6, .45, 0, 0, TAU); x.fill();
  } });
  stand('steam', 'L', -89.5, 107.6, 16, 28, { v: .0175, res: 1.6, lock: .24, amp: .12, pivot: [.008, 0], color: '#e8e1d3', draw(x, W, H) {
    // Three ribbons of steam: thin where they leave the coffee, wider as they curl up, thin again where they fade.
    const wisp = (x0, ph, top, w0, amp, fq, c) => {
      const n = 30, pts = [], wd = t => w0 * (.3 + .7 * Math.sin(PI * t)) * (1 - .55 * t);
      for (let i = 0; i <= n; i++) { const t = i / n; pts.push([x0 + Math.sin(t * fq + ph) * (.25 + t * amp), H - 1 - t * (H - 1 - top)]); }
      layer(x, c, c2 => { for (let i = 0; i <= n; i++) { const w = wd(i / n); i ? c2.lineTo(pts[i][0] + w, pts[i][1]) : c2.moveTo(pts[i][0] + w, pts[i][1]); } for (let i = n; i >= 0; i--) c2.lineTo(pts[i][0] - wd(i / n), pts[i][1]); c2.closePath(); }, { lift: .15, sh: .1, tooth: false });
    };
    // Cut from vellum: thinner than a brush would draw it and the colour of the wall behind, so it stays a breath.
    wisp(7.4, 0, 1.5, .42, 2.8, 7.6, '#ddd3c2');
    wisp(9.8, 2.6, 8.5, .34, 2.2, 8.4, '#e3dacb');
    wisp(5.8, 4.4, 15, .28, 1.4, 7, '#d6ccba');
  }, life: t => { const m = 1 - ease((t - S.t.botschaft - .6) / 2); return { rot: Math.sin(t * 1.15) * .07 * m, du: Math.sin(t * .63 + 1) * .0007 * m, dv: Math.sin(t * .9) * .0003 * m }; } });

  // ------------------------------------------------------------ the desk lamp, burning
  stand('lamp', 'L', -84, 62, 68, 98, { res: 1.6, lock: .22, amp: .1, color: '#272523', draw(x) { deskLamp(x); } });
  stand('lampLight', 'L', -84 + 48, 62.5, 20, 12, { v: (98 - 66) / 1000, e: .9, res: 1.6, lock: .22, amp: .1, color: '#f6e6c2', draw(x) { x.translate(-48, -54); lampOpening(x, true); } });

  // ------------------------------------------------------------ the MCP booklet: it lies closed, then its cover lifts
  flatAt('heftBlock', 'R', 59, 128, 52, 84, { res: 1.6, life: () => ({ hop: .0002 }), draw(x) { bookletPage(x); } });
  flatAt('heftCover', 'R', 59, 121, 50, 70, { res: 1.6, draw(x, W, H) { bookletCover(x, W, H); }, life: t => ({ hop: .0012, show: t < S.t.mcp }) });
  // The same cover as a stand hinged at the spine: lying it matches the flat; then it swings up to stand behind the page.
  stand('heftLid', 'R', 34, 86, 50, 70, { v: .0017, pivot: [.025, 0], res: 1.6, lock: .3, amp: 0, color: '#e6dcc4', draw(x, W, H) { x.translate(W, H); x.rotate(PI); bookletCover(x, W, H); },
    life: t => { const k = t - S.t.mcp, up = k <= 0 ? 0 : Math.min(1.015, 1 - Math.exp(-k * 3.6) * Math.cos(k * 3.9)); return { show: k >= 0, rot: PI, rx: PI / 2 + PI / 2 * up }; } });
  // The inside of that cover, on the lid's back: the same hinge and swing (the lid turned over is the same as a sheet
  // rising from lying forward), shown once it is half up and kept a hair in front, so the open cover is printed paper
  // with a ruled frame and a fine hatch, not a blank grey board.
  stand('heftLidIn', 'R', 34, 86, 50, 70, { v: .0017, pivot: [.025, 0], res: 1.6, lock: .3, amp: 0, color: '#e2d7bd', draw(x, W, H) {
    layer(x, '#e2d7bd', rect(0, 0, W, H), { lift: 0 });
    inside(x, rect(0, 0, W, H), () => { x.strokeStyle = 'rgba(120,100,70,.07)'; x.lineWidth = .16; x.beginPath(); for (let d = -H; d < W; d += 1.6) { x.moveTo(d, H); x.lineTo(d + H, 0); } x.stroke(); });
    x.strokeStyle = 'rgba(43,36,32,.38)'; x.lineWidth = .3; x.strokeRect(4, 4, W - 8, H - 8); x.lineWidth = .14; x.strokeRect(5.2, 5.2, W - 10.4, H - 10.4);
    x.fillStyle = 'rgba(120,100,70,.1)'; x.fillRect(W - 2.2, 0, 2.2, H);
  }, life: t => { const k = t - S.t.mcp, up = k <= 0 ? 0 : Math.min(1.015, 1 - Math.exp(-k * 3.6) * Math.cos(k * 3.9)); return { show: k >= 0 && up > .5, rx: PI / 2 * (1 - up), doff: .0002 }; } });

  // ------------------------------------------------------------ the laptop with Code Mode switched on
  flatAt('lapBase', 'R', 147, 98, 88, 62, { res: 1.6, life: () => ({ hop: .002 }), draw(x, W, H) {
    const body = rrect(1, 1, 86, 60, 3);
    layer(x, '#cdd0ce', body, { lift: .3 });
    inside(x, body, wash(0, 0, 0, H, 'rgba(255,255,255,.12)', 'rgba(60,64,66,.1)'));
    // Bead-blasted, brushed aluminium: fine streaks across the deck, a soft sheen where the lamp lies on it, a lit
    // chamfer along the front edge.
    inside(x, body, () => {
      for (let i = 0; i < 260; i++) { const yy = 1 + rnd(201, i) * 60, xx = rnd(202, i) * 80, l = 6 + rnd(203, i) * 30; x.fillStyle = rnd(204, i) > .5 ? 'rgba(255,255,255,.12)' : 'rgba(70,74,76,.07)'; x.fillRect(xx, yy, l, .09); }
      const g = x.createRadialGradient(20, 50, 0, 20, 50, 46); g.addColorStop(0, 'rgba(255,244,222,.16)'); g.addColorStop(1, 'rgba(255,244,222,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    });
    x.fillStyle = 'rgba(255,255,255,.45)'; x.fillRect(4, 60.2, 80, .3);
    layer(x, '#8f9393', rect(6, 1, 76, 2.4), { lift: 0 }); x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(6, 1.2, 76, .3);
    layer(x, '#b7bbb9', rrect(7, 5.4, 74, 28.4, 1.2), { lift: 0 });
    let y = 6.2;
    [[.6, 14], [1, 14], [1, 14], [1, 13], [1, 12], [1, 9]].forEach(([hk, n], r) => {
      const kh = 3.6 * hk, wide = { 1: [13, 1.5], 2: [0, 1.5], 3: [0, 1.8, 12, 1.8], 4: [0, 2.3, 11, 2.4], 5: [3, 5.6] }[r] || [], ws = Array(n).fill(1);
      for (let i = 0; i < wide.length; i += 2) ws[wide[i]] = wide[i + 1];
      const tot = ws.reduce((a, b) => a + b, 0), U = (72 - .5 * n) / tot; let kx = 8;
      ws.forEach(w => { layer(x, '#2b2e31', rrect(kx, y, w * U, kh, .45), { lift: .12, sh: .3 }); x.fillStyle = 'rgba(255,255,255,.1)'; x.fillRect(kx + .2, y + .15, w * U - .4, .2); kx += w * U + .5; });
      y += kh + .55;
    });
    layer(x, '#c3c6c4', rrect(29, 36.6, 30, 20, 1.6), { lift: 0 }); x.strokeStyle = 'rgba(120,124,124,.5)'; x.lineWidth = .2; x.beginPath(); rrect(29, 36.6, 30, 20, 1.6)(x); x.stroke();
    for (const sx of [3.2, 82.4]) for (let r = 0; r < 14; r++) for (let c = 0; c < 2; c++) { x.fillStyle = 'rgba(70,74,76,.45)'; x.beginPath(); x.arc(sx + c * 1.2, 7 + r * 1.9, .22, 0, TAU); x.fill(); }
    x.fillStyle = 'rgba(90,94,96,.4)'; x.beginPath(); x.ellipse(44, 61, 6, 1.1, 0, PI, 0); x.fill();
  } });
  stand('lapEdge', 'R', 104, 128, 86, 2.4, { res: 1.6, lock: .26, amp: .1, color: '#a9adab', draw(x, W, H) { layer(x, '#b5b9b7', rrect(0, 0, W, H, 1), { lift: .2 }); x.fillStyle = 'rgba(80,84,86,.4)'; x.beginPath(); x.ellipse(W / 2, 0, 6, 1, 0, 0, PI); x.fill(); } });
  stand('lapLid', 'R', 104, 68, 86, 58, { v: .0024, res: 1.6, lock: .26, amp: .1, color: '#b9bcba', draw(x, W, H) {
    layer(x, '#c9ccc9', rrect(0, 0, W, H, 2.6), { lift: .6 });
    layer(x, '#111315', rrect(.8, .8, W - 1.6, H - 2.6, 2), { lift: 0, tooth: false });
    x.fillStyle = 'rgba(255,255,255,.07)'; x.beginPath(); x.moveTo(60, .8); x.lineTo(70, .8); x.lineTo(50, H - 2); x.lineTo(40, H - 2); x.closePath(); x.fill();
    // The camera in the top bezel: a grey ring, the dark lens, a glint on it.
    layer(x, '#3a3f43', circle(W / 2, 1.8, .62), { lift: 0, tooth: false }); layer(x, '#07090b', circle(W / 2, 1.8, .36), { lift: 0, tooth: false });
    x.fillStyle = 'rgba(190,205,215,.7)'; x.beginPath(); x.arc(W / 2 - .12, 1.68, .1, 0, TAU); x.fill();
    layer(x, '#9fa3a3', rect(4, H - 1.8, W - 8, 1.8), { lift: 0 });
  } });
  stand('lapScreen', 'R', 108, 68.4, 78, 50, { v: .0074, e: .45, res: 1.6, lock: .26, amp: .1, color: TERM, draw(x, W, H) { terminal(x, W, H); }, life: t => ({ glow: (.1 + .9 * ease((t - S.t.claude) / .6)) * dim(t) }) });
  stand('lapStatus', 'R', 111, 68.8, 72, 24, { v: .0124, e: .5, res: 1.6, lock: .26, amp: .1, color: C.cream, draw(x, W) { statusLine(x, W); }, life: t => ({ show: t > S.t.claude + .7, glow: ease((t - S.t.claude - .7) / .25) * dim(t) }) });
  // A stack of books right of the laptop.
  stand('books', 'R', 206, 64, 50, 26, { res: 1.6, lock: .24, amp: .1, color: '#6e3434', draw(x, W, H) {
    [[1, 44, 5.2, '#5d6a58'], [3, 41, 4.4, '#d8cdb4'], [0, 46, 6, '#6e3434'], [4, 37, 3.6, '#b88a3e'], [2.4, 40, 4.6, '#45403a']].reduce((b, [a, w, h, c], i) => {
      layer(x, c, rect(a, b - h, w, h), { lift: .35 });
      x.fillStyle = 'rgba(255,240,210,.35)'; x.fillRect(a + w * .12, b - h * .62, w * .3, h * .24);
      x.fillStyle = 'rgba(0,0,0,.15)'; x.fillRect(a, b - .3, w, .3);
      if (i === 1) { x.fillStyle = 'rgba(80,64,44,.35)'; for (let k = 0; k < 6; k++) x.fillRect(a + w - .2, b - h + .5 + k * .6, .2, .2); }
      return b - h;
    }, H);
  } });

  // ------------------------------------------------------------ who named it, who offers it, who switches it on: three index cards
  // Cloudflare and Anthropic lie left of the gutter in front of the lamp and the mug, the other agents right of it in
  // front of the booklet; each stands on its word and all three lie down again while the camera moves to the booklet,
  // so they hide nothing there. Each card is cut to its name; all three names are set in one size.
  // s, b: where the card stands in the room (mm along the wall, mm in front of it); w: its width. Cards lying flat
  // reach b + 24: the outermost one stands a little further back, so it stays on the page.
  const IDX = [
    { name: 'cardCloudflare', side: 'L', s: -134, b: 172, w: 46, words: TX.cloudflare, up: () => S.t.cloudflare, down: () => S.t.mcp - 1.25 },
    { name: 'cardAnthropic', side: 'L', s: -80, b: 182, w: 46, words: TX.anthropic, up: () => S.t.anthropic, down: () => S.t.mcp - 1.1 },
    { name: 'cardAndere', side: 'R', s: 34, b: 182, w: 60, words: TX.andere, up: () => S.t.andere, down: () => S.t.mcp - .95 },
  ];
  const indexCard = (x, W, H, [big, small]) => {
    layer(x, CARD, rrect(.4, .4, W - .8, H - .8, .7), { lift: .35 });
    x.fillStyle = rgba(INK, .5); x.fillRect(4, 4.2, W - 8, .22);
    const size = Math.min(6.6, ...IDX.map(c => 6.6 * (c.w - 9) / textWidth(x, c.words[0], 6.6, { weight: 900 })));
    text(x, big, W / 2, 11.6, size, { weight: 900, color: INK });
    x.fillStyle = rgba(INK, .55); x.fillRect(W / 2 - 5, 15.4, 10, .26);
    text(x, small, W / 2, 19.4, 3.3, { weight: 600, color: INK });
  };
  // A stand at rest lies flush under the page, so a card lying face down is a flat of its own (its plain back), shown
  // until the stand lifts off and again once it is down. Only the stand ever moves; nothing lies across a fold at the close.
  // The back of the card stock: uncoated, a shade darker than the printed face, with its fibres.
  const cardBack = (x, W, H) => {
    const r = rrect(.4, .4, W - .8, H - .8, W > 60 ? 1 : .7);
    layer(x, '#e9dfc8', r, { lift: .3 });
    inside(x, r, () => {
      wash(0, 0, W, H, 'rgba(255,255,255,.08)', 'rgba(120,96,60,.12)')(x);
      for (let i = 0; i < W * H / 6; i++) { x.fillStyle = rnd(201, i) > .5 ? 'rgba(150,120,80,.12)' : 'rgba(255,255,255,.14)'; x.save(); x.translate(rnd(202, i) * W, rnd(203, i) * H); x.rotate(rnd(204, i) * PI); x.fillRect(0, 0, .6 + rnd(205, i) * 1.4, .1); x.restore(); }
    });
    // The back is printed too, faintly: a double rule round the edge and, on the large card, the book's own mark.
    x.strokeStyle = rgba(INK, .26); x.lineWidth = .3; x.strokeRect(2.6, 2.6, W - 5.2, H - 5.2);
    x.strokeStyle = rgba(INK, .16); x.lineWidth = .14; x.strokeRect(3.5, 3.5, W - 7, H - 7);
    if (W > 60) mark(x, W / 2, H / 2, 8, rgba(INK, .3));
  };
  const lying = (name, side, s, b, w, h, up, down) => flatAt(name, side, s + w / 2, b + h / 2, w, h, { res: 1.6, draw(x, W, H) { cardBack(x, W, H); },
    life: t => ({ hop: .0003, show: !(t > up() + .04 && t < down() + .48) }) });
  for (const c of IDX) {
    lying(c.name + 'Back', c.side, c.s, c.b, c.w, 24, c.up, c.down);
    stand(c.name, c.side, c.s, c.b, c.w, 24, { pivot: [0, 0], res: 2, lock: .3, amp: 0, color: CARD, e: .2, draw(x, W, H) { indexCard(x, W, H, c.words); },
      life: t => { const r = riseFall(c.up(), c.down())(t); return { ...r, show: r.show && t > c.up() && t < c.down() + .55 }; } });
  }

  // ------------------------------------------------------------ the message: face down on the desk, it stands at the end
  // It stands up blank on "Code Mode ist also", while the camera comes to it; its three lines are three print runs, each
  // on its word. The card is four sheets on one hinge and one rise, blank, one line, two lines, three lines, and only
  // one of them is shown at a time, like the digits of the round counter: no line can be read before its word, not even
  // while the card stands up, and lying flat it shows only its plain back.
  const MSG = { s: 112, b: 131, w: 130, h: 52 };
  const msgUp = () => S.t.botschaft - 1.2;
  const lineAt = [() => S.t.botschaft, () => S.t.gross, () => S.t.zukunft];
  // Letterpress: each line is bitten into the stock, and the lower rim of the bite catches the light. The stressed
  // word is the same cut inked a little fuller.
  const printLine = (x, s, cx, cy, size, stress) => {
    const f = { weight: 600 }, left = cx - textWidth(x, s, size, f) / 2;
    for (const [dy, color] of [[.17, 'rgba(255,250,236,.75)'], [0, INK]]) {
      text(x, s, cx, cy + dy, size, { ...f, color });
      const i = stress ? s.indexOf(stress) : -1;
      if (i < 0) continue;
      x.save(); x.font = `600 ${size}px Fraunces`; x.textBaseline = 'middle'; x.textAlign = 'left'; x.lineJoin = 'round';
      x.strokeStyle = color; x.lineWidth = size * .034; x.strokeText(stress, left + textWidth(x, s.slice(0, i), size, f), cy + dy);
      x.restore();
    }
  };
  const messageFace = (x, W, H, n) => {
    const face = rrect(.5, .5, W - 1, H - 1, 1);
    layer(x, CARD, face, { lift: .4 });
    // Standing, it takes the lamp from above: the face a shade warmer towards the desk.
    inside(x, face, wash(0, 0, 0, H, 'rgba(255,255,255,.07)', 'rgba(120,96,60,.1)'));
    x.strokeStyle = rgba(INK, .55); x.lineWidth = .35; x.strokeRect(3, 3, W - 6, H - 6);
    x.strokeStyle = rgba(INK, .3); x.lineWidth = .16; x.strokeRect(4, 4, W - 8, H - 8);
    for (const [px, py] of [[3, 3], [W - 3, 3], [3, H - 3], [W - 3, H - 3]]) { x.fillStyle = C.cobalt; x.beginPath(); x.moveTo(px, py - 1.5); x.lineTo(px + 1.5, py); x.lineTo(px, py + 1.5); x.lineTo(px - 1.5, py); x.closePath(); x.fill(); }
    // Three short lines, the first a statement of its own, so a little more air after it.
    const size = Math.min(6.8, 6.8 * 100 / Math.max(...TX.card.map(l => textWidth(x, l, 6.8, { weight: 600 }))));
    const g1 = size * 1.62, g2 = size * 1.42, y1 = H / 2 - 3.2 - (g1 + g2) / 2, ys = [y1, y1 + g1, y1 + g1 + g2];
    for (let i = 0; i < n; i++) printLine(x, TX.card[i], W / 2, ys[i], size, i === 2 ? TX.stress : null);
    // The book's own mark under the words, small, between the last line and the rule.
    mark(x, W / 2, (ys[2] + size * .5 + H - 4) / 2 + .3, 3, rgba(INK, .5));
  };
  lying('cardBack', 'R', MSG.s, MSG.b, MSG.w, MSG.h, msgUp, () => 1e9);
  [0, 1, 2, 3].forEach(n => stand(n ? 'cardLines' + n : 'card', 'R', MSG.s, MSG.b, MSG.w, MSG.h, { pivot: [0, 0], res: 2, lock: .3, amp: 0, color: CARD, e: .2,
    draw(x, W, H) { messageFace(x, W, H, n); },
    life: t => {
      const r = rise(msgUp())(t), a = n ? lineAt[n - 1]() : msgUp(), b = n < 3 ? lineAt[n]() : 1e9, k = t - a;
      // A new line glimmers once as it comes, then the card is still.
      return { ...r, show: r.show && t > msgUp() && t >= a && t < b, glow: n ? 1 + .1 * ease(k / .15) * Math.exp(-k * 2.4) : 1 };
    } }));
  return S;
}
