// The camera path. One continuous move through the film: every shot is a key, and the keys are the edit.
// Until the voice exists the times are plain seconds. Afterwards every time is a word: K(cue(3, 'Tisch'), ...).
import { sampleKeys, v3 } from './m.js';
import { DURATION } from './cues.js';
import { CUP, DESK, HERO_OUT } from './set.js';

let keys = [];

// Time, eye, target, field of view (radians), aperture (metres of lens radius), focus offset.
function K(t, eye, at, fov, aperture, df = 0) {
  if (keys.length && t <= keys[keys.length - 1].t) throw new Error(`Camera: time runs backwards at ${t} (before: ${keys[keys.length - 1].t})`);
  keys.push({ t, v: [eye[0], eye[1], eye[2], at[0], at[1], at[2], fov, aperture, df] });
}

export function buildCamera() {
  keys = [];
  const dx = DESK.x, dz = DESK.z, top = DESK.top;
  // The hero: a long lens close to the object, very little depth of field, barely moving.
  K(0, [CUP.x + .285, top + .176, CUP.z + .72], [CUP.x + .018, top + .05, CUP.z], .205, .0028);
  K(HERO_OUT, [CUP.x + .25, top + .168, CUP.z + .66], [CUP.x + .016, top + .05, CUP.z], .205, .0028);
  // Back to the desk, then the room. The lens widens while the camera pulls back, so the move never feels like a zoom.
  K(HERO_OUT + 2.4, [dx + .78, top + .5, dz + 1.26], [dx + .12, top + .12, dz - .02], .56, .003);
  K(HERO_OUT + 6.5, [dx + .1, 1.66, 3.5], [dx, 1.4, -1.8], .68, .005);
  // A slow drift keeps the picture alive. Replace it: the next chapter starts here.
  K(Math.max(DURATION, HERO_OUT + 16), [dx - .3, 1.62, 3.1], [dx - .05, 1.4, -1.8], .68, .005);
}

export function camAt(ts) {
  const v = sampleKeys(keys, ts);
  const eye = [v[0], v[1], v[2]], at = [v[3], v[4], v[5]];
  return { eye, at, fov: v[6], aperture: v[7], focus: Math.max(.05, v3.len(v3.sub(at, eye)) + v[8]) };
}
