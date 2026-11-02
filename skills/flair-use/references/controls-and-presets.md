# Controls, presets, camera moves and motion

## Controls

Every effect has controls: named values with a type, a default and (for numbers) a range. Shader controls are uniforms (`uSpeed`, `uTint`); vector controls are plain names (`word`, `accent`). Find them before setting them:

- `npx flair effects --search <id> --json` lists an effect with its presets; `getEffectMeta(id).controls` (from `@pixerate/flair/catalog/lazy`) or `effectControls(getEffect(id))` (from `@pixerate/flair/catalog`) gives each control's name, type, default, `min` and `max`.
- `effectControlSchema(id)` gives a strict JSON Schema of the values: use it to validate values from a form, a config file or a model.

Value types:

| Control | Value |
| --- | --- |
| `float`, `int` | a number; a declared `min`/`max` is a limit (`checkControlValue`, the schema and `flair render --set` refuse a value past it) |
| `bool` | `true` / `false` |
| colour (`vec3`/`vec4` marked colour) | a CSS colour string (`"#ff0080"`, `"rgb(…)"`, `"hsl(…)"`) or channels 0–1 (`[1, 0, 0.5]`); vector effects also take `"currentColor"` |
| `vec2`–`vec4` | an array of numbers |
| `sampler2D` (an image) | a URL, `""` for none; words go in through `textImage("…")` |
| `path` | SVG path data (`"M 0 0 C …"`) or points `[x0, y0, x1, y1, …]` |
| `text` (vector effects) | a string; it is escaped, so any words are safe |

Set values where the effect is mounted: the `values` prop or option, or `m.setValues({ … })` on a mounted effect. Unset controls keep their defaults. A renderer does not complain about a value it cannot use: it keeps the default, so a typo looks like "nothing happened". Validate values with `effectControlSchema(id)` or `checkControlValue(control, value)` (`{ ok: false, message }` says what the control takes).

## Presets

A preset is a named set of values (the index line lists them: `Presets: Ember, Ice`). Pass `preset: "Ember"` (or the `preset` prop); `values` apply on top of it. `effectDefaults(effect, { preset: "Ember", values: { uSpeed: 0.5 } })` gives the merged values for code that drives a renderer itself. Preset names are case-sensitive.

## Overlays and alpha

Effects marked "Overlay" in the index (`transparent: true`) draw over what is under them: `mountEffect` and the components give them a transparent canvas, and recordings keep alpha in `webm`, `mov`, `png` and `gif`. Lay the element over a picture or a section with CSS positioning.

## Interaction, audio and scroll

Effects that "answer" `hover`, `press`, `click`, `trail` or `pointer` read the pointer by themselves: no wiring. Audio effects take an `{ audio }` subject (a playing `<audio>`, a microphone `MediaStream` or a Web Audio node); start it from a click, since browsers suspend audio until the page is interacted with. Scroll effects follow the page by themselves.

## Camera moves

Camera moves are catalog effects of kind `camera` ([camera.md](effects/camera.md)). They belong in a scene shot's `camera`: `in` (how the camera gets into the shot; role `transition`) and `during` (how it moves while the shot holds; role `hold`):

```json
{ "camera": { "frame": ["card"], "in": { "move": "camera-whip-pan", "preset": "Soft" }, "during": "camera-ken-burns" } }
```

`validateScene` refuses a move in the wrong field and names the moves there are. On its own, `mountEffect(el, "camera-ken-burns", { subject: { image: "/photo.jpg" } })` previews a move on a picture.

## Motion primitives (animating your own SVG)

`@pixerate/flair/motion` holds entrances, exits, emphasis and path motions as data, to apply to any element (by id) of an SVG:

```ts
import { applyPrimitive, PRIMITIVES } from "@pixerate/flair/motion";
import { SvgPlayer } from "@pixerate/flair/vector";

let motion = { svg: '<svg viewBox="0 0 200 100"><rect id="card" x="10" y="10" width="80" height="40"/></svg>' };
const pop = applyPrimitive(motion, { primitive: "entrance.pop", target: "card" });
if (pop.ok) motion = pop.motion;
else throw new Error(pop.message); // says what to fix, with the nearest names
new SvgPlayer(el, motion, { loop: false });
```

`PRIMITIVES` lists them with their params (`entrance.fade`, `entrance.slide`, `emphasis.pulse`, `exit.fade`, `path.follow`, …). A use is checked whole before anything changes; read `ok` and `message`.
