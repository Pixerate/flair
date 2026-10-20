---
"@pixerate/flair": minor
---

JSON Schemas. `effectControlSchema(id)` (catalog) gives a strict JSON Schema (draft 2020-12) of an effect's control values: each control with its type, range, unit and default, colours as sRGB 0–1 or CSS colours, images as URLs. `controlsSchema` and `controlSchema` do the same for any controls, and an optional `unit=` attribute on `@control` declares a control's unit. `EFFECT_DOCUMENT_SCHEMA` (editor) describes an effect document, and is published as `@pixerate/flair/schemas/effect-document.json`. Agents get the current effect's schema with the `values.schema` command. Fixes `createEffectDocument` giving 45 vector effects a `NaN` duration when their timing is set by controls.
