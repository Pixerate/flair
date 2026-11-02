---
name: flair-use
description: Use when writing app code with @pixerate/flair - finding a catalog effect (backgrounds, image filters, text animations, transitions, loaders, overlays, camera moves) and putting it on a page, in React or Svelte, in a scene or a recording, setting its controls and presets, and checking the result. For writing a new shader or vector effect, use flair-author.
---

# Using Flair

`@pixerate/flair` is a catalog of 600+ ready-made web effects (WebGL2 shaders and animated SVGs), plus the engine that runs them. Most tasks are: find an effect, pick an entry point, give it a subject and values, check it.

## 1. Find an effect

Never guess an id. Ids, preset names and control names are plain strings to TypeScript, so `tsc` passes with a wrong one and the page quietly shows the default or nothing. Search, then confirm:

- **The index** in [references/effects/](references/effects/): one file per group, every effect as one line (id, kind, what it looks like, what it takes, presets, tags). Grep it: `grep -ri "neon" references/effects/`.
  - Backgrounds: [backgrounds.md](references/effects/backgrounds.md) · Light: [light.md](references/effects/light.md) · Pictures: [pictures.md](references/effects/pictures.md) · Particles & FX: [particles-fx.md](references/effects/particles-fx.md) · Type & titles: [type-titles.md](references/effects/type-titles.md) · Inputs (pointer, audio, scroll): [inputs.md](references/effects/inputs.md) · Interface: [interface.md](references/effects/interface.md) · Loaders: [loaders.md](references/effects/loaders.md) · Transitions: [transitions.md](references/effects/transitions.md) · Camera: [camera.md](references/effects/camera.md)
- **The CLI**, in the project: `npx flair effects --search glow --accepts image` (also `--category`, `--kind`, `--tag`, `--interaction`, `--transparent`, `--json`); `npx flair tags --category fire` lists tags to narrow by.
- **In code**: `findEffects({ text: "glow", accepts: ["image"] })` from `@pixerate/flair/catalog`, or `findEffectMeta(...)` from `@pixerate/flair/catalog/lazy` (same queries, metadata only).

Confirm with a command that fails when it is wrong: `npx flair render <id> --preset <name> --duration 0.1 -o check/` exits 1 naming the presets there are (add `--text "…"`, `--image …` for the subject).

What an effect takes matters: `effectInputs(effect)` (or the index line) says whether it wants an `image`, `video`, `svg`, `text`, `mask`, `path` or `audio`, and whether it is an overlay (draws over what is under it).

## 2. Put it on a page

| Need | Use | Reference |
| --- | --- | --- |
| React | `<FlairEffect effect="…" subject={…} />` from `@pixerate/flair/react` | [entry-points.md](references/entry-points.md) |
| Svelte | `use:flairEffect` from `@pixerate/flair/svelte` | [entry-points.md](references/entry-points.md) |
| Plain DOM, any framework | `mountEffect(el, id, { subject })` from `@pixerate/flair/embed` | [entry-points.md](references/entry-points.md) |
| Only list or search effects, load few (bundle size) | `@pixerate/flair/catalog/lazy` | [entry-points.md](references/entry-points.md) |
| A video, GIF or PNG frames | `recordEffect` (browser) or `npx flair render` / `exportEffect` (Node) | [entry-points.md](references/entry-points.md) |
| Several shots with layers, transitions and camera moves | a scene | [scenes.md](references/scenes.md) |

The effect fills its element: size the element with CSS (an `aspect-ratio`, a height).

## 3. Set controls and presets

Pass `preset` (a name from the index line) and `values` (control name → value). `effectControlSchema(id)` gives the controls' JSON Schema. A renderer quietly falls back to the default for a value it cannot use (a misspelt name, a wrong type), so check names and values against the schema rather than by eye. See [controls-and-presets.md](references/controls-and-presets.md), which also covers camera moves and motion primitives.

## 4. Check the work

Every change ends with a check. See [checking.md](references/checking.md):

- Unit tests run Flair without a GPU through `installFakeWebGl()` from `@pixerate/flair/testing`.
- `npx flair render <id> … -o check.png` renders an effect headlessly, to look at the frames.
- `npx flair scene validate <file>` and `npx flair scene review <file>` check a scene.

## Rules

- Browser code imports only browser-safe entry points; `@pixerate/flair/node` (rendering with headless Chrome) is for Node scripts and servers.
- Image URLs from another origin need CORS; videos need `crossOrigin = "anonymous"`.
- Writing a new effect (GLSL or animated SVG): use the flair-author skill.
