---
title: SVG Motion
description: Deterministic vector frame evaluation and playback.
---

# SVG Motion

Flair's vector engine treats animation as a pure mathematical function of time:

```ts
import { svgFrame } from "@pixerate/flair/vector";

// Evaluate exact SVG markup at t = 1.5 seconds
const markup = svgFrame(effectDefinition, 1.5, {
  color: "#8b5cf6",
});
```

Because frames are evaluated deterministically:
- Video/GIF exporters can record seamless loops without dropped frames.
- SSR hydration matches client output byte-for-byte.
- Fast scrubbing along page scroll positions is stutter-free.
