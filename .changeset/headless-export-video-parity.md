---
"@pixerate/flair": minor
---

Support headless Chrome container execution, video metadata probing, audio pass-through muxing, and permissive control checks:

- **Headless Chrome Discovery & Linux Container Support**:
  - Discover Playwright and Puppeteer cached browsers (`~/.cache/ms-playwright`, `~/.cache/puppeteer`, and system locations).
  - Add standard Linux container flags (`--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, SwiftShader WebGL fallback flags) and support custom Chrome flags via `chromeFlags` export option and `FLAIR_CHROME_FLAGS` environment variable.
  - Optional fallback to `@ffmpeg-installer/ffmpeg` when `ffmpeg` is not in system PATH.
- **Video Probing & Export Parity**:
  - Add `probeVideo(file: string): Promise<VideoProbe>` (and export from `@pixerate/flair/node`) to probe video duration, native dimensions (`width`, `height`), and audio stream presence.
  - Default `exportEffect` output dimensions to probed video input dimensions and video duration without capping at 10s.
  - Automatically mux and preserve original video audio streams (or custom audio tracks) when exporting to `.mp4`, `.webm`, or `.mov` with `audio` option support (`'copy' | 'mute' | false | boolean | string`).
- **Permissive Control Validation**:
  - Add `ignoreUnknownControls?: boolean` to `checkEffectValues` and `EffectExportOptions` to safely allow extra/custom pipeline control keys without throwing validation errors.
