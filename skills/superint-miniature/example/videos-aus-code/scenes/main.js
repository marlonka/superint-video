// Der Einstieg: Die Website, die die Zeit kennt.
import { defineScene } from '/runtime/scene.js';
import { makeWorld } from './story.js';

const canvas = document.getElementById('film');
let W = null;

const fonts = ['500 20px Jost', '700 20px Jost', '400 20px "Courier Prime"', '700 20px "Courier Prime"', '400 20px "JetBrains Mono"', '700 20px "JetBrains Mono"', '700 20px Caveat', '600 20px Fraunces', '900 20px Fraunces'];

defineScene({
  props: { samples: { type: 'number', default: 24, label: 'Teilbilder je Filmbild', min: 1, max: 512 } },
  ready: (async () => {
    await Promise.all(fonts.map(f => document.fonts.load(f)));
    W = await makeWorld(canvas);
  })(),
  render({ time, props }) {
    W.render(time, props.samples);
  },
});
