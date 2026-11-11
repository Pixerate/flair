import { describe, expect, it } from "vitest";
import { checkControlValue } from "../shader/controls.js";
import { planOf } from "../integrations/effects.js";
import { effectMeta, getEffect } from "./index.js";
import { EFFECT_META, getEffectMeta } from "./lazy.js";
import { PAINT_HINTS, PAINT_MAPS, PAINT_REPEATS, paintHint } from "./paint.js";

const hinted = Object.entries(PAINT_HINTS);

/** Categories whose effects never make good paint: they need sound, or are type, widgets or banners. */
const NEVER_PAINT = new Set(["audio", "text", "loader", "meme", "broadcast", "annotation", "icon", "scroll", "3d", "camera", "timing", "transition"]);

describe("paint hints", () => {
  it("are on some of the effects that draw a picture of their own, well under half of them", () => {
    const candidates = EFFECT_META.filter((m) => m.kind === "shader" && planOf(m).uses.some((u) => u === "generator" || u === "overlay" || u === "title"));
    expect(hinted.length).toBeGreaterThan(40);
    expect(hinted.length).toBeLessThan(candidates.length / 2);
  });

  it.each(hinted)("%s names a catalog shader that shows something without audio, a pointer or a picture", (id) => {
    const meta = getEffectMeta(id);
    expect(meta, `no catalog effect "${id}"`).toBeDefined();
    expect(meta!.kind).toBe("shader");
    const plan = planOf(meta!);
    expect(plan.uses.some((u) => u === "generator" || u === "overlay")).toBe(true);
    expect(plan.uses).not.toContain("title");
    expect(NEVER_PAINT.has(meta!.category), `${id} is ${meta!.category}`).toBe(false);
    expect(plan.inputs.filter((i) => i.required)).toEqual([]);
    expect(meta!.inputs.accepts).not.toContain("audio");
    expect(meta!.inputs.accepts).not.toContain("image");
    // Click and cursor effects wait for the pointer; hover effects show themselves without it.
    expect(meta!.inputs.interactions).not.toContain("click");
  });

  it.each(hinted)("%s names real controls, with values they take", (id, hint) => {
    const controls = new Map(getEffectMeta(id)!.controls.map((c) => [c.name, c]));
    expect(PAINT_MAPS).toContain(hint.map);
    const colors = hint.colors ?? [];
    expect(colors.length).toBeLessThanOrEqual(2);
    expect(new Set(colors).size).toBe(colors.length);
    for (const name of colors) {
      expect(controls.get(name)?.color, `${id}: colour ${name} is not one of its colour controls`).toBe(true);
    }
    for (const [name, value] of Object.entries(hint.values ?? {})) {
      const control = controls.get(name);
      expect(control, `${id}: ${name} is not one of its controls`).toBeDefined();
      expect(checkControlValue(control!, value)).toMatchObject({ ok: true });
      expect(value, `${id}: ${name} is already ${JSON.stringify(value)} by default`).not.toEqual(control!.default);
      expect(control!.type).not.toBe("path");
    }
    if (hint.map === "path") expect([...controls.values()].some((c) => c.type === "path"), `${id} has no path control`).toBe(true);
    if (hint.repeat !== undefined) {
      expect(hint.map).toBe("stroke");
      expect(PAINT_REPEATS).toContain(hint.repeat);
    }
    if (hint.size !== undefined) expect(hint.size > 0 && hint.size <= 512).toBe(true);
  });

  it("follow the stroke for every path effect drawn along a path given at run time", () => {
    // A path effect that makes good paint draws along the stroke; one whose path is a scene's (a title's, say) gets none.
    for (const [id, hint] of hinted) {
      if (getEffectMeta(id)!.controls.some((c) => c.type === "path") && getEffectMeta(id)!.category === "path") expect(hint.map, id).toBe("path");
    }
  });

  it("reach the catalog's metadata (the lazy catalog's and effectMeta's)", () => {
    for (const meta of EFFECT_META) expect(meta.paint, meta.id).toEqual(paintHint(meta.id));
    expect(effectMeta(getEffect("lava-flow")!).paint).toEqual(PAINT_HINTS["lava-flow"]);
    expect(paintHint("planet")).toBeUndefined();
    expect(paintHint("toString")).toBeUndefined();
  });

  it("are dropped from an edited copy whose controls no longer match", () => {
    const lava = getEffect("lava-flow")!;
    if (lava.kind !== "shader") throw new Error("lava-flow is a shader");
    const edited = { ...lava, source: lava.source.replace(/uniform vec3 uLava;[^\n]*\n/, "") };
    expect(effectMeta(edited).paint).toBeUndefined();
  });
});
