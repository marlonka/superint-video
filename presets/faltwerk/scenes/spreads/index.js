// The spreads of the book in order. Spread s lies open when s leaves are turned.
// One spread per chapter of the script; LEAVES in plan.js is the number of spreads minus one.
import { T } from '../texts.js';
import { LEAVES } from '../plan.js';
import { cover, title, back } from './s00_book.js';
import { stadt } from './s02_stadt.js';
import { fluss } from './s03_fluss.js';

export function makeSpreads() {
  const a = [cover(0, T), title(1, T), stadt(2, T), fluss(3, T), back(4, T)];
  if (a.length !== LEAVES + 1) throw new Error('plan.js: LEAVES does not match the spreads');
  return a;
}
