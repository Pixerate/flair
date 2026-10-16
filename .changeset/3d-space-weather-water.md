---
"@pixerate/flair": minor
---

Eighteen catalog shaders in three new categories, `3d`, `weather` and `water`, and more `space`:

- `3d`: `globe` (a dotted or realistic Earth-like globe with glowing arcs between cities and an atmosphere rim; drag it to turn it), `rotating-shapes` (a torus, rounded cube and icosahedron in a soft-shadowed studio), `isometric-city` (buildings rising, windows lighting through a day and night cycle), `wireframe-terrain` (a glowing mesh fly-over with fog), `metaballs-3d` (glossy merging blobs reflecting a studio) and `torus-knot` (an iridescent, glowing (p, q) knot).
- `space`: `planet` (banded or rocky, with atmosphere, terminator and optional rings), `spiral-galaxy` and `solar-system`.
- `weather`: `rain-streaks`, `wind-gust` and `hail` (transparent overlays), `thunderstorm`, and `rainbow` (over a picture or video).
- `water`: `ocean-waves` (sunset or day, foam and sun glint), `underwater-scene`, `pond-ripples` (raindrops and clicked stones rippling a picture or video) and `waterfall`.

`EFFECT_CATEGORIES` lists the new categories before `transition`. The 3D effects meet their shapes analytically or march only inside bounding volumes with bounded steps, so each stays at about 3 ms or less a frame at 1080p on an M4 Pro.
