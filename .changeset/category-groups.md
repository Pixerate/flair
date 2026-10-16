---
"@pixerate/flair": minor
---

Catalog: `EFFECT_CATEGORY_GROUPS` sorts the 40 categories into 8 groups (Backgrounds, Light, Pictures, Particles & FX, Type & titles, Inputs, Interface, Transitions). `categoryGroup(category)` gives a category's group, and `findEffects({ group })` and the `catalog.search` command filter by group. The demo gallery browses by group, then by category. Editor documents for vector effects now get the effect's own length (its motion plus `hold`) as their timeline instead of a fixed 5 s.
