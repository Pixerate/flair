---
"@pixerate/flair": minor
---

`@pixerate/flair/integrations`: `flairEffects()` makes Flair the effects provider for `@pixerate/editor`'s editors, through the editor's `@pixerate/editor/effects` contract. It lists, searches and describes every shader, vector effect and motion primitive (controls as strict JSON Schemas, colours as `#rrggbb`), renders shaders with `ShaderFrames` on a page or in a Worker, takes `ImageBitmap`, `VideoFrame`, `OffscreenCanvas` or pixel inputs, drives transitions by `progress`, renders vector effects on a page (or with `rasterizeSvg`), and applies motion primitives to SVG with `applyVectorEffect`. It passes the editor's `checkEffectProvider`, and needs `@pixerate/editor` 0.124 or later (the first with `/effects`).
