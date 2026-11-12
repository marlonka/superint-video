/**
 * What both ways of recording a voice share: the state the server keeps, the countdown before
 * a take, and the words for a microphone that did not start.
 */
import type { Translate } from '../i18n';
import { MicrophoneError } from '../home/recorder';

/** What the clean-up noticed about a recording; each is a reason to record it again. */
type TakeNote = 'clipped' | 'quiet' | 'noisy';

export interface Take {
  seconds: number;
  notes: TakeNote[];
}

export interface ScriptParagraph {
  paragraph: number;
  text: string;
  /** `stale`: recorded, but the text changed since. */
  state: 'empty' | 'draft' | 'accepted' | 'stale';
  accepted: Take | null;
  draft: Take | null;
}

/** The voice of a film as `/api/voice` tells it. */
export interface VoiceState {
  /** The paragraphs of `voice.md`; null when the film has no voice text. */
  script: {
    source: 'ai' | 'own';
    paragraphs: ScriptParagraph[];
    recorded: number;
    total: number;
    complete: boolean;
    /** `measured`: a transcription model hears the recordings and times every word. */
    timing: 'measured' | 'estimated';
    transcription: string | null;
  } | null;
  /** Why `voice.md` could not be read. */
  problem: string | null;
  /** A take spoken over the picture that waits to be kept. */
  over: (Take & { startFrame: number }) | null;
  /** The script's paragraphs with the second of the film they begin at, where known. */
  cues: { paragraph: number; text: string; seconds: number | null }[];
}

/** Counts in before a take: 3, 2, 1. */
const COUNT_FROM = 3;
const COUNT_STEP_MS = 800;

/**
 * Counts down, telling `show` every number. Resolves false when `signal` gave up meanwhile.
 */
export function countdown(show: (left: number) => void, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    let left = COUNT_FROM;
    show(left);
    const timer = setInterval(() => {
      left -= 1;
      if (left > 0) return show(left);
      clearInterval(timer);
      resolve(!signal.aborted);
    }, COUNT_STEP_MS);
    signal.addEventListener('abort', () => {
      clearInterval(timer);
      resolve(false);
    });
  });
}

/** Why the microphone did not start, in the user's words. */
export function microphoneProblem(cause: unknown, say: Translate): string {
  if (cause instanceof MicrophoneError) {
    return cause.problem === 'other'
      ? say('dictate.problem.other', { detail: cause.message })
      : say(`dictate.problem.${cause.problem}`);
  }
  return cause instanceof Error ? cause.message : String(cause);
}

/** Audio the tool reads; the browser's file dialog offers these first. */
export const AUDIO_FILES = 'audio/*,.mp3,.wav,.m4a,.ogg,.oga,.webm,.flac,.aac';

/** Someone is typing or choosing: keys belong to that control, not to the recorder. */
export function typing(event: KeyboardEvent): boolean {
  const target = event.target;
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}
