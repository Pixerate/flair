# Scenes

A scene is plain JSON: a board (`stage`, 1920 × 1080 by default) and `shots`. Each shot can draw elements on the board, frame them with the camera, lay catalog effects over or under them as `layers`, and name a catalog `transition` into it. Use a scene for anything with several beats (a product reveal, an explainer, a title sequence); for one effect on a page, use `mountEffect` or `<FlairEffect>` instead.

## A minimal scene

```json
{
  "name": "launch",
  "shots": [
    {
      "title": "Meet Orbit",
      "hold": 2000,
      "camera": { "frame": ["card"], "during": "camera-ken-burns" },
      "run": [{ "type": "element", "element": { "id": "card", "type": "rectangle", "x": 760, "y": 400, "width": 400, "height": 280, "text": "Orbit" } }],
      "layers": [
        { "effect": "aurora", "preset": "Ember", "role": "background" },
        { "effect": "lower-third", "preset": "News", "role": "overlay", "values": { "name": "Orbit", "title": "Now shipping" }, "from": 300 }
      ]
    },
    {
      "title": "Details",
      "hold": 2400,
      "transition": { "effect": "transition-flare-wipe", "ms": 900 },
      "camera": { "x": 0, "y": 0, "width": 1920, "height": 1080, "in": "camera-whip-pan" },
      "layers": [{ "effect": "image-duotone", "subject": { "slot": "productShot" }, "rect": { "x": 1300, "y": 300, "width": 480, "height": 480 } }]
    }
  ]
}
```

- **Layers**: `effect` (a catalog id, with `preset` and `values`) or `source` (your own GLSL, see the flair-author skill). `subject` is `{ image }`, `{ video }`, `{ svg }`, `{ text }` or `{ slot: "name" }`, filled by the host when it plays or records. `role` is `background`, `subject` or `overlay`; `rect` or `ids` place it on the board; `from`, `until`, `fade` and `opacity` time it.
- **Transitions**: an effect from [transitions.md](effects/transitions.md), with `ms`.
- **Camera**: `frame` (element ids) or a box, `in` and `during` camera moves ([camera.md](effects/camera.md)), and `tilt`, `turn`, `roll` for 3D.

## Starting from a template

Templates are scenes with typed slots: `npx flair template list`, `npx flair template show product-reveal`, then

```bash
npx flair template fill product-reveal --set productName="Orbit Mug" --set product=./mug.png -o launch.scene.json --html launch.html
```

In code: `instantiateTemplate(sceneTemplate("product-reveal")!, values)` (from `@pixerate/flair` and `@pixerate/flair/catalog`) returns `{ ok, scene, issues, openSlots }` or `{ ok: false, errors }`.

## Checking a scene

Always check before playing or exporting:

```bash
npx flair scene validate launch.scene.json   # structure, unknown effects (with the nearest ids), subjects, camera moves
npx flair scene review launch.scene.json     # a fast headless run: timing per shot, framing, text size, warnings
```

In code: `validateScene(scene)` returns issues (`[{ shot, message }]`; none means valid), `await checkSceneLayers(scene)` checks presets and control values against the catalog, and `await simulateScene(scene)` returns `{ review }` whose `review.markdown` is the same report as `flair scene review`. Fix every issue it names; the messages say what to write instead.

## Playing and exporting

- Page: `mountScene(host, scene, { subjects: { productShot: { image: "/mug.png" } } })` from `@pixerate/flair/embed`.
- Recording in the browser: `recordScene(scene, { subjects, format: "mp4" })`.
- A standalone page: `npx flair scene html launch.scene.json --subject productShot=./mug.png`.
- Editors: `npx flair scene lottie launch.scene.json out.json` (also `fcp7`, `edl`, `motn`).

## Agents directing scenes at runtime

If the app itself lets a model edit scenes, give the model `FLAIR_AGENT_TOOLS` and apply each call with `applySceneTool(scene, name, input)` (from `@pixerate/flair`); its tools include `find_layer_effects`, `find_camera_moves`, `use_template` and `preview_scene`. That is the app's agent surface, separate from this skill.
