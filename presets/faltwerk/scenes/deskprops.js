// What a paper engineer keeps within reach: pencils, a bone folder, a knife, a steel rule, and offcuts of the
// papers the book is made of. Everything lies on the desk top (y = 0) and is built the way the thing is built.
import { MAT } from './geo.js';
import { PI, TAU, hash } from './m.js';
import { LOOK } from './look.js';

// A pencil. Its point is at the origin, it runs along +y. len in metres.
function pencilBody(g, len, body) {
  const R = .0037;
  g.with({ c: '#2a2a2e', mat: MAT.plain, r: .45 }, () => g.at([0, .0025, 0], () => g.cyl(.0003, .005, 8, .0011)));
  g.with({ c: '#d8b98c', mat: MAT.plain, r: .8 }, () => g.at([0, .015, 0], () => g.cyl(.0011, .02, 12, R)));
  g.with({ c: body, mat: MAT.plain, r: .32, flag: 64 }, () => g.at([0, (.025 + len - .02) / 2, 0], () => g.cyl(R, len - .045, 6)));
  g.with({ c: '#c8a85a', mat: MAT.brushed, m: 1, r: .3 }, () => g.at([0, len - .014, 0], () => g.cyl(.0039, .012, 14)));
  g.with({ c: '#c76f6a', mat: MAT.plain, r: .8 }, () => g.at([0, len - .004, 0], () => g.rcyl(.0036, .008, .0012, 14)));
}
// Lying on the desk at (x, z), pointing along ry (0: the point looks to -x).
export function pencil(g, x, z, ry, body = '#b8862e', len = .176) {
  g.at([x, .0033, z], [0, ry, 0], () => g.at([0, 0, 0], [0, 0, PI / 2], () => pencilBody(g, len, body)));
}
// A bone folder: a flat blade of bone, pointed at one end, round at the other.
export function boneFolder(g, x, z, ry) {
  const o = [[0, 0]];
  for (let i = 1; i <= 8; i++) { const u = i / 8; o.push([.05 * u, -.0105 * Math.sin(u * PI / 2)]); }
  o.push([.142, -.0105]);
  for (let i = 1; i < 10; i++) { const a = -PI / 2 + i / 10 * PI; o.push([.142 + Math.cos(a) * .0105, Math.sin(a) * .0105]); }
  o.push([.142, .0105]);
  for (let i = 7; i >= 1; i--) { const u = i / 8; o.push([.05 * u, .0105 * Math.sin(u * PI / 2)]); }
  g.with({ c: '#e9dcbf', mat: MAT.plain, r: .22, flag: 64 }, () => g.at([x, .0019, z], [0, ry, 0], () => g.at([0, 0, 0], [-PI / 2, 0, 0], () => g.prism(o, .0034))));
}
// A craft knife: knurled aluminium handle, a collar, a short steel blade.
export function knife(g, x, z, ry) {
  g.at([x, .0046, z], [0, ry, 0], () => g.at([0, 0, 0], [0, 0, PI / 2], () => {
    g.with({ c: '#aeb2b6', mat: MAT.brushed, m: 1, r: .42 }, () => g.at([0, .083, 0], () => g.cyl(.0044, .1, 18)));
    g.with({ c: '#8e9296', mat: MAT.brushed, m: 1, r: .3 }, () => { g.at([0, .029, 0], () => g.cyl(.003, .01, 14, .0046)); g.at([0, .134, 0], () => g.rcyl(.0044, .003, .001, 16)); });
    g.with({ c: '#c9ccd0', mat: MAT.steel, m: 1, r: .2 }, () => g.at([0, 0, 0], [0, PI / 2, 0], () => g.prism([[0, 0], [.0052, .024], [-.0016, .024], [-.0016, .008]], .0005)));
  }));
}
// The steel rule's face: centimetres and millimetres along the far edge.
export function paintRule() {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
  x.fillStyle = '#b4b8bc'; x.fillRect(0, 0, 1024, 96);
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${hash(i) > .5 ? '255,255,255' : '40,44,48'},${.03 + hash(i * 3.1) * .05})`; x.fillRect(0, hash(i * 7.7) * 92, 1024, 1); }
  x.fillStyle = '#23262a'; x.font = '600 20px Jost, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'top';
  const mm = 1024 / 310;
  for (let i = 0; i <= 300; i++) { const px = 5 * mm + i * mm, h = i % 10 === 0 ? 30 : i % 5 === 0 ? 21 : 13; x.fillRect(px - .7, 0, 1.4, h); if (i % 10 === 0 && i > 0 && i < 300) x.fillText(String(i / 10), px, 34); }
  return c;
}
export function rule(g, x, z, ry, tex) {
  const w = .31, d = .0285, t = .0009;
  g.at([x, 0, z], [0, ry, 0], () => {
    g.with({ c: '#b4b8bc', mat: MAT.brushed, m: 1, r: .4 }, () => g.at([0, t / 2, 0], () => g.box(w, t, d, 1 | 2 | 16 | 32)));
    g.with({ c: '#b4b8bc', mat: MAT.brushed, m: 1, r: .4, tex }, () => g.rect([-w / 2, t, -d / 2], [w / 2, t, -d / 2], [w / 2, t, d / 2], [-w / 2, t, d / 2], [0, 1, 0], [0, 0, 1, 92 / 1024]));
  });
}
// A glazed jar with pencils, a brush and the handles of a pair of scissors.
export function jar(g, x, z) {
  g.at([x, 0, z], () => {
    g.with({ c: '#23414d', mat: MAT.plain, r: .16, flag: 64 }, () => g.lathe([[0, 0], [.035, 0], [.038, .003], [.039, .012], [.039, .088], [.0375, .094], [.0345, .094], [.034, .088], [.034, .012], [0, .012]], 40, 0, TAU, .9));
    g.with({ c: '#0c0e10', mat: MAT.plain, r: .9 }, () => g.at([0, .05, 0], () => g.cyl(.0338, .001, 28)));
    const P = [['#b8862e', -.012, .008, .16, -.1, 1], ['#7a2f2a', .014, -.006, .2, .13, 0], ['#2f4a5a', .002, -.016, -.12, -.16, 1], ['#3f5a3a', -.016, -.012, .07, .2, 0], ['#b8862e', .016, .012, -.2, .06, 1]];
    for (const [c, px, pz, rx, rz, up] of P) g.at([px, up ? .012 : .188, pz], [rx, 0, up ? rz : PI + rz], () => pencilBody(g, .176, c));
    // A flat brush: wooden handle, ferrule, bristles.
    g.at([-.004, .012, .018], [.2, 0, .05], () => {
      g.with({ c: '#6a2a20', mat: MAT.plain, r: .3, flag: 64 }, () => g.at([0, .075, 0], () => g.cyl(.0026, .15, 10, .0042)));
      g.with({ c: '#c9ccd0', mat: MAT.brushed, m: 1, r: .3 }, () => g.at([0, .162, 0], () => g.box(.012, .024, .0046)));
      g.with({ c: '#3a2a1c', mat: MAT.fabric, r: .9 }, () => g.at([0, .186, 0], () => g.box(.0125, .026, .0036)));
    });
    // Scissors, blades down: only the two handle loops and the pivot show.
    g.at([.018, .104, .014], [0, .5, .06], () => {
      g.with({ c: '#15171a', mat: MAT.plain, r: .35 }, () => { for (const s of [-1, 1]) { g.at([s * .017, .034, 0], [PI / 2, 0, 0], () => g.torus(.0125, .0032, 28, 10)); g.at([s * .0085, .01, 0], [0, 0, s * .42], () => g.rbox(.0052, .03, .0036, .001, 1)); } });
      g.with({ c: '#c9ccd0', mat: MAT.steel, m: 1, r: .22 }, () => { for (const s of [-1, 1]) g.at([s * .002, -.014, 0], [0, 0, s * .1], () => g.box(.007, .03, .0012)); g.at([0, -.004, .001], [PI / 2, 0, 0], () => g.cyl(.0022, .003, 12)); });
    });
  });
}
// Offcuts: what the knife left of the book's own papers, trimmed against the steel rule. Straight cut edges, the
// cream card of the pages, the map's buff, a little of the red; one long trimming has curled up as paper does.
export function offcuts(g, x, z, seed = 1) {
  const CREAM = '#efe6d2', BUFF = '#e8d5a2', SKY = '#d5e6cf', GREEN = '#9aa3a6';
  const flat = (px, pz, ry, c, parts, i) => g.with({ c, mat: MAT.paper, r: .88 }, () => g.at([x + px, .00022 + i * .00036, z + pz], [0, ry, 0], () => g.at([0, 0, 0], [-PI / 2, 0, 0], () => { for (const pts of parts) g.prism(pts, .0003); })));
  // The sheet an index card was cut from: cream card with the opening left in it (four pieces round the hole).
  const a = .025, b = .057, t = .026, bt = .056, ap = .013;
  flat(.07, -.074, .22 + PI, CREAM, [[[0, 0], [a, 0], [a, .07], [0, .07]], [[b, 0], [.09, 0], [.09, .07], [b, .07]], [[a, bt], [b, bt], [b, .07], [a, .07]], [[a, 0], [b, 0], [b, t], [a, t]]], 0);
  // A trimming from the fore-edge of a page, and a strip of manila.
  flat(-.07, .03, -.12, CREAM, [[[0, 0], [.1, .0012], [.1, .0062], [0, .0071]]], 1);
  flat(.045, .038, -.5, BUFF, [[[0, 0], [.062, 0], [.058, .0085], [0, .0074]]], 2);
  // Small triangles left at the corners of cut shapes: manila, the pale green of listing paper, a sliver of steel grey.
  flat(.072, -.012, 1.9, BUFF, [[[0, 0], [.026, 0], [.004, .017]]], 3);
  flat(.06, .018, .7, SKY, [[[0, 0], [.019, 0], [.016, .011]]], 4);
  flat(-.072, -.01, 2.6, GREEN, [[[0, 0], [.022, .003], [.003, .008]]], 5);
  // A strip of the binding's green, its end lifting a little where it was curled on the roll.
  const curl = (px, pz, ry, c, L, w, lift) => g.with({ c, mat: MAT.paper, r: .88 }, () => g.at([x + px, lift, z + pz], [0, ry, 0], () => g.surf((u, v) => {
    const s = u * L, f = Math.max(0, u - .6) / .4;
    return [s - f * f * .004, .0003 + f * f * .009, (v - .5) * w];
  }, 40, 2)));
  curl(-.06, .052, .08, '#2f5f4f', .12, .011, .0007);
}
// A spool of linen thread for sewing the sections, with its needle: the book is sewn by hand.
export function spool(g, x, z, ry = 0) {
  g.at([x, 0, z], [0, ry, 0], () => {
    g.with({ c: '#9a6a3e', mat: MAT.fineWood, r: .45 }, () => {
      g.at([0, .0016, 0], () => g.rcyl(.0135, .0032, .0008, 28));
      g.at([0, .0264, 0], () => g.rcyl(.0135, .0032, .0008, 28));
    });
    g.with({ c: '#e2d6bc', mat: MAT.fabric, r: .9 }, () => g.at([0, .014, 0], () => g.cyl(.0118, .0216, 32)));
    g.with({ c: '#2a2018', mat: MAT.plain, r: .6 }, () => g.at([0, .0285, 0], () => g.cyl(.0034, .0004, 16)));
    // The loose end runs down the spool and across the desk.
    g.with({ c: '#e2d6bc', mat: MAT.fabric, r: .9 }, () => g.tube([[.0118, .02, .002], [.0122, .008, .004], [.016, .0006, .008], [.034, .0006, .016], [.052, .0006, .012], [.066, .0006, .02]], .00045, 6));
    // The needle, lying where the thread ends.
    g.with({ c: '#c9ccd0', mat: MAT.steel, m: 1, r: .18 }, () => g.at([.078, .0006, .026], [0, -.35, PI / 2], () => { g.cyl(.00045, .05, 8); g.at([0, .026, 0], () => g.cyl(.00045, .002, 8, .0001)); }));
  });
}
