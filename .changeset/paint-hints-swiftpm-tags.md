---
"@pixerate/flair": minor
---

Paint hints and SwiftPM version tags. Effects that make good paint in an editor that brushes with effects now say how: `flairEffects()` summaries and descriptions (and the Swift `FlairEffectProvider`'s, through `flair-effects.json`) carry a `paint` hint (`map`: `path`, `stroke` or `canvas`; `colors`; `values`; `live`; `repeat` for `stroke`; `size` when suggested), and both providers declare `capabilities.paintHints`, meaning effects without a hint are not meant as paint. 66 of the 259 generator, overlay and title shaders have one; the hints are `PAINT_HINTS` in `@pixerate/flair/catalog` and `/catalog/lazy`, and `EffectMeta.paint`. Releases now also tag their commit with a plain semver tag (`0.110.0`), so Swift apps can depend on Flair with `.package(url: "https://github.com/Pixerate/flair.git", from: "0.109.0")`.
