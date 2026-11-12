# blank: no house look

This preset brings no art direction of its own, only a neutral starter: Geist, a dark ground, one blue accent and the style-neutral helpers in `kit/kit.js` (motion, text reveal, fit, SVG). Everything about the look is still open.

Before any scene, write the look into `direction.md` from, in this order:

1. what the user said about the look in `brief.md` and in the conversation;
2. a brand kit in `assets/brand/` (logo, colours, fonts, screenshots, tone), which wins over everything else;
3. the pictures in `references/`: name for each what to take from it (palette, type, light, composition, motion) and what not;
4. the workflow skill's defaults.

`direction.md` then states, in numbers: palette tokens (replace the ones in `kit/theme.css`), type (face, weights, sizes, tracking), shapes and materials, light, motion vocabulary (eases, durations, staggers), the composition grammar and the don'ts. Ship any other font locally under `kit/fonts/` with its licence and await it in `ready`.

To reuse the look in later films, make it a preset of its own: `superint-video preset new <name> --from blank --reference <stills…>`, copy the project's `kit/` and `scenes/lib/` into the new preset folder, and write the rules from `direction.md` into its `STYLE.md`.
