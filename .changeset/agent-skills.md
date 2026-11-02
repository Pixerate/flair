---
"@pixerate/flair": minor
---

Agent skills for coding agents writing code that uses Flair: `flair-use` (finding an effect from a generated index of the whole catalog, choosing an entry point, controls, presets, camera moves, scenes and checking the result) and `flair-author` (custom shader and vector effects). They ship in the package's `skills/` folder; `npx flair skills install [--dir .claude/skills] [--skill <name>]` copies them into a project (`installSkills` from `@pixerate/flair/node`), and `flair skills list` lists them. `flair controls` now also reads vector effects (`.svg`, or `.json` holding an `SvgMotion`): it lists their `{{control}}` declarations and what keeps them from drawing, exiting 1 until they are fixed.
