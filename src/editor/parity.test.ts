/**
 * Parity between `@pixerate/editor`'s animation editor and Flair's motion
 * primitives: for every editor command that names a Flair primitive
 * (`motionFlairPrimitive`), a scene playing it is exported with
 * `toFlairSvgMotion`, the same primitive is applied to the same picture with
 * Flair's `applyPrimitive`, and both are played with `svgFrame`. The two may
 * build the motion differently (the editor moves the element itself, Flair
 * moves a wrapper group; their wrapper and clip ids differ), so what is
 * compared is what the target *shows*: its opacity (the product down its
 * ancestors), its composed transform (as a matrix), how much of its stroke
 * is drawn, the clips over it (in the viewBox's units) and its paints.
 */

import {
  createMotionScene,
  motionCommandDuration,
  motionFlairPrimitive,
  toFlairSvgMotion,
  type MotionCommand,
  type MotionScene,
} from "@pixerate/editor/animation-editor";
import { describe, expect, it } from "vitest";
import { applyPrimitive, getPrimitive, MOVE_EASE, PRIMITIVES } from "../motion/index.js";
import { localBox, multiply, transformBox, type Matrix } from "../motion/geometry.js";
import { scanMarkup, type MarkupElement } from "../motion/markup.js";
import { transformMatrix } from "../vector/animated.js";
import { easeFunction, svgFrame, svgMotionIssues, type SvgEase, type SvgMotion } from "../vector/motion.js";

// ── The picture ─────────────────────────────────────────────────────

/** A filled, stroked card (not square, so an iris is an ellipse) and a curved route to follow. */
const ARTWORK = {
  width: 200,
  height: 100,
  nodes: [
    { id: "card", type: "path", fill: "#336699", stroke: "#112233", strokeWidth: 2, subpaths: [{ closed: true, anchors: [{ x: 20, y: 20 }, { x: 80, y: 20 }, { x: 80, y: 60 }, { x: 20, y: 60 }] }] },
    { id: "route", type: "path", stroke: "#000000", strokeWidth: 1, subpaths: [{ closed: false, anchors: [{ x: 10, y: 80, out: { x: 60, y: 0 } }, { x: 190, y: 40, in: { x: 140, y: 100 } }] }] },
  ],
} as unknown as MotionScene["artwork"];

const scene = (run: MotionCommand[]): MotionScene => createMotionScene(ARTWORK, { name: "parity", shots: [{ id: "s", run }] });

/** The artwork as the editor writes it, with nothing moving: the picture Flair applies primitives to. */
const BASE: SvgMotion = { svg: toFlairSvgMotion(scene([{ type: "wait", duration: 100 }])).motion.svg };

// ── The cases: editor commands and the Flair uses they should match ──

interface Case {
  name: string;
  command: MotionCommand;
  /** Flair's ease for the main change, when the comparison needs one other than the primitive's (see the cases). */
  ease?: SvgEase;
}

const card = { targets: ["card"] };
const CASES: Case[] = [
  { name: "enter fade", command: { type: "enter", ...card } },
  { name: "enter pop", command: { type: "enter", style: "pop", ...card } },
  { name: "enter pop from 0.2", command: { type: "enter", style: "pop", scale: 0.2, ...card } },
  { name: "enter grow", command: { type: "enter", style: "grow", ...card } },
  { name: "enter slide", command: { type: "enter", style: "slide", ...card } },
  { name: "enter slide left 60", command: { type: "enter", style: "slide", direction: "left", distance: 60, ...card } },
  // The editor times a draw by the outline's length; Flair's default is 600 ms, so both are given 600.
  { name: "enter draw", command: { type: "enter", style: "draw", duration: 600, ...card }, ease: "in-out" },
  { name: "enter zoom", command: { type: "enter", style: "zoom", ...card } },
  { name: "enter zoom from 0.4", command: { type: "enter", style: "zoom", scale: 0.4, ...card } },
  { name: "enter rise", command: { type: "enter", style: "rise", ...card } },
  { name: "enter rise 35", command: { type: "enter", style: "rise", distance: 35, ...card } },
  { name: "enter wipe", command: { type: "enter", style: "wipe", ...card } },
  { name: "enter wipe left", command: { type: "enter", style: "wipe", direction: "left", ...card } },
  { name: "enter wipe up", command: { type: "enter", style: "wipe", direction: "up", ...card } },
  { name: "enter wipe down", command: { type: "enter", style: "wipe", direction: "down", ...card } },
  { name: "enter iris", command: { type: "enter", style: "iris", ...card } },
  { name: "enter iris box", command: { type: "enter", style: "iris", shape: "box", ...card } },
  { name: "enter split", command: { type: "enter", style: "split", ...card } },
  { name: "enter split vertical", command: { type: "enter", style: "split", orientation: "vertical", ...card } },
  { name: "exit fade", command: { type: "exit", ...card } },
  { name: "exit shrink", command: { type: "exit", style: "shrink", ...card } },
  { name: "exit slide", command: { type: "exit", style: "slide", ...card } },
  { name: "exit slide right 25", command: { type: "exit", style: "slide", direction: "right", distance: 25, ...card } },
  { name: "exit undraw", command: { type: "exit", style: "undraw", duration: 450, ...card }, ease: "in-out" },
  { name: "exit wipe", command: { type: "exit", style: "wipe", ...card } },
  { name: "exit wipe up", command: { type: "exit", style: "wipe", direction: "up", ...card } },
  { name: "pulse", command: { type: "pulse", ...card } },
  { name: "pulse 0.4 twice", command: { type: "pulse", amount: 0.4, count: 2, ...card } },
  { name: "shake", command: { type: "shake", ...card } },
  { name: "shake vertical", command: { type: "shake", axis: "vertical", amount: 12, count: 5, ...card } },
  { name: "teeter", command: { type: "teeter", ...card } },
  { name: "teeter 20 twice", command: { type: "teeter", angle: 20, count: 2, ...card } },
  { name: "wave", command: { type: "wave", ...card } },
  { name: "wave 10 three times", command: { type: "wave", amount: 10, count: 3, ...card } },
  { name: "wiggle", command: { type: "wiggle", ...card } },
  { name: "wiggle turning, seeded", command: { type: "wiggle", amount: 4, frequency: 2, octaves: 3, rotate: 15, seed: 7, ...card } },
  { name: "color-pulse", command: { type: "color-pulse", ...card } },
  { name: "color-pulse stroke", command: { type: "color-pulse", paint: "stroke", color: "#ff0000", count: 2, ...card } },
  { name: "rotate by 90", command: { type: "rotate", by: 90, ...card }, ease: "in-out" },
  { name: "rotate by -450", command: { type: "rotate", by: -450, ...card }, ease: "in-out" },
  { name: "follow", command: { type: "follow", path: "route", ...card }, ease: "in-out" },
  { name: "follow turning, part way", command: { type: "follow", path: "route", rotate: true, from: 0.2, to: 0.8, ...card }, ease: "in-out" },
];

/** The Flair parameters an editor command stands for (same names and defaults, per `motionFlairPrimitive`). */
function flairParams(c: MotionCommand): Record<string, unknown> {
  const pick = (entries: [string, unknown][]) => Object.fromEntries(entries.filter(([, v]) => v !== undefined));
  switch (c.type) {
    case "enter":
      return pick([
        ["direction", c.direction],
        ["distance", c.distance],
        ["from", c.scale],
        ["shape", c.shape],
        ["orientation", c.orientation],
      ]);
    case "exit":
      return pick([["direction", c.direction], ["distance", c.distance]]);
    case "pulse":
      return pick([["amount", c.amount], ["count", c.count]]);
    case "shake":
      return pick([["amount", c.amount], ["count", c.count], ["axis", c.axis]]);
    case "teeter":
      return pick([["angle", c.angle], ["count", c.count]]);
    case "wave":
      return pick([["amount", c.amount], ["count", c.count]]);
    case "wiggle":
      return pick([["amount", c.amount], ["frequency", c.frequency], ["octaves", c.octaves], ["rotate", c.rotate], ["seed", c.seed]]);
    case "color-pulse":
      return pick([["color", c.color], ["attribute", c.paint], ["count", c.count]]);
    case "rotate":
      return pick([["angle", c.by]]);
    case "follow":
      return pick([["path", c.path], ["orient", c.rotate], ["from", c.from], ["to", c.to]]);
    default:
      throw new Error(`${c.type} has no Flair primitive`);
  }
}

// ── What a target shows ─────────────────────────────────────────────

interface Shown {
  opacity: number;
  matrix: Matrix;
  draw: number;
  fill: string;
  fillOpacity: number;
  stroke: string;
  /** The clips over the target, outermost first, as boxes in the viewBox (a circle clip as its ellipse's box). */
  clips: { shape: string; box: readonly [number, number, number, number] }[];
}

/** A point `at` (0–1) of the way along a path of M, L, C and Z commands (absolute), and its direction in degrees. */
function pointAlong(d: string, at: number): { x: number; y: number; angle: number } {
  const pts: [number, number][] = [];
  const tokens = d.match(/[MLCZ]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
  let i = 0;
  let cmd = "";
  let cur: [number, number] = [0, 0];
  let start: [number, number] = [0, 0];
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[MLCZ]/i.test(tokens[i]!)) cmd = tokens[i++]!.toUpperCase();
    if (cmd === "M") {
      cur = start = [num(), num()];
      pts.push(cur);
      cmd = "L";
    } else if (cmd === "L") {
      cur = [num(), num()];
      pts.push(cur);
    } else if (cmd === "C") {
      const [p0, p1, p2, p3] = [cur, [num(), num()], [num(), num()], [num(), num()]] as [number, number][];
      for (let k = 1; k <= 2000; k++) {
        const s = k / 2000;
        const w = [(1 - s) ** 3, 3 * (1 - s) ** 2 * s, 3 * (1 - s) * s * s, s ** 3];
        pts.push([w[0]! * p0![0] + w[1]! * p1![0] + w[2]! * p2![0] + w[3]! * p3![0], w[0]! * p0![1] + w[1]! * p1![1] + w[2]! * p2![1] + w[3]! * p3![1]]);
      }
      cur = p3!;
    } else if (cmd === "Z") {
      cur = start;
      pts.push(cur);
    } else throw new Error(`pointAlong reads M, L, C and Z, not ${cmd} in ${d}`);
  }
  const lengths = [0];
  for (let k = 1; k < pts.length; k++) lengths.push(lengths[k - 1]! + Math.hypot(pts[k]![0] - pts[k - 1]![0], pts[k]![1] - pts[k - 1]![1]));
  const total = lengths[lengths.length - 1]!;
  const point = (len: number): [number, number] => {
    const l = Math.min(total, Math.max(0, len));
    let k = 1;
    while (k < pts.length - 1 && lengths[k]! < l) k++;
    const span = lengths[k]! - lengths[k - 1]! || 1;
    const u = (l - lengths[k - 1]!) / span;
    return [pts[k - 1]![0] + (pts[k]![0] - pts[k - 1]![0]) * u, pts[k - 1]![1] + (pts[k]![1] - pts[k - 1]![1]) * u];
  };
  const [x, y] = point(at * total);
  // As the player turns it: the direction a little either side of the point.
  const dd = Math.min(0.5, total / 1000);
  const a = point(at * total - dd);
  const b = point(at * total + dd);
  return { x, y, angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI };
}

/** What element `id` of `motion` shows at `timeMs`, played by `svgFrame`. */
function shown(motion: SvgMotion, id: string, timeMs: number): Shown {
  const { root, byId } = scanMarkup(motion.svg);
  const target = byId.get(id);
  if (!root || !target) throw new Error(`no element "${id}"`);
  const frames = svgFrame(motion.animate ?? [], [], timeMs);
  const chain: MarkupElement[] = [];
  for (let e: MarkupElement | undefined = target; e && e !== root; e = e.parent) chain.unshift(e);
  const attr = (e: MarkupElement, name: string) => (e.attrs.id !== undefined ? frames.get(e.attrs.id)?.attrs[name] : undefined) ?? e.attrs[name];
  const own = (e: MarkupElement): Matrix => {
    const along = e.attrs.id !== undefined ? frames.get(e.attrs.id)?.along : undefined;
    if (along) {
      // As the player places it: its transform becomes the point on the path (turned with it for `orient`).
      const path = byId.get(along.path);
      if (!path?.attrs.d) throw new Error(`no path "${along.path}" to follow`);
      const p = pointAlong(path.attrs.d, along.at);
      return transformMatrix(`translate(${p.x} ${p.y})${along.orient ? ` rotate(${p.angle})` : ""}`) as unknown as Matrix;
    }
    return transformMatrix(attr(e, "transform") ?? "") as unknown as Matrix;
  };
  const owns = chain.map(own);
  let matrix: Matrix = [1, 0, 0, 1, 0, 0];
  let opacity = 1;
  const clips: Shown["clips"] = [];
  const box = localBox(target, byId);
  if (!box) throw new Error(`cannot measure "${id}"`);
  chain.forEach((e, k) => {
    matrix = multiply(matrix, owns[k]!);
    opacity *= Number(attr(e, "opacity") ?? 1);
    const clipRef = attr(e, "clip-path");
    if (!clipRef) return;
    const clipPath = byId.get(/^url\(#(.+)\)$/.exec(clipRef)![1]!);
    expect(clipPath?.attrs.clipPathUnits).toBe("objectBoundingBox");
    const shape = clipPath!.children[0]!;
    const n = (name: string) => Number(attr(shape, name) ?? 0);
    // The clipped element's box in its own units: the target's, through what lies between.
    const inner = owns.slice(k + 1).reduce<Matrix>((m, t) => multiply(m, t), [1, 0, 0, 1, 0, 0]);
    const [bx, by, bw, bh] = transformBox(box, inner);
    const unit: [number, number, number, number] =
      shape.tag === "circle" ? [n("cx") - n("r"), n("cy") - n("r"), 2 * n("r"), 2 * n("r")] : [n("x"), n("y"), n("width"), n("height")];
    clips.push({ shape: shape.tag, box: transformBox([bx + unit[0] * bw, by + unit[1] * bh, unit[2] * bw, unit[3] * bh], matrix) });
  });
  return {
    opacity,
    matrix,
    draw: frames.get(id)?.draw ?? 1,
    fill: attr(target, "fill") ?? "#000000",
    fillOpacity: Number(attr(target, "fill-opacity") ?? 1),
    stroke: attr(target, "stroke") ?? "none",
    clips,
  };
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Differences between two frames beyond the tolerances, as sentences (none when they match). */
function differences(a: Shown, b: Shown, tol: { linear: number; shift: number }): string[] {
  const out: string[] = [];
  const near = (what: string, x: number, y: number, eps: number) => {
    if (!(Math.abs(x - y) <= eps)) out.push(`${what}: editor ${+x.toFixed(4)}, Flair ${+y.toFixed(4)}`);
  };
  near("opacity", a.opacity, b.opacity, 2e-3);
  near("fill-opacity", a.fillOpacity, b.fillOpacity, 2e-3);
  near("draw", a.draw, b.draw, 1e-3);
  a.matrix.forEach((v, i) => near(`matrix[${i}]`, v, b.matrix[i]!, i < 4 ? tol.linear : tol.shift));
  for (const [what, x, y] of [["fill", a.fill, b.fill], ["stroke", a.stroke, b.stroke]] as const) {
    if (x.startsWith("#") && y.startsWith("#")) rgb(x).forEach((c, i) => near(`${what}[${i}]`, c, rgb(y)[i]!, 1));
    else if (x !== y) out.push(`${what}: editor ${x}, Flair ${y}`);
  }
  if (a.clips.length !== b.clips.length) out.push(`clips: editor ${a.clips.length}, Flair ${b.clips.length}`);
  else
    a.clips.forEach((c, i) => {
      if (c.shape !== b.clips[i]!.shape) out.push(`clip ${i}: editor <${c.shape}>, Flair <${b.clips[i]!.shape}>`);
      c.box.forEach((v, j) => near(`clip ${i} [${"xywh"[j]}]`, v, b.clips[i]!.box[j]!, 0.02));
    });
  return out;
}

/** Times to compare at: through the change, its end and past it. */
const timesFor = (ms: number) => [0, 0.05, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.5].map((f) => Math.round(f * ms));

/** The editor's export and Flair's primitive for a case, ready to play. */
function build(c: Case) {
  const id = motionFlairPrimitive(c.command)!;
  const editorScene = scene([c.command]);
  const exported = toFlairSvgMotion(editorScene);
  const descriptor = getPrimitive(id)!;
  const ms = c.command.type === "wait" ? 0 : (c.command.duration ?? descriptor.ms);
  const applied = applyPrimitive(BASE, { primitive: id, target: "card", params: flairParams(c.command), ms, ...(c.ease && { ease: c.ease }) });
  if (!applied.ok) throw new Error(applied.message);
  return { id, exported, flair: applied.motion, ms, editorScene };
}

// ── The tests ───────────────────────────────────────────────────────

describe("the animation editor's commands and Flair's primitives", () => {
  it("name every Flair primitive, and only those", () => {
    const named = new Set(CASES.map((c) => motionFlairPrimitive(c.command)));
    expect([...named].sort()).toEqual(
      [
        "entrance.fade", "entrance.pop", "entrance.grow", "entrance.slide", "entrance.draw", "entrance.zoom", "entrance.rise", "entrance.wipe", "entrance.iris", "entrance.split",
        "exit.fade", "exit.shrink", "exit.slide", "exit.undraw", "exit.wipe",
        "emphasis.pulse", "emphasis.shake", "emphasis.teeter", "emphasis.wave", "emphasis.wiggle", "emphasis.color-pulse", "emphasis.spin",
        "path.follow",
      ].sort(),
    );
    expect([...named].sort()).toEqual(PRIMITIVES.map((p) => p.id).sort());
    // Commands that are the editor's own have none.
    for (const c of [
      { type: "move", by: { x: 1, y: 0 }, ...card },
      { type: "rotate", to: 90, ...card },
      { type: "scale", to: 2, ...card },
      { type: "fade", to: 0, ...card },
      { type: "style", fill: "#ffffff", ...card },
      { type: "draw", ...card },
      { type: "wait", duration: 100 },
    ] as MotionCommand[])
      expect(motionFlairPrimitive(c), c.type).toBeUndefined();
  });

  it("take the same default lengths (but a draw, timed by its outline's length in the editor)", () => {
    const lengths = CASES.filter((c) => c.command.type !== "wait" && c.command.duration === undefined).map((c) => {
      const id = motionFlairPrimitive(c.command)!;
      return [c.name, motionCommandDuration(c.command, scene([c.command]), "card"), getPrimitive(id)!.ms];
    });
    for (const [name, editor, flair] of lengths) expect(editor, String(name)).toBe(flair);
    expect(lengths.length).toBe(CASES.length - 2);
    // A documented difference: the editor times draw and undraw by the outline's length
    // (1.5 ms a unit, clamped to 500–2500 ms), so the card's 200-long outline takes 500 ms;
    // Flair's entrance.draw takes 600 ms and exit.undraw 450 ms whatever the length. The
    // comparisons above give both the same length.
    const lengthOf = (command: MotionCommand) => motionCommandDuration(command, scene([command]), "card");
    expect(lengthOf({ type: "enter", style: "draw", ...card })).toBe(500);
    expect(lengthOf({ type: "exit", style: "undraw", ...card })).toBe(500);
    expect([getPrimitive("entrance.draw")!.ms, getPrimitive("exit.undraw")!.ms]).toEqual([600, 450]);
  });

  it("compares closely enough to catch a different motion", () => {
    // The harness itself: changing one parameter on Flair's side shows up as a difference.
    const mismatched: [MotionCommand, Record<string, unknown>][] = [
      [{ type: "enter", style: "pop", ...card }, { from: 0.45 }],
      [{ type: "enter", style: "wipe", ...card }, { direction: "left" }],
      [{ type: "enter", style: "iris", ...card }, { shape: "box" }],
      [{ type: "exit", style: "slide", ...card }, { distance: 39 }],
      [{ type: "teeter", ...card }, { count: 2 }],
      [{ type: "wiggle", ...card }, { seed: 1 }],
      [{ type: "color-pulse", ...card }, { color: "#f5ae0b" }],
      [{ type: "follow", path: "route", ...card }, { path: "route", orient: true }],
    ];
    for (const [command, params] of mismatched) {
      const { exported, ms, id } = build({ name: "", command, ease: command.type === "follow" ? "in-out" : undefined });
      const flair = applyPrimitive(BASE, { primitive: id, target: "card", params, ms, ...(command.type === "follow" && { ease: "in-out" as const }) });
      if (!flair.ok) throw new Error(flair.message);
      const found = timesFor(ms).some((t) => differences(shown(exported.motion as SvgMotion, "card", t), shown(flair.motion, "card", t), { linear: 2e-3, shift: 0.06 }).length > 0);
      expect(found, `${id} ${JSON.stringify(params)}`).toBe(true);
    }
  });

  it("export valid motions that Flair plays without sampling", () => {
    for (const c of CASES) {
      const { exported, flair } = build(c);
      expect(svgMotionIssues(exported.motion), c.name).toEqual([]);
      expect(svgMotionIssues(flair), c.name).toEqual([]);
      expect({ name: c.name, sampled: exported.sampled, notes: exported.notes }).toEqual({ name: c.name, sampled: 0, notes: [] });
    }
  });

  it.each(CASES.map((c) => [c.name, c] as const))("%s shows the same thing played either way", (_, c) => {
    const { exported, flair, ms } = build(c);
    const problems: string[] = [];
    for (const t of timesFor(ms)) {
      const diff = differences(shown(exported.motion as SvgMotion, "card", t), shown(flair, "card", t), { linear: 2e-3, shift: 0.06 });
      if (diff.length) problems.push(`at ${t} ms: ${diff.join("; ")}`);
    }
    expect(problems).toEqual([]);
  });

  it("export moves with Flair's in-out, within 1% of the cubic-bezier both use by default", () => {
    // The editor eases spins, draws and follows with cubic-bezier(0.65, 0, 0.35, 1), Flair's
    // MOVE_EASE, but writes it as Flair's named `in-out` (cubic) because the two agree within
    // 1%; so those cases above give Flair `ease: "in-out"` to compare like with like.
    const [a, b] = [easeFunction("in-out"), easeFunction(MOVE_EASE)];
    let worst = 0;
    for (let i = 0; i <= 1000; i++) worst = Math.max(worst, Math.abs(a(i / 1000) - b(i / 1000)));
    expect(worst).toBeGreaterThan(0);
    expect(worst).toBeLessThan(0.01);
    for (const c of CASES.filter((x) => x.ease)) {
      const changes = build(c).exported.motion.animate ?? [];
      expect(changes.some((x) => x.ease === "in-out"), c.name).toBe(true);
    }
  });
});
