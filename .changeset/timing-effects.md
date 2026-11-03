---
"@pixerate/flair": minor
---

Add timing effects: a new `timing` kind and category that retimes real video footage. The kind includes a speed change, speed ramp, reverse, boomerang, freeze frame, stutter, step frames, frame echo and long exposure. Each effect is a pure function from a moment of the result to the weighted footage frames it shows (`timingSample`, `timingLength`). `TimingRenderer` and `FrameBlender` draw those frames from any `TimingFootage`. `mountEffect` and `recordEffect` play timing effects on a `{ video }` subject, or on Flair's own preview clip (`previewFootage`, `videoFootage` in `/embed`). Agents find them with `catalog.search` (`kind: "timing"`) and inspect a retime with the new `catalog.timing` command.
