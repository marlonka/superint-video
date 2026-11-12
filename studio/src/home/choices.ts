/** The choices the start page offers for a film: lengths, picture formats and languages. */
import type { MessageKey } from '../i18n';
import type { Style } from '../types';

/** Suggested lengths in seconds. A guide: the film is as long as its narration needs. */
export const LENGTHS = [15, 30, 45, 60, 90, 120, 180, 300, 600, 900, 1200, 1800, 2700, 3600];
/** The longest film the tool makes, in seconds (`new --seconds`). */
const MOST_SECONDS = 3600;

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

/** The picture formats; a new film is wide unless someone picks another. */
export const FORMATS: { value: string; label: MessageKey }[] = [
  { value: '16:9', label: 'format.wide' },
  { value: '9:16', label: 'format.upright' },
  { value: '1:1', label: 'format.square' },
  { value: '4:5', label: 'format.feed' },
];
export const USUAL_FORMAT = '16:9';

/** A style's title and description in the app's language, where the style has them. */
export function styleText(style: Style, locale: string) {
  const own = style.translations[locale];
  return {
    title: own?.title ?? style.title,
    description: own?.description ?? style.description,
  };
}

/**
 * Language codes for narration and on-screen words: the languages the speaking models read
 * well. The browser knows their names in every language of the app.
 */
export const FILM_LANGUAGES = [
  'ar', 'bg', 'bn', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fa', 'fi', 'fil', 'fr',
  'he', 'hi', 'hr', 'hu', 'id', 'it', 'ja', 'ko', 'lt', 'lv', 'mr', 'ms', 'nb', 'nl', 'pl',
  'pt', 'ro', 'ru', 'sk', 'sl', 'sr', 'sv', 'sw', 'ta', 'te', 'th', 'tr', 'uk', 'ur', 'vi',
  'zh',
]; // prettier-ignore

/** Scripts and the language they stand for; where several share one, `withinScript` decides. */
const SCRIPTS: [RegExp, string][] = [
  [/[\p{Script=Hiragana}\p{Script=Katakana}]/u, 'ja'],
  [/\p{Script=Han}/u, 'zh'],
  [/\p{Script=Hangul}/u, 'ko'],
  [/\p{Script=Thai}/u, 'th'],
  [/\p{Script=Bengali}/u, 'bn'],
  [/\p{Script=Tamil}/u, 'ta'],
  [/\p{Script=Telugu}/u, 'te'],
  [/\p{Script=Greek}/u, 'el'],
  [/\p{Script=Hebrew}/u, 'he'],
  [/\p{Script=Devanagari}/u, 'hi'],
  [/\p{Script=Arabic}/u, 'ar'],
  [/\p{Script=Cyrillic}/u, 'ru'],
  [/\p{Script=Latin}/u, 'latin'],
];

/** The small words a sentence cannot do without, for the languages written in Latin letters. */
const WORDS: Record<string, string> = {
  en: 'the and of to is are why how what with for this that it about from can does will you your we our they be was should which when would',
  de: 'der die das und ist sind nicht ein eine einen wie warum was mit für über auf zu von im sich es wir ich man dass wird werden kann auch den dem des bei oder wenn sollte unsere',
  fr: 'le la les et est sont une un des du de pour pourquoi comment que qui dans sur avec pas ce cette il nous vous au aux ne se',
  es: 'el los las y es son una un de por qué cómo porque para con del que en se no lo su sus este esta muy',
  it: 'il lo gli le e è sono una un di perché come che del della per con non si nel alla questo questa',
  pt: 'o os as e é são uma um de por porque como que do da dos das para com não no na em isso este esta você',
  nl: 'de het een en is zijn waarom hoe wat van met voor op niet dat die je we ook naar bij wordt kan',
  pl: 'i w na z jest są nie się jak dlaczego co to do że o dla czy jego od po',
  cs: 'je jsou se na v z že jak proč co to pro není nebo který která které jako do',
  sk: 'je sú sa na v z že ako prečo čo to pre nie alebo ktorý ktorá ktoré aj do',
  sv: 'och är att det en ett som på för med inte varför hur vad av till den om vi jag',
  da: 'og er at det en et som på for med ikke hvorfor hvordan hvad af til den om vi jeg mig nu',
  nb: 'og er at det en et som på for med ikke hvorfor hvordan hva av til den om vi jeg meg nå',
  fi: 'ja on ei se että miksi miten mitä kuin ovat oli tai kun mutta tämä myös hän',
  hu: 'az és hogy nem egy miért hogyan mi van vagy ez is meg már csak',
  ro: 'și este sunt nu un o de la cu în pe din ce care cum pentru mai sau',
  tr: 've bir bu için ile neden nasıl ne da de değil mi çok gibi olan daha',
  id: 'dan yang di ini itu untuk dengan tidak mengapa bagaimana apa adalah ke dari akan bisa kita',
  vi: 'và là của có không một những các tại sao như thế nào cho với được trong',
  hr: 'i je su u na se da za kako zašto što nije ili koji od to',
  ca: 'el la els les i és són per què com amb no del de que un una aquest aquesta',
};
const WORD_SETS = Object.entries(WORDS).map(
  ([code, words]) => [code, new Set(words.split(' '))] as const,
);
/** Letters that point to one language among those written in Latin letters. */
const LETTERS: [RegExp, string][] = [
  [/ß/u, 'de'],
  [/[ñ¿¡]/u, 'es'],
  [/[ãõ]/u, 'pt'],
  [/œ/u, 'fr'],
  [/[łąęśźżń]/u, 'pl'],
  [/[řůě]/u, 'cs'],
  [/[ľĺŕ]/u, 'sk'],
  [/[őű]/u, 'hu'],
  [/[ășț]/u, 'ro'],
  [/[ğı]/u, 'tr'],
  [/[ơưđạảấầậắằặẹẻẽếềệỉịọỏốồộớờợụủứừựỳỵỷỹ]/u, 'vi'],
];

/**
 * The language a topic is written in, guessed from its script and its small words; null when
 * the text does not say clearly. The agent reads the topic itself, so a null only means the
 * prompt asks it to keep to the topic's language without naming it.
 */
export function topicLanguage(topic: string): string | null {
  // The start of a long, dictated topic says as much as all of it.
  const text = topic.slice(0, MOST_READ);
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length < 3) return null;
  let script = '';
  let most = 0;
  for (const [pattern, code] of SCRIPTS) {
    const count = letters.filter((letter) => pattern.test(letter)).length;
    if (count > most) [script, most] = [code, count];
  }
  return script === 'latin' ? latin(text) : withinScript(script, text);
}

/** How much of a topic is read to tell its language. */
const MOST_READ = 600;
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const BULGARIAN = new Set(['това', 'от', 'са', 'като', 'ще', 'защо', 'какво', 'тази', 'но']);

/** The language within a script that several share, by the letters or words only it uses. */
function withinScript(script: string, text: string): string {
  switch (script) {
    // Japanese writes Chinese characters too, between its kana.
    case 'zh':
      return KANA.test(text) ? 'ja' : 'zh';
    case 'hi':
      return /ळ|आहे|आणि|च्या/u.test(text) ? 'mr' : 'hi';
    case 'ar':
      return /[ٹڈڑںےھ]/u.test(text) ? 'ur' : /[پچژگکی]/u.test(text) ? 'fa' : 'ar';
    case 'ru':
      if (/[іїєґ]/u.test(text)) return 'uk';
      if (/[ђјљњћџ]/u.test(text)) return 'sr';
      // ы and э are Russian; a few small words are Bulgarian.
      if (/[ыэ]/u.test(text)) return 'ru';
      return words(text).filter((word) => BULGARIAN.has(word)).length >= 2 ? 'bg' : 'ru';
    default:
      return script;
  }
}

/** Among the languages written in Latin letters: the one with most small words and letters. */
function latin(text: string): string | null {
  const found = words(text);
  const lettered = new Set(
    LETTERS.filter(([pattern]) => pattern.test(text)).map(([, code]) => code),
  );
  const scores = WORD_SETS.map(
    ([code, set]) =>
      [code, found.filter((word) => set.has(word)).length + (lettered.has(code) ? 2 : 0)] as const,
  ).sort((a, b) => b[1] - a[1]);
  const [first, second] = scores;
  return first[1] > 0 && first[1] > second[1] ? first[0] : null;
}

function words(text: string) {
  return text.toLowerCase().match(/\p{L}+/gu) ?? [];
}
