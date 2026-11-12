# Project format, version 1

`video.json` owns dimensions, FPS, tracks, timing, clip properties and audio placement. HTML files own scene structure, styles and animation. Studio writes the manifest; it does not rewrite scene JavaScript.

```text
project/
  video.json
  scenes/
  assets/
  renders/
  .superint/
```

Paths use forward slashes relative to the project root. Unicode and spaces are supported. Absolute paths, remote URLs, traversal, Windows device names and paths escaping through symlinks/junctions are rejected. HTML scene sources end in `.html` or `.htm`.

## Minimal manifest

```json
{
  "version": 1,
  "name": "Example",
  "width": 1920,
  "height": 1080,
  "fps": { "num": 30, "den": 1 },
  "durationFrames": 90,
  "tracks": [{ "id": "visuals", "kind": "visual" }],
  "clips": [{
    "id": "intro",
    "type": "scene",
    "src": "scenes/intro.html",
    "track": "visuals",
    "startFrame": 0,
    "durationFrames": 90,
    "props": { "title": "Example" }
  }]
}
```

[video.schema.json](video.schema.json) is generated from the Rust types. `superint-video schema` exports it. Studio's manifest types are generated from that schema by `scripts/generate-types.mjs`; its build rejects stale generated types. Schema validation covers shape and individual bounds; the Rust validator additionally checks references, timing relationships, source paths and finite numbers. Unknown fields are rejected.

## Project fields

| Field | Contract |
|---|---|
| `version` | Required, exactly `1`. Other versions are rejected. |
| `name` | Optional; default `Untitled`; at most 512 UTF-8 bytes. |
| `width`, `height` | Required integers, 1–8192 pixels. Use even values for H.264/yuv420p. |
| `fps` | Required positive integer `num` and `den`; ratio at most 240. Example: `30000/1001`. |
| `durationFrames` | Required positive integer, at most JavaScript's safe integer limit. |
| `background` | Optional `#RRGGBB` or `#RRGGBBAA`; default `#101113`. |
| `tracks` | Required nonempty array. IDs must be unique. |
| `clips` | Required array; may be empty. IDs must be unique. |

Track and clip IDs use 1–128 ASCII letters, digits, underscores or hyphens.

## Tracks and stacking

Track fields: `id`, `kind: "visual" | "audio"`, optional `name` (empty by default), `hidden` and `muted` (false by default).

Later visual tracks paint above earlier ones. Within a track, later clips in the `clips` array paint above earlier clips. Overlaps do not move or trim other clips. Gaps show the project background. Audio clips require audio tracks; scene/image/video clips require visual tracks.

Hidden tracks contribute neither imagery nor audio. Muted tracks silence audio while retaining imagery.

## Clips

| Field | Contract / default |
|---|---|
| `id`, `track` | Required stable clip ID and existing track ID. |
| `type` | Required: `scene`, `image`, `video` or `audio`. |
| `src` | Required project-relative source path. |
| `startFrame` | Required nonnegative project frame. |
| `durationFrames` | Required positive frame count. Clip end must not exceed project duration. |
| `sourceOffsetFrames` | Nonnegative offset in **project** frames; default `0`. |
| `props` | Scene instance values; object, default `{}`. |
| `transform` | `{ "x": 0, "y": 0, "scale": 1, "rotation": 0 }`. Coordinates are pixels; rotation is degrees. Scale must be positive; all values finite. |
| `opacity` | 0–1; default `1`. |
| `gain` | Linear amplitude multiplier, 0–16; default `1`. |
| `fadeInFrames`, `fadeOutFrames` | Nonnegative frame counts; default `0`. Each must fit inside the clip duration. |
| `hidden`, `muted` | Default `false`. Hidden suppresses imagery and audio; muted suppresses audio only. |
| `includeAudio` | Default `false`; video audio contributes only when enabled. Audio clips do not need this flag. |

Media must contain the entire requested source interval; sources are not silently looped, stretched or frozen. Video frames are selected by presentation timestamps. Export audio is resampled to 48 kHz, placed at the nearest sample, faded, summed without normalization, and padded/trimmed to the composition duration.

## Frame contract

For project frame `f`:

```text
time_seconds = f * fps.den / fps.num
active interval = [startFrame, startFrame + durationFrames)
source_frame = f - startFrame + sourceOffsetFrames
source_time_seconds = source_frame * fps.den / fps.num
```

`sourceOffsetFrames` never uses source-video frame numbering. Export evaluates `0` through `durationFrames - 1`. Studio's paused end position displays the last frame. A 30-frame clip at 30 FPS contains frames 0–29; the next clip can start at 30 without sharing a frame.

Each HTML instance has its own iframe and state. Animated scenes register one `defineScene({ props, ready, render })` function. `render` receives `{ frame, time, fps, width, height, props }`, with source-offset-local frame/time. Set the complete visual state from that frame; backward seeking must not depend on previous calls. See the [scene API](../skills/superint-video/references/scene-api.md).

## Editing operations

Studio sends `{ "revision": "…", "operation": { ... } }` to `/api/edit`. Operations are validated as a complete next manifest before saving. Each accepted operation is one undo step; a drag saves when its gesture completes.

| Operation | Fields / behavior |
|---|---|
| `updateClip` | `id`, `changes`; patches clip fields. `id` and `type` cannot change. Partial transforms merge; supplied `props` replaces the props object. |
| `splitClip` | `id`, `frame`; frame must be strictly inside the clip. Creates two new IDs and advances the second source offset continuously. |
| `duplicateClip` | `id`; creates a new ID immediately after the original in paint order, with identical timing. |
| `deleteClip` | `id`; removes the selected clip only. |
| `addClip` | `clip`; appends a valid clip. |
| `addTrack` | `track`; appends a valid track. |
| `updateTrack` | `id`, `changes`; edits `hidden`, `muted` or `name`. |
| `updateProject` | `changes`; edits name, dimensions, FPS, duration, background or the track array. |

A move changes `startFrame` only. A left trim from 10 to 20 advances `sourceOffsetFrames` by 10 and reduces duration by 10. A right trim changes duration only. The operation must include those fields explicitly; changing placement alone never changes source time.

Splitting preserves outer fades and creates no new fade at the cut. A split inside an existing fade is rejected because the current format cannot represent that truncated envelope without changing it. Shorten/remove that fade first.

`POST /api/history` accepts `{ "revision": "…", "action": "undo" | "redo" }`. History holds up to 100 edits in the running Studio session and is not written to the project.

## Persistence and render inputs

Manifest saves use a synced temporary file and atomic replacement, including on Windows. Revision checks include scene and asset content. Stale mutations return HTTP 409; invalid edits leave the current file intact. Invalid external JSON is preserved rather than overwritten with an older valid manifest.

External changes reload valid content and clear undo/redo. Writes made by unrelated programs are not part of a shared filesystem transaction; a small check/write race remains. A read-back check detects replacement during saving.

Top-level `.superint`, `renders`, `.git`, `node_modules` and `target` are normally excluded from revisions and render snapshots. A directory explicitly referenced by a clip is treated as input even if it has an excluded name. Nested source directories and local scene dependencies are copied. Do not place authored files under the reserved `.superint-write-` temporary prefix.

Rendering copies inputs into an owned temporary directory and compares content revisions before copying, after copying and against the frozen copy. Edits during preparation reject the snapshot. Later edits cannot change an active render. Temporary snapshots are removed when their owner finishes.

Use `renders/` for exports and inspection files. Assets copied by Studio import are new project content and therefore invalidate pre-import revisions and undo history. Importing a file and inserting its clip are separate operations.
