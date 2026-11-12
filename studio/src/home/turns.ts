/**
 * The style cards' pictures take turns: one card at a time moves on to its next picture, in the
 * order of the page, so a row never changes all at once and the page keeps one calm rhythm.
 * Each picture stays nine seconds or more. Nothing turns while the page is hidden, on a card out
 * of view or under the pointer or the focus, or for people who asked for less motion.
 */

/** How long a card's picture stays, at least. */
export const STAY = 9000;
/** How long the next picture takes to fade in over the last. */
export const FADE = 1400;
/** The least time between two cards changing. */
const APART = 3500;

interface Card {
  /** The pictures' frame: what has to be in view. */
  frame: HTMLElement;
  /** The whole card: the pointer or the focus on it holds its picture. */
  card: Element;
  /** Whether the card has more than one picture. */
  ready: () => boolean;
  /** Moves on to the next picture; false when none is loaded yet. */
  next: () => boolean;
  seen: boolean;
}

const cards = new Set<Card>();
let last: Card | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let watcher: IntersectionObserver | null = null;

const lessMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const held = (card: Card) => card.card.matches(':hover, :focus-within');
const before = (a: Card, b: Card) =>
  a.frame.compareDocumentPosition(b.frame) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;

function stop() {
  clearTimeout(timer);
  timer = undefined;
}

function wait(delay: number) {
  stop();
  if (cards.size && !document.hidden) timer = setTimeout(turn, delay);
}

function turn() {
  const waiting = [...cards].filter((card) => card.seen && card.ready()).sort(before);
  const free = lessMotion() ? [] : waiting.filter((card) => !held(card));
  // The card after the one that moved last, round the page.
  const start = last ? free.findIndex((card) => before(last as Card, card) < 0) : 0;
  const order = start > 0 ? [...free.slice(start), ...free.slice(0, start)] : free;
  const moved = order.find((card) => card.next());
  if (moved) last = moved;
  wait(Math.max(APART, STAY / Math.max(waiting.length, 1)));
}

function onVisibility() {
  if (document.hidden) stop();
  else wait(APART);
}

/** Lets a card's pictures take part; returns what makes it leave again. */
export function join(frame: HTMLElement, ready: Card['ready'], next: Card['next']) {
  const card: Card = { frame, card: frame.closest('li') ?? frame, ready, next, seen: false };
  if (!cards.size) {
    document.addEventListener('visibilitychange', onVisibility);
    watcher = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          for (const known of cards)
            if (known.frame === entry.target) known.seen = entry.isIntersecting;
      },
      { threshold: 0.5 },
    );
    // The first change waits a whole stay, so every first picture is seen for a while.
    cards.add(card);
    wait(STAY);
  } else cards.add(card);
  watcher?.observe(frame);
  return () => {
    watcher?.unobserve(frame);
    cards.delete(card);
    if (last === card) last = null;
    if (!cards.size) {
      document.removeEventListener('visibilitychange', onVisibility);
      watcher?.disconnect();
      watcher = null;
      stop();
    }
  };
}
