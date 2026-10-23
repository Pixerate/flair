---
"@pixerate/flair": minor
---

`sparkles`, `bokeh`, `circular-spectrum`, `bass-pulse`, `vinyl`, `gemstone`, `chrome-text` and `floor-reflection` are now overlays by default (`transparent: true`, `uBackgroundAlpha` 0, tagged `overlay`). Each has a "With background" preset ("On the platter" for `vinyl`) for the old full-frame look, which replaces their "Overlay" presets (`circular-spectrum`'s is now "Bare ring").

Background and backdrop opacity controls now work outside an explicit `{ alpha: true }` canvas: `mountEffect`, `recordEffect`, `exportEffect` and `effectStack` use the new `drawsAlpha(effect, values?)` (in `@pixerate/flair/catalog`) to pick a transparent canvas, keep alpha, and layer an effect over the one below, so picture effects with `uBackdropAlpha` at 0 lay over the page, and an overlay with its background turned up records opaque.
