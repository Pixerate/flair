---
"@pixerate/flair": minor
---

Render in a host's WebGL context: `ShaderPipeline`'s `gl` option renders in a context the host owns, takes the host's textures as inputs (`{ texture, width, height }`), and keeps the output on the GPU (`outputTexture`, or `render(t, { target })` into a host framebuffer), with no read back per frame. Every call leaves the host's GL state as it found it, and `dispose` frees only what the pipeline made. `TextureCache` takes an optional `around` wrapper for uploads that arrive later.
