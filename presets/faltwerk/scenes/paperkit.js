// Things made of cut paper: people, trees, houses, vehicles. Millimetres, like paper.js.
// Everything is built from glued sheets (layer), from the back to the front, so each part throws its little shadow.
import { layer, inside, stroke, text, rect, rrect, circle, ellipse, poly, curve, blob, arch, tone, blend, rgba, rnd, TAU, wash } from './paper.js';

// ---------------------------------------------------------------- people
// A paper figure, H millimetres tall, standing on y = base. o:
//   skin, hair, top, bottom, shoes   colours
//   kind    'jacket' | 'coat' | 'dress' | 'kittel' (a white work coat) | 'shirt'
//   hairStyle 'short' | 'side' | 'bob' | 'long' | 'bun' | 'hat' | 'cap' | 'bald'
//   pose    'stand' | 'walk';  face  1 looks right, -1 looks left
//   armL, armR   'down' | 'bag' | 'up' | 'fwd' | 'hip' | 'carry'
//   child   shorter legs, larger head;  eyes  false for figures seen from far away
//   hold    (x, hx, hy, side) => void   draws what the hand holds
export function person(x, cx, base, H, o = {}) {
  const skin = o.skin || '#e9b999', hair = o.hair || '#3a2a20', top = o.top || '#3f5d7a', bottom = o.bottom || '#3a3530', shoes = o.shoes || '#2a2420';
  const kind = o.kind || 'jacket', f = o.face || 1, child = !!o.child, walk = o.pose === 'walk';
  const r = child ? H / 9.5 : H / 14.6;
  const headY = base - H + r, shY = headY + r * 1.42, sw = (o.wide ? .118 : .104) * H * (child ? 1.05 : 1);
  const hipY = base - (child ? .43 : .5) * H, hw = .076 * H;
  const hem = kind === 'coat' || kind === 'kittel' ? base - .3 * H : kind === 'dress' ? base - .27 * H : hipY + .035 * H;
  const dark = tone(top, -.22);
  const legW0 = .062 * H, legW1 = .038 * H, footY = base - .012 * H;
  const fx = walk ? [f * .085 * H, -f * .07 * H] : [.045 * H, -.045 * H];
  const hx = [.036 * H, -.036 * H];
  const armW = .046 * H;
  const hand = (side, mode) => {
    const sx = cx + side * (sw - armW * .3), sy = shY + armW * .55;
    if (mode === 'up') return [[sx, sy], [sx + side * .09 * H, sy - .02 * H], [sx + side * .13 * H, sy - .17 * H]];
    if (mode === 'fwd') return [[sx, sy], [sx + f * .05 * H, sy + .13 * H], [sx + f * .17 * H, sy + .12 * H]];
    if (mode === 'hip') return [[sx, sy], [sx + side * .075 * H, sy + .12 * H], [cx + side * hw * .9, hipY - .02 * H]];
    if (mode === 'carry') return [[sx, sy], [sx + side * .01 * H, sy + .14 * H], [sx - side * .05 * H, sy + .2 * H]];
    const sw2 = walk ? side * f * .05 * H : 0;
    return [[sx, sy], [sx + side * .018 * H + sw2 * .5, sy + .15 * H], [sx + side * .012 * H + sw2, sy + .285 * H]];
  };
  const arm = (side, mode, behind) => {
    const p = hand(side, mode), c = behind ? dark : kind === 'kittel' ? tone(top, -.04) : tone(top, .04);
    const sleeveEnd = kind === 'shirt' || kind === 'dress' ? .55 : 1;
    const q = sleeveEnd < 1 ? [p[0], [p[0][0] + (p[1][0] - p[0][0]) * 1.0, p[0][1] + (p[1][1] - p[0][1]) * 1.0]] : p;
    if (sleeveEnd < 1) stroke(x, p, skin, armW * .78, { smooth: true, lift: behind ? 0 : .25 });
    stroke(x, q, c, armW, { smooth: true, lift: behind ? 0 : .3 });
    const h = p[2];
    layer(x, skin, circle(h[0], h[1], armW * .5), { lift: .15, tooth: false });
    if (o.hold && ((side === 1 && o.armR === mode) || (side === -1 && o.armL === mode))) o.hold(x, h[0], h[1], side);
  };
  // The arm away from us first, a tone darker.
  const backSide = -f;
  arm(backSide, (backSide === 1 ? o.armR : o.armL) || 'down', true);
  // Legs and shoes.
  for (const i of [1, 0]) {
    const tx = cx + hx[i], bx = cx + fx[i], c = i ? tone(bottom, -.14) : bottom;
    if (kind === 'dress' || o.skirt) {
      stroke(x, [[tx, hem - .01 * H], [bx, footY - .03 * H]], skin, legW1 * .95, { cap: 'butt' });
    } else {
      layer(x, c, poly([[tx - legW0 / 2, hipY], [tx + legW0 / 2, hipY], [bx + legW1 / 2, footY - .02 * H], [bx - legW1 / 2, footY - .02 * H]]), { lift: i ? 0 : .25 });
    }
    layer(x, shoes, x => { x.moveTo(bx - f * legW1 * .62, footY - .028 * H); x.lineTo(bx + f * (legW1 * .5 + .028 * H), footY - .028 * H); x.quadraticCurveTo(bx + f * (legW1 * .7 + .05 * H), footY - .012 * H, bx + f * (legW1 * .6 + .05 * H), base); x.lineTo(bx - f * legW1 * .62, base); x.closePath(); }, { lift: .2, tooth: false });
  }
  // Body.
  const hemW = kind === 'dress' ? .15 * H : kind === 'coat' || kind === 'kittel' ? .112 * H : hw * 1.22;
  layer(x, top, x => {
    x.moveTo(cx - sw * .42, shY - .012 * H);
    x.quadraticCurveTo(cx - sw, shY - .008 * H, cx - sw, shY + .05 * H);
    x.lineTo(cx - (kind === 'dress' ? hw * .95 : sw * .93), hipY - .07 * H);
    x.lineTo(cx - hemW, hem); x.lineTo(cx + hemW, hem);
    x.lineTo(cx + (kind === 'dress' ? hw * .95 : sw * .93), hipY - .07 * H);
    x.lineTo(cx + sw, shY + .05 * H);
    x.quadraticCurveTo(cx + sw, shY - .008 * H, cx + sw * .42, shY - .012 * H);
    x.closePath();
  }, { lift: .5 });
  // Printed detail on the body: front edge, collar, buttons, belt.
  if (kind === 'pullover') {
    // A V-neck jumper over a shirt: the shirt in the neck, its two collar points, the knitted hem.
    const sc2 = o.shirt || '#f4f1ea';
    layer(x, sc2, poly([[cx - sw * .36, shY - .014 * H], [cx, shY + .082 * H], [cx + sw * .36, shY - .014 * H]]), { lift: 0, tooth: false });
    for (const s of [-1, 1]) layer(x, tone(sc2, -.05), poly([[cx + s * sw * .44, shY - .018 * H], [cx + s * sw * .1, shY + .04 * H], [cx + s * sw * .02, shY - .018 * H]]), { lift: .15, tooth: false });
    stroke(x, [[cx - hemW * .96, hem - .018 * H], [cx + hemW * .96, hem - .018 * H]], rgba(tone(top, -.5), .4), .008 * H, { cap: 'butt' });
  }
  if (o.shirt && (kind === 'coat' || kind === 'jacket')) layer(x, o.shirt, poly([[cx - sw * .15, shY - .013 * H], [cx, shY + .045 * H], [cx + sw * .15, shY - .013 * H]]), { lift: 0, tooth: false });
  if (kind === 'coat' || kind === 'kittel' || kind === 'jacket') {
    stroke(x, [[cx + f * .004 * H, shY + .03 * H], [cx + f * .004 * H, hem]], rgba(tone(top, -.5), .55), .012 * H, { cap: 'butt' });
    layer(x, kind === 'kittel' ? tone(top, -.08) : tone(top, .16), poly([[cx - sw * .36, shY - .012 * H], [cx, shY + .085 * H], [cx + sw * .36, shY - .012 * H], [cx + sw * .12, shY - .012 * H], [cx, shY + .03 * H], [cx - sw * .12, shY - .012 * H]]), { lift: .18 });
    for (let i = 0; i < 3; i++) layer(x, kind === 'kittel' ? '#c9c2b2' : tone(top, -.4), circle(cx + f * .022 * H, shY + (.12 + i * .075) * H, .0085 * H), { lift: 0, tooth: false });
    if (o.pocket !== false) stroke(x, [[cx + .03 * H, hipY - .03 * H], [cx + .075 * H, hipY - .03 * H]], rgba(tone(top, -.5), .5), .008 * H, { cap: 'butt' });
  }
  if (o.belt) layer(x, o.belt, rect(cx - sw * .94, hipY - .095 * H, sw * 1.88, .024 * H), { lift: .15 });
  if (o.scarf) layer(x, o.scarf, x => { x.moveTo(cx - sw * .5, shY - .02 * H); x.quadraticCurveTo(cx, shY + .05 * H, cx + sw * .5, shY - .02 * H); x.lineTo(cx + sw * .46, shY + .03 * H); x.quadraticCurveTo(cx, shY + .1 * H, cx - sw * .46, shY + .03 * H); x.closePath(); }, { lift: .3 });
  // Neck and head.
  layer(x, tone(skin, -.1), rect(cx - r * .33, headY + r * .6, r * .66, r * .95), { lift: 0, tooth: false });
  layer(x, skin, ellipse(cx, headY, r * .92, r), { lift: .4, tooth: false });
  layer(x, tone(skin, -.07), circle(cx - f * r * .86, headY + r * .12, r * .17), { lift: 0, tooth: false });
  if (o.eyes !== false) {
    for (const s of [-1, 1]) layer(x, '#2a2018', circle(cx + f * r * .22 + s * r * .33, headY + r * .1, r * .085), { lift: 0, tooth: false });
    layer(x, rgba('#d98a7a', .55), circle(cx + f * r * .62, headY + r * .4, r * .16), { lift: 0, tooth: false });
    if (o.smile !== false) stroke(x, [[cx + f * r * .08, headY + r * .46], [cx + f * r * .28, headY + r * .56], [cx + f * r * .5, headY + r * .44]], rgba('#7a3a2a', .8), r * .07, { smooth: true });
  }
  // A short full beard: round the jaw and under the nose, the mouth in it.
  if (o.beard) {
    const mx = cx + f * r * .24;
    layer(x, o.beard, x => {
      x.moveTo(cx - r * .94, headY + r * .1); x.quadraticCurveTo(cx - r * 1.0, headY + r * .98, cx, headY + r * 1.08); x.quadraticCurveTo(cx + r * 1.0, headY + r * .98, cx + r * .94, headY + r * .1);
      x.quadraticCurveTo(cx + r * .8, headY + r * .52, mx + r * .44, headY + r * .36); x.quadraticCurveTo(mx, headY + r * .22, mx - r * .44, headY + r * .36); x.quadraticCurveTo(cx - r * .8, headY + r * .52, cx - r * .94, headY + r * .1); x.closePath();
    }, { lift: .12 });
    stroke(x, [[mx - r * .2, headY + r * .56], [mx, headY + r * .63], [mx + r * .22, headY + r * .55]], rgba('#8a4a3a', .9), r * .085, { smooth: true });
  }
  // Glasses with a thin frame.
  if (o.glasses) {
    const gy = headY + r * .1, g0 = cx + f * r * .22, gr = r * .27;
    x.save(); x.strokeStyle = o.glasses; x.lineWidth = Math.max(.12, r * .065);
    for (const s of [-1, 1]) { x.beginPath(); x.arc(g0 + s * r * .33, gy, gr, 0, TAU); x.stroke(); }
    x.beginPath(); x.moveTo(g0 - r * .07, gy - gr * .25); x.lineTo(g0 + r * .07, gy - gr * .25); x.moveTo(g0 - f * (r * .33 + gr), gy - gr * .15); x.lineTo(cx - f * r * .9, gy); x.stroke(); x.restore();
  }
  // Hair.
  const hs = o.hairStyle || 'short';
  const HP = (a, b) => [cx + f * a * r, headY + b * r];
  if (hs === 'crown') {
    // Bald on top, a wreath of short hair over the ears, light on the crown of the head.
    for (const s of [-1, 1]) layer(x, hair, x => { x.moveTo(cx + s * r * .6, headY - r * .76); x.quadraticCurveTo(cx + s * r * 1.18, headY - r * .5, cx + s * r * 1.05, headY + r * .36); x.lineTo(cx + s * r * .84, headY + r * .3); x.quadraticCurveTo(cx + s * r * .9, headY - r * .3, cx + s * r * .6, headY - r * .76); x.closePath(); }, { lift: .15 });
    layer(x, 'rgba(255,255,255,.3)', ellipse(cx - f * r * .2, headY - r * .64, r * .3, r * .13, -f * .3), { lift: 0, tooth: false });
  } else if (hs === 'parted') {
    // Full hair of the seventies with a side parting: over the ears, swept across the forehead.
    const pts = [[1, .32], [.84, .24], [.87, -.25], [.7, -.5], [.45, -.68], [-.1, -.2], [-.72, -.3], [-.9, -.1], [-.84, .24], [-1, .32]].map(p => HP(p[0], p[1]));
    if (f < 0) pts.reverse();
    layer(x, hair, x => {
      x.moveTo(cx - r * 1.0, headY + r * .32); x.bezierCurveTo(cx - r * 1.32, headY - r * 1.42, cx + r * 1.32, headY - r * 1.42, cx + r * 1.0, headY + r * .32);
      const q = (c, p) => x.quadraticCurveTo(c[0], c[1], p[0], p[1]), l = p => x.lineTo(p[0], p[1]);
      if (f > 0) { l(pts[1]); q(pts[2], pts[3]); l(pts[4]); q(pts[5], pts[6]); q(pts[7], pts[8]); l(pts[9]); }
      else { l(pts[1]); q(pts[2], pts[3]); q(pts[4], pts[5]); l(pts[6]); q(pts[7], pts[8]); l(pts[9]); }
      x.closePath();
    }, { lift: .28 });
    for (const st of [[[.42, -.98], [-.2, -.84], [-.78, -.44]], [[.46, -.76], [-.1, -.54], [-.62, -.34]], [[.56, -.84], [.88, -.5], [.93, -.02]]]) stroke(x, st.map(p => HP(p[0], p[1])), rgba(tone(hair, .3), .75), r * .07, { smooth: true });
  } else if (hs !== 'bald') {
    if (hs === 'long') layer(x, tone(hair, -.12), x => { x.moveTo(cx - r * 1.02, headY - r * .2); x.quadraticCurveTo(cx - r * 1.25, headY + r * 1.3, cx - r * .9, headY + r * 2.3); x.lineTo(cx + r * .9, headY + r * 2.3); x.quadraticCurveTo(cx + r * 1.25, headY + r * 1.3, cx + r * 1.02, headY - r * .2); x.closePath(); }, { lift: 0 });
    layer(x, hair, x => {
      const low = hs === 'bob' || hs === 'long' ? .55 : hs === 'side' ? .05 : -.02;
      x.moveTo(cx - r * 1.0, headY + r * low);
      x.bezierCurveTo(cx - r * 1.22, headY - r * 1.25, cx + r * 1.22, headY - r * 1.25, cx + r * 1.0, headY + r * low);
      if (hs === 'bob' || hs === 'long') { x.quadraticCurveTo(cx + r * .9, headY - r * .1, cx + f * r * .62 + r * .22, headY - r * .34); x.quadraticCurveTo(cx + f * r * .1, headY - r * .62, cx - f * r * .5 - r * .22, headY - r * .28); x.quadraticCurveTo(cx - r * .92, headY - r * .05, cx - r * 1.0, headY + r * low); }
      else if (hs === 'receding') { x.quadraticCurveTo(cx + r * .9, headY - r * .42, cx + r * .58, headY - r * .76); x.quadraticCurveTo(cx + r * .24, headY - r * .5, cx, headY - r * .6); x.quadraticCurveTo(cx - r * .24, headY - r * .5, cx - r * .58, headY - r * .76); x.quadraticCurveTo(cx - r * .9, headY - r * .42, cx - r * 1.0, headY + r * low); }
      else if (hs === 'side') { x.quadraticCurveTo(cx + f * r * .9, headY - r * .5, cx + f * r * .1, headY - r * .52); x.quadraticCurveTo(cx - f * r * .7, headY - r * .5, cx - f * r * 1.0, headY + r * .3); x.lineTo(cx - r * 1.0, headY + r * low); }
      else { x.quadraticCurveTo(cx + r * .7, headY - r * .42, cx, headY - r * .5); x.quadraticCurveTo(cx - r * .7, headY - r * .42, cx - r * 1.0, headY + r * low); }
      x.closePath();
    }, { lift: .28 });
    if (hs === 'bun') layer(x, hair, circle(cx - f * r * .55, headY - r * 1.0, r * .42), { lift: .25 });
    if (hs === 'hat') {
      layer(x, o.hat || '#4a3a2e', ellipse(cx, headY - r * .62, r * 1.5, r * .26), { lift: .3 });
      layer(x, o.hat || '#4a3a2e', rrect(cx - r * .82, headY - r * 1.45, r * 1.64, r * .9, r * .3), { lift: .2 });
      layer(x, tone(o.hat || '#4a3a2e', -.35), rect(cx - r * .82, headY - r * .82, r * 1.64, r * .16), { lift: 0 });
    }
    if (hs === 'cap') {
      layer(x, o.hat || '#3d4a5a', x => { x.moveTo(cx - r * 1.02, headY - r * .42); x.bezierCurveTo(cx - r * 1.1, headY - r * 1.4, cx + r * 1.1, headY - r * 1.4, cx + r * 1.02, headY - r * .42); x.closePath(); }, { lift: .3 });
      layer(x, tone(o.hat || '#3d4a5a', -.25), ellipse(cx + f * r * .75, headY - r * .42, r * .7, r * .15), { lift: .2 });
    }
  }
  // The arm towards us last.
  arm(f, (f === 1 ? o.armR : o.armL) || 'down', false);
}
// What hands hold.
export const bag = (c = '#c9a15a', w = 5, h = 6) => (x, hx, hy) => {
  stroke(x, [[hx - w * .28, hy + h * .25], [hx, hy - .2], [hx + w * .28, hy + h * .25]], tone(c, -.35), .45, { smooth: true });
  layer(x, c, x => { x.moveTo(hx - w / 2, hy + h * .2); x.lineTo(hx + w / 2, hy + h * .2); x.lineTo(hx + w * .44, hy + h * 1.2); x.lineTo(hx - w * .44, hy + h * 1.2); x.closePath(); }, { lift: .3 });
};
export const basket = (c = '#b8894e') => (x, hx, hy) => {
  stroke(x, [[hx - 2.6, hy + 2.6], [hx, hy - .2], [hx + 2.6, hy + 2.6]], tone(c, -.3), .5, { smooth: true });
  layer(x, c, x => { x.moveTo(hx - 3.4, hy + 2.4); x.lineTo(hx + 3.4, hy + 2.4); x.lineTo(hx + 2.7, hy + 6.2); x.lineTo(hx - 2.7, hy + 6.2); x.closePath(); }, { lift: .3 });
  for (let i = 0; i < 3; i++) stroke(x, [[hx - 3.1 + i * .2, hy + 3.3 + i * 1], [hx + 3.1 - i * .2, hy + 3.3 + i * 1]], rgba(tone(c, -.45), .5), .22);
};

// ---------------------------------------------------------------- plants
export function tree(x, cx, base, h, o = {}) {
  const c = o.c || '#5d9b63', trunk = o.trunk || '#7a5a3a', w = o.w || h * .62, seed = o.seed || 1;
  const th = h * .42, tw = Math.max(1.2, h * .06);
  layer(x, trunk, x => { x.moveTo(cx - tw * .7, base); x.lineTo(cx - tw * .42, base - th); x.lineTo(cx + tw * .42, base - th); x.lineTo(cx + tw * .7, base); x.closePath(); }, { lift: .3 });
  stroke(x, [[cx, base - th * .8], [cx - w * .2, base - th * 1.25]], trunk, tw * .45); stroke(x, [[cx, base - th * .7], [cx + w * .22, base - th * 1.2]], trunk, tw * .4);
  const cy = base - h + (h - th) * .56;
  layer(x, tone(c, -.2), blob(cx + w * .06, cy + h * .05, w * .5, (h - th) * .58, seed + 5, 10, .13), { lift: .5 });
  layer(x, c, blob(cx, cy, w * .47, (h - th) * .55, seed, 10, .15), { lift: .6 });
  // A large crown is cut from many leaf clusters: they scallop its edge, darker on the shade side, lighter towards the lamp.
  if (h >= 40) {
    const rx = w * .47, ry = (h - th) * .55, n = 13;
    // Inside the crown a second, looser ring of clusters, so it has depth and not a flat middle.
    for (let i = 0; i < 6; i++) { const an = i / 6 * TAU + .4 + rnd(seed + 44, i) * .4, px = cx + Math.cos(an) * rx * .36, py = cy + Math.sin(an) * ry * .36; layer(x, tone(c, Math.cos(an) + Math.sin(an) < 0 ? .06 : -.07), blob(px, py, w * .13, w * .1, seed + 70 + i, 7, .2), { lift: .25 }); }
    for (let i = 0; i < n; i++) {
      const an = i / n * TAU + rnd(seed + 40, i) * .3, rr = .72 + rnd(seed + 41, i) * .14, px = cx + Math.cos(an) * rx * rr, py = cy + Math.sin(an) * ry * rr;
      const lightSide = Math.cos(an) * -.7 + Math.sin(an) * -.7;
      layer(x, tone(c, lightSide > .2 ? .1 : lightSide < -.3 ? -.12 : -.02), blob(px, py, w * (.12 + rnd(seed + 42, i) * .05), w * (.1 + rnd(seed + 43, i) * .04), seed + 50 + i, 7, .2), { lift: .3 });
    }
  }
  layer(x, tone(c, .17), blob(cx - w * .12, cy - h * .09, w * .25, (h - th) * .27, seed + 2, 8, .16), { lift: .4 });
  layer(x, tone(c, .3), blob(cx - w * .17, cy - h * .15, w * .11, (h - th) * .11, seed + 3, 7, .16), { lift: .3 });
  if (o.fruit) for (let i = 0; i < 6; i++) layer(x, o.fruit, circle(cx + (rnd(seed, i + 20) - .5) * w * .7, cy + (rnd(seed, i + 30) - .5) * (h - th) * .7, h * .022), { lift: .2, tooth: false });
}
export function conifer(x, cx, base, h, o = {}) {
  const c = o.c || '#3f7a5a', w = o.w || h * .46;
  layer(x, '#6a4a30', rect(cx - h * .025, base - h * .16, h * .05, h * .16), { lift: .3 });
  for (let i = 0; i < 4; i++) { const y0 = base - h * (.14 + i * .2), ww = w * (1 - i * .2); layer(x, tone(c, .06 * i), poly([[cx - ww / 2, y0], [cx, y0 - h * .34], [cx + ww / 2, y0]]), { lift: .45 }); }
}
export function bush(x, cx, base, w, h, o = {}) {
  const c = o.c || '#6aa56a', seed = o.seed || 3;
  layer(x, tone(c, -.15), x => { blob(cx + w * .1, base - h * .5, w * .5, h * .55, seed + 1, 9, .14)(x); }, { lift: .4 });
  layer(x, c, blob(cx - w * .1, base - h * .45, w * .45, h * .5, seed, 9, .16), { lift: .5 });
  inside(x, rect(cx - w, base, w * 2, h), () => { });
  if (o.flowers) for (let i = 0; i < 7; i++) layer(x, o.flowers, circle(cx + (rnd(seed, i + 9) - .5) * w * .8, base - h * (.25 + rnd(seed, i + 17) * .6), h * .06), { lift: .2, tooth: false });
}
export function cloud(x, cx, cy, w, o = {}) {
  const c = o.c || '#ffffff', h = w * .34, seed = o.seed || 1;
  layer(x, tone(c, -.07), x => { ellipse(cx - w * .22, cy + h * .08, w * .28, h * .5)(x); ellipse(cx + w * .2, cy + h * .1, w * .3, h * .46)(x); ellipse(cx, cy - h * .2, w * .26, h * .6)(x); x.rect(cx - w * .42, cy + h * .1, w * .84, h * .42); }, { lift: o.lift === undefined ? .7 : o.lift });
  layer(x, c, x => { ellipse(cx - w * .2, cy, w * .22, h * .38)(x); ellipse(cx + .14 * w, cy - h * .12, w * .2, h * .4)(x); }, { lift: .3 });
}
export function bird(x, cx, cy, s, c = '#3a3530', flap = 0) {
  stroke(x, [[cx - s, cy - s * (.25 + flap * .4)], [cx - s * .45, cy - s * .55 + flap * s * .3], [cx, cy], [cx + s * .45, cy - s * .55 + flap * s * .3], [cx + s, cy - s * (.25 + flap * .4)]], c, s * .2, { smooth: true });
}

// ---------------------------------------------------------------- houses
// A window with frame, cross and sill. lit: glass colour.
export function windowAt(x, a, b, w, h, o = {}) {
  const frame = o.frame || '#f4eee0', glass = o.glass || '#9db6c4';
  layer(x, frame, rect(a - .5, b - .5, w + 1, h + 1), { lift: .25 });
  layer(x, glass, rect(a + .35, b + .35, w - .7, h - .7), { lift: 0, tooth: false });
  inside(x, rect(a + .35, b + .35, w - .7, h - .7), () => { x.fillStyle = 'rgba(255,255,255,.22)'; x.beginPath(); x.moveTo(a, b + h * .7); x.lineTo(a + w * .6, b); x.lineTo(a + w * .85, b); x.lineTo(a + w * .1, b + h); x.lineTo(a, b + h); x.fill(); });
  // Behind the glass, as in any street: a roller blind pulled part way down, a pot plant on the inner sill.
  if (o.blind) {
    const d = (h - .7) * o.blind;
    layer(x, o.blindC || '#eadfc4', rect(a + .35, b + .35, w - .7, d), { lift: 0 });
    x.fillStyle = 'rgba(60,40,20,.18)'; x.fillRect(a + .35, b + .35 + d * .5, w - .7, .12);
    x.fillStyle = tone(o.blindC || '#eadfc4', -.3); x.fillRect(a + .35, b + .35 + d - .35, w - .7, .35);
    x.fillStyle = 'rgba(40,30,20,.6)'; x.beginPath(); x.arc(a + w / 2, b + .35 + d + .35, .18, 0, TAU); x.fill();
  }
  if (o.plant) {
    const px = a + w * (o.plant > 0 ? .3 : .7), py = b + h - .35, pw = Math.min(1.8, w * .26);
    for (let i = 0; i < 5; i++) { const an = -Math.PI / 2 + (i - 2) * .55; layer(x, i % 2 ? '#4f7f4a' : '#6a9a55', ellipse(px + Math.cos(an) * pw * .55, py - pw * .9 + Math.sin(an) * pw * .55, pw * .38, pw * .2, an), { lift: 0, tooth: false }); }
    layer(x, '#b8653e', poly([[px - pw / 2, py - pw * .75], [px + pw / 2, py - pw * .75], [px + pw * .38, py], [px - pw * .38, py]]), { lift: 0, tooth: false });
    x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(px - pw / 2, py - pw * .75, pw, .15);
  }
  if (o.cross !== false) { x.fillStyle = frame; x.fillRect(a + w / 2 - .3, b, .6, h); if (o.bar !== false) x.fillRect(a, b + h * .4 - .3, w, .6); }
  if (o.curtain) { layer(x, o.curtain, x => { x.moveTo(a + .35, b + .35); x.lineTo(a + w * .42, b + .35); x.quadraticCurveTo(a + w * .2, b + h * .5, a + .35, b + h * .7); x.closePath(); }, { lift: 0 }); layer(x, o.curtain, x => { x.moveTo(a + w - .35, b + .35); x.lineTo(a + w * .58, b + .35); x.quadraticCurveTo(a + w * .8, b + h * .5, a + w - .35, b + h * .7); x.closePath(); }, { lift: 0 }); }
  if (o.sill !== false) layer(x, tone(frame, -.1), rect(a - 1.1, b + h + .4, w + 2.2, 1), { lift: .3 });
  if (o.box) { layer(x, '#7a4a30', rect(a - .8, b + h - .4, w + 1.6, 1.6), { lift: .35 }); for (let i = 0; i < 5; i++) layer(x, i % 2 ? o.box : '#5d9b63', circle(a + (i + .5) * w / 5, b + h - .9, 1), { lift: .2, tooth: false }); }
}
// Brick or plank lines printed on a wall. Call inside().
export function bricks(x, a, b, w, h, c = 'rgba(90,40,25,.16)', bh = 2.1, bw = 5.2) {
  x.strokeStyle = c; x.lineWidth = .22; x.beginPath();
  for (let j = 0; j * bh <= h; j++) { const y = b + j * bh; x.moveTo(a, y); x.lineTo(a + w, y); for (let i = 0; i * bw <= w + bw; i++) { const px = a + i * bw + (j % 2) * bw / 2; x.moveTo(px, y); x.lineTo(px, y + bh); } }
  x.stroke();
}
// A town house seen from the front. o: wall, roof, floors, cols, roofKind 'gable'|'flat'|'mansard'|'step', brick, glass, lit(i,j)
export function house(x, a, base, w, h, o = {}) {
  const wall = o.wall || '#d9b98f', roof = o.roof || '#8a4a3a', floors = o.floors || 3, cols = o.cols || 3, kind = o.roofKind || 'gable';
  const rh = kind === 'flat' ? 2.2 : kind === 'mansard' ? h * .16 : h * .2, top = base - h, wt = top + rh;
  const body = kind === 'gable' ? poly([[a, base], [a, wt], [a + w / 2, top - .3], [a + w, wt], [a + w, base]]) : rect(a, wt, w, base - wt);
  layer(x, wall, body, { lift: .55, shade: wash(a, wt, a + w, base, 'rgba(255,255,255,.07)', 'rgba(60,30,10,.1)') });
  if (o.brick) inside(x, body, () => bricks(x, a, top, w, h, o.brick === true ? undefined : o.brick));
  // Roof.
  if (kind === 'gable') { layer(x, roof, poly([[a - 1.4, wt + 1], [a + w / 2, top - 1.8], [a + w + 1.4, wt + 1], [a + w + 1.4, wt + 2.4], [a + w / 2, top + .9], [a - 1.4, wt + 2.4]]), { lift: .5 }); }
  else if (kind === 'mansard') { layer(x, roof, poly([[a - 1, wt + .6], [a + w * .08, top], [a + w * .92, top], [a + w + 1, wt + .6]]), { lift: .5 }); for (let i = 0; i < cols; i++) { const wx = a + (i + .5) * w / cols; layer(x, tone(roof, -.15), poly([[wx - 2.4, wt - .4], [wx - 2.4, wt - rh * .62], [wx, wt - rh * .92], [wx + 2.4, wt - rh * .62], [wx + 2.4, wt - .4]]), { lift: .3 }); layer(x, o.glass || '#9db6c4', rect(wx - 1.4, wt - rh * .58, 2.8, rh * .5), { lift: 0, tooth: false }); } }
  else if (kind === 'step') { layer(x, wall, poly([[a, wt], [a, wt - rh * .3], [a + w * .2, wt - rh * .3], [a + w * .2, wt - rh * .65], [a + w * .38, wt - rh * .65], [a + w * .38, top], [a + w * .62, top], [a + w * .62, wt - rh * .65], [a + w * .8, wt - rh * .65], [a + w * .8, wt - rh * .3], [a + w, wt - rh * .3], [a + w, wt]]), { lift: .4 }); }
  else layer(x, roof, rect(a - 1, wt - 1.4, w + 2, 2.6), { lift: .5 });
  if (o.chimney !== false && kind !== 'flat') layer(x, tone(roof, -.25), rect(a + w * .72, top + rh * .1 - 3, 2.6, rh * .6 + 3), { lift: .3 });
  // Windows.
  const g0 = o.ground === undefined ? 0 : o.ground, fh = (base - wt - g0) / floors, ww = Math.min(w / cols * .5, fh * .5), wh = Math.min(fh * .62, ww * 1.5);
  for (let j = 0; j < floors; j++) for (let i = 0; i < cols; i++) {
    if (o.skip && o.skip(i, j)) continue;
    const wx = a + (i + .5) * w / cols - ww / 2, wy = wt + j * fh + (fh - wh) * .45;
    const lit = o.lit && o.lit(i, j);
    // Every window has its own household: a blind at its own height, a plant, now and then.
    const k = rnd(Math.round(a * 13 + base * 7 + w), i * 7 + j * 13), big = ww >= 3.6 && !lit;
    windowAt(x, wx, wy, ww, wh, { glass: lit ? (typeof lit === 'string' ? lit : '#ffdf8a') : o.glass, frame: o.frame, curtain: o.curtain && (i + j) % 2 === 0 ? o.curtain : null, box: o.boxes && j === floors - 1 && i % 2 === 0 ? o.boxes : null,
      blind: big && k < .26 ? .2 + rnd(a + 3, i * 5 + j) * .45 : 0, blindC: ['#eadfc4', '#e6d3ac', '#efe8d6', '#dcae6e'][Math.floor(rnd(a + 5, i + j * 3) * 4)], plant: big && k > .82 ? (k > .91 ? 1 : -1) : 0 });
  }
  if (kind === 'gable' && o.attic !== false) layer(x, o.glass || '#9db6c4', circle(a + w / 2, wt - rh * .1, Math.min(2, w * .06)), { lift: 0, tooth: false });
  return { wt, fh };
}
// A striped awning over a shop window.
export function awning(x, a, b, w, d, c1 = '#a8432f', c2 = '#f4eee0', n = 7) {
  layer(x, c1, x => { x.moveTo(a, b); x.lineTo(a + w, b); x.lineTo(a + w + 1, b + d); x.lineTo(a - 1, b + d); x.closePath(); }, { lift: .7 });
  inside(x, x => { x.moveTo(a, b); x.lineTo(a + w, b); x.lineTo(a + w + 1, b + d); x.lineTo(a - 1, b + d); x.closePath(); }, () => { x.fillStyle = c2; for (let i = 0; i < n; i += 2) { const u0 = i / n, u1 = (i + 1) / n; x.beginPath(); x.moveTo(a + w * u0, b); x.lineTo(a + w * u1, b); x.lineTo(a - 1 + (w + 2) * u1, b + d); x.lineTo(a - 1 + (w + 2) * u0, b + d); x.fill(); } });
  const sc = []; for (let i = 0; i <= n; i++) sc.push(a - 1 + (w + 2) * i / n);
  layer(x, c1, x => { x.moveTo(a - 1, b + d); for (let i = 0; i < n; i++) x.quadraticCurveTo((sc[i] + sc[i + 1]) / 2, b + d + 2.2, sc[i + 1], b + d); x.closePath(); }, { lift: .3 });
}
// A street lamp.
export function lampPost(x, cx, base, h, c = '#3a4038', lit = false) {
  layer(x, c, x => { x.rect(cx - .5, base - h + 3, 1, h - 3); x.rect(cx - 1.3, base - 2, 2.6, 2); }, { lift: .3 });
  layer(x, lit ? '#ffe9a8' : '#e8e2cf', x => { x.moveTo(cx - 1.6, base - h + 3.2); x.lineTo(cx - 1.1, base - h + .6); x.lineTo(cx + 1.1, base - h + .6); x.lineTo(cx + 1.6, base - h + 3.2); x.closePath(); }, { lift: .3, tooth: false });
  layer(x, c, poly([[cx - 1.9, base - h + .7], [cx, base - h - .8], [cx + 1.9, base - h + .7]]), { lift: .2 });
}

// ---------------------------------------------------------------- wheels and vehicles
export function wheel(x, cx, cy, r, o = {}) {
  layer(x, o.tyre || '#2a2622', circle(cx, cy, r), { lift: .35, tooth: false });
  layer(x, o.hub || '#cfc8b8', circle(cx, cy, r * .56), { lift: 0, tooth: false });
  layer(x, o.tyre || '#2a2622', circle(cx, cy, r * .16), { lift: 0, tooth: false });
}
// A delivery van of the seventies, seen from the side, driving to the right (f = 1) or left (-1).
export function van(x, a, base, w, o = {}) {
  const c = o.c || '#f2ead8', h = w * .46, f = o.face || 1, band = o.band;
  x.save(); if (f < 0) { x.translate(2 * a + w, 0); x.scale(-1, 1); }
  const top = base - h, wr = w * .085, wy = base - wr;
  layer(x, c, x => { x.moveTo(a, wy - wr * .2); x.lineTo(a, top + h * .12); x.quadraticCurveTo(a, top, a + w * .07, top); x.lineTo(a + w * .78, top); x.quadraticCurveTo(a + w * .9, top + h * .02, a + w * .96, top + h * .36); x.lineTo(a + w, top + h * .52); x.lineTo(a + w, wy - wr * .2); x.closePath(); }, { lift: .6 });
  if (band) layer(x, band, rect(a, top + h * .5, w, h * .15), { lift: 0 });
  layer(x, '#a9c4d0', x => { x.moveTo(a + w * .7, top + h * .1); x.lineTo(a + w * .8, top + h * .1); x.lineTo(a + w * .92, top + h * .4); x.lineTo(a + w * .7, top + h * .4); x.closePath(); }, { lift: 0, tooth: false });
  layer(x, '#a9c4d0', rect(a + w * .52, top + h * .1, w * .15, h * .3), { lift: 0, tooth: false });
  stroke(x, [[a + w * .5, top + h * .06], [a + w * .5, wy - wr * .3]], rgba('#3a3530', .35), .3, { cap: 'butt' });
  layer(x, '#d9d2c2', rect(a + w * .93, wy - wr * 1.1, w * .08, wr * .5), { lift: .2 });
  layer(x, '#ffe9a8', circle(a + w * .975, top + h * .62, w * .016), { lift: 0, tooth: false });
  if (o.sign) o.sign(x, a + w * .26, top + h * .32, w * .44, h * .3);
  wheel(x, a + w * .2, wy, wr); wheel(x, a + w * .8, wy, wr);
  x.restore();
}
// One bicycle wheel: tyre, rim, crossed spokes, hub. spin turns it (radians).
export function bikeWheel(x, wx, wy, r, o = {}) {
  const ring = (r0, r1) => x => { x.moveTo(wx + r0, wy); x.arc(wx, wy, r0, 0, TAU); x.moveTo(wx + r1, wy); x.arc(wx, wy, r1, 0, TAU, true); };
  layer(x, o.tyre || '#24211e', ring(r, r * .87), { lift: o.lift === undefined ? .2 : o.lift, tooth: false, rule: 'evenodd' });
  layer(x, o.rim || '#c4c5bf', ring(r * .875, r * .79), { lift: 0, tooth: false, rule: 'evenodd' });
  const n = r > 4 ? 20 : 14, spin = o.spin || 0;
  x.save(); x.strokeStyle = 'rgba(150,150,144,.96)'; x.lineWidth = Math.max(.1, r * .022); x.lineCap = 'butt';
  for (let i = 0; i < n; i++) { const a = spin + i * TAU / n, k = i % 2 ? .55 : -.55; x.beginPath(); x.moveTo(wx + Math.cos(a + k) * r * .09, wy + Math.sin(a + k) * r * .09); x.lineTo(wx + Math.cos(a) * r * .8, wy + Math.sin(a) * r * .8); x.stroke(); }
  x.restore();
  layer(x, '#8f908c', circle(wx, wy, r * .11), { lift: 0, tooth: false }); layer(x, '#dcddd7', circle(wx - r * .025, wy - r * .025, r * .05), { lift: 0, tooth: false });
  // The valve, so that a turning wheel shows that it turns.
  x.save(); x.translate(wx, wy); x.rotate(spin); x.fillStyle = '#6f706c'; x.fillRect(r * .66, -r * .022, r * .13, r * .044); x.restore();
}
// A bicycle from the side, L millimetres from tyre to tyre, standing on y = base, front wheel to the right
// (o.face -1: to the left). Proportions of a town bicycle with 28 inch wheels: beside a figure H tall, L is about H.
// o: c frame colour;  kind 'diamond' | 'step' (a low frame without a top tube);  wheels false leaves the wheels out
// (when they turn on discs of their own: see the returned rear, front, r);  spin, crank (angle of the near crank,
// 0 forward, PI / 2 down);  guards, rack, lamp, case (chain case), prop (kickstand): true or false;
// load (x, a, b, w) => void draws what is tied to the carrier, standing on y = b from x = a to a + w;
// rider {h, skin, hair, top, bottom, shoes, socks, hairStyle 'short' | 'pony' | 'cap', hat, shorts, sleeves 'short',
// lean, child} seats a person on it.
// Returns the frame's points in sheet millimetres: {rear, front, r, bb, saddle, grip, head, rack}.
export function bicycle(x, cx, base, L, o = {}) {
  if (typeof o === 'string') o = { c: o };
  const c = o.c || '#2f4a5a', f = o.face || 1, metal = o.metal || '#b4b5af', dark = '#24211e', K = L;
  const r = .194 * K, ay = base - r, xr = cx - .306 * K, xf = cx + .306 * K;
  const bb = [xr + .247 * K, ay + .036 * K], at = (p, d, k) => [p[0] + d[0] * k * K, p[1] + d[1] * k * K];
  const E = [-.309, -.951], Hd = [-.342, -.94];
  const seat = at(bb, E, .3), sad = at(bb, E, o.saddle === undefined ? .385 : o.saddle);
  const crown = [xf - .095 * K, ay - .215 * K], headTop = at(crown, Hd, .085), stem = at(headTop, Hd, .062);
  const grip = [stem[0] - .095 * K, stem[1] - .006 * K];
  const ca = o.crank === undefined ? .5 : o.crank, cl = .092 * K;
  const pedN = [bb[0] + Math.cos(ca) * cl, bb[1] + Math.sin(ca) * cl], pedF = [bb[0] - Math.cos(ca) * cl, bb[1] - Math.sin(ca) * cl];
  const rackY = ay - r - .05 * K, rack = [xr - .2 * K, rackY, .3 * K];
  const tube = (a, b, w, col = c, lift = .2) => stroke(x, [a, b], col, w * K, { lift });
  const pedal = (p, col) => layer(x, col, rrect(p[0] - .034 * K, p[1] - .009 * K, .068 * K, .02 * K, .008 * K), { lift: .1, tooth: false });
  // The rider, in parts: what is on the far side of the frame is cut first.
  const R = o.rider; let B = null;
  if (R) {
    const h = R.h || K * .97, skin = R.skin || '#e9b999', top = R.top || '#3f6f8a', bottom = R.bottom || '#3a3530', shoes = R.shoes || '#2a2420';
    const lean = R.lean === undefined ? .44 : R.lean, hr = (R.child ? .08 : .0685) * h;
    const hip = [sad[0] - .014 * K, sad[1] - .036 * K - .03 * h], sh = [hip[0] + Math.sin(lean) * .3 * h, hip[1] - Math.cos(lean) * .3 * h];
    const hd = [sh[0] + .04 * h, sh[1] - hr * 1.42];
    const joint = (a, b, l1, l2, side) => { const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, dm = Math.min(d, (l1 + l2) * .998), k = (l1 * l1 - l2 * l2 + dm * dm) / (2 * dm), hh = Math.sqrt(Math.max(0, l1 * l1 - k * k)), ux = dx / d, uy = dy / d; return [a[0] + ux * k - uy * hh * side, a[1] + uy * k + ux * hh * side]; };
    const leg = (ped, far) => {
      const ank = [ped[0] - .01 * h, ped[1] - .034 * h], kn = joint(hip, ank, .245 * h, .25 * h, -1), cb = far ? tone(bottom, -.2) : bottom, lift = far ? 0 : .3;
      if (R.shorts) {
        stroke(x, [kn, ank], far ? tone(skin, -.14) : skin, .05 * h, { lift });
        const mid = [kn[0] + (ank[0] - kn[0]) * .45, kn[1] + (ank[1] - kn[1]) * .45]; stroke(x, [mid, ank], far ? tone(R.socks || '#e9e3d6', -.16) : R.socks || '#e9e3d6', .052 * h);
        stroke(x, [hip, [hip[0] + (kn[0] - hip[0]) * .82, hip[1] + (kn[1] - hip[1]) * .82]], cb, .086 * h, { lift, cap: 'butt' }); layer(x, cb, circle(hip[0], hip[1], .043 * h), { lift: 0 });
      } else { stroke(x, [kn, ank], cb, .056 * h, { lift }); stroke(x, [hip, kn], cb, .08 * h, { lift }); }
      layer(x, far ? tone(shoes, -.1) : shoes, x => { x.moveTo(ank[0] - .03 * h, ank[1] + .036 * h); x.lineTo(ank[0] - .03 * h, ank[1] + .004 * h); x.quadraticCurveTo(ank[0] + .03 * h, ank[1] - .004 * h, ank[0] + .07 * h, ank[1] + .036 * h); x.closePath(); }, { lift: far ? 0 : .15, tooth: false });
    };
    const arm = far => {
      const s0 = [sh[0] + (far ? .012 : -.004) * h, sh[1] + .03 * h], g = [grip[0] + .012 * K, grip[1] - .012 * K], el = joint(s0, g, .165 * h, .155 * h, 1), ct = far ? tone(top, -.2) : tone(top, .05), lift = far ? 0 : .3;
      if (R.sleeves === 'short') { stroke(x, [s0, el, g], far ? tone(skin, -.14) : skin, .042 * h, { lift }); stroke(x, [s0, [s0[0] + (el[0] - s0[0]) * .6, s0[1] + (el[1] - s0[1]) * .6]], ct, .058 * h, { lift }); }
      else stroke(x, [s0, el, g], ct, .054 * h, { lift });
      layer(x, far ? tone(skin, -.14) : skin, circle(g[0], g[1], .024 * h), { lift: far ? 0 : .12, tooth: false });
    };
    B = { h, skin, top, hip, sh, hd, hr, leg, arm, lean };
  }
  x.save(); x.translate(cx, 0); x.scale(f, 1); x.translate(-cx, 0);
  // Far side: the far crank and pedal, the rider's far leg and arm.
  tube(bb, pedF, .013, tone(metal, -.3), 0); pedal(pedF, '#1b1917');
  if (B) { B.leg(pedF, true); B.arm(true); }
  // Wheels.
  if (o.wheels !== false) for (const wx of [xr, xf]) bikeWheel(x, wx, ay, r, { spin: o.spin, tyre: o.tyre, rim: o.rim });
  // Mudguards with their stays.
  if (o.guards !== false) {
    const gc = o.guardC || c, gr = r + .017 * K;
    const arc = (wx, a0, a1) => { x.save(); x.strokeStyle = gc; x.lineWidth = .017 * K; x.lineCap = 'round'; x.beginPath(); x.arc(wx, ay, gr, a0, a1); x.stroke(); x.restore(); };
    stroke(x, [[xf, ay], [xf + Math.cos(Math.PI * 1.13) * gr, ay + Math.sin(Math.PI * 1.13) * gr]], metal, .006 * K);
    stroke(x, [[xr, ay], [xr + Math.cos(Math.PI * 1.02) * gr, ay + Math.sin(Math.PI * 1.02) * gr]], metal, .006 * K);
    arc(xr, Math.PI * .98, Math.PI * 1.9); arc(xf, Math.PI * 1.1, Math.PI * 1.76);
    layer(x, '#a8322a', circle(xr + Math.cos(Math.PI * 1.0) * (gr + .008 * K), ay + .012 * K, .011 * K), { lift: 0, tooth: false });
  }
  // The carrier over the back wheel and what is tied to it.
  if (o.rack !== false) {
    const [ra, ry, rw] = rack, q = [xr + (seat[0] - xr) * .74, ay + (seat[1] - ay) * .74];
    stroke(x, [[ra + rw * .16, ry], [xr, ay]], metal, .008 * K); stroke(x, [[ra + rw * .5, ry], [xr, ay]], metal, .008 * K);
    stroke(x, [[ra, ry], [ra + rw * .8, ry], q], tone(metal, -.25), .012 * K, { lift: .15 });
    if (o.load) o.load(x, ra + .01 * K, ry - .007 * K, rw * .72);
  }
  // The frame: stays, seat tube, top tube or the low tube of a step-through frame, down tube, head tube, fork.
  tube([xr, ay], bb, .014); tube([xr, ay], seat, .013);
  stroke(x, [crown, [crown[0] + .054 * K, crown[1] + .15 * K], [xf, ay]], c, .016 * K, { smooth: true, lift: .2 });
  tube(bb, seat, .02);
  if (o.kind === 'step') stroke(x, [at(crown, Hd, .05), [bb[0] + .15 * K, bb[1] - .1 * K], at(bb, E, .13)], c, .019 * K, { smooth: true, lift: .2 });
  else tube(seat, at(crown, Hd, .078), .02);
  tube([crown[0] - .012 * K, crown[1] - .014 * K], bb, .022);
  tube(crown, headTop, .028);
  tube(seat, sad, .012, metal); tube(headTop, stem, .013, metal);
  // Chain, chain wheel, sprocket; on a town bicycle a case over the chain.
  const cw = .05 * K;
  if (o.case) layer(x, tone(c, -.08), x => { x.moveTo(bb[0] + cw * 1.25, bb[1] - cw * .5); x.quadraticCurveTo(bb[0] + cw * .9, bb[1] - cw * 1.4, bb[0] - cw * .2, bb[1] - cw * 1.3); x.lineTo(xr + .012 * K, ay - .034 * K); x.quadraticCurveTo(xr - .03 * K, ay - .01 * K, xr + .01 * K, ay + .012 * K); x.lineTo(bb[0] - cw * .2, bb[1] + cw * .28); x.quadraticCurveTo(bb[0] + cw * 1.1, bb[1] + cw * .5, bb[0] + cw * 1.25, bb[1] - cw * .5); x.closePath(); }, { lift: .18 });
  else {
    for (const s of [-1, 1]) stroke(x, [[bb[0], bb[1] + s * cw * .95], [xr, ay + s * .018 * K]], '#4a4844', Math.max(.1, .007 * K), { cap: 'butt' });
    layer(x, metal, x => { x.moveTo(bb[0] + cw, bb[1]); x.arc(bb[0], bb[1], cw, 0, TAU); x.moveTo(bb[0] + cw * .62, bb[1]); x.arc(bb[0], bb[1], cw * .62, 0, TAU, true); }, { lift: .1, tooth: false, rule: 'evenodd' });
    for (let i = 0; i < 5; i++) { const a = ca + i * TAU / 5; stroke(x, [bb, [bb[0] + Math.cos(a) * cw * .7, bb[1] + Math.sin(a) * cw * .7]], metal, .008 * K, { cap: 'butt' }); }
    layer(x, metal, circle(xr, ay, .019 * K), { lift: 0, tooth: false });
  }
  layer(x, tone(metal, -.2), circle(bb[0], bb[1], .016 * K), { lift: 0, tooth: false });
  if (o.prop) stroke(x, [[bb[0] - .07 * K, bb[1] + .012 * K], [bb[0] - .125 * K, base - .004 * K]], metal, .011 * K);
  // Saddle, handlebar with its grip, lamp.
  layer(x, o.saddleC || '#3a2a20', x => { const [sx, sy] = sad; x.moveTo(sx - .078 * K, sy - .012 * K); x.quadraticCurveTo(sx - .084 * K, sy - .042 * K, sx - .03 * K, sy - .038 * K); x.quadraticCurveTo(sx + .04 * K, sy - .036 * K, sx + .088 * K, sy - .022 * K); x.quadraticCurveTo(sx + .094 * K, sy - .008 * K, sx + .05 * K, sy - .005 * K); x.lineTo(sx - .05 * K, sy + .005 * K); x.quadraticCurveTo(sx - .078 * K, sy + .005 * K, sx - .078 * K, sy - .012 * K); x.closePath(); }, { lift: .2 });
  stroke(x, [stem, [stem[0] + .02 * K, stem[1] - .024 * K], [stem[0] - .04 * K, stem[1] - .022 * K], grip], metal, .013 * K, { smooth: true, lift: .15 });
  stroke(x, [[grip[0] + .04 * K, grip[1] - .012 * K], grip], dark, .02 * K);
  if (o.lamp !== false) { stroke(x, [at(crown, Hd, .06), [headTop[0] + .045 * K, headTop[1] + .03 * K]], metal, .007 * K); layer(x, '#e6e1d0', x => { const lx = headTop[0] + .05 * K, ly = headTop[1] + .03 * K; x.moveTo(lx, ly - .022 * K); x.quadraticCurveTo(lx + .036 * K, ly - .02 * K, lx + .036 * K, ly); x.quadraticCurveTo(lx + .036 * K, ly + .02 * K, lx, ly + .022 * K); x.closePath(); }, { lift: .15, tooth: false }); }
  // Near side: the rider's body, the near crank, leg and arm, the head.
  if (B) {
    const { h, skin, top, hip, sh, hd, hr, lean } = B, n = [Math.cos(lean), Math.sin(lean)], t = [Math.sin(lean), -Math.cos(lean)];
    const P = (p, a, b) => [p[0] + n[0] * a * h + t[0] * b * h, p[1] + n[1] * a * h + t[1] * b * h];
    const hb = P(hip, -.07, -.03), hf = P(hip, .062, -.01), sf = P(sh, .05, -.01), st = P(sh, -.005, .05), sb = P(sh, -.07, 0);
    layer(x, top, x => { x.moveTo(hb[0], hb[1]); x.lineTo(hf[0], hf[1]); const m = P(hip, .085, .16); x.quadraticCurveTo(m[0], m[1], sf[0], sf[1]); x.quadraticCurveTo(st[0] + n[0] * .04 * h, st[1] + n[1] * .04 * h, st[0], st[1]); x.quadraticCurveTo(sb[0] + t[0] * .04 * h, sb[1] + t[1] * .04 * h, sb[0], sb[1]); const m2 = P(hip, -.085, .14); x.quadraticCurveTo(m2[0], m2[1], hb[0], hb[1]); x.closePath(); }, { lift: .4 });
    if (R.knit) for (let i = 1; i < 5; i++) { const a = P(hip, -.07, i * .055), b = P(hip, .066, i * .055); stroke(x, [a, b], rgba(tone(top, -.5), .28), .008 * h, { cap: 'butt' }); }
  }
  tube(bb, pedN, .014, metal, .15); pedal(pedN, dark);
  if (B) {
    const { h, skin, hd, hr, sh } = B, hair = R.hair || '#5a3a22';
    B.leg(pedN, false);
    stroke(x, [[sh[0] + .012 * h, sh[1] - .02 * h], [hd[0] - hr * .15, hd[1] + hr * .7]], tone(skin, -.1), hr * .72, { cap: 'butt' });
    B.arm(false);
    // The head, looking the way he rides.
    layer(x, skin, ellipse(hd[0], hd[1], hr * .93, hr), { lift: .35, tooth: false });
    layer(x, skin, circle(hd[0] + hr * .92, hd[1] + hr * .2, hr * .17), { lift: 0, tooth: false });
    layer(x, tone(skin, -.09), ellipse(hd[0] - hr * .12, hd[1] + hr * .14, hr * .16, hr * .24), { lift: 0, tooth: false });
    layer(x, '#2a2018', circle(hd[0] + hr * .5, hd[1] - hr * .02, hr * .095), { lift: 0, tooth: false });
    layer(x, rgba('#d98a7a', .5), circle(hd[0] + hr * .4, hd[1] + hr * .42, hr * .2), { lift: 0, tooth: false });
    stroke(x, [[hd[0] + hr * .5, hd[1] + hr * .56], [hd[0] + hr * .78, hd[1] + hr * .5]], rgba('#7a3a2a', .8), hr * .075);
    layer(x, hair, x => { x.moveTo(hd[0] + hr * .94, hd[1] - hr * .38); x.bezierCurveTo(hd[0] + hr * .7, hd[1] - hr * 1.3, hd[0] - hr * 1.24, hd[1] - hr * 1.14, hd[0] - hr * .98, hd[1] + hr * .3); x.quadraticCurveTo(hd[0] - hr * .66, hd[1] + hr * .3, hd[0] - hr * .4, hd[1] - hr * .06); x.quadraticCurveTo(hd[0] - hr * .3, hd[1] - hr * .34, hd[0] - hr * .02, hd[1] - hr * .3); x.quadraticCurveTo(hd[0] + hr * .3, hd[1] - hr * .72, hd[0] + hr * .94, hd[1] - hr * .38); x.closePath(); }, { lift: .14 });
    stroke(x, [[hd[0] + hr * .5, hd[1] - hr * .86], [hd[0] - hr * .3, hd[1] - hr * .9], [hd[0] - hr * .82, hd[1] - hr * .3]], rgba(tone(hair, .3), .7), hr * .07, { smooth: true });
    if (R.hairStyle === 'pony') layer(x, hair, x => { x.moveTo(hd[0] - hr * .85, hd[1] - hr * .4); x.quadraticCurveTo(hd[0] - hr * 2.2, hd[1] - hr * .3, hd[0] - hr * 2.0, hd[1] + hr * 1.3); x.quadraticCurveTo(hd[0] - hr * 1.45, hd[1] + hr * .35, hd[0] - hr * .7, hd[1] + hr * .1); x.closePath(); }, { lift: .2 });
    if (R.hairStyle === 'cap') { const hc = R.hat || '#5a4a3a'; layer(x, hc, x => { x.moveTo(hd[0] - hr * 1.02, hd[1] - hr * .38); x.bezierCurveTo(hd[0] - hr * 1.0, hd[1] - hr * 1.4, hd[0] + hr * .9, hd[1] - hr * 1.42, hd[0] + hr * .98, hd[1] - hr * .56); x.quadraticCurveTo(hd[0] + hr * 1.7, hd[1] - hr * .5, hd[0] + hr * 1.66, hd[1] - hr * .3); x.lineTo(hd[0] - hr * 1.02, hd[1] - hr * .22); x.closePath(); }, { lift: .3 }); }
  }
  x.restore();
  const M = p => [cx + f * (p[0] - cx), p[1]];
  return { rear: M([xr, ay]), front: M([xf, ay]), r, bb: M(bb), saddle: M([sad[0], sad[1] - .038 * K]), grip: M(grip), head: M(headTop), rack: [f > 0 ? rack[0] : 2 * cx - rack[0] - rack[2], rack[1], rack[2]] };
}
