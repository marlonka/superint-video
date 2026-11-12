# Studio

Svelte 5, TypeScript, Vite. Static output is embedded in the Rust executable.
No Node runtime, package installation, network fonts, analytics, or cloud endpoints are needed by a video project.

```powershell
cd studio
npm ci
npm run check
npm run build
cd ..
cargo build
```

Serve the embedded build with `superint-video studio <project>`; `new` and `render` start it detached and write its address to `.superint/studio.json`, so a project has one instance. A render, whoever started it, reports through `.superint/live/`, and `RenderLive.svelte` shows it in place of the preview. The Vite dev command is for source development; the integrated Rust server is the verified runtime. Its strict origin checks mean mutation requests must use the Studio origin served by Rust.

`Shell.svelte` decides what the page is: with a project it mounts the editor (`App.svelte`) and lays the start page (`Home.svelte`) over it when the logo is clicked; without one (`superint-video app`) it mounts the start page alone. The start page asks `/api/app` every few seconds while it is visible and follows a film the coding agent has just created. Its parts live in `src/home/` (`Setup`, `Composer`, `Films`, `Defaults`) and share one state in `session.ts`. Every line of Setup is a `SetupItem`: mark, text and one action in the same three columns, so they line up down the page.

Motion is CSS transitions in `src/style.css` (pressed buttons, menus, dialogs, the toast) plus two Svelte transitions in `src/motion.ts` (a section that unfolds, a check mark that settles). Entrances take 180 to 240 ms and ease out, exits are shorter, nothing bounces, and nothing moves under `prefers-reduced-motion`.

## Languages

The page speaks German and English. `src/i18n/en.ts` is the source catalog; `de.ts` is typed against it, so a missing or extra key fails `npm run check`. Use `$t('key', {values})` for every visible text and accessible name, and `$format` for numbers, percentages, times, lists and language names (all from the browser's `Intl`, so each language writes them its own way). A message with a count is an object of plural forms (`{one, other}`), chosen by `Intl.PluralRules`. Never build a sentence from fragments: one key per sentence, with `{placeholders}`.

- A new text: add the key to `en.ts`, then to `de.ts`.
- A new language: add a catalog, register it in `LOCALES` and `CATALOGS` in `src/i18n/index.ts`, and in `UI_LANGUAGES` in `src/home.rs`.
- The server sends ids and facts; the page holds the words. Texts the coding agent writes (step notes, polish findings) and the tool's error messages are shown as written.

The language follows the system until the user chooses one; the choice is the setting `uiLanguage`, so every Studio window agrees.

## Editing

- **Media** opens the searchable file library. **Import files** or a file drop copies assets into the project; **Add** inserts an asset at the playhead. Video/audio metadata determines the initial clip duration.
- Select a timeline clip to open its inspector. Scene properties appear first, followed by exact frame timing and the clip's applicable controls. Additional source and transform controls are grouped in expandable sections. Edit arbitrary scene code in its source file.
- Drag a clip to move it; drag its edges to trim. A completed gesture is one edit and one undo step. Scrub the ruler to move the playhead while preserving selection. Timeline zoom and **Whole film** change the visible time range; **Zoom** next to the transport scales the preview independently (**Whole picture** fits it).
- Project settings contain dimensions, duration, background and project location. Rename the project in the header. Text and number fields save when focus leaves them; Enter commits a single-line field and Ctrl/Cmd+Enter commits a multiline field.
- **More actions** contains **Copy context**, **Check project**, **Findings**, **Keyboard shortcuts**, the dark/light theme switch and the language. Copied context includes the revision, selected source/props, frame and diagnostics for use with an agent.
- **Export** offers Draft/Final quality, an output path relative to the project, explicit replacement of an existing file, progress, cancellation and **Open video** after completion.
- Theme choice is remembered locally. Media and inspector panels can close; panel dividers and timeline height support pointer and arrow-key resizing.

Keyboard shortcuts apply outside text fields and native controls:

| Action                                   | Shortcut                              |
| ---------------------------------------- | ------------------------------------- |
| Play / pause                             | Space                                 |
| Step one / ten frames                    | Left or Right / Shift + Left or Right |
| First / last frame                       | Home / End                            |
| Move selected clip one frame             | Alt + Left or Right                   |
| Trim selected clip end one frame         | Alt + Shift + Left or Right           |
| Split / duplicate / delete selected clip | S / D / Delete                        |
| Toggle snapping                          | N                                     |
| Undo / redo                              | Ctrl/Cmd + Z / Ctrl/Cmd + Shift + Z   |
| Close the active menu, dialog or panel   | Escape                                |

Menus support arrow keys and Home/End. Dialogs contain keyboard focus and return it to an available opener when closed.

Server revisions protect every edit and undo operation. A stale edit shows a conflict and offers a local recovery JSON download. Reloading fetches disk state. An external valid change preserves the playhead and surviving selection.

The player iframe runs on the separate read-only preview origin. Both sides check the message origin and sender. The Studio capability stays out of preview messages and URLs.

## Checks

`npm run check` checks TypeScript and Svelte accessibility diagnostics. `npm run build` compiles production assets. `npm run format:check` verifies source formatting.

`npm run verify:api` exercises real HTTP editing, security, import collisions, persistence, and external-change recovery using a separate temporary project and its owned local server. Build the Rust executable first, or pass its path with `npm run verify:api -- <executable>`.

UI acceptance requires the real Rust server and player; a mocked frontend response is not evidence for file persistence, media correctness, or render completion.

Dependencies are pinned in `package.json` and `package-lock.json`. CI uses Node.js 26.13.1 LTS and npm 12.2.2. Svelte Check uses the native TypeScript 7 compiler and still requires TypeScript 6 for its JavaScript API.

Design source attribution, product decisions and redesign acceptance results are tracked in [docs/REDESIGN.md](../docs/REDESIGN.md).

Manifest types in `src/generated.ts` are generated from `docs/video.schema.json`, exported by Rust. Run `npm run types:generate` after updating that schema. Typecheck and production build reject stale generated types. The generator has no third-party dependencies; HTTP response envelopes remain in `src/types.ts`.
