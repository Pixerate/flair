---
"@pixerate/flair": minor
---

A `path` category (browsed under its own "Paths" group) gathers the effects that move along a path you give them: `glass-tube`, `glass-writing`, `swoosh-underline`, `border-beam`, `text-on-path`, `route`, `signature`, and the pointer trails that follow a path while idle (`comet-trail`, `ribbon-trail`, `sparkle-trail`, `brush-trail`, `ghost-trail`, `light-painting`, still tagged `trail`). Shader effects that build up once and settle say how long that takes in a new `build` field (also in the lazy catalog's metadata), and `ThumbnailPool.register` takes `{ build }` so a thumbnail replays the build from when it comes into view and holds the built frame when still; the gallery's glass tube and glass writing now show themselves being drawn.
