// Paper engineering. A spread is two pages and what stands on them:
//   vfold   two panels glued to the two pages along lines through one point of the gutter. The opening
//           angle of the pages alone decides where the panels stand: flat when shut, upright when open.
//   stand   a layer on tabs: it stays parallel to a panel of its host fold, a set distance in front of it.
//           With life() it slides on its tab, rocks, turns or glows.
// Every sheet is painted with a 2D context in millimetres; what stays transparent is cut away.
import { Geo, MAT } from './geo.js';
import { M, v3, PI, clamp } from './m.js';
import { DENS, PW, PD } from './book.js';

const SIZE = 2048, PAD = 10;
const rad = d => d * PI / 180;

export class Spread {
  constructor(index) {
    this.index = index; this.pages = {}; this.items = []; this.byName = {}; this.sheets = []; this.slots = 2;
    // t: named moments in seconds after the spread lies open, used by life(); the timeline may reset them to words of the voice.
    // cam: camera keys [tau, eye, at, fov, aperture, focusOffset], tau in seconds after landing (negative while it rises).
    // plan: the seconds the spread is planned to stay open; cam and t are stretched to the real time.
    this.t = {}; this.cam = null; this.plan = 20;
  }
  // Where a point of a fold or stand meets the page, in the page's millimetres: [x, y] for page(side, ...).
  spot(host, side, u, off = 0) {
    const it = this.byName[host], al = rad(it.alpha), sa = Math.sin(al), ca = Math.cos(al) * it.dir;
    const x = side === 'L' ? u * sa + off * ca : u * sa - off * ca, z = it.z + (side === 'L' ? -u : u) * ca + off * sa;
    return [(side === 'L' ? PW + x : x) * 1000, (z + PD / 2) * 1000];
  }
  page(side, draw) { this.pages[side] = draw; return this; }
  // z: where on the gutter the fold's point lies (metres, negative is far from the viewer).
  // alpha: angle between gutter and glue line in degrees. dir +1: the arms come towards the viewer (a backdrop),
  // -1: they run away from the viewer (a corner that points at us).
  vfold(name, o) {
    const it = { type: 'v', name, z: 0, alpha: 78, dir: 1, wL: .2, wR: .2, h: .12, lock: 0, amp: .07, color: '#e9dfcb', ...o };
    this.items.push(it); this.byName[name] = it; return it;
  }
  // host: name of a fold; side 'L' or 'R'; u: metres along the panel from the crease (negative on the left panel);
  // off: metres in front of the panel (negative: behind); v: metres above the page; w, h: size in metres.
  stand(name, o) {
    const it = { type: 's', name, side: 'R', u: 0, off: .02, v: 0, w: .05, h: .05, lock: .04, amp: .1, color: '#e9dfcb', e: 0, ...o };
    this.items.push(it); this.byName[name] = it; return it;
  }
  // A piece that lies flat on a page and slides on it, like a token on a pull-tab. side 'L' | 'R'; x, y: page
  // millimetres of its top left corner; w, h in metres. life(t) may return {dx, dy} (page millimetres), rot, hop (metres up), show, glow.
  flat(name, o) {
    const it = { type: 'f', name, side: 'R', x: 0, y: 0, w: .05, h: .05, lift: .0005, color: '#e9dfcb', e: 0, ...o };
    this.items.push(it); this.byName[name] = it; return it;
  }
  // Where each sheet lies in the spread's texture layers.
  _pack() {
    let slot = 2, x = PAD, y = PAD, rowH = 0;
    const put = (w, h, res = 1) => {
      const pw = Math.ceil(w * 1000 * DENS * res), ph = Math.ceil(h * 1000 * DENS * res);
      if (pw + 2 * PAD > SIZE || ph + 2 * PAD > SIZE) throw new Error(`Spread ${this.index}: a sheet of ${pw}x${ph}px is too large`);
      if (x + pw + PAD > SIZE) { x = PAD; y += rowH + PAD; rowH = 0; }
      if (y + ph + PAD > SIZE) { slot++; x = PAD; y = PAD; rowH = 0; }
      const r = { slot, x, y, pw, ph }; x += pw + PAD; rowH = Math.max(rowH, ph); return r;
    };
    // Tall sheets first: the shelves stay tight.
    const list = [];
    for (const it of this.items) {
      if (it.type === 'v') { list.push({ it, part: 'L', w: it.wL, h: it.h }); list.push({ it, part: 'R', w: it.wR, h: it.h }); }
      else list.push({ it, part: 'S', w: it.w, h: it.h });
    }
    for (const s of list) s.res = s.it.res || (s.part === 'S' ? Math.min(1.6, 1900 / (Math.max(s.w, s.h) * 1000 * DENS)) : 1);
    list.sort((a, b) => b.h * b.res - a.h * a.res);
    for (const s of list) { s.rect = put(s.w, s.h, s.res); }
    this.sheets = list; this.slots = slot + 1;
  }
  build(E, room, layers) {
    this.E = E; this.layers = layers;
    this._pack();
    if (this.slots > layers.length) throw new Error(`Spread ${this.index} needs ${this.slots} layers, the bank has ${layers.length}`);
    let order = 0;
    for (const s of this.sheets) {
      const it = s.it, r = s.rect, g = new Geo();
      const uv = [(r.x + .5) / SIZE, (r.y + r.ph - .5) / SIZE, (r.x + r.pw - .5) / SIZE, (r.y + .5) / SIZE];
      g.s({ room, flag: 16 | (it.e ? 8 : 0), mat: MAT.cut, tex: layers[r.slot], c: it.color, r: .88, e: it.e || 0 });
      const x0 = s.part === 'L' ? -s.w : 0;
      g.rect([x0, 0, 0], [x0 + s.w, 0, 0], [x0 + s.w, s.h, 0], [x0, s.h, 0], [0, 0, 1], uv);
      s.dyn = E.addDynamic(g, room); s.dyn.visible = false;
      s.order = order++;
      if (s.part === 'L') it.dynL = s; else if (s.part === 'R') it.dynR = s; else it.dyn = s;
    }
    return this;
  }
  // Paints every sheet and hands the layers to the renderer. Called when the spread comes into view.
  paint() {
    const E = this.E, cvs = [];
    const mk = () => { const c = document.createElement('canvas'); c.width = c.height = SIZE; return c; };
    for (let i = 0; i < this.slots; i++) cvs.push(mk());
    const W = PW * 1000, D = PD * 1000;
    ['L', 'R'].forEach((side, i) => {
      const x = cvs[i].getContext('2d');
      x.save(); x.scale(DENS, DENS); x.beginPath(); x.rect(0, 0, W + 1, D + 1); x.clip();
      if (!(this.raw && this.raw[side])) { x.fillStyle = '#efe6d2'; x.fillRect(0, 0, W + 1, D + 1); }
      if (this.pages[side]) this.pages[side](x, W, D);
      x.restore();
    });
    for (const s of this.sheets) {
      const it = s.it, r = s.rect;
      const c = document.createElement('canvas'); c.width = r.pw; c.height = r.ph;
      const x = c.getContext('2d');
      x.save(); x.scale(DENS * s.res, DENS * s.res);
      const full = it.type === 'v' ? (it.wL + it.wR) * 1000 : it.w * 1000;
      if (s.part === 'R') x.translate(-it.wL * 1000, 0);
      if (it.draw) it.draw(x, full, it.h * 1000, it);
      x.restore();
      // Only paper counts as paper: the soft shadows the glued layers throw past the outline are cut away.
      { const im = x.getImageData(0, 0, r.pw, r.ph), d = im.data; for (let i = 3; i < d.length; i += 4) { const al = d[i]; d[i] = al < 150 ? 0 : al > 235 ? 255 : Math.round((al - 150) / 85 * 255); } x.putImageData(im, 0, 0); }
      // The cut edge: the sheet's own colours run a little past its outline, so the edge never turns dark.
      const a = cvs[r.slot].getContext('2d');
      a.save();
      a.beginPath(); a.rect(r.x - PAD / 2, r.y - PAD / 2, r.pw + PAD, r.ph + PAD); a.clip();
      a.drawImage(c, r.x, r.y);
      a.globalCompositeOperation = 'destination-over';
      for (const d of [1.5, 3]) for (let k = 0; k < 8; k++) a.drawImage(c, r.x + Math.cos(k * PI / 4) * d, r.y + Math.sin(k * PI / 4) * d);
      a.restore();
    }
    cvs.forEach((c, i) => {
      if (i >= 2) { const a = c.getContext('2d'); a.globalCompositeOperation = 'destination-over'; a.fillStyle = 'rgba(255,255,255,.012)'; a.fillRect(0, 0, SIZE, SIZE); }
      E.updateDoc(this.layers[i], c);
    });
  }
  hide() { for (const s of this.sheets) s.dyn.visible = false; }
  // kin: {G, psiL, psiR} the two page angles around the gutter; tau: seconds since the spread lay open.
  place(kin, tau) {
    const { G, psiL, psiR } = kin;
    const open = psiL - psiR;
    if (open < .012) { this.hide(); return; }
    const uR = [Math.cos(psiR), Math.sin(psiR), 0], uL = [Math.cos(psiL), Math.sin(psiL), 0];
    const nR = [-Math.sin(psiR), Math.cos(psiR), 0], nL = [Math.sin(psiL), -Math.cos(psiL), 0];
    const pm = (psiL + psiR) / 2, m = [Math.cos(pm), Math.sin(pm), 0];
    const frame = (it, wob) => {
      const al = rad(it.alpha), d = [0, 0, it.dir], th = open + wob;
      const ch = Math.cos(th / 2), sa = Math.sin(al), ca = Math.cos(al);
      const Rr = Math.hypot(ca, sa * ch), dl = Math.atan2(sa * ch, ca);
      const ga = dl + Math.acos(clamp(Math.cos(rad(it.beta === undefined ? 90 : it.beta)) / Rr, -1, 1));
      const c = v3.add(v3.mul(d, Math.cos(ga)), v3.mul(m, Math.sin(ga)));
      const A = [G[0], G[1], it.z];
      const aR = v3.add(v3.mul(uR, sa), v3.mul(d, ca)), aL = v3.add(v3.mul(uL, sa), v3.mul(d, ca));
      const mk = (X, nUp) => { const Y = v3.norm(v3.sub(c, v3.mul(X, v3.dot(c, X)))), Z = v3.cross(X, Y); return { X, Y, Z, p: v3.cross(X, nUp) }; };
      return { A, R: mk(aR, nR), L: mk(v3.mul(aL, -1), nL) };
    };
    const wobble = (it) => { const t = tau - it.lock; return t > 0 ? it.amp * Math.sin(t * 13) * Math.exp(-t * 5.2) : 0; };
    const mat = (f, O) => [f.X[0], f.X[1], f.X[2], 0, f.Y[0], f.Y[1], f.Y[2], 0, f.Z[0], f.Z[1], f.Z[2], 0, O[0], O[1], O[2], 1];
    // Sheets that share a plane are kept a few thousandths of a millimetre apart, in the order they were packed.
    const lift = (O, f, k) => v3.add(O, v3.mul(f.Z, k * .000004));
    for (const it of this.items) {
      if (it.type !== 'v') continue;
      const F = it.F = frame(it, wobble(it));
      it.dynL.dyn.visible = it.dynR.dyn.visible = true; it.dynL.dyn.glow = it.dynR.dyn.glow = 1;
      it.dynL.dyn.set(mat(F.L, lift(F.A, F.L, it.dynL.order)));
      it.dynR.dyn.set(mat(F.R, lift(F.A, F.R, it.dynR.order)));
    }
    for (const it of this.items) {
      if (it.type !== 'f') continue;
      const L = it.side === 'L', un = L ? uL : uR, n = L ? nL : nR, X = L ? v3.mul(uL, -1) : uR;
      const life = it.life ? it.life(tau, it) || {} : {};
      const px = it.x + (life.dx || 0), py = it.y + it.h * 1000 + (life.dy || 0), d = (L ? PW * 1000 - px : px) / 1000;
      const up = it.lift + it.dyn.order * .000004 + (life.hop || 0);
      const O = [G[0] + un[0] * d + n[0] * up, G[1] + un[1] * d + n[1] * up, py / 1000 - PD / 2];
      let mm = mat({ X, Y: [0, 0, -1], Z: n }, O);
      if (life.rot) { const qx = it.pivot ? it.pivot[0] : it.w / 2, qy = it.pivot ? it.pivot[1] : it.h / 2; mm = M.mul(mm, M.mul(M.T(qx, qy, 0), M.mul(M.RZ(life.rot), M.T(-qx, -qy, 0)))); }
      it.dyn.dyn.visible = life.show === undefined ? true : !!life.show;
      it.dyn.dyn.glow = life.glow === undefined ? 1 : life.glow;
      it.dyn.dyn.set(mm);
    }
    for (const it of this.items) {
      if (it.type !== 's') continue;
      const host = this.byName[it.host];
      if (!host) throw new Error(`Spread ${this.index}: ${it.name} has no host ${it.host}`);
      // A layer on tabs follows its host, a moment later and with its own little swing.
      const F = wobble(it) ? frame(host, wobble(host) + wobble(it)) : host.F;
      const f = it.side === 'L' ? F.L : F.R;
      const life = it.life ? it.life(tau, it) || {} : {};
      const u = it.u + (life.du || 0), v = it.v + (life.dv || 0);
      let O = v3.add(v3.add(v3.add(F.A, v3.mul(f.X, u)), v3.mul(f.p, it.off + (life.doff || 0))), v3.mul(f.Y, v));
      O = lift(O, f, it.dyn.order);
      let mm = mat(f, O);
      if (life.rot) { const px = it.pivot ? it.pivot[0] : it.w / 2, py = it.pivot ? it.pivot[1] : 0; mm = M.mul(mm, M.mul(M.T(px, py, 0), M.mul(M.RZ(life.rot), M.T(-px, -py, 0)))); }
      if (life.ry) { const px = it.pivot ? it.pivot[0] : 0; mm = M.mul(mm, M.mul(M.T(px, 0, 0), M.mul(M.RY(life.ry), M.T(-px, 0, 0)))); }
      // lie: 1 lays the layer flat on its page in front of the host (face down), 0 leaves it in the host's plane, -1 lays it
      // back towards the host, face up, so its print stays readable. Measured against the page, so it stays lying while
      // the spread opens and shuts.
      if (life.lie !== undefined) { const th = Math.atan2(v3.dot(f.p, f.Z), v3.dot(f.p, f.Y)); life.rx = (life.rx || 0) + (life.lie >= 0 ? (th - .02) * life.lie : (PI - th - .02) * life.lie); }
      if (life.rx) { const py = it.pivot ? it.pivot[1] : 0; mm = M.mul(mm, M.mul(M.T(0, py, 0), M.mul(M.RX(life.rx), M.T(0, -py, 0)))); }
      if (life.scale !== undefined) { const px = it.pivot ? it.pivot[0] : it.w / 2, py = it.pivot ? it.pivot[1] : 0; mm = M.mul(mm, M.mul(M.T(px, py, 0), M.mul(M.S(life.scale, life.scale, 1), M.T(-px, -py, 0)))); }
      it.dyn.dyn.visible = life.show === undefined ? true : !!life.show;
      it.dyn.dyn.glow = life.glow === undefined ? 1 : life.glow;
      it.dyn.dyn.set(mm);
    }
  }
}
