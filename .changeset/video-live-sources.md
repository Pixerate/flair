---
"@pixerate/flair": minor
---

Effects on HTML5 video: `ShaderRenderer.setLiveSource(name, video)` and `ShaderFrames.setLiveSource` show a playing `<video>` (or a canvas) in an image control. The current frame is uploaded each time it changes, and a paused preview still follows the video. `seekVideo` steps a video for frame-exact export, and `ready()` waits for each video's first frame. Shader effects with image controls now carry `video: "filter" | "transition" | "interactive" | "stills" | "none"`, which says how they suit video. `findEffects({ video })` and the `catalog.search` command filter by it.
