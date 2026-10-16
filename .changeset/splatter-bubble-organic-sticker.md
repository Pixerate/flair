---
"@pixerate/flair": minor
---

Catalog: 30 new effects, and SVG ids that never clash between pictures.

- **splatter** (new): paint splatter and goo splat (also landing at clicks), ink splash, splash crown, paint roller (a transition, video-ready), water splash, and a vector splat stamp.
- **bubble** (new): soap bubbles (thin-film colour, popping at clicks), underwater bubbles over a picture or video, fizz, foam, bubble wrap (click to pop), lava bubbles, and vector chat bubble and bubble-pop loader.
- **organic**: reaction diffusion, cell division, coral growth, veins, ferrofluid (follows the pointer), jellyfish and fur.
- **sticker** (new): holographic foil sticker (any shape, tilting with the pointer) and a sticker-peel transition, and vector sticker slap (click), sticker peel (hover), holo sticker, sticker sheet, stamp badge (click) and washi tape.
- Live SVG views (`svgView`, `SvgPlayer`, and the React and Svelte components) now give the ids a picture refers to — gradients, filters, clips, masks, `<use>`d shapes — a suffix unique on the page, and point `url(#…)` and `href="#…"` at them, so two pictures defining the same id no longer borrow each other's. Other ids stay as written; `onPick` still reports ids as written.
