---
"@pixerate/flair": patch
---

Faster catalog shaders, looking the same: sand erosion about 10× faster per frame, boids, glass shatter and spark fountain 4–5×, volumetric clouds and image shatter 3–4×, confetti cannon, soap bubbles and flow particles about 3×, fur, sparkle trail and brush trail about 2×, and drip melt, ribbon trail, light painting, particle text, backlight glow, aura, oil paint and the particle-swap transition 1.2–1.8×. They skip work that cannot show (bounded searches, early outs, hashes and samples reused), so frames are the same to within a level or two, except flow particles' streaks (a cheaper, equivalent flow field) and small shading differences in volumetric clouds and aura.
