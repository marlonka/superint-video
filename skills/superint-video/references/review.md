# Looking at the film: snapshots and review passes

The CLI captures frames from the live project, so no render is needed to judge a film. The workflow skill supplies the rubric; this page is the mechanics that every workflow shares.

## Style frames

Before animating everything, build the scenes that carry the look (the workflow names them: hook, key image, title, end card …), place them in `video.json` and snapshot one settled frame of each:

```sh
superint-video snapshot <dir> --frames 45,600,1650 --output renders/frames
```

Look at each at full size and scaled to 320 px wide, next to the references at the same scale. Fix scene and `direction.md` together.

## One review pass

1. `superint-video review <dir>` writes `renders/review/<n>/`:
   - `contact-sheet.png`: a frame every 3 s (`--every`) plus the last frame
   - `review.md`: the worksheet, one row per frame with the words spoken there (from `audio/words.json`) and what was measured
   - `review.json`: the same data, plus the actors each scene reported
2. Read the measurements at the top of the worksheet. The tool samples the whole film every 0.5 s for stretches where the picture barely changes for 3 s, actors that the frame edge cuts to a sliver, and highlights that do not enclose their target. They are hints to look closer, not verdicts. A `no-actors` warning means edges and targets went unchecked: make scenes report actors ([scene-api.md](scene-api.md)).
3. Look at the contact sheet next to the references at the same size, then at every frame at full size.
4. Fill in every row of `review.md` before changing anything: the defect you see against the workflow's rubric, then the concrete change. A frame with no defect gets `ok` and a reason.
5. Details up close: `--camera x,y,zoom` in scenes that declare the check camera, `--crop x,y,w,h` in any scene. Look at faces, hands, labels, small text, edges of UI.
6. Motion frame by frame: `--strip a-b` (at most 90 frames) over every exit, transition and fast move; ugly frames hide mid-motion.
7. Fix every defect and every measured flag. A flag may stay only with a written reason in `process/review.md`. Then run `check` again.
8. Log the pass in `process/review.md`: number and offset, defects found, changes made, flags kept with their reason.

**Next pass:** alternate the grid offset (`--offset 1.5`, then `--offset 0`) so each pass sees the frames between the previous pass's frames. The workflow says how many passes; stop when a pass at a new offset finds nothing that matters.

## A move over every frame

A still cannot show a jump between two frames. When something moves through the whole film (a pointer, a camera, a hand), keep its position a pure function of time and ask it for every frame: the largest step and the largest turn from one frame to the next, and whether it covers a text. The preview server serves every project file at `<previewUrl>/asset/<path>` (`studio` prints `previewUrl`), so a scene's modules can be imported in the browser and asked directly. A step far larger than its neighbours is a jump a viewer sees.

## Before and after the render

Review passes end when the film holds up for its author. Then comes polish ([polish.md](polish.md)): fresh eyes walk the film one still at a time, fix what they see and add detail, and leave the record that `render` asks for.

To judge sound against the picture, render a draft first (`render --quality draft`) and listen to it with `superint-video listen` (see the `superint-audio` skill). Don't claim to have listened if you only checked metadata.

After the final render nothing more is judged by looking: read the frames, size, loudness and true peak it reports, and hand the film over.
