// Das Kino: Was du brauchst und was du schreibst. Danach das Ende: alle Raeume an, das Schild, das Haus auf dem Tisch.
import { Geo, MAT } from './geo.js';
import { M, PI, TAU, clamp, mix, smooth, smoother, hash, lin } from './m.js';
import { part, many, canvas, paperGround, wrap, cue, cueE, INK, RED, bump, claudeMark } from './kit.js';
import * as P from './props.js';
import { ROOM, R } from './house.js';
import { DESK } from './schreib.js';
import { DURATION } from './cues.js';
import { ENV } from './envelope.js';

const ID = ROOM.KINO, BG0 = '#0d0c10';
export const SCREEN = { x: 7.86, y: 1.56, z: -1.8, w: 2.8, h: 1.575 };
export const WIDE = { eye: [1.3, 2.85, 46.6], at: [.55, 9.2, 0], fov: .5, ap: .008 };
export const tCut = () => (Math.floor((cueE(24, 'Code') + .14) * 30) + .5) / 30;
export const DIO = { x: -4.58, w: .4, h: .225, d: .2, z: DESK.z + .12, y: DESK.top + .225 / 2 + .022 };

export function buildKino(ctx) {
  const { E, rooms, light, liveSlots, stillImg, thumbs, thumbCell } = ctx;
  const r = R.KINO, g = new Geo(); g.s({ room: ID });
  P.roomShell(g, r, { wallC: '#5e0f14', wallM: MAT.velvet, wallR: .9, floorC: '#250a0c', floorM: MAT.rug, floorR: 1, ceilC: '#1c0a0b' });
  // Goldene Pilaster und Deckenfries
  g.with({ c: '#b58a3a', mat: MAT.brushed, m: 1, r: .32 }, () => {
    for (let i = 0; i <= 8; i++) g.at([r.x0 + .4 + i * 1.22, 1.6, r.z0 + .03], () => g.rbox(.05, 3.2, .05, .01));
    g.at([(r.x0 + r.x1) / 2, r.y1 - .12, r.z0 + .04], () => g.rbox(10.6, .05, .07, .01));
    g.at([(r.x0 + r.x1) / 2, .92, r.z0 + .03], () => g.rbox(10.6, .03, .05, .008));
  });
  // Wandlampen
  for (let i = 0; i < 4; i++) {
    const x = r.x0 + 1.01 + i * 2.44;
    g.at([x, 1.9, r.z0 + .03], () => {
      g.with({ c: '#b58a3a', mat: MAT.brushed, m: 1, r: .28 }, () => { g.rbox(.09, .2, .02, .005); g.at([0, -.02, .09], [PI / 2, 0, 0], () => g.cyl(.008, .18, 8)); });
      g.with({ c: '#f4d8a8', e: 6, r: .9 }, () => g.at([0, .05, .17], () => g.lathe([[.085, -.08], [.05, .08]], 16)));
    });
  }
  // ---------------------------------------------------- Leinwand, Goldrahmen, Vorhang
  const Sc = SCREEN;
  g.at([Sc.x + .03, Sc.y, Sc.z], [0, -PI / 2, 0], () => {
    g.with({ c: '#b58a3a', mat: MAT.brushed, m: 1, r: .3 }, () => {
      const t = .07;
      for (const [x, y, w, h] of [[0, Sc.h / 2 + t / 2, Sc.w + t * 2, t], [0, -Sc.h / 2 - t / 2, Sc.w + t * 2, t], [-Sc.w / 2 - t / 2, 0, t, Sc.h], [Sc.w / 2 + t / 2, 0, t, Sc.h]]) g.at([x, y, .02], () => g.rbox(w, h, .05, .012, 2));
    });
    g.with({ c: '#07070a', r: .5 }, () => g.card(Sc.w, Sc.h));
  });
  // Vorhaenge an beiden Seiten
  for (const s of [-1, 1]) g.with({ c: '#7a1218', mat: MAT.velvet, r: .85 }, () => {
    const n = 24, a = [], b = [], cz = s < 0 ? -3.45 : -.15;
    for (let i = 0; i <= n; i++) { const u = i / n, z = cz + (u - .5) * .42, x = 7.74 + Math.sin(u * TAU * 3) * .06, nz = -Math.cos(u * TAU * 3) * .6; a.push(g.v([x, 0, z], [-1, 0, nz], u, 1)); b.push(g.v([x, 3.2, z], [-1, 0, nz], u, 0)); }
    for (let i = 0; i < n; i++) g.quad(b[i], b[i + 1], a[i + 1], a[i]);
  });
  g.with({ c: '#7a1218', mat: MAT.velvet, r: .85 }, () => {
    const n = 40, a = [], b = [];
    for (let i = 0; i <= n; i++) { const u = i / n, z = -3.6 + u * 3.6, x = 7.72 + Math.sin(u * TAU * 6) * .05, nz = -Math.cos(u * TAU * 6) * .5, sag = .08 * Math.cos(u * TAU * 3) ** 2; a.push(g.v([x, 2.62 + sag, z], [-1, 0, nz], u, 1)); b.push(g.v([x, 3.2, z], [-1, 0, nz], u, 0)); }
    for (let i = 0; i < n; i++) g.quad(b[i], b[i + 1], a[i + 1], a[i]);
  });
  // Buehnenkante
  g.with({ c: '#2a100f', mat: MAT.wood, r: .35 }, () => g.at([7.45, .2, -1.8], () => g.rbox(1.1, .4, 3.6, .01)));
  g.with({ c: '#b58a3a', mat: MAT.brushed, m: 1, r: .3 }, () => g.at([6.89, .35, -1.8], () => g.rbox(.02, .03, 3.6, .006)));
  // Vorfuehrkabine: dunkle Wand, Luke, Projektor
  g.with({ c: '#14080a', r: .6 }, () => { g.at([-2.45, 1.0, -1.8], () => g.rbox(.3, 2.0, 3.6, .01)); g.at([-2.45, 2.95, -1.8], () => g.rbox(.3, .5, 3.6, .01)); g.at([-2.45, 2.35, -3.0], () => g.rbox(.3, .7, 1.2, .01)); g.at([-2.45, 2.35, -.6], () => g.rbox(.3, .7, 1.2, .01)); });
  const PJ = { x: -2.32, y: 2.36, z: -1.8 };
  g.at([PJ.x - .22, PJ.y, PJ.z], () => {
    g.with({ c: '#2c3a37', mat: MAT.plain, r: .3 }, () => g.rbox(.6, .32, .3, .03, 3));
    g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .25 }, () => g.at([.36, 0, 0], [0, 0, -PI / 2], () => g.lathe([[.0, -.06], [.08, -.06], [.08, .06], [.06, .08], [0, .08]], 22)));
    for (const dx of [-.12, .14]) g.with({ c: '#b0b2b8', mat: MAT.brushed, m: 1, r: .3 }, () => g.at([dx, .34, 0], [PI / 2, 0, 0], () => g.cyl(.17, .02, 30)));
  });
  g.with({ c: '#fff4dc', e: 70 }, () => g.at([PJ.x + .2, PJ.y, PJ.z], [0, 0, -PI / 2], () => g.lathe([[.06, 0], [0, 0]], 22)));
  // Stufen fuer die Sitzreihen
  const rows = 9, seatsZ = [-3.08, -2.44, -1.8, -1.16, -.52];
  const rowX = i => 6.2 - i * .72, rowY = i => .03 + i * .082;
  g.with({ c: '#250a0c', mat: MAT.rug, r: 1 }, () => { for (let i = 0; i < rows; i++) g.at([rowX(i) - .1, rowY(i) / 2, -1.8], () => g.rbox(.74, rowY(i), 3.6, .004)); });
  g.with({ c: '#b58a3a', mat: MAT.brushed, m: 1, r: .35 }, () => { for (let i = 0; i < rows; i++) g.at([rowX(i) + .27, rowY(i) + .002, -1.8], () => g.rbox(.012, .006, 3.56, .002)); });
  E.addStatic(g, ID);

  // Sitze: Samt, leicht gekippt, schauen zur Leinwand
  const seat = many(E, ID, rows * seatsZ.length, gg => {
    gg.with({ c: '#8a1a20', mat: MAT.velvet, r: .85 }, () => {
      gg.at([0, .4, 0], () => gg.rbox(.42, .1, .5, .03, 3));
      gg.at([-.24, .72, 0], [0, 0, .12], () => gg.rbox(.1, .66, .5, .035, 3));
    });
    gg.with({ c: '#150707', mat: MAT.plain, r: .35 }, () => { gg.at([-.04, .2, -.28], () => gg.rbox(.34, .4, .05, .01)); gg.at([-.04, .2, .28], () => gg.rbox(.34, .4, .05, .01)); });
    gg.with({ c: '#b58a3a', mat: MAT.brushed, m: 1, r: .3 }, () => { gg.at([-.04, .54, -.28], () => gg.rbox(.36, .03, .05, .008)); gg.at([-.04, .54, .28], () => gg.rbox(.36, .03, .05, .008)); });
  });
  seat.begin();
  for (let i = 0; i < rows; i++) for (const z of seatsZ) seat.push(M.T(rowX(i), rowY(i), z), [0, 0, 0, 0], [1, 1, 0, 0], [-1, ID, 1, 1]);
  seat.end();

  rooms[ID] = { up: lin('#7a1a1e').map(v => v * .3), dn: lin('#2a0a0c').map(v => v * .32), fill: [.075, .02, .02], power: 1, gloss: .7, min: [r.x0, r.y0, r.z0], max: [r.x1, r.y1, r.z1] };
  const rB = { ...r, x1: 7.62 };
  for (let i = 0; i < 2; i++) light(ID, rB, { pos: [r.x0 + 2.2 + i * 5, r.y1 - .1, -1.0], dir: norm([0, -1, -.38]), angle: 1.3, inner: .9, color: [5.4, 3.0, 2.2], range: 8, size: .4, haze: .0015 });
  const beam = light(ID, rB, { pos: [PJ.x + .3, PJ.y, PJ.z], dir: norm([Sc.x - PJ.x, Sc.y - PJ.y, 0]), angle: .172, inner: .15, color: [90, 90, 84], range: 13, size: .012, near: .2, haze: .0045, manual: true, power: 0 });
  const glow = light(ID, rB, { pos: [Sc.x - .25, Sc.y, Sc.z], dir: [-1, -.1, 0], angle: 1.45, inner: 1.1, color: [7, 7, 8], range: 7, size: 1, near: .05, manual: true, power: 0 });

  // Die vierte Wand: gibt es nur, wenn die Kamera im Saal sitzt.
  const front = part(E, ID, gg => {
    gg.s({ c: '#5e0f14', mat: MAT.velvet, r: .9 });
    gg.rect([r.x1, 0, 0], [r.x0, 0, 0], [r.x0, 3.2, 0], [r.x1, 3.2, 0], [0, 0, -1]);
    gg.with({ c: '#b58a3a', mat: MAT.brushed, m: 1, r: .32 }, () => { for (let i = 0; i <= 8; i++) gg.at([r.x0 + .4 + i * 1.22, 1.6, -.03], () => gg.rbox(.05, 3.2, .05, .01)); });
  });
  // Leinwand: lebt (Fenster 1). Darauf das Haus (Fenster 0).
  const UI = liveSlots.ui;
  const screen = part(E, ID, gg => { gg.s({ c: '#ffffff', tex: 201, flag: 8, e: 1.05, r: .96 }); gg.card(Sc.w, Sc.h); });
  screen.set(M.mul(M.T(Sc.x + .022, Sc.y, Sc.z), M.RY(-PI / 2)));
  const titleDoc = E.addDoc(canvas(1024, 576, (x, w, h) => { x.fillStyle = BG0; x.fillRect(0, 0, w, h); x.fillStyle = '#efe8d8'; x.font = '900 118px Fraunces'; x.textBaseline = 'middle'; x.fillText('Der Rest', 70, 210); x.fillStyle = '#c49b49'; x.fillText('ist Code.', 70, 350); }));
  const title = part(E, ID, gg => { gg.s({ c: '#ffffff', tex: titleDoc, flag: 8, e: 1.05, r: .3 }); gg.card(Sc.w, Sc.h); });
  title.set(M.mul(M.T(Sc.x + .024, Sc.y, Sc.z), M.RY(-PI / 2)));
  const house = part(E, ID, gg => { gg.s({ c: '#ffffff', tex: 200, flag: 8, e: 1.0, r: .3 }); gg.card(Sc.w, Sc.h, [0, 1, 1, 0]); });
  house.set(M.mul(M.T(Sc.x + .018, Sc.y, Sc.z), M.RY(-PI / 2)));

  // ---------------------------------------------------- Was auf der Leinwand steht
  const Tm = {
    und: cue(19, 'Und'), zwei: cue(19, 'zwei'), cc: cue(19, 'Claude'), ich: cue(19, 'Das'), chat: cue(19, 'nur'), ordner: cue(19, 'sondern'), app: cue(19, 'Das', 1), appE: cueE(19, 'Desktop'), abo: cue(19, 'im', 1), euro: cue(19, 'zwanzig'),
    werk: cue(20, 'Und'), hf: cue(20, 'leichte'), hfName: cue(20, 'HyperFrames'), frei: cue(20, 'kostenlos'), heygen: cue(20, 'von'), inst: cue(20, 'Installieren'), sag: cue(20, 'Sag'),
    eigene: cue(20, 'Marlon', 0), bestimmt: cue(20, 'Was'), mod: cue(20, 'welche', 0), wz: cue(20, 'welche', 1), si: cue(20, 'Darum'), haus: cue(20, 'Dieses'), name: cue(20, 'Der', 2), intel: cue(20, 'Superintelligenz'), arbeit: cue(20, 'Ich', 1),
    brief: cue(21, 'Dann'), sagst: cue(21, 'sagst'), tippen: cue(21, 'Tippen'), sprich: cue(21, 'sprich'), vier: cue(21, 'Vier'), l1: cue(21, 'Was', 1), l2: cue(21, 'Für'), l3: cue(21, 'Wie'), shots: cue(21, 'Beispielbildern'), l4: cue(21, 'Und'), l4e: cueE(21, 'ungefähr'),
    nicht: cue(22, 'Nicht'), f1: cue(22, 'Schrift'), f2: cue(22, 'Farbe'), f3: cue(22, 'Code'), prompt: cue(22, 'Du', 0), frei2: cue(22, 'Du', 1), gut: cue(22, 'Und'), albern: cue(22, 'Klingt'), hilft: cue(22, 'Hilft'),
    wicht: cue(23, 'Und'), draft: cue(23, 'Der'), sag2: cue(23, 'Sag'), kind: cue(23, 'Zu'), runden: cue(23, 'Das', 1), abo2: cue(23, 'und', 1), code: cue(23, 'Aber'), codeE: cueE(23, 'Code'),
    wer: cue(24, 'Wer'),
  };
  ctx.kinoT = Tm;
  const CREAM = '#efe8d8', GOLD = '#c49b49', BG = '#0d0c10', DIM = 'rgba(239,232,216,.62)';
  const paper = canvas(2048, 1152, (x, w, h) => paperGround(x, w, h, '#d9d1bb', 91));
  const mixHex = (a, b, k) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A0 = p(a), B0 = p(b); return `rgb(${A0.map((v, i) => Math.round(mix(v, B0[i], k))).join(',')})`; };
  const typedOf = (s, t, a, b) => s.slice(0, Math.floor(clamp((t - a) / (b - a)) * s.length + .001));
  const ROUND = (x, a, b, c, d, rad) => { x.beginPath(); x.roundRect(a, b, c, d, rad); };
  function folderPanel(x, t, X, Y, W0, H0, ao = 1) {
    x.globalAlpha = ao;
    ROUND(x, X, Y, W0, H0, 26); x.fillStyle = '#1b1920'; x.fill(); x.strokeStyle = 'rgba(239,232,216,.25)'; x.lineWidth = 3; x.stroke();
    x.fillStyle = GOLD; ROUND(x, X + 44, Y + 44, 90, 64, 10); x.fill(); ROUND(x, X + 44, Y + 34, 46, 22, 8); x.fill();
    x.fillStyle = CREAM; x.font = '700 58px "JetBrains Mono"'; x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillText('Mein Film/', X + 156, Y + 62);
    x.fillStyle = GOLD; x.font = '500 40px Jost'; x.fillText('auf deinem Rechner', X + 158, Y + 118);
    ['brief.md', 'script.md', 'voice.md', 'scenes/', 'renders/film.mp4'].forEach((f, i) => { const a = smooth(Tm.ordner + .5 + i * .36, Tm.ordner + .75 + i * .36, t); x.globalAlpha = a * ao; x.fillStyle = 'rgba(239,232,216,.92)'; x.font = '400 54px "JetBrains Mono"'; x.fillText(f, X + 70, Y + 200 + i * 70); }); x.globalAlpha = 1;
  }
  function inputField(x, s, y, caret, h = 130) {
    ROUND(x, 170, y, 2048 - 340, h, h / 2); x.fillStyle = '#1b1920'; x.fill(); x.strokeStyle = 'rgba(196,155,73,.7)'; x.lineWidth = 4; x.stroke();
    x.fillStyle = CREAM; x.font = '400 62px "JetBrains Mono"'; x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillText(s, 240, y + h / 2 + 2);
    if (caret) { const w = x.measureText(s).width; x.fillStyle = GOLD; x.fillRect(244 + w, y + h / 2 - 34, 6, 68); }
  }
  const circle = (x, n, cx, cy, a) => { x.globalAlpha = a; x.fillStyle = '#b89a55'; x.beginPath(); x.arc(cx, cy, 44, 0, TAU); x.fill(); x.strokeStyle = '#6a5426'; x.lineWidth = 4; x.stroke(); x.fillStyle = '#16120a'; x.font = '700 58px Jost'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), cx, cy + 3); x.globalAlpha = 1; x.textAlign = 'left'; };
  function typedPar(x, s, X, Y, maxW, lh) { const ls = wrap(x, s, maxW); ls.forEach((l, i) => x.fillText(l, X, Y + i * lh)); return ls.length; }
  const strike = (x, X0, X1, y, p) => { if (p <= 0) return; x.strokeStyle = RED; x.lineWidth = 12; x.lineCap = 'round'; x.beginPath(); const X = mix(X0, X1, p); for (let i = 0; i <= 30; i++) { const px = mix(X0, X, i / 30), py = y + Math.sin(i * .9) * 3; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); };
  // Erster Entwurf und was daraus wird
  const drawImg = (x, im, X, Y, W0, H0, a = 1) => { if (!im) return; x.globalAlpha = a; x.drawImage(im, X, Y, W0, H0); x.globalAlpha = 1; };
  let key0 = '';
  function paint(t) {
    const fr = Math.floor(t * 30); if (fr === key0 && UI.owner === 'kino') return; key0 = fr; UI.owner = 'kino';
    UI.paint(x => {
      const W = 2048, H = 1152, A = (a, d = .28) => smooth(a, a + d, t);
      x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.lineCap = 'butt';
      x.globalAlpha = 1; x.fillStyle = BG; x.fillRect(0, 0, W, H);
      if (t < Tm.cc - .05) {
        x.globalAlpha = A(Tm.und + .7); x.fillStyle = CREAM; x.font = '900 190px Fraunces'; x.fillText('Du brauchst', 180, 520);
        x.globalAlpha = A(Tm.zwei - .05); x.fillStyle = GOLD; x.fillText('zwei Dinge.', 180, 730); x.globalAlpha = 1;
      } else if (t < Tm.werk - .05) {
        // 1 Claude Code
        { const k = smoother(Tm.chat - .55, Tm.chat + .05, t);
          circle(x, 1, mix(250, 214, k), mix(392, 168, k), 1);
          x.fillStyle = CREAM; x.font = `900 ${mix(250, 120, k)}px Fraunces`; x.fillText('Claude Code', mix(180, 300, k), mix(640, 210, k));
          { const fs = mix(250, 120, k), tw = x.measureText('Claude Code').width; claudeMark(x, mix(180, 300, k) + tw + fs * .62, mix(640, 210, k) - fs * .36, fs * .86); }
          x.globalAlpha = A(Tm.ich); x.fillStyle = DIM; x.font = `500 ${mix(84, 54, k)}px Jost`; x.fillText('Das bin ich.', mix(186, 1222, k), mix(800, 202, k)); x.globalAlpha = 1; }
        // Chatfenster, dann der Ordner daneben
        const ac = A(Tm.chat), dm = 1 - .45 * A(Tm.ordner);
        x.globalAlpha = ac * dm;
        ROUND(x, 170, 270, 800, 560, 26); x.fillStyle = '#1b1920'; x.fill(); x.strokeStyle = 'rgba(239,232,216,.25)'; x.lineWidth = 3; x.stroke();
        x.fillStyle = DIM; x.font = '500 46px Jost'; x.fillText('Im Chat', 210, 340);
        x.fillStyle = '#332f3c'; ROUND(x, 420, 370, 510, 92, 30); x.fill(); ROUND(x, 216, 490, 640, 150, 30); x.fill(); ROUND(x, 450, 670, 480, 92, 30); x.fill();
        claudeMark(x, 194, 520, 36);
        x.fillStyle = CREAM; x.font = '500 46px Jost'; x.fillText('Mach mir einen Film.', 456, 432); x.fillText('Gern. Hier ist ein Text,', 252, 552); x.fillText('wie er aussehen könnte.', 252, 606); x.fillText('Und wo ist der Film?', 486, 732);
        x.globalAlpha = 1;
        const ao = A(Tm.ordner); x.globalAlpha = ao;
        folderPanel(x, t, 1060, 270, 820, 560, ao);
        x.textBaseline = 'alphabetic'; x.textAlign = 'left';
        x.globalAlpha = 1;
        // Wo es steckt: in der App fuer den Desktop, Reiter Code. Darunter, was es kostet.
        { const a = A(Tm.app);
          x.globalAlpha = a; ROUND(x, 180, 896, 78, 78, 18); x.fillStyle = '#d97757'; x.fill(); claudeMark(x, 219, 935, 58, '#faf3e6');
          x.fillStyle = CREAM; x.font = '500 62px Jost'; x.fillText('Claude-App für den Desktop', 280, 952);
          const px = 280 + x.measureText('Claude-App für den Desktop').width + 44;
          x.fillStyle = DIM; x.fillText('→', px, 952);
          const a2 = A(Tm.appE - .3); x.globalAlpha = a2; ROUND(x, px + 84, 896, 190, 78, 39); x.fillStyle = GOLD; x.fill(); x.fillStyle = '#16120a'; x.font = '700 50px "JetBrains Mono"'; x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillText('Code', px + 179, 937); x.textAlign = 'left'; x.textBaseline = 'alphabetic'; }
        x.globalAlpha = A(Tm.abo);
        x.fillStyle = CREAM; x.font = '500 62px Jost'; x.fillText('Im Abo:', 180, 1076);
        x.fillStyle = GOLD; x.font = '900 92px Fraunces'; x.globalAlpha = A(Tm.euro - .1); x.fillText('rund 20 € im Monat', 430, 1082); x.globalAlpha = 1;
      } else if (t < Tm.eigene - .05) {
        // 2 Werkstatt, der leichte Weg
        const kW = smoother(Tm.hfName - .5, Tm.hfName + .02, t);
        { const k = kW;
          circle(x, 2, mix(250, 214, k), mix(392, 168, k), 1);
          x.fillStyle = CREAM; x.font = `900 ${mix(220, 120, k)}px Fraunces`; x.fillText('Eine Werkstatt', mix(180, 300, k), mix(640, 210, k)); }
        x.globalAlpha = A(Tm.hf); x.fillStyle = DIM; x.font = '500 62px Jost'; x.fillText('Der leichte Weg:', 186, mix(800, 400, kW));
        x.globalAlpha = A(Tm.hfName - .05); x.fillStyle = GOLD; x.font = '900 190px Fraunces'; x.fillText('HyperFrames', 170, 590);
        x.globalAlpha = A(Tm.frei - .05); x.fillStyle = CREAM; x.font = '500 76px Jost'; x.fillText('kostenlos', 180, 736);
        x.globalAlpha = A(Tm.heygen - .05); x.fillStyle = DIM; x.fillText('von der Firma HeyGen', 560, 736);
        x.globalAlpha = 1;
        if (t > Tm.inst - .25) { x.globalAlpha = A(Tm.inst - .25); const s = typedOf('Installiere HyperFrames.', t, Tm.sag - .35, Tm.sag + .45); inputField(x, s, 880, Math.floor(t * 4) % 2 === 0 || s.length < 24, 140); x.globalAlpha = 1; x.textBaseline = 'alphabetic'; }
      } else if (t < Tm.si - .05) {
        // Was sie kann, bestimmt Marlon: was angeschlossen ist und was ich selbst benutzen darf.
        const kE = smoother(Tm.mod - .55, Tm.mod + .02, t);
        x.globalAlpha = A(Tm.eigene); x.fillStyle = CREAM; x.font = `900 ${mix(130, 74, kE)}px Fraunces`; x.fillText('Marlon wollte eine eigene.', mix(170, 170, kE), mix(400, 150, kE));
        x.globalAlpha = A(Tm.bestimmt - .05); x.fillStyle = GOLD; x.font = `900 ${mix(180, 92, kE)}px Fraunces`;
        if (kE < .5) { x.fillText('Was sie kann,', 170, mix(650, 260, kE)); x.fillText('bestimmt Marlon.', 170, mix(850, 360, kE)); } else { x.fillText('Was sie kann, bestimmt Marlon.', 170, mix(650, 268, kE)); }
        x.globalAlpha = 1;
        if (t > Tm.mod - .1) {
          const col = [170, 1110], top = 410, rowH = 142;
          const head = (s0, X, a) => { x.globalAlpha = a; x.fillStyle = DIM; x.font = '500 58px Jost'; x.textBaseline = 'alphabetic'; x.fillText(s0, X, top); };
          head('Angeschlossene Modelle', col[0], A(Tm.mod - .1));
          head('Was ich selbst benutzen darf', col[1], A(Tm.wz - .1));
          const rows = [['Stimme', 'Gemini TTS'], ['Musik', 'Lyria'], ['Mitschrift', 'Gemini Transcribe'], ['Klang', 'Earshot']];
          const span = (Tm.si - .3 - Tm.mod) * .5;
          rows.forEach((rw, i) => {
            const a = A(Tm.mod + i * span / 4, .22), y = top + 68 + i * rowH;
            x.globalAlpha = a; ROUND(x, col[0], y, 860, 118, 22); x.fillStyle = '#1b1920'; x.fill(); x.strokeStyle = 'rgba(239,232,216,.22)'; x.lineWidth = 3; x.stroke();
            x.textBaseline = 'middle'; x.fillStyle = CREAM; x.font = '500 54px Jost'; x.fillText(rw[0], col[0] + 40, y + 62);
            x.fillStyle = GOLD; x.font = '500 44px "JetBrains Mono"'; x.fillText(rw[1], col[0] + 340, y + 62);
            // Schalter: springt um, sobald die zweite Haelfte des Satzes faellt.
            const on = smooth(Tm.wz + i * .24, Tm.wz + i * .24 + .16, t), sw = 200, sh = 96, sy = y + 11;
            x.globalAlpha = A(Tm.wz - .1, .2);
            ROUND(x, col[1], sy, sw, sh, sh / 2); x.fillStyle = mixHex('#2a2732', '#b89a55', on); x.fill(); x.strokeStyle = 'rgba(239,232,216,.3)'; x.lineWidth = 3; x.stroke();
            x.fillStyle = CREAM; x.beginPath(); x.arc(col[1] + mix(sh / 2, sw - sh / 2, on), sy + sh / 2, sh / 2 - 9, 0, TAU); x.fill();
            x.fillStyle = on > .5 ? CREAM : DIM; x.font = '500 52px Jost'; x.fillText(on > .5 ? 'ich selbst' : 'nur Marlon', col[1] + sw + 40, y + 62);
          });
          x.globalAlpha = 1; x.textBaseline = 'alphabetic';
        }
      } else if (t < Tm.haus + .1) {
        x.globalAlpha = A(Tm.si); x.fillStyle = GOLD; x.font = '900 230px Fraunces'; x.fillText('SuperInt-Video', 130, 660); x.globalAlpha = 1;
      } else if (t < Tm.name - .12) {
        x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
      } else if (t < Tm.brief - .1) {
        // Der Name: Int ist die Abkuerzung von etwas, an dem ich noch arbeite.
        const k = smoother(Tm.intel - .25, Tm.intel + .55, t);
        const af = A(Tm.name - .12, .25) * (1 - smooth(Tm.brief - .55, Tm.brief - .15, t));
        x.globalAlpha = af; x.fillStyle = GOLD; x.font = '900 196px Fraunces'; x.textBaseline = 'alphabetic';
        const full = 'Superintelligenz', vis = k < .02 ? 'SuperInt' : 'Superint' + 'elligenz'.slice(0, Math.round(k * 8));
        x.fillText(vis, 130, 560);
        if (k < .02) { x.fillStyle = DIM; x.fillText('-Video', 130 + x.measureText('SuperInt').width, 560); }
        x.globalAlpha = af * A(Tm.arbeit, .2); x.fillStyle = CREAM; x.font = '500 84px Jost';
        x.fillText(typedOf('Ich arbeite daran.', t, Tm.arbeit, Tm.arbeit + .85), 140, 760);
        x.globalAlpha = 1;
      } else if (t < Tm.prompt - .12) {
        // Was du sagst. Vier Dinge. Getippt wird hier nicht: Die Stimme laeuft mit.
        x.drawImage(paper, 0, 0);
        const fade = smooth(Tm.prompt - .4, Tm.prompt - .12, t);
        // Mikrofon und Pegel: die echte Stimme dieses Films.
        { const a = A(Tm.sagst - .1, .25) * (1 - smooth(Tm.vier - .2, Tm.vier + .3, t) * .55);
          x.globalAlpha = a; x.fillStyle = INK; x.strokeStyle = INK; x.lineWidth = 7; x.lineCap = 'round';
          ROUND(x, 126, 66, 40, 72, 20); x.fill(); x.beginPath(); x.arc(146, 104, 36, .15, PI - .15); x.stroke(); x.beginPath(); x.moveTo(146, 140); x.lineTo(146, 158); x.stroke();
          const f0 = Math.floor(t * 30), n = 44;
          if (t > Tm.sagst - .1) for (let i = 0; i < n; i++) { const v = ENV[Math.max(0, Math.min(ENV.length - 1, f0 - (n - 1 - i) * 2))] / 99, h0 = 6 + v * 88; x.fillStyle = `rgba(27,26,30,${.25 + .6 * (i / n)})`; x.fillRect(214 + i * 16, 104 - h0 / 2, 9, h0); }
          x.lineCap = 'butt'; x.globalAlpha = 1; }
        x.fillStyle = INK; x.font = '700 58px "Courier Prime"';
        const hd = 'Mach mir ein Erklärvideo über unser neues Reisekosten-Formular.';
        typedPar(x, typedOf(hd, t, Tm.tippen + .15, Tm.vier + .25), 120, 228, W - 240, 72);
        const LX = 245, MAXW = W - LX - 130, block = (n, y, a0, a1, lbl, txt) => {
          if (t < a0 - .02) return;
          circle(x, n, 170, y - 16, A(a0 - .02, .15));
          x.fillStyle = 'rgba(27,26,30,.72)'; x.font = '700 44px "Courier Prime"'; x.fillText(lbl, LX, y - 32);
          x.fillStyle = '#100f12'; x.font = '700 58px "Courier Prime"'; typedPar(x, typedOf(txt, t, a0, a1), LX, y + 36, MAXW, 70);
        };
        block(1, 416, Tm.l1, Tm.l2 - .55, 'Was soll er sagen, in einem Satz?', 'In drei Minuten erledigt, wenn man die Belege gleich fotografiert.');
        block(2, 640, Tm.l2, Tm.l3 - .1, 'Für wen?', 'Alle, die das Formular hassen.');
        block(3, 770, Tm.l3, Tm.shots - .1, 'Wie soll er aussehen?', 'Wie diese Beispiele:');
        if (t > Tm.shots - .1) { const a = A(Tm.shots - .1, .2); [stillImg.stil1, stillImg.stil2, stillImg.stil3].forEach((im, i) => { const iw = 250, ih = 150, ix = 1060 + i * (iw + 26), iy = 712; x.globalAlpha = a; x.fillStyle = '#fff'; x.fillRect(ix - 6, iy - 6, iw + 12, ih + 12); drawImg(x, im, ix, iy, iw, ih, a); }); x.globalAlpha = 1; }
        block(4, 912, Tm.l4, Tm.l4e, 'Wie lang ungefähr?', 'Eine Minute.');
        // Was nicht hinein muss
        if (t > Tm.nicht - .05) {
          const aN = A(Tm.nicht - .05, .2); x.globalAlpha = aN;
          x.textBaseline = 'alphabetic'; x.fillStyle = 'rgba(27,26,30,.8)'; x.font = '700 58px "Courier Prime"'; const Y = 1092;
          x.fillText('Nicht:', 170, Y);
          const words = ['Schrift', 'Farbe', 'Code'], xs = [410, 780, 1090], ts = [Tm.f1, Tm.f2, Tm.f3];
          words.forEach((w0, i) => { const a = A(ts[i] - .32, .16); x.globalAlpha = a * aN; x.fillStyle = INK; x.font = '400 66px "Courier Prime"'; x.fillText(w0, xs[i], Y + 2); });
          x.globalAlpha = 1;
          words.forEach((w0, i) => { x.font = '400 66px "Courier Prime"'; const wd = x.measureText(w0).width; strike(x, xs[i] - 8, xs[i] + wd + 8, Y - 13, clamp((t - ts[i] - .06) / .34)); });
          x.textBaseline = 'middle';
        }
        if (fade > 0) { x.globalAlpha = fade; x.fillStyle = BG; x.fillRect(0, 0, W, H); x.globalAlpha = 1; }
      } else if (t < Tm.gut - .1) {
        // Du brauchst keinen perfekten Prompt. Du musst mir nur die Freiheit lassen.
        x.globalAlpha = A(Tm.prompt - .12); x.fillStyle = CREAM; x.font = '900 150px Fraunces'; x.fillText('Kein perfekter Prompt.', 150, 480);
        x.globalAlpha = A(Tm.frei2 - .05); x.fillStyle = GOLD; x.font = '900 190px Fraunces'; x.fillText('Nur Freiheit.', 150, 720);
        x.globalAlpha = 1;
      } else if (t < Tm.wicht + .25) {
        // Und sag ruhig dazu, dass es richtig gut werden soll.
        x.globalAlpha = A(Tm.gut - .1, .2);
        const s0 = typedOf('Und mach es richtig gut.', t, Tm.gut + .15, cueE(22, 'soll') - .05);
        inputField(x, s0, 380, Math.floor(t * 4) % 2 === 0 || s0.length < 24, 150); x.textBaseline = 'alphabetic'; x.globalAlpha = 1;
        x.globalAlpha = A(Tm.albern - .03, .15); x.fillStyle = DIM; x.font = '900 110px Fraunces'; x.fillText('Klingt albern.', 240, 760);
        x.font = '900 110px Fraunces'; { const wA = x.measureText('Klingt albern.').width; x.globalAlpha = A(Tm.hilft - .03, .15); x.fillStyle = GOLD; x.fillText('Hilft aber.', 240 + wA + 56, 760); }
        x.globalAlpha = 1;
        const fd = smooth(Tm.wicht - .1, Tm.wicht + .25, t);
        if (fd > 0) { x.globalAlpha = fd; x.fillStyle = BG; x.fillRect(0, 0, W, H); x.globalAlpha = 1; }
        const aw = smooth(Tm.wicht + .1, Tm.wicht + .4, t);
        if (aw > 0) { x.globalAlpha = aw; x.fillStyle = CREAM; x.font = '900 170px Fraunces'; x.fillText('Das Wichtigste', 180, 620); x.globalAlpha = 1; }
      } else if (t < Tm.draft - .03) {
        x.fillStyle = CREAM; x.font = '900 170px Fraunces'; x.fillText('Das Wichtigste', 180, 620);
      } else if (t < Tm.runden - .05) {
        // Der erste Entwurf
        drawImg(x, stillImg.kinder, 0, 0, W, H);
        x.fillStyle = 'rgba(10,9,12,.72)'; x.fillRect(0, 0, 500, 110); x.fillStyle = CREAM; x.font = '500 62px Jost'; x.fillText('Entwurf 1', 40, 78);
        if (t > Tm.sag2 - .1) {
          x.globalAlpha = A(Tm.sag2 - .1, .2);
          const s = typedOf('Zu kindisch.', t, Tm.kind, Tm.kind + .45);
          inputField(x, s, 960, Math.floor(t * 4) % 2 === 0 || s.length < 12);
          x.globalAlpha = 1; x.textBaseline = 'alphabetic';
          if (t > Tm.kind + .02) { const p = clamp((t - Tm.kind - .02) / .55); x.save(); x.beginPath(); x.rect(0, 0, 340 + p * 1500, H); x.clip(); x.fillStyle = RED; x.font = '700 290px Caveat'; x.translate(560, 560); x.rotate(-.05); x.fillText('Zu kindisch.', -220, 60); x.restore(); }
        }
      } else if (t < Tm.code - .1) {
        // Ein paar Runden
        const tiles = [[stillImg.kinder, 'Entwurf 1'], [stillImg.luft, 'Entwurf 2'], [ctx.stillImg.wide || stillImg.frau, 'Entwurf 3']];
        const tw = 580, th = tw * 9 / 16, ty = 250;
        tiles.forEach(([im, lbl], i) => { const a = A(Tm.runden + i * .22, .2), X = 110 + i * (tw + 44); x.globalAlpha = a; drawImg(x, im, X, ty, tw, th, a); x.fillStyle = DIM; x.font = '500 50px Jost'; x.fillText(lbl, X, ty + th + 64); });
        x.globalAlpha = 1;
        const an = A(Tm.abo2 - .05);
        x.globalAlpha = an; x.fillStyle = GOLD; x.font = '700 92px Jost'; x.fillText('Das Abo hat Grenzen:', 110, 870);
        x.fillStyle = CREAM; x.font = '500 76px Jost'; x.fillText('Bei Pro ein Limit alle fünf Stunden.', 110, 975);
        x.globalAlpha = 1;
      } else {
        const a = A(Tm.code - .1, .25) * (1 - smooth(Tm.wer - .4, Tm.wer + .3, t));
        x.globalAlpha = a; x.fillStyle = CREAM; x.font = '900 200px Fraunces'; x.fillText('Keine Zeile', 180, 500); x.fillStyle = GOLD; x.fillText('Code.', 180, 720); x.globalAlpha = 1;
      }
    });
  }

  // ---------------------------------------------------- Das Haus als Guckkasten auf dem Tisch
  const T_CUT = tCut();
  const dioF = part(E, ROOM.SCHREIB, gg => {
    gg.s({ c: '#2a1409', mat: MAT.wood, r: .28, grain: 1 });
    const w = DIO.w * 1.006, h = DIO.h * 1.006, t = .02, d = DIO.d;
    gg.at([0, h / 2 + t / 2, -d / 2], () => gg.rbox(w + t * 2, t, d, .004));
    gg.at([0, -h / 2 - t / 2, -d / 2], () => gg.rbox(w + t * 2, t, d, .004));
    gg.at([-w / 2 - t / 2, 0, -d / 2], () => gg.rbox(t, h, d, .004));
    gg.at([w / 2 + t / 2, 0, -d / 2], () => gg.rbox(t, h, d, .004));
    gg.at([0, 0, -d], () => gg.box(w + t * 2, h + t * 2, .008));
    gg.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .25 }, () => { for (const s of [-1, 1]) for (const q of [-1, 1]) gg.at([s * (w / 2 + t / 2), q * (h / 2 + t / 2), .001], [PI / 2, 0, 0], () => gg.rcyl(.005, .002, .001, 10)); });
  });
  const dioFace = part(E, ROOM.SCHREIB, gg => { gg.s({ c: '#ffffff', tex: 200, flag: 8, e: 1.0, r: .2 }); gg.card(DIO.w, DIO.h, [0, 1, 1, 0]); });
  dioF.set(M.T(DIO.x, DIO.y, DIO.z)); dioFace.set(M.T(DIO.x, DIO.y, DIO.z - .002));
  const END_D = cueE(24, 'ich') - T_CUT;
  ctx.wideInner = t => (t > Tm.haus - .25 && t < Tm.name - .1) || (t >= T_CUT && t < T_CUT + 6.2 + END_D);

  let beamBase = 0;
  return {
    frame(t) {
      const act = t > SCENE0() && t < Tm.wer + 1.2;
      screen.visible = act; title.visible = t >= Tm.wer + 1.2;
      if (act) paint(t);
      house.visible = t > Tm.haus + .02 && t < Tm.name - .1;
      // Der Strahl: sichtbar von der Seite. Wer in die Leinwand schaut, soll lesen koennen.
      const side = smooth(Tm.und - .3, Tm.und + .4, t) * (1 - smooth(Tm.cc - .2, Tm.cc + .5, t)) + smooth(Tm.si - .5, Tm.si + .2, t) * (1 - smooth(Tm.name - .3, Tm.name + .2, t)) + smooth(Tm.wer - .2, Tm.wer + .8, t);
      beamBase = t < Tm.und - .3 ? 0 : mix(.035, 1, Math.min(1, side));
      glow.power = act ? 1 : .15;
      dioF.visible = dioFace.visible = t >= T_CUT;
    },
    sub(ts, s, N, t, eye, at) {
      front.visible = eye[2] < -.03;
      // Wer die Leinwand anschaut, schaut den Strahl entlang: dann ist er nur Licht, kein Nebel.
      const dx = at[0] - eye[0], dy = at[1] - eye[1], dz = at[2] - eye[2], along = Math.abs(dx) / Math.max(1e-4, Math.hypot(dx, dy, dz));
      beam.power = beamBase * (1 - smooth(.42, .78, along));
    },
  };
  function SCENE0() { return Tm.und - 1.4; }
}
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
