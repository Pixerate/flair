---
"@pixerate/flair": minor
---

A lazy catalog: `@pixerate/flair/catalog/lazy` loads every effect's metadata up front (`EFFECT_META`, `getEffectMeta`, `findEffectMeta`: ids, names, categories, descriptions, tags, controls, preset names, inputs and video use; about 91 KB gzipped, against 425 KB for the full catalog), and loads each effect's shader or picture on demand with `loadEffect(id)` (a median of 12 KB). The full catalog gains `loadEffect` and `effectMeta` with the same shapes, and is unchanged otherwise.
