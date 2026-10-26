---
title: Interactive Pointer & Trails
description: Built-in uniforms for pointer tracking, click history, and motion trails.
---

# Interactive Pointer & Trails

Beyond Shadertoy's simple `iMouse`, Flair provides comprehensive interactive uniforms for every fragment shader:

## Built-In Interactive Uniforms

- `uniform vec4 iPointer`: XY coordinates normalized to `[0, 1]`, hover progress `[0, 1]`, and duration held.
- `uniform vec4 iClicks[8]`: Circular buffer of recent clicks (XY coordinates, time elapsed, click type).
- `uniform vec4 iTrail[32]`: Historical pointer trail sampled over the last second.

## Example: Pointer Ripple Effect

```glsl
// Distance to active pointer
float dist = length(vUv - iPointer.xy);
float ripple = sin(dist * 30.0 - iTime * 4.0) * iPointer.z;
```
