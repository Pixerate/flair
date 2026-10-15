---
"@pixerate/flair": minor
---

Every text effect now takes `font`, `weight` and `inline` controls, like drip text: typewriter, scramble text, kinetic stagger, neon sign, stroke draw text, split reveal, highlighter, word cycle, liquid fill, glitch text and extruded text.

- `font` takes any CSS font-family, and `inherit` uses the surrounding text's. `weight` runs from 100 to 900. The defaults keep each effect's current look.
- `inline: true` frames just the text, from cap height to baseline, hides the backdrop and sets `overflow="visible"`, so the effect sits in a heading without adding leading. Give its container `display: inline-block; height: 0.72em` and the viewBox's aspect ratio.
