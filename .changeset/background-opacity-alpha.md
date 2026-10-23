---
"@pixerate/flair": patch
---

Fix background and backdrop opacity controls having no effect outside an explicit `{ alpha: true }` canvas: `mountEffect` now draws `sparkles`, `bokeh`, the audio visualizers and the picture effects with `uBackdropAlpha` on a transparent canvas, and `recordEffect`, `exportEffect` and `effectStack` keep (or lay over the background) their alpha once `uBackgroundAlpha` / `uBackdropAlpha` is below 1. New `drawsAlpha(effect, values?)` in `@pixerate/flair/catalog` says when an effect needs an alpha canvas.
