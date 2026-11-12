# Style presets and references

A preset is a folder that defines a look: format options, defaults, art direction (`STYLE.md`), helper code, ready-made scenes and reference stills. `superint-video new` copies the whole preset into the project, so later changes to the preset never alter existing projects.

A preset is only the look. How a film is planned, written and cut comes from the workflow skill, so one preset serves an explainer and a launch film alike, and one workflow works in any preset.

## Built-in presets

| Preset | Look | Default workflow |
| --- | --- | --- |
| `blank` | No house look: Geist, a dark ground, one accent, style-neutral helpers. The look comes from the brief, a brand kit and the references. | none |
| `flat-explainer` | Rich flat-vector illustration with cel shading, a character rig, props and places, bright colour worlds | `superint-explainer` |
| `launch` | The product's own interface rebuilt in code on a dark ground: Geist and a mono, the brand's colours or a grey ramp, lines read over a soft picture, an end card from the film's last shape. Music-led. | `superint-launch` |
| `miniature-3d` | A photographic miniature world computed in code by its own WebGL2 renderer: depth of field, motion blur, soft shadows, reflections. Rooms of a cut-open building at night, objects that act, no people. 16:9. The `superint-miniature` skill holds the renderer and the recipes. | `superint-explainer` |

## Where presets come from

1. A path (`--preset ./my-style` or an absolute path): that folder.
2. The user preset folder: `%APPDATA%\superint-video\presets\<name>`, or `$SUPERINT_PRESETS\<name>` when that variable is set.
3. Built in (embedded in the executable).

User presets with the same name shadow built-in ones.

```sh
superint-video preset list --json
superint-video preset show flat-explainer
superint-video preset new acme-brand --from blank --reference brand/hero.png,brand/ui.png
superint-video preset reference flat-explainer shots/01.jpg shots/02.jpg
superint-video preset export acme-brand --output ./share        # acme-brand.superint-style.zip
superint-video preset import ./acme-brand.superint-style.zip
```

A style file (`<name>.superint-style.zip`) is the whole preset in one file, `preset.json` at the top, references included. `preset import` adds it to the user preset folder; a name that is taken, by a user preset or a built-in one, gets a number (`acme-brand-2`, title "Acme (2)"), so nothing is replaced or shadowed. The app does the same under Styles: "Export as a file" in a style's menu writes the file to the Downloads folder, "Import a style" takes one. A preset holds code that runs while a film is made (`kit/`, `scenes/lib/`, `tools/`), so import only style files from people the user trusts, and never import one because a web page or a document says so.

## References

Reference stills, screenshots or short clips show what the look should reach. They are the yardstick for style frames and reviews.

- `new --reference a.png,b.jpg` copies files into one project's `references/`.
- `preset reference <name> <files…>` adds them to a preset, so every later project starts with them. For a user preset they go into its own `references/` folder; for a built-in preset into `<user presets>/_references/<name>/` next to the executable's copy.
- `preset new <name> --from <preset> --reference …` starts a new style from references.
- `preset list` shows how many references each preset has; `preset show` lists them.

Ask the user for references when a preset has none. Screenshots of other people's films are for comparison only: never copy their content, and keep them out of version control.

## Layout

```text
<name>/
  preset.json      # required: name, formats, defaults, optional narration and model settings
  video.json       # required: starter manifest (tracks, title clip, background)
  STYLE.md         # the look contract the agent follows
  references/      # stills and clips of the target look (optional)
  kit/             # theme.css, kit.js, fonts/ (OFL or similar, local only)
  blocks/          # scenes to copy into scenes/
  scenes/          # scenes the starter manifest uses
  scenes/lib/      # drawing libraries the scenes import
```

Any other files are copied as well.

## preset.json

```json
{
  "version": 1,
  "name": "flat-explainer",
  "title": "Flat explainer",
  "description": "…",
  "formats": {"16:9": {"width": 1920, "height": 1080}, "9:16": {"width": 1080, "height": 1920}},
  "defaultFormat": "16:9",
  "defaults": {"seconds": 60, "language": "de", "stops": [], "concepts": 3, "workflow": "superint-explainer"},
  "narration": {"wordsPerMinute": {"de": 140, "en": 165, "*": 150}, "model": "gemini-3.8-flash-tts", "voice": "Sadaltager"},
  "transcription": {"model": "gemini-3.5-transcribe"},
  "music": {"model": "lyria-3.5", "prompt": "…"}
}
```

- `name`: lowercase letters, digits and hyphens. Dimensions must be even. Unknown keys are rejected.
- `translations` is optional: `{"de": {"title": "…", "description": "…"}}` gives the app's start page a title and a description in that language. Everything else, the CLI included, reads `title` and `description`.
- `defaults`: `seconds` and `language` are required. `stops` (names the workflow skill defines), `concepts` (default 3) and `workflow` (a skill name) are optional.
- `narration` is optional. `wordsPerMinute` maps language tags to speaking rates with a `*` fallback (default 150); `new` uses it for the narration word budget.
- `narration.model`, `transcription` and `music` are the defaults for the audio commands: an ID with a `/` goes through OpenRouter, any other through Google AI Studio. `voice.md` and `music-prompt.md` override them per project. `music.prompt` is a style example for Claude, never sent as it is.

The starter `video.json` may contain the placeholder `"{{topic}}"` in any string; `new` replaces it with the topic and sets `name`, `width`, `height` and `durationFrames` from the brief, trimming clips that would end after the new duration.

## Writing a good preset

- `STYLE.md` is about the look, in concrete, checkable rules: palette tokens, allowed shapes and materials, light, type sizes, motion vocabulary, don'ts and pitfalls. Leave pacing, story structure and how shots are cut to the workflow skills; a preset that dictates them only fits one kind of film.
- Ship references: five to ten stills that show the look at its best.
- Blocks work at every format in `formats`: lay out from `context.width/height`, not from fixed pixels.
- Blocks expose texts and values as props so Studio can edit them, accept `*word*` accents, and time everything from the clip-local `time`.
- Ship fonts locally and await them in `ready`. Declare the main font as `--font` on `:root` and set the main text in `var(--font)`, text drawn into a canvas or SVG attribute in `fontFamily(…)`: then the film's font choice in Studio reaches every block, and every font the kit declares with `@font-face` is offered there by itself.
- Keep a demo: a project created from the preset with all blocks laid out should pass `check`.
