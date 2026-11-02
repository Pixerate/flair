# Vector effects

A vector effect is an `SvgMotion`: one self-contained `<svg>` with a `viewBox`, plus `animate`, a list of timed changes to its elements by id. Every frame is a function of time, so it plays in a page, scrubs, server-renders as a still and exports as a self-playing `.svg`.

## The shape

```json
{
  "svg": "<svg viewBox=\"0 0 400 120\"><!-- {{title: text default='Hello' label='Title'}} {{ink: color default=#6366F1 label='Ink'}} {{size: float min=24 max=72 default=48 label='Size'}} --><rect id=\"bar\" x=\"20\" y=\"92\" width=\"0\" height=\"6\" fill=\"{{ink}}\"/><text id=\"title\" x=\"20\" y=\"80\" font-size=\"{{size}}\" font-family=\"system-ui\" font-weight=\"800\" fill=\"{{ink}}\" opacity=\"0\">{{title}}</text></svg>",
  "animate": [
    { "id": "bar", "attrs": { "width": [0, 360] }, "ms": 500, "ease": "out" },
    { "id": "title", "attrs": { "opacity": [0, 1] }, "delay": 200, "ms": 400 },
    { "id": "title", "attrs": { "transform": ["translate(0 12)", "translate(0 0)"] }, "delay": 200, "ms": 600, "ease": { "spring": { "stiffness": 200, "damping": 14 } } }
  ]
}
```

## Controls: `{{placeholders}}`

- The first `{{name: type attributes…}}` declares a control; every `{{name}}` is filled with its value. Declare each name once, and put declarations in an XML comment (`<!-- … -->`) when the markup has no other place for them: the comment is dropped when the picture is filled in.
- Types: `float`, `int`, `bool`, `color`, `text`. Attributes as on a shader's `@control`: `default=`, `min=`, `max=`, `step=`, `label=`, `unit=`. Quote values with spaces in single quotes: `label='Bar colour'`.
- Placeholders work anywhere: attributes, text, and the values in `animate` (`"width": [0, "{{length}}"]`). A string that is only a placeholder becomes the value itself, so numbers stay numbers.
- Text is escaped when it is filled in, so any words are safe. Colours take any CSS colour or `currentColor` (the colour of the text around it).

## Changes: `animate`

Each change names an element `id` (it must exist in the SVG) and when it plays: `delay` and `ms` (milliseconds), `ease` (`linear`, `in`, `out`, `in-out` and the other named eases, a `[x1, y1, x2, y2]` cubic-bezier, or `{ "spring": { … } }`), `repeat`, `alternate`, and `step` (for click-triggered pictures). What it changes:

| Field | Does |
| --- | --- |
| `attrs` | `{ name: [from, to] }`: numbers, colours, or strings whose numbers change (a `d`, `transform`, `points`) |
| `draw` | draws a stroke on along its length (`true`, or `[from, to]` fractions) |
| `along`, `at`, `orient` | moves the element along a path by id (draw it round 0,0) |
| `count`, `format`, `decimals` | counts the element's text from one number to another (`"{n}%"`) |
| `write`, `scramble`, `caret` | types text in letter by letter |
| `view` | zooms and pans the whole picture to a box or an element |
| `behavior` | `pulse`, `oscillate`, `wriggle` or `overshoot` between `from` and `to` |

For ready-made entrances, exits and emphasis on your own elements, apply motion primitives instead of writing changes by hand: `applyPrimitive(motion, { primitive: "entrance.pop", target: "title" })` from `@pixerate/flair/motion` (see the flair-use skill's controls reference).

## Not allowed

No `<script>`, event handlers, `<foreignObject>`, links outside the file (only `#id` and `data:image/` URLs), and no `<animate>`, `<animateTransform>`, `<animateMotion>` or `<set>` in the markup: changes go in `animate`. `svgMotionIssues(motion)` (from `@pixerate/flair/vector`) lists every problem as a sentence; `flair controls` prints them.

## Using it

```ts
import { mountEffect } from "@pixerate/flair/embed";
import { renderVectorEffect, vectorControls, type VectorEffect } from "@pixerate/flair/catalog";
import { SvgPlayer, svgAnimatedMarkup, svgMotionIssues } from "@pixerate/flair/vector";

const headline: VectorEffect = {
  id: "my-headline",
  name: "Underlined headline",
  kind: "vector",
  category: "text",
  description: "A title rising in over an underline that sweeps out under it.",
  tags: ["title", "text"],
  motion, // the SvgMotion above
  hold: 1200, // ms on the last frame before it loops
  presets: [{ name: "Big red", values: { ink: "#dc2626", size: 64 } }],
};

vectorControls(headline.motion); // [{ name: "title", type: "text", … }, { name: "ink", … }, { name: "size", … }]
const filled = renderVectorEffect(headline, { title: "Launch day" });
console.assert(svgMotionIssues(filled).length === 0);

mountEffect(el, headline, { subject: { text: "Launch day" } }); // the text subject fills the text control
new SvgPlayer(el2, filled, { hold: headline.hold });           // or play it yourself
const file = svgAnimatedMarkup(filled, { hold: headline.hold }); // a self-playing .svg, no script
```

Every field but `presets`, `hold` and `trigger` is required; `category` is one of `EFFECT_CATEGORIES` (from `@pixerate/flair/catalog`). Keep the motion in a `.json` (or `.svg`) file to check it with `flair controls`, and import it into app code (`import motion from "./headline.json"` with `resolveJsonModule`) or inline it.

In React, `<FlairEffect effect={headline} values={{ title: "Launch day" }} />` (from `@pixerate/flair/react`).

Interactive pictures set `trigger` on the definition (`"hover"`, `"press"`, `"click"` or `"scroll"`) and pass it to the player: `new SvgPlayer(el, filled, { trigger: headline.trigger })`.

## Check it

```bash
npx flair controls headline.json   # or headline.svg: the declared controls, then anything to fix (exits 1 until it is clean)
```

Then look at it: write `svgAnimatedMarkup(filled)` to a `.svg` file and open it in a browser, or mount it in the app.
