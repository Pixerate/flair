---
"@pixerate/flair": patch
---

`relief-hex-ink` (and, less visibly, `relief-hex-tiles`) no longer splits tiles. A tile could show a thin vertical groove, or be half black and half white, along a line that shifted as the tiles rose and fell. Per-tile randomness is now keyed on a whole-number tile id (a tile's centre came out a hair different either side of the grid's internal seams), and whether a tile is inked is judged at its centre. Ink tiles also shade by height, so black tiles are seen rising and falling too.
