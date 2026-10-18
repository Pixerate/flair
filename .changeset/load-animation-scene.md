---
"@pixerate/flair": minor
---

The effect editor opens animations made with `@pixerate/editor`'s vector animation editor. `effectDocumentFromAnimation(scene)` and `EffectEditor.loadAnimation(scene)` (the `effect.loadAnimation` command, so agents can call it too) turn a `MotionScene` into a vector effect with the scene's colour controls as `{{name: color}}` placeholders and its presets kept. A scene with errors is refused, listing them. The optional `@pixerate/editor` peer now needs 0.55 or later, the first release with `/animation-editor`.
