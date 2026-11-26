---
"@pixerate/flair": minor
---

New `pixel-speckles` overlay shader: faint, twinkling pixel squares (rounded squares, corners 28% of their side) scattered over a transparent background and tinted along a four-stop gradient, for decorating the empty space around a title. Spacing, density, size and opacity ranges, twinkle depth and speed, seed, gradient colours and corner roundness are controls, and up to four keep-clear rectangles (`uClear1`–`uClear4`, normalised x, y, width, height from the top left; zero-sized when unused) leave speckles out where a title or button sits. Light page (fainter and sparser) and Dark page presets use Swash's brand gradient. It loops every 30 s, rests on a still frame under reduced motion, and is compiled to Metal as `PixelSpeckles` in `FlairEffects`.
