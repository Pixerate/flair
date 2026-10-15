# @pixerate/flair

<p align="center">
  <strong>Visual effects and motion graphics for the web: WebGL2 shader effects, animated vector effects, a catalog of ready-made looks, and a UI-agnostic, agent-ready effect editor.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@pixerate/flair"><img src="https://img.shields.io/npm/v/@pixerate/flair.svg?style=flat-square&color=violet" alt="npm version" /></a>
  <a href="https://github.com/Pixerate/flair/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Pixerate/flair/ci.yml?branch=main&style=flat-square" alt="CI build status" /></a>
  <a href="https://pixerate.github.io/flair/"><img src="https://img.shields.io/badge/demo-live-a855f7.svg?style=flat-square" alt="Live demo" /></a>
  <a href="https://github.com/Pixerate/flair/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="MIT License" /></a>
</p>

---

## 🌟 Overview

Flair gives products a library of good-looking, configurable visual effects (hero backgrounds, textures, light, image treatments, transitions, loaders, animated icons and charts) and the tools to make more of them, by hand or with an agent.

### Core Capabilities

- 🎨 **Effect catalog (`@pixerate/flair/catalog`)**: 63 effects, each with controls and presets. There are 46 WebGL2 shaders (gradients, organic textures, patterns, light, space, retro, image effects, transitions) and 17 animated SVG effects (loaders, status icons, titles, charts, counters, node graphs). [Browse them live](https://pixerate.github.io/flair/).
- ⚡ **Shader engine**:
  - Shadertoy-style GLSL ES 3.00 fragment shaders, with controls declared in the source (`// @control`), including image inputs.
  - Compile errors come back with line numbers that match the source.
  - Live previews (`ShaderRenderer`, with optional `{ alpha: true }` for transparent overlays) and many animated or hover-activated thumbnails on one context (`ThumbnailPool`).
  - Frames at exact times (`ShaderFrames`), looping GIFs, and standalone HTML pages.
- ✒️ **Vector motion (`@pixerate/flair/vector`)**: animated SVG described as data. Catalog vector effects declare their controls in the picture (`{{name: type …}}`), text included. It covers attribute tweens, draw-on strokes, motion along paths, counters (`animateCount` / `formatCount` for DOM elements too) and view zooms. Every frame is a pure function of time (`svgFrame`), and `SvgPlayer` plays it (with `scrollTrigger`, `hideWhenPaused`, and `reset()`).
- 🎛️ **Effect editor (`@pixerate/flair/editor`)**:
  - A headless editor for an effect's source, values, keyframes, presets and timeline.
  - Built on [`@pixerate/editor`](https://github.com/Pixerate/editor)'s undo history and command registry, with no UI framework assumed.
- 🤖 **Agent-native, bring your own model**:
  - Every editing action is a command, and the commands are exposed as MCP-shaped tools.
  - Ships instructions for the model. The host supplies the model, keys and agent loop.
- 🎬 **Directing and interchange**: multi-shot scenes with camera moves (3D tilt and motion blur included), procedural effects, validation and fast headless simulation. Also blend modes, Oklab colour and grading, retiming, timecode, and export to Lottie, Apple Motion, FCP7 XML and CMX 3600 EDL.

---

## 📦 Entry points

| Import | What it provides | Runtime dependencies |
| :--- | :--- | :--- |
| `@pixerate/flair` | Shader engine, vector motion, time and easing, colour, blending, transitions, scenes, interchange exporters | None (browser-safe) |
| `@pixerate/flair/catalog` | `EFFECTS`, `getEffect`, `findEffects`, `effectDefaults`, `renderVectorEffect`, `vectorControls`, GLSL helpers, sample images | None |
| `@pixerate/flair/vector` | `SvgMotion`, `svgFrame`, `svgView`, `SvgPlayer`, `animateCount`, `formatCount`, `svgMotionIssues` | None |
| `@pixerate/flair/editor` | `EffectEditor`, effect documents, keyframe tracks, renderer bindings, parameter-panel binding, agent tools and instructions | `@pixerate/editor` ≥ 0.29 (optional peer; only its dependency-free `/history`, `/commands`, `/tools`, `/animation` and `/parameters` subpaths) |
| `@pixerate/flair/node` | `exportMotionGraphic`: renders a shader to GIF/MP4 through headless Chrome and ffmpeg | Node.js |

The `flair` CLI inspects shaders, writes standalone pages and directs scenes (see [CLI](#-cli)).

---

## 🏗️ Architecture

```mermaid
graph TD
  subgraph Effects["Effects (no dependencies)"]
    Catalog["catalog: 63 effects + presets"]
    Shader["shader engine: controls, compile, render, GIF, HTML"]
    Vector["vector motion: SvgMotion, SvgPlayer"]
    Time["time: clocks, easing, keyframes, noise"]
  end
  subgraph Editing["Editing (@pixerate/flair/editor)"]
    Doc["EffectDocument: source, values, tracks, presets"]
    Editor["EffectEditor: state, playhead"]
    Cmds["commands → MCP tools"]
  end
  PE["@pixerate/editor: history, commands"]
  Host["Your app: UI (any framework) + your model"]

  Catalog --> Shader
  Catalog --> Vector
  Doc --> Editor
  Editor --> Cmds
  PE --> Editor
  PE --> Cmds
  Editor -- bindShaderRenderer / bindSvgView --> Shader
  Editor --> Vector
  Host --> Editor
  Host -- tool calls --> Cmds
```

Flair stays free of LLM SDKs and UI frameworks. Your app owns the interface and the model. Flair owns the rendering, the effect model and the tool surface.

---

## 🚀 Quickstart

```bash
npm install @pixerate/flair
# For the editor:
npm install @pixerate/flair @pixerate/editor
# For the ready-made React (or Svelte) controls panel:
npm install @pixerate/editor-react
```

### 1. Drop in a catalog effect

```ts
import { ShaderRenderer, SvgPlayer, ThumbnailPool, animateCount } from "@pixerate/flair";
import { getEffect, effectDefaults, renderVectorEffect } from "@pixerate/flair/catalog";

// A shader background (or pass { alpha: true } with uBackgroundAlpha: 0 for a transparent overlay)
const aurora = getEffect("aurora")!;
if (aurora.kind === "shader") {
  const preview = new ShaderRenderer(document.querySelector("#hero")!);
  preview.setSource(aurora.source);
  preview.setValues(effectDefaults(aurora, { preset: "Ember", values: { uSpeed: 0.5 } }));
}

// Many shader cards sharing one WebGL context, animating only while hovered
const pool = new ThumbnailPool({ hoverOnly: true });

// An animated SVG effect, with scroll-triggered playback or hover reset (hideWhenPaused + reset())
const spinner = getEffect("spinner")!;
if (spinner.kind === "vector") {
  new SvgPlayer(document.querySelector("#loading")!, renderVectorEffect(spinner, { accent: "#0ea5e9" }), {
    hold: spinner.hold,
  });
}

// Standalone DOM number counter using Flair's clock and easing curves
animateCount({
  element: document.querySelector("#year")!,
  from: 2010,
  to: 2026,
  ms: 900,
  ease: "out",
});
```

Find effects with `findEffects({ text: "glow", category: "light", kind: "shader" })`. Each effect has an `id`, `name`, `description`, `category`, `tags` and optional `presets`. Image effects default to built-in sample pictures, so they look right before you set `uImage` to your own URL.

A vector effect declares its controls in its picture, the way a shader declares its uniforms: the first `{{name: type …}}` declares a control (`float`, `int`, `bool`, `color` or `text`, with `@control`'s attributes; quote values with spaces in single quotes), and every `{{name}}` is filled with its value. Declarations can sit in an XML comment, which is dropped when the picture is filled in, and text is escaped, so any words are safe:

```ts
const title = { motion: { svg: `<svg viewBox="0 0 200 60"><!-- {{title: text default='Hello' label='Title'}} {{ink: color default=#6366F1}} --><text x="10" y="40" fill="{{ink}}">{{title}}</text></svg>` } };
vectorControls(title.motion); // [{ name: "title", type: "text", default: "Hello", … }, { name: "ink", type: "vec3", color: true, … }]
renderVectorEffect(title, { title: "Fish & chips" }); // …<text …>Fish &amp; chips</text>…
renderVectorEffect(getEffect("drip-text")!, { word: "UNSTOPPABLE" }); // drips follow the word
```

### 2. Write your own shader

```glsl
// Controls are uniforms annotated on the same line.
uniform vec3 uTint;    // @control color default=#77C16A label="Tint"
uniform float uSpeed;  // @control min=0 max=4 default=1 label="Speed"
uniform sampler2D uPhoto; // @control filter=linear wrap=clamp label="Photo"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec3 photo = texture(uPhoto, uv + 0.01 * sin(uv.yx * 20.0 + iTime * uSpeed)).rgb;
  fragColor = vec4(photo * uTint, 1.0);
}
```

```ts
import { ShaderRenderer, ShaderFrames, recordGif, standaloneHtml, parseControls } from "@pixerate/flair";

const status = renderer.setSource(source); // { ok, errors: [{ line, message }] }
parseControls(source); // [{ name: "uTint", type: "vec3", color: true, default: [...] }, ...]
const gif = await recordGif({ source, width: 480, height: 270, fps: 30, duration: 3 });
const page = standaloneHtml("My effect", source, { uSpeed: 2 });
```

### 3. Build an editor (any UI)

```ts
import { createEffectEditor, bindShaderRenderer, bindSvgView } from "@pixerate/flair/editor";
import { ShaderRenderer } from "@pixerate/flair";

const editor = createEffectEditor({ from: "nebula" });
const renderer = new ShaderRenderer(previewElement);
bindShaderRenderer(editor, renderer); // source, values at the playhead, time; compile errors flow back

editor.subscribe((state) => render(state)); // state: document, controls, values, issues, compile, time, history
editor.setValue("uDensity", 1.4); // checked and undoable; slider drags merge into one step
editor.setKeyframe("uSpeed", 2000, 0.2, "ease-in-out");
editor.applyPreset("Ember");
editor.play();
editor.undo();

// Menus, shortcuts and command palettes run the same commands by id:
editor.commands.execute("values.randomize");
window.addEventListener("keydown", (e) => editor.commands.handleKeyDown(e)); // Space plays/pauses
```

`getState()` returns the same object until something changes, so React's `useSyncExternalStore` works as is. Documents are plain JSON (`EffectDocument`). Keyframe tracks use `@pixerate/editor/animation`'s track shape and easing engine.

For a ready-made controls panel, bind the effect to `@pixerate/editor`'s parameters editor. Every field, image pick and keyframe diamond goes through the effect editor and its undo history:

```tsx
import { bindEffectParameters } from "@pixerate/flair/editor";
import { ParametersPanel } from "@pixerate/editor-react/parameters"; // or @pixerate/editor-svelte/parameters

const { controller, dispose } = bindEffectParameters(editor);
<ParametersPanel controller={controller} showToolbar={false} showPresets={false} showKeyframes />;
```

`parameterSchemaFor(controls)` gives you the schema alone, for a UI of your own.

### 4. Let an agent drive it

```ts
import { createEffectToolProvider, createEffectToolRegistry, toolDefinitions, callTool, EFFECT_AGENT_INSTRUCTIONS } from "@pixerate/flair/editor";

const tools = createEffectToolProvider(editor, {
  capture: () => renderer.capture({ type: "image/png" }), // adds a `view_effect` tool so the model can look
});

// Give your model EFFECT_AGENT_INSTRUCTIONS and toolDefinitions(tools), then for each tool call:
const result = await callTool(tools, call.name, call.input); // MCP tools/call result

// Or serve them through @pixerate/editor/tools' ToolRegistry (MCP tools/list and tools/call):
const registry = createEffectToolRegistry(editor); // registry.listTools(), registry.callTool(name, args)
```

The tools are `list_commands`, `run_command` and `run_commands`, plus `view_effect` when you can capture the preview. The commands they run:

- **Inspect and start:** `effect.describe`, `catalog.search`, `effect.load`.
- **Edit the effect:** `effect.setSource`.
- **Values and presets:** `values.set`, `values.reset`, `values.randomize`, `preset.apply` and `preset.save`.
- **Keyframes:** `keyframe.set`, `keyframe.setTrack`, `keyframe.remove`, `keyframe.setEasing` and `keyframe.clear`.
- **Timeline:** `timeline.setTiming`, `timeline.play`, `timeline.pause` and `timeline.seek`.
- **History:** `history.undo` and `history.redo`.

Every change is one undo step, and refusals come back as messages the model can act on.

---

## 🎬 Camera moves

A shot's `camera` frames a box (`{ x, y, width, height }`) or elements (`{ frame: ["card"] }`), and can turn in 3D and blur while it moves, like the product-video swoop onto a tilted screen:

```json
{ "camera": { "frame": ["dashboard"], "tilt": 35, "turn": -15, "motionBlur": 1.5 } }
```

- `tilt` leans the board back (top away, like a desk seen from above), `turn` swings it round its vertical axis (left side nearer when positive), `roll` rolls it clockwise. Tilt and turn go up to ±75°.
- `perspective` is the lens distance as a multiple of the stage width (1.2 by default). Lower values look more dramatic.
- `motionBlur` (0 to 3, with 1 as natural) blurs the move in proportion to its speed, so the blur peaks mid-move and clears when the camera settles. A pan streaks along its direction (`View.blurAngle`), while a zoom or turn blurs in every direction.
- Angles carry over to later shots until a shot changes them. `{ "camera": { "tilt": 0, "turn": 0 } }` flattens the board in place.

`playScene` hands boards views with these fields (`View.tilt`, `View.blur`, `View.blurAngle`, …). For renderers:
- `cameraTransform(view, stage, width)` gives the CSS `transform` for a board layer.
- `cameraBlur(...)` gives the `stdDeviation` for an SVG `feGaussianBlur` that streaks, and `cameraFilter(...)` gives a CSS `blur()`.
- `projectPoint` gives where a scene point lands on screen.
- `cameraTrack` and `cameraSamples` lay the camera out on a timeline.

The standalone player (`flair scene html`) plays all of it. Layout checks (framing, edges, text size, the title) are judged on screen, where the angle puts each element.

The exporters carry the camera too:
- **Lottie:** a "Camera" null layer that the element layers hang off. When the camera is angled, it is a 3D layer with an AE camera (lottie-web draws it with its `html` renderer).
- **Apple Motion:** a keyframed "Camera" group around the shots.
- **FCP7 XML:** a keyframed Distort corner pin on each shot's clip, plus Motion Blur.
- **EDL:** a `* CAMERA:` note, since CMX 3600 has no transforms.

## 🎨 The catalog

| Category | Effects |
| :--- | :--- |
| gradient | mesh gradient, aurora, gradient flow, conic sweep, silk |
| organic | liquid marble, smoke, lava lamp, plasma, caustics, flames, blob morph |
| pattern | dot wave, Truchet flow, hex pulse, living cells, moiré rings, kaleidoscope, stripes, neon circuit |
| light / space | bokeh, god rays, sparkles, neon ripple, light ribbons, warp starfield, nebula, event horizon |
| retro | synthwave, digital rain, dithered gradient, TV static |
| image | ripple, glitch, duotone, halftone, pixel reveal, CRT screen, film look |
| transition | wipe, iris, block dissolve, grid wipe, glass wipe, twister, light leak, cross zoom |
| loader / icon / data | spinner, bouncing dots, pulse ping, equalizer, progress ring, bar chart, line chart, stat counter, route, success check, error cross, heartbeat, signature, confetti, drip text, flow network |

Every shader is self-contained and compiles on WebGL2. Open [`#check`](https://pixerate.github.io/flair/#check) on the demo to compile the catalog on your own GPU.

---

## 💻 CLI

```bash
npx flair controls ./effect.frag            # list @control uniforms (--json for JSON)
npx flair html ./effect.frag --out page.html --open
npx flair scene validate ./scene.json        # layout, framing and timing checks
npx flair scene review ./scene.json          # fast headless simulation + review
npx flair scene lottie ./scene.json out.json # also: fcp7, edl, motn
```

---

## 🧪 Interactive Browser Demo

The [live demo](https://pixerate.github.io/flair/) has three parts:

- **Gallery:** the whole catalog, live.
- **Editor:** controls, presets, keyframes, source and export, built with React on the headless editor.
- **Agent tools:** the tool surface, plus a sample agent plan you can run.

To run it locally:

```bash
pnpm install
pnpm dev   # http://localhost:3100
```

---

## 🛠️ Development

```bash
pnpm typecheck && pnpm build && pnpm test
pnpm changeset   # describe consumer-facing changes; merging to main publishes them
```

See [AGENTS.md](./AGENTS.md) for the conventions contributors and coding agents follow.

---

## 📄 License

MIT © Pixerate
