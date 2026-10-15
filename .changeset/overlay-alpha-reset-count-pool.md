---
"@pixerate/flair": minor
---

Add transparent WebGL shader overlays, `SvgPlayer.reset()` / `hideWhenPaused`, standalone `animateCount()` / `formatCount()`, and hover-only / alpha support in `ThumbnailPool`:

- Preserve clamped `flair_color.a` in `wrapSource` and add `alpha?: boolean` to `createContext`, `ShaderRendererOptions`, and `ThumbnailPoolOptions`.
- Add `uBackgroundAlpha` and `uChance` (sparsity) controls to the `sparkles` catalog shader and `uBackgroundAlpha` to `bokeh`.
- Add `SvgPlayer.reset()` and `hideWhenPaused?: boolean` to `SvgPlayerOptions` for hover-triggered vector animations.
- Add `animateCount()` and `formatCount()` to `@pixerate/flair/vector` for animating DOM numbers on a `Clock` with `EASES`.
- Add `hoverOnly?: boolean` and `animateMode?: "always" | "hover" | "reduced-motion"` to `ThumbnailPoolOptions`.
