---
"@pixerate/flair": patch
---

Fix straight-alpha output in `bokeh` when `uBackgroundAlpha` is below 1 so bokeh lights keep their colour instead of darkening on transparent backdrops, and map `bokeh`, `plexus-web` and `relief-hex-tiles` along the stroke in `PAINT_HINTS` with brush-scaled parameters (Pixerate/JazzPaint#58).
