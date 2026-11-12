// Der Zeichensaal: Register mit Stempel, drei Plakate, drei Drehbuecher, die Mappe mit den echten Dateien.
import { Geo, MAT } from './geo.js';
import { M, PI, TAU, clamp, mix, smooth, hash, lin } from './m.js';
import { part, many, canvas, paperGround, wrap, cue, cueE, INK, bump } from './kit.js';
import * as P from './props.js';
import { ROOM, R } from './house.js';

const ID = ROOM.ZEICHEN, FL = 10.8;
export const BOARD = { x: 1.95, y: FL + 1.03, z: -2.12, w: 2.1, d: 1.2, tilt: .6 };
export const POSTER = { y: FL + 1.68, z: -3.54, w: .78, h: 1.1, xs: [3.72, 4.66, 5.6] };
export const STACKS = { top: FL + .84, z: -2.4, xs: [6.5, 6.95, 7.4], w: .3, d: .42 };
export const TRAY = { x0: 3.3, x1: 6.0, y: FL + .62, z: -3.3 };
const TABS = ['brief.md', 'research.md', 'concepts.md', 'direction.md', 'script.md', 'voice.md', 'beats.md', 'video.json', 'scenes/', 'audio/', 'renders/'];
export const SCRIPT_TAB = 4;
export const tabX = i => TRAY.x0 + .12 + i * (TRAY.x1 - TRAY.x0 - .24 - .24) / (TABS.length - 1) + .12;

// Echte Zeilen aus research.md.
const REG = [
  ['C2', 'Jede Website ist Code. Der Browser macht daraus Bilder.', 'scenes/film.html'],
  ['C3', 'Ein kleines Programm stellt die Zeit ein und fotografiert.', 'src/renderer.rs'],
  ['C4', 'Am Ende klebt es die Fotos aneinander.', 'src/renderer.rs'],
  ['C5', 'Jedes Bild ist eine reine Funktion der Zeit.', 'runtime/scene.js'],
  ['C7', 'KI-Videos: Änderung heißt im Zweifel neu erzeugen.', 'Web, 3 Quellen'],
  ['C12', 'Claude Code steckt im Abo und in der Desktop-App.', 'support.claude.com'],
  ['C13', 'HyperFrames ist kostenlos und von HeyGen.', 'github.com/heygen-com'],
  ['C17', 'Dieses Haus ist nicht gefilmt und kein KI-Bild.', 'scenes/'],
];
const ROW0 = 330, ROWH = 186;

function paintRegister() {
  return canvas(2048, 1170, (x, w, h) => {
    paperGround(x, w, h, '#ece4cf', 21);
    x.fillStyle = INK; x.textBaseline = 'alphabetic';
    x.font = '700 74px "Courier Prime"'; x.fillText('research.md', 90, 120);
    x.font = '400 44px "Courier Prime"'; x.fillStyle = 'rgba(27,26,30,.65)'; x.fillText('Jede Behauptung. Jeder Beleg.', 90, 186);
    x.strokeStyle = 'rgba(27,26,30,.75)'; x.lineWidth = 4; x.beginPath(); x.moveTo(90, 232); x.lineTo(w - 90, 232); x.stroke();
    REG.forEach((rw, i) => {
      const y = ROW0 + i * ROWH * .52;
      x.fillStyle = 'rgba(27,26,30,.55)'; x.font = '700 40px "Courier Prime"'; x.fillText(rw[0], 90, y);
      x.fillStyle = INK; x.font = '400 42px "Courier Prime"'; x.fillText(rw[1], 200, y);
      x.fillStyle = 'rgba(27,26,30,.55)'; x.font = '400 30px "Courier Prime"'; x.fillText(rw[2], 200, y + 36);
      x.strokeStyle = 'rgba(27,26,30,.16)'; x.lineWidth = 2; x.beginPath(); x.moveTo(90, y + 56); x.lineTo(w - 90, y + 56); x.stroke();
    });
  });
}
const rowV = i => (ROW0 + i * ROWH * .52 - 14) / 1170;

function posterA() {
  return canvas(1024, 1448, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#101a33'); g.addColorStop(1, '#070a14'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    // Aufgeschnittenes Haus, wie im Film.
    const hx = 170, hy = 330, hw = 684, fh = 124;
    x.fillStyle = '#05060a'; x.beginPath(); x.moveTo(hx - 24, hy + fh * 4 + 40); x.lineTo(hx - 24, hy); x.lineTo(hx + hw / 2, hy - 120); x.lineTo(hx + hw + 24, hy); x.lineTo(hx + hw + 24, hy + fh * 4 + 40); x.fill();
    const cols = [['#10392f', '#c56a5d'], ['#0f2a33', '#b1801f', '#7a5a1e'], ['#3a1a3f', '#0b2fb0'], ['#c56a5d', '#5e0f14']];
    cols.forEach((row, j) => { const n = row.length, cw = hw / n; row.forEach((c, i) => { x.fillStyle = c; x.fillRect(hx + i * cw + 7, hy + j * fh + 7, cw - 14, fh - 14); x.fillStyle = 'rgba(255,220,150,.75)'; x.beginPath(); x.arc(hx + (i + .5) * cw, hy + j * fh + 26, 6, 0, TAU); x.fill(); }); });
    x.fillStyle = '#efe8d8'; x.font = '900 112px Fraunces'; x.textBaseline = 'alphabetic';
    x.fillText('Das Haus,', 70, 1020); x.fillText('das es', 70, 1130); x.fillText('nicht gibt', 70, 1240);
    x.font = '500 34px Jost'; x.fillStyle = '#c49b49'; x.fillText('KONZEPT A', 74, 1350);
  });
}
function posterB() {
  return canvas(1024, 1448, (x, w, h) => {
    x.fillStyle = '#16140f'; x.fillRect(0, 0, w, h);
    // Bleilettern: spiegelverkehrt, in Reihen.
    x.save(); x.translate(w, 0); x.scale(-1, 1);
    const L = 'BLEISATZ'; x.font = '900 190px Fraunces'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) {
      const cx = 140 + (i % 4) * 248, cy = 170 + Math.floor(i / 4) * 262;
      const g = x.createLinearGradient(cx - 110, cy - 120, cx + 110, cy + 120); g.addColorStop(0, '#6a6f78'); g.addColorStop(1, '#30333a');
      x.fillStyle = g; x.fillRect(cx - 112, cy - 120, 224, 240);
      x.fillStyle = '#c2c7cf'; x.fillText(L[i % L.length], cx, cy + 6);
    }
    x.restore();
    x.fillStyle = '#efe8d8'; x.font = '900 140px Fraunces'; x.textBaseline = 'alphabetic'; x.fillText('Bleisatz', 70, 1200);
    x.font = '500 34px Jost'; x.fillStyle = '#c49b49'; x.fillText('KONZEPT B', 74, 1350);
  });
}
function posterC() {
  return canvas(1024, 1448, (x, w, h) => {
    x.fillStyle = '#4b2d17'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) { x.strokeStyle = `rgba(20,10,4,${.05 + hash(i) * .12})`; x.lineWidth = 1 + hash(i + 3) * 5; x.beginPath(); const y = hash(i * 1.7) * h; x.moveTo(0, y); x.bezierCurveTo(w * .3, y + 30 * Math.sin(i), w * .7, y - 30 * Math.cos(i), w, y + 14 * Math.sin(i * 3)); x.stroke(); }
    // Von oben: Tasse und ein Blatt
    x.save(); x.translate(240, 300); x.rotate(-.14); x.fillStyle = '#e9e1cd'; x.fillRect(0, 0, 420, 560); x.fillStyle = 'rgba(27,26,30,.45)'; for (let i = 0; i < 12; i++) x.fillRect(40, 50 + i * 40, 280 + hash(i) * 60, 10); x.restore();
    x.fillStyle = '#efe8d8'; x.beginPath(); x.arc(760, 320, 120, 0, TAU); x.fill(); x.fillStyle = '#efe8d8'; x.fillRect(860, 300, 60, 34); x.fillStyle = '#2a170c'; x.beginPath(); x.arc(760, 320, 92, 0, TAU); x.fill();
    x.fillStyle = '#efe8d8'; x.font = '900 180px Fraunces'; x.textBaseline = 'alphabetic'; x.fillText('Der', 70, 1090); x.fillText('Tisch', 70, 1240);
    x.font = '500 34px Jost'; x.fillStyle = '#c49b49'; x.fillText('KONZEPT C', 74, 1350);
  });
}
function draftPage(n, lines) {
  return canvas(1024, 1024, (x, w, h) => {
    paperGround(x, w, h, '#efe8d8', 40 + n);
    x.fillStyle = 'rgba(27,26,30,.65)'; x.font = '700 58px "Courier Prime"'; x.fillText(`Drehbuch ${n}`, 70, 110);
    x.fillStyle = INK; x.font = '400 50px "Courier Prime"';
    let y = 210; for (const l of lines) { for (const t of wrap(x, l, w - 140)) { x.fillText(t, 70, y); y += 66; } y += 30; }
  });
}

export function buildZeichen(ctx) {
  const { E, rooms, light, still } = ctx;
  const r = R.ZEICHEN, g = new Geo(); g.s({ room: ID });
  P.roomShell(g, r, { wallC: '#8a6520', wallM: MAT.wallC, wallR: .68, floorC: '#5e3c20', floorR: .36, ceilC: '#d8c9a4' });
  P.wainscot(g, r.x0, r.x1, FL, .46, r.z0, 14, { c: '#3e2711' });
  g.with({ c: '#e4d8bc', r: .6 }, () => g.at([(r.x0 + r.x1) / 2, r.y1 - .05, r.z0 + .05], () => g.rbox(7.6, .1, .1, .02)));

  // ---------------------------------------------------- Zeichenbrett
  const B = BOARD;
  const boardM = M.mul(M.T(B.x, B.y, B.z), M.RX(B.tilt));
  g.at([B.x, B.y, B.z], [B.tilt, 0, 0], () => {
    g.with({ c: '#caa86e', mat: MAT.wood, r: .34, grain: 1 }, () => g.rbox(B.w + .1, .035, B.d + .1, .006, 2));
    g.with({ c: '#ffffff', tex: E.addDoc(paintRegister()), mat: MAT.paper, r: .85 }, () => g.at([0, .0195, 0], () => g.sheet(B.w * .96, B.d * .96, 1, 1)));
    // Reissschiene und Schiene fuer den Stempel
    g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .26 }, () => { g.at([0, .05, -B.d / 2 - .02], [0, 0, PI / 2], () => g.cyl(.012, B.w + .12, 12)); for (const s of [-1, 1]) g.at([s * (B.w / 2 + .06), .03, -B.d / 2 - .02], () => g.rbox(.04, .05, .04, .006)); });
    g.with({ c: '#e8e3d2', r: .35 }, () => g.at([0, .03, B.d / 2 + .02], () => g.rbox(B.w, .012, .03, .004)));
  });
  g.with({ c: '#2a1a0e', mat: MAT.wood, r: .3 }, () => {
    for (const s of [-1, 1]) {
      g.tube([[B.x + s * .9, FL, B.z - .66], [B.x + s * .9, B.y + .3, B.z - .52]], .026, 8);
      g.tube([[B.x + s * .9, FL, B.z + .62], [B.x + s * .9, B.y - .38, B.z + .46]], .026, 8);
    }
    g.at([B.x, FL + .34, B.z - .1], [0, 0, PI / 2], () => g.cyl(.018, 1.8, 8));
  });
  // Stifte, Lineal, Lampe mit Federarm
  g.with({ c: '#2a2c30', mat: MAT.brushed, m: 1, r: .4 }, () => { g.tube([[.62, r.y0 + 1.7, -3.5], [.72, FL + 2.3, -3.0], [1.25, FL + 2.45, -2.6], [1.6, FL + 2.2, -2.2]], .012, 8); g.at([1.62, FL + 2.13, -2.18], [.5, 0, -.25], () => g.lathe([[.016, .05], [.03, .05], [.13, -.09], [.135, -.09]], 26)); });
  g.with({ c: '#ffe4b0', e: 22 }, () => g.at([1.62, FL + 2.1, -2.18], () => g.sphere(.03, 10, 8)));
  // Pinnwand mit der Stilvorlage
  g.with({ c: '#7b5a35', mat: MAT.fabric, r: .95 }, () => g.at([1.95, FL + 2.0, r.z0 + .012], () => g.card(2.2, 1.0)));
  g.with({ c: '#2a1a0e', mat: MAT.wood, r: .3 }, () => { for (const [x, y, w, h] of [[1.95, FL + 2.52, 2.26, .04], [1.95, FL + 1.48, 2.26, .04], [.83, FL + 2, .04, 1.04], [3.07, FL + 2, .04, 1.04]]) g.at([x, y, r.z0 + .02], () => g.rbox(w, h, .03, .006)); });
  const pins = [[1.2, FL + 2.05, .62, .4, still.stil1, -.03], [1.95, FL + 2.1, .62, .4, still.stil2, .02], [2.7, FL + 2.02, .62, .4, still.stil3, -.015], [1.45, FL + 1.68, .3, .2, still.luft, .04], [2.45, FL + 1.68, .3, .2, still.kinder, -.05]];
  for (const [x, y, w, h, tx, a] of pins) {
    g.at([x, y, r.z0 + .018], [0, 0, a], () => { g.with({ c: '#efe7d4', mat: MAT.paper, r: .8 }, () => g.card(w + .03, h + .03)); g.with({ c: '#ffffff', tex: tx, r: .6 }, () => g.at([0, 0, .001], () => g.card(w, h))); g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .3 }, () => g.at([0, h / 2, .006], () => g.sphere(.012, 8, 6))); });
  }
  // Rollenkorb
  g.at([.86, FL, -3.1], () => {
    g.with({ c: '#2a2c30', mat: MAT.brushed, m: 1, r: .5 }, () => g.lathe([[.16, 0], [.19, .7], [.185, .7], [.15, .02], [0, .02], [0, 0]], 20));
    for (let i = 0; i < 7; i++) { const a = i * 2.2; g.with({ c: i % 2 ? '#ddd4bd' : '#b8ad92', mat: MAT.paper, r: .8 }, () => g.at([Math.cos(a) * .07, .55 + hash(i) * .25, Math.sin(a) * .07], [Math.sin(a) * .06, 0, Math.cos(a) * .06], () => g.cyl(.03, 1.0, 12))); }
  });
  // Hocker am Brett
  g.at([B.x + .55, FL, -1.02], () => { g.with({ c: '#2a1a0e', mat: MAT.wood, r: .3 }, () => { g.at([0, .68, 0], () => g.rcyl(.17, .04, .01, 22)); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; g.tube([[Math.cos(a) * .1, .66, Math.sin(a) * .1], [Math.cos(a) * .2, 0, Math.sin(a) * .2]], .012, 6); } }); });

  // ---------------------------------------------------- Plakatwand und Sideboard
  g.with({ c: '#7a5a38', mat: MAT.wood, r: .34 }, () => { g.at([4.66, FL + .31, -3.28], () => g.rbox(3.0, .62, .62, .01, 2)); });
  g.with({ c: '#2a1a0e', mat: MAT.wood, r: .3 }, () => { for (let i = 0; i < 3; i++) g.at([3.66 + i, FL + .31, -2.965], () => g.rbox(.92, .54, .012, .004)); });
  g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .3 }, () => { for (let i = 0; i < 3; i++) g.at([3.66 + i, FL + .36, -2.95], () => g.rbox(.2, .018, .02, .006)); });
  // Messingleiste fuer die Plakate und Klammern
  g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .28 }, () => {
    g.at([4.66, POSTER.y + POSTER.h / 2 + .03, r.z0 + .03], [0, 0, PI / 2], () => g.cyl(.012, 2.95, 10));
    for (const x of POSTER.xs) for (const s of [-1, 1]) g.at([x + s * .28, POSTER.y + POSTER.h / 2 + .012, r.z0 + .05], () => g.rbox(.05, .05, .02, .006));
  });
  // Die Mappe: Haengeregister mit echten Reitern
  const tabDoc = E.addDoc(canvas(2048, 2048, (x, w, h) => {
    x.fillStyle = '#c9b786'; x.fillRect(0, 0, w, h);
    TABS.forEach((t, i) => { const cy = i * (h / 12); x.fillStyle = '#d6c592'; x.fillRect(0, cy + 2, w / 4, h / 12 - 4); x.fillStyle = INK; x.font = '700 72px "Courier Prime"'; x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillText(t, w / 8, cy + h / 24 + 3); });
  }));
  const T = TRAY, FW = T.x1 - T.x0, FH = .36;
  g.with({ c: '#2a1a0e', mat: MAT.wood, r: .32 }, () => {
    g.at([(T.x0 + T.x1) / 2, T.y + .05, -2.98], () => g.rbox(FW + .1, .1, .03, .006));
    g.at([(T.x0 + T.x1) / 2, T.y + .05, -3.56 + .02], () => g.rbox(FW + .1, .1, .03, .006));
    g.at([T.x0 - .03, T.y + .05, -3.27], () => g.rbox(.03, .1, .56, .006));
    g.at([T.x1 + .03, T.y + .05, -3.27], () => g.rbox(.03, .1, .56, .006));
  });
  const brass = E.addDoc(canvas(1024, 192, (x, w, h) => { x.fillStyle = '#b89a55'; x.fillRect(0, 0, w, h); x.fillStyle = '#16120a'; x.font = '700 92px "JetBrains Mono"'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('videos-aus-code/', w / 2, h / 2 + 4); }));
  g.with({ c: '#ffffff', tex: brass, mat: MAT.plain, r: .32 }, () => g.at([(T.x0 + T.x1) / 2, T.y + .05, -2.962], () => g.card(.92, .082)));
  const FOLDC = ['#a58f58', '#9c8650', '#ac9860', '#94804c'];
  const folderZ = i => -3.03 - (TABS.length - 1 - i) * .042;
  const fm = i => FOLDC[i % 4];
  TABS.forEach((t, i) => {
    if (i === SCRIPT_TAB) return;
    const z = folderZ(i);
    g.with({ c: fm(i), mat: MAT.paper, r: .85 }, () => { g.at([(T.x0 + T.x1) / 2, T.y + FH / 2 + .02, z], () => g.card(FW - .04, FH)); });
    g.with({ c: '#ffffff', tex: tabDoc, mat: MAT.paper, r: .85 }, () => g.at([tabX(i), T.y + FH + .055, z], () => g.card(.208, .062, [0, i / 12, .25, (i + 1) / 12])));
  });

  // ---------------------------------------------------- Tisch fuer die Drehbuecher, mit zwei Falltueren
  const S = STACKS, flapW = S.w + .06, flapD = S.d + .06;
  g.at([6.95, 0, S.z], () => {
    g.with({ c: '#5e3c20', mat: MAT.wood, r: .32, grain: 1 }, () => {
      const y = S.top - .02, xL = -.45 - flapW / 2, xR = .45 + flapW / 2, hz = flapD / 2;
      // Platte mit zwei Loechern: aus Streifen gebaut
      g.at([0, y, -(hz + .1)], () => g.rbox(1.6, .04, .2, .006)); g.at([0, y, hz + .1], () => g.rbox(1.6, .04, .2, .006));
      g.at([0, y, 0], () => g.rbox(.45 * 2 - flapW, .04, flapD, .004));
      g.at([xL - .06, y, 0], () => g.rbox(.11, .04, flapD, .004)); g.at([xR + .06, y, 0], () => g.rbox(.11, .04, flapD, .004));
    });
    g.with({ c: '#2a1a0e', mat: MAT.wood, r: .3 }, () => { for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.at([sx * .74, FL + .4, sz * .42], () => g.cyl(.024, .8, 10, .018)); });
    for (const s of [-1, 1]) g.at([s * .45, FL, 0], () => g.with({ c: '#26272c', mat: MAT.brushed, m: 1, r: .5 }, () => g.lathe([[.2, 0], [.24, .5], [.235, .5], [.195, .02], [0, .02], [0, 0]], 24)));
  });
  // Der Reststapel Papier, der schon im Korb liegt.
  // ---------------------------------------------------- Lampen
  P.pendant(g, 1.95, r.y1, -1.5, .55, '#1f2a24', '#ffe0ae');
  P.pendant(g, 4.66, r.y1, -2.3, .42, '#1f2a24', '#ffe0ae');
  P.pendant(g, 6.95, r.y1, -2.0, .55, '#1f2a24', '#ffe0ae');
  E.addStatic(g, ID);
  rooms[ID] = { up: lin('#caa058').map(v => v * .42), dn: lin('#6a4a24').map(v => v * .36), fill: [.13, .105, .06], power: 1, gloss: .85, min: [r.x0, r.y0, r.z0], max: [r.x1, r.y1, r.z1] };
  light(ID, r, { pos: [1.95, r.y1 - .72, -1.5], dir: [0, -1, -.12], angle: 1.25, inner: .8, color: [10.5, 9.4, 7], range: 7, size: .14, haze: .0028 });
  light(ID, r, { pos: [4.66, r.y1 - .58, -1.9], dir: norm([0, -.62, -1]), angle: .98, inner: .62, color: [10, 9, 6.8], range: 7, size: .14, haze: .0028 });
  light(ID, r, { pos: [6.95, r.y1 - .72, -2.0], dir: [0, -1, -.1], angle: 1.25, inner: .8, color: [10.5, 9.4, 7], range: 7, size: .14, haze: .0028 });
  light(ID, r, { pos: [1.62, FL + 2.08, -2.18], dir: norm([.25, -1, .2]), angle: 1.1, inner: .7, color: [2.2, 1.9, 1.4], range: 3, size: .05, bias: .002 });

  // ---------------------------------------------------- Bewegtes: Stempel
  const stampDoc = E.addDoc(canvas(512, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.strokeStyle = '#1c3166'; x.lineWidth = 12; x.strokeRect(14, 14, w - 28, h - 28);
    x.fillStyle = '#1c3166'; x.font = '700 120px Jost'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('BELEG', w / 2, h / 2 + 6);
    x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(0,0,0,${hash(i) * .5})`; x.fillRect(hash(i * 3.1) * w, hash(i * 7.7) * h, 4 + hash(i) * 6, 2 + hash(i * 2) * 4); }
  }));
  const imprint = many(E, ID, 8, gg => { gg.s({ c: '#ffffff', r: .6, flag: 1 | 16, tex: stampDoc }); gg.sheet(.3, .12, 1, 1); });
  imprint.shadowRoom = -99;
  const T0 = cue(13, 'jede'), TE = cueE(13, 'Beleg');
  const STAMPS = [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ t: mix(T0, TE, i / 7.2) + .05, u: 1.0 - .48, v: rowV(i) }));
  const sX = i => (STAMPS[i].u + .28 - .5) * B.w * .96, sZ = i => (STAMPS[i].v - .5) * B.d * .96;
  const carriage = part(E, ID, gg => {
    gg.s({ c: '#26272c', mat: MAT.brushed, m: 1, r: .35 });
    gg.at([0, .05, 0], () => gg.rbox(.1, .05, .06, .008));
    gg.at([0, .082, .5], () => gg.rbox(.03, .016, 1, .004));
  });
  const head = part(E, ID, gg => {
    gg.with({ c: '#2a160c', mat: MAT.wood, r: .3 }, () => { gg.at([0, .17, 0], () => gg.lathe([[0, -.06], [.028, -.06], [.02, -.02], [.034, .03], [.02, .06], [0, .065]], 16)); });
    gg.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .25 }, () => gg.at([0, .09, 0], () => gg.rbox(.16, .04, .08, .006)));
    gg.with({ c: '#1c3166', r: .7 }, () => gg.at([0, .012, 0], () => gg.rbox(.3, .024, .12, .004)));
    gg.with({ c: '#26272c', mat: MAT.brushed, m: 1, r: .35 }, () => gg.at([0, .18, 0], () => gg.cyl(.008, .3, 8)));
  });
  function stampState(ts) {
    let i = 0; for (let k = 0; k < STAMPS.length; k++) if (ts >= STAMPS[k].t - .02) i = k;
    const a = STAMPS[i], b = STAMPS[Math.min(i + 1, STAMPS.length - 1)];
    const u = smooth(a.t + .05, b.t - .05, ts);
    let x = mix(sX(i), sX(Math.min(i + 1, 7)), u), z = mix(sZ(i), sZ(Math.min(i + 1, 7)), u);
    if (ts < STAMPS[0].t - .05) { const v = smooth(cue(13, 'recherchiere'), STAMPS[0].t - .1, ts); x = mix(B.w * .4, sX(0), v); z = mix(-B.d * .4, sZ(0), v); }
    if (ts > STAMPS[7].t + .1) { const v = smooth(STAMPS[7].t + .1, STAMPS[7].t + .8, ts); x = mix(sX(7), B.w * .4, v); z = mix(sZ(7), -B.d * .4, v); }
    let press = 1;
    for (const s of STAMPS) { const d = ts - s.t; if (d > -.07 && d < .1) press = Math.min(press, Math.abs(d < 0 ? d / .07 : d / .1)); }
    return { x, z, h: .022 + press * .1 };
  }

  // Plakate
  const docsP = [E.addDoc(posterA()), E.addDoc(posterB()), E.addDoc(posterC())];
  const poster = many(E, ID, 3, gg => { gg.s({ c: '#ffffff', mat: MAT.paper, r: .7 }); gg.card(POSTER.w, POSTER.h); });
  const xDoc = E.addDoc(canvas(1024, 128, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.strokeStyle = '#111014'; x.lineCap = 'round';
    for (let k = 0; k < 4; k++) { x.lineWidth = 26 - k * 5; x.globalAlpha = .92 - k * .15; x.beginPath(); for (let i = 0; i <= 80; i++) { const u = i / 80, px = 18 + u * (w - 36), py = h * .5 + Math.sin(u * 9 + k) * 5 + (k - 1.5) * 5; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
  }));
  const crosses = many(E, ID, 4, gg => { gg.s({ c: '#ffffff', r: .5, flag: 1 | 16, tex: xDoc }); gg.card(1, 1); });
  crosses.shadowRoom = -99;
  const tX = cue(13, 'zwei') - .32, tOut = cue(13, 'fliegen');
  const posterM = (i, ts) => {
    const x = POSTER.xs[i], base = [x, POSTER.y, POSTER.z];
    if (i === 0) return M.T(base[0], base[1], base[2]);
    const d = ts - tOut - (i === 2 ? .09 : 0); if (d <= 0) return M.T(base[0], base[1], base[2]);
    const dur = .66, u = clamp(d / dur);
    const y = mix(POSTER.y, FL + .006 + .006 * i, u * u), z = mix(POSTER.z, -2.3 - i * .09, Math.pow(u, .7)), rx = (PI / 2 + .0) * Math.pow(u, 1.2) * (-1) * -1, rz = (i === 1 ? .22 : -.31) * u, dx = (i === 1 ? -.18 : .22) * u;
    return M.mul(M.T(x + dx, y + bump(ts, tOut + (i === 2 ? .09 : 0) + dur, .22) * .03, z), M.mul(M.RY(rz), M.RX(-PI / 2 * Math.pow(u, 1.2))));
  };
  // Drehbuecher
  const pageDocs = [
    draftPage(1, ['Erst Auftrag, dann Recherche, dann Konzept, dann Skript. Eine Maschine, Schritt für Schritt.']),
    draftPage(2, ['Diesen Tisch gibt es nicht. Das Zimmer auch nicht.', 'Das hier ist Code.']),
    draftPage(3, ['Mein erster Film war schlecht. Das hier ist die Geschichte meiner Fehler.']),
  ].map(c => E.addDoc(c));
  const stack = many(E, ID, 3, gg => { gg.s({ c: '#e9e1cd', mat: MAT.paper, r: .8 }); gg.rbox(S.w, .05, S.d, .002); });
  const top = many(E, ID, 3, gg => { gg.s({ c: '#ffffff', mat: MAT.paper, r: .8 }); gg.sheet(S.w, S.d, 1, 1); });
  top.shadowRoom = -99;
  const flapL = part(E, ID, gg => { gg.s({ c: '#5e3c20', mat: MAT.wood, r: .32 }); gg.at([flapW / 2, 0, 0], () => gg.rbox(flapW, .03, flapD, .003)); });
  const flapR = part(E, ID, gg => { gg.s({ c: '#5e3c20', mat: MAT.wood, r: .32 }); gg.at([-flapW / 2, 0, 0], () => gg.rbox(flapW, .03, flapD, .003)); });
  const tDrop = cue(13, 'nur') - .1;
  const stackY = (i, ts) => { if (i === 1) return S.top + .025; const d = ts - tDrop - (i === 2 ? .12 : 0) - .06; if (d <= 0) return S.top + .025; return Math.max(FL + .05, S.top + .025 - 4.9 * d * d); };
  // Echter Text im gehobenen Reiter
  // Das Blatt ist 1.8 breit und .338 hoch. Die Leinwand hat dasselbe Format, sonst steht die Schrift gestaucht da.
  const scriptPage = E.addDoc(canvas(2724, 512, (x, w, h) => {
    paperGround(x, w, h, '#efe8d8', 77);
    x.fillStyle = 'rgba(27,26,30,.6)'; x.font = '700 40px "Courier Prime"'; x.fillText('script.md', 60, 62);
    x.fillStyle = INK; x.font = '400 44px "Courier Prime"';
    ['Diesen Tisch gibt es nicht. Das Zimmer auch nicht.', 'Das Haus schon gar nicht.', 'Niemand hat das gefilmt. Niemand hat es gezeichnet.', 'Und nein, das kommt auch nicht aus einem KI-Videogenerator.', 'Das hier ist Code.'].forEach((l, i) => x.fillText(l, 60, 132 + i * 66));
  }));
  const liftF = part(E, ID, gg => {
    gg.with({ c: fm(SCRIPT_TAB), mat: MAT.paper, r: .85 }, () => gg.card(FW - .04, FH));
    gg.with({ c: '#ffffff', tex: scriptPage, mat: MAT.paper, r: .85 }, () => gg.at([0, .0, .004], () => gg.card(FW - .9, FH * .94)));
    gg.with({ c: '#ffffff', tex: tabDoc, mat: MAT.paper, r: .85 }, () => gg.at([tabX(SCRIPT_TAB) - (T.x0 + T.x1) / 2, FH / 2 + .035, 0], () => gg.card(.208, .062, [0, SCRIPT_TAB / 12, .25, (SCRIPT_TAB + 1) / 12])));
  });
  const tLift = cue(13, 'kannst');

  const wire = [];
  ctx.zeichenCam = { boardM, tDrop };
  return {
    sub(ts) {
      // Stempel
      const st = stampState(ts);
      carriage.set(M.mul(boardM, M.T(st.x, 0, -B.d / 2 - .02)));
      head.set(M.mul(boardM, M.T(st.x, .02 + st.h, st.z)));
      imprint.begin();
      STAMPS.forEach((s, i) => {
        if (ts < s.t) return;
        const a = (hash(i * 3.7) - .5) * .09;
        imprint.push(M.mul(M.mul(boardM, M.T(sX(i), .0205 + i * .00002, sZ(i))), M.RY(a)), [0, 0, 0, 0], [1, 1, 0, 0], [stampDoc, ID, 1, 1]);
      });
      imprint.end();
      // Plakate und Kreuze
      poster.begin();
      for (let i = 0; i < 3; i++) poster.push(posterM(i, ts), [0, 0, 0, 0], [1, 1, 0, 0], [docsP[i], ID, 1, 1]);
      poster.end();
      crosses.begin();
      for (let i = 1; i < 3; i++) for (let k = 0; k < 2; k++) {
        const t0 = tX + (i - 1) * .17 + k * .08, p = clamp((ts - t0) / .1); if (p <= 0) continue;
        const a = (k ? -1 : 1) * Math.atan2(POSTER.h, POSTER.w) * .86, L = Math.hypot(POSTER.w, POSTER.h) * .92;
        crosses.push(M.mul(posterM(i, ts), M.mul(M.T(0, 0, .004 + k * .001), M.mul(M.RZ(a), M.mul(M.T(-L / 2 + L * p / 2, 0, 0), M.S(L * p, .085, 1))))), [0, 0, 0, 0], [p, 1, 0, 0], [xDoc, ID, 1, 1]);
      }
      crosses.end();
      // Drehbuecher
      stack.begin(); top.begin();
      for (let i = 0; i < 3; i++) {
        const y = stackY(i, ts), x = S.xs[i];
        stack.push(M.T(x, y, S.z), [0, 0, 0, 0], [1, 1, 0, 0], [-1, ID, 1, 1]);
        top.push(M.T(x, y + .0255, S.z), [0, 0, 0, 0], [1, 1, 0, 0], [pageDocs[i], ID, 1, 1]);
      }
      stack.end(); top.end();
      const fo = smooth(tDrop, tDrop + .12, ts);
      flapL.set(M.mul(M.T(S.xs[0] - flapW / 2, S.top - .02, S.z), M.RZ(-fo * 1.45)));
      flapR.set(M.mul(M.T(S.xs[2] + flapW / 2, S.top - .02, S.z), M.RZ(fo * 1.45)));
      // Der Reiter, den du jederzeit lesen kannst.
      const l = smooth(tLift, tLift + .7, ts);
      liftF.set(M.T((T.x0 + T.x1) / 2, T.y + FH / 2 + .02 + l * .3, folderZ(SCRIPT_TAB)));
    },
  };
}
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
