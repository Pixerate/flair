---
"@pixerate/flair": minor
---

Scene layers can retime their video. A layer whose subject is `{ "video": url }` (or a slot the host fills with a video) takes a timing effect as its `timing`, by id (`"timing": "retime-reverse"`) or with a preset and values (`{ "effect": "long-exposure", "preset": "Light trails" }`). The layer's `effect`, if any, treats the retimed picture. `validateScene` checks the timing effect, its preset and values and the subject, with refusals that say what to write; a timing id in `effect` now points at `timing`. `scenePlan` carries it as the layer's `timing` (`{ effect, values }`, in the plan's JSON Schema), and `SceneCompositor`, `mountScene`, `recordScene` and the standalone scene page draw it with `TimingRenderer`. For agents, the new `retime_layer` scene tool sets or removes a layer's timing, `find_layer_effects` lists timing effects (`kind: "timing"`, `goesIn: "timing"`), and the outline shows each layer's timing.
