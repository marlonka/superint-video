# Executable examples and common fixes

The repository includes:

- `examples/starter`: one deterministic scene; same pattern as `init`.
- `examples/demo`: three HTML scenes, local SVG, five-second video, overlapping audio, fades. Its video and audio are generated, not committed: run `scripts/generate-demo-assets.ps1` once (needs FFmpeg).
- `examples/fixture`: synthetic frame markers, a gap, overlap, and nonzero scene source offsets.

Run from the repository root using the installed binary or the built executable:

```sh
superint-video check examples/starter --json
superint-video snapshot examples/starter --frames 0,30,90,149 --output renders/snapshots
superint-video render examples/demo --output renders/demo.mp4
```

Minimal static scene, `scenes/still.html`:

```html
<!doctype html><html lang="en"><meta charset="utf-8">
<style>html,body{margin:0;width:100%;height:100%;background:#111;color:white}h1{position:absolute;left:8%;top:35%;font:120px Arial}</style>
<h1>Superint Video</h1></html>
```

Mixed manifest fragment using local files:

```json
{
  "version":1,"width":1920,"height":1080,"fps":{"num":30,"den":1},"durationFrames":300,
  "tracks":[{"id":"visuals","kind":"visual"},{"id":"sound","kind":"audio"}],
  "clips":[
    {"id":"intro","type":"scene","src":"scenes/still.html","track":"visuals","startFrame":0,"durationFrames":150,"sourceOffsetFrames":0},
    {"id":"footage","type":"video","src":"assets/numbered.mp4","track":"visuals","startFrame":150,"durationFrames":150,"sourceOffsetFrames":0,"includeAudio":false},
    {"id":"bed","type":"audio","src":"assets/tone.wav","track":"sound","startFrame":0,"durationFrames":300,"sourceOffsetFrames":0,"gain":0.15,"fadeInFrames":15,"fadeOutFrames":30}
  ]
}
```

Before running this fragment, put `numbered.mp4` and `tone.wav` into the fresh project's `assets/`:
`scripts/generate-demo-assets.ps1 -Destination <project>/assets` makes them. The fixture is synthetic, created for this repository.
Do not interpret its sound or frame pattern as third-party footage.

| Symptom | Fix |
|---|---|
| `Uncontrolled animation` | Remove the running CSS animation/transition; compute style from `frame`, or pause WAAPI and set `currentTime` in `render`. |
| `Scene video/audio elements are unsupported` | Remove those elements; declare video/audio manifest clips. |
| `Image failed` | Fix the project-relative URL and verify the local asset exists and decodes. |
| `Font loading ... timed out` | Remove remote fonts; copy an authorized local font and correct its `@font-face` URL. |
| `render(context) timed out` | Resolve asynchronous frame work; remove never-settling promises or long network calls. |
| Scene script exception | Open the reported scene file and line; verify DOM selectors and property types. |
| Wrong animation after trim | Retain `sourceOffsetFrames`; use supplied local `frame`/`time` without subtracting placement again. |
| Wrong media excerpt | Express offset in project frames; check fps numerator/denominator and source duration. |
| Duplicate audio | Keep `includeAudio:false` when a separate audio clip supplies that video's sound. |
| Stale revision/save conflict | Reload latest manifest and reapply the intended edit; preserve unrelated external changes. |
| Remote dependency rejected | Copy the licensed asset/script/font locally and replace the remote URL. |
| Unsupported media probe | Convert source explicitly to a supported SDR codec; reimport and verify. Indexed presentation timestamps also support VFR. |

For frame-contract inspection, fixture frames 0–29 show A with local frames 0–29;
30–34 are a black gap; 35–59 show B with local frames 30–54;
60–89 show C with local frames 60–89 above overlapping B.
Each scene draws a 16-bit binary frame marker at the lower left.
The white bar moves 5 pixels per local frame, including consecutive 60 fps frames
if the manifest's FPS is changed to `{num:60,den:1}`.
