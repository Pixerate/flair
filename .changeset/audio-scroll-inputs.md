---
"@pixerate/flair": minor
---

Sound and scrolling as shader inputs, and effects that use them.

- New built-ins: `iAudio` (level, bass, mid, treble), `iSpectrum[16]` (64 log-spaced bins), `iBeat` (seconds since the last beat) and `iScroll` (progress through the viewport, page scroll, velocity, scrolling).
- `ShaderRenderer.setAudioSource(element | stream | node)` listens through a shared `AudioContext` and `AnalyserNode`; `ShaderRenderer.setScrollProgress(p)` pins the scroll for scrubbers. `ShaderFrames.render(t, { audio, scroll })` scripts both.
- `AudioAnalysis` (pure, deterministic), `analyseAudioBuffer` (offline, frame-exact, with a small radix-2 `fft`), `LiveAudio`, `sharedAudioContext`, `ScrollTracker` and `viewportProgress`.
- `SvgPlayer` takes `trigger: "scroll"` (scrubbing with the page, over `scrollRange`) and gains `setProgress(p)` and `scrollPosition(p)`.
- `effectInputs` reports `audio` in `accepts` and `scroll` in `interactions`; `mountEffect` takes an `{ audio }` subject; `recordEffect` takes `audio` (an `AudioBuffer` or a URL) to drive audio-reactive shaders frame for frame and mux the sound as AAC (mp4) or Opus (webm). `standaloneHtml` takes `{ audio: url | "mic" }`.
- New `audio` category: spectrum-bars, circular-spectrum, waveform-line, bass-pulse, audio-particles, audio-plasma, vinyl. New `scroll` category: scroll-reveal, parallax-layers, scroll-progress-glow, scroll-velocity-blur, scroll-zoom, scroll-draw, scroll-counter, scroll-steps. All play idle demos with no sound or scrolling.
