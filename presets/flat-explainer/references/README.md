# References

Stills that show the look this preset aims for. Every new project gets a copy in its own `references/`, and the agent compares its style frames and contact sheets with them.

## Shipped

`style-reference.jpg` is the style sheet made for this preset. Compare against it:

- the characters: proportions, faces, hair, clothing, props in their hands;
- the palette;
- the label style: pills joined by lines with dot ends to what they name;
- the clean data graphics;
- the way abstract ideas turn into concrete objects.

It is a board, not a frame: its dark navy background and the panel grid are the layout of the sheet. Backgrounds, place and pacing in a film follow `STYLE.md`: mostly bright worlds, a few of them, travelled smoothly.

## Your own

The stills the preset was tuned against are copyrighted frames of other films and stay out of version control. Add your own:

```sh
superint-video preset reference flat-explainer path/to/still-01.jpg path/to/still-02.jpg
```

They are stored next to your user presets (`<user presets>/_references/flat-explainer/`) and merged into every new project.
