---
"@pixerate/flair": minor
---

Camera moves are now catalog effects of their own kind (`kind: "camera"`, category `camera`): `camera-glide`, `camera-whip-pan`, `camera-punch-zoom` and `camera-cut` get the camera into a shot, and `camera-ken-burns` and `camera-crash-zoom` move it while the shot holds. Each has controls and presets. `findEffects({ kind: "camera", role })` finds them, and `mountEffect` and `recordEffect` preview one on a picture.

Scenes play them through a shot camera's `in` and `during`, by id or as `{ move, ms?, preset?, values? }`. A move's length can now be set per shot; before, every move took 600 ms. The player, the standalone player and the Lottie, Apple Motion, FCP7 and EDL exporters all follow both moves. `validateScene` names an unknown move, a move in the wrong field and a bad value, and the new scene tool `find_camera_moves` lists the moves for agents.

**Breaking:** a shot camera's `transition` and `motionBlur` are replaced, and `validateScene` says what to write instead:
- `transition: "move" | "whip" | "zoom" | "cut"` becomes `in: "camera-glide" | "camera-whip-pan" | "camera-punch-zoom" | "camera-cut"`.
- `motionBlur: n` becomes `in: { move, values: { motionBlur: n } }`. A punch zoom's depth is now its own `punch` control; it was 1 + motionBlur.

`CameraTransition`, `CAMERA_TRANSITIONS`, `TRANSITION_BLUR`, `transitionStrength`, `transitionView`, `CAMERA_MS` and `cutsHalfway` are removed. `CameraShot` has `move`, `during` and `end` in place of `transition` and `motionBlur`, and `moveCut` replaces `cutsHalfway`. `@pixerate/flair/integrations` leaves camera moves out of the editor's effect provider, and the effect editor and Node `exportEffect` refuse them, saying where to use them.
