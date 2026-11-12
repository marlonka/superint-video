const stage = document.querySelector('#stage');
const errorElement = document.querySelector('#error');
let manifest, layers = [], frame = 0, playing = false, generation = 0, requestSequence = 0;
let propDefinitions = {}, pendingSeek = null, draining = false, rafId = 0;
let audioContext = null, audioNodes = [], audioBuffers = new Map(), clockStart = 0, clockFrame = 0, playEpoch = 0;
let readyPromise, reloadWork = null;
const sceneRequests = new Map();
const errors = [];
const studioOrigin = window.SUPERINT_STUDIO_ORIGIN || null;
const captureMode = new URLSearchParams(location.search).get('capture') === '1';
const fps = () => manifest.fps.num / manifest.fps.den;
const seconds = value => value * manifest.fps.den / manifest.fps.num;
const assetUrl = src => '/asset/' + src.split('/').map(encodeURIComponent).join('/');
const timeout = (promise, label, ms = 20000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  Promise.resolve(promise).then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
});
const paint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const state = () => ({ frame, playing, durationFrames: manifest?.durationFrames || 0, propDefinitions, actors: placed('actors'), texts: placed('texts'), errors: [...errors] });
// Boxes in stage pixels: the clip transform turns about the stage centre, like the layer's CSS.
// `actors` are the scene's review boxes, `texts` where it shows its text props.
function placed(kind) {
  if (!manifest) return [];
  const cx = manifest.width / 2, cy = manifest.height / 2;
  return layers.flatMap(layer => (layer[kind] || []).map(box => {
    const t = layer.clip.transform || {}, s = t.scale ?? 1, r = (t.rotation || 0) * Math.PI / 180;
    const corners = [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]]
      .map(([x, y]) => [cx + (t.x || 0) + s * ((x - cx) * Math.cos(r) - (y - cy) * Math.sin(r)), cy + (t.y || 0) + s * ((x - cx) * Math.sin(r) + (y - cy) * Math.cos(r))]);
    const xs = corners.map(c => c[0]), ys = corners.map(c => c[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { ...box, clipId: layer.clip.id, x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }));
}
function post(type, extra = {}) {
  if (studioOrigin && parent !== window) parent.postMessage({ source: 'superint-player', type, ...state(), ...extra }, studioOrigin);
}
function report(error, clip) {
  const message = error?.message || String(error);
  const diagnostic = { severity: 'error', code: 'RUNTIME', message, ...(clip ? { clipId: clip.id, path: clip.src } : {}) };
  errors.push(diagnostic);
  if (errors.length > 100) errors.shift();
  errorElement.textContent = (clip ? `${clip.src} [${clip.id}]\n` : '') + message;
  errorElement.style.display = 'block';
  post('error', diagnostic);
}
function fit() {
  if (!manifest) return;
  stage.style.width = manifest.width + 'px'; stage.style.height = manifest.height + 'px';
  stage.style.transform = `translate(-50%, -50%) scale(${Math.min(innerWidth / manifest.width, innerHeight / manifest.height)})`;
}
addEventListener('resize', fit);

function sceneRequest(layer, action, context) {
  const requestId = ++requestSequence;
  return timeout(new Promise((resolve, reject) => {
    sceneRequests.set(requestId, { resolve, reject, layer });
    layer.element.contentWindow.postMessage({ source: 'superint-player', nonce: layer.nonce, action, requestId, context }, '*');
  }), `Scene ${layer.clip.src}`, 20000).finally(() => sceneRequests.delete(requestId));
}
addEventListener('message', event => {
  const message = event.data;
  if (message?.source === 'superint-scene') {
    const layer = layers.find(value => value.element.contentWindow === event.source && value.nonce === message.nonce);
    if (!layer || event.origin !== 'null') return;
    const request = sceneRequests.get(message.requestId);
    if (message.type === 'error') {
      if (request) request.reject(new Error(message.message)); else report(new Error(message.message), layer.clip);
    } else if (request && request.layer === layer) {
      if (message.type === 'initialized') propDefinitions[layer.clip.id] = message.propDefinitions || {};
      request.resolve(message);
    }
    return;
  }
  if (!studioOrigin || event.source !== parent || event.origin !== studioOrigin || message?.source !== 'superint-studio') return;
  const run = async () => {
    if (message.action === 'reload') { await reload(); return; }
    await readyPromise;
    switch (message.action) {
      case 'seek': pause(); await seek(message.frame); break;
      case 'play': await play(); break;
      // Paused, the picture is drawn once more with the places of its texts (see evaluate).
      case 'pause': pause(); await seek(frame); break;
    }
  };
  run().catch(report);
});

function trackFor(clip) { return manifest.tracks.find(track => track.id === clip.track); }
function visible(clip, at) {
  return !clip.hidden && !trackFor(clip)?.hidden && at >= clip.startFrame && at < clip.startFrame + clip.durationFrames;
}
function opacity(clip, at) {
  const local = at - clip.startFrame;
  const fadeIn = clip.fadeInFrames ? Math.min(1, local / clip.fadeInFrames) : 1;
  const fadeOut = clip.fadeOutFrames ? Math.min(1, (clip.durationFrames - local) / clip.fadeOutFrames) : 1;
  return (clip.opacity ?? 1) * Math.max(0, fadeIn) * Math.max(0, fadeOut);
}
async function makeLayer(clip) {
  const wrapper = document.createElement('div'); wrapper.className = 'layer'; wrapper.dataset.clip = clip.id;
  const element = document.createElement(clip.type === 'scene' ? 'iframe' : 'img');
  const layer = { clip, wrapper, element, nonce: crypto.randomUUID(), loadedFrame: null };
  // Chrome pauses a hidden cross-origin frame: no animation frames and no bitmap decode, so a scene
  // waiting on either would time out. Keep it visible at opacity 0 until the first frame decides.
  wrapper.style.visibility = 'visible'; wrapper.style.opacity = '0';
  wrapper.append(element); stage.append(wrapper); layers.push(layer);
  if (clip.type === 'scene') {
    element.setAttribute('sandbox', 'allow-scripts'); element.title = clip.id;
    element.style.width = manifest.width + 'px'; element.style.height = manifest.height + 'px';
    await timeout(new Promise((resolve, reject) => {
      element.onload = resolve; element.onerror = () => reject(new Error(`Unable to load ${clip.src}`));
      element.src = assetUrl(clip.src);
    }), `Scene ${clip.src} load`);
    await sceneRequest(layer, 'initialize');
  } else if (clip.type === 'image') {
    element.src = assetUrl(clip.src);
    await timeout(element.decode(), `Image ${clip.src}`);
  }
  return layer;
}
async function load() {
  const response = await fetch('/manifest', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Manifest loading failed: ${response.status}`);
  manifest = await response.json();
  stage.style.background = manifest.background || '#101113'; fit();
  const ordered = manifest.clips.filter(clip => clip.type !== 'audio').map((clip, index) => ({ clip, index }))
    .sort((a, b) => manifest.tracks.findIndex(track => track.id === a.clip.track) - manifest.tracks.findIndex(track => track.id === b.clip.track) || a.index - b.index);
  // Create in paint order; iframe readiness is independent.
  await Promise.all(ordered.map(({ clip }) => makeLayer(clip).catch(error => { report(error, clip); throw error; })));
}
async function evaluate(at, expectedGeneration) {
  await Promise.all(layers.map(async layer => {
    const clip = layer.clip;
    if (!visible(clip, at)) { layer.actors = []; layer.texts = []; return; }
    const local = at - clip.startFrame + (clip.sourceOffsetFrames || 0);
    try {
      if (clip.type === 'scene') {
        if (layer.wrapper.style.visibility === 'hidden') { layer.wrapper.style.opacity = '0'; layer.wrapper.style.visibility = 'visible'; }
        const reply = await sceneRequest(layer, 'frame', { frame: local, time: seconds(local), fps: manifest.fps, width: manifest.width, height: manifest.height, props: clip.props || {}, font: manifest.font || null, preview: !captureMode, texts: !captureMode && !playing });
        layer.actors = reply.actors || [];
        layer.texts = reply.texts || [];
      } else if (clip.type === 'video' && layer.loadedFrame !== local) {
        const image = new Image();
        image.src = `/frame/${encodeURIComponent(clip.id)}/${local}.png`;
        await timeout(image.decode(), `Video ${clip.src} frame ${local}`);
        // Never let a stale decode overwrite a more recent requested frame.
        if (expectedGeneration !== generation) return;
        layer.element.src = image.src;
        await timeout(layer.element.decode(), `Video ${clip.src} display`);
        layer.loadedFrame = local;
      }
    } catch (error) { report(error, clip); throw error; }
  }));
  if (expectedGeneration !== generation) return false;
  for (const layer of layers) {
    const clip = layer.clip, transform = clip.transform || {};
    // visibility, not display: inactive scenes keep their layout, so render() can measure text.
    layer.wrapper.style.visibility = visible(clip, at) ? 'visible' : 'hidden';
    layer.wrapper.style.opacity = opacity(clip, at);
    layer.wrapper.style.transform = `translate(${transform.x || 0}px, ${transform.y || 0}px) scale(${transform.scale ?? 1}) rotate(${transform.rotation || 0}deg)`;
  }
  await paint();
  if (expectedGeneration !== generation) return false;
  frame = at; post('state'); return true;
}
// One evaluator; newest scrub request replaces queued work. All callers settle.
function seek(requestedFrame) {
  if (!Number.isFinite(requestedFrame)) return Promise.reject(new Error('seek(frame) requires a finite frame number'));
  const target = Math.max(0, Math.min(manifest.durationFrames - 1, Math.round(requestedFrame)));
  const currentGeneration = ++generation;
  return new Promise((resolve, reject) => {
    if (pendingSeek) pendingSeek.resolve({ superseded: true });
    pendingSeek = { target, generation: currentGeneration, resolve, reject };
    if (!draining) drain();
  });
}
async function drain() {
  draining = true;
  while (pendingSeek) {
    const current = pendingSeek; pendingSeek = null;
    try { const committed = await evaluate(current.target, current.generation); current.resolve({ frame, superseded: !committed }); }
    catch (error) { current.reject(error); }
  }
  draining = false;
}
function stopAudio() {
  for (const node of audioNodes) { try { node.source.stop(); } catch {} node.source.disconnect(); node.gain.disconnect(); node.fadeOut.disconnect(); }
  audioNodes = [];
}
function pause() {
  playing = false; playEpoch++; cancelAnimationFrame(rafId); stopAudio(); post('state');
}
async function audioBuffer(src) {
  if (!audioBuffers.has(src)) {
    audioBuffers.set(src, (async () => {
      const response = await fetch(assetUrl(src));
      if (!response.ok) throw new Error(`Audio loading failed: ${src}`);
      if (Number(response.headers.get('Content-Length')) > 134217728) throw new Error(`Preview audio exceeds 128 MiB: ${src}. Use a shorter local source.`);
      const data = await response.arrayBuffer();
      if (data.byteLength > 134217728) throw new Error(`Preview audio exceeds 128 MiB: ${src}`);
      return audioContext.decodeAudioData(data);
    })());
  }
  return audioBuffers.get(src);
}
function audibleClips() {
  return manifest.clips.filter(clip => (clip.type === 'audio' || clip.type === 'video' && clip.includeAudio) && !clip.muted && !clip.hidden && !trackFor(clip)?.muted && !trackFor(clip)?.hidden && clip.startFrame + clip.durationFrames > frame);
}
async function play() {
  if (playing) return;
  if (captureMode) throw new Error('Playback is disabled during frame capture; use seek(frame).');
  const epoch = ++playEpoch;
  const clips = audibleClips();
  if (!audioContext) audioContext = new AudioContext();
  await timeout(audioContext.resume(), 'Audio playback permission', 5000);
  const buffers = await Promise.all(clips.map(clip => timeout(audioBuffer(clip.src), `Audio ${clip.src}`, 30000)));
  if (epoch !== playEpoch) return;
  stopAudio(); clockFrame = frame; clockStart = audioContext.currentTime + 0.06; playing = true;
  clips.forEach((clip, index) => {
    const local = Math.max(0, frame - clip.startFrame), start = clockStart + seconds(Math.max(0, clip.startFrame - frame));
    const duration = seconds(clip.durationFrames - local), offset = seconds((clip.sourceOffsetFrames || 0) + local);
    const source = audioContext.createBufferSource(), gain = audioContext.createGain(), fadeOut = audioContext.createGain();
    source.buffer = buffers[index]; source.connect(gain); gain.connect(fadeOut); fadeOut.connect(audioContext.destination);
    const amplitude = clip.gain ?? 1;
    gain.gain.setValueAtTime(amplitude * (clip.fadeInFrames ? Math.min(1, local / clip.fadeInFrames) : 1), start);
    if (clip.fadeInFrames > local) gain.gain.linearRampToValueAtTime(amplitude, start + seconds(clip.fadeInFrames - local));
    fadeOut.gain.setValueAtTime(clip.fadeOutFrames ? Math.min(1, (clip.durationFrames - local) / clip.fadeOutFrames) : 1, start);
    if (clip.fadeOutFrames) {
      const fadeStart = clip.durationFrames - clip.fadeOutFrames;
      if (fadeStart > local) fadeOut.gain.setValueAtTime(1, start + seconds(fadeStart - local));
      fadeOut.gain.linearRampToValueAtTime(0, start + duration);
    }
    source.start(start, offset, duration); audioNodes.push({ source, gain, fadeOut });
  });
  post('state');
  async function tick() {
    if (!playing || epoch !== playEpoch) return;
    const target = clockFrame + Math.max(0, Math.floor((audioContext.currentTime - clockStart) * fps()));
    try {
      if (target >= manifest.durationFrames) { pause(); await seek(manifest.durationFrames - 1); return; }
      if (target !== frame) await seek(target);
    } catch (error) { pause(); report(error); return; }
    if (playing && epoch === playEpoch) rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);
}
async function reloadOnce() {
  pause(); generation++;
  if (pendingSeek) { pendingSeek.resolve({ superseded: true }); pendingSeek = null; }
  // Finish any scene bridge work before replacing iframe instances.
  while (draining) await new Promise(resolve => setTimeout(resolve, 10));
  layers = []; stage.replaceChildren(); propDefinitions = {}; errors.length = 0; errorElement.style.display = 'none';
  audioBuffers.clear();
  await load(); await seek(frame); post('ready'); return state();
}
function reload() {
  const previous = reloadWork || readyPromise;
  const task = previous.catch(() => {}).then(reloadOnce);
  reloadWork = task; readyPromise = task; window.__superint.ready = task;
  return task.finally(() => { if (reloadWork === task) reloadWork = null; });
}
readyPromise = load().then(() => seek(0)).then(() => { post('ready'); return state(); });
readyPromise.catch(report);
window.__superint = { ready: readyPromise, seek: at => { pause(); return readyPromise.then(() => seek(at)); }, play, pause, getState: state, reload };
