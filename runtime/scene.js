/** Superint Video scene API. Motion is evaluated from absolute project frames. */
export const ease = Object.freeze({
  linear: t => t,
  inCubic: t => t * t * t,
  outCubic: t => 1 - (1 - t) ** 3,
  inOutCubic: t => t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2,
  outQuint: t => 1 - (1 - t) ** 5,
});

/** Piecewise numeric interpolation. Input is clamped unless options.clamp=false. */
export function interpolate(value, input, output, options = {}) {
  if (input.length !== output.length || input.length < 2 || input.some((v, i) => i && v <= input[i - 1])) {
    throw new Error('interpolate requires equal arrays and strictly increasing input values');
  }
  let i = 0;
  while (i < input.length - 2 && value > input[i + 1]) i++;
  let progress = (value - input[i]) / (input[i + 1] - input[i]);
  if (options.clamp !== false) progress = Math.max(0, Math.min(1, progress));
  return output[i] + (output[i + 1] - output[i]) * (options.ease || ease.linear)(progress);
}

/** Analytic damped spring. time is seconds; result approaches 1 from 0. */
export function spring(time, { mass = 1, stiffness = 140, damping = 22 } = {}) {
  if (mass <= 0 || stiffness <= 0 || damping < 0) throw new Error('Invalid spring parameters');
  if (time <= 0) return 0;
  const w = Math.sqrt(stiffness / mass), z = damping / (2 * Math.sqrt(stiffness * mass));
  if (Math.abs(z - 1) < 1e-6) return 1 - Math.exp(-w * time) * (1 + w * time);
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * time) * (Math.cos(wd * time) + z * w / wd * Math.sin(wd * time));
  }
  const r1 = -w * (z - Math.sqrt(z * z - 1)), r2 = -w * (z + Math.sqrt(z * z - 1));
  return 1 - (r2 * Math.exp(r1 * time) - r1 * Math.exp(r2 * time)) / (r2 - r1);
}

/** Stable random value [0,1) from a string/number seed and optional integer index. */
export function random(seed, index = 0) {
  const value = `${seed}:${index}`;
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  h += h << 13; h ^= h >>> 7; h += h << 3; h ^= h >>> 17; h += h << 5;
  return (h >>> 0) / 4294967296;
}

/**
 * Review data a render may return: {actors: [{id, x, y, w, h, target?}]}, boxes in scene pixels.
 * `target` names an actor the box must enclose (a highlight and what it marks).
 */
export function validateActors(result) {
  const actors = result?.actors;
  if (actors == null) return [];
  if (!Array.isArray(actors)) throw new Error('render() actors must be an array');
  return actors.map((actor, index) => {
    const { id, x, y, w, h, target } = actor || {};
    if (typeof id !== 'string' || !id) throw new Error(`Actor ${index} requires an id`);
    if (![x, y, w, h].every(Number.isFinite) || w < 0 || h < 0) throw new Error(`Actor ${id} requires finite x, y and non-negative w, h`);
    if (target === undefined) return { id, x, y, w, h };
    if (typeof target !== 'string' || !target) throw new Error(`Actor ${id} target must be an actor id`);
    return { id, x, y, w, h, target };
  });
}

let definition = null;
function validateProp(key, prop, value) {
  const expectedType = prop.type === 'number' ? 'number' : prop.type === 'boolean' ? 'boolean' : 'string';
  if (typeof value !== expectedType || expectedType === 'number' && !Number.isFinite(value)) throw new Error(`Prop ${key} requires ${prop.type}`);
  if (prop.type === 'number' && (prop.min !== undefined && value < prop.min || prop.max !== undefined && value > prop.max)) throw new Error(`Prop ${key} is outside its min/max range`);
  if (prop.type === 'color' && typeof CSS !== 'undefined' && !CSS.supports('color', value)) throw new Error(`Prop ${key} requires a CSS color`);
}
export function defineScene(scene) {
  if (definition) throw new Error('Only one defineScene call is supported per document');
  if (!scene || typeof scene.render !== 'function') throw new Error('defineScene requires render(context)');
  for (const [key, prop] of Object.entries(scene.props || {})) {
    if (!['text', 'number', 'color', 'boolean'].includes(prop.type)) throw new Error(`Invalid prop type: ${key}`);
    validateProp(key, prop, prop.default);
  }
  definition = scene;
}

const deadline = (promise, label, ms = 15000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  Promise.resolve(promise).then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
});

async function assetReadiness() {
  await deadline(document.fonts.ready, 'Font loading');
  const failedFonts = [...document.fonts].filter(font => font.status === 'error');
  if (failedFonts.length) throw new Error(`Font failed: ${failedFonts.map(font => font.family).join(', ')}`);
  await Promise.all([...document.images].map(async img => {
    try { await deadline(img.decode(), `Image ${img.getAttribute('src') || ''}`); }
    catch (error) { throw new Error(`Image failed: ${img.getAttribute('src') || ''}: ${error.message}`); }
  }));
  if (document.querySelector('video, audio')) throw new Error('Scene video/audio elements are unsupported. Add media as manifest clips.');
  for (const animation of document.getAnimations()) {
    if (animation.playState === 'running') throw new Error('Uncontrolled animation. Pause animation and set its currentTime inside render(context).');
  }
}

// Static HTML also receives this module from the project server.
if (typeof window !== 'undefined' && window.parent !== window) {
  let nonce = null;
  const startupErrors = [];
  const parentOrigin = new URL(document.URL).origin;
  const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise(resolve => window.addEventListener('load', resolve, { once: true }));
  const post = message => parent.postMessage({ source: 'superint-scene', nonce, ...message }, parentOrigin);
  let serial = Promise.resolve();
  window.addEventListener('message', event => {
    if (event.source !== parent || event.origin !== parentOrigin || event.data?.source !== 'superint-player') return;
    const message = event.data;
    if (message.action === 'initialize' && nonce === null && typeof message.nonce === 'string') nonce = message.nonce;
    if (message.nonce !== nonce || nonce === null) return;
    if (!['initialize', 'frame'].includes(message.action)) return;
    serial = serial.then(async () => {
      try {
        await deadline(loaded, 'Document loading');
        if (startupErrors.length) throw new Error(startupErrors.join('\n'));
        await deadline(definition?.ready, 'Scene initialization');
        if (message.action === 'initialize') {
          await assetReadiness();
          post({ type: 'initialized', requestId: message.requestId, propDefinitions: definition?.props || {} });
          return;
        }
        const context = message.context;
        if (!context || !Number.isInteger(context.frame) || !Number.isFinite(context.time)) throw new Error('Invalid frame context');
        const props = Object.fromEntries(Object.entries(definition?.props || {}).map(([key, value]) => [key, value.default]));
        Object.assign(props, context.props || {});
        for (const [key, prop] of Object.entries(definition?.props || {})) validateProp(key, prop, props[key]);
        const actors = validateActors(await deadline(definition?.render({ ...context, props }), 'render(context)'));
        await assetReadiness();
        // A layout read flushes author style changes before the parent's capture.
        document.documentElement.getBoundingClientRect();
        post({ type: 'frame', requestId: message.requestId, frame: context.frame, actors });
      } catch (error) {
        post({ type: 'error', requestId: message.requestId, message: error?.stack || String(error) });
      }
    });
  });
  const recordError = message => { if (!nonce) startupErrors.push(message); else post({ type: 'error', message }); };
  window.addEventListener('error', event => recordError(`${event.message} (${event.filename}:${event.lineno})`));
  window.addEventListener('unhandledrejection', event => recordError(String(event.reason?.stack || event.reason)));
}
