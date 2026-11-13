# Editing an existing project

## Read before editing

1. Read `video.json`, the scenes you will touch, and `brief.md`/`script.md` if present.
2. Run `superint-video inspect <dir> --json`.
3. Change only what was asked. Preserve clip IDs, source offsets, assets and unrelated edits.
4. Re-read `video.json` right before writing if time has passed; Studio may have saved changes.

Never replace an existing project with a new `init` or `new`. For a save conflict, keep the intended change and reapply it to the latest file.

## Timeline semantics

See [project.md](project.md) for the manifest fields.

- Moving a clip changes `startFrame` only; it does not change animation speed.
- Left trim adds to `startFrame` and `sourceOffsetFrames` and shortens `durationFrames`.
- Right trim changes `durationFrames` only.
- Splitting at frame `s`: the second clip gets `sourceOffsetFrames = old + s - oldStart`.
- Clip intervals are half-open: `[startFrame, startFrame + durationFrames)`. The last frame is `durationFrames - 1`.
- Later visual tracks draw above earlier ones; within a track, later clips in the array draw on top.
- Nothing loops, stretches or freezes implicitly. Do not exceed media duration.
- Audio plays from audio clips and from video clips with `includeAudio: true`. Set gain and fades explicitly; preserve mutes and intentional overlaps.

## Scene edits

- Text and values: change the clip's `props` when the scene exposes them; that keeps the same scene reusable.
- Look and motion: edit the scene HTML. If several clips use the same file and only one should change, copy the file first.
- Keep animations deterministic (see [scene-api.md](scene-api.md)).

## Preview and verify

```sh
superint-video check <dir> --json
superint-video snapshot <dir> --frames 0,45,90 --output renders/snapshots
superint-video studio <dir> --background
```

- `check` with zero sampled frames means visual validation did not run.
- After a visual change, `superint-video review <dir> --frames <list> --strip <a-b>` also measures actors cut at the frame edge and highlights off their target around it.
- Look at snapshots at a scale where text is readable; check settled frames, mid-motion frames and cut boundaries.
- Studio runs in the foreground and prints its local URL. Keep a handle to stop it; do not detach it.
- Errors name the clip, source and frame. Fix and repeat only the affected checks.
- A change to the picture needs a polish pass before the new render ([polish.md](polish.md)): `superint-video polish <dir>` walks only the stills the change touched when the film's last round was accepted, and the whole film otherwise. Write its rows, then `polish --accept`.

Render to a new file name unless the user asked to replace an export:

```sh
superint-video render <dir> --output renders/<name>-v2.mp4
```
