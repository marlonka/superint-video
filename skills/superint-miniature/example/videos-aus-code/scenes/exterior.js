// Draussen: Strasse, Regen, Himmel, das Schild auf dem Dach und drueben die Traumfabrik.
import { Geo, MAT } from './geo.js';
import { M, PI, TAU, clamp, mix, smooth, hash, hash2, lin } from './m.js';
import { part, many, canvas, neonText, textWidth, softDoc, cue, cueE, rise, claudeMark } from './kit.js';
import { ROOM } from './house.js';

const EXT = ROOM.EXT;
const N_VOX = 2100, N_SMOKE = 520;
const STREET_Y = -.6;

// Drei Traeume desselben Gebaeudes. Jeder Klotz hat einen Platz je Traum und einen Bildpunkt im Traumbild.
function dreamCells(which) {
  const c = [], S = .62;
  const fill = (x0, x1, y0, y1, dep = 1) => {
    for (let x = x0; x < x1 - 1e-3; x += S) for (let y = y0; y < y1 - 1e-3; y += S) for (let d = 0; d < dep; d++) c.push([x + S / 2, y + S / 2, -d * S * 1.1]);
  };
  if (which === 0) {
    // Lange Halle mit Saegedach, zwei Schlote, ein Turm
    fill(-10, 8, 0, 4.4, 1);
    for (let i = 0; i < 5; i++) { const x0 = -10 + i * 3.6; for (let k = 0; k < 6; k++) fill(x0 + k * .55, x0 + 3.6, 4.4 + k * .35, 4.4 + (k + 1) * .35, 1); }
    fill(-7.4, -6.2, 6, 13); fill(-3.8, -2.6, 6, 11.4);
    fill(8, 12, 0, 10.2); fill(8.6, 11.4, 10.2, 11.2);
  } else if (which === 1) {
    // Haelfte Kuppel, vier duenne Schlote, Turm jetzt links: dasselbe, nur anders geraten
    fill(-12, 2, 0, 3.4, 1);
    for (let a = 0; a < 26; a++) { const t = a / 25 * PI; const x = -5 + Math.cos(t) * 6.2, y = 3.4 + Math.sin(t) * 5.1; for (let r = 0; r < 4; r++) c.push([-5 + Math.cos(t) * (6.2 - r * .7), 3.4 + Math.sin(t) * (5.1 - r * .7), 0]); }
    fill(2, 7, 0, 6.5); fill(7, 12, 0, 2.6);
    for (const x of [3, 4.6, 6, 8.5]) fill(x, x + .62, 6.5, 13 - (x - 3));
    fill(-14, -11.6, 0, 12.2);
  } else {
    // Dritter Versuch: Etagen, die nicht ganz aufeinander passen, und ein Stueck Haus in der Luft
    for (let i = 0; i < 6; i++) { const w = 18 - i * 2.2, o = Math.sin(i * 2.1) * 1.8; fill(-w / 2 + o, w / 2 + o, i * 1.9, (i + 1) * 1.9 - .15); }
    fill(-13, -9.5, 7.5, 10.4); fill(9, 13, 8.8, 11);
    fill(-2, -.8, 11.4, 15); fill(3, 3.62, 9, 13);
  }
  return c;
}

export function buildExterior(ctx) {
  const { E, rooms, add } = ctx;
  const g = new Geo();
  g.s({ room: EXT });
  // Himmel weit hinten
  g.with({ c: '#000000', mat: MAT.sky, flag: 32 }, () => g.at([0, 30, -78], () => g.card(420, 170)));
  // Nasse Strasse
  g.with({ c: '#1b1b20', mat: MAT.street, r: .35, flag: 32 }, () => g.rect([-140, STREET_Y, 80], [140, STREET_Y, 80], [140, STREET_Y, -78], [-140, STREET_Y, -78], [0, 1, 0]));
  // Gehsteigkante vor dem Haus
  g.with({ c: '#2a2a30', mat: MAT.plain, r: .6 }, () => { g.at([0, STREET_Y + .06, 1.2], () => g.rbox(36, .12, 2.4, .03)); g.at([0, STREET_Y + .06, -5.6], () => g.rbox(36, .12, 3, .03)); });
  // Zwei Laternen
  const lamp = (x, z) => g.at([x, STREET_Y, z], () => {
    g.with({ c: '#14151a', mat: MAT.brushed, m: 1, r: .4 }, () => {
      g.lathe([[0, 0], [.16, 0], [.16, .1], [.08, .18], [.05, .3], [.04, 4.6], [.03, 4.7]], 18);
      g.at([0, 4.75, 0], () => g.lathe([[.03, 0], [.2, .02], [.22, .05], [.02, .1]], 18));
      g.at([0, 5.32, 0], () => g.lathe([[.05, 0], [.27, .05], [.25, .1], [.06, .2], [0, .24]], 18));
    });
    g.with({ c: '#ffcf94', e: 34, r: .4 }, () => g.at([0, 5.08, 0], () => g.sphere(.2, 18, 12)));
  });
  lamp(-11.2, 2.4); lamp(11.4, 2.4); lamp(-13.5, -6.4); lamp(16, -6.4);
  E.addStatic(g, EXT);
  rooms[EXT] = { up: lin('#141c2e').map(v => v * .85), dn: lin('#0c0c10'), fill: [.018, .022, .034], power: 1, gloss: .6, min: [-140, -1, -80], max: [140, 60, 90] };

  add({ room: EXT, pos: [-22, 42, 40], dir: norm([.38, -.6, -.7]), angle: .62, inner: .4, color: [1500, 1850, 2700], range: 110, size: 2.5, near: 8, power: 1, base: 1, bias: .004, haze: .00022 });
  for (const [x, z] of [[-11.2, 2.4], [11.4, 2.4]]) add({ room: EXT, pos: [x, STREET_Y + 5.0, z], dir: [0, -1, 0], angle: 1.25, inner: .8, color: [20, 13.5, 7.5], range: 16, size: .12, near: .3, power: 1, base: 1, bias: .004, haze: .007 });

  // ---------------------------------------------------- Regen
  const rain = many(E, EXT, 1500, gg => { gg.s({ c: '#c5d6ec', e: .7, r: .25 }); gg.card(1, 1); }, {});
  const rm = new Float32Array(16); rm[15] = 1;
  function updateRain(ts, eye) {
    rain.begin();
    const far = Math.abs(eye[2]);
    const front = smooth(12, 24, eye[2]);
    const w = .005 + far * .00045, h = .22 + far * .0035;
    rm[0] = w; rm[5] = h; rm[10] = 1;
    const box = eye[2] > 12 ? 1 : 0;
    const n = box ? 1100 : 700, cx = box ? 0 : eye[0];
    for (let i = 0; i < n; i++) {
      const a = hash(i * 1.17), b = hash(i * 2.31), c = hash(i * 3.73), sp = 8.5 + 3 * hash(i * 5.3);
      const y = STREET_Y + ((b * 40 - ts * sp) % 40 + 40) % 40;
      let x, z;
      if (box && i % 2 === 0) { x = (a - .5) * 70 + eye[0]; z = 3 + c * Math.max(eye[2] - 8, 1); if (front < .5) continue; }
      else { x = (a - .5) * 70 + cx; z = -5 - c * 26; }
      rm[12] = x + ts * .9 * ((y - STREET_Y) / 40 - .5) * .1; rm[13] = y; rm[14] = z;
      // Tropfen dicht vor der Linse waeren nur noch grosse, flache Schemen.
      const na = box ? smooth(6, 14, eye[2] - z) : 1; if (na < .01) continue;
      rain.push(rm, [0, 0, 0, 0], [1, 1, 0, 0], [-1, -1, 1, (box ? .13 : .22) * na]);
    }
    rain.end();
  }

  // ---------------------------------------------------- Das Schild auf dem Dach: dunkel, bis der Film es einschaltet
  const SIGN = 'VIDEOS AUS CODE';
  // Links vom Schriftzug das Zeichen des Hauses: Es geht an, sobald die Stimme sagt, wer hier wohnt.
  const LOGO = 1.42, LOGO_GAP = .46;
  const sh = 1.02, sw = textWidth(SIGN, sh) + LOGO + LOGO_GAP, sx0 = -sw / 2 + LOGO + LOGO_GAP, sy0 = 19.5, lx = -sw / 2 + LOGO / 2, ly = sy0 + sh / 2;
  const logoDoc = E.addDoc(canvas(512, 512, (x, w) => { x.clearRect(0, 0, w, w); claudeMark(x, w / 2, w / 2, w * .96, '#2a130d'); }));
  const logoLitDoc = E.addDoc(canvas(512, 512, (x, w) => { x.clearRect(0, 0, w, w); claudeMark(x, w / 2, w / 2, w * .96, '#ff7a48'); }));
  const sg = new Geo(); sg.s({ room: EXT });
  sg.with({ c: '#15151a', mat: MAT.brushed, m: 1, r: .45 }, () => {
    sg.at([0, sy0 + sh + .06, -.28], () => sg.rbox(sw + .4, .05, .05, .01));
    sg.at([0, sy0 - .06, -.28], () => sg.rbox(sw + .4, .05, .05, .01));
    for (let i = 0; i <= 12; i++) { const x = -sw / 2 - .2 + (sw + .4) * i / 12, yr = 18.9 - Math.abs(x) * .39; sg.at([x, (yr + sy0 + sh) / 2, -.28], () => sg.cyl(.022, sy0 + sh - yr, 8)); }
  });
  sg.with({ c: '#3a1410', r: .25, mat: MAT.plain }, () => sg.at([0, 0, -.25], () => neonText(sg, SIGN, sx0, sy0, sh, .03)));
  sg.with({ c: '#3a1a12', r: .3, mat: MAT.plain, tex: logoDoc, flag: 1 }, () => sg.at([lx, ly, -.25], () => sg.card(LOGO, LOGO)));
  E.addStatic(sg, EXT);
  const letters = []; let cx = sx0;
  for (const ch of SIGN) {
    if (ch !== ' ') {
      letters.push(part(E, EXT, gg => { gg.s({ c: '#ff5a2c', e: 46, r: .3, flag: 0 }); gg.at([0, 0, -.2], () => neonText(gg, ch, cx, sy0, sh, .034)); }));
    }
    cx += textWidth(ch, sh) + .22 * sh;
  }
  const logoLit = part(E, EXT, gg => { gg.s({ c: '#ff6a38', e: 13, r: .3, tex: logoLitDoc, flag: 1 | 16 }); gg.at([lx, ly, -.2], () => gg.card(LOGO, LOGO)); });
  const logoAt = cue(4, 'Claude');
  const signLight = add({ room: EXT, pos: [0, 21.6, 3.6], dir: norm([0, -.62, -.78]), angle: 1.1, inner: .6, color: [120, 26, 12], range: 22, size: 1.2, near: .5, power: 0, base: 0, bias: .004 });
  // Wann brennt welcher Buchstabe? Reine Funktion der Zeit, Flackern aus der Buchstabennummer.
  // Buchstabe fuer Buchstabe, genau auf den drei Woertern.
  const signAt = cue(24, 'Videos');
  const signStart = [];
  [['Videos', 6], ['aus', 3], ['Code', 4]].forEach(([w, n]) => { const a = cue(24, w), b = cueE(24, w); for (let k = 0; k < n; k++) signStart.push(a + k / n * Math.max(.12, b - a - .08)); });
  function signLevel(i, t) {
    const t0 = signStart[i];
    if (t < t0) return 0;
    const u = t - t0; if (u > .32) return 1;
    return hash(i * 7.7 + Math.floor(u * 30)) > .45 ? 1 : .12;
  }

  // ---------------------------------------------------- Die Traumfabrik
  const pic = E.addDoc(paintDreams());
  const cells = [dreamCells(0), dreamCells(1), dreamCells(2)].map(c => pick(c, N_VOX));
  const vox = many(E, EXT, N_VOX + N_SMOKE, gg => {
    gg.s({ c: '#ffffff', e: 2.3, r: .5, flag: 8 | 4 | 16 });
    gg.box(1, 1, 1);
  });
  vox.shadowRoom = -99; // wirft keinen Schatten, ist ja nur geträumt
  const PIC_ROW = [0, 1 / 3, 2 / 3];
  const voxData = [];
  for (let i = 0; i < N_VOX; i++) voxData.push({ h: hash(i * 3.3), h2: hash(i * 7.1), h3: hash(i * 9.9), dark: hash(i * 2.2) < .2 });
  const vm = new Float32Array(16); vm[15] = 1;
  const dreamAt = cue(6, 'kaputt') - .22, dreamAt2 = cue(6, 'alles'), dreamEnd = cue(6, 'anderer') + .2;
  // 0 = erster Traum. Bei "alles neu getraeumt" zerfaellt alles zu Pixeln und steht als ein anderer Bau wieder da.
  function dreamState(t) {
    if (t < dreamAt2 - .25) return [0, 1, 0];
    if (t < dreamEnd + .4) return [0, 1, smooth(dreamAt2 - .25, dreamEnd, t)];
    return [1, 2, smooth(cue(7, 'Aber', 0), cue(7, 'Aber', 0) + 2, t)];
  }
  const signs = ['TRAUMFABRIK', 'TRAUMFRABIK', 'TRÄUMFABR8K'].map((s, k) => {
    const h = 1.5, w = textWidth(s, h);
    return part(E, EXT, gg => {
      gg.s({ c: k === 0 ? '#9ee8ff' : k === 1 ? '#ffb2e6' : '#ffe29e', e: 34, r: .3, flag: 0 });
      neonText(gg, s, -w / 2, 13.6 + (k === 2 ? .8 : 0) - (k === 1 ? 1 : 0), h, .055);
    });
  });
  const soft = softDoc(E);
  const glow = part(E, EXT, gg => { gg.s({ c: '#ffffff', e: 0, tex: soft, flag: 1 | 16, r: 1 }); gg.card(1, 1); });
  glow.visible = false;
  const glowI = many(E, EXT, 6, gg => { gg.s({ c: '#ffffff', e: 1.0, tex: soft, flag: 1 | 16 | 0, r: 1 }); gg.card(1, 1); });
  glowI.shadowRoom = -99;

  // Wo steht die Fabrik? In der Totale rechts vom Haus, durch die Tuer des Foyers genau gegenueber.
  const doorFrom = cue(5, 'Keine') - 1, doorTo = cue(7, 'Aber', 0) + .4;
  const winFrom = cue(17, 'Darum'), winTo = cue(18, 'Aber') + .6;
  function factoryPlace(t) {
    if (t > doorFrom && t < doorTo) return { x: -6.2, y: STREET_Y, z: -30, dim: 1 };
    if (t > winFrom && t < winTo) return { x: -1.1, y: STREET_Y, z: -34, dim: 1 };
    return { x: 27, y: STREET_Y, z: -46, dim: mix(.17, .62, smooth(cue(2, 'Und') - .2, cue(2, 'Videogenerator'), t) * (1 - smooth(cue(3, 'Das') - .2, cue(3, 'Das') + .6, t))) };
  }
  let factoryOn = true;
  function updateFactory(ts, t, eye) {
    const pl = factoryPlace(t);
    const [a, b, k] = dreamState(ts);
    const shake = 0;
    vox.begin();
    const dA = cells[a], dB = cells[b];
    for (let i = 0; i < N_VOX; i++) {
      const d = voxData[i];
      const delay = d.h * .5, u = clamp((k - delay * .6) / (1 - delay * .6));
      const uu = u * u * (3 - 2 * u);
      const pa = dA[i], pb = dB[i];
      // Mitten im Umbau schwebt alles als Wolke.
      const lift = Math.sin(uu * PI);
      const ang = d.h2 * TAU + ts * (.4 + d.h3);
      const x = mix(pa[0], pb[0], uu) + lift * Math.cos(ang) * (3 + d.h3 * 5);
      const y = mix(pa[1], pb[1], uu) + lift * (2.5 + d.h * 7) * Math.abs(Math.sin(ang * .7 + d.h));
      const z = mix(pa[2], pb[2], uu) + lift * Math.sin(ang) * (3 + d.h2 * 4);
      const s = .6 * (1 - lift * .35);
      vm[0] = s; vm[5] = s; vm[10] = s;
      vm[12] = pl.x + x; vm[13] = pl.y + y; vm[14] = pl.z + z;
      const row = PIC_ROW[lift > .5 ? b : a];
      const ux = clamp(((lift > .5 ? pb[0] : pa[0]) + 15) / 30), uy = clamp((lift > .5 ? pb[1] : pa[1]) / 16);
      const bright = (d.dark ? .22 : 1) * (.55 + .45 * Math.sin(ts * 1.4 + d.h * 30) ** 2) * pl.dim;
      vox.push(vm, [0, 0, 0, 0], [0, 0, ux, row + (1 - uy) * (1 / 3 - .004)], [pic, -1, bright, 1]);
    }
    // Schlote: Rauch aus Pixeln
    const stacks = [[[-6.8, 13], [-3.2, 11.4]], [[3.3, 13], [4.9, 11.4], [6.3, 10], [8.8, 7.5]], [[-1.4, 15], [3.3, 13]]][a];
    for (let i = 0; i < N_SMOKE; i++) {
      const h = hash(i * 4.4), life = ((ts * .19 + h) % 1 + 1) % 1, st = stacks[i % stacks.length];
      const x = st[0] + (hash(i * 8.1) - .5) * (.5 + life * 9) + life * 8 + Math.sin(ts * .5 + i) * life;
      const y = st[1] + life * 15;
      const z = (hash(i * 6.2) - .5) * (.4 + life * 3);
      const s = (.5 + hash(i) * .5) * (1.1 - life * .6);
      vm[0] = s; vm[5] = s; vm[10] = s; vm[12] = pl.x + x; vm[13] = pl.y + y; vm[14] = pl.z + z;
      vox.push(vm, [0, 0, 0, 0], [0, 0, hash(i * 3.1), PIC_ROW[a] + hash(i * 5.1) * .32], [pic, -1, (1 - life) * .9 * pl.dim, (1 - life * life) * .75]);
    }
    vox.end();
    // Lichthof im Nebel
    glowI.begin();
    const gm = M.trs([pl.x, pl.y + 7, pl.z - 3], [0, 0, 0], [46, 28, 1]);
    glowI.push(gm, [0, 0, 0, 0], [1, 1, 0, 0], [-1, -1, .5 * pl.dim, .2 * pl.dim]);
    glowI.end();
    // Das Schild: flackert beim Umbau, jede Fassung anders falsch
    const sb = M.T(pl.x, pl.y, pl.z);
    // Die Schrift kommt kaputt heraus: erst ein Dreher, dann ist es ein anderes Wort.
    const which = ts < dreamAt ? 0 : ts < dreamAt2 ? 1 : ts < dreamEnd - .5 ? (hash(Math.floor(ts * 13)) > .4 ? 1 : 2) : 2;
    const flick = (ts > dreamAt && ts < dreamAt + .7) || (a === 0 && k > .03 && k < .9);
    signs.forEach((sg2, i) => {
      sg2.set(sb);
      sg2.visible = i === which && (!flick || hash(Math.floor(ts * 24) + i) > .55) && pl.dim > .7;
    });
  }
  const off = () => { vox.visible = false; signs.forEach(s => s.visible = false); glowI.visible = false; };

  return {
    frame(t, world) {
      // Das Schild und sein Licht
      letters.forEach((l, i) => { l.level = signLevel(i, t); });
      signLight.power = letters.reduce((a, l) => a + l.level, 0) / letters.length;
      { const u = t - logoAt; logoLit.level = u < 0 ? 0 : u > .4 ? 1 : hash(Math.floor(u * 30) + 3.3) > .4 ? 1 : .15; }
      const seesFactory = (t > 9 && t < 24.2) || (t > doorFrom && t < doorTo) || (t > winFrom && t < winTo) || t > cue(24, 'Wer') - 3;
      vox.visible = glowI.visible = factoryOn = seesFactory;
      if (!seesFactory) signs.forEach(s => s.visible = false);
    },
    sub(ts, s, N, t, eye) {
      letters.forEach(l => { l.visible = (s + .5) / N <= l.level; });
      logoLit.visible = (s + .5) / N <= logoLit.level;
      updateRain(ts, eye);
      if (factoryOn) updateFactory(ts, t, eye);
    },
    signTime: signAt,
  };
}

function pick(list, n) {
  const a = list.slice(), out = [];
  // Feste Zufallsfolge: jeder Klotz behaelt in jedem Lauf denselben Platz.
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(hash(i * 1.77) * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  for (let i = 0; i < n; i++) { const base = a[i % a.length]; out.push(i < a.length ? base : [base[0] + (hash(i) - .5) * .3, base[1] + (hash(i * 3) - .5) * .3, base[2] - .6]); }
  return out;
}
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }

// Drei Traumbilder: ueppig und ohne Sinn, so wie Generatoren traeumen.
function paintDreams() {
  return canvas(1024, 1024, (x, w, h) => {
    const H = h / 3;
    const band = (row, stops, sun, ranges) => {
      x.save(); x.beginPath(); x.rect(0, row * H, w, H); x.clip();
      const g = x.createLinearGradient(0, row * H, 0, (row + 1) * H);
      stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); x.fillStyle = g; x.fillRect(0, row * H, w, H);
      const r = x.createRadialGradient(sun[0], row * H + sun[1], 4, sun[0], row * H + sun[1], sun[2]);
      r.addColorStop(0, sun[3]); r.addColorStop(.25, sun[3]); r.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = r; x.fillRect(0, row * H, w, H);
      ranges.forEach((rg, k) => {
        x.fillStyle = rg[1]; x.beginPath(); x.moveTo(0, (row + 1) * H);
        for (let px = 0; px <= w; px += 8) { const yy = rg[0] + Math.sin(px * .012 + k * 2.3) * 26 + Math.sin(px * .031 + k) * 14 + Math.sin(px * .08 + k * 5) * 6; x.lineTo(px, row * H + yy); }
        x.lineTo(w, (row + 1) * H); x.closePath(); x.fill();
      });
      x.restore();
    };
    band(0, ['#2b0a5c', '#c0266d', '#ff7a3c', '#ffd27a'], [640, 190, 240, 'rgba(255,245,200,1)'], [[225, '#7a1f6e'], [262, '#3f1454'], [300, '#1c0c33']]);
    band(1, ['#001a3a', '#003f6b', '#0c8f8f', '#7cf0c0'], [260, 110, 200, 'rgba(180,255,240,1)'], [[238, '#06506e'], [275, '#04304a'], [310, '#021a2c']]);
    band(2, ['#3a0040', '#7a0a8a', '#e23cc0', '#ffb0d0'], [760, 120, 170, 'rgba(255,230,255,1)'], [[220, '#6a1a9a'], [268, '#2a1466'], [305, '#120a30']]);
  });
}
