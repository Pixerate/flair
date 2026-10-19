---
"@pixerate/flair": minor
---

Add catalog effect capability predicates, query filters, and prompt integration helpers:
- Add `canOutputAnimatedSvg` and `canOutputVideo` predicates for querying effect output capabilities.
- Add `output?: "animation" | "video"` support to `EffectQuery` in `findEffects`.
- Add `isHumanReadableControl` to identify configurable effect controls suitable for user interfaces and prompts while filtering out internal/engine uniforms and textures.
- Add `getPromptVariables` to extract human-readable effect controls as prompt variable definitions with constraints or default options.
- Add `getEffectReferenceSvg` to extract rendered SVG markup from vector effects for renderer template reference.
