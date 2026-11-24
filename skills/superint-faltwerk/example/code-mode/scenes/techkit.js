// The real things of this book as cut paper: code and JSON on cards, listing paper, racks, cages, screens.
// Millimetres, like paper.js. Every recurring thing is drawn here once, so it looks the same on every spread.
import { layer, inside, stroke, text, textWidth, rect, rrect, circle, poly, tone, rgba, rnd, TAU, wash } from './paper.js';
import { LOOK } from './look.js';

export const C = {
  ink: '#2b2420', cream: '#f3ecd8', page: '#efe6d2', manila: '#e8d5a2', slate: '#8e969b', steel: '#9aa3a6', anth: '#2f3437',
  listing: '#f4f1e4', stripe: '#d5e6cf', stamp: '#b8433a', green: '#7fd18a', amber: '#f0b44c', yellow: '#e8c23a',
  floorA: '#c8ccc8', floorB: '#b5bab7', wall: '#e1e4e1', alu: '#c9ccc9', brass: '#c49846', oak: '#b98a55',
  cobalt: LOOK.signal, cobaltLight: LOOK.signalLight, cobaltDark: LOOK.signalDark,
};
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ease = u => { u = clamp(u); return u * u * (3 - 2 * u); };
export const easeOut = u => { u = clamp(u); return 1 - (1 - u) * (1 - u) * (1 - u); };
// A card that lies flat and stands up on its word: rx for life(). at: seconds after landing.
export const rise = at => t => { const k = t - at, up = k <= 0 ? 0 : Math.min(1.03, 1 - Math.exp(-k * 4.5) * Math.cos(k * 5.5)); return { show: t > .6, rx: (Math.PI / 2 - .02) * (1 - up) }; };
// The same, and it lies down again at `down`.
export const riseFall = (at, down) => t => { const a = rise(at)(t); if (t <= down) return a; const k = clamp((t - down) / .55); return { show: true, rx: (Math.PI / 2 - .02) * ease(k) }; };
// A lamp that comes on at t0 and stays (0..1), and one that is on between two moments.
export const on = (t, t0, d = .35) => ease((t - t0) / d);
export const between = (t, a, b, d = .3) => ease((t - a) / d) * (1 - ease((t - b) / d));

// ---------------------------------------------------------------- the example: 500 invoices, 41 open, 23,874.60 euros
export const KUNDEN = ['Tischlerei Nord', 'Gärtnerei am Hang', 'Druckhaus Süd', 'Café Ecke', 'Praxis am Markt', 'Fahrradladen West', 'Buchhandlung Linde', 'Hofladen Wiese', 'Bäckerei Korn', 'Optik am Ring', 'Weingut Talblick', 'Schreinerei Ost', 'Blumenhaus Flora', 'Malerei Hell', 'Elektro Mitte', 'Kanzlei am Park'];
const OPEN_AMOUNTS = [1181.9, 124.1, 509.5, 294.6, 377.1, 610.0, 154.3, 255.4, 484.0, 1299.8, 962.9, 160.1, 1358.0, 952.4, 364.0, 1193.9, 355.7, 638.7, 250.1, 842.7, 506.5, 665.9, 339.8, 143.0, 256.5, 426.7, 120.0, 152.8, 340.7, 1333.0, 774.1, 222.0, 338.5, 170.3, 534.6, 1324.2, 1179.3, 396.5, 857.7, 565.0, 858.3];
export const TOTAL = 23874.6, N_INVOICES = 500, N_OPEN = 41;
// Invoice i (1..500). Every twelfth, from the fifth on, is open.
export function invoice(i) {
  const k = (i - 5) / 12, open = i >= 5 && Number.isInteger(k) && k < N_OPEN;
  const betrag = open ? OPEN_AMOUNTS[k] : Math.round((90 + rnd(7, i) * rnd(8, i) * 1900) * 10) / 10;
  return { nr: 'R-' + String(i).padStart(4, '0'), kunde: KUNDEN[Math.floor(rnd(5, i) * KUNDEN.length)], betrag, offen: open };
}
export const openInvoices = () => { const a = []; for (let i = 1; i <= N_INVOICES; i++) { const v = invoice(i); if (v.offen) a.push(v); } return a; };
export const euro = v => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const num = v => v.toFixed(2);

// ---------------------------------------------------------------- type
// Lines of code or JSON, set in a mono face. o.bold: a RegExp with one capturing group; what it matches is set bold.
export function mono(x, lines, x0, y0, size, o = {}) {
  const font = o.font || 'JetBrains Mono', lead = size * (o.lead || 1.45), bold = o.bold;
  x.save(); x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  lines.forEach((ln, i) => {
    let px = x0; const y = y0 + i * lead, parts = bold ? ln.split(bold) : [ln];
    parts.forEach((p, k) => {
      if (!p) return; const b = bold && k % 2 === 1;
      x.font = `${b ? 700 : 400} ${size}px "${font}"`; x.fillStyle = b && o.boldColor ? o.boldColor : (o.color || C.ink);
      x.fillText(p, px, y); px += x.measureText(p).width;
    });
  });
  x.restore(); return y0 + lines.length * lead;
}
// A small sign: a plate with a word in Jost capitals. Returns its width.
export function plate(x, s, cx, cy, size, o = {}) {
  const w = (o.w || textWidth(x, s, size, { font: 'Jost', weight: 700, track: o.track ?? size * .09 }) + size * 1.5), h = o.h || size * 1.75;
  layer(x, o.c || C.alu, rrect(cx - w / 2, cy - h / 2, w, h, o.r ?? .5), { lift: o.lift ?? .3 });
  if (o.screws !== false && w > 8) for (const sx of [-1, 1]) { x.fillStyle = 'rgba(60,64,66,.55)'; x.beginPath(); x.arc(cx + sx * (w / 2 - size * .42), cy, size * .13, 0, TAU); x.fill(); }
  text(x, s, cx, cy + size * .06, size, { font: 'Jost', weight: 700, track: o.track ?? size * .09, color: o.ink || C.ink });
  return w;
}

// ---------------------------------------------------------------- cards
// The services of the hall: door and back wall of each cage, its cable, the machine inside.
export const SERVICE = {
  RECHNUNGEN: { c: '#7b2b2d', cable: '#5a1f21', kind: 'rechnungen' }, TABELLE: { c: '#2e5c48', cable: '#22463a', kind: 'tabelle' },
  MAIL: { c: '#c8902e', cable: '#9a6d20', kind: 'mail' }, KALENDER: { c: '#b75b3b', cable: '#8c432b', kind: 'kalender' },
  DATEIEN: { c: '#6b3f5e', cable: '#4f2e45', kind: 'dateien' }, CHAT: { c: '#8f8a3a', cable: '#6b672b', kind: 'chat' }, WETTER: { c: '#7e9a7c', cable: '#5e745d', kind: 'wetter' },
};
// The tools of the example and which server they belong to. desc: what the description says.
export const TOOLS = {
  rechnungen_liste: { server: 'RECHNUNGEN', desc: 'Rechnungen je Jahr', arg: ['jahr', 'integer'] },
  rechnung_lesen: { server: 'RECHNUNGEN', desc: 'Liest eine Rechnung.', arg: ['nr', 'string'] },
  mahnung_senden: { server: 'RECHNUNGEN', desc: 'Sendet eine Mahnung.', arg: ['nr', 'string'] },
  kunde_suchen: { server: 'RECHNUNGEN', desc: 'Sucht einen Kunden.', arg: ['name', 'string'] },
  zeilen_anfuegen: { server: 'TABELLE', desc: 'Fügt Zeilen an.', arg: ['zeilen', 'array'] },
  zelle_schreiben: { server: 'TABELLE', desc: 'Schreibt eine Zelle.', arg: ['zelle', 'string'] },
  tabelle_oeffnen: { server: 'TABELLE', desc: 'Öffnet eine Tabelle.', arg: ['name', 'string'] },
  mail_senden: { server: 'MAIL', desc: 'Sendet eine Mail.', arg: ['an', 'string'] },
  postfach_suchen: { server: 'MAIL', desc: 'Sucht im Postfach.', arg: ['text', 'string'] },
  termin_anlegen: { server: 'KALENDER', desc: 'Legt einen Termin an.', arg: ['beginn', 'string'] },
  termine_liste: { server: 'KALENDER', desc: 'Listet Termine.', arg: ['tag', 'string'] },
  datei_lesen: { server: 'DATEIEN', desc: 'Liest eine Datei.', arg: ['pfad', 'string'] },
  ordner_liste: { server: 'DATEIEN', desc: 'Listet einen Ordner.', arg: ['pfad', 'string'] },
  nachricht_senden: { server: 'CHAT', desc: 'Sendet eine Nachricht.', arg: ['kanal', 'string'] },
  wetter_abfragen: { server: 'WETTER', desc: 'Fragt das Wetter ab.', arg: ['ort', 'string'] },
};
export const toolJson = name => { const t = TOOLS[name]; return ['{', ' "name":', `  "${name}",`, ' "description":', `  "${t.desc}",`, ' "inputSchema": {', '  "type": "object",', '  "properties": {', `   "${t.arg[0]}": {`, `    "type": "${t.arg[1]}"`, '   }', '  } }', '}']; };
// The same description as the Code Mode card box hands it out: a TypeScript signature.
export const toolTs = name => { const t = TOOLS[name], ty = t.arg[1] === 'integer' ? 'number' : t.arg[1] === 'array' ? 'Zeile[]' : 'string', list = name === 'rechnungen_liste'; return [`${name}(`, ` input: {`, `  ${t.arg[0]}${list ? '?' : ''}: ${ty} }`, `): Promise<`, `  ${list ? 'Rechnung[]' : 'void'}>`]; };
// A tool description: a manila index card with a rider for its server and real JSON. (a, b): top left of the card body.
export function toolCard(x, a, b, w, h, name, o = {}) {
  const t = TOOLS[name], size = o.size || w / 19.5, tabW = Math.min(w * .62, textWidth(x, t.server, size * .86, { font: 'Jost', weight: 700, track: .14 }) + 3.4), tx = a + (o.tabAt ?? .1) * (w - tabW);
  const c = o.c || C.manila;
  layer(x, SERVICE[t.server].c, rrect(tx, b - 3.6 * size / 1.9, tabW, 6, .9), { lift: .3 });
  text(x, t.server, tx + tabW / 2, b - 1.55 * size / 1.9, size * .86, { font: 'Jost', weight: 700, track: .14, color: '#f4eedd' });
  layer(x, c, rrect(a, b, w, h, 1.1), { lift: o.lift ?? .45 });
  // The printed head rule of an index card, and its faint lines.
  x.fillStyle = rgba(C.stamp, .5); x.fillRect(a + 1.4, b + size * 2.1, w - 2.8, .16);
  x.fillStyle = 'rgba(110,92,62,.17)'; for (let y = b + size * 4.55; y < b + h - 1.6; y += size * 1.5) x.fillRect(a + 1.4, y, w - 2.8, .11);
  // Handled card stock: the edges a shade darker where fingers and air have toned them, a soft thumb mark low right.
  inside(x, rrect(a, b, w, h, 1.1), () => {
    for (const [x0, y0, x1, y1] of [[a, 0, a + 3, 0], [a + w, 0, a + w - 3, 0], [0, b + h, 0, b + h - 3], [0, b, 0, b + 2.4]]) { const g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(120,88,40,.16)'); g.addColorStop(1, 'rgba(120,88,40,0)'); x.fillStyle = g; x.fillRect(a, b, w, h); }
    const tx2 = a + w * .82, ty2 = b + h * .88, g = x.createRadialGradient(tx2, ty2, 0, tx2, ty2, w * .14); g.addColorStop(0, 'rgba(100,78,46,.07)'); g.addColorStop(1, 'rgba(100,78,46,0)'); x.fillStyle = g; x.fillRect(a, b, w, h);
  });
  if (o.text === false) return;
  mono(x, o.ts ? toolTs(name) : toolJson(name), a + size * 1.05, b + size * 4.1, size, { font: o.ts ? 'JetBrains Mono' : 'Courier Prime', lead: 1.5, bold: o.ts ? /(Promise)/ : /("name"|"description"|"inputSchema")/ });
}
// The two tools Code Mode offers instead of all the others: small manila cards with just a name.
export function miniCard(x, a, b, w, h, name) {
  layer(x, C.manila, rrect(a, b, w, h, .8), { lift: .35 });
  x.fillStyle = rgba(C.stamp, .5); x.fillRect(a + 1, b + h * .3, w - 2, .14);
  text(x, name, a + w / 2, b + h * .64, Math.min(h * .26, (w - 3) / (name.length * .62)), { font: 'Courier Prime', weight: 700, color: C.ink });
}
// Only the edge and rider of a card, as seen in a stack. y: top edge. Each card differs a little.
export function cardEdge(x, a, y, w, th, i, o = {}) {
  const c = tone(o.c || C.manila, (rnd(31, i) - .5) * .1), dx = (rnd(33, i) - .5) * 1.2, SV = Object.values(SERVICE);
  layer(x, c, rect(a + dx, y, w, th), { lift: .16, sh: .3 });
  // The rider shows which service the card belongs to.
  if (o.rider !== false) { const rw = 5 + rnd(35, i) * 4, rx = a + dx + 1.5 + rnd(37, i) * (w - rw - 3); layer(x, o.riderC || SV[Math.floor(rnd(39, i) * SV.length)].c, rrect(rx, y - 1.1, rw, 1.6, .4), { lift: .12, sh: .25 }); }
}
// A tool call as the model writes it on the direct way: a small manila card with one line of JSON.
export const CALLS = {
  rechnungen_liste: ['{"name": "rechnungen_liste",', ' "arguments": {"jahr": 2026}}'],
  zeilen_anfuegen: ['{"name": "zeilen_anfuegen",', ' "arguments": {"zeilen": [...]}}'],
  zelle_schreiben: ['{"name": "zelle_schreiben",', ' "arguments": {"zelle": "D43",', '  "wert": 23874.6}}'],
  nachschlagen: ['{"name": "nachschlagen",', ' "arguments": {"suche":', '  "rechnungen tabelle"}}'],
};
export function callCard(x, a, b, w, h, lines, o = {}) {
  layer(x, C.manila, rrect(a, b, w, h, .9), { lift: o.lift ?? .4 });
  const s = o.size || 1.9;
  x.fillStyle = tone(C.manila, -.12); x.fillRect(a, b, w, s * 2.1);
  text(x, o.head || 'AUFRUF', a + s * 1.1, b + s * 1.1, s * .92, { font: 'Jost', weight: 700, track: .2, align: 'left', color: rgba(C.ink, .8) });
  mono(x, lines, a + s * 1.05, b + s * 4.1, s, { font: 'Courier Prime', lead: 1.45, bold: /("name"|"arguments")/ });
}
// The program the model writes in Code Mode: the one cobalt card of the book.
export const PROGRAM = ['async () => {', '  const alle = await codemode', '    .rechnungen_liste(', '      { jahr: 2026 });', '  const offen = alle.filter(', '    r => r.status === "offen");', '  await codemode', '    .zeilen_anfuegen(', '      { zeilen: offen });', '  const summe = offen.reduce(', '    (s, r) => s + r.betrag, 0);', '  await codemode', '    .zelle_schreiben(', '      { zelle: "D43",', '        wert: summe });', '  return {', '    anzahl: offen.length,', '    summe: summe.toFixed(2) };', '}'];
// Which line of the program does what (for the pointer and the light that runs over the names).
export const PROGRAM_LINE = { rechnungen_liste: 2, filter: 4, zeilen_anfuegen: 7, reduce: 9, zelle_schreiben: 12, ret: 15 };
const TOOL_IN_LINE = /\.(rechnungen_liste|zeilen_anfuegen|zelle_schreiben)\(/;
// Returns where its lines sit: { x0, y0 (baseline of line 0), lead, size } in the sheet's millimetres.
export function programCard(x, a, b, w, h, o = {}) {
  const size = o.size || w / 21.6, lead = size * (o.lead || 1.42), lines = o.lines || PROGRAM;
  layer(x, C.cobaltDark, rrect(a, b, w, h, 1.3), { lift: o.lift ?? .5 });
  layer(x, C.cobalt, rrect(a + .5, b + .5, w - 1, h - 1, 1), { lift: 0 });
  inside(x, rrect(a + .5, b + .5, w - 1, h - 1, 1), wash(a, b, a + w, b + h, 'rgba(255,255,255,.07)', 'rgba(10,20,70,.12)'));
  text(x, 'PROGRAMM', a + size * 1.9, b + size * 2, size * .9, { font: 'Jost', weight: 700, track: .3, align: 'left', color: rgba(C.cream, .78) });
  x.fillStyle = rgba(C.cream, .35); x.fillRect(a + size * 1.9, b + size * 3.1, w - size * 3.8, .14);
  const y0 = b + size * 5.4, x0 = a + size * 1.9, meas = s => { x.save(); x.font = `700 ${size}px "JetBrains Mono"`; const v = x.measureText(s).width; x.restore(); return v; };
  // The three tool names sit on manila, like the riders of the cards they come from.
  const names = []; lines.forEach((ln, i) => { const m = ln.match(TOOL_IN_LINE); if (m) names.push([m[1], x0 + meas(ln.slice(0, m.index + 1)), y0 + i * lead]); });
  for (const [n, px, py] of names) layer(x, C.manila, rrect(px - size * .25, py - size * .98, meas(n) + size * .5, size * 1.32, size * .22), { lift: .2, sh: .3 });
  mono(x, lines.map(ln => ln.replace(TOOL_IN_LINE, (m, n) => '.' + ' '.repeat(n.length) + '(')), x0, y0, size, { color: C.cream, lead: o.lead || 1.42, bold: /\b(async|const|await|return)\b/ });
  x.save(); x.font = `700 ${size}px "JetBrains Mono"`; x.textBaseline = 'alphabetic'; x.textAlign = 'left'; x.fillStyle = C.ink; for (const [n, px, py] of names) x.fillText(n, px, py); x.restore();
  return { x0, y0, lead, size };
}
// What a Code Mode program hands back: a slip with a cobalt edge.
export function resultSlip(x, a, b, w, h, o = {}) {
  layer(x, C.cream, rrect(a, b, w, h, .6), { lift: o.lift ?? .35 });
  x.fillStyle = C.cobalt; x.fillRect(a, b, 1.5, h);
  const s = o.size || h * .26;
  mono(x, o.lines || ['{ "anzahl": 41,', '  "summe": "23874.60" }'], a + 3, b + h * .42, s, { font: 'Courier Prime', lead: 1.5 });
}

// ---------------------------------------------------------------- listing paper
// One panel of fan-fold listing paper with sprocket holes and green bars, printed with invoices as JSON.
// first: number of the first invoice on the panel; per panel `rows` invoices (four lines each).
export function listing(x, a, b, w, h, first, o = {}) {
  const rows = o.rows || 2, size = o.size || h / (rows * 4 * 1.42 + 1.2), lead = size * 1.42, bar = lead * 4;
  layer(x, C.listing, rect(a, b, w, h), { lift: o.lift ?? .3, sh: .28 });
  inside(x, rect(a, b, w, h), () => {
    for (let r = 0; r * bar < h; r += 2) { x.fillStyle = C.stripe; x.fillRect(a, b + size * .6 + r * bar, w, bar); }
    // Sprocket holes down both edges, and the perforation that lets the margin tear off.
    for (const ex of [a + 1.5, a + w - 1.5]) { for (let y = b + 1.6; y < b + h; y += 3.1) { x.fillStyle = 'rgba(46,38,30,.62)'; x.beginPath(); x.arc(ex, y, .55, 0, TAU); x.fill(); } }
    x.strokeStyle = 'rgba(90,100,90,.35)'; x.lineWidth = .1; x.setLineDash([.4, .4]);
    for (const ex of [a + 3.1, a + w - 3.1]) { x.beginPath(); x.moveTo(ex, b); x.lineTo(ex, b + h); x.stroke(); } x.setLineDash([]);
    if (o.text === false) return;
    for (let r = 0; r < rows; r++) {
      const v = invoice(first + r), y = b + size * 1.75 + r * bar;
      mono(x, [`{ "nr": "${v.nr}",`, `  "kunde": "${v.kunde}",`, `  "status": "${v.offen ? 'offen' : 'bezahlt'}",`, `  "betrag": ${num(v.betrag)} },`], a + 4.2, y, size, { font: 'Courier Prime', lead: 1.42, color: rgba(C.ink, .88) });
      if (v.offen) stamp(x, a + w - 9.5, y + lead * 1.2, size * 1.35);
    }
  });
}
// The red stamp on an open invoice.
export function stamp(x, cx, cy, size, s = 'offen') {
  x.save(); x.translate(cx, cy); x.rotate(-.2);
  const w = textWidth(x, s, size, { font: 'Jost', weight: 700, track: .12 }) + size * .9;
  x.strokeStyle = rgba(C.stamp, .85); x.lineWidth = size * .13; x.beginPath(); rrect(-w / 2, -size * .78, w, size * 1.56, size * .22)(x); x.stroke();
  text(x, s, 0, size * .05, size, { font: 'Jost', weight: 700, track: .12, color: rgba(C.stamp, .9) });
  x.restore();
}
// A stack of fan-fold paper seen from the front: the folded edges of n panels, th millimetres each, a few stamps showing.
export function listingEdge(x, a, y, w, th, i) {
  layer(x, i % 2 ? C.listing : tone(C.stripe, .25), rect(a + (i % 2 ? .5 : 0), y, w - (i % 2 ? 1 : 0), th), { lift: .14, sh: .26 });
  for (const ex of [a + 1.6, a + w - 1.6]) { x.fillStyle = 'rgba(46,38,30,.4)'; x.fillRect(ex - .3, y + th * .25, .6, th * .5); }
  // About one fold in twelve carries the red mark of an open invoice (41 of 500).
  if (i % 12 === 5) { x.fillStyle = C.stamp; x.fillRect(a + w * (.3 + rnd(71, i) * .45), y + th * .12, 2.6, th * .76); }
}
// The rows the model copies out on the direct way: a cream strip with column lines, closely written, every row an open one.
export function rowStrip(x, a, b, w, h, o = {}) {
  layer(x, C.page, rrect(a, b, w, h, .5), { lift: o.lift ?? .35 });
  const s = h * .2; x.fillStyle = tone(C.page, -.1); x.fillRect(a, b, w, s * 1.7);
  text(x, 'zeilen_anfuegen', a + 1.4, b + s * .9, s, { font: 'Courier Prime', weight: 700, align: 'left', color: C.ink });
  for (let r = 0; r < 3; r++) for (let k = 0; k < 9; k++) { const px = a + 2 + k * (w - 3.4) / 9, py = b + s * 2.5 + r * s * 1.05; x.fillStyle = rgba(C.ink, .5); x.fillRect(px, py, (w - 3.4) / 9 * (.5 + rnd(81 + r, k) * .3), s * .32); x.fillStyle = C.stamp; x.fillRect(px - .8, py, .45, s * .32); }
}
