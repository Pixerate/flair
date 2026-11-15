---
"@pixerate/flair": patch
---

Text treatments: `ribbon-curl`'s ribbon and sparkles now show in the scripted preview (`previewTextTreatment`, and `mountEffect` for a treatment), which played the landing without a caret. A preview mounted paused (`autoplay: false`) now animates once played, and stages also finish on a timer so `finished` settles in background tabs. `shimmer` is now a loading skeleton (words on rounded pills with a glint streaking across twice), distinct from `soft-sweep`, with Slate, Violet and Dark theme presets. The docs modal shows text treatments on paper, or on a dark page for dark-theme presets.
