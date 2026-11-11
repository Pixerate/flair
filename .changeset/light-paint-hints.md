---
"@pixerate/flair": patch
---

`light-painting` and `neon-ripple` now have paint hints. `light-painting` paints along the stroke (`map: "path"`, still, with `uBackgroundAlpha: 0`). It gains its own background opacity control, so its vignette and grain fade with the backdrop; at the default opacity it looks as before. `neon-ripple` is live canvas paint whose rings keep spreading without a pointer. `prism-light` stays unhinted: it is a single prism and beam, so painting only uncovers a fragment.
