---
"@pixerate/flair": minor
---

Scene cameras can turn in 3D and blur while they move. A shot's `camera` takes `tilt`, `turn` and `roll` (degrees), `perspective` and `motionBlur` alongside its framing, or on their own to change the angle in place, and angles carry over until a shot changes them. `playScene` passes views with the angle and a speed-based `blur`. New helpers: `cameraTransform` and `cameraFilter` (CSS for a board layer), `projectPoint`, `motionBlur`, `shotView`. `validateScene` checks the new fields, and the standalone scene player now plays camera moves (framing, angle and blur) and moves through shots when playing.
