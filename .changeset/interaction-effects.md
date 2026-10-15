---
"@pixerate/flair": minor
---

Interaction: pointer uniforms, `SvgPlayer` triggers and 21 interaction effects.

- Shaders get two new built-ins: `iPointer` (xy while over the canvas, eased hover amount, seconds held or minus seconds since release) and `iClicks[8]` (the latest clicks: xy, `iTime` of the click, 1). `ShaderRenderer`, standalone pages and hovered `ThumbnailPool` thumbnails feed them; `ShaderFrames.render` takes `pointer` and `clicks` for scripted recordings. `PointerTracker`, `clicksUniform`, `MAX_CLICKS` and `HOVER_SECONDS` are exported.
- `SvgPlayer` takes `trigger: "hover" | "press" | "click"` (and `triggerTarget`): hover and press play forward while active and back after; click plays the next step on each click, wrapping round. `setActive(on)` and `advance()` let hosts drive it. Vector effects declare `trigger`.
- **interaction** (new category): click ripple, click burst, cursor glow, hover liquid, X-ray reveal, magnifier, holo card, press charge and hover swap shaders (each with an idle demo), and like button, toggle switch, checkbox, menu toggle, bookmark, copy, send and download buttons, link hover, button hover fill, tooltip pop and press button vector effects.
