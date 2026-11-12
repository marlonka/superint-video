import type { en } from './en';

/** A text, or one text per plural form of the language (`other` is the fallback). */
export type Message = string | ({ other: string } & Partial<Record<Intl.LDMLPluralRule, string>>);
/** English is the source: every other language has exactly its keys. */
export type MessageKey = keyof typeof en;
export type Catalog = Record<MessageKey, Message>;
