---
"@pixerate/flair": patch
---

Transparent effects render correctly in Safari. `ShaderRenderer` with `alpha: true` (and so `mountEffect` for overlay effects such as `iridescent-text`) now draws into a premultiplied canvas and premultiplies its output: Safari shows a straight-alpha WebGL canvas as if it were premultiplied, so faint pixels such as soft glows came out as bright, opaque boxes. `createContext` takes a `premultiplied` option and `premultiplyOutput` sets up the blending for it. Pixels read back from `ShaderFrames` and `ShaderPipeline` are unchanged.
