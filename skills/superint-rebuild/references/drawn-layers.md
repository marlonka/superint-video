# Building what is drawn

Everything code can draw is built as a scene, so that the user can change it afterwards. The `superint-video` skill's rules hold as always: animation is a function of the frame, every text the user may want to change is a prop with `data-prop`, and the main text takes `var(--font)`. This file is about getting a built layer to measure like its source.

## Type

The ink box is the measure. Open the line in `compare --at <frame> --region <box around the line>`, which prints the box of the source's ink, the box of the film's ink and the `delta` between them (film minus source), then change one property per number:

| The numbers say | Change |
| --- | --- |
| Box heights differ | `font-size` × source box height ÷ film box height |
| Heights agree, widths differ | `letter-spacing`: subtract `dw` ÷ (letters − 1) pixels; a line 21 pixels too wide over 14 letters loses 1.6 per gap |
| Film `coverage` lower than the source's | the next heavier weight (400, 500, 600, 700), then measure again |
| Ink colours differ | shift the CSS colour by the difference; the ink colour averages strokes and their soft edges, so on a dark ground it reads darker than the CSS value |
| `dx`, `dy` not 0 | move the element by minus those amounts |

Work through the table top to bottom and measure after each round. In the test rebuild the title was right to a pixel after the second round; small lines in the same family usually need one.

Pick the family before measuring: set a word with `a`, `g`, `R` and a few numerals in two or three candidates from the tool's library (`superint-video fonts <dir>`) or from the user's brand fonts, enlarge them next to the source with `--region`, and keep the one whose letters have the same shapes. A family that is neither in the library nor from the user is a stand-in, and the report says so.

A box measured by `look` or `compare` goes into CSS as it is: `left`, `top`, `width` and `height` in pixels, because canvas and source share one size.

## Captions

Put a region on the caption band and run `look --events` over the shot. Every event is a frame on which the words change, so one group of words stands from one event to the next. A caption that fades or types on has no event; `--ink` per frame shows it as a colour that climbs or a box that widens. The words come from the frames, or from `superint-video transcribe` when a key is set up. Time every caption from the events and never from the transcript: captions are rarely in step with the voice.

## Grounds

`look --colours 8x6` at a shot's first, middle and last frame shows the ground as a grid. Equal cells are a flat colour. Cells that get lighter towards a point are a radial gradient around it; cells that change along one direction are a linear gradient along it. Build it, then put the film's grid next to the source's at the same frames and move the stops until they agree. The test card's ground was CSS `#0a0a0a`, rising to `#141414` at the top centre.

A ground with a still texture (paper, a pattern) can be a lifted still under the drawn layers. A texture that moves is drawn from its repeat, measured on a frame, or lifted as a clip.

## Motion

Read motion from the ink, frame by frame: `look --range <first>-<last> --region <the element's box at its largest> --ink --max 60`. Then build it from what the numbers do:

- **The box slides:** a move. Its position per frame is the path; equal steps are linear, large steps first an ease-out.
- **The box grows about its own centre:** a scale.
- **Every box on the frame grows by the same factor:** the camera pushes in. Put the elements in one stage element, set `transform-origin` on the point that stays put and scale that. In the test end card every box grew 4.5 % over 113 frames around the frame's centre: one linear `scale` from 1 to 1.045.
- **The colour climbs from the ground's to its own:** a fade. The test subtitle took 7 frames, its box rising 10 pixels at the same time, in large steps first: `interpolate(frame, [8, 15], [0, 1], {ease: ease.outCubic})` for both.
- **The box widens from one side:** a wipe or letters typing on.
- **Nothing in between:** a hard switch. Set the element on the measured frame. An `interpolate` needs at least two in-between frames in `look` that differ from both ends.

A scene's frame is local, counted from its clip's `startFrame`. Write the source frames next to the local ones, as in `[8, 15]  // source 104-111`.

`open` gives a dissolve and a flash a `to` frame: that span is built too. A dissolve is two overlapping clips with opacity fades from `frame` to `to`; a flash is one full-frame layer from `frame` to `to`.

## Looks that need more than a box

The tool has no motion blur and no text effects of its own, so build what the frames show and check it with `compare --at`:

| What `look` shows | What to build |
| --- | --- |
| A fast element smeared along its path | an SVG Gaussian blur on its wrapper with one axis at 0 (`stdDeviation="18 0"` for a horizontal path), the other following the speed; CSS `blur()` spreads in every direction |
| Letters whose colour changes across the word | a `linear-gradient` background clipped to the text (`background-clip: text`, transparent colour), its end colours read with `--colours` on the word |
| Letters drawn as a line only | a transparent fill with `-webkit-text-stroke` as wide as the measured line |
| A new colour running through a word | the word twice, the copy on top in the new colour, uncovered by an animated `clip-path: inset(...)` in the direction of the run |
| A halo around letters | stacked `text-shadow` layers, radius and opacity from the ink's soft edge |

Anything else follows the same path: look at it frame by frame, say what changes, build that as a function of the frame, compare.
