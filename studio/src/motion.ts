/**
 * The few movements the page makes itself. Everything else is a CSS transition in `style.css`.
 * Nothing moves for people who asked their system for less motion.
 */
import { cubicOut } from 'svelte/easing';
import { readable } from 'svelte/store';
import { slide, type TransitionConfig } from 'svelte/transition';

type Direction = { direction?: 'in' | 'out' | 'both' };

const LESS_MOTION = '(prefers-reduced-motion: reduce)';
const still = () => matchMedia(LESS_MOTION).matches;

/** Whether the system asks for less motion, kept current while the page is open. */
export const lessMotion = readable(false, (set) => {
  const query = matchMedia(LESS_MOTION);
  const change = () => set(query.matches);
  change();
  query.addEventListener('change', change);
  return () => query.removeEventListener('change', change);
});

/** A section that opens below its heading; it closes a little faster than it opens. */
export function unfold(node: Element, _: unknown, { direction }: Direction): TransitionConfig {
  if (still()) return { duration: 0 };
  return slide(node, { duration: direction === 'out' ? 180 : 240, easing: cubicOut });
}

/** A mark that confirms something just got done: it settles once, without a bounce. */
export function settle(_: Element): TransitionConfig {
  if (still()) return { duration: 0 };
  return {
    duration: 220,
    easing: cubicOut,
    css: (t) => `opacity: ${t}; transform: scale(${0.6 + 0.4 * t})`,
  };
}
