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

## Embed (`@pixerate/flair/embed`)

- `mountEffect(element, effect, options)`: High-level DOM mount function returning an active `EffectInstance`.
