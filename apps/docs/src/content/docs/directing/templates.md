---
title: Sequence Templates
description: Reusable scenes with typed slots that a person or an agent fills to get a finished scene.
---

# Sequence Templates

A template is a [scene](../scenes/) with declared **slots**: a product reveal that takes your product shot and name, a before and after that takes two pictures, a stat countdown that takes a number. Fill the slots and you have a finished `Scene`, ready to play, record or export.

## The format

```json
{
  "id": "product-reveal",
  "name": "Product reveal",
  "description": "A product shot drifts in over a gradient…",
  "tags": ["product", "promo"],
  "slots": [
    { "name": "product", "type": "image", "label": "Product shot", "default": "<svg …>" },
    { "name": "productName", "type": "text", "label": "Product name", "default": "Nova Headphones", "maxLength": 40 },
    { "name": "accent", "type": "color", "label": "Accent colour", "default": "#FF5A36" },
    { "name": "holdMs", "type": "number", "label": "Time on each shot (ms)", "default": 2200, "min": 1200, "max": 6000, "integer": true }
  ],
  "scene": {
    "name": "product-reveal",
    "shots": [
      {
        "caption": "{{productName}}",
        "hold": "{{holdMs}}",
        "layers": [
          { "effect": "mesh-gradient", "role": "background", "values": { "uColorA": "{{accent}}" } },
          { "effect": "image-ken-burns", "subject": { "slot": "product" }, "rect": { "x": 400, "y": 150, "width": 1120, "height": 630 } }
        ]
      }
    ]
  }
}
```

Each slot has a `name` (letters, digits, `-` and `_`), a `type`, a `label`, an optional `description`, and a `default`:

| Type | Takes | Range |
| --- | --- | --- |
| `image`, `video`, `svg` | A URL, a `data:` URL or `<svg>` markup, a subject object (`{ "image": … }`), or `{ "slot": name }` to leave it for the host | — |
| `text` | Words | `maxLength` |
| `color` | `#RRGGBB` or `#RGB` | — |
| `number` | A number | `min`, `max`, `integer` |

**Subject slots** are the [layer slots](../scenes/#slots) a scene already has: a layer whose `subject` is `{ "slot": "product" }`. The template declares the slot's type and label; filling it puts the picture on the layer. With no value its default is used (the catalog's are labelled placeholder pictures, so every template plays as it is). A subject slot with no default, or given `{ "slot": name }`, stays a slot that the host fills at play time, for a live `<video>` say.

**Other slots** fill `{{name}}` placeholders in any string of the scene: shot titles and captions, layer and transition `values`, element text, the scene's title. A string that is only a placeholder (`"hold": "{{holdMs}}"`, `"values": { "value": "{{value}}" }`) takes the slot's typed value, so a number stays a number. Inside longer words it is written as text. Words can be a layer's subject too: `"subject": { "text": "{{headline}}" }`.

## Filling a template

```ts
import { instantiateTemplate, checkTemplate } from "@pixerate/flair";
import { sceneTemplate } from "@pixerate/flair/catalog";

const result = instantiateTemplate(sceneTemplate("before-after")!, {
  before: "https://example.com/kitchen-before.jpg",
  after: "https://example.com/kitchen-after.jpg",
  headline: "Kitchen makeover",
}, { name: "kitchen" });

if (result.ok) {
  result.scene;     // the finished Scene
  result.issues;    // validateScene's issues with it
  result.openSlots; // subject slots the host still fills
} else {
  result.errors;    // a sentence for each bad value
}
```

`instantiateTemplate` is pure and leaves the template as it was. It refuses, all at once:

- an unknown slot: *There is no slot "colour"; "product-reveal" has product (image), productName (text), …*
- a wrong type: *Slot "accent" takes a colour like "#FF5A36", not the words "blue".*
- a value out of range: *Slot "holdMs" takes a whole number from 1200 to 6000; 99 is out of range.*

`checkTemplate(template)` checks a template of your own: its id and slots, each default against its own type and range, placeholders and layer slots the scene uses without declaring, slots it declares and never uses, and the scene's issues with the defaults filled in. `templateSlotSummary(slot)` describes a slot in a line, for a form or a prompt.

## The catalog

`SCENE_TEMPLATES` and `sceneTemplate(id)` come from `@pixerate/flair/catalog`. They are built only from catalog effects, camera moves and transitions. The root entry loads them on demand, so they add nothing to its bundle.

| Template | Slots | What it does |
| --- | --- | --- |
| `product-reveal` | product, productName, tagline, price, accent, holdMs | A product shot drifts in over a gradient, the camera punches in to a lower third with its name and price, and a flare wipes to a closing title card. |
| `before-after` | before, after, beforeLabel, afterLabel, headline, background | The before picture, a wipe to the after picture, then both side by side under a headline. |
| `stat-countdown` | intro, countFrom, value, caption, closing, accent | A countdown, a counter running up to the number that matters, and a kinetic closing line. |
| `title-into-tour` | title, subtitle, accent, feature1–3, screen1–3, holdMs | A title card focus-pulls into a tour of three features, the camera gliding and whip-panning between screenshots. |

## Agents

The scene tools (`FLAIR_AGENT_TOOLS`, applied with `applySceneTool`) include:

- `find_templates` `{ text?, limit?, offset? }`: the templates, a page at a time, with a `total` and each one's slots.
- `describe_template` `{ template }`: each slot's type, label, default and range, and an outline of the shots.
- `use_template` `{ template, values?, name? }`: replaces the working scene with the filled template and returns its issues and open slots. A value that does not fit is refused, with what the slot takes, and the scene is left alone. It works inside `batch_scene`, so an agent can fill a template and edit its shots in one change.

## Command line

```bash
flair template list
flair template show stat-countdown
flair template fill stat-countdown --set value=4200 --set caption="orders shipped" -o stats.scene.json --html stats.html
flair template fill ./my-template.json --values values.json
```

`fill` takes a catalog id or a template file. `--values` reads a JSON file of values by slot name (picture paths in it are relative to it); `--set slot=value` sets one (numbers for number slots; a local picture, SVG or video file for a subject slot, inlined into the scene). It writes the scene JSON, and with `--html` a standalone player. Open slots can still be filled when playing: `flair scene html stats.scene.json --subject slot=./file.png`.
