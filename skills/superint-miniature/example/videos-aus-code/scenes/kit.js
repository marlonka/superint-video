// Werkzeugkasten: Wortzeiten, Papier, Leuchtschrift, bewegte Dinge.
import { WORDS } from './cues.js';
import { Geo, MAT } from './geo.js';
import { M, PI, TAU, clamp, smooth, hash, lin } from './m.js';

// ---------------------------------------------------------------- Wann fiel welches Wort?
const norm = s => s.toLowerCase().replace(/[^\wäöüß]+/g, '');
const IDX = WORDS.map(w => norm(w[0]));
// cue(Absatz, Wort, n): Beginn des n-ten Vorkommens. Die Stimme entscheidet, nie eine getippte Sekunde.
export function cue(par, word, n = 0) {
  const k = norm(word); let c = 0;
  for (let i = 0; i < WORDS.length; i++) if (WORDS[i][3] === par && IDX[i] === k) { if (c++ === n) return WORDS[i][1]; }
  throw new Error(`Kein Wort ${word} in Absatz ${par}`);
}
export function cueE(par, word, n = 0) {
  const k = norm(word); let c = 0;
  for (let i = 0; i < WORDS.length; i++) if (WORDS[i][3] === par && IDX[i] === k) { if (c++ === n) return WORDS[i][2]; }
  throw new Error(`Kein Wort ${word} in Absatz ${par}`);
}
// Die Woerter eines Absatzes, jeder Buchstabe mit seiner Zeit: fuer alles, was synchron zur Stimme schreibt.
export function lettersOf(par) {
  const out = [];
  for (const w of WORDS) {
    if (w[3] !== par) continue;
    const s = w[0], d = (w[2] - w[1]) / Math.max(1, s.length);
    for (let i = 0; i < s.length; i++) out.push({ ch: s[i], t: w[1] + i * d });
    out.push({ ch: ' ', t: w[2] });
  }
  return out;
}

// Eine Flanke, gemessen in Sekunden ab dem Stichwort.
export const rise = (t, t0, d = .4) => smooth(t0, t0 + d, t);
export const pulse = (t, t0, a, b) => smooth(t0, t0 + a, t) * (1 - smooth(t0 + a, t0 + a + b, t));
// Feder, die einmal anschlaegt: fuer alles, was auf einem Stichwort landet.
export const bump = (t, t0, d = .35) => { if (t < t0) return 0; const u = (t - t0) / d; return u > 1 ? 0 : Math.sin(u * PI) * (1 - u); };

// ---------------------------------------------------------------- Bewegtes
// Baut ein Teil, das sich je Teilbild bewegen darf. Muster bleiben am Teil haften (Flag 16).
export function part(E, room, fn, base = {}) {
  const g = new Geo(); g.s({ room, flag: 16, ...base }); fn(g);
  const d = E.addDynamic(g, room); return d;
}
// Dasselbe als Vorlage fuer viele Gleiche.
export function many(E, room, cap, fn, base = {}) {
  const g = new Geo(); g.s({ room, flag: 16, ...base }); fn(g);
  const o = E.addInstanced(g, cap); o.shadowRoom = room; return o;
}
// Legt alle Ecken eines Teilstuecks auf eine feste Texturstelle.
export function pinUV(g, fn, u = .02, v = .02) {
  const i0 = g.uv.length; fn(); for (let i = i0; i < g.uv.length; i += 2) { g.uv[i] = u; g.uv[i + 1] = v; }
}

// ---------------------------------------------------------------- Die Marke
// Das Zeichen von Claude als Pfad: in jeder Groesse scharf, nichts wird geladen.
const CLAUDE_D = 'm4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7893.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z';
export const TERRACOTTA = '#d97757';
export function claudeMark(x, cx, cy, size, color = TERRACOTTA) {
  x.save(); x.translate(cx - size / 2, cy - size / 2); x.scale(size / 24, size / 24); x.fillStyle = color; x.fill(new Path2D(CLAUDE_D)); x.restore();
}

// ---------------------------------------------------------------- Papier
export function canvas(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: false }); fn && fn(x, w, h); return c;
}
export const INK = '#1b1a1e', RED = '#e5391f', PAPER = '#efe8d8';
// Zeilenumbruch fuer Fliesstext auf Papier.
export function wrap(x, text, maxW) {
  const out = [];
  for (const par of text.split('\n')) {
    let line = '';
    for (const w of par.split(' ')) {
      const n = line ? line + ' ' + w : w;
      if (x.measureText(n).width > maxW && line) { out.push(line); line = w; } else line = n;
    }
    out.push(line);
  }
  return out;
}
// Altpapier: leichte Flecken, damit kein Blatt digital wirkt.
export function paperGround(x, w, h, c = PAPER, seed = 1) {
  x.fillStyle = c; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) {
    const a = hash(seed + i * 1.3), b = hash(seed + i * 2.7), r = 20 + hash(seed + i * 4.1) * 120;
    x.fillStyle = `rgba(${90 + 40 * hash(i)},${70 + 30 * hash(i + 3)},40,${.006 + .012 * hash(seed + i * 5.1)})`;
    x.beginPath(); x.arc(a * w, b * h, r, 0, TAU); x.fill();
  }
}

// ---------------------------------------------------------------- Leuchtschrift
// Buchstaben als Linien in einem Kasten von .72 x 1: wie gebogene Glasroehren.
const arc = (cx, cy, rx, ry, a0, a1, n = 10) => { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p; };
export const STROKES = {
  V: [[[0, 1], [.36, 0], [.72, 1]]],
  A: [[[0, 0], [.36, 1], [.72, 0]], [[.13, .36], [.59, .36]]],
  B: [[[.04, 0], [.04, 1], [.42, 1], ...arc(.42, .76, .22, .24, PI / 2, -PI / 2, 8), [.04, .52]], [[.42, .52], ...arc(.44, .26, .26, .26, PI / 2, -PI / 2, 8), [.04, 0]]],
  C: [arc(.42, .5, .4, .5, .85, TAU - .85, 16)],
  D: [[[.04, 0], [.04, 1], [.28, 1], ...arc(.28, .5, .42, .5, PI / 2, -PI / 2, 14), [.04, 0]]],
  E: [[[.64, 1], [.04, 1], [.04, 0], [.64, 0]], [[.04, .52], [.54, .52]]],
  F: [[[.64, 1], [.04, 1], [.04, 0]], [[.04, .52], [.52, .52]]],
  G: [[...arc(.42, .5, .4, .5, .85, TAU - .2, 16), [.82, .42], [.5, .42]].map(p => [p[0] * .88, p[1]])],
  H: [[[.04, 0], [.04, 1]], [[.68, 0], [.68, 1]], [[.04, .52], [.68, .52]]],
  I: [[[.12, 0], [.12, 1]]],
  K: [[[.04, 0], [.04, 1]], [[.64, 1], [.04, .42]], [[.24, .6], [.68, 0]]],
  L: [[[.04, 1], [.04, 0], [.6, 0]]],
  M: [[[.04, 0], [.04, 1], [.42, .3], [.8, 1], [.8, 0]]],
  N: [[[.04, 0], [.04, 1], [.68, 0], [.68, 1]]],
  O: [arc(.4, .5, .36, .5, 0, TAU, 20)],
  P: [[[.04, 0], [.04, 1], [.4, 1], ...arc(.4, .72, .24, .28, PI / 2, -PI / 2, 8), [.04, .44]]],
  R: [[[.04, 0], [.04, 1], [.4, 1], ...arc(.4, .72, .24, .28, PI / 2, -PI / 2, 8), [.04, .44]], [[.34, .44], [.68, 0]]],
  S: [[...arc(.34, .74, .28, .26, .3, PI + PI / 2, 10), ...arc(.34, .26, .3, .26, PI / 2, -PI + -.3, 10)]],
  T: [[[0, 1], [.72, 1]], [[.36, 1], [.36, 0]]],
  U: [[[.04, 1], [.04, .36], ...arc(.36, .34, .32, .34, PI, TAU, 10), [.68, 1]]],
  X: [[[.02, 0], [.68, 1]], [[.02, 1], [.68, 0]]],
  Ä: [[[0, 0], [.36, 1], [.72, 0]], [[.13, .36], [.59, .36]], [[.24, 1.2], [.24, 1.28]], [[.48, 1.2], [.48, 1.28]]],
  8: [arc(.36, .75, .25, .25, -PI / 2, PI * 1.5, 12), arc(.36, .25, .3, .25, PI / 2, PI * 2.5, 12)],
};
export const LETTER_W = { I: .24, M: .84, ' ': .4 };
const lw = ch => LETTER_W[ch] === undefined ? .72 : LETTER_W[ch];
const KERN = { VI: -.04, FA: -.24, TR: -.05, RA: -.04, AU: -.03, AB: -.02, 'ÄU': -.03, 'RÄ': -.04 };
const kern = (s, i) => KERN[s[i] + s[i + 1]] || 0;
export function textWidth(s, h, gap = .22) { let w = 0; for (let i = 0; i < s.length; i++) w += (lw(s[i]) + gap + kern(s, i)) * h; return w - gap * h; }
// Baut einen Schriftzug aus Roehren in g; Ursprung links unten, liegt in XY. Liefert nichts, zeichnet nur.
export function neonText(g, s, x, y, h, r = .02, gap = .22) {
  let cx = x;
  for (let ci = 0; ci < s.length; ci++) {
    const c = s[ci], st = STROKES[c];
    if (st) for (const line of st) {
      const pts = [];
      for (let i = 0; i < line.length; i++) {
        const p = line[i], q = [cx + p[0] * h, y + p[1] * h, 0];
        if (i) { const a = line[i - 1], ax = cx + a[0] * h, ay = y + a[1] * h, n = 2; for (let k = 1; k < n; k++) pts.push([ax + (q[0] - ax) * k / n, ay + (q[1] - ay) * k / n, 0]); }
        pts.push(q);
      }
      if (pts.length > 1) g.tube(pts, r, 6);
    }
    cx += (lw(c) + gap + kern(s, ci)) * h;
  }
}

// ---------------------------------------------------------------- Weiche Flecken (Dampf, Dunst, Lichthof)
export function softDoc(E) {
  return E.addDoc(canvas(256, 256, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.55)'); g.addColorStop(.7, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }));
}

export { Geo, MAT, M, PI, TAU, clamp, smooth, hash, lin };
