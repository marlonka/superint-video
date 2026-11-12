/** The choices the start page offers for a film: lengths, picture formats and languages. */
import type { MessageKey } from '../i18n';
import type { Style } from '../types';

/** Seconds. A guide: the film is as long as its narration needs. */
export const LENGTHS = [15, 30, 45, 60, 90, 120, 180, 300, 600, 900, 1200];
/** The longest film the tool makes, in seconds (`new --seconds`, the settings). */
export const MOST_SECONDS = 3600;

const UNITS: [RegExp, number][] = [
  [/^(h|std|stunden?|hours?)$/, 3600],
  [/^(m|min|minuten?|minutes?)$/, 60],
  [/^(s|sek|sekunden?|sec|seconds?)$/, 1],
];

/**
 * A length as people type it, in seconds: "3 min", "90 s", "1 min 30 s", "2:30", "1,5 min",
 * or a bare number, which counts as minutes. Null when it is none of these or not between one
 * second and an hour.
 */
export function parseLength(text: string): number | null {
  const plain = text.trim().toLowerCase().replace(/,/g, '.');
  if (!plain) return null;
  const clock = plain.match(/^(\d+):([0-5]\d)$/);
  if (clock) return within(Number(clock[1]) * 60 + Number(clock[2]));
  const parts = [...plain.matchAll(/(\d+(?:\.\d+)?)\s*([a-zäöü]*)\s*/gy)];
  if (!parts.length || parts.reduce((sum, part) => sum + part[0].length, 0) !== plain.length)
    return null;
  let total = 0;
  for (const [, number, unit] of parts) {
    const scale = unit ? UNITS.find(([words]) => words.test(unit))?.[1] : 60;
    if (!scale) return null;
    total += Number(number) * scale;
  }
  return within(Math.round(total));
}

function within(seconds: number) {
  return seconds >= 1 && seconds <= MOST_SECONDS ? seconds : null;
}

export const FORMATS: { value: string; label: MessageKey }[] = [
  { value: '16:9', label: 'format.wide' },
  { value: '9:16', label: 'format.upright' },
  { value: '1:1', label: 'format.square' },
  { value: '4:5', label: 'format.feed' },
];

/** A style's title and description in the app's language, where the style has them. */
export function styleText(style: Style, locale: string) {
  const own = style.translations[locale];
  return {
    title: own?.title ?? style.title,
    description: own?.description ?? style.description,
  };
}

/** Language codes for narration and on-screen words; the browser knows their names. */
export const FILM_LANGUAGES = ['de', 'en', 'fr', 'es', 'it', 'nl', 'pt', 'pl', 'ja'];
