// The title page's pop-up: both ways in one small picture, from the opening question to "Ist das die Zukunft?".
// Left the KI (the model's rack, as on spread 2), then the agent, then three services with their MCP plugs.
// The usual way runs once: a call goes out, a long listing comes back into the KI. Then the program stands up, calls
// the same tools through the same plugs, keeps their results, and only a small slip goes into the KI.
// It rises while the cover opens and folds flat when the thin title page turns (beats.md, "Doppelseite 1").
import { layer, rect, rrect, circle, text, tone, rgba, TAU } from '../paper.js';
import { C, SERVICE, plate, clamp, ease, on, between } from '../techkit.js';
import { cage, mcpPlug, agentBox, agentDisplay } from '../machines.js';
import { rackModel, way, traveller, PIECE, standUp } from '../hall.js';
import { THIN_LEAD, THIN_LAG } from '../book.js';

const mm = v => v / 1000;
const HOST = 'titelfalz';
// The fold the pieces stand on: a narrow paper strip across the title page. It runs at a slant (a V-fold must, to
// rise while the book opens), so every piece sits at its own distance in front of it and the row stands straight.
const FOLD = { z: .02, alpha: 83, dir: 1, wL: .005, wR: .272, h: .0016 };
const SA = Math.sin(FOLD.alpha * Math.PI / 180), CA = Math.cos(FOLD.alpha * Math.PI / 180);
// Distance in front of the fold that puts a point at u on the page line zb (metres from the page's middle, towards us).
const OFF = (u, zb) => (zb - FOLD.z - u * CA) / SA;
const P = (u, zb) => [u, OFF(u, zb)];
// Page lines (metres; page y = (zb + .118) * 1000 mm): the machines, the slot's mouth, the channel, the program.
const ZB = .065, Z_SLOT = .072, Z_TRUNK = .081, Z_PROG = .092;
// Where things stand: u in metres from the gutter, w and h in millimetres.
const KI = { u: .030, w: 42, h: 85 };            // the model's rack, 0.59 of its size on spread 2
const AG = { u: .088, w: 35, h: 41.4 };          // the agent, 0.8 of its size
const PROG = { u: .084, w: 42, h: 29 };          // the program card, in front of the agent
const CAGE = [['RECHNUNGEN', .141, 44, 62], ['TABELLE', .193, 40, 54], ['MAIL', .241, 38, 58]];
const plateY = h => h * .46 + 5.6;               // the MCP plate's height above the cage's foot, as cage() places it

// The MCP socket without its word: "MCP" comes with the plug, on its word.
function socket(x, cx, cy, w = 9, h = 6) {
  layer(x, C.alu, rrect(cx - w / 2, cy - h / 2, w, h, .7), { lift: .3 });
  for (const sx of [-1, 1]) { x.fillStyle = 'rgba(50,54,56,.6)'; x.beginPath(); x.arc(cx + sx * (w / 2 - 1), cy - h / 2 + 1, .32, 0, TAU); x.fill(); }
  layer(x, '#16181a', rrect(cx - w * .27, cy - h * .12, w * .54, h * .42, .5), { lift: 0, tooth: false });
  x.fillStyle = C.brass; for (let k = 0; k < 4; k++) x.fillRect(cx - w * .2 + k * w * .11, cy + h * .02, w * .06, h * .16);
}
// The program as the eye takes it in at this size: cobalt, lines of code by their indent, the three calls in manila.
function miniProgram(x, W, H) {
  layer(x, C.cobaltDark, rrect(.3, .3, W - .6, H - .6, 1.1), { lift: .5 });
  layer(x, C.cobalt, rrect(.8, .8, W - 1.6, H - 1.6, .8), { lift: 0 });
  const rows = [[0, .55], [1, .8], [2, .5, 1], [1, .7], [2, .62], [1, .5, 1], [2, .66], [1, .58, 1], [1, .44], [0, .2]];
  const lead = (H - 4.2) / rows.length;
  rows.forEach(([ind, len, call], i) => {
    const y = 2.4 + i * lead, x0 = 2.4 + ind * 1.9, w = (W - 4.8 - ind * 1.9) * len;
    x.fillStyle = call ? C.manila : 'rgba(243,236,216,.78)'; x.fillRect(x0, y, w, lead * .42);
  });
}

export function titlePopup(S, T) {
  // Seconds after the title page lies open (beats.md); the voice's word times replace them.
  S.plan = 18;
  S.t = { stecker: .3, direkt: 3.2, nein: 4.3, ki: 7.1, programm: 9.1, aufrufe: 12.1, endergebnis: 15.1, zukunft: 16.9 };
  S.setup = t => {
    S.vfold(HOST, { ...FOLD, lock: 0, amp: .05, color: '#e6dcc4', draw() {} });
    const st = (name, u, zb, o) => S.stand(name, { host: HOST, side: 'R', u, off: OFF(u, zb), lock: .1, amp: .06, ...o });
    const W = pts => way(S, 'R', pts, HOST);

    // ---- the KI: the model's rack, a lamp on its column, the plate "KI" that opens on its word
    st('ki', KI.u, ZB, { w: mm(KI.w), h: mm(KI.h), color: '#1b1e20', draw(x, Wd, Hd) { x.save(); x.scale(Wd / 74, Hd / 150); rackModel(x, 0, 150, 74, 150); x.restore(); } });
    const s = KI.w / 74, lampU = KI.u + mm(59.7 * s), lampV = mm(KI.h - 25 * s);
    const lampOn = tt => Math.max(between(tt, t.ki, t.ki + 1.6, .25), between(tt, slipIn - .1, slipIn + 1.4, .2));
    st('kiLampe', lampU - .0011, ZB, { v: lampV - .0011, off: OFF(KI.u, ZB) + .0008, w: .0022, h: .0022, e: .9, color: C.amber, draw(x, Wd, Hd) { layer(x, C.amber, circle(Wd / 2, Hd / 2, Wd * .46), { lift: 0, tooth: false }); layer(x, '#ffe6ae', circle(Wd * .42, Hd * .4, Wd * .16), { lift: 0, tooth: false }); }, life: tt => { const g = lampOn(tt); return { show: g > .02, glow: g }; } });
    const signU = KI.u + mm(59.7 * s - 5.2);
    st('kiSchild', signU, ZB, { v: mm(KI.h - 13.4 * s - 2), off: OFF(KI.u, ZB) + .0009, w: .0104, h: .0042, res: 1.6, pivot: [0, 0], color: '#e9ecea', draw(x, Wd, Hd) { plate(x, 'KI', Wd / 2, Hd / 2, 2.5, { c: '#e9ecea' }); }, life: standUp(t.ki) });

    // ---- the agent with its display
    st('agent', AG.u, ZB, { w: mm(AG.w), h: mm(AG.h), color: '#b9ad95', draw(x, Wd, Hd) { x.save(); x.scale(Wd / 44, Hd / 52); agentBox(x, 0, 52, 44, 52, { sign: false }); x.restore(); } });
    const as = AG.w / 44;
    st('agentDisp', AG.u + mm(4 * as), ZB, { v: mm(AG.h - (10 + 10.4) * as), off: OFF(AG.u, ZB) + .0007, w: mm(22.9 * as), h: mm(10.4 * as), e: .5, color: '#0f1513', draw(x, Wd, Hd) { agentDisplay(x, Wd, Hd); }, life: tt => ({ glow: .45 + .4 * Math.max(pulse(tt), .3 + .3 * Math.sin(tt * 2.2)) }) });

    // ---- the services: cage, socket, the plug that stands up and seats itself on "MCP"
    const doors = {}, plugT = k => t.stecker + .1 + k * .3, plateAt = {};
    CAGE.forEach(([name, u, w, h], k) => {
      const sv = SERVICE[name], py = plateY(h);
      st('kaefig' + k, u, ZB, { w: mm(w), h: mm(h), lock: .05 + k * .03, amp: .07, color: tone(sv.c, -.3), draw(x, Wd, Hd) { cage(x, 0, Hd, Wd, Hd, sv.kind, name, { c: sv.c, plate: false, signSize: Math.min(2.5, (Wd - 5) / (name.length * .8)) }); socket(x, Wd - 7.2, Hd - py); } });
      const pu = u + mm(w) - .022, t0 = plugT(k);
      st('stecker' + k, pu, ZB, { off: OFF(u, ZB) + .002, w: .017, h: mm(py + 3), pivot: [.0085, 0], amp: 0, res: 1.5, color: tone(sv.cable, -.2), draw(x, Wd, Hd) {
          x.save(); x.strokeStyle = sv.cable; x.lineWidth = 1.2; x.lineCap = 'round'; x.beginPath(); x.moveTo(6, Hd); x.lineTo(6, 6.2); x.quadraticCurveTo(6.2, 3.4, 7.4, 3); x.stroke(); x.restore();
          mcpPlug(x, 11, 3, 1, 1, 'rgba(0,0,0,0)');
          layer(x, '#f4eedd', rrect(2.8, Math.min(17, Hd - 6), 6.4, 3.2, .5), { lift: .2 }); text(x, 'MCP', 6, Math.min(17, Hd - 6) + 1.85, 1.7, { font: 'Jost', weight: 700, color: C.ink }); },
        // Before its word it lies face down in the channel: no "MCP" to read yet.
        life: tt => { const k2 = tt - t0, up = k2 <= 0 ? 0 : Math.min(1, 1 - Math.exp(-k2 * 5) * Math.cos(k2 * 6)); return { lie: 1 - up, du: -.0034 * (1 - ease((k2 - .45) / .25)) }; } });
      const lu = u + mm(w) - .0108;
      st('led' + k, lu, ZB, { v: mm(py + 2.3), off: OFF(u, ZB) + .0008, w: .0016, h: .0016, e: .9, color: C.green, draw(x, Wd, Hd) { layer(x, C.green, circle(Wd / 2, Hd / 2, Wd * .42), { lift: 0, tooth: false }); }, life: tt => ({ show: tt > t0 + .7, glow: .7 * on(tt, t0 + .7, .2) }) });
      doors[name] = u + mm(w) * .3;
      plateAt[name] = [u + mm(w - 7.2 - 6), py, u];
    });
    // A socket answers when a call arrives: an amber frame round it.
    const answers = { RECHNUNGEN: [], TABELLE: [], MAIL: [] };
    CAGE.forEach(([name], k) => { const [pu, py, cu] = plateAt[name]; st('glimmt' + k, pu, ZB, { v: mm(py - 4.5), off: OFF(cu, ZB) + .0046, w: .012, h: .009, e: 1, lock: .2, amp: 0, color: C.amber, draw(x, Wd, Hd) { x.strokeStyle = '#ffc45a'; x.lineWidth = 1.1; x.beginPath(); rrect(.8, .8, Wd - 1.6, Hd - 1.6, 1.2)(x); x.stroke(); }, life: tt => { const g = answers[name].reduce((a, T) => Math.max(a, between(tt, T - .1, T + .8, .2)), 0); return { show: g > .02, glow: g }; } }); });

    // ---- the channels on the page: from the KI's slot along the front to every door, and from the program card
    const kx = KI.u + mm(KI.w * .8), ax = AG.u + mm(AG.w / 2), px = PROG.u + mm(PROG.w / 2);
    const kiAgent = W([P(kx, Z_SLOT), P(kx, Z_TRUNK), P(ax, Z_TRUNK), P(ax, ZB - .003)]);
    const agentKi = W([P(ax, ZB - .003), P(ax, Z_TRUNK), P(kx, Z_TRUNK), P(kx, Z_SLOT)]);
    const agentKiIn = W([P(ax, ZB - .003), P(ax, Z_TRUNK), P(kx, Z_TRUNK), P(kx, ZB - .004)]);
    const toDoor = name => W([P(ax, ZB - .003), P(ax, Z_TRUNK), P(doors[name], Z_TRUNK), P(doors[name], ZB + .004)]);
    const fromDoor = name => W([P(doors[name], ZB + .004), P(doors[name], Z_TRUNK), P(ax, Z_TRUNK), P(ax, ZB - .003)]);
    const progAgent = W([P(px, Z_PROG - .002), P(px, Z_TRUNK), P(ax, Z_TRUNK), P(ax, ZB - .003)]);
    const pileAt = k => P(PROG.u + mm(PROG.w) + .008 + k * .007, Z_PROG + .002 + k * .001);
    const agentPile = k => W([P(ax, ZB - .003), P(ax, Z_TRUNK), P(pileAt(k)[0], Z_TRUNK), pileAt(k)]);
    // The channel print, one flat sheet: brass-edged slots under every way.
    const all = [kiAgent, ...CAGE.map(([n]) => toDoor(n)), progAgent, agentPile(2)];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const w of all) for (const [a, b] of w.P) { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, a); y1 = Math.max(y1, b); }
    x0 -= 4; y0 -= 4; x1 += 4; y1 += 4;
    S.flat('kanal', { side: 'R', x: x0, y: y0, w: mm(x1 - x0), h: mm(y1 - y0), lift: .0009, color: '#2a2520', draw(x) {
      x.save(); x.translate(-x0, -y0);
      const line = (w, c, lw) => { x.strokeStyle = c; x.lineWidth = lw; x.lineJoin = 'round'; x.lineCap = 'butt'; x.beginPath(); w.P.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke(); };
      for (const [c, lw] of [['rgba(40,30,16,.22)', 3.6], [C.brass, 2.9], ['#2a2520', 2.2], ['rgba(0,0,0,.35)', .9]]) for (const w of all) line(w, c, lw);
      x.restore(); } });

    // ---- the usual way, once: a call out to RECHNUNGEN, the long listing back into the KI. It stays there.
    const d0 = t.direkt + .05;
    traveller(S, 'rufDirekt', { side: 'R', lift: .0016, w: 11, h: 8, draw: PIECE.call, legs: [{ way: kiAgent, t0: d0, t1: d0 + .4 }, { way: toDoor('RECHNUNGEN'), t0: d0 + .45, t1: d0 + .85 }] });
    answers.RECHNUNGEN.push(d0 + .85);
    const l0 = d0 + 1.0, lEnd = l0 + 1.05, dim = Math.max(t.nein + .5, lEnd + .3);
    const listing = (x, Wd, Hd) => { for (let i = 2; i >= 0; i--) layer(x, i % 2 ? C.listing : tone(C.stripe, -.1), rect(.4 + i * .35, .4 + i * .3, Wd - 1.6, Hd - 1.4), { lift: .2, sh: .3 }); for (let r = 0; r < 9; r++) { x.fillStyle = r % 2 ? 'rgba(0,0,0,0)' : tone(C.stripe, -.16); x.fillRect(.4, .6 + r * (Hd - 1.4) / 9, Wd - 1.6, (Hd - 1.4) / 9); } x.fillStyle = 'rgba(46,38,30,.55)'; for (let y = 1; y < Hd - 1; y += 1.3) { x.beginPath(); x.arc(1.1, y, .22, 0, TAU); x.arc(Wd - 1.9, y, .22, 0, TAU); x.fill(); } };
    traveller(S, 'listeDirekt', { side: 'R', lift: .0016, w: 11, h: 34, draw: listing, color: C.listing, stay: true, legs: [{ way: fromDoor('RECHNUNGEN'), t0: l0, t1: l0 + .5 }, { way: agentKi, t0: l0 + .55, t1: lEnd }],
      also: tt => ({ glow: 1 - .42 * ease((tt - dim) / .6) }) });

    // ---- Code Mode: the program stands up, calls the same three tools, keeps the results; a slip goes into the KI
    st('programm', PROG.u, Z_PROG, { w: mm(PROG.w), h: mm(PROG.h), res: 1.6, pivot: [0, 0], lock: .3, amp: 0, color: C.cobalt, draw: miniProgram, life: standUp(t.programm, 1e9, false) });
    const c0 = t.aufrufe + .05, back = [];
    CAGE.forEach(([name], k) => {
      const a = c0 + k * .3;
      traveller(S, 'ruf' + k, { side: 'R', lift: .0016, w: 11, h: 8, draw: PIECE.call, legs: [{ way: progAgent, t0: a, t1: a + .35 }, { way: toDoor(name), t0: a + .4, t1: a + .85 }] });
      answers[name].push(a + .85);
      const r0 = a + 1.0;
      traveller(S, 'ergebnis' + k, { side: 'R', lift: .0016, w: 9, h: 15, draw: listing, color: C.listing, stay: true, legs: [{ way: fromDoor(name), t0: r0, t1: r0 + .45 }, { way: agentPile(k), t0: r0 + .5, t1: r0 + 1.0 }] });
      back.push(r0 + 1.0);
    });
    const slip0 = Math.max(t.endergebnis - .1, back[2] + .3), slipIn = slip0 + .95;
    const slipFrom = W([P(px + .002, Z_PROG + .004), P(px + .002, Z_TRUNK), P(ax, Z_TRUNK), P(ax, ZB - .003)]);
    traveller(S, 'zettel', { side: 'R', lift: .0016, w: 12, h: 7, draw: PIECE.slip(C.cobalt), color: C.cream, legs: [{ way: slipFrom, t0: slip0, t1: slip0 + .4 }, { way: agentKiIn, t0: slip0 + .45, t1: slipIn }] });
    // The agent's display answers whenever something passes through it.
    const through = [d0 + .42, l0 + .52, ...CAGE.map((_, k) => c0 + k * .3 + .37), ...back.map(b => b - .48), slip0 + .42];
    function pulse(tt) { let g = 0; for (const T of through) g = Math.max(g, between(tt, T - .15, T + .35, .12)); return g; }

    // ---- the question, printed under the title on its word
    S.flat('frage', { side: 'R', x: 94, y: 95, w: .12, h: .016, lift: .0009, color: '#ece2c8', draw(x, Wd, Hd) { text(x, T.titleAsk, Wd / 2, Hd / 2 + .4, 8.6, { weight: 600, color: '#2b2420', track: .4 }); },
      life: tt => ({ show: tt >= t.zukunft - .03, glow: .55 + .45 * ease((tt - t.zukunft) / .35) }) });
  };

  // Every standing piece is glued to the page on a folded tab: the tab lies in front of its foot, a crease where it
  // bends up, and a tight shade where the piece meets the paper. Printed under the pop-up, so it holds when it folds.
  const pageR = S.pages.R;
  S.page('R', (x, W, H) => {
    pageR(x, W, H);
    const fx = -CA, fy = SA, D = 2.6;
    const feet = [[KI.u, KI.w, 1.25], [AG.u, AG.w, 1.1], ...CAGE.map(([, u, w]) => [u, w, 1])];
    for (const [u, w, k] of feet) {
      const off = OFF(u, ZB), a = S.spot(HOST, 'R', u, off), b = S.spot(HOST, 'R', u + mm(w), off);
      const ex = (b[0] - a[0]) / w, ey = (b[1] - a[1]) / w, at = (p, s, d) => [p[0] + ex * s + fx * d, p[1] + ey * s + fy * d];
      // the shade under the foot, a little towards the front right, away from the lamp
      for (const [lw, al] of [[4.2, .05 * k], [2.2, .08 * k], [.9, .14 * k]]) { x.save(); x.strokeStyle = `rgba(30,22,12,${al})`; x.lineWidth = lw; x.lineCap = 'round'; x.beginPath(); const p = at(a, .6, .5), q = at(b, .6, .5); x.moveTo(p[0], p[1]); x.lineTo(q[0], q[1]); x.stroke(); x.restore(); }
      // the tab: board paper, trimmed at its corners, glued flat
      const tab = [at(a, .4, .15), at(b, -.4, .15), at(b, -1.6, D), at(a, 1.6, D)];
      layer(x, '#e2d6ba', x2 => { x2.moveTo(tab[0][0], tab[0][1]); for (const p of tab.slice(1)) x2.lineTo(p[0], p[1]); x2.closePath(); }, { lift: .22, sh: .3 });
      // the crease and a lit lip at the tab's cut edge
      x.strokeStyle = 'rgba(70,50,28,.42)'; x.lineWidth = .22; x.beginPath(); x.moveTo(tab[0][0], tab[0][1]); x.lineTo(tab[1][0], tab[1][1]); x.stroke();
      x.strokeStyle = 'rgba(255,250,236,.55)'; x.lineWidth = .16; x.beginPath(); x.moveTo(tab[3][0], tab[3][1] - .08); x.lineTo(tab[2][0], tab[2][1] - .08); x.stroke();
    }
    // Each MCP cable runs down into the page through a brass-lipped slot: the plug's tab slides along it into its socket.
    CAGE.forEach(([, u, w]) => {
      const off = OFF(u, ZB) + .002, pu = u + mm(w) - .022 + .006;
      const a = S.spot(HOST, 'R', pu - .0034 - .0009, off), b = S.spot(HOST, 'R', pu + .0009, off);
      const cap = (lw, c) => { x.save(); x.strokeStyle = c; x.lineWidth = lw; x.lineCap = 'round'; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); x.restore(); };
      cap(2.5, 'rgba(40,30,16,.2)'); cap(2.0, C.brass); cap(1.55, tone(C.brass, -.25)); cap(1.15, '#1f1b17');
      x.save(); x.strokeStyle = 'rgba(255,236,180,.6)'; x.lineWidth = .14; x.beginPath(); x.moveTo(a[0] + .2, a[1] + .95); x.lineTo(b[0] - .2, b[1] + .95); x.stroke(); x.restore();
    });
  });

  // The thin title page bends while it turns (book.js): the pop-up lies on the chord of that bend, as on spread 2.
  const ET = u => { u = clamp(u); return 2.1 * u * u - 1.1 * u * u * u; };
  const unET = s => { let a = 0, b = 1; for (let i = 0; i < 32; i++) { const m = (a + b) / 2; if (ET(m) < s) a = m; else b = m; } return (a + b) / 2; };
  // Only while the leaf is really turning: at rest the right page lies at the stack's own small angle.
  const place0 = S.place.bind(S), START = 0;
  S.place = (kin, tau) => {
    if (tau > 0 && kin.psiR > .03) { const s = clamp((kin.psiR - START) / (kin.psiL - START)); if (s > 0 && s < .995) { const raw = unET(s), base = ET(raw * THIN_LEAD), tip = ET((raw - THIN_LAG) / (1 - THIN_LAG)); kin = { ...kin, psiR: START + (kin.psiL - START) * (base + tip) / 2 }; } }
    return place0(kin, tau);
  };
  return S;
}
