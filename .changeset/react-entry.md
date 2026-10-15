---
"@pixerate/flair": minor
---

New `@pixerate/flair/react` entry point, with `react` (>= 18) as an optional peer dependency:

- `<VectorEffect id="drip-text" values={{ word: "Slop" }} loop={false} />` plays a catalog vector effect; `<SvgPlayerView motion={...} />` plays any `SvgMotion`. Each makes an `SvgPlayer` after mount and disposes it on unmount.
- Server-renders a still of the last frame, sized from the viewBox, so hydration neither shifts the layout nor flashes blank. The still stays under `prefers-reduced-motion` (`reducedMotion` overrides).
- `inline` (or an effect's `inline` control, like drip text's) sizes it as a word in a line: `inline-block`, 0.72em high, with the viewBox's aspect ratio.

`@pixerate/flair/vector` adds `svgFrameMarkup(motion, { at })`, a frame as safe `<svg>` markup with no DOM (for server rendering and reduced motion), and `svgViewBox` / `parseViewBox`.
