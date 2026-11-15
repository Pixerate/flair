---
"@pixerate/flair": minor
---

Text treatments: a new `text-treatment` kind and `treatment` category for how edits to a range of text look (an agent checking a sentence, selecting a word, typing over it, the change landing, and its caret with a name tag). A treatment's stages are data, and `textTreatmentPlan` turns a stage at a moment into a layer plan (rectangles, gradients, text, colours, opacities) over the host's line rectangles, with a Reduce Motion version of every stage.

- Seven treatments: `soft-sweep` (the default, the writing partner's look), `marker-swipe`, `glow-underline`, `shimmer`, `scan-line`, `presence` and `design-frame`, each with presets, and `color` as the agent's colour.
- Web: `mountTextTreatment` (`/embed`) draws stages in SVG overlays behind and above a container's text, from `rangeRects` (a DOM `Range`'s lines) and `caretAt`; `mountEffect` plays a treatment's scripted edit (`previewTextTreatment`), as the demo and docs galleries do.
- Swift: `FlairTextTreatments` plans the same stages from the same data, checked against plans written by TypeScript, and `FlairTextTreatmentRenderer` draws them with Core Animation layers.
- Agents: `catalog.search` takes `kind: "text-treatment"`, and the new `catalog.treatment` command shows what a stage draws. `effect.load`, scene layers, recording, export and `flairEffects()` (whose contract has no treatments yet) refuse them, saying what to use instead.
