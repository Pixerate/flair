---
"@pixerate/flair": patch
---

`ThumbnailPool` compiles at most one new thumbnail shader per frame, so a row of thumbnails scrolling into view no longer stalls a single frame.
