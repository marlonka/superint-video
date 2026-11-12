// Das Archiv unter dem Dach: Jeder Satz wird eine Karte, jede Karte eine Schublade. Ich vergesse. Der Ordner nicht.
import { Geo, MAT } from './geo.js';
import { M, PI, TAU, clamp, mix, smooth, hash, lin } from './m.js';
import { part, many, canvas, paperGround, cue, cueE, INK, RED, bump } from './kit.js';
import * as P from './props.js';
import { ROOM, R } from './house.js';
import { capsuleGeo } from './foyer.js';
import { FRAMES } from './cues.js';
import { TUBE2 } from './schnitt.js';

const ID = ROOM.ARCHIV, FL = 14.4;
const yRoof = x => 18.42 - Math.abs(x) * (3.1 / 8);
export const CAB = { z: -2.74, x0: -6.6, x1: 6.6, cw: .24, rh: .2, y0: FL + .14 };
export const PLATE = { x: 0, y: FL + 1.0, w: 1.2, h: .34 };
export const BOARD = { x: 5.35, y: FL + 1.03, z: -1.3, w: 1.62, h: .92 };
export const TYPER = { x: -6.95, z: -1.75, top: FL + .86 };
// Echte Regeln aus Marlons Rueckmeldungen und den Skills.
const RULES = ['Nichts schwebt', 'Musik viel leiser', 'Keine Menschen aus Code', 'Echte Pausen', 'Linien verbunden', 'Zeit zum Lesen', 'Kein Konfetti', 'Wow in jeder Szene', 'Kabel hinten raus', 'Ein Gedanke je Bild', 'Echte Dinge zeigen', 'Keine Kinderbilder', 'Stimme führt', 'Länge folgt Stimme', 'Fakten mit Beleg', 'Botschaft zuerst', 'Keine Wischblende', 'Kontaktschatten', 'Wenige Welten', 'Fahrt statt Schnitt', 'Text in der Welt', 'Bild für Bild prüfen', 'Stimme nie schneller', 'Keine Fußnoten', 'Endkarte zum Schluss', 'Erwachsener Look', 'Besetzung offen', 'Hintergrund ruhig', 'Technik stimmt', 'Reine Zeitfunktion', 'Keine erfundenen Zahlen', 'Sonst nichts erfinden', 'Klang weit unter Stimme', 'Pause vor der Pointe', 'Ein Stil, eine Welt', 'Kritik vor Abgabe', 'Bezug zum Satz', 'Lesbar auf dem Handy', 'Keine Effekthascherei', 'Ohren: messen', 'Runde um Runde', 'Quelle im Register', 'Ende auf der Botschaft', 'Brief lesen', 'Marlon fragen', 'Prüfen, nicht hoffen', 'Kein Lärm im Bild', 'Handlung vor Grafik'];
const FEATURED = [{ c: 22, r: 8, t: 'Nichts schwebt.' }, { c: 27, r: 7, t: 'Keine Menschen aus Code.' }, { c: 32, r: 8, t: 'Musik viel leiser.' }];

function ruleCard(txt, n) {
  return canvas(1024, 1024, (x, w, h) => {
    paperGround(x, w, h, '#ece4cf', 60 + n);
    x.fillStyle = '#c0a56e'; x.fillRect(0, 150, w, 5);
    x.fillStyle = 'rgba(27,26,30,.55)'; x.font = '700 58px "Courier Prime"'; x.textBaseline = 'alphabetic'; x.fillText(`Regel ${String(n * 37 + 11).padStart(3, '0')}`, 60, 112);
    x.fillStyle = INK; x.font = '700 124px "Courier Prime"';
    const words = txt.split(' '); let ln = '', y = 320; const lines = [];
    for (const wd of words) { const t = ln ? ln + ' ' + wd : wd; if (x.measureText(t).width > w - 120) { lines.push(ln); ln = wd; } else ln = t; } lines.push(ln);
    lines.forEach(l => { x.fillText(l, 60, y); y += 150; });
  });
}

export function buildArchiv(ctx) {
  const { E, rooms, light, liveSlots } = ctx;
  const r = { ...R.ARCHIV, y1: 18.42 }, g = new Geo(); g.s({ room: ID });
  // Boden
  g.with({ c: '#4a2e18', mat: MAT.parquet, r: .36 }, () => g.rect([r.x0, FL, 0], [r.x1, FL, 0], [r.x1, FL, r.z0], [r.x0, FL, r.z0], [0, 1, 0]));
  // Rueckwand folgt dem Giebel
  g.with({ c: '#8a5a2a', mat: MAT.wallC, r: .72 }, () => { for (let i = 0; i < 16; i++) { const a = r.x0 + i, b = a + 1; g.rect([a, FL, r.z0], [b, FL, r.z0], [b, yRoof(b), r.z0], [a, yRoof(a), r.z0], [0, 0, 1]); } });
  // Dachflaechen, mit Loechern fuer die Fenster
  const winX = [[-6.2, -4.5], [-2.9, -1.2], [1.2, 2.9], [4.5, 6.2]], wz0 = -2.8, wz1 = -1.05;
  const slope = (a, b, z0, z1) => { const nx = a < 0 || b <= 0 ? .361 : -.361; g.rect([a, yRoof(a), z0], [b, yRoof(b), z0], [b, yRoof(b), z1], [a, yRoof(a), z1], [nx, -.932, 0]); };
  g.with({ c: '#3b2a1c', mat: MAT.wood, r: .55 }, () => {
    let px = r.x0;
    for (const [a, b] of winX) {
      if (a > px) slope(px, a, r.z0, 0);
      slope(a, b, r.z0, wz0); slope(a, b, wz1, 0);
      px = b;
      if (a < 0 && b >= -1.3 && false) px = b;
    }
    // Der First teilt die Strecke zwischen den inneren Fenstern
    if (px < r.x1) slope(px, r.x1, r.z0, 0);
    // Luecke ueber dem First schliessen
    slope(-1.2, 0, r.z0, 0); slope(0, 1.2, r.z0, 0);
  });
  // Sparren und Pfetten: Dachstuhl aus Holz
  g.with({ c: '#2a1a0e', mat: MAT.wood, r: .4 }, () => {
    for (let z = -3.2; z < 0; z += 1.05) { for (const s of [-1, 1]) { const a = [s * .0, 18.34, z], b = [s * 7.9, yRoof(7.9) - .08, z]; const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; g.at([mx, my, z], [0, 0, -s * Math.atan(3.1 / 8)], () => g.rbox(8.55, .09, .07, .01)); } }
    g.at([0, 18.3, -1.8], () => g.rbox(.12, .12, 3.6, .01));
    for (const s of [-1, 1]) g.at([s * 3.4, yRoof(3.4) - .1, -1.8], () => g.rbox(.1, .12, 3.6, .01));
  });
  // Fensterkreuze
  g.with({ c: '#1a1208', mat: MAT.wood, r: .45 }, () => {
    for (const [a, b] of winX) {
      const dirx = a < 0 ? 1 : -1, m = (a + b) / 2;
      for (const z of [wz0, (wz0 + wz1) / 2, wz1]) g.tube([[a, yRoof(a) - .01, z], [b, yRoof(b) - .01, z]], .018, 6);
      for (const x of [a, m, b]) g.tube([[x, yRoof(x) - .01, wz0], [x, yRoof(x) - .01, wz1]], .018, 6);
    }
  });
  // Scheiben: Nachthimmel. Werfen keinen Schatten, damit der Mond hereinkommt.
  const pane = many(E, ID, 4, gg => { gg.s({ c: '#26365e', e: .5, r: .2 }); gg.card(1, 1); });
  pane.shadowRoom = -99;
  // ---------------------------------------------------- Die Wand aus Schubladen
  const cols = Math.round((CAB.x1 - CAB.x0) / CAB.cw), DRAW = [];
  const skip = (x, y) => Math.abs(x - PLATE.x) < PLATE.w / 2 + .02 && Math.abs(y - PLATE.y) < PLATE.h / 2 + .03;
  for (let c = 0; c < cols; c++) {
    const x = CAB.x0 + (c + .5) * CAB.cw, rows = Math.floor((yRoof(x + Math.sign(x || 1) * CAB.cw / 2) - .08 - CAB.y0) / CAB.rh);
    for (let ro = 0; ro < rows; ro++) { const y = CAB.y0 + (ro + .5) * CAB.rh; if (skip(x, y)) continue; DRAW.push({ c, r: ro, x, y, i: DRAW.length, b: .78 + hash(c * 3.1 + ro * 7.7) * .34 }); }
  }
  ctx.drawerCount = DRAW.length;
  // Korpus hinter den Schubladen: treppig mit dem Giebel
  g.with({ c: '#26170b', mat: MAT.wood, r: .4 }, () => {
    for (let c = 0; c < cols; c += 1) {
      const x = CAB.x0 + (c + .5) * CAB.cw, top = CAB.y0 + Math.floor((yRoof(x + Math.sign(x || 1) * CAB.cw / 2) - .08 - CAB.y0) / CAB.rh) * CAB.rh;
      g.at([x, (FL + top) / 2, (r.z0 + CAB.z) / 2 - .01], () => g.box(CAB.cw, top - FL, CAB.z - r.z0, 1 | 4));
    }
  });
  g.with({ c: '#2a1a0e', mat: MAT.wood, r: .35 }, () => g.at([0, FL + .07, CAB.z + .015], () => g.rbox(13.3, .14, .05, .008)));
  // Das Schild
  const plateDoc = E.addDoc(canvas(1024, 256, (x, w, h) => {
    x.fillStyle = '#b89a55'; x.fillRect(0, 0, w, h); const gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'rgba(255,240,200,.25)'); gr.addColorStop(.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.2)'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#16120a'; x.lineWidth = 7; x.strokeRect(14, 14, w - 28, h - 28); x.fillStyle = '#16120a'; x.font = '700 150px Jost'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('S K I L L', w / 2, h / 2 + 8);
  }));
  g.at([PLATE.x, PLATE.y, CAB.z + .004], () => {
    g.with({ c: '#26170b', mat: MAT.wood, r: .35 }, () => g.at([0, 0, -.01], () => g.rbox(PLATE.w + .06, PLATE.h + .06, .04, .008)));
    g.with({ c: '#ffffff', tex: plateDoc, mat: MAT.plain, r: .3 }, () => g.at([0, 0, .012], () => g.card(PLATE.w, PLATE.h)));
    g.with({ c: '#2c2a30', mat: MAT.brushed, m: 1, r: .32 }, () => { g.tube([[0, PLATE.h / 2 + .03, .01], [0, PLATE.h / 2 + .1, .18]], .006, 6); g.at([0, PLATE.h / 2 + .1, .18], [0, 0, PI / 2], () => g.cyl(.024, .5, 14)); });
  });
  // Lampen
  for (const x of [-4.2, 0, 4.2]) P.pendant(g, x, yRoof(x) - .05, -1.7, .45, '#26170b', '#ffdca4');
  // ---------------------------------------------------- Karten-Schreibmaschine links, Rohrpost-Ankunft
  const Ty = TYPER;
  P.bankerLamp(g, Ty.x + .46, Ty.top, Ty.z + .04, -.5);
  light(ID, r, { pos: [Ty.x + .4, Ty.top + .3, Ty.z + .16], dir: norm([-.55, -.8, -.1]), angle: 1.15, inner: .72, color: [2.4, 2.0, 1.45], range: 2.6, size: .07, near: .04 });
  g.at([Ty.x, FL, Ty.z], () => {
    g.with({ c: '#26170b', mat: MAT.wood, r: .32, grain: 1 }, () => { g.at([0, .84, 0], () => g.rbox(1.0, .04, .8, .008, 2)); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.at([sx * .44, .41, sz * .34], () => g.cyl(.022, .82, 10, .016)); });
    g.at([0, .86, 0], () => {
      g.with({ c: '#101013', mat: MAT.plain, r: .25 }, () => { g.at([0, .07, .08], () => g.rbox(.5, .12, .36, .03, 3)); g.at([0, .16, -.1], () => g.rbox(.54, .1, .16, .02, 2)); });
      g.with({ c: '#b0b2b8', mat: MAT.brushed, m: 1, r: .25 }, () => g.at([0, .21, -.1], [0, 0, PI / 2], () => g.cyl(.03, .6, 16)));
      for (let i = 0; i < 24; i++) g.with({ c: '#d9d3bf', r: .35 }, () => g.at([-.2 + (i % 8) * .058 + (Math.floor(i / 8) * .012), .135 + Math.floor(i / 8) * -.0, .14 + Math.floor(i / 8) * .05], () => g.rcyl(.02, .012, .003, 12)));
    });
  });
  g.with({ c: '#c8dde4', mat: MAT.glass, r: .03, m: .08 }, () => { g.at([TUBE2.x, 14.7, TUBE2.z], () => g.lathe([[.045, -.3], [.045, .3]], 16)); });
  g.with({ c: '#c8dde4', mat: MAT.glass, r: .03, m: .08 }, () => g.tube([[TUBE2.x, 15.0, TUBE2.z], [TUBE2.x + .25, 15.05, TUBE2.z - .15], [Ty.x - .1, 15.05, Ty.z - .1]], .045, 14));
  g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .25 }, () => { g.at([TUBE2.x, 15.0, TUBE2.z], () => g.sphere(.066, 14, 10)); g.at([Ty.x - .1, 15.05, Ty.z - .1], () => g.sphere(.066, 14, 10)); g.tube([[Ty.x - .1, 15.05, Ty.z - .1], [Ty.x - .1, Ty.top + .2, Ty.z - .1]], .012, 8); });
  // Seilzug vor den Schubladen
  const WY = FL + .7, WZ = CAB.z + .34;
  g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .26 }, () => {
    for (const x of [Ty.x + .55, -3.2, 0, 3.2]) { g.at([x, (FL + WY) / 2, WZ], () => g.cyl(.012, WY - FL, 8)); g.at([x, FL + .02, WZ], () => g.rcyl(.06, .03, .006, 16)); g.at([x, WY + .018, WZ], [PI / 2, 0, 0], () => g.torus(.022, .005, 16, 6)); }
  });
  g.with({ c: '#26272c', r: .5 }, () => { g.tube([[Ty.x + .55, WY + .04, WZ], [3.2, WY + .04, WZ]], .0028, 5); g.tube([[Ty.x + .55, WY, WZ], [3.2, WY, WZ]], .0028, 5); });
  // ---------------------------------------------------- Die Tafel auf der Staffelei
  const Bd = BOARD;
  // Unter dem Text: eine oft geloeschte Tafel. Kreide bleibt immer ein bisschen.
  const smear = E.addDoc(canvas(1024, 582, (x, w, h) => {
    x.fillStyle = '#2b4238'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { const y = hash(i * 1.7) * h, l = 200 + hash(i * 2.3) * 700, x0 = hash(i * 3.1) * w - 120; x.fillStyle = `rgba(226,226,208,${.012 + hash(i * 5.3) * .035})`; x.fillRect(x0, y, l, 8 + hash(i * 4.4) * 34); }
  }));
  g.at([Bd.x, 0, Bd.z], () => {
    g.with({ c: '#2a1a0e', mat: MAT.wood, r: .35 }, () => { for (const s of [-1, 1]) g.tube([[s * .98, FL, .14], [s * .86, Bd.y + .5, .02]], .02, 8); g.tube([[0, FL, -.42], [0, Bd.y + .4, -.02]], .02, 8); g.at([0, Bd.y - Bd.h / 2 - .03, .04], () => g.rbox(Bd.w + .1, .03, .1, .006)); });
    g.at([0, Bd.y, .018], () => { g.with({ c: '#2a1a0e', mat: MAT.wood, r: .35 }, () => g.rbox(Bd.w + .08, Bd.h + .08, .03, .006)); g.with({ c: '#ffffff', tex: smear, r: .78 }, () => g.at([0, 0, .016], () => g.card(Bd.w, Bd.h))); });
  });
  // Bilderleuchte auf dem Tafelrahmen
  g.at([Bd.x, 0, Bd.z], () => g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .28 }, () => {
    g.tube([[-.3, Bd.y + Bd.h / 2 + .04, .03], [-.3, Bd.y + Bd.h / 2 + .17, .14], [-.3, Bd.y + Bd.h / 2 + .17, .34]], .007, 8);
    g.tube([[.3, Bd.y + Bd.h / 2 + .04, .03], [.3, Bd.y + Bd.h / 2 + .17, .14], [.3, Bd.y + Bd.h / 2 + .17, .34]], .007, 8);
    g.at([0, Bd.y + Bd.h / 2 + .17, .36], [0, 0, PI / 2], () => g.cyl(.03, .9, 18));
  }));
  const chalk = E.addDoc(canvas(2048, 1162, (x, w, h) => {
    x.fillStyle = '#2b4238'; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(244,242,226,.97)'; x.font = '700 104px Caveat'; x.textBaseline = 'alphabetic';
    ['Dieses Gespräch:', '– Film: Videos aus Code', '– Stimme: Sadaltager', '– Regen vor dem Fenster', `– ${FRAMES} Bilder, kein einziges gemalt`].forEach((l, i) => x.fillText(l, 90, 160 + i * 166));
  }));
  const chalkI = many(E, ID, 1, gg => { gg.s({ c: '#ffffff', r: .75 }); gg.card(1, 1); });
  chalkI.shadowRoom = -99;
  const wiper = part(E, ID, gg => { gg.with({ c: '#3a2212', mat: MAT.wood, r: .4 }, () => gg.rbox(.05, Bd.h + .02, .035, .008)); gg.with({ c: '#c0bdb0', mat: MAT.fabric, r: 1 }, () => gg.at([0, 0, -.022], () => gg.rbox(.05, Bd.h, .012, .004))); });
  g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .26 }, () => g.at([Bd.x, Bd.y + Bd.h / 2 + .06, Bd.z + .05], [0, 0, PI / 2], () => g.cyl(.008, Bd.w + .2, 8)));

  E.addStatic(g, ID);
  rooms[ID] = { up: lin('#b08048').map(v => v * .32), dn: lin('#6a4a2a').map(v => v * .28), fill: [.1, .075, .05], power: 1, gloss: .85, min: [r.x0, FL, r.z0], max: [r.x1, 18.42, 0] };
  // Mondlicht durch die Fenster: ein Licht weit oben, das Dach wirft die Schatten.
  // Ein einziger Mond: Sein Licht faellt parallel durch beide Dachfenster.
  const moon = [light(ID, r, { pos: [-2.2, 46, 9], dir: norm([.06, -1, -.3]), angle: .3, inner: .24, color: [1500, 1950, 3400], range: 48, size: .5, near: 24, bias: .0035, haze: .0035, manual: true, power: 0 })];
  const lamps = [-4.2, 0, 4.2].map(x => light(ID, r, { pos: [x, yRoof(x) - .62, -1.7], dir: norm([0, -.5, -.42]), angle: 1.22, inner: .85, color: [13, 10.2, 6.4], range: 8, size: .12, haze: .002, manual: true, power: 0 }));
  const lampG = [-4.2, 0, 4.2].map(x => part(E, ID, gg => { gg.s({ c: '#ffdca4', e: 42, flag: 0 }); gg.at([x, yRoof(x) - .05 - .45 - .06, -1.7], () => gg.sphere(.046, 14, 10)); }));
  const plateL = light(ID, r, { pos: [0, PLATE.y + PLATE.h / 2 + .09, CAB.z + .22], dir: norm([0, -.72, -.45]), angle: 1.1, inner: .7, color: [4.4, 3.8, 2.6], range: 2.4, size: .1, manual: true, power: 0, bias: .001 });
  const boardL = light(ID, r, { pos: [Bd.x, Bd.y + Bd.h / 2 + .16, Bd.z + .36], dir: norm([0, -.86, -.34]), angle: 1.36, inner: .9, color: [3.0, 2.7, 2.1], range: 2.6, size: .22, near: .03, manual: true, power: 0 });

  // ---------------------------------------------------- Schubladen
  const drawer = many(E, ID, DRAW.length + 8, gg => {
    gg.with({ c: '#7a4c22', mat: MAT.wood, r: .34, grain: 0 }, () => gg.rbox(CAB.cw - .012, CAB.rh - .012, .32, .004));
    gg.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .22 }, () => { gg.at([0, -.046, .163], [PI / 2, 0, 0], () => gg.lathe([[.0, 0], [.017, 0], [.017, .012], [.012, .012]], 12)); });
  });
  const labels = E.addDoc(canvas(2048, 2048, (x, w, h) => {
    x.fillStyle = '#e6dcc0'; x.fillRect(0, 0, w, h); x.fillStyle = INK; x.textAlign = 'center'; x.textBaseline = 'middle';
    const NX = 6, NY = 8, cw = w / NX, ch = h / NY;
    RULES.forEach((t, i) => { const cx = (i % NX + .5) * cw, cy = (Math.floor(i / NX) + .5) * ch; let fs = 62; x.font = `700 ${fs}px "Courier Prime"`; const m = x.measureText(t).width; if (m > cw - 18) { fs = fs * (cw - 18) / m; x.font = `700 ${fs}px "Courier Prime"`; } x.fillText(t, cx, cy); x.strokeStyle = 'rgba(27,26,30,.25)'; x.strokeRect(cx - cw / 2 + 3, cy - ch / 2 + 3, cw - 6, ch - 6); });
  }));
  const label = many(E, ID, DRAW.length + 8, gg => { gg.s({ c: '#ffffff', r: .55, mat: MAT.paper }); gg.card(.16, .034); });
  label.shadowRoom = -99;
  const uvL = i => [1 / 6, 1 / 8, (i % 6) / 6, (Math.floor(i / 6) % 8) / 8];
  // Zeitplan
  const tW0 = cue(18, 'Jeder', 1) - .1, tW1 = cueE(18, 'hat');
  // Die vier Karten am Seil: Aus jedem Satz von Marlon wird eine Regel.
  const WIRE_DOCS = ['Nichts schwebt.', 'Kein Kindervideo.', 'Musik viel leiser.', 'Keine Menschen aus Code.'].map((s, i) => E.addDoc(ruleCard(s, i)));
  const FE = FEATURED.map((f, i) => {
    const x = CAB.x0 + (f.c + .5) * CAB.cw, y = CAB.y0 + (f.r + .5) * CAB.rh;
    return { ...f, x, y, t: tW0 + .6 + i * 1.15, doc: E.addDoc(ruleCard(f.t, i)), i };
  });
  ctx.archivFeatured = FE;
  const isF = (c, ro) => FE.find(f => f.c === c && f.r === ro);
  const waveAt = (d, ts) => {
    if (ts < tW0 - .5 || ts > tW1 + 3) return 0;
    const t0 = tW0 + (d.c / cols) * 2.8 + hash(d.r * 3.3 + d.c) * .25 + (d.r * .03), a = (ts - t0) / .55;
    return (a > 0 && a < 1 ? Math.sin(a * PI) ** 2 : 0) * (.1 + hash(d.c * 1.7 + d.r) * .1);
  };
  // Rohrpost-Karten: Vier Saetze werden zu vier Karten, der Seilzug bringt sie zu ihrer Schublade.
  const TARGETS = [{ c: 10, r: 2 }, { c: 15, r: 3 }, { c: 19, r: 2 }, { c: 13, r: 1 }].map(q => ({ ...q, x: CAB.x0 + (q.c + .5) * CAB.cw, y: CAB.y0 + (q.r + .5) * CAB.rh }));
  const tType0 = cue(18, 'wurde') + .35, tType1 = cueE(18, 'Regel') + .25;
  const tWire = [tType1 + .05, tType1 + .6, tType1 + 1.1, tType1 + 1.6];
  const travel = 2.0;
  const wireCard = many(E, ID, 4, gg => { gg.s({ c: '#ffffff', mat: MAT.paper, r: .75 }); gg.card(.2, .2); });
  const clip = many(E, ID, 4, gg => { gg.s({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .25 }); gg.at([0, .012, 0], () => gg.rbox(.04, .03, .012, .003)); gg.at([0, .04, 0], () => gg.rbox(.012, .05, .008, .002)); });
  const bigCard = many(E, ID, 3, gg => { gg.s({ c: '#ffffff', mat: MAT.paper, r: .75, flag: 8 | 16, e: .5 }); gg.card(.2, .2); });
  const cardPos = (i, ts) => {
    const t0 = tWire[i], d = ts - t0, q = TARGETS[i];
    const startX = Ty.x + .55;
    if (d < 0) return null;
    const u = clamp(d / travel), xc = mix(startX, q.x, u * u * (3 - 2 * u));
    const ins = smooth(travel, travel + .35, d), low = smooth(travel, travel + .14, d);
    if (ins >= 1) return null;
    return { x: xc, y: mix(WY - .12, q.y + .02, low), z: mix(WZ, CAB.z - .1, ins) };
  };
  // Das Blatt in der Maschine: wird live getippt.
  const UI = liveSlots.ui;
  const typed = part(E, ID, gg => { gg.s({ c: '#ffffff', tex: 201, mat: MAT.paper, r: .8 }); gg.card(.36, .36, [0, 0, 1152 / 2048, 1]); });
  typed.set(M.mul(M.T(Ty.x, Ty.top + .3, Ty.z - .12), M.RX(-.28)));
  const CARDTXT = FEATURED[0].t;
  let key0 = '';
  function paintCard(t) {
    const n = Math.floor(clamp((t - tType0) / (tType1 - tType0)) * CARDTXT.length + .001);
    const k = 'c' + n; if (k === key0 && UI.owner === 'archiv') return; key0 = k; UI.owner = 'archiv';
    UI.paint(x => {
      x.save(); x.beginPath(); x.rect(0, 0, 1152, 1152); x.clip(); x.scale(1152 / 1024, 1152 / 1024);
      paperGround(x, 1024, 1024, '#ece4cf', 60);
      x.fillStyle = '#c0a56e'; x.fillRect(0, 150, 1024, 5);
      x.fillStyle = 'rgba(27,26,30,.55)'; x.font = '700 58px "Courier Prime"'; x.fillText('Regel 011', 60, 112);
      x.fillStyle = INK; x.font = '700 124px "Courier Prime"'; const s = CARDTXT.slice(0, n), parts = s.split(' ');
      x.fillText(parts[0] || '', 60, 320); if (parts[1] !== undefined) x.fillText(parts[1], 60, 470);
      x.restore();
    });
  }
  // Die Karte bleibt auch als feste Ansicht sichtbar, wenn das Fenster anderswo gebraucht wird.
  const stillCard = part(E, ID, gg => { gg.s({ c: '#ece4cf', mat: MAT.paper, r: .8 }); gg.card(.36, .36); });
  stillCard.set(M.mul(M.T(Ty.x, Ty.top + .3, Ty.z - .1205), M.RX(-.28)));
  // Kapselankunft
  const cap = part(E, ID, capsuleGeo);
  const tCapE = ctx.capsule2.tCapE;

  const tDim = cue(18, 'vergesse'), tDimE = cueE(18, 'alles') + .35, tBack = cue(18, 'Jeder', 1) - .05;
  const tSkill = cue(18, 'Skill');
  const wipe0 = cue(18, 'nach') - .05, wipe1 = cue(18, 'alles') + .3;
  let last = '', built = false;
  return {
    frame(t) {
      const base = smooth(cue(18, 'Aber') - .9, cue(18, 'Aber'), t);
      const dim = 1 - smooth(tDim, tDimE, t) + smooth(tBack, tBack + 1.2, t);
      const lp = base * Math.min(1, dim);
      lamps.forEach((l, i) => {
        const d0 = [.45, 0, .9][i], di = 1 - smooth(tDim, tDimE, t) + smooth(tBack + d0, tBack + d0 + .5, t), p = base * Math.min(1, di);
        l.power = p; lampG[i].level = p;
      });
      // Die Tafel behaelt ihr Licht, bis sie leer ist. Erst dann geht es auch hier aus.
      boardL.power = base * (1 - smooth(wipe1 + .05, wipe1 + .7, t) * (1 - Math.min(1, smooth(tBack, tBack + 1.2, t))));
      // Der Mond ist immer da. Man sieht ihn nur erst im Dunkeln richtig.
      const moonP = mix(.3, 1.0, 1 - Math.min(1, dim)) * base;
      moon.forEach(m => { m.power = moonP; });
      plateL.power = smooth(tSkill - .08, tSkill + .05, t);
      // Wenn alle Lampen aus sind, faellt auch das Grundlicht des Raums.
      rooms[ID].power *= mix(.22, 1, Math.min(1, dim));
      E.updateRooms();
      const act = t > tType0 - 1 && t < tType1 + 4;
      typed.visible = act; stillCard.visible = !act;
      if (act) paintCard(t);
    },
    sub(ts, s, N) {
      const sh = (s + .5) / N;
      lampG.forEach(l => { l.visible = sh <= l.level; });
      // Scheiben
      pane.begin();
      for (const [a, b] of winX) {
        const m = (a + b) / 2, ang = (a < 0 ? 1 : -1) * Math.atan(3.1 / 8), L = (b - a) / Math.cos(ang);
        pane.push(M.mul(M.T(m, yRoof(m) + .03, (wz0 + wz1) / 2), M.mul(M.RZ(-ang), M.mul(M.RX(PI / 2), M.S(L, wz1 - wz0, 1)))), [0, 0, 0, 0], [1, 1, 0, 0], [-1, ID, 1, 1]);
      }
      pane.end();
      // Schubladen nur neu setzen, wenn sie sich bewegen.
      const active = (ts > tWire[0] - .2 && ts < tWire[3] + travel + 1.2) || (ts > tW0 - .6 && ts < tW1 + 3.2);
      const st = active ? ts : 'zu';
      if (st !== last || !built) {
        last = st; built = true;
        drawer.begin(); label.begin();
        for (const d of DRAW) {
          let o = active ? waveAt(d, ts) : 0;
          for (let i = 0; i < 4; i++) { const q = TARGETS[i]; if (q.c === d.c && q.r === d.r && active) { const t0 = tWire[i] + travel - .35; o = Math.max(o, .26 * smooth(t0, t0 + .25, ts) * (1 - smooth(t0 + .75, t0 + 1.05, ts))); } }
          const f = isF(d.c, d.r);
          if (f && active) o = Math.max(o, .42 * smooth(f.t - .12, f.t + .2, ts) * (1 - smooth(tW1 + .9, tW1 + 1.5, ts)));
          const z = CAB.z - .16 + o;
          drawer.push(M.T(d.x, d.y, z), [0, 0, 0, 0], [1, 1, 0, 0], [-1, ID, d.b, 1]);
          label.push(M.T(d.x, d.y + .03, z + .1615), [0, 0, 0, 0], uvL(d.i * 7 + d.c), [labels, ID, .72, 1]);
        }
        drawer.end(); label.end();
      }
      // Karten am Seil
      wireCard.begin(); clip.begin();
      for (let i = 0; i < 4; i++) {
        const p = cardPos(i, ts);
        if (p) {
          wireCard.push(M.T(p.x, p.y - .1, p.z), [0, 0, 0, 0], [1, 1, 0, 0], [WIRE_DOCS[i], ID, 1, 1]);
          clip.push(M.T(p.x, p.y, p.z + .004), [0, 0, 0, 0], [1, 1, 0, 0], [-1, ID, 1, 1]);
        }
      }
      // Die grossen Regelkarten in den offenen Schubladen
      wireCard.end(); clip.end();
      bigCard.begin();
      for (const f of FE) {
        if (!(ts > tW0 - .4 && ts < tW1 + 1.6)) break;
        const a = smooth(f.t - .1, f.t + .25, ts) * (1 - smooth(tW1 + .9, tW1 + 1.5, ts)); if (a <= 0) continue;
        const z = CAB.z - .16 + .42 * a + .0, y = f.y + .03 + a * .16;
        bigCard.push(M.mul(M.T(f.x, y, z + .02), M.S(1.9, 1.9, 1)), [0, 0, 0, 0], [1, 1, 0, 0], [f.doc, ID, 1, 1]);
      }
      bigCard.end();
      // Tafel: wischt sich selbst
      const p = clamp((ts - wipe0) / (wipe1 - wipe0));
      chalkI.begin();
      if (p < 1) chalkI.push(M.mul(M.T(Bd.x + Bd.w * p / 2, Bd.y, Bd.z + .0355), M.S(Bd.w * (1 - p), Bd.h, 1)), [0, 0, 0, 0], [1 - p, 1, p, 0], [chalk, ID, 1, 1]);
      chalkI.end();
      const wx = p > 0 && p < 1 ? Bd.x - Bd.w / 2 + Bd.w * p : Bd.x - Bd.w / 2 - .02 + (p >= 1 ? 0 : 0);
      wiper.set(M.T(wx, Bd.y, Bd.z + .07));
      // Kapsel kommt an und gleitet zur Maschine
      const dA = ts - tCapE;
      cap.visible = dA >= 0 && dA < .7;
      if (cap.visible) { const u = clamp(dA / .5); cap.set(M.mul(M.T(mix(TUBE2.x, Ty.x - .1, u), mix(15.0, 15.05, u), mix(TUBE2.z, Ty.z - .1, u)), M.RY(-.8))); }
    },
  };
}
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
