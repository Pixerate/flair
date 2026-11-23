---
"@pixerate/flair": minor
---

A new `montage` category for effects that take a list of media (#230):

- `EffectItems` on a definition declares a montage's `min`/`max` items, the image controls (`slots`) they fill, and how longer lists cycle (`swap` or `carousel`). `effectInputs(effect).items` reports it, and `findEffects({ accepts: ["items"] })` finds montages.
- Subjects carry optional `device`, `label`, `focus` and `duration` metadata. `mountEffect` fills the slots and rotates longer lists through them as it plays, with `itemDuration`, `overlap`, `loop`, `shuffle` and `onItem` (also on `<FlairEffect>` and `use:flairEffect`). It holds while paused or scrolled out of view, plays only the video items a slot shows, and stays still under reduced motion.
- A shared library of generic device frames: `DEVICE_KINDS`, `DEVICE_FRAMES` (size and screen rectangle) and `DEVICE_GLSL`.
- Starter effects: `device-showcase` (two to five devices in a staggered 3D layout that swap screens in sequence; presets "Phone + laptop", "Device family", "Floating stack") and `screenshot-carousel` (one frame cycling through screenshots with a slide, fade, zoom or wipe).
- An `items.set` editor command, so agents can set a montage's list.
