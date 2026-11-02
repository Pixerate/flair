---
"@pixerate/flair": minor
---

Words as paths: `textPath(text, { font, size, align })` writes single-stroke handwriting (Hershey Script Simplex, joined up, or Simplex Roman) as SVG path data in pen order, smoothed into curves, refusing letters it cannot write with `textPathProblem`. Path controls take words in the editor's `values.set` as `{"text", "font"?, "align"?}`. New effect: `glass-writing`, words written on in one glowing glass stroke.
