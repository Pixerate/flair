---
title: Multi-Shot Scenes
description: Directing multi-camera compositions and sequential cuts.
---

# Multi-Shot Scenes

Flair includes a declarative directing schema for orchestrating complex visual narratives across multiple shots and cameras.

```ts
import type { Scene } from "@pixerate/flair";

const promoScene: Scene = {
  id: "hero-intro",
  duration: 8.0,
  shots: [
    {
      id: "shot-1",
      duration: 3.5,
      camera: { x: 0, y: 0, zoom: 1.0 },
      effects: [{ id: "star-trails" }],
    },
    {
      id: "shot-2",
      duration: 4.5,
      camera: { x: 0, y: 0, zoom: 1.4 },
      effects: [{ id: "flaming-text" }],
    },
  ],
};
```
