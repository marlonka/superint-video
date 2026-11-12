/**
 * What the start page shares with the editor around it: the overview from `/api/app`, the calls
 * that change it, and the short messages they leave.
 */
import { get, writable } from 'svelte/store';
import { chooseLocale, isLocale, t, type Locale } from '../i18n';
import type { Overview, Settings } from '../types';

export const overview = writable<Overview | null>(null);
/** The action that is running, by a name its button knows; one at a time. */
export const busy = writable('');
/** A failure the user has to read. It stays until dismissed. */
export const problem = writable('');
/** A confirmation that goes away by itself. */
export const toast = writable('');

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
  problem.set(cause instanceof Error ? cause.message : String(cause));
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
 * Calls the server. A value is sent as JSON, a file as it is. A failure carries its status.
 * `signal` lets the caller give up on the answer, as when a dictation is discarded.
 */
export async function call<T>(
  path: string,
  method = 'POST',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const file = body instanceof Blob;
  const response = await fetch(path, {
    method,
    signal,
    headers: {
      'X-Superint-Token': token,
      ...(body === undefined
        ? {}
        : { 'Content-Type': file ? 'application/octet-stream' : 'application/json' }),
    },
    body: body === undefined ? undefined : file ? body : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const said =
      result.message || result.error || get(t)('common.failed', { status: response.status });
    throw Object.assign(new Error(said), { status: response.status });
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
    if (!response.ok) return null;
    const next: Overview = await response.json();
    accept(next);
    return next;
  } catch {
    // The app is restarting or the computer was asleep: the next round asks again.
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
    announce(done ?? get(t)('defaults.saved'));
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

/** What has to be in place before a film can be made, in the order Setup asks for it. */
export type SetupNeed = 'agent' | 'picture' | 'key';

export function needs(state: Overview): SetupNeed[] {
  const { agents, can } = state.setup;
  const missing: SetupNeed[] = [];
  if (!agents.some((agent) => agent.ready)) missing.push('agent');
  if (!can.picture) missing.push('picture');
  if (!can.voice) missing.push('key');
  return missing;
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
