---
title: API Reference
description: Complete public API reference for @pixerate/flair.
---

# API Reference

## Core (`@pixerate/flair`)

- `ShaderRenderer(canvas, options)`: GPU WebGL2 fragment shader runner.
- `ManualClock`: Deterministic frame step clock.
- `blend(bottom, top, mode)`: Color blend calculations.

## Lazy Catalog (`@pixerate/flair/catalog/lazy`)

- `EFFECT_META`: Array of 450+ effect summaries.
- `loadEffect(id)`: Asynchronously loads the effect shader or vector markup.
- `findEffectMeta(query)`: Query effects by text, category, tag, or inputs.
- `UI_HINTS`, `uiValues(effect, data)`: effects offered as UI components (`EffectMeta.ui`, a `UiDescriptor` with a `contentHash`, and `uiBindings`), and their typed data as control values.

## Embed (`@pixerate/flair/embed`)

- `mountEffect(element, effect, options)`: High-level DOM mount function returning an active `EffectInstance`.
- `options.reducedMotion` (`"user"` by default): under `prefers-reduced-motion` a shader holds one rest frame, a vector effect its last frame.
- `playMoment(anchor, effect, options)`: plays a shader or vector effect once over an element (or `"viewport"`) on a pointer-transparent overlay, then removes it; settles `false` without playing under reduced motion or without WebGL2.
- Montages (`category: "montage"`, `effectInputs(effect).items`): `options.subject` is a list of `{ image | video | svg, device?, label?, duration? }`, rotated through the effect's slots as it plays; `options.itemDuration`, `overlap`, `loop`, `shuffle`, `onItem(index)`.
- `@pixerate/flair/embed/lazy` (and `/react/lazy`, `/svelte/lazy`): the same API, loading effects by id one by one instead of the whole catalog; there `mountEffect` returns a promise.
- For UI components (`toggle-switch`, `progress-bar`, `gauge`, and the loaders `liquid-loader` and `flame-loader`, whose `data.value` is 0–1 or `null` while a job cannot tell): `options.data` (typed data), `options.state` with `options.onEvent` (a controlled switch: `"change"` fires, nothing moves until `setState`), `options.label` and `options.reducedMotion`; the instance has `setData`, `setState` and `state`.
