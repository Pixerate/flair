---
title: Motion Primitives
description: 23 reusable animation primitives for SVG elements.
---

# Motion Primitives

`@pixerate/flair/motion` provides 23 composable motion primitives defined as declarative data structures:

- **Entrances**: Pop, FadeIn, SlideUp, Unfold, Stamp, DrawStroke
- **Exits**: Shrink, Dissolve, SlideDown
- **Emphasis**: Pulse, Bounce, Jiggle, Flash, Float
- **Path Motions**: FollowPath, RotateAround, Orbit

```ts
import { applyPrimitive, PRIMITIVES } from "@pixerate/flair/motion";

const motion = applyPrimitive(baseSvg, PRIMITIVES.popEntrance, {
  duration: 600,
  easing: "spring",
});
```
