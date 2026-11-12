---
"@pixerate/flair": minor
---

Path trails and tubes can be sized by a brush instead of by the frame. `comet-trail`, `ribbon-trail`, `sparkle-trail`, `brush-trail`, `ghost-trail`, `light-painting`, `glass-tube` and `glass-writing` gain a `uUnit` control ("Size unit", px, default 0): when it is set, the widths, sizes and glows they draw are shares of `uUnit` px instead of the frame's height (or, for the tubes, its shorter side), while their positions stay in pixels. An editor painting one along a stroke on a large canvas sets it from the brush's size, so the stroke looks as it does in a small preview. With `uUnit` 0 nothing changes.
