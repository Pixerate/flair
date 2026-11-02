# Choosing an entry point

Install: `npm install @pixerate/flair` (React and Svelte are optional peers, used only by their entry points).

| Import | For | Runs in |
| --- | --- | --- |
| `@pixerate/flair/react` | `<FlairEffect>` (any effect on a subject), `<VectorEffect>` (vector effects, server-rendered as a still) | Browser, SSR-safe |
| `@pixerate/flair/svelte` | `flairEffect` and `vectorEffect` actions, `vectorEffectStill` for SSR | Browser, SSR-safe |
| `@pixerate/flair/embed` | `mountEffect`, `recordEffect`, `mountScene`, `recordScene` | Browser |
| `@pixerate/flair/catalog` | `EFFECTS`, `getEffect`, `findEffects`, `effectInputs`, `effectDefaults`, `effectControlSchema`, `renderVectorEffect`, `textImage` | Browser or Node |
| `@pixerate/flair/catalog/lazy` | `EFFECT_META`, `findEffectMeta`, `getEffectMeta`, `loadEffect`: metadata up front, each effect's source on demand | Browser or Node |
| `@pixerate/flair` | The engine: `ShaderRenderer`, `ShaderFrames`, `SvgPlayer`, scenes (`validateScene`, `simulateScene`) | Browser or Node |
| `@pixerate/flair/vector` | `SvgPlayer`, `svgFrameMarkup` (a still as markup), `svgAnimatedMarkup` (a self-playing `.svg`) | Browser or Node |
| `@pixerate/flair/motion` | Motion primitives: `PRIMITIVES`, `applyPrimitive`, `removePrimitive` | Browser or Node |
| `@pixerate/flair/testing` | `installFakeWebGl` for unit tests without a GPU | Tests |
| `@pixerate/flair/node` | `exportEffect`, `exportMotionGraphic`: render to MP4, WebM, MOV, GIF, PNG or SVG with headless Chrome | Node only |

Every entry point except `/node` is browser-safe. Never import `/node` into browser code.

## React

```tsx
import { FlairEffect, VectorEffect } from "@pixerate/flair/react";

export function Hero() {
  return (
    <section>
      <FlairEffect effect="aurora" preset="Ember" style={{ height: 480 }} />
      <FlairEffect effect="image-duotone" subject={{ image: "/team.jpg" }} preset="Spotify" style={{ aspectRatio: "16 / 9" }} />
      <h1>
        Stop the <VectorEffect id="drip-text" values={{ word: "Slop", inline: true, font: "inherit" }} loop={false} />
      </h1>
    </section>
  );
}
```

- `<FlairEffect>` takes `effect` (an id or a definition), `subject`, `preset`, `values`, `autoplay`, `pauseWhenHidden` and any `<div>` attribute. It fills its element and renders nothing on the server, so give it a size with CSS.
- Words for a text effect: `subject={{ text: "…" }}` on `<FlairEffect>` puts them in the right control; with `values`, use the control the index line names ("Words go in `word`").
- `<VectorEffect>` (vector effects only) takes `id`, `values`, `preset`, player options (`loop`, `autoplay`, `speed`, `hold`, `trigger`), `poster`, `reducedMotion`, `inline`, `contain` and any `<span>` attribute. It renders a still on the server and plays after hydration; it respects `prefers-reduced-motion`. With `inline` it sits in a line of text.
- In Next.js and other SSR frameworks both are safe to render on the server; mark the file `"use client"` where the framework needs it.

## Svelte

```svelte
<script>
  import { flairEffect } from "@pixerate/flair/svelte";
</script>

<div use:flairEffect={{ effect: "typewriter", subject: { text: "Hello there" } }} style="aspect-ratio: 16 / 9"></div>
```

## Plain DOM

```ts
import { mountEffect } from "@pixerate/flair/embed";

const m = mountEffect(el, "image-duotone", { subject: { image: "/team.jpg" }, preset: "Spotify" });
m.setValues({ uSpeed: 2 });
m.dispose(); // when the element goes
```

A subject is one of `{ image }` (a URL), `{ video }` (a playing `<video>`), `{ svg }` (markup or a URL), `{ text }`, `{ path }` (SVG path data) or `{ audio }`; transitions take two: `[{ image: a }, { image: b }]`. `mountEffect` throws a sentence when the effect cannot take the subject; check with `effectInputs(effect).accepts` first.

## Bundle size

`/react`, `/svelte`, `/embed` and `/catalog` carry the whole catalog (several hundred KB gzipped), because they look effects up by id. Where effects are only listed or searched (pickers, agent tools), or a page draws a few shaders, use the lazy catalog and the engine instead:

```ts
import { findEffectMeta, loadEffect } from "@pixerate/flair/catalog/lazy";
import { ShaderRenderer } from "@pixerate/flair";

const filters = findEffectMeta({ video: ["filter"] }); // same queries as findEffects
const aurora = await loadEffect("aurora");
if (aurora.kind === "shader") {
  const renderer = new ShaderRenderer(el, { alpha: !!aurora.transparent });
  renderer.setSource(aurora.source); // defaults come from the source
  renderer.setValues(aurora.presets?.find((p) => p.name === "Ember")?.values ?? {});
}
```

## Files: video, GIF, PNG, SVG

- Browser: `recordEffect("image-duotone", { subject: { image: "/team.jpg" }, format: "mp4" })` from `@pixerate/flair/embed` resolves to a `Blob` (`mp4`, `webm`, `gif`, or `png` frames in a ZIP).
- Node: `exportEffect("image-duotone", { subject: { image: "team.jpg" }, outputPath: "team.mp4" })` from `@pixerate/flair/node`, or the CLI:

```bash
npx flair render image-duotone --image team.jpg --preset Spotify -o team.mp4
npx flair render typewriter --text "Hello" -o hello.gif
npx flair render toggle-switch -o toggle.svg
```

Node rendering needs Chrome (found in the usual places, or at `CHROME_PATH`) and, for video, ffmpeg (on the `PATH` or at `FFMPEG_PATH`). Vector effects to `.svg` need neither.
