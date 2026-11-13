/** Manifest types derive from the Rust-exported JSON Schema. */
import type { ClipType, Manifest } from './generated';
export type { Clip, ClipType, Manifest, Track, Transform } from './generated';
export interface Asset {
  path: string;
  name: string;
  kind: ClipType | 'other';
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnail?: string;
  waveform?: number[];
}
export interface Project {
  manifest: Manifest;
  revision: string;
  name: string;
  projectPath: string;
  previewUrl: string;
  token: string;
  assets: Asset[];
  canUndo?: boolean;
  canRedo?: boolean;
  production?: Production;
  fonts?: FontChoices;
}
/** What the film can take as its main font (`manifest.font`). */
export interface FontChoices {
  /** Declared by the film's own files, whatever its style. */
  film: string[];
  /** The tool's own, without the film's. */
  library: string[];
  /** The style's main font, kept while none is chosen. */
  style: string | null;
  /** Whether any scene takes the choice. */
  follows: boolean;
}
/** What the agent is producing, read from brief.md, preset.json and process/status.json. */
export interface Production {
  brief: {
    topic?: string;
    message?: string;
    seconds?: number;
    format?: string;
    language?: string;
    workflow?: string;
    preset?: string;
    stops: string[];
  } | null;
  preset: { name?: string; title?: string; description?: string } | null;
  skills: string[];
  references: string[];
  status: {
    step?: string;
    note?: string;
    steps?: { name: string; state?: 'done' | 'active' | 'todo' }[];
  } | null;
  latestLook?: { path: string; modified: number } | null;
  polish?: Polish | null;
  documents: { path: string; modified: number }[];
  activity: { path: string; modified: number }[];
  scenes: number;
  now: number;
}
/** A render, whoever started it: the agent's CLI or Export here. */
export interface LiveRender {
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'lost';
  stage: string;
  completed: number;
  total: number;
  fps: number;
  framesPerSecond: number | null;
  etaSeconds: number | null;
  startedAt: number;
  updatedAt: number;
  finishedAt: number | null;
  output: string;
  outputInProject: boolean;
  latestFrame: number | null;
  strip: number[];
  error: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: Record<string, any> | null;
}
export interface Live {
  render: LiveRender | null;
  /** `asks`: the command waits for the user, e.g. `recording` for their own voice. */
  running: { label: string; asks?: string | null; startedAt: number }[];
}
export interface Diagnostic {
  severity: string;
  code: string;
  message: string;
  path?: string;
  clipId?: string;
}
export interface PropDefinition {
  type: 'text' | 'number' | 'color' | 'boolean';
  default: string | number | boolean;
  label?: string;
  min?: number;
  max?: number;
}
/** A text prop where the paused preview shows it, in project pixels. */
export interface TextSpot {
  clipId: string;
  prop: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface RenderJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  stage: string;
  completed: number;
  total: number;
  output: string;
  error?: string;
}
/** One image of a polish pass and what the worksheet says about it so far. */
export interface PolishRow {
  file: string;
  kind: 'still' | 'cut' | 'move';
  time: number;
  closeUps: string[];
  verdict: 'ok' | 'kept' | 'defect' | 'open';
  said: string;
  fix: string;
}
/** The last look before a render: the latest pass and whether a clean one is on record. */
export interface Polish {
  pass: number;
  folder: string;
  capturing: boolean;
  /** Whether the polish is done for the picture as it is: `next-round` when a round is clean
   * and another is due. */
  record: {
    state: 'accepted' | 'next-round' | 'stale' | 'missing';
    pass?: number;
    round?: number;
    rounds?: number;
  };
  /** The round of the latest pass and how many the film gets; absent while it is captured. */
  round?: number;
  rounds?: number;
  rows?: PolishRow[];
  counts?: {
    listed: number;
    ok: number;
    kept: number;
    defects: number;
    open: number;
    settled: number;
  };
}
/** The start page: what is set up, the defaults, the styles and the films. */
export interface Tool {
  id: 'chrome' | 'ffmpeg' | 'earshot';
  title: string;
  ok: boolean;
  optional: boolean;
  /** Earshot: how many sounds its bank holds. */
  sounds?: number | null;
  /** The page to download it from. */
  get: string;
  /** The app can install it: a click opens the installer in a window of its own. */
  install: boolean;
  /** A command for a terminal that installs it, when the app cannot. */
  command?: string | null;
}
export interface KeyRow {
  name: 'GEMINI_API_KEY' | 'OPENROUTER_API_KEY' | 'GOOGLE_CLOUD_API_KEY' | 'OPENAI_API_KEY';
  title: string;
  recommended: boolean;
  present: boolean;
  /** `google`: no key, the user's Google sign-in (Google Cloud only). */
  source: 'app' | 'file' | 'environment' | 'google' | null;
  get: string;
  /** For few users: folded away in Setup until it holds a key. */
  more: boolean;
  /** The models this provider's key is used with by default; OpenAI's dictates and writes
   * styles, and makes no part of a film. */
  models: { voice?: string; timings?: string; music?: string; dictation: string; style: string };
  /** Google Cloud: where requests go. `fixed` when the environment or a .env file sets it. */
  place?: { project: string | null; location: string; servedIn: string; fixed: boolean };
  /** OpenAI: the region of its address. */
  region?: 'global' | 'eu';
  /** Google Cloud: a key, or a sign-in with a project. */
  ready?: boolean;
}
/** The models a film and a dictation use when the user names none. */
export interface UsualModels {
  narration: string;
  voice: string;
  transcription: string;
  music: string;
  dictation: string;
  /** What looks at reference pictures and writes a new style. */
  style: string;
}
/** A style that was made: its name among the styles, its title, and who wrote it. */
export interface MadeStyle {
  name: string;
  title: string;
  model: string;
  styles: Style[];
}
/** What a dictation came back as: the text, and the model and route that wrote it down. */
export interface Dictation {
  text: string;
  model: string;
  route: 'aiStudio' | 'openRouter' | 'googleCloud' | 'openAi';
}
/** What asking the provider about a saved key found. */
export interface KeyCheck {
  ok: boolean;
  state: 'none' | 'works' | 'partial' | 'refused';
  /** Models the key does not reach, with `partial`. */
  missing?: string[];
  /** US dollars left of the key's limit; null when it has none. OpenRouter only. */
  creditLeft?: number | null;
  /** The provider's answer, with `refused`. */
  detail?: string;
  /** Google Cloud: asked with the user's Google sign-in, not a saved key. */
  signIn?: boolean;
  /** Google Cloud, with `refused`: the project asked for and Google's reason. */
  project?: string | null;
  reason?: string | null;
  /** Google Cloud, with `refused` by a sign-in: its other projects that serve the models. */
  usable?: string[];
}
/** A coding agent that operates Superint Video once it has the skills. */
export interface Agent {
  id: string;
  title: string;
  found: boolean;
  ready: boolean;
  missing: string[];
  /** Skills that are there but are not the ones this app ships. */
  outdated: string[];
  /** How many skills there are in all. */
  skills: number;
  canInstall: boolean;
  get: string;
  /** It has Chrome DevTools MCP for every project: it can open web pages and take screenshots. */
  browser: boolean;
}
/** A voice a narration model takes by name, and Google's word for how it sounds. */
export interface Voice {
  name: string;
  sound?: string;
}
/** The voices of one family of narration models, and the one it speaks with unless chosen. */
export interface VoiceFamily {
  usual: string;
  voices: Voice[];
}
export interface Voices {
  gemini: VoiceFamily;
  elevenlabs: VoiceFamily;
}
export interface Settings {
  preset: string | null;
  projectsDir: string | null;
  window: 'app' | 'browser';
  follow: boolean;
  /** The language of the app itself; null follows the system. */
  uiLanguage: string | null;
  /** Models a pro chose; null keeps the usual ones. */
  narrationModel: string | null;
  narrationVoice: string | null;
  transcriptionModel: string | null;
  musicModel: string | null;
  dictationModel: string | null;
  styleModel: string | null;
  /** Google Cloud: the project (null: express mode) and its region (null: eu). */
  googleCloudProject: string | null;
  googleCloudLocation: 'eu' | 'us' | 'global' | null;
  /** OpenAI: null is global. */
  openAiRegion: 'global' | 'eu' | null;
  /** Rounds of polish the coding agent runs before a render, 1 to 3. */
  polishRounds: number;
}
export interface Style {
  name: string;
  title: string;
  description: string;
  /** Title and description in other languages, by language code. */
  translations: Record<string, { title?: string; description?: string }>;
  formats: string[];
  defaultFormat: string;
  seconds: number;
  language: string;
  voice?: string | null;
  music: boolean;
  own: boolean;
  /** Reference pictures, by file name. */
  references: string[];
  /** The pictures made for the style's card, by file name; empty for most of the user's own. */
  preview: string[];
}
export interface Film {
  id: string;
  name: string;
  /** The film's folder, for a prompt that names it. */
  path: string;
  createdAt: number;
  seenAt: number;
  exists: boolean;
  current: boolean;
  render?: { status: string; completed: number; total: number };
  /** Rendered, with the agent at the last step of its plan. */
  ready?: boolean;
  running?: string | null;
  step?: string | null;
  note?: string | null;
  picture?: number | null;
}
/** Where a shortcut to the app is: none, one that starts this app, one that starts another copy. */
export type ShortcutPlace = 'missing' | 'here' | 'elsewhere';
export interface Shortcut {
  /** The program a shortcut starts; null where there is none to start, as in an unpackaged build. */
  app: string | null;
  desktop: ShortcutPlace;
  startMenu: ShortcutPlace;
}

export interface Overview {
  version: string;
  home: string;
  project: { name: string | null } | null;
  token: string;
  setup: {
    tools: Tool[];
    /** The app on the desktop and in the Start menu. */
    shortcut: Shortcut;
    keys: KeyRow[];
    /** The `.env` file keys are read from, unencrypted; null when none are. Never a value. */
    envFile: string | null;
    can: {
      picture: boolean;
      /** A key reaches a TTS model: the AI voice. The user's own voice needs none. */
      voice: boolean;
      /** A key reaches a transcription model: word times are measured, not estimated. */
      timings: boolean;
      music: boolean;
      soundEffects: boolean;
      /** Any key, OpenAI's too: the start page can write down what is said. */
      dictate: boolean;
      /** Any key: a model can look at pictures and write a style. */
      style: boolean;
    };
    models: UsualModels;
    voices: Voices;
    /** The model a style would be written with now, and whose it is. */
    style: { model: string; provider: string } | null;
    agents: Agent[];
  };
  settings: Settings;
  /** This program, and whether an agent's shell finds it as `superint-video`. */
  cli: { path: string | null; onPath: boolean };
  /** Where a new film goes: the folder the user chose, else the usual one. */
  filmsFolder: string | null;
  styles: Style[];
  films: Film[];
}
