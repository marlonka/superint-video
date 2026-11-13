/**
 * The app's languages. Texts live in one catalog per language (`en.ts` is the source), numbers,
 * dates, lists and language names come from the browser's `Intl`, so each language writes them
 * its own way. `$t('key', {values})` and `$format` follow the chosen language at once.
 */
import { derived, writable, type Readable } from 'svelte/store';
import { de } from './de';
import { en } from './en';
import type { Catalog, MessageKey } from './types';

export type { MessageKey } from './types';

export const LOCALES = [
  { code: 'de', name: 'Deutsch' },
  { code: 'en', name: 'English' },
] as const;
export type Locale = (typeof LOCALES)[number]['code'];
type Values = Record<string, string | number>;

const CATALOGS: Record<Locale, Catalog> = { de, en };
const STORAGE = 'superint-language';

export const isLocale = (value: unknown): value is Locale =>
  LOCALES.some((entry) => entry.code === value);

/** Whether the app has words for this key, as for a failure the server names by a code. */
export const hasMessage = (key: string): key is MessageKey => Object.hasOwn(en, key);

/** The first language of the browser that the app speaks; English otherwise. */
function systemLocale(): Locale {
  for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    const code = tag.toLowerCase().split('-')[0];
    if (isLocale(code)) return code;
  }
  return 'en';
}

function remembered(): Locale | null {
  try {
    const saved = localStorage.getItem(STORAGE);
    return isLocale(saved) ? saved : null;
  } catch {
    return null;
  }
}

/** What the user chose; null follows the system. */
const preference = writable<Locale | null>(remembered());
export const locale: Readable<Locale> = derived(preference, (chosen) => chosen ?? systemLocale());

/** Sets the language of the app on this page and remembers it for the next start. */
export function chooseLocale(next: Locale | null) {
  preference.set(next);
  try {
    if (next) localStorage.setItem(STORAGE, next);
    else localStorage.removeItem(STORAGE);
  } catch {
    /* The choice still holds for this page. */
  }
}

locale.subscribe((code) => {
  document.documentElement.lang = code;
});

/** What the browser knows about writing one language; built once per language. */
function conventions(code: Locale) {
  return {
    plural: new Intl.PluralRules(code),
    number: new Intl.NumberFormat(code),
    percent: new Intl.NumberFormat(code, { style: 'percent', maximumFractionDigits: 0 }),
    relative: new Intl.RelativeTimeFormat(code, { numeric: 'auto' }),
    clock: new Intl.DateTimeFormat(code, { hour: '2-digit', minute: '2-digit' }),
    date: new Intl.DateTimeFormat(code, { dateStyle: 'medium' }),
    and: new Intl.ListFormat(code, { type: 'conjunction' }),
    or: new Intl.ListFormat(code, { type: 'disjunction' }),
    languages: new Intl.DisplayNames(code, { type: 'language' }),
  };
}
const cache = new Map<Locale, ReturnType<typeof conventions>>();
function of(code: Locale) {
  let known = cache.get(code);
  if (!known) cache.set(code, (known = conventions(code)));
  return known;
}

function translate(code: Locale, key: MessageKey, values: Values = {}): string {
  const message = CATALOGS[code][key];
  const text =
    typeof message === 'string'
      ? message
      : (message[of(code).plural.select(Number(values.count))] ?? message.other);
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = values[name];
    if (value === undefined) return placeholder;
    return typeof value === 'number' ? of(code).number.format(value) : value;
  });
}

export type Translate = (key: MessageKey, values?: Values) => string;
export const t: Readable<Translate> = derived(
  locale,
  (code) => (key: MessageKey, values?: Values) => translate(code, key, values),
);

export interface Formats {
  /** 1,234.5 or 1.234,5; `digits` fixes the decimals. */
  number(value: number, digits?: number): string;
  /** A share of one as a percentage: 0.45 is "45%" or "45 %". */
  percent(share: number): string;
  /** How long ago a moment was: "just now", "5 minutes ago", "yesterday", then the date. */
  ago(moment: number, now: number): string;
  /** The time of day of a moment. */
  clock(moment: number): string;
  /** "a, b and c". */
  and(items: string[]): string;
  /** "a, b or c". */
  or(items: string[]): string;
  /** The name of a language by its code: "German" or "Deutsch" for `de`. */
  language(code: string): string;
  /** An amount of US dollars. */
  dollars(amount: number): string;
}

function formats(code: Locale): Formats {
  const known = of(code);
  return {
    number: (value, digits) =>
      digits === undefined
        ? known.number.format(value)
        : value.toLocaleString(code, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
          }),
    percent: (share) => known.percent.format(share),
    ago(moment, now) {
      const seconds = Math.max(0, Math.round((now - moment) / 1000));
      if (seconds < 45) return translate(code, 'time.justNow');
      const minutes = Math.round(seconds / 60);
      if (minutes < 60) return known.relative.format(-minutes, 'minute');
      const hours = Math.round(minutes / 60);
      if (hours < 24) return known.relative.format(-hours, 'hour');
      const days = Math.round(hours / 24);
      if (days < 7) return known.relative.format(-days, 'day');
      return known.date.format(moment);
    },
    clock: (moment) => known.clock.format(moment),
    and: (items) => known.and.format(items),
    or: (items) => known.or.format(items),
    language(tag) {
      try {
        return known.languages.of(tag) || tag;
      } catch {
        return tag;
      }
    },
    dollars: (amount) => amount.toLocaleString(code, { style: 'currency', currency: 'USD' }),
  };
}
export const format: Readable<Formats> = derived(locale, formats);

/** A film length as people say it in a row of facts: "45 s", "1 min", "1 min 30 s". */
/** Film time in minutes and seconds, the same in every language: `1:05`. */
export function filmClock(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function lengthLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return seconds % 60 ? `${minutes} min ${seconds % 60} s` : `${minutes} min`;
}
