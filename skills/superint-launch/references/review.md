# Review: the director pass

Adapted from cinetic's director critic (`assets/critics/director.md`, Leonxlnx, MIT). The mechanics of a pass (`superint-video review`, worksheet, strips, close-ups) are in `references/review.md` of the superint-video skill. A product film gets one full pass; a second only when the first changed something big or a P0 remains.

Run it on a contact sheet at a tighter grid than an explainer, because product films move fast: `superint-video review <dir> --every 1`. If your host can start a sub-agent, give it the sheet, `brief.md` and `script.md` without your notes.

## 1. The picture alone first

Read the sheet with the words ignored. For each picture beat write one line: what the product does in it. A beat that reads "nothing happens" or "a screen sits there" gets the product acting (a click, a result appearing, an object transforming) before any word is added. Target: every beat reads at least partly, half of them clearly.

## 2. The checklist

Every item is a yes or a no with frame numbers. A no is a **P0** on the hook, a picture beat's core action, the end card or a hard ban; a **P1** elsewhere. Fix every P0 and the P1s time allows.

1. **What it is by 3 s.** A stranger knows the product's category and what it does from the first line and picture.
2. **Words in the middle.** Statements centred in the middle band for most of their time; none flush left at the top or bottom; "text on top, picture below" at most once.
3. **Line, then picture.** At least two type-only beats (0.5–2.3 s); a line over a picture only where it names what the picture is doing; the first line by 1 s; each picture shows the thing its line said (input → output, before → after) without repeating its words.
4. **One voice, quiet emphasis.** One face; each line arrives differently from the one before; the line centred at every frame of its build; emphasis on at most two lines; no box, marker, pill or underline unless it is the film's one signature.
5. **Seams that flow.** Every hard cut carries something (an anchor held, a blur at the seam, motion carried, an object flying over it); no one-frame swap of unrelated scenes; no move starting at full speed; no seam kind on more than 40 % of the changes. Check every seam with `--strip`.
6. **The spine holds.** One case from first act to last, its names and numbers agreeing; the element handed on at every change; no line-card-line-card loop.
7. **Clean UI.** No accent bar beside a card; stacked rows aligned within 4 px; no text touching an edge; even padding; real strings everywhere (no bracket slot, stand-in number or kit sample); no title cut with "…"; nothing flying over readable words. Close-ups with `--crop` on every screen.
8. **Marks.** Other products' marks current and in one presentation; the end card centred, grown from the last element, held 2–3 s, the name once and one fact under it, alive to the last frame.
9. **Premium, not just clean.** One sharp plane and a blur ladder behind it; one camera move with a job per shot, front-loaded and landing; light from a source; a hero material; the product's real content in quantity. A flat field with small type and a still card fails.
10. **Motion.** Nothing still for more than 0.8 s; no float, drift or bob for its own sake; no bounce on copy; smear only on fast moves.
11. **Sound.** Acts on downbeats, seams on beats, the end card on the last phrase, the track's own ending; SFX only where the picture acts; the music never ducked under effects.
12. **Copy.** Every line passes the line test in [standard.md](standard.md#copy); nothing from the cut-on-sight list.

## 3. Log

Write the pass into `process/review.md`: P0s and P1s with frames, what changed, what stays and why. Then comes the polish pass of the superint-video skill (`references/polish.md`), which looks at the end card at full size once more, and only then the render.
