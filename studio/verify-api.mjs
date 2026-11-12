/** Real HTTP/application boundary. Uses its own temporary project and owned server. */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { once } from 'node:events';
import { mkdtemp, mkdir, realpath, writeFile, readFile, rm } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { crc32, deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const binary =
  process.argv[2] ||
  path.join(
    root,
    'target',
    'debug',
    process.platform === 'win32' ? 'superint-video.exe' : 'superint-video',
  );
// Windows runners may spell TEMP as a short path. The server reports canonical paths.
const tempBase = await realpath(tmpdir());
const tempRoot = await mkdtemp(path.join(tempBase, 'superint-studio-api-'));
const projectPath = path.join(tempRoot, 'Prüfung with spaces');
await mkdir(path.join(projectPath, 'scenes'), { recursive: true });
await mkdir(path.join(projectPath, 'assets'));
await writeFile(path.join(tempRoot, 'outside.txt'), 'OUTSIDE_PROJECT_PRIVATE_SENTINEL');
await writeFile(
  path.join(projectPath, 'scenes', 'scene.html'),
  '<!doctype html><html><body>Frame contract</body></html>',
);
const manifest = {
  version: 1,
  name: 'Studio API verification',
  width: 640,
  height: 360,
  fps: { num: 30, den: 1 },
  durationFrames: 180,
  background: '#101113',
  tracks: [{ id: 'visuals', kind: 'visual' }],
  clips: [
    {
      id: 'original',
      type: 'scene',
      src: 'scenes/scene.html',
      track: 'visuals',
      startFrame: 10,
      durationFrames: 60,
      sourceOffsetFrames: 4,
      props: { title: 'Original' },
    },
  ],
};
await writeFile(path.join(projectPath, 'video.json'), JSON.stringify(manifest, null, 2));
// Its own user folder and no .env: the run never reads or writes the developer's settings, keys,
// films, styles or downloads.
const homePath = path.join(tempRoot, 'home');
await mkdir(homePath);
await writeFile(path.join(tempRoot, 'empty.env'), '');
// What a model would answer when asked for a style: a sheet of values, a line, the look
// contract. The server reads it from this file, so the run asks no model and needs no key.
const styleSheet = {
  title: { en: 'Paper Cut', de: 'Scherenschnitt' },
  description: {
    en: 'Layered cut paper in warm tones with one strong accent.',
    de: 'Geschichtetes Papier in warmen Tönen mit einem kräftigen Akzent.',
  },
  essence:
    'Everything is cut from paper and stacked: flat shapes with a cut edge, a soft shadow under each layer and a warm ground.',
  palette: {
    ground: '#F4ECDF',
    surface: '#e9dcc6',
    line: '#cdbb9d',
    ink: '#221100',
    muted: '#6b5d4a',
    accent: '#E4572E',
  },
  uses: { ground: 'The paper every frame stands on', accent: 'The one thing that matters' },
  font: 'Fraunces',
  displayWeight: 800,
  textWeight: 500,
  tracking: -0.02,
  seconds: 60,
  workflow: 'superint-explainer',
  voice: 'Kore',
  music: 'Warm felt piano and soft brushes, 84 BPM. Instrumental, no vocals.',
};
const styleSections = [
  ['The frame test', '- Is the ground a warm paper tone (`ground`), never white?'],
  ['Colour', '`ground` fills at least 55 % of every frame; `accent` takes at most 8 %.'],
  ['Shapes and materials', 'Layered cut paper: flat fills, corners of 0.6 vmin, no outlines.'],
  ['Light and depth', 'One light from the upper left; every layer drops a soft shadow.'],
  ['Type', 'Fraunces 800 for headlines at 9 vmin, sentence case, at most six words a line.'],
  ['Composition', 'Margins of 7 vmin. The subject sits on a third, never in the centre.'],
  ['Motion', 'Layers slide in from below over 0.5 s with an ease-out; staggers of 0.08 s.'],
  ['Do', '- Stack layers so each overlaps the one behind it.'],
  ["Don't", '- No outlines, gradients, glows or glass.'],
  ['Pitfalls', '- Shadows that point different ways.'],
];
const styleAnswer = path.join(tempRoot, 'style-answer.txt');
await writeFile(
  styleAnswer,
  '```json\n' +
    JSON.stringify(styleSheet, null, 2) +
    '\n```\n\n=== STYLE.md ===\n' +
    styleSections.map(([title, text]) => `## ${title}\n\n${text}\n`).join('\n'),
);
/** A PNG of one colour, small enough to write by hand. */
function png(width, height, [red, green, blue]) {
  const chunk = (kind, data) => {
    const body = Buffer.concat([Buffer.from(kind), data]);
    const frame = Buffer.alloc(8 + body.length);
    frame.writeUInt32BE(data.length, 0);
    body.copy(frame, 4);
    frame.writeUInt32BE(crc32(body), 4 + body.length);
    return frame;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3)]);
  for (let x = 0; x < width; x++) row.set([red, green, blue], 1 + x * 3);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(Array(height).fill(row)))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const isolated = {
  ...process.env,
  SUPERINT_HOME: homePath,
  // A Google sign-in on this machine would count as a Google Cloud key; point at none.
  GOOGLE_APPLICATION_CREDENTIALS: path.join(tempRoot, 'no-google-sign-in.json'),
  SUPERINT_ENV: path.join(tempRoot, 'empty.env'),
  SUPERINT_FILMS: path.join(tempRoot, 'films'),
  SUPERINT_PRESETS: path.join(tempRoot, 'styles'),
  SUPERINT_DOWNLOADS: path.join(tempRoot, 'downloads'),
  SUPERINT_STYLE_ANSWER: styleAnswer,
  GEMINI_API_KEY: '',
  GOOGLE_API_KEY: '',
  OPENROUTER_API_KEY: '',
  OPENAI_API_KEY: '',
  GOOGLE_CLOUD_API_KEY: '',
  GOOGLE_CLOUD_PROJECT: '',
};
const server = spawn(binary, ['studio', projectPath, '--port', '0', '--no-open'], {
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: isolated,
});
let stderr = '';
server.stderr.on('data', (data) => (stderr += data));
let passed = false;
try {
  const address = await new Promise((resolve, reject) => {
    let stdout = '';
    const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${stderr}`)), 15000);
    server.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    server.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited ${code}: ${stderr}`));
    });
    server.stdout.on('data', (data) => {
      stdout += data;
      for (const line of stdout.split('\n')) {
        try {
          const value = JSON.parse(line);
          if (value.url) {
            clearTimeout(timer);
            resolve(value);
            return;
          }
        } catch {}
      }
    });
  });
  const origin = address.url;
  let project;
  async function get(endpoint) {
    const response = await fetch(origin + endpoint);
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  }
  async function mutation(endpoint, body, overrides = {}) {
    return fetch(origin + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        'X-Superint-Token': project.token,
        ...overrides,
      },
      body: JSON.stringify(body),
    });
  }
  async function edit(operation) {
    const response = await mutation('/api/edit', { revision: project.revision, operation });
    assert.equal(response.status, 200, await response.clone().text());
    project = await response.json();
    return project;
  }
  async function history(action) {
    const response = await mutation('/api/history', { revision: project.revision, action });
    assert.equal(response.status, 200, await response.clone().text());
    project = await response.json();
  }
  project = await get('/api/project');
  const initialRevision = project.revision;
  assert.ok(project.token && project.revision);
  assert.equal(project.manifest.clips[0].sourceOffsetFrames, 4);
  assert.ok((await fetch(origin)).ok, 'embedded Studio index is served');
  assert.ok(
    (await fetch(new URL('/player.html', project.previewUrl))).ok,
    'separate player is served',
  );

  const deniedGet = await fetch(origin + '/api/project', {
    headers: { Origin: 'https://foreign.example' },
  });
  assert.equal(deniedGet.status, 403);
  const missingToken = await mutation(
    '/api/edit',
    { revision: project.revision, operation: { type: 'deleteClip', id: 'original' } },
    { 'X-Superint-Token': '' },
  );
  assert.equal(missingToken.status, 403);
  const foreignMutation = await mutation(
    '/api/edit',
    { revision: project.revision, operation: { type: 'deleteClip', id: 'original' } },
    { Origin: 'https://foreign.example' },
  );
  assert.equal(foreignMutation.status, 403);
  const badHost = await new Promise((resolve, reject) => {
    const request = http.get(
      origin + '/api/project',
      { headers: { Host: 'evil.example' } },
      (response) => {
        response.resume();
        response.on('end', () => resolve(response.statusCode));
      },
    );
    request.on('error', reject);
  });
  assert.equal(badHost, 403);
  const traversal = await fetch(origin + '/api/media?path=' + encodeURIComponent('../outside.txt'));
  assert.ok([400, 403].includes(traversal.status));
  assert.ok(!(await traversal.text()).includes('OUTSIDE_PROJECT_PRIVATE_SENTINEL'));
  assert.equal(
    (await get('/api/project')).revision,
    initialRevision,
    'denied requests cannot change project',
  );

  await edit({ type: 'updateClip', id: 'original', changes: { startFrame: 20 } });
  assert.equal(project.manifest.clips[0].sourceOffsetFrames, 4, 'move preserves source time');
  await edit({
    type: 'updateClip',
    id: 'original',
    changes: { startFrame: 25, durationFrames: 55, sourceOffsetFrames: 9 },
  });
  await edit({ type: 'splitClip', id: 'original', frame: 50 });
  const halves = [...project.manifest.clips].sort((a, b) => a.startFrame - b.startFrame);
  assert.equal(halves.length, 2);
  assert.deepEqual(
    halves.map(({ startFrame, durationFrames, sourceOffsetFrames }) => ({
      startFrame,
      durationFrames,
      sourceOffsetFrames,
    })),
    [
      { startFrame: 25, durationFrames: 25, sourceOffsetFrames: 9 },
      { startFrame: 50, durationFrames: 30, sourceOffsetFrames: 34 },
    ],
  );
  assert.ok(halves.every((clip) => clip.id !== 'original'));
  assert.notEqual(halves[0].id, halves[1].id);
  await history('undo');
  assert.equal(project.manifest.clips.length, 1);
  assert.equal(project.manifest.clips[0].sourceOffsetFrames, 9);
  await history('redo');
  assert.deepEqual(
    project.manifest.clips.map((clip) => clip.id).sort(),
    halves.map((clip) => clip.id).sort(),
  );
  await edit({
    type: 'updateClip',
    id: halves[0].id,
    changes: { props: { title: 'Saved\nthrough HTTP' } },
  });
  const savedManifest = JSON.parse(await readFile(path.join(projectPath, 'video.json'), 'utf8'));
  assert.equal(
    savedManifest.clips.find((clip) => clip.id === halves[0].id).props.title,
    'Saved\nthrough HTTP',
  );
  const stale = await mutation('/api/edit', {
    revision: initialRevision,
    operation: { type: 'deleteClip', id: halves[0].id },
  });
  assert.equal(stale.status, 409, 'stale writes are rejected');
  assert.equal((await get('/api/project')).revision, project.revision);

  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#00ff00"/></svg>';
  async function importFile(contents) {
    const response = await fetch(
      origin + '/api/import?name=' + encodeURIComponent('Imported image.svg'),
      {
        method: 'POST',
        headers: {
          Origin: origin,
          'X-Superint-Token': project.token,
          'Content-Type': 'application/octet-stream',
        },
        body: contents,
      },
    );
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  }
  const imported = await importFile(svg);
  const collision = await importFile(svg.replace('#00ff00', '#ff0000'));
  assert.notEqual(
    imported.path,
    collision.path,
    'a different import never overwrites its namesake',
  );
  assert.equal(await readFile(path.join(projectPath, imported.path), 'utf8'), svg);
  project = await get('/api/project');
  await edit({ type: 'addTrack', track: { id: 'overlay', kind: 'visual', name: 'Overlay' } });
  await edit({
    type: 'addClip',
    clip: {
      id: 'image',
      type: 'image',
      src: imported.path,
      track: 'overlay',
      startFrame: 0,
      durationFrames: 30,
      sourceOffsetFrames: 0,
    },
  });
  await edit({ type: 'updateTrack', id: 'overlay', changes: { hidden: true } });
  assert.equal(project.manifest.tracks.find((track) => track.id === 'overlay').hidden, true);
  const beforeExternal = project.revision;
  const externalManifest = JSON.parse(await readFile(path.join(projectPath, 'video.json'), 'utf8'));
  externalManifest.name = 'Externally edited project';
  await writeFile(path.join(projectPath, 'video.json'), JSON.stringify(externalManifest, null, 2));
  project = await get('/api/project');
  assert.equal(project.manifest.name, 'Externally edited project');
  assert.notEqual(project.revision, beforeExternal);
  assert.equal(project.canUndo, false, 'external edits invalidate stale undo');
  const staleUndo = await mutation('/api/history', { revision: beforeExternal, action: 'undo' });
  assert.equal(staleUndo.status, 409);
  assert.equal((await get('/api/project')).manifest.name, 'Externally edited project');
  // The start page: setup, defaults and keys, served next to the project.
  let app = await get('/api/app');
  assert.equal(app.token, project.token);
  assert.equal(app.project.name, 'Externally edited project');
  assert.equal(app.setup.can.voice, false, 'no key yet');
  assert.equal(app.setup.can.dictate, false, 'no key yet');
  assert.deepEqual(
    app.setup.keys.map((key) => [key.name, key.present]),
    [
      ['GEMINI_API_KEY', false],
      ['OPENROUTER_API_KEY', false],
      ['GOOGLE_CLOUD_API_KEY', false],
      ['OPENAI_API_KEY', false],
    ],
  );
  for (const key of app.setup.keys.filter((key) => key.models.voice))
    for (const role of ['voice', 'timings', 'music'])
      assert.equal(
        key.models[role].includes('/'),
        key.name === 'OPENROUTER_API_KEY',
        `${key.name} names its ${role} model in its own provider's form`,
      );
  assert.ok(app.styles.some((style) => style.name === 'blank'));
  // Each built-in look has three pictures of its own for its card, served as JPEG; the neutral
  // style has none and falls back to its references.
  for (const style of app.styles.filter((style) => style.name !== 'blank')) {
    assert.equal(style.preview.length, 3, `${style.name} has three card pictures`);
    const picture = await fetch(
      `${origin}/api/app/styles/${style.name}/preview/${encodeURIComponent(style.preview[0])}`,
    );
    assert.equal(picture.status, 200);
    assert.equal(picture.headers.get('content-type'), 'image/jpeg');
  }
  assert.deepEqual(app.styles.find((style) => style.name === 'blank').preview, []);
  assert.equal(
    (await fetch(`${origin}/api/app/styles/launch/preview/..%2Fpreset.json`)).status,
    400,
    'only pictures are served from a card',
  );
  assert.equal(app.settings.preset, null);
  const send = (endpoint, method, body, overrides = {}) =>
    fetch(origin + endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        'X-Superint-Token': project.token,
        ...overrides,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const sentinel = 'verification-key-0000000001';
  assert.equal(
    (
      await send(
        '/api/app/keys/GEMINI_API_KEY',
        'POST',
        { value: sentinel },
        { 'X-Superint-Token': 'no' },
      )
    ).status,
    403,
    'a key cannot be saved without the capability',
  );
  assert.equal(
    (
      await send(
        '/api/app/keys/GEMINI_API_KEY',
        'POST',
        { value: sentinel },
        { Origin: 'http://127.0.0.1:1' },
      )
    ).status,
    403,
    'a key cannot be saved from a foreign origin',
  );
  assert.equal(
    (await send('/api/app/keys/SOME_OTHER_KEY', 'POST', { value: sentinel })).status,
    400,
  );
  assert.equal(
    (await send('/api/app/keys/GEMINI_API_KEY', 'POST', { value: 'two words' })).status,
    400,
  );
  const saved = await send('/api/app/keys/GEMINI_API_KEY', 'POST', { value: sentinel });
  assert.equal(saved.status, 200, await saved.clone().text());
  assert.ok(!(await saved.text()).includes(sentinel), 'the answer never carries the key');
  app = await get('/api/app');
  assert.equal(app.setup.can.voice, true);
  assert.equal(app.setup.keys[0].source, 'app');
  assert.ok(!JSON.stringify(app).includes(sentinel), 'the start page never carries the key');
  const stored = await readFile(path.join(homePath, 'keys.dat'));
  if (process.platform === 'win32')
    assert.ok(!stored.includes(sentinel), 'the key file is not readable as text');
  assert.equal((await send('/api/app/keys/GEMINI_API_KEY', 'DELETE')).status, 200);
  assert.equal((await get('/api/app')).setup.keys[0].present, false);
  const settings = await send('/api/app/settings', 'PUT', {
    ...app.settings,
    preset: 'blank',
    follow: false,
    // Length, format and language belong to each prompt now; an old client's are dropped.
    seconds: 45,
  });
  assert.equal(settings.status, 200, await settings.clone().text());
  const kept = (await get('/api/app')).settings;
  assert.equal(kept.follow, false);
  assert.equal(kept.preset, 'blank');
  assert.ok(!('seconds' in kept), 'no length is kept among the settings');
  assert.equal(
    (await send('/api/app/settings', 'PUT', { ...app.settings, preset: 'no-such-style' })).status,
    400,
  );
  assert.equal((await send('/api/app/films/0000000000000000/open', 'POST')).status, 404);
  // The app's own language is a setting like the others, and only one the app speaks.
  const spoken = await send('/api/app/settings', 'PUT', { ...app.settings, uiLanguage: 'de' });
  assert.equal(spoken.status, 200, await spoken.clone().text());
  assert.equal((await get('/api/app')).settings.uiLanguage, 'de');
  assert.equal(
    (await send('/api/app/settings', 'PUT', { ...app.settings, uiLanguage: 'xx' })).status,
    400,
  );
  // A pro names models per job, as the provider writes them; `models/` is dropped. The ID says
  // the provider, and OpenAI's models write down dictations only.
  const chosen = await send('/api/app/settings', 'PUT', {
    ...app.settings,
    dictationModel: ' models/gemini-4-transcribe ',
    musicModel: 'google/lyria-3-pro-preview',
    googleCloudProject: 'my-films-123',
    googleCloudLocation: 'US',
    openAiRegion: 'eu',
  });
  assert.equal(chosen.status, 200, await chosen.clone().text());
  const withModels = await get('/api/app');
  assert.equal(withModels.settings.dictationModel, 'gemini-4-transcribe');
  assert.equal(withModels.settings.musicModel, 'google/lyria-3-pro-preview');
  assert.equal(withModels.settings.googleCloudLocation, 'us');
  assert.deepEqual(
    withModels.setup.keys.map((key) => [key.name, key.more]),
    [
      ['GEMINI_API_KEY', false],
      ['OPENROUTER_API_KEY', false],
      ['GOOGLE_CLOUD_API_KEY', true],
      ['OPENAI_API_KEY', true],
    ],
  );
  const cloud = withModels.setup.keys[2];
  assert.equal(cloud.models.music, 'lyria-3-pro-preview');
  if (!cloud.place.fixed) {
    assert.deepEqual(
      [cloud.place.project, cloud.place.location, cloud.place.servedIn],
      ['my-films-123', 'us', 'us'],
    );
  }
  // OpenAI's models write down dictations and write styles, and make no part of a film.
  assert.deepEqual(withModels.setup.keys[3].models, {
    dictation: 'gpt-transcribe',
    style: 'gpt-6.1-sol',
  });
  // The model that writes a style is a job like the others; without a key nobody writes one.
  assert.equal(withModels.setup.models.style, 'gemini-4-hydrogen');
  assert.equal(withModels.setup.can.style, false);
  assert.deepEqual(withModels.setup.style, { model: 'gemini-4-hydrogen', provider: 'Google' });
  const styleWriter = await send('/api/app/settings', 'PUT', {
    ...app.settings,
    styleModel: ' models/gemini-4-argon ',
  });
  assert.equal(styleWriter.status, 200, await styleWriter.clone().text());
  assert.equal((await get('/api/app')).settings.styleModel, 'gemini-4-argon');
  assert.equal(withModels.setup.keys[3].region, 'eu');
  assert.equal(withModels.setup.models.narration, 'gemini-3.8-flash-tts');
  for (const refused of [
    { narrationModel: 'gpt-4o-mini-tts' },
    { dictationModel: 'gemini 4' },
    { styleModel: 'gemini 4' },
    { googleCloudProject: 'My_Project' },
    { googleCloudLocation: 'europe-west4' },
    { openAiRegion: 'jp' },
  ]) {
    const answer = await send('/api/app/settings', 'PUT', { ...app.settings, ...refused });
    assert.equal(answer.status, 400, JSON.stringify(refused));
  }
  const usual = await send('/api/app/settings', 'PUT', app.settings);
  assert.equal(usual.status, 200, await usual.clone().text());
  // A dictation is a WAV recording, and without a key it never leaves the computer.
  const dictate = (bytes, headers = {}) =>
    fetch(`${origin}/api/app/dictate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        Origin: origin,
        'X-Superint-Token': project.token,
        ...headers,
      },
      body: bytes,
    });
  const silence = Buffer.alloc(44 + 32_000);
  silence.write('RIFF', 0);
  silence.writeUInt32LE(36 + 32_000, 4);
  silence.write('WAVEfmt ', 8);
  silence.writeUInt32LE(16, 16);
  silence.writeUInt16LE(1, 20);
  silence.writeUInt16LE(1, 22);
  silence.writeUInt32LE(16_000, 24);
  silence.writeUInt32LE(32_000, 28);
  silence.writeUInt16LE(2, 32);
  silence.writeUInt16LE(16, 34);
  silence.write('data', 36);
  silence.writeUInt32LE(32_000, 40);
  assert.equal((await dictate(silence, { 'X-Superint-Token': 'no' })).status, 403);
  assert.equal((await dictate(Buffer.from('not a recording'))).status, 400);
  const keyless = await dictate(silence);
  assert.equal(keyless.status, 400);
  assert.match((await keyless.json()).message, /API key/);
  // Setup names the coding agents and the tools. Installing is asked for with an unknown tool
  // only, so this check can never start an installation.
  assert.deepEqual(
    app.setup.agents.map((agent) => agent.id),
    ['claude', 'codex', 'antigravity'],
  );
  assert.ok(app.setup.tools.every((tool) => typeof tool.install === 'boolean'));
  assert.ok(app.styles.every((style) => typeof style.translations === 'object'));
  assert.equal(
    (
      await send('/api/app/tools/no-such-tool/install', 'POST', undefined, {
        'X-Superint-Token': 'no',
      })
    ).status,
    403,
    'nothing is installed without the capability',
  );
  assert.equal((await send('/api/app/tools/no-such-tool/install', 'POST')).status, 400);
  // Films have a folder without the user choosing one, and each agent says which skills differ.
  assert.equal(path.resolve(app.filmsFolder), path.resolve(isolated.SUPERINT_FILMS));
  assert.ok(app.setup.agents.every((agent) => Array.isArray(agent.outdated)));
  // A film starts the next one: the copy lands in the films folder, named, without its renders.
  const original = (await get('/api/app')).films.find((film) => film.current);
  assert.ok(original, 'the open film is on the list');
  await mkdir(path.join(original.path, 'renders'), { recursive: true });
  await writeFile(path.join(original.path, 'renders', 'film.mp4'), 'rendered');
  assert.equal(
    (await send(`/api/app/films/${original.id}/duplicate`, 'POST', { name: ' ' })).status,
    400,
  );
  const copied = await send(`/api/app/films/${original.id}/duplicate`, 'POST', {
    name: 'Prüfung (Kopie)',
  });
  assert.equal(copied.status, 200, await copied.clone().text());
  const made = await copied.json();
  const copy = made.films.find((film) => film.id === made.id);
  assert.equal(copy.name, 'Prüfung (Kopie)');
  assert.equal(path.dirname(path.resolve(copy.path)), path.resolve(isolated.SUPERINT_FILMS));
  assert.equal(
    JSON.parse(await readFile(path.join(copy.path, 'video.json'), 'utf8')).name,
    'Prüfung (Kopie)',
  );
  assert.ok(existsSync(path.join(original.path, 'renders')), 'the original keeps its renders');
  assert.ok(!existsSync(path.join(copy.path, 'renders')), 'the copy has none');
  // A style travels as one file: the tool writes it, the start page takes it in. The export
  // route is not called here, because it opens the file manager.
  const exported = JSON.parse(
    execFileSync(binary, ['preset', 'export', 'blank', '--output', isolated.SUPERINT_DOWNLOADS], {
      env: isolated,
      windowsHide: true,
    }).toString(),
  ).file;
  const upload = (body, token = project.token) =>
    fetch(origin + '/api/app/styles/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        Origin: origin,
        'X-Superint-Token': token,
      },
      body,
    });
  const styleFile = await readFile(exported);
  assert.equal((await upload(styleFile, 'no')).status, 403, 'no style comes in without the token');
  assert.equal((await upload(Buffer.from('not a style file'))).status, 400);
  const taken = await upload(styleFile);
  assert.equal(taken.status, 200, await taken.clone().text());
  const arrived = await taken.json();
  // `blank` is a built-in name: the style that comes in gets a number and replaces nothing.
  assert.equal(arrived.name, 'blank-2');
  assert.ok(arrived.title.endsWith('(2)'));
  assert.deepEqual(
    arrived.styles.filter((style) => style.name.startsWith('blank')).map((style) => style.own),
    [false, true],
  );
  assert.ok(
    (await readFile(path.join(isolated.SUPERINT_PRESETS, 'blank-2', 'preset.json'))).length > 0,
  );
  // A style of one's own: pictures and a description go in as a form, the model's answer (the
  // file above) becomes a style among the user's, with the pictures as its references.
  // The form goes out in one piece: a refusal before the body is read (no token) would
  // otherwise race the upload and end as a reset on Windows.
  const wish = async (fields, pictures = [], token = project.token) => {
    const form = new FormData();
    for (const [name, value] of Object.entries(fields)) form.set(name, value);
    for (const [name, bytes, type] of pictures)
      form.append('reference', new Blob([bytes], { type }), name);
    const encoded = new Response(form);
    return fetch(origin + '/api/app/styles/create', {
      method: 'POST',
      headers: {
        Origin: origin,
        'X-Superint-Token': token,
        'Content-Type': encoded.headers.get('content-type'),
      },
      body: Buffer.from(await encoded.arrayBuffer()),
    });
  };
  const picture = png(48, 27, [228, 87, 46]);
  const good = [
    ['Mein Bild (1).png', picture, 'image/png'],
    ['02 zweites.png', png(27, 48, [34, 17, 0]), 'image/png'],
  ];
  assert.equal(
    (await wish({ describe: 'Wie aus Papier geschnitten' }, good, 'no')).status,
    403,
    'no style is ownStyle without the token',
  );
  assert.equal((await wish({ name: 'Leer' })).status, 400, 'nothing to go on');
  assert.equal(
    (await wish({}, [['notes.png', Buffer.from('not a picture'), 'image/png']])).status,
    400,
    'a file that is no picture',
  );
  assert.equal(
    (await wish({}, Array(13).fill(good[0]))).status,
    400,
    'more pictures than a style takes',
  );
  const before = (await get('/api/app')).styles.length;
  const madeAnswer = await wish(
    { name: ' Mein *Papierstil* ', describe: 'Wie aus Papier geschnitten', language: 'de' },
    good,
  );
  assert.equal(madeAnswer.status, 200, await madeAnswer.clone().text());
  const ownStyle = await madeAnswer.json();
  assert.equal(ownStyle.name, 'mein-papierstil');
  assert.equal(ownStyle.title, 'Mein Papierstil');
  assert.equal(ownStyle.styles.length, before + 1);
  const mine = ownStyle.styles.find((style) => style.name === ownStyle.name);
  assert.equal(mine.own, true);
  assert.equal(mine.language, 'de');
  assert.equal(mine.references.length, 2);
  const madeRoot = path.join(isolated.SUPERINT_PRESETS, ownStyle.name);
  const contract = await readFile(path.join(madeRoot, 'STYLE.md'), 'utf8');
  assert.match(contract, /^# Mein Papierstil: art direction/);
  assert.match(contract, /## The frame test[\s\S]*## Pitfalls[\s\S]*## References/);
  assert.ok(!contract.includes('Wie aus Papier geschnitten'), 'the description is not quoted');
  assert.match(await readFile(path.join(madeRoot, 'kit', 'theme.css'), 'utf8'), /#e4572e/i);
  for (const reference of ['01-mein-bild-1.png', '02-zweites.png'])
    assert.ok(existsSync(path.join(madeRoot, 'references', reference)), reference);
  // The same name again takes a free one and replaces nothing.
  const again = await (await wish({ name: 'Mein Papierstil' }, good)).json();
  assert.equal(again.name, 'mein-papierstil-2');
  // It starts a film like any other style.
  const started = JSON.parse(
    execFileSync(binary, ['new', '--preset', ownStyle.name, '--topic', 'Papier', '--no-studio'], {
      env: isolated,
      windowsHide: true,
    }).toString(),
  );
  assert.equal(started.preset, ownStyle.name);
  assert.equal(started.references, 2);
  // A style from a film: the same answer, the film's own look in code, and its topic stays out.
  // A film with nothing of a look in it says so.
  assert.equal(
    (await send(`/api/app/films/${original.id}/style`, 'POST', { name: 'Aus Film' })).status,
    400,
  );
  const source = (await get('/api/app')).films.find(
    (film) => path.resolve(film.path) === path.resolve(started.project),
  );
  assert.ok(source, 'the film that was started is on the list');
  const fromFilm = await send(`/api/app/films/${source.id}/style`, 'POST', { name: 'Aus Film' });
  assert.equal(fromFilm.status, 200, await fromFilm.clone().text());
  const filmStyle = await fromFilm.json();
  assert.equal(filmStyle.name, 'aus-film');
  assert.match(
    await readFile(path.join(isolated.SUPERINT_PRESETS, 'aus-film', 'STYLE.md'), 'utf8'),
    /## Where this style comes from/,
  );
  assert.equal(
    (await send('/api/app/films/0000000000000000/style', 'POST', { name: 'x' })).status,
    404,
  );
  passed = true;
  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          'embedded Studio + isolated player',
          'Host/Origin/capability/path boundary',
          'move + trim + split source continuity',
          'undo + redo stable identities',
          'file persistence + stale revision rejection',
          'import collision + add clip + track hide',
          'external reload + stale undo protection',
          'start page: keys saved sealed and never returned, defaults validated',
          'start page: app language, coding agents, install only for known tools',
          'start page: films folder, skills compared, a style exported and imported under a free name',
          'start page: a film duplicated into the films folder without its renders',
          'start page: a style made from pictures and from a film, with the model answer from a file',
        ],
        projectPath,
      },
      null,
      2,
    ),
  );
} finally {
  server.kill();
  await Promise.race([
    once(server, 'exit').catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  const resolved = path.resolve(tempRoot);
  const allowed =
    path.dirname(resolved) === tempBase &&
    path.basename(resolved).startsWith('superint-studio-api-');
  if (passed && allowed) await rm(resolved, { recursive: true, force: true });
  else console.error(`Verification project retained: ${resolved}\n${stderr}`);
}
