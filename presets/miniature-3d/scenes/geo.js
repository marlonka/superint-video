// Geometrie aus Text. Jeder Gegenstand in diesem Haus besteht aus den Formen in dieser Datei.
import { M, TAU, PI, v3, lin, clamp } from './m.js';

// Materialnummern. Was sie bedeuten, steht im Shader (shaders.js, matDo).
export const MAT = { plain: 0, wood: 1, parquet: 2, paper: 3, checker: 4, foam: 5, brushed: 6, velvet: 7, poche: 8, glass: 9, fabric: 10, plaster: 11, screen: 12, wallA: 13, wallB: 14, wallC: 15, leather: 16, rug: 17, street: 18, sky: 19, film: 20, brick: 21, drawer: 22, fineWood: 23, steam: 24, pages: 25, glaze: 26, steel: 27, saucer: 28 };

const DEFAULT = { c: '#ffffff', r: .6, m: 0, mat: 0, tex: 0, room: 0, e: 0, ao: 1, grain: 0, flag: 0 };

export class Geo {
  constructor() {
    this.pos = []; this.nor = []; this.uv = []; this.col = []; this.mat = []; this.aux = []; this.idx = [];
    this.stack = [M.id()]; this.st = { ...DEFAULT, _c: lin(DEFAULT.c) };
    this.min = [1e9, 1e9, 1e9]; this.max = [-1e9, -1e9, -1e9];
  }
  get m() { return this.stack[this.stack.length - 1]; }
  // Zustand setzen, der fuer alles Folgende gilt.
  s(o) { Object.assign(this.st, o); if (o.c !== undefined) this.st._c = Array.isArray(o.c) ? o.c : lin(o.c); return this; }
  with(o, fn) { const old = { ...this.st }; this.s(o); fn(this); this.st = old; return this; }
  at(p, r, fn, s) { if (typeof r === 'function') { fn = r; r = undefined; } this.stack.push(M.mul(this.m, M.trs(p, r || [0, 0, 0], s || [1, 1, 1]))); fn(this); this.stack.pop(); return this; }
  // Eine Ecke.
  v(p, n, u = 0, w = 0, ao = 1) {
    const q = M.point(this.m, p), d = v3.norm(M.dir(this.m, n)), s = this.st, c = s._c;
    this.pos.push(q[0], q[1], q[2]); this.nor.push(d[0], d[1], d[2]); this.uv.push(u, w);
    this.col.push(c[0], c[1], c[2], s.ao * ao); this.mat.push(s.r, s.m, s.mat, s.tex); this.aux.push(s.room, s.e, s.grain, s.flag);
    for (let i = 0; i < 3; i++) { if (q[i] < this.min[i]) this.min[i] = q[i]; if (q[i] > this.max[i]) this.max[i] = q[i]; }
    return this.pos.length / 3 - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
  // Rechteck aus vier Punkten, Reihenfolge gegen den Uhrzeigersinn von vorn.
  rect(a, b, c, d, n, uv = [0, 0, 1, 1]) {
    if (!n) n = v3.norm(v3.cross(v3.sub(b, a), v3.sub(d, a)));
    const [u0, v0, u1, v1] = uv;
    this.quad(this.v(a, n, u0, v0), this.v(b, n, u1, v0), this.v(c, n, u1, v1), this.v(d, n, u0, v1));
    return this;
  }
  // Scharfkantiger Quader, Mitte im Ursprung.
  box(w, h, d, faces = 63) {
    const x = w / 2, y = h / 2, z = d / 2;
    if (faces & 1) this.rect([-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1]);
    if (faces & 2) this.rect([x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1]);
    if (faces & 4) this.rect([-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], [0, 1, 0]);
    if (faces & 8) this.rect([-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0]);
    if (faces & 16) this.rect([x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], [1, 0, 0]);
    if (faces & 32) this.rect([-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], [-1, 0, 0]);
    return this;
  }
  // Quader mit gerundeten Kanten: Kanten fangen das Licht, darum sieht es nach Ding aus.
  rbox(w, h, d, b = .01, seg = 2) {
    b = Math.min(b, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
    const dims = [w / 2 - b, h / 2 - b, d / 2 - b];
    const ang = []; for (let i = 0; i <= seg; i++) ang.push(i / seg * (PI / 4));
    const sample = []; for (let i = seg; i >= 0; i--) sample.push([-1, ang[i]]); for (let i = 0; i <= seg; i++) sample.push([1, ang[i]]);
    const face = (ax, ay, az, sgn) => {
      const idx = [];
      for (let i = 0; i < sample.length; i++) {
        idx[i] = [];
        for (let j = 0; j < sample.length; j++) {
          const [su, au] = sample[i], [sv, av] = sample[j], dir = [0, 0, 0];
          dir[ax] = su * Math.tan(au); dir[ay] = sv * Math.tan(av); dir[az] = sgn;
          const nn = v3.norm(dir), p = [0, 0, 0];
          p[ax] = su * dims[ax] + nn[ax] * b; p[ay] = sv * dims[ay] + nn[ay] * b; p[az] = sgn * dims[az] + nn[az] * b;
          idx[i][j] = this.v(p, nn, p[ax], p[ay]);
        }
      }
      for (let i = 0; i < sample.length - 1; i++) for (let j = 0; j < sample.length - 1; j++) this.quad(idx[i][j], idx[i + 1][j], idx[i + 1][j + 1], idx[i][j + 1]);
    };
    face(0, 1, 2, 1); face(0, 1, 2, -1); face(2, 0, 1, 1); face(2, 0, 1, -1); face(1, 2, 0, 1); face(1, 2, 0, -1);
    return this;
  }
  // Drehkoerper: Profil aus [radius, y], Achse Y. crease: Winkel ab dem eine harte Kante entsteht.
  lathe(prof, n = 32, a0 = 0, a1 = TAU, crease = .6) {
    const m = prof.length, tang = [];
    for (let i = 0; i < m - 1; i++) { const dr = prof[i + 1][0] - prof[i][0], dy = prof[i + 1][1] - prof[i][1], l = Math.hypot(dr, dy) || 1; tang.push([dy / l, -dr / l]); }
    // Normalen je Profilpunkt, an scharfen Stellen doppelt.
    const rows = [];
    let vcum = 0; const total = tang.reduce((s, _, i) => s + Math.hypot(prof[i + 1][0] - prof[i][0], prof[i + 1][1] - prof[i][1]), 0) || 1;
    for (let i = 0; i < m - 1; i++) {
      const seg = Math.hypot(prof[i + 1][0] - prof[i][0], prof[i + 1][1] - prof[i][1]);
      const na = i > 0 && Math.acos(clamp(tang[i][0] * tang[i - 1][0] + tang[i][1] * tang[i - 1][1], -1, 1)) < crease ? v3.norm([tang[i][0] + tang[i - 1][0], tang[i][1] + tang[i - 1][1], 0]) : [tang[i][0], tang[i][1]];
      const nb = i < m - 2 && Math.acos(clamp(tang[i][0] * tang[i + 1][0] + tang[i][1] * tang[i + 1][1], -1, 1)) < crease ? v3.norm([tang[i][0] + tang[i + 1][0], tang[i][1] + tang[i + 1][1], 0]) : [tang[i][0], tang[i][1]];
      const v0 = vcum / total, v1 = (vcum + seg) / total; vcum += seg;
      for (let j = 0; j < n; j++) {
        const t0 = a0 + (a1 - a0) * j / n, t1 = a0 + (a1 - a0) * (j + 1) / n;
        const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
        const A = this.v([prof[i][0] * s0, prof[i][1], prof[i][0] * c0], [na[0] * s0, na[1], na[0] * c0], j / n, v0);
        const B = this.v([prof[i][0] * s1, prof[i][1], prof[i][0] * c1], [na[0] * s1, na[1], na[0] * c1], (j + 1) / n, v0);
        const C = this.v([prof[i + 1][0] * s1, prof[i + 1][1], prof[i + 1][0] * c1], [nb[0] * s1, nb[1], nb[0] * c1], (j + 1) / n, v1);
        const D = this.v([prof[i + 1][0] * s0, prof[i + 1][1], prof[i + 1][0] * c0], [nb[0] * s0, nb[1], nb[0] * c0], j / n, v1);
        this.quad(A, B, C, D);
      }
    }
    return this;
  }
  // Zylinder entlang Y mit Deckeln, Mitte im Ursprung.
  cyl(r, h, n = 24, r2 = r) {
    return this.lathe([[0, -h / 2], [r, -h / 2], [r2, h / 2], [0, h / 2]], n, 0, TAU, .3);
  }
  // Zylinder mit gerundeter Kante.
  rcyl(r, h, b = .004, n = 28) {
    const pts = [[0, -h / 2]]; const k = 3;
    for (let i = 0; i <= k; i++) { const a = -PI / 2 + i / k * PI / 2; pts.push([r - b + Math.cos(a) * b, -h / 2 + b + Math.sin(a) * b]); }
    for (let i = 0; i <= k; i++) { const a = i / k * PI / 2; pts.push([r - b + Math.cos(a) * b, h / 2 - b + Math.sin(a) * b]); }
    pts.push([0, h / 2]);
    return this.lathe(pts, n, 0, TAU, 1.2);
  }
  sphere(r, nu = 24, nv = 16) {
    const p = []; for (let i = 0; i <= nv; i++) { const a = -PI / 2 + i / nv * PI; p.push([Math.cos(a) * r, Math.sin(a) * r]); }
    return this.lathe(p, nu, 0, TAU, 2);
  }
  torus(R, r, nu = 32, nv = 12, a0 = 0, a1 = TAU) {
    const idx = [];
    for (let i = 0; i <= nu; i++) {
      idx[i] = []; const t = a0 + (a1 - a0) * i / nu, ct = Math.cos(t), st = Math.sin(t);
      for (let j = 0; j <= nv; j++) {
        const q = j / nv * TAU, cq = Math.cos(q), sq = Math.sin(q);
        idx[i][j] = this.v([(R + r * cq) * ct, r * sq, (R + r * cq) * st], [cq * ct, sq, cq * st], i / nu, j / nv);
      }
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) this.quad(idx[i][j], idx[i][j + 1], idx[i + 1][j + 1], idx[i + 1][j]);
    return this;
  }
  // Rohr entlang einer Punktliste. Fuer Kabel, Rohrpost, Lampenarme.
  tube(pts, r = .01, n = 10, closed = false) {
    const N = pts.length; const rings = [];
    let up = [0, 1, 0];
    const tan = i => v3.norm(v3.sub(pts[Math.min(i + 1, N - 1)], pts[Math.max(i - 1, 0)]));
    let t0 = tan(0); if (Math.abs(v3.dot(t0, up)) > .95) up = [1, 0, 0];
    let nx = v3.norm(v3.cross(up, t0));
    for (let i = 0; i < N; i++) {
      const t = tan(i);
      nx = v3.norm(v3.sub(nx, v3.mul(t, v3.dot(nx, t))));
      const by = v3.cross(t, nx); const ring = [];
      const rad = Array.isArray(r) ? r[i] : r;
      for (let j = 0; j <= n; j++) {
        const a = j / n * TAU, c = Math.cos(a), s = Math.sin(a);
        const d = [nx[0] * c + by[0] * s, nx[1] * c + by[1] * s, nx[2] * c + by[2] * s];
        ring.push(this.v([pts[i][0] + d[0] * rad, pts[i][1] + d[1] * rad, pts[i][2] + d[2] * rad], d, j / n, i / (N - 1)));
      }
      rings.push(ring);
    }
    for (let i = 0; i < N - 1; i++) for (let j = 0; j < n; j++) this.quad(rings[i][j], rings[i + 1][j], rings[i + 1][j + 1], rings[i][j + 1]);
    return this;
  }
  // Flaeche aus einer Formel: fn(u,v) -> [x,y,z]. Die Normalen rechnet die Formel selbst aus. uvf(u,v) legt die Textur.
  surf(fn, nu = 24, nv = 24, uvf = null) {
    const e = 1e-3, idx = [];
    const nrm = (u, v) => {
      let n = v3.cross(v3.sub(fn(u + e, v), fn(u - e, v)), v3.sub(fn(u, v + e), fn(u, v - e)));
      if (v3.len(n) < 1e-14) {
        const u2 = clamp(u, .03, .97), v2 = clamp(v, .03, .97);
        n = v3.cross(v3.sub(fn(u2 + e, v2), fn(u2 - e, v2)), v3.sub(fn(u2, v2 + e), fn(u2, v2 - e)));
      }
      return v3.norm(n);
    };
    for (let i = 0; i <= nu; i++) {
      idx[i] = [];
      for (let j = 0; j <= nv; j++) {
        const u = i / nu, w = j / nv, t = uvf ? uvf(u, w) : [u, w];
        idx[i][j] = this.v(fn(u, w), nrm(u, w), t[0], t[1]);
      }
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) this.quad(idx[i][j], idx[i + 1][j], idx[i + 1][j + 1], idx[i][j + 1]);
    return this;
  }
  // Flaches Raster, liegt in XZ, Normale +Y. Fuer Papier, das sich biegen kann.
  sheet(w, d, nx = 1, nz = 1, uv = [0, 0, 1, 1]) {
    const idx = [];
    for (let i = 0; i <= nx; i++) {
      idx[i] = [];
      for (let j = 0; j <= nz; j++) {
        const u = i / nx, t = j / nz;
        idx[i][j] = this.v([(u - .5) * w, 0, (t - .5) * d], [0, 1, 0], uv[0] + (uv[2] - uv[0]) * u, uv[1] + (uv[3] - uv[1]) * t);
      }
    }
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) this.quad(idx[i][j], idx[i][j + 1], idx[i + 1][j + 1], idx[i + 1][j]);
    return this;
  }
  // Aufrechtes Rechteck in XY, schaut nach +Z. Fuer alles, das man lesen soll.
  card(w, h, uv = [0, 0, 1, 1]) {
    const x = w / 2, y = h / 2;
    return this.rect([-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0], [0, 0, 1], [uv[0], uv[3], uv[2], uv[1]]);
  }
  // Prisma aus einem Umriss in XY, Tiefe entlang Z. Umriss gegen den Uhrzeigersinn, ohne Loecher.
  prism(outline, depth) {
    const z = depth / 2, tris = earcut(outline), n = outline.length;
    const fr = outline.map(p => this.v([p[0], p[1], z], [0, 0, 1], p[0], p[1]));
    for (const [a, b, c] of tris) this.tri(fr[a], fr[b], fr[c]);
    const bk = outline.map(p => this.v([p[0], p[1], -z], [0, 0, -1], p[0], p[1]));
    for (const [a, b, c] of tris) this.tri(bk[a], bk[c], bk[b]);
    for (let i = 0; i < n; i++) {
      const a = outline[i], b = outline[(i + 1) % n];
      const nn = v3.norm([b[1] - a[1], a[0] - b[0], 0]);
      this.rect([a[0], a[1], z], [a[0], a[1], -z], [b[0], b[1], -z], [b[0], b[1], z], nn);
    }
    return this;
  }
}

function earcut(poly) {
  const n = poly.length, ind = poly.map((_, i) => i), out = [];
  const area = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inside = (p, a, b, c) => area(a, b, p) >= 0 && area(b, c, p) >= 0 && area(c, a, p) >= 0;
  let guard = 0;
  while (ind.length > 3 && guard++ < 10000) {
    let cut = false;
    for (let i = 0; i < ind.length; i++) {
      const i0 = ind[(i + ind.length - 1) % ind.length], i1 = ind[i], i2 = ind[(i + 1) % ind.length];
      const a = poly[i0], b = poly[i1], c = poly[i2];
      if (area(a, b, c) <= 0) continue;
      let ok = true;
      for (const j of ind) { if (j === i0 || j === i1 || j === i2) continue; if (inside(poly[j], a, b, c)) { ok = false; break; } }
      if (!ok) continue;
      out.push([i0, i1, i2]); ind.splice(i, 1); cut = true; break;
    }
    if (!cut) break;
  }
  if (ind.length === 3) out.push([ind[0], ind[1], ind[2]]);
  return out;
}
