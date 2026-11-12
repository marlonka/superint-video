/** Light or dark, for the start page and the editor alike. `public/theme.js` sets it before paint. */
import { writable } from 'svelte/store';

type Theme = 'dark' | 'light';

const current = (): Theme =>
  document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

export const theme = writable<Theme>(current());

export function toggleTheme() {
  const next: Theme = current() === 'dark' ? 'light' : 'dark';
  const root = document.documentElement;
  root.dataset.theme = next;
  root.style.colorScheme = next;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', next === 'dark' ? '#0e0e0e' : '#f7f7f7');
  try {
    localStorage.setItem('superint-theme', next);
  } catch {
    /* The theme still applies if storage is unavailable. */
  }
  theme.set(next);
}
