---
"@pixerate/flair": minor
---

Vector motion timing: an `SvgAnimation` can now `repeat` whole cycles (taking `ms × repeat`), `alternate` every other cycle backwards, hold its time on a `strobe` grid of frames a second, and take a spring ease, `{spring: {mass?, stiffness?, damping?, velocity?}}`, that matches `@pixerate/editor`'s `springAt` exactly (`springProgress`, `springSettleMs`). `svgFrame`, `svgDuration`, `SvgPlayer` and `svgAnimatedMarkup` play them, `svgMotionIssues` checks them, and emphasis primitives take `repeat` and `alternate`. A new test checks every primitive the animation editor shares against Flair's.
