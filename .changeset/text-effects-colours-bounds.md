---
"@pixerate/flair": minor
---

Text effects suit headlines of any length and any theme:

- **Colours**: colour controls take CSS colours, through `effectDefaults` and the React and Svelte wrappers too. Before, `effectDefaults` silently replaced colour strings with defaults. Hex can be `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`, and `rgb()`/`rgba()` and `hsl()`/`hsla()` work too (see the new `parseColor`). Vector effects also take `currentColor` to follow the surrounding text colour, and colours mixed from it use CSS `color-mix`.
- **Long text**: inline text effects keep their full size and the picture gets wider, so long phrases are no longer shrunk. Drip text no longer squashes long words at any size: it scales the whole word down on its own stage and widens inline. Its drips now repeat along the word instead of crowding the middle.
- **Overhang**: text effects write `data-overhang="top right bottom left"` (ems) on their `<svg>`, saying how far they reach past their inline box. The new `svgInlineLayout(svg)` in `/vector` reads it with the aspect ratio. In React and Svelte, `contain` turns it into a margin.
- **Plays when seen**: in React and Svelte, an effect that plays once (`loop: false`, no trigger) now waits until it is scrolled into view by default. `playOnEnter: false` starts it at mount. `SvgPlayer`'s `playOnEnter` now plays at once where there is no `IntersectionObserver`.
