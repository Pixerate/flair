---
"@pixerate/flair": minor
---

New `@pixerate/flair/svelte` entry point, with `svelte` (>= 5) as an optional peer dependency (its types only; nothing to compile):

- `use:vectorEffect={{ id: "drip-text", values: { word: "Slop" }, loop: false }}` plays a catalog vector effect (or `{ motion }`, any `SvgMotion`) in an element: it makes an `SvgPlayer` on mount, remakes it when the params change (values by content, `speed` without remaking) and disposes it on destroy. Works as an attachment through `fromAction`.
- `vectorEffectStill(params)` returns `{ markup, style }` for server rendering: `<span use:vectorEffect={params} style={still.style}>{@html still.markup}</span>` shows the last frame, sized from the viewBox, until the player takes over. The still stays under `prefers-reduced-motion` (`reducedMotion` overrides).
- Sized like the React components: a block with the viewBox's aspect ratio, or with `inline` (or an effect's `inline` control) an `inline-block` 0.72em high.
