---
"@pixerate/flair": minor
---

`effectInputs(effect)` says what an effect takes and how it answers the pointer: what it `accepts` (image, video, svg, text, mask, path), its image controls and whether each wants a picture, a mask or text, its text controls (copy, font, path, glyphs), its video use, its `interactions` (hover, press, click, trail, pointer) and whether it is a transparent overlay. It is worked out from the effect's controls, source and fields, so it never drifts. `findEffects` and the `catalog.search` command filter on `accepts`, `interaction` and `transparent`, and the search lists each effect's inputs. `silhouette-morph` now says `video: "none"` (it takes silhouettes, not photos), and the fireworks, explosion and bullet-time effects are tagged `interactive`.
