// The machines of this book as cut paper: the model's rack, the servers in their cages, the agent, the shaft that
// is the context window, and the screens. Millimetres, like paper.js. Papers and cards: techkit.js.
import { layer, inside, stroke, text, textWidth, rect, rrect, circle, poly, tone, rgba, rnd, TAU, wash } from './paper.js';
import { C, mono, plate, cardEdge, listingEdge, openInvoices, euro, TOTAL, N_OPEN } from './techkit.js';

const led = (x, cx, cy, r, c) => { x.fillStyle = 'rgba(20,22,24,.7)'; x.beginPath(); x.arc(cx, cy, r * 1.5, 0, TAU); x.fill(); x.fillStyle = c; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc(cx - r * .3, cy - r * .3, r * .32, 0, TAU); x.fill(); };
// A fan behind its grille: a ring, blades, a hub. rot: radians.
export function fan(x, cx, cy, r, rot = 0, o = {}) {
  x.save(); x.translate(cx, cy);
  x.fillStyle = o.well || '#15181a'; x.beginPath(); x.arc(0, 0, r, 0, TAU); x.fill();
  x.rotate(rot); x.fillStyle = o.blade || '#5d666b';
  for (let i = 0; i < 7; i++) { x.rotate(TAU / 7); x.beginPath(); x.moveTo(r * .18, 0); x.quadraticCurveTo(r * .55, -r * .5, r * .9, -r * .16); x.quadraticCurveTo(r * .6, r * .05, r * .18, r * .12); x.closePath(); x.fill(); }
  x.fillStyle = o.hub || '#8a9296'; x.beginPath(); x.arc(0, 0, r * .22, 0, TAU); x.fill();
  x.restore();
  x.save(); x.strokeStyle = o.ring || '#7d868a'; x.lineWidth = r * .14; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.stroke(); x.restore();
}
// The model's rack: glass door, eight GPU drawers with fins, fans and lights, coolant hoses, and at chest height
// the slot where what the model writes comes out, the round counter and the lamp. Returns where those parts sit (mm).
export function modelRack(x, a, base, w, h, o = {}) {
  const top = base - h, band = 10.5, n = 8, bandY = top + h * .47, x0 = a + 3.2, x1 = a + w - 8.4, uw = x1 - x0;
  layer(x, '#1d2023', rrect(a, top, w, h, 1.3), { lift: .7 });
  layer(x, '#2a2f33', rect(a + 1.6, top + 8.6, w - 3.2, h - 12.4), { lift: 0 });
  // Feet and the plinth's vent.
  for (const fx of [a + 3, a + w - 6]) layer(x, '#111315', rect(fx, base - 1.6, 3, 1.6), { lift: 0, tooth: false });
  x.fillStyle = 'rgba(0,0,0,.4)'; for (let i = 0; i < 12; i++) x.fillRect(a + 6 + i * (w - 12) / 12, base - 3.1, (w - 12) / 12 - .7, .7);
  // The drawers above and below the slot band.
  const uh = (h - 12.4 - band - 2.2) / n; let y = top + 9.2;
  for (let i = 0; i < n; i++) {
    if (i === 4) y += band + .6;
    const f = i % 2, c = tone('#3b4246', (rnd(51, i) - .5) * .12);
    layer(x, c, rrect(x0, y, uw, uh - .9, .5), { lift: .25, sh: .4 });
    const fr = (uh - .9) * .36, fx = f ? x1 - fr - 1.6 : x0 + fr + 1.6, cy = y + (uh - .9) / 2;
    if (!o.noFans) fan(x, fx, cy, fr, i * .7);
    // Cooling fins: a comb of light and dark.
    const g0 = f ? x0 + 6.2 : x0 + fr * 2 + 4, g1 = f ? x1 - fr * 2 - 4 : x1 - 6.2, fins = 15 + (i % 3) * 3;
    for (let k = 0; k < fins; k++) { const fxk = g0 + k * (g1 - g0) / fins; x.fillStyle = k % 2 ? 'rgba(170,180,184,.5)' : 'rgba(18,20,22,.55)'; x.fillRect(fxk, y + 1.1, (g1 - g0) / fins * .55, uh - 3.1); }
    // Handle, a label strip and two lights at the other end.
    const ex = f ? x0 + 1.2 : x1 - 4.6;
    x.fillStyle = '#9aa3a6'; x.fillRect(ex, y + (uh - .9) * .7, 3.4, .55);
    x.fillStyle = 'rgba(243,236,216,.75)'; x.fillRect(ex, y + 1.2, 3.4, 1.3);
    if (!o.noLeds) { led(x, ex + .8, cy - .2, .5, C.green); led(x, ex + 2.5, cy - .2, .5, i % 3 === 1 ? C.amber : C.green); }
    y += uh;
  }
  // The band: a brass-rimmed slot, the counter's window, the lamp.
  layer(x, '#34393d', rect(a + 1.6, bandY, w - 3.2, band), { lift: .3 });
  const slot = [a + 6.5, bandY + band * .56, w * .44, 2.3];
  layer(x, C.brass, rrect(slot[0] - 1, slot[1] - 1, slot[2] + 2, slot[3] + 2, .9), { lift: .25 });
  layer(x, '#0c0d0e', rrect(slot[0], slot[1], slot[2], slot[3], .5), { lift: 0, tooth: false });
  text(x, 'AUSGABE', slot[0] + slot[2] / 2, bandY + band * .26, 1.75, { font: 'Jost', weight: 700, track: .26, color: 'rgba(233,236,234,.82)' });
  const counter = [a + w * .62, bandY + 1.5, 7, band - 3];
  layer(x, C.brass, rrect(counter[0] - .8, counter[1] - .8, counter[2] + 1.6, counter[3] + 1.6, .8), { lift: .25 });
  layer(x, '#101214', rrect(counter[0], counter[1], counter[2], counter[3], .4), { lift: 0, tooth: false });
  const lamp = [a + w - 8.2, bandY + band * .42];
  layer(x, '#101214', circle(lamp[0], lamp[1], 1.9), { lift: .2, tooth: false }); layer(x, tone(C.amber, -.55), circle(lamp[0], lamp[1], 1.35), { lift: 0, tooth: false });
  // Glass door: a frame, hinges, two slanting reflections.
  x.save(); x.strokeStyle = '#596166'; x.lineWidth = .7; x.strokeRect(a + 1.9, top + 8.9, w - 9.4, h - 13); x.restore();
  inside(x, rect(a + 1.9, top + 8.9, w - 9.4, h - 13), () => { x.fillStyle = 'rgba(255,255,255,.055)'; for (const [u, k] of [[.12, .14], [.34, .05]]) { x.beginPath(); x.moveTo(a + w * (u + k), top); x.lineTo(a + w * (u + k + .1), top); x.lineTo(a + w * (u - .16), base); x.lineTo(a + w * (u - .26), base); x.closePath(); x.fill(); } });
  for (const hy of [top + 22, base - 22]) layer(x, '#7d868a', rect(a + 1.1, hy, 1.4, 5), { lift: .15, tooth: false });
  // Coolant: a black and a copper hose down the right side, with clamps.
  for (const [hx, c] of [[a + w - 5.4, '#141618'], [a + w - 2.9, '#b5713c']]) { layer(x, c, rrect(hx - .75, top + 9, 1.5, h - 13, .7), { lift: .25, sh: .4 }); x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(hx - .5, top + 9, .3, h - 13); for (let k = 0; k < 7; k++) { x.fillStyle = '#9aa3a6'; x.fillRect(hx - 1, top + 16 + k * (h - 26) / 6, 2, .8); } }
  // The head: a vent and the name plate.
  x.fillStyle = 'rgba(0,0,0,.45)'; for (let i = 0; i < 16; i++) x.fillRect(a + 4 + i * (w - 8) / 16, top + 1.5, (w - 8) / 16 - .6, .6);
  if (o.sign !== false) plate(x, o.sign || 'MODELL', a + w / 2, top + 5.4, 3.3, { c: '#e9ecea' });
  return { slot, counter, lamp, bandY, band, top };
}
// The numbers of the counter drum: a strip 0..n that slides behind the counter's window. Each cell is cw x ch.
export function counterStrip(x, cw, ch, n = 4) {
  for (let i = 0; i <= n; i++) {
    layer(x, '#f6f3ea', rect(0, i * ch, cw, ch - .25), { lift: 0, tooth: false });
    if (i) text(x, String(i), cw / 2, i * ch + ch / 2 + .1, ch * .78, { font: 'Jost', weight: 700, color: '#141414' });
    x.fillStyle = 'rgba(0,0,0,.16)'; x.fillRect(0, i * ch, cw, ch * .12); x.fillRect(0, i * ch + ch * .82, cw, ch * .14);
  }
}

// What stands inside each cage: seven servers, none like another. kind decides body, drawers and lights.
const SERVERS = {
  rechnungen: { body: '#17191b', face: '#2b2f32', hk: .86, unit(x, a, y, w, h, i) { const n = 6; for (let k = 0; k < n; k++) { x.fillStyle = k % 2 ? '#3a4044' : '#444b50'; x.fillRect(a + .7 + k * (w - 1.4) / n, y + .7, (w - 1.4) / n - .5, h - 1.4); x.fillStyle = (i + k) % 5 === 0 ? C.amber : C.green; x.fillRect(a + 1.1 + k * (w - 1.4) / n, y + h - 1.5, .7, .45); } } },
  tabelle: { body: '#8d9599', face: '#c5cbcc', hk: .7, unit(x, a, y, w, h, i) { x.fillStyle = 'rgba(40,44,46,.5)'; for (let k = 0; k < 9; k++) x.fillRect(a + 1 + k * (w - 2) / 9, y + h * .3, (w - 2) / 9 - .5, h * .4); x.fillStyle = C.green; x.fillRect(a + w - 2.2, y + .8, .8, .5); } },
  mail: { body: '#d8dbd8', face: '#f1f2ee', hk: .78, n: 13, unit(x, a, y, w, h, i) { x.fillStyle = 'rgba(60,66,70,.42)'; x.fillRect(a + 1, y + h * .42, w * .5, h * .22); x.fillStyle = i % 4 === 2 ? C.amber : C.green; x.fillRect(a + w - 2.4, y + h * .34, .9, h * .36); x.fillStyle = 'rgba(60,66,70,.5)'; x.fillRect(a + w - 5, y + h * .34, 1.6, h * .36); } },
  kalender: { body: '#3d3a36', face: '#575148', hk: .56, n: 4, unit(x, a, y, w, h, i) { for (let k = 0; k < 5; k++) { x.fillStyle = C.amber; x.beginPath(); x.arc(a + 2 + k * 1.9, y + h / 2, .5, 0, TAU); x.fill(); } x.fillStyle = 'rgba(0,0,0,.4)'; for (let k = 0; k < 8; k++) x.fillRect(a + w * .5 + k * w * .055, y + 1, w * .03, h - 2); } },
  dateien: { body: '#23272b', face: '#30363a', hk: .92, n: 4, unit(x, a, y, w, h, i) { for (let k = 0; k < 6; k++) { const bx = a + .8 + k * (w - 1.6) / 6, bw = (w - 1.6) / 6 - .45; x.fillStyle = '#596268'; x.fillRect(bx, y + .7, bw, h - 1.4); x.fillStyle = '#1a1d1f'; x.fillRect(bx + bw * .2, y + 1.3, bw * .6, h * .5); x.fillStyle = (i * 6 + k) % 7 === 3 ? C.amber : C.green; x.fillRect(bx + bw * .25, y + h - 1.9, bw * .5, .5); } } },
  chat: { body: '#5e6f66', face: '#8fa398', hk: .64, n: 5, unit(x, a, y, w, h, i) { x.fillStyle = 'rgba(30,40,36,.45)'; for (let k = 0; k < 3; k++) { x.beginPath(); x.arc(a + 2.2 + k * 2.6, y + h / 2, h * .28, 0, TAU); x.fill(); } x.fillStyle = C.green; x.fillRect(a + w - 3.4, y + h * .4, 2.2, h * .2); } },
  wetter: { body: '#b9bfc0', face: '#dfe3e2', hk: .34, n: 2, unit(x, a, y, w, h, i) { x.fillStyle = 'rgba(40,44,46,.45)'; x.fillRect(a + 1, y + 1, w - 2, h * .25); x.fillStyle = C.green; x.beginPath(); x.arc(a + w - 2, y + h * .7, .55, 0, TAU); x.fill(); } },
};
// The standard plate every server offers its tools on.
export function mcpPlate(x, cx, cy, w = 9, h = 6) {
  layer(x, C.alu, rrect(cx - w / 2, cy - h / 2, w, h, .7), { lift: .3 });
  for (const sx of [-1, 1]) { x.fillStyle = 'rgba(50,54,56,.6)'; x.beginPath(); x.arc(cx + sx * (w / 2 - 1), cy - h / 2 + 1, .32, 0, TAU); x.fill(); }
  layer(x, '#16181a', rrect(cx - w * .27, cy - h * .12, w * .54, h * .42, .5), { lift: 0, tooth: false });
  x.fillStyle = C.brass; for (let k = 0; k < 4; k++) x.fillRect(cx - w * .2 + k * w * .11, cy + h * .02, w * .06, h * .16);
  text(x, 'MCP', cx, cy - h * .27, h * .27, { font: 'Jost', weight: 700, track: .16, color: C.ink });
}
// A server in its cage: the machine, then the mesh, posts, a door with the service's name, the MCP plate.
// (a, base): lower left of the cage; returns where its plate, door and rack sit.
export function cage(x, a, base, w, h, kind, label, o = {}) {
  const S = SERVERS[kind], top = base - h, rw = w * (o.rackW || .6), rh = (h - 9) * S.hk, ra = a + (w - rw) * (o.rackAt ?? .42), n = S.n || 7;
  // The back of the cage in its service's colour (o.c), darker towards the top where the light does not reach.
  const col = o.c || '#aab0ae', dim = o.dim || 0, ST = '#5d6164';
  layer(x, tone(col, -dim), rect(a, top, w, h), { lift: .5 });
  inside(x, rect(a, top, w, h), wash(a, top, a, base, 'rgba(20,16,14,.34)', 'rgba(20,16,14,.06)'));
  if (kind === 'wetter') {
    // A small box on the wall, a conduit down to the floor.
    layer(x, '#8d9599', rect(ra + rw * .46, base - h * .5, 1.4, h * .5), { lift: .2 });
    layer(x, S.body, rrect(ra, base - h * .5 - rh, rw, rh, .8), { lift: .5 });
    for (let i = 0; i < n; i++) S.unit(x, ra + .8, base - h * .5 - rh + .9 + i * (rh - 1.8) / n, rw - 1.6, (rh - 1.8) / n - .4, i);
  } else {
    layer(x, S.body, rrect(ra, base - rh, rw, rh, .8), { lift: .55 });
    const uh = (rh - 3.4) / n;
    for (let i = 0; i < n; i++) { layer(x, tone(S.face, (rnd(41 + kind.length, i) - .5) * .08), rect(ra + 1, base - rh + 1.4 + i * uh, rw - 2, uh - .45), { lift: .15, sh: .3 }); S.unit(x, ra + 1, base - rh + 1.4 + i * uh, rw - 2, uh - .45, i); }
    for (const fx of [ra + 1, ra + rw - 3]) layer(x, '#0e0f10', rect(fx, base - 1.2, 2, 1.2), { lift: 0, tooth: false });
  }
  if (kind === 'tabelle') { const dw = rw * .7, dh = rw * .46; layer(x, '#16181a', rrect(ra + (rw - dw) / 2, base - rh - dh - 2.5, dw, dh, .6), { lift: .35 }); layer(x, '#6d767a', rect(ra + rw / 2 - .7, base - rh - 2.5, 1.4, 2.5), { lift: .1 }); }
  // The mesh: expanded metal, a net of diamonds over everything behind it.
  inside(x, rect(a + 1.6, top + 1.6, w - 3.2, h - 3.2), () => {
    x.strokeStyle = 'rgba(70,74,78,.7)'; x.lineWidth = .22; const s = o.mesh || 3.1;
    x.beginPath(); for (let d = -h; d < w + h; d += s) { x.moveTo(a + d, top); x.lineTo(a + d + h * .62, base); x.moveTo(a + d + h * .62, top); x.lineTo(a + d, base); } x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.2)'; x.lineWidth = .08; x.beginPath(); for (let d = -h; d < w + h; d += s) { x.moveTo(a + d + .18, top); x.lineTo(a + d + .18 + h * .62, base); } x.stroke();
  });
  // Posts, top rail, a mid rail.
  for (const px of [a, a + w - 1.8]) layer(x, ST, rect(px, top, 1.8, h), { lift: .35 });
  layer(x, ST, rect(a, top, w, 1.9), { lift: .35 }); layer(x, tone(ST, -.1), rect(a, base - h * .46, w, 1.1), { lift: .25 });
  // The kick plate in the service's colour, and the door: its frame, hinges, a latch, the sign.
  layer(x, tone(col, -dim - .12), rect(a, base - Math.min(9, h * .12), w, Math.min(9, h * .12)), { lift: .25 });
  x.fillStyle = 'rgba(255,255,255,.16)'; x.fillRect(a, base - Math.min(9, h * .12), w, .3);
  const dw = Math.min(w * .5, 22), dx = a + (o.doorAt ?? .08) * (w - dw), dh = h * .8;
  x.save(); x.strokeStyle = tone(col, -dim - .3); x.lineWidth = 1.1; x.strokeRect(dx, base - dh, dw, dh - 1.2); x.restore();
  for (const hy of [base - dh + 4, base - 12]) layer(x, '#3d4346', rect(dx - .7, hy, 1.4, 3), { lift: .12, tooth: false });
  layer(x, '#c49846', rrect(dx + dw - 2.6, base - dh * .5, 1.7, 4.2, .5), { lift: .2, tooth: false });
  const signY = top + 6.4, sw = plate(x, label, a + w / 2, signY, o.signSize || Math.min(2.9, (w - 5) / (label.length * .78)), { c: '#f4eedd' });
  const mcp = [a + w - 7.2, base - h * .46 - 5.6];
  if (o.plate !== false) mcpPlate(x, mcp[0], mcp[1]);
  return { mcp, door: [dx, base - dh, dw, dh], rack: [ra, base - rh, rw, rh], sign: [a + w / 2, signY, sw] };
}
// The plug of an MCP cable: a grey body, brass contacts, the cable leaving through its back, in line with it.
// dir -1: it points left, at a plate left of it.
export function mcpPlug(x, cx, cy, s = 1, dir = -1, cable = C.yellow) {
  x.save(); x.translate(cx, cy); x.scale(dir * s, s);
  stroke(x, [[-3.6, 0], [-9, 0], [-12, 2.4], [-14, 9]], cable, 1.1, { smooth: true, lift: .2 });
  layer(x, '#3d4346', rrect(-4, -1.9, 5.2, 3.8, .7), { lift: .3 });
  layer(x, '#dfe3e2', rect(1.2, -1.2, 2.2, 2.4), { lift: .15 });
  x.fillStyle = C.brass; for (let k = 0; k < 4; k++) x.fillRect(1.5, -.95 + k * .52, 1.7, .26);
  x.restore();
}
// The agent: the program between person, model and tools. A waist-high cabinet with vents, a small display, ports.
export function agentBox(x, a, base, w, h, o = {}) {
  const top = base - h;
  layer(x, '#b9ad95', rrect(a, top, w, h, 1.2), { lift: .6 });
  layer(x, '#ece4d3', rrect(a + 1.2, top + 1.2, w - 2.4, h - 4.2, .8), { lift: .25,
    // powder-coated steel: lit from the lamp at the upper left, a little grime gathering towards the foot
    shade: xx => { const g = xx.createLinearGradient(a, top, a + w * .6, base); g.addColorStop(0, 'rgba(255,252,240,.22)'); g.addColorStop(.55, 'rgba(255,252,240,0)'); g.addColorStop(1, 'rgba(90,74,50,.16)'); xx.fillStyle = g; xx.fillRect(a, top, w, h); } });
  for (const fx of [a + 2.5, a + w - 5.5]) layer(x, '#2a2e31', rect(fx, base - 1.4, 3, 1.4), { lift: 0, tooth: false });
  // the front panel's screws, and the seam where the service hatch below the display comes off
  for (const [sx, sy] of [[a + 2.3, top + 2.3], [a + w - 2.3, top + 2.3], [a + 2.3, base - 4.1], [a + w - 2.3, base - 4.1]]) { x.fillStyle = '#a89c84'; x.beginPath(); x.arc(sx, sy, .38, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,250,236,.6)'; x.beginPath(); x.arc(sx - .1, sy - .12, .14, 0, TAU); x.fill(); x.strokeStyle = 'rgba(40,36,30,.55)'; x.lineWidth = .09; x.beginPath(); x.moveTo(sx - .26, sy + .08); x.lineTo(sx + .26, sy - .08); x.stroke(); }
  { const sy = top + h * .5 - 2.6; x.fillStyle = 'rgba(70,60,44,.3)'; x.fillRect(a + 1.6, sy, w - 3.2, .16); x.fillStyle = 'rgba(255,252,240,.5)'; x.fillRect(a + 1.6, sy + .16, w - 3.2, .12); }
  // a rating label low on the left: a white plate, a few printed lines and a barcode
  { const lx = a + 3.2, ly = base - 8.4; layer(x, '#f6f3ea', rect(lx, ly, 8.4, 3.4), { lift: .08, sh: .15, tooth: false }); x.fillStyle = 'rgba(43,36,32,.5)'; x.fillRect(lx + .5, ly + .5, 4.2, .26); x.fillRect(lx + .5, ly + 1.05, 3.1, .2); for (let k = 0; k < 14; k++) { x.fillStyle = 'rgba(30,28,26,.75)'; x.fillRect(lx + .5 + k * .5 + (k % 3) * .06, ly + 1.65, k % 4 ? .18 : .3, 1.25); } }
  // The vent: a pressed panel held by four screws, with slots of equal length. Each slot is dark inside, with the
  // lamp catching its lower lip, so it reads as cut into the case and never as a line of text.
  { const vx = a + 4, vy = top + h * .5 - 1.2, vw = w - 8, vh = 9 * 1.55 + 1.6;
    layer(x, '#e2d9c6', rrect(vx, vy, vw, vh, .7), { lift: .15, sh: .22, tooth: false });
    for (const [sx, sy] of [[vx + 1, vy + 1], [vx + vw - 1, vy + 1], [vx + 1, vy + vh - 1], [vx + vw - 1, vy + vh - 1]]) { x.fillStyle = '#9a8f78'; x.beginPath(); x.arc(sx, sy, .42, 0, TAU); x.fill(); x.strokeStyle = 'rgba(40,36,30,.6)'; x.lineWidth = .1; x.beginPath(); x.moveTo(sx - .3, sy - .1); x.lineTo(sx + .3, sy + .1); x.stroke(); }
    for (let r = 0; r < 8; r++) { const sy = vy + 1.6 + r * 1.62; layer(x, '#2b2f31', rrect(vx + 2.2, sy, vw - 4.4, .62, .31), { lift: 0, tooth: false }); x.fillStyle = 'rgba(255,250,236,.55)'; x.fillRect(vx + 2.5, sy + .66, vw - 5, .16); x.fillStyle = 'rgba(40,34,26,.25)'; x.fillRect(vx + 2.5, sy - .2, vw - 5, .2); } }
  // The display's bezel (its light is a sheet of its own), the ports to model, person and tools.
  const disp = [a + 4, top + 10, w * .52, h * .2];
  layer(x, '#1c1f21', rrect(disp[0] - 1, disp[1] - 1, disp[2] + 2, disp[3] + 2, .8), { lift: .25 });
  const ports = [];
  for (let k = 0; k < 3; k++) { const px = a + w - 5.6, py = top + 10.4 + k * 3.5; layer(x, '#16181a', rrect(px - 1.7, py - 1.1, 3.4, 2.2, .4), { lift: .1, tooth: false }); x.fillStyle = C.brass; x.fillRect(px - 1.1, py - .1, 2.2, .3); ports.push([px, py]); }
  if (o.sign !== false) plate(x, 'AGENT', a + w / 2, top + 5, 3, { c: '#c49846' });
  return { disp, ports, top };
}
// What the agent's small display shows: three lines.
export function agentDisplay(x, W, H, lit = [1, 1, 1]) {
  x.fillStyle = '#0f1513'; x.fillRect(0, 0, W, H);
  // Three lines of a terminal, set as glyphs: a prompt, words of different lengths, a cursor on the last line. Too
  // small to read, but they read as writing and never as bars.
  const lh = H * .12, cw = lh * .58, gap = lh * .16, words = [[1, 5, 3, 6, 2, 4], [1, 7, 2, 5], [1, 4, 6, 3, 5]];
  lit.forEach((k, i) => {
    const y = H * (.2 + i * .27), x1 = W * .1 + W * (i === 1 ? .5 : i ? .66 : .78);
    let px = W * .1;
    x.fillStyle = k ? C.green : 'rgba(127,209,138,.18)';
    words[i].forEach((n, j) => {
      for (let c = 0; c < n && px + cw <= x1; c++) {
        const s = Math.sin((i * 31 + j * 7 + c) * 12.9898) * 43758.5453, r = s - Math.floor(s), hh = j === 0 ? lh : lh * (r > .7 ? 1 : .74);
        x.fillRect(px, y + lh - hh, cw, hh); px += cw + gap;
      }
      px += cw * .9;
    });
    if (i === 2 && k) { x.fillStyle = 'rgba(127,209,138,.85)'; x.fillRect(Math.min(px, W * .92 - cw), y - lh * .1, cw * 1.1, lh * 1.2); }
  });
  // scan lines and a little glare on the glass
  x.fillStyle = 'rgba(0,0,0,.22)'; for (let yy = 0; yy < H; yy += lh * .5) x.fillRect(0, yy, W, lh * .14);
  { const g = x.createLinearGradient(0, 0, W * .5, H); g.addColorStop(0, 'rgba(255,255,255,.08)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
}

// ---------------------------------------------------------------- the context window
// A tall shaft in front of the model: what the model reads lies in it, layer on layer. Back: the rear wall with its
// scale; front: two posts and thin braces, open between them.
export function shaftBack(x, W, H) {
  layer(x, '#7f888b', rect(0, 0, W, H), { lift: 0 });
  inside(x, rect(0, 0, W, H), wash(0, 0, W, 0, 'rgba(20,24,26,.3)', 'rgba(255,255,255,.08)'));
  x.fillStyle = 'rgba(30,34,36,.5)'; for (let y = H; y > 0; y -= 5) x.fillRect(1.2, y - .1, (Math.round((H - y) / 5) % 5 === 0 ? 4 : 2.2), .22);
  layer(x, '#5f676a', rect(0, H - 2, W, 2), { lift: .2 });
}
export function shaftFront(x, W, H) {
  for (const px of [0, W - 2.4]) { layer(x, C.steel, rect(px, 0, 2.4, H), { lift: .4 }); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(px + .3, 0, .35, H); }
  for (const y of [H * .34, H * .67]) layer(x, tone(C.steel, -.1), rect(0, y, W, 1.1), { lift: .25 });
  layer(x, tone(C.steel, -.16), rect(0, 0, W, 2.2), { lift: .3 }); layer(x, tone(C.steel, -.22), rect(0, H - 2.6, W, 2.6), { lift: .3 });
  for (const px of [1.2, W - 1.2]) for (const y of [1.1, H - 1.3]) { x.fillStyle = 'rgba(40,44,46,.6)'; x.beginPath(); x.arc(px, y, .38, 0, TAU); x.fill(); }
}
// The layers that lie in the shaft, seen from the front. (a, y): left and TOP of the layer; h its height in mm.
export function instrSheet(x, a, y, w, h) { layer(x, C.slate, rect(a, y, w, h), { lift: .2 }); x.fillStyle = 'rgba(255,255,255,.3)'; for (let k = 0; k < Math.floor(h / 1.1); k++) x.fillRect(a + 2, y + .5 + k * 1.1, w * (.5 + rnd(21, k) * .35), .28); }
export function cardStack(x, a, y, w, h, seed = 0, o = {}) { const n = Math.max(1, Math.round(h / (o.th || 1.5))); for (let i = n - 1; i >= 0; i--) cardEdge(x, a, y + i * h / n, w, h / n - .12, seed + i, o); }
export function listingStack(x, a, y, w, h, seed = 0) { const n = Math.max(1, Math.round(h / 1.1)); for (let i = n - 1; i >= 0; i--) listingEdge(x, a, y + i * h / n, w, h / n - .1, seed + i); }

// ---------------------------------------------------------------- screens
// A monitor on its foot: bezel, column, base. The picture is a sheet of its own that glows. Returns the picture's rect.
export function monitor(x, cx, base, w, h, o = {}) {
  const top = base - h - (o.neck ?? 9);
  layer(x, '#23272a', rrect(cx - w * .19, base - 1.6, w * .38, 1.6, .7), { lift: .4 });
  layer(x, '#34393d', rect(cx - 2.2, top + h - 1, 4.4, base - top - h), { lift: .3 });
  layer(x, '#202326', rrect(cx - w / 2, top, w, h, 1.4), { lift: .6 });
  layer(x, '#0d0e10', rect(cx - w / 2 + 2, top + 2, w - 4, h - 4.6), { lift: 0, tooth: false });
  x.fillStyle = 'rgba(255,255,255,.3)'; x.beginPath(); x.arc(cx, top + h - 1.3, .35, 0, TAU); x.fill();
  return [cx - w / 2 + 2, top + 2, w - 4, h - 4.6];
}
const winBar = (x, W, title, c = '#e4dfd2', ink = C.ink) => { x.fillStyle = c; x.fillRect(0, 0, W, 3.6); ['#c9675a', '#d9b24f', '#7fae74'].forEach((k, i) => { x.fillStyle = k; x.beginPath(); x.arc(2.4 + i * 2.1, 1.8, .62, 0, TAU); x.fill(); }); text(x, title, W / 2, 1.95, 2, { font: 'Jost', weight: 500, color: rgba(ink, .8) }); x.fillStyle = 'rgba(43,36,32,.18)'; x.fillRect(0, 3.6, W, .14); };
// The chat window of the agent. o.msg: lines of the person's message; o.reply: lines of the answer.
export function chatScreen(x, W, H, o = {}) {
  x.fillStyle = '#f4f1e8'; x.fillRect(0, 0, W, H); winBar(x, W, o.title || 'Agent');
  // A narrow list of earlier conversations.
  x.fillStyle = '#e9e4d6'; x.fillRect(0, 3.74, W * .2, H); for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(43,36,32,${i === 0 ? .32 : .15})`; x.fillRect(1.4, 6.6 + i * 2.7, W * .2 - 2.8 - (i % 3), .8); }
  const s = o.size || 2.35, lines = o.msg || [], bw = Math.max(...lines.map(l => textWidth(x, l, s, { font: 'Jost', weight: 500 })), 8) + 5, bh = lines.length * s * 1.42 + 3, bx = W - 3 - bw, by = o.by ?? H * .3;
  if (lines.length) {
    layer(x, '#dfe7d6', rrect(bx, by, bw, bh, 1.5), { lift: .25, sh: .22 });
    lines.forEach((l, i) => text(x, l, bx + 2.5, by + 1.5 + s * .78 + i * s * 1.42, s, { font: 'Jost', weight: 500, align: 'left', color: C.ink }));
  }
  if (o.reply) { const rl = o.reply, rw = Math.max(...rl.map(l => textWidth(x, l, s, { font: 'Jost', weight: 500 }))) + 5, ry = by + bh + 2.4; layer(x, '#ffffff', rrect(W * .2 + 3, ry, rw, rl.length * s * 1.42 + 3, 1.5), { lift: .25, sh: .22 }); rl.forEach((l, i) => text(x, l, W * .2 + 5.5, ry + 1.5 + s * .78 + i * s * 1.42, s, { font: 'Jost', weight: 500, align: 'left', color: C.ink })); }
  // The input field with its cursor and the send button.
  layer(x, '#ffffff', rrect(W * .2 + 3, H - 7.2, W * .8 - 6, 4.8, 1.4), { lift: .2, sh: .2 });
  x.fillStyle = rgba(C.ink, .7); x.fillRect(W * .2 + 5, H - 6.2, .3, 2.8);
  layer(x, '#3d4a44', circle(W - 5.6, H - 4.8, 1.5), { lift: 0, tooth: false }); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(W - 6.1, H - 4.4); x.lineTo(W - 5.6, H - 5.5); x.lineTo(W - 5.1, H - 4.4); x.closePath(); x.fill();
}
// A spreadsheet. o.rows: how many of the 41 open invoices are filled in; o.sum: show the total in D43.
export function sheetScreen(x, W, H, o = {}) {
  const filled = o.rows ?? 0, vis = o.visible || 9, y0 = o.bar === false ? 0 : 3.74, rh = (H - y0) / (vis + 1), cols = [.09, .2, .43, .28], open = openInvoices(), s = Math.min(2.1, rh * .62);
  x.fillStyle = '#fbfaf5'; x.fillRect(0, 0, W, H); if (o.bar !== false) winBar(x, W, o.title || 'Offene Rechnungen');
  let cx = 0; const X = cols.map(c => { const v = cx; cx += c * W; return v; });
  x.fillStyle = '#c99a4a'; x.fillRect(0, y0, W, rh);
  ['', 'Nr.', 'Kunde', 'Betrag'].forEach((h, i) => text(x, h, X[i] + 1.2, y0 + rh / 2 + .1, s, { font: 'Jost', weight: 700, align: 'left', color: '#2b2420' }));
  // The last rows of the list scroll into view, so the total is on screen when it is written.
  const first = o.sum ? N_OPEN - vis + 1 : Math.max(0, Math.min(filled - vis + 1, N_OPEN - vis));
  for (let r = 0; r < vis; r++) {
    const y = y0 + (r + 1) * rh, idx = first + r, row = idx + 2;
    if (r % 2) { x.fillStyle = 'rgba(201,154,74,.08)'; x.fillRect(0, y, W, rh); }
    x.fillStyle = 'rgba(43,36,32,.14)'; x.fillRect(0, y + rh - .1, W, .1);
    x.fillStyle = '#efe9da'; x.fillRect(0, y, X[1] - .6, rh - .1);
    text(x, String(row), X[1] - 1.6, y + rh / 2 + .1, s * .86, { font: 'Jost', weight: 500, align: 'right', color: rgba(C.ink, .55) });
    if (idx < N_OPEN && idx < filled) { const v = open[idx]; text(x, v.nr, X[1] + 1.2, y + rh / 2 + .1, s, { font: 'Jost', weight: 500, align: 'left' }); text(x, v.kunde, X[2] + 1.2, y + rh / 2 + .1, s, { font: 'Jost', weight: 500, align: 'left' }); text(x, euro(v.betrag), W - 1.6, y + rh / 2 + .1, s, { font: 'Jost', weight: 500, align: 'right' }); }
    if (idx === N_OPEN && o.sum) { x.fillStyle = 'rgba(201,154,74,.3)'; x.fillRect(X[3] - .6, y, W - X[3] + .6, rh - .1); text(x, 'Summe', X[2] + 1.2, y + rh / 2 + .1, s, { font: 'Jost', weight: 700, align: 'left' }); text(x, euro(TOTAL), W - 1.6, y + rh / 2 + .1, s, { font: 'Jost', weight: 700, align: 'right' }); }
  }
  for (const cxk of X.slice(1)) { x.fillStyle = 'rgba(43,36,32,.14)'; x.fillRect(cxk - .6, y0, .1, H); }
}
// A terminal window. lines: [text, colour?]; o.status: the line at the foot, "Code Mode" in it set in the signal colour.
export function terminalScreen(x, W, H, lines, o = {}) {
  x.fillStyle = '#22262a'; x.fillRect(0, 0, W, H); winBar(x, W, o.title || 'Terminal', '#3a4046', '#f3ecd8');
  const s = o.size || 2;
  lines.forEach((l, i) => mono(x, [l[0]], 2.4, 3.74 + s * 2 + i * s * 1.5, s, { color: l[1] || C.cream }));
  if (o.status) { x.fillStyle = '#181b1e'; x.fillRect(0, H - s * 2.3, W, s * 2.3); mono(x, [o.status], 2.4, H - s * .75, s, { color: C.cream, bold: /(Code Mode)/, boldColor: o.statusColor || C.cobaltLight }); }
}
