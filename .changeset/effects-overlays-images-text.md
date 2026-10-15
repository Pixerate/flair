---
"@pixerate/flair": minor
---

Catalog: 35 new effects and two new categories.

- **overlay** (new category): rain on glass, snowfall, lens flare, vignette & grain, scanline sweep, spotlight, embers, shine sweep and frost creep shaders, plus a viewfinder vector effect. Overlay shaders have `transparent: true` (a new `ShaderEffect` field): render them with `{ alpha: true }` to lay them over other content.
- **image**: Ken Burns, ASCII art, shatter, melt, risograph, thermal / night vision, edge glow, tilt-shift, slit-scan, mosaic flip, chromatic lens and oil paint.
- **text** (new category): typewriter, scramble text, kinetic stagger, neon sign, stroke draw text, split reveal, highlighter, word cycle, liquid fill, glitch text and extruded text vector effects, and a `shader-text` shader that fills letters with plasma, fire, caustics or chrome. Drip text moves here from `icon`.
- `textImage(text, options)` in `/catalog`: any Unicode text as a transparent SVG `data:` URL, for image controls such as `shader-text`'s.
- Vector motion: `SvgAnimation.write` writes text letter by letter, with `scramble` (unwritten letters cycle through random characters) and `caret`; `writtenText` and `SCRAMBLE_MS` are exported from `/vector`.
