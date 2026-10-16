---
"@pixerate/flair": minor
---

Scene shots can choose how the camera gets into them with `camera.transition`:

- `"move"` (the default) eases across as before.
- `"whip"` whip-pans off the last framing and onto the new one in a streak of motion blur.
- `"zoom"` punches in and cuts to the new framing settling out.
- `"cut"` jumps straight there and takes no time.

The player, the standalone HTML player and the Lottie, Apple Motion, FCP7 and EDL exporters all play them. `transitionView` gives the camera part-way through any of them.

New catalog shader **Whip pan** (`transition-whip-pan`): a two-image whip pan or zoom punch. The motion blur peaks at the cut and there's a slight scale punch. It has presets for whip left, whip up, zoom punch and hard whip.
