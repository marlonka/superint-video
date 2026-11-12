# Composition: how an explainer is staged, paced and cut

The composition grammar of an explainer, independent of the look. The preset's `STYLE.md` says how things look; this page says what is on screen when, how the camera moves and when the film cuts. Written first for `flat-explainer`, it holds in any preset.

## Shots

- **Show the real thing.** Draw what the sentence is about: the people, places, objects, machines, documents, money and maps of the topic. A film about a tax shows the minister at the lectern, the companies, the office that collects it, the money and the border it crosses. A metaphor is allowed only when every viewer reads it at a glance without explanation (a seesaw, a race, a leaking bucket, a stack of coins); it gets a label and lasts a sentence or two, never the whole film.
- **Few worlds, travelled smoothly.** A film is made of a few connected worlds, one per chapter of the argument: about 2–4 per minute, rarely more than 6–8 in a 3-minute film.
  - Each world is a large, continuous place: a street with its shops, an office floor, a port with its town, a map that becomes a landscape.
  - Inside a world the camera travels: it pans along the street, pushes in on a shop window, pulls back to reveal the next part, and follows a character who walks from one place to the next.
  - New subjects enter that world; the world itself does not swap.
  - Never cut to an unrelated new design every few seconds. That reads as hectic channel-surfing, not as one film.
- **Something new every 2–4 s, a cut much more rarely.** The picture keeps developing on the voice: the camera moves to a new subject, a character acts, objects arrive, build or transform, an inset opens.
  - A hard cut or transition to another world comes on a chapter or sentence boundary, typically every 10–30 s.
  - Short cut sequences (two or three quick cuts) are a device for one moment, such as a list of examples, not the rhythm of the film.
  - A label appearing in an unchanged picture is not development.
- **The picture matches the words.** What the voice names is on screen in that sentence, and nothing on screen needs an explanation the film never gives. If a viewer could ask "what is that ball?", it is a defect.
- **Events on their word.** One motion idea per beat: reveal, then hold. Events happen on their word (±2 frames once word timestamps exist). Every element has an exit: when its beat is over it leaves, and nothing lingers into the next idea.

## Transitions between worlds

Crafted, and only at chapter changes:

- the camera travelling on into the next place;
- a character walking out of one place into the next;
- a match cut on a shape;
- a dive through a window, screen or document;
- a circle wipe or a soft crossfade of 10–20 frames.

A plain cut on a sentence boundary is fine in between. Zooming through scale is one tool for a single moment, not the structure of the film.

## Colour across the film

One art direction for the whole film, with a colour script along it: each world has its dominant hue family, colour shifts gradually within a world and clearly between chapters, and never jumps to a new palette every few seconds. Write the colour script into `direction.md` (world → dominant hue, background values, accents, how it shifts). The preset decides which hues exist.

## Pacing (60 s explainer)

| Part | Time | Job |
| --- | --- | --- |
| Hook | 0–5 s | A striking picture of the situation or the question, in a vivid place. Not a logo. |
| Setup | 5–15 s | What is proposed or what everyone assumes, shown with its real actors. |
| Body | 15–45 s | The mechanism or the reasons, one world per chapter; the camera travels through it while the voice develops the point. |
| Aha | 45–52 s | The strongest image of the film: the point that decides it. |
| Message | 52–58 s | The one sentence the viewer repeats, over its own image. |
| Outro | last 3–6 s | An end card: title or message, the music's final chord, a calm hold. A film never ends on its last word. |

Scale it to the length the voice needs. Narration runs at about 150 words per minute (≈2.5 words/s); a scene with 15 spoken words needs about 6 s.

## Don't

- One world that the camera zooms around in for the whole film.
- Symbol worlds the viewer has to decode (a river for wages, a dam for a tax, a mill for the welfare state) in place of the real thing.
- Filler scenes ("Let's dive in", "Stay tuned"), fake statistics, or numbers that are not in the claim register.

## Pitfalls

- **Slideshow in one place:** shots that keep the same view and only swap labels. Move the camera, let something happen, or bring a new subject in.
- **Channel-surfing:** a new place with a new design every 5–10 s, each cut with a different palette and layout. The film falls apart into slides. Stay in the world, travel through it, and change worlds only with the argument.
- **Coded metaphor:** if `direction.md` needs a sentence to say what an object stands for, the viewer won't get it. Show the real thing, or label the metaphor in the picture.
- **No ending:** a film that stops a second after its last word feels cut off. End on the message image, then the end card with the music's final chord.

Visual devices that work inside this grammar (persistent instruments, scale insets, reveal with light, before and after …) are in [visual-devices.md](visual-devices.md).
