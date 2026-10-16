---
"@pixerate/flair": minor
---

`glare-sweep` (overlay): the light sweep duotone used to have built in, now its own effect, as 0.22.0 should have added when it took the sweep out of `image-duotone`. A soft diagonal glare glides across without a pause, with strength, speed, tilt, sharpness and colour controls. It is added light: laid over a picture with `mix-blend-mode: plus-lighter`, `image-duotone` plus `glare-sweep` at their defaults matches the old duotone to within one level in 255; with normal blending it is a slightly softer, screen-like glare. `image-duotone`'s description now points to it (rather than `shine-sweep`, a different, intermittent gloss).
