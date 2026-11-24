// Spread 2 of the starter book, "Die Stadt": a morning sky on the back fold, a row of town houses on a second fold,
// people, a van and trees on tabs, a street printed exactly under them. It uses the kit once each way: replace it with
// the film's first chapter (one spread per chapter of the script), and keep what it shows about building one.
// S.t holds the named moments in seconds after the spread lies open; tools/after_voice.py sets them to words of the
// voice (MOMENTS there), and world.js stretches the camera keys to the time the spread really stays open.
import { Spread } from '../popup.js';
import { pageGround, layer, rect, rrect, circle, blob, ridge, poly, text, para, tone, rgba, rnd, inside, wash } from '../paper.js';
import { person, bag, basket, tree, conifer, bush, cloud, bird, house, lampPost, van, bicycle } from '../paperkit.js';
import { LOOK } from '../look.js';

// Printed words, in one place. Every fact, number and name a film prints must be in research.md.
const TX = { kapitel: 'Die Stadt', zeile: 'Am Morgen wacht die Straße auf.' };

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = u => { u = clamp(u); return u * u * (3 - 2 * u); };
const GRASS = '#b7c88c', STREET = '#c9c0ae', KERB = '#ddd5c3';

export function stadt(s, T) {
  const S = new Spread(s);
  S.plan = 20;
  // sonne: the sun comes up behind the hills; wagen: the van drives off. Sound effects go on the same seconds.
  S.t = { sonne: 3.5, wagen: 9 };
  const t = S.t;

  // ---- the street, printed exactly where the houses meet the page (S.spot), and the grass in front of it
  const band = (side, u0, u1, o0, o1) => poly([S.spot('town', side, u0, o0), S.spot('town', side, u1, o0), S.spot('town', side, u1, o1), S.spot('town', side, u0, o1)]);
  const ground = (x, W, H, side) => {
    pageGround(x, W, H, side, '#efe6d2', side === 'L' ? 2 : 3);
    layer(x, GRASS, rect(0, 70, W, H), { lift: 0 });
    // Meadow print: soft stripes of mown grass and small flowers.
    inside(x, rect(0, 70, W, H), () => {
      for (let i = 0; i < 9; i++) { x.fillStyle = `rgba(80,110,50,${.04 + .03 * (i % 2)})`; x.fillRect(0, 150 + i * 10, W, 5); }
      for (let i = 0; i < 260; i++) { const px = rnd(side === 'L' ? 7 : 8, i) * W, py = 150 + rnd(9, i) * (H - 152), c = ['#f4eee0', '#e8c25a', '#d98a7a', '#c9b8e0'][i % 4]; layer(x, c, circle(px, py, .7 + rnd(10, i) * .6), { lift: 0, tooth: false }); }
    });
    const u1 = side === 'L' ? -.235 : .25;
    layer(x, STREET, band(side, .004 * Math.sign(u1), u1, -.002, .052), { lift: 0 });
    layer(x, KERB, band(side, .004 * Math.sign(u1), u1, .052, .058), { lift: 0 });
    // Joints of the paving and the line in the middle of the road.
    inside(x, band(side, 0, u1, -.002, .052), () => {
      x.strokeStyle = 'rgba(80,70,55,.14)'; x.lineWidth = .3;
      for (let k = 0; k < 40; k++) { const u = u1 * k / 40, [ax, ay] = S.spot('town', side, u, 0), [bx, by] = S.spot('town', side, u, .052); x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke(); }
    });
    for (let k = 0; k < 9; k++) { const u = u1 * (k + .2) / 9, v = u1 * (k + .6) / 9; layer(x, '#f1ecdf', poly([S.spot('town', side, u, .027), S.spot('town', side, v, .027), S.spot('town', side, v, .03), S.spot('town', side, u, .03)]), { lift: 0, tooth: false }); }
  };
  S.page('L', (x, W, H) => {
    ground(x, W, H, 'L');
    // The chapter on a paper label glued on the near left page, the way every spread of the book names itself.
    layer(x, '#f4eee0', rrect(28, 182, 150, 40, 1.2), { lift: .45, sh: .4 });
    text(x, TX.kapitel, 103, 197, 15, { weight: 900, color: LOOK.signal });
    text(x, TX.zeile, 103, 213, 6.4, { weight: 600, color: LOOK.ink });
  });
  S.page('R', (x, W, H) => {
    ground(x, W, H, 'R');
    for (const [cx, cy, w] of [[60, 196, 26], [150, 214, 34], [236, 190, 24]]) layer(x, '#93ad6b', blob(cx, cy, w / 2, w / 4, cx), { lift: 0 });
  });

  // ---- the back fold: the morning sky with hills; it spans both pages and stands up as the book opens
  S.vfold('sky', { z: -.095, alpha: 80, dir: 1, wL: .27, wR: .27, h: .19, color: '#e4dccb', draw(x, W, H) {
    layer(x, '#cfe0e6', x => { x.moveTo(0, H); x.lineTo(0, 52); x.quadraticCurveTo(W / 2, -36, W, 52); x.lineTo(W, H); x.closePath(); }, { lift: 0, shade: wash(0, 0, 0, H, 'rgba(255,236,200,0)', 'rgba(255,226,180,.35)') });
    for (let i = 0; i < 5; i++) cloud(x, 50 + i * 108, 58 + (i % 2) * 22, 46 + (i % 3) * 8);
  } });
  // Hills on a layer of their own in front of the sky, so the sun can rise behind them.
  for (const side of ['L', 'R']) S.stand('hills' + side, { host: 'sky', side, u: side === 'L' ? -.268 : 0, off: .012, v: 0, w: .268, h: .085, color: '#9fb57a', draw(x, W, H) {
    layer(x, '#a9bf84', ridge(side === 'L' ? [[0, 44], [70, 26], [150, 40], [W, 30]] : [[0, 30], [90, 42], [180, 22], [W, 38]], H + 1), { lift: .6 });
    layer(x, '#8fab6c', ridge(side === 'L' ? [[0, 62], [90, 50], [190, 60], [W, 52]] : [[0, 52], [110, 62], [200, 48], [W, 58]], H + 1), { lift: .6 });
  } });
  S.stand('sun', { host: 'sky', side: 'R', u: .1, off: .006, v: .03, w: .046, h: .046, e: .35, color: '#f3d98a', draw(x, W, H) {
    layer(x, '#f6dc8c', circle(W / 2, H / 2, W / 2 - 1), { lift: .4 });
    layer(x, '#f9e6a8', circle(W / 2 - 3, H / 2 - 3, W / 2 - 8), { lift: .3 });
  }, life: tt => ({ dv: .07 * ease((tt - t.sonne) / 2.6), glow: .4 + .6 * ease((tt - t.sonne) / 2.6) }) });
  S.stand('birds', { host: 'sky', side: 'L', u: -.16, off: .02, v: .12, w: .07, h: .03, draw(x, W, H) {
    for (let i = 0; i < 5; i++) bird(x, 8 + i * 13, 10 + (i % 2) * 8, 3.4, '#4a4440', i % 2 ? .4 : -.2);
  }, life: tt => ({ du: .012 * Math.sin(tt * .5), dv: .004 * Math.sin(tt * 1.3) }) });

  // ---- the town: a second fold in front of the sky, 3 degrees steeper so the two never lie parallel
  S.vfold('town', { z: -.03, alpha: 77, dir: 1, wL: .22, wR: .23, h: .12, lock: .05, color: '#d9cbb3', draw(x, W, H) {
    const lit = k => (i, j) => (i * 3 + j + k) % 4 === 0;
    house(x, 6, H, 46, 92, { wall: '#d9a37a', roof: '#7a3f33', floors: 3, cols: 3, brick: true, curtain: '#f4eee0', lit: lit(0) });
    house(x, 54, H, 50, 104, { wall: '#e8d3a0', roof: '#5f6a70', floors: 4, cols: 3, roofKind: 'mansard', lit: lit(1) });
    house(x, 106, H, 42, 84, { wall: '#c9d3b0', roof: '#8a4a3a', floors: 3, cols: 2, roofKind: 'step' });
    house(x, 150, H, 56, 96, { wall: '#d8c2b2', roof: '#6a4038', floors: 3, cols: 4, lit: lit(2) });
    // The crease runs at x = wL * 1000 = 220: no door, sign or face sits on it.
    house(x, 208, H, 30, 80, { wall: '#cbbfa4', roof: '#5f6a70', floors: 3, cols: 1, roofKind: 'flat' });
    house(x, 240, H, 50, 108, { wall: '#b9c7d2', roof: '#4f5a60', floors: 4, cols: 3, roofKind: 'flat', lit: lit(3) });
    house(x, 292, H, 52, 88, { wall: '#e3b08a', roof: '#7a3f33', floors: 3, cols: 3, brick: true });
    house(x, 346, H, 48, 100, { wall: '#d9cfa8', roof: '#5f6a70', floors: 3, cols: 3, roofKind: 'mansard', lit: lit(1) });
    house(x, 396, H, 52, 90, { wall: '#cfa78f', roof: '#8a4a3a', floors: 3, cols: 3 });
  } });

  // ---- what stands in the street: every piece on a tab of its host, its feet on the printed street
  S.stand('people', { host: 'town', side: 'L', u: -.2, off: .036, w: .15, h: .045, lock: .12, draw(x, W, H) {
    person(x, 14, H, 34, { top: '#8a3b2e', bottom: '#3a3530', kind: 'coat', hairStyle: 'bob', hair: '#6a3a22', armR: 'bag', hold: bag('#d9b25a'), pose: 'walk' });
    person(x, 40, H, 36, { top: '#f4f1e8', bottom: '#4a4a52', kind: 'kittel', hairStyle: 'side', hair: '#2a2018', armR: 'up' });
    person(x, 64, H, 33, { top: '#d9a441', bottom: '#5a3a2a', kind: 'dress', hairStyle: 'long', hair: '#b8873a', face: -1, armL: 'carry', hold: basket() });
    person(x, 86, H, 23, { top: '#4f7fa8', bottom: '#3a4a5a', kind: 'shirt', child: true, hairStyle: 'short', hair: '#4a3020', face: -1, pose: 'walk' });
    person(x, 110, H, 37, { top: '#4a5a4a', bottom: '#2f2f35', kind: 'jacket', hairStyle: 'hat', hair: '#555', face: -1 });
    lampPost(x, 134, H, 42);
  }, life: tt => ({ du: .004 * Math.sin(tt * .9) }) });
  S.stand('trees', { host: 'town', side: 'L', u: -.06, off: .062, w: .05, h: .07, lock: .16, draw(x, W, H) { tree(x, W / 2, H, 66, { seed: 3 }); bush(x, 10, H, 16, 9); }, life: tt => ({ rot: Math.sin(tt * 1.1) * .015 }) });
  // The van drives off on its moment: it slides along its tab, slowly at first, and is gone past the page edge.
  S.stand('van', { host: 'town', side: 'R', u: .03, off: .03, w: .12, h: .05, lock: .1, draw(x, W, H) {
    van(x, 4, H, 70, { band: '#a8432f' }); bicycle(x, 98, H, 26);
  }, life: tt => { const k = clamp((tt - t.wagen) / 3.2); return { du: .16 * k * k, show: k < .99 }; } });
  S.stand('trees2', { host: 'town', side: 'R', u: .17, off: .045, w: .06, h: .09, lock: .2, draw(x, W, H) { tree(x, W / 2 - 8, H, 80, { seed: 5, c: '#7aa35a' }); conifer(x, W - 12, H, 60); }, life: tt => ({ rot: Math.sin(tt * 1.3) * .02 }) });

  // ---- the camera: wide while it rises, then to the sun, down to the street for the van, wide again before the turn.
  // [tau, eye, at, fov, aperture]; tau in seconds after landing, in planned time. Eye height never below 0.11.
  S.cam = t => [
    [-1.7, [0, .5, .68], [0, .03, -.02], .52, .0024],
    [1.2, [0, .46, .64], [0, .04, -.03], .5, .0026],
    [t.sonne + .4, [.06, .3, .4], [.07, .08, -.07], .44, .003],
    [t.wagen - .2, [.1, .2, .34], [.05, .035, -.005], .42, .003],
    [Math.min(t.wagen + 4, S.plan - 1.4), [.04, .22, .36], [.01, .035, -.01], .42, .003],
    [S.plan - .4, [0, .44, .66], [0, .05, -.03], .5, .0026],
  ];
  return S;
}
