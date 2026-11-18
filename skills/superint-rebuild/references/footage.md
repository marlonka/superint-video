# Footage, people, photos and painted shots

What code cannot draw is taken from the source: `rebuild lift` cuts it out on its own box and prints the clip that puts it back where it was. The tool makes no pictures of its own, so a lifted part is the source's pixels, except inside boxes painted out with `--clean`; the report names both.

## Lifting

```sh
superint-video rebuild lift <dir> --range 240-389 --region 1100,180,640,720 --id speaker-2 --add
```

- **A box belongs to one shot.** After a cut the same box shows something else, so lift each shot on its own; `lift` lists in `crosses` the cuts a range runs over. A `change` inside a shot, such as a jump in one take, may stay inside a lift, which copies it on its exact frame.
- **The box.** Measure it with `look --ink` or read it from the frames: large enough for all the thing does in the shot, gestures included. `lift` widens it to even pixels and prints the box it used.
- **The clip.** Its `transform` scales the file back to its size and centres it on its box. Leave it as printed unless the source's camera moves the thing. `--add` puts it on the timeline at once, through Studio when it is open.
- **Tracks.** `open` makes three picture tracks, drawn bottom to top: `ground` for built backgrounds, `lifted` for footage and stills, `rebuilt` for type and graphics. A layer that belongs between them gets a track of its own with `addTrack`; later tracks draw above earlier ones.
- **Sound.** Lifted video clips are silent; the film's sound is the `source-sound` clip.
- **Colour.** A lifted clip is written as BT.709 and a lifted still in CSS levels, so both render at the source's colours without any correction.
- **Limits.** `lift` refuses the whole picture over almost the whole film. A whole-picture lift of one shot is allowed where that shot is footage from edge to edge.

## Stills and logos

`--still` takes one frame as a PNG image clip: a photo, a product shot, an app icon, a textured ground. Take it on the frame where the thing is largest and sharpest. When it has to move with built layers, use it as an `<img>` inside the scene instead of a clip and move it with them; the test end card did that with its mark.

Logos and marks are pixels from the source or files from the user's brand kit, never your own drawing: lift the frame that holds most pixels of it.

## Burned-in text on footage

Text burned into footage (a caption over a speaker, a label on a photo) is in the lift too, and built text on top would show it twice.

- **Small marks on a calm background:** `--clean x,y,w,h`, once per box, fills each box from its edges while lifting. Check it with `compare --at`; on a face or a busy background it smears.
- **Large text, or text over a face:** keep it in the lift and build the new text exactly over it. It is editable only as far as the new text covers the old; the report says so.
- **Text that passes behind a person:** the tool cannot cut a person out, so the text and the person stay together in the lift, and the report names the shot.

## People

People are lifted shot by shot, each on a box that holds them through the shot. Their face, movement and voice stay the source's; nothing about them is redrawn or made up. Lower thirds, captions and stickers on them are built on top. People who appear inside a photo or a screenshot are part of that picture's still.

## Films drawn frame by frame

In a painted, drawn or 3D-animated film every frame is one image, so there are no layers to take apart. One question decides each shot: does the picture hold still while only the camera moves? If not, lift the whole shot. Build on top of it everything that is lettered, the end card and brightness effects (a flash, a glow); a still world under a moving camera may be built from stills lifted on clean frames.

Tell the user before you start, in their language, for example: "The drawn shots stay clips from your video; the lettering and the end card become editable." `open` may list a lamp switching on or a lightning flash as a `cut`: if the drawing is unchanged and only its brightness jumped, it is one shot.

## The share that stays footage

`sourceShare` from `lift` and `compare` is the part of the film, area times frames, that is lifted. A motion-graphics film comes out low, because nearly all of it can be built; a filmed interview comes out high, because its people are lifted. Both are honest results. Report the number and the shots it comes from.
