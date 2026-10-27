---
"@pixerate/flair": minor
---

Add video finishing and kinetic caption effects, and shutter-angle motion blur for recordings and exports:

- `image-chroma-key`: green and blue screen keying with spill suppression and kept shadows.
- `image-lut-grade`: 3D LUT grading (tiles or Hald), or built-in teal & orange, punchy and film noir looks, with skin tones protected.
- `corner-pin`: four-corner perspective pin.
- `bloom` gains `uStreakAngle` and `uStreakLength` for angled anamorphic streaks.
- `caption-word-bounce`, `caption-karaoke` and `caption-pop`: word-by-word caption effects.
- `shutterAngle` and `shutterSamples` on `recordEffect`, `exportEffect` and `exportMotionGraphic`, and `--shutter-angle` / `--shutter-samples` in the CLI. Sub-frames are averaged with premultiplied alpha.
