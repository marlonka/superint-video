# Code-rendered miniature: art direction

A film that looks shot on a miniature set with a real lens, and is computed entirely in code: geometry, wood grain, wallpaper, moon and rain are formulas, no downloaded models or textures, no generated images. The renderer in `scenes/` averages hundreds of subframes per film frame, which gives true depth of field, motion blur, soft shadows and film grain. Read the `superint-miniature` skill before building: it holds the renderer's API, the modelling and light recipes and the known traps.

The references in `references/` are the yardstick. Put every style frame and contact sheet next to them at full size.

## The idea

One connected place, travelled in one almost unbroken camera move. The first film was a cut-open studio building at night in the rain, with one room per trade (study, foyer, stage, drawing office, sound, music, cutting room, archive, cinema). Another film can take a ship, a watch, a town, a factory or a body of pipes, as long as it stays one place with rooms that mean something. Each room is a chapter and has its own colour. A new world appears only when the argument moves on.

## Picture

- **Material and light before graphics.** A frame must work as a photograph of a real object. Depth of field, reflections in lacquer and marble, haze in the light, halation, grain. Nothing flat, nothing clean like CG product shots, no empty surfaces.
- **The opening is a photograph.** The first close-up decides the film: a hero object filling the frame, on a long lens, modelled and lit until it survives next to a real photo of such an object.
- **Grown-up.** Muted jewel colours, dark walls, warm practical lamps. No mascots, confetti, pastel or toy look. A miniature is the opposite of cute here: think of a feature film's model unit.
- **No people.** Figures drawn in code have failed every time. The world acts by itself: typewriters type, pneumatic capsules fly, lamps switch on, cameras roll on rails. Cast stays open in the viewer's mind.
- **Section walls.** Rooms sit in black hatched walls like an architect's section (`MAT.poche`). They wipe through the frame when the camera changes floors, which is the transition. One hard cut at most in a film.
- **Backgrounds have depth and detail, calm and dim:** shelves with real books, radiators, curtains, skirting, cables. Every prop has a reason to be in that room. Things stand on surfaces and share one perspective with tight contact shadows.

## Colour

Each room gets its own colour family, always against warm lamp light, with a night-blue outside. Write the colour script into `direction.md` in numbers, like this first film's:

| Room | Wall | Light | Accent |
| --- | --- | --- | --- |
| Outside, night | night blue `#141c2e` | cold moon | wet street |
| Study | bottle green `#10392f` | amber | brass, banker's lamp |
| Foyer | terracotta `#c56a5d` | warm brass | chessboard floor |
| Stage | Klein blue `#0b2fb0` | slightly cool white | flash, paper |
| Drawing office | mustard `#7a5a1e` | warm daylight | posters |
| Sound studio | petrol `#0f2a33` | very little, a red lamp | ON AIR |
| Music room | saffron `#b1801f` | warm | piano black |
| Cutting room | aubergine `#3a1a3f` | light table from below | red stamp |
| Archive | honey `#8a5a2a` | moon through roof lights | brass handles |
| Cinema | velvet red `#5e0f14` | projector beam | gold |

One accent colour belongs to one thing only (the first film: vermilion `#e5391f` for the human's red pen, and in the end the sign on the roof). Reuse makes it mean nothing.

## Type

Text stands in the world, on paper, stamps, index cards, brass plates, screens. It never floats over the picture, and cards keep their reading time.

| Face | Use |
| --- | --- |
| Jost 500, 700 | signs, plates, neon drawn as tubes |
| Courier Prime 400, 700 | typewriter, files |
| JetBrains Mono 400, 700 | code |
| Caveat 700 | handwritten notes |
| Fraunces 600, 900 | headlines, titles |

All five ship in `kit/fonts` under the OFL. Keep them or replace them, but ship whatever you use and await it in `scenes/main.js`.

## Camera

Long lenses (field of view .2 to .7 rad). Depth of field makes the miniature: aperture .0004 to .008, scaled with the distance. Moves are soft and slow; only the journeys between rooms are fast and may smear. Focus lies on what the voice names at that moment. The picture develops every 2–4 s through camera travel and action inside one room.

## Sound

Very quiet chamber music in several pieces whose breaks tell the story: it stops on the word that matters and holds its silence. Paper, mechanics, valves, relays, all far under the voice. Levels and method are in the skill.

## Voice

Dry, grown-up, unhurried; first person when the film is about the one who made it. Real pauses after the lines that need them. Length follows the voice.

## Don'ts

- No drawn or generated people, no faces, no hands.
- No stock icons, flat overlays, infographic panels or lower thirds in front of the picture.
- No floating objects and nothing without a contact shadow.
- No prop that only fills space, no flat thing askew at a frame edge.
- No text from the brief or the user's messages on screen, not even in the code that a film shows of itself.
- No new world every few seconds.
- No bright, even studio light across a whole room: every light comes from a lamp you can point at.
