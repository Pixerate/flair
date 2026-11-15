---
"@pixerate/flair": patch
---

`ribbon-curl` is redrawn after its reference: a translucent swash laid out across the changed word only (a thin tail, one small loop, then an arc that hooks over the word's end), thinner and quieter than before, with sparkles around it. Curve layers (`ribbon`, `sparkles`) take `anchor: "range"` to lay their points across the range's last line (x across its width, y and widths in its line height) instead of from the caret; `ribbonAlpha` sets the curl's opacity. Curve layers also take `behind`: stretches along the curve drawn under the text, so a ribbon weaves through the words; the curl goes under the letters along its tail and downstroke and over them on its loop and arc.
