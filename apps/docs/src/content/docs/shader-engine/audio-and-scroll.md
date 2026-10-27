---
title: Audio & Scroll Reactivity
description: How Flair shaders sync with Web Audio streams and page scroll position.
---

# Audio & Scroll Reactivity

Flair fragment shaders can respond directly to ambient page scrolling and real-time audio playback.

## Sound Uniforms

- `uniform vec4 iAudio`: Overall amplitude, bass, mid-range, and treble levels.
- `uniform float iSpectrum[16]`: 64 logarithmically spaced frequency bins.
- `uniform float iBeat`: Seconds elapsed since the last detected rhythmic beat.

```ts
import { ShaderRenderer } from "@pixerate/flair";

const renderer = new ShaderRenderer(canvas);
renderer.setAudioSource(document.querySelector("audio"));
```

## Scroll Uniforms

- `uniform vec4 iScroll`: Viewport scroll progress, page pixel offset, velocity, and scrolling state.
