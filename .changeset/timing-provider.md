---
"@pixerate/flair": minor
---

`flairEffects()` now offers timing effects to `@pixerate/editor`'s editors. They come with the use `timing` and `capabilities.supportsTiming`. `timingLength` and `timingSample` give a retime's length and the weighted footage frames each moment shows, exactly as Flair's own players draw them. `/integrations` now needs `@pixerate/editor` 0.254 or later; for an older editor, pass `kinds` without `timing`.
