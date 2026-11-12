---
"@pixerate/flair": patch
---

The Swift package's Metal shaders build without warnings. Seven catalog shaders lose a local they computed but never used (`cinema-projector`, `leaves-blowing`, `sparkler`, `trail-cam`, `wax-melt`, `wind-gust`, `wireframe-reveal`), and `flair export metal` marks its generated `.metal` files to ignore unused variables and constants, which spirv-cross leaves behind when it inlines a helper whose `out` argument a call site ignores, or copies a constant array.
