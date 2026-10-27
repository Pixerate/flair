---
title: Vector Effects
description: Declarative animated SVG graphics and motion paths.
---

# Vector Effects

Flair features 140+ animated vector graphics that run completely in SVG space with zero GPU overhead.

## Key Features

- **Pure SVG Rendering**: Zero WebGL required; crisp at any resolution.
- **Parametric Values**: Modify colors, line weights, and text directly through controls.
- **Scroll & Pointer Scrubbing**: Bind playback directly to scroll position or mouse hover.

## Example

```ts
import { SvgPlayer } from "@pixerate/flair/vector";
import { loadEffect } from "@pixerate/flair/catalog/lazy";

const effect = await loadEffect("infinity-loader");
const player = new SvgPlayer(containerElement, effect, {
  trigger: "hover", // Plays when hovered
});
```
