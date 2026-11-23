---
"@pixerate/flair": minor
---

More montages, and vector montages whose markup follows their item count (#230):

- Eight shader montages, each with presets and a still rest frame: `device-morph` (one frame morphing phone → tablet → laptop with each breakpoint's screenshot), `bento-montage`, `photo-scatter`, `filmstrip-montage`, `split-grid-reveal`, `orbit-gallery`, `before-after-series` and `wall-zoom`. They show six items at a time (`device-morph` four) and bench at 0.5–2.3 ms a frame at 1080p with six items; all compile to Metal.
- Vector repeat blocks: `EffectItems` takes `cycle: "repeat"` with a `list` text control holding the items as JSON (`VectorItem`: `href`, `label`). `renderVectorEffect` writes each `{{#items}}…{{/items}}` block once per item (`{{item.i}}`, `{{item.label}}`, `{{item.href}}` and the effect's `itemDerived` placeholders) and repeats animations that name `{{item.…}}`, `stagger` ms apart. `vectorItems` reads a list. First vector montage: `logo-wall`, a grid of logo cards that fits any count. Vector montages take `{ svg }` items and `data:image/` pictures, and refuse others with a sentence.
- `items.set` takes `svg` markup and a `label` per item, and fills a vector montage's list.
- `svgMarkupUrl` in `@pixerate/flair/catalog` turns SVG markup into a `data:` URL.
