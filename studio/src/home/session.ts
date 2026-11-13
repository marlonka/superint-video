/**
 * What the start page shares with the editor around it: the overview from `/api/app`, the calls
 * that change it, and the short messages they leave.
 */
import { get, writable } from 'svelte/store';
import { chooseLocale, hasMessage, isLocale, t, type Locale } from '../i18n';
import type { Film, Overview, Settings } from '../types';

export const overview = writable<Overview | null>(null);
/** The action that is running, by a name its button knows; one at a time. */
export const busy = writable('');
/** A failure the user has to read. It stays until dismissed. */
export const problem = writable('');
/** A confirmation that goes away by itself. */
export const toast = writable('');
/** Whether the app answered when it was last asked. The page says so for as long as it does not. */
export const reachable = writable(true);
/** The film a new one starts from, chosen in a film's menu; the composer names it in the prompt. */
export const baseFilm = writable<Film | null>(null);
/** The film a style is to be made from, chosen in a film's menu; the styles show the form. */
export const styleFilm = writable<Film | null>(null);

let toastTimer: ReturnType<typeof setTimeout> | undefined;
/** The app's language as the settings last had it; `undefined` before the first overview. */
let savedLanguage: string | null | undefined;
/** What every changing call carries; the server says it with its first answer. */
let token = '';

export function trust(value: string) {
  token = value;
}

export function announce(message: string) {
  toast.set(message);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.set(''), 3200);
}

export function fail(cause: unknown) {
  // That the app is gone is said by the page itself, until it is back.
  if (cause instanceof Unreachable) return;
  problem.set(cause instanceof Error ? cause.message : String(cause));
}

/** The app did not answer at all: it is not running any more. */
class Unreachable extends Error {
  constructor() {
    super(get(t)('common.unreachable'));
  }
}

/**
 * A failure in the user's language: by its code where the app has words for it, else what the
 * server said, introduced so that nobody takes its English for the whole message.
 */
function explain(result: { code?: string; message?: string }, status: number) {
  const say = get(t);
  const key = `error.${result.code}`;
  if (hasMessage(key)) return say(key);
  return result.message
    ? say('common.failedBecause', { message: result.message })
    : say('common.failed', { status });
}

/** Takes a fresh overview. The app's language follows the saved setting whenever that changed. */
export function accept(next: Overview) {
  overview.set(next);
  trust(next.token);
  const saved = next.settings.uiLanguage;
  if (saved !== savedLanguage) {
    savedLanguage = saved;
    chooseLocale(isLocale(saved) ? saved : null);
  }
}

/** Replaces part of the overview with what a call returned. */
export function patch(changes: Partial<Overview>) {
  overview.update((current) => (current ? { ...current, ...changes } : current));
}

/**
 * Calls the server. A value is sent as JSON, a file as it is, a form as a form. A failure
 * carries its status.
 * `signal` lets the caller give up on the answer, as when a dictation is discarded.
 */
export async function call<T>(
  path: string,
  method = 'POST',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const file = body instanceof Blob;
  // A form names its own type, with the boundary between its parts.
  const form = body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      signal,
      headers: {
        'X-Superint-Token': token,
        ...(body === undefined || form
          ? {}
          : { 'Content-Type': file ? 'application/octet-stream' : 'application/json' }),
      },
      body: body === undefined ? undefined : file || form ? body : JSON.stringify(body),
    });
  } catch (cause) {
    // The caller gave up on the answer: that is no failure of the app.
    if (signal?.aborted) throw cause;
    reachable.set(false);
    throw new Unreachable();
  }
  reachable.set(true);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(explain(result, response.status)), { status: response.status });
  }
  return result as T;
}

/** Asks for the overview again; `fresh` also asks the tools again instead of remembering them. */
export async function refresh(fresh = false): Promise<Overview | null> {
  const query = new URLSearchParams();
  if (document.visibilityState === 'visible') query.set('visible', '1');
  if (fresh) query.set('fresh', '1');
  try {
    const response = await fetch(`/api/app?${query}`);
    reachable.set(true);
    if (!response.ok) return null;
    const next: Overview = await response.json();
    accept(next);
    return next;
  } catch {
    // The app is restarting or was closed: the page says so, and the next round asks again.
    reachable.set(false);
    return null;
  }
}

/** Runs one piece of work at a time and shows its failure where the user reads it; says
 * whether it was done. */
export async function run(name: string, work: () => Promise<void>): Promise<boolean> {
  if (get(busy)) return false;
  busy.set(name);
  problem.set('');
  try {
    await work();
    return true;
  } catch (cause) {
    fail(cause);
    return false;
  } finally {
    busy.set('');
  }
}

async function putSettings(changes: Partial<Settings>) {
  const current = get(overview);
  if (!current) return;
  const result = await call<{ settings: Settings }>('/api/app/settings', 'PUT', {
    ...current.settings,
    ...changes,
  });
  patch({ settings: result.settings });
}

/** Saves defaults and says `done`, or "Saved" when the caller has nothing more exact to say. */
export function saveSettings(changes: Partial<Settings>, done?: string) {
  return run('settings', async () => {
    await putSettings(changes);
    announce(done ?? get(t)('settings.saved'));
  });
}

/** Changes the language of the app here at once, and for every other window with the settings. */
export async function setLanguage(next: Locale) {
  chooseLocale(next);
  savedLanguage = next;
  try {
    await putSettings({ uiLanguage: next });
  } catch (cause) {
    fail(cause);
  }
}

/** Opens a folder in the file manager through one of the app's reveal routes. */
export function reveal(path: string) {
  return run('reveal', async () => {
    await call(path);
  });
}

export async function copyText(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    announce(done);
    return true;
  } catch {
    return false;
  }
}

/** What has to be in place before a film can be made, in the order Setup asks for it. API
 * keys are not among it: they add the AI voice, music and dictation to a film that works
 * without them. */
export type SetupNeed = 'agent' | 'picture';

export function needs(state: Overview): SetupNeed[] {
  const { agents, can } = state.setup;
  const missing: SetupNeed[] = [];
  if (!agents.some((agent) => agent.ready)) missing.push('agent');
  if (!can.picture) missing.push('picture');
  return missing;
}

/** Agents that work, with skills older than the app that the app can bring up to date. */
export function skillsBehind(setup: Overview['setup']) {
  return setup.agents.filter(
    (agent) => agent.ready && agent.canInstall && agent.outdated.length > 0,
  );
}

const SKIPPED = 'superint-setup-skipped';
function wasSkipped() {
  try {
    return sessionStorage.getItem(SKIPPED) === '1';
  } catch {
    return false;
  }
}
/** The user went past an unfinished Setup; holds until the window closes. */
export const setupSkipped = writable(wasSkipped());
export function skipSetup(skipped: boolean) {
  setupSkipped.set(skipped);
  try {
    if (skipped) sessionStorage.setItem(SKIPPED, '1');
    else sessionStorage.removeItem(SKIPPED);
  } catch {
    /* Without storage the choice holds for this page. */
  }
}
