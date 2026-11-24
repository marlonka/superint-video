// Was man nur sieht, wenn man nah herangeht: Buchruecken, die Oberflaeche des Kaffees, ein Rohrgeflecht.
import { canvas } from './kit.js';
import { hash, mix } from './m.js';

const TAU = Math.PI * 2;
// Worum es in dieser Bibliothek geht: das Handwerk dieses Hauses.
const TITLES = ['Licht', 'Schatten', 'Perspektive', 'Typografie', 'Rhythmus', 'Farbe', 'Montage', 'Akustik', 'Stimme', 'Kamera', 'Dramaturgie', 'Regeln', 'Holz', 'Papier', 'Musik', 'Optik', 'Geometrie', 'Kurven', 'Pausen', 'Fehler', 'Korrekturen', 'Schrift', 'Stille', 'Zeit', 'Wiederholung', 'Maß', 'Tinte', 'Bewegung', 'Klang', 'Raum', 'Proportion', 'Geduld'];
const BANDS = [.13, .29, .45, .61, .77, .9];
const GOLD = '#d3ad5c', GOLD2 = '#a88439';

export function paintSpines(cols, rows) {
  return canvas(2048, 2048, (x, W, H) => {
    x.clearRect(0, 0, W, H);
    const cw = W / cols, ch = H / rows;
    for (let i = 0; i < cols * rows; i++) {
      const ox = (i % cols) * cw, oy = Math.floor(i / cols) * ch, kind = i % 3, title = TITLES[i % TITLES.length];
      x.save(); x.beginPath(); x.rect(ox, oy, cw, ch); x.clip(); x.translate(ox, oy);
      // Abgegriffen: an den Kanten und oben und unten etwas heller, in der Mitte tiefer.
      const edge = x.createLinearGradient(0, 0, cw, 0);
      edge.addColorStop(0, 'rgba(0,0,0,.34)'); edge.addColorStop(.18, 'rgba(0,0,0,0)'); edge.addColorStop(.82, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,.34)');
      x.fillStyle = edge; x.fillRect(0, 0, cw, ch);
      for (let k = 0; k < 90; k++) { const a = hash(i + k * 1.3), b = hash(i + k * 2.7); x.fillStyle = `rgba(${b < .5 ? '225,205,170' : '0,0,0'},${.012 + .03 * hash(i + k * 5.1)})`; x.beginPath(); x.ellipse(a * cw, hash(i + k * 3.3) * ch, 2 + a * 9, 4 + b * 34, 0, 0, TAU); x.fill(); }
      if (kind !== 2) {
        // Leder mit Bundstegen: Zwischen den Stegen liegen Felder, in einem davon der Titel.
        x.textAlign = 'center'; x.textBaseline = 'middle';
        for (const b of BANDS) {
          const y = (1 - b) * ch;
          const g = x.createLinearGradient(0, y - 16, 0, y + 16);
          g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.3, 'rgba(0,0,0,.42)'); g.addColorStop(.46, 'rgba(255,235,200,.16)'); g.addColorStop(.62, 'rgba(0,0,0,.42)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          x.fillStyle = g; x.fillRect(0, y - 16, cw, 32);
          x.fillStyle = GOLD; x.fillRect(7, y - 13, cw - 14, 2.2); x.fillRect(7, y + 11, cw - 14, 2.2);
        }
        // Titelfeld
        const y0 = (1 - BANDS[4]) * ch + 16, y1 = (1 - BANDS[3]) * ch - 16;
        x.fillStyle = hash(i * 7.7) < .5 ? 'rgba(92,20,16,.92)' : 'rgba(14,30,24,.92)'; x.fillRect(5, y0, cw - 10, y1 - y0);
        x.strokeStyle = GOLD; x.lineWidth = 2; x.strokeRect(10, y0 + 6, cw - 20, y1 - y0 - 12);
        x.fillStyle = GOLD; x.font = '600 25px "Fraunces"';
        let sz = 25; while (x.measureText(title).width > cw - 26 && sz > 10) { sz -= 1; x.font = `600 ${sz}px "Fraunces"`; }
        x.fillText(title, cw / 2, (y0 + y1) / 2 + 1);
        // Ornamente in den anderen Feldern: eine kleine Raute mit Punkten.
        for (let b = 0; b < BANDS.length - 1; b++) {
          if (b === 3) continue;
          const yy = (1 - (BANDS[b] + BANDS[b + 1]) / 2) * ch;
          x.save(); x.translate(cw / 2, yy); x.rotate(Math.PI / 4); x.strokeStyle = GOLD2; x.lineWidth = 1.8; x.strokeRect(-9, -9, 18, 18); x.fillStyle = GOLD2; x.fillRect(-3, -3, 6, 6); x.restore();
          for (const q of [-1, 1]) { x.fillStyle = GOLD2; x.beginPath(); x.arc(cw / 2 + q * 24, yy, 2.1, 0, TAU); x.fill(); }
        }
      } else {
        // Leinen: oben und unten Doppellinien, der Titel laeuft aufrecht.
        x.fillStyle = GOLD;
        for (const y of [ch * .06, ch * .075, ch * .925, ch * .94]) x.fillRect(4, y, cw - 8, 2.4);
        x.translate(cw / 2, ch * .42); x.rotate(Math.PI / 2);
        x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '500 42px "Fraunces"';
        x.fillText(title, 0, 1);
      }
      x.restore();
    }
  });
}

// Kaffee, der schon einen Moment steht: In der Mitte fast schwarz, am Rand ein Ring aus heller Crema.
export function paintCrema() {
  return canvas(1024, 1024, (x, W) => {
    const c = W / 2;
    x.fillStyle = '#7b4a20'; x.fillRect(0, 0, W, W);
    const g = x.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, '#a87441'); g.addColorStop(.6, '#9d6a38'); g.addColorStop(.86, '#8a5a2c'); g.addColorStop(.96, '#6a4220'); g.addColorStop(.988, '#b98a52'); g.addColorStop(1, '#85592e');
    x.fillStyle = g; x.beginPath(); x.arc(c, c, c, 0, TAU); x.fill();
    // Marmorierung der Crema
    for (let i = 0; i < 5200; i++) {
      const a = hash(i * 1.37) * TAU, u = Math.pow(hash(i * 2.11), .55), r = u * c, s = 1 + hash(i * 3.3) * 4.5;
      x.fillStyle = hash(i * 4.7) < .5 ? `rgba(214,160,96,${.03 + .07 * hash(i * 5.1)})` : `rgba(74,38,12,${.03 + .07 * hash(i * 6.3)})`;
      x.beginPath(); x.ellipse(c + Math.cos(a) * r, c + Math.sin(a) * r, s * 3, s, a + Math.PI / 2 + (hash(i * 7.7) - .5), 0, TAU); x.fill();
    }
    // Die Rosetta: Blattpaare von unten nach oben, immer kleiner. Der Milchschaum ist weich an den Kanten.
    const FOAM = '#efe1c8';
    x.save(); x.translate(c, c * .84); x.scale(1.12, .92); x.lineCap = 'round';
    x.shadowColor = 'rgba(239,225,200,.8)'; x.shadowBlur = 16;
    const N = 7;
    for (let k = 0; k < N; k++) {
      const u = k / (N - 1), yy = mix(250, -300, u), w = mix(330, 70, Math.pow(u, 1.15)), lift = mix(92, 40, u), lw = mix(36, 18, u);
      for (const sd of [-1, 1]) {
        x.strokeStyle = FOAM; x.lineWidth = lw;
        x.beginPath(); x.moveTo(sd * 4, yy + 18); x.bezierCurveTo(sd * w * .34, yy + 18, sd * w * .74, yy - lift * .28, sd * w, yy - lift); x.stroke();
        x.lineWidth = lw * .34; x.globalAlpha = .55;
        x.beginPath(); x.moveTo(sd * 8, yy + 44); x.bezierCurveTo(sd * w * .3, yy + 44, sd * w * .62, yy + 8, sd * w * .86, yy - lift * .42); x.stroke();
        x.globalAlpha = 1;
      }
    }
    // Das Herz oben und der Strich, der alles zusammenzieht.
    x.fillStyle = FOAM; x.beginPath(); x.moveTo(0, -402); x.bezierCurveTo(44, -372, 54, -322, 0, -292); x.bezierCurveTo(-54, -322, -44, -372, 0, -402); x.fill();
    x.shadowBlur = 5; x.shadowColor = 'rgba(120,70,28,.6)'; x.strokeStyle = '#a06c38'; x.lineWidth = 6;
    x.beginPath(); x.moveTo(0, -400); x.lineTo(0, 300); x.stroke();
    x.restore();
    // Bluten: ganz feine Blaeschen im Schaum und am Rand
    for (let i = 0; i < 260; i++) {
      const a = hash(i * 8.1) * TAU, u = .92 + .07 * hash(i * 9.3), s = .8 + 2.4 * hash(i * 10.7);
      x.fillStyle = `rgba(226,180,122,${.18 + .3 * hash(i * 11.9)})`;
      x.beginPath(); x.arc(c + Math.cos(a) * u * c, c + Math.sin(a) * u * c, s, 0, TAU); x.fill();
    }
  });
}
export function paintCane() {
  return canvas(1024, 1024, (x, W) => {
    x.fillStyle = '#16100a'; x.fillRect(0, 0, W, W);
    const step = 15, strand = (x0, y0, x1, y1, w, c) => { x.strokeStyle = c; x.lineWidth = w; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); };
    const L = '#b8945a', D = '#94743f';
    for (let i = -W; i < W * 2; i += step) {
      for (const o of [0, 5]) { strand(i + o, 0, i + o, W, 3.2, L); strand(0, i + o, W, i + o, 3.2, D); }
      strand(i, 0, i + W, W, 2.4, '#a5834c'); strand(i, 0, i - W, W, 2.4, '#8a6c3c');
    }
    // Rand, an dem das Geflecht gehalten wird.
    x.strokeStyle = '#2a1a0e'; x.lineWidth = 44; x.beginPath(); x.arc(W / 2, W / 2, W / 2 - 18, 0, TAU); x.stroke();
  });
}
