// The world and its time: a desk, a lamp, and the book. One film frame is E.renderFrame(t, story).
// story.frame(t) runs once per film frame, story.sub(ts, ...) once per subframe. Both are pure functions of time.
import { Engine } from './engine.js';
import { Geo, MAT } from './geo.js';
import { M, v3, lin, sampleKeys } from './m.js';
import { Book, PW, PD, PAGE_UV } from './book.js';
import { makeSpreads } from './spreads/index.js';
import { TURNS, CAM, CAM_END, MOMENTS } from './timeline.js';
import { buildDesk } from './desk.js';
import { LOOK } from './look.js';

export const ROOM = { EXT: 1, DESK: 2 };
const BANK = 20;

export async function makeWorld(canvas) {
  const E = new Engine(canvas, 1920, 1080);
  const rooms = [], lights = [];
  const ctx = { E, rooms, lights, ROOM };
  const desk = buildDesk(ctx);

  // Two banks of texture layers. Spreads take them in turn: only two neighbours are ever in view.
  const banks = [0, 1].map(() => Array.from({ length: BANK }, () => E.reserveDoc(true)));
  const spreads = makeSpreads();
  // Named moments of each spread, set from the voice once it exists.
  // A moment the voice names is turned into the spread's own time: seconds after it lies open, in planned time.
  spreads.forEach(S => {
    const m = MOMENTS[S.index], u = TURNS[S.index - 1], c = TURNS[S.index];
    // With the voice known, the spread's plan is the time it really lies open: its seconds are real seconds.
    if (m && u) { const land = u.t0 + u.dur; if (c) S.plan = c.t0 - land; for (const k in m) S.t[k] = m[k] - land; }
    // A spread may build itself only now, with its moments known: setup(t) adds its sheets.
    if (S.setup) S.setup(S.t);
    if (typeof S.cam === 'function') S.cam = S.cam(S.t);
  });

  spreads.forEach(S => S.build(E, ROOM.DESK, banks[S.index % 2]));
  const N = spreads.length, lay = (s, slot) => banks[s % 2][slot];
  const leaves = [];
  const LEATHER = LOOK.leather;
  // Gold foil pressed into the leather: a metal sheet a hair above the board, cut by its own picture.
  // Pressed foil is never a perfect mirror: the leather's grain shows through it and scatters a little light,
  // so the lettering stays gold where it does not catch the lamp (m below 1, a touch rougher).
  const foil = (layer, top) => (g, w, d, th) => g.with({ mat: MAT.plain, m: .76, r: .31, c: '#e3b659', tex: layer, flag: 17 }, () => top
    ? g.rect([0, th + .00006, -PD / 2], [PW, th + .00006, -PD / 2], [PW, th + .00006, PD / 2], [0, th + .00006, PD / 2], [0, 1, 0], PAGE_UV)
    : g.rect([PW, -.00006, -PD / 2], [0, -.00006, -PD / 2], [0, -.00006, PD / 2], [PW, -.00006, PD / 2], [0, -1, 0], PAGE_UV));
  for (let j = 0; j <= N - 2; j++) {
    const kind = j === 0 ? 'cover' : j === 1 ? 'thin' : j === N - 2 ? 'back' : 'board';
    const L = { kind, front: { tex: lay(j, 1) }, back: { tex: lay(j + 1, 0) } };
    if (kind === 'cover') { L.leather = LEATHER; L.front = { tex: lay(0, 1), mat: MAT.leather, r: .6, c: LEATHER }; L.extra = foil(lay(0, 0), true); }
    if (kind === 'back') { L.leather = LEATHER; L.back = { tex: lay(j + 1, 1), mat: MAT.leather, r: .6, c: LEATHER }; L.extra = foil(lay(j + 1, 0), false); }
    leaves.push(L);
  }
  const book = new Book(E, ROOM.DESK, leaves, TURNS);
  const TURN = 2.3;
  // The development reel: from second 1000 on, every spread has 20 seconds to itself. Spread s opens at
  // 1000 + 20 s (lands 2.7 s later), stays, and closes from second 16.5 on. Frame = (1000 + 20 s + x) * 30.
  // A second reel from second 2000 gives every spread 40 seconds (closing from second 36.5): frame = (2000 + 40 s + x) * 30.
  // A third reel from second 3000 gives every spread 60 seconds (closing from second 56.5): frame = (3000 + 60 s + x) * 30.
  const REELS = [[3000, 60], [2000, 40], [1000, 20]];
  const dev = t => { if (t < 999) return null; const [b, len] = REELS.find(r => t >= r[0] - 1); const s = Math.max(1, Math.min(N - 1, Math.floor((t - b) / len))); return { s, t0: b + s * len, close: len - 3.5 }; };
  const devTurns = d => { const a = []; for (let j = 0; j < d.s - 1; j++) a[j] = { t0: -100, dur: 1 }; a[d.s - 1] = { t0: d.t0 + .4, dur: TURN }; a[d.s] = { t0: d.t0 + d.close, dur: TURN }; return a; };
  const turnsAt = t => { const d = dev(t); return d ? devTurns(d) : book.turns; };
  const landedAt = (s, t) => { const d = dev(t); if (d) return s === d.s ? d.t0 + .4 + TURN : s < d.s ? -1e9 : 1e9; const u = book.turns[s - 1]; return u ? u.t0 + u.dur : 1e9; };

  E.setRooms(rooms);
  E.lights = lights;
  E.finishDocs();

  const owner = [-1, -1];
  function ensure(t) {
    const st = book.state(t, turnsAt(t)); let dirty = false;
    for (let s = 0; s < N; s++) {
      const a = s === 0 ? 1 : st.leaf[s - 1].s, b = st.leaf[s] ? st.leaf[s].s : 0;
      if (a > 0 && b < 1 && owner[s % 2] !== s) { spreads[s].paint(); owner[s % 2] = s; dirty = true; }
    }
    if (dirty) E.finishDocs();
  }

  // The camera: keys of the opening from the timeline, then every spread's own keys, set on the moment it lands
  // and stretched to the time it really stays open.
  const WIDE = [[-1.6, [0, .5, .66], [0, .03, -.02], .52, .0024, 0], [1.5, [0, .4, .66], [0, .05, -.03], .5, .0026, 0], [19, [0, .42, .66], [0, .05, -.03], .5, .0026, 0]];
  const camKeys = (S, land, stay) => (S.cam || WIDE).map(k => ({ t: land + (k[0] < 0 ? k[0] : k[0] * stay / S.plan), v: [...k[1], ...k[2], k[3], k[4], k[5] || 0] }));
  const keys = CAM.map(k => ({ t: k[0], v: [...k[1], ...k[2], k[3], k[4], k[5] || 0] }));
  for (let s = 2; s < N; s++) {
    const u = book.turns[s - 1], c = book.turns[s]; if (!u || !spreads[s].cam) continue;
    const land = u.t0 + u.dur, stay = (c ? c.t0 : land + spreads[s].plan) - land;
    // A key that would run backwards (a spread that is only leafed through) is left out.
    for (const k of camKeys(spreads[s], land, stay)) { if (keys.length && k.t <= keys[keys.length - 1].t + .05) continue; keys.push(k); }
  }
  for (const k of CAM_END || []) keys.push({ t: k[0], v: [...k[1], ...k[2], k[3], k[4], k[5] || 0] });
  const devKeys = {};
  const camAt = ts => {
    const d = dev(ts);
    const ks = d ? (devKeys[d.s] || (devKeys[d.s] = camKeys(spreads[d.s], d.t0 + .4 + TURN, spreads[d.s].plan))) : keys;
    const v = sampleKeys(ks, ts); const eye = [v[0], v[1], v[2]], at = [v[3], v[4], v[5]];
    return { eye, at, fov: v[6], aperture: v[7], focus: Math.max(.05, v3.len(v3.sub(at, eye)) + v[8]) };
  };

  const story = {
    frame(t) {
      ensure(t);
      const g = E.grade; g.exp = .82; g.bloom = .03; g.vig = .3; g.sat = 1.05; g.grain = .016; g.ca = .5;
      E.updateRooms();
      E.plane.on = false;
      const st0 = book.state(t, turnsAt(t)), shut = Math.max(1 - st0.leaf[0].s, st0.leaf[N - 2].s);
      desk.frame && desk.frame(t, camAt(t), shut, shut > 0 && t < 30 ? -.07 + t * .04 : 0);
    },
    sub(ts) {
      const c = camAt(ts);
      E.camera.eye = c.eye; E.camera.at = c.at; E.camera.fov = c.fov; E.camera.focus = c.focus; E.camera.aperture = c.aperture;
      E.camera.near = .03; E.camera.far = 30;
      const st = book.place(ts, turnsAt(ts));
      for (let s = 1; s < N; s++) {
        const S = spreads[s], land = landedAt(s, ts);
        // Seconds since the spread lay open, in the spread's planned time, so life() and S.t hold whatever the voice does.
        const d = dev(ts), c2 = book.turns[s], stay = d || !c2 ? S.plan : c2.t0 - land;
        const tau = ts - land;
        S.place(book.spreadKin(st, s), tau > 0 ? tau * S.plan / Math.max(1, stay) : tau);
      }
    },
  };
  await E.ready();
  return { E, render(t, samples) { E.renderFrame(t, story, { samples }); E.gl.finish(); } };
}
