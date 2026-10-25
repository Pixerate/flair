---
"@pixerate/flair": minor
---

Render overlays over a picture in Node. `exportEffect` and `exportEffectBuffer` take a `backdrop` (a file path, URL or `data:` URL; `{ imageBuffer, ext }` in `exportEffectBuffer`) drawn under the effect in every frame, `backdropFit` (`cover` by default, `contain` or `fill`), and `region` (`[x, y, width, height]`, normalized 0 to 1) to confine the effect to part of the frame at that box's own size. Without a size, the frame takes the backdrop's own size (JPEG rotation included). A backdrop is refused, with a sentence saying what to do, with `alpha`, with `.svg` output, and for a shader that draws every pixel itself. `flair render` gains `--backdrop`, `--backdrop-fit` and `--region`, and `flair effects` gains `--transparent` to list the overlays a backdrop suits. New Node exports: `effectFrameSize`, `imageNaturalSize`, `backdropSize`, `checkRegion`, `BACKDROP_FITS`, and the types `BackdropFit`, `EffectRegion` and `EffectBufferBackdrop`.
