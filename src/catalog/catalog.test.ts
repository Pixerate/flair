import { describe, expect, it } from "vitest";
import { checkControlValue, parseControls } from "../shader/controls.js";
import { svgMotionIssues } from "../vector/motion.js";
import {
  EFFECT_CATEGORIES,
  EFFECTS,
  effectControls,
  effectDefaults,
  findEffects,
  getEffect,
  renderVectorEffect,
  SAMPLE_IMAGES,
  SHADER_EFFECTS,
  vectorControlIssues,
  vectorControls,
} from "./index.js";

describe("catalog", () => {
  it("has unique kebab-case ids in known categories", () => {
    const ids = EFFECTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const effect of EFFECTS) {
      expect(effect.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(EFFECT_CATEGORIES).toContain(effect.category);
      expect(effect.description.length).toBeGreaterThan(10);
      expect(effect.tags.length).toBeGreaterThan(0);
    }
    expect(EFFECTS.length).toBeGreaterThanOrEqual(50);
  });

  it("covers every category", () => {
    for (const category of EFFECT_CATEGORIES) expect(findEffects({ category }).length).toBeGreaterThan(0);
  });

  it.each(SHADER_EFFECTS.map((e) => [e.id, e] as const))("shader %s declares mainImage and controls", (_, effect) => {
    expect(effect.source).toMatch(/void mainImage\(out vec4 fragColor, in vec2 fragCoord\)/);
    const controls = parseControls(effect.source);
    expect(controls.length).toBeGreaterThan(0);
    // Every uniform the source declares is a control (the built-ins come from the wrapper).
    const uniforms = [...effect.source.matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*;/gm)].map((m) => m[1]);
    expect(controls.map((c) => c.name).sort()).toEqual(uniforms.sort());
    for (const c of controls) expect(c.label).not.toBe("");
  });

  it.each(EFFECTS.filter((e) => e.presets).map((e) => [e.id, e] as const))("presets of %s are valid values", (_, effect) => {
    const controls = effectControls(effect);
    for (const preset of effect.presets!) {
      for (const [name, value] of Object.entries(preset.values)) {
        const control = controls.find((c) => c.name === name);
        expect(control, `${effect.id}/${preset.name}: ${name}`).toBeDefined();
        expect(checkControlValue(control!, value).ok, `${effect.id}/${preset.name}: ${name}`).toBe(true);
      }
    }
  });

  it.each(EFFECTS.filter((e) => e.kind === "vector").map((e) => [e.id, e] as const))(
    "vector %s renders with no issues or leftover placeholders",
    (_, effect) => {
      if (effect.kind !== "vector") return;
      const motion = renderVectorEffect(effect, effectDefaults(effect));
      expect(svgMotionIssues(motion)).toEqual([]);
      expect(JSON.stringify(motion)).not.toMatch(/\{\{/);
    },
  );

  it.each(EFFECTS.filter((e) => e.kind === "vector").map((e) => [e.id, e] as const))(
    "vector %s declares its controls in its picture",
    (_, effect) => {
      if (effect.kind !== "vector") return;
      expect(effect.controls).toBeUndefined();
      expect(vectorControlIssues(effect.motion)).toEqual([]);
      expect(vectorControls(effect.motion).length).toBeGreaterThan(0);
    },
  );

  it("reads vector controls from {{name: type …}} placeholders", () => {
    const controls = vectorControls({
      svg: `<svg viewBox="0 0 10 10"><!-- {{size: float min=1 max=9 default=4 step=0.5 label='Size'}} --><text fill="{{ink: color default=#FF0000}}">{{title: text default='Hello there' label="Title"}}</text><rect width="{{size}}"/></svg>`,
      animate: [{ id: "x", attrs: { opacity: [0, "{{on: bool default=true}}"] } }],
    });
    expect(controls.map((c) => [c.name, c.type, c.default])).toEqual([
      ["size", "float", 4],
      ["ink", "vec3", [1, 0, 0]],
      ["title", "text", "Hello there"],
      ["on", "bool", true],
    ]);
    expect(controls[0]).toMatchObject({ min: 1, max: 9, step: 0.5, label: "Size" });
    expect(controls[1]!.color).toBe(true);
    expect(controls[2]!.label).toBe("Title");
    expect(vectorControlIssues({ svg: `<svg>{{a: vec5}}{{b: float}}{{b: float default=2}}</svg>` })).toEqual([
      "{{a: vec5}}: a control's type is one of float, int, bool, color, text",
      '"b" is declared twice; declare it once and write {{b}} everywhere else',
    ]);
  });

  it("fills text safely, drops comments and keeps whole placeholders typed", () => {
    const motion = renderVectorEffect(
      {
        motion: {
          svg: `<svg viewBox="0 0 10 10"><!-- {{n: float default=3}} --><text>{{t: text default=hi}}</text><g data-t="{{t}}"/></svg>`,
          animate: [{ id: "x", attrs: { r: [0, "{{n}}"], d: ["M0 0", "M{{n}} 0"] } }],
        },
      },
      { t: `Fish & "chips" <b>--` },
    );
    expect(motion.svg).toBe(`<svg viewBox="0 0 10 10"><text>Fish &amp; &quot;chips&quot; &lt;b&gt;--</text><g data-t="Fish &amp; &quot;chips&quot; &lt;b&gt;--"/></svg>`);
    expect(motion.animate![0]!.attrs!.r).toEqual([0, 3]);
    expect(motion.animate![0]!.attrs!.d).toEqual(["M0 0", "M3 0"]);
  });

  it("still takes controls listed outside the picture", () => {
    const effect = { motion: { svg: `<svg viewBox="0 0 1 1" fill="{{c}}"/>` }, controls: [{ name: "c", type: "vec3" as const, color: true, default: [0, 0, 1] }] };
    expect(renderVectorEffect(effect).svg).toContain('fill="#0000ff"');
    expect(renderVectorEffect(effect, { c: "#00ff00" }).svg).toContain('fill="#00ff00"');
  });

  it("drip text writes any word, with its drips under it", () => {
    const drip = getEffect("drip-text")!;
    if (drip.kind !== "vector") throw new Error("vector expected");
    expect(effectControls(drip).find((c) => c.name === "word")).toMatchObject({ type: "text", default: "SLOP" });
    const short = renderVectorEffect(drip, { word: "OK" }).svg;
    const long = renderVectorEffect(drip, { word: "UNSTOPPABLE" }).svg;
    expect(short).toContain(">OK</text>");
    expect(short).toContain('textLength="150"');
    expect(long).toContain('textLength="380"');
    expect(svgMotionIssues(renderVectorEffect(drip, { word: "Slop & Co" }))).toEqual([]);
  });

  it("fills vector controls: colours as hex, numbers as numbers, derived values too", () => {
    const ring = getEffect("progress-ring")!;
    if (ring.kind !== "vector") throw new Error("vector expected");
    const motion = renderVectorEffect(ring, { value: 50, accent: [1, 0, 0] });
    expect(motion.svg).toContain('stroke="#ff0000"');
    expect(motion.animate!.find((a) => a.id === "label")!.count).toEqual([0, 50]);
    expect(motion.animate!.find((a) => a.id === "ring")!.draw).toEqual([0, 0.5]);
  });

  it("finds effects by words, kind and tags", () => {
    expect(findEffects({ text: "aurora" }).map((e) => e.id)).toEqual(["aurora"]);
    expect(findEffects({ kind: "vector" }).every((e) => e.kind === "vector")).toBe(true);
    expect(findEffects({ tags: ["loader"] }).length).toBeGreaterThan(2);
    expect(findEffects({ text: "no such thing anywhere" })).toEqual([]);
  });

  it("merges defaults, presets and values", () => {
    const aurora = getEffect("aurora")!;
    const values = effectDefaults(aurora, { preset: "Ember", values: { uSpeed: 2 } });
    expect(values.uSpeed).toBe(2);
    expect(values.uGlowA).toEqual([1, 0.45, 0.1]);
    expect(values.uHeight).toBe(0.55);
  });

  it("gives image effects sample pictures", () => {
    expect(effectDefaults(getEffect("transition-wipe")!).uTo).toBe(SAMPLE_IMAGES.city);
    expect(effectDefaults(getEffect("image-glitch")!).uImage).toBe(SAMPLE_IMAGES.landscape);
    expect(SAMPLE_IMAGES.landscape).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("exposes background alpha and sparsity controls on sparkles and bokeh", () => {
    const sparkles = getEffect("sparkles")!;
    const bokeh = getEffect("bokeh")!;
    expect(effectDefaults(sparkles)).toMatchObject({ uBackgroundAlpha: 1, uChance: 1 });
    expect(effectDefaults(bokeh)).toMatchObject({ uBackgroundAlpha: 1 });
  });
});
