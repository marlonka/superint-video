// Die Kamerafahrt des ganzen Films. Alle Zeiten kommen aus den Wortzeiten der Stimme.
import { sampleKeys, v3, M, mix } from './m.js';
import { cue, cueE } from './kit.js';
import { DESK, TYPER, CUP } from './schreib.js';
import { LECTERN, STATION, MICF, onSheet, letterV, codeV } from './foyer.js';
import { MON, VID, BOOK, RIG, TOWER, PROJ } from './buehne.js';
import { BOARD, POSTER, STACKS, TRAY, tabX, SCRIPT_TAB } from './zeichen.js';
import { MIC, READER, CHART, METER, PHONES, GONG, PIANO } from './ton.js';
import { TABLE, PRINT, SHEETS, WIN } from './schnitt.js';
import { TUBE2 } from './schnitt.js';
import { CAB, PLATE, TYPER as CARDTYPER, BOARD as CHALK } from './archiv.js';
import { SCREEN, WIDE, DIO, tCut } from './kino.js';
import { DURATION } from './cues.js';

let keys = [], endKeys = [], T_CUT = 1e9, T_HIT = 0;
// Zeit, Auge, Ziel, Oeffnungswinkel, Blende, Fokus-Versatz
function K(t, eye, at, fov, ap, df = 0) {
  if (keys.length && t <= keys[keys.length - 1].t) throw new Error(`Kamera: Zeit laeuft rueckwaerts bei ${t} (vorher ${keys[keys.length - 1].t})`);
  keys.push({ t, v: [eye[0], eye[1], eye[2], at[0], at[1], at[2], fov, ap, df] });
}

// Baut die Fahrt, sobald alle Raeume stehen. W: was die Raeume nach aussen geben.
export function buildCamera(W) {
  keys = []; T_HIT = cue(14, 'DIESEM');
  const dx = DESK.x, dz = DESK.z, top = DESK.top, tx = TYPER.x, tz = TYPER.z;
  // ---------------------------------------------------------------- Anfang: vom Holz zum ganzen Haus
  K(0, [CUP.x + .285, top + .176, CUP.z + .72], [CUP.x + .018, top + .05, CUP.z], .205, .0028);
  K(cue(1, 'Diesen') + .1, [CUP.x + .25, top + .168, CUP.z + .66], [CUP.x + .016, top + .05, CUP.z], .205, .0028);
  K(cueE(1, 'nicht', 0) + .2, [dx + .78, top + .5, dz + 1.26], [dx + .12, top + .12, dz - .02], .56, .003);
  K(cueE(1, 'nicht', 1) + .05, [dx + .1, 12.46, 3.5], [dx, 12.2, -1.8], .68, .005);
  K(cueE(1, 'nicht', 2) + .75, [-.6, 3.1, 50.5], [.1, 9.2, 0], .5, .008);
  K(cue(2, 'gefilmt') + .1, [-11.5, 6.5, 15], [-1.5, 8, 0], .6, .006);
  K(cue(2, 'gezeichnet') + .1, [-6.8, 8.4, 11], [-.6, 8.6, 0], .64, .006);
  K(cue(2, 'Und') + .2, [3.5, .8, 15], [12, 5.5, -20], .6, .006);
  K(cue(2, 'Videogenerator') + .6, [10, .7, 17], [25, 7, -46], .46, .005);
  K(cue(3, 'Das') + .6, [1.0, 2.9, 47.5], [.5, 9.2, 0], .5, .008);
  K(cueE(3, 'Code') + 1.05, [1.3, 2.85, 46.6], [.55, 9.2, 0], .5, .008);
  // Zurueck zur Schreibmaschine
  K(cue(4, 'Claude') - .3, [dx + .72, 12.28, 2.7], [dx + .05, 11.85, -1.75], .6, .005);
  K(cue(4, 'Ich', 1) - .1, [tx + .5, top + .5, tz + .72], [tx + .01, top + .12, tz + .01], .5, .0016);
  K(cue(4, 'Ich', 2), [tx + .3, top + .42, tz + .46], [tx + .0, top + .17, tz - .03], .46, .0013);
  K(cue(4, 'Trotzdem'), [tx + .03, top + .325, tz + .17], [tx - .012, top + .222, tz - .09], .44, .0004);
  K(cue(4, 'Ich', 3), [tx - .035, top + .318, tz + .15], [tx - .022, top + .226, tz - .09], .44, .0004);
  K(cue(4, 'Und', 1) + .05, [dx - .32, 12.3, 2.4], [dx - .2, 11.9, -1.7], .62, .005);
  K(cueE(4, 'machst') + .12, [dx - .3, 12.28, 2.2], [dx - .2, 11.9, -1.7], .62, .005);

  // ---------------------------------------------------------------- Foyer: am Haus hinab, das Mikrofon, der Auftrag
  const L = LECTERN, T5 = cue(5, 'Alles');
  K(T5 - .3, [-5.5, 1.66, 5.2], [-5.5, 1.3, -3], .6, .004);
  K(cue(5, 'Auftrag') + .25, [-5.46, 1.52, 3.3], [-5.5, 1.16, -2.6], .6, .004);
  K(cue(5, 'Getippt') + .1, [-5.4, 1.5, 1.2], [-5.54, 1.16, -1.9], .58, .003);
  K(cue(5, 'Mikrofon'), [MICF.x + .12, MICF.y + .02, MICF.z + .78], [MICF.x, MICF.y - .02, MICF.z], .5, .0016);
  K(cue(5, 'gesprochen') + .35, [MICF.x + .05, MICF.y + .0, MICF.z + .66], [MICF.x, MICF.y - .02, MICF.z], .5, .0012);
  // Die Seite fuellt das Bild. Die Kamera liest mit: leichtes Gleiten, kaum Schraege.
  const read = (p, d = .36, ox = 0) => [L.x + ox, p[1] + .7 * d, p[2] + .71 * d];
  const look = (p, ox = 0) => [L.x + ox * .7, p[1], p[2]];
  const ln = (i, u = .46) => onSheet(u, letterV(i));
  K(cue(5, 'Die') - .1, read(ln(-.1), .4, -.02), look(ln(-.1), -.02), .46, .0007);
  K(cue(5, 'Zeig'), read(ln(2.1), .38, -.01), look(ln(2.1), -.01), .46, .0007);
  K(cue(5, 'Und'), read(ln(4.9), .37, 0), look(ln(4.9)), .46, .0007);
  K(cue(5, 'unglaublich'), read(ln(7), .33, -.012), look(ln(7), -.012), .46, .0006);
  K(cue(5, 'Du', 1), read(ln(8.6), .35, -.01), look(ln(8.6), -.01), .46, .0006);
  K(cue(5, 'Keine') - .05, read(ln(8), .5, .03), look(ln(7), .03), .5, .0009);
  K(cue(5, 'Nur', 1) - .1, [-5.12, 1.46, -.62], [-5.12, 1.08, -1.7], .56, .002);
  K(cueE(5, 'Ziel'), [-5.14, 1.44, -.78], [-5.0, 1.12, -1.7], .56, .002);
  // Durch die Glastuer nach draussen
  K(cue(6, 'in') - .25, [-5.875, 1.72, -2.35], [-5.95, 2.2, -6], .62, .0016);
  K(cue(6, 'Traumfabrik') + .3, [-5.875, 1.9, -6.7], [-6.2, 5.9, -30], .72, .004);
  K(cue(6, 'Pixel', 0), [-5.9, 2.1, -9.2], [-6.1, 9.4, -30], .68, .004);
  K(cue(6, 'Das'), [-6.0, 2.2, -10.1], [-5.6, 9.8, -30], .64, .004);
  // Die Schrift
  K(cue(6, 'Aber') + .1, [-6.15, 2.7, -12.4], [-6.2, 12.3, -30], .54, .004);
  K(cue(6, 'kaputt') + .25, [-6.2, 3.0, -14], [-6.2, 13.5, -30], .46, .004);
  K(cue(6, 'besser'), [-6.2, 3.0, -14.4], [-6.2, 13.5, -30], .45, .004);
  // Alles neu
  K(cue(6, 'alles'), [-6.1, 2.3, -9.8], [-6.2, 9.4, -30], .72, .004);
  K(cue(6, 'anderer') + .35, [-6.0, 2.05, -8.4], [-6.1, 8.8, -30], .74, .004);
  // Rueckwaerts zurueck ins Haus: Hier traeumt niemand.
  K(cue(6, 'Hier', 0) + .35, [-5.875, 1.8, -2.1], [-5.9, 2.3, -10], .64, .002);
  // Hier wird Code geschrieben: ueber das Pult zur Wand, beides im Bild.
  const cl = onSheet(.42, codeV(3.1));
  K(cue(6, 'Hier', 1) + .25, read(cl, .66, -.02), look(cl, -.02), .46, .0005);
  K(cue(6, 'Zeile') + .12, read(cl, .58, .0), look(cl, 0), .46, .0004);
  K(cue(6, 'ändert') - .08, [-5.47, 1.56, -.68], [-5.5, 1.16, -2.3], .56, .0006);
  K(cue(6, 'Sache'), [-5.46, 1.62, -.26], [-5.5, 1.34, -2.6], .6, .0012);
  const cf = W.capsuleFirst;
  K(cf.tFire - .05, [-5.26, 1.32, .05], [STATION.x, 1.25, STATION.z], .54, .002);
  // Der Kapsel nach: durch die Decke, durch den Schneideraum, durch die Wand.
  K(cf.tFire + .42, [-4.95, 3.0, 2.2], [STATION.x, 3.1, STATION.z], .6, .002);
  K(cf.tFire + .9, [-3.0, 5.72, 3.3], [-2.7, 6.1, STATION.z], .6, .002);
  K(cf.tFire + 1.35, [.5, 6.3, 4.4], [1.0, 6.2, STATION.z], .62, .002);

  // ---------------------------------------------------------------- Buehne: Daumenkino
  K(cue(7, 'ein', 1) + .1, [2.3, 5.55, 1.9], [2.72, 4.72, -.9], .62, .003);
  K(cue(7, 'Daumenkino') + .3, [2.5, 5.12, .35], [BOOK.x + .14, BOOK.y + .02, BOOK.z - .02], .56, .0016);
  K(cue(7, 'Sekunde') + .1, [2.86, 5.08, .22], [BOOK.x + .22, BOOK.y + .02, BOOK.z - .03], .52, .0012);
  K(cue(7, 'Dieser') + .35, [3.15, 5.7, 1.5], [4.0, 8.2, -3.3], .56, .004);
  K(cue(7, 'elftausend') + .3, [3.5, 6.9, 2.8], [4.2, 9.26, -3.4], .46, .004);
  K(cue(7, 'So'), [3.66, 6.94, 3.2], [4.2, 9.2, -3.4], .46, .004);
  K(cue(7, 'Programm') + .15, [4.0, 6.7, 4.7], [4.2, 7.3, -3.4], .62, .004);
  K(cue(7, 'Browser') + .2, [4.2, 6.9, 2.6], [4.2, 7.1, -3.4], .62, .003);
  // Website
  K(cue(8, 'Website', 0) + .3, [3.25, 7.12, 1.0], [3.4, 7.1, -3.4], .56, .002);
  K(cue(8, 'schreibe') + .2, [3.0, 7.05, .5], [3.3, 6.95, -3.4], .56, .002);
  K(cue(8, 'Zeit') + .2, [3.25, 6.86, .15], [3.4, 6.45, -3.4], .56, .002);
  K(cue(9, 'zwölf', 0) - .1, [4.55, 7.04, .7], [VID.x - .1, VID.y - .1, -3.4], .56, .002);
  K(cue(9, 'drei', 1) + .1, [4.62, 7.0, .26], [VID.x, VID.y - .08, -3.4], .56, .002);
  // Genau diese Sekunde: Die Kamera schaut gerade auf das Bild, damit es endlos ineinander passt.
  K(cue(10, 'Und'), [VID.x, VID.y, .6], [VID.x, VID.y, -3.4], .56, .002);
  K(cue(10, 'Sekunde') + .3, [VID.x, VID.y, -.3], [VID.x, VID.y, -3.4], .56, .002);
  K(cue(11, 'Jetzt') - .05, [VID.x, VID.y, -.55], [VID.x, VID.y, -3.4], .56, .002);
  // Rueckzug, die Kamera auf Schienen rollt herein.
  K(cue(11, 'abdrückt'), [5.6, 6.5, 2.8], [4.6, 6.1, -2], .62, .003);
  K(cue(11, 'Ein') + .1, [6.6, 5.1, .55], [4.6, 5.72, -1.7], .6, .003);
  K(cue(11, 'eins'), [6.3, 5.08, .2], [4.55, 5.74, -1.75], .6, .0026);
  K(cue(11, 'Foto', 0) + .1, [2.7, 6.3, .35], [4.22, 6.55, -2.4], .68, .0026);
  K(cue(11, 'Foto', 1), [2.95, 7.0, 1.0], [4.2, 8.0, -3.4], .62, .003);
  K(cue(11, 'Mal') + .1, [5.3, 5.3, 6.7], [5.3, 7.0, -1.2], .66, .004);
  K(cue(11, 'Dann'), [5.5, 5.6, 5.9], [5.5, 7.25, -1.2], .66, .004);
  K(cue(11, 'klebt') + .25, [6.0, 7.7, 2.9], [7.0, 9.7, -.6], .72, .003);
  K(cue(11, 'Fotos') + .1, [3.6, 8.9, 2.4], [3.8, 9.9, -.72], .66, .0026);
  K(cueE(11, 'aneinander') + .1, [1.8, 8.6, 1.6], [1.1, 9.4, -.72], .62, .0026);
  K(cue(11, 'Ergebnis'), [1.45, 6.7, 1.0], [1.05, 6.5, -.72], .62, .0024);
  K(cue(11, 'gerade'), [PROJ.x + .02, PROJ.y + .02, PROJ.z + 1.5], [PROJ.x, PROJ.y, PROJ.z + .25], .56, .002);
  K(cue(12, 'Damit') - .25, [PROJ.x + .005, PROJ.y + .005, PROJ.z + .5], [PROJ.x, PROJ.y, PROJ.z + .25], .56, .0016);
  // Aha: Das Weiss gibt die ganze Buehne frei, eine Lampe pro Wort.
  K(cue(12, 'Damit') + .02, [4.3, 6.75, 8.7], [4.25, 7.0, -2], .66, .004);
  K(cue(12, 'Schreibaufgabe') + .2, [4.25, 6.8, 7.3], [4.25, 7.0, -2], .66, .004);
  K(cue(13, 'Aber') - .25, [4.2, 6.85, 6.6], [4.2, 7.0, -2], .66, .004);

  // ---------------------------------------------------------------- Zeichensaal: Register, Plakate, Fassungen, Mappe
  K(cue(13, 'Aber') + .3, [4.2, 10.0, 7.6], [4.2, 10.4, -2], .66, .004);
  K(cue(13, 'einfach') + .1, [4.2, 12.3, 6.8], [4.2, 12.4, -2], .66, .004);
  K(cue(13, 'drauflos') + .45, [3.9, 12.4, 5.5], [4.2, 12.4, -2], .66, .004);
  const bx = BOARD.x;
  K(cue(13, 'Erst') + .1, [2.3, 12.35, 1.4], [bx, 11.9, -2], .6, .003);
  K(cue(13, 'Behauptung'), [1.72, 12.42, -.18], [1.78, 11.86, -2.12], .56, .0018);
  K(cue(13, 'Beleg') + .25, [2.0, 12.3, -.34], [2.05, 11.72, -2.12], .56, .0018);
  K(cue(13, 'Drei', 0) + .05, [4.6, 12.42, 1.7], [4.66, 12.3, -3.5], .62, .003);
  K(cue(13, 'zwei') + .05, [4.66, 12.36, 1.35], [4.66, 12.28, -3.5], .62, .003);
  K(cue(13, 'raus') + .45, [4.5, 12.05, 1.7], [4.55, 11.9, -3.2], .62, .003);
  K(cue(13, 'Drehbücher') + .2, [6.95, 12.5, .3], [6.95, 11.72, -2.4], .6, .002);
  K(cue(13, 'nur') + .05, [6.95, 12.32, -.2], [6.95, 11.55, -2.4], .6, .002);
  K(cue(13, 'bleibt') + .4, [6.95, 12.14, -.72], [6.95, 11.68, -2.4], .56, .002);
  const tabY = TRAY.y + .36 + .055;
  const midT = (TRAY.x0 + TRAY.x1) / 2;
  K(cue(13, 'Und') + .1, [tabX(0) + .22, tabY + .2, -2.55], [tabX(0) + .22, tabY + .045, -3.2], .5, .0009);
  K(cue(13, 'Ordner') + .2, [tabX(3) + .2, tabY + .2, -2.55], [tabX(3) + .2, tabY + .045, -3.2], .5, .0009);
  K(cue(13, 'du') + .05, [midT - .6, tabY + .2, -1.95], [midT - .6, tabY + .1, -3.2], .5, .0011);
  K(cue(13, 'mitlesen') + .55, [midT - .42, tabY + .22, -1.85], [midT - .42, tabY + .13, -3.2], .5, .0011);

  // ---------------------------------------------------------------- Tonstudio und Musikzimmer
  K(cue(14, 'Diese') + .2, [-1.8, 10.0, 8.2], [-4.6, 9.0, -2], .62, .004);
  K(cue(14, 'mir'), [-5.9, 8.92, 2.6], [-6.1, 8.75, -2], .6, .003);
  K(cue(14, 'Ein') + .1, [-6.15, 8.88, 1.0], [-6.1, 8.76, -1.8], .56, .002);
  K(cue(14, 'Google'), [-5.95, 8.75, .25], [-5.72, 8.6, -1.9], .54, .0018);
  K(cue(14, 'schreibe'), [-5.62, 8.62, -.42], [-5.62, 8.5, -1.9], .5, .0012);
  K(cue(14, 'Musik') + .25, [-1.9, 8.6, 3.4], [-1.9, 8.5, -3], .6, .003);
  K(cue(14, 'anderes') + .45, [-1.9, 8.4, .85], [-1.9, 8.25, -2.9], .58, .002);
  K(cue(14, 'beide'), [-1.78, 8.32, -.42], [-1.9, 8.08, -2.9], .54, .0016);
  K(cue(14, 'drücken') + .25, [-1.62, 8.26, -1.02], [-1.84, 8.02, -2.9], .5, .0013);
  K(cue(14, 'höre') - .26, [-4.6, 8.6, .75], [-5.6, 8.3, -1.7], .58, .002);
  K(cue(14, 'höre') + .05, [-5.78, 8.7, -.9], [-6.38, 8.5, -1.64], .54, .0012);
  K(cue(14, 'nichts') + .6, [-5.86, 8.68, -1.0], [-6.38, 8.5, -1.64], .54, .0012);
  K(cue(14, 'Aber') + .25, [-7.1, 9.0, .1], [-7.15, 8.1, -1.5], .56, .002);
  K(cue(14, 'jedes'), [-7.3, 8.92, -.82], [-7.3, 8.12, -1.5], .54, .0012);
  K(cue(14, 'Zeit'), [-7.2, 8.9, -.84], [-7.2, 8.12, -1.5], .54, .0012);
  K(cue(14, 'auf', 1) + .25, [-7.12, 8.9, -.84], [-7.12, 8.12, -1.5], .54, .0012);
  K(cue(14, 'Darum') + .1, [-6.05, 8.85, 3.85], [-6.1, 8.82, -3], .64, .003);
  K(cue(14, 'DIESEM'), [-5.75, 9.0, 2.6], [-5.75, 9.05, -3], .6, .003);
  K(cue(14, 'passieren') + .85, [-6.0, 8.8, 3.55], [-6.0, 8.8, -3], .64, .003);

  // ---------------------------------------------------------------- Schneideraum
  const ZC = (TABLE.z0 + TABLE.z1) / 2, tt = TABLE.top;
  K(cue(15, 'Sehen') + .35, [-5.9, 5.65, 4.0], [-5.6, 4.85, -2.5], .62, .003);
  K(cue(15, 'Art') + .1, [-6.86, 5.55, -1.05], [-6.86, tt, ZC - .02], .56, .0015);
  K(cue(15, 'Bild', 1), [-6.86, 5.42, -1.42], [-6.86, tt, ZC - .02], .54, .0012);
  K(cue(15, 'viel'), [-6.82, 5.42, -1.42], [-6.82, tt, ZC - .02], .54, .0012);
  K(cue(15, 'mir') + .3, [-6.84, 5.45, -1.38], [-6.84, tt, ZC - .02], .54, .0012);
  K(cue(16, 'nicht') + .25, [-6.7, 5.6, -1.1], [-6.7, tt, ZC], .56, .0015);
  K(cue(16, 'Erst') + .05, [PRINT.luft.x, 5.38, -1.5], [PRINT.luft.x, tt, ZC - .01], .54, .0012);
  K(cue(16, 'Luft') + .5, [PRINT.luft.x + .03, 5.34, -1.58], [PRINT.luft.x + .03, tt, ZC - .01], .54, .0012);
  K(cue(16, 'wie'), [PRINT.kinder.x, 5.38, -1.5], [PRINT.kinder.x, tt, ZC - .01], .54, .0012);
  K(cue(16, 'gezeichnet') + .55, [PRINT.kinder.x + .03, 5.34, -1.58], [PRINT.kinder.x + .03, tt, ZC - .01], .54, .0012);
  K(cue(16, 'viel'), [PRINT.laut.x, 5.32, -1.6], [PRINT.laut.x, tt, ZC], .54, .0012);
  K(cue(16, 'laut') + .4, [PRINT.laut.x + .03, 5.3, -1.64], [PRINT.laut.x + .03, tt, ZC], .54, .0012);
  K(cue(16, 'Menschen'), [PRINT.frau.x, 5.52, -1.32], [PRINT.frau.x, tt, ZC - .01], .56, .0015);
  K(cue(16, 'Frau') + .4, [PRINT.frau.x, 5.44, -1.48], [PRINT.frau.x, tt, ZC - .01], .54, .0012);
  K(cue(17, 'kein') - .1, [PRINT.frau.x + .1, 5.5, -1.36], [PRINT.frau.x + .1, tt, ZC], .56, .0015);
  K(cue(17, 'vor') + .25, [-1.0, 5.5, -1.1], [-.9, tt - .05, ZC], .58, .002);
  K(cue(17, 'Dafür') + .15, [-1.1, 5.1, -.7], [WIN.x, WIN.y + 1.05, -3.6], .5, .0018);
  K(cue(17, 'Traumfabrik') + .55, [-1.1, 5.05, -1.25], [WIN.x, WIN.y + 1.2, -3.6], .46, .0018);

  // ---------------------------------------------------------------- Archiv
  {
    const tc0 = cue(18, 'jeder') + .25, tc1 = cue(18, 'zu') + .1, yc = v => mix(3.6 + .94, 15, v * v * (3 - 2 * v) * .4 + v * .6);
    K(tc0 - .05, [-6.35, 5.0, 1.15], [-7.5, yc(0) + .25, TUBE2.z], .6, .002);
    K(mix(tc0, tc1, .4), [-6.95, yc(.4) + .1, .62], [-7.7, yc(.4) + .1, TUBE2.z], .6, .002);
    K(mix(tc0, tc1, .75), [-6.95, yc(.75) + .1, .62], [-7.7, yc(.75) + .1, TUBE2.z], .6, .002);
    K(tc1 + .05, [-6.55, 15.05, .7], [-7.2, 15.1, -1.0], .6, .002);
    K(cueE(18, 'Regel') - .1, [-6.72, 15.36, -.72], [-6.95, 15.28, -1.86], .56, .0012);
  }
  K(cue(18, 'Und') + .1, [-6.5, 15.34, -.1], [-6.7, 15.14, -1.9], .58, .0016);
  K(cue(18, 'Ordner', 0), [-3.0, 15.4, 2.6], [-2.2, 15.2, -2.6], .6, .002);
  K(cue(18, 'So') + .05, [-.8, 15.9, 8.6], [-.2, 16.0, -2.7], .62, .003);
  K(cue(18, 'nennt'), [-.2, 15.6, 3.9], [0, 15.5, -2.7], .58, .002);
  K(cue(18, 'Skill') + .2, [0, 15.46, 1.5], [0, PLATE.y + .02, CAB.z], .5, .0014);
  K(cue(18, 'Ich') + .15, [2.8, 15.7, 3.4], [4.6, 15.5, -1.8], .58, .002);
  K(cue(18, 'vergesse') + .15, [CHALK.x - .4, 15.52, .72], [CHALK.x, CHALK.y, CHALK.z], .56, .0015);
  K(cue(18, 'alles') + .25, [CHALK.x - .22, 15.5, .52], [CHALK.x, CHALK.y, CHALK.z], .56, .0015);
  K(cue(18, 'Der', 0) + .1, [2.2, 16.0, 11.2], [0, 16.2, -2.7], .64, .004);
  K(cue(18, 'nicht', 0) + .5, [1.2, 16.0, 10.2], [0, 16.2, -2.7], .64, .004);
  const FE = W.featured;
  K(FE[0].t - .1, [.5, 16.0, 8.6], [0, 16.2, -2.7], .64, .004);
  K(FE[1].t + .1, [0, FE[1].y - .1, CAB.z + 3.95], [0, FE[1].y - .02, CAB.z + .25], .56, .0012);
  K(cue(18, 'Das') + .05, [.1, FE[1].y - .12, CAB.z + 3.4], [.04, FE[1].y - .04, CAB.z + .25], .56, .0012);
  K(cue(18, 'Das') + .9, [0, 15.8, 4.8], [0, 15.6, -2.7], .58, .003);
  K(cue(18, 'Trick') + .3, [0, 15.65, 3.5], [0, 15.5, -2.7], .58, .002);
  K(cue(18, 'Der', 3), [0, 15.44, 1.75], [0, PLATE.y + .01, CAB.z], .5, .0014);
  K(cue(18, 'Ordner', 3) + .75, [0, 15.42, 1.3], [0, PLATE.y + .01, CAB.z], .46, .0012);

  // ---------------------------------------------------------------- Durch alle Stockwerke ins Kino
  const Sc = SCREEN, sat = [Sc.x, Sc.y, Sc.z];
  K(cue(19, 'Und'), [.7, 12.2, 8.4], [1.2, 8, -2], .68, .004);
  K(cue(19, 'Du', 1), [2.6, 5.0, 7.6], [3.2, 2.8, -2], .66, .004);
  K(cue(19, 'zwei'), [3.2, 2.2, 3.4], [5.2, 1.7, -1.8], .62, .003);
  K(cue(19, 'Dinge') + .35, [2.8, 1.72, .15], [7, 1.55, -1.7], .6, .003);
  K(cue(19, 'Claude') + .1, [3.6, 1.6, -1.72], sat, .54, .002);
  K(cue(19, 'Ordner'), [4.35, 1.54, -1.8], sat, .54, .002);
  K(cue(19, 'Euro') + .4, [4.6, 1.52, -1.8], sat, .54, .002);
  K(cue(20, 'Werkstatt'), [4.4, 1.52, -2.0], sat, .54, .002);
  K(cue(20, 'HyperFrames'), [4.6, 1.52, -1.82], sat, .54, .002);
  K(cue(20, 'Installieren'), [4.75, 1.5, -1.8], sat, .54, .002);
  K(cue(20, 'Marlon', 0) + .1, [3.6, 1.75, -2.6], sat, .56, .002);
  K(cue(20, 'welche', 0), [4.3, 1.6, -2.0], sat, .52, .002);
  K(cue(20, 'darf'), [4.55, 1.56, -1.8], sat, .52, .002);
  K(cue(20, 'Darum') + .05, [2.5, 2.0, -.9], sat, .58, .003);
  K(cue(20, 'Dieses'), [1.2, 2.25, -1.3], sat, .58, .003);
  K(cue(20, 'Haus') + .75, [.9, 2.3, -1.55], sat, .58, .003);
  K(cue(20, 'Superintelligenz'), [3.5, 1.7, -1.9], sat, .54, .002);
  K(cue(20, 'daran') + .4, [4.15, 1.6, -1.8], sat, .52, .002);
  K(cue(21, 'sagst') + .1, [4.28, 1.54, -1.8], sat, .5, .0015);
  K(cue(21, 'ungefähr') + .5, [4.56, 1.56, -1.8], sat, .5, .0015);
  K(cue(22, 'Arbeit') + .5, [4.72, 1.56, -1.8], sat, .5, .0015);
  K(cue(22, 'Du', 1), [4.5, 1.56, -1.8], sat, .5, .0015);
  K(cue(22, 'aber') + .3, [4.3, 1.56, -1.8], sat, .5, .0015);
  K(cue(23, 'Wichtigste'), [4.2, 1.54, -1.8], sat, .52, .0015);
  K(cue(23, 'gut') + .2, [4.5, 1.54, -1.8], sat, .5, .0015);
  K(cue(23, 'völlig'), [4.66, 1.56, -1.8], sat, .5, .0015);
  K(cue(23, 'Runden'), [4.45, 1.54, -1.8], sat, .5, .0015);
  K(cue(23, 'Code') + .1, [3.85, 1.56, -1.8], sat, .52, .002);
  K(cue(24, 'Wer') - .1, [3.3, 1.72, -1.2], [6.2, 1.6, -2.3], .56, .002);
  K(cue(24, 'kann', 0) + .1, [2.6, 3.4, 5.5], [2.2, 5, -2], .62, .003);
  K(cue(24, 'will') + .2, [2.1, 3.3, 10], [1.5, 5.2, -2], .56, .005);
  K(cue(24, 'passt'), [1.6, 3.2, 25], [.9, 7.6, 0], .5, .008);
  K(cue(24, 'machen'), [1.32, 2.92, 41.5], [.6, 9, 0], .5, .008);
  K(cue(24, 'Videos'), WIDE.eye, WIDE.at, WIDE.fov, WIDE.ap);
  T_CUT = tCut();
  K(T_CUT - .001, WIDE.eye, WIDE.at, WIDE.fov, WIDE.ap);
  // Das Bild steht im Guckkasten. Niemand merkt den Schnitt, bis die Kamera zurueckfaehrt.
  endKeys = [];
  const P0 = [DIO.x, DIO.y, DIO.z], d0c = DIO.h / (2 * Math.tan(.25));
  const EK = (t, eye, at, fov, ap) => endKeys.push({ t, v: [eye[0], eye[1], eye[2], at[0], at[1], at[2], fov, ap, 0] });
  EK(T_CUT, [P0[0], P0[1], P0[2] + d0c], P0, .5, .0005);
  EK(T_CUT + .7, [P0[0], P0[1], P0[2] + d0c], P0, .5, .0005);
  // Und den schreibe ich: Die Kamera faehrt zurueck, bis die Maschine im Bild steht.
  const D = cueE(24, 'ich') - T_CUT;
  EK(T_CUT + 2.1 + D * .5, [P0[0] + .12, P0[1] + .08, P0[2] + .82], [P0[0] + .06, P0[1] - .02, P0[2]], .52, .0014);
  EK(T_CUT + 3.4 + D, [dx - .15, top + .5, dz + 1.25], [dx - .12, top + .13, dz], .56, .002);
  EK(T_CUT + 4.7 + D, [dx - .1, top + .48, dz + 1.14], [dx - .1, top + .14, dz], .56, .002);
  // Mitte des fertigen Titelblatts, senkrecht aufs Papier (Neigung .33).
  const mx = tx - .0614, my = top + .2581, mz = tz - .0991, nY = .324, nZ = .946;
  EK(T_CUT + 6.0 + D, [mx + .018, my + nY * .47, mz + nZ * .47], [mx, my, mz], .4, .0004);
  EK(DURATION + 1, [mx, my + nY * .43, mz + nZ * .43], [mx, my, mz], .4, .0003);
}

export function camAt(ts) {
  const v = sampleKeys(ts >= T_CUT ? endKeys : keys, ts);
  const eye = [v[0], v[1], v[2]], at = [v[3], v[4], v[5]];
  if (T_HIT && ts > T_HIT && ts < T_HIT + 1) {
    const k = Math.exp(-(ts - T_HIT) * 7) * .022, q = ts * 60;
    eye[0] += Math.sin(q * 1.1) * k; eye[1] += Math.sin(q * 1.7 + 1) * k; at[0] += Math.sin(q * 1.3 + 2) * k * .6; at[1] += Math.sin(q * .9 + 3) * k * .6;
  }
  return { eye, at, fov: v[6], aperture: v[7], focus: Math.max(.05, v3.len(v3.sub(at, eye)) + v[8]) };
}
