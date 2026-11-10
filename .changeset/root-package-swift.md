---
"@pixerate/flair": patch
---

Swift: add a root `Package.swift` so `FlairEffects` can be used as a SwiftPM git dependency. `FlairPathRasterizer` now packs paths in the same texture layout as the web `pathTexture` (points in path units, y down, fitted by the shader's `PATH` helpers), fixing path effects such as `glass-tube` on Metal. `AnyFlairEffect` gains `encodedJSON()`, `decoded(from:)`, `encodedValues()` and `applying(values:)`, and `FlairRenderer` gains `renderBytes(anyEffect:…)`.
