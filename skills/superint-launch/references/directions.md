# Directions: composition ideas for product films

A direction is the film's composition idea: its world, how the camera moves, how it cuts, the one signature shot and how the end card is born. It sits between the workflow (what the film says) and the look (the preset's `STYLE.md` and the brand): the same direction plays in a brand's colours or in `flat-explainer`'s.

Adapted from cinetic's `assets/directions/directions.json` (Leonxlnx, MIT; snapshot 2d63a34), shortened to the decisions. cinetic deals them with a script; here you deal them yourself.

## How to use them

1. Filter by what the film has: its format, its length, and what a direction needs (product UI, footage, a number, the product's name as the set, real audio).
2. Deal three that differ in world and camera into `concepts.md`, each written for this product and its case: how the spine's acts play in that world, what the signature shot shows, how the end card grows.
3. Choose one with a reason (what about the product's idea it carries), and write it into `direction.md` with numbers: world and planes, light, the camera's one move per shot, the seam kinds, the signature, the lockup.
4. A second film for the same product takes another direction. No direction fits? Write your own in the same fields.

Not every direction needs 3D or real light: build it in HTML/CSS/SVG/canvas or WebGL as the scene needs. A direction says *what*, the preset says *how it looks*.

## The directions

### The fold (`fold`)

*Every shot is printed on one sheet, and the film moves on by folding it.*

- **Story:** problem-turn. The problem is printed on the sheet; each fold puts one step behind it; the last fold leaves the result face up.
- **World:** One cool sheet fills the frame, seen from a low three-quarter angle as if it lay on an unseen table.
- **Camera:** The sheet folds, creases and unfolds; the camera only leans in and drifts. Between shots: Inside an act there are no cuts: the sheet folds along a crease and its back is the next shot.
- **Cuts:** Folds are the seams (morph and mask); hard cuts only on the music's two biggest accents.
- **Signature, The crease fold:** A 1.5 px crease draws diagonally across a full-frame product panel in 10 f. The far half lifts toward the camera about the crease, 0 to 180 degrees in 26 f on stdInOut, shading with its angle to the key; at 90 degrees it stands nearly edge-on with a 2 px paper edge, and as it lands flat its reverse face shows the next shot, printed and already moving.
- **End card:** The sheet folds in half twice more, each fold faster (18 f, then 12 f), down to a small square that is the mark printed on its last face; the name prints beside it as the square lands flat.
- **Fits:** launch, feature, sting, vertical, update; 8–40 s

### Noon relief (`relief`)

*The product's screen is cast as a relief in one matte material, and a moving sun decides what the viewer sees.*

- **Story:** many-to-one. A raking light shows every raised thing at once; the light climbs, the shadows give up, and only the one thing the product surfaces keeps its shadow.
- **World:** The product's interface cast as a shallow bas-relief in one matte material: every element raised 4-40 px by its importance, seen from a high three-quarter camera.
- **Camera:** The light: the key climbs, swings and settles; the camera is locked high and only creeps. Between shots: The key drops to 3 degrees, the relief falls to near dark (a light seam), and the next shot rises with the key; act changes cut on the music.
- **Cuts:** Seams carried by the light: the key sinks and rises across them; hard cuts only on the music's entries.
- **Signature, The noon lift:** Under a key at 8 degrees every raised element throws a shadow 4-5 times its height across the floor. The key climbs to 72 degrees in 1.2 s on stdInOut: every shadow shrinks under 15 px, while the one element the product surfaces rises from 40 to 260 px over the same 1.2 s, so its shadow alone stays long (about 85 px) and it ends the tallest, sharpest thing in the frame.
- **End card:** The mark is cast in the same relief, 60 px high, at the centre of a cleared floor; the key settles at 35 degrees and the name lies on the floor beside it, debossed 1 px.
- **Fits:** launch, feature, loop, sting, update; 8–35 s

### Macro bench (`macro-bench`)

*The product made physical and seen through a macro lens: materials and focus, not cuts, move the story.*

- **Story:** detail-to-whole. Open on a surface too close to name; each rack pulls back one step until the detail is understood as part of the product.
- **World:** The product's parts as physical materials at macro scale: a control in matte silicone, an anodised edge with brushed micro-streaks, a printed card whose ink shows its dot structure.
- **Camera:** Focus: a rack between planes carries attention and hides changes. Between shots: Defocus seams: the outgoing shot throws out of focus, the cut lands inside the softness and the new plane snaps sharp; a defocus pulse hides a jump in scale.
- **Cuts:** Carried by focus: defocus cuts and rack hand-offs, never a crossfade.
- **Signature, The focus relay:** A brushed edge 3 px wide on the product fills the left third at 40x, sharp, its streaks catching the sheen; behind it the product is soft tone. The focus racks through three planes in 30 f (the edge, a middle row of printed dots, the far panel), and on frame 15, where the middle plane is softest, its content changes, so the far plane snaps sharp already in its next state.
- **End card:** The mark is embossed in the material at macro scale and racks sharp out of soft tone; a pull back of x6 shows it small on the product's corner, the name printed beside it with its dot screen.
- **Fits:** launch, feature, loop, sting, update; 8–30 s

### One surface (`one-surface`)

*Every state of the product lives on one huge surface; the film is a single camera journey across it.*

- **Story:** journey. One continuous trip across the product's map, each region a stop, until the camera leaves the ground and the whole map is the answer.
- **World:** One very large flat canvas, 5-12 frames wide, holds every shot as a region (the problem, each proof, the payoff), laid out like a plan and joined by the product's own connectors.
- **Camera:** The camera: whips, pull-backs and reframes between regions; the regions themselves barely move. Between shots: No cuts: a whip with a copy swap on its peak, a zoom-out hop, a pull back that reverses into a push.
- **Cuts:** One take: carried velocity everywhere; at most one hard cut, on the music's biggest accent.
- **Signature, The whole-map reveal:** After the proof, the camera pulls back in one log-scale move, x30 over 3 s on strongInOut: every shot the viewer has seen is still there, running, as one region of a single plan joined by the product's connectors, and the pull settles over its last 20 f on the whole surface, which reads as the product's own shape.
- **End card:** The pull reverses into a last push onto one more region of the surface, the one that holds the mark printed at region size; the camera settles and creeps.
- **Fits:** launch, feature, walkthrough, loop, update; 12–45 s

### Depth dive (`depth-dive`)

*The film flies forward through stacked planes of the product; every plane passed is a step left behind.*

- **Story:** accelerando. The flight starts already moving and only gets faster between reads, until it brakes dead on the one screen that matters.
- **World:** A field that reads as thirty to forty planes, each a real state of the product (a screen with its type, a card with its data, a statement, a mark), floating at different depths in one clean void, facing the camera.
- **Camera:** The camera: a forward flight that never stops; speed is the expression, slow in the reads, fast between them. Between shots: Fly-through: a plane passes the lens and the next one is the new frame (zoom-through seams); the flight speed is carried across every cut.
- **Cuts:** Carried velocity: zoom-throughs and velocity cuts; never a cut from rest.
- **Signature, The field flythrough:** The camera accelerates through the field in 2 s, passing about thirty planes, each a real state of the product. Near planes swell past the frame edges on both sides while far ones barely move, and the flight brakes over its last 18 f as one plane arrives square to the lens at 100 % of the frame: the hero screen, already alive.
- **End card:** The last plane is the mark; the flight stops dead on it on the final hit with no settle, and the name sits on the same plane; one quiet creep of 1 % per second until the end.
- **Fits:** launch, sting, vertical, loop, update; 6–30 s

### Rollout (`rollout`)

*The frame is a wall of three hundred double-sided tiles, and every change the product makes rolls across them.*

- **Story:** one-to-many. One tile turns, then a wave carries the change to all of them; four waves, four changes, the last one claiming the whole wall in the accent.
- **World:** About 300 square tiles (20 x 15 at 1080p, 2 px ink gaps) are the whole frame, the wall turned 8 degrees to the camera so a turning tile shows depth.
- **Camera:** The tiles: waves of turns carry every change; the camera is locked and only creeps. Between shots: A wave of turns is the seam: the next shot is on the tiles' backs; act changes cut on downbeats.
- **Cuts:** Cuts on sound: every wave starts on a downbeat; the waves themselves carry the change.
- **Signature, The flood roll:** On the downbeat at the turn the tile under the held shape's centre turns first; a diagonal wave spreads from it, each tile turning 180 degrees about its vertical axis in 8 f with a 1 f stagger per diagonal step, so the whole wall has turned in 42 f. Tiles shade as they pass 90 degrees and land one step brighter, and their backs are the accent: the wall becomes one accent field from the shape outward.
- **End card:** A last roll turns every tile to the plain ground except those under the mark's silhouette, which stay in ink: the mark built of tiles; then its tiles close their gaps from 2 px to 0 over 12 f.
- **Fits:** launch, sting, vertical, loop, feature, update; 6–30 s

### Cut and paste (`cut-and-paste`)

*An unseen hand assembles the film from cut-out pieces of the product at 16 frames a second while the camera glides at 60.*

- **Story:** assembly. Scraps pile up as the problem; the hand builds them into the product; the last pieces are the name.
- **World:** An overhead table of one cool ground.
- **Camera:** The pieces: births, swaps and stacks on a 16 fps cadence; the camera glides smoothly at 60 above them, two cadences at once. Between shots: Stepped seams: the table is cleared or covered piece by piece; a hard cut on a beat at most once per act.
- **Cuts:** Stepped: the collage builds and clears on its own cadence; act changes cut on sound.
- **Signature, The stop-motion build:** Over 2 s, on a 16 fps cadence, cut-out pieces of the product land one by one at irregular 2-6 frame gaps, each at 100 % size and opacity on its first frame, stacking into the full product screen, while the camera pushes in smoothly at 60 fps, x1.15 over the whole build.
- **End card:** The name arrives as cut-out letters placed one per 16 fps step at irregular gaps, the mark's parts last; the camera keeps gliding over the still letters.
- **Fits:** launch, sting, vertical, loop, update; 6–25 s

### Wells (`wells`)

*The product's modules are wells sunk into one slab; the one that matters rises out of it toward the lens.*

- **Story:** nested. A board of live modules; one rises and fills the frame, and inside it is the next board, one level deeper.
- **World:** A thick slab of one mid-tone material fills the frame, seen from 30 degrees above; a 3 x 4 grid of square wells 40-80 px deep is cut into it, each holding a live part of the product on its floor.
- **Camera:** The slab: floors rise and sink on the beat; the camera is locked except for one log-scale push at each rise. Between shots: A rise fills the frame and the next board is inside it; other changes step on sound.
- **Cuts:** Stepped and on sound: layout changes on music accents; one carried rise per act.
- **Signature, The rise:** One well's floor rises 80 px in 24 f on settleOut until its content stands proud of the slab, while the other eleven floors sink 30 px and their shadows deepen; the camera pushes in on a log curve, x3.2 over the same 24 f, so the risen cell fills the frame and its content is the next board, already sunk into wells.
- **End card:** The last rise lifts a cell whose floor carries the mark cut into it as a shallow relief; the key swings 15 degrees and the mark's edges catch it; the name on the slab beside the cell.
- **Fits:** launch, feature, sting, loop, vertical, update; 6–30 s

### Monument type (`monument`)

*The product's name, set so large it becomes the set; the camera travels its letterforms.*

- **Story:** detail-to-whole. Start inside a stroke where nothing reads; travel the letters, look inside one; pull back until the word is the name.
- **World:** The product's name at giant scale (900 px and up, cropped by the frame) is the architecture: the camera moves along its strokes, counters and edges, and product details live inside the counters and on the letter faces.
- **Camera:** The camera: tracks along strokes, banks round curves, dives through counters. Between shots: Carried: the camera leaves one letter at speed and enters the next; a zoom-through a counter.
- **Cuts:** Carried seams: velocity and zoom-throughs; one hard cut on the payoff.
- **Signature, The counter window:** The camera trucks along the bowl of a giant letter at 2 px/f, then pushes into its counter at a constant ratio, x12 in 40 f: the hole inside the letter widens to fill the frame and is the product, running. On the pull back the whole word comes into view at 60 % of the frame width.
- **End card:** The pull back keeps going until the giant word is the name at lockup size, the mark set as its first letter or beside it; the counter that held the product is the last thing still lit.
- **Fits:** launch, sting, vertical, loop, update; 6–30 s; needs the product's name as the set

### Census (`census`)

*Hundreds of the product's own units fill the frame; the film is what the product does to all of them at once.*

- **Story:** one-to-many. One unit's pain, then the camera rises to show four hundred like it; the product sorts them all in one pass.
- **World:** A field of hundreds of the product's units (rows, tickets, files, alerts, each a small real object with its state) lies on a floor plane.
- **Camera:** The field: waves of state change cross the units; the camera cranes from overhead to a low angle and back. Between shots: An isolating push into one unit and out of the next; breath on the cuts.
- **Cuts:** Carried: the field is continuous; chapter changes cut on sound.
- **Signature, The sorting wave:** Four hundred units, each showing its own state, sit in random order. A wave front crosses the field from left to right in 2.4 s, and every unit it passes slides to its ranked place over 18 f, 0.6 f apart, so behind the front the field is sorted and the one unit that matters ends at the head of the field in the accent.
- **End card:** The field sinks into the floor unit by unit from the edges inward, leaving the mark where the one unit that mattered stood; the name beside it on the floor.
- **Fits:** launch, feature, walkthrough, loop, vertical, update; 8–40 s

### Turntable (`turntable`)

*The product is one solid object with real weight; it turns under a fixed light, and its back holds what comes next.*

- **Story:** result-first. The finished object first, heavy and still; then it turns, face by face, to show how it got there.
- **World:** The product as a solid block (its screen or the mark, with a real depth of 15-25 % of its width) standing on an endless matte floor under one fixed key; it casts a shadow that swings and stretches as it turns.
- **Camera:** The object turns with weight; the camera orbits slowly the other way. Between shots: A half-turn brings the back to the camera; a press tilt hides a state change.
- **Cuts:** Carried: turns and press tilts; no hard cuts inside the object's story.
- **Signature, The weighted half-turn:** The block turns 180 degrees in 40 f with inertia: fast for the first 12 f, a long settle, a 2-degree overshoot back on landing. Its four side faces sweep through the key and shade by angle, its shadow swings and stretches with the footprint, and the face that ends square to the lens is its real back, which carries the next state.
- **End card:** The block turns a last quarter and shrinks on the floor into the mark as a solid, its shadow settling under it; the name prints on the floor beside it.
- **Fits:** launch, feature, sting, loop, update; 8–30 s

### Exploded view (`exploded-view`)

*The product comes apart into its layers so the viewer sees how it works, then snaps back whole.*

- **Story:** assembly. The interface in use; it comes apart to show the one layer doing the work; it snaps back and the result is simply there.
- **World:** A three-quarter view from above of the product's interface on a cool floor.
- **Camera:** The layers separate, slide and rejoin; the camera holds its three-quarter view with one crane at the explode. Between shots: The stack rejoins flat and turns front-on: the flat UI is the next shot (a shape match).
- **Cuts:** Carried: shape matches from the 3D stack to the flat UI; chapter changes cut on sound.
- **Signature, The layer explode:** The live interface turns to a three-quarter view and its layers lift apart along depth one after another, 60 px apart with a 4 f stagger. The camera cranes 18 degrees between them to the one layer that does the smart part, it lifts in the accent, then the stack snaps back together in 14 f and turns flat to the camera, landing as the frontal product.
- **End card:** The layers collapse onto one thin plate that is the mark, the smart layer last; the name on the floor beside it.
- **Fits:** launch, feature, walkthrough, update; 10–45 s; needs product UI

### One shape (`one-shape`)

*One shape keeps becoming the next thing: no cuts, only changes of role.*

- **Story:** chain. The product's one control changes role on every beat, each role causing the next, until it opens into the world it was for.
- **World:** A clean ground and one shape (the product's own control: a pill, a bar, a field) that morphs from role to role (progress bar, caret, button, window, card, word container, mark); everything else is born from it or returns to it.
- **Camera:** The shape swells, collapses, stretches and opens; the camera follows it with a lag and scales with it. Between shots: Morph seams only: the shape grows into a window whose interior is the next scene, or collapses to a dot that opens the next.
- **Cuts:** One take: a morph chain with zero hard cuts until the lockup.
- **Signature, The swell into a window:** A small pill holding one word swells by half its width over 12 f, the word leaves, and the pill keeps growing in both axes for 20 f while its corners square to the frame's aspect, so its interior opens as a window onto the next scene, already running; the window's edge leaves the frame on its fastest frame, 100 % wide.
- **End card:** The shape collapses from the window into the mark's silhouette in one 18 f move; the name slides out of it.
- **Fits:** launch, feature, loop, sting, vertical, update; 6–25 s

### The wall (`wall`)

*Sixteen screens of the product in sixteen real moments play on one beat, then slide together into one picture.*

- **Story:** many-to-one. Everyone, everywhere, on one beat; then every panel turns toward the same moment and the wall becomes one frame.
- **World:** A wall of 12-24 live panels (4 x 4 at 1080p, 6 x 4 for longer films) with 10 px ink gutters fills the frame; each panel shows the product in a different real moment (a person, a time of day, a device size), all cut to the same beats.
- **Camera:** The panels: sixteen own cameras on one beat; the wall itself only breathes until the converge. Between shots: Every panel cuts on the same downbeat; a wave of state changes crosses the wall; the converge closes it into one frame.
- **Cuts:** Cuts on sound: all panels cut together on downbeats; inside a panel, carried moves.
- **Signature, The converge:** On the downbeat every panel's camera starts toward one shared picture; over 48 f each panel pans and zooms on its own curve (2 f stagger from the centre outward) until all sixteen show adjacent pieces of one full-frame shot of the product, the gutters close from 10 px to 0 on the last 8 f, and the wall is one frame.
- **End card:** The one frame pulls back x3 until it is a single panel again in an empty wall of ground; the mark and name sit in the gutter space below it.
- **Fits:** launch, feature, vertical, loop, update; 10–40 s; needs product UI

### Odometer (`odometer`)

*One number counts through the whole film, and its digits are the set.*

- **Story:** accelerando. The number climbs with the problem, the product reverses it, and the reels speed up into the one value the product can stand behind.
- **World:** Giant digit reels (each digit a masked drum) fill the frame like machinery; the camera rides along and into the drums, and the product's other objects appear as the units being counted.
- **Camera:** The reels: drums spin, step and lock; the camera rides down a spinning drum and across to the next. Between shots: A vertical whip down a reel to the next scene (the drum is the cut); a snap zoom out to the whole number.
- **Cuts:** Cuts on the counter's locks, each lock on a music accent; vertical whips carry between them.
- **Signature, The reel ride:** The camera dives into the last digit's drum while it spins and travels down the reel with it (the numerals stream past as a stepped strip, one numeral per 5 f), slows with the reel over 40 f and lands, square to the lens, on the locked final digit as the whole number snaps into view on a one-frame zoom out of x4.
- **End card:** The drums roll on past the number into letter strips and lock on the name one drum at a time, left to right, each lock a tick; the mark locks on the first drum.
- **Fits:** launch, feature, sting, vertical, loop, update; 6–30 s; needs one real number

### Waveform (`waveform`)

*The product's real sound becomes a landscape, and the camera rides it as it plays.*

- **Story:** call-response. A sound plays into noise; the product answers by clearing the ground under it; the sound and the landscape end on the same note.
- **World:** The real recorded clip, analysed once at build time into 48 time slices x 64 frequency bands, stands as a landscape of 48 ridges on a floor plane tilted 60 degrees: across is frequency, depth is time, height is energy.
- **Camera:** The sound: the landscape is the clip and the camera rides it at the clip's own speed. Between shots: Cuts between words, at the envelope's quiet points, to the next stretch of landscape from a new angle.
- **Cuts:** Cuts on sound: only in the gaps between words; inside a phrase the ride is continuous.
- **Signature, The clean pass:** As the sound starts, a front moves with the playhead: every ridge it passes loses its noise floor (bands under the threshold drop to zero height over 6 f), so behind the front (ridges 40 px apart) the field is flat and quiet except the sound's own peaks, which stand up x1.4 as each one plays, a copy fragment printed flat on the floor beside the peak it names.
- **End card:** The sound's last peak stands up, settles flat, and the name is printed on the floor where it stood, the mark beside it; the ride slows to a creep.
- **Fits:** launch, feature, sting, loop, vertical, update; 8–35 s; needs the product's real sound

### Inside the document (`document`)

*The film plays inside the product's own document, and its last full stop opens onto the work the line started.*

- **Story:** whole-to-detail. The document at true scale; a line is typed; the camera falls into its final full stop, and inside it the product is already working.
- **World:** The product's own canvas (an editor, a terminal, a doc, a design file) at true scale, full bleed.
- **Camera:** The edit: select, retype, insert, delete; the camera punches in on the caret at each interaction and falls into the last full stop. Between shots: Punch-in inserts on the same render; a cut on the key press; the full-stop dive into the next scene.
- **Cuts:** Cuts on sound: hard cuts on key presses and clicks; edits inside a shot are carried; the dive is one carried move.
- **Signature, The full-stop dive:** The last line of copy is typed and ends on a full stop. The camera zooms into that full stop at a constant ratio, x20 over 1.4 s (1.036 per frame at 60 fps, so the speed feels even), until the glyph is a disc of ink about 260 px wide; the disc opens as an iris to the far corner in 18 f onto the process the line started, already running at true scale.
- **End card:** Back in the document, the caret types the name on a fresh line at the house rate; the mark sits at the start of the line like an icon; the caret blinks twice and stops.
- **Fits:** launch, feature, walkthrough, loop, vertical, update; 8–45 s; needs product UI

### Diorama (`diorama`)

*The product's process is built as a miniature line under one key light, and the film follows one unit through it.*

- **Story:** journey. One unit enters the model at the left and leaves at the right finished; every station on the way is something the product does to it.
- **World:** A tabletop miniature seen from 35 degrees above with a long lens: the product's process as 4-6 stations built from simple extruded blocks (a sorter, a press, a gate, a shelf), one unit (an order, a file, a build) travelling between them on a track.
- **Camera:** The unit: it travels, stops, is acted on and moves on; the camera trucks with it at model scale. Between shots: The camera lets the unit run ahead 0.4 s and catches up with a carried move at the next station.
- **Cuts:** Carried: lateral velocity runs through every station; one hard cut to the overview crane.
- **Signature, The station run:** The unit enters a station; its parts move in turn (a gate drops 20 px in 6 f, a press comes down 30 px and lifts in 14 f) and the unit leaves transformed, its top face changing state on the press's contact frame with a 2 f squash; the camera trucks with it, lets it run ahead 0.4 s and catches up at the next station.
- **End card:** The last station is the mark built as a small extruded building; the finished unit rolls into it and the key catches its edges; the name printed on the table in front.
- **Fits:** launch, feature, loop, walkthrough, update; 10–40 s

### Foreground pass (`foreground-pass`)

*Life passes in front of the lens, and every time it clears, the product has already done its job behind it.*

- **Story:** problem-turn. A day passes in the foreground; behind it the problem is solved in the gaps, one pass at a time, without anyone stopping.
- **World:** Three planes: a far product world, a middle plane with the subject, and a near plane of large dark shapes from the user's day (a door frame, a calendar page, a phone's edge, a shoulder) that slide sideways across the frame and hide it.
- **Camera:** The near plane: occluders slide across the lens and hide every change; the camera trucks laterally with strong parallax. Between shots: Motion-masked swaps: the change happens behind the occluder on its full-cover frames; no visible cut.
- **Cuts:** Carried by occlusion: every scene change hides behind a passing foreground.
- **Signature, The occluder swap:** The camera trucks right past the product at 3 px/f. A huge soft dark shape from the user's day (1.5x the frame height, pre-softened) slides across the whole frame in 12 f, and when it clears, the world behind is the next scene at the same camera speed, the product's result landing sharp in the middle plane.
- **End card:** One last shape slides across and leaves nothing behind it but the ground and the mark in the pool of light; the name follows.
- **Fits:** launch, feature, sting, vertical, update; 8–30 s

### Resolution (`resolution`)

*The product's images arrive out of coarse blocks; resolution is the film's measure of quality.*

- **Story:** reveal. A picture nobody can read; each halving of the cells is one thing the product does; at full resolution it is the result.
- **World:** A flat world where the product's images and its screen start as coarse square cells (8-64 px) and resolve by halving on the beat; each cell is the true average of the image under it, and the edges between resolved and unresolved areas are crisp cell edges.
- **Camera:** The cell size: halving on the beat, the cell front crossing; the camera snap-zooms on the step frames. Between shots: A cell front from a word opens the next scene; hard cuts on the downbeat between images.
- **Cuts:** Stepped and on sound: every resolution step on a music event, declared as stepped.
- **Signature, The cell front:** From the word the product names, a square of resolved image grows outward by whole 36 px cells, one ring of cells per frame, reaching the frame's corners in 30 f. Only the two rings at its edge are coarse (36 px, then 18 px cells); inside, the next image is already at full resolution, outside it the old one is still clean, so a stepped square of sharpening crosses the frame.
- **End card:** The mark resolves from four cells to exact in four steps on the last bar; the name is clean from its first frame.
- **Fits:** launch, sting, vertical, loop, update; 6–25 s

### Sundial (`sundial`)

*The week stands on a floor as blocks of days, and one day passes over it while the film plays.*

- **Story:** day-arc. Dawn on a crowded week; the sun crosses; by evening the product has made room, and the long shadows fall on a week with space in it.
- **World:** Five to seven day-blocks (each a slab as high as that day is full, its top carrying the day's meetings as raised tiles) stand on a mid-tone floor seen from 40 degrees above; the product's focus block stands tallest at the centre like a gnomon.
- **Camera:** Time: the sun crosses and the shadows sweep; the camera only creeps and cranes a few degrees. Between shots: No cuts inside the day; act changes are carried by the light (dawn, noon, evening) and cut on the music only at the turn.
- **Cuts:** Carried by the sun: the day is one continuous light; at most one hard cut, at noon.
- **Signature, The shadow week:** The focus block's shadow sweeps across the floor from Monday's block to Friday's in 3 s as the sun swings 100 degrees; each day the shadow edge crosses, its scattered meeting tiles slide together (12 f each, settleOut) into the gaps the product found, and the cleared stretch lies in the shadow as one long block of focus time.
- **End card:** The sun sets: the last low ray at 3 degrees rakes across the floor and catches only the mark, cut into the floor as a shallow relief; the name lies beside it in the last light.
- **Fits:** launch, feature, loop, walkthrough, update; 10–40 s

### Footage reel (`reel`)

*Real footage breathes with the music, and the product's type locks onto it.*

- **Story:** accelerando. Footage ramps on the music, each ramp a little faster, until the product's moment freezes on the peak.
- **World:** Real supplied footage, graded into one cool duotone toward the accent hue (ink to paper through one hue) and speed-ramped on the music; flat type and product UI sit on top, locked to points in the footage.
- **Camera:** Time: the footage speeds up and slows down; each cut lands on the fastest frame of a ramp. Between shots: Speed-ramp joins on the peak; shape match cuts between clips; type carried across the cut as an anchored overlay.
- **Cuts:** Cuts on sound: ramp peaks land on the music's accents; anchored overlays carry the type across hard cuts.
- **Signature, The payoff ramp:** Clip A slows to 0.3x as its subject reaches the centre, ramps to 3x over 10 f, and the film cuts on the fastest frame to clip B entering at 3x with the same direction of motion, which brakes to 0.5x exactly under the anchored line of type.
- **End card:** The last ramp freezes on its peak frame and settles back into the duotone over 12 f; the name and mark set over the still in quiet type, one creep of 1 % per second.
- **Fits:** launch, sting, vertical, feature, update; 8–30 s; needs footage

### Chain reaction (`domino`)

*Every step the product automates is a standing slab, and the film is one push that topples them all.*

- **Story:** chain. One tap; each step knocks over the next; the chain runs the whole flow without a hand, and the last slab starts the result.
- **World:** A line of 12-30 standing slabs (each a step of the product's flow, its face showing that step) winds across a mid-tone floor in a gentle S, seen from a low three-quarter angle under a raking key; each slab 1.6x as tall as it is wide and 0.2x as deep.
- **Camera:** The chain: slabs fall in order at a steady rate; the camera follows the falling front with a lag. Between shots: One take: the chain is continuous; the camera only rises to the overview as the last slab falls.
- **Cuts:** One take: the chain never cuts; at most one hard cut, to the result the last slab starts.
- **Signature, The topple:** One tap tips the first slab; each slab falls 75 degrees in 14 f, accelerating like a real fall, and strikes the next on its contact frame, so the chain runs at a steady 5 slabs a second while the camera follows the front with a 0.3 s lag. Each slab's face, as it lands, shows its step done; the last falls onto a plate that starts the product's result.
- **End card:** Every slab lies flat except one left standing at the end of the line, which turns face-on in 20 f: it is the mark; the name lies on the floor beside it.
- **Fits:** launch, feature, loop, sting, vertical, walkthrough, update; 6–30 s

### Shadow play (`shadow-play`)

*A light, a wall and the product's objects: the shadows tell the story, and the object casting them is the turn.*

- **Story:** twist. The wall shows a frightening shadow; the object casting it moves toward the wall and turns, and the shadow becomes the product's clean shape.
- **World:** One mid-tone wall fills the frame, lit by a single point light off-frame at the lower left.
- **Camera:** The objects between light and wall: they move nearer and farther and turn; the camera drifts along the wall. Between shots: A shadow grows until it covers the wall and the next scene is in its shape (a mask seam); a defocus seam when an object passes close to the light.
- **Cuts:** Carried by shadows: covers, shrinks and turns; one hard cut at the reveal of the real object.
- **Signature, The reveal turn:** A huge soft shadow fills the wall: the problem, a tangle. The object casting it moves from the light toward the wall over 40 f, so the shadow shrinks x4 and sharpens, and in its last 12 f it turns 90 degrees about its vertical axis: the tangle's silhouette resolves into the product's clean shape.
- **End card:** The last object turns and its shadow is the mark; the object itself never enters the frame; the name is printed on the wall beside the shadow.
- **Fits:** launch, feature, sting, loop, vertical, update; 6–30 s

### The statement (`statement`)

*The words are the picture: one line at full size on a clean field, built word by word on the beat, and the product answers it full frame.*

- **Story:** call-response. The line calls (the problem in a few words); the product answers full frame; the line calls again, shorter; the answer is the result; the last word left on the field is the name.
- **World:** A clean flat field fills the frame: no texture, no plate, no footage behind a read.
- **Camera:** The type and the product move; the camera locks for every read and pushes only into the product. Between shots: Hard cuts on the beat between a line and the product; the line re-centres as each word lands.
- **Cuts:** Hard cuts on beats between the line and the product; each word lands on a beat; one colour seam on the payoff.
- **Signature, The built line:** On four consecutive beats one word each cuts on at full size, centred and frontal on the flat field (the line at 11 % of the frame height, each word whole on its first frame); the line re-centres 70 % of its shift on frame one; on the fourth beat the field flips to the accent in 1 f and the type to near-white, and the line holds still for 0.8 s.
- **End card:** The last line's words leave on one frame except the last, which is the name; the mark cuts on beside it on the next beat, the unit frontal and centred on the clean field at 45 % of the frame width, held 1 s.
- **Fits:** launch, feature, sting, vertical, update; 8–40 s

### The slot line (`slot-line`)

*One fixed phrase stays centred on a clean field while its last word rolls on the beat, and every new word opens the product full frame doing exactly that.*

- **Story:** one-to-many. One phrase, many endings: each rolled word is one thing the product does, shown full frame; the last word the slot lands on is the name.
- **World:** A clean flat field; one phrase set frontal at 9 % of the frame height with a word slot at its end (a window the width of the longest word, a 1 px hairline under it).
- **Camera:** The slot rolls and the product runs; the camera holds still and racks focus between the phrase and the product. Between shots: Carried: the roll's speed carries into the product's first move (launch into the roll, carry out of it).
- **Cuts:** The roll is the seam: each word rolls up out of the slot at speed and the product's first move carries that speed; one hard cut on the payoff.
- **Signature, The slot roll:** The slot word rolls up out of its window in 12 f (a masked roll on snapOut, the new word whole on its first frame at 9 % of the frame height) on the beat; as it lands, the product behind the phrase cuts to the state that word names, its first move carrying the roll's 40 px/f; four rolls over 4 bars, each 0.5 s sooner than the last.
- **End card:** The slot rolls one last time, to the name; the phrase leaves on one frame, the name re-centres with the mark beside it, the unit centred on the clean field at 40 % of the frame width, held 1 s.
- **Fits:** launch, feature, loop, vertical, update; 8–35 s
