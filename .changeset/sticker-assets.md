---
"@pixerate/flair": minor
---

Asset subjects and still stickers.

- Scene layers and `mountEffect` take `{ asset: "provider:id" }` subjects, which the host's `resolveAsset(ref)` turns into `{ svg }` or `{ image }`. Pass it to `scenePlan`, `mountScene`, `recordScene`, `standaloneSceneHtml`, `mountEffect` and `applySceneTool` (its new fourth argument). `resolveSceneAssets`, `sceneAssets` and `resolveSubject` resolve ahead of time. An unresolved asset is reported (a plan note, an agent issue) and draws nothing. Without a resolver, the scene tools refuse edits that add assets.
- New stickers: `sticker-cutout` (a shader that turns any artwork with transparency into a still die-cut sticker), and the still vector stickers `die-cut-sticker` (adds pill and bolt shapes), `sticker-label`, `speech-sticker` and `sticker-wrap` (any SVG path as a sticker).
- New motion primitive `entrance.slap`: slaps an element down like a sticker.
