# @pixerate/flair

## 0.9.0

### Minor Changes

- bf62436: Morphs: `morphPaths` / `morphSequence` and 13 new effects.

  - `morphPaths(from, to)` and `morphSequence(paths)` in `/vector` turn any SVG paths (curves, arcs, relative commands, several pieces) into paths with one structure, so an `attrs` change on `d` blends them. Pieces pair by position and size; one without a partner grows from or shrinks to a point.
  - **morph** (new category): feature morph (two photos, five matching points), silhouette morph (any silhouettes, logos or `textImage` words), and vector shape morph, icon toggle (play/pause, menu/close, plus/check, sun/moon, heart), morph sequence, gooey morph, particle morph and digit morph.
  - **transition**: liquid morph, displacement, luma fade, particle swap and ink bleed.
  - `SAMPLE_IMAGES` gains `portrait2`, `logo` and `heart`.

## 0.8.0

### Minor Changes

- a03bc70: Catalog: 35 new effects and two new categories.

  - **overlay** (new category): rain on glass, snowfall, lens flare, vignette & grain, scanline sweep, spotlight, embers, shine sweep and frost creep shaders, plus a viewfinder vector effect. Overlay shaders have `transparent: true` (a new `ShaderEffect` field): render them with `{ alpha: true }` to lay them over other content.
  - **image**: Ken Burns, ASCII art, shatter, melt, risograph, thermal / night vision, edge glow, tilt-shift, slit-scan, mosaic flip, chromatic lens and oil paint.
  - **text** (new category): typewriter, scramble text, kinetic stagger, neon sign, stroke draw text, split reveal, highlighter, word cycle, liquid fill, glitch text and extruded text vector effects, and a `shader-text` shader that fills letters with plasma, fire, caustics or chrome. Drip text moves here from `icon`.
  - `textImage(text, options)` in `/catalog`: any Unicode text as a transparent SVG `data:` URL, for image controls such as `shader-text`'s.
  - Vector motion: `SvgAnimation.write` writes text letter by letter, with `scramble` (unwritten letters cycle through random characters) and `caret`; `writtenText` and `SCRAMBLE_MS` are exported from `/vector`.

## 0.7.0

### Minor Changes

- 1bdd1f0: Add transparent WebGL shader overlays, `SvgPlayer.reset()` / `hideWhenPaused`, standalone `animateCount()` / `formatCount()`, and hover-only / alpha support in `ThumbnailPool`:

  - Preserve clamped `flair_color.a` in `wrapSource` and add `alpha?: boolean` to `createContext`, `ShaderRendererOptions`, and `ThumbnailPoolOptions`.
  - Add `uBackgroundAlpha` and `uChance` (sparsity) controls to the `sparkles` catalog shader and `uBackgroundAlpha` to `bokeh`.
  - Add `SvgPlayer.reset()` and `hideWhenPaused?: boolean` to `SvgPlayerOptions` for hover-triggered vector animations.
  - Add `animateCount()` and `formatCount()` to `@pixerate/flair/vector` for animating DOM numbers on a `Clock` with `EASES`.
  - Add `hoverOnly?: boolean` and `animateMode?: "always" | "hover" | "reduced-motion"` to `ThumbnailPoolOptions`.

## 0.6.0

### Minor Changes

- bd247bf: Add `playOnEnter` option to `SvgPlayer` and `ShaderRenderer`, plus new `timeline-track` vector effect

## 0.5.0

### Minor Changes

- a08286a: Add `pauseWhenHidden` option to `ShaderRenderer` and `SvgPlayer` to pause animation loops when scrolled off screen via `IntersectionObserver`.

## 0.4.0

### Minor Changes

- 7b06c4e: Allow `ShaderRenderer` to attach directly to an existing `HTMLCanvasElement`.

## 0.3.0

### Minor Changes

- 10f02b2: The 3D camera now reaches layout checks, motion blur direction and the exporters. `checkShot` judges framing, edges, text size and the title on screen, through the camera's angle (`screenBox`). A pan's motion blur streaks along its direction (`View.blurAngle`, `cameraBlur` for an SVG blur, `moveBlur`), and the standalone player draws it that way. `cameraTrack` and `cameraSamples` lay the camera out on a timeline, and the exporters use them: Lottie gets a camera rig (in 3D with an AE camera when angled), Apple Motion a keyframed camera group, FCP7 XML a keyframed Distort corner pin with Motion Blur, and EDL a `* CAMERA:` note.
- 10f02b2: Scene cameras can turn in 3D and blur while they move. A shot's `camera` takes `tilt`, `turn` and `roll` (degrees), `perspective` and `motionBlur` alongside its framing, or on their own to change the angle in place, and angles carry over until a shot changes them. `playScene` passes views with the angle and a speed-based `blur`. New helpers: `cameraTransform` and `cameraFilter` (CSS for a board layer), `projectPoint`, `motionBlur`, `shotView`. `validateScene` checks the new fields, and the standalone scene player now plays camera moves (framing, angle and blur) and moves through shots when playing.
- 10f02b2: Add two catalog effects: `flow-network`, an animated SVG node graph whose links draw on before a glowing critical path races through it to a pulsing hub (its label is a text control), and `light-ribbons`, a shader of thin iridescent light strands weaving across a dark frame.
- 10f02b2: Add two catalog effects: `neon-circuit`, a shader of glowing neon traces routed up a circuit board with pulses running along them, and `drip-text`, an animated SVG title that pops in and oozes drips from its letters.
- 10f02b2: Vector effects declare their controls in their picture: the first `{{name: type …}}` placeholder (`float`, `int`, `bool`, `color` or `text`, with `@control`'s attributes) declares a control, and `vectorControls` reads them, the way `parseControls` reads a shader's. Adds a `text` control type (shown as a text field in the parameters panel), so a picture's words can be changed; text is escaped when filled in. `drip-text` now takes any word, with its drips following it. Every catalog vector effect declares its controls inline, and a vector effect's `controls` list is now optional (still read, for effects written before). `renderVectorEffect` drops comments from the markup and falls back to defaults for values a control cannot take.

## 0.2.0

### Minor Changes

- 6fb310a: Build the effect editor on `@pixerate/editor` 0.29's new subpaths (now the minimum version of the optional peer):

  - Keyframes use `@pixerate/editor/animation`'s easing engine and track types. Flair's own copy is gone; its exports remain as aliases.
  - Agent tools are typed by `@pixerate/editor/tools`. A new `createEffectToolRegistry(editor)` serves them through its `ToolRegistry`, with argument checking.
  - New `parameterSchemaFor(controls)` and `bindEffectParameters(editor)` drive `@pixerate/editor/parameters`, including the React and Svelte `ParametersPanel`s, with every change and keyframe toggle going through the effect editor.
  - New `EffectEditor.setTrack` and its `keyframe.setTrack` command replace a control's keyframes in one step.

## 0.1.1

### Patch Changes

- 921f9f4: Ship `CHANGELOG.md` in the package and normalise the `bin` and `repository` fields, so npm no longer rewrites them on publish.

## 0.1.0

### Minor Changes

- f4849b5: First public release: WebGL2 shader effects with image controls, animated vector effects, a catalog of 59 ready-made effects, and a UI-agnostic, agent-ready effect editor built on `@pixerate/editor`.
