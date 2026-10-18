---
"@pixerate/flair": minor
---

Motion primitives: a new `@pixerate/flair/motion` entry point with 23 reusable entrances, exits, emphasis and path motions (fade, pop, grow, slide, wipe, iris, split, zoom, rise, draw; fade, shrink, slide, wipe and undraw out; pulse, shake, teeter, wave, colour pulse, spin and a seeded wiggle; follow a path) that work on any element of an `SvgMotion`. Each is a JSON descriptor (`PRIMITIVES`) with labelled params, defaults and ranges; `applyPrimitive` expands one into plain `SvgAnimation`s (adding a wrapper group or clip path where needed), all or nothing, and `removePrimitive` takes it off. Defaults match `@pixerate/editor`'s animation editor.

`SvgAnimation` gains `behavior` (pulse, oscillate, wriggle and overshoot, still pure functions of time), `orient` (turn with the path `along` follows) and `tag` (which primitive use added a change). The effect editor adds the `primitive.list`, `primitive.describe`, `primitive.apply`, `primitive.applied` and `primitive.remove` commands, each one undo step, and the agent instructions say when to use them.
