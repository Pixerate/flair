---
"@pixerate/flair": minor
---

Swift: `FlairEffectProvider` (`FlairEditorEffects`) is now an `AuthoringEffectProvider`, so the Pixerate editors' Swift Effect Authoring tab and `effect_authoring_*` tools edit Flair effects: `openAuthoring` opens a catalog effect (optionally with a preset) for its values, presets, keyframes and timing, or a document saved by `exportDocument` on either adapter. Documents keep the catalog's Metal shader when their GLSL matches the hash `pnpm swift:meta` now writes; GLSL edited on the web is refused on Swift with a message saying where to open it. Shaders get 2 seconds to compile (`compileTimeoutMs`), and `FlairRenderer.prepare(anyEffect:timeoutMs:)` compiles one ahead of a render. Paint editors draw saved Flair documents only with `rawShaders: true`. Needs the editor's Swift package 0.41 or later.
