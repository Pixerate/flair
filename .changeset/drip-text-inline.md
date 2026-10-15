---
"@pixerate/flair": minor
---

Drip text sits inside headings and takes your font:

- `inline: true` frames just the word, from cap height to baseline, with `overflow="visible"`, so the outline and drips spill over the text around it without adding leading. Give its container `display: inline-block; height: 0.72em` and the viewBox's aspect ratio.
- `font` (default `Arial Black, Impact, system-ui, sans-serif`; `inherit` takes the surrounding text's) and `weight` (100–900, default 900) controls replace the hard-coded font.
- Documented that `SvgPlayer` with `loop: false` plays once and stays on its last frame.
