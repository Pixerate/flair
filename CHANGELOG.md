# @pixerate/flair

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
