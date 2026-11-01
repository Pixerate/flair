---
"@pixerate/flair": minor
---

**Breaking:** a scene's shots now arrange catalog effects as **layers**, in place of the 12 built-in scene effect types, which were validated but never drawn.

- `Shot.layers`: each layer is a catalog shader or vector effect (`effect`, `preset`, `values`), a custom shader (`source`), or a bare picture, with a `subject` (`{ image }`, `{ video }`, `{ svg }`, `{ text }`, or `{ slot: "name" }` that the host fills at play or record time), a `role` (`background`, `subject`, `overlay`), a place (`rect` or element `ids`, else the whole screen), `from`/`until` (ms, or `{ shots: n }`; by default until the next shot), `opacity` and `fade`.
- `Shot.transition`: a catalog transition into the shot, from the last shot's final frame (`uFrom`) to the new one (`uTo`) by `uProgress`, beside or instead of the camera's `in` (without one, the camera cuts).
- `playScene` takes `subjects` for slots and tells boards `setLayers(layers, ms)` and `setTransition(transition)`; `sceneTimeline` lays out shots, layers and transitions in ms.
- `scenePlan(scene)` works a scene out into a renderer-neutral `ScenePlan` (plain JSON, schema at `@pixerate/flair/schemas/scene-plan.json`) that the web player draws and a native player could.
- `@pixerate/flair/embed`: `recordScene` records a scene (MP4, WebM, GIF, PNG frames) as `recordEffect` records an effect, `mountScene` plays one in a page, and `SceneCompositor` draws a plan onto a canvas.
- `standaloneSceneHtml` is now async and plays layers and transitions, carrying only the effects the scene uses; `flair scene html --subject slot=file` fills slots.
- The Lottie, Motion, FCP7 and EDL exporters carry layers and transitions as far as each format can, and `sceneExportNotes` names what they leave out (written into each file, printed by `flair export`).
- Copies and paths: a `{ type: "replicate", … }` run command lays out copies of an element (the replicator, now wired in), and a `{ type: "path", … }` behavior moves an element along a curve (the motion path, now wired in).
- Agents: `validateScene` refuses bad layers, transitions, copies and paths with the valid choices; `checkSceneLayers` checks presets and values against the catalog, and the scene tools merge both into every edit's issues. The new `find_layer_effects` tool searches the catalog for layer effects and transitions without loading it into the root bundle. `write_scene` and `update_shot` describe layers.

**Migrating:** `validateScene` says what to write for each old field.

| Before | Now |
| --- | --- |
| `scene.media` + `{ type: "media", media: id }` | a layer `{ source, role: "background" }` on the shot that shows it |
| `{ type: "glow" \| "burst" \| …, ids }` | a catalog effect, e.g. `{ effect: "glow-ring-pulse", ids }` (`find_layer_effects` finds one) |
| `stopEffects: [id]` | the layer's `until: { shots: n }` (or ms) |
| rig target `media.<id>.<control>` | `layers.<id>.<control>` (give the layer an `id`) |
| `standaloneSceneHtml(scene)` | `await standaloneSceneHtml(scene)` |
| the `set_media` scene tool | `update_shot` with `layers` |
| `SceneBoard.setEffects` / `setMediaTime` | `setLayers` / `setTransition` |
| `ShotLog.effects` | `ShotLog.layers` |

Removed: `Effect` and its 12 types, `EFFECT_TYPES`, `EFFECT_FADE_MS`, `RunningEffect`, `effectGone`, `effectOpacity` and `SceneMedia`.
