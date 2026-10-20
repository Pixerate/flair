---
"@pixerate/flair": minor
---

`flairEffects()` renders through `ShaderPipeline`, and now supports masks and float layers: `capabilities.supportsMask` is true (masks composite on the GPU over the untouched input, or multiply alpha), and `supportsFloat` is true where the GPU renders to floats (depth 16 and 32 renderers return `float` in linear light; float `EffectPixels` inputs go in as floats).
