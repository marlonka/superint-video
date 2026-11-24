// The spreads of the book in order. Spread s lies open when s leaves are turned.
import { T } from '../texts.js';
import { LEAVES } from '../plan.js';
import { cover, title, back } from './s00_book.js';
import { frage } from './s02_frage.js';
import { werkzeuge } from './s03_werkzeuge.js';
import { direkt } from './s04_direkt.js';
import { codemode } from './s05_codemode.js';
import { lohnt } from './s06_lohnt.js';
import { kommt } from './s07_kommt.js';

export function makeSpreads() {
  const a = [cover(0, T), title(1, T), frage(2, T), werkzeuge(3, T), direkt(4, T), codemode(5, T), lohnt(6, T), kommt(7, T), back(8, T)];
  if (a.length !== LEAVES + 1) throw new Error('plan.js: LEAVES does not match the spreads');
  return a;
}
