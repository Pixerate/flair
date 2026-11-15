---
"@pixerate/flair": patch
---

`ribbon-curl` is redrawn after its reference: a translucent swash laid out across the changed word only (a thin tail, one small loop, then an arc that hooks over the word's end), thinner and quieter than before, with sparkles around it. Curve layers (`ribbon`, `sparkles`) take `anchor: "range"` to lay their points across the range's last line (x across its width, y and widths in its line height) instead of from the caret; `ribbonAlpha` sets the curl's opacity.
