import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const executable = path.resolve(process.argv[2] || 'dist/superint-video.exe');
const project = path.resolve(process.argv[3] || 'examples/demo');
const started = performance.now();
const child = spawn(executable, ['studio', project], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
const deadline = setTimeout(() => { child.kill(); process.exitCode = 1; }, 15000);
try {
  const ready = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', code => reject(new Error(`Studio exited before readiness: ${code}`)));
    child.stdout.on('data', bytes => {
      output += bytes.toString();
      const firstLine = output.split('\n')[0];
      try { resolve(JSON.parse(firstLine)); } catch { /* Wait for a complete JSON line. */ }
    });
  });
  const serverReadyMilliseconds = performance.now() - started;
  const response = await fetch(`${ready.url}/api/project`);
  if (!response.ok) throw new Error(`Project endpoint failed: ${response.status}`);
  await response.json();
  const result = {
    serverReadyMilliseconds: Math.round(serverReadyMilliseconds),
    projectResponseMilliseconds: Math.round(performance.now() - started),
    note: 'One warm-filesystem launch; excludes browser startup and first visual frame.'
  };
  await writeFile('artifacts/launch.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  clearTimeout(deadline);
  child.kill();
}
