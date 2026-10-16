# @pixerate/flair

## 0.21.1

### Patch Changes

- c07ff8a: Faster catalog shaders, looking the same: sand erosion about 10× faster per frame, boids, glass shatter and spark fountain 4–5×, volumetric clouds and image shatter 3–4×, confetti cannon, soap bubbles and flow particles about 3×, fur, sparkle trail and brush trail about 2×, and drip melt, ribbon trail, light painting, particle text, backlight glow, aura, oil paint and the particle-swap transition 1.2–1.8×. They skip work that cannot show (bounded searches, early outs, hashes and samples reused), so frames are the same to within a level or two, except flow particles' streaks (a cheaper, equivalent flow field) and small shading differences in volumetric clouds and aura.

## 0.21.0

### Minor Changes

- 7fdfa7c: Catalog: 32 new effects in four new categories.

  - **atmosphere** (new): ray-marched volumetric clouds, fog banks, rising steam, mist over a picture or video, a sky timelapse, an incense smoke curl and dry ice fog.
  - **glow** (new): aura round any silhouette, bloom for any picture or video, a pulsing halo, a neon outline for any shape or word, backlight glow, rim light, and vector glow ring pulse and glow button (hover).
  - **shadow** (new): long shadow, a drop shadow that lifts on hover, light-sweep shadows (follow the pointer), contact shadow, window shadows (blinds or leaves, over a picture), shadow puppets, and a vector lift card (hover).
  - **distortion** (new): twirl and pinch & bulge (follow the pointer), fisheye, mirror tiles, wave warp, ribbed glass, shower glass, datamosh, polar warp (tiny planet) and texture displace, all for pictures or video.
  - `svgMotionIssues` now flags SMIL animation elements (`<animate>`, `<set>`, …) in a picture: changes belong in `animate`, so every frame is a function of time.

## 0.20.0

### Minor Changes

- af954ba: Pointer trails, and 38 new effects.

  - Shaders get a new built-in, `iTrail[32]`: where the pointer has just been over the canvas, newest first, about 30 points a second (xy pixels, z its `iTime`, w = 1). `ShaderRenderer` and standalone pages feed it; `ShaderFrames.render` takes a scripted `trail`; `PointerTracker.move` takes an optional time to record it. `trailUniform`, `MAX_TRAIL` and `TRAIL_SECONDS` are exported.
  - **trail** (new): comet, ribbon, sparkle, brush and ghost trails and light painting that follow the pointer (each with an idle demo), and vector motion streak and dotted trail.
  - **particles** (new): flow particles, magnetic swarm (follows the pointer, flung by clicks), dust in light, boids, particle text, confetti cannon (and at clicks) and fireflies.
  - **debris** (new): rubble fall, glass shatter (from the click, video-ready), crumbling text, paper shreds, leaves blowing and sand erosion.
  - **impact** (new): shockwave, impact frame and screen shake over a picture or video (at clicks), ground slam, meteor strike, and a vector hit marker (click).
  - **comic** (new): comic book and cel shade looks for any picture or video, focus lines, action lines, a comic panels transition, and vector sound effect, speech bubble, fight cloud, dizzy stars, anime emotes, cartoon poof (click) and line boil.

## 0.19.0

### Minor Changes

- adb0dfc: Catalog: 30 new effects, and SVG ids that never clash between pictures.

  - **splatter** (new): paint splatter and goo splat (also landing at clicks), ink splash, splash crown, paint roller (a transition, video-ready), water splash, and a vector splat stamp.
  - **bubble** (new): soap bubbles (thin-film colour, popping at clicks), underwater bubbles over a picture or video, fizz, foam, bubble wrap (click to pop), lava bubbles, and vector chat bubble and bubble-pop loader.
  - **organic**: reaction diffusion, cell division, coral growth, veins, ferrofluid (follows the pointer), jellyfish and fur.
  - **sticker** (new): holographic foil sticker (any shape, tilting with the pointer) and a sticker-peel transition, and vector sticker slap (click), sticker peel (hover), holo sticker, sticker sheet, stamp badge (click) and washi tape.
  - Live SVG views (`svgView`, `SvgPlayer`, and the React and Svelte components) now give the ids a picture refers to — gradients, filters, clips, masks, `<use>`d shapes — a suffix unique on the page, and point `url(#…)` and `href="#…"` at them, so two pictures defining the same id no longer borrow each other's. Other ids stay as written; `onPick` still reports ids as written.

## 0.18.0

### Minor Changes

- 7fcc7c7: Effects on HTML5 video: `ShaderRenderer.setLiveSource(name, video)` and `ShaderFrames.setLiveSource` show a playing `<video>` (or a canvas) in an image control. The current frame is uploaded each time it changes, and a paused preview still follows the video. `seekVideo` steps a video for frame-exact export, and `ready()` waits for each video's first frame. Shader effects with image controls now carry `video: "filter" | "transition" | "interactive" | "stills" | "none"`, which says how they suit video. `findEffects({ video })` and the `catalog.search` command filter by it.

## 0.17.0

### Minor Changes

- 6bd52a7: Text effects suit headlines of any length and any theme:

  - **Colours**: colour controls take CSS colours, through `effectDefaults` and the React and Svelte wrappers too. Before, `effectDefaults` silently replaced colour strings with defaults. Hex can be `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`, and `rgb()`/`rgba()` and `hsl()`/`hsla()` work too (see the new `parseColor`). Vector effects also take `currentColor` to follow the surrounding text colour, and colours mixed from it use CSS `color-mix`.
  - **Long text**: inline text effects keep their full size and the picture gets wider, so long phrases are no longer shrunk. Drip text no longer squashes long words at any size: it scales the whole word down on its own stage and widens inline. Its drips now repeat along the word instead of crowding the middle.
  - **Overhang**: text effects write `data-overhang="top right bottom left"` (ems) on their `<svg>`, saying how far they reach past their inline box. The new `svgInlineLayout(svg)` in `/vector` reads it with the aspect ratio. In React and Svelte, `contain` turns it into a margin.
  - **Plays when seen**: in React and Svelte, an effect that plays once (`loop: false`, no trigger) now waits until it is scrolled into view by default. `playOnEnter: false` starts it at mount. `SvgPlayer`'s `playOnEnter` now plays at once where there is no `IntersectionObserver`.

- 6bd52a7: Every text effect now takes `font`, `weight` and `inline` controls, like drip text: typewriter, scramble text, kinetic stagger, neon sign, stroke draw text, split reveal, highlighter, word cycle, liquid fill, glitch text and extruded text.

  - `font` takes any CSS font-family, and `inherit` uses the surrounding text's. `weight` runs from 100 to 900. The defaults keep each effect's current look.
  - `inline: true` frames just the text, from cap height to baseline, hides the backdrop and sets `overflow="visible"`, so the effect sits in a heading without adding leading. Give its container `display: inline-block; height: 0.72em` and the viewBox's aspect ratio.

## 0.16.0

### Minor Changes

- 55fbb80: New `@pixerate/flair/svelte` entry point, with `svelte` (>= 5) as an optional peer dependency (its types only; nothing to compile):

  - `use:vectorEffect={{ id: "drip-text", values: { word: "Slop" }, loop: false }}` plays a catalog vector effect (or `{ motion }`, any `SvgMotion`) in an element: it makes an `SvgPlayer` on mount, remakes it when the params change (values by content, `speed` without remaking) and disposes it on destroy. Works as an attachment through `fromAction`.
  - `vectorEffectStill(params)` returns `{ markup, style }` for server rendering: `<span use:vectorEffect={params} style={still.style}>{@html still.markup}</span>` shows the last frame, sized from the viewBox, until the player takes over. The still stays under `prefers-reduced-motion` (`reducedMotion` overrides).
  - Sized like the React components: a block with the viewBox's aspect ratio, or with `inline` (or an effect's `inline` control) an `inline-block` 0.72em high.

## 0.15.0

### Minor Changes

- 61b2ed6: New `@pixerate/flair/react` entry point, with `react` (>= 18) as an optional peer dependency:

  - `<VectorEffect id="drip-text" values={{ word: "Slop" }} loop={false} />` plays a catalog vector effect; `<SvgPlayerView motion={...} />` plays any `SvgMotion`. Each makes an `SvgPlayer` after mount and disposes it on unmount.
  - Server-renders a still of the last frame, sized from the viewBox, so hydration neither shifts the layout nor flashes blank. The still stays under `prefers-reduced-motion` (`reducedMotion` overrides).
  - `inline` (or an effect's `inline` control, like drip text's) sizes it as a word in a line: `inline-block`, 0.72em high, with the viewBox's aspect ratio.

  `@pixerate/flair/vector` adds `svgFrameMarkup(motion, { at })`, a frame as safe `<svg>` markup with no DOM (for server rendering and reduced motion), and `svgViewBox` / `parseViewBox`.

## 0.14.0

### Minor Changes

- 3ee7554: Drip text sits inside headings and takes your font:

  - `inline: true` frames just the word, from cap height to baseline, with `overflow="visible"`, so the outline and drips spill over the text around it without adding leading. Give its container `display: inline-block; height: 0.72em` and the viewBox's aspect ratio.
  - `font` (default `Arial Black, Impact, system-ui, sans-serif`; `inherit` takes the surrounding text's) and `weight` (100–900, default 900) controls replace the hard-coded font.
  - Documented that `SvgPlayer` with `loop: false` plays once and stays on its last frame.

## 0.13.1

### Patch Changes

- 2196487: `ThumbnailPool` compiles at most one new thumbnail shader per frame, so a row of thumbnails scrolling into view no longer stalls a single frame.

## 0.13.0

### Minor Changes

- 78275f0: Add vector solo variants, agent scene outline view, 2D fit/stack layout, and typed value converters inspired by Rive architectural patterns.

## 0.12.0

### Minor Changes

- 1aaa5b3: Image effects work with transparent pictures such as Lucide icons.

  - Every catalog effect that shows a picture (image treatments, transitions, morphs, time-warp, melt, pixel and hover effects) has two new controls, `uBackdrop` (white by default) and `uBackdropAlpha` (1 by default). The picture is laid over the backdrop, so a black `currentColor` icon on a clear background no longer renders as black on black. Set `uBackdropAlpha` to 0 to keep the picture's alpha, so the effect can be laid over other content with `{ alpha: true }`. Opaque pictures look the same as before.
  - Edge glow also finds edges in the picture's alpha, so it outlines an icon whatever its colour. Tilt-shift, slit-scan, speed ramp and time echo blur in premultiplied alpha, so clear areas no longer darken the blur. Game Boy screen stays opaque: it draws the whole device.
  - `SAMPLE_IMAGES.icon`: a Lucide-style sample icon.
  - `ShaderFrames` takes `alpha: true` to keep the shader's alpha in its frames.

## 0.11.0

### Minor Changes

- ef5f69f: Catalog: 54 new effects in four new categories and the retro category.

  - **pyrotechnics** (new): fireworks (also bursting at clicks), sparkler, explosion, spark fountain, roman candle, fuse burn and smoke bomb overlays, a light-show finale, and a vector firework burst.
  - **timewarp** (new): time echo, chrono split, time slice, VHS rewind, bullet time, time tunnel, speed ramp and stutter freeze over an image, and a vector time-lapse clock.
  - **melt** (new): drip melt, heat haze, wax melt, melting text, liquify, melting clock and lava flow, and vector ice cube melt and candle.
  - **electric** (new): lightning (also striking at clicks), Tesla arc, plasma ball, electric border, electric text, Jacob's ladder, short circuit, power surge and electric field, and vector zap icon, power button (click toggle) and battery charge.
  - **retro**: 8-bit palettes with dithering (Game Boy, PICO-8, NES, CGA, C64, 1-bit), Game Boy screen, pixel fire, pixel landscape, OutRun road, palette cycle, raster bars, tape loading and pixel water, a pixel dissolve transition, and vector pixel text, coin spin, space invader, heart health bar and chomp loader.

## 0.10.0

### Minor Changes

- 7542ad5: Interaction: pointer uniforms, `SvgPlayer` triggers and 21 interaction effects.

  - Shaders get two new built-ins: `iPointer` (xy while over the canvas, eased hover amount, seconds held or minus seconds since release) and `iClicks[8]` (the latest clicks: xy, `iTime` of the click, 1). `ShaderRenderer`, standalone pages and hovered `ThumbnailPool` thumbnails feed them; `ShaderFrames.render` takes `pointer` and `clicks` for scripted recordings. `PointerTracker`, `clicksUniform`, `MAX_CLICKS` and `HOVER_SECONDS` are exported.
  - `SvgPlayer` takes `trigger: "hover" | "press" | "click"` (and `triggerTarget`): hover and press play forward while active and back after; click plays the next step on each click, wrapping round. `setActive(on)` and `advance()` let hosts drive it. Vector effects declare `trigger`.
  - **interaction** (new category): click ripple, click burst, cursor glow, hover liquid, X-ray reveal, magnifier, holo card, press charge and hover swap shaders (each with an idle demo), and like button, toggle switch, checkbox, menu toggle, bookmark, copy, send and download buttons, link hover, button hover fill, tooltip pop and press button vector effects.

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
