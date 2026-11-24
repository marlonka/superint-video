// The book as a mechanism. Every leaf hangs on one gutter line and turns around it; the two stacks
// lean a little so that both meet in that line, as a real book does on a desk. Everything a spread
// shows is driven by the angles this file returns: nothing is animated by hand.
import { Geo, MAT } from './geo.js';
import { M, PI, clamp, mix } from './m.js';
import { many } from './kit.js';
import { LOOK } from './look.js';

export const PW = .30, PD = .236;          // page width (from the gutter) and depth (along the spine), metres
export const TH = .002, COVER = .003, OV = .004, THIN = .0003;
export const DENS = 6.6;                   // pixels per millimetre in every painted sheet
export const PAGE_UV = [0, 0, PW * 1000 * DENS / 2048, PD * 1000 * DENS / 2048];

// A hand turns a leaf: it starts gently and the leaf still has some speed when it lands.
export const easeTurn = u => { u = clamp(u); return 2.1 * u * u - 1.1 * u * u * u; };
const softmax = (a, b, k = 2400) => Math.log(Math.exp(k * a) + Math.exp(k * b)) / k;

// How far the gutter edge of the thin leaf leads and its fore edge lags while it turns.
export const THIN_LEAD = 1.12, THIN_LAG = .06;
export class Book {
  // leaves: [{kind: 'cover' | 'thin' | 'board' | 'back', front: state, back: state, extra?: (g, w, d, th) => void}]
  // turns: [{leaf, t0, dur}]
  constructor(E, room, leaves, turns) {
    this.E = E; this.room = room; this.leaves = leaves; this.turns = [];
    for (const t of turns) this.turns[t.leaf] = t;
    leaves.forEach((L, j) => {
      L.th = L.kind === 'cover' || L.kind === 'back' ? COVER : L.kind === 'thin' ? THIN : TH;
      const big = L.kind === 'cover' || L.kind === 'back';
      L.w = PW + (big ? OV : 0); L.d = PD + (big ? 2 * OV : 0);
      if (L.kind === 'thin') {
        // Two sheets back to back: the title on the front, the next page's picture on the back.
        L.inst = many(E, room, 1, g => { g.s({ mat: MAT.cut, c: '#efe6d2', r: .86, ...L.front }); g.sheet(PW, PD, 56, 6, PAGE_UV); });
        L.inst2 = many(E, room, 1, g => { g.s({ mat: MAT.cut, c: '#efe6d2', r: .86, ...L.back }); g.at([0, -.00012, 0], [PI, 0, 0], () => g.sheet(PW, PD, 56, 6, [PAGE_UV[2], PAGE_UV[3], 0, 0])); });
      } else {
        const g = new Geo(); g.s({ room, flag: 16 });
        const w = L.w, d = L.d / 2, th = L.th;
        // Warm card: in the cool shade of the desk it must still read as paper, not grey board. Each board is two
        // sheets pasted back to back, so neighbouring leaves differ a hair in tone and the block shows its layers.
        const edge = big ? { c: L.leather || LOOK.edge, mat: MAT.leather, r: .5 } : { c: ['#e4d4b3', '#dbc9a4', '#e8d9ba'][j % 3], mat: MAT.board, r: .9 };
        // Front face: up while the leaf lies on the right. Its picture reads from the gutter outwards.
        g.with({ c: '#efe6d2', mat: MAT.paper, r: .86, ...L.front }, () => g.rect([0, th, -d], [w, th, -d], [w, th, d], [0, th, d], [0, 1, 0], L.frontUV || PAGE_UV));
        // Back face: up once the leaf lies on the left. Its picture reads towards the gutter.
        g.with({ c: '#efe6d2', mat: MAT.paper, r: .86, ...L.back }, () => g.rect([w, 0, -d], [0, 0, -d], [0, 0, d], [w, 0, d], [0, -1, 0], L.backUV || PAGE_UV));
        g.with(edge, () => {
          g.rect([w, 0, d], [w, 0, -d], [w, th, -d], [w, th, d], [1, 0, 0]);
          g.rect([0, 0, -d], [0, 0, d], [0, th, d], [0, th, -d], [-1, 0, 0]);
          g.rect([0, 0, d], [w, 0, d], [w, th, d], [0, th, d], [0, 0, 1]);
          g.rect([w, 0, -d], [0, 0, -d], [0, th, -d], [w, th, -d], [0, 0, -1]);
        });
        // The squares of both boards: where a board reaches past the book block, the leather turned in over its edge
        // shows on the inside, not the page that lies there (the pages only cover the block, and the texture banks
        // hold other spreads by the time the book is shut).
        if (big) g.with({ c: L.leather || LOOK.edge, mat: MAT.leather, r: .55 }, () => {
          const p = PD / 2;
          if (L.kind === 'back') {
            const y = th + .00004;
            g.rect([PW, y, -d], [w, y, -d], [w, y, d], [PW, y, d], [0, 1, 0]);
            g.rect([0, y, -d], [PW, y, -d], [PW, y, -p], [0, y, -p], [0, 1, 0]);
            g.rect([0, y, p], [PW, y, p], [PW, y, d], [0, y, d], [0, 1, 0]);
          } else {
            const y = -.00004;
            g.rect([w, y, -d], [PW, y, -d], [PW, y, d], [w, y, d], [0, -1, 0]);
            g.rect([PW, y, -d], [0, y, -d], [0, y, -p], [PW, y, -p], [0, -1, 0]);
            g.rect([PW, y, p], [0, y, p], [0, y, d], [PW, y, d], [0, -1, 0]);
          }
        });
        if (L.extra) L.extra(g, w, d, th);
        L.part = E.addDynamic(g, room);
      }
    });
    // The spine: a strip of leather that stands under the gutter.
    const sg = new Geo(); sg.s({ room, flag: 16, c: leaves[0].leather || LOOK.edge, mat: MAT.leather, r: .5 });
    sg.at([-.0022, .5, 0], () => sg.rbox(.0044, 1, PD + 2 * OV, .0012));
    this.spine = E.addDynamic(sg, room);
  }
  // Where is every leaf at this moment?
  state(ts, turns = this.turns) {
    const L = this.leaves, n = L.length, s = new Array(n), raw = new Array(n);
    for (let j = 0; j < n; j++) { const t = turns[j]; raw[j] = t ? clamp((ts - t.t0) / t.dur) : 0; s[j] = easeTurn(raw[j]); }
    let hR = 0, hL = 0;
    for (let j = 0; j < n; j++) { hR += L[j].th * (1 - s[j]); hL += L[j].th * s[j]; }
    const Yg = softmax(hL, hR);
    const dR = Math.asin(clamp((Yg - hR) / PW, 0, .3)), dL = Math.asin(clamp((Yg - hL) / PW, 0, .3));
    const psiR = -dR, psiL = PI + dL;
    const leaf = [];
    for (let j = 0; j < n; j++) {
      let oR = 0, oL = 0;
      for (let i = 0; i < j; i++) oR += L[i].th * (1 - s[i]);
      for (let i = j + 1; i < n; i++) oL += L[i].th * s[i];
      leaf.push({ s: s[j], raw: raw[j], psi: mix(psiR, psiL, s[j]), y0: -(L[j].th + oR) * (1 - s[j]) + oL * s[j] });
    }
    return { Yg, psiR, psiL, leaf, hL, hR, G: [0, Yg, 0] };
  }
  // The pages a spread stands on: left is the back of leaf s-1, right the front of leaf s.
  spreadKin(st, s) {
    const a = st.leaf[s - 1], b = st.leaf[s];
    return { G: st.G, psiL: a ? a.psi : st.psiL, psiR: b ? b.psi : st.psiR };
  }
  place(ts, turns = this.turns) {
    const st = this.state(ts, turns), L = this.leaves;
    for (let j = 0; j < L.length; j++) {
      const k = st.leaf[j], lf = L[j];
      if (lf.kind === 'thin') {
        // Thin paper: the gutter edge leads, the fore edge follows, and the sheet bends between them.
        // Only a little: pop-ups stand on its back, and they are flat.
        const base = mix(st.psiR, st.psiL, easeTurn(clamp(k.raw * THIN_LEAD))), tip = mix(st.psiR, st.psiL, easeTurn(clamp((k.raw - THIN_LAG) / (1 - THIN_LAG))));
        const bend = (tip - base) / PW, wave = Math.sin(k.raw * PI) * .0009;
        const m = M.mul(M.mul(M.T(0, st.Yg, 0), M.RZ(base)), M.T(PW / 2, k.y0 + lf.th * .5, 0));
        lf.inst.begin(); lf.inst.push(m, [bend, -PW / 2, wave, 1.7 + k.raw * 5]); lf.inst.end();
        lf.inst2.begin(); lf.inst2.push(m, [bend, -PW / 2, wave, 1.7 + k.raw * 5]); lf.inst2.end();
      } else {
        lf.part.set(M.mul(M.mul(M.T(0, st.Yg, 0), M.RZ(k.psi)), M.T(0, k.y0, 0)));
      }
    }
    this.spine.set(M.mul(M.T(mix(0, .0044, st.hL / (st.hL + st.hR)), 0, 0), M.S(1, Math.max(.001, st.Yg - .0004), 1)));
    return st;
  }
}
