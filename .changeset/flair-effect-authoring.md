---
"@pixerate/flair": minor
---

`flairEffects()` implements effect authoring (`openAuthoring`, `supportsAuthoring`) from `@pixerate/editor` 0.148, wrapping Flair's `EffectEditor`: shaders open in the editor's Effect Authoring tab with their GLSL, compile errors on the right lines and controls that follow the source; vector effects open with their controls, keyframes and presets. `/integrations` now needs `@pixerate/editor` >= 0.148. `EffectEditor.setValue` and `setValues` take `{ gesture }` so a slider drag is one undo step, and `createEffectToolRegistry` keeps bare tool names (`run_command`) with editors that namespace them by default.
