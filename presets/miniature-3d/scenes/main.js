// Entry point: the runtime gives a time, the world renders that moment.
import { defineScene } from '/runtime/scene.js';
import { htmlCanvas } from '/runtime/html-in-canvas.js';
import { makeWorld } from './story.js';

const canvas = document.getElementById('film');
// Real HTML in the world (a screen, a letter, a newspaper): children of the canvas that carry
// `drawable`. The world is then drawn when the browser has laid them out for this frame.
const stage = canvas.querySelector('[drawable]') ? htmlCanvas(canvas) : null;
let W = null;

const fonts = ['500 20px Jost', '700 20px Jost', '400 20px "Courier Prime"', '700 20px "Courier Prime"', '400 20px "JetBrains Mono"', '700 20px "JetBrains Mono"', '700 20px Caveat', '600 20px Fraunces', '900 20px Fraunces'];

defineScene({
  props: { samples: { type: 'number', default: 24, label: 'Subframes per film frame', min: 1, max: 512 } },
  ready: (async () => {
    await Promise.all(fonts.map(f => document.fonts.load(f)));
    await stage?.ready;
    W = await makeWorld(canvas);
  })(),
  // Studio's live preview gets a light picture; capture for check, snapshot and render always gets every subframe.
  render({ time, props, preview }) {
    const draw = () => W.render(time, preview ? Math.min(props.samples, 24) : props.samples);
    return stage ? stage.paint(draw) : draw();
  },
});
