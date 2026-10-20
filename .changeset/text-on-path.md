---
"@pixerate/flair": minor
---

Text on a path. Two new type effects: `text-on-path` (words gliding along any SVG path you give it) and `circle-text` (words repeated round a turning ring, a badge or seal), both with the text effects' font, weight and inline controls. A new motion primitive, `path.text`, sets any `<text>`'s words along a `<path>` in a picture and moves them from one fraction of its length to another (with `lift` off it), and comes off cleanly with `removePrimitive`. Agents reach it through `primitive.apply`.
