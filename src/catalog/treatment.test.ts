import { describe, expect, it } from "vitest";
import { callTool, createEffectToolProvider } from "../editor/agent.js";
import { createEffectEditor } from "../editor/editor.js";
import { effectControls, effectDefaults, effectDuration, effectInputs, findEffects, getEffect } from "./index.js";
import {
  cubicBezier,
  DEFAULT_TEXT_TREATMENT,
  ease,
  getTextTreatment,
  resolveTextTreatment,
  softSweep,
  TEXT_TREATMENT_STAGES,
  textTreatmentDuration,
  textTreatmentIssues,
  textTreatmentPlan,
  textTreatments,
  treatmentHash,
  type TextTreatmentTarget,
} from "./treatment.js";
import type { TextTreatmentEffect } from "./types.js";

const line = { x: 10, y: 20, width: 100, height: 18 };
const twoLines: TextTreatmentTarget = {
  lines: [
    { x: 40, y: 0, width: 120, height: 20 },
    { x: 0, y: 24, width: 60, height: 20 },
  ],
  caret: { x: 60, y: 24, height: 20 },
  text: "word",
  label: "Agent",
  color: "#1d1d1f",
  background: "#ffffff",
};

describe("text treatments in the catalog", () => {
  it("are a kind and a category, with the soft sweep as the default", () => {
    expect(DEFAULT_TEXT_TREATMENT).toBe("soft-sweep");
    expect(textTreatments[0]).toBe(softSweep);
    expect(findEffects({ kind: "text-treatment" }).map((e) => e.id).sort()).toEqual(textTreatments.map((e) => e.id).sort());
    for (const effect of textTreatments) {
      expect(getEffect(effect.id)).toBe(effect);
      expect(getTextTreatment(effect.id)).toBe(effect);
      expect(effect.category).toBe("treatment");
      expect(effectDuration(effect)).toBeUndefined();
      expect(effectInputs(effect)).toEqual({ accepts: ["text"], images: [], texts: [], interactions: [], transparent: false });
    }
  });

  it("are well formed: every stage, known layers and fields, placeholders naming their controls, presets of their controls", () => {
    for (const effect of textTreatments) expect(textTreatmentIssues(effect), effect.id).toEqual([]);
  });

  it("all have the agent's colour as `color`, and presets that change the look", () => {
    for (const effect of textTreatments) {
      const color = effectControls(effect).find((c) => c.name === "color");
      expect(color?.color, effect.id).toBe(true);
      expect(effect.presets?.length, effect.id).toBeGreaterThanOrEqual(3);
      // One preset may name the default look (its colour), so it can be chosen back.
      const changing = (effect.presets ?? []).filter((p) => JSON.stringify(effectDefaults(effect, { preset: p.name })) !== JSON.stringify(effectDefaults(effect)));
      expect(changing.length, effect.id).toBeGreaterThanOrEqual((effect.presets?.length ?? 0) - 1);
    }
  });

  it("draw something for every stage over a range, and every stage without motion", () => {
    for (const effect of textTreatments) {
      for (const stage of TEXT_TREATMENT_STAGES) {
        for (const reduceMotion of [false, true]) {
          const duration = textTreatmentDuration(effect, stage, twoLines, { reduceMotion });
          expect(duration, `${effect.id} ${stage}`).toBeGreaterThan(0);
          // The middle of a stage always draws something (a fade in or out is half there).
          const plan = textTreatmentPlan(effect, { stage, time: duration / 2, target: twoLines, reduceMotion });
          expect(plan.layers.length, `${effect.id} ${stage} reduced=${reduceMotion}`).toBeGreaterThan(0);
          for (const layer of plan.layers) {
            expect(Number.isFinite(layer.x + layer.y + layer.width + layer.height + layer.opacity)).toBe(true);
            expect(layer.opacity).toBeGreaterThan(0);
            expect(layer.opacity).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it("finish their stages, except the looping ones", () => {
    for (const effect of textTreatments) {
      for (const stage of TEXT_TREATMENT_STAGES) {
        const plan = textTreatmentPlan(effect, { stage, time: 60_000, target: twoLines });
        expect(plan.done, `${effect.id} ${stage}`).toBe(!effect.stages[stage].loop);
      }
    }
  });

  it("checks a resolved treatment's placeholders against its controls", () => {
    const broken: TextTreatmentEffect = {
      ...softSweep,
      id: "broken",
      stages: {
        ...softSweep.stages,
        landed: { duration: "{{nope}}", layers: [{ type: "fill", color: "{{landMs}}", radius: "{{color}}", if: "{{landMs}}" }, { type: "blob" as never }] },
      },
      presets: [{ name: "Bad", values: { missing: 1 } }],
    };
    const issues = textTreatmentIssues(broken).join("\n");
    expect(issues).toMatch(/"\{\{nope\}\}", which is not a control/);
    expect(issues).toMatch(/names "landMs", not a colour control, where a colour goes/);
    expect(issues).toMatch(/names "color", a colour control, where a number goes/);
    expect(issues).toMatch(/"if" takes a bool control/);
    expect(issues).toMatch(/a layer's type is one of fill, band/);
    expect(issues).toMatch(/preset "Bad" sets "missing"/);
  });
});

describe("the soft sweep (the writing partner's look)", () => {
  it("sweeps a band 40% of each line wide across it, 0.32 s plus 1.5 ms a px, each line 80 ms after the last", () => {
    const target = { lines: [line, { ...line, y: 44, width: 60 }] };
    // As Swash times it: by each line's own width (not the grown rectangle's).
    expect(textTreatmentDuration(softSweep, "checking", target)).toBeCloseTo(80 + 320 + 1.5 * 60, 6);
    const start = textTreatmentPlan(softSweep, { stage: "checking", time: 0, target });
    expect(start.layers).toEqual([]);
    // Halfway through the first line's sweep (eased in-out, so exactly halfway across).
    const d = 320 + 1.5 * 100;
    const mid = textTreatmentPlan(softSweep, { stage: "checking", time: d / 2, target });
    const band = mid.layers[0]!;
    expect(band).toMatchObject({ kind: "rect", source: "band", z: "behind", radius: 3 });
    // The line grown 2 px either side and shrunk 1 px top and bottom: 104 × 16.
    expect(band.y).toBe(21);
    expect(band.height).toBe(16);
    const bw = 0.4 * 104;
    expect(band.gradient!.x1 - band.gradient!.x0).toBeCloseTo(bw, 6);
    expect(band.gradient!.x0).toBeCloseTo(8 + 0.5 * (104 + bw) - bw, 6);
    expect(band.gradient!.stops.map((s) => s.color[3])).toEqual([0, 0.22, 0]);
    // The agent's colour: systemPurple.
    expect(band.color.slice(0, 3).map((c) => Math.round(c * 255))).toEqual([0xaf, 0x52, 0xde]);
  });

  it("grows the selection from its start over 180 ms, eased out, with the caret at the end", () => {
    const target = { lines: [line], caret: { x: 110, y: 20, height: 18 }, label: "Partner" };
    const half = textTreatmentPlan(softSweep, { stage: "selecting", time: 90, target });
    const selection = half.layers.find((l) => l.source === "fill")!;
    expect(selection.x).toBe(10);
    expect(selection.width).toBeCloseTo(100 * ease("ease-out", 0.5), 6);
    expect(selection.color[3]).toBeCloseTo(0.22, 6);
    expect(half.layers.find((l) => l.source === "caret")).toMatchObject({ x: 109, y: 20, width: 2, height: 18, radius: 1 });
    expect(half.layers.find((l) => l.source === "tag")).toMatchObject({ kind: "tag", text: "Partner", x: 109 });
    expect(textTreatmentPlan(softSweep, { stage: "selecting", time: 180, target }).done).toBe(true);
  });

  it("covers the old word while typing, draws what is typed over it in the host's font, with a faint tint", () => {
    const plan = textTreatmentPlan(softSweep, { stage: "typing", time: 0, target: { ...twoLines, font: "16px Georgia" } });
    expect(plan.layers.map((l) => l.source)).toEqual(["cover", "cover", "fill", "fill", "ghost", "caret", "tag"]);
    expect(plan.layers[0]!.color).toEqual([1, 1, 1, 1]);
    expect(plan.layers[4]).toMatchObject({ kind: "text", text: "word", font: "16px Georgia", x: 40, y: 0 });
    // Without a background, there is nothing to cover with.
    const bare = textTreatmentPlan(softSweep, { stage: "typing", time: 0, target: { ...twoLines, background: undefined } });
    expect(bare.layers.some((l) => l.source === "cover")).toBe(false);
  });

  it("tints what changed, then fades it", () => {
    const target = { lines: [line] };
    expect(textTreatmentPlan(softSweep, { stage: "landed", time: 100, target }).layers[0]!.opacity).toBe(1);
    const late = textTreatmentPlan(softSweep, { stage: "landed", time: 800, target }).layers[0]!;
    expect(late.opacity).toBeGreaterThan(0);
    expect(late.opacity).toBeLessThan(1);
    expect(late.color[3]).toBeCloseTo(0.16, 6);
    expect(textTreatmentPlan(softSweep, { stage: "landed", time: 900, target }).layers).toEqual([]);
  });

  it("without motion: the sweep held mid-line fades in and out; the tint fades out", () => {
    const target = { lines: [line] };
    const d = textTreatmentDuration(softSweep, "checking", target, { reduceMotion: true });
    const atStart = textTreatmentPlan(softSweep, { stage: "checking", time: 0, target, reduceMotion: true });
    expect(atStart.reduced).toBe(true);
    expect(atStart.layers).toEqual([]);
    const mid = textTreatmentPlan(softSweep, { stage: "checking", time: d / 2, target, reduceMotion: true });
    const moving = textTreatmentPlan(softSweep, { stage: "checking", time: d / 2, target });
    expect(mid.layers[0]!.opacity).toBe(1);
    expect(mid.layers[0]!.gradient).toEqual(moving.layers[0]!.gradient);
    const later = textTreatmentPlan(softSweep, { stage: "checking", time: d * 0.9, target, reduceMotion: true });
    // Held where it was: the band does not move, it fades.
    expect(later.layers[0]!.gradient).toEqual(mid.layers[0]!.gradient);
    expect(later.layers[0]!.opacity).toBeLessThan(1);
    const land = textTreatmentPlan(softSweep, { stage: "landed", time: 450, target, reduceMotion: true });
    expect(land.layers[0]!.opacity).toBeCloseTo(0.5, 6);
  });

  it("takes values and presets: the agent's colour, as a CSS colour too", () => {
    const blue = textTreatmentPlan(softSweep, { stage: "landed", time: 0, target: { lines: [line] }, preset: "Blue" });
    expect(blue.layers[0]!.color.slice(0, 3).map((c) => Math.round(c * 255))).toEqual([0, 122, 255]);
    const green = textTreatmentPlan(softSweep, { stage: "landed", time: 0, target: { lines: [line] }, values: { color: "#00ff00" } });
    expect(green.layers[0]!.color.slice(0, 3)).toEqual([0, 1, 0]);
    expect(resolveTextTreatment(softSweep, effectDefaults(softSweep)).checking.duration).toBe(320);
  });

  it("draws a caret that blinks, when asked, with a name tag that can be turned off", () => {
    const target = { caret: { x: 5, y: 0, height: 20 }, label: "Claude" };
    const steady = textTreatmentPlan(softSweep, { stage: "caret", time: 800, target });
    expect(steady.layers.map((l) => l.source)).toEqual(["caret", "tag"]);
    const off = textTreatmentPlan(softSweep, { stage: "caret", time: 800, target, values: { blink: true } });
    expect(off.layers.map((l) => l.source)).toEqual(["tag"]);
    // It loops: one pass later, it is on again.
    expect(textTreatmentPlan(softSweep, { stage: "caret", time: 1060 + 100, target, values: { blink: true } }).layers.map((l) => l.source)).toEqual(["caret", "tag"]);
    expect(textTreatmentPlan(softSweep, { stage: "caret", time: 0, target, values: { nameTag: false } }).layers.map((l) => l.source)).toEqual(["caret"]);
    expect(textTreatmentPlan(softSweep, { stage: "caret", time: 0, target: { caret: target.caret } }).layers.map((l) => l.source)).toEqual(["caret"]);
  });
});

describe("planning a stage", () => {
  it("crosses wrapped lines as one strip with flow sequence", () => {
    const marker = getTextTreatment("marker-swipe")!;
    const d = textTreatmentDuration(marker, "selecting", twoLines);
    // Revealed a third of the way along the 120 + 60 px strip (plus padding): only the first line shows.
    const early = textTreatmentPlan(marker, { stage: "selecting", time: 0.1 * d, target: twoLines });
    const fills = early.layers.filter((l) => l.source === "fill");
    expect(fills).toHaveLength(1);
    expect(fills[0]!.x).toBe(38);
    const done = textTreatmentPlan(marker, { stage: "selecting", time: d, target: twoLines });
    expect(done.layers.filter((l) => l.source === "fill").map((l) => [l.x, l.width])).toEqual([
      [38, 124],
      [-2, 64],
    ]);
  });

  it("puts design-frame handles at the corners of the whole range", () => {
    const frame = getTextTreatment("design-frame")!;
    const plan = textTreatmentPlan(frame, { stage: "selecting", time: 1000, target: twoLines });
    const handles = plan.layers.filter((l) => l.source === "handles");
    expect(handles.map((h) => [h.x + h.width / 2, h.y + h.height / 2])).toEqual([
      [-3, -2],
      [163, -2],
      [-3, 46],
      [163, 46],
    ]);
  });

  it("refuses a bad stage, time, target, preset or value with a sentence", () => {
    const plan = (o: Partial<Parameters<typeof textTreatmentPlan>[1]>) => () => textTreatmentPlan(softSweep, { stage: "checking", time: 0, target: { lines: [line] }, ...o } as never);
    expect(plan({ stage: "sweeping" as never })).toThrow(/no stage "sweeping".*caret.*checking.*selecting.*typing.*landed/);
    expect(plan({ time: -1 })).toThrow(/0 or more/);
    expect(plan({ target: { lines: [{ x: 0, y: 0, width: -3, height: 10 }] } })).toThrow(/Line 0 of the target/);
    expect(plan({ target: { lines: "nope" as never } })).toThrow(/list of rectangles/);
    expect(plan({ target: { caret: { x: 0, y: 0 } as never } })).toThrow(/caret is \{ x, y, height \}/);
    expect(plan({ target: { color: "not a colour" } })).toThrow(/color is a colour/);
    expect(plan({ preset: "Nope" })).toThrow(/its presets are "Purple"/);
    expect(plan({ values: { sweepAlpha: 5 } })).toThrow(/sweepAlpha/);
    expect(plan({ values: { nope: 1 } })).toThrow(/no control "nope"/);
  });

  it("eases like CSS: named curves and control points", () => {
    expect(ease("linear", 0.3)).toBe(0.3);
    expect(ease("ease-in-out", 0.5)).toBeCloseTo(0.5, 9);
    expect(cubicBezier(0.42, 0, 1, 1, 0.5)).toBeCloseTo(0.3153, 3);
    expect(ease([0, 0, 1, 1], 0.25)).toBeCloseTo(0.25, 6);
    expect(ease("ease-out", 0)).toBe(0);
    expect(ease("ease-out", 1)).toBe(1);
  });
});

describe("the ribbon curl", () => {
  const curl = getTextTreatment("ribbon-curl")!;
  const target = { lines: [{ x: 100, y: 40, width: 60, height: 20 }], caret: { x: 160, y: 40, height: 20 } };
  const ribbons = (time: number, o: { preset?: string; reduceMotion?: boolean } = {}) =>
    textTreatmentPlan(curl, { stage: "landed", time, target, ...o }).layers.filter((l) => l.source === "ribbon");
  /** The curl's line height here: 3.2 line heights wide, scaled down to fit the 60 px word. */
  const uy = 20 * Math.min(1, 60 / (3.2 * 20));
  const near = (a: number | undefined, b: number) => a !== undefined && Math.abs(a - b) < 1e-9;
  /** The main ribbon (glow 0.05 line heights), its woven pieces joined back up in order, and their layers. */
  const main = (time: number, o: { reduceMotion?: boolean } = {}) => {
    const parts = ribbons(time, o).filter((l) => near(l.glow, 0.05 * uy));
    return { parts, segments: parts.flatMap((l) => l.segments!), opacity: parts[0]?.opacity ?? 0 };
  };
  /** The frost (glow 0.12 line heights on light pages, 0.2 with the dark theme), joined up. */
  const frost = (time: number, o: { preset?: string } = {}) => ribbons(time, o).filter((l) => near(l.glow, 0.12 * uy) || near(l.glow, 0.2 * uy));

  it("draws its ribbon on from the tail, thickening and turning from the tail colour to the agent's", () => {
    const early = main(150);
    const drawn = main(1000);
    expect(early.parts[0]!.kind).toBe("path");
    expect(early.segments.length).toBeLessThan(drawn.segments.length);
    const first = drawn.segments[0]!;
    const last = drawn.segments.at(-1)!;
    // Peach at the tail, violet at the head.
    const [r, , b] = first.color.map((c) => Math.round(c * 255));
    expect(r).toBe(255);
    expect(b).toBeLessThan(150);
    expect(last.color[2]).toBeGreaterThan(last.color[0]);
    const width = (seg: { points: [number, number][] }) => Math.hypot(seg.points[0]![0] - seg.points[3]![0], seg.points[0]![1] - seg.points[3]![1]);
    // It swells from the tail (then narrows to a point at the head).
    expect(Math.max(...drawn.segments.map(width))).toBeGreaterThan(width(first) * 4);
    // It stays on the changed word: its line runs from x 100 to 160, y 40 to 60.
    const xs = drawn.segments.flatMap((seg) => seg.points.map((q) => q[0]));
    const ys = drawn.segments.flatMap((seg) => seg.points.map((q) => q[1]));
    expect(Math.min(...xs)).toBeGreaterThan(100 - 3);
    expect(Math.max(...xs)).toBeLessThan(160 + 3);
    expect(Math.min(...ys)).toBeGreaterThan(40 - 0.25 * 20);
    expect(Math.max(...ys)).toBeLessThan(60 + 0.25 * 20);
    // Translucent: each woven piece is drawn at the ribbon's opacity.
    expect(drawn.opacity).toBeLessThanOrEqual(0.7);
    expect(drawn.opacity).toBeGreaterThan(0.6);
  });

  it("keeps its shape and scales with the text: on the end of a long word, scaled down evenly to fit a short one, its glow and head in proportion", () => {
    const at = (lines: { x: number; y: number; width: number; height: number }[]) =>
      textTreatmentPlan(curl, { stage: "landed", time: 1000, target: { lines } }).layers.filter((l) => l.source === "ribbon" && l.segments!.length > 3);
    const bounds = (layers: ReturnType<typeof at>) => {
      const xs = layers.flatMap((l) => l.segments!.flatMap((g) => g.points.map((q) => q[0])));
      return { left: Math.min(...xs), right: Math.max(...xs), glow: Math.max(...layers.map((l) => l.glow ?? 0)) };
    };
    // A long word 20 px tall: the curl is 64 px wide, on its end.
    const long = bounds(at([{ x: 0, y: 0, width: 300, height: 20 }]));
    expect(long.right).toBeGreaterThan(290);
    expect(long.left).toBeGreaterThan(300 - 64 - 3);
    // The same word at half the size: everything halves, glow included.
    const small = bounds(at([{ x: 0, y: 0, width: 150, height: 10 }]));
    expect(small.right - small.left).toBeCloseTo((long.right - long.left) / 2, 0);
    expect(small.glow).toBeCloseTo(long.glow / 2, 6);
    // A short word: scaled down (not squeezed) to fit, centred on it once it can shrink no further.
    const short = bounds(at([{ x: 100, y: 0, width: 20, height: 20 }]));
    expect(short.right - short.left).toBeLessThan(0.45 * 64 + 4);
    expect((short.left + short.right) / 2).toBeCloseTo(110, -1);
    // The head narrows to a point.
    const segs = at([{ x: 0, y: 0, width: 300, height: 20 }]).flatMap((l) => l.segments!);
    const width = (g: { points: [number, number][] }) => Math.hypot(g.points[0]![0] - g.points[3]![0], g.points[0]![1] - g.points[3]![1]);
    expect(width(segs.at(-1)!)).toBeLessThan(0.5 * Math.max(...segs.map(width)));
  });

  it("weaves through the word: under the letters along the tail and the downstroke, over them on the loop and the arc", () => {
    const drawn = main(1000);
    expect(drawn.parts.map((l) => l.z)).toEqual(["behind", "above", "behind", "above"]);
    // The pieces are the curve in order, with nothing lost at the crossings.
    expect(drawn.segments.length).toBe(main(1000).parts.reduce((n, l) => n + l.segments!.length, 0));
    // Sparkles in an under-stretch go under too.
    const sparkles = textTreatmentPlan(curl, { stage: "landed", time: 1000, target }).layers.filter((l) => l.source === "sparkles");
    expect(new Set(sparkles.map((l) => l.z))).toEqual(new Set(["behind", "above"]));
  });

  it("dissolves into frost: pale on light pages, a glowing screen-blended lilac with the dark theme", () => {
    expect(frost(150)).toEqual([]);
    expect(main(1450).parts).toEqual([]);
    const light = frost(1450);
    expect(light.length).toBeGreaterThan(0);
    expect(light.every((l) => l.blend === "normal" && near(l.glow, 0.12 * uy))).toBe(true);
    const dark = frost(1450, { preset: "Dark theme" });
    expect(dark.every((l) => l.blend === "screen")).toBe(true);
    expect(dark[0]!.color.slice(0, 3).map((c) => Math.round(c * 255))).toEqual([0xb9, 0xa6, 0xff]);
    expect(ribbons(1900)).toEqual([]);
  });

  it("sheds the same sparkles every time, and holds the drawn curl without motion", () => {
    const sparkles = (t: number) => textTreatmentPlan(curl, { stage: "landed", time: t, target }).layers.filter((l) => l.source === "sparkles");
    expect(sparkles(700).length).toBeGreaterThan(5);
    expect(sparkles(700)).toEqual(sparkles(700));
    expect(treatmentHash(0)).toBe(treatmentHash(0));
    expect(new Set(Array.from({ length: 50 }, (_, i) => treatmentHash(i))).size).toBe(50);
    expect(main(950, { reduceMotion: true }).segments.length).toBe(main(1000).segments.length);
  });

  it("refuses a curve with the wrong number of points", () => {
    const bad: TextTreatmentEffect = { ...curl, id: "bad-curl", stages: { ...curl.stages, landed: { duration: 100, layers: [{ type: "ribbon", points: [[0, 0], [1, 1]] }] } } };
    expect(textTreatmentIssues(bad).join(" ")).toMatch(/points are a start point and then three/);
    const tangled: TextTreatmentEffect = { ...curl, id: "tangled", stages: { ...curl.stages, landed: { duration: 100, layers: [{ type: "ribbon", points: [[0, 0], [1, 1], [2, 2], [3, 3]], behind: [[0.6, 0.2]] }] } } };
    expect(textTreatmentIssues(tangled).join(" ")).toMatch(/behind is a list of \[from, to\] stretches/);
  });
});

describe("text treatments for agents", () => {
  type Answer = { id: string; stage: string; duration: number; loop?: boolean; reduced?: boolean; target?: string; samples: { time: number; done?: boolean; count: number; layers: { source: string; rect: number[]; color: string; opacity: number }[] }[] };

  it("finds them with catalog.search and shows what a stage draws with catalog.treatment", async () => {
    const editor = createEffectEditor({ from: "aurora" });
    const provider = createEffectToolProvider(editor);
    const search = await callTool(provider, "run_command", { id: "catalog.search", params: { kind: "text-treatment", limit: 50 } });
    const found = (search.structuredContent as { result: { effects: { id: string }[] } }).result.effects.map((e) => e.id);
    expect(found.sort()).toEqual(textTreatments.map((e) => e.id).sort());

    const sweep = await callTool(provider, "run_command", { id: "catalog.treatment", params: { id: "soft-sweep", stage: "landed", times: [100, 900], values: { color: "#0a84ff" }, target: { lines: [line] } } });
    expect(sweep.isError).toBeFalsy();
    const result = (sweep.structuredContent as { result: Answer }).result;
    expect(result).toMatchObject({ id: "soft-sweep", stage: "landed", duration: 900 });
    expect(result.target).toBeUndefined();
    expect(result.samples[0]!.layers[0]).toMatchObject({ source: "fill", rect: [10, 20, 100, 18], color: "#0a84ff", opacity: 1 });
    expect(result.samples[1]).toMatchObject({ time: 900, done: true, count: 0 });

    // Without a target: a sample phrase, and it says so.
    const caret = editor.commands.execute<Answer>("catalog.treatment", { id: "presence", stage: "caret", reduceMotion: true });
    if (!caret.ok) throw new Error(caret.message);
    expect(caret.result).toMatchObject({ loop: true, reduced: true, target: expect.stringMatching(/sample/) });
    expect(caret.result.samples).toHaveLength(3);
  });

  it("refuses what is wrong, saying what would be right", async () => {
    const editor = createEffectEditor({ from: "aurora" });
    const run = (params: unknown) => editor.commands.execute("catalog.treatment", params);
    expect(run({ id: "soft-swep", stage: "checking" })).toMatchObject({ ok: false, message: expect.stringMatching(/no effect "soft-swep".*soft-sweep/) });
    expect(run({ id: "aurora", stage: "checking" })).toMatchObject({ ok: false, message: expect.stringMatching(/"aurora" is a shader effect, not a text treatment/) });
    expect(run({ id: "soft-sweep", stage: "sweep" })).toMatchObject({ ok: false });
    expect(run({ id: "soft-sweep" })).toMatchObject({ ok: false });
    expect(run({ id: "soft-sweep", stage: "checking", values: { sweepAlpha: 3 } })).toMatchObject({ ok: false, message: expect.stringMatching(/sweepAlpha/) });
    expect(run({ id: "soft-sweep", stage: "checking", preset: "Nope" })).toMatchObject({ ok: false, message: expect.stringMatching(/its presets are/) });
    expect(run({ id: "soft-sweep", stage: "checking", times: [-5] })).toMatchObject({ ok: false });
    expect(run({ id: "soft-sweep", stage: "checking", times: Array(21).fill(0) })).toMatchObject({ ok: false });
    expect(run({ id: "soft-sweep", stage: "checking", target: { lines: [{ x: 0, y: 0, width: 10 }] } })).toMatchObject({ ok: false });
    const provider = createEffectToolProvider(editor);
    const load = await callTool(provider, "run_command", { id: "effect.load", params: { id: "soft-sweep" } });
    expect(load.isError).toBe(true);
    expect(JSON.stringify(load.content)).toMatch(/text treatment.*catalog\.treatment/);
  });
});
