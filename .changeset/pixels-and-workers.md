---
"@pixerate/flair": minor
---

Pixels in and out, and rendering in Web Workers. Image controls take an `ImageBitmap`, `VideoFrame`, `ImageData` or `OffscreenCanvas` through `setLiveSource` (stills upload once, and upright, `ImageBitmap` included). `ShaderFrames` accepts an `OffscreenCanvas`, makes one itself where there is no `document`, and gives frames out with `readImageData()` and `toImageBitmap()`. Image URLs load in a Worker through `loadImageSource` (`fetch` and `createImageBitmap`).
