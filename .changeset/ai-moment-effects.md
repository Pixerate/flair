---
"@pixerate/flair": minor
---

New effects for AI product moments, and neubrutalist style controls (#229):

- Shaders: `denoise-reveal` (a generated picture resolving out of diffusion noise), `generating-field` (an ambient loader over a card, with Image/Video/Audio/Text/Vector presets and a bound `value`), `agent-working-border` (a calm beam per agent round a region), `change-pulse` (a one-shot highlight by tone: create, update, remove), `card-complete-burst` (a small burst on a card's edge) and `dragover-attract` (a drop zone pulled toward the pointer, rippling where the item lands).
- Vector: `slop-vat` (a stroked vat filling to a bound `value`), `goo-drop-reveal` (a flat blob that drops, splats and wipes away) and `memphis-burst` (Memphis shapes springing out with hard shadows).
- Shared style controls (`shadowStyle`, `shadowOffset`, `inkWidth`, `inkColor`, `sheen`) on the still stickers, `press-button` and the new vector effects; `styleControls`, `styleDerived` and `neubrutalValues` are exported from `/catalog`.
- A "Neubrutal" preset across the sticker, comic, splatter, icon and loader effects (ink `#09090b`, pink, cyan, yellow, purple, 8 px zero-blur shadow).
