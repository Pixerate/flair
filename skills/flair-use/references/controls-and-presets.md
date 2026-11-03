# Controls, presets, camera moves, timing and motion

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

## Timing effects (retiming video)

Timing effects are catalog effects of kind `timing` (the `timing` category in [pictures.md](effects/pictures.md)): a speed change, a speed ramp, a reverse, a boomerang, a freeze frame, a stutter, step frames, a frame echo and a long exposure. They draw nothing of their own. For each moment of the result, they name the frames of the footage to show and how to blend them. Give them a `<video>`:

```ts
import { mountEffect, recordEffect } from "@pixerate/flair/embed";

mountEffect(el, "long-exposure", { subject: { video }, values: { exposure: 4, lighten: true } });
const slowMo = await recordEffect("retime-speed", { subject: { video }, values: { speed: 0.25 } });
```

Without a video they play on a preview clip of Flair's own. In Node, `flair render long-exposure --video clip.mp4 -o out.mp4` (or `exportEffect` with `subject: { video: "clip.mp4" }`) retimes a video file with ffmpeg and no browser; the video's own sound is left out, and `--audio` muxes another track. `timingLength(effect, footageMs, values)` gives how long the retimed clip is, and `timingSample(effect, { time, footage }, values)` gives the footage frames one moment shows. A speed change of 0.5 doubles the length; a freeze adds its hold. They are not editor documents (`createEffectDocument` refuses them). In a scene, a layer with a video subject takes one as its `timing`: `{ "subject": { "video": "surf.mp4" }, "timing": { "effect": "retime-speed", "preset": "Slow motion" } }` (see [scenes.md](scenes.md)).

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
