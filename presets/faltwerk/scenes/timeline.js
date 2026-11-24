// When things happen. The voice decides: every leaf turns in the pause after its paragraph (timing.js).
// Until the voice exists, plain test seconds stand in: the title page lies open 4 s, every other spread 20 s (S.plan).
import { TIMING } from './timing.js';
import { LEAVES } from './plan.js';

const L = LEAVES;
// The cover is heavy, the title page thin, the back cover falls shut a little slower.
const DUR = Array.from({ length: L }, (_, j) => j === 0 ? 2.2 : j === 1 ? 1.9 : j === L - 1 ? 2.5 : 2.3);
const par = s => TIMING && TIMING.paragraphs.find(p => p.spread === s);
function turns() {
  const a = []; let prev = 0;
  DUR.forEach((d, j) => {
    const p = par(j), hold = TIMING && TIMING.hold && TIMING.hold[j] || 0, at = TIMING && TIMING.turnAt ? TIMING.turnAt[j] : undefined;
    // A leaf with a word in turnAt turns on that word while the voice goes on; the others in the pause after their paragraph.
    const t0 = typeof at === 'number' ? at : p ? p.end + (j === L - 1 ? 5.2 : .15) + hold : j === 0 ? 1.6 : prev + (j === 1 ? 4 : 20);
    a.push({ leaf: j, t0, dur: d }); prev = t0 + d;
  });
  return a;
}
// One entry per leaf that turns: leaf 0 is the cover, leaf 1 the thin title page, the rest are boards, the last the back cover.
export const TURNS = turns();
const T0 = j => TURNS[j].t0, LAND = j => TURNS[j].t0 + TURNS[j].dur;
// The film ends 2.6 s after the book has shut: the back cover is the end card, and the last chord has rung out by then.
export const END = LAND(L - 1) + 2.6;
export const DURATION = END;
// Camera keys of the opening (cover and title page): [time, eye, at, fov, aperture, focus offset]. From spread 2 on every spread brings its own.
// A title page with a pop-up of its own adds keys here on its moments (TIMING.moments['1'], film seconds).
export const CAM = [
  // The shut book on the desk: low and close, the gold catches the lamp.
  [0, [.37, .2, .39], [.165, 0, .012], .42, .0042, 0],
  [T0(0) - .1, [.33, .25, .45], [.15, .004, .006], .44, .0036, 0],
  // Over the rising cover onto the title page, then slowly nearer while the voice reads it.
  [LAND(0) + .2, [.155, .36, .42], [.15, .02, .02], .45, .0028, 0],
  [Math.max(LAND(0) + 1, T0(1) - 1.4), [.16, .31, .37], [.15, .015, .01], .43, .0028, 0],
  [T0(1) - .1, [.15, .42, .4], [.145, .02, .025], .46, .0028, 0],
];
// Camera keys after the last pop-up spread: the book shuts, the back cover.
export const CAM_END = [
  [T0(L - 1) + 1.3, [-.04, .46, .64], [-.05, .03, -.01], .5, .0026, 0],
  [LAND(L - 1) + .6, [-.2, .34, .52], [-.15, .01, 0], .46, .003, 0],
  [END, [-.32, .21, .4], [-.16, 0, .012], .42, .0042, 0],
];
// Named moments per spread, in seconds on the film's timeline (from the voice). world.js turns them into the spread's own time.
export const MOMENTS = TIMING && TIMING.moments ? { ...TIMING.moments } : {};
