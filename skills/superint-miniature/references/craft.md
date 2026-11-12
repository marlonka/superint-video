# Craft: making code look like a photograph

What actually moved these films from "good CG" to "is that real?", with the numbers that worked. Start from these values, then look.

## The hero close-up

A model that is fine at medium distance reads as cheap when it fills the frame. The opening shot gets its own lens, its own light and its own reflections. The worked example is `P.coffee()` in `props.js`, `paintCrema()` in `paint.js`, `heroCards` and `heroEnv` in `shaders.js`, and the two first keys of `camera.js`.

**Work against a picture.** Place a real photo of such an object (or the user's reference) next to your frame at full size. List the differences and fix them from biggest to smallest. A 256-sample frame takes seconds, so look often. Five rounds were needed for the cup.

**Lens.** Field of view .205 rad at about .75 m, eye a little above the object looking down (`eye +.176`, `at +.05` over the table), aperture .0028, barely moving: 4 cm in 2–3 s. Wide lenses close to a small object are what make CG look like CG.

**Light, a photographer's setup.**

- One soft key from the front left, about 1 m away: `size .2`, `angle .3`, `inner .15`, colour `[2.5, 2.1, 1.58]`. One weak fill from the other side: `size .3`, `[.42, .36, .29]`. Both `manual`, `haze: 0`, `bias: .0012`.
- They exist only for the close-up. In `frame(t)` they fade out on the first word's pull-back while the room's lamps take over (`pendant.power *= mix(.52, 1, k)`).
- The lamp that would cut across the object stays off in that shot. A spotlight's cone edge on a cylinder reads as a hard dark band; that was the biggest flaw of the first version.
- Check the shadow side. It needs light from the room or the fill, never pure black.

**Model.**

- Lathes with 256 segments, a real profile: foot ring, a wall that swells, a lip with thickness. Eight profile points were enough for the wall when each point had a reason.
- Anything with a saucer or a base gets its own well, rim and foot, so the shadow and the reflection have something to do.
- Handles are not tubes stuck on. A B-spline centre line (`bspline` in `props.js`) with an elliptical section (`a .0041`, `b .0058`), flaring at both ends (`.0098`, `.0118`), with the ends projected radially onto the wall so it looks cast: `surf(fn, 180, 56)`.
- Small objects give scale and credibility: spoon, latte art, steam. The spoon must read as a spoon: rolled by .2 rad, a bowl 7 mm deep, in front of the saucer, not a flat ellipse behind it.

**Material.**

- Glaze: dull base colour (`#efe5d0`, `r .34`) with a clearcoat on top (`flag: 64`). Without the coat it looks like plastic, with only the coat like glass.
- **Reflections sell it.** A real glazed cup shows bright window streaks. They are studio cards here, defined in the shader only (`heroCards`), visible nowhere but in the coat. Tall, narrow, warm: two strips at the key side (17 and 9 in strength), one low strip at the far side (3.2), a dim wide one behind and an overhead one.
- A cone's true reflections point down at the table, so the cards never appear on it. The wall uses a **cylinderized normal** for the reflection lookup: streaks stay upright and long.
- **Near objects are hit analytically.** A cube map cannot see what stands 2 cm away. `heroEnv` intersects the reflected ray with the table plane, saucer (disc and cone), cup (cone) and spoon (ellipsoid and capsule), and lights those hits with a simple formula. Add cards after that on the cup wall, or only where nothing is hit elsewhere.
- Slight wobble in the coat's normal, because no glaze is plane.
- Highlights from discrete lamp positions show up as a pattern of dots on polished things (`r` ≈ .1, one dot per subframe). Keep a floor on the lobe for direct light: `a ≥ .04` for steel, coat `ac = .035`. The image-based reflection stays sharp and carries the polish.
- Coffee: a painted canvas (`paintCrema`) with a caramel base, mottling and rosetta fronds, and a small meniscus. A flat colour disc reads as a toy.

**Table.** A real mirror plane from a second render (8 subframes, satin blur), `planeK .6`, rich dark colour (`#422311`), rings at a lower frequency for large boards (122), no bump. Lacquered wood gets its picture from colour, not relief, and any bump in it sparkles.

**Background.** The bokeh decides how expensive the frame looks. Book spines with deep colours and gold bands in a rich palette `['#12161f', '#7c1a14', '#1a4a2e', '#3a1510', '#b5851f', ...]`, 20–35 cm behind the hero. Blurred, they still read as leather. Move anything distracting (a pen holder) out of the frame: moving the eye right shifts the background right.

**Steam.** A card facing the lens with `MAT.steam`, width `.075 + y * .44`, alpha low (`* .46`). Shrink it in the close-up (`kst = mix(.4, 1, smooth(.85, 1.8, distance))`) so it doesn't fill the frame.

**Another hero?** Copy this structure: one lathe or surface model at 200+ segments, one `manual` key and fill, cards in the coat, replace the proxies in `heroEnv` with the hero's own neighbours, and set `E.hero`. Metal shows cards even more than glaze.

## Things and rooms

- **Rounded edges everywhere.** `rbox` with a bevel of 2–12 mm. A sharp box catches no highlight and looks computer-made. Only section walls stay sharp.
- **Metres.** Desk top .76, chair seat .45, door 2.0, paper .21 × .297.
- **Books:** one spine atlas (`paintSpines`), real sets (several equal volumes in a row, heights that belong together), a leaning book, a flat pile. Pages have their own material. Random heights alone read as a bar chart.
- **Chair:** bent wood as tubes along smooth curves with a cane seat (`paintCane`), the thing the eye forgives least. A chair built from boxes got laughed at.
- **Wood:** the grain runs along the board. Set `grain` per part: 0 for x, 1 for y, 2 for z. Moving parts need flag 16 or the pattern flows through them.
- **Curtains, cables, skirting, radiators:** cheap to build and they make a room real. Cables with `smoothPts` and `tube`, sagging, entering a plug at its back.
- **Paper:** flag 16 and `MAT.paper`, a sheet 0.3–0.6 mm above the surface, tiny rotation, contact shadow. Stacks: each sheet shifted a little. Two coplanar sheets z-fight, and it looks like pale ink.
- **Neon:** glass tubes as `tube` along strokes (`neonText`). A dark tube behind the lit one (not under: 2 mm under, it flickered away). Emission about 13: higher goes white and the colour dies. Per letter, `visible = (s + .5) / N <= level` for flicker. Separate dark and lit textures for a logo: flag 1 replaces albedo with the texture's rgb.
- **Lamps:** the bulb sits inside the shade, the glow sphere `e: 40`, a real light at the same place. Shade from the inside lighter than the outside.
- **Text on paper:** ink colour nearly black, and watch out for bloom: on a bright page the veil turns black into brown (`bloom .012`, `exp .8` in the close-up). Use `textBaseline = 'alphabetic'` and measure before drawing strike-outs, or the line ends up above the words.
- **Screens:** `r: .96` and flag 8. A glossy screen shows smudges from reflections at a distance.
- **Glass:** dithered per subframe. Needs samples, and far pictures need more subframes.
- **Rain:** instanced streaks, fading near the lens or they become big grey ghosts. Sound separately as tones and drops.
- **Haze:** .001–.004. Bright moving lights get less, or they pull the frame into fog. Direct after a cut, `E.hazeK` starts at 0 and ramps up.
- **Moon:** a disc with seas, highlands and a dark limb, or it is a white coin.
- **Lots of the same** (seats, drawers, keys): `many()`, an atlas and `b` for UVs. A wall of 2 000 drawers renders without trouble.

## Light and exposure

- Every light comes from a lamp you can point at. Rooms keep 5–6 lights.
- A room's `up`/`dn` ambient is colour, not brightness: it should tint the shadows.
- One moon for a room with two roof lights: its light falls parallel through both. Two cones form a dark V.
- A lamp's spot `angle` max is about 1.45. Beyond that the shadow map spreads too thin.
- Rooms not yet reached stay at a visible 45% power, so the house looks inhabited.
- Run a scan over the whole film at 8 samples and 6 fps: no stretch darker than mean 6 for more than .5 s and no stillness over 2 s. Anything found gets a fix or a reason.

## Motion

- Camera: `sampleKeys` is monotone cubic, so it never overshoots. Keys carry the edit: place one on the word the picture changes on, one a little later so the frame keeps developing.
- A mechanical action starts a little before its sound and word: a stamp lands on the word, it does not start on it. `bump(t, t0, d)` for a hit, `rise`, `pulse`, `spring` for the rest.
- All per-subframe motion goes through `sub(ts, ...)`, not `frame(t)`, or it gets no motion blur.
- Fast moves between rooms may smear. A camera that lingers at the end of a fast move looks like it stopped by accident; ease into the next action.

## Traps, each paid for once

To find flicker, compare consecutive raw `snapshot` frames, not the MP4. To find its cause, switch one thing off at a time and output plain albedo: what still flickers with no light is geometry.

| Symptom | Cause | Fix |
| --- | --- | --- |
| Everything soft in close-ups | Sign error in the lens term | `P[8] = -P[0] * lensX / focus` |
| Hatching in light cones | More than 8 lamps with one sample sequence per subframe | Per-lamp counter `_k`, per-lamp index `_lid` |
| Zigzags, unreadable fine text in far shots | Near plane of 2 cm at 60 m | Growing near plane in `sub` |
| Wood sparkles | Bump on lacquered wood | No relief, colour only |
| Desk looks like glass | Mirror too clean | Satin blur, `planeK .6`, wobble |
| AO gone in wide shots | AO box too small | Half-size `clamp(dist * .8 + .15, .45, 14)` |
| Picture in picture too contrasty | It went through the film curve twice | `unfilm` for layer 200 |
| Sky black in the last wide shot | Far plane | `far` 340 |
| Dotted highlights on metal | Discrete lamp samples | Roughness floor for direct light |
| Band across a cylinder | Cone edge of a spot | Switch that lamp off, soft key |
| Cards missing on a cup | A near-field hit overwrote them | Add cards after the hit on the wall |
| Dark logo renders white | Flag 1 replaces albedo with texture rgb | Paint the texture in the wanted colour |
| Mic seen from the back, or lamp bulb outside the shade | Built without looking from the camera | Look from the shot's angle while building |
| Film crashes on one frame | A list held fewer entries than a late card needed | Check every array at `check` and with a frame scan |
| `Camera: time runs backwards` | Wrong cue index or a word moved | Read `cues.js`, use `cue(par, word, n)` properly |
| Snapshot throws after a text change | `cue()` no longer finds the word | Run assemble and `pauses.py` first |
| `clip ends after project end` | Audio clips kept old times | Run `place_audio` and `make_sfx` right after `pauses.py` |
| `Identifier already declared` after a patch | A function moved | Patch by exact boundaries and keep a backup |
| Old text visible in the picture | A contact sheet or code wall baked from an earlier render | Rebake thumbs, sheets, source text, then search |
| Whole walls and floors flicker while the camera moves, fine tilted lines, walls too dark | The black section (`buildShell`) lies in exactly the plane of a room's walls, so both fight for the pixels (z-fighting). It survives with all lighting off | Section walls stand 5 mm behind the room's walls. No two surfaces ever share a plane |
| One room's floor or sloped roof still flickers after that fix | The section's slab or roof lies in that room's floor or ceiling plane. Fixing the walls is not enough | Check every shell face against every room face, top of the slab and underside of the roof included |
| Text on a sheet looks squashed or stretched | The canvas has a different format than the card it is printed on | Canvas width / height = card width / height |
| Polished metal pulses from frame to frame | A lamp is a few very bright texels in the small reflection cube | Cube rendered with highlights capped (`maxCol`), rougher plates on big flat metal |
| The whole room twitches in a fast series | Flash light at 60 per second on 30 frames, so it lands at random | Show the series on the bulb; the room's light stays steady |
| Re-recording one paragraph moves other paragraphs | `audio/takes/report.json` is rewritten and its `pick` may differ from the takes the film uses | Write the film's real pick list down at the first assemble and pass it to `voice assemble --pick`. Afterwards compare word times per paragraph with the old `scenes/cues.js` |
