---
"@pixerate/flair": minor
---

`flairEffects()` now offers Flair's sequence templates to `@pixerate/editor`'s editors (`capabilities.supportsTemplates`, used from editor 0.233). `listTemplates` and `describeTemplate` give the templates and their slots, shaped for a form. `instantiateTemplate` fills one and returns an `EffectSequence` of shots with framings, camera moves, catalog effect layers and transitions, naming in `notes` anything a sequence cannot carry.
