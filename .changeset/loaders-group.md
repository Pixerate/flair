---
"@pixerate/flair": minor
---

Loaders get their own browsing group: `EFFECT_CATEGORY_GROUPS` gains "Loaders" (the `loader` category, out of "Interface"), and the loaders that lived in themed categories move into `loader`: `chomp-loader` (was `retro`), `bubble-pop-loader` (was `bubble`), `progress-ring` (was `data`) and `battery-charge` (was `electric`). `findEffects({ group: "loaders" })` finds them all; filters by their old categories no longer do.
