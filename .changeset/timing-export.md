---
"@pixerate/flair": minor
---

Timing effects now render in Node. `exportEffect` and `flair render <id> --video clip.mp4 -o out.mp4` retime a video file with no browser: ffmpeg decodes it once, `TimingRenderer` blends the frames, and the result is encoded to mp4, webm, mov, gif or png frames, at the video's own size and frame rate unless asked. The clip's own sound is left out because it would not follow the retime. `flair render` gains `--audio` to mux another track, and keeps a retimed video's frame rate when `--fps` isn't given. `flair effects --kind` now takes `camera` and `timing`.
