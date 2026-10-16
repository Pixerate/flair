---
"@pixerate/flair": minor
---

Node rendering: `exportEffect` (and `flair render <effect>`) renders a catalog effect on an image, SVG, text, path or video to MP4, WebM (alpha), MOV (ProRes 4444), GIF, PNG frames or, for vector effects, an animated SVG. `flair effects` lists effects with what they take. `exportMotionGraphic` now compiles shaders with the real wrapper (so `iPointer`, `iClicks` and `iTrail` work), loads image controls, sets `int`/`bool` controls correctly, and can keep alpha.
