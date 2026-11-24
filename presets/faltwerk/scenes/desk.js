// The place: a paper maker's desk in the evening. A brass lamp is the light of the film.
import { Geo, MAT } from './geo.js';
import { lin, PI } from './m.js';
import * as P from './props.js';
import { paintSpines, paintCrema, paintCane } from './paint.js';
import { pencil, boneFolder, knife, rule, paintRule, jar, offcuts, spool } from './deskprops.js';

const norm = a => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };

export function buildDesk(ctx) {
  const { E, rooms, lights, ROOM } = ctx;
  const ID = ROOM.DESK;
  P.setPropDocs({ spines: E.addDoc(paintSpines(P.SPINE_COLS, P.SPINE_ROWS)), crema: E.addDoc(paintCrema()), cane: E.addDoc(paintCane()) });

  const out = new Geo(); out.s({ room: ROOM.EXT });
  out.with({ c: '#05070a', mat: MAT.plain, flag: 32 }, () => out.at([0, 2, -6], () => out.card(30, 12)));
  E.addStatic(out, ROOM.EXT);
  rooms[ROOM.EXT] = { up: lin('#0c1016'), dn: lin('#060606'), fill: [.004, .005, .007], power: 1, gloss: .5, min: [-40, -3, -40], max: [40, 30, 40] };

  const g = new Geo(); g.s({ room: ID });
  // The desk top: old oak under lacquer. Its top lies at y = 0.
  g.with({ c: '#4a2a17', mat: MAT.wood, r: .5, grain: 0, flag: 128 }, () => g.at([0, -.03, -.05], () => g.rbox(3.2, .06, 1.9, .006)));
  // The wall behind: dark, so the lamp's circle is the stage.
  g.with({ c: '#1c2d33', mat: MAT.plaster, r: .92, flag: 32 }, () => g.at([0, .9, -1.02], () => g.box(4.4, 2.6, .04)));
  // Books at the back of the desk and the lamp: out of focus, they give the picture depth.
  P.bookRow(g, -.2, .62, 0, -.66, 5.3, .25, ['#12161f', '#7c1a14', '#1a4a2e', '#3a1510', '#b5851f', '#141820', '#691410', '#183a28', '#54200f', '#a87a1c'], { hi: true });
  P.bankerLamp(g, -.62, 0, -.46, .5);
  P.paperStack(g, .78, 0, -.34, .21, .297, 22, 2.1);
  // The paper engineer's tools, around the book but never on it.
  jar(g, .4, -.36);
  offcuts(g, .2, -.3, 3);
  spool(g, .3, -.37, .4);
  rule(g, -.17, -.2, .012, E.addDoc(paintRule())); knife(g, -.3, -.25, PI + .05); pencil(g, -.02, -.252, .06, '#b8862e');
  boneFolder(g, .37, -.215, PI - .1);
  E.addStatic(g, ID);

  rooms[ID] = { up: lin('#2e2a24').map(v => v * .8), dn: lin('#3a2416').map(v => v * .7), fill: [.03, .028, .024], power: 1, gloss: .9, min: [-3, -1.2, -3], max: [3, 3.4, 3] };
  const box = { boxMin: [-3, -1, -3], boxMax: [3, 3.4, 3] };
  const add = o => { const l = { room: ID, ...box, power: 1, base: 1, near: .05, ...o }; lights.push(l); return l; };
  // Key: the desk lamp, warm, from the back left. Its size makes the shadows of the paper soft.
  const kp = [-.72, .78, -.5];
  add({ pos: kp, dir: norm([-kp[0], .02 - kp[1], -.02 - kp[2]]), angle: .62, inner: .34, color: [10.5, 8, 5.3], range: 6, size: .07, near: .2, bias: .0012 });
  // The lamp on the desk lights its own corner.
  add({ pos: [-.6, .3, -.44], dir: norm([.1, -1, .08]), angle: 1.1, inner: .6, color: [.5, .38, .24], range: 3, size: .06, bias: .0015 });
  // Fill: a big soft light from above the viewer, the room's own evening light.
  add({ pos: [.35, 1.25, .95], dir: norm([-.35, -1.2, -.95]), angle: .6, inner: .35, color: [3.6, 3.9, 4.6], range: 6, size: .38, near: .3, bias: .0016 });
  // Rim: a cool edge from the back right, so standing paper separates from the dark wall.
  add({ pos: [1.05, .5, -.75], dir: norm([-1.05, -.42, .72]), angle: .5, inner: .3, color: [1.5, 2.1, 3.2], range: 5, size: .12, near: .2, bias: .0014 });
  // A soft light that sits where the camera's mirror image is: it lays a sheen on the gold of the binding.
  // Kept below the point where gold clips: the sheen travels, it never flares.
  const glint = add({ pos: [0, .4, -.8], dir: [0, -1, 0], angle: .36, inner: .2, color: [.8, .63, .42], range: 4, size: .17, near: .2, bias: .0014, power: 0 });
  return { frame(t, cam, k, sweep = 0) {
    glint.power = k; if (k <= .001) return;
    const a = [cam.at[0] + sweep, 0, cam.at[2]], d = [a[0] - cam.eye[0], Math.max(.1, cam.eye[1]), a[2] - cam.eye[2]], l = Math.hypot(d[0], d[1], d[2]);
    glint.pos = [a[0] + d[0] / l * .95, d[1] / l * .95, a[2] + d[2] / l * .95];
    glint.dir = norm([a[0] - glint.pos[0], -glint.pos[1], a[2] - glint.pos[2]]);
  } };
}
