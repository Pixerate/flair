---
"@pixerate/flair": minor
---

Multi-pass rendering: `ShaderPipeline` renders several shaders as one picture on one WebGL2 context, each pass reading the one before (`"previous"`), another pass (`{ pass: n }`), its own last frame (`"feedback"`, for trails and echoes) or a picture, with `blend: "over"` for overlays. `effectStack` (catalog) turns catalog shaders into passes, each filter reading the layer below. A pass that does not compile throws a `PassCompileError` naming it.
