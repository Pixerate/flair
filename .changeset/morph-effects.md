---
"@pixerate/flair": minor
---

Morphs: `morphPaths` / `morphSequence` and 13 new effects.

- `morphPaths(from, to)` and `morphSequence(paths)` in `/vector` turn any SVG paths (curves, arcs, relative commands, several pieces) into paths with one structure, so an `attrs` change on `d` blends them. Pieces pair by position and size; one without a partner grows from or shrinks to a point.
- **morph** (new category): feature morph (two photos, five matching points), silhouette morph (any silhouettes, logos or `textImage` words), and vector shape morph, icon toggle (play/pause, menu/close, plus/check, sun/moon, heart), morph sequence, gooey morph, particle morph and digit morph.
- **transition**: liquid morph, displacement, luma fade, particle swap and ink bleed.
- `SAMPLE_IMAGES` gains `portrait2`, `logo` and `heart`.
