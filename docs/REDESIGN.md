# Studio redesign

## Source

The reusable design rules are copied verbatim into [design.md](design.md) from
[Rigometry / docs/design.md](https://github.com/marlonka/Rigometry/blob/main/docs/design.md).

- Imported: 2026-10-09.
- Upstream Git blob: `516cc675848922aae678c9522025001c0d59ee10`.
- Product decisions and verification belong in this document; the source guide stays portable.

## Product decisions

Studio remains a local video editor: assets, composition preview, contextual inspector,
and a multitrack timeline. The redesign changes interface hierarchy and interaction;
authored scene styling and exported video remain controlled by project files.

| Area | Decision |
| --- | --- |
| Density | Move ordinary controls and inputs from the former 12 px baseline toward 15–16 px. Keep metadata subordinate and readable. |
| Color | Neutral dark/light semantic tokens. Monochrome actions and navigation; preserve original source imagery and meaningful media distinctions. |
| Hierarchy | Group related controls by task. Show frequent editing actions directly; move occasional workspace actions into an adjacent menu. |
| Geometry | Stable control bounds, explicit spacing, one radius family, no hover lifts or animated selection highlights. |
| Motion | Direct scrubbing, dragging and resizing. Short local transitions only; reduced motion applies immediately. |
| Scrolling | Assets, inspector and timeline remain independent work areas because they are simultaneously useful in an editor. The timeline retains horizontal scrolling for frame placement. |

Verification targets are 1280×800 and 1920×1080 desktop viewports, a 320×800 narrow
viewport, and increased browser scale. Narrow layouts wrap the header and transport
into two rows. Desktop timeline height defaults to 280 px, exposing three tracks.
Panel collapse and resizing must keep controls reachable at constrained widths.

## Theme contract

`studio/public/theme.js` runs synchronously in the document head before Studio paints.
It uses `superint-theme` from local storage when valid, otherwise the system preference.
Storage failures do not prevent startup.

The resolved theme is expressed through `html[data-theme]`, native `color-scheme`,
and the browser's `theme-color` metadata. Switching themes updates those together.
Theme changes preserve selection, playhead, inspector input, focus and panel sizes.

The bootstrap is an external local script compatible with Studio's existing
`script-src 'self'` policy. Vite copies public assets into the embedded static build.
The redesign introduces no remote fonts, runtime packages or new dependencies.

## State and accessibility requirements

- Keep clip rows and property controls stable during playback and metadata updates.
- Commit an inspector draft to the clip that owned it, including when selection changes.
- Preserve edits while another save is pending. External changes must not erase a dirty field.
- Let native buttons and form controls handle their keyboard activation. Menus own their navigation keys.
- Escape closes the applicable top layer. Dialogs contain focus and restore it to a connected opener.
- Theme and panel changes must preserve text cursors and useful scroll positions.
- Disabled, saving, unavailable, failed and complete states remain distinguishable through text or semantics.
