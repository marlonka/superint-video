// Spread 5, "Code Mode": the same hall at night, the same task from the start. The model looks up three descriptions,
// writes one program, and the program does the work in a sandbox: the hatch stays dark, the window stays low.
import { Spread } from '../popup.js';
import { layer, inside, rect, rrect, poly, circle, text, tone, rnd } from '../paper.js';
import { C, SERVICE, TOOLS, PROGRAM, PROGRAM_LINE, programCard, miniCard, plate, clamp, ease, between } from '../techkit.js';
import { listingStack } from '../machines.js';
import { buildHall, PAL, LAYER, PIECE, WIN, journey, back, pulse, spans, plateGlow, tableDisplay, standUp, inOrder, cardWell } from '../hall.js';

const TX = { title: 'Code Mode', sandbox: 'SANDBOX', net: 'kein Internet', mark: 'direkter Weg' };
// The heights of the stack in millimetres (process/buchplan.md); the pencil mark sits where the direct way ended.
const HT = { anw: 5, mini: 3, frage: 12, ruf: 1, ts: 4, prog: 2, erg: 1 }, DIRECT = 126;
const LOOKED_UP = ['rechnungen_liste', 'zeilen_anfuegen', 'zelle_schreiben'];
const mm = v => v / 1000;

export function codemode(s) {
  const S = new Spread(s); S.plan = 37.5;
  // Seconds after the spread lies open (beats.md); the voice's word times replace them.
  S.t = { nachschlagen: .95, programm: 7.75, sandbox: 15.65, aufrufe: 21.95, zeile: 29.65, nie: 34.05 };
  S.setup = t => {
    const glow = [], lamp = [], h0 = HT.anw + HT.mini + HT.frage;
    const BOX = { u: -.106, w: 36, h: 15, off: .098 }, SB = { u: -.178, w: 62, h: 52, off: .1 };
    const r1 = Math.max(.1, t.nachschlagen - .85);
    // The tile lifter lies behind the chapter's card here, not under it.
    const H = buildHall(S, PAL.night, { title: TX.title, lifterAt: [250, 120], pass: tt => pulse(glow, tt), lampOn: tt => spans(lamp, tt), counter: { open: -20, steps: [], max: 3 },
      ways: way => ({
        kasten: way('L', [[BOX.u + .018, BOX.off + .004], [BOX.u + .018, .116], [-.057, .116], [-.057, .074]]),
        sb: way('L', [[SB.u + mm(SB.w) + .003, .109], [SB.u + mm(SB.w) + .008, .109], [SB.u + mm(SB.w) + .008, .128], [-.05, .128], [-.05, .074]]),
      }) });
    const W = H.ways, win = H.win;

    // ---- round 1: look up
    const ask = journey(S, 'frag', { w: 13, h: 7, draw: PIECE.call, t0: Math.max(r1 + .5, t.nachschlagen), glow, hops: [[W.slotPass, .5], [W.passAgent, .45], [back(W.kasten), .4]] });
    const open = ask.end, flip = open + .75, shut = open + 2.0;
    const ts = journey(S, 'ts', { w: 13, h: 9, draw: PIECE.cards(C.cream, 3), color: C.cream, t0: shut + .1, glow, hops: [[W.kasten, .5], [W.agentPass, .6], [W.passInlet, .7]] });
    // ---- round 2: the program
    const r2 = Math.max(ts.end + .1, t.programm - 1.2), out = r2 + 1.2;
    const hold = clamp(t.sandbox - out - .9, 3.5, 5.2), lie = out + hold;
    const sbUp = Math.max(t.sandbox, lie + 2.0);
    const tile = journey(S, 'prog', { w: 12, h: 9, draw: PIECE.cobalt, color: C.cobalt, t0: sbUp - 1.85, glow, hops: [[W.slotPass, .7], [W.passAgent, .6], [back(W.sb), .8]] });
    // ---- the program works: the same calls, from the sandbox through the agent
    const c1 = journey(S, 'ruf1', { w: 13, h: 7, draw: PIECE.call, t0: Math.max(t.aufrufe, tile.end + .5), hops: [[W.sb, .7], [W.fromAgent('RECHNUNGEN'), .7]] });
    const l1 = journey(S, 'liste', { w: 15, h: 11, draw: PIECE.listing, color: C.listing, t0: c1.end + .25, hops: [[W.door.RECHNUNGEN, .8], [back(W.sb), .7]] });
    const rw = journey(S, 'zeilen', { w: 15, h: 7, draw: PIECE.rows, color: C.page, t0: l1.end + .7, hops: [[W.sb, .7], [W.fromAgent('TABELLE'), .8]] });
    const c2 = journey(S, 'ruf2', { w: 13, h: 7, draw: PIECE.call, t0: l1.end + 1.0, hops: [[W.sb, .7], [W.fromAgent('TABELLE'), .8]] });
    const c3 = journey(S, 'ruf3', { w: 13, h: 7, draw: PIECE.call, t0: c2.end + .2, hops: [[W.sb, .7], [W.fromAgent('TABELLE'), .8]] });
    // ---- one line comes back; round 3
    const res = journey(S, 'ergebnis', { w: 14, h: 6, draw: PIECE.slip(C.cobalt), color: C.cream, t0: Math.max(t.zeile, c3.end + .3), glow, hops: [[W.sb, .7], [W.agentPass, .6], [W.passInlet, .7]] });
    const r3 = res.end + .1, h3 = h0 + HT.ruf + HT.ts + HT.prog + HT.erg, answer = r3 + .3 + h3 / 40 + .3;
    journey(S, 'antwort', { w: 13, h: 6, draw: PIECE.slip(C.ink), color: C.cream, t0: answer, glow, hops: [[W.slotPass, .8], [W.passAgent, .8]] });
    glow.push(r1, r2, r3);
    lamp.push([r1 + .1, ask.t0 + .3], [r2 + .2, out + .6], [r3 + .2, answer + .4]);
    H.counter.steps.push(r1 + .15, r2 + .1, r3 + .15);
    plateGlow(S, 'RECHNUNGEN', [c1.end]); plateGlow(S, 'TABELLE', [rw.end, c2.end, c3.end]);
    tableDisplay(S, { fill: [rw.end + .1, rw.end + 1.5], sum: c3.end + .2 });

    // ---- the stack
    const grow = (at, d = .5) => tt => ease((tt - at) / d);
    win.add('anw', HT.anw, LAYER.anw)
      .add('mini', HT.mini, (x, W2, H2) => { miniCard(x, .4, .2, W2 / 2 - .8, H2 - .3, 'nachschlagen'); miniCard(x, W2 / 2 + .4, .2, W2 / 2 - .8, H2 - .3, 'code_ausfuehren'); })
      .add('frage', HT.frage, LAYER.frage)
      .add('ruf', HT.ruf, LAYER.slab(C.manila), grow(ask.t0, .4))
      .add('ts', HT.ts, (x, W2, H2) => { for (let i = 0; i < 3; i++) { layer(x, tone(C.cream, -.03 * i), rect((rnd(57, i) - .5) * .8, i * H2 / 3, W2, H2 / 3 - .1), { lift: .12, sh: .25 }); layer(x, SERVICE[TOOLS[LOOKED_UP[i]].server].c, rrect(3 + i * 9, i * H2 / 3 - .5, 5, 1.1, .3), { lift: .08, sh: .2 }); } }, grow(ts.end - .1, .8))
      .add('prog', HT.prog, LAYER.slab(C.cobalt), grow(lie, .5))
      .add('erg', HT.erg, LAYER.slab(C.cream, (x, W2, H2) => { x.fillStyle = C.cobalt; x.fillRect(0, 0, 1.6, H2); }), grow(res.end - .1, .4));
    win.read(r1 + .15, h0); win.read(r2 + .3, h0 + HT.ruf + HT.ts); win.read(r3 + .3, h3);
    win.finish();
    // The pencil mark: this high the stack stood on the direct way.
    const mark = Math.max(t.nie, res.end + .3), mv = mm(win.base + DIRECT);
    S.stand('strich', { host: 'halle', side: 'R', u: WIN.u + .003, v: mv - .0004, off: WIN.off + .0094, w: mm(WIN.w - 6), h: .0011, lock: .2, amp: 0, color: '#e8e2d2', draw(x, W2, H2) { for (let k = 0; k < 11; k++) { x.fillStyle = '#e8e2d2'; x.fillRect(k * W2 / 11, H2 * .15, W2 / 11 * .64, H2 * .7); } }, life: tt => ({ show: tt >= mark }) });
    S.stand('strichText', { host: 'halle', side: 'R', u: WIN.u + .0045, v: mv + .0016, off: WIN.off + .0096, w: .031, h: .0074, res: 1.6, lock: .2, amp: 0, color: C.cream, draw(x, W2, H2) { layer(x, C.cream, poly([[0, .3], [W2 - .4, 0], [W2, H2 - .3], [.5, H2]]), { lift: .25 }); // Written by hand in pencil, as the direction's type table asks (Caveat 700), with the graphite's faint sheen.
      text(x, TX.mark, W2 / 2, H2 / 2 + .25, 4.6, { font: 'Caveat', weight: 700, color: '#45413b' }); x.save(); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, 0, W2, H2 * .45); x.restore(); }, life: tt => ({ show: tt >= mark + .15, dv: -.004 * (1 - ease((tt - mark - .15) / .35)) }) });

    // ---- the card box: closed, then three cards rise and turn from JSON to TypeScript
    const oak = C.oak, bu = BOX.u, bo = BOX.off, k0 = tt => ease((tt - open) / .35) * (1 - ease((tt - shut) / .35));
    S.stand('kastenDeckel', { host: 'halle', side: 'L', u: bu, v: mm(BOX.h), off: bo - .0125, w: mm(BOX.w), h: .019, lock: .2, amp: 0, color: tone(oak, -.2), draw(x, W2, H2) { layer(x, tone(oak, -.18), rrect(0, 0, W2, H2, 1), { lift: .3 });
      // The lid's inside: a sunk panel of the same oak, its grain running across, darker where the lamp does not reach.
      inside(x, rrect(1, 1, W2 - 2, H2 - 2, .6), xx => { xx.fillStyle = tone(oak, -.34); xx.fillRect(0, 0, W2, H2);
        for (let k = 0; k < 22; k++) { const y0 = rnd(27, k) * H2, a = .12 + rnd(28, k) * .3; xx.strokeStyle = `rgba(40,24,10,${.12 + rnd(29, k) * .14})`; xx.lineWidth = .1 + rnd(30, k) * .14; xx.beginPath(); for (let px = 0; px <= W2; px += 2) { const py = y0 + Math.sin(px * .2 + k) * a; px ? xx.lineTo(px, py) : xx.moveTo(px, py); } xx.stroke(); }
        const g = xx.createLinearGradient(0, 0, 0, H2); g.addColorStop(0, 'rgba(255,236,200,.1)'); g.addColorStop(1, 'rgba(0,0,0,.22)'); xx.fillStyle = g; xx.fillRect(0, 0, W2, H2); });
      for (const px of [5, W2 - 5]) { x.fillStyle = C.brass; x.fillRect(px - 1.2, H2 - 2.6, 2.4, 2.6); x.fillStyle = 'rgba(70,50,20,.7)'; x.beginPath(); x.arc(px, H2 - 1.3, .3, 0, 6.3); x.fill(); } }, life: tt => ({ show: tt > .3, dv: -.0195 * (1 - k0(tt)) }) });
    // The box is full: behind its front the tops of the other cards show, each with its service's rider, row behind row.
    S.stand('kastenKarten', { host: 'halle', side: 'L', u: bu + .0012, off: bo - .0092, w: mm(BOX.w) - .0024, h: mm(BOX.h) + .0024, res: 1.6, lock: .2, amp: 0, color: C.manila, draw(x, W2, H2) {
      const SV = Object.values(SERVICE);
      for (let row = 3; row >= 0; row--) {
        const top = 2.6 - row * .45, c = tone(C.manila, -.05 * row - .04);
        for (let k = 0; k < 7; k++) { const rw = 3 + rnd(71 + row, k) * 1.8, rx = .6 + k * (W2 - 4) / 7 + rnd(72 + row, k) * 1.6; layer(x, tone(SV[Math.floor(rnd(73 + row, k) * SV.length)].c, -.06 * row), rrect(rx, top - 1.2, rw, 1.7, .35), { lift: .1, sh: .25, tooth: false }); }
        layer(x, c, rect(0, top, W2, H2 - top), { lift: .18, sh: .3 });
        x.fillStyle = 'rgba(255,248,226,.35)'; x.fillRect(0, top, W2, .14);
      }
    }, life: tt => ({ show: tt > .3 }) });
    LOOKED_UP.forEach((name, i) => {
      const cu = bu + .0012 + i * .0116, rise = tt => ease((tt - open - .2 - i * .12) / .4) * (1 - ease((tt - shut + .25 - i * .05) / .3)), ang = tt => Math.PI * ease((tt - flip - i * .14) / .5);
      const base = { host: 'halle', side: 'L', u: cu, off: bo - .0068 + i * .0003, w: .0104, h: .022, res: 1.6, pivot: [.0052, 0], lock: .2, amp: 0 };
      const sv = SERVICE[TOOLS[name].server];
      S.stand('karteJ' + i, { ...base, color: C.manila, draw(x, W2, H2) { layer(x, sv.c, rrect(1, 0, W2 * .5, 2.4, .4), { lift: .15 }); layer(x, C.manila, rrect(0, 1.4, W2, H2 - 1.4, .6), { lift: .25 }); text(x, name.split('_')[0] + '_', .8, 3.6, 1.25, { font: 'Courier Prime', weight: 700, align: 'left', color: C.ink }); text(x, name.split('_')[1], .8, 4.9, 1.25, { font: 'Courier Prime', weight: 700, align: 'left', color: C.ink }); x.fillStyle = 'rgba(43,36,32,.55)'; for (let r = 0; r < 11; r++) x.fillRect(.9 + (r % 4 ? .7 : 0), 6.6 + r * 1.3, (W2 - 2.6) * (.55 + rnd(63 + i, r) * .45), .42); },
        life: tt => { const a = ang(tt); return { show: tt > .3 && a < Math.PI / 2, dv: -.0215 + .033 * rise(tt), ry: a }; } });
      S.stand('karteT' + i, { ...base, color: C.cream, draw(x, W2, H2) { layer(x, sv.c, rrect(W2 * .5 - 1, 0, W2 * .5, 2.4, .4), { lift: .15 }); layer(x, C.cream, rrect(0, 1.4, W2, H2 - 1.4, .6), { lift: .25 }); text(x, name.split('_')[0] + '_', .8, 3.6, 1.25, { font: 'JetBrains Mono', weight: 700, align: 'left', color: C.ink }); text(x, name.split('_')[1] + '(', .8, 4.9, 1.25, { font: 'JetBrains Mono', weight: 700, align: 'left', color: C.ink }); x.fillStyle = 'rgba(43,36,32,.55)'; for (let r = 0; r < 3; r++) x.fillRect(1.5, 6.8 + r * 1.5, (W2 - 3.4) * (.85 - r * .2), .46); },
        life: tt => { const a = ang(tt); return { show: a >= Math.PI / 2, dv: -.0215 + .033 * rise(tt), ry: a - Math.PI }; } });
    });
    S.stand('kasten', { host: 'halle', side: 'L', u: bu, off: bo, w: mm(BOX.w), h: mm(BOX.h), lock: .2, amp: 0, color: oak, draw(x, W2, H2) {
      layer(x, tone(oak, -.2), rrect(0, 0, W2, H2, 1), { lift: .5 }); layer(x, oak, rrect(.8, .8, W2 - 1.6, H2 - 1.6, .6), { lift: .2 });
      inside(x, rrect(.8, .8, W2 - 1.6, H2 - 1.6, .6), xx => {
        // Quarter-sawn oak: long grain lines that wander a little, and the silver flecks of the rays.
        for (let k = 0; k < 34; k++) { const y0 = rnd(17, k) * H2, a = .15 + rnd(18, k) * .35; xx.strokeStyle = `rgba(90,56,26,${.08 + rnd(19, k) * .12})`; xx.lineWidth = .1 + rnd(20, k) * .16; xx.beginPath(); for (let px = 0; px <= W2; px += 2) { const py = y0 + Math.sin(px * .18 + k) * a; px ? xx.lineTo(px, py) : xx.moveTo(px, py); } xx.stroke(); }
        for (let k = 0; k < 14; k++) { xx.fillStyle = 'rgba(255,236,200,.16)'; xx.fillRect(rnd(21, k) * W2, rnd(22, k) * H2, .8 + rnd(23, k) * 2.2, .22); }
        // Box joints at both ends: the fingers of the side boards show their end grain, darker.
        for (const jx of [.8, W2 - 3]) for (let j = 0; j < 7; j += 2) { const jy = .8 + j * (H2 - 1.6) / 7; xx.fillStyle = tone(oak, -.16); xx.fillRect(jx, jy, 2.2, (H2 - 1.6) / 7); xx.fillStyle = 'rgba(60,36,16,.35)'; xx.fillRect(jx + (jx < 1 ? 2.1 : 0), jy, .12, (H2 - 1.6) / 7); for (let d = 0; d < 3; d++) { xx.fillStyle = 'rgba(60,36,16,.3)'; xx.fillRect(jx + .3 + d * .7, jy + .3, .1, (H2 - 1.6) / 7 - .6); } }
        // The top edge is worn bright where the lid rests.
        xx.fillStyle = 'rgba(255,240,210,.18)'; xx.fillRect(0, .8, W2, .35);
      });
      layer(x, C.brass, rrect(W2 / 2 - 7, 3.2, 14, 5.4, .6), { lift: .2 }); layer(x, C.cream, rect(W2 / 2 - 5.8, 4.2, 11.6, 3.4), { lift: 0 });
      for (let k = 0; k < 3; k++) { x.fillStyle = 'rgba(43,36,32,.5)'; x.fillRect(W2 / 2 - 4.6, 4.9 + k * .9, 9.2 - k * 2, .3); }
      layer(x, C.brass, rrect(W2 / 2 - 2.4, 10.6, 4.8, 1.8, .8), { lift: .25 });
      // Brass corner caps, each held by a pin.
      for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const cx = sx > 0 ? 0 : W2, cy = sy > 0 ? 0 : H2; layer(x, C.brass, poly([[cx, cy], [cx + sx * 3.6, cy], [cx + sx * 3.6, cy + sy * .9], [cx + sx * .9, cy + sy * .9], [cx + sx * .9, cy + sy * 3.6], [cx, cy + sy * 3.6]]), { lift: .2, tooth: false }); x.fillStyle = 'rgba(70,50,20,.7)'; x.beginPath(); x.arc(cx + sx * .5, cy + sy * .5, .28, 0, 6.3); x.fill(); }
    } });
    S.stand('kastenKlappe', { host: 'halle', side: 'L', u: bu - .0006, v: mm(BOX.h) - .0008, off: bo + .0004, w: mm(BOX.w) + .0012, h: .0052, pivot: [0, 0], lock: .2, amp: 0, color: tone(oak, -.1), draw(x, W2, H2) { layer(x, tone(oak, -.26), rrect(0, 0, W2, H2, .8), { lift: .3 }); layer(x, tone(oak, -.08), rrect(.6, .6, W2 - 1.2, H2 - 1.2, .5), { lift: 0 }); layer(x, C.brass, rrect(W2 / 2 - 1.6, H2 - 2.2, 3.2, 2.2, .4), { lift: .15 }); }, life: tt => ({ show: k0(tt) < .5, rx: -1.3 * k0(tt) }) });

    // ---- the program card, to read
    const pu = .074, po = .117, pw = 60, ph = 92, size = (pw - 4) / 21.6, lead = size * 1.42;
    // It rises out of a card well in the floor, as the cards on spreads 3 and 4 do, and lies back into it.
    cardWell(S, 'R', pu - .0015, pu + mm(pw) + .0015, po);
    S.stand('programm', { host: 'halle', side: 'R', u: pu, off: po, w: mm(pw), h: mm(ph), res: 1.6, pivot: [0, 0], lock: .3, amp: 0, color: C.cobalt, draw(x, W2, H2) { programCard(x, 3.5, 1.2, W2 - 4, H2 - 2); }, life: standUp(out, lie, true) });
    const ys = ['rechnungen_liste', 'zeilen_anfuegen', 'zelle_schreiben'].map(k => ph - (1.2 + size * 5.4 + PROGRAM_LINE[k] * lead) + size * .35), at = [1.7, 3.8, 4.6].map(v => out + v * hold / 5.2);
    S.stand('progZeiger', { host: 'halle', side: 'R', u: pu + .0002, off: po + .0006, w: .0046, h: .0034, e: .25, lock: .3, amp: 0, color: C.cream, draw(x, W2, H2) { layer(x, C.manila, poly([[0, 0], [W2, H2 / 2], [0, H2]]), { lift: 0 }); },
      life: tt => { if (tt < at[0] || tt > lie - .25) return { show: false }; let v = ys[0]; for (let i = 1; i < 3; i++) v += (ys[i] - ys[i - 1]) * ease((tt - at[i]) / .3); return { show: true, dv: mm(v) - .0017 }; } });

    // ---- the sandbox: back wall, then the frame with its name; in it the program and what it fetches
    const su = SB.u, so = SB.off, inU = su + .005, ready = tile.end;
    S.stand('sbWand', { host: 'halle', side: 'L', u: su, off: so, w: mm(SB.w), h: mm(SB.h), pivot: [0, 0], lock: .3, amp: 0, color: '#f4f3ee', draw(x, W2, H2) {
      layer(x, '#dcdad2', rrect(0, 0, W2, H2, 1.2), { lift: .5 }); layer(x, '#f4f3ee', rect(1.2, 1.2, W2 - 2.4, H2 - 2.4), { lift: 0 });
      // A lab panel: a fine grid with a mounting hole at every crossing, the light falling off towards the floor.
      inside(x, rect(1.2, 1.2, W2 - 2.4, H2 - 2.4), xx => {
        xx.fillStyle = 'rgba(60,70,80,.12)'; for (let k = 0; k < 12; k++) xx.fillRect(1.2 + k * 5.2, 0, .2, H2); for (let k = 0; k < 10; k++) xx.fillRect(0, 1.2 + k * 5.2, W2, .2);
        xx.fillStyle = 'rgba(60,70,80,.22)'; for (let i = 0; i < 12; i++) for (let j = 0; j < 10; j++) { xx.beginPath(); xx.arc(1.3 + i * 5.2, 1.3 + j * 5.2, .32, 0, 6.3); xx.fill(); }
        const g = xx.createLinearGradient(0, 0, 0, H2); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(60,66,72,.1)'); xx.fillStyle = g; xx.fillRect(0, 0, W2, H2);
      });
    }, life: standUp(sbUp) });
    S.stand('sbProg', { host: 'halle', side: 'L', u: inU + .001, off: so + .005, w: .017, h: .03, res: 1.6, lock: .3, amp: 0, color: C.cobalt, draw(x, W2, H2) { programCard(x, .3, .3, W2 - .6, H2 - .6, { size: .92, lift: .3 }); }, life: tt => ({ show: tt > ready - .1, dv: -.032 * (1 - ease((tt - ready + .1) / .45)) }) });
    // The pointer that runs down its lines as the program works.
    const P = PROGRAM_LINE, steps = [[c1.t0 - .2, P.rechnungen_liste], [l1.end + .1, P.filter], [rw.t0 - .2, P.zeilen_anfuegen], [c2.end - .2, P.reduce], [c3.t0 - .1, P.zelle_schreiben], [res.t0 - .3, P.ret]];
    S.stand('sbZeiger', { host: 'halle', side: 'L', u: inU - .0012, off: so + .0056, w: .0024, h: .002, e: .5, lock: .3, amp: 0, color: C.amber, draw(x, W2, H2) { layer(x, C.amber, poly([[0, 0], [W2, H2 / 2], [0, H2]]), { lift: 0, tooth: false }); },
      life: tt => { if (tt < steps[0][0]) return { show: false }; let ln = steps[0][1]; for (let i = 1; i < steps.length; i++) ln += (steps[i][1] - steps[i - 1][1]) * ease((tt - steps[i][0]) / .3); return { show: true, glow: 1, dv: mm(30 - (.3 + .92 * 5.4 + ln * .92 * 1.42)) - .0007 }; } });
    S.stand('sbListe', { host: 'halle', side: 'L', u: su + .028, off: so + .008, w: .026, h: .034, lock: .3, amp: 0, color: C.listing, draw(x, W2, H2) { listingStack(x, 0, 0, W2, H2, 0); }, life: tt => ({ show: tt > l1.end - .1, dv: -.036 * (1 - ease((tt - l1.end + .1) / 1.3)) }) });
    S.stand('sbRahmen', { host: 'halle', side: 'L', u: su - .001, off: so + .017, w: mm(SB.w) + .002, h: mm(SB.h) + .004, res: 1.5, pivot: [0, 0], lock: .3, amp: 0, color: '#e9e7df', draw(x, W2, H2) {
      const bw = 4.2, hd = 10;
      layer(x, '#e9e7df', xx => { rrect(0, 0, W2, H2, 1.4)(xx); xx.rect(bw, hd, W2 - 2 * bw, H2 - hd - bw); }, { lift: .6, rule: 'evenodd' });
      x.fillStyle = 'rgba(60,70,80,.16)'; x.fillRect(bw - .5, hd - .5, W2 - 2 * bw + 1, .5); x.fillRect(bw - .5, hd, .5, H2 - hd - bw);
      // The opening's other two reveals catch the lamp; a pressed bead runs round the frame's face.
      x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(W2 - bw, hd, .35, H2 - hd - bw); x.fillRect(bw, H2 - bw, W2 - 2 * bw, .35);
      x.strokeStyle = 'rgba(60,70,80,.18)'; x.lineWidth = .16; x.beginPath(); rrect(1.3, 1.3, W2 - 2.6, H2 - 2.6, .9)(x); x.stroke();
      // Vent slots in the header on both sides of the name, and two hinges on the left post.
      for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) { const vx = W2 / 2 + sx * (17 + k * 2.1); x.fillStyle = 'rgba(40,46,52,.55)'; x.fillRect(vx - .35, hd / 2 - 1.6, .7, 3.4); x.fillStyle = 'rgba(255,255,255,.6)'; x.fillRect(vx - .35, hd / 2 + 1.8, .7, .2); }
      for (const hy of [hd + 6, H2 - bw - 8]) { layer(x, '#c9ccc9', rrect(.2, hy, 1.6, 5, .5), { lift: .2, tooth: false }); x.fillStyle = 'rgba(60,66,72,.5)'; x.fillRect(.2, hy + 2.4, 1.6, .2); }
      plate(x, TX.sandbox, W2 / 2, hd / 2 + .2, 3.5, { c: '#f8f7f2' });
      // The glass: two short glints of silvered paper in the upper right of the opening, above whatever stands inside.
      for (const [d, bw, c] of [[0, 1, '#dfe4e2'], [1.9, .42, '#cdd4d1']]) { x.fillStyle = c; x.beginPath(); x.moveTo(W2 - bw - 11.5 + d, hd + 1); x.lineTo(W2 - 11.5 + d, hd + 1); x.lineTo(W2 - bw - 6.4 + d, hd + 7.6); x.lineTo(W2 - bw - 6.4 + d - bw, hd + 7.6); x.closePath(); x.fill(); }
      for (const px of [2.1, W2 - 2.1]) for (const py of [2.1, H2 - 2.1]) { x.fillStyle = 'rgba(60,66,72,.55)'; x.beginPath(); x.arc(px, py, .5, 0, 6.3); x.fill(); }
    }, life: standUp(sbUp + .2) });
    // The network socket in its left post: a red blind cap, and what it means.
    S.stand('sbKappe', { host: 'halle', side: 'L', u: su - .0006, v: .021, off: so + .0176, w: .0036, h: .0036, e: .7, lock: .3, amp: 0, color: C.stamp, draw(x, W2, H2) { layer(x, '#c9382e', circle(W2 / 2, H2 / 2, W2 * .46), { lift: 0, tooth: false }); layer(x, '#e86a5c', circle(W2 * .42, H2 * .4, W2 * .16), { lift: 0, tooth: false }); }, life: tt => ({ show: tt > sbUp + 1.0, glow: .45 + .55 * between(tt, sbUp + 1.1, sbUp + 3.2, .3) }) });
    // The tag hangs on a short cord from the cap: a brass eyelet at its end, the cord's end under the cap.
    S.stand('sbNetz', { host: 'halle', side: 'L', u: su - .0261, v: .0199, off: so + .0174, w: .0285, h: .0058, res: 1.6, lock: .3, amp: 0, color: C.cream, draw(x, W2, H2) {
      const tw = 25, ey = tw - 1.5;
      x.save(); x.strokeStyle = '#3a3e41'; x.lineWidth = .34; x.lineCap = 'round'; x.beginPath(); x.moveTo(ey, H2 / 2); x.quadraticCurveTo(ey + 2.2, H2 / 2 + 1.6, W2 - 1.2, H2 / 2); x.stroke(); x.restore();
      layer(x, C.cream, rrect(0, 0, tw, H2, .7), { lift: .3 });
      layer(x, C.brass, circle(ey, H2 / 2, .75), { lift: .1, tooth: false }); layer(x, '#2a2520', circle(ey, H2 / 2, .34), { lift: 0, tooth: false });
      text(x, TX.net, (tw - 2.4) / 2, H2 / 2 + .1, 2.9, { font: 'Jost', weight: 700, color: C.ink });
    }, life: tt => ({ show: tt > sbUp + 1.0 }) });
  };
  S.cam = t => inOrder([
    [-1.7, [0, .52, .68], [0, .03, -.02], .52, .0024],
    [.2, [-.01, .3, .56], [-.01, .06, -.02], .48, .0026],
    [t.nachschlagen + 1.2, [-.07, .1, .29], [-.072, .03, .012], .36, .003],
    [t.nachschlagen + 5.2, [-.068, .1, .29], [-.07, .03, .012], .355, .003],
    [t.programm - 1.0, [.03, .13, .36], [.03, .06, -.03], .42, .003],
    [t.programm + .8, [.084, .08, .37], [.082, .047, .03], .34, .0026],
    [t.programm + 5.2, [.086, .08, .365], [.083, .047, .03], .335, .0026],
    [t.sandbox + .2, [-.1, .16, .43], [-.09, .04, .0], .46, .0028],
    [t.zeile - .5, [-.097, .155, .42], [-.088, .04, .0], .455, .0028],
    [t.zeile + 1.9, [.02, .12, .34], [.022, .07, -.03], .44, .003],
    [t.zeile + 3.4, [.034, .095, .31], [.034, .078, -.036], .44, .003],
    [S.plan - 1.6, [.034, .095, .315], [.034, .08, -.036], .445, .003],
    [S.plan - .2, [0, .4, .67], [0, .045, -.02], .51, .0026],
  ]);
  return S;
}
