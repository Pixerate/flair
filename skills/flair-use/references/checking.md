# Checking the work

Finish every change with a check that would fail if it were wrong. Pick the ones that fit:

## Is the id, preset or value right?

```bash
npx flair effects --search image-duotone --json   # the effect, its inputs and preset names
```

In code, `getEffectMeta(id)` (lazy catalog) or `getEffect(id)` returns `undefined` for an unknown id; `loadEffect(id)` rejects with the nearest id ("Did you mean …"). `effectControlSchema(id)` validates values: run it through any JSON Schema validator, or `checkControlValue(control, value)` from `@pixerate/flair` for one value (`{ ok, value }` or `{ ok: false, message }`).

## Unit tests (no GPU)

`installFakeWebGl()` from `@pixerate/flair/testing` gives canvases a fake WebGL2 context, so components and code that render with Flair run in jsdom, Node or CI. No shader runs: pixels come from a function you give, and every draw is recorded so a test can assert on it.

```ts
import { afterEach, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { installFakeWebGl } from "@pixerate/flair/testing";
import { FlairEffect } from "@pixerate/flair/react";

const webgl = installFakeWebGl();
afterEach(() => webgl.restore());

it("draws the hero background", () => {
  const { container } = render(<FlairEffect effect="aurora" preset="Ember" autoplay={false} style={{ height: 200 }} />);
  expect(container.querySelector("canvas")).not.toBeNull();
  expect(webgl.last().calls.some((c) => c.name === "drawArrays")).toBe(true); // it drew
});
```

Any test runner works (Jest, Vitest, `node:test`); the fake is plain TypeScript. A source containing `COMPILE_ERROR` fails to compile, to test error paths.

## Look at it (headless)

Render the effect as the page would, and open the result:

```bash
npx flair render image-duotone --image team.jpg --preset Spotify --duration 1 -o check.gif
npx flair render aurora --duration 0.1 -o frames/          # PNG frames to inspect
npx flair render lower-third --text "Ada Lovelace" -o lt.svg   # vector effects: no browser needed
```

`flair render` exits non-zero with a sentence when the effect, preset, a `--set` value or the subject is wrong. Add `--software` for frames that match on every machine (golden images).

## Scenes

```bash
npx flair scene validate my.scene.json
npx flair scene review my.scene.json
```

`validate` lists issues by shot (no output past the summary means valid); `review` simulates the scene headlessly and reports timing, framing and warnings. See [scenes.md](scenes.md).

## In the running app

If a dev server and a browser are available, open the page and look: the effect should animate (unless `autoplay` is off or it is a still), with no errors in the console. A shader that fails to compile logs its errors; an image from another origin without CORS shows black, and the renderer's `onImageError` says why.
