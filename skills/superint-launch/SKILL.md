---
name: superint-launch
description: Workflow for short product films with Superint Video - launch films, update videos ("v2 is out"), product and feature videos, UI walkthroughs, feature loops, logo stings and social ads, 4-90 s, music-led, with plain-word copy, the product's real UI built in code, one element carried through every scene change, and a brand kit or an invented brand. Use with the superint-video skill when the user wants to launch, announce, promote or demo a product, app, feature or release, in any style preset (launch plus a brand kit is the usual start). Adapted from Leon's cinetic (MIT).
---

# Launch and product film workflow

Read the `superint-video` skill first: it covers the tool, presets, references, the CLI, the live status for Studio and the making-of. Its rule holds here too: everything below is a floor, not a ceiling. This skill plans the film: copy, structure, composition, sound and review. The look comes from the project's `STYLE.md`, a brand kit and `references/`.

The rules are adapted from [cinetic](https://github.com/Leonxlnx/cinetic) by Leonxlnx (MIT), rewritten for Superint Video's engine: HTML scenes and a `video.json` timeline instead of Remotion, `check`/`review` instead of its scripts, and its house taste moved out of the workflow so the style preset can set it.

## The bar

A film a product team would post on launch day: a stranger knows **what the product is by 3 s** and **what it does by the end**, every picture shows the product doing the thing its line says, and the film feels designed, not assembled from components. Priorities, in order: **clear → shown → designed → finished.**

## Formats

| Format | Length | Script | Deliverables |
| --- | --- | --- | --- |
| Launch film | 15–30 s (to 45) | what it is, 3–5 things it does, the close | 16:9 master, 9:16 and 1:1 variants, poster |
| Update film ("vX is out") | 8–20 s | name and version, one line per change, the close | master, 9:16, poster |
| Product or feature video | 8–30 s | what it is, what it does, 3–6 lines | master, poster |
| UI walkthrough | 20–90 s | what it is, one line per step | master, captions |
| Feature loop | 4–15 s, whole bars | 1–2 lines, reads muted | MP4, last frame flows into frame 0 |
| Logo sting | 3–8 s | the name and at most one line | MP4, poster |
| Social ad | 15–22 s | the opener, what it holds, the claim, the close | 9:16 and 1:1 masters |

## Steps

| # | Step | Writes | Gate |
| --- | --- | --- | --- |
| 0 | Intake | `brief.md`, `assets/brand/` | Product, format, length known; brand kit or "invent one"; every reference read. At most three questions, only for what is missing. |
| 1 | Product inventory | `inventory.md` | What it is in one line, its real objects, screens, numbers and strings, from the user's material or its website; nothing invented |
| 2 | Copy | `script.md` | The lines pass the line test in [references/standard.md](references/standard.md#copy); read aloud with the picture off, they tell a stranger what it is and why |
| 3 | Direction and spine | `concepts.md`, `direction.md` | Three directions from [references/directions.md](references/directions.md) dealt, one chosen with reasons; the spine written ([references/structure.md](references/structure.md)): one sentence, 3–5 acts, one case, one element and its forms |
| 4 | Track | `audio/music/`, `beats.md` | A track picked and its bars and downbeats measured; every act and seam on the grid |
| 5 | Ending and style frames | end card, two key frames, `renders/frames/` | The end card reads at thumbnail size; frames hold up next to the references and the brand |
| 6 | Build | `scenes/*.html`, `video.json` | `check` passes; every line and every act on screen; the product's UI built in code with its real strings |
| 7 | Review | `renders/review/<n>/`, `process/review.md` | One director pass ([references/review.md](references/review.md)) finds no P0; a second pass only when the first changed something big |
| 8 | Polish | `renders/polish/<n>/`, `process/polish.md` | Fresh eyes have looked at every still, close-up, cut and move (`references/polish.md` of the superint-video skill, with `--every 1` under 30 s and `--every 2` above) and fixed what they found; a pass is clean and `polish --accept` has recorded it |
| 9 | Render and hand over | `renders/<slug>.mp4` | The render's own numbers check out; the user has the MP4 and the Studio address and watches before anything else happens |
| 10 | After acceptance | variants, `renders/poster.png`, `report.md` | The variants reframed, not cropped, each with its own accepted polish pass; the report names the direction and why, the track and its licence or prompt, and ends with the making-of |

**Read soft, act sharp.** A line is read over the product it names, softly blurred and dimmed behind a dark pool; as the line leaves, the product sharpens and does the thing. The viewer never reads and watches at once, and no frame is a bare text card after the first line.

**Whole film early.** Get a complete rough version on the timeline before polishing any scene: blocked-in scenes cut to the track by about 45 % of the time you have, then polish. A finished film beats a perfect opening.

**Stops** this workflow knows (`new --stop direction,script,frames,contact`): `direction` after `concepts.md`, `script` after `script.md`, `frames` after the style frames, `contact` after the first review sheet.

## Intake

- **Brand kit** (logo, colours, fonts, screenshots, tone) wins over the preset's tokens and over every default here. Copy it into `assets/brand/`, fonts into `kit/fonts/` with their licence. Write what the brand bans into `brief.md` under Avoid.
- **No brand:** design one from three personality words the user gives (or you propose): a name if missing, one sans face, a ground, one accent, a simple mark built from the film's last element. Write it into `direction.md`.
- **The product's real material:** screenshots, the website, the changelog, real UI strings, real numbers. Rebuild screens in code at film size from them; never show a blurred screenshot where the product acts.
- **Preset:** `launch` when the film shows the product (its interface rebuilt in code; the brand kit sets its colours), `blank` for a film without the product on screen, `flat-explainer` for an illustrated product story.
- **The case from a real run:** where the product makes something, use a real result as the case (a film it rendered, a document it wrote) with the real numbers from its logs, so every picture and count is true. Where that result shows other brands, hold a frame, crop or push past it so their names stay unreadable.

## Sound

Launch films are music-led: the track is chosen before the timeline and the picture is cut to it. A voice is optional and short.

- Prefer a licensed track the user supplies (`assets/`, with its licence noted in `report.md`). Otherwise generate one with the `superint-audio` skill (`music`), with a prompt that states BPM, bars, the lift on the reveal and a real ending on the end card.
- Lyria keeps the tempo and key you ask for but not the length: a 32 s prompt came back as 66–83 s pieces built from 16 s (8-bar) sections. Cut the cue on bar lines instead of fading it: measure each variant's sections and attacks (`earshot measure --music` for tempo and key, the loudness per second for the sections), take whole bars of intro, build, lift and peak, and end on the variant's own struck final chord. Join with 40 ms equal-power crossfades that end just before each downbeat, write the cut as a script in `process/`, and let `listen` confirm the joins are inaudible. Check that the final chord rings out: one variant faded its chord out within half a second, another let it ring for 5 s.
- Measure the bars: act changes on downbeats, seams on beats, the end card on the last phrase, the track's own ending, never a fade cut by hand. Keep every time in the scene as a beat of the cue (`grid` in the `launch` kit), so a new cut moves the picture with it.
- SFX from Earshot for actions the picture shows (clicks, keys, toasts, snaps), one hit on the end card, nothing on every cut.
- Credits never appear in the picture; they go into `report.md`.
- Sound effects come from Earshot through `superint-audio` (`sfx kit`, `sfx place`): one kit per film, roles matched to the material of what moves. Without a voice their levels follow the music: under a bright electronic cue keys and ticks sat well at 31 dB under it, snaps at 26, the click at 22 and the hit on the final chord at 18; tune the hit to the cue's root.

## Rules for product films

- Every word, number, name and screen shows the real product. No fake metrics, no stand-in UI text, no invented customers or logos. Other products' marks only in their current official form, from the brand's own site.
- No invented features. When the material does not say it, it is not in the film.
- Length follows the content: a format's range is a guide, a film is delivered whole, never cut to hit a number.
- The first frame is the thumbnail on GitHub, in players and in feeds: open on content (the first line, the product), never on an empty ground. When an entrance leaves frame 0 empty, trim whole beats off the start of picture and music together (`sourceOffsetFrames` on both clips, the SFX moved by as much), so every time stays on the grid.

## Example

[example/superint-video-launch/](example/superint-video-launch/) is the launch film of Superint Video itself (33 s, German, music-led): one scene that rebuilds the start page, a neutral terminal, Studio and the render view in code; the bar of the logo carried from the first line to the end card; the music cut to the film on bar lines. It holds the scene, the plan from inventory to beats and the audio's text files; the case pictures and the music are not included (they show other brands), so it is for reading, not for rendering. Read it before building a similar handover, camera or end card. It shows how things were solved; it is not a template for the next film's ideas.
