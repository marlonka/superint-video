// The set: one room, open at the front like a section through a building, with one hero object on a desk.
// This room is the starting point and the quality bar, never the next film's idea. Replace the room, the hero
// and the camera with what the film needs; keep how they are built. Full rooms: skill superint-miniature, example/.
import { Geo, MAT } from './geo.js';
import { M, PI, mix, smooth, hash, lin } from './m.js';
import { part, canvas, paperGround, INK } from './kit.js';
import * as P from './props.js';

// Room 1 is "outside" to the renderer: the sky, the street, whatever has no walls. Up to 23 more rooms fit.
export const ROOM = { EXT: 1, STUDY: 2 };
const ID = ROOM.STUDY;
const R = { x0: -4, x1: 4, y0: 0, y1: 3.2, z0: -3.6, z1: 0 };
export const DESK = { x: -.05, z: -1.75, top: .76 };
export const CUP = { x: DESK.x + .66, y: DESK.top, z: DESK.z + .22 };
// The close-up keeps its own light until this second.
export const HERO_OUT = 3.4;

const norm = a => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };

// The black, hatched section walls around the room, like a building section in an architect's drawing.
function buildShell(E) {
  const g = new Geo();
  g.s({ room: ROOM.EXT, mat: MAT.poche, c: '#0c0c10', r: .9, flag: 32 });
  const B = (x0, x1, y0, y1, z0 = -4.1, z1 = 0) => g.at([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], () => g.box(x1 - x0, y1 - y0, z1 - z0));
  // The section stands e behind the room's own walls. In the same plane, both fight for the same pixels and the walls flicker as the camera moves.
  const e = .005, o = .1;
  B(R.x0 - .4, R.x0 - e, R.y0 - .6, R.y1 + .4);
  B(R.x1 + e, R.x1 + .4, R.y0 - .6, R.y1 + .4);
  B(R.x0 - o, R.x1 + o, R.y0 - .6, R.y0 - e);
  B(R.x0 - o, R.x1 + o, R.y1 + e, R.y1 + .4);
  E.addStatic(g, ROOM.EXT);
}

export function buildSet(ctx) {
  const { E, rooms, light } = ctx;
  buildShell(E);

  // Outside: only the sky through the windows.
  const out = new Geo();
  out.s({ room: ROOM.EXT });
  out.with({ c: '#000000', mat: MAT.sky, flag: 32 }, () => out.at([0, 30, -78], () => out.card(420, 170)));
  E.addStatic(out, ROOM.EXT);
  rooms[ROOM.EXT] = { up: lin('#141c2e').map(v => v * .85), dn: lin('#0c0c10'), fill: [.018, .022, .034], power: 1, gloss: .6, min: [-140, -1, -80], max: [140, 60, 90] };

  // The room: bottle-green wallpaper, panelling, heavy curtains, shelves. Details first, then light.
  const r = R, g = new Geo();
  g.s({ room: ID });
  const win = [{ x: -1.9, y: .85, w: 1.15, h: 1.85 }, { x: 1.8, y: .85, w: 1.15, h: 1.85 }];
  P.roomShell(g, r, { wallC: '#10392f', wallM: MAT.wallA, wallR: .62, floorC: '#6a3f21', ceilC: '#c7bda5', noBack: true });
  g.with({ c: '#10392f', mat: MAT.wallA, r: .62 }, () => P.wallWithHoles(g, r.x0, r.x1, r.y0, r.y1, r.z0, win));
  P.wainscot(g, r.x0, r.x1, r.y0, 1.0, r.z0, 11);
  for (const w of win) {
    P.windowFrame(g, w.x, w.y, w.w, w.h, r.z0 - .1);
    P.radiator(g, w.x, r.y0, r.z0 + .12);
    for (const s of [-1, 1]) P.curtain(g, w.x + s * (w.w / 2 + .17), .46, r.y0 + .95, r.y1 - .17, r.z0 + .2, s * 1.7 + w.x);
    g.with({ c: '#a98a45', mat: MAT.brushed, m: 1, r: .3 }, () => {
      g.at([w.x, r.y1 - .15, r.z0 + .2], [0, 0, PI / 2], () => g.cyl(.012, w.w + .95, 12));
      for (const s of [-1, 1]) g.at([w.x + s * (w.w + .95) / 2, r.y1 - .15, r.z0 + .2], () => g.sphere(.021, 12, 8));
    });
  }
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
  P.chair(g, dx, dy, dz + .95, PI);
  P.shelf(g, r.x0 + .7, r.y0 + .02, r.z0 + .2, 1.3, 2.7, 7, 1.7);
  P.shelf(g, r.x1 - .7, r.y0 + .02, r.z0 + .2, 1.3, 2.7, 7, 5.9);
  P.floorLamp(g, -2, r.y0, -2.5);
  // A waste-paper basket: what such a room has. Details that have a reason make a place believable.
  g.at([1.8, r.y0, -2.45], () => {
    g.with({ c: '#3b2a1a', mat: MAT.leather, r: .6 }, () => g.lathe([[0, 0], [.16, 0], [.2, .36], [.19, .36], [.15, .012], [0, .012]], 28));
    for (let i = 0; i < 6; i++) P.paperBall(g, Math.cos(i * 2.2) * .085, .345 + hash(i) * .045, Math.sin(i * 2.2) * .085, .052 + hash(i * 3.1) * .012, i * 1.37 + 1);
  });
  P.pendant(g, dx, r.y1, dz, .82);

  // Text stands in the world: a typed sheet on the desk. Nothing ever floats in front of the picture.
  const sheetDoc = E.addDoc(canvas(724, 1024, (x, w, h) => {
    paperGround(x, w, h, '#efe8d8', 4);
    x.fillStyle = INK; x.font = '400 42px "Courier Prime"'; x.textBaseline = 'alphabetic';
    ['Szene 1', 'Take 1', '', 'Dieser Raum ist', 'der Anfang,', 'nicht der Film.'].forEach((l, i) => x.fillText(l, 84, 150 + i * 62));
  }));
  g.with({ c: '#efe8d8', mat: MAT.paper, r: .85, tex: sheetDoc, flag: 16 }, () => g.at([dx - .2, top + .0006, dz + .24], [0, .09, 0], () => g.sheet(.148, .21)));

  E.addStatic(g, ID);
  rooms[ID] = { up: lin('#3a3a2e').map(v => v * .75), dn: lin('#4a2a18').map(v => v * .7), fill: [.055, .05, .042], power: 1, gloss: .9, min: [r.x0, r.y0, r.z0], max: [r.x1, r.y1, r.z1] };

  // Practical lights: every lamp in the picture really lights the room.
  const bankerL = light(ID, r, { pos: [dx - .74, top + .29, dz - .19], dir: norm([.16, -1, .12]), angle: 1.2, inner: .8, color: [4.2, 3.2, 2], range: 7, size: .07, haze: .003 });
  const pendantL = light(ID, r, { pos: [dx, r.y1 - .92, dz], dir: [0, -1, 0], angle: 1.42, inner: 1.0, color: [21, 16, 10], range: 10, size: .14, haze: .004 });
  light(ID, r, { pos: [-2, r.y0 + 1.75, -2.5], dir: norm([.2, -1, .3]), angle: 1.45, inner: 1.1, color: [10, 6.6, 3.4], range: 7, size: .14, haze: .002 });
  light(ID, r, { pos: [0, r.y1 - .1, -1.8], dir: [0, -1, 0], angle: 1.5, inner: 1.2, color: [8, 7.2, 5.8], range: 9, size: 1.9 });
  light(ID, r, { pos: [.8, r.y0 + 3.0, -6.2], dir: norm([-.25, -.42, 1]), angle: .85, inner: .6, color: [34, 50, 90], range: 16, size: .3, near: 1, haze: .001, bias: .003 });

  // The hero's own light: a soft key and a fill that exist only for the close-up, like a photographer's.
  // Their cones must end well outside the frame, and the lamp that would cut across the object stays off.
  const kp = [CUP.x - .46, top + .36, CUP.z + .86], fp = [CUP.x + .62, top + .2, CUP.z + .66];
  const heroKey = light(ID, r, { pos: kp, dir: norm([CUP.x - kp[0], top + .03 - kp[1], CUP.z - kp[2]]), angle: .3, inner: .15, color: [2.5, 2.1, 1.58], range: 3, size: .2, near: .1, manual: true, power: 0, haze: 0, bias: .0012 });
  const heroFill = light(ID, r, { pos: fp, dir: norm([CUP.x - fp[0], top + .03 - fp[1], CUP.z - fp[2]]), angle: .36, inner: .18, color: [.42, .36, .29], range: 3, size: .3, near: .1, manual: true, power: 0, haze: 0, bias: .0012 });

  // Things that act: a part moves per subframe, so it gets true motion blur. Steam is a card that always faces the lens.
  const metronome = { x: dx + .32, z: dz + .06 };
  const body = new Geo();
  body.s({ room: ID });
  body.with({ c: '#2a160b', mat: MAT.wood, r: .34 }, () => body.at([metronome.x, top, metronome.z], () => body.lathe([[.056, 0], [.056, .012], [.04, .012], [.016, .19], [.0, .19]], 4, PI / 4, PI / 4 + PI * 2, .2)));
  E.addStatic(body, ID);
  const arm = part(E, ID, gg => {
    gg.s({ c: '#c9cbd0', mat: MAT.brushed, m: 1, r: .28 });
    gg.at([0, .075, 0], () => gg.cyl(.0016, .15, 8));
    gg.with({ c: '#b08d43', r: .32 }, () => gg.at([0, .112, 0], () => gg.rbox(.016, .022, .007, .002)));
  });
  const steam = part(E, ID, gg => { gg.s({ c: '#f3ece0', mat: MAT.steam, r: 1, flag: 16 }); gg.card(1, 1); });

  return {
    frame(t) {
      const k = smooth(HERO_OUT - .4, HERO_OUT + 1.6, t);
      heroKey.power = heroFill.power = 1 - k;
      pendantL.power *= mix(.52, 1, k);
      bankerL.power *= k;
    },
    sub(ts, s, N, t, eye) {
      arm.set(M.mul(M.T(metronome.x, top + .03, metronome.z + .018), M.RZ(Math.sin(ts * PI * 1.6) * .42)));
      const dc = Math.hypot(eye[0] - CUP.x, eye[1] - CUP.y, eye[2] - CUP.z), kst = mix(.4, 1, smooth(.85, 1.8, dc));
      const SW = .3 * kst, SH = .5 * kst, by = CUP.y + .0066 + .0726 + SH / 2;
      steam.set(M.trs([CUP.x, by, CUP.z], [0, Math.atan2(eye[0] - CUP.x, eye[2] - CUP.z), 0], [SW, SH, 1]));
    },
  };
}
