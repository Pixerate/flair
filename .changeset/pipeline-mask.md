---
"@pixerate/flair": minor
---

Masks and regions: `ShaderPipeline`'s `setMask` (or `mask` option) limits where the effect applies, on the GPU, by a coverage picture (alpha or luminance, 8-bit or float), a rectangle with a feathered edge, or both, optionally inverted. Where coverage is 0 a picture or a pass's output shows through (`under`); without one, coverage multiplies the output's alpha.
