---
"@pixerate/flair": minor
---

Image effects work with transparent pictures such as Lucide icons.

- Every image and transition effect in the catalog has two new controls, `uBackdrop` (white by default) and `uBackdropAlpha` (1 by default). The picture is laid over the backdrop, so a black `currentColor` icon on a clear background no longer renders as black on black. Set `uBackdropAlpha` to 0 to keep the picture's alpha, so the effect can be laid over other content with `{ alpha: true }`. Opaque pictures look the same as before.
- Edge glow also finds edges in the picture's alpha, so it outlines an icon whatever its colour. Tilt-shift and slit-scan blur in premultiplied alpha, so clear areas no longer darken the blur.
- `SAMPLE_IMAGES.icon`: a Lucide-style sample icon.
- `ShaderFrames` takes `alpha: true` to keep the shader's alpha in its frames.
