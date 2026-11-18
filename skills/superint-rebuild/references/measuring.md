# Measuring with `rebuild`

How to read what `open`, `look` and `compare` print, and what their numbers mean. All four verbs print JSON; pictures land under `renders/rebuild/`, and Studio shows the newest sheet under "Looked at last", so the user sees what you are looking at.

## Frames, not seconds

Every frame number is a frame of the film at the source's rate, counted from 0. A clip's `startFrame` and `durationFrames` take these numbers as they are. A source without a steady rate (many phone videos) gets the nearest common rate, and `open` says so in `note`.

## What `open` lists

`changes` holds every place where the picture jumps, each with the frame it starts on:

| `kind` | What happened | `to` |
| --- | --- | --- |
| `cut` | At least half the picture is replaced from one frame to the next: a new shot. | the same frame |
| `change` | Part of the picture jumps: a jump cut inside one take where the room stays, a card or a word that pops in or out, a window whose content switches. | the same frame |
| `flash` | A few frames of another picture (white, black, a burst), then the picture before returns. | the last frame of the flash |
| `dissolve` | One picture blends into the next over several frames. | the frame where the blend ends |

`strength` is the mean difference per colour channel across the change (0 to 255, at 64 × 36 pixels; colour, so two shots of the same brightness still cut) and `share` the part of the picture that changed (0 to 1). In the test film a pop of a small label measured strength 5 and share 0.05; a window switching its content measured strength 20 to 30 and share 0.3. `shots` are the first frames of the shots (cuts and dissolves).

Not listed: changes that are slow (a fade, a push, a drift) and changes too thin to move the average (a line that jumps, a cursor). Find those with `look`: a region with `--events` catches small jumps, and `--ink` frame by frame shows a fade as a colour that climbs and a move as a box that travels. A blend shorter than about five frames is listed as a `cut` on its first frame; look at the frames to see which it is.

The sheet (`sheet.file`) shows the frame after every change with its number underneath. Motion graphics on one ground often have no `cut` at all; then the changes are the rows of the shot map.

## Colours are CSS colours

The render turns a scene's CSS colours into the film's levels along a different curve, which lifts dark tones: CSS `#0a0a0a` comes out of the render as level 23, CSS `#171717` as 34. So `look` and `compare --at` show and measure the source in CSS levels: a colour they print goes into a scene as it is, and the render brings it back to the source. Dark grounds therefore read darker than a picture viewer shows the source. Lifted video needs nothing: the player and the render handle its levels, and a lifted still is saved in CSS levels.

`compare --render` compares two video files, so its colours are film levels on both sides.

## `look`

```sh
superint-video rebuild look <dir> --range 240-262 [--region x,y,w,h] [--events] [--ink] [--colours 8x6] [--max 24]
```

- The sheet shows every frame of a range of up to `--max` frames (24 by default), labelled with its number. A longer range shows every nth frame and says so in `note`. For the frames around a change, take a few either side and every one of them.
- `--region` cuts the frames to a box in source pixels. Wide boxes such as a caption band get wide tiles; small ones are enlarged.
- `--events` lists the frames where the region changes, in the same form as `open`'s changes. Put the region tight around what you want to time: the tighter, the smaller a change it notices.
- `--ink` measures, per frame on the sheet, what stands out from the region's most common colour: `box` (in source pixels), `colour` (the mean of the ink, edges included), `ground` and `coverage` (the share of the box that is ink; heavier type covers more). A region that holds two things (a mark and a word) measures them as one box: tighten it.
- `--colours 8x6` gives the mean colour of an 8 × 6 grid over the region at the first, middle and last frame on the sheet: enough to see whether a ground is flat, where a gradient is lighter and whether it changes over the shot.

## `compare --at`

```sh
superint-video rebuild compare <dir> --at 96,150,209 [--region x,y,w,h]
```

Renders those frames from the scenes (no MP4 needed) and puts each next to the source. Per frame:

- `score`: structural similarity of the two pictures in grey, 1 for the same picture.
- `rebuilt`: the same without the boxes where lifted footage shows; `null` when lifted footage covers the whole frame. This is the number that says how well you built.
- `colour`: mean difference per colour channel, 0 to 255.
- `weakest`: the three weakest cells of an 8 × 8 grid, `cell` as `[column, row]` from the top left, with their `box` in source pixels and their score.
- `picture`: source | film | difference, the weakest cells outlined in red. In the difference panel dark means equal and bright orange means apart.

With `--region` around one line of type it also measures the ink of both (`source`, `film`) and prints `delta`, always film minus source: `dx`, `dy` (position), `dw`, `dh` (size) in pixels and the difference in `coverage`. The region picture shows both crops enlarged next to each other. How to turn the deltas into CSS: [drawn-layers.md](drawn-layers.md#type).

## `compare --render`

```sh
superint-video rebuild compare <dir> --render renders/rebuild.mp4 --side-by-side [--range a-b]
```

- `frames`: how many frames the source and the film have and how many were compared; `length` appears when they differ.
- `score`: `all` (whole pictures), `rebuilt` (without lifted footage) and `colour`, averaged over the compared frames.
- `sourceShare`: the share of the film's picture, area times frames, that is lifted footage.
- `cuts`: the changes of both, found the same way. `missed` are the source's that the film lacks, `extra` the film's that the source lacks, `shifted` those that are there but off by one or two frames (`by` is positive when the film is late). Two frames apart still counts as the same change.
- `sound`: how far the film's sound runs behind the source's (`offsetMs`, `offsetFrames`) and how well they line up (`match`, 1 for the same sound). With the source's sound as one clip from frame 0 this is 0.
- `weak`: stretches of at least a quarter second where `rebuilt` stays under 0.6, with their mean. It catches gross gaps only; work through `worst` for the rest.
- `empty`: stretches where the film is a flat, empty frame while the source shows something.
- `worst`: the six weakest rebuilt frames, at least a second apart, each pictured like `--at`. Frames that are all lifted footage are left out: there is nothing in them to fix.
- `sideBySide` (with `--side-by-side`): `renders/rebuild/side-by-side.mp4`, source on the left and film on the right, with the film's sound.

## What the scores mean

From a test rebuild of a 7-second end card (a logo, a title, a subtitle on a dark ground with a soft glow):

| What | `rebuilt` |
| --- | --- |
| A lifted full frame placed with the clip `lift` printed | 0.998 (as `score`; `rebuilt` is `null`) |
| The card in the right font, the title about 20 % too large, the subtitle too small and too light | 0.93 to 0.95 |
| Everything in place, but the colours read in the film's levels instead of CSS levels, so the render lifted the ground by 11 levels | 0.93, colour difference 10.8 |
| After two rounds of `--region` measuring and colours in CSS levels: type within a pixel | 0.995, colour difference 1.0 |

`compare --at` predicted the render within 0.004. Above 0.98 the remaining difference is usually compression and anti-aliasing; between 0.9 and 0.98 something is visibly off (size, position, colour, timing) and the picture shows it; under 0.9 an element is missing or in the wrong place. Footage with grain, noise or heavy compression scores lower however well it is rebuilt: judge such frames by the picture, not the number.

## Long films

Work a long film in sections of about a minute that end at a cut. `compare --render … --range a-b` compares only that section of a render. Each `compare` writes a new numbered folder under `renders/rebuild/compare/`.
