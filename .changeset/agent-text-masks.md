---
"@pixerate/flair": minor
---

Agents can set a text mask's words. An image control that draws words from a `textImage` (a banner's or caption's `uText`) now takes `{ "text": "…", "font"?, "weight"? }` in the editor's `values.set` and `keyframe.set`. The words become a text image in the default's font and weight unless others are named. `effect.describe` marks these controls `textMask: true`, and `values.schema` describes both forms. Bare words for a text mask are now refused with what to pass instead: before, they were stored as an image path and the effect lost its words. A text image's URL, or a relative image path, still works.
