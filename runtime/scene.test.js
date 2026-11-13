import test from 'node:test';
import assert from 'node:assert/strict';
import { interpolate, ease, spring, random, validateActors, textBoxes } from './scene.js';

test('motion evaluates identically after reverse and random frame requests', () => {
  const sample = frame => [spring(frame / 30), interpolate(frame, [0, 30, 60], [0, 100, 20], { ease: ease.outCubic }), random('scene', frame)];
  const forward = Array.from({ length: 91 }, (_, frame) => sample(frame));
  for (const frame of [90, 0, 45, 12, 89, 30, 1]) assert.deepEqual(sample(frame), forward[frame]);
  assert.equal(forward[0][0], 0);
  assert.equal(forward[30][1], 100);
  assert.equal(forward[60][1], 20);
});

test('interpolation clamps endpoints and preserves explicit extrapolation', () => {
  assert.equal(interpolate(-1, [0, 10], [5, 25]), 5);
  assert.equal(interpolate(20, [0, 10], [5, 25]), 25);
  assert.equal(interpolate(-1, [0, 10], [5, 25], { clamp: false }), 3);
  assert.throws(() => interpolate(0, [0, 0], [0, 1]), /strictly increasing/);
});

test('under, critical and overdamped springs converge to the same endpoint', () => {
  for (const damping of [10, 20, 32]) {
    assert.equal(spring(0, { stiffness: 100, damping }), 0);
    assert.ok(Math.abs(spring(10, { stiffness: 100, damping }) - 1) < 1e-8);
  }
  assert.throws(() => spring(1, { mass: 0 }), /Invalid/);
});

test('render may report actors as boxes with an id and an optional target', () => {
  assert.deepEqual(validateActors(undefined), []);
  assert.deepEqual(validateActors({}), []);
  assert.deepEqual(
    validateActors({ actors: [{ id: 'lens', x: 1, y: 2, w: 3, h: 4, target: 'label', note: 'dropped' }, { id: 'label', x: -5, y: 0, w: 0, h: 0 }] }),
    [{ id: 'lens', x: 1, y: 2, w: 3, h: 4, target: 'label' }, { id: 'label', x: -5, y: 0, w: 0, h: 0 }],
  );
  assert.throws(() => validateActors({ actors: {} }), /must be an array/);
  assert.throws(() => validateActors({ actors: [{ x: 0, y: 0, w: 1, h: 1 }] }), /Actor 0 requires an id/);
  assert.throws(() => validateActors({ actors: [{ id: 'a', x: 0, y: NaN, w: 1, h: 1 }] }), /finite/);
  assert.throws(() => validateActors({ actors: [{ id: 'a', x: 0, y: 0, w: -1, h: 1 }] }), /non-negative/);
  assert.throws(() => validateActors({ actors: [{ id: 'a', x: 0, y: 0, w: 1, h: 1, target: '' }] }), /target must be an actor id/);
});

test('seeded random provides stable indexed values within range', () => {
  assert.equal(random('a', 10), random('a', 10));
  assert.notEqual(random('a', 10), random('b', 10));
  assert.notEqual(random('a', 10), random('a', 11));
  for (let index = 0; index < 200; index++) assert.ok(random('a', index) >= 0 && random('a', index) < 1);
});

// A few elements are enough to stand for a scene: children, text, a box and a style.
function element({ text = '', box = [0, 0, 100, 20], style = {}, prop, children = [], localName = 'div' } = {}) {
  const node = {
    children, style, localName, parentElement: null,
    get textContent() { return children.length ? children.map(child => child.textContent).join('') : text; },
    getAttribute: name => (name === 'data-prop' ? prop ?? null : null),
    getBoundingClientRect: () => ({ left: box[0], top: box[1], width: box[2], height: box[3] }),
    contains(other) { return other === node || children.some(child => child.contains(other)); },
  };
  for (const child of children) child.parentElement = node;
  return node;
}
const styleOf = node => ({ display: 'block', visibility: 'visible', opacity: '1', ...node.style });

test('texts are found by their mark, else by their exact words, innermost first', () => {
  const title = element({ text: 'Probier’s selbst aus', box: [20, 380, 540, 100] });
  const marked = element({ text: 'ganz anders', prop: 'note', box: [80, 880, 900, 30] });
  const root = element({ children: [element({ children: [title] }), marked] });
  const definitions = { title: { type: 'text', default: '' }, note: { type: 'text', default: '' }, size: { type: 'number', default: 1 } };
  const boxes = textBoxes(root, definitions, { title: '  Probier’s   selbst aus ', note: 'Hinweis', size: 3 }, styleOf);
  assert.deepEqual(boxes, [
    { prop: 'title', x: 20, y: 380, w: 540, h: 100 },
    { prop: 'note', x: 80, y: 880, w: 900, h: 30 },
  ]);
});

test('hidden, transparent and missing texts give no box', () => {
  const faded = element({ text: 'Später', style: { opacity: '0' } });
  const root = element({ children: [element({ style: { visibility: 'hidden' }, children: [element({ text: 'Weg' })] }), faded, element({ text: 'Leer', box: [0, 0, 0, 0] })] });
  const definitions = { a: { type: 'text' }, b: { type: 'text' }, c: { type: 'text' }, d: { type: 'text' } };
  assert.deepEqual(textBoxes(root, definitions, { a: 'Weg', b: 'Später', c: 'Leer', d: 'Nirgends' }, styleOf), []);
  assert.deepEqual(textBoxes(root, {}, {}, styleOf), []);
});

test('HTML inside a canvas has no place to click', () => {
  const drawn = element({ text: 'Im Canvas', prop: 'inside' });
  const root = element({ children: [element({ localName: 'canvas', children: [drawn] }), element({ text: 'Daneben' })] });
  const definitions = { inside: { type: 'text' }, beside: { type: 'text' } };
  assert.deepEqual(textBoxes(root, definitions, { inside: 'Im Canvas', beside: 'Daneben' }, styleOf), [{ prop: 'beside', x: 0, y: 0, w: 100, h: 20 }]);
});
