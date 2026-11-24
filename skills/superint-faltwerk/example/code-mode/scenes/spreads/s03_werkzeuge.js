// Spread 3, "Die Werkzeuge": the hall at sunset. Plug after plug seats itself, every cage sends its descriptions
// to the agent, and one bundle goes through the hatch and pushes itself under the question.
import { Spread } from '../popup.js';
import { layer, rect, rrect, poly, text, textWidth, tone } from '../paper.js';
import { C, SERVICE, toolCard, cardEdge, ease, between } from '../techkit.js';
import { buildHall, PAL, CAGES, traveller, standUp, LAYER, inOrder, cardWell } from '../hall.js';

// Printed words. The number: research.md PR20/AN12 (Anthropic: five common servers, 58 tools, about 55,000 tokens).
const TX = { title: 'Die Werkzeuge', plate: ['5 verbreitete Dienste · 58 Werkzeuge', 'rund 55.000 Tokens', 'bevor die Arbeit beginnt'] };

export function werkzeuge(s) {
  const S = new Spread(s); S.plan = 36.5;
  // Seconds after the spread lies open (beats.md); the voice's word times replace them.
  S.t = { mcp: 3.3, mail: 9, karte: 15, stapel: 23.7, zahl: 31.1 };
  S.setup = t => {
    // RECHNUNGEN and TABELLE plug in on "MCP", the other five on "Mail".
    const plug = k => k < 2 ? t.mcp + .2 + k * .4 : t.mail + (k - 2) * .4;
    // The bundle leaves the agent early enough to come up at the inlet on its word.
    const inlet = t.stapel, pass = inlet - 1.25, go = pass - 1.1, down = Math.min(t.karte + 5.6, go - .3);
    // The chapter's name nearer the gutter and the front edge: whole in the wide shots and in the held shot on the card,
    // below the frame in the shots on the cages and on the window.
    const H = buildHall(S, PAL.sunset, { title: TX.title, titleAt: [118, 213, 20], plugs: plug, ways: way => ({ karte: way('L', [[-.0495, .036], [-.0495, .05], [-.102, .05], [-.102, .124]]) }), pass: tt => between(tt, pass - .3, pass + .7, .2), agentLit: tt => .5 + .5 * Math.sin(tt * 2.4) });
    H.win.add('anw', 5, LAYER.anw).add('beschr', 45, LAYER.beschr, tt => ease((tt - inlet + .1) / 2.8)).add('frage', 12, LAYER.frage).finish();
    // The wave: a bundle of cards from every cage to the agent, as soon as its plug is in.
    const bundle = name => (x, W, HH) => { for (let i = 2; i >= 0; i--) layer(x, tone(C.manila, -.05 * i), rrect(.6 + i * .5, 1.6 + i * .45, W - 2.2, HH - 3.2, .6), { lift: .25, sh: .3 }); layer(x, SERVICE[name].c, rrect(1.4, .5, W * .46, 2, .4), { lift: .15 }); for (let k = 0; k < 3; k++) { x.fillStyle = 'rgba(43,36,32,.4)'; x.fillRect(1.6, 3.2 + k * .9, (W - 4.4) * (.9 - k * .2), .28); } };
    CAGES.forEach(([name], k) => traveller(S, 'welle' + k, { side: 'L', w: 9.5, h: 7, legs: [{ way: H.ways.door[name], t0: plug(k) + .95, t1: plug(k) + 2.1 + k * .16 }], draw: bundle(name) }));
    // One bundle from the agent through the hatch to the inlet.
    const big = (x, W, HH) => { for (let i = 4; i >= 0; i--) { layer(x, tone(C.manila, -.04 * i), rrect(.5 + i * .45, 1.8 + i * .4, W - 2.9, HH - 3.6, .6), { lift: .25, sh: .3 }); layer(x, Object.values(SERVICE)[(i * 3) % 7].c, rrect(1.2 + i * 1.9, .6 + i * .4, 2.6, 1.8, .4), { lift: .1 }); } };
    traveller(S, 'buendelL', { side: 'L', w: 12, h: 8, legs: [{ way: H.ways.agentPass, t0: go, t1: pass }], draw: big });
    traveller(S, 'buendelR', { side: 'R', w: 12, h: 8, legs: [{ way: H.ways.passInlet, t0: pass + .25, t1: inlet }], draw: big });
    // The card to read: rechnungen_liste, as its server describes it.
    const cu = -.128, co = .128, cw = 52, ch = 68, fs = 2.55;
    // Its channel ends in a card well let into the floor: a brass-rimmed slot along the card's foot, out of which it
    // stands up and into which it lies back. Before its word the channel leads somewhere, not to bare tiles.
    cardWell(S, 'L', cu - .0015, cu + .0535, co);
    S.stand('karte', { host: 'halle', side: 'L', u: cu, off: co, w: cw / 1000, h: ch / 1000, res: 1.6, pivot: [0, 0], lock: .3, amp: 0, color: C.manila, draw(x, W, HH) { toolCard(x, 7, 6.5, W - 8, HH - 7.5, 'rechnungen_liste', { size: fs }); },
      // Read, it lays itself back on the floor face up: a printed card, not a blank one, for the rest of the spread.
      life: tt => { const r = standUp(t.karte, down)(tt); if (tt > down && r.lie !== undefined) r.lie = -r.lie; return r; } });
    // It comes out of the cage of RECHNUNGEN as a small card and stands up large where it stops.
    traveller(S, 'karteKlein', { side: 'L', w: 10, h: 7.5, legs: [{ way: H.ways.karte, t0: t.karte - 1.5, t1: t.karte - .05 }], draw: bundle('RECHNUNGEN') });
    // The pointer at its margin: name, description, inputSchema.
    const rows = [1, 3, 5].map(i => ch - (6.5 + fs * 4.1 + i * fs * 1.5) + .9), at = [t.karte + .9, t.karte + 1.8, t.karte + 2.9];
    S.stand('zeiger', { host: 'halle', side: 'L', u: cu + .0012, off: co + .0006, w: .0052, h: .0036, e: .2, lock: .3, amp: 0, color: C.stamp, draw(x, W, HH) { layer(x, C.stamp, poly([[0, 0], [W, HH / 2], [0, HH]]), { lift: 0 }); },
      life: tt => { if (tt < at[0] || tt > down - .25) return { show: false }; let v = rows[0]; for (let i = 1; i < 3; i++) v += (rows[i] - rows[i - 1]) * ease((tt - at[i]) / .3); return { show: true, dv: v / 1000 - .0018 }; } });
    // The measured number, standing up on its word.
    S.stand('tafel', { host: 'halle', side: 'L', u: -.214, off: .112, w: .078, h: .04, res: 1.6, pivot: [0, 0], lock: .3, amp: 0, color: C.cream, draw(x, W, HH) {
      layer(x, tone(C.oak, -.25), rrect(0, 0, W, HH, 1.4), { lift: .5 }); layer(x, C.cream, rrect(1.4, 1.4, W - 2.8, HH - 2.8, .8), { lift: .2 });
      text(x, TX.plate[0], W / 2, 8.2, 3.5, { font: 'Jost', weight: 500, color: C.ink });
      // The number as large as the cream face allows, with a margin inside the oak border.
      const big = Math.min(7.3, 7.3 * (W - 2.8 - 7) / textWidth(x, TX.plate[1], 7.3, { weight: 900 }));
      text(x, TX.plate[1], W / 2, 19.5, big, { weight: 900, color: C.ink });
      text(x, TX.plate[2], W / 2, 31.4, 4, { weight: 600, color: 'rgba(43,36,32,.86)' });
      for (const [px, py] of [[4, 4], [W - 4, 4], [4, HH - 4], [W - 4, HH - 4]]) { x.fillStyle = C.brass; x.beginPath(); x.arc(px, py, .8, 0, 6.3); x.fill(); }
    }, life: standUp(t.zahl) });
  };
  S.cam = t => inOrder([
    [-1.7, [0, .52, .68], [0, .03, -.02], .52, .0024],
    [1.4, [-.01, .37, .62], [-.01, .06, -.03], .5, .0026],
    [Math.min(4.6, t.mcp - 1.4), [-.06, .2, .46], [-.07, .06, -.03], .44, .003],
    // A hair above the floor's front: the frame's lower edge passes behind the chapter's name instead of cutting its top.
    [t.mcp + 1.0, [-.05, .174, .4], [-.07, .059, -.03], .44, .003],
    [t.mcp + 4.4, [-.2, .164, .38], [-.17, .054, -.03], .44, .003],
    [t.karte - .2, [-.092, .1, .37], [-.1, .037, .05], .36, .0028],
    [t.karte + 5.2, [-.097, .1, .365], [-.1, .037, .05], .355, .0028],
    [t.stapel - 1.5, [.012, .13, .37], [.012, .05, -.03], .42, .003],
    [t.zahl - 2.6, [.016, .135, .375], [.014, .055, -.03], .42, .003],
    [t.zahl + .3, [-.15, .12, .39], [-.155, .03, .04], .38, .0028],
    [t.zahl + 3.6, [-.148, .12, .39], [-.153, .03, .04], .375, .0028],
    [S.plan - .6, [0, .4, .67], [0, .045, -.02], .51, .0026],
  ]);
  return S;
}
