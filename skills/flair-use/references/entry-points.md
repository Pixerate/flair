# Choosing an entry point

Install: `npm install @pixerate/flair` (React and Svelte are optional peers, used only by their entry points).

| Import | For | Runs in |
| --- | --- | --- |
| `@pixerate/flair/react` | `<FlairEffect>` (any effect on a subject), `<VectorEffect>` (vector effects, server-rendered as a still), `useFlairMoment()` | Browser, SSR-safe |
| `@pixerate/flair/svelte` | `flairEffect`, `flairMoment` and `vectorEffect` actions, `vectorEffectStill` for SSR | Browser, SSR-safe |
| `@pixerate/flair/embed` | `mountEffect`, `playMoment`, `recordEffect`, `mountScene`, `recordScene` | Browser |
| `@pixerate/flair/react/lazy`, `/svelte/lazy`, `/embed/lazy` | The same components, actions, `mountEffect` and `playMoment`, loading effects by id one by one (see Bundle size) | Browser |
| `@pixerate/flair/catalog` | `EFFECTS`, `getEffect`, `findEffects`, `effectInputs`, `effectDefaults`, `effectControlSchema`, `renderVectorEffect`, `textImage` | Browser or Node |
| `@pixerate/flair/catalog/lazy` | `EFFECT_META`, `findEffectMeta`, `getEffectMeta`, `loadEffect`: metadata up front, each effect's source on demand | Browser or Node |
| `@pixerate/flair` | The engine: `ShaderRenderer`, `ShaderFrames`, `SvgPlayer`, scenes (`validateScene`, `simulateScene`) | Browser or Node |
| `@pixerate/flair/vector` | `SvgPlayer`, `svgFrameMarkup` (a still as markup), `svgAnimatedMarkup` (a self-playing `.svg`) | Browser or Node |
| `@pixerate/flair/motion` | Motion primitives: `PRIMITIVES`, `applyPrimitive`, `removePrimitive` | Browser or Node |
| `@pixerate/flair/testing` | `installFakeWebGl` for unit tests without a GPU | Tests |
| `@pixerate/flair/node` | `exportEffect`, `exportMotionGraphic`, `compileShaderToMetal`, `exportMetalPackage`: render with headless Chrome or transpile shaders to Metal + Swift | Node only |

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

- `<FlairEffect>` takes `effect` (an id or a definition), `subject`, `preset`, `values`, `autoplay`, `pauseWhenHidden`, `reducedMotion`, `onError` and any `<div>` attribute. It fills its element and renders nothing on the server, so give it a size with CSS.
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

## Reduced motion

Every effect respects `prefers-reduced-motion` by default (`reducedMotion: "user"`): a shader holds one rest frame (its `rest` time; a one-shot driven by `uProgress` shows its end), a vector effect its last frame, a UI component its rest state. Pass `reducedMotion: "never"` for editors and previews that must move, `"always"` to force the still. `new ShaderRenderer(el, { reducedMotion, restTime })` does the same for the engine.

## Moments: an effect played once over an element

For product moments (a result arriving, a change landing, a task done), play an effect once over an element; it lays a transparent overlay over it that lets the pointer through, follows it as the page scrolls, and removes itself (canvas, GL context and all) when done:

```ts
import { playMoment } from "@pixerate/flair/embed";

const played = await playMoment(card, "success-check", { outset: 24 }); // or "viewport"
```

It plays nothing and settles `false` under reduced motion, without WebGL2 for a shader, when the element is off the page or `signal` aborts, so keep a CSS fallback. React: `useFlairMoment()` returns a function that plays a moment over a ref (and stops on unmount). Svelte: `use:flairMoment={{ effect: id, key: item.updatedAt }}` plays each time `key` changes (on mount without a `key`).

## Montages: a list of media

Effects in the `montage` category (`findEffects({ accepts: ["items"] })`) take a list rather than one subject: `{ image }`, `{ video }` or `{ svg }` items, each with an optional `device` (`phone`, `tablet`, `laptop`, `desktop`, `watch`, `browser`), `label` and `duration`. They show the first few at once and bring the rest in as they play:

```ts
mountEffect(el, "device-showcase", { subject: [{ image: "/laptop.png", device: "laptop" }, { image: "/phone.png", device: "phone" }], itemDuration: 3000, onItem: (i) => showCaption(i) });
```

`itemDuration`, `overlap`, `loop`, `shuffle` and `onItem` work the same on `<FlairEffect>` and `use:flairEffect`; the mounted effect's `setSubject` swaps the list. A list outside the effect's `effectInputs(effect).items` range (`min` to `max`), an item that is not media, or an unknown device is refused with a sentence.

## Loaders with real progress

Loaders whose metadata has `ui.implements: "loader"` (`liquid-loader`, `flame-loader`) take `data: { value }`: 0–1 shows the job's progress, `null` plays the loader's own loop while the job cannot tell. They are progress bars to assistive tech (name them with `label`):

```tsx
<FlairEffect effect="liquid-loader" data={{ value: job.progress ?? null }} label="Generating image" style={{ height: 120 }} />
```

## Bundle size

`/react`, `/svelte`, `/embed` and `/catalog` carry the whole catalog (several hundred KB gzipped), because they look effects up by id. On a hot path (a loader, a moment), use the lazy entries instead: `@pixerate/flair/react/lazy`, `/svelte/lazy` and `/embed/lazy` have the same API and load each effect by id when it is first used, from a compact index (tens of KB up front for the engine, then the effect's own module). There `mountEffect` returns a promise; `<FlairEffect>` and `use:flairEffect` mount once the effect has loaded (errors go to `onError`); `<VectorEffect>` and `vectorEffectStill` render on the server, so give them an effect you have loaded (`await loadEffect(id)`, exported by each lazy entry):

```tsx
import { FlairEffect, useFlairMoment } from "@pixerate/flair/react/lazy";
```

Where effects are only listed or searched (pickers, agent tools), or a page draws a few shaders with the engine, use the lazy catalog:

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
