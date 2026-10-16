---
"@pixerate/flair": minor
---

Pair any catalog effect with a picture, video, SVG, words or path, put it on a page, and record or export it.

- `@pixerate/flair/embed` (new entry): `mountEffect(host, effect, { subject })` runs a shader or vector effect applied to `{ image }`, `{ video }`, `{ svg }` (markup or URL), `{ text }` or `{ path }`, putting it in the right control (from `effectInputs`) and explaining in a sentence when the effect can't take it; `subjectValues` gives the values without mounting. `recordEffect(effect, { subject, format })` records MP4 (H.264), WebM (VP9, with transparency), GIF or a ZIP of PNG frames in the browser with WebCodecs, frame-exact, with no new dependencies (small MP4, WebM and ZIP writers are included).
- React `<FlairEffect>` and the Svelte `flairEffect` action run any catalog effect, shader or vector, applied to a subject.
- `svgAnimatedMarkup(motion)` (in `/vector`) writes a vector effect as one self-contained animated `.svg` file (SMIL), exact for eases, draw-on, motion along paths and view zooms, with written text and counts switched in steps.
