# Example: "Code Mode"

The first film in this look: a German explainer of 3:57 about Code Mode for AI agents, a pop-up book with seven spreads between cover and back cover (November 2026). Only the files that differ from the preset are here; every other file of its `scenes/` (the renderer, the book, the paper kit, the desk, `world.js`) is the preset's own. Generated files (`scenes/cues.js`, `scenes/timing.js`, the audio) are not included.

It shows how things were solved. It is not a template for the next film's ideas: its machines, rooms and compositions belong to this film.

| File | What to learn from it |
| --- | --- |
| `direction.md` | A full direction for a pop-up book: form, paper mechanics, colour script per spread, type, scale, every real thing as cut paper |
| `script.md`, `voice.md`, `beats.md` | One paragraph per spread, the trigger words of every moment, the camera stops |
| `scenes/spreads/s00_book.js` | The binding (leather, gold, blind tooling), the marbled pastedown, the bookplate, the title page set high for a pop-up below |
| `scenes/spreads/s01_titel.js` | A pop-up on the thin title leaf: an invisible host fold, a row on one line (`OFF`), travellers on printed channels, the bent-leaf `S.place` override |
| `scenes/spreads/s02_frage.js` | A landscape spread with buildings in section and hero pieces in front, tokens cut by a knife and stacked behind glass |
| `scenes/hall.js`, `scenes/machines.js`, `scenes/techkit.js` | One building used by three spreads (`buildHall`), machines and printed data as cut paper, `traveller`, `journey`, `standUp`, `rise` |
| `scenes/spreads/s03_werkzeuge.js` to `s05_codemode.js` | The same hall in three lights, stacks that grow on words, a reading light, a counter, a sandbox that stands up |
| `scenes/spreads/s06_lohnt.js` | A test room: a brass slider over a scale, two windows compared |
| `scenes/spreads/s07_kommt.js` | An office from inside at night, index cards that stand up on their names, the message card |
| `scenes/timeline.js` | The opening camera on the title page's moments, `turnAt` for a cover that lifts on a word |
| `tools/after_voice.py`, `tools/pauses.py`, `tools/make_timing.py` | The film's moments, pauses, gaps and holds |
| `audio/make_sfx.py`, `audio/kit.json`, `sfx.json`, `mix.json` | Sound effects placed from the turns and moments; the levels |
| `audio/score.py`, `music-prompt.md` | Music cut on bar lines to the turns (in the project it lived in `audio/music/`) |
