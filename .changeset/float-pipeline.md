---
"@pixerate/flair": minor
---

Float layers: `ShaderPipeline` takes `format: "rgba16f" | "rgba32f"` for half- or full-float passes (HDR, 16- and 32-bit layers), `readFloatPixels()` for output in linear light with straight alpha (values may exceed 1), and float pictures (`{ width, height, data: Float32Array }`, linear) as inputs. Shaders see sRGB-encoded colour in every format, so effects look the same at any depth; conversions run on the GPU with extended sRGB curves. The README documents the colour-space and premultiplied-alpha contract.
