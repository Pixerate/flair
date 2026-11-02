---
"@pixerate/flair": minor
---

Shaders can draw along a path given at run time. A `sampler2D` marked `path` (`uniform sampler2D uPath; // @control path default="M …" fit=contain`) takes SVG path data, fitted into the frame, or points `[x0, y0, x1, y1, …]` in frame pixels; it is resampled (up to `MAX_PATH_POINTS`) into a small float texture that follows resizes, travels with standalone pages and exports, and is checked with a sentence saying what to pass. The catalog's `PATH` GLSL helpers (`pathNearest`, `pathAt`, `pathHits`, `pathLength`) read it, path controls report the `path` input, and their schema marks path data with `format: "svg-path"`. New effect: `glass-tube`, a see-through glowing tube that draws itself along any path, overlaps showing through each other.
