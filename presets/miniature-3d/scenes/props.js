// Moebel und Dinge. Alles, was im Haus steht, wird hier in Zahlen beschrieben.
import { TAU, PI, hash, hash2, lin, mix, clamp, smooth } from './m.js';
import { MAT } from './geo.js';

// Eine glatte Linie durch wenige Punkte. Fuer Profile, Buegel, Kabel.
export function smoothPts(P, k = 5) {
  const out = [], n = P.length, d = P[0].length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = P[Math.max(i - 1, 0)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(i + 2, n - 1)];
    for (let j = 0; j < k; j++) {
      const u = j / k, q = [];
      for (let c = 0; c < d; c++) q.push(.5 * (2 * p1[c] + (p2[c] - p0[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u * u + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * u * u * u));
      out.push(q);
    }
  }
  out.push(P[n - 1].slice());
  return out;
}
// Wertrauschen in JavaScript: fuer zerknuelltes Papier und gewachsene Formen.
const vn = (x, y, z) => {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), f = t => t * t * (3 - 2 * t), u = f(x - i), v = f(y - j), w = f(z - k);
  const h = (a, b, c) => hash(a * 12.9898 + b * 78.233 + c * 37.719);
  const m = (a, b, t) => a + (b - a) * t;
  return m(m(m(h(i, j, k), h(i + 1, j, k), u), m(h(i, j + 1, k), h(i + 1, j + 1, k), u), v), m(m(h(i, j, k + 1), h(i + 1, j, k + 1), u), m(h(i, j + 1, k + 1), h(i + 1, j + 1, k + 1), u), v), w);
};
// Was mehrere Raeume teilen. Wird einmal gesetzt, bevor die Moebel entstehen.
const DOCS = { spines: 0, crema: 0, cane: 0 };
export function setPropDocs(d) { Object.assign(DOCS, d); }

const WOOD = g => g.s({ mat: MAT.wood, r: .42, m: 0 });

// ---------------------------------------------------------------- Raum
// R = {x0,x1,y0,y1,z0,z1}. Die Vorderseite (z1) bleibt offen: Wir schauen in einen Schnitt durchs Haus.
export function roomShell(g, R, o) {
  const { x0, x1, y0, y1, z0, z1 } = R, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, H = y1 - y0, D = z1 - z0;
  // Boden
  g.with({ c: o.floorC || '#6d4526', mat: o.floorM !== undefined ? o.floorM : MAT.parquet, r: o.floorR === undefined ? .3 : o.floorR, m: 0, grain: 0, flag: 32 | (o.floorCoat ? 64 : 0) }, () => {
    g.rect([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], [0, 1, 0]);
  });
  // Decke
  g.with({ c: o.ceilC || '#e6dcc8', mat: MAT.plaster, r: .9, flag: 32 }, () => {
    g.rect([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, -1, 0]);
  });
  // Waende
  const wallS = { c: o.wallC, mat: o.wallM !== undefined ? o.wallM : MAT.plaster, r: o.wallR === undefined ? .78 : o.wallR, flag: 32 };
  if (!o.noWalls) g.with(wallS, () => {
    if (!o.noBack) g.rect([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, 1]);
    g.rect([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [1, 0, 0]);
    g.rect([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [-1, 0, 0]);
  });
}

// Holzvertaefelung mit Rahmen: ein ganzer Raum wird davon erwachsen.
export function wainscot(g, x0, x1, y, h, z, n, o = {}) {
  const w = x1 - x0, pw = w / n;
  g.with({ c: o.c || '#3a2415', mat: MAT.wood, r: .34, grain: 1 }, () => {
    g.with({ flag: 32 }, () => g.at([(x0 + x1) / 2, y + h / 2, z + .012], () => g.box(w, h, .024, 1 | 4 | 16 | 32)));
    g.at([(x0 + x1) / 2, y + h + .022, z + .03], () => g.s({ grain: 0 }).rbox(w, .05, .06, .012));
    g.s({ grain: 0 });
    g.at([(x0 + x1) / 2, y + .08, z + .03], () => g.rbox(w, .16, .05, .01));
    g.s({ grain: 1 });
    for (let i = 0; i < n; i++) {
      const cx = x0 + pw * (i + .5);
      g.at([cx, y + h / 2 + .03, z + .03], () => {
        const pw2 = pw - .14, ph = h - .3;
        g.at([0, ph / 2, 0], () => g.rbox(pw2 + .05, .026, .02, .006));
        g.at([0, -ph / 2, 0], () => g.rbox(pw2 + .05, .026, .02, .006));
        g.at([-pw2 / 2, 0, 0], () => g.rbox(.026, ph, .02, .006));
        g.at([pw2 / 2, 0, 0], () => g.rbox(.026, ph, .02, .006));
      });
    }
  });
}

// Fenster in der Rueckwand: Rahmen, Sprossen, Glas. Dahinter steht der Nachthimmel.
export function windowFrame(g, x, y, w, h, z, o = {}) {
  const t = o.t || .05, d = .09, nx = o.nx || 2, ny = o.ny || 3;
  g.with({ c: o.c || '#d9d0bd', mat: MAT.plain, r: .5 }, () => {
    g.at([x, y + h / 2, z], () => g.rbox(t, 0.001 + h, d, .006)); // Mitte unten
    g.at([x - w / 2, y + h / 2, z], () => g.rbox(t * 1.6, h + t * 2, d * 1.3, .01));
    g.at([x + w / 2, y + h / 2, z], () => g.rbox(t * 1.6, h + t * 2, d * 1.3, .01));
    g.at([x, y, z], () => g.rbox(w + t * 3, t * 1.6, d * 1.5, .01));
    g.at([x, y + h, z], () => g.rbox(w + t * 3, t * 1.6, d * 1.3, .01));
    for (let i = 1; i < nx; i++) if (i * 2 !== nx) g.at([x - w / 2 + w * i / nx, y + h / 2, z], () => g.rbox(t * .6, h, d * .7, .004));
    for (let j = 1; j < ny; j++) g.at([x, y + h * j / ny, z], () => g.rbox(w, t * .6, d * .7, .004));
  });
  g.with({ c: '#9fb8c8', mat: MAT.glass, r: .05, m: 0 }, () => g.at([x, y + h / 2, z - .01], () => g.card(w, h)));
}

// Eine Wand mit Loechern. win = [{x, y, w, h}] in Weltkoordinaten.
export function wallWithHoles(g, x0, x1, y0, y1, z, win) {
  const oldFlag = g.st.flag; g.st.flag = oldFlag | 32;
  const xs = [x0, ...win.flatMap(w => [w.x - w.w / 2, w.x + w.w / 2]), x1];
  for (let i = 0; i + 1 < xs.length; i += 2) g.rect([xs[i], y0, z], [xs[i + 1], y0, z], [xs[i + 1], y1, z], [xs[i], y1, z], [0, 0, 1]);
  for (const w of win) {
    g.rect([w.x - w.w / 2, y0, z], [w.x + w.w / 2, y0, z], [w.x + w.w / 2, w.y, z], [w.x - w.w / 2, w.y, z], [0, 0, 1]);
    g.rect([w.x - w.w / 2, w.y + w.h, z], [w.x + w.w / 2, w.y + w.h, z], [w.x + w.w / 2, y1, z], [w.x - w.w / 2, y1, z], [0, 0, 1]);
    // Laibung
    const dz = -.26;
    g.rect([w.x - w.w / 2, w.y, z + dz], [w.x - w.w / 2, w.y, z], [w.x - w.w / 2, w.y + w.h, z], [w.x - w.w / 2, w.y + w.h, z + dz], [1, 0, 0]);
    g.rect([w.x + w.w / 2, w.y, z], [w.x + w.w / 2, w.y, z + dz], [w.x + w.w / 2, w.y + w.h, z + dz], [w.x + w.w / 2, w.y + w.h, z], [-1, 0, 0]);
    g.rect([w.x - w.w / 2, w.y, z + dz], [w.x + w.w / 2, w.y, z + dz], [w.x + w.w / 2, w.y, z], [w.x - w.w / 2, w.y, z], [0, 1, 0]);
    g.rect([w.x - w.w / 2, w.y + w.h, z], [w.x + w.w / 2, w.y + w.h, z], [w.x + w.w / 2, w.y + w.h, z + dz], [w.x - w.w / 2, w.y + w.h, z + dz], [0, -1, 0]);
  }
  g.st.flag = oldFlag;
}

// ---------------------------------------------------------------- Moebel
export function desk(g, x, y, z, w = 1.9, d = .95, o = {}) {
  const h = .76, top = .032, c = o.c || '#55331c';
  g.at([x, y, z], () => {
    // Die Platte: Bretter, geschliffen, lackiert.
    g.with({ c, mat: MAT.wood, r: .3, grain: 0, flag: 64 | 128 }, () => g.at([0, h - top / 2, 0], () => g.rbox(w, top, d, .0065, 3)));
    g.with({ c, mat: MAT.wood, r: .3, grain: 0, flag: 64 }, () => {
      // Profilleiste unter der Platte
      g.at([0, h - top - .008, 0], () => g.rbox(w - .028, .017, d - .028, .0075, 2));
      g.at([0, h - top - .02, 0], () => g.rbox(w - .052, .012, d - .052, .004, 1));
      // Zarge mit Mittelschublade
      g.at([0, h - top - .066, 0], () => g.rbox(w - .08, .082, d - .08, .003, 1));
      g.at([0, h - top - .066, (d - .08) / 2 + .004], () => g.rbox(w - 1.26, .062, .009, .003, 1));
      for (const sx of [-1, 1]) g.at([sx * (w / 2 - .3), 0, 0], () => {
        const bw = .54, y0 = .07, y1 = h - top - .108, bh = y1 - y0, bd = d - .12;
        // Sockel und Korpus
        g.at([0, .035, 0], () => g.rbox(bw + .03, .07, bd + .03, .006, 2));
        g.at([0, y0 + bh / 2, 0], () => g.rbox(bw, bh, bd, .005, 2));
        // Drei Schubladen: jede Front steht ein wenig vor, mit Fuge.
        const fh = (bh - .05) / 3;
        for (let k = 0; k < 3; k++) {
          const fy = y0 + .025 + fh * (k + .5);
          g.at([0, fy, bd / 2 + .005], () => {
            g.rbox(bw - .05, fh - .012, .012, .0035, 2);
            g.with({ c: '#b48d45', mat: MAT.brushed, m: 1, r: .28, flag: 0 }, () => {
              g.at([0, .012, .009], () => g.rbox(.082, .018, .003, .0014, 1));
              for (const px of [-.03, .03]) g.at([px, .012, .012], () => g.sphere(.0038, 8, 6));
              g.at([0, .012, .012], [PI / 2, 0, 0], () => g.at([0, 0, 0], [0, 0, 0], () => { const pts = []; for (let i = 0; i <= 16; i++) { const a = i / 16 * PI; pts.push([Math.cos(a) * .03, Math.sin(a) * .006, Math.sin(a) * .026]); } g.tube(pts, .0024, 7); }));
            });
          });
        }
      });
    });
  });
}

export function bankerLamp(g, x, y, z, ry = 0) {
  const SH = .34, LEN = .36, RY = .07, RZ = .082;
  g.at([x, y, z], [0, ry, 0], () => {
    g.with({ c: '#b58f43', mat: MAT.brushed, m: 1, r: .27, grain: 0, flag: 64 }, () => {
      // Fuss: gedrechselt, mit Stufe
      g.lathe(smoothPts([[0, 0], [.102, 0], [.106, .003], [.104, .011], [.092, .017], [.062, .023], [.034, .031], [.021, .045], [.0145, .065], [.0125, .09]], 3).concat([[.0125, .262], [.0165, .266], [.0165, .278], [.011, .284]]), 56, 0, TAU, .9);
      // Querstange und zwei Halter zum Schirm
      g.at([0, .284, 0], [0, 0, PI / 2], () => g.cyl(.0075, .24, 12));
      for (const s of [-1, 1]) {
        g.at([s * .12, .284, 0], () => g.sphere(.0105, 12, 8));
        g.tube(smoothPts([[s * .12, .284, 0], [s * .125, .305, -.004], [s * .13, SH - .004, -.008]], 4), .0042, 8);
      }
    });
    // Zugkette mit Kugel
    g.with({ c: '#c29c50', mat: MAT.brushed, m: 1, r: .25 }, () => {
      for (let i = 0; i < 12; i++) g.at([.06, SH - .045 - i * .0062, .058], () => g.sphere(.0021, 6, 4));
      g.at([.06, SH - .045 - 12 * .0062 - .004, .058], () => g.sphere(.0058, 10, 8));
    });
    const shade = k => (u, v) => { const a = mix(-.26, PI + .26, u); return [(v - .5) * LEN, SH + Math.sin(a) * RY * k, Math.cos(a) * RZ * k]; };
    const cap = sx => (u, v) => { const a = mix(-.26, PI + .26, u); return [sx * LEN / 2, SH + Math.sin(a) * RY * v, Math.cos(a) * RZ * v]; };
    // Gruenes Glas: dick, glatt, leuchtet von innen ein wenig durch.
    g.with({ c: '#07402b', mat: MAT.plain, r: .1, e: .16, flag: 64 }, () => {
      g.surf(shade(1), 40, 3);
      for (const sx of [-1, 1]) g.surf(cap(sx), 24, 3);
    });
    // Innen: weisses Opalglas.
    g.with({ c: '#efe7d2', mat: MAT.plain, r: .5, e: 1.7 }, () => g.surf(shade(.965), 28, 2));
    // Messingraender
    g.with({ c: '#b58f43', mat: MAT.brushed, m: 1, r: .27 }, () => {
      for (const sx of [-1, 1]) { const pts = []; for (let i = 0; i <= 28; i++) { const a = mix(-.26, PI + .26, i / 28); pts.push([sx * LEN / 2, SH + Math.sin(a) * RY, Math.cos(a) * RZ]); } g.tube(pts, .0026, 6); }
      for (const z of [-1, 1]) { const a = z > 0 ? -.26 : PI + .26; g.tube([[-LEN / 2, SH + Math.sin(a) * RY, Math.cos(a) * RZ], [LEN / 2, SH + Math.sin(a) * RY, Math.cos(a) * RZ]], .0022, 6); }
    });
    // Birne
    g.with({ c: '#ffd9a0', e: 26, r: .9 }, () => g.at([0, SH - .012, 0], () => g.sphere(.026, 14, 10)));
    g.with({ c: '#ffd9a0', e: 26, r: .9 }, () => g.at([-.09, SH - .012, 0], () => g.sphere(.02, 12, 8)));
    g.with({ c: '#ffd9a0', e: 26, r: .9 }, () => g.at([.09, SH - .012, 0], () => g.sphere(.02, 12, 8)));
  });
}

// Ein Teeloeffel, der Ursprung liegt an der Spitze, er zeigt nach +x.
export function spoon(g) {
  const L = .124;
  const fn = (s, v) => {
    s = clamp(s, 0, 1);
    const l = Math.cos(v * TAU), t0 = s / .3, bowl = s < .3 ? Math.pow(Math.max(Math.sin(PI * Math.pow(t0, .82)), 0), .7) : 0;
    const handle = mix(.0024, .0064, smooth(.3, .93, s)) * Math.sqrt(Math.max(1 - Math.pow(smooth(.95, 1, s), 2), 0)) * smooth(.26, .32, s);
    const w = Math.max(.0158 * bowl, handle);
    const th = mix(.0008, .0012, smooth(.25, .4, s)) * Math.sqrt(Math.max(1 - Math.pow(smooth(.96, 1, s), 2), 0));
    const bk = bowl > 0 ? bowl : 0;
    const y = .0004 * smooth(.27, .69, s) + .0022 * smooth(.69, 1, s) - .0008 * Math.sin(smooth(.24, .42, s) * PI);
    return [s * L, y + th * Math.sin(v * TAU) + .0074 * bk * (l * l - 1), w * l];
  };
  g.surf(fn, 220, 28);
}
// Lage von Tasse und Loeffel fuer den Shader (relativ zum Fuss der Untertasse).
export const HERO = { a: [0, 0, 0], b: [0, 0, 0] };
// Kubische B-Spline: Sie laeuft durch den ersten und letzten Punkt und bleibt zweimal stetig, darum knicken Spiegelungen nicht.
function bspline(C, u) {
  const P = [C[0], C[0], ...C, C[C.length - 1], C[C.length - 1]], seg = P.length - 3;
  const t = clamp(u, 0, 1) * seg, i = Math.min(Math.floor(t), seg - 1), f = t - i, f2 = f * f, f3 = f2 * f;
  const b0 = (1 - 3 * f + 3 * f2 - f3) / 6, b1 = (3 * f3 - 6 * f2 + 4) / 6, b2 = (-3 * f3 + 3 * f2 + 3 * f + 1) / 6, b3 = f3 / 6;
  return [0, 1].map(k => P[i][k] * b0 + P[i + 1][k] * b1 + P[i + 2][k] * b2 + P[i + 3][k] * b3);
}
export function coffee(g, x, y, z, ry = 0) {
  const GL = { c: '#efe5d0', mat: MAT.glaze, r: .34, flag: 64 }, SC = { c: '#efe5d0', mat: MAT.saucer, r: .34, flag: 64 };
  // Aussenwand der Tasse, Hoehe von ihrem Fuss gemessen.
  const WALL = [[.0254, .0006], [.0262, .0024], [.0272, .0058], [.0296, .0135], [.0329, .0255], [.0364, .0405], [.0398, .0565], [.0424, .0695], [.0434, .0745]];
  const FLOOR = .0066;
  const wallR = yy => {
    const W = WALL; if (yy <= W[0][1]) return W[0][0]; if (yy >= W[W.length - 1][1]) return W[W.length - 1][0];
    for (let i = 0; i < W.length - 1; i++) if (yy <= W[i + 1][1]) return mix(W[i][0], W[i + 1][0], (yy - W[i][1]) / (W[i + 1][1] - W[i][1]));
    return W[0][0];
  };
  g.at([x, y, z], [0, ry, 0], () => {
    // Untertasse: Fussring, breite Fahne, runder Rand, in der Mitte der Spiegel mit seinem Absatz.
    g.with(SC, () => g.lathe(smoothPts([[0, .0032], [.0345, .0032], [.0356, .0012], [.0372, 0], [.0402, 0], [.0416, .0012], [.0432, .0034], [.055, .0072], [.068, .0122], [.0762, .0156], [.079, .017], [.0802, .0186], [.08, .02], [.0788, .0208], [.077, .0205], [.068, .0174], [.055, .0124], [.0445, .0094], [.0405, .0087], [.0385, .0079], [.0362, .007], [.033, .0067], [.018, .0066], [0, .0065]], 7), 256, 0, TAU, 1.4));
    g.at([0, FLOOR, 0], () => {
      g.with(GL, () => {
        g.lathe(smoothPts([[0, .003], [.0192, .003], [.0212, .0012], [.0228, .0002], [.0244, 0], ...WALL, [.04345, .0757], [.0431, .0766], [.0424, .077], [.0416, .0766], [.0411, .0755], [.0402, .071], [.0384, .0635], [.035, .05], [.03, .03], [.024, .016], [.018, .0105], [0, .009]], 7), 256, 0, TAU, 1.4);
        // Der Henkel ist gegossen: Er waechst aus der Wand, wird in der Mitte schlank und laeuft unten wieder in sie hinein.
        const C = [[.0345, .0612], [.0415, .0655], [.05, .0682], [.0588, .0662], [.0648, .0588], [.0655, .0495], [.06, .0408], [.0515, .0335], [.0425, .0275], [.0345, .0228], [.0288, .02]];
        const fn = (u, v) => {
          u = clamp(u, 0, 1);
          const c = bspline(C, u), c0 = bspline(C, u - .002), c1 = bspline(C, u + .002);
          let tx = c1[0] - c0[0], ty = c1[1] - c0[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
          const fl = Math.pow(1 - smooth(0, .24, u), 2) + Math.pow(smooth(.76, 1, u), 2);
          const a = mix(.0041, .0098, fl), b = mix(.0058, .0118, fl), th = v * TAU, ca = Math.cos(th), sa = Math.sin(th);
          const Px = c[0] - ty * a * ca, Py = c[1] + tx * a * ca, Pz = b * sa;
          // Beide Enden liegen zuletzt ganz auf der Wand: So entsteht eine Hohlkehle statt einer Kante.
          const w = Math.max(1 - smooth(0, .15, u), smooth(.85, 1, u)), r = Math.hypot(Px, Pz) || 1, R = wallR(Py) - .0002;
          return [mix(Px, Px / r * R, w), Py, mix(Pz, Pz / r * R, w)];
        };
        g.surf(fn, 180, 56);
      });
      // Kaffee: die Oberflaeche steigt am Rand ein wenig an die Wand.
      const CR = .0409, CY = .0726;
      g.with({ c: '#ffffff', tex: DOCS.crema, mat: MAT.plain, r: .2, flag: 64 }, () => g.surf((u, v) => {
        const r = clamp(u) * CR, a = v * TAU, yy = CY + .0012 * Math.pow(clamp(u), 22);
        return [Math.sin(a) * r, yy, Math.cos(a) * r];
      }, 48, 96, (u, v) => { const a = v * TAU; return [.5 + .5 * u * Math.sin(a), .5 + .5 * u * Math.cos(a)]; }));
    });
    // Teeloeffel: Laffe vor der Tasse auf der Fahne, der Stiel liegt auf dem Rand und ragt darueber hinaus.
    const SX = .0035, SZ = .0605, SR = .19, SY = .0222, ROLL = .2;
    g.with({ c: '#dcd9d2', mat: MAT.steel, m: 1, r: .09 }, () => g.at([SX, SY, SZ], [0, SR, 0], () => g.at([0, 0, 0], [ROLL, 0, 0], () => spoon(g))));
    const cg = Math.cos(ry), sg = Math.sin(ry), rot = (px, py, pz) => [px * cg + pz * sg, py, -px * sg + pz * cg];
    const dirx = Math.cos(SR), dirz = -Math.sin(SR);
    HERO.a = rot(SX + dirx * .021, SY - .003, SZ + dirz * .021);
    HERO.b = rot(SX + dirx * .128, SY + .008, SZ + dirz * .128);
  });
}
export const SPINE_COLS = 16, SPINE_ROWS = 2;
const BANDS = [.13, .29, .45, .61, .77, .9];
export function book(g, x, y, z, w, h, d, c, o = {}) {
  const hi = !!o.hi, cell = o.cell === undefined ? 0 : o.cell, t = Math.min(.0026, w * .12), sq = .0026;
  const bulge = Math.min(.0078, w * .17), back = d / 2 - bulge;
  const cx = (cell % SPINE_COLS) / SPINE_COLS, cy = Math.floor(cell / SPINE_COLS) % SPINE_ROWS / SPINE_ROWS;
  const hasB = cell % 3 !== 2;
  g.at([x, y + h / 2, z], o.rot || [0, 0, 0], () => {
    const R = o.mat !== undefined ? o.mat : MAT.leather;
    g.with({ c, mat: R, r: o.gloss || .4, grain: 0, flag: 0 }, () => {
      // Deckel
      for (const s of [-1, 1]) g.at([s * (w / 2 - t / 2), 0, -bulge / 2], () => hi ? g.rbox(t, h, d - bulge, .0011, 1) : g.box(t, h, d - bulge));
      // Ruecken: gewoelbt. Die Stege stehen auf dem Leder.
      const fn = (u, v) => {
        const a = (u - .5) * 2.55, sx = Math.sin(a) / Math.sin(1.275);
        let b = 0;
        if (hi && hasB) for (const k of BANDS) b += Math.exp(-Math.pow((v - k) / .0135, 2));
        return [sx * (w / 2 + b * .0006), (v - .5) * h, back + (Math.cos(a) - Math.cos(1.275)) / (1 - Math.cos(1.275)) * bulge + b * .0014];
      };
      g.with({ tex: DOCS.spines }, () => g.surf(fn, hi ? 12 : 4, hi ? 96 : 1, (u, v) => [cx + (.02 + .96 * u) / SPINE_COLS, cy + (1 - v) / SPINE_ROWS]));
    });
    // Buchblock
    g.with({ c: '#d9cfb6', mat: MAT.pages, r: .9, grain: o.pagesAxis || 0, flag: 0 }, () => g.at([0, 0, -bulge / 2 - .0012], () => g.box(w - 2 * t - .0004, h - 2 * sq, d - bulge - .0026, 63)));
    // Oben sieht man in den Ruecken hinein: dunkel. Davor das Kapitalband.
    g.with({ c: '#120d09', r: .9, mat: MAT.plain }, () => { for (const s of [-1, 1]) g.at([0, s * (h / 2 - sq), back + bulge * .4], () => g.box(w - 2 * t, .0008, bulge * 1.3 + .001, 4 | 8)); });
    if (hi) g.with({ c: hash(cell * 3.3) < .5 ? '#8a2a20' : '#c7b07a', r: .7, mat: MAT.fabric }, () => { for (const s of [-1, 1]) g.at([0, s * (h / 2 - sq + .0006), back + .0003], [0, 0, PI / 2], () => g.cyl(.0012, w - 2 * t - .001, 6)); });
  });
}
const PAL = ['#3e1715', '#5a2219', '#1b312b', '#1d2840', '#4a341a', '#231f1c', '#6a5430', '#2f1c2b', '#18242f', '#7f6e4e', '#a39470', '#30241a'];
// Eine Reihe Buecher: Baende gehoeren zusammen, es gibt Luecken, manches lehnt, manches liegt.
export function bookRow(g, x0, x1, y, z, seed, maxH = .34, palette = PAL, o = {}) {
  palette = palette || PAL;
  let x = x0, i = 0, setLeft = 0, sc = 0, sw = 0, sh = 0, leanNext = 0;
  const H = n => hash(seed + i * n);
  const room = x1 - x0, flatW = room > .5 && hash(seed * 3.3) < .55 ? Math.min(.34, maxH * 1.05) : 0;
  const xEnd = x1 - flatW - (flatW ? .015 : 0);
  while (x < xEnd - .016) {
    if (setLeft <= 0) {
      setLeft = H(2.3) < .24 ? 3 + Math.floor(H(4.7) * 4) : 1;
      sc = palette[Math.floor(H(17.1) * palette.length)];
      sw = .018 + Math.pow(H(3.1), 1.6) * .04;
      sh = maxH * (.68 + .32 * H(5.7));
    }
    setLeft--;
    const w = sw * (.96 + .08 * H(6.1)), h = sh * (.992 + .008 * H(7.2)), d = Math.min(.235, h * .74) * (.92 + .1 * H(7.9));
    if (x + w > xEnd) break;
    if (H(11.3) < .05 && setLeft === 0 && x > x0 + .05) { const gap = .012 + H(12.7) * .03; x += gap; leanNext = Math.atan(gap / h) * .92; }
    const lean = leanNext; leanNext = 0;
    const zo = (H(13.7) - .5) * .014;
    const cell = Math.floor(H(19.3) * SPINE_COLS * SPINE_ROWS);
    const dx = Math.sin(lean) * h / 2;
    book(g, x + w / 2 + dx - (lean ? .002 : 0), y - (1 - Math.cos(lean)) * h / 2, z + zo, w, h, d, sc, { rot: [0, 0, lean], cell, hi: o.hi, mat: H(23.1) < .32 ? MAT.fabric : MAT.leather, gloss: H(29.3) < .32 ? .86 : .38 });
    x += w + .0007 + (lean ? Math.sin(lean) * h * .15 : 0); i++;
  }
  // Am Ende liegen zwei, drei Baende flach.
  if (flatW && xEnd < x1 - .1) {
    let yy = y; const n = 2 + Math.floor(hash(seed * 5.9) * 2);
    for (let k = 0; k < n; k++) {
      const t = .022 + hash(seed + k * 9.1) * .022, hh = flatW * (.96 - k * .06), dd = Math.min(.21, hh * .72);
      const cell = Math.floor(hash(seed + k * 31.7) * SPINE_COLS * SPINE_ROWS);
      if (yy + t > y + maxH * 1.02) break;
      book(g, x1 - flatW / 2 - .004 + (hash(seed + k * 3.7) - .5) * .01, yy + t / 2 - hh / 2, z + (hash(seed + k * 4.3) - .5) * .012, t, hh, dd, palette[Math.floor(hash(seed + k * 37.1) * palette.length)], { rot: [0, (hash(seed + k * 6.1) - .5) * .05, PI / 2], cell, pagesAxis: 1, hi: o.hi });
      yy += t;
    }
  }
}
export function shelf(g, x, y, z, w, h, n, seed, o = {}) {
  const d = .3, t = .03;
  g.with({ c: o.c || '#3f2715', mat: MAT.wood, r: .34, grain: 1 }, () => {
    g.at([x, y + h / 2, z - d / 2 + .01], () => g.box(w, h, .02));
    g.at([x - w / 2, y + h / 2, z], () => g.rbox(t, h, d, .006));
    g.at([x + w / 2, y + h / 2, z], () => g.rbox(t, h, d, .006));
    g.s({ grain: 0 });
    for (let i = 0; i <= n; i++) g.at([x, y + i * (h - t) / n + t / 2, z], () => g.rbox(w, t, d, .006));
    // Sockel und Kranz: Ein Regal steht auf dem Boden und hoert oben richtig auf.
    g.at([x, y + .05, z + .004], () => g.rbox(w + .05, .1, d + .03, .006));
    g.at([x, y + h + .012, z + .006], () => g.rbox(w + .07, .024, d + .05, .009));
    g.at([x, y + h + .034, z + .004], () => g.rbox(w + .04, .02, d + .03, .006));
  });
  const sh = (h - t) / n;
  for (let i = 0; i < n; i++) bookRow(g, x - w / 2 + .024, x + w / 2 - .024, y + i * sh + t, z + .012, seed + i * 19.7, sh * .84, o.palette);
}
export function pendant(g, x, y, z, drop, c = '#1b1b1b', glow = '#ffcf8a') {
  g.at([x, y, z], () => {
    g.with({ c: '#141414', r: .5 }, () => { g.at([0, -drop / 2, 0], () => g.cyl(.006, drop, 8)); g.at([0, -.015, 0], () => g.cyl(.03, .03, 16)); });
    g.at([0, -drop, 0], () => {
      g.with({ c, r: .35, mat: MAT.plain }, () => g.lathe([[.17, -.14], [.175, -.145], [.15, -.08], [.06, -.01], [.025, .0], [.025, .03], [.0, .03]], 40));
      g.with({ c: '#d8ceb8', r: .6 }, () => g.lathe([[.165, -.138], [.145, -.078], [.055, -.012]], 40));
      g.with({ c: glow, e: 40, r: .9 }, () => g.at([0, -.06, 0], () => g.sphere(.04, 14, 10)));
    });
  });
}
export function radiator(g, x, y, z, n = 14) {
  g.with({ c: '#b8ae98', r: .5, mat: MAT.plain }, () => {
    for (let i = 0; i < n; i++) g.at([x + (i - (n - 1) / 2) * .05, y + .3, z], () => g.rbox(.036, .52, .09, .012));
    g.at([x, y + .1, z], [0, 0, PI / 2], () => g.cyl(.012, n * .05, 8));
    g.at([x, y + .5, z], [0, 0, PI / 2], () => g.cyl(.012, n * .05, 8));
    for (const sx of [-1, 1]) g.at([x + sx * (n * .025 - .03), y + .03, z], () => g.rbox(.02, .06, .05, .006));
  });
}
export function rug(g, x, y, z, w, d, c1, c2) {
  g.with({ c: c1, mat: MAT.rug, r: .98 }, () => g.at([x, y + .006, z], () => g.rbox(w, .012, d, .004)));
  g.with({ c: c2, mat: MAT.rug, r: .98 }, () => {
    const b = .09, t = .05;
    for (const s of [-1, 1]) {
      g.at([x, y + .0125, z + s * (d / 2 - b)], () => g.box(w - b * 2 + t, .001, t, 4));
      g.at([x + s * (w / 2 - b), y + .0125, z], () => g.box(t, .001, d - b * 2, 4));
    }
  });
  g.with({ c: '#d8ccb0', mat: MAT.rug, r: 1 }, () => {
    for (const s of [-1, 1]) for (let i = 0; i < 40; i++) g.at([x + s * (w / 2 + .012), y + .003, z - d / 2 + (i + .5) * d / 40], () => g.box(.026, .002, .006, 4));
  });
}
// Ein Bugholzstuhl: Hinterbeine und Lehne sind ein einziger gebogener Stab.
export function chair(g, x, y, z, ry = 0, c = '#24160d') {
  const SY = .455, SR = .205;
  g.at([x, y, z], [0, ry, 0], () => {
    g.with({ c, mat: MAT.wood, r: .3, grain: 1, flag: 64 }, () => {
      const half = [[.158, 0, -.255], [.146, .22, -.215], [.13, SY, -.172], [.127, .6, -.197], [.118, .735, -.228], [.086, .845, -.248], [.036, .895, -.258], [0, .904, -.26]];
      const mir = a => a.map(p => [-p[0], p[1], p[2]]);
      const outer = smoothPts([...half, ...mir(half).reverse().slice(1)], 7);
      const rad = outer.map((p) => { const yy = p[1]; return yy < SY ? mix(.0108, .0148, yy / SY) : mix(.0148, .0108, Math.min((yy - SY) / .45, 1)); });
      g.tube(outer, rad, 12);
      const halfI = [[.072, SY + .006, -.198], [.073, .6, -.214], [.062, .695, -.232], [.032, .75, -.244], [0, .762, -.246]];
      g.tube(smoothPts([...halfI, ...mir(halfI).reverse().slice(1)], 6), .0078, 9);
      // Vorderbeine: nach unten duenner, leicht gespreizt.
      for (const sx of [-1, 1]) {
        const L = smoothPts([[sx * .186, 0, .2], [sx * .172, .24, .158], [sx * .16, SY - .012, .126]], 8);
        g.tube(L, L.map(p => mix(.0108, .0152, p[1] / SY)), 12);
        g.at([sx * .186, .002, .2], () => g.with({ c: '#0c0a08', mat: MAT.plain, r: .6, flag: 0 }, () => g.cyl(.0115, .004, 12)));
      }
      // Sitzring, doppelt
      g.at([0, SY - .002, 0], () => g.torus(SR, .0155, 72, 12));
      g.at([0, SY - .03, 0], () => g.torus(SR - .012, .0105, 64, 10));
      // Der Ring zwischen den Beinen
      g.at([0, .285, -.02], () => g.torus(.226, .0072, 72, 8));
      for (const [px, pz] of [[.172, .155], [-.172, .155], [.142, -.208], [-.142, -.208]]) g.at([px, .285, pz], () => g.sphere(.0092, 8, 6));
    });
    // Sitzflaeche: Rohrgeflecht.
    g.with({ c: '#ffffff', tex: DOCS.cane, mat: MAT.plain, r: .62, flag: 0 }, () => g.surf((u, v) => {
      const r = clamp(u) * (SR - .008), a = v * TAU; return [Math.sin(a) * r, SY + .0065 - .009 * (1 - clamp(u) * clamp(u)), Math.cos(a) * r];
    }, 8, 48, (u, v) => { const a = v * TAU; return [.5 + .5 * u * Math.sin(a), .5 + .5 * u * Math.cos(a)]; }));
  });
}
// Ein schwerer Vorhang: Die Falten laufen unten auseinander, oben sind sie gerafft.
export function curtain(g, cx, w, y0, y1, z, seed, o = {}) {
  const folds = o.folds || 4.5;
  g.with({ c: o.c || '#3d1a14', mat: MAT.fabric, r: .95 }, () => g.surf((u, v) => {
    const a = u * TAU * folds + seed, drift = Math.sin(v * 2.3 + seed) * .35 + (vn(u * 5 + seed, v * 2.2, seed) - .5) * 1.3;
    const zz = Math.sin(a + drift) * .052 + Math.sin(a * 2.27 + seed * 2 + v * 1.7) * .014 + (vn(u * 13, v * 4, seed * 2) - .5) * .012;
    const gather = mix(.74, 1, Math.pow(1 - v, 1.4));
    return [cx + (u - .5) * w * gather + Math.sin(a * .5 + v * 2.1) * .012, mix(y0, y1, v), z + zz * mix(.72, 1, 1 - v)];
  }, 160, 18, (u, v) => [u, 1 - v]));
}
// Zerknuelltes Papier: eine Kugel mit harten Knicken.
export function paperBall(g, x, y, z, R, seed) {
  g.with({ c: '#e4ddca', mat: MAT.paper, r: .88 }, () => g.at([x, y, z], [seed, seed * 2.3, seed * .7], () => g.surf((u, v) => {
    const th = u * TAU, ph = v * PI, d = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
    const q = 2.6;
    const n1 = 1 - Math.abs(2 * vn(d[0] * q + seed, d[1] * q, d[2] * q) - 1), n2 = 1 - Math.abs(2 * vn(d[0] * q * 2.3 + 5, d[1] * q * 2.3 + seed, d[2] * q * 2.3) - 1), n3 = 1 - Math.abs(2 * vn(d[0] * q * 5.1, d[1] * q * 5.1 + 3, d[2] * q * 5.1 + seed) - 1);
    const rr = R * (.66 + .34 * n1 + .15 * n2 + .05 * n3);
    return [d[0] * rr, d[1] * rr, d[2] * rr];
  }, 56, 36)));
}
// Stehlampe mit Stoffschirm.
export function floorLamp(g, x, y, z, o = {}) {
  const h = o.h || 1.55;
  g.at([x, y, z], () => {
    g.with({ c: '#2a2118', mat: MAT.brushed, m: 1, r: .35 }, () => {
      g.lathe([[0, 0], [.14, 0], [.145, .012], [.05, .03], [.012, .05], [.012, h]], 32);
    });
    g.with({ c: o.shade || '#e9c88e', r: .9, e: o.e === undefined ? 1.5 : o.e }, () => g.at([0, h + .1, 0], () => g.lathe([[.21, -.13], [.11, .13]], 36)));
    g.with({ c: '#ffd9a0', e: 30 }, () => g.at([0, h + .06, 0], () => g.sphere(.035, 12, 8)));
  });
}
// Bild an der Wand, Rahmen aus Holz.
export function framed(g, x, y, z, w, h, tex, o = {}) {
  g.at([x, y, z], () => {
    g.with({ c: o.c || '#2a1a0e', mat: MAT.wood, r: .35 }, () => {
      const t = o.t || .03;
      g.at([0, h / 2 + t / 2, .015], () => g.rbox(w + t * 2, t, .03, .006));
      g.at([0, -h / 2 - t / 2, .015], () => g.rbox(w + t * 2, t, .03, .006));
      g.at([-w / 2 - t / 2, 0, .015], () => g.rbox(t, h, .03, .006));
      g.at([w / 2 + t / 2, 0, .015], () => g.rbox(t, h, .03, .006));
    });
    g.with({ c: o.bg || '#efe7d4', tex: tex || 0, mat: MAT.plain, r: .65 }, () => g.at([0, 0, .006], () => g.card(w, h)));
  });
}
// Ein Stapel Papier, jedes Blatt minimal anders versetzt.
export function paperStack(g, x, y, z, w, d, n, seed, o = {}) {
  const t = o.t || .0009;
  g.with({ c: o.c || '#efe8d8', mat: MAT.paper, r: .85 }, () => {
    for (let i = 0; i < n; i++) {
      const ox = (hash(seed + i) - .5) * .008, oz = (hash(seed + i * 2.3) - .5) * .008, ry = (hash(seed + i * 3.7) - .5) * .018;
      g.at([x + ox, y + t * (i + .5) * (o.step || 1), z + oz], [0, ry, 0], () => g.box(w, t, d, 4 | 1 | 16 | 32 | 2));
    }
  });
}
