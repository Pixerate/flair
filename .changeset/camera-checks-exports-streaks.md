---
"@pixerate/flair": minor
---

The 3D camera now reaches layout checks, motion blur direction and the exporters. `checkShot` judges framing, edges, text size and the title on screen, through the camera's angle (`screenBox`). A pan's motion blur streaks along its direction (`View.blurAngle`, `cameraBlur` for an SVG blur, `moveBlur`), and the standalone player draws it that way. `cameraTrack` and `cameraSamples` lay the camera out on a timeline, and the exporters use them: Lottie gets a camera rig (in 3D with an AE camera when angled), Apple Motion a keyframed camera group, FCP7 XML a keyframed Distort corner pin with Motion Blur, and EDL a `* CAMERA:` note.
