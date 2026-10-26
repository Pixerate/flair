---
title: Declared Controls
description: How @control annotations define interactive parameter surfaces.
---

# Shader Controls & Uniforms

In Flair, fragment shader source code is the single source of truth. Every configurable uniform is annotated with a special inline `// @control` comment.

## Control Syntax

```glsl
#version 300 es
precision highp float;

out vec4 fragColor;

// @control uFlames color [1.0, 0.4, 0.1] "Flame Tint"
uniform vec3 uFlames;

// @control uSpeed float 1.0 min 0.1 max 5.0 step 0.1 "Speed"
uniform float uSpeed;

void main() {
    // Shader logic...
}
```

Flair automatically parses these annotations into structured JSON definitions:
- Control types (`float`, `vec2`, `vec3`, `color`, `sampler2D`, `bool`)
- Default values and boundaries (`min`, `max`, `step`)
- Human-readable display labels
