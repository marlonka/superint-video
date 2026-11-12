// Der Schneideraum: Leuchttisch, Lupe, meine gruenen Haken. Dann kommt Marlons Stift.
import { Geo, MAT } from './geo.js';
import { M, PI, TAU, clamp, mix, smooth, hash, lin, sampleKeys } from './m.js';
import { part, many, canvas, cue, cueE, RED, bump, INK } from './kit.js';
import * as P from './props.js';
import { ROOM, R } from './house.js';
import { STATION, capsuleGeo } from './foyer.js';

const ID = ROOM.SCHNITT, FL = 3.6;
export const TABLE = { x0: -7.62, x1: -.72, z0: -3.15, z1: -2.0, top: FL + .9 };
const ZC = (TABLE.z0 + TABLE.z1) / 2;
export const PRINT = { luft: { x: -5.6, w: .84 }, kinder: { x: -4.0, w: .84 }, laut: { x: -2.86, w: .96 }, frau: { x: -1.62, w: 1.08 } };
export const SHEETS = [{ x: -7.2, w: .66 }, { x: -6.5, w: .66 }];
export const WIN = { x: -1.1, y: FL + 1.05, w: 1.25, h: 1.85 };
export const TUBE2 = { x: -7.84, z: -.62 };

function verdict(txt, wMeters) {
  return canvas(1024, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.fillStyle = RED; x.textBaseline = 'middle'; x.textAlign = 'center';
    let fs = 190; x.font = `700 ${fs}px Caveat`; const mw = x.measureText(txt).width; fs = Math.min(190, fs * (w - 50) / mw); x.font = `700 ${fs}px Caveat`;
    x.fillText(txt, w / 2, h * .52);
  });
}

export function buildSchnitt(ctx) {
  const { E, rooms, light, still, stillImg, thumbs, thumbFull } = ctx;
  const r = R.SCHNITT, g = new Geo(); g.s({ room: ID });
  const T = TABLE, TW = T.x1 - T.x0, TD = T.z1 - T.z0;
  P.roomShell(g, r, { wallC: '#3a1a3f', wallM: MAT.wallA, wallR: .66, floorC: '#1b1218', floorM: MAT.parquet, floorR: .4, ceilC: '#2a1430', noBack: true });
  g.with({ c: '#3a1a3f', mat: MAT.wallA, r: .66 }, () => P.wallWithHoles(g, r.x0, r.x1, r.y0, r.y1, r.z0, [WIN]));
  P.windowFrame(g, WIN.x, WIN.y, WIN.w, WIN.h, r.z0 - .1);
  // Vorhaenge am Fenster, dunkel
  for (const s of [-1, 1]) g.with({ c: '#1a0b1c', mat: MAT.fabric, r: .95 }, () => {
    const cx = WIN.x + s * (WIN.w / 2 + .14), top = r.y1 - .12, bot = FL + .12, n = 16, a = [], b = [];
    for (let i = 0; i <= n; i++) { const u = i / n, x = cx + (u - .5) * .36, z = r.z0 + .16 + Math.sin(u * TAU * 3) * .04, nx = -Math.cos(u * TAU * 3) * .55; a.push(g.v([x, bot, z], [nx, 0, 1], u, 1)); b.push(g.v([x, top, z], [nx, 0, 1], u, 0)); }
    for (let i = 0; i < n; i++) g.quad(a[i], a[i + 1], b[i + 1], b[i]);
  });
  // ---------------------------------------------------- Der Leuchttisch
  g.with({ c: '#20141f', mat: MAT.wood, r: .32 }, () => {
    g.at([(T.x0 + T.x1) / 2, T.top - .05, T.z0 - .03], () => g.rbox(TW + .1, .1, .06, .01));
    g.at([(T.x0 + T.x1) / 2, T.top - .05, T.z1 + .03], () => g.rbox(TW + .1, .1, .06, .01));
    g.at([T.x0 - .03, T.top - .05, (T.z0 + T.z1) / 2], () => g.rbox(.06, .1, TD + .12, .01));
    g.at([T.x1 + .03, T.top - .05, (T.z0 + T.z1) / 2], () => g.rbox(.06, .1, TD + .12, .01));
    for (let i = 0; i <= 5; i++) for (const z of [T.z0 + .08, T.z1 - .08]) g.at([T.x0 + .1 + i * (TW - .2) / 5, FL + .42, z], () => g.rbox(.08, .84, .08, .01));
    g.at([(T.x0 + T.x1) / 2, FL + .2, (T.z0 + T.z1) / 2], () => g.rbox(TW - .2, .04, TD - .25, .006));
  });
  const glassE = .5;
  // Mattglas mit Raster, wie auf jedem Leuchttisch: Alle zehn Zentimeter ein Strich, alle halben Meter eine Zahl.
  const gridDoc = E.addDoc(canvas(2048, Math.round(2048 * TD / TW), (x, w, h) => {
    const pm = w / TW; x.fillStyle = '#f6f2e6'; x.fillRect(0, 0, w, h);
    for (let i = 0; i * .1 < TW; i++) { const X = i * .1 * pm, big = i % 5 === 0; x.strokeStyle = big ? 'rgba(60,70,90,.3)' : 'rgba(60,70,90,.12)'; x.lineWidth = big ? 1.6 : 1; x.beginPath(); x.moveTo(X, 0); x.lineTo(X, h); x.stroke(); }
    for (let i = 0; i * .1 < TD; i++) { const Y = i * .1 * pm; x.strokeStyle = 'rgba(60,70,90,.12)'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, Y); x.lineTo(w, Y); x.stroke(); }
  }));
  g.with({ c: '#ffffff', tex: gridDoc, flag: 8, e: glassE, r: .22, mat: MAT.plain }, () => g.at([(T.x0 + T.x1) / 2, T.top - .004, (T.z0 + T.z1) / 2], () => g.sheet(TW, TD, 1, 1)));
  // Fuehrungsschienen der Bruecke
  const RY = T.top + .62;
  g.with({ c: '#2c2a30', mat: MAT.brushed, m: 1, r: .34 }, () => {
    for (const z of [T.z0 - .08]) { g.at([(T.x0 + T.x1) / 2, RY, z], [0, 0, PI / 2], () => g.cyl(.016, TW + .2, 12)); for (let i = 0; i <= 4; i++) g.at([T.x0 + i * TW / 4, (T.top + RY) / 2, z], () => g.cyl(.009, RY - T.top, 8)); }
  });
  // ---------------------------------------------------- Regalwand: haengende Filmstreifen aus diesem Film
  g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .28 }, () => g.at([-4.8, r.y1 - .22, r.z0 + .1], [0, 0, PI / 2], () => g.cyl(.012, 5.4, 10)));
  const STRIPF = 13, SW = .125;
  for (let i = 0; i < 28; i++) {
    const x = -7.35 + i * .185;
    if (Math.abs(x + 4.72) < .05) continue;
    const n = 7 + Math.floor(hash(i * 3.3) * (STRIPF - 7));
    g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .3 }, () => g.at([x, r.y1 - .245, r.z0 + .095], () => g.rbox(.05, .03, .02, .005)));
    for (let k = 0; k < n; k++) {
      const c = thumbFull(Math.floor(hash(i * 7.7) * 180) + k).b;
      g.with({ c: '#d8d8d8', tex: thumbs, r: .25, mat: MAT.plain, e: .55, flag: 8 }, () => g.at([x, r.y1 - .29 - (k + .5) * (SW * .7), r.z0 + .09 + hash(i) * .012], () => g.card(SW, SW * .68, [c[2], c[3], c[2] + c[0], c[3] + c[1]])));
    }
  }
  // Zwei grosse Spulen an der Wand links
  for (const [x, y] of [[-7.45, FL + 2.65], [-7.45, FL + 1.8]]) g.at([x, y, r.z0 + .06], [PI / 2, 0, 0], () => { g.with({ c: '#7a7c84', mat: MAT.brushed, m: 1, r: .28 }, () => g.cyl(.3, .012, 40)); g.with({ c: '#111014', r: .4 }, () => { g.at([0, .012, 0], () => g.cyl(.26, .008, 40)); }); g.with({ c: '#d9dade', mat: MAT.brushed, m: 1, r: .3 }, () => g.at([0, .025, 0], () => g.cyl(.05, .02, 16))); });
  // Papierkorb am Tischende: dort landet die Frau.
  g.at([-.34, FL, ZC], () => { g.with({ c: '#26272c', mat: MAT.brushed, m: 1, r: .5 }, () => g.lathe([[.2, 0], [.27, .66], [.262, .66], [.195, .02], [0, .02], [0, 0]], 24)); });
  // Schraege Rutsche ins Korb-Innere
  g.with({ c: '#2c2a30', mat: MAT.brushed, m: 1, r: .4 }, () => g.at([-.52, T.top - .07, ZC], [0, 0, -.5], () => g.rbox(.36, .012, TD * .86, .004)));
  // Lampen
  P.pendant(g, -5.6, r.y1, -2.0, .4, '#1b1b1f', '#e8d6ff');
  P.pendant(g, -2.4, r.y1, -2.0, .4, '#1b1b1f', '#e8d6ff');
  // ---------------------------------------------------- Rohrpost durch den Raum
  const S = STATION;
  g.with({ c: '#c8dde4', mat: MAT.glass, r: .03, m: .08 }, () => {
    g.at([S.x, FL + 1.325, S.z], () => g.lathe([[.045, -1.325], [.045, 1.325]], 18));
    g.tube([[S.x, 6.25, S.z], [0, 6.25, S.z]], .045, 16);
  });
  g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .25 }, () => {
    g.at([S.x, 6.25, S.z], () => g.sphere(.072, 16, 12));
    for (const y of [FL + .08, FL + 1.2, FL + 2.2]) g.at([S.x, y, S.z], () => g.torus(.052, .007, 18, 6));
    for (const x of [-3.6, -2.2, -.8]) g.at([x, 6.25, S.z], [0, 0, PI / 2], () => g.torus(.052, .007, 18, 6));
    g.at([S.x, 6.25 + .21, S.z], () => g.cyl(.008, .42, 8));
    for (const x of [-3.6, -2.2, -.8]) g.at([x, 6.25 + .28, S.z], () => g.cyl(.006, .54, 6));
  });
  // Zweite Rohrpost: links die ganze Wand hinauf ins Archiv. Haus-Rohr, Abschnitt je Raum.
  const riser = (room, y0, y1) => { const gg = new Geo(); gg.s({ room }); gg.with({ c: '#c8dde4', mat: MAT.glass, r: .03, m: .08 }, () => gg.at([TUBE2.x, (y0 + y1) / 2, TUBE2.z], () => gg.lathe([[.045, -(y1 - y0) / 2], [.045, (y1 - y0) / 2]], 16))); gg.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .25 }, () => { for (const y of [y0 + .1, y1 - .1]) gg.at([TUBE2.x, y, TUBE2.z], () => gg.torus(.052, .007, 16, 6)); }); E.addStatic(gg, room); };
  riser(ROOM.TON, 7.2, 10.4); riser(ROOM.SCHREIB, 10.8, 14);
  g.with({ c: '#c8dde4', mat: MAT.glass, r: .03, m: .08 }, () => g.at([TUBE2.x, (FL + .95 + 6.8) / 2, TUBE2.z], () => g.lathe([[.045, -(6.8 - FL - .95) / 2], [.045, (6.8 - FL - .95) / 2]], 16)));
  g.at([TUBE2.x, FL, TUBE2.z], () => { g.with({ c: '#20141f', mat: MAT.wood, r: .3 }, () => g.lathe([[0, 0], [.14, 0], [.14, .02], [.08, .05], [.06, .78], [.08, .84], [0, .84]], 20)); g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .25 }, () => g.at([0, .88, 0], () => g.rcyl(.07, .08, .01, 20))); });

  // ---------------------------------------------------- Die Bilder auf dem Tisch: von unten durchleuchtet
  const surf = T.top + .001;
  const lit = (x, z, w, h, tex, ry = 0, e = 1.05) => g.at([x, surf, z], [0, ry, 0], () => g.with({ c: '#ffffff', tex, flag: 8, e, r: .18, mat: MAT.plain }, () => g.sheet(w, h, 1, 1)));
  SHEETS.forEach((s, i) => lit(s.x, ZC, s.w, s.w * .9, i ? still.bogen2 : still.bogen1, (i - .5) * .025, .95));
  lit(PRINT.luft.x, ZC, PRINT.luft.w, PRINT.luft.w * 9 / 16, still.luft, -.012);
  lit(PRINT.kinder.x, ZC, PRINT.kinder.w, PRINT.kinder.w * 9 / 16, still.kinder, .016);
  // Der Ton: Stimme klein, Musik riesig.
  const laut = E.addDoc(canvas(1024, 512, (x, w, h) => {
    x.fillStyle = '#efe8d8'; x.fillRect(0, 0, w, h);
    const lane = (y, a, c, lbl) => { x.fillStyle = 'rgba(27,26,30,.6)'; x.font = '700 30px "Courier Prime"'; x.fillText(lbl, 22, y - 74); x.strokeStyle = c; x.lineWidth = 3; x.beginPath(); for (let i = 0; i < w; i += 2) { const v = (Math.sin(i * .021) * .5 + .5) * a * (.5 + .5 * hash(Math.floor(i / 6))); x.moveTo(i, y - v); x.lineTo(i, y + v); } x.stroke(); };
    lane(130, 40, '#1b1a1e', 'Stimme'); lane(340, 150, '#1b1a1e', 'Musik');
  }));
  lit(PRINT.laut.x, ZC, PRINT.laut.w, PRINT.laut.w * .5, laut, -.01);
  // Die Frau liegt auf einem eigenen Blatt: Sie kann weggeschoben werden.
  const frau = many(E, ID, 1, gg => { gg.s({ c: '#ffffff', flag: 8, e: 1.0, r: .18, mat: MAT.plain }); gg.sheet(PRINT.frau.w, PRINT.frau.w * 9 / 16, 1, 1); });
  frau.shadowRoom = -99;

  E.addStatic(g, ID);
  rooms[ID] = { up: lin('#7a4a84').map(v => v * .3), dn: lin('#2a1a30').map(v => v * .35), fill: [.05, .03, .06], power: 1, gloss: .7, min: [r.x0, r.y0, r.z0], max: [r.x1, r.y1, r.z1] };
  // Vom Tisch nach oben, von oben auf den Tisch.
  light(ID, r, { pos: [-5.2, T.top + .03, ZC], dir: [0, 1, 0], angle: 1.5, inner: 1.1, color: [4.2, 3.9, 3.6], range: 5, size: 1.2, near: .02, bias: .004 });
  light(ID, r, { pos: [-2.2, T.top + .03, ZC], dir: [0, 1, 0], angle: 1.5, inner: 1.1, color: [4.2, 3.9, 3.6], range: 5, size: 1.2, near: .02, bias: .004 });
  light(ID, r, { pos: [-5.6, r.y1 - .52, -2.0], dir: [0, -1, -.15], angle: 1.15, inner: .8, color: [6, 5.2, 7], range: 6, size: .12, haze: .0028 });
  light(ID, r, { pos: [-2.4, r.y1 - .52, -2.0], dir: [0, -1, -.15], angle: 1.15, inner: .8, color: [6, 5.2, 7], range: 6, size: .12, haze: .0028 });
  const pinkL = light(ID, r, { pos: [WIN.x - .5, WIN.y + 2.2, r.z0 - 2.4], dir: norm([.12, -.55, 1]), angle: .46, inner: .24, color: [34, 8, 22], range: 9, size: .25, near: 1, haze: .006, manual: true, power: 0, bias: .003 });

  // ---------------------------------------------------- Bewegtes
  const bridge = part(E, ID, gg => {
    gg.s({ c: '#2c2a30', mat: MAT.brushed, m: 1, r: .34 });
    gg.at([0, 0, (.12 - (TD / 2 + .08)) / 2], () => gg.rbox(.05, .04, TD / 2 + .2, .008));
    gg.at([0, -.0, -(TD / 2 + .08)], () => gg.rbox(.1, .06, .05, .008));
  });
  const loupe = part(E, ID, gg => {
    gg.with({ c: '#2c2a30', mat: MAT.brushed, m: 1, r: .34 }, () => { gg.at([0, .54, -.112], () => gg.rbox(.05, .05, .07, .008)); gg.at([0, .27, -.112], () => gg.cyl(.005, .54, 8)); });
    gg.with({ c: '#d9ae5c', mat: MAT.brushed, m: .3, r: .3 }, () => gg.at([0, 0, 0], () => gg.torus(.1, .008, 56, 10)));
    gg.with({ c: '#fff1cf', e: 2.4, r: .4, mat: MAT.plain }, () => gg.at([0, -.007, 0], () => gg.torus(.1, .0026, 56, 6)));
    gg.with({ c: '#d9eef2', mat: MAT.glass, r: .02, m: .1 }, () => gg.at([0, .003, 0], () => gg.lathe([[0, .012], [.05, .009], [.098, 0]], 30)));
  });
  const LENS_R = .096, LENS_MAG = 2.3;
  const lensI = many(E, ID, 1, gg => {
    gg.s({ c: '#ffffff', r: .12, e: .95, flag: 8 });
    const n = 44, c0 = gg.v([0, 0, 0], [0, 1, 0], .5, .5); let last = gg.v([1, 0, 0], [0, 1, 0], 1, .5);
    for (let i = 1; i <= n; i++) { const a = i / n * TAU, p = gg.v([Math.cos(a), 0, Math.sin(a)], [0, 1, 0], .5 + Math.cos(a) / 2, .5 + Math.sin(a) / 2); gg.tri(c0, last, p); last = p; }
  });
  lensI.shadowRoom = -99;
  const pen = part(E, ID, gg => {
    gg.with({ c: '#2c2a30', mat: MAT.brushed, m: 1, r: .34 }, () => { gg.at([0, .62, 0], () => gg.rbox(.05, .05, .07, .008)); gg.at([0, .44, 0], () => gg.cyl(.006, .34, 8)); });
    gg.with({ c: RED, mat: MAT.plain, r: .18 }, () => gg.at([0, .16, 0], () => gg.cyl(.018, .3, 16)));
    gg.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .25 }, () => gg.at([0, .32, 0], () => gg.rcyl(.02, .025, .004, 14)));
    gg.with({ c: '#101014', r: .4 }, () => gg.at([0, .004, 0], () => gg.lathe([[.004, -.003], [.018, .012]], 12)));
    gg.with({ c: RED, r: .3 }, () => gg.at([0, -.0, 0], () => gg.lathe([[0, -.004], [.004, .0]], 8)));
  });
  const pusher = part(E, ID, gg => { gg.s({ c: '#2c2a30', mat: MAT.brushed, m: 1, r: .34 }); gg.at([0, -.28, 0], () => gg.cyl(.005, .58, 8)); gg.at([0, -.585, 0], () => gg.rbox(.025, .05, .62, .006)); });

  // Gruene Haken: meine eigene, viel zu freundliche Kritik.
  const tick = E.addDoc(canvas(256, 256, (x, w, h) => { x.clearRect(0, 0, w, h); x.strokeStyle = '#1f8a4c'; x.lineWidth = 34; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(50, 136); x.lineTo(108, 196); x.lineTo(210, 64); x.stroke(); }));
  const ticks = many(E, ID, 24, gg => { gg.s({ c: '#ffffff', r: .4, flag: 1 | 16, tex: tick }); gg.sheet(.08, .08, 1, 1); });
  ticks.shadowRoom = -99;
  const notesDocs = {
    strike: E.addDoc(canvas(1024, 256, (x, w, h) => { x.clearRect(0, 0, w, h); x.strokeStyle = RED; x.lineWidth = 15; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); for (let i = 0; i <= 120; i++) { const u = i / 120, px = 18 + u * (w - 36), py = h / 2 + Math.sin(u * 44) * 76 * (.75 + .25 * Math.sin(u * 7)); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); })),
    luft: E.addDoc(verdict('Häuser in der Luft')), kinder: E.addDoc(verdict('wie von Kindern gezeichnet')), laut: E.addDoc(verdict('viel zu laut')), frau: E.addDoc(verdict('Das ist doch keine Frau.')),
  };
  const notes = many(E, ID, 5, gg => { gg.s({ c: '#ffffff', r: .35, flag: 1 | 8 | 16, e: 1.6 }); gg.sheet(1, 1, 1, 1); });
  notes.shadowRoom = -99;

  // Stichworte
  const Tn = {
    s0: cue(15, 'Bild', 0), s1: cue(15, 'für'), s2: cue(15, 'Bild', 1),
    tick0: cue(15, 'Nur') + .05, tick1: cueE(15, 'mir'),
    strike: cue(16, 'Marlon'), strikeE: cueE(16, 'nicht') + .12,
    frauWrite: cue(16, 'Das'), frauE: cueE(16, 'Frau') + .1,
    push: cue(17, 'kein') - .2, pushE: cueE(17, 'vor') + .1,
  };
  const SHX = SHEETS[0].x, SHW = SHEETS[0].w;
  const gridPos = (i) => { const c = i % 4, ro = Math.floor(i / 4) % 3; return [SHX - SHW * .36 + c * SHW * .24 + (Math.floor(i / 12) * .7), ZC - SHW * .28 + ro * SHW * .28]; };
  // Schreibauftraege fuer den roten Stift: Worte zur Stimme.
  const WRITES = [
    { k: 'strike', t0: Tn.strike, t1: Tn.strikeE, x0: SHEETS[0].x - .3, x1: SHEETS[1].x + .24, z: ZC + .02, h: .28 },
    { k: 'luft', t0: cue(16, 'Häuser'), t1: cueE(16, 'Luft'), x0: PRINT.luft.x - .39, x1: PRINT.luft.x + .39, z: ZC + .11, h: .195 },
    { k: 'kinder', t0: cue(16, 'wie'), t1: cueE(16, 'gezeichnet'), x0: PRINT.kinder.x - .39, x1: PRINT.kinder.x + .39, z: ZC + .11, h: .195 },
    { k: 'laut', t0: cue(16, 'viel'), t1: cueE(16, 'laut'), x0: PRINT.laut.x - .36, x1: PRINT.laut.x + .36, z: ZC + .135, h: .18 },
    { k: 'frau', t0: Tn.frauWrite, t1: Tn.frauE, x0: PRINT.frau.x - .5, x1: PRINT.frau.x + .5, z: ZC + .15, h: .25 },
  ];
  // Wo die Bruecke steht: erst bei der Lupe, dann beim Stift.
  const LOUPE = [[Tn.s0 - 1.2, 0], [Tn.s0, 1], [Tn.s1, 2], [Tn.s2, 3]];
  const bKeys = [];
  const addB = (t, x) => { if (!bKeys.length || t > bKeys[bKeys.length - 1].t + .001) bKeys.push({ t, v: [x] }); };
  addB(0, SHEETS[0].x - .1);
  addB(Tn.s0 - .1, SHX - SHW * .36);
  addB(Tn.s2 + .1, SHX - SHW * .12);
  addB(Tn.tick1, SHEETS[1].x + .2);
  addB(Tn.strike - .25, WRITES[0].x0);
  WRITES.forEach((w, i) => { addB(w.t0, w.x0); addB(w.t1, w.x1); });
  addB(Tn.push - .9, PRINT.frau.x - PRINT.frau.w / 2 - .1);
  addB(Tn.push, PRINT.frau.x - PRINT.frau.w / 2 - .02);
  addB(Tn.pushE, T.x1 - .05);
  addB(Tn.pushE + 1.6, T.x1 - 3.4);
  const penState = ts => {
    for (const w of WRITES) if (ts >= w.t0 && ts <= w.t1) { const p = (ts - w.t0) / (w.t1 - w.t0); const jig = Math.sin(ts * 42) * .012 + Math.sin(ts * 67) * .008; return { x: mix(w.x0, w.x1, p), z: w.z + jig + (w.k === 'strike' ? Math.sin(p * 44) * .08 : 0), up: 0, on: 1 }; }
    let on = ts >= Tn.strike - .35 && ts < Tn.push - .5 ? 1 : 0;
    return { x: 0, z: ZC + .15, up: .1, on };
  };
  const frauX = ts => { const u = clamp((ts - Tn.push) / (Tn.pushE - Tn.push)); return mix(PRINT.frau.x, T.x1 + PRINT.frau.w * .56, u * u * (3 - 2 * u)); };
  const frauDrop = ts => { const x = frauX(ts); const over = x + PRINT.frau.w * .5 - T.x1; if (over <= PRINT.frau.w * .55) return { y: 0, a: 0, gone: false }; const v = (over - PRINT.frau.w * .55) / (PRINT.frau.w * .45); return { y: -v * v * .7, a: -v * 1.2, gone: v > 1.02 }; };

  // Zweite Kapsel: Marlons Saetze fahren ins Archiv.
  const cap2 = part(E, ID, capsuleGeo);
  // Die Kapsel leuchtet: ein Licht, das durchs dunkle Haus nach oben schiesst.
  const cap2G = part(E, ID, gg => { gg.s({ c: '#ffd9a0', e: 16, r: .4, flag: 0 }); gg.sphere(.03, 12, 8); });
  const cap2L = ctx.add({ room: ID, pos: [0, 0, 0], dir: norm([.55, -.1, .83]), angle: 1.45, inner: .9, color: [8, 6, 3.6], range: 3.8, size: .04, near: .06, haze: .0012, bias: .004, manual: true, power: 0, base: 0 });
  const tCap = cue(18, 'jeder') + .25, tCapE = cue(18, 'zu') + .1;
  ctx.capsule2 = { tCap, tCapE };
  ctx.schnittNotes = WRITES;

  return {
    frame(t) {
      pinkL.power = smooth(cue(17, 'Dafür') - .5, cue(17, 'Dafür') + .5, t) * (1 - smooth(cue(18, 'Aber') + 1, cue(18, 'Aber') + 2.5, t));
    },
    sub(ts) {
      const b = sampleKeys(bKeys, ts)[0];
      const penS = penState(ts), onPen = penS.on > 0;
      const bx = b;
      bridge.set(M.T(bx, RY, ZC));
      // Lupe: Bild fuer Bild, faehrt nach hinten, wenn der Stift kommt.
      const lz = mix(ZC, T.z0 + .05, smooth(Tn.strike - .5, Tn.strike - .1, ts));
      loupe.set(M.T(bx - .03, RY - .54, lz));
      lensI.begin();
      {
        const lx = bx - .03, sh = SHEETS[Math.abs(lx - SHEETS[0].x) < Math.abs(lx - SHEETS[1].x) ? 0 : 1], sd = sh.w * .9;
        const pu = (lx - (sh.x - sh.w / 2)) / sh.w, pv = (lz - (ZC - sd / 2)) / sd, wu = 2 * LENS_R / LENS_MAG / sh.w, wv = 2 * LENS_R / LENS_MAG / sd;
        if (pu > 0 && pu < 1 && pv > 0 && pv < 1) lensI.push(M.mul(M.T(lx, RY - .54 - .002, lz), M.S(LENS_R, 1, LENS_R)), [0, 0, 0, 0], [wu, wv, pu - wu / 2, pv - wv / 2], [sh === SHEETS[0] ? still.bogen1 : still.bogen2, ID, 1, 1]);
      }
      lensI.end();
      const pz = penS.up ? ZC + .1 : penS.z;
      // Vor Marlons Auftritt haengt der Stift oben unter der Bruecke.
      const park = 1 - smooth(Tn.strike - .55, Tn.strike - .05, ts) + smooth(Tn.push - 1.1, Tn.push - .5, ts);
      const py = T.top + .003 + (penS.up ? .1 : 0) + Math.min(1, park) * .58;
      pen.set(M.T(bx + .03, py, pz));
      pusher.set(M.T(bx, RY, ZC));
      pusher.visible = ts > Tn.push - 1.2 && ts < Tn.pushE + 2.4;
      // Haken
      ticks.begin();
      if (ts > Tn.tick0) for (let i = 0; i < 24; i++) {
        const t0 = mix(Tn.tick0, Tn.tick1, i / 24); if (ts < t0) break;
        const [x, z] = gridPos(i), k = 1 + bump(ts, t0, .18) * .6;
        ticks.push(M.mul(M.T(x, surf + .0015, z), M.S(k, 1, k)), [0, 0, 0, 0], [1, 1, 0, 0], [tick, ID, 1, 1]);
      }
      ticks.end();
      // Roter Stift hinterlaesst, was er schreibt.
      notes.begin();
      for (const w of WRITES) {
        const p = clamp((ts - w.t0) / (w.t1 - w.t0)); if (p <= 0) continue;
        const L = w.x1 - w.x0;
        let dx = 0, y = surf + .002, a = 0, hide = false;
        if (w.k === 'frau') { const d = frauDrop(ts); dx = frauX(ts) - PRINT.frau.x; y += d.y; a = d.a; hide = d.gone; }
        if (hide) continue;
        notes.push(M.mul(M.mul(M.T(w.x0 + dx + L * p / 2, y, w.z), M.RZ(a)), M.S(L * p, 1, w.h)), [0, 0, 0, 0], [p, 1, 0, 0], [notesDocs[w.k], ID, 1, 1]);
      }
      notes.end();
      // Die Frau
      frau.begin();
      { const d = frauDrop(ts); if (!d.gone) frau.push(M.mul(M.T(frauX(ts), surf + .0008 + d.y, ZC), M.RZ(d.a)), [0, 0, 0, 0], [1, 1, 0, 0], [still.frau, ID, 1, 1]); }
      frau.end();
      // Kapsel 2
      const v = clamp((ts - tCap) / (tCapE - tCap));
      cap2.visible = v > 0 && v < 1;
      const y = mix(FL + .94, 15.0, v * v * (3 - 2 * v) * .4 + v * .6);
      cap2.roomOv = y < 7 ? ID : y < 10.6 ? ROOM.TON : y < 14.2 ? ROOM.SCHREIB : ROOM.ARCHIV;
      cap2.set(M.mul(M.T(TUBE2.x, y, TUBE2.z), M.RZ(PI / 2)));
      cap2G.visible = cap2.visible; cap2G.roomOv = cap2.roomOv; cap2G.set(M.T(TUBE2.x, y, TUBE2.z + .06));
      cap2L.room = cap2.roomOv; cap2L.pos = [TUBE2.x + .08, y, TUBE2.z + .1]; cap2L.power = cap2.visible ? 1 : 0;
    },
  };
}
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
