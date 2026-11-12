// Entry point: the runtime gives a time, the world renders that moment.
import { defineScene } from '/runtime/scene.js';
import { makeWorld } from './story.js';

const canvas = document.getElementById('film');
let W = null;

const fonts = ['500 20px Jost', '700 20px Jost', '400 20px "Courier Prime"', '700 20px "Courier Prime"', '400 20px "JetBrains Mono"', '700 20px "JetBrains Mono"', '700 20px Caveat', '600 20px Fraunces', '900 20px Fraunces'];

defineScene({
  props: { samples: { type: 'number', default: 24, label: 'Subframes per film frame', min: 1, max: 512 } },
  ready: (async () => {
    await Promise.all(fonts.map(f => document.fonts.load(f)));
    W = await makeWorld(canvas);
  })(),
  // Studio's live preview gets a light picture; capture for check, snapshot and render always gets every subframe.
  render({ time, props, preview }) {
    W.render(time, preview ? Math.min(props.samples, 24) : props.samples);
  },
});
