---
"@pixerate/flair": minor
---

Trail effects (`comet-trail`, `ribbon-trail`, `sparkle-trail`, `brush-trail`, `ghost-trail`, `light-painting`) given their path as points through the editor effect adapters (`flairEffects()` and Swift's `FlairEffectProvider`) now draw the whole path as their trail, head at its end, instead of a demo walking along it, so an editor painting with one along a stroke sees the whole stroke. SVG path data still walks as before.
