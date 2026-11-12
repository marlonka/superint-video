/** The choices the start page offers for a film: lengths, picture formats and languages. */
import type { MessageKey } from '../i18n';
import type { Style } from '../types';

/** Seconds. A guide: the film is as long as its narration needs. */
export const LENGTHS = [15, 30, 45, 60, 90, 120, 180, 300];

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
