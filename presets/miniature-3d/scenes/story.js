// The world and its time: renderer, set, lights, camera. One film frame is E.renderFrame(t, story).
// story.frame(t) runs once per film frame, story.sub(ts, ...) once per subframe. Both are pure functions of time.
import { Engine } from './engine.js';
import { smooth } from './m.js';
import { softDoc } from './kit.js';
import { setPropDocs, SPINE_COLS, SPINE_ROWS } from './props.js';
import { paintSpines, paintCrema, paintCane } from './paint.js';
import { buildSet, ROOM, DESK } from './set.js';
import { buildCamera, camAt } from './camera.js';

export async function makeWorld(canvas) {
  const E = new Engine(canvas, 1920, 1080);
  const rooms = [], lights = [];
  const add = l => { lights.push(l); return l; };
  const boxOf = r => ({ boxMin: [r.x0, r.y0, r.z0 - .4], boxMax: [r.x1, r.y1, r.z1] });
  const light = (room, r, o) => add({ room, ...boxOf(r), power: 1, base: 1, near: .05, ...o });

  setPropDocs({ spines: E.addDoc(paintSpines(SPINE_COLS, SPINE_ROWS)), crema: E.addDoc(paintCrema()), cane: E.addDoc(paintCane()) });
  const ctx = { E, rooms, lights, add, light, softTex: softDoc(E) };

  // Every room or chapter is a module: it builds its geometry once and returns frame(t) and sub(ts, s, N, t, eye, at).
  const mods = [buildSet(ctx)];
  E.setRooms(rooms);
  E.lights = lights;
  E.finishDocs();
  buildCamera();

  // When does a room come on? A house that gets brighter chapter by chapter is a good way to show progress.
  const ON = { [ROOM.EXT]: -1, [ROOM.STUDY]: -1 };
  function setPowers(t) {
    rooms.forEach((rm, id) => { if (rm) rm.power = Math.max(.45, smooth(ON[id], ON[id] + .9, t)); });
    E.updateRooms();
    for (const l of lights) { if (l.manual) continue; const p = rooms[l.room].power; l.power = p > .16 ? l.base * p : 0; }
  }

  // The lacquered desk is a real mirror: a second look at the world from below its surface.
  const mirrorView = E._view(1920, 1080), mirrorTarget = E.makeTarget(1920, 1080);
  mirrorTarget.noVig = true;
  let mirrorY = 0, curSamples = 32;

  function prepare(t) {
    setPowers(t);
    const g = E.grade;
    g.exp = 1; g.bloom = .055; g.vig = .36; g.sat = 1.06; g.grain = .02; g.ca = 1.2;
    for (const m of mods) m.frame && m.frame(t);
    const c0 = camAt(t);
    E.plane.on = false;
    if (c0.eye[1] > DESK.top + .004 && c0.eye[1] < DESK.top + 1.6 && Math.hypot(c0.eye[0] - DESK.x, c0.eye[2] - DESK.z) < 3.2) {
      mirrorY = DESK.top;
      E.liveBusy = mirrorTarget.t;
      E.renderInto(mirrorView, mirrorTarget, t, story, 8);
      E.liveBusy = null;
      E.live[3] = mirrorTarget.t;
      E.plane.on = true; E.plane.y = DESK.top; E.plane.soft = 1;
    }
  }

  let curT = 0;
  const story = {
    frame(t) { curT = t; prepare(t); },
    sub(ts, _E, s, N, view) {
      const c = camAt(ts), mirror = view === mirrorView;
      E.camera.eye = c.eye; E.camera.at = c.at; E.camera.fov = c.fov; E.camera.focus = c.focus;
      // Far from everything the near plane can move out, so the depth buffer keeps its precision.
      E.camera.near = Math.min(3, Math.max(.02, (c.eye[2] - 9) * .1));
      E.camera.aperture = mirror ? 0 : c.aperture; E.camera.mirrorY = mirror ? mirrorY : undefined;
      for (const m of mods) m.sub && m.sub(ts, s, N, curT, c.eye, c.at);
    },
  };
  await E.ready();
  return {
    E,
    render(t, samples) {
      curSamples = samples;
      E.renderFrame(t, story, { samples });
      E.gl.finish();
    },
  };
}
