# @pixerate/flair

## 0.120.0

### Minor Changes

- a2ec9ec: Add `insight-cards`, a UI effect: an AI analysis panel whose findings drop in one after another. Each card arrives as a shimmering skeleton before its title, source link and summary fade in. Then the flagged finding turns red: a wash comes up, its bracket turns red, and a glowing border traces round it and pulses.

  - Up to three findings, each with a title, a source and a summary. Summaries wrap to two lines and are cut short with an ellipsis if longer.
  - Choose which finding is flagged (or none), the heading, and the count on the "+n" pill (0 hides it). The panel shrinks to fit fewer findings.
  - Colours for the background (which can be turned off), panel, text, accent and flag, plus a glow strength.
  - Presets: Light, Amber warning, No flag and Two findings.

## 0.119.0

### Minor Changes

- 6bfe761: Add `seed-head-burst`, a transparent light overlay for a hero moment. A fuzzy gold orb, like a dandelion seed head, comes into focus out of a cloud of golden dust: fine engraved rings and a fringe of spines sharpen. Then it bursts. Rays shoot out with glowing comet heads that ease to a stop and land as small nodes, some as purple orbs and the rest as cyan sparks, while the dust blows outward and away.

  - Colours for the orb, its rim and spines, the dust, the rays, the comet heads and the nodes.
  - The number of rays (4–32), orb size, ray reach, how much dust, glow, cycle length, and a still progress for a single frame.
  - Presets: With background, Ember, Ice, Still burst and Many rays.
  - It's also exported to the Metal/Swift package.

## 0.118.0

### Minor Changes

- 7e8838b: Add `ai-prompt-bar`, a UI effect: a frosted AI prompt box. A request types into the field while two glowing beams chase round the panel. Then the send button presses with a ripple, the action chip lights up and a shimmer sweeps the text while it thinks.

  - Set the request, placeholder, agent chip, action chip and typing pace (ms per letter). A request too long for the field is cut short with an ellipsis.
  - Colours for the background (which can be turned off), panel, field, typed text, chip text and two accents, plus a glow strength.
  - Presets: Light, Violet and Search.

## 0.117.0

### Minor Changes

- 4e3538b: Add `stat-cards`, a data effect: a grid of headline stats that fade in dim, then light up one after another. As each card lights, a streak runs across its top, a glowing ring flashes round it and its figure counts up. Once all are lit, the rings pulse together.

  - Values are written as they should read (`120+`, `$4.2M`, `98%`, `15 min`). The text before and after the number is kept while it counts, and a value with no number in it is shown as it is.
  - Up to six cards, laid out by how many there are: a row of up to three, two by two for four, three by two for five or six, with a short last row centred.
  - Colours for the background, cards, accent and text, a glow strength, and the background can be turned off.
  - Presets: Light, Gold and Six up.

## 0.116.0

### Minor Changes

- 3395927: Add `ringed-orb`, a shader loader: a glossy, lit orb inside two rings turning opposite ways, one of fine radial dashes and one of drifting specks. It sits on a dark halo disk with a light sweeping round the disk's rim. It's transparent by default, so it can be dropped onto any card as a hero icon or a "thinking" indicator.

  - Colours for the orb, its rim, the ring, accent glints and the disk.
  - Disk opacity, size, the number of dashes, ring speed, rim-light speed and glow.
  - Presets: With background, Gold, Cyan and No disk.
  - It's also exported to the Metal/Swift package.

## 0.115.1

### Patch Changes

- 1c3135d: `relief-hex-ink` (and, less visibly, `relief-hex-tiles`) no longer splits tiles. A tile could show a thin vertical groove, or be half black and half white, along a line that shifted as the tiles rose and fell. Per-tile randomness is now keyed on a whole-number tile id (a tile's centre came out a hair different either side of the grid's internal seams), and whether a tile is inked is judged at its centre. Ink tiles also shade by height, so black tiles are seen rising and falling too.

## 0.115.0

### Minor Changes

- 2340432: Add `hub-spoke-graph`, a data effect. A glowing hub lights up in a puff of dust, then spokes shoot out on comet heads to glossy pearl nodes, up to eight of them. Each node branches into small leaves and links to its neighbours, then sparks run out along the spokes as the hub pulses.

  - `labels`: the spoke names, comma-separated.
  - `hub`: the centre's label.
  - `leaves`: leaves per spoke, 0 to 4.
  - `backdrop`: turn it off to use the effect as an overlay.
  - Presets: Light, Neon and Solar system.

## 0.114.0

### Minor Changes

- ccddf39: Add `fan-out-links`, a data effect: one source card sends a fan of curved links out to a column of up to ten targets, each drawn by a glowing comet head that lands on its label. The card's count ticks up as the links arrive, then sparks run along them. Targets go in `labels` (comma-separated) and the card's caption in `source`. `total` sets the count, and `backdrop` turns the background off for use as an overlay. It comes with Light, Neon and Team presets.

## 0.113.2

### Patch Changes

- 0644b4a: `relief-hex-tiles` and `relief-hex-ink` now visibly move: their tiles rise and fall in a wave that rolls across the cluster toward where it gathers, each tile a little out of step, instead of each tile drifting on its own (which read as still). The wave turns twice in the 8-second loop. `uVariation` ("Rise and fall") now sets how deep the wave goes, default 0.8.

## 0.113.1

### Patch Changes

- 2c8359a: The Swift package's Metal shaders build without warnings. Seven catalog shaders lose a local they computed but never used (`cinema-projector`, `leaves-blowing`, `sparkler`, `trail-cam`, `wax-melt`, `wind-gust`, `wireframe-reveal`), and `flair export metal` marks its generated `.metal` files to ignore unused variables and constants, which spirv-cross leaves behind when it inlines a helper whose `out` argument a call site ignores, or copies a constant array.

## 0.113.0

### Minor Changes

- b61f1bf: Path trails and tubes can be sized by a brush instead of by the frame. `comet-trail`, `ribbon-trail`, `sparkle-trail`, `brush-trail`, `ghost-trail`, `light-painting`, `glass-tube` and `glass-writing` gain a `uUnit` control ("Size unit", px, default 0): when it is set, the widths, sizes and glows they draw are shares of `uUnit` px instead of the frame's height (or, for the tubes, its shorter side), while their positions stay in pixels. An editor painting one along a stroke on a large canvas sets it from the brush's size, so the stroke looks as it does in a small preview. With `uUnit` 0 nothing changes.

## 0.112.0

### Minor Changes

- fbf8224: A new `relief` catalog category, browsed under Backgrounds: white-on-white surfaces shaped in depth and drawn only by a side light and soft shadows.

  - `relief-hex-tiles`: hexagon tiles raised from a wall at different heights, gathering toward one side with a few strays, rising and settling slowly (loops in 8 s). It paints as a canvas texture.
  - `relief-hex-ink`: the same tiles on cracked plaster, the deep ones black ink and marbled, with ink spattered across the wall.
  - `relief-paper-text`: a word or logo (any picture's alpha) cut into a sheet or raised from it, or cut in at one end and rising at the other.
  - `relief-paper-waves`: stacked paper-cut waves, each casting a soft shadow on the one below (loops in 10 s).
  - `relief-emboss`: a picture or video pressed into paper, as a live video filter.

  Each has light direction and height, shadow softness and, for the raised ones, a view tilt that shows their walls.

## 0.111.1

### Patch Changes

- 71a8e47: `light-painting` and `neon-ripple` now have paint hints. `light-painting` paints along the stroke (`map: "path"`, still, with `uBackgroundAlpha: 0`). It gains its own background opacity control, so its vignette and grain fade with the backdrop; at the default opacity it looks as before. `neon-ripple` is live canvas paint whose rings keep spreading without a pointer. `prism-light` stays unhinted: it is a single prism and beam, so painting only uncovers a fragment.

## 0.111.0

### Minor Changes

- 6ee24c9: Swift: documents whose GLSL was edited on the web now open and draw in `FlairEditorEffects` when they carry Metal compiled from that GLSL. `attachFlairMetal(document)` (`@pixerate/flair/node`) and `flair export metal-document <document.json> [output.json]` add it as `provider.metal` (the MSL, its uniform layout, the description for its controls and a SHA-256 of its GLSL). The Swift session shows and saves the GLSL with its Metal, drops the Metal when the GLSL is edited on the device (where it can't compile), and refuses Metal made from other GLSL, saying how to compile it. New in `FlairEffects`: `FlairRuntimeEffect`, `AnyFlairEffect(runtime:)` and `FlairRenderer.loadLibrary(msl:functionName:timeoutMs:)`, within the 2 s compile budget. The TypeScript adapter now keeps a document's `provider` data until its GLSL changes, opens GLSL given as the contract's `source`, and writes `source` and `sourceLanguage: "glsl"` in shader documents. Needs the editor's Swift package 0.42.0. `flair export metal` now writes `FlairRuntimeEffect.swift` and the `prepare` method `FlairRenderer` gained in the last release (its template had missed it); a test now keeps the templates and the Swift package's files the same.

## 0.110.0

### Minor Changes

- 14cbdb6: Paint hints and SwiftPM version tags. Effects that make good paint in an editor that brushes with effects now say how: `flairEffects()` summaries and descriptions (and the Swift `FlairEffectProvider`'s, through `flair-effects.json`) carry a `paint` hint (`map`: `path`, `stroke` or `canvas`; `colors`; `values`; `live`; `repeat` for `stroke`; `size` when suggested), and both providers declare `capabilities.paintHints`, meaning effects without a hint are not meant as paint. 66 of the 259 generator, overlay and title shaders have one; the hints are `PAINT_HINTS` in `@pixerate/flair/catalog` and `/catalog/lazy`, and `EffectMeta.paint`. Releases now also tag their commit with a plain semver tag (this release's own, e.g. `0.110.0`), so Swift apps can depend on Flair with `.package(url: "https://github.com/Pixerate/flair.git", from: "0.110.0")`.

## 0.109.0

### Minor Changes

- 6435124: Trail effects (`comet-trail`, `ribbon-trail`, `sparkle-trail`, `brush-trail`, `ghost-trail`, `light-painting`) given their path as points through the editor effect adapters (`flairEffects()` and Swift's `FlairEffectProvider`) now draw the whole path as their trail, head at its end, instead of a demo walking along it, so an editor painting with one along a stroke sees the whole stroke. SVG path data still walks as before.

## 0.108.0

### Minor Changes

- 5abba4c: Swift: `FlairEffectProvider` (`FlairEditorEffects`) is now an `AuthoringEffectProvider`, so the Pixerate editors' Swift Effect Authoring tab and `effect_authoring_*` tools edit Flair effects: `openAuthoring` opens a catalog effect (optionally with a preset) for its values, presets, keyframes and timing, or a document saved by `exportDocument` on either adapter. Documents keep the catalog's Metal shader when their GLSL matches the hash `pnpm swift:meta` now writes; GLSL edited on the web is refused on Swift with a message saying where to open it. Shaders get 2 seconds to compile (`compileTimeoutMs`), and `FlairRenderer.prepare(anyEffect:timeoutMs:)` compiles one ahead of a render. Paint editors draw saved Flair documents only with `rawShaders: true`. Needs the editor's Swift package 0.41 or later.

## 0.107.0

### Minor Changes

- f029a4d: Swift: `FlairEditorEffects`, a new optional product of the root Swift package, makes Flair an effects provider for the Pixerate editors' Swift package. `controller.setEffectsProvider(FlairEffectProvider())` on a `PaintEditorController` gives it every Metal shader as effect paper, effect layers, fills and effect paint, described exactly as `flairEffects()` describes them (generated by the new `pnpm swift:meta`), so documents move between web and Swift editors. Filters, transitions, masks and CSS colours render as in the TypeScript adapter.

  **Breaking for Swift apps:** the Swift package (root and `swift/`, and `flair export metal`'s manifest) now targets macOS 14 and iOS 17 (was macOS 12 and iOS 15), because the editor's package needs them and SwiftPM sets platforms per package.

## 0.106.0

### Minor Changes

- 04bd8bc: Three new categories of effects, browsed under Pictures:

  - `emergency`: `siren-lights` (the red and blue wash of a light bar, alternating or rotating, as an overlay), `red-alert` (a picture or video under red emergency lighting with a beacon sweeping round), `caution-tape` (tape snapping across the frame in an X, any text) and `emergency-alert` (a phone's emergency alert card dropping in and buzzing). Neither light can be set to light up more than one and a half times a second; the shaders clamp it too.
  - `film`: `film-strip` (a picture or video running through a strip of film between its sprocket holes, upright, across or tilted, as a negative too), `film-damage` (a battered print: scratches, dust, hair, blotches, splices and cue marks), `dramatic-letterbox` (bars slamming in with a push-in and a teal-and-orange grade) and `film-projector` (a vintage projector running, as an animated SVG). `letterbox`, `academy-leader` and `cinema-projector` move here from `cinematic`, keeping their `cinematic` tag.
  - `crt`: `crt-power` (a tube switching on from a bright line and off to a fading dot), `vertical-roll` (a picture rolling as it loses vertical hold, then catching), `crt-television` (a picture on an old TV set in a dark room) and `crt-terminal` (a phosphor terminal typing out lines, as an animated SVG). `crt` moves here from `image` and `tv-static` from `retro`.

  Filter by `category: "emergency"`, `"film"` or `"crt"` to find them. The Swift package gains the new shaders.

### Patch Changes

- 79d5e32: Deduplicate in-flight module loads in `@pixerate/flair/catalog/lazy` when multiple effects from the same module are requested together, and resolve effects in the docs gallery, detail sheet, and hero stage from the already-bundled `@pixerate/flair/catalog` so previews never fail on dynamic chunk fetches across deployments.
- b3d8e9d: Swift: add a root `Package.swift` so `FlairEffects` can be used as a SwiftPM git dependency. `FlairPathRasterizer` now packs paths in the same texture layout as the web `pathTexture` (points in path units, y down, fitted by the shader's `PATH` helpers), fixing path effects such as `glass-tube` on Metal. `AnyFlairEffect` gains `encodedJSON()`, `decoded(from:)`, `encodedValues()` and `applying(values:)`, and `FlairRenderer` gains `renderBytes(anyEffect:…)`.
- 7ccbe85: Transparent effects render correctly in Safari. `ShaderRenderer` with `alpha: true` (and so `mountEffect` for overlay effects such as `iridescent-text`) now draws into a premultiplied canvas and premultiplies its output: Safari shows a straight-alpha WebGL canvas as if it were premultiplied, so faint pixels such as soft glows came out as bright, opaque boxes. `createContext` takes a `premultiplied` option and `premultiplyOutput` sets up the blending for it. Pixels read back from `ShaderFrames` and `ShaderPipeline` are unchanged.

## 0.105.0

### Minor Changes

- 9fe75f4: Add an automated GLSL → SPIR-V → Metal Shading Language (MSL 2.1) transpilation pipeline and the `FlairEffects` Swift package (`swift/`) targeting iOS 15+ and macOS 12+:

  - **Metal pipeline (`@pixerate/flair/node` & `flair export metal`)**: `wrapMetalSource`, `metalUniformLayout`, `packMetalUniforms`, `compileShaderToMetal`, `generateSwiftEffectStruct`, and `exportMetalPackage` compile all 441 catalog shader effects (and their multi-pass/feedback chains) into `.metal` sources with line-mapped diagnostics and generated Swift `FlairEffect` structs.
  - **`FlairEffects` Swift package (`swift/`)**: Typed `FlairEffect & Sendable & Equatable & Codable` structs with `@control` properties, presets, `std140` uniform packing, web-compatible `Codable` JSON (`uSpeed`, hex or `[r, g, b]` colours), `MTKView` + SwiftUI `FlairEffectView` / `.flairBackground` / `.flairOverlay`, offscreen `FlairRenderer`, multi-pass/feedback `FlairPipeline`, CoreText `FlairTextRasterizer`, `CGPath` `FlairPathRasterizer`, and `FlairPointerTracker` / `FlairAudioTracker` / `FlairScrollTracker`.
  - **Catalog & CLI (`swiftReady` / `--swift`)**: Added `swiftReady` to `EffectMeta` / `EffectQuery`, `--swift` to `flair effects`, and `swiftReady` filtering to the `catalog.search` agent command.

## 0.104.0

### Minor Changes

- 4281796: Three pixel-bloom effects: rounded squares on a sunflower spiral (phyllotaxis). `pixel-bloom` (pattern) is big at a bright centre and shrinks to pixel dust toward the edge, turning slowly while a shimmer ripples outward, on a clear background. `pixel-bloom-reveal` (loader) is a logo-sting loop: squares pop out centre-first, hold, then spin away to dust edge-first. `transition-pixel-bloom` grows spiral squares out from the centre, each carrying the next picture, with a glow on the growing edge. Each pixel only checks the squares near its radius and angle, so all three stay within a few milliseconds a frame at 1080p.

## 0.103.0

### Minor Changes

- 48069f7: Sixteen new audio-reactive effects in the `audio` category, each playing an idle demo when silent:

  - `black-hole-spectrum`: a lensed black hole whose accretion disk is the spectrum (bass outside, treble by the horizon).
  - `black-hole-silhouette`: the same for any shape or word (a mask): the disk hugs its outline, lensed over the top, with a photon ring tracing its edge.
  - `arcane-sigil`: any shape or word as a magic portal ringed by bands of glowing runes, one to a band of the spectrum.
  - `spell-trace`: a minimal hairline trace of any shape or word, with a ring of 64 spectrum dots (transparent).
  - `ripple-dot`: a single dot and its ripples, the spectrum read outward (transparent).
  - `cymatics`, `liquid-chrome`, `aurora-curtain`, `neon-skyline`, `fractal-pulse`, `ferrofluid-spikes`, `saturn-rings`, `solar-prominence`, `plasma-globe`, `pulsar` and `nebula-pillars`.

  Find the ones that take a shape with `findEffects({ accepts: ["audio", "mask"] })`.

## 0.102.0

### Minor Changes

- 9482b18: A new `anime` category of effects, browsed under Pictures: `manga-tone` (a picture or video printed as a black-and-white manga page with screentones and hatching), `anime-sky` (a painted sky with cel-shaded cumulus and sun glare), `sakura-petals` (cherry blossom drifting down, as an overlay), `shoujo-sparkles` (a pastel backdrop of bubbles and sparkles), `gloom-lines` (despair lines hanging from the top of the frame), `menacing` (throbbing ゴゴゴ glyphs, any glyph you give it) and `eyecatch` (an anime ad-break title card). `focus-lines` and `anime-emotes` move here from `comic`; filter by `category: "anime"` (or the `manga` / `anime` tags) to find them.

## 0.101.0

### Minor Changes

- 9a297b0: `flairEffects()` now offers timing effects to `@pixerate/editor`'s editors. They come with the use `timing` and `capabilities.supportsTiming`. `timingLength` and `timingSample` give a retime's length and the weighted footage frames each moment shows, exactly as Flair's own players draw them. `/integrations` now needs `@pixerate/editor` 0.254 or later; for an older editor, pass `kinds` without `timing`.

## 0.100.0

### Minor Changes

- 5989caa: Timing effects now render in Node. `exportEffect` and `flair render <id> --video clip.mp4 -o out.mp4` retime a video file with no browser: ffmpeg decodes it once, `TimingRenderer` blends the frames, and the result is encoded to mp4, webm, mov, gif or png frames, at the video's own size and frame rate unless asked. The clip's own sound is left out because it would not follow the retime. `flair render` gains `--audio` to mux another track, and keeps a retimed video's frame rate when `--fps` isn't given. `flair effects --kind` now takes `camera` and `timing`.

## 0.99.0

### Minor Changes

- 215aa61: Add timing effects: a new `timing` kind and category that retimes real video footage. The kind includes a speed change, speed ramp, reverse, boomerang, freeze frame, stutter, step frames, frame echo and long exposure. Each effect is a pure function from a moment of the result to the weighted footage frames it shows (`timingSample`, `timingLength`). `TimingRenderer` and `FrameBlender` draw those frames from any `TimingFootage`. `mountEffect` and `recordEffect` play timing effects on a `{ video }` subject, or on Flair's own preview clip (`previewFootage`, `videoFootage` in `/embed`). Agents find them with `catalog.search` (`kind: "timing"`) and inspect a retime with the new `catalog.timing` command.
- 5b1126c: Scene layers can retime their video. A layer whose subject is `{ "video": url }` (or a slot the host fills with a video) takes a timing effect as its `timing`, by id (`"timing": "retime-reverse"`) or with a preset and values (`{ "effect": "long-exposure", "preset": "Light trails" }`). The layer's `effect`, if any, treats the retimed picture. `validateScene` checks the timing effect, its preset and values and the subject, with refusals that say what to write; a timing id in `effect` now points at `timing`. `scenePlan` carries it as the layer's `timing` (`{ effect, values }`, in the plan's JSON Schema), and `SceneCompositor`, `mountScene`, `recordScene` and the standalone scene page draw it with `TimingRenderer`. For agents, the new `retime_layer` scene tool sets or removes a layer's timing, `find_layer_effects` lists timing effects (`kind: "timing"`, `goesIn: "timing"`), and the outline shows each layer's timing.

## 0.98.0

### Minor Changes

- 8c8ebd7: Text template export: `exportTextTemplate(scene)` exports a scene's words as an animated Bodymovin/Lottie title template for video editors, with editable text layers for titles, captions, element text and text effects, their fonts, boxes and word timings, and Lottie slots and fields to re-bind them. `exportScene(scene, format)` exports to any scene format by name, `flair scene export --format text-template` writes one, and agents get an `export_scene` tool.

## 0.97.1

### Patch Changes

- 8e04d16: `light-strand-text` keeps its strands distinct: while it builds up, each strand falls as its own bright line with the dark between strands left clear, and the letters fill in behind them once they land. Built, the strands are crisper lines at the same overall brightness.

## 0.97.0

### Minor Changes

- 8ddd321: Flair's agent skills (`flair-use`, `flair-author`) are now a Claude Code plugin: the repository is a plugin marketplace named `pixerate`, so `/plugin marketplace add Pixerate/flair` then `/plugin install flair@pixerate` installs them. The plugin's version follows the package's, so it updates with each release. The skills also say to install `@pixerate/flair` in the project, since their `npx flair` commands run the project's own copy.

## 0.96.0

### Minor Changes

- 3aab8f2: A `path` category (browsed under its own "Paths" group) gathers the effects that move along a path you give them: `glass-tube`, `glass-writing`, `swoosh-underline`, `border-beam`, `text-on-path`, `route`, `signature`, and the pointer trails that follow a path while idle (`comet-trail`, `ribbon-trail`, `sparkle-trail`, `brush-trail`, `ghost-trail`, `light-painting`, still tagged `trail`). Shader effects that build up once and settle say how long that takes in a new `build` field (also in the lazy catalog's metadata), and `ThumbnailPool.register` takes `{ build }` so a thumbnail replays the build from when it comes into view and holds the built frame when still; the gallery's glass tube and glass writing now show themselves being drawn.

### Patch Changes

- babf348: Skip `.dts` generation during Firebase App Hosting builds (`FIREBASE_APP_HOSTING=1` or `NO_DTS=1`) to prevent build worker out-of-memory errors.

## 0.95.0

### Minor Changes

- 0d40399: `light-strand-text` builds up: its strands fall into place from top to bottom, the middles of the letters first and their edges last, over `uBuildTime` seconds (turn `uAnimate` off and set `uProgress` to hold a stage). The strands no longer trail out past the letters' corners, and the `uTrail` control is gone.

## 0.94.0

### Minor Changes

- b0d3e52: Agent skills for coding agents writing code that uses Flair: `flair-use` (finding an effect from a generated index of the whole catalog, choosing an entry point, controls, presets, camera moves, scenes and checking the result) and `flair-author` (custom shader and vector effects). They ship in the package's `skills/` folder; `npx flair skills install [--dir .claude/skills] [--skill <name>]` copies them into a project (`installSkills` from `@pixerate/flair/node`), and `flair skills list` lists them. `flair controls` now also reads vector effects (`.svg`, or `.json` holding an `SvgMotion`): it lists their `{{control}}` declarations and what keeps them from drawing, exiting 1 until they are fixed.

## 0.93.0

### Minor Changes

- ccb6368: New effect: `led-net`, a picture shown through a net of tiny LEDs draped in folds like fabric. Each light glows with a star-filter cross, mostly in one cool tint with drifting rainbow patches, and dark parts of the picture switch the lights off so shapes read as silhouettes.
- 0e80eed: Two new light effects: `light-waves`, a glossy sheet of fine parallel ridges folding in slow waves with an iridescent sheen across the folds, and `light-strand-text`, tall letters filled with strands of light that follow the letters' edges, squeezing into corners and curving round counters, trail off the corners, and brighten and fade as light slides down them, with a few warm threads and a glow along the lower edges.
- 3c9b08d: New effect: `wireframe-reveal`, a picture first seen as a schematic wireframe on black (pale hatched panels, outlines and coloured circuit traces along their edges) that builds up to the real picture block by block behind a glitching front, then folds back. It has a still-frame progress control and can reveal from the top.

## 0.92.0

### Minor Changes

- c9301c5: More effects take a path. `border-beam` runs round any outline, `swoosh-underline` sweeps along any curve, and the pointer trails (`comet-trail`, `ribbon-trail`, `sparkle-trail`, `brush-trail`, `ghost-trail`, `light-painting`) follow a path while idle; each keeps its own shape until given one (`""` is no path). `signature` and `route` expose their path and fit their picture to it, and vector path controls take words (`{"text": …}`) in the editor too.
- b059356: Words as paths: `textPath(text, { font, size, align })` writes single-stroke handwriting (Hershey Script Simplex, joined up, or Simplex Roman) as SVG path data in pen order, smoothed into curves, refusing letters it cannot write with `textPathProblem`. Path controls take words in the editor's `values.set` as `{"text", "font"?, "align"?}`. New effect: `glass-writing`, words written on in one glowing glass stroke.
- 4f2dcd0: Shaders can draw along a path given at run time. A `sampler2D` marked `path` (`uniform sampler2D uPath; // @control path default="M …" fit=contain`) takes SVG path data, fitted into the frame, or points `[x0, y0, x1, y1, …]` in frame pixels; it is resampled (up to `MAX_PATH_POINTS`) into a small float texture that follows resizes, travels with standalone pages and exports, and is checked with a sentence saying what to pass. The catalog's `PATH` GLSL helpers (`pathNearest`, `pathAt`, `pathHits`, `pathLength`) read it, path controls report the `path` input, and their schema marks path data with `format: "svg-path"`. New effect: `glass-tube`, a see-through glowing tube that draws itself along any path, overlaps showing through each other.

## 0.91.0

### Minor Changes

- 359d859: Asset subjects and still stickers.

  - Scene layers and `mountEffect` take `{ asset: "provider:id" }` subjects, which the host's `resolveAsset(ref)` turns into `{ svg }` or `{ image }`. Pass it to `scenePlan`, `mountScene`, `recordScene`, `standaloneSceneHtml`, `mountEffect` and `applySceneTool` (its new fourth argument). `resolveSceneAssets`, `sceneAssets` and `resolveSubject` resolve ahead of time. An unresolved asset is reported (a plan note, an agent issue) and draws nothing. Without a resolver, the scene tools refuse edits that add assets.
  - New stickers: `sticker-cutout` (a shader that turns any artwork with transparency into a still die-cut sticker), and the still vector stickers `die-cut-sticker` (adds pill and bolt shapes), `sticker-label`, `speech-sticker` and `sticker-wrap` (any SVG path as a sticker).
  - New motion primitive `entrance.slap`: slaps an element down like a sticker.

## 0.90.0

### Minor Changes

- 106f65d: `flairEffects()` now offers Flair's sequence templates to `@pixerate/editor`'s editors (`capabilities.supportsTemplates`, used from editor 0.233). `listTemplates` and `describeTemplate` give the templates and their slots, shaped for a form. `instantiateTemplate` fills one and returns an `EffectSequence` of shots with framings, camera moves, catalog effect layers and transitions, naming in `notes` anything a sequence cannot carry.

## 0.89.0

### Minor Changes

- 239ba33: Sequence templates: reusable scenes with typed slots (`image`, `video`, `svg`, `text`, `color`, `number`, each with a label, a default and a range) that fill layer subject slots and `{{slot}}` placeholders. `instantiateTemplate` fills one into a `Scene` and refuses unknown slots, wrong types and out-of-range values with what each slot takes; `checkTemplate` checks a template of your own. The catalog has four (`product-reveal`, `before-after`, `stat-countdown`, `title-into-tour`) as `SCENE_TEMPLATES` in `@pixerate/flair/catalog`, loaded on demand by the root. Agents get `find_templates`, `describe_template` and `use_template` scene tools, and the CLI `flair template list | show | fill`.

## 0.88.0

### Minor Changes

- 1f1f610: **Breaking:** a scene's shots now arrange catalog effects as **layers**, in place of the 12 built-in scene effect types, which were validated but never drawn.

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

  | Before                                         | Now                                                                                          |
  | ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
  | `scene.media` + `{ type: "media", media: id }` | a layer `{ source, role: "background" }` on the shot that shows it                           |
  | `{ type: "glow" \| "burst" \| …, ids }`        | a catalog effect, e.g. `{ effect: "glow-ring-pulse", ids }` (`find_layer_effects` finds one) |
  | `stopEffects: [id]`                            | the layer's `until: { shots: n }` (or ms)                                                    |
  | rig target `media.<id>.<control>`              | `layers.<id>.<control>` (give the layer an `id`)                                             |
  | `standaloneSceneHtml(scene)`                   | `await standaloneSceneHtml(scene)`                                                           |
  | the `set_media` scene tool                     | `update_shot` with `layers`                                                                  |
  | `SceneBoard.setEffects` / `setMediaTime`       | `setLayers` / `setTransition`                                                                |
  | `ShotLog.effects`                              | `ShotLog.layers`                                                                             |

  Removed: `Effect` and its 12 types, `EFFECT_TYPES`, `EFFECT_FADE_MS`, `RunningEffect`, `effectGone`, `effectOpacity` and `SceneMedia`.

## 0.87.0

### Minor Changes

- 3c91b2f: Adds two camera effects. `camera-handheld` is a camera move a shot plays while it holds (`camera.during`): the camera drifts, sways and rolls round its framing as if held by hand, with `amount`, `speed`, `roll`, `footsteps`, `seed` and `motionBlur` controls and Subtle, Walking, Shaky cam and Found footage presets. It settles in from the framing it arrived at and zooms in just enough that the shake never shows past the framing's edges. `dolly-zoom` is a cinematic shader for pictures and video: the vertigo shot, the subject holding its size while the background behind it rushes in or falls away.

## 0.86.0

### Minor Changes

- 5b2ad55: `flairEffects()` now offers the catalog's camera moves to `@pixerate/editor`'s editors as `camera` effects (`capabilities.supportsCamera`). `cameraView` gives where a move puts a scene's camera part-way through it, exactly as Flair's scene player moves it, and `sampleCameraMove` keys it for an editor to bake. This needs `@pixerate/editor` 0.224 or later; with an older editor, pass `kinds: ["shader", "vector", "motion"]` to leave camera moves out.

  Fixes `camera-crash-zoom`, which gave the camera a NaN position before its first step (the first 300 ms of the hold by default).

## 0.85.0

### Minor Changes

- 413fd51: Camera moves are now catalog effects of their own kind (`kind: "camera"`, category `camera`): `camera-glide`, `camera-whip-pan`, `camera-punch-zoom` and `camera-cut` get the camera into a shot, and `camera-ken-burns` and `camera-crash-zoom` move it while the shot holds. Each has controls and presets. `findEffects({ kind: "camera", role })` finds them, and `mountEffect` and `recordEffect` preview one on a picture.

  Scenes play them through a shot camera's `in` and `during`, by id or as `{ move, ms?, preset?, values? }`. A move's length can now be set per shot; before, every move took 600 ms. The player, the standalone player and the Lottie, Apple Motion, FCP7 and EDL exporters all follow both moves. `validateScene` names an unknown move, a move in the wrong field and a bad value, and the new scene tool `find_camera_moves` lists the moves for agents.

  **Breaking:** a shot camera's `transition` and `motionBlur` are replaced, and `validateScene` says what to write instead:

  - `transition: "move" | "whip" | "zoom" | "cut"` becomes `in: "camera-glide" | "camera-whip-pan" | "camera-punch-zoom" | "camera-cut"`.
  - `motionBlur: n` becomes `in: { move, values: { motionBlur: n } }`. A punch zoom's depth is now its own `punch` control; it was 1 + motionBlur.

  `CameraTransition`, `CAMERA_TRANSITIONS`, `TRANSITION_BLUR`, `transitionStrength`, `transitionView`, `CAMERA_MS` and `cutsHalfway` are removed. `CameraShot` has `move`, `during` and `end` in place of `transition` and `motionBlur`, and `moveCut` replaces `cutsHalfway`. `@pixerate/flair/integrations` leaves camera moves out of the editor's effect provider, and the effect editor and Node `exportEffect` refuse them, saying where to use them.

## 0.84.0

### Minor Changes

- b9c02b2: Seven more `cinematic` effects:

  - `technicolor`: a three-strip (or two-strip) dye-transfer print, with saturated primaries, a warm print, slight misregistration between the colour records and an optional faded print.
  - `day-for-night`: a daylight picture graded into moonlit night. It is underexposed, desaturated and tinted moonlight blue. Highlights are dimmed most but keep their order, so a sun in the shot reads as a moon.
  - `academy-leader`: the 8-to-3 film-leader countdown with rings, crosshairs and a sweep each second. The 2 flashes for a frame, then the screen goes black. It loops over 7 s and can be worn with dust, scratches and flicker.
  - `cinema-projector`: a picture on a cinema screen in a dark auditorium, with a dusty projector beam, light spilling onto the curtains and a row of silhouetted heads.
  - `trailer-title-slam`: metal title letters slam down with a flash, a shake and a burst of dust, then a lens flare glints across them. It takes any text and can sit over video.
  - `opening-credits`: a vector effect showing one card at a time, a lead over a name, ending on the film's title. Cards are written as `Lead: Name; # Title`, and they can be centred or placed in a lower corner.
  - `transition-flare-wipe`: a transition where an anamorphic flare sweeps across and the next picture is left behind it.

## 0.83.0

### Minor Changes

- 45e306d: A new `cinematic` catalog category, browsed under Pictures, with a first batch of cinema looks:

  - `anamorphic-lens`: highlights throw long horizontal streaks and soft oval glows, and the frame bows a little at its sides.
  - `rack-focus`: focus racks between two points you place, with the rest of the picture in lens blur whose highlights open into discs (round or anamorphic oval) and slight lens breathing.
  - `bleach-bypass`: the silver-retention grade, with low saturation, hard contrast and crushed blacks.
  - `letterbox`: transparent bars framing any picture to a cinema aspect ratio, pillarboxed when the ratio is narrower than the frame. They can slide in and out.
  - `end-credits-roll`: a vector credits crawl. You write the credits as `Role: Name; # Heading; a line on its own`.

  There is also a `transition-focus-pull` transition: the first picture falls out of focus and the next is pulled sharp. All six are tagged `cinematic`.

## 0.82.0

### Minor Changes

- 3d5be3d: Agents can set a text mask's words. An image control that draws words from a `textImage` (a banner's or caption's `uText`) now takes `{ "text": "…", "font"?, "weight"? }` in the editor's `values.set` and `keyframe.set`. The words become a text image in the default's font and weight unless others are named. `effect.describe` marks these controls `textMask: true`, and `values.schema` describes both forms. Bare words for a text mask are now refused with what to pass instead: before, they were stored as an image path and the effect lost its words. A text image's URL, or a relative image path, still works.

## 0.81.0

### Minor Changes

- b3e462a: Six more "meme" effects: `needs-more-jpeg` (a picture recompressed step by step into 8 × 8 blocks, chroma bleed and mosquito noise, then snapping back clean), `triggered` (a red-tinted picture jittering fast, capped and without a strobe, with a banner bar of words), `vaporwave-grade` (a pink and cyan regrade with scanlines, a colour split, a striped sun over a rolling grid and a strip of glyphs), `galaxy-brain` (a glow from a head point climbing through four levels: halo, rays, nebula, starburst), `sad-mode` (a cool blue-grey drain with rain, a slow push-out and a heavy vignette) and `game-over-banner` (stuttering slow motion and a drain to grey, then serif words fading in on a dark band). Their words come from `textImage(...)` and are fitted to the ink, so any text fills its banner.

## 0.80.0

### Minor Changes

- 097fe89: Six more vector effects in the "meme" category: `stonks-chart` (a jagged line rocketing up, or crashing, to a fat arrow head with its value ticking up and a label), `error-cascade` (unbranded retro error dialogs popping up in a cascade or dragging a trail across the screen, with an editable title, message and button), `bonk` (a cartoon mallet swinging onto a point, the head squashing, an impact star and BONK popping), `hitmarker-montage` (hit markers landing at a list of points with a score floating off each and the frame jolting, the last in red), `reaction-rain` (live-stream reactions, any emoji or words, floating and wobbling up the side) and `wordart-text` (90s word art: a flowing rainbow fill, a skewed 3D extrude and a wave or arch). Each has an "Overlay" preset that drops the background for laying over a picture.

## 0.79.0

### Minor Changes

- 86d553c: A new "meme" catalog category, browsed under Pictures, with a first batch of six effects: `impact-caption` (outlined Impact top and bottom text, the punchline popping on a beat later), `deal-with-it` (pixel sunglasses sliding down onto a pair of eyes), `deep-fried` (blown-out colour, oversharpening, JPEG blocks and glints at the eyes), `dramatic-zoom` (a stepped crash zoom onto a point), `laser-eyes` (beams firing from two eye points) and `to-be-continued` (a sepia freeze frame with an arrow sliding in). Points on the picture are 0–1 across the frame, y up, and default to the sample portrait's face.

## 0.78.0

### Minor Changes

- 0c8f3a6: Add three more pixel effects to the catalog: `pixel-snake-loader` (a snake running laps round a phone-LCD board, eating its food, as a looping loader), `pixel-weather` (16 × 16 pixel-art weather icons: sun, partly cloudy, cloudy, rain, thunder and snow, each animated in steps) and `pixel-explosion` (an 8-bit fireball swelling into a ring of smoke with sparks flying out).

## 0.77.0

### Minor Changes

- d6ca2e3: Add ten pixel effects to the catalog. Image treatments: `image-pixel-sort` (glitch-art pixel sorting between two brightness thresholds), `image-led-wall` (a stadium LED board), `image-subpixel` (a macro zoom down to LCD stripes, PenTile diamonds or CRT phosphor triads) and `image-bricks` (a toy-brick, fuse-bead or cross-stitch mosaic built up row by row). Backgrounds: `pixel-sprites` (procedurally generated pixel creatures) and `pixel-city` (a night skyline in parallax). Transitions: `transition-screen-melt` (the classic shooter's screen melt) and `transition-pixel-staircase` (an 8-bit block wipe in diagonal, spiral, iris or random order). SVG: `rpg-dialog` (a game text box that types out its line) and `led-ticker` (a dot-matrix sign scrolling any text).

## 0.76.0

### Minor Changes

- 7a62a2e: A control's declared `min=` and `max=` are now limits. `checkControlValue` (and with it the editor's `values.set` and keyframes, document checks, the integrations and the CLI) refuses a number beyond them, saying what range the control takes, for example "uAmount takes a number from 0 to 1, not 3.". Before, such values were accepted silently.

  A control that declares no range keeps 0–1 (0–10 for `int`) as its slider range only, and still takes any number. `ControlDef.limits` holds the declared ends. `renderVectorEffect` still draws whatever it is given.

## 0.75.0

### Minor Changes

- 67989be: A new `beauty` catalog category, browsed under Pictures. It holds retouching and make-up for a portrait or a live face: `beauty-skin-smooth`, `beauty-dewy-glow`, `beauty-soft-focus`, `beauty-brighten` (eyes and teeth), `beauty-lip-tint`, `beauty-blush`, `beauty-eyeshadow` and `beauty-highlighter`. It also holds beauty-ad graphics: `beauty-retouch-reveal`, `beauty-product-shine`, and the vector `lipstick-swipe` and `swatch-reveal`.

  Each shader works as a live video filter on a region you place by hand, defaulting to the sample face, since Flair has no face tracking. The effects keep to skin by its colour. Make-up takes a shade's hue but keeps the picture's own lightness, so texture shows through.

  The censor effects now share their region helpers through `src/catalog/shaders/region.ts`, and their output is unchanged.

## 0.74.1

### Patch Changes

- 7d87d58: `hologram` now projects icons and cut-outs on a clear backdrop. It used to take its key colour from the picture's corners even when they were transparent (read as black), so it keyed away dark shapes, and it gave dark shapes almost no light; a black icon all but disappeared. The key colour now comes only from opaque corners (a picture with clear corners has no background to remove), and a cut-out's dark parts still give some light. Pictures with an opaque background render exactly as before.

## 0.74.0

### Minor Changes

- 1991ec2: The last of the horror additions, in the loader, interaction and icon categories, all tagged `horror`. Loaders: `coffin-loader` (a lid creaking open on eyes in the dark and slamming shut), `candle-burndown` (a candle burning down and blowing out), `ghost-loader` (a ghost floating round in a circle) and `skeleton-hand-loader` (bony fingers drumming on a table). Interactions: `cursor-follow-eyes` (eyes that follow the pointer, narrowing as it comes near; a transparent overlay), `mirror-mismatch` (a reflection that follows the pointer half a second late and sometimes does its own thing) and `haunted-hover` (a button that flinches away on hover). Icons: `jack-o-lantern`, `bat-flap` and `skull-chatter`.

## 0.73.0

### Minor Changes

- 0bcc656: Horror additions to the transition and text categories, all tagged `horror`. Five transitions, which like the others loop back and forth or follow Progress: `transition-claw-slash` (claw marks tearing open to the next picture), `transition-blood-wipe` (a curtain of blood pouring down and draining away), `transition-shadow-swallow` (darkness swallowing one picture and giving back the next), `transition-static-cut` (the signal breaking into static and tuning back in) and `transition-film-burn` (the film burning through to the next picture). Five text effects, which take any font and sit inline like the other text effects: `zalgo-text` (combining marks creeping over a title and overrunning it), `fogged-mirror-writing` (words traced on a fogged mirror, then fogging over), `scratched-text` (words gouged into a surface), `ransom-note` (letters cut from magazines, a different face for each unless a font is set) and `carved-pumpkin-text` (letters carved in a pumpkin lit from inside by a flickering candle).

## 0.72.0

### Minor Changes

- 6028c44: Eight more `horror` effects: jump scares (tagged `shock`) and stylised gore (tagged `gore`). `scare-cut` (a sudden cut to a face with a zoom punch and a shake), `subliminal-flicker` (a single hidden frame now and then), `failing-light` (a fluorescent tube stuttering out over a picture) and `heartbeat-vignette` (a red pulse at the edges quickening as the pointer nears a target) are kept below seizure thresholds: none can be set to flash more than three times a second, and the heartbeat stops at 120 beats a minute. Then `blood-drip-border` (a transparent band of blood dripping from the top of the frame), the SVG `bleeding-text` (blood seeping through a title and dripping from it), `claw-slash` (claw marks tearing through a picture) and `blood-moon` (a crimson moon over dark hills).

## 0.71.0

### Minor Changes

- 968c662: Eight more `horror` effects: the last of the creatures, a poltergeist, and the occult. `tentacles` (curling up out of the dark and reaching for the pointer), `bat-swarm` (bats wheeling across a dusk sky past the moon, scattering from the pointer), `passing-silhouette` (a tall figure walking once across a picture), the SVG `poltergeist` (an app's card, button, avatar and toggle lifting, wobbling and slamming back down), `summoning-circle` (a sigil drawing itself and flaring), the SVG text `rune-glow` (carved letters lighting up in turn, inline-capable), `cauldron` (a bubbling green brew under curling steam) and `candle-ring` (candles that gutter out all at once and relight round the ring). The occult ones are tagged `occult`.

## 0.70.0

### Minor Changes

- 0ea9234: Six decay effects in the `horror` category, tagged `decay`: `rust-spread` (rust breaking out and eating across a picture), `mold-bloom` (fuzzy mould colonies blooming across it), `wither` (a picture draining, cracking and caving in), `peeling-wallpaper` (a picture peeling back like wallpaper from a grimy picture underneath), `aged-photo` (sepia, foxing, silvering, creases and worn edges) and `film-burn` (projected film stalling, blistering and burning open). The growing ones loop over their cycle, or hold a moment with Animate off.

## 0.69.0

### Minor Changes

- 15d1a82: Six more `horror` effects, rounding out analog horror and the spectral and starting on creatures: `trail-cam` (an infrared trail camera's stills, date-stamped, with a figure closer in every shot), the SVG `emergency-broadcast` (a fictional "do not look outside" alert card switching on like an old set), `ectoplasm-wisps` (glowing trails spiralling in to the pointer), `spirit-orbs` (pale orbs drifting over a picture and darting off), `creeping-dark` (darkness with tendril edges closing in and recoiling from the pointer) and `shadow-hands` (the shadows of long-fingered hands reaching in from the edges).

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
