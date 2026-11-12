// Die Schreibstube: Tisch, Tasse, Lampe und die Schreibmaschine, die synchron zur Stimme tippt.
import { Geo, MAT } from './geo.js';
import { M, PI, TAU, clamp, mix, smooth, hash, lin } from './m.js';
import { part, many, canvas, paperGround, pinUV, lettersOf, softDoc, cue, cueE, INK, RED, bump, claudeMark, TERRACOTTA } from './kit.js';
import * as P from './props.js';
import { ROOM, R } from './house.js';
import { WORDS } from './cues.js';

const ID = ROOM.SCHREIB;
export const DESK = { x: -4.05, z: -1.75, top: 10.8 + .76 };
export const TYPER = { x: DESK.x + .02, y: DESK.top, z: DESK.z + .08 };
export const CUP = { x: DESK.x + .66, y: DESK.top, z: DESK.z + .22 };

// Tastenfeld: was wo liegt.
const ROWS = ['1234567890ß', 'QWERTZUIOPÜ', 'ASDFGHJKLÖÄ', 'YXCVBNM,.-:'];
const CREDITS = ['Videos aus Code.', '', 'Bild:    Claude', 'Regie:   Claude', 'Stimme:  Gemini', 'Musik:   Lyria', 'Klang:   Earshot', 'Urteil:  Marlon'];

export function buildSchreib(ctx) {
  const { E, rooms, light, liveSlots } = ctx;
  const r = R.SCHREIB, g = new Geo(); g.s({ room: ID });
  const win = [{ x: -5.9, y: 11.65, w: 1.15, h: 1.85 }, { x: -2.2, y: 11.65, w: 1.15, h: 1.85 }];
  P.roomShell(g, r, { wallC: '#10392f', wallM: MAT.wallA, wallR: .62, floorC: '#6a3f21', ceilC: '#c7bda5', noBack: true });
  g.with({ c: '#10392f', mat: MAT.wallA, r: .62 }, () => P.wallWithHoles(g, r.x0, r.x1, r.y0, r.y1, r.z0, win));
  P.wainscot(g, r.x0, r.x1, r.y0, 1.0, r.z0, 11);
  for (const w of win) { P.windowFrame(g, w.x, w.y, w.w, w.h, r.z0 - .1); P.radiator(g, w.x, r.y0, r.z0 + .12); }
  // Vorhaenge: schwere Stoffbahnen. Stange aus Messing, ueber dem Fenster.
  for (const w of win) {
    for (const s of [-1, 1]) P.curtain(g, w.x + s * (w.w / 2 + .17), .46, r.y0 + .95, r.y1 - .17, r.z0 + .2, s * 1.7 + w.x);
    g.with({ c: '#a98a45', mat: MAT.brushed, m: 1, r: .3 }, () => {
      g.at([w.x, r.y1 - .15, r.z0 + .2], [0, 0, PI / 2], () => g.cyl(.012, w.w + .95, 12));
      for (const s of [-1, 1]) g.at([w.x + s * (w.w + .95) / 2, r.y1 - .15, r.z0 + .2], () => g.sphere(.021, 12, 8));
    });
  }
  // Deckenleiste
  g.with({ c: '#d7ccb4', r: .7 }, () => {
    g.at([(r.x0 + r.x1) / 2, r.y1 - .05, r.z0 + .05], () => g.rbox(8, .1, .1, .02));
    g.at([r.x0 + .05, r.y1 - .05, (r.z0 + r.z1) / 2], () => g.rbox(.1, .1, 3.6, .02));
    g.at([r.x1 - .05, r.y1 - .05, (r.z0 + r.z1) / 2], () => g.rbox(.1, .1, 3.6, .02));
  });
  const dx = DESK.x, dz = DESK.z, dy = r.y0, top = DESK.top;
  P.rug(g, dx, dy, dz + .1, 4.2, 2.6, '#6e1f1b', '#caa45a');
  P.desk(g, dx, dy, dz, 2.1, 1, { c: '#422311' });
  P.bankerLamp(g, dx - .78, top, dz - .22, .2);
  P.coffee(g, CUP.x, top, CUP.z, .3);
  E.hero = { pos: [CUP.x, top, CUP.z], a: P.HERO.a, b: P.HERO.b };
  P.paperStack(g, dx - .87, top, dz + .1, .21, .297, 34, 3.3);
  P.bookRow(g, dx + .25, dx + .96, top, dz - .36, 9.1, .265, ['#12161f', '#7c1a14', '#1a4a2e', '#3a1510', '#b5851f', '#141820', '#691410', '#183a28', '#54200f', '#a87a1c'], { hi: true });
  // Stifte im Becher und eine Brille: Der Tisch gehoert jemandem, der gerade nicht da ist.
  g.at([dx + .13, top, dz - .36], () => {
    g.with({ c: '#2a2c30', mat: MAT.brushed, m: 1, r: .4 }, () => g.lathe([[0, 0], [.036, 0], [.038, .1], [.035, .1], [.033, .006], [0, .006]], 24));
    for (let i = 0; i < 6; i++) { const a = i * 1.7, c = ['#c8a24a', '#2c2c2c', '#7a2a20', '#c8a24a', '#274a44', '#ddd'][i]; g.with({ c, r: .4 }, () => g.at([Math.cos(a) * .012, .1, Math.sin(a) * .012], [Math.sin(a) * .14, 0, Math.cos(a) * .14], () => g.cyl(.0035, .16, 8))); }
  });
  P.chair(g, dx, dy, dz + .95, PI);
  P.shelf(g, -7.3, r.y0 + .02, r.z0 + .2, 1.3, 2.7, 7, 1.7);
  P.shelf(g, -.7, r.y0 + .02, r.z0 + .2, 1.3, 2.7, 7, 5.9);
  P.floorLamp(g, -6.0, r.y0, -2.5);
  // Papierkorb und Globus: was in so einem Zimmer steht.
  g.at([-2.2, r.y0, -2.45], () => {
    g.with({ c: '#3b2a1a', mat: MAT.leather, r: .6 }, () => g.lathe([[0, 0], [.16, 0], [.2, .36], [.19, .36], [.15, .012], [0, .012]], 28));
    for (let i = 0; i < 6; i++) P.paperBall(g, Math.cos(i * 2.2) * .085, .345 + hash(i) * .045, Math.sin(i * 2.2) * .085, .052 + hash(i * 3.1) * .012, i * 1.37 + 1);
  });
  P.pendant(g, dx, r.y1, dz, .82);
  E.addStatic(g, ID);
  rooms[ID] = { up: lin('#3a3a2e').map(v => v * .75), dn: lin('#4a2a18').map(v => v * .7), fill: [.055, .05, .042], power: 1, gloss: .9, min: [r.x0, r.y0, r.z0], max: [r.x1, r.y1, r.z1] };
  const bankerL = light(ID, r, { pos: [dx - .74, top + .29, dz - .19], dir: norm([.16, -1, .12]), angle: 1.2, inner: .8, color: [4.2, 3.2, 2], range: 7, size: .07, haze: .003 });
  const pendantL = light(ID, r, { pos: [dx, r.y1 - .92, dz], dir: [0, -1, 0], angle: 1.42, inner: 1.0, color: [21, 16, 10], range: 10, size: .14, haze: .004 });
  const kp = [CUP.x - .46, top + .36, CUP.z + .86];
  const heroKey = light(ID, r, { pos: kp, dir: norm([CUP.x - kp[0], top + .03 - kp[1], CUP.z - kp[2]]), angle: .3, inner: .15, color: [2.5, 2.1, 1.58], range: 3, size: .2, near: .1, manual: true, power: 0, haze: 0, bias: .0012 });
  const fp = [CUP.x + .62, top + .2, CUP.z + .66];
  const heroFill = light(ID, r, { pos: fp, dir: norm([CUP.x - fp[0], top + .03 - fp[1], CUP.z - fp[2]]), angle: .36, inner: .18, color: [.42, .36, .29], range: 3, size: .3, near: .1, manual: true, power: 0, haze: 0, bias: .0012 });
  const heroFrom = cueE(1, 'nicht', 0) - .15, heroTo = cueE(1, 'nicht', 0) + 1.5;
  light(ID, r, { pos: [-6.0, r.y0 + 1.75, -2.5], dir: norm([.2, -1, .3]), angle: 1.45, inner: 1.1, color: [10, 6.6, 3.4], range: 7, size: .14, haze: .002 });
  light(ID, r, { pos: [-4, r.y1 - .1, -1.8], dir: [0, -1, 0], angle: 1.5, inner: 1.2, color: [8, 7.2, 5.8], range: 9, size: 1.9 });
  light(ID, r, { pos: [-3.2, r.y0 + 3.0, -6.2], dir: norm([-.25, -.42, 1]), angle: .85, inner: .6, color: [34, 50, 90], range: 16, size: .3, near: 1, haze: .001, bias: .003 });

  // ---------------------------------------------------- Die Schreibmaschine
  const tx = TYPER.x, ty = TYPER.y, tz = TYPER.z;
  const t0 = new Geo(); t0.s({ room: ID });
  const nameDoc = E.addDoc(canvas(1024, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = '#d3ad5c'; x.font = '700 168px Fraunces'; x.textAlign = 'left'; x.textBaseline = 'middle';
    const tw = x.measureText('Claude').width, m = 196, gap = 34, x0 = (w - m - gap - tw) / 2;
    x.fillText('Claude', x0 + m + gap, h / 2 + 8);
    claudeMark(x, x0 + m / 2, h / 2, m);
  }));
  t0.at([tx, ty, tz], () => buildTypewriterBody(t0, nameDoc));
  E.addStatic(t0, ID);

  // Tasten: viele Gleiche mit eigenem Buchstaben.
  const keyTex = E.addDoc(canvas(1024, 1024, (x) => {
    const C = 1024 / 8;
    x.clearRect(0, 0, 1024, 1024);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    ROWS.join('').split('').concat([' ']).forEach((ch, i) => {
      const cx = (i % 8 + .5) * C, cy = (Math.floor(i / 8) + .5) * C;
      x.fillStyle = '#0d0d0f'; x.beginPath(); x.arc(cx, cy, C * .46, 0, TAU); x.fill();
      x.fillStyle = '#ece6d4'; x.font = '700 62px Jost'; x.fillText(ch, cx, cy + 4);
    });
  }));
  const keys = many(E, ID, 48, gg => {
    gg.s({ c: '#c7c8cc', mat: MAT.plain, m: 1, r: .22 });
    pinUV(gg, () => gg.lathe([[.0118, -.0005], [.0122, -.002], [.0118, -.0065], [.004, -.008], [.003, -.042]], 24));
    gg.s({ c: '#101013', m: 0, r: .16 });
    const c = gg.v([0, 0, 0], [0, 1, 0], .5, .5); const rim = [];
    for (let i = 0; i <= 28; i++) { const a = i / 28 * TAU, x = Math.sin(a), z = Math.cos(a); rim.push(gg.v([x * .0115, 0, z * .0115], [0, 1, 0], .5 + x * .46, .5 + z * .46)); }
    for (let i = 0; i < 28; i++) gg.tri(c, rim[i], rim[i + 1]);
  });
  keys.shadowRoom = ID;
  const KEYPOS = [];
  ROWS.forEach((row, ri) => {
    [...row].forEach((ch, ci) => {
      const zz = .142 - ri * .0325, yy = .052 + ri * .0205, xx = (ci - 5) * .0272 + (ri - 1.5) * .0072;
      KEYPOS.push({ ch, p: [tx + xx, ty + yy, tz + zz], i: KEYPOS.length });
    });
  });
  const keyIdx = {}; KEYPOS.forEach(k => { keyIdx[k.ch] = k; });
  // Leertaste
  const space = part(E, ID, gg => { gg.s({ c: '#1a1a1e', r: .22 }); gg.rbox(.13, .007, .016, .003); gg.s({ c: '#a7a8ac', m: 1, r: .3 }); gg.at([0, -.012, 0], () => gg.box(.09, .014, .002)); });

  // Der Wagen mit Walze und Papier faehrt, die Typenhebel schlagen, das Blatt steigt.
  const carriage = part(E, ID, gg => {
    gg.s({ c: '#0e0e10', mat: MAT.plain, r: .38 });
    gg.at([0, 0, 0], [0, 0, PI / 2], () => gg.cyl(.0235, .34, 28));
    gg.s({ c: '#16161a', r: .16 });
    for (const s of [-1, 1]) {
      gg.at([s * .2, 0, 0], [0, 0, PI / 2], () => gg.rcyl(.021, .035, .004, 24));
      gg.with({ c: '#c5c6ca', m: 1, r: .24 }, () => gg.at([s * .177, 0, 0], [0, 0, PI / 2], () => gg.cyl(.012, .014, 16)));
    }
    gg.with({ c: '#bcbdc1', mat: MAT.brushed, m: 1, r: .25 }, () => {
      gg.at([0, -.021, -.03], () => gg.rbox(.40, .012, .04, .004));
      gg.at([0, .011, .027], [0, 0, PI / 2], () => gg.cyl(.0022, .3, 8)); // Papierhalter
      gg.at([-.17, .05, .04], [.5, 0, .5], () => gg.cyl(.0036, .13, 10)); // Zeilenhebel
    });
    gg.with({ c: '#16161a', r: .3 }, () => gg.at([-.2, .1, .068], () => gg.sphere(.009, 10, 8)));
  });
  // Das Blatt: eine Karte, die aus der Walze waechst. Die Textur malt der Film je Bild neu.
  const sheetW = .21, sheetH = .297;
  const sheet = part(E, ID, gg => {
    gg.s({ c: '#efe8d8', mat: MAT.paper, r: .85, tex: 202, flag: 16 });
    gg.at([0, sheetH / 2, 0], () => gg.card(sheetW, sheetH));
  });
  const bar = part(E, ID, gg => {
    gg.s({ c: '#b6b7bb', mat: MAT.brushed, m: 1, r: .26 });
    gg.at([0, .043, 0], () => gg.box(.0028, .086, .0012));
    gg.at([0, .088, 0], () => gg.rbox(.004, .006, .0034, .001));
  });
  const ribbon = part(E, ID, gg => { gg.s({ c: '#16141a', r: .5 }); gg.box(.03, .012, .0012); gg.with({ c: '#7a1c16' }, () => gg.at([0, -.006, 0], () => gg.box(.03, .006, .0013))); });

  // Was tippt die Maschine? Genau, was die Stimme gerade sagt: Absatz 4.
  const typed = [];
  {
    // Die Stimme liefert nur Woerter und Zeiten. Die Satzzeichen stehen im Sprechtext.
    const TXT = 'Ich bin Claude, eine KI. Ich habe keine Kamera und keine Hände. Ich kann nur eines: schreiben. Trotzdem ist dieser Film von mir, jedes einzelne Bild. Ich zeige dir, wie das geht. Und wie du es selbst machst.'.split(' ');
    const W4 = WORDS.filter(w => w[3] === 4), lets = [];
    TXT.forEach((s, i) => { const w = W4[i], d = (w[2] - w[1]) / s.length; for (let j = 0; j < s.length; j++) lets.push({ ch: s[j], t: w[1] + j * d }); lets.push({ ch: ' ', t: w[2] }); });
    let line = 0, col = 0, out = [];
    for (let i = 0; i < lets.length; i++) {
      const l = lets[i];
      if (l.ch === ' ' && col === 0) continue;
      out.push({ ch: l.ch, t: l.t, line, col, h: hash(i * 1.71), h2: hash(i * 2.93) });
      col++;
      // Neue Zeile nach jedem Satz oder wenn die Zeile voll ist.
      const prev = l.ch;
      if ((prev === ' ' && /[.:]/.test(lets[i - 1] ? lets[i - 1].ch : '') && !/^(Ich kann nur eines:)/.test('')) && /[.]/.test(lets[i - 1].ch)) { line++; col = 0; }
      else if (col > 62 && prev === ' ') { line++; col = 0; }
    }
    typed.push(...out);
  }
  const CW = .00254, LH = .0064;
  const page = liveSlots.page;
  const ctxP = page.ctx, W = page.w, H = page.h;
  const typeFirst = typed[0].t, typeLast = typed[typed.length - 1].t;
  const creditsAt = ctx.creditsAt;
  function typedIndex(t) { let lo = 0, hi = typed.length; while (lo < hi) { const m = (lo + hi) >> 1; if (typed[m].t <= t) lo = m + 1; else hi = m; } return lo - 1; }
  const creditLetters = [];
  { let tc = 0; CREDITS.forEach((ln, li) => { [...ln].forEach((ch, ci) => { if (ch !== ' ') creditLetters.push({ ch, line: li, col: ci, h: hash(li * 9.3 + ci), h2: hash(li * 3.3 + ci * 7), t: tc }); tc += .026; }); tc += .1; }); }
  // Die Maschine legt zum Schluss ein neues Blatt ein und schreibt doppelt so breit: das Titelblatt.
  const KC = 2.7, CWC = CW * KC, LHC = LH * KC, XC = .043, YC = .022, TOPC = .04, swapAt = creditsAt - .24, rollAt = creditsAt - .62;
  const pageBg = canvas(W, H, (x, w, h) => paperGround(x, w, h, '#efe8d8', 5));
  // Das Blatt fuer Absatz 4 ist Claudes eigenes Papier: mit Briefkopf.
  const letterBg = canvas(W, H, (x, w, h) => { x.drawImage(pageBg, 0, 0); const q = w / sheetW; x.globalCompositeOperation = 'multiply'; claudeMark(x, w * .13 + .0085 * q, .029 * q, .017 * q); x.globalCompositeOperation = 'source-over'; });
  // Das Siegel auf dem Titelblatt: Es landet, nachdem die letzte Zeile steht.
  const sealAt = creditLetters[creditLetters.length - 1].t + .75;
  const SEAL = canvas(512, 512, (x, w) => { x.clearRect(0, 0, w, w); claudeMark(x, w / 2, w / 2, w * .96); x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(0,0,0,${.05 + .3 * hash(i * 3.7)})`; const r = .6 + 2.6 * hash(i * 5.3); x.beginPath(); x.arc(hash(i * 1.3) * w, hash(i * 2.9) * w, r, 0, TAU); x.fill(); } x.globalCompositeOperation = 'source-over'; });
  function paintPage(t) {
    ctxP.drawImage(t >= swapAt ? pageBg : letterBg, 0, 0, W, H);
    const px = W / sheetW, fs = CW * px / .6, x0 = W * .13, y0 = .06 * px, lh = LH * px, j = W / 1024;
    ctxP.font = `700 ${fs}px "Courier Prime"`; ctxP.textBaseline = 'alphabetic';
    if (t >= swapAt) {
      const u = t - creditsAt, last = CREDITS.length - 1;
      for (const c of creditLetters) {
        if (c.t > u) break;
        ctxP.fillStyle = c.line === last ? RED : `rgba(3,2,3,${.92 + .08 * c.h})`;
        ctxP.font = `700 ${fs * KC}px "Courier Prime"`;
        ctxP.fillText(c.ch, (XC + c.col * CWC) * px + (c.h2 - .5) * j, (YC + c.line * LHC) * px + (c.h - .5) * j);
      }
      if (u >= sealAt) {
        const k = .05 * px, sp = 1 + .12 * (1 - smooth(sealAt, sealAt + .07, u));
        ctxP.save(); ctxP.globalCompositeOperation = 'multiply'; ctxP.globalAlpha = smooth(sealAt, sealAt + .05, u) * .94;
        ctxP.translate(.1775 * px, .09 * px); ctxP.rotate(-.13); ctxP.scale(sp, sp); ctxP.drawImage(SEAL, -k / 2, -k / 2, k, k); ctxP.restore();
      }
      return;
    }
    const n = typedIndex(t);
    for (let i = 0; i <= n; i++) {
      const c = typed[i]; if (c.ch === ' ') continue;
      ctxP.fillStyle = `rgba(3,2,3,${.9 + .1 * c.h})`;
      ctxP.fillText(c.ch, x0 + c.col * CW * px + (c.h2 - .5) * 1.1 * j, y0 + c.line * lh + (c.h - .5) * 1.2 * j);
    }
  }
  let pageKey = '';
  // Reine Funktion der Zeit: Wo steht der Wagen, welche Taste ist unten?
  function strike(ts) {
    if (ts > creditsAt - .01) {
      const u = ts - creditsAt; let last = null;
      for (const c of creditLetters) { if (c.t > u) break; last = c; }
      return last ? { c: last, dt: u - last.t, line: last.line, col: last.col + 1 } : { c: null, dt: 9, line: 0, col: 0 };
    }
    const n = typedIndex(ts);
    if (n < 0) return { c: null, dt: 9, line: 0, col: 0 };
    const c = typed[n], nx = typed[n + 1];
    let col = c.col + 1, line = c.line;
    // Wagenruecklauf: in den letzten Millisekunden vor der neuen Zeile.
    if (nx && nx.line !== c.line) {
      const left = nx.t - ts, span = Math.min(.26, nx.t - c.t);
      if (left < span) { const u = 1 - left / span, e = u * u * (3 - 2 * u); col = mix(col, 0, e); line = mix(c.line, nx.line, e); }
    }
    return { c, dt: ts - c.t, col, line };
  }
  const tm = new Float32Array(16);
  // Dampf
  const steam = part(E, ID, gg => { gg.s({ c: '#f3ece0', mat: MAT.steam, r: 1, flag: 16 }); gg.card(1, 1); });

  return {
    frame(t, world) {
      // In der Nahaufnahme fuehrt das weiche Licht von vorn. Danach gehoert die Tasse wieder der Lampe.
      { const k = smooth(heroFrom, heroTo, t); heroKey.power = heroFill.power = 1 - k; pendantL.power *= mix(.52, 1, k); bankerL.power *= k; }
      // Das Blatt ist eine reine Funktion der Zeit: gemalt wird nur, wenn sich der Zustand aendert.
      // Das Blatt teilt sich die Leinwand mit dem Foyer: In dessen Minute ist die Maschine nicht im Bild.
      if (ctx.pageBusy && ctx.pageBusy(t)) return;
      const key = t >= swapAt ? 'c' + Math.floor((t - creditsAt) * 60) : 't' + typedIndex(t);
      if (key !== pageKey || page.owner !== 'schreib') { pageKey = key; page.owner = 'schreib'; page.paint(() => paintPage(t)); }
    },
    sub(ts, s, N, t, eye, at) {
      const near = Math.hypot(eye[0] - tx, eye[1] - ty, eye[2] - tz) < 9;
      // Tasten
      const st = strike(ts);
      const hit = st.c && st.dt < .09 ? st.c.ch.toUpperCase() : null;
      keys.begin();
      for (const k of KEYPOS) {
        const d = (hit === k.ch || (hit === 'ß' && k.ch === 'ß')) ? 1 - st.dt / .09 : 0;
        const y = k.p[1] - .009 * d * (d > 0 ? Math.sin(d * PI) * .4 + .6 : 0);
        const idx = ROWS.join('').indexOf(k.ch);
        keys.push(M.trs([k.p[0], y, k.p[2]], [.36, 0, 0]), [0, 0, 0, 0], [1 / 8, 1 / 8, (idx % 8) / 8, Math.floor(idx / 8) / 8], [keyTex, ID, 1, 1]);
      }
      keys.end();
      const sp = st.c && st.c.ch === ' ' && st.dt < .09 ? .005 : 0;
      space.set(M.trs([tx, ty + .03 - sp, tz + .158], [.3, 0, 0]));
      // Wagen
      // Letzter Akt: Das alte Blatt rollt zurueck in die Maschine, der Wagen faehrt heim, das neue rollt heraus.
      const crX = tx + .1 + .21 * .13 - XC;
      const sq = strike(t), pos = (st.col % 1 || sq.col % 1 || (ts >= rollAt && ts < creditsAt + .01)) ? st : sq;
      let cxp = ts >= creditsAt - .01 ? crX - pos.col * CWC : tx + .1 - pos.col * CW;
      if (ts >= rollAt && ts < creditsAt - .01) cxp = mix(tx + .1 - pos.col * CW, crX, smooth(rollAt, creditsAt - .05, ts));
      const cyp = ty + .178, czp = tz - .082;
      carriage.set(M.T(cxp, cyp, czp));
      // Blatt: steigt zeilenweise, faehrt mit dem Wagen.
      let lift = pos.line * LH + .0006 + .0507;
      if (ts >= creditsAt - .01) lift = pos.line * LHC + (TOPC - .027);
      else if (ts >= swapAt) lift = mix(-.036, TOPC - .027, smooth(swapAt, creditsAt - .02, ts));
      else if (ts >= rollAt) lift = mix(lift, -.036, smooth(rollAt, swapAt, ts));
      const tilt = -.33;
      const sm = M.mul(M.T(cxp - .1 + sheetW / 2 - .21 * .13, cyp + .012, czp + .0062), M.RX(tilt));
      sheet.set(M.mul(sm, M.T(0, lift - sheetH + .027, 0)));
      // Typenhebel
      const active = st.c && st.c.ch !== ' ' && st.dt < .085;
      const u = active ? Math.sin(clamp(st.dt / .085) * PI) : 0;
      bar.set(M.mul(M.T(tx, ty + .112, tz - .002), M.RX(mix(1.28, -.63, u))));
      bar.visible = u > .01;
      ribbon.set(M.T(tx, ty + .177 + u * .006, tz - .049));
      // Dampf ueber der Tasse: Reine Funktion der Zeit.
      steam.visible = eye[2] < 7 && Math.abs(eye[1] - ty) < 3;
      if (steam.visible) {
        const dcup = Math.hypot(eye[0] - CUP.x, eye[1] - CUP.y, eye[2] - CUP.z), kst = mix(.4, 1, smooth(.85, 1.8, dcup));
        const SW = .3 * kst, SH = .5 * kst, by = CUP.y + .0066 + .0726 + SH / 2;
        const V = v3sub(eye, [CUP.x, by, CUP.z]);
        steam.set(M.trs([CUP.x, by, CUP.z], [0, Math.atan2(V[0], V[2]), 0], [SW, SH, 1]));
      }
    },
  };
}
const v3sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

function buildTypewriterBody(g, nameDoc) {
  // Gehaeuse: schwarzer Lack, die Kanten fangen Licht.
  g.with({ c: '#050506', mat: MAT.plain, r: .62, m: 0 }, () => {
    g.at([0, 0, 0], [0, -PI / 2, 0], () => g.prism([[-.175, 0], [.175, 0], [.175, .026], [.03, .116], [-.008, .13], [-.06, .146], [-.158, .128], [-.175, .06]], .35));
  });
  g.with({ c: '#0c0c0e', mat: MAT.plain, r: .24, m: 0, flag: 64 }, () => {
    // Seitenwangen, die vorn bis zur Tastatur herunterlaufen.
    for (const s of [-1, 1]) {
      g.at([s * .178, .07, -.07], () => g.rbox(.03, .14, .19, .012, 3));
      g.with({ flag: 0, r: .34 }, () => g.at([s * .178, 0, 0], [0, -PI / 2, 0], () => g.prism([[.02, 0], [.178, 0], [.178, .03], [.03, .122], [.02, .124]], .03)));
    }
    // Vorderkante und Haube ueber dem Typenkorb
    g.at([0, .0145, .168], () => g.rbox(.35, .029, .018, .005, 3));
    g.at([0, .129, -.118], () => g.rbox(.35, .02, .1, .007, 3));
  });
  // Zierlinien und Name, in Gold auf die Vorderkante gesetzt.
  g.with({ c: '#c29a4e', mat: MAT.plain, m: 1, r: .3 }, () => {
    g.at([0, .0268, .1775], () => g.box(.335, .0007, .0005));
    for (const s of [-1, 1]) g.at([s * .1935, .07, -.07], () => g.box(.0005, .1, .15, 16 | 32));
  });
  // Tastenhebel: von jeder Taste ein Bogen aus Stahl nach hinten in den Kamm.
  g.with({ c: '#7c7d82', mat: MAT.plain, m: 1, r: .34 }, () => {
    ROWS.forEach((row, ri) => {
      [...row].forEach((ch, ci) => {
        const zz = .142 - ri * .0325, yy = .052 + ri * .0205, xx = (ci - 5) * .0272 + (ri - 1.5) * .0072;
        const a = [xx, yy - .03, zz - .012], b = [xx * .92, yy - .022, zz - .05], c0 = [xx * .78, .112, .02], pts = [];
        for (let i = 0; i <= 6; i++) { const u = i / 6; pts.push([mix(mix(a[0], b[0], u), mix(b[0], c0[0], u), u), mix(mix(a[1], b[1], u), mix(b[1], c0[1], u), u), mix(mix(a[2], b[2], u), mix(b[2], c0[2], u), u)]); }
        g.tube(pts, .0009, 4);
      });
    });
    // Der Kamm, der die Hebel fuehrt
    g.at([0, .112, .021], () => g.rbox(.3, .005, .004, .0012, 1));
  });
  // Griffmulde vor der Walze
  g.with({ c: '#08080a', r: .5 }, () => g.at([0, .13, -.012], () => g.rbox(.26, .012, .07, .004)));
  // Zeichen und Name, eingelegt in die Platte zwischen den Farbbanddosen.
  if (nameDoc) g.with({ c: '#ffffff', tex: nameDoc, flag: 1, r: .3, m: 0 }, () => g.at([0, .1368, .002], [-PI / 2, 0, 0], () => g.card(.108, .027)));
  // Typenkorb: Hebel in einem Halbkreis, liegend im Dunkeln.
  g.with({ c: '#8d8e92', mat: MAT.brushed, m: 1, r: .32 }, () => {
    for (let i = 0; i < 36; i++) {
      const a = (i / 35 - .5) * 2.3;
      g.at([Math.sin(a) * .1, .128, -.012 + Math.cos(a) * .03], [0, a * .35, 0], () => g.box(.0025, .0022, .05));
    }
  });
  // Farbbanddosen und Band
  for (const s of [-1, 1]) {
    g.at([s * .125, .149, -.03], () => {
      g.with({ c: '#b7b8bc', mat: MAT.brushed, m: 1, r: .24 }, () => g.rcyl(.031, .009, .002, 26));
      g.with({ c: '#141318', r: .4 }, () => g.at([0, .0055, 0], () => g.cyl(.022, .002, 20)));
      g.with({ c: '#c9cace', m: 1, r: .2 }, () => g.at([0, .0075, 0], () => g.cyl(.005, .004, 10)));
    });
  }
  g.with({ c: '#141216', r: .5 }, () => g.at([0, .158, -.044], () => g.box(.22, .006, .001)));
  // Chromleisten und Schriftzug-Platte
  g.with({ c: '#c5c6ca', mat: MAT.brushed, m: 1, r: .22 }, () => {
    g.at([0, .012, .177], () => g.rbox(.35, .006, .004, .001));
    g.at([0, .027, .176], () => g.rbox(.35, .002, .002, .0005));
    g.at([0, .163, -.116], () => g.rbox(.42, .009, .012, .003));
    g.at([0, .163, -.05], () => g.rbox(.42, .006, .009, .002));
  });
  // Gummifuesse
  g.with({ c: '#111', r: .8 }, () => { for (const [x, z] of [[-.15, .15], [.15, .15], [-.15, -.15], [.15, -.15]]) g.at([x, .002, z], () => g.cyl(.012, .006, 12)); });
  // Stiele unter den Tasten: dunkel, sieht man kaum, muss aber da sein.
}
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
