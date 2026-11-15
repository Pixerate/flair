---
"@pixerate/flair": minor
---

`flairEffects()` offers text treatments to `@pixerate/editor`'s editors (0.330 and later, the first with text treatments in the effects contract): they are listed as `text-treatment` effects with the use `text-treatment`, no inputs and `#rrggbb` colour controls (`color` is the agent's colour); `capabilities.supportsTextTreatments` is set, with `soft-sweep` as `defaultTextTreatment`; and `textTreatmentPlan(id, { stage, time, target, reduceMotion }, values)` gives Flair's own plan, refusing unknown ids, other kinds, bad requests and bad values with the contract's errors. `createRenderer` and authoring refuse treatments, pointing at `textTreatmentPlan`. For an editor older than 0.330, pass `kinds` without `text-treatment`.

In Swift, `FlairEffectProvider` is the editor package's `TextTreatmentProvider` (editor package 0.73 and later), and the new `FlairTextTreatmentLayers` is its `TextTreatmentRenderer`, drawing plans with `FlairTextTreatmentRenderer`'s Core Animation layers.
