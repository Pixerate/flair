---
"@pixerate/flair": patch
---

`svgFrameMarkup` (and so `flair render` / `exportEffect` frames of vector effects) now follows changes `along` a path, turning with it under `orient`, measured from the path's `d` with no DOM. Before, the moving element stayed at the picture's top-left corner (the sparkline's dot, the send button's plane, the wish star).
