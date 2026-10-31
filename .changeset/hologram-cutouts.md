---
"@pixerate/flair": patch
---

`hologram` now projects icons and cut-outs on a clear backdrop. It used to take its key colour from the picture's corners even when they were transparent (read as black), so it keyed away dark shapes, and it gave dark shapes almost no light; a black icon all but disappeared. The key colour now comes only from opaque corners (a picture with clear corners has no background to remove), and a cut-out's dark parts still give some light. Pictures with an opaque background render exactly as before.
