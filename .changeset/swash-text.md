---
"@pixerate/flair": minor
---

New `swash-text` shader (text): the `ribbon-curl` treatment's flourish in full detail. A rounded, twisting gradient ribbon is drawn through a title along a swash curve (in along the baseline, a loop, an arc hooking over the end), woven under and over the letters pixel by pixel with the letters' shadow on it where it passes behind, with a specular streak, an iridescent edge, star sparkles, and a noise dissolve into frost. Controls for the text, colours, width, opacity, twists, glow, sparkles, weave, frost and timing (or a still `uProgress`), with Light page, Dark page, Ocean, Gold leaf and Flat ribbon presets; compiled to Metal for `FlairEffects`.

`flair export metal` keeps the text treatments' resource in the standalone `swift/Package.swift` it writes.
