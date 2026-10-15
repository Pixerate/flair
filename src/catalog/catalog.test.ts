import { describe, expect, it } from "vitest";
import { checkControlValue, parseControls } from "../shader/controls.js";
import { svgFrame, svgMotionIssues } from "../vector/motion.js";
import { svgDuration } from "../vector/svg.js";
import type { VectorEffect } from "./types.js";
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
  textImage,
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

  it("drip text takes a font and sits inline on the baseline", () => {
    const drip = getEffect("drip-text")!;
    if (drip.kind !== "vector") throw new Error("vector expected");
    const block = renderVectorEffect(drip).svg;
    expect(block).toContain('viewBox="0 0 400 200" overflow="hidden"');
    expect(block).toContain(`font-family="Arial Black, Impact, system-ui, sans-serif"`);
    expect(block).toContain('font-weight="900"');
    const inline = renderVectorEffect(drip, { word: "SLOP", inline: true, font: "inherit", weight: 400 }).svg;
    // The word's capitals only: cap height (y 45) down to its baseline (y 120).
    expect(inline).toContain('viewBox="50 45 300 75" overflow="visible"');
    expect(inline).toContain('font-family="inherit"');
    expect(inline).toContain('font-weight="400"');
    expect(renderVectorEffect(drip, { font: `'Rubik Wet Paint', cursive` }).svg).toContain(`font-family="&#39;Rubik Wet Paint&#39;, cursive"`);
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

  // Effects that show a picture lay it over a backdrop, so transparent images (Lucide icons:
  // black strokes on clear) are not black on black, and pass its alpha on for overlays.
  const PICTURE_EFFECTS = SHADER_EFFECTS.filter((e) => /\b(picture|pictureRGBA|flair_transition)\(/.test(e.source));
  // These draw a whole opaque device around the picture, so they stay opaque.
  const OPAQUE = new Set(["gameboy-screen"]);

  it.each(PICTURE_EFFECTS.map((e) => [e.id, e] as const))("%s lays its image over a backdrop and keeps its alpha", (_, effect) => {
    expect(effectDefaults(effect)).toMatchObject({ uBackdrop: [1, 1, 1], uBackdropAlpha: 1 });
    expect(effect.source).toContain("vec4 overBackdrop(vec4 s)");
    const main = effect.source.slice(effect.source.indexOf("void mainImage"));
    if (OPAQUE.has(effect.id)) return;
    expect(main, "no opaque output: the picture's alpha goes to fragColor").not.toMatch(/fragColor\s*=\s*vec4\([^;]*,\s*1\.0\);/);
    expect(main).not.toMatch(/\btexture\(/);
  });

  it("covers the image and transition effects, and samples a Lucide-style icon", () => {
    expect(PICTURE_EFFECTS.length).toBeGreaterThanOrEqual(50);
    for (const id of ["image-duotone", "transition-wipe", "feature-morph", "time-echo", "hover-swap"]) {
      expect(PICTURE_EFFECTS.map((e) => e.id)).toContain(id);
    }
    const icon = atob(SAMPLE_IMAGES.icon.split(",")[1]!);
    expect(icon).toContain('stroke="currentColor"');
    expect(icon).toContain('fill="none"');
  });

  it("exposes background alpha and sparsity controls on sparkles and bokeh", () => {
    const sparkles = getEffect("sparkles")!;
    const bokeh = getEffect("bokeh")!;
    expect(effectDefaults(sparkles)).toMatchObject({ uBackgroundAlpha: 1, uChance: 1 });
    expect(effectDefaults(bokeh)).toMatchObject({ uBackgroundAlpha: 1 });
  });

  it("draws any text as a white-on-clear SVG image", () => {
    const url = textImage(`Café <&> 日本 🎉 'quoted'`);
    expect(url).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(url).not.toMatch(/[\s'"()]/);
    const svg = decodeURIComponent(url.slice(url.indexOf(",") + 1));
    expect(svg).toContain(`>Café &lt;&amp;&gt; 日本 🎉 &#39;quoted&#39;</text>`);
    expect(svg).toContain('viewBox="0 0 1024 256"');
    expect(svg).toContain('fill="#fff"');
    // Longer text is set smaller, so it still fits.
    const size = (u: string) => Number(/font-size="([\d.]+)"/.exec(decodeURIComponent(u))![1]);
    expect(size(textImage("A LONGER TITLE HERE"))).toBeLessThan(size(textImage("HI")));
    expect(decodeURIComponent(textImage("x", { font: "Georgia", weight: 400, size: 80 }))).toMatch(/font-family="Georgia" font-weight="400" font-size="80"/);
    expect(effectDefaults(getEffect("shader-text")!).uText).toBe(textImage("FLAIR"));
  });

  it.each(findEffects({ category: "text", kind: "vector" }).map((e) => [e.id, e] as const))(
    "text effect %s fits short, long and unusual text",
    (_, effect) => {
      if (effect.kind !== "vector") return;
      const text = effectControls(effect).find((c) => c.type === "text")!;
      for (const word of ["A", "Supercalifragilistic & <co>", "Café 日本 🎉"]) {
        const motion = renderVectorEffect(effect, { [text.name]: word });
        expect(svgMotionIssues(motion)).toEqual([]);
        expect(JSON.stringify(motion)).not.toMatch(/\{\{|NaN|undefined/);
      }
    },
  );

  it("every text effect takes a font and weight, and sits inline on the baseline", () => {
    const texts = findEffects({ kind: "vector", category: "text" }) as VectorEffect[];
    expect(texts.length).toBeGreaterThan(10);
    for (const effect of texts) {
      expect(effectControls(effect).map((c) => c.name), effect.id).toEqual(expect.arrayContaining(["font", "weight", "inline"]));
      const block = renderVectorEffect(effect).svg;
      expect(block, effect.id).toMatch(/^<svg viewBox="0 0 400 200" overflow="hidden"/);
      const inline = renderVectorEffect(effect, { inline: true, font: "inherit", weight: 300 });
      expect(inline.svg, effect.id).toMatch(/^<svg viewBox="[\d.-]+ [\d.-]+ [\d.]+ [\d.]+" overflow="visible"/);
      expect(inline.svg, effect.id).not.toContain('viewBox="0 0 400 200"');
      // Every word takes the font, and no backdrop covers the line.
      expect(inline.svg.match(/font-family="([^"]*)"/g)!.every((f) => f === 'font-family="inherit"'), effect.id).toBe(true);
      expect(inline.svg, effect.id).toContain('font-weight="300"');
      expect(inline.svg, effect.id).not.toMatch(/<rect width="400" height="200"[^>]*opacity="1"/);
      expect(svgMotionIssues(inline), effect.id).toEqual([]);
    }
  });

  it("typewriter writes its text with a caret, kinetic stagger one letter per slot", () => {
    const typed = renderVectorEffect(getEffect("typewriter") as never, { text: "Hi there" });
    expect(typed.animate![0]).toMatchObject({ id: "typed", write: "Hi there", caret: "▌", ms: 720 });
    const kinetic = renderVectorEffect(getEffect("kinetic-stagger") as never, { text: "Go!" }).svg;
    expect(kinetic).toMatch(/id="l0"[^>]*>G</);
    expect(kinetic).toMatch(/id="l2"[^>]*>!</);
    expect(kinetic).toMatch(/id="l3"[^>]*><\/text>/);
  });

  it("gives the image morphs two pictures and a progress control", () => {
    for (const id of ["feature-morph", "silhouette-morph", "transition-liquid-morph", "transition-displacement", "transition-luma", "transition-particle-swap", "transition-ink-bleed"]) {
      const effect = getEffect(id)!;
      expect(effect, id).toBeDefined();
      const names = effectControls(effect).map((c) => c.name);
      expect(names, id).toEqual(expect.arrayContaining(["uFrom", "uTo", "uAnimate", "uProgress"]));
      expect(effect.kind === "shader" && effect.loop, id).toBe(4);
    }
    expect(effectDefaults(getEffect("feature-morph")!)).toMatchObject({ uFrom: SAMPLE_IMAGES.portrait, uTo: SAMPLE_IMAGES.portrait2, uFromA: [0.461, 0.583] });
    expect(effectDefaults(getEffect("silhouette-morph")!, { preset: "Hello → World" }).uTo).toBe(textImage("WORLD"));
    for (const key of ["portrait2", "logo", "heart"] as const) expect(SAMPLE_IMAGES[key]).toMatch(/^data:image\/svg\+xml;base64,/);
  });
});

describe("morph effects", () => {
  const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
  const skeleton = (d: unknown) => String(d).replace(NUMBER, "#");
  const render = (id: string, values: Record<string, unknown> = {}) => {
    const effect = getEffect(id)!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    return renderVectorEffect(effect, values as never);
  };
  /** Every `d` change blends: both ends have one structure. */
  const blends = (motion: ReturnType<typeof render>) => {
    for (const a of motion.animate ?? []) if (a.attrs?.d) expect(skeleton(a.attrs.d[0])).toBe(skeleton(a.attrs.d[1]));
  };

  it.each(findEffects({ category: "morph", kind: "vector" }).map((e) => [e.id] as const))("%s morphs shapes of one structure", (id) => {
    blends(render(id));
  });

  it("shape morph fits any paths to its picture and falls back on unreadable ones", () => {
    const motion = render("shape-morph", { from: "M0 0 H1000 V500 H0 Z M200 100 H400 V400 H200 Z", to: "m5 5 l1 0 l0 1z" });
    blends(motion);
    const numbers = String(motion.animate![0]!.attrs!.d[0]).match(NUMBER)!.map(Number);
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(11.9);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(88.1);
    const broken = render("shape-morph", { from: "not a path", to: "M0 0 X" });
    expect(svgMotionIssues(broken)).toEqual([]);
    expect(broken.animate![0]!.attrs!.d).toEqual(render("shape-morph").animate![0]!.attrs!.d);
  });

  it("icon toggle morphs every pair", () => {
    for (let pair = 0; pair <= 4; pair++) {
      const motion = render("icon-toggle", { pair });
      expect(svgMotionIssues(motion)).toEqual([]);
      blends(motion);
    }
  });

  it("particle morph keeps one dot per element whatever the shapes", () => {
    for (const to of ["M0 0 H10 V10 H0 Z M20 0 H30 V10 H20 Z M40 0 H50 V10 H40 Z", "M0 0 L100 0", "nonsense"]) {
      const motion = render("particle-morph", { to });
      expect(svgMotionIssues(motion)).toEqual([]);
      expect(motion.svg.match(/<circle id="p\d+"/g)).toHaveLength(48);
      expect(JSON.stringify(motion)).not.toMatch(/\{\{|NaN|undefined/);
    }
  });

  it("digit morph counts through at most a few numbers, up or down", () => {
    for (const [from, to] of [[12, 20], [9999, 0], [98, 103], [5, 5], [0, 7]]) {
      const motion = render("digit-morph", { from, to });
      expect(svgMotionIssues(motion)).toEqual([]);
      expect(JSON.stringify(motion)).not.toMatch(/\{\{|NaN|undefined/);
      blends(motion);
    }
    // 98 → 103 shows a hundreds digit only from 100 on.
    const slot = render("digit-morph", { from: 98, to: 103 }).animate!.filter((a) => a.id === "s1");
    expect(slot.map((a) => a.attrs!.opacity)).toEqual([[0, 0], [0, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 0]]);
  });
});

describe("interaction effects", () => {
  const interactive = findEffects({ category: "interaction", kind: "shader" });

  it("include the pointer-driven shaders", () => {
    const ids = interactive.map((e) => e.id);
    for (const id of ["click-ripple", "click-burst", "cursor-glow", "hover-liquid", "hover-reveal", "magnifier", "holo-card", "press-charge", "hover-swap"])
      expect(ids).toContain(id);
  });

  it.each(interactive.map((e) => [e.id, e] as const))("%s reads the pointer built-ins and can turn its idle demo off", (_, effect) => {
    if (effect.kind !== "shader") return;
    expect(effect.tags).toContain("interactive");
    expect(effect.tags.some((t) => ["hover", "click", "press"].includes(t))).toBe(true);
    expect(effect.source).toMatch(/\biPointer\b|\biClicks\b/);
    expect(effect.source).not.toMatch(/uniform\s+vec4\s+(iPointer|iClicks)/);
    expect(effectControls(effect).find((c) => c.name === "uDemo")).toMatchObject({ type: "bool", default: true });
  });

  it("marks the overlays transparent", () => {
    for (const id of ["click-ripple", "click-burst", "cursor-glow", "holo-card", "press-charge"]) {
      const effect = getEffect(id)!;
      expect(effect.kind === "shader" && effect.transparent).toBe(true);
    }
  });
});

describe("interaction vector effects", () => {
  const effects = findEffects({ category: "interaction", kind: "vector" });
  const render = (effect: (typeof effects)[number], values: Record<string, unknown> = {}) => {
    if (effect.kind !== "vector") throw new Error("vector expected");
    return renderVectorEffect(effect, values as never);
  };
  const lastStep = (motion: ReturnType<typeof render>) => Math.max(0, ...(motion.animate ?? []).map((a) => a.step ?? 0));

  it("are all triggered and tagged for it", () => {
    expect(effects.length).toBeGreaterThanOrEqual(12);
    for (const effect of effects) {
      if (effect.kind !== "vector") continue;
      expect(effect.trigger, effect.id).toBeDefined();
      expect(effect.tags, effect.id).toEqual(expect.arrayContaining(["interactive", "ui", effect.trigger!]));
    }
  });

  it.each(effects.filter((e) => e.kind === "vector" && e.trigger === "click").map((e) => [e.id, e] as const))(
    "click effect %s changes on its steps and ends a round as it started",
    (_, effect) => {
      const motion = render(effect);
      const steps = lastStep(motion);
      expect(steps === 1 || steps === 2, `${effect.id} has ${steps} steps`).toBe(true);
      // Step 0 never plays: everything waits for a click.
      expect(motion.animate!.every((a) => (a.step ?? 0) >= 1)).toBe(true);
      const at = (clicks: number[], ms: number) => JSON.stringify([...svgFrame(motion.animate!, clicks, ms)].sort());
      const start = at([], 0);
      // A toggle is on after step 1; every round ends where it began.
      if (steps === 2) expect(at([0], 5000)).not.toBe(start);
      else expect(at([0], 400)).not.toBe(start);
      expect(at(steps === 2 ? [0, 5000] : [0], 10000)).toBe(start);
    },
  );

  it.each(effects.filter((e) => e.kind === "vector" && e.trigger !== "click").map((e) => [e.id, e] as const))(
    "hover or press effect %s plays from rest to a different end",
    (_, effect) => {
      const motion = render(effect);
      expect(lastStep(motion)).toBe(0);
      const frame = (ms: number) => JSON.stringify([...svgFrame(motion.animate!, [], ms)].sort());
      expect(frame(svgDuration(motion))).not.toBe(frame(0));
    },
  );

  it.each(effects.flatMap((e) => effectControls(e).filter((c) => c.type === "text").map((c) => [e.id, c.name, e] as const)))(
    "%s fits short, long and unusual %s",
    (_, name, effect) => {
      for (const word of ["A", "Supercalifragilistic & <co>", "Café 日本 🎉", ""]) {
        const motion = render(effect, { [name]: word });
        expect(svgMotionIssues(motion)).toEqual([]);
        expect(JSON.stringify(motion)).not.toMatch(/\{\{|NaN|undefined/);
      }
    },
  );

  it("like button counts up from its start count and back", () => {
    const like = render(getEffect("like-button")!, { count: 99 });
    expect(like.animate!.filter((a) => a.count).map((a) => a.count)).toEqual([[99, 100], [100, 99]]);
  });

  it("menu toggle morphs bars and cross of one structure at any weight", () => {
    const skeleton = (d: unknown) => String(d).replace(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi, "#");
    for (const weight of [1, 2, 3.5]) {
      const d = render(getEffect("menu-toggle")!, { weight }).animate!.find((a) => a.id === "glyph")!.attrs!.d!;
      expect(skeleton(d[0])).toBe(skeleton(d[1]));
      expect(d[0]).not.toBe(d[1]);
    }
  });
});

describe("timewarp effects", () => {
  const timewarp = findEffects({ category: "timewarp" });

  it("include the echoes, rewinds, freezes and the clock", () => {
    const ids = timewarp.map((e) => e.id);
    for (const id of ["time-echo", "chrono-split", "time-slice", "rewind", "bullet-time", "time-tunnel", "speed-ramp", "stutter-freeze", "time-lapse-clock"])
      expect(ids).toContain(id);
    for (const effect of timewarp) expect(effect.tags).toContain("time");
  });

  it("shaders take an image and draw opaque", () => {
    for (const effect of timewarp) {
      if (effect.kind !== "shader") continue;
      expect(effect.transparent).toBeFalsy();
      expect(effectControls(effect).find((c) => c.name === "uImage")).toMatchObject({ type: "sampler2D" });
      expect(effect.source).not.toMatch(/uniform\s+vec4\s+(iPointer|iClicks)/);
    }
    const bullet = getEffect("bullet-time")!;
    expect(bullet.kind === "shader" && bullet.source).toMatch(/\biClicks\[0\]/);
  });

  it("time-lapse clock turns its hands whole turns and ends the sky where it began", () => {
    const effect = getEffect("time-lapse-clock")!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    const motion = renderVectorEffect(effect, { day: "#112233" } as never);
    const turns = (id: string) => motion.animate!.filter((a) => a.id === id).map((a) => a.attrs!.transform);
    expect(turns("minute")).toEqual([["rotate(0 100 100)", "rotate(4320 100 100)"]]);
    expect(turns("hour")).toEqual([["rotate(0 100 100)", "rotate(360 100 100)"]]);
    const sky = motion.animate!.filter((a) => a.id === "sky").map((a) => a.attrs!.fill);
    expect(sky[0]![0]).toBe("#112233");
    expect(sky.at(-1)![1]).toBe("#112233");
    expect(motion.svg).toContain('fill="#112233"');
  });
});

describe("pyrotechnics", () => {
  const pyro = findEffects({ category: "pyrotechnics" });

  it("has the fireworks, sparks, explosions and smoke", () => {
    const ids = pyro.map((e) => e.id);
    for (const id of ["fireworks", "sparkler", "explosion", "spark-fountain", "roman-candle", "fuse-burn", "smoke-bomb", "light-show", "firework-burst"])
      expect(ids).toContain(id);
    for (const effect of pyro) expect(effect.tags).toContain("pyro");
  });

  it("draws the shaders as transparent overlays, all but the opaque light show", () => {
    for (const effect of pyro) {
      if (effect.kind !== "shader") continue;
      expect(effect.transparent ?? false, effect.id).toBe(effect.id !== "light-show");
    }
  });

  it("fires fireworks and explosions at clicks, and moves the sparkler with the pointer", () => {
    for (const id of ["fireworks", "explosion"]) {
      const effect = getEffect(id)!;
      expect(effect.kind === "shader" && effect.source, id).toMatch(/\biClicks\[/);
    }
    const sparkler = getEffect("sparkler")!;
    expect(sparkler.kind === "shader" && sparkler.source).toMatch(/\biPointer\b/);
  });
});

describe("melt effects", () => {
  const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
  const skeleton = (d: unknown) => String(d).replace(NUMBER, "#");

  it("include drips, haze, wax, text, liquify, a clock, lava and vector melts", () => {
    const ids = findEffects({ category: "melt" }).map((e) => e.id);
    for (const id of ["drip-melt", "heat-haze", "wax-melt", "melting-text", "liquify", "dali-clock", "lava-flow", "ice-cube-melt", "candle"]) expect(ids).toContain(id);
    for (const effect of findEffects({ category: "melt" })) expect(effect.tags).toContain("melt");
  });

  it("loops the melt-and-reform shaders, with a still progress control", () => {
    for (const id of ["drip-melt", "wax-melt", "melting-text"]) {
      const effect = getEffect(id)!;
      expect(effect.kind === "shader" && effect.loop, id).toBe(8);
      expect(effectControls(effect).map((c) => c.name), id).toEqual(expect.arrayContaining(["uAnimate", "uProgress"]));
    }
    expect(effectDefaults(getEffect("melting-text")!).uText).toBe(textImage("MELT"));
    expect(effectDefaults(getEffect("wax-melt")!).uMask).toBe(textImage("WAX"));
    const text = getEffect("melting-text")!;
    expect(text.kind === "shader" && text.transparent).toBe(true);
    expect(effectDefaults(text).uBackgroundAlpha).toBe(0);
    // Liquify reads the pointer built-in without declaring it.
    const liquify = getEffect("liquify")!;
    expect(liquify.kind === "shader" && liquify.source).toMatch(/\biPointer\b/);
    expect(liquify.kind === "shader" && liquify.source).not.toMatch(/uniform\s+vec4\s+iPointer/);
  });

  it.each([["ice-cube-melt"], ["candle"]])("%s blends every change and ends where it starts", (id) => {
    const effect = getEffect(id)!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    const motion = renderVectorEffect(effect, effectDefaults(effect));
    for (const a of motion.animate ?? []) for (const [name, [from, to]] of Object.entries(a.attrs ?? {}))
        if (!String(from).startsWith("#")) expect(skeleton(from), `${id} ${a.id} ${name}`).toBe(skeleton(to));
    // Each attribute's last change returns it to its first value, so the loop is seamless.
    const first = new Map<string, unknown>();
    const last = new Map<string, unknown>();
    const timed = [...(motion.animate ?? [])].map((a, i) => ({ a, i })).sort((x, y) => (x.a.delay ?? 0) - (y.a.delay ?? 0) || x.i - y.i);
    for (const { a } of timed)
      for (const [name, [from, to]] of Object.entries(a.attrs ?? {})) {
        const key = `${a.id}.${name}`;
        if (!first.has(key)) first.set(key, from);
        last.set(key, to);
      }
    for (const [key, value] of first) expect(last.get(key), key).toEqual(value);
  });
});

describe("electric effects", () => {
  const electric = findEffects({ category: "electric" });

  it("has the lightning, arcs, plasma, sparks and icons", () => {
    const ids = electric.map((e) => e.id);
    for (const id of ["lightning", "tesla-arc", "plasma-ball", "electric-border", "electric-text", "jacobs-ladder", "short-circuit", "power-surge", "electric-field", "zap-icon", "power-button", "battery-charge"])
      expect(ids).toContain(id);
    for (const effect of electric) expect(effect.tags).toContain("electric");
  });

  it("draws the overlays transparent and the rest opaque", () => {
    const overlays = ["lightning", "tesla-arc", "electric-border", "short-circuit"];
    for (const effect of electric) {
      if (effect.kind !== "shader") continue;
      expect(effect.transparent ?? false, effect.id).toBe(overlays.includes(effect.id));
    }
  });

  it("strikes at clicks and follows the pointer", () => {
    const lightning = getEffect("lightning")!;
    expect(lightning.kind === "shader" && lightning.source).toMatch(/\biClicks\[/);
    for (const id of ["tesla-arc", "plasma-ball", "electric-field"]) {
      const effect = getEffect(id)!;
      expect(effect.kind === "shader" && effect.source, id).toMatch(/\biPointer\b/);
      expect(effect.kind === "shader" && effect.source, id).not.toMatch(/uniform\s+vec4\s+(iPointer|iClicks)/);
    }
  });

  it("power button turns on with its first click and back off with its second", () => {
    const effect = getEffect("power-button")!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    const motion = renderVectorEffect(effect, effectDefaults(effect));
    expect(motion.animate!.every((a) => a.step === 1 || a.step === 2)).toBe(true);
    const at = (clicks: number[], ms: number) => JSON.stringify([...svgFrame(motion.animate!, clicks, ms)].sort());
    const start = at([], 0);
    expect(at([0], 5000)).not.toBe(start);
    expect(at([0, 5000], 10000)).toBe(start);
  });

  it("battery counts up to a full charge", () => {
    const effect = getEffect("battery-charge")!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    const motion = renderVectorEffect(effect, effectDefaults(effect));
    expect(motion.animate!.find((a) => a.count)!.count).toEqual([0, 100]);
  });
});

describe("pixel effects", () => {
  const SHADERS = ["image-8bit", "gameboy-screen", "pixel-fire", "pixel-landscape", "outrun-road", "palette-cycle", "raster-bars", "loading-stripes", "pixel-water"];
  const VECTORS = ["pixel-text", "coin-spin", "space-invader", "pixel-heart-health", "chomp-loader"];

  it("are retro and tagged pixel or retro", () => {
    for (const id of [...SHADERS, ...VECTORS]) {
      const effect = getEffect(id)!;
      expect(effect, id).toBeDefined();
      expect(effect.category, id).toBe("retro");
      expect(effect.tags.some((t) => t === "pixel" || t === "retro"), id).toBe(true);
    }
    for (const id of VECTORS) {
      const effect = getEffect(id)!;
      expect(effect.kind === "vector" && effect.motion.svg, id).toContain('shape-rendering="crispEdges"');
    }
  });

  it("8-bit has a preset per palette", () => {
    const effect = getEffect("image-8bit")!;
    expect(effect.presets!.map((p) => p.values.uPalette)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("pixel dissolve is a looping two-image transition", () => {
    const effect = getEffect("transition-pixel-dissolve")!;
    expect(effect.category).toBe("transition");
    expect(effect.tags).toEqual(expect.arrayContaining(["transition", "pixel"]));
    expect(effectControls(effect).map((c) => c.name)).toEqual(expect.arrayContaining(["uFrom", "uTo", "uAnimate", "uProgress"]));
    expect(effect.kind === "shader" && effect.loop).toBe(4);
  });

  it("pixel text draws any text as one path per letter, cut to its slots", () => {
    const effect = getEffect("pixel-text")!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    for (const text of ["A", "", "Hello, world & <co>!", "Café 日本 🎉", "A VERY LONG TITLE INDEED"]) {
      const motion = renderVectorEffect(effect, { text });
      expect(svgMotionIssues(motion)).toEqual([]);
      expect(JSON.stringify(motion)).not.toMatch(/\{\{|NaN|undefined/);
      expect(motion.svg.match(/<g id="g\d+"/g)).toHaveLength(16);
    }
    const hi = renderVectorEffect(effect, { text: "Hi" }).svg;
    // H's path is drawn; the slots after the text are empty.
    expect(hi).toMatch(/<g id="g0"[^>]*><path[^>]*d="M0 0h1v1h-1zM4 0h1v1h-1z/);
    expect(hi).toMatch(/<g id="g2"[^>]*><path[^>]*d="M0 0"/);
    const delays = renderVectorEffect(effect, { stagger: 100 }).animate!.filter((a) => a.id === "g3").map((a) => a.delay);
    expect(delays).toEqual([300, 300, 560, 670]);
  });
});
