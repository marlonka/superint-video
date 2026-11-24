// Spread 3 of the starter book, "Der Fluss": a wooded hillside on the back fold, a river printed across the pages
// that comes out of the hills and runs to the near left corner, a stone bridge on a fold of its own, a boat that lies
// flat on the water and travels on a pull-tab. It shows the other ways of the kit: an arch cut out of a fold, a flat
// token that moves, windmill sails that turn on their own tab, birds that lift off on a word. Replace it with a chapter of the film.
import { Spread } from '../popup.js';
import { pageGround, layer, rect, rrect, circle, blob, ridge, poly, curve, arch, text, para, stroke, rgba, rnd, inside, wash, TAU } from '../paper.js';
import { person, tree, conifer, bush, bird, windowAt } from '../paperkit.js';
import { LOOK } from '../look.js';

const TX = { kapitel: 'Der Fluss', zeile: 'Was die Stadt braucht, kommt übers Wasser.', schild: 'ZUM HAFEN' };

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = u => { u = clamp(u); return u * u * (3 - 2 * u); };
const GRASS = '#b3c487', WATER = '#7fa3ad', WATER_LIGHT = '#a9c4c6';

// The river's middle line in spread millimetres: X from the gutter (left page negative), Y from the far edge.
const RIVER = [[4, 0], [0, 40], [-24, 92], [-70, 146], [-112, 196], [-132, 250]];
const half = y => 9 + y * .1;
function riverShape(ox, e = 0) {
  const L = RIVER.map(([X, Y]) => [ox + X - half(Y) - e, Y]), R = RIVER.map(([X, Y]) => [ox + X + half(Y) + e, Y]).reverse();
  return poly([...L, ...R]);
}

export function fluss(s, T) {
  const S = new Spread(s);
  S.plan = 20;
  // boot: the boat sets off under the bridge; voegel: the birds lift off from the trees.
  S.t = { boot: 3, voegel: 11 };
  const t = S.t;

  // ---- the pages: meadow, the river with its light ripples, a towpath along the near bank
  const ground = (x, W, H, side) => {
    const ox = side === 'L' ? W : 0;
    pageGround(x, W, H, side, '#efe6d2', side === 'L' ? 5 : 6);
    layer(x, GRASS, rect(0, 0, W, H), { lift: 0 });
    inside(x, rect(0, 0, W, H), () => {
      for (let i = 0; i < 300; i++) { const px = rnd(side === 'L' ? 21 : 22, i) * W, py = 60 + rnd(23, i) * (H - 60), c = ['#f4eee0', '#e8c25a', '#d98a7a'][i % 3]; layer(x, c, circle(px, py, .6 + rnd(24, i) * .6), { lift: 0, tooth: false }); }
      for (let i = 0; i < 40; i++) layer(x, '#9db574', blob(rnd(25 + (side === 'L' ? 0 : 9), i) * W, 40 + rnd(26, i) * (H - 40), 6 + rnd(27, i) * 8, 2.5 + rnd(28, i) * 2, i), { lift: 0 });
    });
    // The bank is a little darker than the meadow, then the water.
    layer(x, '#8f9f6a', riverShape(ox, 2.4), { lift: 0 });
    inside(x, riverShape(ox), () => {
      x.fillStyle = WATER; x.fillRect(0, 0, W, H);
      wash(0, 0, 0, H, 'rgba(60,90,100,.25)', 'rgba(200,225,225,.2)')(x);
      for (let i = 0; i < 70; i++) {
        const k = rnd(31, i), j = Math.min(RIVER.length - 2, Math.floor(k * (RIVER.length - 1))), f = k * (RIVER.length - 1) - j;
        const X = RIVER[j][0] + (RIVER[j + 1][0] - RIVER[j][0]) * f, Y = RIVER[j][1] + (RIVER[j + 1][1] - RIVER[j][1]) * f, w = half(Y) * (rnd(32, i) - .5) * 1.4;
        stroke(x, [[ox + X + w - 4, Y], [ox + X + w + 4, Y - 2]], rgba(WATER_LIGHT, .7), .5);
      }
    });
  };
  S.page('L', (x, W, H) => {
    ground(x, W, H, 'L');
    // The chapter label on the near left page, beside the river's mouth.
    layer(x, '#f4eee0', rrect(14, 186, 116, 38, 1.2), { lift: .45, sh: .4 });
    text(x, TX.kapitel, 72, 200, 14, { weight: 900, color: LOOK.signal });
    para(x, TX.zeile, 20, 213.5, 104, 4.6, { align: 'center', lead: 1.3, color: LOOK.ink });
  });
  S.page('R', (x, W, H) => {
    ground(x, W, H, 'R');
    // The towpath: a pale band from the bridge along the near bank.
    layer(x, '#d8cfb6', curve([[10, 120], [120, 150], [300, 170], [300, 182], [118, 162], [6, 132]]), { lift: 0 });
  });

  // ---- the back fold: sky, hills and a wood; the river comes out of the hills at the crease
  S.vfold('wald', { z: -.098, alpha: 81, dir: 1, wL: .28, wR: .28, h: .17, color: '#ddd3bf', draw(x, W, H) {
    const C = W / 2;
    // A late afternoon sky: apricot above, pale near the hills, a low sun on the right, small clouds.
    layer(x, '#f6dcb6', rect(0, 0, W, H), { lift: 0, shade: wash(0, 0, 0, 110, 'rgba(226,150,110,.45)', 'rgba(250,236,210,.6)') });
    layer(x, '#f8dc96', circle(C + 150, 70, 15), { lift: .5 });
    for (let i = 0; i < 4; i++) layer(x, '#fbeedd', blob(60 + i * 140 + (i % 2) * 30, 30 + (i % 2) * 16, 26, 7, i + 11), { lift: .5 });
    layer(x, '#a6b98a', ridge([[0, 92], [120, 70], [240, 88], [C, 80], [400, 66], [W, 86]], H + 1), { lift: .7 });
    layer(x, '#8aa56e', ridge([[0, 118], [140, 100], [C, 112], [420, 96], [W, 114]], H + 1), { lift: .7 });
    // The river leaves the hills right at the crease and runs down to the page.
    layer(x, WATER, poly([[C - 3, 112], [C + 3, 112], [C + 12, H + 1], [C - 12, H + 1]]), { lift: .3 });
    for (let i = 0; i < 26; i++) { const px = 14 + i * 21 + rnd(41, i) * 8; if (Math.abs(px - C) < 22) continue; (i % 3 ? conifer : tree)(x, px, 128 + rnd(42, i) * 18, 34 + rnd(43, i) * 18, { seed: i, c: i % 2 ? '#6f9558' : '#5f8a4e' }); }
  } });
  // The birds sit in the trees and lift off on their word: they rise and drift away to the right.
  S.stand('birds', { host: 'wald', side: 'L', u: -.2, off: .02, v: .1, w: .08, h: .03, draw(x, W, H) {
    for (let i = 0; i < 6; i++) bird(x, 7 + i * 12, 12 + (i % 2) * 7, 3.2, '#4a4440', i % 2 ? .5 : -.1);
  }, life: tt => { const k = ease((tt - t.voegel) / 4); return { dv: .05 * k, du: .14 * k, show: k < .98 }; } });

  // ---- the bridge: one fold across the gutter, its arch cut out where the river runs under it
  const BRIDGE = { z: -.03, alpha: 78, dir: 1, wL: .1, wR: .07, h: .046 };
  S.vfold('bridge', { ...BRIDGE, lock: .08, color: '#b9ab92', draw(x, W, H) {
    const c = BRIDGE.wL * 1000, ax = c - 30, aw = 36, deck = 12;
    const stone = x => { x.rect(0, deck, W, H - deck); x.moveTo(ax - aw / 2, H + .1); x.lineTo(ax - aw / 2, H - 14); x.arc(ax, H - 14, aw / 2, Math.PI, 0, false); x.lineTo(ax + aw / 2, H + .1); x.closePath(); };
    layer(x, '#c9b89a', stone, { lift: .4, rule: 'evenodd' });
    inside(x, x => { stone(x); }, () => {
      x.strokeStyle = 'rgba(90,70,45,.2)'; x.lineWidth = .35;
      for (let y = deck + 4; y < H; y += 4.2) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); for (let k = (y / 4.2) % 2 ? 0 : 4; k < W; k += 8) { x.beginPath(); x.moveTo(k, y - 4.2); x.lineTo(k, y); x.stroke(); } }
    });
    // Voussoirs round the arch, the deck and its railing.
    for (let i = 0; i <= 10; i++) { const a = Math.PI + i / 10 * Math.PI, r0 = aw / 2, r1 = aw / 2 + 4; layer(x, i % 2 ? '#d6c6a6' : '#c2b190', poly([[ax + Math.cos(a - .14) * r0, H - 14 + Math.sin(a - .14) * r0], [ax + Math.cos(a + .14) * r0, H - 14 + Math.sin(a + .14) * r0], [ax + Math.cos(a + .14) * r1, H - 14 + Math.sin(a + .14) * r1], [ax + Math.cos(a - .14) * r1, H - 14 + Math.sin(a - .14) * r1]]), { lift: .3 }); }
    layer(x, '#a8977c', rect(0, deck - 1.5, W, 3), { lift: .3 });
    for (let k = 3; k < W; k += 6) layer(x, '#8f7f66', rect(k, 2, 1.2, deck - 3), { lift: .2 });
    layer(x, '#8f7f66', rect(0, 1, W, 1.6), { lift: .25 });
  } });
  S.stand('sign', { host: 'bridge', side: 'R', u: .02, off: .022, w: .036, h: .046, lock: .14, draw(x, W, H) {
    layer(x, '#7a5a3a', rect(W / 2 - 1, 10, 2, H - 10), { lift: .3 });
    layer(x, '#f4eee0', poly([[3, 4], [W - 7, 4], [W - 2, 9.5], [W - 7, 15], [3, 15]]), { lift: .4 });
    text(x, TX.schild, W / 2 - 2, 9.7, 3.9, { font: 'Jost', weight: 700, track: .3, color: LOOK.ink });
  }, life: tt => ({ rot: Math.sin(tt * 1.4) * .012 }) });

  // ---- a windmill on the right bank, a figure on the towpath
  S.stand('mill', { host: 'wald', side: 'R', u: .1, off: .07, w: .05, h: .075, lock: .1, draw(x, W, H) {
    // A tower mill: a tapered tower of tarred boards, a white cap, a door and one lit window.
    layer(x, '#8a6a4e', poly([[10, H], [40, H], [34, 24], [16, 24]]), { lift: .4 });
    inside(x, poly([[10, H], [40, H], [34, 24], [16, 24]]), () => { x.strokeStyle = 'rgba(40,25,15,.25)'; x.lineWidth = .3; for (let y = 27; y < H; y += 3) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); } });
    layer(x, '#efe6d2', x => { x.moveTo(13, 25); x.quadraticCurveTo(25, 12, 37, 25); x.closePath(); }, { lift: .4 });
    layer(x, '#4a3a2c', arch(21, H - 12, 8, 12), { lift: .2 });
    windowAt(x, 22.5, 40, 5, 6, { lit: '#f3d58a' });
    bush(x, 4, H, 10, 6); bush(x, 45, H, 9, 5);
  } });
  // The sails turn on a tab of their own, around the hub at the top of the tower.
  S.stand('sails', { host: 'wald', side: 'R', u: .09, off: .074, v: .014, w: .07, h: .07, lock: .12, pivot: [.035, .035], draw(x, W, H) {
    const c = W / 2;
    for (let i = 0; i < 4; i++) {
      x.save(); x.translate(c, c); x.rotate(i * TAU / 4);
      layer(x, '#6a5038', rect(-.9, 2, 1.8, c - 2), { lift: .3 });
      layer(x, '#f1ead8', rect(.9, 7, 6, c - 9), { lift: .3 });
      inside(x, rect(.9, 7, 6, c - 9), () => { x.strokeStyle = 'rgba(90,70,45,.45)'; x.lineWidth = .3; for (let y = 10; y < c - 2; y += 4) { x.beginPath(); x.moveTo(.9, y); x.lineTo(6.9, y); x.stroke(); } x.beginPath(); x.moveTo(3.9, 7); x.lineTo(3.9, c - 2); x.stroke(); });
      x.restore();
    }
    layer(x, '#4a3a2c', circle(c, c, 2.4), { lift: .35 });
  }, life: tt => ({ rot: -tt * .55 }) });
  S.stand('walker', { host: 'bridge', side: 'R', u: .05, off: .05, w: .03, h: .04, lock: .16, draw(x, W, H) {
    person(x, W / 2, H, 30, { top: '#4f6f8a', bottom: '#3a3530', kind: 'jacket', hairStyle: 'cap', hair: '#4a3020', face: -1, pose: 'walk' });
  }, life: tt => ({ du: .03 * ease((tt - t.boot - 3) / 8) }) });

  // ---- the boat: a flat token on the water, seen from above, on a pull-tab from the bridge to the near corner
  const A = [250, 116], B = [178, 206], ang = Math.atan2(B[1] - A[1], B[0] - A[0]);
  S.flat('boat', { side: 'L', x: A[0] - 22, y: A[1] - 22, w: .044, h: .044, draw(x, W, H) {
    x.save(); x.translate(W / 2, H / 2); x.rotate(ang); x.scale(1.4, 1.4);
    // The wake first, then the hull, the deck, the cabin.
    for (const f of [-1, 1]) stroke(x, [[-6, 0], [-15, f * 4.5]], 'rgba(235,245,245,.75)', .6);
    layer(x, '#7a4a32', x => { x.moveTo(11, 0); x.quadraticCurveTo(6, -4.4, -7, -3.6); x.lineTo(-8, 3.6); x.quadraticCurveTo(6, 4.4, 11, 0); x.closePath(); }, { lift: .5 });
    layer(x, '#c9a26e', x => { x.moveTo(9, 0); x.quadraticCurveTo(5, -3.2, -6, -2.7); x.lineTo(-6.6, 2.7); x.quadraticCurveTo(5, 3.2, 9, 0); x.closePath(); }, { lift: .2 });
    layer(x, '#e9e1cf', rrect(-4.6, -2, 6, 4, .6), { lift: .4 });
    layer(x, '#a8432f', rect(-4.6, -2, 6, .9), { lift: .1, tooth: false });
    x.restore();
  }, life: tt => { const k = ease((tt - t.boot) / 6); return { dx: (B[0] - A[0]) * k, dy: (B[1] - A[1]) * k, rot: Math.sin(tt * 1.7) * .03 }; } });

  // ---- the camera: wide, down to the bridge as the boat sets off, along with it to the near corner, up to the birds, wide.
  S.cam = t => [
    [-1.7, [0, .5, .68], [0, .03, -.02], .52, .0024],
    [1.2, [-.02, .44, .62], [-.01, .04, -.03], .5, .0026],
    [t.boot - .2, [-.03, .2, .27], [-.05, .012, -.005], .43, .003],
    [t.boot + 5.5, [-.09, .19, .33], [-.12, .006, .08], .43, .003],
    [t.voegel - .4, [-.08, .26, .36], [-.1, .09, -.08], .45, .003],
    [S.plan - .4, [0, .44, .66], [0, .05, -.03], .5, .0026],
  ];
  return S;
}
