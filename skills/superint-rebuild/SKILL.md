---
name: superint-rebuild
description: Turn a finished video into a Superint Video film the user can edit, measured against the original frame by frame - motion graphics, explainers, product films, slideshows, talking heads and other footage. Use with superint-video when the user brings a video and wants it nachgebaut, rebuilt, recreated, turned into an editable project, or wants one of their videos as a starting point they can change. Read superint-video first.
---

# Rebuilding a video

Read the `superint-video` skill first: it covers the tool, scenes, the timeline, Studio and the live status. This skill turns a finished video into a film of that tool. When it is done, the render and the source look the same when played next to each other, and everything drawn in it (type, captions, cards, charts, backgrounds, motion) is a scene the user can change in Studio. Footage that code cannot draw comes back as clips cut from the source, each on its own box, and the report says which.

The tool measures and cuts; you build. `superint-video rebuild` has four verbs for it:

| Verb | What it does |
| --- | --- |
| `rebuild open <video>` | A new film at the source's size, frame rate and length. The source is copied into `source/` untouched; its sound becomes one audio clip over the whole film; every shot and every change is listed; a sheet shows the frame after every change. Opens Studio. |
| `rebuild look <dir> --range a-b` | Source frames of a range on one sheet, every frame when the range is short. In a `--region`: the frames where it changes (`--events`), the box and colour of the ink (`--ink`), the colours of a grid (`--colours 8x4`). |
| `rebuild lift <dir> --range a-b --region x,y,w,h` | Cuts that region of the source into `assets/lifted/` for those frames and prints the clip that puts it back on its own box; `--still` for one frame as an image, `--clean` to paint out burned-in text, `--add` to put it on the timeline. |
| `rebuild compare <dir> --at f,f,…` / `--render <mp4>` | Scores the film against the source: a few frames straight from the scenes, or a whole render with its cuts, how far its sound is shifted, weak and empty stretches and the weakest moments as pictures. |

Every count is in frames of the film's own rate, and `video.json` places everything on whole frames, so there is no rounding between seconds and frames to get wrong. What each output means and how to read it: [references/measuring.md](references/measuring.md).

## Whose video it is

Rebuild only a video the user made or may use: their own film, their company's, or one they hold the rights to. That is the one case where a video is content and not only a reference; the main skill's rule against copying other people's footage stays for everything else.

- If it is unclear whose video it is, ask once before opening it. A video from someone else's channel, a brand's ad, a film or a show is not rebuilt.
- Never rebuild in order to remove a watermark, a logo, a credit or a signature that belongs to someone else.
- The tool downloads nothing. The user brings the file.
- The first goal is a faithful copy. Another product, other words or another language are edits in Studio afterwards, and only on the user's request.

## Steps

Write `process/status.json` with these steps in the user's language, so Studio shows where the rebuild stands:

| # | Step | Writes | Done when |
| --- | --- | --- | --- |
| 1 | Open | `video.json`, `process/rebuild.json`, the sheet of changes | `rebuild open` ran; you named the Studio address and said in one or two sentences what will be rebuilt in code and what will stay footage |
| 2 | Shot map | `process/shots.md` | One row per shot with its frames and every element in it, each marked **build**, **lift** or **still**; the changes inside each shot read on consecutive frames |
| 3 | Build | `scenes/*.html`, lifted clips, the timeline | Every shot has its content on the timeline; `compare --at` on the frames of each shot shows no element missing or misplaced |
| 4 | Render and compare | `renders/rebuild.mp4`, `renders/rebuild/compare/<n>/` | `rebuild compare --render` ran; every missed cut, empty stretch and weak moment it names has been looked at |
| 5 | Fix | the scenes and timeline | What the comparison found is fixed; a second render and comparison show it fixed |
| 6 | Hand over | `report.md` | The user has the MP4, the side-by-side film and the Studio address |

### 1 Open

```sh
superint-video rebuild open "<video>"
```

The film goes into the user's films folder, named after the file (`--name` for another name, `--to` for another folder). Name the `studio` address in your reply so the user can watch from the start. The film has no `brief.md`: its brief is the source.

What `open` fixes stays fixed: canvas and source share one size, the rate is the source's rate (a fractional rate such as 24000/1001 stays fractional), and the length is the source's number of frames. Never change them. The `source-sound` clip is the source's own sound over the whole film; keep it as it is, and keep every lifted clip silent (lifted video clips are silent unless `includeAudio` is set).

### 2 Shot map

Look at the sheet (`sheet.file`: the frame after every change, with its number), then write `process/shots.md`: one row per shot, from its first frame to the frame before the next one, what it shows, and every element in it with one of three marks:

- **build**: drawn in a scene. Type, captions, labels, numbers, cards, panels, buttons, interfaces and screen recordings of interfaces, charts, maps, icons, shapes, gradients and flat backgrounds, light effects laid over the picture, the end card. This is the default; most of a motion-graphics film is built.
- **lift**: cut from the source as a moving clip on its own box. Camera footage, a person, a screen recording too dense to rebuild, a painted or 3D-animated shot.
- **still**: cut from the source as one frame. A photo, a logo, an app icon, a product shot that does not move, a textured background that holds still.

Logos and marks are stills or brand files, as [references/footage.md](references/footage.md) says.

The sheet is for the map only. Timing is read from `look` with every frame shown: before building a change, look at it together with the frames just before and after, and write into the map on which frame it starts and how many frames it takes. [references/measuring.md](references/measuring.md) says how to read the changes `open` lists.

### 3 Build

Build shot by shot, in order, and put each shot on the timeline as soon as it has its content, rough first, so the user sees the film grow. Times come from the shot map in frames; a `box` that `look` or `compare` prints goes into CSS unchanged.

- How to match type, captions, graphics, backgrounds and motion so that they score: [references/drawn-layers.md](references/drawn-layers.md).
- People, footage, photos, logos and painted shots: [references/footage.md](references/footage.md).

Check while you build, without rendering: `rebuild compare <dir> --at <frames>` renders those frames from the scenes and puts each next to the source with the difference. Take the first frame, a middle frame and the last frame of the shot you just built, plus the frame of every entrance. With `--region` around a line of type it also measures the ink of both, which is how type gets its size. Fix what is visibly wrong before going on to the next shot.

`lift` refuses the whole picture over almost the whole film. Do not get around it with a clip of the source itself, hidden or at zero opacity: the result would be the source, not a rebuild.

### 4 Render and compare

Run `superint-video check <dir>` once the timeline is full. Its errors are yours to fix; a warning about low contrast or small type that the source has too is not. Then render and compare:

```sh
superint-video render <dir> --output renders/rebuild.mp4 --codec x264
superint-video rebuild compare <dir> --render renders/rebuild.mp4 --side-by-side
```

The film has no brief, so `render` does not wait for a polish pass. The polish walk of the main skill adds detail, and here detail the source does not have is a defect; the comparison is this film's last look instead. If your host can start a sub-agent, let one look cold at the comparison sheet and the side-by-side film and list what differs from the source, without your reasoning.

### 5 Fix

First what is plainly wrong: missed or extra cuts, a length that differs, sound that is shifted, empty stretches. Then the `worst` list, lowest score first; `weak` only catches gross gaps, so `worst` is the list to work through. Each entry has a picture with source, film and difference side by side and the weakest cells outlined. Act only on a difference the picture shows. A low number with nothing visible in the picture stays as it is.

Then render and compare a second time. The second comparison confirms the fixes; a third is only for something the second shows newly. More rounds chase noise.

### 6 Hand over

Give the user the render, the side-by-side film (`renders/rebuild/side-by-side.mp4`, source left, film right) and the Studio address, and tell them in a sentence that every built element can be changed there. Then write `report.md` with a `## Rebuild` section:

- what is built, what is lifted, what is a still, shot by shot in a few lines;
- what is approximate: a font that stands in for one you could not identify, an effect you matched by eye;
- the last comparison's numbers: `score.all`, `score.rebuilt`, `sourceShare`, cuts missed and extra, how far the sound is shifted;
- which lifted clips still carry burned-in text, which boxes `--clean` painted out, and where text passes behind a person and could not be separated.

The making-of of the main skill follows, as for every film.

## Long videos

Split a video over two minutes at cuts into parts of about a minute and tell the user the count before starting. Build, compare (`compare --render … --range a-b`) and fix one part at a time; at the end, render the whole film once and compare it whole.
