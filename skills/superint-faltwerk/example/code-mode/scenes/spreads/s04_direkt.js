// Spread 4, "Der direkte Weg": the same hall at dusk. The model writes a call, all five hundred invoices come back
// into the window, and round after round the reading light runs up the whole stack.
import { Spread } from '../popup.js';
import { C, CALLS, callCard, listing, clamp, ease, between } from '../techkit.js';
import { buildHall, PAL, LAYER, MARKS, PIECE, journey, pulse, spans, plateGlow, tableDisplay, standUp, inOrder, cardWell } from '../hall.js';

const TX = { title: 'Der direkte Weg' };
// The heights of the stack in millimetres (process/buchplan.md).
const HT = { anw: 5, beschr: 45, frage: 12, ruf: 1, rechnungen: 55, zeilen: 6, best: 2 };

export function direkt(s) {
  const S = new Spread(s); S.plan = 50;
  // Seconds after the spread lies open (beats.md); the voice's word times replace them.
  S.t = { aufruf: 2.35, ergebnis: 13.55, runde: 20.35, zweite: 24.15, liest: 29.05, abschreiben: 32.35, zweimal: 40.55, dritte: 42.95 };
  S.setup = t => {
    const glow = [], lamp = [], h0 = HT.anw + HT.beschr + HT.frage;
    // Round 1 ends just before the call is written.
    const r1 = Math.max(.1, t.aufruf - h0 / 40 - .25), read1 = r1 + .2;
    // The call stands while the voice reads it and says what the tool can search for; it arrives as the invoices leave.
    const hold = Math.max(2.4, t.ergebnis - t.aufruf - 3.0), lie = t.aufruf + hold;
    const r2 = t.zweite, read2 = Math.min(t.liest, t.abschreiben - 3.2), h2 = h0 + HT.ruf + HT.rechnungen;
    const r3 = t.dritte, read3 = r3 + .3, h3 = h2 + HT.zeilen + 2 * HT.ruf + HT.best;
    // The chapter's name ends 20 mm from the gutter, 26 mm in from the front edge: whole in the wide shots and in the
    // shots on the cages, out of the frame in those on the call card, the window and the stack.
    // The parts trolley is parked at the far end, in front of CHAT and WETTER, by the tile lifter.
    const H = buildHall(S, PAL.dusk, { title: TX.title, titleAt: [0, 190, 20, 280], trolley: [-.262, .13], pass: tt => pulse(glow, tt), lampOn: tt => spans(lamp, tt), counter: { open: t.runde, steps: [r1 + .15, r2, r3 + .15] } });
    const W = H.ways, win = H.win;
    // The hatch glows when the agent sends everything again: on round 2 that is half a second after the flap opens.
    glow.push(r1, r2 + .5, r2 + 1.5, r3);
    lamp.push([r1 + .2, t.aufruf + .5], [read2 - .1, t.abschreiben + 1.2], [r3 + .2, read3 + h3 / 40 + 1]);

    // ---- what travels
    const call1 = journey(S, 'ruf1', { w: 13, h: 7, draw: PIECE.call, t0: lie + .3, glow, hops: [[W.slotPass, .8], [W.passAgent, .7], [W.fromAgent('RECHNUNGEN'), .8]] });
    const list = journey(S, 'liste', { w: 15, h: 11, draw: PIECE.listing, color: C.listing, t0: Math.max(t.ergebnis, call1.end + .2), glow, hops: [[W.door.RECHNUNGEN, .9], [W.agentPass, .8], [W.passInlet, .85]] });
    const rows = journey(S, 'zeilen', { w: 15, h: 7, draw: PIECE.rows, color: C.page, t0: t.abschreiben, glow, hops: [[W.slotPass, .8], [W.passAgent, .7], [W.fromAgent('TABELLE'), .9]] });
    const call2 = journey(S, 'ruf2', { w: 13, h: 7, draw: PIECE.call, t0: t.abschreiben + .45, hops: [[W.slotPass, .8], [W.passAgent, .7], [W.fromAgent('TABELLE'), .9]] });
    const call3 = journey(S, 'ruf3', { w: 13, h: 7, draw: PIECE.call, t0: t.abschreiben + .9, hops: [[W.slotPass, .8], [W.passAgent, .7], [W.fromAgent('TABELLE'), .9]] });
    const done = call3.end + 1.7;
    const ok = journey(S, 'best', { w: 12, h: 5.5, draw: PIECE.slip(C.green), color: C.cream, t0: Math.min(Math.max(done, t.zweimal + .6), r3 - 2.9), glow, hops: [[W.door.TABELLE, .85], [W.agentPass, .7], [W.passInlet, .8]] });
    const answer = read3 + h3 / 40 + .25;
    journey(S, 'antwort', { w: 13, h: 6, draw: PIECE.slip(C.ink), color: C.cream, t0: answer, glow, hops: [[W.slotPass, .8], [W.passAgent, .8]] });
    plateGlow(S, 'RECHNUNGEN', [call1.end]); plateGlow(S, 'TABELLE', [rows.end, call2.end, call3.end]);
    tableDisplay(S, { fill: [rows.end + .2, rows.end + 2.4], sum: call3.end + .25 });

    // ---- the stack
    const grow = (at, d = .5) => tt => ease((tt - at) / d);
    const marks = tt => between(tt, t.zweimal - .1, t.zweimal + 2.3, .3) * (.72 + .28 * Math.sin((tt - t.zweimal) * 7));
    win.add('anw', HT.anw, LAYER.anw).add('beschr', HT.beschr, LAYER.beschr).add('frage', HT.frage, LAYER.frage)
      .add('ruf1', HT.ruf, LAYER.slab(C.manila), grow(t.aufruf, .4))
      .add('rechnungen', HT.rechnungen, LAYER.rechnungen, grow(list.end - .1, 3.3))
      .add('zeilen', HT.zeilen, LAYER.zeilen, grow(t.abschreiben - .1, 1.2))
      .add('ruf2', HT.ruf, LAYER.slab(C.manila), grow(t.abschreiben + .45, .4))
      .add('ruf3', HT.ruf, LAYER.slab(C.manila), grow(t.abschreiben + .9, .4))
      .add('best', HT.best, LAYER.slab(C.cream, (x, W2, H2) => { x.fillStyle = C.green; x.fillRect(0, 0, 1.4, H2); }), grow(ok.end - .1, .5))
      .overlay('markenR', 4, MARKS.rechnungen, marks)
      .overlay('markenZ', 5, MARKS.zeilen, marks);
    win.read(read1, h0); win.read(read2, h2); win.read(read3, h3);
    win.finish();

    // ---- to read: the call as the model writes it, then one panel of what comes back
    const hu = .076, ho = .114;
    // Both hero pieces rise out of one card well in the floor and lie back into it.
    cardWell(S, 'R', hu - .0015, hu + .0795, ho + .002);
    S.stand('aufruf', { host: 'halle', side: 'R', u: hu, off: ho, w: .066, h: .033, res: 1.6, pivot: [0, 0], lock: .3, amp: 0, color: C.manila, draw(x, W2, H2) { callCard(x, 1.5, 1.5, W2 - 3, H2 - 3, CALLS.rechnungen_liste, { size: 3.05 }); }, life: standUp(t.aufruf, lie, true) });
    const up = t.ergebnis + 1.1, down = Math.min(up + 4.4, t.runde - .5);
    S.stand('feld', { host: 'halle', side: 'R', u: hu, off: ho + .002, w: .078, h: .046, res: 1.6, pivot: [0, 0], lock: .3, amp: 0, color: C.listing, draw(x, W2, H2) { listing(x, 1, 1, W2 - 2, H2 - 2, 112, { rows: 3 }); }, life: standUp(up, down, true) });
  };
  S.cam = t => inOrder([
    [-1.7, [0, .52, .68], [0, .03, -.02], .52, .0024],
    [.6, [.03, .22, .52], [.03, .07, -.03], .46, .0028],
    [t.aufruf + .4, [.088, .1, .35], [.082, .045, .02], .38, .0026],
    [t.aufruf + 3.4, [.09, .1, .345], [.083, .045, .02], .375, .0026],
    [t.ergebnis - 2.9, [.09, .1, .345], [.083, .045, .02], .375, .0026],
    [t.ergebnis - .2, [-.01, .15, .4], [-.01, .045, -.01], .44, .003],
    [t.ergebnis + 2.4, [.072, .062, .34], [.062, .056, .0], .5, .0014],
    [t.runde - .8, [.07, .066, .34], [.06, .06, .0], .5, .0014],
    [t.runde + 1.0, [.055, .1, .3], [.055, .095, -.036], .4, .003],
    [t.liest - .6, [.045, .085, .32], [.045, .085, -.036], .44, .003],
    [t.abschreiben - .4, [.046, .1, .32], [.045, .098, -.036], .44, .003],
    [t.abschreiben + 1.5, [-.03, .17, .42], [-.035, .05, -.02], .44, .003],
    [t.zweimal - .7, [-.04, .16, .4], [-.045, .055, -.02], .43, .003],
    [t.zweimal + .7, [.034, .11, .29], [.033, .098, -.036], .42, .003],
    [t.dritte - .2, [.036, .11, .3], [.036, .095, -.036], .44, .003],
    [t.dritte + 2.2, [.03, .15, .4], [.03, .08, -.03], .46, .003],
    [S.plan - .6, [0, .4, .67], [0, .045, -.02], .51, .0026],
  ]);
  return S;
}
