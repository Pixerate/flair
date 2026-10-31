# @pixerate/flair

## 0.68.0

### Minor Changes

- 6ffb1b4: Add a `horror` category (browsed under Pictures) with six effects, the first batch from the spooky-effects proposal: `vhs-tracking` (a cursed tape: warp, a rolling tracking band, head-switching tear, colour bleed and a camcorder's REC and clock), `night-vision-cam` (green phosphor night vision where pairs of eyes shine out of the dark), `signal-lost` (a feed that stutters, freezes and corrupts into a hidden picture, then cuts to static), `ghost-apparition` (a translucent figure fading in over a picture, with an optional double exposure), `eyes-in-the-dark` (glowing eyes that blink, watch the pointer and shut when it comes near) and the SVG `possessed-text` (letters writhing and floating out of line, then snapping back). Tags `analog-horror`, `spectral` and `creature` group them by kind; find them all with `findEffects({ category: "horror" })` or `catalog.search` with `category: "horror"`.

## 0.67.0

### Minor Changes

- 9f05fe3: Add censor and redaction effects: `censor-pixelate`, `censor-blur` and `censor-scramble` hide a box or ellipse region of a picture or live video (or everything but it) behind mosaic blocks, a smooth mipmapped blur, or shuffled noisy blocks; `redaction-bars` draws rough marker bars over lines of a picture on a loop; and the `redact-box` annotation draws redaction bars over part of a screenshot or video and stamps REDACTED on top.

## 0.66.0

### Minor Changes

- 383184c: Every shader that paints its own `uBackground` colour now has a "Background opacity" control (`uBackgroundAlpha`, default 1, so nothing changes until it is lowered). Below 1 the background colour is keyed out (colour to alpha), so generators such as Neon ripple or Warp starfield can sit over other content; `drawsAlpha` follows it. `withBackgroundOpacity` / `takesBackgroundOpacity` do the same for any source. The editor provider (`flairEffects`) names the control as `backgroundOpacity`, and gives a shader that moves without repeating a `duration` (`ENDLESS_PLAY_MS`, 4 s) so editors can scrub and animate it.

## 0.65.0

### Minor Changes

- eb9153e: Twelve card effects join the catalog:

  - `card-flip`: a card turning over in perspective on hover, front picture to back.
  - `scratch-card`: a coin scratching a ticket's foil away to reveal a picture.
  - `swipe-stack`: a dating-app stack flinging cards off under LIKE and NOPE stamps.
  - `pack-opening`: a foil booster pack tearing open and fanning out its cards, the rare one glowing.
  - `card-fan`: a hand of playing cards fanning open on hover.
  - `riffle-shuffle`: a deck cut and riffled back together, as a loader.
  - `cover-flow`: a ring of picture cards turning in perspective over a glossy floor.
  - `polaroid-develop`: an instant photo shaken and developing from blue-green to colour.
  - `tarot-reveal`: a gilt-backed tarot card turning over in a golden glow to reveal a picture.
  - `metal-card`: a brushed-metal payment card tilting toward the pointer.
  - `card-spotlight`: a bento grid of cards whose borders light up near the pointer.
  - `rolodex`: cards on a spindle flipping through figures and their labels.

## 0.64.0

### Minor Changes

- bb91f86: Add seven promo effects, the accents of a punchy product-update video: `orbit-swoosh` (comet ribbons orbiting a title, slipping behind it on the far side and shedding confetti), `tick-ring-burst` (a sunburst arc of ticks popping out behind a title), `swoosh-underline` (a glowing curved stroke sweeping on under a subtitle), `knockout-wipe` (a slanted cut knocking a picture's background out to a transparency checkerboard), `before-after` (two pictures either side of a divider that follows the pointer), and the SVG `slime-drop` (a drippy title falling in and splashing) and `app-window` (a neo-brutalist window filling its progress ring). Find them together with `findEffects({ tags: ["promo"] })`. Adds `SAMPLE_IMAGES.cutout`, the sample portrait with its background removed.

## 0.63.0

### Minor Changes

- 66cd708: Make effect tags something consumers and agents can browse, not only filter by.

  - `effectTags(query?)`, in both `@pixerate/flair/catalog` and `@pixerate/flair/catalog/lazy`, lists the tags of the effects a query finds with how many carry each, the most used first. `normaliseTag` and `TAG_FORMAT` are exported too.
  - `findEffects({ tags })` and `findEffectMeta({ tags })` match tags in any case, with spaces as hyphens (`"Game Boy"` finds `game-boy`).
  - Agents: `catalog.search` takes `tags` and returns each effect's tags, and the new `catalog.tags` command lists tags under the same filters. An unknown tag is refused with the nearest ones.
  - CLI: `flair effects --tag <tags>` and a new `flair tags` command.
  - Catalog tags are now consistently kebab-case, each word in one form: spaced tags are hyphenated (`motion blur` → `motion-blur`, `game boy` → `game-boy`), and singular/plural pairs are merged (`spark` → `sparks`, `star` → `stars`, `waves` → `wave`), and `timelapse` is `time-lapse`. Code filtering on the old spellings should switch to the new ones.

## 0.62.0

### Minor Changes

- 28f98bc: Add five webbing effects: `spider-web` (an orb web swaying in the breeze, beaded with dew), `cobweb-corners` (tattered cobwebs in the corners, transparent over the page), `web-shot` (a strand of silk shot to every click, bursting into a web splat), `plexus-web` (drifting points strung to their neighbours) and the `spider-web-loader` SVG loader. Find them together with `findEffects({ tags: ["web"] })`.

## 0.61.0

### Minor Changes

- 822f666: `flairEffects()` implements effect authoring (`openAuthoring`, `supportsAuthoring`) from `@pixerate/editor` 0.148, wrapping Flair's `EffectEditor`: shaders open in the editor's Effect Authoring tab with their GLSL, compile errors on the right lines and controls that follow the source; vector effects open with their controls, keyframes and presets. `/integrations` now needs `@pixerate/editor` >= 0.148. `EffectEditor.setValue` and `setValues` take `{ gesture }` so a slider drag is one undo step, and `createEffectToolRegistry` keeps bare tool names (`run_command`) with editors that namespace them by default.

## 0.60.1

### Patch Changes

- `neon-fluid`, `neon-worms`, `neon-warp` and `prism-burst` draw their light over the ground rather than adding to it, so they look the same on dark but no longer wash out on a light ground. Each, with `molten-web`, gains a "Light" preset for light pages.

## 0.60.0

### Minor Changes

- d8fa6c1: Add video finishing and kinetic caption effects, and shutter-angle motion blur for recordings and exports:

  - `image-chroma-key`: green and blue screen keying with spill suppression and kept shadows.
  - `image-lut-grade`: 3D LUT grading (tiles or Hald), or built-in teal & orange, punchy and film noir looks, with skin tones protected.
  - `corner-pin`: four-corner perspective pin.
  - `bloom` gains `uStreakAngle` and `uStreakLength` for angled anamorphic streaks.
  - `caption-word-bounce`, `caption-karaoke` and `caption-pop`: word-by-word caption effects.
  - `shutterAngle` and `shutterSamples` on `recordEffect`, `exportEffect` and `exportMotionGraphic`, and `--shutter-angle` / `--shutter-samples` in the CLI. Sub-frames are averaged with premultiplied alpha.

## 0.59.0

### Minor Changes

- 406106d: Add seven iridescent and neon shader effects: `iridescent-text` (a rainbow-chrome title with glints, transparent over the page), `neon-fluid`, `neon-worms`, `molten-web`, `prism-burst`, `neon-warp` and `iridescent-blobs`. Find them together with `findEffects({ tags: ["iridescent"] })` or `["neon"]`.

## 0.58.4

### Patch Changes

- f365baf: Add animated live previews to effect tiles and accurately rank recent effects based on catalog introduction commits in developer documentation.

## 0.58.3

### Patch Changes

- 0d4c95d: Explicitly bind server to HOST 0.0.0.0 and PORT 8080 for App Hosting container startup probes

## 0.58.2

### Patch Changes

- e59a8f6: Configure root package.json build and start scripts for App Hosting deployment

## 0.58.1

### Patch Changes

- 3fd1db8: Add documentation and marketing site in `apps/docs` with Firebase App Hosting deployment configuration for flair.pixerate.com.

## 0.58.0

### Minor Changes

- 06f4a05: Render overlays over a picture in Node. `exportEffect` and `exportEffectBuffer` take a `backdrop` (a file path, URL or `data:` URL; `{ imageBuffer, ext }` in `exportEffectBuffer`) drawn under the effect in every frame, `backdropFit` (`cover` by default, `contain` or `fill`), and `region` (`[x, y, width, height]`, normalized 0 to 1) to confine the effect to part of the frame at that box's own size. Without a size, the frame takes the backdrop's own size (JPEG rotation included). A backdrop is refused, with a sentence saying what to do, with `alpha`, with `.svg` output, and for a shader that draws every pixel itself. `flair render` gains `--backdrop`, `--backdrop-fit` and `--region`, and `flair effects` gains `--transparent` to list the overlays a backdrop suits. New Node exports: `effectFrameSize`, `imageNaturalSize`, `backdropSize`, `checkRegion`, `BACKDROP_FITS`, and the types `BackdropFit`, `EffectRegion` and `EffectBufferBackdrop`.

## 0.57.0

### Minor Changes

- 7bda389: Add a `fire` category (in the Light group) with eight effects: `fire-border` (flames rising off a rounded frame, tallest along its top, with sparks), `flaming-text` (words smouldering like coals with flames rising off them), `burn-away` (a picture or video catching fire and burning away from a point, looping, with a still progress control), `fire-ring` (a hoop of fire that flares on hover), `fireball` (a roiling ball of fire that swoops about or follows the pointer, streaming a tail), `campfire` (a night scene with logs, coals, sparks and flickering firelight), and the animated SVGs `flame-icon` (a three-layer flickering flame with embers) and `match-strike` (a match struck, flaring, charring and blown out). The overlays draw on clear, with a background a preset away.
- 7ff8a77: Loaders get their own browsing group: `EFFECT_CATEGORY_GROUPS` gains "Loaders" (the `loader` category, out of "Interface"), and the loaders that lived in themed categories move into `loader`: `chomp-loader` (was `retro`), `bubble-pop-loader` (was `bubble`), `progress-ring` (was `data`) and `battery-charge` (was `electric`). `findEffects({ group: "loaders" })` finds them all; filters by their old categories no longer do.
- 393256f: Add eight loaders to the `loader` category. Four are shaders drawn on clear, with a background a preset away: `liquid-loader` (a glass circle filling with sloshing liquid and bubbles), `glow-ring-spinner` (a glowing head sweeping round a ring with a breathing gradient tail), `metaball-loader` (gooey blobs chasing round and merging) and `flame-loader` (a progress bar burning along its length). The two that fill up loop over 6 s and have a still progress control. Four are animated SVGs that loop seamlessly: `hourglass`, `infinity-loader`, `orbit-loader` and `shape-morph-loader`.

## 0.56.0

### Minor Changes

- e70b6c2: Add a `hologram` category (in the Light group) with five effects: `hologram` (a picture or video projected as a flickering hologram, its plain background keyed out, with scanlines, glowing edges, glitching tears, an emitter's beam and an optional line-by-line materialise), `hologram-text`, `hologram-projector` (a wireframe globe, cube or icosahedron in an emitter's light cone), and the animated SVGs `holo-hud` (rings, a radar sweep and a counting readout) and `holo-panel` (an info panel that unfolds, decodes its text in and folds away). The shader holograms draw on clear, with a background a preset away.

## 0.55.0

### Minor Changes

- 0da8828: Add four more night-sky effects to the catalog: `northern-lights` (aurora curtains over a pine skyline, mirrored in a lake), `satellite-pass` (a satellite gliding over, with "Starlink train", "Iridium flare" and "Long exposure" presets), `star-trails` (long-exposure arcs round the celestial pole) and the `wish-star` icon (a shooting star that swoops in on a drawn trail and lands with a burst of sparkles).
- 1817192: Add three space effects to the catalog: `shooting-star` (a transparent overlay of shooting stars that cool from white to blue, flare as they burn out and shed sparks; clicking launches one from the pointer), `meteor-shower` (meteors radiating from one point over a wooded horizon and the Milky Way, with the odd fireball) and `comet` (a coma with a curving dust tail and a streaming ion tail).

### Patch Changes

- 00410b2: `svgFrameMarkup` (and so `flair render` / `exportEffect` frames of vector effects) now follows changes `along` a path, turning with it under `orient`, measured from the path's `d` with no DOM. Before, the moving element stayed at the picture's top-left corner (the sparkline's dot, the send button's plane, the wish star).

## 0.54.0

### Minor Changes

- d0ae4d9: `sparkles`, `bokeh`, `circular-spectrum`, `bass-pulse`, `vinyl`, `gemstone`, `chrome-text` and `floor-reflection` are now overlays by default (`transparent: true`, `uBackgroundAlpha` 0, tagged `overlay`). Each has a "With background" preset ("On the platter" for `vinyl`) for the old full-frame look, which replaces their "Overlay" presets (`circular-spectrum`'s is now "Bare ring").

  Background and backdrop opacity controls now work outside an explicit `{ alpha: true }` canvas: `mountEffect`, `recordEffect`, `exportEffect` and `effectStack` use the new `drawsAlpha(effect, values?)` (in `@pixerate/flair/catalog`) to pick a transparent canvas, keep alpha, and layer an effect over the one below, so picture effects with `uBackdropAlpha` at 0 lay over the page, and an overlay with its background turned up records opaque.

## 0.53.1

### Patch Changes

- 508221a: Fix glass-wipe transition direction, preserve host element positioning in flairEffect, add native cover/contain aspect ratio fitting for image shaders, add playOnEnter / loop controls to mountEffect, and provide preloadImages and transitionTo helpers.

## 0.53.0

### Minor Changes

- c0faf02: `image-charcoal` can draw in colour: a new `uColour` control (0 keeps plain charcoal) takes the stick's colour from the picture, with new `Crayon` and `Soft pastel` presets.

## 0.52.0

### Minor Changes

- 59b1ae5: Add five artist's-media image effects to the catalog: `image-pencil-sketch` (graphite or coloured pencil, with a blueprint preset), `image-watercolor` (layered washes with pooled edges and granulation), `image-crosshatch` (pen and ink as hatching, stippling or engraving, with woodcut and banknote presets), `image-charcoal` (smudgy charcoal, sanguine or chalkboard) and `sketch-reveal` (a picture drawn in pencil, shaded, then washed with colour, on a 6 s loop). The drawn looks take an optional line boil.

## 0.51.0

### Minor Changes

- 1194c35: `flairEffects()` renders through `ShaderPipeline`, and now supports masks and float layers: `capabilities.supportsMask` is true (masks composite on the GPU over the untouched input, or multiply alpha), and `supportsFloat` is true where the GPU renders to floats (depth 16 and 32 renderers return `float` in linear light; float `EffectPixels` inputs go in as floats).

## 0.50.0

### Minor Changes

- d777272: `@pixerate/flair/integrations`: `flairEffects()` makes Flair the effects provider for `@pixerate/editor`'s editors, through the editor's `@pixerate/editor/effects` contract. It lists, searches and describes every shader, vector effect and motion primitive (controls as strict JSON Schemas, colours as `#rrggbb`), renders shaders with `ShaderFrames` on a page or in a Worker, takes `ImageBitmap`, `VideoFrame`, `OffscreenCanvas` or pixel inputs, drives transitions by `progress`, renders vector effects on a page (or with `rasterizeSvg`), and applies motion primitives to SVG with `applyVectorEffect`. It passes the editor's `checkEffectProvider`, and needs `@pixerate/editor` 0.124 or later (the first with `/effects`).

## 0.49.0

### Minor Changes

- ff6e1e0: Float layers: `ShaderPipeline` takes `format: "rgba16f" | "rgba32f"` for half- or full-float passes (HDR, 16- and 32-bit layers), `readFloatPixels()` for output in linear light with straight alpha (values may exceed 1), and float pictures (`{ width, height, data: Float32Array }`, linear) as inputs. Shaders see sRGB-encoded colour in every format, so effects look the same at any depth; conversions run on the GPU with extended sRGB curves. The README documents the colour-space and premultiplied-alpha contract.
- b962059: Render in a host's WebGL context: `ShaderPipeline`'s `gl` option renders in a context the host owns, takes the host's textures as inputs (`{ texture, width, height }`), and keeps the output on the GPU (`outputTexture`, or `render(t, { target })` into a host framebuffer), with no read back per frame. Every call leaves the host's GL state as it found it, and `dispose` frees only what the pipeline made. `TextureCache` takes an optional `around` wrapper for uploads that arrive later.
- 2595f67: Masks and regions: `ShaderPipeline`'s `setMask` (or `mask` option) limits where the effect applies, on the GPU, by a coverage picture (alpha or luminance, 8-bit or float), a rectangle with a feathered edge, or both, optionally inverted. Where coverage is 0 a picture or a pass's output shows through (`under`); without one, coverage multiplies the output's alpha.
- 3126878: Multi-pass rendering: `ShaderPipeline` renders several shaders as one picture on one WebGL2 context, each pass reading the one before (`"previous"`), another pass (`{ pass: n }`), its own last frame (`"feedback"`, for trails and echoes) or a picture, with `blend: "over"` for overlays. `effectStack` (catalog) turns catalog shaders into passes, each filter reading the layer below. A pass that does not compile throws a `PassCompileError` naming it.
- e13e413: Testing without a GPU, and deterministic renders. `@pixerate/flair/testing` publishes the fake WebGL2 context Flair tests itself with: `installFakeWebGl()` makes canvases and `OffscreenCanvas` hand out fakes (any test runner, `restore()` to undo), so `ShaderFrames`, pipelines and `flairEffects()` render in jsdom with the same pixels every time, and record the calls made. For real pixels that match across machines, `software: true` on `exportEffect` / `exportMotionGraphic` (`--software` on `flair render` and `flair export`, or `FLAIR_SOFTWARE_GL=1`) draws with SwiftShader on every platform.

## 0.48.0

### Minor Changes

- 35b5b7a: JSON Schemas. `effectControlSchema(id)` (catalog) gives a strict JSON Schema (draft 2020-12) of an effect's control values: each control with its type, range, unit and default, colours as sRGB 0–1 or CSS colours, images as URLs. `controlsSchema` and `controlSchema` do the same for any controls, and an optional `unit=` attribute on `@control` declares a control's unit. `EFFECT_DOCUMENT_SCHEMA` (editor) describes an effect document, and is published as `@pixerate/flair/schemas/effect-document.json`. Agents get the current effect's schema with the `values.schema` command. Fixes `createEffectDocument` giving 45 vector effects a `NaN` duration when their timing is set by controls.

## 0.47.0

### Minor Changes

- 6b20188: Text on a path. Two new type effects: `text-on-path` (words gliding along any SVG path you give it) and `circle-text` (words repeated round a turning ring, a badge or seal), both with the text effects' font, weight and inline controls. A new motion primitive, `path.text`, sets any `<text>`'s words along a `<path>` in a picture and moves them from one fraction of its length to another (with `lift` off it), and comes off cleanly with `removePrimitive`. Agents reach it through `primitive.apply`.

### Patch Changes

- 28f203a: The lazy catalog (`@pixerate/flair/catalog/lazy`) lists `text-on-path` and `circle-text`, which were added to the catalog alongside it.

## 0.46.0

### Minor Changes

- 2dcab84: A lazy catalog: `@pixerate/flair/catalog/lazy` loads every effect's metadata up front (`EFFECT_META`, `getEffectMeta`, `findEffectMeta`: ids, names, categories, descriptions, tags, controls, preset names, inputs and video use; about 91 KB gzipped, against 425 KB for the full catalog), and loads each effect's shader or picture on demand with `loadEffect(id)` (a median of 12 KB). The full catalog gains `loadEffect` and `effectMeta` with the same shapes, and is unchanged otherwise.

## 0.45.0

### Minor Changes

- 9de18d4: Pixels in and out, and rendering in Web Workers. Image controls take an `ImageBitmap`, `VideoFrame`, `ImageData` or `OffscreenCanvas` through `setLiveSource` (stills upload once, and upright, `ImageBitmap` included). `ShaderFrames` accepts an `OffscreenCanvas`, makes one itself where there is no `document`, and gives frames out with `readImageData()` and `toImageBitmap()`. Image URLs load in a Worker through `loadImageSource` (`fetch` and `createImageBitmap`).

## 0.44.0

### Minor Changes

- d3db504: Add 16 glass and mirror effects to the catalog: `glass-text` (glass letters over a picture with a light beam that sweeps through and splits into a faint rainbow at the bevels), `chrome-text`, `glass-orb`, `glass-blocks`, `cracked-glass` (cracks at clicks), `condensation-wipe` (the pointer wipes fogged glass), `stained-glass`, `image-stained-glass`, `gemstone`, `prism-light`, `dichroic-glass`, `floor-reflection`, `water-reflection`, `infinity-mirror`, `funhouse-mirror` and the `transition-mirror-fold` transition. `ribbed-glass` and `shower-glass` gain a `uDispersion` control (off by default) and a "Prismatic" preset. Glass effects across categories are tagged `glass`, and mirrors `mirror` and `reflection`. The `SPECTRUM` GLSL helper (`spectrum(x)`, red to violet) is exported from `@pixerate/flair/catalog`.

## 0.43.0

### Minor Changes

- 8ec6139: Add `isMotionEffect`, `nonImageEffectControls`, and `sanitizeEffectValues` catalog helpers, and `exportEffectBuffer` in `@pixerate/flair/node` for in-memory server effect rendering.

## 0.42.0

### Minor Changes

- 5358c52: Add catalog effect capability predicates, query filters, and prompt integration helpers:
  - Add `canOutputAnimatedSvg` and `canOutputVideo` predicates for querying effect output capabilities.
  - Add `output?: "animation" | "video"` support to `EffectQuery` in `findEffects`.
  - Add `isHumanReadableControl` to identify configurable effect controls suitable for user interfaces and prompts while filtering out internal/engine uniforms and textures.
  - Add `getPromptVariables` to extract human-readable effect controls as prompt variable definitions with constraints or default options.
  - Add `getEffectReferenceSvg` to extract rendered SVG markup from vector effects for renderer template reference.

## 0.41.0

### Minor Changes

- fa273b2: Add `isSinglePictureEffect` catalog helper and `singlePicture` option to `EffectQuery` in `@pixerate/flair/catalog` to cleanly filter effects designed to style, filter, or distort a single picture.

## 0.40.0

### Minor Changes

- b403438: Vector motion timing: an `SvgAnimation` can now `repeat` whole cycles (taking `ms × repeat`), `alternate` every other cycle backwards, hold its time on a `strobe` grid of frames a second, and take a spring ease, `{spring: {mass?, stiffness?, damping?, velocity?}}`, that matches `@pixerate/editor`'s `springAt` exactly (`springProgress`, `springSettleMs`). `svgFrame`, `svgDuration`, `SvgPlayer` and `svgAnimatedMarkup` play them, `svgMotionIssues` checks them, and emphasis primitives take `repeat` and `alternate`. A new test checks every primitive the animation editor shares against Flair's.

## 0.39.0

### Minor Changes

- 307a343: Support headless Chrome container execution, video metadata probing, audio pass-through muxing, and permissive control checks:

  - **Headless Chrome Discovery & Linux Container Support**:
    - Discover Playwright and Puppeteer cached browsers (`~/.cache/ms-playwright`, `~/.cache/puppeteer`, and system locations).
    - Add standard Linux container flags (`--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, SwiftShader WebGL fallback flags) and support custom Chrome flags via `chromeFlags` export option and `FLAIR_CHROME_FLAGS` environment variable.
    - Set ANGLE backend to SwiftShader for non-macOS headless Chrome.
    - Capture Chrome stderr and attach diagnostic logs to render stall, exit, and launch errors.
    - Configurable render stall watchdog timeout via `stallTimeoutMs` or `FLAIR_STALL_TIMEOUT_MS`.
    - Optional fallback to `@ffmpeg-installer/ffmpeg` when `ffmpeg` is not in system PATH.
  - **Video Probing & Export Parity**:
    - Add `probeVideo(file: string): Promise<VideoProbe>` (and export from `@pixerate/flair/node`) to probe video duration, native dimensions (`width`, `height`), and audio stream presence.
    - Default `exportEffect` output dimensions to probed video input dimensions and video duration without capping at 10s.
    - Automatically mux and preserve original video audio streams (or custom audio tracks) when exporting to `.mp4`, `.webm`, or `.mov` with `audio` option support (`'copy' | 'mute' | false | boolean | string`).
  - **Permissive Control Validation**:
    - Add `ignoreUnknownControls?: boolean` to `checkEffectValues` and `EffectExportOptions` to safely allow extra/custom pipeline control keys without throwing validation errors.

## 0.38.0

### Minor Changes

- 02f96f9: Motion primitives: a new `@pixerate/flair/motion` entry point with 23 reusable entrances, exits, emphasis and path motions (fade, pop, grow, slide, wipe, iris, split, zoom, rise, draw; fade, shrink, slide, wipe and undraw out; pulse, shake, teeter, wave, colour pulse, spin and a seeded wiggle; follow a path) that work on any element of an `SvgMotion`. Each is a JSON descriptor (`PRIMITIVES`) with labelled params, defaults and ranges; `applyPrimitive` expands one into plain `SvgAnimation`s (adding a wrapper group or clip path where needed), all or nothing, and `removePrimitive` takes it off. Defaults match `@pixerate/editor`'s animation editor.

  `SvgAnimation` gains `behavior` (pulse, oscillate, wriggle and overshoot, still pure functions of time), `orient` (turn with the path `along` follows) and `tag` (which primitive use added a change). The effect editor adds the `primitive.list`, `primitive.describe`, `primitive.apply`, `primitive.applied` and `primitive.remove` commands, each one undo step, and the agent instructions say when to use them.

## 0.37.0

### Minor Changes

- 2718199: The effect editor opens animations made with `@pixerate/editor`'s vector animation editor. `effectDocumentFromAnimation(scene)` and `EffectEditor.loadAnimation(scene)` (the `effect.loadAnimation` command, so agents can call it too) turn a `MotionScene` into a vector effect with the scene's colour controls as `{{name: color}}` placeholders and its presets kept. A scene with errors is refused, listing them. The optional `@pixerate/editor` peer now needs 0.55 or later, the first release with `/animation-editor`.

## 0.36.0

### Minor Changes

- ba87bdf: Vector motion takes any cubic-bezier easing: `SvgAnimation.ease` (and `stepProgress`, `stepData`, `animateCount`) accept `[x1, y1, x2, y2]` besides `linear`, `out` and `in-out`, with overshoot for back eases. `svgMotionIssues` checks the curve, and `svgAnimatedMarkup` writes it as an exact SMIL `keySplines` curve (sampled when it overshoots, which SMIL cannot spline). New exports: `SvgEase`, `CubicBezier`, `cubicBezierEase`, `easeFunction`, `isCubicBezier`, `isSvgEase`. Animations exported from `@pixerate/editor`'s animation editor can use their own curves instead of being sampled into linear steps.

## 0.35.2

### Patch Changes

- 66e52bd: Add swiftshader ANGLE flag for headless Linux Chrome, evaluate render stall timeout dynamically, and capture Chrome stderr for diagnostic logs on exit or timeout

## 0.35.1

### Patch Changes

- ac354c4: fix: add container-friendly flags and configurable stall timeout in recorder

## 0.35.0

### Minor Changes

- ff69dbd: Agent tools are stricter, smaller and more complete.

  - Scene tools (`applySceneTool`) check arguments against each tool's schema and refuse calls that cannot apply (a missing or out-of-range shot, deleting a shot that does not exist, removing media that is not there) with `ok: false` and a sentence saying what to fix. Every result has an `output` to send the model: an outline without the full scene, a one-line summary and issues after an edit, the review without its markdown.
  - New `batch_scene` tool runs several scene tools as one all-or-nothing change. A `$N.path` reference that does not resolve now fails its step instead of passing the literal text on, and `$5.99`-style text is left alone.
  - `validateScene` reports unknown scene and shot fields, mistyped shot fields, commands without a type and shader media without `mainImage`.
  - New `effect.setMotion` command, so agents can edit vector pictures.
  - `catalog.search` returns `{ total, effects, more? }`, 20 effects at a time unless given `limit` (and `offset` to page). **Breaking** for code that read its result as an array.
  - `effect.setSource` returns the compile report (or says the source has not been compiled yet), and `effect.describe` says so instead of `compile: null`.

## 0.34.0

### Minor Changes

- a3be887: Catalog: `EFFECT_CATEGORY_GROUPS` sorts the 40 categories into 8 groups (Backgrounds, Light, Pictures, Particles & FX, Type & titles, Inputs, Interface, Transitions). `categoryGroup(category)` gives a category's group, and `findEffects({ group })` and the `catalog.search` command filter by group. The demo gallery browses by group, then by category. Editor documents for vector effects now get the effect's own length (its motion plus `hold`) as their timeline instead of a fixed 5 s.

## 0.33.0

### Minor Changes

- 8a5a3b0: Data and icon effects (vector, so they render crisp and export to animated SVG and recordings).

  - **data**: `donut-chart`, `pie-chart`, `gauge`, `bar-race`, `sparkline`, `leaderboard`, `area-chart` and `kpi-tile`. Lists come in through text controls of comma-separated values with a matching labels control (`values: "42,28,18,12"`, `labels: "Direct,Social,Search,Email"`); stacked series and race rows are separated by semicolons (`series: "12,18,15;8,10,14"`, `rows: "Lumen:12,28,41;Pixel:30,36,48"`). Any text is safe: unreadable numbers count as nothing, units and currency signs are ignored, and the defaults come back when nothing is readable. Long labels are cut short with an ellipsis.
  - **icon**: `weather-icons` (sun, partly cloudy, cloudy, rain, thunder, snow or wind, picked by `kind`), `notification-bell`, `animated-arrows` (nudge, chevrons, refresh or external link), `emoji-reactions` (hover), `bookmark-star` (a five-star rating filling on hover; `like-button` already covers the heart burst), `trash-delete` (click, replays), `lock-unlock` (click toggle) and `wifi-signal`.

## 0.32.0

### Minor Changes

- 2db30d4: Eighteen catalog shaders in three new categories, `3d`, `weather` and `water`, and more `space`:

  - `3d`: `globe` (a dotted or realistic Earth-like globe with glowing arcs between cities and an atmosphere rim; drag it to turn it), `rotating-shapes` (a torus, rounded cube and icosahedron in a soft-shadowed studio), `isometric-city` (buildings rising, windows lighting through a day and night cycle), `wireframe-terrain` (a glowing mesh fly-over with fog), `metaballs-3d` (glossy merging blobs reflecting a studio) and `torus-knot` (an iridescent, glowing (p, q) knot).
  - `space`: `planet` (banded or rocky, with atmosphere, terminator and optional rings), `spiral-galaxy` and `solar-system`.
  - `weather`: `rain-streaks`, `wind-gust` and `hail` (transparent overlays), `thunderstorm`, and `rainbow` (over a picture or video).
  - `water`: `ocean-waves` (sunset or day, foam and sun glint), `underwater-scene`, `pond-ripples` (raindrops and clicked stones rippling a picture or video) and `waterfall`.

  `EFFECT_CATEGORIES` lists the new categories before `transition`. The 3D effects meet their shapes analytically or march only inside bounding volumes with bounded steps, so each stays at about 3 ms or less a frame at 1080p on an M4 Pro.

## 0.31.0

### Minor Changes

- 1bd6d27: A new `ui` catalog category for landing-page flourishes and backgrounds, plus more loaders and gradients (22 effects):

  - **UI shaders**: Border beam (`border-beam`, a light beam running round a card's border), Gradient border (`gradient-border`, a turning conic ring with glow), Meteors (`meteors`), Background beams (`background-beams`), Grid spotlight (`grid-spotlight`, follows the pointer), Dot grid (`dot-grid`, dots swell near the pointer), Glass card (`glass-card`, frosted glass over a picture or video), Liquid glass (`liquid-glass`, a refracting glass pill that follows the pointer) and Grainy glow background (`noise-grain-bg`). Each has dark and light presets.
  - **UI vectors**: Marquee (`marquee`, a seamless logo or word scroller with faded edges), Number ticker (`number-ticker`, an odometer roll to any formatted value such as `$12,480`) and Animated badge (`animated-badge`, a shimmering "New" pill with a sparkle).
  - **Loaders**: Skeleton shimmer, Progress bar (striped, with a percentage), Indeterminate bar, Step progress, Circle dots loader and Wave bars.
  - **Gradients**: Grainy gradient (with a Stripe-like preset), Stripe gradient, Holographic gradient and Radial glow.

## 0.30.0

### Minor Changes

- 94bac1b: Broadcast graphics and annotations: two new catalog categories of animated SVG effects in a 16:9, title-safe frame. `broadcast` has a lower third, a stacked lower third with a logo, a title card, a logo reveal, a logo sting, an end card, a countdown, a subscribe button, a news ticker, a scoreboard and a chapter marker; `annotation` has a hand-drawn circle and arrow, a callout, a bracket note, a scribble-out, step badges, a focus box, a product-demo cursor and a tooltip tour, all transparent to lay over video or screenshots. Each animates in, holds for its `hold` control and animates out, and takes a logo as SVG path data where it has one.

## 0.29.0

### Minor Changes

- aae5438: Sound and scrolling as shader inputs, and effects that use them.

  - New built-ins: `iAudio` (level, bass, mid, treble), `iSpectrum[16]` (64 log-spaced bins), `iBeat` (seconds since the last beat) and `iScroll` (progress through the viewport, page scroll, velocity, scrolling).
  - `ShaderRenderer.setAudioSource(element | stream | node)` listens through a shared `AudioContext` and `AnalyserNode`; `ShaderRenderer.setScrollProgress(p)` pins the scroll for scrubbers. `ShaderFrames.render(t, { audio, scroll })` scripts both.
  - `AudioAnalysis` (pure, deterministic), `analyseAudioBuffer` (offline, frame-exact, with a small radix-2 `fft`), `LiveAudio`, `sharedAudioContext`, `ScrollTracker` and `viewportProgress`.
  - `SvgPlayer` takes `trigger: "scroll"` (scrubbing with the page, over `scrollRange`) and gains `setProgress(p)` and `scrollPosition(p)`.
  - `effectInputs` reports `audio` in `accepts` and `scroll` in `interactions`; `mountEffect` takes an `{ audio }` subject; `recordEffect` takes `audio` (an `AudioBuffer` or a URL) to drive audio-reactive shaders frame for frame and mux the sound as AAC (mp4) or Opus (webm). `standaloneHtml` takes `{ audio: url | "mic" }`.
  - New `audio` category: spectrum-bars, circular-spectrum, waveform-line, bass-pulse, audio-particles, audio-plasma, vinyl. New `scroll` category: scroll-reveal, parallax-layers, scroll-progress-glow, scroll-velocity-blur, scroll-zoom, scroll-draw, scroll-counter, scroll-steps. All play idle demos with no sound or scrolling.

## 0.28.0

### Minor Changes

- da66f72: `glare-sweep` (overlay): the light sweep duotone used to have built in, now its own effect, as 0.22.0 should have added when it took the sweep out of `image-duotone`. A soft diagonal glare glides across without a pause, with strength, speed, tilt, sharpness and colour controls. It is added light: laid over a picture with `mix-blend-mode: plus-lighter`, `image-duotone` plus `glare-sweep` at their defaults matches the old duotone to within one level in 255; with normal blending it is a slightly softer, screen-like glare. `image-duotone`'s description now points to it (rather than `shine-sweep`, a different, intermittent gloss).

## 0.27.0

### Minor Changes

- c4b5214: Eleven new catalog effects, inspired by the Slop Machine promo videos:

  - **Slime curtain wipe** (`slime-curtain-wipe`): glossy goo pours down over the frame with drips and beads, then strings away to reveal the next picture.
  - **Gooey frame** (`gooey-frame`): a wobbling slime rim round a rounded rectangle, with drips that swell, run and bead. The goo version of Electric border.
  - **Goo vortex** (`goo-vortex`): glossy goo ribbons spiral into a ball, then fling out and splat round the frame.
  - **Memphis pattern** (`memphis-pattern`): an 80s field of squiggles, zigzags, triangles, rings and confetti that drifts and boils.
  - **Chevron tunnel** (`chevron-tunnel`): two-tone hazard chevrons streaming out of (or into) a centre point.
  - **Toast notification** (`toast-notification`): a toast that slides in, draws its tick, runs down its timer bar and slides away. Plays on click.
  - **Slider scrub** (`slider-scrub`): a cursor drags a slider knob while the fill and value count with it. Plays on click.
  - **Upload card** (`upload-card`): an image placeholder whose progress bar fills as a percentage counts, then the picture fades in with a check.
  - **Doodle burst** (`doodle-burst`): a tilted label card pops in while hand-drawn doodles burst out round it, with a line-boil wobble.
  - **Exploded layers** (`exploded-layers`): an isometric card whose layers lift apart with soft shadows between them, then settle back.
  - **Seal badge** (`seal-badge`): a scalloped or starburst seal that spins with its text upright, pulsing with a glint.

  The README's effect counts and category table are updated, including last release's Whip pan.

## 0.26.0

### Minor Changes

- 9c2c741: Scene shots can choose how the camera gets into them with `camera.transition`:

  - `"move"` (the default) eases across as before.
  - `"whip"` whip-pans off the last framing and onto the new one in a streak of motion blur.
  - `"zoom"` punches in and cuts to the new framing settling out.
  - `"cut"` jumps straight there and takes no time.

  The player, the standalone HTML player and the Lottie, Apple Motion, FCP7 and EDL exporters all play them. `transitionView` gives the camera part-way through any of them.

  New catalog shader **Whip pan** (`transition-whip-pan`): a two-image whip pan or zoom punch. The motion blur peaks at the cut and there's a slight scale punch. It has presets for whip left, whip up, zoom punch and hard whip.

## 0.25.0

### Minor Changes

- c33dcac: Pair any catalog effect with a picture, video, SVG, words or path, put it on a page, and record or export it.

  - `@pixerate/flair/embed` (new entry): `mountEffect(host, effect, { subject })` runs a shader or vector effect applied to `{ image }`, `{ video }`, `{ svg }` (markup or URL), `{ text }` or `{ path }`, putting it in the right control (from `effectInputs`) and explaining in a sentence when the effect can't take it; `subjectValues` gives the values without mounting. `recordEffect(effect, { subject, format })` records MP4 (H.264), WebM (VP9, with transparency), GIF or a ZIP of PNG frames in the browser with WebCodecs, frame-exact, with no new dependencies (small MP4, WebM and ZIP writers are included).
  - React `<FlairEffect>` and the Svelte `flairEffect` action run any catalog effect, shader or vector, applied to a subject.
  - `svgAnimatedMarkup(motion)` (in `/vector`) writes a vector effect as one self-contained animated `.svg` file (SMIL), exact for eases, draw-on, motion along paths and view zooms, with written text and counts switched in steps.

- c33dcac: Node rendering: `exportEffect` (and `flair render <effect>`) renders a catalog effect on an image, SVG, text, path or video to MP4, WebM (alpha), MOV (ProRes 4444), GIF, PNG frames or, for vector effects, an animated SVG. `flair effects` lists effects with what they take. `exportMotionGraphic` now compiles shaders with the real wrapper (so `iPointer`, `iClicks` and `iTrail` work), loads image controls, sets `int`/`bool` controls correctly, and can keep alpha.

## 0.24.0

### Minor Changes

- e909f4e: Catalog: a new **lighting** category, 10 effects that relight a picture or video rather than draw light as a background. The shaders read the picture's brightness as a height map (a Sobel of fine detail plus two broader scales from its mip levels) and shade the normals it gives.

  - **relight**: a directional light with azimuth, elevation, colour, ambient and a soft specular.
  - **point light**: a torch over a darkened picture, following the pointer while hovered and drifting otherwise.
  - **studio lighting**: three-point lighting on a subject, warm key, cool fill and a rim along its silhouette (alpha, or the corner colour keyed out), on a studio backdrop.
  - **time of day**: dawn, noon, golden hour, blue hour and night on an hour control or animated, with lights glowing from the brightest spots at night.
  - **gobo projection**: window panes, foliage, stars, venetian slats or your own text (a gobo image) projected onto a picture, softly focused and drifting.
  - **neon spill**, **candlelight**, **pool caustics** and **party lights** (beams, sweeping pools, mirror ball and strobe).
  - **lamp switch** (vector, click): a pendant lamp whose pull cord switches a warm light cone on and off.

## 0.23.0

### Minor Changes

- 69cdb60: `effectInputs(effect)` says what an effect takes and how it answers the pointer: what it `accepts` (image, video, svg, text, mask, path), its image controls and whether each wants a picture, a mask or text, its text controls (copy, font, path, glyphs), its video use, its `interactions` (hover, press, click, trail, pointer) and whether it is a transparent overlay. It is worked out from the effect's controls, source and fields, so it never drifts. `findEffects` and the `catalog.search` command filter on `accepts`, `interaction` and `transparent`, and the search lists each effect's inputs. `silhouette-morph` now says `video: "none"` (it takes silhouettes, not photos), and the fireworks, explosion and bullet-time effects are tagged `interactive`.

## 0.22.0

### Minor Changes

- 4eb5f23: `image-duotone` is now only a duotone: it maps the picture onto two colours by brightness, still and without its built-in light sweep (the `uSweep` control is gone). For the glare, lay the `shine-sweep` overlay over it.

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
