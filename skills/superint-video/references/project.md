# Project format v1

The installed/repository JSON Schema is authoritative for structural validation.
Use project-relative paths and keep referenced files inside the project directory.
All frames are integer project frames. FPS is a rational `{num,den}`.

```json
{
  "version":1,
  "name":"Example",
  "width":1920,
  "height":1080,
  "fps":{"num":30,"den":1},
  "durationFrames":150,
  "background":"#111413",
  "font":"Fraunces",
  "tracks":[{"id":"visuals","kind":"visual","name":"Scenes"}],
  "clips":[{
    "id":"intro","type":"scene","src":"scenes/intro.html","track":"visuals",
    "startFrame":0,"durationFrames":150,"sourceOffsetFrames":0,
    "props":{"title":"Superint Video"}
  }]
}
```

Track kinds: `visual`, `audio`. Optional track fields: `name`, `hidden:false`, `muted:false`.
Clip types: `scene`, `image`, `video`, `audio`.
Scene/image/video clips use visual tracks; audio clips use audio tracks.
IDs are stable; source files may be reused by multiple clips.

Optional clip fields and defaults:

| Field | Default | Meaning |
|---|---|---|
| `sourceOffsetFrames` | `0` | Project frames trimmed from source start |
| `props` | `{}` | Scene instance property overrides |
| `transform.x`, `transform.y` | `0` | Translation in composition pixels |
| `transform.scale` | `1` | Uniform scaling around composition center |
| `transform.rotation` | `0` | Degrees clockwise around center |
| `opacity` | `1` | Visual opacity |
| `fadeInFrames`, `fadeOutFrames` | `0` | Linear visual/audio fade length |
| `gain` | `1` | Linear audio amplitude; `0` is silent |
| `hidden` | `false` | Disable visual and audio contribution |
| `muted` | `false` | Disable audio contribution |
| `includeAudio` | `false` | Enable a video clip's embedded audio |

Images/videos fit inside the composition with `object-fit:contain`.
Transform applies to that composition-sized layer.
Later tracks draw above earlier tracks. Array order breaks ties within a track.
Gaps show `background`. Use overlapping clips and opacity fades for crossfades.
`font` (optional) is the film's main font, a family the film's files declare or one of the tool's library; scenes take it through `var(--font)`. Leave it out to keep the style's. Change it with `superint-video fonts <dir> <family>`, which checks the name.

For project frame `f`, an active clip's local frame is:

```text
f - startFrame + sourceOffsetFrames
```

The active interval is `[startFrame, startFrame + durationFrames)`.
Moving changes placement only; it does not change animation speed.
Source offsets use the project timebase even if source video has a different frame rate.
The media decoder selects the source frame at the requested timestamp.

Left-trimming `n` frames adds `n` to start and source offset, subtracting it from duration.
Right-trimming `n` frames subtracts `n` from duration.
A split at project frame `s` produces durations `s-start` and `oldEnd-s`.
The second clip's source offset is `oldOffset + s - oldStart`.

Do not exceed media duration. Unsupported/HDR source diagnostics must be resolved
before rendering, by supplying a supported local source or following the CLI's repair guidance.
No implicit looping, freezing, or retiming fills a long clip.
Source video selection uses indexed presentation timestamps, including variable-frame-rate
sources. A synthetic source changing from 30 to 15 fps is covered by the real media test.

`renders/` stores outputs. `.superint/` stores disposable caches and render snapshots.
Do not use either directory for source material.
An active export freezes its revision and referenced sources; later edits apply to future exports.
