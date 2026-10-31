---
"@pixerate/flair": minor
---

A new `beauty` catalog category, browsed under Pictures. It holds retouching and make-up for a portrait or a live face: `beauty-skin-smooth`, `beauty-dewy-glow`, `beauty-soft-focus`, `beauty-brighten` (eyes and teeth), `beauty-lip-tint`, `beauty-blush`, `beauty-eyeshadow` and `beauty-highlighter`. It also holds beauty-ad graphics: `beauty-retouch-reveal`, `beauty-product-shine`, and the vector `lipstick-swipe` and `swatch-reveal`.

Each shader works as a live video filter on a region you place by hand, defaulting to the sample face, since Flair has no face tracking. The effects keep to skin by its colour. Make-up takes a shade's hue but keeps the picture's own lightness, so texture shows through.

The censor effects now share their region helpers through `src/catalog/shaders/region.ts`, and their output is unchanged.
