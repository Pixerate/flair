---
"@pixerate/flair": minor
---

`flairEffects()` now offers the catalog's camera moves to `@pixerate/editor`'s editors as `camera` effects (`capabilities.supportsCamera`). `cameraView` gives where a move puts a scene's camera part-way through it, exactly as Flair's scene player moves it, and `sampleCameraMove` keys it for an editor to bake. This needs `@pixerate/editor` 0.224 or later; with an older editor, pass `kinds: ["shader", "vector", "motion"]` to leave camera moves out.

Fixes `camera-crash-zoom`, which gave the camera a NaN position before its first step (the first 300 ms of the hold by default).
