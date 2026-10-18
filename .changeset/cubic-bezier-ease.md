---
"@pixerate/flair": minor
---

Vector motion takes any cubic-bezier easing: `SvgAnimation.ease` (and `stepProgress`, `stepData`, `animateCount`) accept `[x1, y1, x2, y2]` besides `linear`, `out` and `in-out`, with overshoot for back eases. `svgMotionIssues` checks the curve, and `svgAnimatedMarkup` writes it as an exact SMIL `keySplines` curve (sampled when it overshoots, which SMIL cannot spline). New exports: `SvgEase`, `CubicBezier`, `cubicBezierEase`, `easeFunction`, `isCubicBezier`, `isSvgEase`. Animations exported from `@pixerate/editor`'s animation editor can use their own curves instead of being sampled into linear steps.
