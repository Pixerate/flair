---
"@pixerate/flair": minor
---

Agent tools are stricter, smaller and more complete.

- Scene tools (`applySceneTool`) check arguments against each tool's schema and refuse calls that cannot apply (a missing or out-of-range shot, deleting a shot that does not exist, removing media that is not there) with `ok: false` and a sentence saying what to fix. Every result has an `output` to send the model: an outline without the full scene, a one-line summary and issues after an edit, the review without its markdown.
- New `batch_scene` tool runs several scene tools as one all-or-nothing change. A `$N.path` reference that does not resolve now fails its step instead of passing the literal text on, and `$5.99`-style text is left alone.
- `validateScene` reports unknown scene and shot fields, mistyped shot fields, commands without a type and shader media without `mainImage`.
- New `effect.setMotion` command, so agents can edit vector pictures.
- `catalog.search` returns `{ total, effects, more? }`, 20 effects at a time unless given `limit` (and `offset` to page). **Breaking** for code that read its result as an array.
- `effect.setSource` returns the compile report (or says the source has not been compiled yet), and `effect.describe` says so instead of `compile: null`.
