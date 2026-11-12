// Das Haus. Ein Schnitt von vorn: Stockwerke, Raeume, dazwischen schwarze Mauern wie in einer Bauzeichnung.
import { Geo, MAT } from './geo.js';
import { lin } from './m.js';
import * as P from './props.js';

export const ROOM = { EXT: 1, SCHREIB: 2, ZEICHEN: 3, TON: 4, MUSIK: 5, SCHNITT: 6, BUEHNE: 7, FOYER: 8, KINO: 9, ARCHIV: 10 };
const Z0 = -3.6, Z1 = 0;
export const R = {
  FOYER: { x0: -8, x1: -3, y0: 0, y1: 3.2, z0: Z0, z1: Z1 },
  KINO: { x0: -2.6, x1: 8, y0: 0, y1: 3.2, z0: Z0, z1: Z1 },
  SCHNITT: { x0: -8, x1: 0, y0: 3.6, y1: 6.8, z0: Z0, z1: Z1 },
  BUEHNE: { x0: .4, x1: 8, y0: 3.6, y1: 10.4, z0: Z0, z1: Z1 },
  TON: { x0: -8, x1: -4.2, y0: 7.2, y1: 10.4, z0: Z0, z1: Z1 },
  MUSIK: { x0: -3.8, x1: 0, y0: 7.2, y1: 10.4, z0: Z0, z1: Z1 },
  SCHREIB: { x0: -8, x1: 0, y0: 10.8, y1: 14, z0: Z0, z1: Z1 },
  ZEICHEN: { x0: .4, x1: 8, y0: 10.8, y1: 14, z0: Z0, z1: Z1 },
  ARCHIV: { x0: -8, x1: 8, y0: 14.4, y1: 17.8, z0: Z0, z1: Z1 },
};

// Die schwarzen Mauern: alles, was zwischen den Raeumen stehen bleibt.
export function buildShell(E) {
  const g = new Geo();
  g.s({ room: ROOM.EXT, mat: MAT.poche, c: '#0c0c10', r: .9, flag: 32 });
  const B = (x0, x1, y0, y1, z0 = -4.1, z1 = 0) => g.at([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], () => g.box(x1 - x0, y1 - y0, z1 - z0));
  // Der Schnitt steht e hinter den Waenden der Raeume. Laegen sie in derselben Ebene, kaempften beide um dieselben Pixel:
  // Die Waende und Boeden flackern, sobald die Kamera faehrt. Decken und Zwischenwaende greifen dafuer in ihre Nachbarn.
  const e = .005, o = .1;
  // Aussenwaende
  B(-8.4, -8 - e, -.6, 14.4); B(8 + e, 8.4, -.6, 14.4);
  // Decken
  B(-8.4, 8.4, -.6, -e);
  B(-8 - o, 8 + o, 3.2 + e, 3.6 - e);
  B(-8 - o, .4 - e, 6.8 + e, 7.2 - e);
  B(-8 - o, 8 + o, 10.4 + e, 10.8 - e);
  B(-8 - o, 8 + o, 14 + e, 14.4 - e);
  // Zwischenwaende
  B(-3 + e, -2.6 - e, -o, 3.2 + o); B(e, .4 - e, 3.6 - o, 14 + o); B(-4.2 + e, -3.8 - e, 7.2 - o, 10.4 + o);
  // Dachstuhl: schraeg, davor die gleiche Schraffur.
  const parts = [
    [[-8.4, 14.4], [-8.4, 15.6], [-8 - e, 15.757], [-8 - e, 14.4]],
    [[-8, 15.32 + e], [-8, 15.757], [0, 18.9], [0, 18.42 + e]],
    [[0, 18.42 + e], [0, 18.9], [8, 15.757], [8, 15.32 + e]],
    [[8 + e, 14.4], [8 + e, 15.757], [8.4, 15.6], [8.4, 14.4]],
  ];
  g.at([0, 0, -2.05], () => { for (const p of parts) g.prism(p, 4.1); });
  E.addStatic(g, ROOM.EXT);
}

// Noch leere Raeume: Waende, damit das Haus steht, bis sie eingerichtet sind.
export function placeholder(ctx, id, r, wall, floor, up, dn, lc) {
  const { E, rooms, light } = ctx;
  const g = new Geo(); g.s({ room: id });
  P.roomShell(g, r, { wallC: wall, floorC: floor, ceilC: '#b7ad98' });
  E.addStatic(g, id);
  rooms[id] = { up: lin(up).map(v => v * .5), dn: lin(dn).map(v => v * .4), fill: [.04, .04, .04], power: 1, gloss: .8, min: [r.x0, r.y0, r.z0], max: [r.x1, r.y1, r.z1] };
  light(id, r, { pos: [(r.x0 + r.x1) / 2, r.y1 - .2, -1.8], dir: [0, -1, 0], angle: 1.45, inner: 1.1, color: lc, range: 11, size: 1.2, haze: .002 });
}
