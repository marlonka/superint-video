// Tonstudio und Musikzimmer: Niemand spricht ins Mikrofon, das Klavier spielt allein, der Schreiber notiert jedes Wort. Auf DIESEM Wort schlaegt die Kugel an.
import { Geo, MAT } from './geo.js';
import { M, PI, TAU, clamp, mix, smooth, hash, lin, v3 } from './m.js';
import { part, many, canvas, paperGround, cue, cueE, INK, bump, wrap } from './kit.js';
import * as P from './props.js';
import { ROOM, R } from './house.js';
import { WORDS } from './cues.js';
import { ENV } from './envelope.js';

const TON = ROOM.TON, MUS = ROOM.MUSIK, FL = 7.2;
export const MIC = { x: -6.42, y: FL + 1.58, z: -1.7 };
export const READER = { x: -5.62, y: FL + 1.28, z: -1.9, w: .42, h: .86 };
export const CHART = { x: -7.15, y: FL + .92, z: -1.5, w: 1.3, d: .5 };
export const METER = { x: -4.74, y: FL + 1.42, z: -2.5 };
export const PHONES = { x: -6.42, y: FL + 1.33, z: -1.7 };
export const GONG = { x: -4.82, y: FL + 2.32, z: -2.55 };
export const PIANO = { x: -1.9, y: FL, z: -2.96 };
const env = t => ENV[Math.max(0, Math.min(ENV.length - 1, Math.floor(t * 30)))] / 99;

export function buildTon(ctx) {
  const { E, rooms, light, liveSlots } = ctx;
  const r = R.TON, g = new Geo(); g.s({ room: TON });
  P.roomShell(g, r, { wallC: '#123845', wallM: MAT.foam, wallR: .95, floorC: '#231412', floorM: MAT.rug, floorR: 1, ceilC: '#0f2a33' });
  g.with({ c: '#0a1d24', mat: MAT.foam, r: .98 }, () => g.rect([r.x0, r.y1 - .003, r.z0], [r.x1, r.y1 - .003, r.z0], [r.x1, r.y1 - .003, r.z1], [r.x0, r.y1 - .003, r.z1], [0, -1, 0]));
  // Teppichkante und Sockel
  g.with({ c: '#0b0b0e', r: .4 }, () => { g.at([(r.x0 + r.x1) / 2, FL + .05, r.z0 + .02], () => g.rbox(3.8, .1, .04, .006)); });

  // ---------------------------------------------------- Mikrofon: Niemand steht davor.
  const m = MIC;
  g.at([m.x, FL, m.z], () => {
    g.with({ c: '#1a1b20', mat: MAT.brushed, m: 1, r: .36 }, () => {
      g.lathe([[0, .0], [.19, 0], [.2, .02], [.15, .045], [.03, .06], [.016, .08], [0, .08]], 30);
      g.at([0, .7, 0], () => g.cyl(.012, 1.3, 10));
      g.at([0, 1.36, 0], () => g.rcyl(.021, .05, .006, 12));
      g.tube([[0, 1.36, 0], [0, m.y - FL - .1, .03], [0, m.y - FL, .08]], .008, 8);
    });
  });
  const micG = gg => {
    // Spinne
    gg.with({ c: '#26272c', mat: MAT.brushed, m: 1, r: .32 }, () => { gg.at([0, 0, 0], () => gg.torus(.09, .005, 26, 6)); gg.at([0, -.11, 0], () => gg.torus(.09, .005, 26, 6)); gg.at([0, .11, 0], () => gg.torus(.09, .005, 26, 6)); });
    gg.with({ c: '#1a1a1e', r: .85 }, () => { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; gg.tube([[Math.cos(a) * .09, -.11, Math.sin(a) * .09], [Math.cos(a + .35) * .036, 0, Math.sin(a + .35) * .036], [Math.cos(a) * .09, .11, Math.sin(a) * .09]], .0018, 4); } });
    // Koerper und Korb
    gg.with({ c: '#c9ccd2', mat: MAT.brushed, m: 1, r: .25 }, () => gg.lathe([[0, -.2], [.032, -.2], [.036, -.18], [.036, .06], [.042, .065], [.042, .075]], 28));
    gg.with({ c: '#8a8d95', mat: MAT.screen, m: 1, r: .4 }, () => gg.lathe([[.041, .075], [.044, .1], [.044, .15], [.036, .19], [.016, .21], [0, .212]], 28));
    gg.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .25 }, () => gg.at([0, .124, 0], () => gg.torus(.045, .0025, 28, 5)));
  };
  g.at([m.x, m.y, m.z + .08], () => micG(g));
  // Ploppschutz
  g.at([m.x, m.y + .1, m.z + .32], [PI / 2, 0, 0], () => { g.with({ c: '#101013', r: .5 }, () => g.torus(.1, .005, 30, 6)); g.with({ c: '#26303a', mat: MAT.glass, r: .5 }, () => g.lathe([[0, 0], [.098, 0]], 30)); });
  g.with({ c: '#26272c', mat: MAT.brushed, m: 1, r: .4 }, () => g.tube([[m.x, m.y - .22, m.z + .03], [m.x + .05, m.y - .08, m.z + .12], [m.x + .03, m.y + .0, m.z + .24]], .004, 6));
  // Kabel: vom Mikrofon hinten zum Pult
  g.with({ c: '#0b0b0e', r: .5 }, () => { const a = []; for (let i = 0; i <= 26; i++) { const u = i / 26; a.push([mix(m.x, -4.9, u) + Math.sin(u * 9) * .08, FL + .012 + (u < .06 ? (1 - u / .06) * .05 : 0), mix(m.z, -2.5, u) + Math.cos(u * 7) * .12]); } g.tube(a, .007, 6); });

  // ---------------------------------------------------- Lesegeraet: Papierrolle mit dem Text, Wort fuer Wort
  const a = READER;
  g.at([a.x, FL, a.z], () => {
    g.with({ c: '#1a1b20', mat: MAT.brushed, m: 1, r: .4 }, () => { g.lathe([[0, 0], [.16, 0], [.17, .02], [.03, .05], [0, .06]], 24); g.at([0, .45, 0], () => g.cyl(.012, .82, 10)); });
  });
  g.at([a.x, a.y, a.z], [-.18, 0, 0], () => {
    g.with({ c: '#2a160c', mat: MAT.wood, r: .3 }, () => g.at([0, 0, -.012], () => g.rbox(a.w + .08, a.h + .1, .022, .006)));
    g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .25 }, () => {
      for (const y of [-a.h / 2 - .035, a.h / 2 + .035]) g.at([0, y, .022], [0, 0, PI / 2], () => g.cyl(.022, a.w + .03, 16));
      // Lesezeiger
      g.at([-a.w / 2 - .02, .0, .012], [0, 0, 0], () => g.prism([[0, -.018], [.042, 0], [0, .018]], .008));
      g.at([a.w / 2 + .02, .0, .012], [0, 0, 0], () => g.prism([[0, -.018], [-.042, 0], [0, .018]], .008));
    });
  });
  const plateDoc = (txt, sz = 104) => E.addDoc(canvas(1024, 256, (x, w, h) => { x.fillStyle = '#b89a55'; x.fillRect(0, 0, w, h); x.strokeStyle = '#16120a'; x.lineWidth = 6; x.strokeRect(10, 10, w - 20, h - 20); x.fillStyle = '#16120a'; x.font = `700 ${sz}px Jost`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 + 4); }));
  g.at([a.x, a.y - a.h / 2 - .1, a.z + .03], [-.18, 0, 0], () => g.with({ c: '#ffffff', tex: plateDoc('Sprachmodell von Google', 66), r: .34, mat: MAT.plain }, () => g.card(.42, .08)));

  // ---------------------------------------------------- Pult mit Zeigern, Kugelbahn, Gong
  g.at([-4.74, FL, -2.3], () => {
    g.with({ c: '#22242a', mat: MAT.plain, r: .35 }, () => { g.at([0, .42, 0], () => g.rbox(.84, .84, 1.5, .012, 2)); g.at([.08, 1.02, -.2], () => g.rbox(.62, .36, .9, .012, 2)); });
    g.with({ c: '#3a3c44', mat: MAT.brushed, m: 1, r: .3 }, () => { for (let i = 0; i < 14; i++) g.at([-.42, .9 - (i % 2) * .05, -.65 + i * .095], () => g.rbox(.012, .03, .05, .002)); });
    // Bandspulen
    for (const z of [-.46, .1]) g.at([-.42, .55, z], [0, 0, PI / 2], () => { g.with({ c: '#5a5c63', mat: MAT.brushed, m: 1, r: .28 }, () => { g.cyl(.16, .012, 34); }); g.with({ c: '#1a1a1e', r: .35 }, () => g.at([0, .01, 0], () => g.cyl(.14, .008, 32))); g.with({ c: '#d9dade', mat: MAT.brushed, m: 1, r: .3 }, () => g.at([0, .02, 0], () => g.cyl(.03, .02, 14))); });
  });
  // Instrumentenkasten mit grossem Zeiger, schaut zur Kamera
  const meterFace = E.addDoc(canvas(1024, 512, (x, w, h) => {
    x.fillStyle = '#e8dcbc'; x.fillRect(0, 0, w, h); x.strokeStyle = '#1b1a1e'; x.fillStyle = '#1b1a1e'; x.lineWidth = 6;
    const cx = w / 2, cy = h * 1.05, R0 = h * .78;
    x.beginPath(); x.arc(cx, cy, R0, -PI * .78, -PI * .22); x.stroke();
    for (let i = 0; i <= 20; i++) { const a0 = -PI * .78 + i / 20 * PI * .56, l = i % 5 ? 22 : 44; x.lineWidth = i % 5 ? 3 : 6; x.beginPath(); x.moveTo(cx + Math.cos(a0) * R0, cy + Math.sin(a0) * R0); x.lineTo(cx + Math.cos(a0) * (R0 + l), cy + Math.sin(a0) * (R0 + l)); x.stroke(); }
    x.strokeStyle = '#a0201a'; x.lineWidth = 14; x.beginPath(); x.arc(cx, cy, R0 - 10, -PI * .34, -PI * .22); x.stroke();
    x.font = '700 66px Jost'; x.textAlign = 'center'; x.fillText('STIMME', cx, h * .72);
  }));
  const FACE = { w: .6, h: .3 };
  g.at([METER.x - .02, METER.y, METER.z + .28], () => {
    g.with({ c: '#14151a', mat: MAT.plain, r: .35 }, () => g.at([0, 0, -.04], () => g.rbox(FACE.w + .08, FACE.h + .08, .1, .012, 2)));
    g.with({ c: '#ffffff', tex: meterFace, mat: MAT.plain, r: .35 }, () => g.at([0, 0, .012], () => g.card(FACE.w, FACE.h)));
  });
  // Kugelbahn an der Rueckwand
  const TZ = r.z0 + .2;
  const RUN = [[-7.75, 9.95, TZ], [-5.55, 9.62, TZ], [-5.3, 9.5, TZ], [-5.55, 9.34, TZ], [-7.6, 9.02, TZ], [-7.8, 8.88, TZ], [-7.6, 8.72, TZ], [-5.25, 8.42 + .9, TZ - 0]];
  // Glatte Bahn: Geraden mit runden Kehren.
  const run3 = []; {
    const K = [[-7.8, 10.02], [-5.45, 9.62], [-5.24, 9.48], [-5.45, 9.32], [-7.56, 9.0], [-7.76, 8.84], [-7.56, 8.68], [-5.2, 9.52 - .78], [GONG.x - .2, GONG.y - .02 - .48 + .0]];
    for (let i = 0; i < K.length - 1; i++) { for (let k = 0; k < 12; k++) { const u = k / 12; run3.push([mix(K[i][0], K[i + 1][0], u), mix(K[i][1], K[i + 1][1], u), TZ]); } }
    run3.push([K[K.length - 1][0], K[K.length - 1][1], TZ]);
    for (let it = 0; it < 4; it++) for (let i = 1; i < run3.length - 1; i++) run3[i] = v3.mix(v3.mix(run3[i - 1], run3[i + 1], .5), run3[i], .5);
  }
  // Ende der Bahn: Kugel steigt in die Schale vor dem Gong.
  const last = run3[run3.length - 1];
  g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .26 }, () => {
    for (const s of [-1, 1]) g.tube(run3.map(p => [p[0], p[1] - .017, p[2] + s * .024]), .0058, 6);
    for (let i = 0; i < run3.length; i += 8) g.tube([[run3[i][0], run3[i][1] - .022, r.z0 + .012], [run3[i][0], run3[i][1] - .022, run3[i][2] + .024]], .0052, 5);
  });
  // Gong
  const G = GONG;
  g.with({ c: '#2a160c', mat: MAT.wood, r: .3 }, () => {
    g.at([G.x, G.y + .46, G.z - .25], () => g.rbox(.74, .04, .04, .006));
    for (const s of [-1, 1]) g.at([G.x + s * .35, G.y - .06, G.z - .25], () => g.rbox(.04, 1.08, .04, .006));
  });
  const gong = part(E, TON, gg => {
    gg.s({ c: '#b98c3a', mat: MAT.brushed, m: 1, r: .3 });
    gg.at([0, -.43, 0], [PI / 2, 0, 0], () => { gg.lathe([[0, .006], [.2, .002], [.27, -.012], [.28, -.04], [.27, -.04], [.26, -.016], [.2, -.004], [0, -.006]], 44); });
    gg.with({ c: '#3a2a16', r: .7 }, () => { for (const s of [-1, 1]) gg.at([s * .07, -.08, 0], () => gg.cyl(.0025, .16, 5)); });
  });
  // ON AIR
  const air = { x: -6.1, y: r.y1 - .42, z: r.z0 + .05 };
  g.at([air.x, air.y, air.z], () => g.with({ c: '#1a1a1e', mat: MAT.brushed, m: 1, r: .35 }, () => g.at([0, 0, -.02], () => g.rbox(.82, .3, .06, .012, 2))));
  const airDoc = E.addDoc(canvas(1024, 384, (x, w, h) => { x.fillStyle = '#2a0303'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff1ec'; x.font = '700 200px Jost'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('ON AIR', w / 2, h / 2 + 8); }));
  const airCard = part(E, TON, gg => { gg.s({ c: '#ffffff', tex: airDoc, flag: 8, e: 3.2, r: .2 }); gg.card(.74, .24); });
  airCard.set(M.T(air.x, air.y, air.z + .016));
  g.with({ c: '#200606', r: .3 }, () => g.at([air.x, air.y, air.z + .014], () => g.card(.74, .24)));
  // Kopfhoerer am Mikrofonstaender. Das Kabel haengt lose: Niemand hoert zu.
  const ph = PHONES;
  light(TON, r, { pos: [ph.x + .42, ph.y + .62, ph.z + 1.0], dir: norm([-.42, -.72, -1.0]), angle: .42, inner: .24, color: [12, 10, 7.4], range: 3, size: .08, near: .05 });
  g.at([ph.x, ph.y, ph.z], () => {
    g.with({ c: '#c49b49', mat: MAT.brushed, m: .3, r: .28 }, () => { g.tube([[0, -.015, 0], [0, -.01, .05], [0, .012, .072]], .0045, 6); g.at([0, -.015, 0], () => g.cyl(.014, .03, 12)); });
    const Z = .06, R0 = .125, YB = -.135;
    g.with({ c: '#17151a', mat: MAT.leather, r: .5 }, () => g.at([0, YB, Z], [PI / 2, 0, 0], () => g.torus(R0, .0095, 32, 8, PI, TAU)));
    for (const s of [-1, 1]) g.at([s * R0, YB - .036, Z], [0, 0, PI / 2], () => {
      g.with({ c: '#25222a', mat: MAT.brushed, m: .3, r: .36 }, () => g.rcyl(.058, .028, .008, 24));
      g.with({ c: '#c49b49', mat: MAT.brushed, m: .3, r: .26 }, () => g.at([0, -s * .0145, 0], () => g.torus(.044, .0032, 28, 6)));
      g.with({ c: '#352720', mat: MAT.leather, r: .85 }, () => g.at([0, s * .024, 0], () => g.rcyl(.052, .022, .009, 24)));
    });
    // Das Kabel haengt ins Leere, mit einem Stecker, der nirgends steckt.
    g.with({ c: '#0e0e11', r: .5 }, () => g.tube([[-R0 - .012, YB - .09, Z], [-R0 - .014, YB - .17, Z + .012], [-R0 + .018, YB - .27, Z + .03], [-R0 - .004, YB - .34, Z + .024], [-R0 - .002, YB - .385, Z + .022]], .0035, 6));
    g.with({ c: '#101013', r: .4 }, () => g.at([-R0 - .002, YB - .4, Z + .022], () => g.rcyl(.0085, .036, .003, 12)));
    g.with({ c: '#d9b45a', mat: MAT.brushed, m: .3, r: .22 }, () => g.at([-R0 - .002, YB - .437, Z + .022], () => g.cyl(.0042, .04, 10)));
  });

  // ---------------------------------------------------- Schreiber: Papierstreifen mit Woertern und Zeiten
  const c0 = CHART;
  g.at([c0.x, FL, c0.z], () => {
    g.with({ c: '#2a160c', mat: MAT.wood, r: .32, grain: 1 }, () => { g.at([0, .86, 0], () => g.rbox(1.42, .045, .72, .008, 2)); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.at([sx * .62, .42, sz * .24], () => g.cyl(.024, .84, 10, .018)); });
    g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .25 }, () => { for (const s of [-1, 1]) g.at([s * .68, .925, -.0], [PI / 2, 0, 0], () => g.cyl(.03, .58, 16)); g.at([0, 1.15, -.34], () => g.rbox(.08, .4, .05, .008)); });
    g.with({ c: '#ded3b4', mat: MAT.paper, r: .8 }, () => { g.at([-.68, .925, -.0], [PI / 2, 0, 0], () => g.cyl(.052, .52, 22)); });
    g.with({ c: '#ded3b4', mat: MAT.paper, r: .8 }, () => { g.at([.68, .925, -.0], [PI / 2, 0, 0], () => g.cyl(.07, .52, 22)); });
  });
  g.at([c0.x, c0.y - .058, c0.z + .34], [.0, 0, 0], () => g.with({ c: '#ffffff', tex: plateDoc('Transkription', 110), r: .34, mat: MAT.plain }, () => g.card(.34, .08)));
  // Papier: lebendig (Fenster 1)
  const UI = liveSlots.ui, CH_U0 = 640 / 2048, CH_V1 = 541 / 1152;
  const chartCard = part(E, TON, gg => { gg.s({ c: '#ffffff', tex: 201, r: .8, mat: MAT.paper }); gg.sheet(c0.w, c0.d, 1, 1, [CH_U0, 0, 1, CH_V1]); });
  chartCard.set(M.T(c0.x, c0.y - .005, c0.z));
  const rollCard = part(E, TON, gg => { gg.s({ c: '#ffffff', tex: 201, r: .8, mat: MAT.paper }); gg.card(a.w, a.h, [0, 0, CH_U0, 1]); });
  rollCard.set(M.mul(M.T(a.x, a.y, a.z), M.mul(M.RX(-.18), M.T(0, 0, .004))));
  // Dasselbe als feste Ansicht fuer spaetere Totalen
  const P14_ = WORDS.filter(w => w[3] === 14);
  const LINES = []; { let ln = []; let n = 0; for (const w of P14_) { const l = w[0].length + 1; if (n + l > 22 && ln.length) { LINES.push(ln); ln = []; n = 0; } ln.push(w); n += l; } if (ln.length) LINES.push(ln); }
  const still = canvas(1024, 1024, (x, w, h) => { paperGround(x, w, h, '#c9c2b0', 31); x.fillStyle = INK; x.font = '700 58px "Courier Prime"'; LINES.slice(0, 13).forEach((ln, i) => x.fillText(ln.map(q => q[0]).join(' '), 60, 110 + i * 70)); });
  const stillDoc = E.addDoc(still);
  const chartStill = part(E, TON, gg => { gg.s({ c: '#ffffff', tex: stillDoc, r: .8, mat: MAT.paper }); gg.sheet(c0.w, c0.d, 1, 1); });
  chartStill.set(M.T(c0.x, c0.y - .006, c0.z));
  const rollStill = part(E, TON, gg => { gg.s({ c: '#ffffff', tex: stillDoc, r: .8, mat: MAT.paper }); gg.card(a.w, a.h); });
  rollStill.set(M.mul(M.T(a.x, a.y, a.z), M.mul(M.RX(-.18), M.T(0, 0, .0035))));
  // Schreibarm
  const pen = part(E, TON, gg => {
    gg.with({ c: '#26272c', mat: MAT.brushed, m: 1, r: .35 }, () => gg.at([0, .07, -.18], () => gg.rbox(.012, .012, .36, .003)));
    gg.with({ c: '#d9dade', mat: MAT.brushed, m: 1, r: .28 }, () => gg.at([0, .035, 0], () => gg.cyl(.006, .07, 8, .002)));
  });
  // Nadeln
  const needle = part(E, TON, gg => { gg.s({ c: '#a0201a', r: .35, flag: 0 }); gg.at([0, .155, 0], () => gg.box(.0055, .31, .002, 1)); });
  const ball = part(E, TON, gg => { gg.s({ c: '#ecc66a', mat: MAT.brushed, m: .35, r: .2, e: .35 }); gg.sphere(.05, 22, 14); });
  // Staub und Flocken beim Schlag
  const dust = many(E, TON, 90, gg => { gg.s({ c: '#b9b0a0', mat: MAT.plain, r: .95 }); gg.sheet(.012, .012, 1, 1); });
  dust.shadowRoom = -99;

  E.addStatic(g, TON);
  rooms[TON] = { up: lin('#2b5a68').map(v => v * .34), dn: lin('#140c0c').map(v => v * .4), fill: [.022, .042, .05], power: 1, gloss: .55, min: [r.x0, r.y0, r.z0], max: [r.x1, r.y1, r.z1] };
  const key = light(TON, r, { pos: [m.x + .1, r.y1 - .2, -1.0], dir: norm([0, -1, -.4]), angle: .85, inner: .5, color: [22, 23, 25], range: 6, size: .12, haze: .0035 });
  light(TON, r, { pos: [-4.9, r.y1 - .35, -1.5], dir: norm([.05, -1, -.5]), angle: 1.1, inner: .8, color: [7, 6.2, 5], range: 5, size: .12, haze: .002 });
  light(TON, r, { pos: [c0.x + .1, r.y1 - .25, c0.z + .2], dir: norm([0, -1, -.1]), angle: .85, inner: .52, color: [10, 8.6, 6.5], range: 5, size: .1, bias: .002 });
  const airL = light(TON, r, { pos: [air.x, air.y - .24, air.z + .45], dir: norm([0, -.6, -.4]), angle: 1.35, inner: .9, color: [7, .35, .25], range: 3.2, size: .15, manual: true, power: 0, haze: .001 });
  const hitL = light(TON, r, { pos: [G.x - .15, G.y - .25, G.z + 1.1], dir: norm([-.5, -.12, -1]), angle: 1.42, inner: 1, color: [60, 52, 38], range: 8, size: .4, manual: true, power: 0, haze: .012 });

  // ---------------------------------------------------- Zeitplan
  const tOn = cue(14, 'Diese') - .2;
  const tRoll = cue(14, 'Darum'), tHit = cue(14, 'DIESEM');
  // Bahnlaenge
  const segL = []; let total = 0; for (let i = 1; i < run3.length; i++) { const d = v3.len(v3.sub(run3[i], run3[i - 1])); segL.push(d); total += d; }
  function ballAt(ts) {
    if (ts < tRoll) return run3[0];
    const u = clamp((ts - tRoll) / (tHit - tRoll - .01));
    let s = (u * u * .55 + u * .45) * total;
    for (let i = 0; i < segL.length; i++) { if (s <= segL[i]) return v3.mix(run3[i], run3[i + 1], s / segL[i]); s -= segL[i]; }
    return run3[run3.length - 1];
  }
  const P14 = WORDS.filter(w => w[3] === 14);
  const ALLW = WORDS.filter(w => w[3] >= 13 && w[3] <= 15);
  let key0 = '';
  // Zeilen des Lesestreifens: echte Woerter, automatisch gebrochen.
  const P14T = 'Diese Stimme gehört mir übrigens nicht. Ein Modell von Google spricht, was ich schreibe. Die Musik macht ein anderes. Ich rufe beide selbst auf, niemand muss für mich Knöpfe drücken. Ich höre davon nichts. Aber noch ein Modell schreibt mir jedes Wort mit der genauen Zeit auf. Darum kann das hier genau auf DIESEM Wort passieren.'.split(' ');
  const PT = new Map(P14.map((w, i) => [w, P14T[i] || w[0]]));
  const RL = []; { let ln = []; let n = 0; for (const w of P14) { const l = PT.get(w).length + 1; if (n + l > 16 && ln.length) { RL.push(ln); ln = []; n = 0; } ln.push(w); n += l; } if (ln.length) RL.push(ln); }
  // Bahnen der Woerter: 300 Pixel je Sekunde Papier, Courier 44 hat 26,4 Pixel je Zeichen.
  const CHW = (() => { const free = [-1e9, -1e9, -1e9], out = []; for (const w of ALLW) { const need = Math.max(w[0].length * 26.4, 90) + 26; let row = 0, best = free[0]; for (let i = 1; i < 3; i++) if (free[i] < best) { best = free[i]; row = i; } const X = w[1] * 260; if (X < free[row]) continue; free[row] = X + need; out.push({ s: w[0], t: w[1], row }); } return out; })();
  function paint(t) {
    const fr = Math.floor(t * 30);
    if (fr === key0 && UI.owner === 'ton') return; key0 = fr; UI.owner = 'ton';
    UI.paint(x => {
      const W = 2048, H = 1152, Lw = 640;
      x.save();
      // ------------------------ Rolle links
      x.beginPath(); x.rect(0, 0, Lw, H); x.clip();
      paperGround(x, Lw, H, '#efe8d8', 12);
      let li = 0, frac = 0;
      for (let i = 0; i < RL.length; i++) { const a0 = RL[i][0][1], b0 = RL[i + 1] ? RL[i + 1][0][1] : RL[i][RL[i].length - 1][2]; if (t >= a0) { li = i; frac = clamp((t - a0) / Math.max(.01, b0 - a0)); } }
      if (t < RL[0][0][1]) { li = 0; frac = 0; }
      const lh = 86, y0 = H / 2 - (li + frac) * lh;
      x.textBaseline = 'middle'; x.textAlign = 'left'; x.font = '700 58px "Courier Prime"';
      RL.forEach((ln, i) => {
        const y = y0 + i * lh; if (y < -60 || y > H + 60) return; let cx = 34;
        for (const w of ln) { const done = t >= w[1]; x.fillStyle = done ? 'rgba(27,26,30,.96)' : 'rgba(27,26,30,.34)'; const s = PT.get(w) + ' '; x.fillText(s, cx, y); cx += x.measureText(s).width; }
      });
      x.restore();
      // ------------------------ Papierstreifen rechts: laeuft mit der Zeit, Welle und Woerter.
      x.save(); x.beginPath(); x.rect(Lw, 0, W - Lw, H); x.clip();
      x.translate(Lw, 0);
      const SW = W - Lw;
      paperGround(x, SW, H, '#efe8d8', 12);
      // Raster
      x.strokeStyle = 'rgba(160,32,26,.16)'; x.lineWidth = 2;
      const pps = 260; // Pixel je Sekunde
      const penX = SW / 2;
      const first = Math.floor(t - penX / pps);
      for (let s = first; s < t + 3; s += .25) { const px = penX + (s - t) * pps; if (px < 0 || px > SW) continue; x.globalAlpha = Math.abs(s - Math.round(s)) < .01 ? 1 : .35; x.beginPath(); x.moveTo(px, 0); x.lineTo(px, H); x.stroke(); }
      x.globalAlpha = 1;
      const mid = 150;
      x.strokeStyle = 'rgba(27,26,30,.88)'; x.lineWidth = 5; x.beginPath();
      for (let px = 0; px <= penX; px += 2) { const s = t + (px - penX) / pps, v = env(s), q = Math.sin(s * 91) * .6 + Math.sin(s * 57) * .4; const y = mid + q * v * 118; px ? x.lineTo(px, y) : x.moveTo(px, y); }
      x.stroke();
      // Woerter mit Zeit, nur was schon gesprochen ist. Jede Bahn nimmt ein Wort erst, wenn das letzte zu Ende ist.
      x.textAlign = 'left';
      for (const w of CHW) {
        if (w.t > t) continue; const px = penX + (w.t - t) * pps; if (px < -360 || px > SW) continue;
        const y = 318 + w.row * 78;
        x.strokeStyle = 'rgba(27,26,30,.4)'; x.lineWidth = 2; x.beginPath(); x.moveTo(px, 250); x.lineTo(px, y - 18); x.stroke();
        x.fillStyle = INK; x.font = '700 44px "Courier Prime"'; x.fillText(w.s, px + 6, y);
        x.fillStyle = 'rgba(27,26,30,.6)'; x.font = '400 30px "Courier Prime"'; x.fillText(w.t.toFixed(2), px + 6, y + 32);
      }
      x.restore();
    });
  }
  // Feste Ansicht einmal malen, wenn alles da ist: letzter Stand.

  const inChapter = t => t > tOn - 1.5 && t < cue(15, 'Sehen') + 1;
  ctx.tonCam = { tRoll, tHit };
  return {
    frame(t) {
      const inCh = inChapter(t);
      chartCard.visible = rollCard.visible = inCh; chartStill.visible = rollStill.visible = !inCh;
      if (inCh) paint(t);
      // ON AIR: an, solange die Stimme im Raum ist, danach gedimmt als Standlicht.
      const on = smooth(tOn, tOn + .12, t);
      const flash = bump(t, tHit, .5);
      airL.power = on * (1 + flash * 5);
      hitL.power = t >= tHit ? Math.exp(-(t - tHit) * 6.5) * 1.0 : 0;
      airCard.visible = on > .02;
      key.power = rooms[TON].power;
    },
    sub(ts, s, N) {
      const v = inChapter(ts) ? env(ts) : 0;
      // Zeiger springt mit der Stimme.
      const a0 = mix(-.78, .78, Math.min(1, v * .95 + (ts >= tHit && ts < tHit + .4 ? 1 : 0)));
      needle.set(M.mul(M.T(METER.x - .02, METER.y - FACE.h * .55, METER.z + .28 + .016), M.RZ(-a0 * .74)));
      // Schreibarm
      const q = Math.sin(ts * 91) * .6 + Math.sin(ts * 57) * .4;
      const pz = c0.z - c0.d * .5 + (150 / 541) * c0.d + q * v * (118 / 541) * c0.d;
      pen.set(M.T(c0.x + 0, c0.y - .005, pz));
      // Kugel
      const p = ballAt(ts);
      ball.set(M.T(p[0], p[1] + .033, p[2]));
      // Gong
      const d = ts - tHit, sw = d > 0 ? Math.exp(-d * 1.5) * Math.sin(d * 12) * .26 : 0, trem = d > 0 ? Math.exp(-d * 4) * Math.sin(d * 75) * .012 : 0;
      gong.set(M.mul(M.T(G.x, G.y + .44, G.z), M.RX(sw + trem)));
      // Flocken
      dust.begin();
      if (d > -.01 && d < 3.6) for (let i = 0; i < 90; i++) {
        const dl = hash(i * 1.3) * .35, dd = d - dl; if (dd < 0) continue;
        const x = mix(r.x0 + .2, r.x1 - .2, hash(i * 3.1)), z = mix(r.z0 + .1, -.3, hash(i * 7.3)), y = r.y1 - .03 - dd * (1.1 + hash(i) * .8) - .5 * .3 * dd * dd;
        if (y < FL) continue;
        dust.push(M.mul(M.T(x + Math.sin(dd * 3 + i) * .1, y, z), M.mul(M.RX(dd * 5 + i), M.RZ(dd * 3.7 + i * 2))), [0, 0, 0, 0], [1, 1, 0, 0], [-1, TON, 1, 1]);
      }
      dust.end();
    },
  };
}

export function buildMusik(ctx) {
  const { E, rooms, light } = ctx;
  const r = R.MUSIK, g = new Geo(); g.s({ room: MUS });
  P.roomShell(g, r, { wallC: '#b1801f', wallM: MAT.wallB, wallR: .62, floorC: '#5a3a1e', floorR: .3, ceilC: '#d9c79a' });
  P.wainscot(g, r.x0, r.x1, FL, .86, r.z0, 7, { c: '#3a2410' });
  P.rug(g, -1.9, FL, -1.8, 2.6, 1.6, '#3f1a2a', '#c49b49');
  const X = PIANO.x, Z = PIANO.z, W = 1.56, KY = .74;
  const black = { c: '#08080b', mat: MAT.plain, r: .1, m: 0 };
  g.at([X, FL, Z], () => {
    g.with(black, () => {
      g.at([0, .68, -.1], () => g.rbox(W, 1.36, .36, .012, 3));          // Korpus
      g.at([0, KY - .05, .22], () => g.rbox(W, .08, .36, .008, 2));      // Spieltisch
      for (const s of [-1, 1]) { g.at([s * (W / 2 - .03), .35, .28], () => g.rbox(.05, .7, .1, .006)); g.at([s * (W / 2 - .03), KY + .13, .22], () => g.rbox(.05, .22, .34, .012)); }
      g.at([0, KY + .23, .06], () => g.rbox(W - .1, .03, .06, .006));
      g.at([0, 1.385, -.1], () => g.rbox(W + .05, .035, .4, .01));
    });
    g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .24 }, () => {
      for (const s of [-1, 1]) g.at([s * .52, .08, .22], () => g.rbox(.06, .03, .18, .005));
      g.at([0, .28, .08], [0, 0, PI / 2], () => g.cyl(.006, 1.3, 8));
      for (const s of [-1, 0, 1]) g.at([s * .11, .06, .3], () => g.rbox(.05, .012, .12, .003));
      for (const s of [-1, 1]) g.at([s * .54, KY + .42, .1], () => g.tube([[0, 0, 0], [0, .08, .08], [s * .05, .14, .09]], .006, 6));
      for (const s of [-1, 1]) g.at([s * .59, KY + .57, .19], () => g.lathe([[.03, 0], [.012, .02], [.012, .08]], 12));
    });
    g.with({ c: '#ffe7b8', e: 15 }, () => { for (const s of [-1, 1]) g.at([s * .59, KY + .67, .19], () => g.lathe([[.012, 0], [.006, .045], [0, .07]], 8)); });
  });
  // Rollenfach im Korpus: dunkel, die Rolle laeuft darin.
  g.with({ c: '#120d09', r: .7 }, () => g.at([X, FL + KY + .36, Z + .082], () => g.card(.92, .42)));
  g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .24 }, () => { for (const y of [FL + KY + .55, FL + KY + .17]) g.at([X, y, Z + .1], [0, 0, PI / 2], () => g.cyl(.018, .78, 14)); });
  // Schild
  const plate = E.addDoc(canvas(1024, 256, (x, w, h) => { x.fillStyle = '#b89a55'; x.fillRect(0, 0, w, h); x.strokeStyle = '#16120a'; x.lineWidth = 6; x.strokeRect(10, 10, w - 20, h - 20); x.fillStyle = '#16120a'; x.font = '700 100px Jost'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('LYRIA', w / 2, h / 2 + 4); }));
  g.with({ c: '#ffffff', tex: plate, r: .34, mat: MAT.plain }, () => g.at([X, FL + .46, Z + .085], () => g.card(.24, .06)));
  // Regale mit Rollenschachteln, Sessel, Metronom, Bilder
  P.shelf(g, r.x0 + .55, FL + .02, r.z0 + .2, .92, 2.5, 6, 3.3);
  P.shelf(g, r.x1 - .55, FL + .02, r.z0 + .2, .92, 2.5, 6, 7.7);
  P.pendant(g, -1.9, r.y1, -1.6, .4, '#3a2410', '#ffe0ae');
  P.floorLamp(g, -3.32, FL, -1.2);
  g.at([X + .34, FL + 1.415, Z - .08], () => {
    g.with({ c: '#2a160c', mat: MAT.wood, r: .3 }, () => g.lathe([[.0, 0], [.08, 0], [.078, .012], [.03, .24], [0, .25]], 4, PI / 4));
  });
  // Tasten: 52 weisse, 36 schwarze
  const KW = (W - .12) / 52;
  const white = many(E, MUS, 52, gg => { gg.s({ c: '#efe9da', mat: MAT.plain, r: .18 }); gg.rbox(KW * .94, .022, .155, .0025); });
  const blackK = many(E, MUS, 36, gg => { gg.s({ c: '#08080a', mat: MAT.plain, r: .14 }); gg.rbox(KW * .56, .03, .096, .003); });
  const needle = part(E, MUS, gg => { gg.s({ c: '#d9dade', mat: MAT.brushed, m: 1, r: .28 }); gg.at([0, .09, .0], () => gg.box(.004, .18, .002, 1)); });
  // Papierrolle: lange Spur aus Loechern. Reine Funktion der Zeit.
  const holes = canvas(1024, 2048, (x, w, h) => {
    x.fillStyle = '#d8cdb0'; x.fillRect(0, 0, w, h); x.fillStyle = '#17120c';
    for (let i = 0; i < 620; i++) { const col = Math.floor(hash(i * 2.3) * 44), y = hash(i * 7.1) * h, l = 14 + hash(i * 3.3) * 60; x.fillRect(46 + col * 21, y, 11, l); }
    x.fillStyle = '#8a7a58'; x.fillRect(16, 0, 6, h); x.fillRect(w - 22, 0, 6, h);
  });
  const holeDoc = E.addDoc(holes);
  const roll = many(E, MUS, 1, gg => { gg.s({ c: '#ffffff', mat: MAT.paper, r: .8 }); gg.card(.74, .38); });
  roll.shadowRoom = -99;
  const tMus = cue(14, 'Musik') - .5, tMusE = cue(14, 'höre') + 1;
  // Welche Tasten sind gerade unten? Akkorde und Lauf, festes Raster.
  const BPM = 84, EIGHTH = 60 / BPM / 2;
  const down = (i, ts) => {
    const n = Math.floor(ts / EIGHTH); let d = 0;
    for (let b = n; b > n - 3; b--) {
      const root = 14 + Math.floor(hash(Math.floor(b / 8) * 1.7) * 14), pattern = [0, 4, 7, 11, 14, 7, 11, 4][((b % 8) + 8) % 8];
      const key = root + Math.round(pattern * .6) + (b % 2 ? 7 : 0);
      if (i === key || (b % 8 === 0 && (i === root - 7 || i === root - 3))) { const age = ts / EIGHTH - b; d = Math.max(d, age < .9 ? 1 - age * .3 : 0); }
    }
    return d;
  };
  E.addStatic(g, MUS);
  rooms[MUS] = { up: lin('#d4a648').map(v => v * .4), dn: lin('#6a4624').map(v => v * .34), fill: [.12, .09, .05], power: 1, gloss: .85, min: [r.x0, r.y0, r.z0], max: [r.x1, r.y1, r.z1] };
  light(MUS, r, { pos: [-1.9, r.y1 - .55, -1.6], dir: [0, -1, -.2], angle: 1.3, inner: .8, color: [14, 11, 7], range: 7, size: .14, haze: .003 });
  light(MUS, r, { pos: [X, FL + KY + .9, Z + .75], dir: norm([0, -.5, -1]), angle: .85, inner: .5, color: [6, 5, 3.6], range: 4, size: .08, bias: .002 });
  return {
    sub(ts) {
      const act = ts > tMus && ts < tMusE;
      white.begin();
      for (let i = 0; i < 52; i++) {
        const d = act ? down(i, ts) : 0;
        white.push(M.mul(M.T(X - (W - .12) / 2 + (i + .5) * KW, FL + KY + .002, Z + .32), M.mul(M.T(0, 0, -.08), M.mul(M.RX(d * .06), M.T(0, 0, .08)))), [0, 0, 0, 0], [1, 1, 0, 0], [-1, MUS, 1, 1]);
      }
      white.end();
      blackK.begin();
      const pat = [1, 1, 0, 1, 1, 1, 0];
      let bi = 0;
      for (let i = 0; i < 51 && bi < 36; i++) {
        if (!pat[(i + 5) % 7]) continue;
        const d = act ? down(i + 60, ts) : 0;
        blackK.push(M.mul(M.T(X - (W - .12) / 2 + (i + 1) * KW, FL + KY + .024 - d * .012, Z + .29), M.RX(d * .05)), [0, 0, 0, 0], [1, 1, 0, 0], [-1, MUS, 1, 1]);
        bi++;
      }
      blackK.end();
      // Rolle laeuft nach unten durch
      roll.begin();
      const off = clamp((ts - tMus) * .035, 0, .8);
      roll.push(M.T(X, FL + KY + .36, Z + .09), [0, 0, 0, 0], [1, .19, 0, off], [holeDoc, MUS, 1, 1]);
      roll.end();
      // Metronom
      const a = act ? Math.sin((ts - tMus) * PI * BPM / 60) * .42 : 0;
      needle.set(M.mul(M.T(X + .34, FL + 1.44, Z - .018), M.RZ(a)));
    },
  };
}
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
