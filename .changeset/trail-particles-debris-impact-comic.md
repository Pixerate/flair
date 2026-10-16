---
"@pixerate/flair": minor
---

Pointer trails, and 38 new effects.

- Shaders get a new built-in, `iTrail[32]`: where the pointer has just been over the canvas, newest first, about 30 points a second (xy pixels, z its `iTime`, w = 1). `ShaderRenderer` and standalone pages feed it; `ShaderFrames.render` takes a scripted `trail`; `PointerTracker.move` takes an optional time to record it. `trailUniform`, `MAX_TRAIL` and `TRAIL_SECONDS` are exported.
- **trail** (new): comet, ribbon, sparkle, brush and ghost trails and light painting that follow the pointer (each with an idle demo), and vector motion streak and dotted trail.
- **particles** (new): flow particles, magnetic swarm (follows the pointer, flung by clicks), dust in light, boids, particle text, confetti cannon (and at clicks) and fireflies.
- **debris** (new): rubble fall, glass shatter (from the click, video-ready), crumbling text, paper shreds, leaves blowing and sand erosion.
- **impact** (new): shockwave, impact frame and screen shake over a picture or video (at clicks), ground slam, meteor strike, and a vector hit marker (click).
- **comic** (new): comic book and cel shade looks for any picture or video, focus lines, action lines, a comic panels transition, and vector sound effect, speech bubble, fight cloud, dizzy stars, anime emotes, cartoon poof (click) and line boil.
