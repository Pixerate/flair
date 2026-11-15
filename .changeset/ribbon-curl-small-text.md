---
"@pixerate/flair": patch
---

`ribbon-curl` scales with the text: at small sizes it no longer becomes a smudge with a halo, and on short words it is no longer squeezed. Curve layers over the range take `aspect` (their own width in line heights, so a curve keeps its shape: on the end of a long word, scaled down evenly to fit a short one) and `endTaper` (the head narrows to a point), and their `glow` is in line heights, so it keeps to the text's size.
