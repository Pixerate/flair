---
title: Multi-Shot Scenes
description: Directing shots on one board, with camera moves from the catalog between and during them.
---

# Multi-Shot Scenes

A scene is a sequence of shots on one large board. Each shot frames part of the board with its camera, runs commands that draw or change elements, shows a title and caption, and holds. The camera gets into each shot with a **camera move** from the catalog, and can keep moving while the shot holds.

```ts
import type { Scene } from "@pixerate/flair";

const tour: Scene = {
  name: "pipeline-tour",
  stage: { width: 1920, height: 1080 },
  shots: [
    {
      title: "Ingest",
      camera: { frame: ["ingest"], during: "camera-ken-burns" },
      run: [
        { type: "element", element: { id: "ingest", type: "rectangle", x: 200, y: 400, width: 400, height: 280, text: "Ingest" } },
        { type: "element", element: { id: "compute", type: "rectangle", x: 1200, y: 400, width: 500, height: 280, text: "Workers" } },
      ],
      hold: 1500,
    },
    {
      title: "Compute",
      camera: { frame: ["compute"], tilt: 20, in: { move: "camera-whip-pan", values: { motionBlur: 3 } } },
      hold: 1200,
    },
  ],
};
```

## Camera moves

Camera moves are catalog effects of their own kind (`kind: "camera"`), with controls and presets:

- **Into a shot** (`camera.in`, role `transition`): `camera-glide` (the default), `camera-whip-pan`, `camera-punch-zoom` and `camera-cut`.
- **While a shot holds** (`camera.during`, role `hold`): `camera-ken-burns` and `camera-crash-zoom`. The move plays across the shot's `hold`, and the next shot's move starts where it ends.

Name a move by its id, or give `{ move, ms?, preset?, values? }`. `findEffects({ kind: "camera", role: "hold" })` lists them, and so does the scene tool `find_camera_moves`. On its own, `mountEffect(el, "camera-whip-pan", { subject: { image } })` previews a move on a picture.

Camera moves move the scene's camera across the whole board. The catalog's transitions and picture zooms change pixels inside one effect.

## Checking and playing

- `validateScene(scene)` checks framing, timing and camera moves, and says what to write instead.
- `simulateScene(scene)` plays it instantly on a manual clock and reviews it.
- `standaloneSceneHtml(scene)` (`flair scene html`) plays it in a page.
- `flair scene lottie | motn | fcp7 | edl` exports it, camera moves included.
