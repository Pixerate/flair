import { readFileSync } from "node:fs";
import path from "node:path";
import { EFFECT_TYPES, type EvalTask, type TaskMode } from "./types.ts";

/**
 * The built-in tasks. From scratch: a brief in a person's words. From reference: frames of a catalog
 * effect held out of the prompt (the model sees how it looks, never its source, id or description).
 */
export const SCRATCH_TASKS: readonly EvalTask[] = [
  // Backgrounds
  {
    id: "bg-pool-caustics",
    type: "background",
    mode: "scratch",
    brief: "Sunlight caustics rippling across the floor of a swimming pool: bright, sharp, wobbling light lines over deep turquoise water. Let people set the water colour, the light colour, the scale of the pattern and the speed.",
    expect: { animated: true, minControls: 4, minColorControls: 2 },
  },
  {
    id: "bg-hyperspace",
    type: "background",
    mode: "scratch",
    brief: "Hyperspace: stars stream outward from the centre of the frame as streaks that lengthen as they speed up near the edges, on a near-black background with a faint blue glow in the middle. Controls for the star count (density), speed, streak length and glow colour.",
    expect: { animated: true, minControls: 4, minColorControls: 1 },
  },
  {
    id: "bg-brand-mesh",
    type: "background",
    mode: "scratch",
    brief: "A soft mesh gradient of four brand colours that drift and blend slowly, with a little film grain, for a hero section behind text. It should loop seamlessly (declare how long the loop is). Each of the four colours is a control, plus speed and grain amount.",
    expect: { animated: true, minControls: 6, minColorControls: 4 },
  },
  // Filters
  {
    id: "filter-duotone-halftone",
    type: "filter",
    mode: "scratch",
    brief: "Turn a photo into a two-colour halftone print: round dots on a rotated grid, sized by the photo's brightness, ink colour on paper colour. Controls for dot size, grid angle, ink colour and paper colour.",
    expect: { minControls: 5, minColorControls: 2 },
  },
  {
    id: "filter-vhs",
    type: "filter",
    mode: "scratch",
    brief: "Make a picture look like a worn VHS tape: colour bleeding sideways, a rolling band of tracking distortion, horizontal jitter, noise and slightly washed-out colour. It moves over time like a playing tape. Controls for how worn it is, the tracking band's strength and the noise.",
    expect: { animated: true, minControls: 4 },
  },
  // Overlays
  {
    id: "overlay-snowfall",
    type: "overlay",
    mode: "scratch",
    brief: "Snow falling over whatever is under it: flakes in three depth layers (near flakes bigger, blurrier and faster), drifting a little sideways. Transparent everywhere there is no flake. Controls for the amount of snow, wind and flake colour.",
    expect: { animated: true, minControls: 3, minColorControls: 1 },
  },
  {
    id: "overlay-light-leak",
    type: "overlay",
    mode: "scratch",
    brief: "Warm film light leaks: soft orange and magenta glows that bloom in from the frame edges and drift, over whatever is under them, transparent where there is no glow. Controls for intensity, speed and the two glow colours.",
    expect: { animated: true, minControls: 4, minColorControls: 2 },
  },
  // Transitions
  {
    id: "transition-radial-pixelate",
    type: "transition",
    mode: "scratch",
    brief: "A transition between two pictures: the first picture breaks into ever bigger square pixels, swaps to the second at the halfway point, then the pixels shrink back to sharp. Cells nearer the centre switch first, so the swap spreads out in a ring. Controls for the biggest pixel size and how wide the ring is.",
    expect: { minControls: 5 },
  },
  {
    id: "transition-glass-shards",
    type: "transition",
    mode: "scratch",
    brief: "A transition where the first picture cracks into angular glass shards that tilt, refract and fall away, revealing the second picture behind. Controls for the number of shards and how far they fall.",
    expect: { minControls: 5 },
  },
  // Interactive
  {
    id: "interactive-dot-grid",
    type: "interactive",
    mode: "scratch",
    brief: "A grid of glowing dots on a dark background. Dots near the pointer swell and push away from it; each click sends a ring-shaped ripple out through the grid. With no pointer it breathes gently. Controls for grid spacing, dot colour and how strongly dots react.",
    expect: { animated: true, minControls: 3, minColorControls: 1 },
  },
  // Vector: titles
  {
    id: "title-kicker-headline",
    type: "title",
    mode: "scratch",
    brief: "A two-line title for a video: a small uppercase kicker slides in from the left, then the headline rises into place under it while a coloured highlight bar wipes in behind the headline. The kicker and headline text, the accent colour and the text colour are controls.",
    expect: { animated: true, minTextControls: 2, minColorControls: 2, loops: true },
  },
  {
    id: "title-quote-card",
    type: "title",
    mode: "scratch",
    brief: "A quote card: big quotation marks pop in, the quote types in word by word, then the author's name fades up below with a short line drawing on beside it. Quote, author and accent colour are controls.",
    expect: { animated: true, minTextControls: 2, minColorControls: 1, loops: true },
  },
  // Vector: loaders
  {
    id: "loader-orbit-dots",
    type: "loader",
    mode: "scratch",
    brief: "A loading indicator: three dots orbit a centre point one after another, each shrinking and fading as it trails the one before, looping forever. Colour and size are controls.",
    expect: { animated: true, minControls: 2, minColorControls: 1, loops: true },
  },
  {
    id: "loader-progress-ring",
    type: "loader",
    mode: "scratch",
    brief: "A circular progress ring that draws on from 0 to a target percentage while the number in the middle counts up to match (\"0%\" to \"72%\"), then holds. The target percentage, ring colour and track colour are controls.",
    expect: { animated: true, minControls: 3, minColorControls: 2 },
  },
  // Vector: icons and UI
  {
    id: "icon-success-check",
    type: "icon",
    mode: "scratch",
    brief: "A success icon: a circle strokes on, fills with green, then a white checkmark draws in and the whole badge does a small springy pop. Circle colour and check colour are controls.",
    expect: { animated: true, minColorControls: 2 },
  },
  {
    id: "ui-toggle-switch",
    type: "ui",
    mode: "scratch",
    brief: "A toggle switch that flips each time it is clicked: the knob slides across with a slight squash, and the track changes from grey (off) to an accent colour (on). It plays on click, step by step, not on a loop. The accent colour is a control.",
    expect: { trigger: "click", minColorControls: 1 },
  },
  // Vector: data
  {
    id: "data-bar-chart",
    type: "data",
    mode: "scratch",
    brief: "A bar chart of five values that grow up from a baseline one after another, each with its value counting up above it and a label under it. Each of the five values and the bar colour are controls.",
    expect: { animated: true, minControls: 6, minColorControls: 1 },
  },
];

/** Catalog effects held out as references: what each looks like is the whole brief. */
export const REFERENCE_TASKS: readonly EvalTask[] = [
  { id: "ref-caustics", type: "background", mode: "reference", brief: "", reference: { effect: "caustics" }, expect: { animated: true } },
  { id: "ref-nebula", type: "background", mode: "reference", brief: "", reference: { effect: "nebula" }, expect: { animated: true } },
  { id: "ref-image-halftone", type: "filter", mode: "reference", brief: "", reference: { effect: "image-halftone" } },
  { id: "ref-image-thermal", type: "filter", mode: "reference", brief: "", reference: { effect: "image-thermal" } },
  { id: "ref-embers", type: "overlay", mode: "reference", brief: "", reference: { effect: "embers" }, expect: { animated: true } },
  { id: "ref-rain-on-glass", type: "overlay", mode: "reference", brief: "", reference: { effect: "rain-on-glass" }, expect: { animated: true } },
  { id: "ref-transition-iris", type: "transition", mode: "reference", brief: "", reference: { effect: "transition-iris" } },
  { id: "ref-split-reveal", type: "title", mode: "reference", brief: "", reference: { effect: "split-reveal", text: "Launch day" }, expect: { animated: true, minTextControls: 1 } },
  { id: "ref-lower-third", type: "title", mode: "reference", brief: "", reference: { effect: "lower-third" }, expect: { animated: true } },
  { id: "ref-orbit-loader", type: "loader", mode: "reference", brief: "", reference: { effect: "orbit-loader" }, expect: { animated: true } },
  { id: "ref-success-check", type: "icon", mode: "reference", brief: "", reference: { effect: "success-check" }, expect: { animated: true } },
  { id: "ref-line-chart", type: "data", mode: "reference", brief: "", reference: { effect: "line-chart" }, expect: { animated: true } },
];

export const BUILTIN_TASKS: readonly EvalTask[] = [...SCRATCH_TASKS, ...REFERENCE_TASKS];

/** Every transition's controls, whatever else the task asks. */
export function taskExpectations(task: EvalTask) {
  const expect = { ...task.expect };
  if (task.type === "transition") expect.controls = [...new Set([...(expect.controls ?? []), "uFrom", "uTo", "uProgress"])];
  return expect;
}

/** Problems with a task, as sentences (empty when it is fine). */
export function taskIssues(task: unknown, at = "task"): string[] {
  if (!task || typeof task !== "object") return [`${at} is not an object`];
  const t = task as Partial<EvalTask>;
  const issues: string[] = [];
  if (typeof t.id !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.id)) issues.push(`${at}.id must be kebab-case, like "my-task"`);
  if (!EFFECT_TYPES.includes(t.type as never)) issues.push(`${at}.type must be one of ${EFFECT_TYPES.join(", ")}`);
  if (t.mode !== "scratch" && t.mode !== "reference") issues.push(`${at}.mode must be "scratch" or "reference"`);
  if (typeof t.brief !== "string") issues.push(`${at}.brief must be a string ("" for none)`);
  if (t.mode === "scratch" && !t.brief?.trim()) issues.push(`${at}.brief is empty; a scratch task needs a brief`);
  if (t.mode === "reference") {
    const r = t.reference;
    const sources = [r?.effect, r?.images?.length ? r.images : undefined, r?.video].filter(Boolean).length;
    if (sources !== 1) issues.push(`${at}.reference needs exactly one of effect, images or video`);
  }
  return issues;
}

/**
 * Tasks from a JSON file: an array of tasks, or `{ "tasks": [...] }`. Picture and video paths are
 * relative to the file.
 */
export function loadTaskFile(file: string): EvalTask[] {
  const raw = JSON.parse(readFileSync(file, "utf8")) as unknown;
  const list = Array.isArray(raw) ? raw : (raw as { tasks?: unknown }).tasks;
  if (!Array.isArray(list)) throw new Error(`${file} holds neither an array of tasks nor { "tasks": [...] }.`);
  const issues = list.flatMap((t, i) => taskIssues(t, `tasks[${i}]`));
  if (issues.length) throw new Error(`${file} has problems:\n- ${issues.join("\n- ")}`);
  const dir = path.dirname(path.resolve(file));
  return (list as EvalTask[]).map((t) => {
    const r = t.reference;
    if (!r) return t;
    return {
      ...t,
      reference: {
        ...r,
        ...(r.images && { images: r.images.map((p) => path.resolve(dir, p)) }),
        ...(r.video && { video: path.resolve(dir, r.video) }),
      },
    };
  });
}

/** Tasks narrowed by mode, type and id (each list empty for all). */
export function selectTasks(tasks: readonly EvalTask[], filter: { modes?: readonly TaskMode[]; types?: readonly string[]; ids?: readonly string[] }): EvalTask[] {
  const out = tasks.filter(
    (t) =>
      (!filter.modes?.length || filter.modes.includes(t.mode)) &&
      (!filter.types?.length || filter.types.includes(t.type)) &&
      (!filter.ids?.length || filter.ids.includes(t.id)),
  );
  const unknownIds = (filter.ids ?? []).filter((id) => !tasks.some((t) => t.id === id));
  if (unknownIds.length) throw new Error(`There is no task ${unknownIds.map((id) => `"${id}"`).join(", ")}; list them with --list.`);
  const unknownTypes = (filter.types ?? []).filter((t) => !EFFECT_TYPES.includes(t as never));
  if (unknownTypes.length) throw new Error(`Unknown type ${unknownTypes.join(", ")}; the types are ${EFFECT_TYPES.join(", ")}.`);
  return out;
}
