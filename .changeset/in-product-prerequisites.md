---
"@pixerate/flair": minor
---

In-product prerequisites (#228):

- Shaders respect `prefers-reduced-motion`: `ShaderRenderer`, `mountEffect`, `<FlairEffect>` and `use:flairEffect` take `reducedMotion: "user" | "always" | "never"` (default `"user"`) and render one rest frame, then stop (a shader effect's new `rest` time, else its `build`, else 1 s; a `uProgress` one-shot shows its end). Vector effects mounted with `mountEffect` now respect it too. Editors that must animate pass `"never"`.
- Lazy entry points: `@pixerate/flair/embed/lazy`, `/react/lazy` and `/svelte/lazy` have the same API but load effects by id one by one from a compact index, never pulling in the full catalog (about 26–30 KB gzipped up front instead of ~425 KB).
- One-shot moments: `playMoment(anchor | "viewport", effect, options)` in `/embed`, `useFlairMoment()` in React and the `flairMoment` action in Svelte play an effect once on a pointer-transparent overlay and dispose it (DOM and GL context); they play nothing under reduced motion or without WebGL2.
- Loader progress binding: UI hints now cover shader effects, and the new `loader` contract binds a `value` (0–1, or `null` while a job cannot tell) through `uiBindings.progress`; `liquid-loader` and `flame-loader` take it as `data: { value }` and report it as a progress bar.
