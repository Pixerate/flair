---
name: flair-author
description: Use when writing a custom effect for @pixerate/flair - a WebGL2 shader (GLSL with a Shadertoy-style mainImage and // @control uniforms) or an animated vector effect (an SVG with {{control}} placeholders and timed changes) - and checking it with `flair controls`. To use an existing catalog effect instead, use flair-use; check the catalog first, since 600+ effects may already do it.
---

# Authoring Flair effects

A Flair effect is one of two kinds. Pick by what it draws:

- **Shader** (GLSL ES 3.00 fragment shader): per-pixel looks: backgrounds, image filters, glows, distortions, particles. See [references/shader.md](references/shader.md).
- **Vector** (an animated SVG): crisp shapes and text that move: titles, icons, loaders, charts, lower thirds. Small, resolution-independent, and exportable as a self-playing `.svg`. See [references/vector.md](references/vector.md).

Before writing one, search the catalog (`npx flair effects --search <words>`): a preset or a few values on an existing effect is often enough.

## The rules

- **The source is the single source of truth.** Every value a person or an agent may change is a declared control: `// @control` on a shader uniform, `{{name: type …}}` in a vector picture. Defaults live in the declaration.
- **Self-contained.** A shader inlines every helper it uses (no `#include`); a vector picture has no scripts, no outside links, and no `<animate>` of its own.
- **Presets use only declared controls.** A preset is `{ name, values }` whose keys are control names.
- **Errors keep your line numbers.** Compile errors point at lines of your own source (the wrapper compiles it after `#line 1`), so fix the line the error names.

## The check loop

1. Write the source to a file: `effect.frag` for a shader, `effect.svg` (or `effect.json` holding `{ "svg": …, "animate": [ … ] }`) for a vector effect.
2. Run `npx flair controls <file>`: it lists the parsed controls (name, type, label, default, range). For a vector file it also lists what keeps the picture from drawing and exits 1 until it is fixed. Every control you meant to declare must be there, with the default you meant.
3. Compile and look:
   - Shader: `npx flair export effect.frag -o check/ -d 0.1` renders PNG frames in headless Chrome and fails with the compiler's message (`ERROR: 0:<line>: …`, the line in your file) when it does not compile. In a page, `renderer.setSource(source)` returns `{ ok, errors: [{ line, message }] }`.
   - Vector: render it in a page with `SvgPlayer`, or write a self-playing file with `svgAnimatedMarkup` and open it.
4. Use it: `mountEffect(el, effect)` or `<FlairEffect effect={effect} />` take your own definition as well as a catalog id (see the flair-use skill).
