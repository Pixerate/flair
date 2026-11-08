---
"@pixerate/flair": minor
---

Add an automated GLSL → SPIR-V → Metal Shading Language (MSL 2.4) transpilation pipeline and the `FlairEffects` Swift package (`swift/`) targeting iOS 15+ and macOS 12+:

- **Metal pipeline (`@pixerate/flair/node` & `flair export metal`)**: `wrapMetalSource`, `metalUniformLayout`, `packMetalUniforms`, `compileShaderToMetal`, `generateSwiftEffectStruct`, and `exportMetalPackage` compile all 441 catalog shader effects (and their multi-pass/feedback chains) into `.metal` sources with line-mapped diagnostics and generated Swift `FlairEffect` structs.
- **`FlairEffects` Swift package (`swift/`)**: Typed `FlairEffect & Sendable & Equatable & Codable` structs with `@control` properties, presets, `std140` uniform packing, web-compatible `Codable` JSON (`uSpeed`, hex or `[r, g, b]` colours), `MTKView` + SwiftUI `FlairEffectView` / `.flairBackground` / `.flairOverlay`, offscreen `FlairRenderer`, multi-pass/feedback `FlairPipeline`, CoreText `FlairTextRasterizer`, `CGPath` `FlairPathRasterizer`, and `FlairPointerTracker` / `FlairAudioTracker` / `FlairScrollTracker`.
- **Catalog & CLI (`swiftReady` / `--swift`)**: Added `swiftReady` to `EffectMeta` / `EffectQuery`, `--swift` to `flair effects`, and `swiftReady` filtering to the `catalog.search` agent command.
