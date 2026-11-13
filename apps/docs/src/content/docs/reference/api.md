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
- For UI components (`toggle-switch`, `progress-bar`, `gauge`): `options.data` (typed data), `options.state` with `options.onEvent` (a controlled switch: `"change"` fires, nothing moves until `setState`), `options.label` and `options.reducedMotion`; the instance has `setData`, `setState` and `state`.
