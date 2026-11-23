import { describe, expect, it } from "vitest";
import { svgMotionIssues } from "../vector/motion.js";
import { effectControls, effectDefaults, EFFECTS, findEffects, getEffect, renderVectorEffect, shaderRestTime, uiValues, type VectorEffect } from "./index.js";
import { loadEffect } from "./load.js";
import { NEUBRUTAL_CATEGORIES, neubrutalValues, styleDerived } from "./neubrutal.js";

const SHADERS = ["denoise-reveal", "generating-field", "agent-working-border", "change-pulse", "card-complete-burst", "dragover-attract"];
const VECTORS = ["slop-vat", "goo-drop-reveal", "memphis-burst"];
const vector = (id: string) => getEffect(id) as VectorEffect;
const controlNames = (id: string) => effectControls(getEffect(id)!).map((c) => c.name);

describe("AI product moment effects", () => {
  it("are in the catalog, in the categories the issue names", () => {
    expect(SHADERS.map((id) => [id, getEffect(id)?.kind, getEffect(id)?.category])).toEqual([
      ["denoise-reveal", "shader", "transition"],
      ["generating-field", "shader", "loader"],
      ["agent-working-border", "shader", "ui"],
      ["change-pulse", "shader", "ui"],
      ["card-complete-burst", "shader", "pyrotechnics"],
      ["dragover-attract", "shader", "interaction"],
    ]);
    expect(VECTORS.map((id) => [id, getEffect(id)?.kind, getEffect(id)?.category])).toEqual([
      ["slop-vat", "vector", "loader"],
      ["goo-drop-reveal", "vector", "transition"],
      ["memphis-burst", "vector", "icon"],
    ]);
  });

  it("draw over the page where they sit over an element, with a rest frame under reduced motion", () => {
    for (const id of ["generating-field", "agent-working-border", "change-pulse", "card-complete-burst", "dragover-attract"]) expect(getEffect(id), id).toMatchObject({ transparent: true });
    for (const id of SHADERS) expect(shaderRestTime(getEffect(id)!), id).toBeGreaterThan(0);
  });

  it("run their one-shots on uProgress, with an uAnimate loop for previews, resting at the end", () => {
    for (const id of ["denoise-reveal", "change-pulse", "card-complete-burst"]) {
      expect(controlNames(id), id).toEqual(expect.arrayContaining(["uProgress", "uAnimate"]));
    }
    expect(effectDefaults(getEffect("denoise-reveal")!).uProgress).toBe(1);
  });

  it("generating field has a preset per kind of job, each a motion of its own", () => {
    const presets = getEffect("generating-field")!.presets!;
    expect(["Image", "Video", "Audio", "Text", "Vector"].map((name) => presets.find((p) => p.name === name)?.values.uMotion)).toEqual([0, 1, 2, 3, 4]);
  });

  it("the agent border runs one beam per agent, up to four, and the change pulse has a tone for create, update and remove", () => {
    expect(effectControls(getEffect("agent-working-border")!).find((c) => c.name === "uAgents")).toMatchObject({ type: "int", min: 1, max: 4, default: 1 });
    expect(getEffect("change-pulse")!.presets!.map((p) => [p.name, p.values.uTone]).slice(0, 3)).toEqual([["Created", 0], ["Updated", 1], ["Removed", 2]]);
  });

  it("dragover attract takes the host's drag events as well as the pointer", () => {
    expect(controlNames("dragover-attract")).toEqual(expect.arrayContaining(["uHover", "uTarget", "uLanded", "uDemo"]));
  });

  it.each(VECTORS)("%s draws cleanly at its defaults and presets", (id) => {
    const effect = vector(id);
    expect(svgMotionIssues(renderVectorEffect(effect, effectDefaults(effect)))).toEqual([]);
    for (const preset of effect.presets ?? []) expect(svgMotionIssues(renderVectorEffect(effect, effectDefaults(effect, { preset: preset.name }))), preset.name).toEqual([]);
  });

  it("goo drop reveal leaves its word in the slot", () => {
    expect(renderVectorEffect(vector("goo-drop-reveal"), { ...effectDefaults(vector("goo-drop-reveal")), label: "Done" }).svg).toContain(">Done</text>");
  });

  it("memphis burst springs out its sparkles, squiggle, ring, triangle and dots", () => {
    const motion = renderVectorEffect(vector("memphis-burst"), effectDefaults(vector("memphis-burst")));
    for (const id of ["memphisSparkle", "memphisSquiggle", "memphisRing", "memphisTriangle", "memphisDot1"]) expect(motion.svg).toContain(`id="${id}"`);
  });
});

describe("loaders bound to a job's progress", () => {
  it("slop vat fills to the value, and fills and empties on its own while it cannot tell", () => {
    const vat = vector("slop-vat");
    const half = uiValues(vat, { value: 0.5 }).values;
    expect(half).toEqual({ level: 0.5, animate: false });
    const still = renderVectorEffect(vat, { ...effectDefaults(vat), ...half });
    expect(still.svg).toContain('transform="translate(0 100)"');
    const looping = renderVectorEffect(vat, { ...effectDefaults(vat), ...uiValues(vat, { value: null }).values });
    expect(looping.animate!.find((a) => a.id === "slopLevel")!.attrs!.transform).toEqual(["translate(0 148)", "translate(0 52)"]);
  });

  it("generating field takes a value 0–1 or null", () => {
    expect(uiValues(getEffect("generating-field")!, { value: 0.8 }).values).toEqual({ uProgress: 0.8, uAnimate: false });
    expect(uiValues(getEffect("generating-field")!, { value: null }).values).toEqual({ uAnimate: true });
  });
});

describe("neubrutalist style", () => {
  it("the shared controls switch a soft shadow to a hard, unblurred, offset one", () => {
    expect(styleDerived({ shadowStyle: 0, shadowOffset: 8, inkWidth: 0, sheen: 1 }, { dy: 5, blur: 4, alpha: 0.3 })).toEqual({ shDx: 0, shDy: 5, shBlur: 4, shAlpha: 0.3, inkOn: 0, sheenA: 1 });
    expect(styleDerived({ shadowStyle: 1, shadowOffset: 8, inkWidth: 3, sheen: 0 })).toEqual({ shDx: 8, shDy: 8, shBlur: 0, shAlpha: 1, inkOn: 1, sheenA: 0 });
  });

  it.each(["die-cut-sticker", "sticker-label", "speech-sticker", "sticker-wrap", "press-button", "slop-vat", "goo-drop-reveal", "memphis-burst"])("%s takes the shared style controls", (id) => {
    expect(controlNames(id)).toEqual(expect.arrayContaining(["shadowStyle", "shadowOffset", "inkWidth", "inkColor", "sheen"]));
  });

  it("the still stickers stay soft and glossy by default, and go flat with a hard shadow", () => {
    const sticker = vector("die-cut-sticker");
    const soft = renderVectorEffect(sticker, effectDefaults(sticker)).svg;
    expect(soft).toContain('dx="0" dy="5" stdDeviation="4"');
    const flat = renderVectorEffect(sticker, effectDefaults(sticker, { preset: "Neubrutal" })).svg;
    expect(flat).toContain('dx="8" dy="8" stdDeviation="0"');
    expect(flat).toMatch(/fill="url\(#dieCutGloss\)" opacity="0"/);
  });

  it("press button pushes onto a hard ink block in its Neubrutal preset", () => {
    const button = vector("press-button");
    const motion = renderVectorEffect(button, effectDefaults(button, { preset: "Neubrutal" }));
    expect(motion.animate!.find((a) => a.id === "faceG" && a.delay === 40)!.attrs!.transform).toEqual(["translate(0 -1.5)", "translate(8 8)"]);
  });

  it("every sticker, comic, splatter, icon and loader effect with colours to set has a Neubrutal preset of its own controls", () => {
    const families = EFFECTS.filter((e) => (NEUBRUTAL_CATEGORIES as readonly string[]).includes(e.category) && (e.kind === "vector" || e.kind === "shader"));
    expect(families.length).toBeGreaterThan(60);
    for (const effect of families) {
      const preset = effect.presets?.find((p) => p.name === "Neubrutal");
      if (!neubrutalValues(effect) && !preset) continue;
      expect(preset, effect.id).toBeDefined();
      const names = new Set(effectControls(effect).map((c) => c.name));
      for (const key of Object.keys(preset!.values)) expect(names.has(key), `${effect.id}: ${key}`).toBe(true);
    }
    expect(findEffects({ category: "sticker" }).filter((e) => e.presets?.some((p) => p.name === "Neubrutal")).length).toBeGreaterThan(8);
  });

  it("uses the palette: ink for outlines and text, the brights for the rest", () => {
    const values = neubrutalValues(getEffect("die-cut-sticker")!)!;
    expect(values.inkColor).toEqual([0.035, 0.035, 0.043]);
    expect(values.sticker).toEqual([1, 0.165, 0.522]);
    expect(values).toMatchObject({ shadowStyle: 1, shadowOffset: 8, sheen: 0, inkWidth: 3 });
  });

  it("the lazy loader gives an effect the same preset", async () => {
    const lazy = await loadEffect("sticker-label");
    expect(lazy.presets?.find((p) => p.name === "Neubrutal")).toEqual(getEffect("sticker-label")!.presets!.find((p) => p.name === "Neubrutal"));
  });
});
