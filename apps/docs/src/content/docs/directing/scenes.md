---
title: Multi-Shot Scenes
description: Directing shots on one board, each arranging catalog effects as layers, with catalog transitions and camera moves between them.
---

# Multi-Shot Scenes

A scene is a sequence of shots on one large board. Each shot frames part of the board with its camera, runs commands that draw or change elements, arranges **catalog effects as layers** over them, shows a title and caption, and holds. It gets into each shot with a **camera move** from the catalog, a **catalog transition**, or both, and the camera can keep moving while the shot holds.

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
      layers: [
        { id: "sky", effect: "aurora", role: "background", until: { shots: 2 } },
        { effect: "lower-third", role: "overlay", values: { name: "Ingest" }, from: 300 },
      ],
      hold: 1500,
    },
    {
      title: "Compute",
      camera: { frame: ["compute"], tilt: 20, in: { move: "camera-whip-pan", values: { motionBlur: 3 } } },
      layers: [{ effect: "image-duotone", subject: { slot: "productShot" }, ids: ["compute"] }],
      hold: 1200,
    },
    {
      title: "Ship",
      transition: { effect: "transition-film-burn", ms: 900 },
      hold: 1200,
    },
  ],
};
```

## Layers

A shot's `layers` are drawn over (and under) its board:

- **What:** a catalog shader or vector effect (`effect`, with `preset` and `values`), a custom shader (`source`, GLSL with `mainImage` and `// @control` uniforms), or a bare picture (only a `subject`).
- **On what:** `subject` is `{ image }`, `{ video }` (a URL), `{ svg }`, `{ text }`, or `{ slot: "name" }` for the host to fill at play or record time.
- **Where:** without `rect` or `ids` it fills the screen; with a `rect` (board units) or `ids` (elements, with `padding`) it sits on the board and moves with the camera. `role` stacks it: `background` under the elements, `subject` over them on the board (the default when placed), `overlay` over everything but the title and caption.
- **When:** `from` and `until` are ms after the shot starts, or `{ shots: n }` for the start of a later shot; a layer lasts until the next shot by default. `opacity` and `fade` (ms) soften it.

The scene tool `find_layer_effects` lists effects with what they take (`{ accepts: ["image"] }`, `{ kind: "vector" }`, `{ transparent: true }`), their controls and presets.

## Slots

A slot is a subject the scene leaves to its host, so one scene plays with any product shot or logo:

```ts
await playScene(scene, board, clock, { subjects: { productShot: { video: videoEl } } });
const mp4 = await recordScene(scene, { subjects: { productShot: { image: "/shot.jpg" } } });
```

`flair scene html scene.json --subject productShot=./shot.jpg` fills one in a standalone page. A slot left out fails the shot that uses it when subjects are given, and is noted otherwise.

A [sequence template](../templates/) declares a scene's slots, with types, labels and defaults, alongside `{{placeholders}}` for words, colours and numbers.

## Transitions

`transition: { effect, ms?, preset?, values? }` names a catalog transition into the shot (`find_layer_effects` with `transition: true` lists them). The last shot's final frame is its `uFrom`, the new shot its `uTo`, and `uProgress` runs from 0 to 1 over `ms` (800 by default). Without a camera `in` the camera cuts, so the transition does the move; with one, the camera moves inside the incoming picture as it is revealed.

## Copies and paths

- `{ type: "replicate", element, pattern: "grid" | "line" | "circle" | "spiral", count, … }` in a shot's `run` draws copies `<id>_0`, `<id>_1`…; `sequence.delayPerItem` staggers them. A camera `frame` or a layer's `ids` can name the copies, or the element's id for all of them.
- `{ type: "path", target, waypoints: [{ point: [x, y], inTangent?, outTangent? }, …], orient? }` in `behaviors` moves an element along a curve at an even speed while the shot holds; a layer placed over it rides along.

## Camera moves

Camera moves are catalog effects of their own kind (`kind: "camera"`), with controls and presets:

- **Into a shot** (`camera.in`, role `transition`): `camera-glide` (the default), `camera-whip-pan`, `camera-punch-zoom` and `camera-cut`.
- **While a shot holds** (`camera.during`, role `hold`): `camera-ken-burns`, `camera-crash-zoom` and `camera-handheld`. The move plays across the shot's `hold`, and the next shot's move starts where it ends.

Name a move by its id, or give `{ move, ms?, preset?, values? }`. `findEffects({ kind: "camera", role: "hold" })` lists them, and so does the scene tool `find_camera_moves`. On its own, `mountEffect(el, "camera-whip-pan", { subject: { image } })` previews a move on a picture.

Camera moves move the scene's camera across the whole board. The catalog's transitions and picture zooms change pixels inside one effect.

## Checking, playing and recording

- `validateScene(scene)` checks framing, timing, camera moves, layers and transitions, and says what to write instead; `checkSceneLayers(scene)` checks presets and control values against the catalog.
- `simulateScene(scene)` plays it instantly on a manual clock and reviews it.
- `scenePlan(scene)` works it out into plain JSON (shots, the camera at every frame, elements, layers and transitions with their shaders or pictures) that any player can draw; its JSON Schema is `@pixerate/flair/schemas/scene-plan.json`.
- `mountScene(host, scene)` plays it in a page and `recordScene(scene, { format })` records it to MP4, WebM, GIF or PNG frames (`@pixerate/flair/embed`).
- `await standaloneSceneHtml(scene)` (`flair scene html`) is a self-contained page that plays it.
- `flair scene lottie | motn | fcp7 | edl` exports it, camera moves included; each format names the layers and transitions it cannot carry in full (`sceneExportNotes`).

## Moving from scene media and effects

`Scene.media`, `Shot.effects` and `Shot.stopEffects` were replaced by layers; `validateScene` says what to write for each. A media shader becomes a layer with its `source` on the shot that shows it, each built-in effect type a catalog effect, `stopEffects` a layer's `until`, and a rig's `media.<id>.<control>` target `layers.<id>.<control>`.
