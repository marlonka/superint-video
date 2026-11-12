# Structure: the spine, film shapes and handovers

Adapted from cinetic (Leonxlnx, MIT): `references/spine.md` and `references/templates.md`, rewritten for HTML scenes and a `video.json` timeline. Write the spine into `direction.md` before any picture.

## The spine: one action, carried

A launch or update film that reads as one idea follows **one action** from end to end. It is one sentence played as 3–5 acts; every act is one verb of that sentence, done to **one case** (the same request, names and numbers from the input to the result) by **one element** whose form changes from act to act. Every change of scene hands that element on.

A film built as "a line, then a card, then a line, then a card" is a checklist of moments with no idea joining them. A spine is a chain: *the word becomes the pill becomes the page becomes the count becomes the mark*.

### The sentence and its acts

Write the film as one sentence: "[Name] [verb 1]s [the case], [verb 2]s it, [verb 3]s it." Each verb is an act.

| Part | Rule |
| --- | --- |
| Sentence | One action; a film that needs "and also" is two films: cut one idea |
| Acts | 3–5 for a launch (4 for 15–35 s, 5 from about 45 s); 3–4 for an update (the hook and 2–3 changes) |
| Shares | The first act about a quarter of the body, the last about a fifth, the middle acts the rest |
| Scenes | 1–3 states of the element per act, each a change of its state (cause, action, result), 1.5–3 s each |
| Changes | Every scene change hands the element on; a bare cut (nothing carried) only between two acts, on a downbeat, once a film at most |

An update film plays the same way: one session, the same person doing one task that uses each change in turn, ordered by the session, not by importance.

### The case

Pick the one request, record or person every act works on, in real words from the brief and the inventory: the sentence typed into the input, the page it makes, the names on the notifications, the number on the count. The request made early is the result shown later; names and numbers agree from act to act. List the case's strings in `direction.md`.

### The element and its forms

One element, one form per scene, never two at once. Forms: `word` · `pill` · `chip` · `button` · `card` · `page` · `window` · `list` · `notice` · `thread` · `photo` · `count` · `world` · `mark`. In the scene code, every screen knows where each form it draws is on any frame (a function of `time` returning its box), so the next scene can pick it up exactly there.

### Where the lines live

Lines alone, on the clean ground, only for the promise and the claim (read in 1.2 s). Everywhere else lines live inside the product's own words or around the element. The first line is on screen by 1 s.

### The end card grows from the last form

The lockup is built from the film's last element: the last picture's element becomes the mark, the last word becomes the wordmark, a badge spins in from the count. It lands centred, keeps creeping gently about its centre to the last frame while the music rings out, with the name once and one fact under it (the URL, "out now", the version). Never a fade to blank.

## Handovers

A handover passes the element from scene *k* to scene *k + 1* as one object: its box, corner, fill and content morph from where the outgoing scene draws it to where the incoming one does, so the cut never shows.

- Size changes on a log scale (a 40 px chip and a 900 px page meet at an even perceived speed); the path on a soft arc for thrown elements.
- Moving handovers are fastest on the cut frame, with the speed matched across it.
- Content never scales with the box: each side lays out its content at its own size, and the box clips or reveals it. Old content fades out over the first third, new content in over the last 40 %, or swaps in one frame at the most blurred frame.
- Every value is a pure function of the frame, as every scene is.

In Superint Video two scenes overlap on the timeline for the handover span (two clips on stacked tracks, or one scene that draws both sides). The outgoing scene hides its own copy of the element while the handover draws it.

| Handover | What carries | Use it when |
| --- | --- | --- |
| grow | The element's box becomes the next screen; contents cross-blur | The request becomes the result; a notice opens |
| shrink | The whole scene collapses into a chip under a blur | The whole becomes one item |
| swell | A small thing swells 40–60 % and is replaced by the next control at its old size | A chip becomes a word, an icon a pill, a status a button |
| press-open | A pressed button squeezes to 88 % and opens as a window | The press reveals who or what does the work |
| iris | A shape from the element opens onto the next world | A turn: into the product, out to the world |
| zoom-into | An exponential push into the element until it is the frame | Going inside: the screen, the photo, the app |
| pull-out | The detail is revealed as part of the bigger thing | The macro detail is the whole request; the mark is the lockup |
| fly | The element launches on an arc and lands as the next scene's first element | Something is sent or delivered |
| stay | The element holds while its surroundings change | Choosing one of many; the same request, a new answer |
| word | A word survives the cut and becomes the next line, the name or the mark | The case's key word becomes the claim or the name |
| part | The line parts; the element appears in the gap | The line names the thing; the thing arrives in it |
| converge | Many collapse to a point; the next element grows from it | Many become one: results, the count, the mark |
| same-surface | One front-loaded camera move across the same screen to its next state | The next step happens in the same product |
| momentum | Speed only: a whip in the same direction | A run of consequences of the same case; never between two subjects |

Use two or three kinds in a film, none on more than 40 % of the changes.

## Film shapes

Say the film in one sentence, then pick the shape:

| Shape | Length | The sentence | Acts |
| --- | --- | --- | --- |
| Launch (default) | 15–30 s | "It is X, and it does A, B, C to this case" | What it is, 3–5 proofs on the case, the lockup |
| Update | 8–20 s | "Here is what changed" | The name and version on a clean ground moving from frame 1, each change as its line alone then the scene that proves it (2–4 s a change), the mark pulls back with the version under it |
| UI walkthrough | 25–40 s (to 90) | "You give it X and get Y" | The promise, the input becoming the output (the signature), the flow in steps, the output live, the end card |
| Prompt run | 18–20 s | "Ask it, it does the steps, here is the result" | The request typed, the send, the steps it runs, the result, the lockup |
| Capability reel | 15–25 s | "It works with everything and returns anything" | Only when the brief asks for breadth: a ring of real sources, one real record, the claim, the end card |
| Camera teaser | 20–25 s | The same story, dark and fast | Whips, pushes and one 3D turn over one layout per shot |
| Social ad | 17–22 s | "Here is everything it is for, fast" | The opener in one move onto a stack of what it holds, the mark, the claim inside that content, the close |
| Type explainer | 20–30 s | "It is X, it fixes Y, and these are its parts", told in words | The name, what it is, the problem, the promise with the product in it, one wipe, the parts, the close |

When none fits, use the launch shape. A launch film may end on a reel's close or open on a walkthrough's first acts.
