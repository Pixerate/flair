---
title: Shader Effects
description: WebGL2 fragment shaders, categories, and presets.
---

# WebGL2 Shader Effects

Flair includes over 300 GLSL ES 3.00 fragment shaders designed for high performance and visual richness.

## Categories

- **Loaders**: Liquid fill, glowing spinners, flame progress bars, gooey metaballs.
- **Fire & Pyrotechnics**: Flame borders, burning text, campfire, fireballs, burning edges.
- **Holograms**: Scanlines, chromatic aberration, holo projection, HUD displays.
- **Space & Atmosphere**: Star trails, meteor showers, northern lights, clouds, weather.
- **Beauty**: Skin smoothing, dewy glow, soft focus, lip tint, blush, eyeshadow, highlighter, product shine.
- **Distortions & Glitch**: CRT scanlines, pixelation, ripple, chromatic split.
- **Transitions**: Cross-zooms, light leaks, twister, wipes, dissolve.

## Live Shaders via `@pixerate/flair/catalog/lazy`

To avoid inflating initial web bundle sizes, load shaders dynamically:

```ts
import { loadEffect } from "@pixerate/flair/catalog/lazy";

const effect = await loadEffect("liquid-loader");
console.log("Controls:", effect.controls);
console.log("Presets:", effect.presets);
```
