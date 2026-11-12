// Die Buehne: Daumenkino, Browser, die Sekunde, die sich selbst zeigt, Kamera, Papierturm, Filmstreifen. Der Aha-Moment.
import { Geo, MAT } from './geo.js';
import { M, PI, TAU, clamp, mix, smooth, hash, lin, v3, sampleKeys } from './m.js';
import { part, many, canvas, cue, cueE, bump, rise, pulse, RED, INK, paperGround, softDoc, claudeMark } from './kit.js';
import * as P from './props.js';
import { ROOM, R } from './house.js';
import { FRAMES, FPS, DURATION } from './cues.js';

const ID = ROOM.BUEHNE;
const FLOOR = 3.6;
export const MON = { x: 4.2, y: 7.1, z: -3.44, w: 3.5, h: 1.97 };
// Wo das Bild im Fenster liegt: rechts neben dem Text.
export const VID = { x: MON.x + MON.w * .19, y: MON.y + MON.h * .045, w: MON.w * .58, h: MON.w * .58 * 9 / 16 };
export const BOOK = { x: 2.72, y: FLOOR + .9, z: -.82, w: .82, d: .46 };
export const RIG = { x: 4.2, y: FLOOR + 1.72, z: -1.15 };
export const TOWER = { x: 7.2, z: -.48, w: .54, d: .36, H: 6.62 };
export const PROJ = { x: 1.16, y: FLOOR + 1.25, z: -.85 };

const CODE = [
  '// Der Einstieg: Die Website, die die Zeit kennt.',
  "import { defineScene } from '/runtime/scene.js';",
  "import { makeWorld } from './story.js';",
  '',
  "const canvas = document.getElementById('film');",
  'let W = null;',
  '',
  'defineScene({',
  '  ready: (async () => {',
  '    W = await makeWorld(canvas);',
  '  })(),',
  '  render({ time, props }) {',
  '    W.render(time, props.samples);',
  '  },',
  '});',
];

export function buildBuehne(ctx) {
  const { E, rooms, light, add, liveSlots, thumbs, barcode } = ctx;
  const r = R.BUEHNE, g = new Geo(); g.s({ room: ID });
  P.roomShell(g, r, { wallC: '#0b2fb0', wallM: MAT.plaster, wallR: .62, floorC: '#16161e', floorM: MAT.plain, floorR: .42, ceilC: '#1a2552' });
  // Rueckwand: grosse Tafeln, feine Fugen, damit das Blau ein Material hat.
  g.with({ c: '#07196e', r: .55 }, () => {
    for (let i = 1; i < 10; i++) g.at([r.x0 + i * .76, (r.y0 + r.y1) / 2, r.z0 + .008], () => g.box(.018, r.y1 - r.y0, .012, 1));
    for (const y of [5.3, 7.0, 8.7]) g.at([(r.x0 + r.x1) / 2, y, r.z0 + .008], () => g.box(7.6, .018, .012, 1));
  });
  // Bodenmarken, Klebeband, Kabel
  g.with({ c: '#cfc7a8', r: .7 }, () => {
    for (const [x, z, w, d] of [[4.2, -1.15, .34, .03], [4.2, -1.15, .03, .34], [2.4, -2.6, .3, .03], [6, -2.8, .03, .3]]) g.at([x, FLOOR + .0015, z], () => g.box(w, .002, d, 4));
  });
  g.with({ c: '#0b0b0e', r: .45 }, () => {
    const lay = (pts) => g.tube(pts, .012, 6);
    const n = (x0, z0, x1, z1, wob, seed) => { const a = []; for (let i = 0; i <= 26; i++) { const u = i / 26; a.push([mix(x0, x1, u) + Math.sin(u * 7 + seed) * wob, FLOOR + .012, mix(z0, z1, u) + Math.cos(u * 5 + seed) * wob]); } return a; };
    lay(n(1.3, -3.3, 4.1, -1.3, .22, 1)); lay(n(4.3, -1.1, 7.6, -3.4, .3, 2)); lay(n(2.2, -1.0, 1.5, -3.4, .2, 3)); lay(n(.7, -3.2, 3.3, -3.2, .15, 4));
  });
  // Rohrpost-Empfaenger: hier landet die Kapsel aus dem Foyer.
  g.with({ c: '#c8dde4', mat: MAT.glass, r: .03, m: .08 }, () => {
    g.tube([[r.x0, 6.25, -1.68], [1.32, 6.25, -1.68]], .045, 16);
    g.at([1.4, 5.65, -1.68], () => g.lathe([[.045, -.46], [.045, .5]], 18));
  });
  g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .25 }, () => {
    g.at([1.4, 6.25, -1.68], () => g.sphere(.072, 16, 12));
    g.at([1.4, 5.14, -1.68], () => g.rcyl(.075, .08, .01, 22));
    g.at([.5, 6.25, -1.68], [0, 0, PI / 2], () => g.rcyl(.066, .03, .006, 20));
    g.at([1.4, 4.35, -1.68], () => g.lathe([[.1, -.75], [.14, -.74], [.06, -.68], [.03, -.6], [.03, .7], [.06, .72]], 18));
  });
  // Kisten und Stative: So sieht es in so einem Raum aus.
  const crate = (x, y, z, w, h, d, c = '#1a1b20', ry = 0) => g.at([x, y + h / 2, z], [0, ry, 0], () => {
    g.with({ c, mat: MAT.plain, r: .45 }, () => g.rbox(w, h, d, .012));
    g.with({ c: '#9a9ca2', mat: MAT.brushed, m: 1, r: .3 }, () => {
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.at([sx * (w / 2 - .018), sy * (h / 2 - .018), d / 2 + .002], () => g.box(.04, .04, .004, 1));
      g.at([0, h / 2 - .1, d / 2 + .002], () => g.rbox(.12, .02, .012, .004));
    });
  });
  crate(7.3, FLOOR, -3.0, .9, .55, .6); crate(7.26, FLOOR + .55, -3.02, .6, .36, .5, '#23252b', .1); crate(1.05, FLOOR, -3.05, .7, .42, .5, '#26201a');
  // Wandlampe "Aufnahme" neben dem Monitor
  g.at([1.15, 8.75, r.z0 + .03], () => {
    g.with({ c: '#121216', r: .4 }, () => g.rbox(.9, .32, .05, .01));
  });

  // ---------------------------------------------------- Der Monitor
  g.at([MON.x, MON.y, MON.z], () => {
    g.with({ c: '#0a0a0d', r: .28, mat: MAT.plain }, () => g.at([0, 0, -.06], () => g.rbox(MON.w + .18, MON.h + .18, .12, .02, 3)));
    g.with({ c: '#2a2c33', mat: MAT.brushed, m: 1, r: .32 }, () => {
      g.at([0, -MON.h / 2 - .11, -.04], () => g.rbox(.34, .05, .03, .01));
      g.at([0, -2.225, -.1], () => g.rbox(.2, 2.45, .05, .01));
      g.at([0, FLOOR - MON.y + .025, -.02], () => g.rbox(1.3, .05, .34, .012));
    });
  });
  // Dunkler Bildschirm, solange er aus ist.
  g.with({ c: '#05060a', r: .12, mat: MAT.plain }, () => g.at([MON.x, MON.y, MON.z + .002], () => g.card(MON.w, MON.h)));

  // ---------------------------------------------------- Fallblattanzeige
  const FB = { x: MON.x, y: 9.42, z: r.z0 + .035, dw: .36, dh: .6 };
  g.at([FB.x, FB.y, FB.z], () => {
    g.with({ c: '#0b0b0e', r: .4 }, () => g.at([0, 0, .02], () => g.rbox(FB.dw * 6 + .34, FB.dh + .22, .08, .015)));
    g.with({ c: '#b89a55', mat: MAT.brushed, m: 1, r: .28 }, () => { g.at([0, FB.dh / 2 + .11, .06], () => g.rbox(FB.dw * 6 + .38, .022, .02, .006)); g.at([0, -FB.dh / 2 - .11, .06], () => g.rbox(FB.dw * 6 + .38, .022, .02, .006)); });
  });
  const plate = E.addDoc(canvas(1024, 256, (x, w, h) => {
    x.fillStyle = '#b89a55'; x.fillRect(0, 0, w, h); x.fillStyle = '#16120a'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '700 92px Jost'; x.fillText(`BILD  VON  ${String(FRAMES).padStart(6, '0')}`, w / 2, h / 2 + 4);
  }));
  g.with({ c: '#ffffff', tex: plate, mat: MAT.plain, r: .35, m: 0 }, () => g.at([FB.x, FB.y - FB.dh / 2 - .27, FB.z + .012], () => g.card(1.25, .3)));
  // Eine eigene kleine Lampe fuer die Anzeige
  g.with({ c: '#1a1a1e', mat: MAT.brushed, m: 1, r: .4 }, () => { g.at([FB.x, FB.y + .55, FB.z + .22], () => g.rbox(2.2, .05, .08, .02)); });

  // ---------------------------------------------------- Tisch mit Daumenkino
  g.at([BOOK.x, FLOOR, BOOK.z], () => {
    g.with({ c: '#2a2118', mat: MAT.wood, r: .3 }, () => {
      g.at([0, .86, 0], () => g.rbox(1.5, .05, .9, .01, 2));
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.at([sx * .66, .42, sz * .38], () => g.cyl(.03, .84, 12, .022));
    });
    // Die Klammer am Buchruecken
    g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .26 }, () => {
      g.at([0, .9, 0], () => g.rbox(.06, .03, .54, .006));
      for (const s of [-1, 1]) g.at([0, .94, s * .24], () => g.rcyl(.028, .07, .006, 14));
      g.at([0, .93, 0], () => g.rbox(.04, .02, .52, .004));
    });
    // Linker und rechter Stapel: Blaetter, nur die Kante ist echt.
    g.with({ c: '#e7dfca', mat: MAT.paper, r: .85 }, () => {
      g.at([-BOOK.w / 2, .91, 0], () => g.rbox(BOOK.w - .02, .012, BOOK.d, .002));
      g.at([BOOK.w / 2, .91, 0], () => g.rbox(BOOK.w - .02, .012, BOOK.d, .002));
    });
  });

  // ---------------------------------------------------- Schienen und Foerderband
  g.with({ c: '#3e4047', mat: MAT.brushed, m: 1, r: .3 }, () => {
    for (const z of [RIG.z - .24, RIG.z + .24]) g.at([5.72, FLOOR + .02, z], () => g.rbox(4.56, .04, .035, .006));
    for (let i = 0; i < 12; i++) g.at([3.62 + i * .38, FLOOR + .006, RIG.z], () => g.rbox(.05, .012, .6, .003));
  });
  // Band von der Kamera zum Turm
  const BZ = -.48, BY = FLOOR + .46;
  g.with({ c: '#121216', r: .75, mat: MAT.rug }, () => g.at([(RIG.x + TOWER.x) / 2 - .05, BY, BZ], () => g.rbox(TOWER.x - RIG.x + .1, .018, .42, .005)));
  g.with({ c: '#3e4047', mat: MAT.brushed, m: 1, r: .32 }, () => {
    for (let i = 0; i <= 6; i++) { const x = RIG.x + i * (TOWER.x - RIG.x) / 6; g.at([x - .05, BY - .03, BZ], [PI / 2, 0, 0], () => g.cyl(.022, .44, 12)); for (const s of [-1, 1]) g.at([x - .05, FLOOR + (BY - FLOOR - .03) / 2, BZ + s * .23], () => g.cyl(.012, BY - FLOOR - .03, 8)); }
    for (const s of [-1, 1]) g.at([(RIG.x + TOWER.x) / 2 - .05, BY - .03, BZ + s * .23], () => g.rbox(TOWER.x - RIG.x + .1, .036, .012, .004));
  });
  // Fuehrungen des Turms: bis unter die Decke.
  g.with({ c: '#54565e', mat: MAT.brushed, m: 1, r: .34 }, () => {
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) g.at([TOWER.x + sx * (TOWER.w / 2 + .02), (FLOOR + r.y1) / 2, TOWER.z + sz * (TOWER.d / 2 + .02)], () => g.cyl(.01, r.y1 - FLOOR, 8));
    for (let y = FLOOR + .9; y < r.y1 - .4; y += 1.05) for (const sz of [-1, 1]) g.at([TOWER.x, y, TOWER.z + sz * (TOWER.d / 2 + .02)], () => g.rbox(TOWER.w + .08, .012, .012, .003));
    g.at([TOWER.x, FLOOR + .03, TOWER.z], () => g.rbox(TOWER.w + .2, .06, TOWER.d + .2, .01));
  });
  // Rollen und Traversen fuer den Filmstreifen: oben quer durch den Raum, links hinunter.
  g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .25 }, () => {
    for (let i = 0; i < 9; i++) { const x = .92 + i * (TOWER.x - .92) / 8; g.at([x, r.y1 - .38, -.72], [PI / 2, 0, 0], () => g.cyl(.03, .18, 14)); }
    for (let i = 0; i < 4; i++) g.at([.82, r.y1 - .95 - i * .7, -.72], [PI / 2, 0, 0], () => g.cyl(.03, .18, 14));
  });
  g.with({ c: '#26272c', mat: MAT.brushed, m: 1, r: .4 }, () => {
    g.at([(0.8 + TOWER.x) / 2, r.y1 - .12, -.72], () => g.rbox(TOWER.x - .4, .05, .05, .01));
    g.at([(0.8 + TOWER.x) / 2, r.y1 - .12, -2.1], () => g.rbox(TOWER.x - .4, .05, .05, .01));
    for (let i = 0; i < 9; i++) { const x = .92 + i * (TOWER.x - .92) / 8; g.at([x, r.y1 - .24, -.72], () => g.cyl(.006, .24, 6)); }
    g.at([.66, (r.y1 + PROJ.y) / 2 - .1, -.72], () => g.rbox(.04, r.y1 - PROJ.y - .4, .04, .01));
    for (let i = 0; i < 4; i++) g.at([.74, r.y1 - .95 - i * .7, -.72], [0, 0, PI / 2], () => g.cyl(.006, .16, 6));
  });
  // Projektor auf Stativ, Linse zeigt zu uns.
  g.at([PROJ.x, FLOOR, PROJ.z], () => {
    g.with({ c: '#1e1f24', mat: MAT.brushed, m: 1, r: .4 }, () => {
      g.at([0, .55, 0], () => g.cyl(.04, 1.1, 12));
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + .4; g.tube([[0, .3, 0], [Math.cos(a) * .36, 0, Math.sin(a) * .36]], .014, 8); }
    });
    g.at([0, 1.25, 0], () => {
      g.with({ c: '#2c3a37', mat: MAT.plain, r: .3 }, () => { g.rbox(.3, .3, .46, .03, 3); g.at([0, .19, -.1], () => g.rbox(.18, .1, .2, .02)); });
      g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .25 }, () => { g.at([0, .0, .26], [PI / 2, 0, 0], () => g.lathe([[.07, -.03], [.07, .03], [.06, .08], [.058, .08], [.05, .03], [0, .03]], 28)); g.at([0, .32, .12], () => g.cyl(.012, .08, 10)); g.at([0, .32, -.2], () => g.cyl(.012, .08, 10)); });
      g.with({ c: '#ffffff', e: 0, r: .1 }, () => { });
    });
  });
  // Lichtbruecke: acht Scheinwerfer, die erst beim Aha angehen.
  const LAMPS = [];
  for (let i = 0; i < 8; i++) LAMPS.push({ x: 1.05 + i * .88, y: r.y1 - .58, z: -2.1, aim: [(i - 3.5) * .05, -1, .55] });
  g.with({ c: '#101116', mat: MAT.plain, r: .35 }, () => {
    for (const l of LAMPS) g.at([l.x, l.y, l.z], () => {
      const d = norm(l.aim), ax = Math.atan2(Math.hypot(d[0], d[2]), -d[1]), ry = Math.atan2(d[0], d[2]);
      g.at([0, 0, 0], [0, ry, 0], () => g.at([0, 0, 0], [PI / 2 + (PI / 2 - ax) * 0 + (ax - PI / 2), 0, 0], () => {
        g.lathe([[.0, -.2], [.09, -.2], [.13, -.1], [.14, .1], [.15, .13], [.0, .13]], 20);
        for (const a of [0, 1, 2, 3]) g.at([0, .16, 0], [0, a * PI / 2, 0], () => g.at([.14, 0, 0], [0, 0, -.5], () => g.box(.012, .13, .2)));
      }));
    });
    g.at([4.2, r.y1 - .36, -2.1], () => g.rbox(7.3, .04, .04, .01));
  });
  g.with({ c: '#27282d', mat: MAT.brushed, m: 1, r: .4 }, () => { for (const l of LAMPS) g.at([l.x, l.y + .13, l.z], () => g.cyl(.012, .24, 8)); });

  E.addStatic(g, ID);
  rooms[ID] = { up: lin('#3254c8').map(v => v * .55), dn: lin('#0e1a50').map(v => v * .5), fill: [.028, .05, .13], power: 1, gloss: 1, min: [r.x0, r.y0, r.z0], max: [r.x1, r.y1, r.z1] };
  // Grundlicht: Zwei breite Flaechen von oben, die das Blau zum Leuchten bringen.
  const baseA = light(ID, r, { pos: [2.6, r.y1 - .2, -1.5], dir: norm([.12, -1, -.42]), angle: 1.3, inner: .9, color: [24, 30, 56], range: 12, size: 1, haze: .0018 });
  const baseB = light(ID, r, { pos: [6.0, r.y1 - .2, -1.5], dir: norm([-.12, -1, -.42]), angle: 1.3, inner: .9, color: [24, 30, 56], range: 12, size: 1, haze: .0018 });
  light(ID, r, { pos: [FB.x, FB.y + .5, FB.z + .24], dir: norm([0, -.7, -.3]), angle: 1.0, inner: .7, color: [2.2, 2.2, 2.4], range: 3, size: .08 });
  const bookLamp = light(ID, r, { pos: [BOOK.x - .3, FLOOR + 2.1, BOOK.z + .3], dir: norm([.2, -1, -.2]), angle: .75, inner: .46, color: [6.4, 5.9, 5.3], range: 5, size: .1, haze: .002 });
  // Blitz und Monitorlicht
  const flashL = light(ID, r, { pos: [RIG.x + .05, RIG.y + .46, RIG.z - .12], dir: norm([0, .3, -1]), angle: 1.35, inner: .9, color: [120, 118, 112], range: 12, size: .1, near: .1, haze: .004, manual: true, power: 0 });
  const monL = light(ID, r, { pos: [MON.x, MON.y, MON.z + .45], dir: [0, -.05, 1], angle: 1.42, inner: .9, color: [10, 11, 14], range: 9, size: 1.2, near: .05, manual: true, power: 0 });
  const lampL = LAMPS.map(l => light(ID, r, { pos: [l.x, l.y - .1, l.z + .06], dir: norm(l.aim), angle: .62, inner: .32, color: [46, 44, 40], range: 13, size: .1, near: .1, haze: .0024, manual: true, power: 0 }));
  const projL = light(ID, r, { pos: [PROJ.x, PROJ.y + .0, PROJ.z + .3], dir: [0, 0, 1], angle: .24, inner: .12, color: [60, 58, 54], range: 6, size: .02, near: .05, haze: .03, manual: true, power: 0 });

  const beltL = light(ID, r, { pos: [5.5, FLOOR + 1.9, BZ + .35], dir: norm([0, -1, -.18]), angle: 1.05, inner: .62, color: [20, 17, 12.5], range: 5, size: .5, near: .2, manual: true, power: 0 });
  const rigFill = light(ID, r, { pos: [RIG.x + 1.25, RIG.y + .85, RIG.z + .55], dir: norm([-1.25, -.85, -.55]), angle: .72, inner: .42, color: [9, 7.5, 5.5], range: 6, size: .25, near: .2, manual: true, power: 0 });
  const towerL = light(ID, r, { pos: [5.9, FLOOR + .5, 3.1], dir: norm([.32, .62, -.72]), angle: .62, inner: .4, color: [46, 44, 42], range: 13, size: .15, near: .3, manual: true, power: 0 });
  // Leuchtende Scheinwerfer-Glaeser
  const lampG = LAMPS.map(l => part(E, ID, gg => {
    gg.s({ c: '#fff2d2', e: 36, r: .3, flag: 0 });
    const d = norm(l.aim), ax = Math.atan2(Math.hypot(d[0], d[2]), -d[1]), ry = Math.atan2(d[0], d[2]);
    gg.at([l.x, l.y, l.z], [0, ry, 0], () => gg.at([0, 0, 0], [ax - PI / 2 + PI / 2, 0, 0], () => gg.at([0, -.0, 0], () => gg.lathe([[.11, -.13], [.0, -.13]], 20))));
  }));
  const projG = part(E, ID, gg => { gg.s({ c: '#fff4dc', e: 90, r: .2, flag: 0 }); gg.at([PROJ.x, PROJ.y, PROJ.z + .28], [PI / 2, 0, 0], () => gg.lathe([[.052, .03], [0, .03]], 22)); });

  // ---------------------------------------------------- Bildschirm: lebt
  const UI = liveSlots.ui;
  const uiCard = part(E, ID, gg => { gg.s({ c: '#ffffff', tex: 201, flag: 8, e: 1.18, r: .1, mat: MAT.screen }); gg.card(MON.w, MON.h); });
  uiCard.set(M.T(MON.x, MON.y, MON.z + .006));
  const vidCard = part(E, ID, gg => { gg.s({ c: '#ffffff', tex: 200, flag: 8, e: .72, r: .1 }); gg.card(VID.w, VID.h, [0, 1, 1, 0]); });
  vidCard.set(M.T(VID.x, VID.y, MON.z + .012));
  const vidSelf = part(E, ID, gg => { gg.s({ c: '#ffffff', tex: 200, flag: 8, e: 1, r: .1 }); gg.card(VID.w, VID.h, [0, 1, 1, 0]); });
  vidSelf.set(M.T(VID.x, VID.y, MON.z + .012));

  // Zeitplan des Kapitels
  const on = cue(7, 'Programm') - .1, webT = cue(8, 'Jede');
  const q12 = cue(9, 'zwölf', 0), a12 = cue(9, 'zeigt') , q3 = cue(9, 'drei', 0);
  const self = cue(10, 'dieser');
  const tFoto = [cue(11, 'Foto', 0), cue(11, 'Foto', 1), cue(11, 'Foto', 2)];
  const tEins = cue(11, 'eins'), tZwei = cue(11, 'zwei'), tDrei = cue(11, 'drei');
  const tNeun = cue(11, 'Elftausend'), tDann = cue(11, 'Dann'), tKlebt = cue(11, 'klebt');
  const tAnein = cueE(11, 'aneinander'), tGerade = cue(11, 'gerade');
  const tRig = cue(11, 'Jetzt') - .3, tRigIn = cue(11, 'Ein');
  const tAhaEnd = cue(13, 'Aber');
  const tTowerEnd = tDann + 1.6;
  ctx.buehneTimes = { on, webT, q12, q3, self, tFoto, tNeun, tDann, tGerade, tRig, tRigIn };
  // Was zeigt der Regler? Sekunden.
  function sliderTime(t) {
    if (t < q12 - .25) return 0;
    if (t < q3 - .3) return 12;
    if (t < self - .3) return 3;
    if (t < tEins - .12) return t;
    if (t < tTowerEnd) return counter(t) / FPS;
    return DURATION - .1;
  }
  // Welche Bildnummer steht auf der Anzeige? Normal die echte. Beim Abdruecken zaehlt das Programm.
  function counter(t) {
    if (t >= tEins - .12 && t < tZwei - .05) return 1;
    if (t >= tZwei - .05 && t < tDrei - .05) return 2;
    if (t >= tDrei - .05 && t < tNeun) return 3;
    if (t >= tNeun && t < tTowerEnd) { const u = (t - tNeun) / (tTowerEnd - tNeun); return Math.round(3 + (FRAMES - 3) * u * u * (3 - 2 * u)); }
    if (t >= tTowerEnd && t < tAhaEnd - .2) return FRAMES;
    return Math.max(0, Math.round(t * FPS));
  }
  // Wie viele Fotos sind geschossen?
  function shots(t) {
    let n = 0; for (const f of tFoto) if (t >= f) n++;
    if (t >= tNeun) { const u = clamp((t - tNeun) / (tTowerEnd - tNeun)); n = 3 + (FRAMES - 3) * u * u * (3 - 2 * u); }
    return n;
  }
  // Zeitpunkt des n-ten Schusses, rueckwaerts
  function shotTime(n) {
    if (n < 3) return tFoto[n];
    // Umkehrung von smoothstep, grob genuegt.
    const f = (n - 3) / (FRAMES - 3); let lo = 0, hi = 1; for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (m * m * (3 - 2 * m) < f) lo = m; else hi = m; } return tNeun + lo * (tTowerEnd - tNeun);
  }

  // Bildschirm malen: Browserfenster mit echtem Text links, Regler unter dem Bild.
  let uiKey = '';
  function paintUI(t) {
    const sec = sliderTime(t), key = `${Math.floor(sec * 30)}|${Math.round(smooth(webT - 1, webT, t) * 40)}|${t > cue(12, 'Damit') ? Math.floor(clamp((t - cue(12, 'Damit')) * 18, 0, 400)) : 0}`;
    if (key === uiKey && UI.owner === 'buehne') return; uiKey = key; UI.owner = 'buehne';
    UI.paint(x => {
      const W = UI.w, H = UI.h;
      x.fillStyle = '#10121a'; x.fillRect(0, 0, W, H);
      // Fensterleiste
      x.fillStyle = '#23262f'; x.fillRect(0, 0, W, 128);
      ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { x.fillStyle = c; x.beginPath(); x.arc(52 + i * 52, 42, 16, 0, TAU); x.fill(); });
      x.fillStyle = '#10121a'; x.beginPath(); x.roundRect(240, 10, 520, 62, [14, 14, 0, 0]); x.fill();
      x.fillStyle = '#d7dae3'; x.font = '500 30px Jost'; x.textBaseline = 'middle'; x.textAlign = 'left'; claudeMark(x, 282, 41, 34); x.fillText('Videos aus Code', 312, 42);
      x.fillStyle = '#10121a'; x.beginPath(); x.roundRect(40, 80, W - 80, 40, 20); x.fill();
      x.fillStyle = '#9ea3b0'; x.font = '400 25px "JetBrains Mono"'; x.fillText('videos-aus-code/film.html', 70, 100);
      // Links: der Text
      const cw = 15.6;
      x.font = '400 26px "JetBrains Mono"'; x.textBaseline = 'alphabetic';
      const afterAha = t - cue(12, 'Damit');
      CODE.forEach((ln, i) => {
        const y = 200 + i * 44;
        x.fillStyle = 'rgba(158,163,176,.45)'; x.textAlign = 'right'; x.fillText(String(i + 1), 62, y); x.textAlign = 'left';
        x.fillStyle = ln.startsWith('//') ? '#7f8b6a' : /render|time/.test(ln) ? '#ffcf7a' : '#cfd3de';
        x.fillText(ln.slice(0, 44), 86, y);
      });
      // Die Zeile mit der Zeit
      const m = Math.floor(sec / 60), s = Math.floor(sec) % 60;
      x.fillStyle = 'rgba(255,207,122,.12)'; x.fillRect(0, 846, W * .39, 74);
      x.font = '700 40px "JetBrains Mono"'; x.fillStyle = '#ffcf7a'; x.fillText(`time = ${m}:${String(s).padStart(2, '0')}`, 86, 896);
      // Rechts der Bereich des Bildes, unten der Regler
      x.fillStyle = '#000'; const vx = W * .40, vw = W * .58;
      x.fillRect(vx, 190, vw, vw * 9 / 16);
      const ty = H - 150, tx0 = vx + 30, tx1 = vx + vw - 30;
      x.fillStyle = '#3a3e4a'; x.beginPath(); x.roundRect(tx0, ty - 7, tx1 - tx0, 14, 7); x.fill();
      const px = tx0 + (tx1 - tx0) * clamp(sec / DURATION);
      x.fillStyle = '#ffcf7a'; x.beginPath(); x.roundRect(tx0, ty - 7, Math.max(8, px - tx0), 14, 7); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(px, ty, 22, 0, TAU); x.fill();
      x.fillStyle = '#d7dae3'; x.font = '500 38px Jost'; x.textBaseline = 'alphabetic'; x.textAlign = 'center'; x.fillText(`${m}:${String(s).padStart(2, '0')}`, px, ty - 40);
      // Beim Aha: Quelltext scrollt ueber den ganzen Schirm.
      if (afterAha > 0) {
        const k = smooth(0, .8, afterAha);
        x.globalAlpha = k; x.fillStyle = '#0c0e14'; x.fillRect(0, 130, W, H - 130); x.globalAlpha = 1;
        const SRC = ctx.SOURCE; const cols = 118, rows = 25, off = Math.floor(clamp(afterAha, 0, 400 / 18) * 240);
        x.font = '400 27px "JetBrains Mono"'; x.textAlign = 'left'; x.fillStyle = `rgba(190,205,225,${k})`;
        for (let i = 0; i < rows; i++) { x.fillText(SRC.substr((off + i * cols) % (SRC.length - cols), cols), 40, 180 + i * 40); }
      }
    });
  }

  // ---------------------------------------------------- Das Daumenkino
  const page = many(E, ID, 32, gg => { gg.s({ c: '#efe8d8', mat: MAT.paper, r: .8 }); gg.at([BOOK.w / 2 - .01, 0, 0], () => gg.sheet(BOOK.w - .02, BOOK.d, 12, 1)); });
  page.shadowRoom = ID;
  const tBook0 = cue(7, 'Ein', 1) - .4, tBook1 = cue(7, 'Aber', 1);
  // Blaetter pro Sekunde: erst langsam zum Sehen, dann die dreissig.
  const rate = t => mix(2.4, 30, smooth(cue(7, 'dreißig') - .3, cue(7, 'Sekunde'), t)) * (1 - smooth(tBook1, tBook1 + 1.2, t) * .92);
  const pTable = []; { let p = 0; for (let i = 0; i < 40 * 30; i++) { pTable.push(p); p += rate(tBook0 + i / 30) / 30; } }
  const pageAt = t => { const f = (t - tBook0) * 30; if (f <= 0) return 0; const i = Math.min(pTable.length - 2, Math.floor(f)); return mix(pTable[i], pTable[i + 1], f - i); };
  const pmL = new Float32Array(16);
  function updateBook(ts) {
    page.begin();
    const p = pageAt(ts), D = .32, r2 = rate(ts);
    const inFlight = Math.min(26, Math.ceil(r2 * D) + 2), base = Math.floor(p);
    const bx = BOOK.x, by = FLOOR + .925, bz = BOOK.z;
    const cell = ctx.thumbCell;
    // Oberste Seiten der Stapel
    const pushP = (ang, idx, k) => {
      const m = M.mul(M.T(bx, by, bz), M.RZ(ang));
      const c = cell(Math.max(idx, 0));
      page.push(m, [k, 0, 0, 0], c.b, [ang > PI / 2 ? -1 : thumbs, ID, 1, 1]);
    };
    pushP(0, base + 1, 0);             // rechts: die naechste Seite
    pushP(PI, base - inFlight, 0);     // links: was schon durch ist. Liegt gewendet: Rueckseite.
    for (let i = 0; i < inFlight; i++) {
      const idx = base - i;
      if (idx < 0) continue;
      const age = (p - idx) / Math.max(r2, .1);
      const u = clamp(age / D); if (u >= 1) continue;
      const e = u * u * (3 - 2 * u);
      const ang = e * PI;
      const k = Math.sin(e * PI) * (i % 2 ? .55 : .8) * -1;
      pushP(ang, idx, k);
    }
    page.end();
  }

  // ---------------------------------------------------- Die Kamera auf Schienen
  const tagDoc = E.addDoc(canvas(512, 256, (x, w, h) => {
    paperGround(x, w, h, '#e9dfc5', 3); x.fillStyle = INK; x.font = '700 62px "Courier Prime"'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('Kleines', w / 2, h * .36); x.fillText('Programm', w / 2, h * .68);
    x.strokeStyle = '#8a6a2c'; x.lineWidth = 4; x.strokeRect(10, 10, w - 20, h - 20);
  }));
  const rig = part(E, ID, gg => {
    // Fahrgestell
    gg.with({ c: '#26272c', mat: MAT.brushed, m: 1, r: .35 }, () => {
      gg.at([0, -1.67, 0], () => gg.rbox(.62, .07, .72, .012));
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) gg.at([sx * .24, -1.67, sz * .24], [PI / 2, 0, 0], () => gg.rcyl(.046, .03, .006, 16));
      gg.at([0, -.86, 0], () => gg.cyl(.05, 1.56, 14));
      gg.at([0, -.2, 0], () => gg.rbox(.3, .05, .3, .01));
    });
    // Kamera: Holz, Messing, Balg
    gg.at([0, .08, 0], [.46, 0, 0], () => {
      gg.with({ c: '#54301a', mat: MAT.fineWood, r: .24, flag: 16 }, () => {
        gg.at([0, 0, .2], () => gg.rbox(.5, .5, .32, .018, 2));
        gg.at([0, 0, -.32], () => gg.rbox(.42, .42, .06, .012, 2));
      });
      gg.with({ c: '#241e1a', mat: MAT.fabric, r: .6 }, () => {
        const n = 7; for (let i = 0; i < n; i++) { const s = .4 - i * .004; gg.at([0, 0, .03 - i * .045], () => gg.rbox(i % 2 ? s : s + .03, i % 2 ? s : s + .03, .03, .004)); }
      });
      gg.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .24 }, () => {
        gg.at([0, 0, -.38], [PI / 2, 0, 0], () => gg.lathe([[.11, -.05], [.11, .06], [.095, .06], [.09, .02], [.06, .02]], 28));
        for (const s of [-1, 1]) for (const y of [-1, 1]) gg.at([s * .25, y * .25, .03], () => gg.sphere(.012, 8, 6));
        gg.at([0, .29, .2], () => gg.rcyl(.04, .04, .006, 14));
      });
      gg.with({ c: '#0a0a0d', r: .08 }, () => gg.at([0, 0, -.415], [PI / 2, 0, 0], () => gg.lathe([[.0, 0], [.09, 0]], 28)));
      // Auswurf hinten
      gg.with({ c: '#101013', r: .5 }, () => gg.at([0, -.18, .365], () => gg.rbox(.36, .04, .012, .004)));
    });
    // Blitzschirm am Arm
    gg.with({ c: '#26272c', mat: MAT.brushed, m: 1, r: .35 }, () => gg.tube([[.03, .28, .05], [.03, .52, -.02]], .012, 8));
    gg.at([.03, .58, -.08], [PI / 2 + .35, 0, 0], () => {
      gg.with({ c: '#d9dade', mat: MAT.brushed, m: 1, r: .26 }, () => gg.lathe([[.012, -.02], [.05, -.015], [.15, .05], [.155, .056], [.15, .056]], 28));
    });
    // Anhaenger an einer Schnur
    gg.with({ c: '#b9ac8a', r: .9 }, () => gg.tube([[-.24, .24, .28], [-.31, .05, .36], [-.31, -.08, .37]], .0022, 5));
  });
  const tag = part(E, ID, gg => { gg.s({ c: '#e9dfc5', tex: tagDoc, mat: MAT.paper, r: .8, flag: 16 }); gg.card(.3, .15); });
  const bulb = part(E, ID, gg => { gg.s({ c: '#f8f6ff', e: 240, r: .2, flag: 0 }); gg.sphere(.05, 12, 10); });

  // Abzuege: fallen aus der Kamera aufs Band und laufen zum Turm.
  const print = many(E, ID, 40, gg => { gg.s({ c: '#f2eee2', mat: MAT.paper, r: .75 }); gg.sheet(.34, .19, 4, 1); });
  print.shadowRoom = ID;
  // Der Turm: ein einziger Quader, seine Kante ist der Farbstreifen des ganzen Films.
  const tower = many(E, ID, 1, gg => {
    gg.s({ c: '#ffffff', mat: MAT.plain, r: .86 });
    const w = TOWER.w / 2, d = TOWER.d / 2;
    gg.rect([-w, 0, d], [w, 0, d], [w, 1, d], [-w, 1, d], [0, 0, 1], [0, 1, 1, 0]);
    gg.rect([w, 0, d], [w, 0, -d], [w, 1, -d], [w, 1, d], [1, 0, 0], [0, 1, 1, 0]);
    gg.rect([-w, 0, -d], [-w, 0, d], [-w, 1, d], [-w, 1, -d], [-1, 0, 0], [0, 1, 1, 0]);
  });
  tower.shadowRoom = ID;
  const towerTop = part(E, ID, gg => { gg.s({ c: '#efe8d8', mat: MAT.paper, r: .8, flag: 16 }); gg.box(TOWER.w + .002, .002, TOWER.d + .002, 4); });
  const towerH = t => {
    const n = shots(t);
    return n / FRAMES * TOWER.H;
  };

  // Filmstreifen
  const path = [[TOWER.x - .02, FLOOR + TOWER.H + .05, TOWER.z], [TOWER.x - .1, r.y1 - .22, -.8], [6.0, r.y1 - .3, -.72], [2.2, r.y1 - .3, -.72], [1.0, r.y1 - .3, -.72], [.88, r.y1 - .5, -.72], [.88, 7.6, -.72], [.92, 6.2, -.72], [1.2, PROJ.y + .28, PROJ.z - .1]];
  const smooth3 = [];
  for (let i = 0; i < path.length - 1; i++) { const n = 18; for (let k = 0; k < n; k++) smooth3.push(v3.mix(path[i], path[i + 1], k / n)); } smooth3.push(path[path.length - 1]);
  for (let it = 0; it < 6; it++) for (let i = 1; i < smooth3.length - 1; i++) smooth3[i] = v3.mix(v3.mix(smooth3[i - 1], smooth3[i + 1], .5), smooth3[i], .5);
  const seg = []; let tot = 0; for (let i = 1; i < smooth3.length; i++) { const d = v3.len(v3.sub(smooth3[i], smooth3[i - 1])); seg.push(d); tot += d; }
  const FRW = .126;  // Abstand der Bilder
  const stripN = Math.floor(tot / FRW);
  const strip = many(E, ID, stripN + 4, gg => { gg.s({ c: '#ffffff', mat: MAT.plain, r: .28, flag: 8, e: .9 }); gg.card(FRW * .985, FRW * .985 * 2 / 3); });
  strip.shadowRoom = ID;
  function pathAt(s) {
    if (s <= 0) return [smooth3[0], v3.norm(v3.sub(smooth3[1], smooth3[0]))];
    let d = s; for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const a = smooth3[i], b = smooth3[i + 1]; return [v3.mix(a, b, d / seg[i]), v3.norm(v3.sub(b, a))]; } d -= seg[i]; }
    const n = smooth3.length - 1; return [smooth3[n], v3.norm(v3.sub(smooth3[n], smooth3[n - 1]))];
  }
  const stripStart = tKlebt - .05, stripEnd = tGerade - .25;
  function updateStrip(ts) {
    strip.begin();
    if (ts > stripStart) {
      const head = clamp((ts - stripStart) / (stripEnd - stripStart)); const e = head * head * (3 - 2 * head) * .4 + head * .6;
      const run = Math.max(0, ts - stripEnd) * 1.1;
      const off = (run % FRW);
      const cell = ctx.thumbFull;
      for (let i = 0; i < stripN; i++) {
        const s = i * FRW + off; if (s > e * tot) break;
        const [p, tn] = pathAt(s);
        // Der Streifen peitscht, solange sein Kopf unterwegs ist.
        const front = 1 - clamp((e * tot - s) / 4);
        const wob = Math.sin(s * 3.1 - ts * 22) * front * .08;
        const ang = Math.atan2(tn[1], tn[0]);
        const idx = (i - Math.floor(run / FRW)) % 216; const c = cell(idx < 0 ? idx + 216 : idx);
        strip.push(M.mul(M.T(p[0], p[1] + wob, p[2] + wob * .6), M.RZ(ang)), [0, 0, 0, 0], c.b, [thumbs, ID, 1, 1]);
      }
    }
    strip.end();
  }
  // Grosse Spule
  const reel = part(E, ID, gg => {
    gg.s({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .26 });
    gg.at([0, 0, 0], [PI / 2, 0, 0], () => {
      gg.torus(.32, .012, 44, 8);
      gg.rcyl(.05, .05, .01, 18);
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; gg.tube([[Math.cos(a) * .05, 0, Math.sin(a) * .05], [Math.cos(a) * .32, 0, Math.sin(a) * .32]], .01, 6); }
    });
    gg.with({ c: '#18171a', mat: MAT.plain, m: 0, r: .22 }, () => gg.at([0, 0, -.012], [PI / 2, 0, 0], () => gg.lathe([[.06, -.012], [.27, -.012], [.27, .012], [.06, .012]], 44)));
  });
  const reelPos = [1.72, r.y1 - 1.28, -.72];

  // ---------------------------------------------------- Fallblatt
  const digitDoc = E.addDoc(canvas(1024, 1024, (x, w, h) => {
    const cw = w / 4, ch = h / 3;
    x.fillStyle = '#0c0c0f'; x.fillRect(0, 0, w, h);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let d = 0; d < 10; d++) {
      const cx = (d % 4 + .5) * cw, cy = (Math.floor(d / 4) + .5) * ch;
      x.fillStyle = '#ece6d2'; x.font = '500 300px "JetBrains Mono"'; x.fillText(String(d), cx, cy + 12);
    }
  }));
  const flapI = many(E, ID, 28, gg => { gg.s({ c: '#ffffff', mat: MAT.plain, r: .34 }); gg.card(1, 1); });
  flapI.shadowRoom = -99;
  const CW = 1 / 4, CH = 1 / 3;
  const uvOf = (d, half) => [CW, CH / 2, (d % 4) * CW, Math.floor(d / 4) * CH + (half ? CH / 2 : 0)];
  function digitAt(n, k) { return Math.floor(n / 10 ** k) % 10; }
  function updateFlaps(ts) {
    flapI.begin();
    const FD = .11;
    const now = counter(ts);
    for (let i = 0; i < 6; i++) {
      const k = 5 - i, x = FB.x + (i - 2.5) * FB.dw, y = FB.y, z = FB.z + .07;
      const d = digitAt(now, k);
      // Wann hat diese Stelle zuletzt gewechselt? Reine Funktion: zurueckschauen.
      let prev = d, age = FD;
      for (let a = 1 / 60; a < FD; a += 1 / 60) { const v = digitAt(counter(ts - a), k); if (v !== d) { prev = v; age = a; break; } }
      const w = FB.dw * .9, h = FB.dh / 2 - .004;
      const top = M.mul(M.T(x, y + h / 2 + .004, z), M.S(w, h, 1));
      const bot = M.mul(M.T(x, y - h / 2 - .004, z), M.S(w, h, 1));
      flapI.push(top, [0, 0, 0, 0], uvOf(d, 0), [digitDoc, ID, 1, 1]);
      flapI.push(bot, [0, 0, 0, 0], uvOf(age < FD ? prev : d, 1), [digitDoc, ID, 1, 1]);
      if (age < FD) {
        const u = age / FD, a = u * PI;
        if (u < .5) { flapI.push(M.mul(M.mul(M.T(x, y, z + .003), M.RX(-a)), M.mul(M.T(0, h / 2 + .004, 0), M.S(w, h, 1))), [0, 0, 0, 0], uvOf(prev, 0), [digitDoc, ID, 1, 1]); }
        else { flapI.push(M.mul(M.mul(M.T(x, y, z + .003), M.RX(PI - a)), M.mul(M.T(0, -h / 2 - .004, 0), M.S(w, h, 1))), [0, 0, 0, 0], uvOf(d, 1), [digitDoc, ID, 1, 1]); }
      }
    }
    flapI.end();
  }

  // Was der Film im Film gerade zeigen soll.
  const ahaLamps = [cue(12, 'Damit'), cue(12, 'ist'), cue(12, 'Video'), cue(12, 'plötzlich'), cue(12, 'eine'), cue(12, 'Schreibaufgabe'), cue(12, 'Schreibaufgabe') + .32, cue(12, 'Und')];
  const rigRest = 8.2;
  const rigX = t => mix(rigRest, RIG.x, smooth(tRig, tRigIn - .1, t));
  ctx.whiteOut = t => {
    const up = smooth(tGerade + .15, cue(12, 'Damit') - .3, t), dn = 1 - smooth(cue(12, 'Damit') - .02, cue(12, 'Damit') + .55, t);
    return up * dn;
  };
  ctx.buehneInner = (t) => {
    if (t < on - .1 || t > cue(13, 'Aber') + 4) return null;
    if (t >= self - .3 && t < tEins - .12) return 'self';
    return sliderTime(t);
  };

  return {
    frame(t, world) {
      const showUI = (t > on && t < cue(13, 'Aber') + 4) || t > cue(24, 'Wer') + 1.3;
      uiCard.visible = showUI; { const on = showUI && t < cue(12, 'Damit') + .8, self = ctx.buehneInner(t) === 'self'; vidCard.visible = on && !self; vidSelf.visible = on && self; }
      if (showUI) paintUI(t);
      monL.power = showUI ? smooth(on, on + .5, t) * (1 + .05 * Math.sin(t * 40) * 0) : 0;
      const aha = smooth(cue(12, 'Damit') - .1, cue(12, 'Damit'), t) * (1 - smooth(cue(13, 'Aber') - .6, cue(13, 'Aber') + .6, t));
      baseA.power = baseB.power = rooms[ID].power * mix(1, .34, aha);
      towerL.power = smooth(tNeun - 1.2, tNeun - .2, t);
      beltL.power = smooth(cue(11, 'Foto', 0) - .4, cue(11, 'Foto', 0) + .3, t) * (1 - smooth(tNeun, tNeun + 1, t));
      rigFill.power = smooth(cue(11, 'Jetzt'), cue(11, 'Jetzt') + .9, t) * (1 - smooth(cue(11, 'klebt'), cue(11, 'klebt') + 1, t));
      // Scheinwerfer nacheinander
      lampL.forEach((l, i) => {
        const on0 = ahaLamps[i], u = t < on0 ? 0 : Math.min(1, (t - on0) / .14);
        const fl = u >= 1 ? 1 : (hash(i * 3.3 + Math.floor(t * 40)) > .4 ? u : u * .3);
        l.power = fl; lampG[i].level = fl;
      });
      // Projektor
      const pl = rise(t, tGerade - .4, .3);
      projL.power = pl; projG.level = pl;
    },
    sub(ts, s, N, t, eye) {
      const inRoom = true;
      updateBook(ts);
      updateFlaps(ts);
      const sh = (s + .5) / N;
      lampG.forEach(l => { l.visible = sh <= l.level; });
      projG.visible = sh <= projG.level;
      // Kamera
      const rx = rigX(ts);
      const ring = M.T(rx, RIG.y, RIG.z);
      rig.set(ring);
      const sw = Math.sin(ts * 3) * .05 + bump(ts, tFoto[0], .5) * .4;
      tag.set(M.mul(M.T(rx - .31, RIG.y - .14, RIG.z + .375), M.mul(M.RX(.06 + sw * .25), M.T(0, -.04, 0))));
      // Blitz: Was je Schuss passiert, passiert in der Zeit, nicht im Zustand.
      let fl = 0;
      for (const f of tFoto) fl = Math.max(fl, ts >= f && ts < f + .12 ? 1 - (ts - f) / .12 : 0);
      if (ts >= tNeun && ts < tTowerEnd) { const n = shots(ts); const rate2 = 60; fl = Math.max(fl, (ts * rate2 + hash(Math.floor(ts * rate2))) % 1 < .35 ? 1 : 0); }
      // Die schnelle Serie sieht man am Blitz, nicht an der Wand: 60 Blitze je Sekunde auf 30 Bilder liessen den ganzen Raum zufaellig zucken.
      flashL.power = ts >= tNeun && ts < tTowerEnd ? .2 : fl;
      bulb.set(M.mul(M.T(rx + .03, RIG.y + .08 + .55, RIG.z - .13), M.S(1)));
      bulb.visible = fl > .05 && sh <= fl + .02;
      // Abzuege
      print.begin();
      const n = shots(ts);
      const newest = Math.floor(n);
      const belt = TOWER.x - RIG.x - .05;
      const beltT = ts < tNeun ? 1.4 : .34;
      for (let i = 0; i < 18; i++) {
        const k = newest - 1 - i; if (k < 0) break;
        const t0 = shotTime(k), a = ts - t0; if (a < 0) continue;
        const fallD = .4;
        const cell = ctx.thumbCell(Math.floor(k / FRAMES * 216));
        const yEj = RIG.y - .1, zEj = RIG.z + .36;
        let p, rot;
        if (a < fallD) { const u = a / fallD; p = [RIG.x + Math.sin(u * 3 + k) * .03, mix(yEj, BY + .012, u * u), mix(zEj, BZ, u)]; rot = (1 - u) * 1.1; }
        else { const u = (a - fallD) / beltT; if (u > 1) continue; p = [RIG.x + u * belt, BY + .012, BZ]; rot = 0; }
        print.push(M.mul(M.T(p[0], p[1], p[2]), M.RX(rot)), [0, 0, 0, 0], cell.b, [thumbs, ID, 1, 1]);
      }
      print.end();
      // Turm
      const H = Math.max(.002, towerH(ts));
      tower.begin();
      if (H > .004) tower.push(M.mul(M.T(TOWER.x, FLOOR + .06, TOWER.z), M.S(1, H, 1)), [0, 0, 0, 0], [1, H / TOWER.H, 0, 0], [barcode, ID, 1, 1]);
      tower.end();
      towerTop.set(M.T(TOWER.x, FLOOR + .06 + H, TOWER.z));
      updateStrip(ts);
      const spin = ts < stripStart ? 0 : (ts - stripStart) * 3.2;
      reel.set(M.mul(M.T(reelPos[0], reelPos[1], reelPos[2]), M.RZ(spin)));
    },
  };
}
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
