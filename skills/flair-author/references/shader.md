# Shader effects

A shader effect is a GLSL ES 3.00 fragment shader written Shadertoy-style. Flair wraps it: it adds `#version 300 es`, precision, the built-in uniforms and `main()`, then `#line 1`, so compiler errors name lines of your source.

## The shape

```glsl
// Controls are uniforms annotated on the same line.
uniform vec3 uTint;       // @control color default=#77C16A label="Tint"
uniform float uSpeed;     // @control min=0 max=4 default=1 label="Speed"
uniform int uRings;       // @control min=1 max=12 default=5
uniform bool uGrain;      // @control default=true label="Film grain"
uniform sampler2D uPhoto; // @control filter=linear wrap=clamp label="Photo"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec3 photo = texture(uPhoto, uv + 0.01 * sin(uv.yx * 20.0 + iTime * uSpeed)).rgb;
  float ring = 0.5 + 0.5 * sin(length(uv - 0.5) * float(uRings) * 6.2832 - iTime * uSpeed);
  vec3 color = photo * mix(vec3(1.0), uTint, ring);
  if (uGrain) color += 0.04 * (fract(sin(dot(fragCoord, vec2(12.9898, 78.233))) * 43758.5453) - 0.5);
  fragColor = vec4(color, 1.0);
}
```

- Define `void mainImage(out vec4 fragColor, in vec2 fragCoord)`. Do not write `#version`, `precision`, `main()`, an `out` variable or the built-in uniforms: the wrapper declares them, and declaring them again fails to compile.
- `fragCoord` is in pixels from the bottom left; divide by `iResolution.xy` for 0–1.
- Write `1.0`, not `1`, where a float is wanted: GLSL ES does not convert ints to floats.

## Built-in uniforms (never declare these)

| Uniform | What it holds |
| --- | --- |
| `vec3 iResolution` | canvas size in pixels (z = 1) |
| `float iTime`, `float iTimeDelta`, `int iFrame` | seconds since start, since the last frame; frame number |
| `vec4 iPointer` | xy pointer in pixels, z how hovered (0–1), w seconds held (negative after release) |
| `vec4 iMouse` | Shadertoy's mouse: xy while pressed, zw press position |
| `vec4 iClicks[]`, `vec4 iTrail[]` | recent clicks; where the pointer has been |
| `vec4 iAudio`, `vec4 iSpectrum[16]`, `float iBeat` | sound: level, bass, mid, treble; 64 frequency bins; seconds since the last beat (-1 before any) |
| `vec4 iScroll` | x the canvas's progress through the viewport, y page scroll, z velocity, w scrolling |

Reading `iPointer`, `iClicks`, `iAudio` or `iScroll` is enough: the renderer feeds them, and the effect answers the pointer, sound or scrolling with no wiring. With nothing connected they are 0, so give the effect an idle look.

## Controls

A uniform is a control when its line ends with `// @control` and attributes:

| Attribute | Means |
| --- | --- |
| `default=` | the starting value: a number, `true`/`false`, `#rrggbb` for a colour, `x,y,z` for a vector, a URL or `"…"` for an image or path |
| `min=` `max=` | the range; a declared bound is a limit, and a value past it is refused |
| `step=` | slider step |
| `label="…"` | the name shown in panels (default: the name made readable, `uFlowSpeed` → "Flow speed") |
| `color` | a `vec3`/`vec4` shown as a colour picker |
| `unit=` | what a number measures (`degrees`, `pixels`) |
| `filter=` `wrap=` | sampling of a `sampler2D`: `mipmap`/`linear`/`nearest`; `repeat`/`clamp`/`mirror` |
| `path` | a `sampler2D` that takes SVG path data or points (`fit=contain|cover|none`, `margin=`) |

Types: `float`, `int`, `bool`, `vec2`, `vec3`, `vec4`, `sampler2D`. Every uniform the effect reads should be a control (except the built-ins), so people and agents can set it. One declaration per line.

## Overlays and alpha

An effect that draws over other content writes coverage to `fragColor.a` (0 where it draws nothing). Mark its definition `transparent: true`, so `mountEffect`, `<FlairEffect>` and recordings give it a transparent canvas.

## Helpers

`@pixerate/flair/catalog` exports the catalog's GLSL helpers as strings (`HASH`, `NOISE`, `FBM`, `PALETTE`, `ROTATE`, `PATH`, …). Paste them into the source (a template literal: `` `${HASH}\n${NOISE}\nvoid mainImage(...)` ``), so the source stays self-contained, in the order their comments give (`NOISE` needs `HASH`).

## Using it

```ts
import { ShaderRenderer } from "@pixerate/flair";
import { mountEffect } from "@pixerate/flair/embed";
import type { ShaderEffect } from "@pixerate/flair/catalog";

const ripple: ShaderEffect = {
  id: "my-ripple",
  name: "Ripple tint",
  kind: "shader",
  category: "image",
  description: "A photo tinted in rings that ripple out from the centre.",
  tags: ["image", "ripple"],
  source, // the GLSL above
  presets: [{ name: "Fast teal", values: { uSpeed: 3, uTint: "#14b8a6" } }],
};

mountEffect(el, ripple, { subject: { image: "/photo.jpg" }, preset: "Fast teal" });

// Or drive a renderer directly, and read the compile report:
const renderer = new ShaderRenderer(el);
const status = renderer.setSource(source); // { ok, errors: [{ line, message }] }
if (!status.ok) console.error(status.errors);
renderer.setValues({ uSpeed: 2 });
```

Every field but `presets` is required (`transparent`, `loop`, `build` and `video` are optional extras; `build` is the seconds a shader takes to build up once before it settles, such as a path drawing on, so previews replay it). `id` is your own kebab-case id; `category` is one of `EFFECT_CATEGORIES` (from `@pixerate/flair/catalog`), such as `gradient`, `image`, `overlay` or `text`, and only sorts it.

### Getting the source into app code

The `.frag` file is for checking; the app needs the GLSL as a string:

- **Inline it** as a template literal in a `.ts` file (simplest; keep the `.frag` as the file you check with `flair controls`, or check the string with `parseControls` in a test).
- **Vite**: `import source from "./pulse.frag?raw";` and, for TypeScript, a `src/raw.d.ts` with `declare module "*?raw" { const text: string; export default text; }`. Other bundlers have their own raw-text loaders (webpack `asset/source`).
- **Node** (scripts, servers): `readFileSync("effects/pulse.frag", "utf8")`.

`parseControls(source)` (from `@pixerate/flair`) returns the controls without a GPU, as `flair controls` prints them: use it in a unit test to pin the control surface. A uniform whose `@control` comment is not on its own declaration line is not a control, and `flair controls` will not list it.

## Check it

```bash
npx flair controls effect.frag            # the controls as parsed (colours print as 0–1 channels); --json for JSON
npx flair export effect.frag -o check/ -d 0.1 --values '{"uSpeed":2}'   # compiles in headless Chrome, writes PNG frames (no ffmpeg needed); exits 1 with ERROR: 0:<your line> when it does not compile
npx flair html effect.frag --out effect.html --open   # a standalone page with sliders, to look at it
```

Keep it cheap: a background runs every frame at full resolution. Avoid loops of more than a few dozen steps per pixel, and prefer a closed form or fewer octaves.
