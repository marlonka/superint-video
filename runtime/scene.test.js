import test from 'node:test';
import assert from 'node:assert/strict';
import { interpolate, ease, spring, random, validateActors } from './scene.js';

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
