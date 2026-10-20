---
"@pixerate/flair": minor
---

Testing without a GPU, and deterministic renders. `@pixerate/flair/testing` publishes the fake WebGL2 context Flair tests itself with: `installFakeWebGl()` makes canvases and `OffscreenCanvas` hand out fakes (any test runner, `restore()` to undo), so `ShaderFrames`, pipelines and `flairEffects()` render in jsdom with the same pixels every time, and record the calls made. For real pixels that match across machines, `software: true` on `exportEffect` / `exportMotionGraphic` (`--software` on `flair render` and `flair export`, or `FLAIR_SOFTWARE_GL=1`) draws with SwiftShader on every platform.
