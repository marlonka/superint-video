// Die Welt und ihre Zeit. Hier kommt alles zusammen: Haus, Raeume, Kamera, Licht.
import { Engine } from './engine.js';
import { ROOM, R, buildShell, placeholder } from './house.js';
import { M, clamp, smooth, mix, hash } from './m.js';
import { canvas as mkCanvas, cue, cueE, softDoc } from './kit.js';
import { setPropDocs, SPINE_COLS, SPINE_ROWS } from './props.js';
import { paintSpines, paintCrema, paintCane } from './paint.js';
import { DESK } from './schreib.js';
import { buildExterior } from './exterior.js';
import { buildSchreib } from './schreib.js';
import { buildFoyer } from './foyer.js';
import { buildBuehne } from './buehne.js';
import { buildZeichen } from './zeichen.js';
import { buildTon, buildMusik } from './ton.js';
import { buildSchnitt } from './schnitt.js';
import { buildArchiv } from './archiv.js';
import { buildKino, WIDE, tCut } from './kino.js';
import { buildCamera, camAt } from './camera.js';
import { DURATION, SCENES, FRAMES } from './cues.js';
import { SOURCE } from './source-text.js';
import { IMG } from './baked-images.js';

const STREET_Y = -.6;
const loadImg = src => new Promise(res => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

export async function makeWorld(canvas) {
  const E = new Engine(canvas, 1920, 1080);
  buildShell(E);
  const rooms = [], lights = [];
  const add = l => { lights.push(l); return l; };
  const boxOf = r => ({ boxMin: [r.x0, r.y0, r.z0 - .4], boxMax: [r.x1, r.y1, r.z1] });
  const light = (room, r, o) => add({ room, ...boxOf(r), power: 1, base: 1, near: .05, ...o });

  // Lebende Texturen: was je Bild neu entsteht.
  const live = (slot, w, h) => {
    E.makeLive(slot, w, h, true);
    const c = mkCanvas(w, h), x = c.getContext('2d');
    return { w, h, c, ctx: x, paint(fn) { fn(x); E.updateLive(slot, c); } };
  };
  const liveSlots = { page: live(2, 2048, 2896), ui: live(1, 2048, 1152) };

  // Bilder aus frueheren eigenen Filmen, Kontaktboegen dieses Films, Ausschnitte der eigenen Stilvorlage.
  const names = ['luft', 'kinder', 'frau', 'bogen1', 'bogen2', 'stil1', 'stil2', 'stil3', 'wide'];
  const imgs = await Promise.all(names.map(n => loadImg(IMG[n])));
  const still = {}, stillImg = {};
  names.forEach((n, i) => { stillImg[n] = imgs[i]; still[n] = imgs[i] ? E.addDoc(mkCanvas(1024, 1024, x => x.drawImage(imgs[i], 0, 0, 1024, 1024))) : 0; });
  const [atlasImg, barImg] = await Promise.all([loadImg(IMG.atlas), loadImg(IMG.barcode)]);
  const AC = 12, AR = 18, CW = 1 / AC, CH = 1 / AR, IH = 96 / 2048, IB = 8.9 / 2048;
  const thumbs = E.addDoc(atlasImg ? mkCanvas(2048, 2048, x => x.drawImage(atlasImg, 0, 0, 2048, 2048)) : mkCanvas(2048, 2048, (x, w, h) => {
    const cols = ['#10392f', '#0d1420', '#c56a5d', '#0b2fb0', '#7a5a1e', '#0f2a33', '#3a1a3f', '#8a5a2a', '#5e0f14'];
    for (let i = 0; i < AC * AR; i++) { const cx = (i % AC) * w * CW, cy = Math.floor(i / AC) * h * CH; x.fillStyle = '#060608'; x.fillRect(cx, cy, w * CW, h * CH); x.fillStyle = cols[Math.floor(i / 216 * cols.length)]; x.fillRect(cx, cy + IB * h, w * CW, IH * h); x.fillStyle = '#fff4'; x.font = '700 30px Jost'; x.fillText(String(i * 44), cx + 10, cy + 60); }
  }));
  const barcode = E.addDoc(barImg ? mkCanvas(1024, 1024, x => x.drawImage(barImg, 0, 0, 1024, 1024)) : mkCanvas(1024, 1024, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); ['#10392f', '#0d1420', '#c56a5d', '#0b2fb0', '#7a5a1e', '#0f2a33', '#3a1a3f', '#8a5a2a', '#5e0f14'].forEach((c, i) => g.addColorStop(i / 8, c)); x.fillStyle = g; x.fillRect(0, 0, w, h);
  }));
  const cellCache = [], fullCache = [];
  const thumbCell = i => { i = ((i % 216) + 216) % 216; return cellCache[i] || (cellCache[i] = { b: [CW, IH, (i % AC) * CW, Math.floor(i / AC) * CH + IB] }); };
  const thumbFull = i => { i = ((i % 216) + 216) % 216; return fullCache[i] || (fullCache[i] = { b: [CW, CH, (i % AC) * CW, Math.floor(i / AC) * CH] }); };

  setPropDocs({ spines: E.addDoc(paintSpines(SPINE_COLS, SPINE_ROWS)), crema: E.addDoc(paintCrema()), cane: E.addDoc(paintCane()) });
  const creditsAt = DURATION - 5.9;
  const ctx = { E, rooms, lights, add, light, liveSlots, softTex: softDoc(E), creditsAt, still, stillImg, thumbs, barcode, thumbCell, thumbFull, SOURCE };

  // Die Raeume
  const mods = [];
  mods.push(buildExterior(ctx));
  mods.push(buildSchreib(ctx));
  const foyer = buildFoyer(ctx); mods.push(foyer);
  const buehne = buildBuehne(ctx); mods.push(buehne);
  mods.push(buildZeichen(ctx));
  mods.push(buildTon(ctx));
  mods.push(buildMusik(ctx));
  mods.push(buildSchnitt(ctx));
  mods.push(buildArchiv(ctx));
  mods.push(buildKino(ctx));
  E.setRooms(rooms);
  E.lights = lights;
  E.finishDocs();
  buildCamera({ capsuleFirst: ctx.capsuleFirst, featured: ctx.archivFeatured });

  // Wann gehen die Raeume an? Das Haus wird von Kapitel zu Kapitel heller.
  const ON = { [ROOM.EXT]: -1, [ROOM.SCHREIB]: -1, [ROOM.FOYER]: SCENES.brief - 2.4, [ROOM.BUEHNE]: SCENES.daumenkino - 1, [ROOM.ZEICHEN]: SCENES.planung - .6, [ROOM.TON]: SCENES.ton - 1, [ROOM.MUSIK]: SCENES.ton + 5, [ROOM.SCHNITT]: SCENES.schnitt - 1, [ROOM.ARCHIV]: SCENES.archiv - 1, [ROOM.KINO]: SCENES.du - 1 };
  for (const l of lights) if (l.base === undefined) l.base = 1;
  function setPowers(t) {
    rooms.forEach((rm, id) => { if (!rm) return; rm.power = Math.max(.45, smooth(ON[id], ON[id] + .9, t)); if (rm.tint) rm.tint(t); });
    E.updateRooms();
    for (const l of lights) { if (l.manual) continue; const p = rooms[l.room].power; l.power = p > .16 ? l.base * p : 0; }
  }

  // Die Schrift fuer den Moment, in dem alles zu Text wird: der Quelltext dieses Films, der Reihe nach.
  E.setGlyphs(mkCanvas(1024, 1024, (x, w, h) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '400 50px "JetBrains Mono"';
    for (let c = 32; c < 256; c++) { if (c >= 127 && c < 160) continue; x.fillText(String.fromCharCode(c), (c % 16 + .5) * 64, (Math.floor(c / 16) + .5) * 64 + 2); }
  }));
  {
    const cols = 240, rows = Math.ceil(SOURCE.length / cols), a = new Uint8Array(cols * rows);
    for (let i = 0; i < a.length; i++) { const c = i < SOURCE.length ? SOURCE.charCodeAt(i) : 32; a[i] = c < 32 || c > 255 ? 32 : c; }
    E.setCode(a, cols, rows);
  }
  const reflView = E._view(960, 540), reflTarget = E.makeTarget(960, 540);
  E.live[3] = reflTarget.t;
  // Bild im Bild: zwei Ziele im Wechsel, damit die Welt sich selbst zeigen kann, ohne in die Textur zu schreiben, die sie liest.
  const innerView = E._view(1280, 720), innerA = E.makeTarget(1280, 720), innerB = E.makeTarget(1280, 720);
  innerA.noVig = innerB.noVig = true;
  E.live[0] = innerA.t;

  const textAt = cue(3, 'Code'), textBack = textAt + 2.25;
  let curT = 0, lastInner = null, camOv = null, mirrorAt = STREET_Y, curMirror = reflView, curSamples = 32;
  const wideTarget = E.makeTarget(1920, 1080), wideView = E._view(1920, 1080), deskTarget = E.makeTarget(1920, 1080);
  deskTarget.noVig = true;
  const WCAM = { eye: WIDE.eye, at: WIDE.at, fov: WIDE.fov, aperture: WIDE.ap, focus: Math.hypot(WIDE.eye[0] - WIDE.at[0], WIDE.eye[1] - WIDE.at[1], WIDE.eye[2] - WIDE.at[2]) };
  const cam = t => camOv || camAt(t);
  function prepare(t) {
    curT = t;
    setPowers(t);
    const g = E.grade; const wo = ctx.whiteOut ? ctx.whiteOut(t) : 0; const endK = camOv ? 0 : smooth(creditsAt + 1.1, creditsAt + 2.1, t), T_C = tCut(); const letK = camOv ? 0 : Math.max(smooth(cue(4, 'Trotzdem') - 1.1, cue(4, 'Trotzdem') - .3, t) * (1 - smooth(cue(4, 'Ich', 3) + .4, cue(4, 'Ich', 3) + 1.1, t)), smooth(cue(5, 'gesprochen') + .2, cue(5, 'Die') - .1, t) * (1 - smooth(cue(5, 'Keine') - .2, cue(5, 'Nur', 1) - .1, t))); g.exp = (1 + 60 * wo * wo * wo) * mix(1, .84, endK) * mix(1, .8, letK); g.bloom = mix(.055, .012, Math.max(endK, letK)) * (camOv ? 1 : (t < T_C ? 1 : smooth(T_C + .5, T_C + 1.7, t))); g.vig = .36; g.sat = 1.06; g.grain = .02; g.ca = 1.2;
    // Das hier ist Text: Eine Kante laeuft von oben durchs Bild, dann wieder zurueck.
    const down = smooth(textAt, textAt + 1.05, t), up = smooth(textBack, textBack + .85, t);
    const edge = mix(1 - down, 1, up);
    E.text.mask = down > 0 && up < 1 ? 1 : 0;
    E.text.geo = [960, -40 + edge * 1160, -1, 26];
    E.text.cell = 15; E.text.scroll = Math.floor((t - textAt) * 2);
    // Direkt nach dem Schnitt steht nichts zwischen Linse und Guckkasten: Der Dunst der Stube kommt erst mit der Fahrt zurueck.
    E.hazeK = camOv || t < T_C ? 1 : smooth(T_C + .6, T_C + 2.2, t);
    const world = {};
    for (const m of mods) m.frame && m.frame(t, world);
    // Nasse Strasse: nur in den Totalen, dann aber richtig.
    const c0 = cam(t);
    E.refl = 0; E.plane.on = false; mirrorAt = STREET_Y; E.live[3] = reflTarget.t;
    if (c0.eye[2] > 6.5 && c0.eye[1] < 9) {
      E.liveBusy = reflTarget.t;
      E.renderInto(reflView, reflTarget, t, story, 5);
      E.liveBusy = null;
      E.refl = smooth(6.5, 12, c0.eye[2]) * 1.1;
    } else if (!camOv && c0.eye[1] > DESK.top + .004 && c0.eye[1] < DESK.top + 1.6 && Math.hypot(c0.eye[0] - DESK.x, c0.eye[2] - DESK.z) < 3.2) {
      // Die lackierte Platte: von nahem sieht man die Tasse darin.
      mirrorAt = DESK.top;
      curMirror = wideView;
      E.liveBusy = deskTarget.t;
      E.renderInto(wideView, deskTarget, t, story, 8);
      E.liveBusy = null;
      curMirror = reflView;
      E.live[3] = deskTarget.t;
      E.plane.on = true; E.plane.y = DESK.top; E.plane.soft = 1;
    } else if (!camOv && c0.eye[0] > -8.6 && c0.eye[0] < -2.4 && c0.eye[1] > .05 && c0.eye[1] < 3.4 && c0.eye[2] < 6.5 && c0.eye[2] > -3.6) {
      // Der Marmor im Foyer: Lampe, Pult und Wand stehen noch einmal im Boden.
      mirrorAt = 0;
      curMirror = wideView;
      E.liveBusy = deskTarget.t;
      E.renderInto(wideView, deskTarget, t, story, 8);
      E.liveBusy = null;
      curMirror = reflView;
      E.live[3] = deskTarget.t;
      E.plane.on = true; E.plane.y = 0; E.plane.soft = .55;
    }
  }
  function renderInner(t2, target, N) {
    E.liveBusy = target.t;
    E.renderInto(innerView, target, t2, story, N);
    E.liveBusy = null;
    E.live[0] = target.t;
  }
  const story = {
    frame(t) {
      const want = ctx.buehneInner ? ctx.buehneInner(t) : null;
      if (ctx.wideInner && ctx.wideInner(t)) {
        // Das ganze Haus, von aussen, jetzt gerade: auf der Leinwand und im Guckkasten.
        camOv = WCAM;
        prepare(t);
        E.live[0] = E.emptyTex;
        E.liveBusy = wideTarget.t;
        wideTarget.noVig = true;
        E.renderInto(wideView, wideTarget, t, story, curSamples >= 128 ? 72 : 16);
        E.liveBusy = null;
        E.live[0] = wideTarget.t;
        camOv = null;
        lastInner = null;
      } else if (want === 'self') {
        // Die Website zeigt genau diese Sekunde: also sich selbst, die sich selbst zeigt, die sich selbst zeigt.
        prepare(t);
        E.live[0] = E.emptyTex;
        for (let lv = 0; lv < 7; lv++) renderInner(t, lv % 2 ? innerB : innerA, 8);
        lastInner = null;
      } else if (want !== null && want !== lastInner) {
        prepare(want);
        E.live[0] = E.emptyTex;
        renderInner(want, innerA, 14);
        lastInner = want;
      }
      prepare(t);
    },
    sub(ts, _E, s, N, view) {
      const c = cam(ts);
      const mirror = view === curMirror;
      E.camera.eye = c.eye; E.camera.at = c.at; E.camera.fov = c.fov; E.camera.focus = c.focus;
      // Draussen steht nichts dicht vor der Linse: Mit einer weiteren Nahebene reicht die Tiefe auch fuer Millimeter in der Ferne.
      E.camera.near = Math.min(3, Math.max(.02, (c.eye[2] - 9) * .1));
      E.camera.aperture = mirror ? 0 : c.aperture; E.camera.mirrorY = mirror ? mirrorAt : undefined;
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
