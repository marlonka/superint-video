// Das Foyer: Ein Mikrofon, niemand davor. Die Sprechanlage tippt mit, was gesagt wird. Dann Code, eine Zeile aendert sich, eine Sache aendert sich. Dann Rohrpost.
import { Geo, MAT } from './geo.js';
import { M, PI, TAU, clamp, mix, smooth, hash, lin, inCubic, outCubic } from './m.js';
import { part, many, canvas, paperGround, wrap, cue, cueE, INK, RED, bump } from './kit.js';
import * as P from './props.js';
import { ROOM, R } from './house.js';
import { WORDS } from './cues.js';
import { ENV } from './envelope.js';

const ID = ROOM.FOYER;
export const LECTERN = { x: -5.5, y: .97, z: -1.68, tilt: .47, w: .32, h: .45 };
export const STATION = { x: -4.72, y: 1.06, z: -1.68 };
export const DOOR = { x: -5.5, y: 0, w: 1.5, h: 2.6 };
const L0 = LECTERN;
// Die Pultplatte und das Blatt obenauf: von hier aus rechnet alles, was auf dem Pult liegt.
export const PLATE = M.mul(M.T(L0.x, L0.y - .05, L0.z), M.RX(L0.tilt));
const STACK_T = .0065;
export const REST = M.mul(PLATE, M.T(0, .0175 + STACK_T, 0));
export const onSheet = (u, v, n = 0) => M.point(REST, [(u - .5) * L0.w, n, (v - .5) * L0.h]);
// Wo das Mikrofon haengt.
const STEM = M.point(PLATE, [-.2, .02, -.27]);
export const MICF = { x: STEM[0] + .02, y: STEM[1] + .34, z: STEM[2] + .1 };

// Satzspiegel des Blatts. Die Leinwand ist so gross wie das Blatt der Schreibmaschine.
const PW = 2048, PH = 2896;
const LX = 160, LY = 470, LFS = 90, LCW = 54, LLH = 132;
const CX = 190, CY = 470, CFS = 104, CCW = 62.4, CLH = 156;
export const letterV = i => (LY + i * LLH - 30) / PH;
export const codeV = i => (CY + i * CLH - 34) / PH;

// Was Marlon gesagt hat, in meinen Worten: Jedes Wort ist ein Wort der Stimme.
const LETTER = ['Die Leute fragen, wie so ein', 'Film möglich ist.', '', 'Zeig es ihnen so, dass sie es', 'selbst verstehen.', '', 'Und vielleicht machst du einfach', 'einen Stil, der', 'unglaublich kreativ ist.', '', 'Du hast ja Geschmack.'];
// Das Foyer als Code. Die eine Zeile, um die es geht, steht in Zeile 4.
export const WALL_A = '#c56a5d', WALL_B = '#2f6a5a';
const CODE = ['// foyer.js', 'const foyer = {', "  boden:  'schachbrett',", '  lampen: 4,', `  waende: '${WALL_A}',`, '', '};'];
const NEWLINE = `  waende: '${WALL_B}',`;

export function buildFoyer(ctx) {
  const { E, rooms, light } = ctx;
  const r = R.FOYER, g = new Geo(); g.s({ room: ID });
  const door = { x: DOOR.x, y: DOOR.y, w: DOOR.w, h: DOOR.h };
  P.roomShell(g, r, { floorC: '#ffffff', floorM: MAT.checker, floorR: .14, floorCoat: true, ceilC: '#d8c8b0', noBack: true, noWalls: true });
  P.wainscot(g, r.x0, door.x - door.w / 2 - .08, r.y0, .95, r.z0, 3, { c: '#3a1a14' });
  P.wainscot(g, door.x + door.w / 2 + .08, r.x1, r.y0, .95, r.z0, 3, { c: '#3a1a14' });
  // Stuck an der Decke und ein breiter Fries
  g.with({ c: '#e8dcc6', r: .6, mat: MAT.plain }, () => {
    g.at([(r.x0 + r.x1) / 2, r.y1 - .07, r.z0 + .05], () => g.rbox(5, .14, .1, .03));
    g.at([r.x0 + .05, r.y1 - .07, (r.z0 + r.z1) / 2], () => g.rbox(.1, .14, 3.6, .03));
    g.at([r.x1 - .05, r.y1 - .07, (r.z0 + r.z1) / 2], () => g.rbox(.1, .14, 3.6, .03));
    g.at([(r.x0 + r.x1) / 2, r.y1 - .22, r.z0 + .03], () => g.rbox(5, .03, .05, .01));
  });
  // Tuer: unten Holz, oben Glas, darueber ein Oberlicht mit Goldschrift (von innen spiegelverkehrt).
  const dx = door.x, dz = r.z0, dw = door.w;
  g.with({ c: '#22130c', mat: MAT.wood, r: .34, grain: 1 }, () => {
    g.at([dx - dw / 2 - .05, door.h / 2, dz + .02], () => g.rbox(.1, door.h + .1, .14, .01));
    g.at([dx + dw / 2 + .05, door.h / 2, dz + .02], () => g.rbox(.1, door.h + .1, .14, .01));
    g.s({ grain: 0 });
    g.at([dx, door.h + .05, dz + .02], () => g.rbox(dw + .2, .1, .14, .01));
    // Tuerblaetter
    for (const s of [-1, 1]) {
      const cx = dx + s * dw / 4, w = dw / 2 - .02;
      g.at([cx, .68, dz + .01], () => g.rbox(w, 1.36, .05, .008));
      g.at([cx + s * (w / 2 - .035), 1.85, dz + .01], () => g.rbox(.07, 1.0, .05, .006));
      g.at([cx - s * (w / 2 - .035), 1.85, dz + .01], () => g.rbox(.07, 1.0, .05, .006));
      g.at([cx, 2.34, dz + .01], () => g.rbox(w, .08, .05, .006));
    }
    g.at([dx, 2.42, dz + .02], () => g.rbox(dw, .06, .07, .006));
  });
  g.with({ c: '#b48c3f', mat: MAT.brushed, m: 1, r: .28 }, () => {
    // Griffe und Tritt
    for (const s of [-1, 1]) g.at([dx + s * .07, 1.5, dz + .07], () => g.cyl(.012, .46, 12));
    g.with({ r: .62 }, () => g.at([dx, .07, dz + .045], () => g.rbox(dw - .04, .14, .01, .004)));
  });
  // Glas
  g.with({ c: '#b8cdd8', mat: MAT.glass, r: .03 }, () => {
    for (const s of [-1, 1]) g.at([dx + s * dw / 4, 1.84, dz + .005], () => g.card(dw / 2 - .14, 1));
    g.at([dx, 2.52, dz + .005], () => g.card(dw, .14));
  });
  const goldDoc = E.addDoc(canvas(1024, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.translate(w, 0); x.scale(-1, 1);
    x.fillStyle = '#d9b45a'; x.font = '700 104px Jost'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('S T U D I O', w / 2, h / 2 + 6);
  }));
  g.with({ c: '#ffffff', tex: goldDoc, flag: 1, r: .25, m: 0 }, () => g.at([dx, 2.52, dz + .012], () => g.card(1.2, .3)));

  // Das Pult: dunkles Holz, Messingkante, auf einer gedrechselten Saeule.
  const L = LECTERN;
  g.at([L.x, 0, L.z], () => {
    g.with({ c: '#2a160c', mat: MAT.wood, r: .3, grain: 1 }, () => {
      g.lathe([[0, 0], [.26, 0], [.27, .02], [.24, .05], [.12, .08], [.07, .13], [.05, .22], [.042, .52], [.056, .6], [.05, .66], [.075, .74], [.09, .82], [0, .82]], 36);
    });
  });
  g.at([L.x, L.y - .05, L.z], [L.tilt, 0, 0], () => {
    g.with({ c: '#3a1f10', mat: MAT.wood, r: .22 }, () => g.rbox(.46, .03, .62, .006, 2));
    g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .25 }, () => g.at([0, .03, .3], () => g.rbox(.44, .024, .012, .004)));
    g.with({ c: '#1a2a1e', mat: MAT.leather, r: .55 }, () => g.at([0, .0165, 0], () => g.box(.4, .002, .56, 4)));
  });
  // Schwanenhalslampe am Pult, rechts: links steht das Mikrofon. Der Schirm zeigt aufs Blatt, die Birne sitzt darin.
  const LH = [L.x + .25, 1.19, L.z + .02], LROT = -.72;
  const LAX = norm([Math.sin(LROT), -Math.cos(LROT), 0]);
  {
    const foot = M.point(PLATE, [.205, .018, -.14]);
    const top = [LH[0] - LAX[0] * -.03, LH[1] - LAX[1] * -.03, LH[2]];
    const neck = P.smoothPts([foot, [foot[0] + .02, foot[1] + .1, foot[2] + .01], [mix(foot[0], top[0], .7) + .03, mix(foot[1], top[1], .72), mix(foot[2], top[2], .7)], [top[0] + .01, top[1] + .012, top[2]], top], 8);
    g.with({ c: '#a98a45', mat: MAT.brushed, m: 1, r: .26 }, () => {
      g.at(foot, [L.tilt, 0, 0], () => g.rbox(.05, .012, .05, .004));
      g.tube(neck, .0052, 8);
      for (let i = 1; i < neck.length - 1; i++) g.at(neck[i], () => g.sphere(.0058, 8, 5));
    });
    g.at(LH, [0, 0, LROT], () => {
      g.with({ c: '#8a6f36', mat: MAT.plain, m: 1, r: .3 }, () => g.lathe(P.smoothPts([[.008, .03], [.0135, .029], [.021, .012], [.033, -.012], [.05, -.038], [.052, -.041]], 4), 64, 0, TAU, 1.1));
      g.with({ c: '#efe6d0', r: .6, e: 2.2 }, () => g.lathe(P.smoothPts([[.0495, -.04], [.032, -.0125], [.02, .011], [.011, .025]], 3), 48));
      g.with({ c: '#ffd9a0', e: 18 }, () => g.at([0, -.01, 0], () => g.sphere(.014, 14, 10)));
    });
  }

  // Papierstapel auf dem Pult: Das oberste Blatt ist immer das naechste.
  g.at([L.x, L.y - .05, L.z], [L.tilt, 0, 0], () => g.at([0, .0175, 0], () => {
    const n = 7;
    g.with({ c: '#e6dfcd', mat: MAT.paper, r: .85 }, () => {
      for (let i = 0; i < n; i++) g.at([(hash(i * 1.3) - .5) * .004, STACK_T * (i + .5) / n, (hash(i * 2.9) - .5) * .004], [0, (hash(i * 4.1) - .5) * .012, 0], () => g.box(L.w, STACK_T / n, L.h, 4 | 1 | 2 | 16 | 32));
    });
  }));
  // Die Sprechanlage: zwei Schienen am Blatt, Bruecke und Kopf fahren darauf. Kabel kommt vom Mikrofon.
  const railX = L.w / 2 + .032, railZ = L.h / 2 + .055, railY = .04;
  g.at([L.x, L.y - .05, L.z], [L.tilt, 0, 0], () => {
    g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .24 }, () => {
      for (const s of [-1, 1]) {
        g.at([s * railX, railY, 0], [PI / 2, 0, 0], () => g.cyl(.0052, railZ * 2, 14));
        for (const q of [-1, 1]) g.at([s * railX, railY / 2 + .008, q * railZ], () => g.rbox(.024, railY + .002, .018, .003));
      }
    });
    // Anschlusskasten mit Lampe
    g.with({ c: '#17161a', mat: MAT.plain, r: .3 }, () => g.at([-railX, .03, -railZ - .035], () => g.rbox(.06, .034, .05, .006, 3)));
    g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .24 }, () => g.at([-railX, .0485, -railZ - .035], () => g.rcyl(.011, .004, .001, 16)));
  });
  // Das Mikrofon: Ring, Federn, Kapsel. Niemand steht davor.
  const MF = [MICF.x, MICF.y, MICF.z];
  const MR = .078; // Ringradius
  g.with({ c: '#b9bbc0', mat: MAT.brushed, m: 1, r: .22 }, () => {
    g.at([STEM[0], STEM[1] - .012, STEM[2]], [L.tilt, 0, 0], () => g.rbox(.05, .012, .05, .004));
    const neck = []; for (let i = 0; i <= 18; i++) { const u = i / 18, e = u * u * (3 - 2 * u); neck.push([mix(STEM[0], MF[0], e), STEM[1] + u * (MF[1] - MR - .02 - STEM[1]), mix(STEM[2], MF[2] - .02, e * e)]); }
    g.tube(neck, .0058, 10);
    for (let i = 1; i < 18; i += 1) g.at(neck[i], () => g.sphere(.0066, 10, 6));
  });
  g.at(MF, [PI / 2 - .12, 0, 0], () => {
    g.with({ c: '#c7c9ce', mat: MAT.brushed, m: 1, r: .18 }, () => {
      g.torus(MR, .0062, 56, 12);
      g.at([0, 0, MR + .009], () => g.rbox(.024, .016, .02, .004));
    });
    g.with({ c: '#3a3b40', mat: MAT.brushed, m: 1, r: .32 }, () => g.lathe([[0, .017], [.03, .017], [.033, .012], [.033, -.012], [.03, -.017], [0, -.017]], 36, 0, TAU, 1.0));
    g.with({ c: '#9a9da5', mat: MAT.screen, m: 1, r: .36 }, () => g.at([0, .0178, 0], () => g.lathe([[0, .0034], [.012, .0031], [.024, .0018], [.0305, -.0008]], 48)));
    g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .25 }, () => g.at([0, .0166, 0], () => g.torus(.0318, .0016, 56, 8)));
    // Acht Federn halten die Kapsel in der Luft.
    g.with({ c: '#d4d5d9', mat: MAT.brushed, m: 1, r: .22 }, () => {
      for (let i = 0; i < 8; i++) {
        const a = (i + .5) / 8 * TAU, ca = Math.cos(a), sa = Math.sin(a), pts = [];
        const r0 = .0325, r1 = MR - .004, coils = 11, n = 120;
        for (let k = 0; k <= n; k++) { const u = k / n, rr = mix(r0, r1, u), q = u * coils * TAU, rad = .0019 * Math.min(1, Math.min(u, 1 - u) * 22); pts.push([ca * rr - sa * Math.cos(q) * rad, Math.sin(q) * rad, sa * rr + ca * Math.cos(q) * rad]); }
        g.tube(pts, .00042, 4);
      }
    });
  });
  // Kabel: aus dem Ruecken der Kapselhalterung, am Hals hinab, in den Kasten.
  {
    const end = M.point(PLATE, [-railX, .05, -railZ - .052]);
    const a0 = [MF[0], MF[1] - MR - .012, MF[2] - .02], a1 = [MF[0] - .014, MF[1] - MR - .05, MF[2] - .07], a2 = [STEM[0] - .03, STEM[1] + .1, STEM[2] - .1], a3 = [end[0] - .012, end[1] + .05, end[2] - .05];
    const pts = [a0, a1, a2, a3, end], fine = [];
    for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 12; k++) {
      const u = k / 12, p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
      const cr = (a, b, c, d) => .5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u);
      fine.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1]), cr(p0[2], p1[2], p2[2], p3[2])]);
    }
    fine.push(end);
    g.with({ c: '#141318', r: .55 }, () => g.tube(fine, .0028, 7));
  }
  // Hinten am Pult: das Hausnetz.
  g.with({ c: '#141318', r: .55 }, () => {
    const from = M.point(PLATE, [-railX, .02, -railZ - .06]);
    const fine = []; for (let i = 0; i <= 24; i++) { const u = i / 24; fine.push([mix(from[0], L.x - .01, u) , mix(from[1], .36, u * u * .6 + u * .4), mix(from[2], L.z - .05, u)]); }
    g.tube(fine, .0028, 7);
  });

  // Kapselstation und senkrechtes Glasrohr
  const S = STATION;
  g.at([S.x, 0, S.z], () => {
    g.with({ c: '#2a160c', mat: MAT.wood, r: .3 }, () => g.lathe([[0, 0], [.16, 0], [.165, .02], [.1, .05], [.07, .1], [.06, .7], [.075, .78], [.09, .82], [0, .82]], 26));
    g.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .25 }, () => {
      g.at([0, .86, 0], () => g.rcyl(.075, .08, .01, 22));
      g.at([0, 1.42, 0], () => g.rcyl(.066, .03, .006, 20));
      g.at([0, 3.15, 0], () => g.rcyl(.075, .1, .006, 20));
      for (const y of [1.9, 2.5]) g.at([0, y, 0], () => g.torus(.05, .007, 18, 6).s({}));
      g.tube([[0, 1.0, 0], [.2, 1.0, 0]], .006, 6); // Hebel
      g.at([.2, 1.0, 0], () => g.sphere(.016, 10, 8));
    });
    g.with({ c: '#c8dde4', mat: MAT.glass, r: .03, m: .08 }, () => g.at([0, 2.3, 0], () => g.lathe([[.045, -.9], [.045, .9]], 18)));
    g.with({ c: '#c8dde4', mat: MAT.glass, r: .03, m: .08 }, () => g.at([0, 1.2, 0], () => g.lathe([[.052, -.3], [.052, .22]], 18)));
  });

  // Ausstattung: Bank, Schirmstaender, Spiegel, gerahmte Filmbilder, Wandlampen, Fussmatte, Pflanze.
  g.at([-7.45, 0, -2.0], [0, PI / 2, 0], () => {
    g.with({ c: '#2a160c', mat: MAT.wood, r: .32 }, () => {
      g.at([0, .44, 0], () => g.rbox(1.5, .05, .42, .01));
      for (const s of [-1, 1]) g.at([s * .68, .21, 0], () => g.rbox(.06, .42, .38, .008));
      g.at([0, .86, -.2], () => g.rbox(1.5, .06, .03, .008));
      for (let i = 0; i < 12; i++) g.at([-.66 + i * .12, .66, -.2], () => g.rbox(.04, .36, .02, .004));
    });
    g.with({ c: '#5a1a1a', mat: MAT.velvet, r: .8 }, () => g.at([0, .485, .01], () => g.rbox(1.4, .04, .38, .014)));
  });
  g.at([-3.5, 0, -3.1], () => {
    g.with({ c: '#b48c3f', mat: MAT.brushed, m: 1, r: .3 }, () => g.lathe([[0, 0], [.13, 0], [.14, .02], [.12, .03], [.11, .6], [.13, .62], [.12, .63], [.1, .05], [0, .05]], 22));
    g.with({ c: '#191b22', r: .5 }, () => { g.tube([[.03, .05, 0], [.04, 1.0, .03]], .009, 8); g.tube([[-.05, .05, -.02], [-.03, .94, -.04]], .009, 8); });
    g.with({ c: '#2a1a12', mat: MAT.wood, r: .3 }, () => { g.at([.04, 1.03, .03], [.0, 0, 1.2], () => g.torus(.025, .007, 14, 6, 0, PI)); });
    g.with({ c: '#3a0f12', mat: MAT.fabric, r: .9 }, () => g.at([.04, .72, .03], () => g.lathe([[.012, -.3], [.062, -.16], [.046, .1], [.012, .26]], 12)));
  });
  g.with({ c: '#3e2a1a', mat: MAT.rug, r: 1 }, () => g.at([dx, .007, dz + .75], () => g.rbox(1.2, .012, .7, .005)));
  for (const x of [-7.25, -3.75]) {
    g.at([x, 1.86, r.z0 + .03], () => {
      g.with({ c: '#b48c3f', mat: MAT.brushed, m: 1, r: .28 }, () => { g.rbox(.08, .16, .02, .005); g.at([0, .02, .1], [PI / 2, 0, 0], () => g.cyl(.009, .2, 8)); });
      g.with({ c: '#f4e0b8', e: 8, r: .9 }, () => g.at([0, .12, .19], () => g.lathe([[.08, -.09], [.05, .09]], 18)));
      g.with({ c: '#ffd9a0', e: 26 }, () => g.at([0, .1, .19], () => g.sphere(.026, 10, 8)));
    });
  }
  P.pendant(g, -5.5, r.y1, -1.7, .45, '#2a1b10', '#ffd8a2');
  // Vier alte Filmbilder an den Waenden: die werden im Schneideraum noch wichtig.
  P.framed(g, -6.72, 1.98, r.z0 + .012, .5, .28, ctx.still.luft);
  P.framed(g, -4.28, 1.98, r.z0 + .012, .5, .28, ctx.still.kinder);
  E.addStatic(g, ID);
  const upA = lin('#c88b6e').map(v => v * .32), upB = lin('#7aa593').map(v => v * .32), dnA = lin('#6a4436').map(v => v * .3), dnB = lin('#3f5a4e').map(v => v * .3), fillA = [.11, .085, .07], fillB = [.07, .098, .085];
  rooms[ID] = { up: upA, dn: dnA, fill: fillA, power: 1, gloss: .9, min: [r.x0, r.y0, r.z0], max: [r.x1, r.y1, r.z1] };
  light(ID, r, { pos: [-5.5, r.y1 - .55, -1.7], dir: [0, -1, 0], angle: 1.42, inner: 1.0, color: [13, 9.2, 5.8], range: 7, size: .14, haze: .004 });
  light(ID, r, { pos: [-7.25, 2.1, r.z0 + .4], dir: norm([.05, -.5, 1]), angle: 1.3, inner: .9, color: [3.4, 2.4, 1.4], range: 4, size: .08 });
  light(ID, r, { pos: [-3.75, 2.1, r.z0 + .4], dir: norm([-.05, -.5, 1]), angle: 1.3, inner: .9, color: [3.4, 2.4, 1.4], range: 4, size: .08 });
  light(ID, r, { pos: [LH[0] + LAX[0] * .03, LH[1] + LAX[1] * .03, LH[2]], dir: LAX, angle: 1.0, inner: .62, color: [.2, .15, .1], range: 2.4, size: .025, bias: .001 });
  // Kaltes Licht von draussen durch die Glastuer
  light(ID, r, { pos: [-5.8, 3.4, -7.4], dir: norm([.05, -.5, 1]), angle: .55, inner: .35, color: [26, 34, 56], range: 9, size: .2, near: 1, haze: .004, bias: .003 });

  // ---------------------------------------------------- Die Waende: zwei Fassungen, ein Wechsel in einem einzigen Bild.
  const wallGeo = c => part(E, ID, gg => {
    gg.s({ c, mat: MAT.wallB, r: .55, flag: 16 | 32 });
    P.wallWithHoles(gg, r.x0, r.x1, r.y0, r.y1, r.z0, [door]);
    gg.rect([r.x0, r.y0, r.z1], [r.x0, r.y0, r.z0], [r.x0, r.y1, r.z0], [r.x0, r.y1, r.z1], [1, 0, 0]);
    gg.rect([r.x1, r.y0, r.z0], [r.x1, r.y0, r.z1], [r.x1, r.y1, r.z1], [r.x1, r.y1, r.z0], [-1, 0, 0]);
  });
  const wallsA = wallGeo(WALL_A), wallsB = wallGeo(WALL_B);

  // ---------------------------------------------------- Bewegtes
  const page = ctx.liveSlots.page;
  const bg = canvas(PW, PH, (x, w, h) => paperGround(x, w, h, '#efe8d8', 9));
  const letter = many(E, ID, 2, gg => { gg.s({ c: '#efe8d8', mat: MAT.paper, r: .85 }); gg.sheet(L.w, L.h, 14, 6); });
  letter.shadowRoom = ID;
  const strokeDoc = E.addDoc(canvas(1024, 128, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.strokeStyle = RED; x.lineCap = 'round';
    // Ein Filzstift: dick, leicht unruhig, zum Ende duenner.
    for (let k = 0; k < 3; k++) {
      x.lineWidth = 15 - k * 3; x.globalAlpha = .88 - k * .2; x.beginPath();
      for (let i = 0; i <= 80; i++) { const u = i / 80, px = 12 + u * (w - 24), py = h * .5 + Math.sin(u * 11 + k) * 5 + Math.sin(u * 31) * 2 + (k - 1) * 4; i ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.stroke();
    }
  }));
  const strokes = many(E, ID, 2, gg => { gg.s({ c: '#ffffff', r: .55, tex: strokeDoc, flag: 1 | 16 }); gg.sheet(1, 1, 1, 1); });
  strokes.shadowRoom = -99;
  const capsule = part(E, ID, capsuleGeo);
  const capG = part(E, ID, gg => { gg.s({ c: '#ffd9a0', e: 16, r: .4, flag: 0 }); gg.sphere(.03, 12, 8); });
  const capL = ctx.add({ room: ID, pos: [0, 0, 0], dir: [.5547, -.1, .8320], angle: 1.45, inner: .9, color: [8, 6, 3.6], range: 3.8, size: .04, near: .06, haze: .0012, bias: .004, manual: true, power: 0, base: 0 });
  const lid = part(E, ID, gg => { gg.s({ c: '#a78037', mat: MAT.brushed, m: 1, r: .3 }); gg.at([.033, 0, 0], () => gg.rcyl(.034, .008, .002, 18)); });

  // Die Bruecke und der Schreibkopf der Sprechanlage
  const bridge = part(E, ID, gg => {
    gg.with({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .24 }, () => gg.at([0, 0, 0], [0, 0, PI / 2], () => gg.cyl(.0042, railX * 2 + .012, 12)));
    gg.with({ c: '#c7c9ce', mat: MAT.brushed, m: 1, r: .26 }, () => { for (const s of [-1, 1]) gg.at([s * railX, 0, 0], () => gg.rbox(.018, .016, .03, .004)); });
  });
  const headP = part(E, ID, gg => {
    gg.with({ c: '#26252a', mat: MAT.plain, r: .3, flag: 16 | 64 }, () => gg.at([0, .0015, .0], () => gg.rbox(.03, .013, .019, .0035, 3)));
    gg.with({ c: '#b9bbc0', mat: MAT.brushed, m: 1, r: .24 }, () => {
      for (const s of [-1, 1]) gg.at([s * .0095, .0088, 0], () => gg.rcyl(.0028, .002, .0005, 10));
      // Der Arm fuehrt zur Kugel, vor der Zeile.
      gg.tube([[0, .0035, -.008], [0, .0055, -.016], [0, .0115, -.024], [0, .0135, -.030]], .0021, 8);
    });
  });
  const hammer = part(E, ID, gg => {
    gg.with({ c: '#d6d7da', mat: MAT.plain, m: 1, r: .1 }, () => {
      gg.sphere(.0082, 28, 18);
      // Reihen erhabener Lettern: So erkennt man eine Typenkugel.
      for (let row = -2; row <= 2; row++) {
        const ph = row * .34, rr = Math.cos(ph) * .0084, yy = Math.sin(ph) * .0084;
        for (let i = 0; i < 18; i++) { const a = (i + row * .5) / 18 * TAU; gg.at([Math.sin(a) * rr, yy, Math.cos(a) * rr], [ph * -.0, a, 0], () => gg.rbox(.0014, .0014, .0008, .0003, 1)); }
      }
    });
    gg.with({ c: '#26252a', mat: MAT.plain, r: .3 }, () => gg.at([0, .0088, 0], () => gg.rcyl(.0032, .0026, .0006, 14)));
  });
  const lampOn = part(E, ID, gg => { gg.s({ c: '#ffb860', e: 22, r: .3, flag: 0 }); gg.sphere(.0062, 12, 8); });
  const lampPos = M.point(PLATE, [-railX, .054, -railZ - .035]);
  lampOn.set(M.T(lampPos[0], lampPos[1], lampPos[2]));

  // Stichworte
  const W5 = WORDS.filter(w => w[3] === 5), i0 = W5.findIndex(w => w[0] === 'Die');
  const tRoll = cue(5, 'Nur', 1) + .1, tInCap = tRoll + .62, tSnap = tInCap + .22;
  const tFire = cueE(6, 'Sache') + .28, tArrive = tFire + 1.5;
  ctx.capsuleFirst = { tFire, tArrive };
  const tSwap = tInCap + .1, tPage0 = cue(5, 'Alles') - .34, tPage1 = cue(7, 'Ein', 1);
  ctx.pageBusy = t => t >= tPage0 && t <= tPage1;
  // Alles, was der Kopf anschlaegt: erst das, was die Stimme sagt, Wort fuer Wort. Dann der Code, schnell.
  const seq = [];
  {
    let wi = i0;
    LETTER.forEach((ln, li) => {
      let col = 0;
      for (const tok of ln.split(' ')) {
        if (!tok) continue;
        const w = W5[wi++], d = (w[2] - w[1]) / tok.length;
        for (let j = 0; j < tok.length; j++) seq.push({ ch: tok[j], t: w[1] + j * d, line: li, col: col + j, h: hash(seq.length * 1.71), h2: hash(seq.length * 2.93), code: false });
        col += tok.length + 1;
      }
    });
    const tC0 = cue(6, 'Code'), tC1 = cue(6, 'Ändere') - .1;
    const nCode = CODE.reduce((a, l) => a + l.trimStart().length, 0);
    let k = 0;
    CODE.forEach((ln, li) => { const lead = ln.length - ln.trimStart().length; for (let j = lead; j < ln.length; j++) { if (ln[j] !== ' ' || j > lead) seq.push({ ch: ln[j], t: mix(tC0, tC1, k / nCode), line: li, col: j, h: hash(seq.length * 1.71), h2: hash(seq.length * 2.93), code: true }); k++; } });
    // Die alte Zeile wird ueberschlagen, die neue steht darunter.
    const tS0 = cue(6, 'Zeile') - .2, tS1 = tS0 + .44, tFlipIn = cue(6, 'ändert') - .03, oldL = CODE[4], lead = 2;
    for (let j = lead; j < oldL.length; j++) seq.push({ ch: 'x', t: mix(tS0, tS1, (j - lead) / (oldL.length - lead)), line: 4, col: j, h: hash(seq.length * 1.71), h2: hash(seq.length * 2.93), code: true, over: true });
    const tN0 = tS1 + .06;
    for (let j = lead; j < NEWLINE.length; j++) seq.push({ ch: NEWLINE[j], t: mix(tN0, tFlipIn, (j - lead) / (NEWLINE.length - lead - 1)), line: 5, col: j, h: hash(seq.length * 1.71), h2: hash(seq.length * 2.93), code: true });
  }
  ctx.foyerTyping = seq.map(c => c.t);
  const tFlip = cue(6, 'ändert') - .03;
  ctx.wallFlip = tFlip;
  rooms[ID].tint = t => { const k = t >= tFlip; rooms[ID].up = k ? upB : upA; rooms[ID].dn = k ? dnB : dnA; rooms[ID].fill = k ? fillB : fillA; };
  const idx = t => { let lo = 0, hi = seq.length; while (lo < hi) { const m = (lo + hi) >> 1; if (seq[m].t <= t) lo = m + 1; else hi = m; } return lo - 1; };
  const sheetU = c => (c.code ? CX + c.col * CCW : LX + c.col * LCW) / PW;
  const sheetV = c => (c.code ? CY + c.line * CLH : LY + c.line * LLH) / PH;

  function paintSheet(x, t) {
    x.drawImage(bg, 0, 0, PW, PH);
    x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    const n = idx(t), j = PW / 1024;
    if (t < tSwap) {
      x.fillStyle = 'rgba(27,26,30,.5)'; x.font = '700 62px "Courier Prime"'; x.fillText('Auftrag, gesprochen', LX, 292);
      x.strokeStyle = 'rgba(27,26,30,.28)'; x.lineWidth = 3; x.beginPath(); x.moveTo(LX, 322); x.lineTo(PW - LX, 322); x.stroke();
      x.font = `700 ${LFS}px "Courier Prime"`;
      for (let i = 0; i <= n; i++) { const c = seq[i]; if (c.code || c.ch === ' ') continue; x.fillStyle = `rgba(3,2,3,${.965 + .035 * c.h})`; x.fillText(c.ch, LX + c.col * LCW + (c.h2 - .5) * 1.1 * j, LY + c.line * LLH + (c.h - .5) * 1.2 * j); }
    } else {
      x.font = `700 ${CFS}px "JetBrains Mono"`;
      for (let i = 0; i <= n; i++) {
        const c = seq[i]; if (!c.code || c.ch === ' ') continue;
        x.fillStyle = c.line === 0 ? 'rgba(27,26,30,.55)' : c.over ? 'rgba(3,2,3,.98)' : `rgba(3,2,3,${.965 + .035 * c.h})`;
        x.fillText(c.ch, CX + c.col * CCW + (c.h2 - .5) * 1.1 * j, CY + c.line * CLH + (c.h - .5) * 1.2 * j);
      }
    }
  }
  let pageKey = '';

  // Wo steht der Kopf? Reine Funktion der Zeit: zwischen zwei Anschlaegen kurze Fahrt, in langen Pausen zurueck zum Ruheplatz.
  const HOME = { u: .985, v: -.075 };
  function headAt(ts) {
    const n = idx(ts);
    if (n < 0) { const nx = seq[0]; const k = smooth(nx.t - .7, nx.t - .05, ts); return { u: mix(HOME.u, sheetU(nx), k), v: mix(HOME.v, sheetV(nx), k), press: 0 }; }
    const c = seq[n], nx = seq[n + 1], dt = ts - c.t, press = dt < .055 ? Math.sin(clamp(dt / .055) * PI) : 0;
    if (!nx) { const k = smooth(c.t + .1, c.t + .8, ts); return { u: mix(sheetU(c), HOME.u, k), v: mix(sheetV(c), HOME.v, k), press }; }
    const gap = nx.t - c.t;
    if (gap < 1.2) { const k = smooth(nx.t - Math.min(.14, gap * .9), nx.t, ts); return { u: mix(sheetU(c), sheetU(nx), k), v: mix(sheetV(c), sheetV(nx), k), press }; }
    // Lange Pause: nach Hause und rechtzeitig wieder zurueck.
    const a = smooth(c.t + .12, c.t + .8, ts), b = smooth(nx.t - .6, nx.t - .04, ts);
    const hu = mix(sheetU(c), HOME.u, a), hv = mix(sheetV(c), HOME.v, a);
    return { u: mix(hu, sheetU(nx), b), v: mix(hv, sheetV(nx), b), press };
  }

  // Die Bahn der Kapsel, durchs ganze Haus bis zur Buehne.
  const S2 = S;
  const PATH = [[S2.x, S2.y + .08, S2.z], [S2.x, 3.4, S2.z], [S2.x, 6.25, S2.z], [1.4, 6.25, S2.z], [1.4, 5.05, S2.z]];
  const lens = []; let tot = 0; for (let i = 1; i < PATH.length; i++) { const d = Math.hypot(PATH[i][0] - PATH[i - 1][0], PATH[i][1] - PATH[i - 1][1]); lens.push(d); tot += d; }
  function capsulePos(u) { let s = u * tot; for (let i = 0; i < lens.length; i++) { if (s <= lens[i] || i === lens.length - 1) { const k = s / lens[i]; return [mix(PATH[i][0], PATH[i + 1][0], k), mix(PATH[i][1], PATH[i + 1][1], k), PATH[i][2], i]; } s -= lens[i]; } return PATH[0]; }
  ctx.capsuleAt = capsulePos;
  ctx.capsuleU = ts => { const v = clamp((ts - tFire) / (tArrive - tFire)); return v * v * (3 - 2 * v) * .5 + v * .5; };

  const RP = M.point(REST, [0, 0, 0]);
  // Unterstreichung: Zeile 8 beginnt mit den zwei Woertern, um die es geht.
  const underline = { u0: LX / PW, u1: (LX + 'unglaublich kreativ'.length * LCW) / PW, v: (LY + 8 * LLH + 22) / PH };
  const tU0 = cue(5, 'unglaublich'), tU1 = cueE(5, 'kreativ');

  return {
    frame(t) {
      wallsA.visible = t < tFlip; wallsB.visible = t >= tFlip;
      if (!ctx.pageBusy(t)) return;
      const n = idx(t), key = (t < tSwap ? 'L' : 'C') + n;
      if (key !== pageKey || page.owner !== 'foyer') { pageKey = key; page.owner = 'foyer'; page.paint(x => paintSheet(x, t)); }
    },
    sub(ts, s, N, t, eye) {
      // Das unterste Blatt liegt schon da: Wenn das obere geht, ist es leer und wartet auf den Code.
      letter.begin();
      letter.push(M.mul(REST, M.T(0, .00035, 0)), [0, 0, 0, 0], [1, 1, 0, 0], [ts >= tSwap ? 202 : -1, ID, 1, 1]);
      if (ts < tInCap + .1) {
        let m = M.mul(REST, M.T(0, .0008, 0)), k = 0;
        if (ts >= tRoll) {
          const u = clamp((ts - tRoll) / (tInCap - tRoll));
          const roll = smooth(0, .5, u), move = smooth(.35, 1, u);
          const ax = mix(0, PI / 2 - L.tilt, move);
          m = M.mul(M.T(mix(RP[0], S.x, move), mix(RP[1] + roll * .09, S.y + .28, move) - smooth(.8, 1, u) * .2, mix(RP[2], S.z, move)), M.RX(L.tilt + ax));
          k = roll * 22;
        }
        letter.push(m, [k, 0, 0, 0], [1, 1, 0, 0], [202, ID, 1, 1]);
      }
      letter.end();
      // Zinnober: zieht sich von selbst unter die zwei Woerter.
      strokes.begin();
      if (ts > tU0 && ts < tRoll) {
        const p = clamp((ts - tU0) / (tU1 - tU0)), w = (underline.u1 - underline.u0) * L.w, lx = (underline.u0 - .5) * L.w, lz = (underline.v - .5) * L.h;
        strokes.push(M.mul(M.mul(REST, M.T(lx + w * p / 2, .0013, lz)), M.S(w * p, 1, .014)), [0, 0, 0, 0], [p, 1, 0, 0], [strokeDoc, ID, 1, 1]);
      }
      strokes.end();
      // Bruecke und Kopf
      const hd = headAt(ts), hx = (hd.u - .5) * L.w, hz = (hd.v - .5) * L.h;
      const ry = railY - (.0175 + STACK_T);
      const bz = Math.min(railZ - .03, Math.max(-railZ + .02, hz + .03));
      bridge.set(M.mul(REST, M.T(0, ry, bz)));
      headP.set(M.mul(REST, M.T(hx, ry + .002, bz)));
      // Die Kugel schlaegt an und dreht sich zum naechsten Buchstaben.
      const hN = idx(ts), ballY = hN >= 0 && !seq[hN].code ? 0 : 0, hRot = hN >= 0 ? hash(hN * 1.37) * TAU + (ts - seq[hN].t) * .4 : 0;
      hammer.set(M.mul(M.mul(REST, M.T(hx, ry + .002 + .0135 - .0 - hd.press * .0034, bz - .0345)), M.mul(M.RY(hRot), M.RX(.22 + hd.press * .2))));
      // Die Lampe an der Anlage: lebt mit der Stimme, solange gesprochen und getippt wird.
      const f = Math.floor(ts * 30), on = ts > cue(5, 'Mikrofon') - .1 && ts < cueE(5, 'Geschmack') + .2;
      lampOn.visible = on && (ENV[Math.max(0, Math.min(ENV.length - 1, f))] > 8);
      // Kapsel: wartet offen auf der Station, schnappt zu, schiesst los.
      const u = ctx.capsuleU(ts);
      const pos = capsulePos(u);
      const horiz = pos[3] === 2;
      capsule.visible = lid.visible = u < .999;
      const trans = horiz ? M.mul(M.T(pos[0], pos[1], pos[2]), M.RZ(0)) : M.mul(M.T(pos[0], pos[1], pos[2]), M.RZ(PI / 2));
      capsule.roomOv = lid.roomOv = pos[1] < 3.4 ? ID : pos[0] < .1 ? ROOM.SCHNITT : ROOM.BUEHNE;
      capsule.set(trans);
      { const on2 = u > .002 && u < .999; capG.visible = on2; capG.roomOv = capsule.roomOv; capG.set(M.T(pos[0], pos[1], pos[2] + .06)); capL.room = capsule.roomOv; capL.pos = [pos[0] + .08, pos[1], pos[2] + .1]; capL.power = on2 ? 1 : 0; }
      const op = 1 - smooth(tSnap, tSnap + .1, ts);
      const lidm = M.mul(trans, M.mul(M.T(.075, 0, 0), M.RY(-op * 1.9)));
      lid.set(M.mul(lidm, M.T(0, 0, 0)));
    },
  };
}

export function capsuleGeo(gg) {
  // Liegt entlang X, Oeffnung bei +X.
  gg.s({ c: '#c49b49', mat: MAT.brushed, m: 1, r: .25 });
  gg.at([0, 0, 0], [0, 0, PI / 2], () => {
    gg.lathe([[0, -.07], [.028, -.072], [.034, -.062], [.034, .072], [.03, .072], [.03, -.05], [0, -.05]], 22);
    gg.with({ c: '#2a1a12', mat: MAT.fabric, m: 0, r: .95 }, () => { gg.at([0, -.05, 0], () => gg.torus(.04, .007, 20, 6)); gg.at([0, .06, 0], () => gg.torus(.04, .007, 20, 6)); });
    gg.with({ c: '#8a6a2c', r: .4 }, () => gg.at([0, .005, 0], () => gg.torus(.0345, .0018, 22, 5)));
  });
}
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
