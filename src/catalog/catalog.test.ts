import { describe, expect, it } from "vitest";
import { checkControlValue, parseControls } from "../shader/controls.js";
import { svgFrame, svgMotionIssues } from "../vector/motion.js";
import { svgInlineLayout } from "../vector/static.js";
import { svgDuration } from "../vector/svg.js";
import type { EffectCategory, VectorEffect } from "./types.js";
import {
  EFFECT_CATEGORIES,
  EFFECT_CATEGORY_GROUPS,
  categoryGroup,
  EFFECTS,
  effectControls,
  effectDefaults,
  findEffects,
  getEffect,
  renderVectorEffect,
  SAMPLE_IMAGES,
  SHADER_EFFECTS,
  SPECTRUM,
  textImage,
  vectorControlIssues,
  vectorControls,
  VIDEO_USES,
  effectInputs,
  isSinglePictureEffect,
  isMotionEffect,
  nonImageEffectControls,
  sanitizeEffectValues,
  canOutputAnimatedSvg,
  canOutputVideo,
  isHumanReadableControl,
  getPromptVariables,
  getEffectReferenceSvg,
  effectTags,
  normaliseTag,
  TAG_FORMAT,
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
    expect(short).toContain('textLength="154"');
    // A long word keeps its letters' shapes: drawn at its own width and scaled down to fit the stage.
    expect(long).toContain('textLength="847"');
    expect(long).toContain('scale(0.449) translate(-200 -100)"><g id="word"');
    expect(svgMotionIssues(renderVectorEffect(drip, { word: "Slop & Co" }))).toEqual([]);
  });

  it("drip text repeats its drips along a long word", () => {
    const drip = getEffect("drip-text") as VectorEffect;
    const drips = (word: string) => (renderVectorEffect(drip, { word, inline: true }).svg.match(/<circle id="fc\d+"/g) ?? []).length;
    const shown = (word: string) => (renderVectorEffect(drip, { word, inline: true }).svg.match(/<g display="inline"><rect id="fr/g) ?? []).length;
    expect(drips("SLOP")).toBe(56);
    expect(shown("SLOP")).toBe(7);
    expect(shown("PRODUCT ONBOARDING")).toBeGreaterThanOrEqual(28);
    const inline = renderVectorEffect(drip, { word: "PRODUCT ONBOARDING", inline: true }).svg;
    // Inline, the picture widens with the word rather than squeezing it.
    expect(inline).toMatch(/viewBox="-[\d.]+ 45 (\d+) 75"/);
    expect(Number(/viewBox="[^ ]+ 45 (\d+) 75"/.exec(inline)![1])).toBeGreaterThan(1000);
    expect(inline).toContain('scale(1) translate(-200 -100)');
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
    expect(inline).toContain('viewBox="46 45 308 75" overflow="visible"');
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
    expect(findEffects({ text: "aurora" }).map((e) => e.id)).toEqual(["aurora", "northern-lights"]);
    expect(findEffects({ kind: "vector" }).every((e) => e.kind === "vector")).toBe(true);
    expect(findEffects({ tags: ["loader"] }).length).toBeGreaterThan(2);
    expect(findEffects({ text: "no such thing anywhere" })).toEqual([]);
  });

  it("writes tags one way: kebab-case, each once, and never both a word and its plural", () => {
    for (const effect of EFFECTS) {
      for (const tag of effect.tags) expect(tag, effect.id).toMatch(TAG_FORMAT);
      expect(new Set(effect.tags).size, `${effect.id} repeats a tag`).toBe(effect.tags.length);
    }
    // Different words that only look like a plural.
    const apart = new Set(["new"]);
    const tags = new Set(effectTags().map((t) => t.tag));
    for (const tag of tags) if (!apart.has(tag)) expect(tags.has(`${tag}s`), `"${tag}" and "${tag}s" are both tags; use one`).toBe(false);
  });

  it("lists tags with how many effects carry them, the most used first", () => {
    const all = effectTags();
    expect(all.reduce((n, t) => n + t.count, 0)).toBe(EFFECTS.reduce((n, e) => n + e.tags.length, 0));
    for (let i = 1; i < all.length; i++) expect(all[i - 1]!.count).toBeGreaterThanOrEqual(all[i]!.count);
    const fire = effectTags({ category: "fire" });
    expect(fire.find((t) => t.tag === "fire")!.count).toBe(findEffects({ category: "fire", tags: ["fire"] }).length);
    for (const { tag, count } of fire) expect(findEffects({ category: "fire", tags: [tag] }).length).toBe(count);
  });

  it("finds tags in any case, with spaces for hyphens", () => {
    expect(normaliseTag(" Game Boy ")).toBe("game-boy");
    expect(findEffects({ tags: ["Game Boy"] }).map((e) => e.id)).toEqual(findEffects({ tags: ["game-boy"] }).map((e) => e.id));
    expect(findEffects({ tags: ["game-boy"] }).length).toBeGreaterThan(0);
  });

  it("says how every shader with an image control suits video, and only those", () => {
    for (const effect of EFFECTS) {
      if (effect.kind !== "shader") continue;
      const images = parseControls(effect.source).some((c) => c.type === "sampler2D");
      if (images) expect(VIDEO_USES, `${effect.id} needs a video use`).toContain(effect.video);
      else expect(effect.video, `${effect.id} takes no image, so no video`).toBeUndefined();
    }
    expect(getEffect("crt")).toMatchObject({ video: "filter" });
    expect(getEffect("transition-wipe")).toMatchObject({ video: "transition" });
    expect(getEffect("magnifier")).toMatchObject({ video: "interactive" });
    expect(getEffect("time-echo")).toMatchObject({ video: "stills" });
    expect(getEffect("shader-text")).toMatchObject({ video: "none" });
  });

  it("finds effects by how they suit video", () => {
    const filters = findEffects({ video: ["filter"] });
    expect(filters.length).toBeGreaterThan(15);
    expect(filters.every((e) => e.kind === "shader" && e.video === "filter")).toBe(true);
    const clips = findEffects({ video: ["filter", "transition"] }).map((e) => e.id);
    expect(clips).toContain("transition-luma");
    expect(clips).not.toContain("aurora");
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
  // These draw a whole opaque device or ticket around the picture, so they stay opaque.
  const OPAQUE = new Set(["gameboy-screen", "scratch-card"]);

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

  it("draws the generators with a background opacity as overlays, with their background a preset away", () => {
    for (const id of ["sparkles", "bokeh", "circular-spectrum", "bass-pulse", "vinyl", "gemstone", "chrome-text", "floor-reflection"]) {
      const effect = getEffect(id)!;
      expect(effect, id).toMatchObject({ transparent: true });
      expect(effect.tags, id).toContain("overlay");
      expect(effectDefaults(effect).uBackgroundAlpha, id).toBe(0);
      expect(effect.presets?.some((p) => p.values.uBackgroundAlpha === 1), id).toBe(true);
    }
  });

  it("exposes background alpha and sparsity controls on sparkles and bokeh", () => {
    const sparkles = getEffect("sparkles")!;
    const bokeh = getEffect("bokeh")!;
    expect(effectDefaults(sparkles)).toMatchObject({ uBackgroundAlpha: 0, uChance: 1 });
    expect(effectDefaults(bokeh)).toMatchObject({ uBackgroundAlpha: 0 });
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

  it("text effects keep long text full size inline, and say how far they spill", () => {
    const long = "The quick brown fox jumps over";
    for (const effect of findEffects({ kind: "vector", category: "text" }) as VectorEffect[]) {
      // Text on a path is framed by its path, not its words: long text runs along it instead.
      if (effect.motion.svg.includes("<textPath")) continue;
      const values = { text: long, word: long, prefix: long, inline: true };
      const block = svgInlineLayout(renderVectorEffect(effect, { ...values, inline: false }).svg)!;
      const inline = svgInlineLayout(renderVectorEffect(effect, values).svg)!;
      // Inline, the picture widens rather than the text shrinking to the stage.
      expect(inline.aspectRatio, effect.id).toBeGreaterThan(400 / (200 * 0.72) + 1);
      expect(block.viewBox, effect.id).toEqual([0, 0, 400, 200]);
      expect(inline.overhang.bottom, effect.id).toBeGreaterThan(0);
    }
  });

  it("colours take CSS colours and currentColor, through effectDefaults too", () => {
    const drip = getEffect("drip-text") as VectorEffect;
    expect(effectDefaults(drip, { values: { fill: "#000", outline: "rgb(255 255 255)" } })).toMatchObject({ fill: [0, 0, 0], outline: [1, 1, 1] });
    expect(renderVectorEffect(drip, effectDefaults(drip, { values: { fill: "hsl(0 100% 50%)" } })).svg).toContain('fill="#ff0000"');
    for (const effect of findEffects({ kind: "vector", category: "text" }) as VectorEffect[]) {
      const colours = effectControls(effect).filter((c) => c.color);
      const values = effectDefaults(effect, { values: Object.fromEntries(colours.map((c) => [c.name, "currentColor"])) });
      expect(colours.every((c) => values[c.name] === "currentColor"), effect.id).toBe(true);
      const motion = renderVectorEffect(effect, values);
      expect(motion.svg, effect.id).toContain('"currentColor"');
      expect(motion.svg, effect.id).not.toMatch(/#[0-9a-f]{6}"/i);
      expect(svgMotionIssues(motion), effect.id).toEqual([]);
    }
    // Shaders take no currentColor: it falls back to the default.
    const aurora = getEffect("aurora")!;
    const colour = effectControls(aurora).find((c) => c.color)!;
    expect(effectDefaults(aurora, { values: { [colour.name]: "currentColor" } })[colour.name]).toEqual(colour.default);
  });

  it("typewriter writes its text with a caret, kinetic stagger one letter per slot", () => {
    const typed = renderVectorEffect(getEffect("typewriter") as never, { text: "Hi there" });
    expect(typed.animate![0]).toMatchObject({ id: "typed", write: "Hi there", caret: "▌", ms: 720 });
    const kinetic = renderVectorEffect(getEffect("kinetic-stagger") as never, { text: "Go!" }).svg;
    expect(kinetic).toMatch(/id="l0"[^>]*>G</);
    expect(kinetic).toMatch(/id="l2"[^>]*>!</);
    expect(kinetic).toMatch(/id="l3"[^>]*><\/text>/);
  });

  it("caption effects put one word per slot, leave the rest empty and stagger the words", () => {
    const at = (svg: string, id: string) => Number(svg.match(new RegExp(`id="${id}"[^>]*?translate\\((-?[\\d.]+)`))![1]);
    const bounce = renderVectorEffect(getEffect("caption-word-bounce") as never, { text: "  one two   three ", stagger: 100 });
    expect(bounce.svg).toMatch(/id="bw0"[^>]*>one</);
    expect(bounce.svg).toMatch(/id="bw2"[^>]*>three</);
    expect(bounce.svg).toMatch(/id="bw3"[^>]*><\/text>/);
    expect(at(bounce.svg, "bw0")).toBeLessThan(at(bounce.svg, "bw1"));
    expect(at(bounce.svg, "bw1")).toBeLessThan(at(bounce.svg, "bw2"));
    const rises = bounce.animate!.filter((a) => a.ms === 260);
    expect(rises.slice(0, 4).map((a) => a.delay)).toEqual([0, 100, 200, 0]);
    expect(bounce.animate!.find((a) => a.id === "bw0" && a.ms === 260)!.attrs!.transform![1]).toContain("scale(1.15)");
    // Thirteen words: the twelfth is the last that shows.
    const many = renderVectorEffect(getEffect("caption-pop") as never, { text: Array.from({ length: 13 }, (_, i) => `w${i}`).join(" ") }).svg;
    expect(many).toMatch(/id="pw11"[^>]*>w11</);
    expect(many).not.toContain(">w12<");

    const karaoke = renderVectorEffect(getEffect("caption-karaoke") as never, { text: "sing it loud", pace: 300 });
    const wipes = karaoke.animate!.filter((a) => /^kc\d+$/.test(a.id!));
    expect(wipes).toHaveLength(12);
    expect(wipes.slice(0, 3).map((a) => [a.delay, a.ms])).toEqual([[400, 300], [700, 300], [1000, 300]]);
    expect(wipes[0]!.attrs!.width![1]).toBeGreaterThan(0);
    expect(wipes[3]!.attrs!.width![1]).toBe(0);
    expect(karaoke.svg).toContain('clip-path="url(#kclip1)"');
    expect(karaoke.svg).toContain('fill="#facc15"');

    // Pop: alternating tilts, and each word lit until the next one lands.
    const pop = renderVectorEffect(getEffect("caption-pop") as never, { text: "a b c", pace: 200 });
    expect(pop.svg).toMatch(/id="pw0"[^>]*rotate\(-4\)/);
    expect(pop.svg).toMatch(/id="pw1"[^>]*rotate\(4\)/);
    const fills = pop.animate!.filter((a) => a.id === "pw1" && a.attrs!.fill);
    expect(fills.map((a) => a.delay)).toEqual([200, 400]);
  });

  it("caption effects wrap a long caption onto two lines, but never inline", () => {
    const text = "this caption is long enough that it wraps";
    const effect = getEffect("caption-pop") as VectorEffect;
    const ys = (svg: string) => new Set([...svg.matchAll(/id="pw\d+"[^>]*?translate\([\d.-]+ ([\d.-]+)\)[^>]*>[^<]/g)].map((m) => m[1]));
    expect(ys(renderVectorEffect(effect, { text }).svg).size).toBe(2);
    expect(ys(renderVectorEffect(effect, { text, inline: true }).svg).size).toBe(1);
    expect(ys(renderVectorEffect(effect, { text: "short one" }).svg).size).toBe(1);
  });

  it("gives the image morphs two pictures and a progress control", () => {
    for (const id of ["feature-morph", "silhouette-morph", "transition-liquid-morph", "transition-displacement", "transition-luma", "transition-particle-swap", "transition-ink-bleed", "transition-whip-pan"]) {
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
    for (const id of ["click-ripple", "click-burst", "cursor-glow", "hover-liquid", "hover-reveal", "magnifier", "holo-card", "card-flip", "press-charge", "hover-swap"])
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
    for (const id of ["click-ripple", "click-burst", "cursor-glow", "holo-card", "card-flip", "press-charge"]) {
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

describe("artist's media effects", () => {
  const MEDIA = ["image-pencil-sketch", "image-watercolor", "image-crosshatch", "image-charcoal", "sketch-reveal"];

  it("are video filters found by the medium's name", () => {
    for (const id of MEDIA) expect(getEffect(id), id).toMatchObject({ kind: "shader", category: "image", video: "filter" });
    for (const [words, id] of [
      ["pencil", "image-pencil-sketch"],
      ["watercolour", "image-watercolor"],
      ["watercolor", "image-watercolor"],
      ["stipple", "image-crosshatch"],
      ["woodcut", "image-crosshatch"],
      ["chalk", "image-charcoal"],
      ["crayon", "image-charcoal"],
      ["pastel", "image-charcoal"],
      ["sketch reveal", "sketch-reveal"],
    ] as const) {
      expect(findEffects({ text: words }).map((e) => e.id), words).toContain(id);
    }
  });

  it("pen and ink draws hatching, stippling or engraving, with a preset for each", () => {
    const pen = getEffect("image-crosshatch")!;
    expect(effectControls(pen).find((c) => c.name === "uStyle")).toMatchObject({ min: 0, max: 2, default: 0 });
    const styles = (pen.presets ?? []).map((p) => p.values.uStyle ?? 0);
    expect(new Set(styles)).toEqual(new Set([0, 1, 2]));
  });

  it("charcoal draws in colour for its crayon and pastel presets", () => {
    const charcoal = getEffect("image-charcoal")!;
    expect(effectDefaults(charcoal).uColour).toBe(0);
    for (const preset of ["Crayon", "Soft pastel"]) expect(effectDefaults(charcoal, { preset }).uColour, preset).toBe(1);
  });

  it("sketch reveal loops, with a still progress control", () => {
    const reveal = getEffect("sketch-reveal")!;
    expect(reveal.kind === "shader" && reveal.loop).toBe(6);
    expect(effectControls(reveal).map((c) => c.name)).toEqual(expect.arrayContaining(["uAnimate", "uProgress"]));
  });
});

describe("electric effects", () => {
  const electric = findEffects({ category: "electric" });

  it("has the lightning, arcs, plasma, sparks and icons", () => {
    const ids = electric.map((e) => e.id);
    for (const id of ["lightning", "tesla-arc", "plasma-ball", "electric-border", "electric-text", "jacobs-ladder", "short-circuit", "power-surge", "electric-field", "zap-icon", "power-button"])
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

  it("are retro (the chomp loader is a loader) and tagged pixel or retro", () => {
    for (const id of [...SHADERS, ...VECTORS]) {
      const effect = getEffect(id)!;
      expect(effect, id).toBeDefined();
      expect(effect.category, id).toBe(id === "chomp-loader" ? "loader" : "retro");
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

describe("growth effects", () => {
  const IDS = ["reaction-diffusion", "cell-division", "coral-growth", "veins", "ferrofluid", "jellyfish", "fur"];

  it("are opaque organic shaders with presets", () => {
    for (const id of IDS) {
      const effect = getEffect(id)!;
      expect(effect, id).toBeDefined();
      expect(effect.kind, id).toBe("shader");
      expect(effect.category, id).toBe("organic");
      expect(effect.tags, id).toContain("organic");
      expect(effect.presets?.length, id).toBeGreaterThan(0);
      if (effect.kind === "shader") {
        expect(effect.transparent, id).toBeUndefined();
        expect(effect.video, id).toBeUndefined();
      }
    }
  });

  it("follow the pointer where they are interactive, and cell division loops", () => {
    for (const id of ["ferrofluid", "fur"]) {
      const effect = getEffect(id)!;
      expect(effect.kind === "shader" && effect.source, id).toContain("iPointer");
      expect(effect.tags, id).toContain("hover");
    }
    expect(getEffect("cell-division")).toMatchObject({ loop: 8 });
    expect(getEffect("reaction-diffusion")!.presets!.map((p) => p.name)).toEqual(["Coral", "Zebra", "Leopard spots"]);
    expect(getEffect("veins")!.presets!.map((p) => p.name)).toEqual(["Leaf veins", "Blood vessels", "Tree roots"]);
    expect(getEffect("fur")!.presets!.map((p) => p.name)).toEqual(["Moss", "Fur", "Grass"]);
  });
});

describe("splatter effects", () => {
  const splatter = findEffects({ category: "splatter" });

  it("has paint, ink, crowns, goo, a roller, water and a stamp", () => {
    const ids = splatter.map((e) => e.id);
    for (const id of ["paint-splatter", "ink-splash", "splash-crown", "goo-splat", "paint-roller", "water-splash", "splat-stamp"]) expect(ids).toContain(id);
    for (const effect of splatter) expect(effect.tags).toContain("splatter");
  });

  it("draws the overlays transparent, splats at clicks with an idle demo, and loops", () => {
    for (const id of ["paint-splatter", "goo-splat", "water-splash"]) expect(getEffect(id)).toMatchObject({ transparent: true });
    for (const id of ["paint-splatter", "goo-splat"]) {
      const effect = getEffect(id)!;
      expect(effect.kind === "shader" && effect.source, id).toMatch(/\biClicks\[/);
      expect(effectControls(effect).map((c) => c.name), id).toContain("uDemo");
    }
    for (const effect of splatter) if (effect.kind === "shader") expect(effect.loop, effect.id).toBeGreaterThan(0);
    expect(getEffect("paint-roller")).toMatchObject({ video: "transition" });
  });

  it("stamps a splat that morphs from a dot and back, for any shape", () => {
    const effect = getEffect("splat-stamp")!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
    for (const shape of [0, 5, 9]) {
      const motion = renderVectorEffect(effect, { shape, size: 50 });
      expect(svgMotionIssues(motion)).toEqual([]);
      const ds = (motion.animate ?? []).filter((a) => a.id === "splat").flatMap((a) => a.attrs!.d!);
      expect(new Set(ds.map((d) => String(d).replace(NUMBER, "#"))).size).toBe(1);
      expect(ds[0]).toBe(ds[ds.length - 1]);
    }
  });
});

describe("bubble effects", () => {
  const bubbles = findEffects({ category: "bubble" });

  it("has the soap, underwater, fizz, foam, wrap, lava and chat bubbles", () => {
    const ids = bubbles.map((e) => e.id);
    for (const id of ["soap-bubbles", "underwater-bubbles", "fizz", "foam", "bubble-wrap", "lava-bubbles", "chat-bubble"])
      expect(ids).toContain(id);
    for (const effect of bubbles) expect(effect.tags).toContain("bubble");
  });

  it("draws soap bubbles as an overlay and pops them, and bubble wrap, at clicks", () => {
    expect(getEffect("soap-bubbles")).toMatchObject({ transparent: true });
    expect(getEffect("underwater-bubbles")).toMatchObject({ video: "filter" });
    for (const id of ["soap-bubbles", "bubble-wrap"]) {
      const effect = getEffect(id)!;
      expect(effect.kind === "shader" && effect.source, id).toMatch(/\biClicks\[/);
      expect(effect.kind === "shader" && effect.source, id).not.toMatch(/uniform\s+vec4\s+iClicks/);
      expect(effectControls(effect).map((c) => c.name), id).toContain("uDemo");
    }
  });

  it("chat bubble writes its message", () => {
    const effect = getEffect("chat-bubble")!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    for (const text of ["Hi", "A much longer message that has to shrink to fit the bubble"]) {
      const motion = renderVectorEffect(effect, { text });
      expect(svgMotionIssues(motion)).toEqual([]);
      expect(JSON.stringify(motion)).not.toMatch(/\{\{|NaN|undefined/);
      expect(motion.animate!.find((a) => a.write)!.write).toBe(text);
    }
  });

  it("bubble pop loader ends every attribute where it starts", () => {
    const effect = getEffect("bubble-pop-loader")!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    const motion = renderVectorEffect(effect, effectDefaults(effect));
    const first = new Map<string, unknown>();
    const last = new Map<string, unknown>();
    const timed = [...motion.animate!].map((a, i) => ({ a, i })).sort((x, y) => (x.a.delay ?? 0) - (y.a.delay ?? 0) || x.i - y.i);
    for (const { a } of timed)
      for (const [name, [from, to]] of Object.entries(a.attrs ?? {})) {
        const key = `${a.id}.${name}`;
        if (!first.has(key)) first.set(key, from);
        last.set(key, to);
      }
    for (const [key, value] of first) expect(last.get(key), key).toEqual(value);
  });
});

describe("sticker effects", () => {
  const stickers = findEffects({ category: "sticker" });
  const render = (effect: (typeof stickers)[number], values: Record<string, unknown> = {}) => {
    if (effect.kind !== "vector") throw new Error("vector expected");
    return renderVectorEffect(effect, values as never);
  };
  const frameAt = (motion: ReturnType<typeof render>, clicks: number[], ms: number) => JSON.stringify([...svgFrame(motion.animate!, clicks, ms)].sort());

  it("has the slapped, peeled, holo, stamped and taped stickers, all tagged", () => {
    const ids = stickers.map((e) => e.id);
    for (const id of ["sticker-slap", "sticker-peel", "holo-sticker", "sticker-sheet", "stamp-badge", "washi-tape", "holo-foil-sticker", "sticker-peel-reveal"])
      expect(ids).toContain(id);
    for (const effect of stickers) expect(effect.tags).toContain("sticker");
  });

  it("slap replays on every click and the stamp toggles, each ending a round as it started", () => {
    for (const [id, steps] of [["sticker-slap", 1], ["stamp-badge", 2]] as const) {
      const effect = getEffect(id)!;
      expect(effect.kind === "vector" && effect.trigger, id).toBe("click");
      const motion = render(effect);
      expect(motion.animate!.every((a) => (a.step ?? 0) >= 1 && (a.step ?? 0) <= steps), id).toBe(true);
      const start = frameAt(motion, [], 0);
      expect(frameAt(motion, [0], 300), id).not.toBe(start);
      expect(frameAt(motion, steps === 2 ? [0, 5000] : [0], 10000), id).toBe(start);
    }
  });

  it("peels on hover to a different end", () => {
    const effect = getEffect("sticker-peel")!;
    expect(effect.kind === "vector" && effect.trigger).toBe("hover");
    const motion = render(effect);
    expect(frameAt(motion, [], svgDuration(motion))).not.toBe(frameAt(motion, [], 0));
  });

  it("holo sticker loops seamlessly: everything plays inside one sweep, which moves its gradient a whole period", () => {
    const effect = getEffect("holo-sticker")!;
    for (const speed of [1, 3, 8]) {
      const motion = render(effect, { speed });
      expect(svgDuration(motion)).toBe(speed * 1000);
      const shift = (id: string) => motion.animate!.find((a) => a.id === id)!.attrs!.gradientTransform!.map((t) => Number(/translate\((-?[\d.]+)/.exec(String(t))![1]));
      expect(shift("holoFoil")).toEqual([0, 150]);
      // The grain's gradient repeats every 30 (reflected, so every 60).
      expect(shift("holoGrain")).toEqual([0, -60]);
      // Sparkles and sheen are gone again by the end, as at the start.
      expect(frameAt(motion, [], speed * 1000)).toMatch(/"glint3",\{"attrs":\{"transform":"[^"]*scale\(0\)/);
    }
  });

  it.each(stickers.flatMap((e) => effectControls(e).filter((c) => c.type === "text" && c.name !== "font").map((c) => [e.id, c.name, e] as const)))(
    "%s fits short, long and unusual %s",
    (_, name, effect) => {
      for (const word of ["A", "Supercalifragilistic & <co>", "Café 日本 🎉", ""]) {
        const motion = render(effect, { [name]: word });
        expect(svgMotionIssues(motion)).toEqual([]);
        expect(JSON.stringify(motion)).not.toMatch(/\{\{|NaN|undefined/);
      }
    },
  );

  it("switches the slap and holo shapes", () => {
    for (const id of ["sticker-slap", "holo-sticker"]) {
      const shapes = new Set([0, 1, 2, 3].map((shape) => render(getEffect(id)!, { shape }).svg));
      expect(shapes.size, id).toBe(4);
    }
  });

  it("draws the foil sticker over a transparent canvas from a mask, tilting with the pointer", () => {
    const foil = getEffect("holo-foil-sticker")!;
    expect(foil).toMatchObject({ transparent: true, video: "none" });
    expect(effectDefaults(foil).uMask).toBe(textImage("WOW"));
    expect(foil.kind === "shader" && foil.source).toMatch(/\biPointer\b/);
    expect(foil.kind === "shader" && foil.source).not.toMatch(/uniform\s+vec4\s+(iPointer|iClicks)/);
  });

  it("peel reveal is a looping two-image transition", () => {
    const peel = getEffect("sticker-peel-reveal")!;
    expect(peel).toMatchObject({ video: "transition", loop: 4 });
    expect(effectControls(peel).map((c) => c.name)).toEqual(expect.arrayContaining(["uFrom", "uTo", "uAnimate", "uProgress"]));
  });
});

describe("impact effects", () => {
  const impacts = findEffects({ category: "impact" });

  it("has the shockwave, slam, impact frame, meteor, shake and hit marker, all tagged", () => {
    const ids = impacts.map((e) => e.id);
    for (const id of ["shockwave", "ground-slam", "impact-frame", "meteor-strike", "screen-shake", "hit-marker"]) expect(ids).toContain(id);
    for (const effect of impacts) expect(effect.tags).toContain("impact");
  });

  it.each(impacts.filter((e) => e.kind === "shader").map((e) => [e.id, e] as const))("%s strikes at clicks and on a schedule while idle", (_, effect) => {
    if (effect.kind !== "shader") return;
    expect(effect.source).toMatch(/\biClicks\b/);
    expect(effect.source).not.toMatch(/uniform\s+vec4\s+(iPointer|iClicks)/);
    expect(effectControls(effect).find((c) => c.name === "uDemo")).toMatchObject({ type: "bool", default: true });
    const image = effectControls(effect).some((c) => c.type === "sampler2D");
    expect(effect.video === "interactive").toBe(image);
    expect(effect.transparent).toBeFalsy();
  });

  it("hit marker replays on every click, ending as it started, and can hide its number", () => {
    const effect = getEffect("hit-marker")!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    expect(effect.trigger).toBe("click");
    const motion = renderVectorEffect(effect, { damage: 1234 });
    expect(motion.svg).toContain(">1234</text>");
    expect(motion.animate!.every((a) => a.step === 1)).toBe(true);
    const frameAt = (clicks: number[], ms: number) => JSON.stringify([...svgFrame(motion.animate!, clicks, ms)].sort());
    const start = frameAt([], 0);
    expect(frameAt([0], 200)).not.toBe(start);
    expect(frameAt([0], 10000)).toBe(start);
    const hidden = renderVectorEffect(effect, { showNumber: false });
    expect(hidden.animate!.find((a) => a.id === "hitMarkerNumber")!.attrs!.opacity).toEqual([0, 0]);
  });
});

describe("particle effects", () => {
  const particles = findEffects({ category: "particles" });

  it("has the flow, swarm, dust, flock, text, confetti and firefly systems, all tagged", () => {
    const ids = particles.map((e) => e.id);
    for (const id of ["flow-particles", "magnetic-swarm", "dust-in-light", "boids", "particle-text", "confetti-cannon", "fireflies"]) expect(ids).toContain(id);
    for (const effect of particles) expect(effect.tags).toContain("particles");
  });

  it("draws the swarm, dust and confetti as transparent overlays", () => {
    for (const id of ["magnetic-swarm", "dust-in-light", "confetti-cannon"]) expect(getEffect(id)!).toMatchObject({ transparent: true });
  });

  it("reads the pointer built-ins without declaring them, with idle demos where clicks matter", () => {
    for (const id of ["magnetic-swarm", "confetti-cannon", "fireflies"]) {
      const effect = getEffect(id)!;
      if (effect.kind !== "shader") throw new Error("shader expected");
      expect(effect.tags, id).toContain("interactive");
      expect(effect.source, id).toMatch(/\biPointer\b|\biClicks\b/);
      expect(effect.source, id).not.toMatch(/uniform\s+vec4\s+(iPointer|iClicks|iTrail)/);
    }
    for (const id of ["magnetic-swarm", "confetti-cannon"])
      expect(effectControls(getEffect(id)!).find((c) => c.name === "uDemo"), id).toMatchObject({ type: "bool", default: true });
  });

  it("dissolves FLAIR by default on a 6 s loop, an image control not meant for video", () => {
    const text = getEffect("particle-text")!;
    expect(text).toMatchObject({ video: "none", loop: 6 });
    expect(effectDefaults(text).uText).toBe(textImage("FLAIR"));
    for (const effect of particles.filter((e) => e.id !== "particle-text")) expect(effect.kind === "shader" && effect.video, effect.id).toBeUndefined();
  });
});

describe("trail effects", () => {
  const trails = findEffects({ category: "trail" });
  const shaders = ["comet-trail", "ribbon-trail", "sparkle-trail", "brush-trail", "ghost-trail", "light-painting"];

  it("has the comet, ribbon, sparkle, brush, ghost, light painting, streak and dotted trails, all tagged", () => {
    const ids = trails.map((e) => e.id);
    for (const id of [...shaders, "motion-streak", "dotted-trail"]) expect(ids).toContain(id);
    for (const effect of trails) expect(effect.tags).toContain("trail");
  });

  it("follow iTrail with an idle demo, draw over the page (light painting opaque) and take no pictures", () => {
    for (const id of shaders) {
      const effect = getEffect(id)!;
      if (effect.kind !== "shader") throw new Error("shader expected");
      expect(effect.source, id).toMatch(/\biTrail\[/);
      expect(effect.source, id).not.toMatch(/uniform\s+vec4\s+(iTrail|iPointer|iClicks)/);
      expect(effectControls(effect).map((c) => c.name), id).toContain("uDemo");
      expect(effect.transparent ?? false, id).toBe(id !== "light-painting");
      expect(effect.video, id).toBeUndefined();
    }
  });

  it("ghost trail switches between its shapes", () => {
    const ghost = getEffect("ghost-trail")!;
    expect(effectControls(ghost).find((c) => c.name === "uShape")).toMatchObject({ type: "int", min: 0, max: 2 });
  });

  it("motion streak switches shape, and the dotted trail moves its dots along its paths", () => {
    const streak = getEffect("motion-streak")!;
    const dotted = getEffect("dotted-trail")!;
    if (streak.kind !== "vector" || dotted.kind !== "vector") throw new Error("vector expected");
    expect(renderVectorEffect(streak, { shape: 0 }).svg).not.toBe(renderVectorEffect(streak, { shape: 1 }).svg);
    const motion = renderVectorEffect(dotted, {});
    expect(motion.animate!.filter((a) => a.along).length).toBe(12);
    // The stagger moves the two sides apart.
    expect(renderVectorEffect(dotted, { stagger: 0 }).svg).not.toBe(renderVectorEffect(dotted, { stagger: 20 }).svg);
    for (const values of [{}, { keep: 2, gap: 60 }, { keep: 12, gap: 400, footprints: true }] as Record<string, number | boolean>[])
      expect(JSON.stringify(renderVectorEffect(dotted, values))).not.toMatch(/\{\{|NaN|undefined/);
  });
});

describe("comic effects", () => {
  const comics = findEffects({ category: "comic" });
  const render = (id: string, values: Record<string, unknown> = {}) => {
    const effect = getEffect(id)!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    return renderVectorEffect(effect, { ...effectDefaults(effect), ...values } as never);
  };
  const frameAt = (motion: ReturnType<typeof render>, clicks: number[], ms: number) => JSON.stringify([...svgFrame(motion.animate!, clicks, ms)].sort());

  it("has the inked, toon, speed-line, panel and cartoon effects, all tagged", () => {
    const ids = comics.map((e) => e.id);
    for (const id of ["comic-book", "cel-shade", "focus-lines", "action-lines", "sound-effect", "speech-bubble", "fight-cloud", "dizzy-stars", "anime-emotes", "cartoon-poof", "line-boil"])
      expect(ids).toContain(id);
    for (const effect of comics) expect(effect.tags.some((t) => t === "comic" || t === "cartoon"), effect.id).toBe(true);
    expect(getEffect("transition-comic-panels")).toMatchObject({ category: "transition", video: "transition", loop: 4 });
    expect(getEffect("transition-comic-panels")!.tags).toEqual(expect.arrayContaining(["transition", "comic"]));
  });

  it("says how the image ones suit video, and focus lines follow the pointer", () => {
    for (const id of ["comic-book", "cel-shade", "action-lines"]) expect(getEffect(id), id).toMatchObject({ video: "filter" });
    const focus = getEffect("focus-lines")!;
    expect(focus).toMatchObject({ transparent: true });
    expect(focus.kind === "shader" && focus.source).toMatch(/\biPointer\b/);
    expect(focus.kind === "shader" && focus.source).not.toMatch(/uniform\s+vec4\s+iPointer/);
  });

  it("sound effect and speech bubble take any text", () => {
    for (const [id, name] of [["sound-effect", "word"], ["speech-bubble", "text"], ["cartoon-poof", "word"]] as const)
      for (const text of ["A", "Supercalifragilistic expialidocious & <co> with a very long tail of words that goes on and on", "Café 日本 🎉", ""]) {
        for (const thought of [false, true]) {
          const motion = render(id, { [name]: text, thought });
          expect(svgMotionIssues(motion), id).toEqual([]);
          expect(JSON.stringify(motion), id).not.toMatch(/\{\{|NaN|undefined/);
        }
      }
    const written = render("speech-bubble", { text: "Holy guacamole, it really works" }).animate!.filter((a) => a.write !== undefined).map((a) => a.write).join(" ");
    expect(written.trim()).toBe("Holy guacamole, it really works");
  });

  it("speech bubble switches to a thought cloud with trailing circles", () => {
    const speech = render("speech-bubble").svg;
    const thought = render("speech-bubble", { thought: true }).svg;
    expect(speech).not.toBe(thought);
    expect(thought).toMatch(/<g display="inline"><circle id="sbTrail0"/);
    expect(speech).toMatch(/<g display="none"><circle id="sbTrail0"/);
  });

  it("anime emotes show one emote at a time", () => {
    for (const emote of [0, 1, 2, 3]) {
      const svg = render("anime-emotes", { emote }).svg;
      expect(svg.match(/display="inline"/g)!.length, String(emote)).toBe(1);
    }
  });

  it("cartoon poof vanishes on a click and comes back as it was", () => {
    const effect = getEffect("cartoon-poof")!;
    expect(effect.kind === "vector" && effect.trigger).toBe("click");
    for (const shape of [0, 1, 2]) {
      const motion = render("cartoon-poof", { shape });
      expect(motion.animate!.every((a) => a.step === 1)).toBe(true);
      const start = frameAt(motion, [], 0);
      expect(frameAt(motion, [0], 500)).not.toBe(start);
      expect(frameAt(motion, [0], 10000)).toBe(start);
    }
  });

  it("loops end where they start", () => {
    for (const id of ["fight-cloud", "dizzy-stars", "anime-emotes"]) {
      const motion = render(id);
      expect(frameAt(motion, [], svgDuration(motion)), id).toBe(frameAt(motion, [], 0));
    }
  });

  it("line boil redraws its noise in steps over any path", () => {
    const motion = render("line-boil", { rate: 100, d: "M0 0 L10 10" });
    expect(motion.svg).toContain('d="M0 0 L10 10"');
    expect(motion.svg).toMatch(/<feTurbulence id="lineBoilNoise"/);
    expect(svgDuration(motion)).toBe(400);
    const seeds = new Set([0, 150, 250, 350].map((t) => svgFrame(motion.animate!, [], t).get("lineBoilNoise")!.attrs.seed));
    expect(seeds.size).toBe(4);
  });
});

describe("debris effects", () => {
  const debris = findEffects({ category: "debris" });
  const source = (id: string) => {
    const effect = getEffect(id)!;
    return effect.kind === "shader" ? effect.source : "";
  };

  it("has rubble, glass, crumbling text, shreds, leaves and sand", () => {
    const ids = debris.map((e) => e.id);
    for (const id of ["rubble-fall", "glass-shatter", "crumbling-text", "paper-shreds", "leaves-blowing", "sand-erosion"]) expect(ids).toContain(id);
    for (const effect of debris) expect(effect.tags).toContain("debris");
  });

  it("draws the falling debris as transparent overlays, and says how pictures take video", () => {
    for (const id of ["rubble-fall", "paper-shreds", "leaves-blowing", "crumbling-text", "sand-erosion"]) expect(getEffect(id), id).toMatchObject({ transparent: true });
    expect(getEffect("glass-shatter")).toMatchObject({ video: "interactive" });
    expect(getEffect("crumbling-text")).toMatchObject({ video: "none", loop: 8 });
    expect(getEffect("sand-erosion")).toMatchObject({ video: "none", loop: 8 });
    for (const id of ["rubble-fall", "paper-shreds", "leaves-blowing"]) expect(getEffect(id), id).not.toHaveProperty("video");
  });

  it("shatters glass at clicks, with a demo while idle, and reads the built-in without declaring it", () => {
    expect(source("glass-shatter")).toMatch(/\biClicks\[0\]/);
    expect(source("glass-shatter")).not.toMatch(/uniform\s+vec4\s+iClicks/);
    expect(effectControls(getEffect("glass-shatter")!).map((c) => c.name)).toContain("uDemo");
  });

  it("crumbles and erodes text masks by default, with a still progress control", () => {
    expect(effectDefaults(getEffect("crumbling-text")!).uText).toBe(textImage("DECAY"));
    expect(effectDefaults(getEffect("sand-erosion")!).uMask).toBe(textImage("SAND"));
    for (const id of ["crumbling-text", "sand-erosion"])
      expect(effectControls(getEffect(id)!).map((c) => c.name), id).toEqual(expect.arrayContaining(["uAnimate", "uProgress"]));
  });

  it("lets the wind blow either way", () => {
    const wind = effectControls(getEffect("leaves-blowing")!).find((c) => c.name === "uWind")!;
    expect(wind.min).toBeLessThan(0);
    expect(wind.max).toBeGreaterThan(0);
  });
});

describe("atmosphere effects", () => {
  const atmosphere = findEffects({ category: "atmosphere" });
  const source = (id: string) => {
    const effect = getEffect(id)!;
    return effect.kind === "shader" ? effect.source : "";
  };

  it("has clouds, fog banks, steam, mist, a sky timelapse, a smoke curl and dry ice fog", () => {
    const ids = atmosphere.map((e) => e.id);
    for (const id of ["volumetric-clouds", "fog-banks", "rising-steam", "mist-over-image", "sky-timelapse", "smoke-curl", "dry-ice-fog"])
      expect(ids).toContain(id);
    for (const effect of atmosphere) expect(effect.tags).toContain("atmosphere");
  });

  it("draws fog, steam and smoke as transparent overlays, and mist filters video", () => {
    for (const id of ["fog-banks", "rising-steam", "smoke-curl", "dry-ice-fog"]) expect(getEffect(id), id).toMatchObject({ transparent: true });
    for (const id of ["volumetric-clouds", "sky-timelapse", "mist-over-image"]) expect(getEffect(id), id).not.toHaveProperty("transparent");
    expect(getEffect("mist-over-image")).toMatchObject({ video: "filter" });
    for (const id of ["volumetric-clouds", "fog-banks", "rising-steam", "sky-timelapse", "smoke-curl", "dry-ice-fog"])
      expect(getEffect(id), id).not.toHaveProperty("video");
  });

  it("keeps the cloud ray march bounded, with a sun direction and the three looks", () => {
    const loops = [...source("volumetric-clouds").matchAll(/for \(int \w+ = \d+; \w+ <=? (\d+);/g)].map((m) => Number(m[1]));
    expect(Math.max(...loops)).toBeLessThanOrEqual(48);
    expect(effectControls(getEffect("volumetric-clouds")!).map((c) => c.name)).toEqual(expect.arrayContaining(["uSunAzimuth", "uSunHeight"]));
    expect(getEffect("volumetric-clouds")!.presets!.map((p) => p.name)).toEqual(["Midday", "Sunset", "Storm"]);
    expect(getEffect("rising-steam")!.presets!.map((p) => p.name)).toEqual(["Coffee cup", "Vent", "Kettle burst"]);
  });

  it("lets steam and smoke rise from a source anywhere", () => {
    for (const id of ["rising-steam", "smoke-curl"]) {
      const src = effectControls(getEffect(id)!).find((c) => c.name === "uSource")!;
      expect(src.type, id).toBe("vec2");
    }
  });
});

describe("distortion effects", () => {
  const distortion = findEffects({ category: "distortion" });
  const ids = [
    "twirl",
    "pinch-bulge",
    "fisheye",
    "mirror-tiles",
    "wave-warp",
    "ribbed-glass",
    "shower-glass",
    "datamosh",
    "polar-warp",
    "texture-displace",
  ];
  const source = (id: string) => {
    const effect = getEffect(id)!;
    return effect.kind === "shader" ? effect.source : "";
  };

  it("has swirls, bulges, lenses, mirrors, waves, glass, moshing, polar and displacement", () => {
    const found = distortion.map((e) => e.id);
    for (const id of ids) expect(found).toContain(id);
    for (const effect of distortion) expect(effect.tags).toContain("distortion");
  });

  it("distorts a picture, and says how it takes video", () => {
    for (const id of ids) {
      expect(effectControls(getEffect(id)!).find((c) => c.name === "uImage")?.type, id).toBe("sampler2D");
      expect(getEffect(id), id).toHaveProperty("video");
    }
    for (const id of ["twirl", "pinch-bulge"]) expect(getEffect(id), id).toMatchObject({ video: "interactive" });
  });

  it("centres twirl and pinch on the pointer while hovered, reading the built-in without declaring it", () => {
    for (const id of ["twirl", "pinch-bulge"]) {
      expect(source(id), id).toMatch(/\biPointer\.z\b/);
      expect(source(id), id).not.toMatch(/uniform\s+vec4\s+iPointer/);
      expect(effectControls(getEffect(id)!).map((c) => c.name), id).toEqual(expect.arrayContaining(["uCentre", "uFollow"]));
    }
  });

  it("folds mirror tiles 2 to 8 ways, square or hex", () => {
    const fold = effectControls(getEffect("mirror-tiles")!).find((c) => c.name === "uFold")!;
    expect(fold).toMatchObject({ type: "int", min: 2, max: 8 });
    expect(effectControls(getEffect("mirror-tiles")!).map((c) => c.name)).toContain("uHex");
  });

  it("wraps or unwraps polar coordinates, and displaces by a second texture", () => {
    expect(getEffect("polar-warp")!.presets!.map((p) => p.name)).toContain("Tiny planet");
    expect(effectControls(getEffect("polar-warp")!).find((c) => c.name === "uUnwrap")?.type).toBe("bool");
    expect(effectControls(getEffect("texture-displace")!).find((c) => c.name === "uMap")?.type).toBe("sampler2D");
  });
});

describe("glow effects", () => {
  const glows = findEffects({ category: "glow" });
  const ids = ["aura", "bloom", "pulsing-halo", "neon-outline", "backlight-glow", "rim-light", "glow-ring-pulse", "glow-button"];
  const render = (id: string, values: Record<string, unknown> = {}) => {
    const effect = getEffect(id)!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    return renderVectorEffect(effect, values as never);
  };
  const frameAt = (motion: ReturnType<typeof render>, ms: number) => JSON.stringify([...svgFrame(motion.animate!, [], ms)].sort());

  it("has the auras, halos, outlines and glowing UI, all tagged", () => {
    expect(glows.map((e) => e.id)).toEqual(expect.arrayContaining(ids));
    for (const effect of glows) expect(effect.tags, effect.id).toContain("glow");
    for (const effect of glows) expect(effect.presets?.length ?? 0, effect.id).toBeGreaterThan(0);
  });

  it("says how pictures take video, and the overlays draw on a transparent canvas", () => {
    expect(getEffect("aura")).toMatchObject({ video: "stills" });
    for (const id of ["bloom", "rim-light"]) expect(getEffect(id), id).toMatchObject({ video: "filter" });
    for (const id of ["neon-outline", "backlight-glow"]) expect(getEffect(id), id).toMatchObject({ video: "none" });
    for (const id of ["pulsing-halo", "neon-outline"]) expect(getEffect(id), id).toMatchObject({ transparent: true });
    expect(getEffect("pulsing-halo")).not.toHaveProperty("video");
    expect(effectDefaults(getEffect("neon-outline")!).uMask).toBe(textImage("GLOW"));
    expect(effectDefaults(getEffect("aura")!).uMask).toBe(SAMPLE_IMAGES.portrait);
  });

  it("ring pulse loops seamlessly at any speed: the last ring has faded out as the first is born under the core", () => {
    for (const period of [0.8, 2.4, 6]) {
      const motion = render("glow-ring-pulse", { period });
      const ms = Math.round(period * 1000);
      expect(svgDuration(motion)).toBe(ms);
      const start = new Map(svgFrame(motion.animate!, [], 0));
      const end = new Map(svgFrame(motion.animate!, [], ms));
      for (const id of ["glowRingPulseCore", "glowRingPulseRing1", "glowRingPulseRing2"]) expect(end.get(id), id).toEqual(start.get(id));
      expect(end.get("glowRingPulseRing0")).toMatchObject({ attrs: { opacity: "0" } });
      expect(frameAt(motion, Math.round(period * 500))).not.toBe(frameAt(motion, 0));
    }
  });

  it("glow button plays on hover to a lifted, brighter end and fits any label", () => {
    expect(getEffect("glow-button")).toMatchObject({ trigger: "hover" });
    const motion = render("glow-button");
    expect(frameAt(motion, svgDuration(motion))).not.toBe(frameAt(motion, 0));
    for (const label of ["A", "Supercalifragilistic & <co>", "Café 日本 🎉", ""]) {
      const m = render("glow-button", { label });
      expect(svgMotionIssues(m)).toEqual([]);
      expect(JSON.stringify(m)).not.toMatch(/\{\{|NaN|undefined/);
    }
  });

  it("prefixes every vector id with the effect's name", () => {
    for (const [id, prefix] of [["glow-ring-pulse", "glowRingPulse"], ["glow-button", "glowButton"]] as const)
      for (const [, name] of render(id).svg.matchAll(/\sid="([^"]+)"/g)) expect(name, id).toMatch(new RegExp(`^${prefix}`));
  });
});

describe("shadow effects", () => {
  const shadows = findEffects({ category: "shadow" });
  const shaders = ["long-shadow", "drop-shadow-lift", "light-sweep-shadows", "contact-shadow", "window-shadows", "shadow-puppets"];

  it("has the long, lifting, swept, contact, window and puppet shadows and the lift card, all tagged", () => {
    const ids = shadows.map((e) => e.id);
    for (const id of [...shaders, "lift-card"]) expect(ids).toContain(id);
    for (const effect of shadows) expect(effect.tags).toContain("shadow");
  });

  it("say how their pictures suit video, draw opaque and read the pointer from the built-in", () => {
    const video: Record<string, string | undefined> = { "long-shadow": "none", "drop-shadow-lift": "none", "window-shadows": "filter" };
    for (const id of shaders) {
      const effect = getEffect(id)!;
      if (effect.kind !== "shader") throw new Error("shader expected");
      expect(effect.video, id).toBe(video[id]);
      expect(effect.transparent ?? false, id).toBe(false);
      expect(effect.source, id).not.toMatch(/uniform\s+vec4\s+(iPointer|iClicks|iTrail)/);
    }
    for (const id of ["drop-shadow-lift", "light-sweep-shadows"]) {
      const effect = getEffect(id)!;
      expect(effect.kind === "shader" && effect.source, id).toMatch(/\biPointer\b/);
    }
    expect(effectControls(getEffect("drop-shadow-lift")!).map((c) => c.name)).toContain("uDemo");
  });

  it("switch between their shapes and patterns", () => {
    expect(effectControls(getEffect("shadow-puppets")!).find((c) => c.name === "uPuppet")).toMatchObject({ type: "int", min: 0, max: 2 });
    expect(effectControls(getEffect("window-shadows")!).find((c) => c.name === "uPattern")).toMatchObject({ type: "int", min: 0, max: 1 });
    expect(effectControls(getEffect("contact-shadow")!).find((c) => c.name === "uShape")).toMatchObject({ type: "int", min: 0, max: 2 });
  });

  it("lift card rises on hover with any title", () => {
    const effect = getEffect("lift-card")!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    expect(effect.trigger).toBe("hover");
    for (const title of ["", "A", "A much longer card title that goes on & on <with> markup", "Café 日本 🎉"]) {
      const motion = renderVectorEffect(effect, { title });
      expect(svgMotionIssues(motion), title).toEqual([]);
      expect(JSON.stringify(motion), title).not.toMatch(/\{\{|NaN|undefined/);
      for (const [, id] of motion.svg.matchAll(/\sid="([^"]+)"/g)) expect(id).toMatch(/^liftCard/);
    }
    const motion = renderVectorEffect(effect, {});
    const frame = (ms: number) => JSON.stringify([...svgFrame(motion.animate!, [], ms)].sort());
    expect(frame(svgDuration(motion))).not.toBe(frame(0));
    expect(frame(svgDuration(motion))).toContain("scale(1.02)");
  });
});

describe("lighting effects", () => {
  const lighting = findEffects({ category: "lighting" });
  const shaders = ["relight", "point-light", "studio-lighting", "time-of-day", "gobo-projection", "neon-spill", "candlelight", "pool-caustics", "party-lights"];

  it("has the relights, lamps, gobos, neon, candles, caustics, party lights and the lamp switch, all tagged", () => {
    expect(lighting.map((e) => e.id)).toEqual(expect.arrayContaining([...shaders, "lamp-switch"]));
    for (const effect of lighting) expect(effect.tags, effect.id).toContain("lighting");
    for (const effect of lighting) expect(effect.presets?.length ?? 0, effect.id).toBeGreaterThan(0);
    expect(EFFECT_CATEGORIES.indexOf("lighting")).toBe(EFFECT_CATEGORIES.indexOf("light") + 1);
  });

  it("relight pictures opaque, say how they suit video, and follow the pointer from the built-in", () => {
    for (const id of shaders) {
      const effect = getEffect(id)!;
      if (effect.kind !== "shader") throw new Error("shader expected");
      expect(effect.video, id).toBe(id === "point-light" ? "interactive" : "filter");
      expect(effect.transparent ?? false, id).toBe(false);
      expect(effectControls(effect).find((c) => c.name === "uImage"), id).toMatchObject({ type: "sampler2D" });
      expect(effect.source, id).not.toMatch(/uniform\s+vec4\s+(iPointer|iClicks|iTrail)/);
    }
    const point = getEffect("point-light")!;
    expect(point.kind === "shader" && point.source).toMatch(/\biPointer\b/);
  });

  it("gobo projection picks a pattern or the gobo image, text by default", () => {
    const gobo = getEffect("gobo-projection")!;
    expect(effectControls(gobo).find((c) => c.name === "uPattern")).toMatchObject({ type: "int", min: 0, max: 4 });
    expect(effectDefaults(gobo).uGobo).toBe(textImage("LIGHTS"));
  });

  it("lamp switch turns on with its first click and back off with its second, its ids prefixed", () => {
    const effect = getEffect("lamp-switch")!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    expect(effect.trigger).toBe("click");
    const motion = renderVectorEffect(effect, effectDefaults(effect));
    expect(motion.animate!.every((a) => a.step === 1 || a.step === 2)).toBe(true);
    for (const [, id] of motion.svg.matchAll(/\sid="([^"]+)"/g)) expect(id).toMatch(/^lampSwitch/);
    const at = (clicks: number[], ms: number) => JSON.stringify([...svgFrame(motion.animate!, clicks, ms)].sort());
    const start = at([], 0);
    expect(at([0], 5000)).not.toBe(start);
    expect(at([0, 5000], 10000)).toBe(start);
  });
});

describe("duotone", () => {
  it("only maps colours: no glare and no motion of its own (glare-sweep adds it back)", () => {
    const duotone = getEffect("image-duotone")!;
    if (duotone.kind !== "shader") throw new Error("shader expected");
    expect(duotone.source).not.toMatch(/\biTime\b|uSweep/);
    expect(effectControls(duotone).map((c) => c.name)).not.toContain("uSweep");
    expect(getEffect("glare-sweep")).toMatchObject({ category: "overlay", transparent: true });
  });
});

describe("glare sweep", () => {
  it("is duotone's old light sweep on its own: the same band, the same speed and strength by default", () => {
    const glare = getEffect("glare-sweep")!;
    if (glare.kind !== "shader") throw new Error("shader expected");
    expect(glare.source).toContain("exp(-pow((uv.x + uv.y * uTilt - fract(iTime * uSpeed) * 2.0 + 0.4) * uSharpness, 2.0))");
    expect(effectDefaults(glare)).toMatchObject({ uStrength: 0.3, uSpeed: 0.15, uTilt: 0.4, uSharpness: 6, uColor: [1, 1, 1] });
    expect(glare.loop).toBeCloseTo(1 / 0.15);
    expect(effectInputs(glare)).toMatchObject({ accepts: [], transparent: true, interactions: [] });
  });
});

describe("audio effects", () => {
  const audio = findEffects({ category: "audio" });

  it("has the bars, ring, waveform, pulse, particles, plasma and vinyl", () => {
    expect(audio.map((e) => e.id)).toEqual(["spectrum-bars", "circular-spectrum", "waveform-line", "bass-pulse", "audio-particles", "audio-plasma", "vinyl"]);
  });

  it.each(audio.map((e) => [e.id, e] as const))("%s hears sound, plays a demo when silent, and is not tagged interactive", (_, effect) => {
    if (effect.kind !== "shader") throw new Error("shader expected");
    expect(effectInputs(effect).accepts).toContain("audio");
    expect(effect.tags).toContain("audio");
    expect(effect.tags).not.toContain("interactive");
    expect(effect.source).not.toMatch(/uniform\s+\w+\s+(iAudio|iSpectrum|iBeat)\b/);
    // The demo plays only with no audio at all: iBeat and iAudio both 0.
    expect(effect.source).toContain("iBeat == 0.0 && dot(iAudio, iAudio) == 0.0");
    expect(effectControls(effect).find((c) => c.name === "uDemo")).toMatchObject({ type: "bool", default: true });
  });

  it("finds them by what they take", () => {
    expect(findEffects({ accepts: ["audio"] }).map((e) => e.id).sort()).toEqual(audio.map((e) => e.id).sort());
    expect(findEffects({ accepts: ["audio", "image"] }).map((e) => e.id)).toEqual(["circular-spectrum", "bass-pulse", "vinyl"]);
  });
});

describe("scroll effects", () => {
  const scroll = findEffects({ category: "scroll" });

  it("has the shaders and the vector effects", () => {
    expect(scroll.map((e) => e.id)).toEqual(["scroll-reveal", "parallax-layers", "scroll-progress-glow", "scroll-velocity-blur", "scroll-zoom", "scroll-draw", "scroll-counter", "scroll-steps"]);
  });

  it.each(scroll.map((e) => [e.id, e] as const))("%s follows the scroll and is tagged for it", (_, effect) => {
    expect(effectInputs(effect).interactions).toEqual(["scroll"]);
    expect(effect.tags).toEqual(expect.arrayContaining(["interactive", "scroll"]));
    if (effect.kind === "vector") expect(effect.trigger).toBe("scroll");
    else {
      expect(effect.source).toContain("dot(iScroll, iScroll) == 0.0");
      expect(effectControls(effect).find((c) => c.name === "uDemo")).toMatchObject({ type: "bool", default: true });
    }
  });

  it("prefixes every vector id with the effect's name, and scrubs from start to end", () => {
    for (const [id, prefix] of [["scroll-draw", "scrollDraw"], ["scroll-counter", "scrollCounter"], ["scroll-steps", "scrollSteps"]] as const) {
      const effect = getEffect(id) as VectorEffect;
      const motion = renderVectorEffect(effect, effectDefaults(effect));
      for (const [, name] of motion.svg.matchAll(/\sid="([^"]+)"/g)) expect(name, id).toMatch(new RegExp(`^${prefix}`));
      expect(motion.svg).not.toMatch(/<animate|<set\b/);
      const end = JSON.stringify([...svgFrame(motion.animate!, [], svgDuration(motion))]);
      expect(end).not.toBe(JSON.stringify([...svgFrame(motion.animate!, [], 0)]));
    }
    const counter = renderVectorEffect(getEffect("scroll-counter") as VectorEffect, { value: 12.5, decimals: 1, prefix: "$", suffix: "M" });
    expect(counter.animate![0]).toMatchObject({ count: [0, 12.5], decimals: 1, format: "$" + "{n}M" });
    expect(effectInputs(getEffect("scroll-draw")!).accepts).toEqual(["path"]);
  });

  it("marks the overlays transparent", () => {
    for (const id of ["scroll-reveal", "scroll-progress-glow"]) expect(getEffect(id)).toMatchObject({ transparent: true });
  });
});

describe("ui effects", () => {
  const ui = findEffects({ category: "ui" });
  const shaders = ["border-beam", "gradient-border", "meteors", "background-beams", "grid-spotlight", "dot-grid", "glass-card", "liquid-glass", "noise-grain-bg", "dichroic-glass"];
  const vectors = ["marquee", "number-ticker", "animated-badge", "app-window", "swipe-stack", "pack-opening"];
  const render = (id: string, values: Record<string, unknown> = {}) => {
    const effect = getEffect(id)!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    return renderVectorEffect(effect, values as never);
  };

  it("has the frames, backgrounds, glass and the marquee, ticker and badge, all tagged and with presets", () => {
    expect(ui.map((e) => e.id).sort()).toEqual([...shaders, ...vectors].sort());
    for (const effect of ui) {
      expect(effect.tags, effect.id).toContain("ui");
      expect(effect.presets?.length ?? 0, effect.id).toBeGreaterThan(1);
    }
  });

  it("draws the frames and meteors over the page, says how the glass takes video, and follows the pointer with an idle demo", () => {
    for (const id of ["border-beam", "gradient-border", "meteors"]) expect(getEffect(id), id).toMatchObject({ transparent: true });
    for (const id of ["background-beams", "grid-spotlight", "dot-grid", "noise-grain-bg", "glass-card", "liquid-glass"]) expect(getEffect(id), id).not.toHaveProperty("transparent");
    expect(getEffect("glass-card")).toMatchObject({ video: "filter" });
    expect(getEffect("liquid-glass")).toMatchObject({ video: "interactive" });
    for (const id of ["grid-spotlight", "dot-grid", "liquid-glass"]) {
      expect(effectInputs(getEffect(id)!).interactions, id).toEqual(["hover", "pointer"]);
      expect(effectDefaults(getEffect(id)!).uDemo, id).toBe(true);
    }
  });

  it("prefixes every vector id with the effect's name", () => {
    for (const [id, prefix] of [["marquee", "marquee"], ["number-ticker", "numberTicker"], ["animated-badge", "animatedBadge"], ["swipe-stack", "swipeStack"], ["pack-opening", "packOpening"]] as const)
      for (const [, name] of render(id).svg.matchAll(/\sid="([^"]+)"/g)) expect(name, id).toMatch(new RegExp(`^${prefix}`));
  });

  it("marquee scrolls exactly one copy per loop, either way, for any words", () => {
    for (const values of [{}, { words: "A" }, { words: "One · Two · Three · Four · Five · Six · Seven · Eight", reverse: true, size: 30 }]) {
      const motion = render("marquee", values);
      const xs = [...motion.svg.matchAll(/<text x="([-\d.]+)"/g)].map((m) => Number(m[1]));
      const period = xs[1]! - xs[0]!;
      expect(xs.length).toBe(6);
      // The five copies after the first always reach past the right edge.
      expect(period * 5).toBeGreaterThanOrEqual(399);
      const [from, to] = motion.animate![0]!.attrs!.transform!;
      const shift = (s: string | number) => Number(/translate\(([-\d.]+)/.exec(String(s))![1]);
      expect(Math.abs(shift(to) - shift(from))).toBeCloseTo(period, 1);
      expect(svgMotionIssues(motion)).toEqual([]);
    }
  });

  it("number ticker rolls each digit to its value and keeps the rest of the format", () => {
    const motion = render("number-ticker", { value: "$12,480" });
    const end = svgFrame(motion.animate!, [], svgDuration(motion));
    const rolls = [0, 1, 2, 3, 4, 5, 6].map((i) => end.get(`numberTickerDigit${i}`)!.attrs.transform);
    expect(rolls).toEqual(["translate(0 0)", "translate(0 -704)", "translate(0 -768)", "translate(0 0)", "translate(0 -896)", "translate(0 -1152)", "translate(0 -640)"]);
    expect(motion.svg).toContain(">$</text>");
    expect(motion.svg).toContain(">,</text>");
    for (const value of ["", "98.6%", "1,234,567,890,123", "<b>&"]) {
      const m = render("number-ticker", { value });
      expect(svgMotionIssues(m)).toEqual([]);
      expect(JSON.stringify(m)).not.toMatch(/\{\{|NaN|undefined/);
    }
  });

  it("badge fits any label", () => {
    for (const label of ["A", "Early access & more", "Café 日本 🎉", ""]) {
      const m = render("animated-badge", { label });
      expect(svgMotionIssues(m)).toEqual([]);
      expect(JSON.stringify(m)).not.toMatch(/\{\{|NaN|undefined/);
    }
  });
});

describe("more loaders", () => {
  const ids = ["skeleton-shimmer", "progress-bar", "indeterminate-bar", "step-progress", "circle-dots-loader", "wave-bars", "hourglass", "infinity-loader", "orbit-loader", "shape-morph-loader"];
  const render = (id: string, values: Record<string, unknown> = {}) => {
    const effect = getEffect(id)!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    return renderVectorEffect(effect, values as never);
  };
  const frameAt = (motion: ReturnType<typeof render>, ms: number) => JSON.stringify([...svgFrame(motion.animate!, [], ms)].sort()).replace(/rotate\(360 /g, "rotate(0 "); // A whole turn ends where it starts.

  it("are vector loaders, tagged and prefixed with their names", () => {
    for (const id of ids) {
      const effect = getEffect(id)!;
      expect(effect, id).toMatchObject({ kind: "vector", category: "loader" });
      expect(effect.tags, id).toContain("loader");
      const prefix = id.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
      for (const [, name] of render(id).svg.matchAll(/\sid="([^"]+)"/g)) expect(name, id).toMatch(new RegExp(`^${prefix}`));
    }
  });

  it("loop seamlessly: each ends as it starts (the shimmer and racing bars end off the track, the progress bar fades its fill out first)", () => {
    for (const id of ids.filter((i) => !["progress-bar", "skeleton-shimmer", "indeterminate-bar"].includes(i))) {
      const motion = render(id);
      expect(frameAt(motion, svgDuration(motion)), id).toBe(frameAt(motion, 0));
      expect(frameAt(motion, svgDuration(motion) / 2), id).not.toBe(frameAt(motion, 0));
    }
    // The racing segments start and end off the track.
    const race = render("indeterminate-bar");
    for (const ms of [0, svgDuration(race)])
      for (const [, f] of svgFrame(race.animate!, [], ms)) expect(Number(f.attrs.x) + Number(f.attrs.width) <= 0 || Number(f.attrs.x) >= 240).toBe(true);
    const bar = render("progress-bar", { value: 50 });
    expect(svgFrame(bar.animate!, [], svgDuration(bar)).get("progressBarBar")!.attrs.opacity).toBe("0");
    expect(svgFrame(bar.animate!, [], 2000).get("progressBarFill")!.attrs.width).toBe("110");
  });

  it("step progress labels its steps from one text", () => {
    const motion = render("step-progress", { labels: "One · Two" });
    expect(motion.svg).toContain(">One</text>");
    expect(motion.svg).toContain(">Two</text>");
    expect(JSON.stringify(motion)).not.toMatch(/\{\{|NaN|undefined/);
  });
});

describe("more gradients", () => {
  it("are opaque full-frame shaders with presets, taking no pictures or pointer", () => {
    for (const id of ["grainy-gradient", "stripe-gradient", "holographic-gradient", "radial-glow"]) {
      const effect = getEffect(id)!;
      expect(effect, id).toMatchObject({ kind: "shader", category: "gradient" });
      expect(effectInputs(effect), id).toMatchObject({ accepts: [], interactions: [], transparent: false });
      expect(effect.presets?.length ?? 0, id).toBeGreaterThan(1);
    }
    expect(getEffect("grainy-gradient")!.presets!.map((p) => p.name)).toContain("Stripe-like");
  });
});

describe("3d, space, weather and water effects", () => {
  const ids = (category: EffectCategory) => findEffects({ category }).map((e) => e.id);

  it("fill the new categories and add to space", () => {
    expect(ids("3d")).toEqual(["globe", "rotating-shapes", "isometric-city", "wireframe-terrain", "metaballs-3d", "torus-knot", "gemstone"]);
    expect(ids("weather")).toEqual(["rain-streaks", "thunderstorm", "rainbow", "wind-gust", "hail"]);
    expect(ids("water")).toEqual(["ocean-waves", "underwater-scene", "pond-ripples", "waterfall", "water-reflection"]);
    for (const id of ["planet", "spiral-galaxy", "solar-system"]) expect(ids("space")).toContain(id);
  });

  it("lay the weather overlays over other content and filter pictures", () => {
    for (const id of ["rain-streaks", "wind-gust", "hail"]) expect(getEffect(id), id).toMatchObject({ transparent: true });
    for (const id of ["rainbow", "pond-ripples"]) {
      expect(getEffect(id), id).toMatchObject({ video: "filter" });
      expect(effectInputs(getEffect(id)!).accepts).toContain("video");
    }
  });

  it("streak shooting stars, a meteor shower and a comet across the sky", () => {
    for (const id of ["shooting-star", "meteor-shower", "comet"]) expect(ids("space")).toContain(id);
    // The shooting star lays over a page by default and keeps a preset for the old opaque sky.
    expect(getEffect("shooting-star")).toMatchObject({ transparent: true });
    expect(effectControls(getEffect("shooting-star")!).find((c) => c.name === "uBackgroundAlpha")).toMatchObject({ default: 0 });
    expect(getEffect("shooting-star")!.presets!.map((p) => p.name)).toContain("Night sky");
    // Clicking launches one from the pointer.
    expect(effectInputs(getEffect("shooting-star")!).interactions).toContain("click");
    for (const id of ["meteor-shower", "comet"]) expect(getEffect(id), id).not.toMatchObject({ transparent: true });
  });

  it("show the northern lights, satellites and star trails over a skyline, and a wish star icon", () => {
    for (const id of ["northern-lights", "satellite-pass", "star-trails"]) {
      expect(ids("space")).toContain(id);
      expect(effectControls(getEffect(id)!).find((c) => c.name === "uHorizon"), id).toBeDefined();
    }
    expect(getEffect("satellite-pass")!.presets!.map((p) => p.name)).toEqual(["Starlink train", "Iridium flare", "Long exposure"]);
    expect(findEffects({ category: "icon" }).map((e) => e.id)).toContain("wish-star");
    const effect = getEffect("wish-star")!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    const wish = renderVectorEffect(effect, {});
    expect(wish.svg).toContain('id="wishStarRoute"');
    expect((wish.animate ?? []).some((a) => a.along === "wishStarRoute")).toBe(true);
  });

  it("let the globe be dragged and the pond take stones, with idle demos", () => {
    expect(effectInputs(getEffect("globe")!).interactions).toEqual(expect.arrayContaining(["press", "pointer"]));
    expect(effectInputs(getEffect("pond-ripples")!).interactions).toContain("click");
    for (const id of ["globe", "pond-ripples"]) {
      expect(effectControls(getEffect(id)!).find((c) => c.name === "uDemo"), id).toMatchObject({ type: "bool", default: true });
    }
  });
});

describe("fire effects", () => {
  const ids = findEffects({ category: "fire" }).map((e) => e.id);
  const skeleton = (d: unknown) => String(d).replace(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi, "#");

  it("fill the fire category, browsed under Light", () => {
    expect(ids).toEqual(["fire-border", "flaming-text", "burn-away", "fire-ring", "fireball", "campfire", "flame-icon", "match-strike"]);
    expect(categoryGroup("fire").name).toBe("Light");
  });

  it("draw the burning overlays on clear, with their background a preset away", () => {
    for (const id of ["fire-border", "flaming-text", "fire-ring", "fireball"]) {
      const effect = getEffect(id)!;
      expect(effect, id).toMatchObject({ transparent: true });
      expect(effect.tags, id).toContain("overlay");
      expect(effectDefaults(effect).uBackgroundAlpha, id).toBe(0);
      expect(effect.presets?.some((p) => p.values.uBackgroundAlpha === 1), id).toBe(true);
    }
    expect(getEffect("campfire")).not.toMatchObject({ transparent: true });
  });

  it("set words and pictures alight, burning pictures away on a loop with a still progress control", () => {
    expect(effectInputs(getEffect("flaming-text")!).accepts).toContain("text");
    expect(effectDefaults(getEffect("flaming-text")!).uText).toBe(textImage("FIRE"));
    const burn = getEffect("burn-away")!;
    expect(burn).toMatchObject({ video: "filter", loop: 8 });
    expect(effectInputs(burn).accepts).toEqual(expect.arrayContaining(["image", "video"]));
    expect(effectControls(burn).map((c) => c.name)).toEqual(expect.arrayContaining(["uAnimate", "uProgress"]));
  });

  it("flare the ring on hover and send the fireball after the pointer", () => {
    expect(effectInputs(getEffect("fire-ring")!).interactions).toContain("hover");
    const fireball = getEffect("fireball")!;
    expect(fireball.kind === "shader" && fireball.source).toMatch(/\biTrail\b/);
    expect(effectInputs(fireball).interactions).toEqual(expect.arrayContaining(["pointer"]));
  });

  it.each([["flame-icon"], ["match-strike"]])("%s tweens like with like and ends where it starts", (id) => {
    const effect = getEffect(id)!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    const motion = renderVectorEffect(effect, effectDefaults(effect));
    for (const a of motion.animate ?? []) for (const [name, [from, to]] of Object.entries(a.attrs ?? {}))
        if (!String(from).startsWith("#")) expect(skeleton(from), `${id} ${a.id} ${name}`).toBe(skeleton(to));
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

describe("hologram effects", () => {
  const ids = findEffects({ category: "hologram" }).map((e) => e.id);

  it("fill the hologram category, browsed under Light", () => {
    expect(ids).toEqual(["hologram", "hologram-text", "hologram-projector", "holo-hud", "holo-panel"]);
    expect(categoryGroup("hologram").name).toBe("Light");
  });

  it("draw the shader holograms as overlays, with their background a preset away", () => {
    for (const id of ["hologram", "hologram-text", "hologram-projector"]) {
      const effect = getEffect(id)!;
      expect(effect, id).toMatchObject({ transparent: true });
      expect(effectDefaults(effect).uBackgroundAlpha, id).toBe(0);
      expect(effect.presets?.some((p) => p.values.uBackgroundAlpha === 1), id).toBe(true);
    }
  });

  it("project pictures and video, keying out a plain background, and words", () => {
    expect(getEffect("hologram")).toMatchObject({ video: "filter" });
    expect(effectInputs(getEffect("hologram")!).accepts).toEqual(expect.arrayContaining(["image", "video"]));
    expect(effectControls(getEffect("hologram")!).find((c) => c.name === "uKey")).toMatchObject({ default: 0.6 });
    expect(effectInputs(getEffect("hologram-text")!).accepts).toContain("text");
  });

  it("loop the HUD and panel, with their words as text controls", () => {
    for (const id of ["holo-hud", "holo-panel"]) {
      const effect = getEffect(id)!;
      if (effect.kind !== "vector") throw new Error("vector expected");
      const motion = renderVectorEffect(effect, {});
      expect(motion.svg, id).toContain("feGaussianBlur");
    }
    const panel = getEffect("holo-panel")!;
    if (panel.kind !== "vector") throw new Error("vector expected");
    const motion = renderVectorEffect(panel, { title: "HELLO" });
    expect((motion.animate ?? []).find((a) => a.id === "holoPanelTitle" && a.write)).toMatchObject({ write: "HELLO" });
  });
});

describe("loaders", () => {
  const SHADERS = ["liquid-loader", "glow-ring-spinner", "metaball-loader", "flame-loader"];

  it("include shader loaders drawn on clear, with their background a preset away", () => {
    for (const id of SHADERS) {
      const effect = getEffect(id)!;
      expect(effect, id).toMatchObject({ kind: "shader", category: "loader", transparent: true });
      expect(effect.tags, id).toEqual(expect.arrayContaining(["loader", "overlay"]));
      expect(effectDefaults(effect).uBackgroundAlpha, id).toBe(0);
      expect(effect.presets?.some((p) => p.values.uBackgroundAlpha === 1), id).toBe(true);
      expect(effectInputs(effect), id).toMatchObject({ accepts: [], interactions: [] });
    }
  });

  it("loop the filling loaders, with a still progress control", () => {
    for (const id of ["liquid-loader", "flame-loader"]) {
      const effect = getEffect(id)!;
      expect(effect.kind === "shader" && effect.loop, id).toBe(6);
      expect(effectControls(effect).map((c) => c.name), id).toEqual(expect.arrayContaining(["uAnimate", "uProgress"]));
    }
  });

  it("morph the shape through square, circle and triangle and back, turning a whole turn", () => {
    const effect = getEffect("shape-morph-loader")!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    const motion = renderVectorEffect(effect, effectDefaults(effect));
    const shapes = (motion.animate ?? []).filter((a) => a.id === "shapeMorphLoaderShape").map((a) => a.attrs!.d!);
    expect(shapes).toHaveLength(3);
    expect(shapes[2]![1]).toBe(shapes[0]![0]);
    expect(svgFrame(motion.animate!, [], svgDuration(motion)).get("shapeMorphLoaderTurn")!.attrs.transform).toBe("rotate(360 60 60)");
  });

  it("are browsed in their own group, gathered from the themed effects too", () => {
    expect(categoryGroup("loader").name).toBe("Loaders");
    const ids = findEffects({ group: "loaders" }).map((e) => e.id);
    for (const id of ["spinner", "progress-bar", "chomp-loader", "bubble-pop-loader", "progress-ring", "battery-charge", ...SHADERS, "hourglass", "infinity-loader", "orbit-loader", "shape-morph-loader"]) expect(ids, id).toContain(id);
    for (const id of ids) expect(getEffect(id)!.category, id).toBe("loader");
  });
});

describe("category groups", () => {
  it("hold every category exactly once", () => {
    const grouped = EFFECT_CATEGORY_GROUPS.flatMap((g) => g.categories);
    expect([...grouped].sort()).toEqual([...EFFECT_CATEGORIES].sort());
    expect(new Set(EFFECT_CATEGORY_GROUPS.map((g) => g.name)).size).toBe(EFFECT_CATEGORY_GROUPS.length);
  });

  it("find a category's group and filter by it", () => {
    expect(categoryGroup("melt").name).toBe("Pictures");
    const lights = findEffects({ group: "light" });
    expect(lights.length).toBeGreaterThan(0);
    expect(lights.every((e) => categoryGroup(e.category).name === "Light")).toBe(true);
    expect(findEffects({ group: "nope" })).toEqual([]);
  });
});

describe("single picture effects", () => {
  it("recognises effects tailored to a single picture input", () => {
    expect(isSinglePictureEffect(getEffect("image-duotone")!)).toBe(true);
    expect(isSinglePictureEffect(getEffect("image-glitch")!)).toBe(true);
    expect(isSinglePictureEffect(getEffect("crt")!)).toBe(true);
    expect(isSinglePictureEffect(getEffect("image-pixelate")!)).toBe(true);

    // Procedural/gradient background effects take no image
    expect(isSinglePictureEffect(getEffect("holographic-gradient")!)).toBe(false);
    expect(isSinglePictureEffect(getEffect("aurora")!)).toBe(false);

    // Multi-image transitions take more than 1 image
    const transition = findEffects({ category: "transition" })[0];
    if (transition) {
      expect(isSinglePictureEffect(transition)).toBe(false);
    }
  });

  it("filters the catalog by singlePicture", () => {
    const single = findEffects({ singlePicture: true });
    expect(single.length).toBeGreaterThan(10);
    expect(single.every(isSinglePictureEffect)).toBe(true);

    const nonSingle = findEffects({ singlePicture: false });
    expect(nonSingle.length).toBeGreaterThan(10);
    expect(nonSingle.some(isSinglePictureEffect)).toBe(false);
    expect(single.length + nonSingle.length).toBe(EFFECTS.length);
  });
});

describe("capabilities and prompt helpers", () => {
  it("determines output capability for animated SVG vs video", () => {
    const vectorEffect = EFFECTS.find((e) => e.kind === "vector")!;
    const shaderEffect = EFFECTS.find((e) => e.kind === "shader" && e.video !== "none")!;

    expect(canOutputAnimatedSvg(vectorEffect)).toBe(true);
    expect(canOutputAnimatedSvg(shaderEffect)).toBe(false);

    expect(canOutputVideo(vectorEffect)).toBe(false);
    expect(canOutputVideo(shaderEffect)).toBe(true);
  });

  it("filters catalog effects by output query", () => {
    const animations = findEffects({ output: "animation" });
    expect(animations.length).toBeGreaterThan(0);
    expect(animations.every((e) => canOutputAnimatedSvg(e))).toBe(true);

    const videos = findEffects({ output: "video" });
    expect(videos.length).toBeGreaterThan(0);
    expect(videos.every((e) => canOutputVideo(e))).toBe(true);
  });

  it("identifies human-readable controls and filters internal engine uniforms", () => {
    expect(isHumanReadableControl({ name: "speed", type: "float", default: 1, min: 0, max: 2, step: 0.1, line: 0 })).toBe(true);
    expect(isHumanReadableControl({ name: "color", type: "vec3", color: true, default: [1, 0, 0], min: 0, max: 1, step: 0.01, line: 0 })).toBe(true);

    // Filtered internal uniforms & samplers
    expect(isHumanReadableControl({ name: "_internal", type: "float", default: 0, min: 0, max: 1, step: 0.1, line: 0 })).toBe(false);
    expect(isHumanReadableControl({ name: "uImage", type: "sampler2D", default: 0, min: 0, max: 1, step: 0.1, line: 0 })).toBe(false);
    expect(isHumanReadableControl({ name: "uResolution", type: "vec2", default: [0, 0], min: 0, max: 1, step: 0.1, line: 0 })).toBe(false);
    expect(isHumanReadableControl({ name: "iTime", type: "float", default: 0, min: 0, max: 1, step: 0.1, line: 0 })).toBe(false);
    expect(isHumanReadableControl({ name: "uAspect", type: "float", default: 1, min: 0, max: 1, step: 0.1, line: 0 })).toBe(false);
    expect(isHumanReadableControl({ name: "x1", type: "float", default: 0, min: 0, max: 1, step: 0.1, line: 0 })).toBe(false);
  });

  it("extracts prompt variables with options or defaults", () => {
    const effect = EFFECTS.find((e) => effectControls(e).some((c: any) => c.options && c.options.length > 0)) || EFFECTS[0];
    const vars = getPromptVariables(effect);
    expect(Array.isArray(vars)).toBe(true);
    for (const v of vars) {
      expect(v.name).toBeDefined();
      expect(v.label).toBeDefined();
      expect(v.type).toBeDefined();
    }
  });

  it("extracts reference SVG from vector effects", () => {
    const vectorEffect = EFFECTS.find((e) => e.kind === "vector")!;
    const svg = getEffectReferenceSvg(vectorEffect.id);
    expect(svg).toBeDefined();
    expect(typeof svg).toBe("string");
    expect(svg!.includes("<svg") || svg!.includes("<path") || svg!.includes("<g")).toBe(true);

    const shaderEffect = EFFECTS.find((e) => e.kind === "shader")!;
    expect(getEffectReferenceSvg(shaderEffect.id)).toBeUndefined();
    expect(getEffectReferenceSvg("non-existent-effect")).toBeUndefined();
  });

  it("identifies motion vs static effects with isMotionEffect", () => {
    expect(isMotionEffect(undefined)).toBe(false);
    const vectorEffect = EFFECTS.find((e) => e.kind === "vector")!;
    expect(isMotionEffect(vectorEffect)).toBe(true);
    expect(isMotionEffect(getEffect("image-ripple"))).toBe(true);
    expect(isMotionEffect(getEffect("image-duotone"))).toBe(false);
  });

  it("filters out image slots and sampler2D controls with nonImageEffectControls", () => {
    expect(nonImageEffectControls(undefined)).toEqual([]);
    const duotone = getEffect("image-duotone")!;
    const controls = nonImageEffectControls(duotone);
    expect(controls.length).toBeGreaterThan(0);
    expect(controls.some((c) => c.name === "uImage" || c.type === "sampler2D")).toBe(false);
    expect(controls.some((c) => c.name === "uContrast")).toBe(true);
  });

  it("strips image inputs, sample SVGs, and unknown controls with sanitizeEffectValues", () => {
    const duotone = getEffect("image-duotone")!;
    const defaults = effectDefaults(duotone);
    const sanitized = sanitizeEffectValues(duotone, {
      ...defaults,
      uContrast: 1.4,
      uImage: "https://example.com/photo.png",
      uImage2: "https://example.com/photo2.png",
      unknownControl: 42,
      nullVal: null,
    });
    expect(sanitized.uContrast).toBe(1.4);
    expect(sanitized.uImage).toBeUndefined();
    expect(sanitized.uImage2).toBeUndefined();
    expect(sanitized.unknownControl).toBeUndefined();
    expect(sanitized.nullVal).toBeUndefined();
  });
});


describe("glass and mirror effects", () => {
  const GLASS = ["glass-text", "glass-orb", "glass-blocks", "cracked-glass", "condensation-wipe", "stained-glass", "image-stained-glass", "gemstone", "prism-light", "dichroic-glass"];
  const MIRROR = ["chrome-text", "floor-reflection", "water-reflection", "infinity-mirror", "funhouse-mirror", "transition-mirror-fold"];

  it("gathers glass under one tag, with the glass looks in other categories, and mirrors under another", () => {
    const glass = findEffects({ tags: ["glass"] }).map((e) => e.id);
    for (const id of [...GLASS, "ribbed-glass", "shower-glass", "glass-card", "liquid-glass", "rain-on-glass", "glass-shatter", "magnifier"]) expect(glass, id).toContain(id);
    const mirrors = findEffects({ tags: ["reflection"] }).map((e) => e.id);
    for (const id of MIRROR) {
      expect(mirrors, id).toContain(id);
      expect(getEffect(id)!.tags, id).toContain("mirror");
    }
  });

  it("glass text takes a word and a picture behind it, and sweeps a beam of light that splits at the bevels", () => {
    const effect = getEffect("glass-text")!;
    expect(effect).toMatchObject({ category: "text", video: "filter", loop: 4 });
    const inputs = effectInputs(effect);
    expect(inputs.images.map((s) => s.wants)).toEqual(["text", "picture"]);
    expect(inputs.accepts).toEqual(expect.arrayContaining(["text", "image", "video"]));
    const defaults = effectDefaults(effect);
    expect(defaults.uText).toBe(textImage("GLASS"));
    expect(defaults).toMatchObject({ uBeam: 1, uPrism: 0.6, uSweepTime: 4 });
    expect(effect.kind === "shader" && effect.source).toContain("vec3 spectrum(float x)");
    expect(effectDefaults(effect, { preset: "Still" }).uBeam).toBe(0);
  });

  it("chrome text is made from a word alone, on a background that can be cleared", () => {
    const effect = getEffect("chrome-text")!;
    expect(effect).toMatchObject({ category: "text", video: "none" });
    expect(effectInputs(effect).images.map((s) => s.wants)).toEqual(["text"]);
    expect(effectDefaults(effect, { preset: "Gold" }).uTint).toEqual([1, 0.78, 0.38]);
    expect(effectControls(effect).find((c) => c.name === "uBackgroundAlpha")).toMatchObject({ default: 0 });
  });

  it("answer the pointer the way their tags say", () => {
    const answers = (id: string) => effectInputs(getEffect(id)!).interactions;
    expect(answers("cracked-glass")).toContain("click");
    expect(answers("condensation-wipe")).toEqual(expect.arrayContaining(["trail", "hover"]));
    expect(answers("glass-orb")).toEqual(expect.arrayContaining(["hover", "pointer"]));
    expect(answers("dichroic-glass")).toEqual(expect.arrayContaining(["hover", "pointer"]));
    for (const id of ["cracked-glass", "condensation-wipe", "glass-orb", "dichroic-glass"]) {
      expect(getEffect(id), id).toMatchObject({ video: "interactive" });
      expect(effectControls(getEffect(id)!).find((c) => c.name === "uDemo"), id).toMatchObject({ type: "bool", default: true });
    }
    for (const id of ["stained-glass", "prism-light", "gemstone", "infinity-mirror", "funhouse-mirror", "water-reflection", "floor-reflection"])
      expect(effectInputs(getEffect(id)!).interactions, id).toEqual([]);
  });

  it("the mirror fold is a transition between two pictures", () => {
    const effect = getEffect("transition-mirror-fold")!;
    expect(effect).toMatchObject({ category: "transition", video: "transition", loop: 4 });
    expect(effectControls(effect).filter((c) => c.type === "sampler2D").map((c) => c.name)).toEqual(["uFrom", "uTo"]);
  });

  it("ribbed and shower glass can split light, off by default so their look is unchanged", () => {
    for (const id of ["ribbed-glass", "shower-glass"]) {
      const effect = getEffect(id)!;
      expect(effectDefaults(effect).uDispersion, id).toBe(0);
      expect(effectDefaults(effect, { preset: "Prismatic" }).uDispersion, id).toBeGreaterThan(0.5);
    }
  });

  it("shares the spectrum helper with consumers", () => {
    expect(SPECTRUM).toMatch(/^vec3 spectrum\(float x\)/);
  });
});

describe("iridescent and neon effects", () => {
  const IDS = ["iridescent-text", "neon-fluid", "neon-worms", "molten-web", "prism-burst", "neon-warp", "iridescent-blobs"];

  it("are found together by their tags", () => {
    const found = new Set([...findEffects({ tags: ["iridescent"] }), ...findEffects({ tags: ["neon"] })].map((e) => e.id));
    for (const id of IDS.filter((id) => id !== "molten-web")) expect(found, id).toContain(id);
    expect(getEffect("molten-web")!.category).toBe("organic");
  });

  it("iridescent text is a transparent title over clear, with a background preset", () => {
    const effect = getEffect("iridescent-text")!;
    expect(effect).toMatchObject({ category: "text", video: "none", transparent: true });
    expect(effect.tags).toContain("overlay");
    expect(effectInputs(effect).images.map((s) => s.wants)).toEqual(["text"]);
    expect(effectDefaults(effect).uBackgroundAlpha).toBe(0);
    expect(effectDefaults(effect, { preset: "With background" }).uBackgroundAlpha).toBe(1);
  });

  it("the backgrounds are opaque and size their lines in pixels where they say so", () => {
    for (const id of IDS.filter((id) => id !== "iridescent-text")) expect(getEffect(id), id).not.toMatchObject({ transparent: true });
    expect(effectControls(getEffect("neon-worms")!).find((c) => c.name === "uWidth")!.label).toMatch(/px/);
    expect(effectControls(getEffect("neon-warp")!).find((c) => c.name === "uWidth")!.label).toMatch(/px/);
  });

  it("the hero backgrounds have a Light preset on a light ground, for light pages", () => {
    for (const [id, ground] of [["neon-fluid", "uBackground"], ["neon-worms", "uBackground"], ["neon-warp", "uBackground"], ["prism-burst", "uBackground"], ["molten-web", "uRock"]] as const) {
      const dark = effectDefaults(getEffect(id)!)[ground] as number[];
      const light = effectDefaults(getEffect(id)!, { preset: "Light" })[ground] as number[];
      expect(Math.min(...light), id).toBeGreaterThan(0.85);
      expect(Math.max(...dark), id).toBeLessThan(0.1);
    }
  });
});

describe("webbing effects", () => {
  const IDS = ["spider-web", "cobweb-corners", "web-shot", "plexus-web", "spider-web-loader"];

  it("are found together by their tag", () => {
    const found = findEffects({ tags: ["web"] }).map((e) => e.id);
    for (const id of IDS) expect(found, id).toContain(id);
  });

  it("draws the cobwebs and web shot as transparent overlays, the backgrounds opaque", () => {
    for (const id of ["cobweb-corners", "web-shot"]) expect(getEffect(id), id).toMatchObject({ transparent: true });
    for (const id of ["spider-web", "plexus-web"]) expect(getEffect(id), id).not.toMatchObject({ transparent: true });
  });

  it("shoots a web at every click, with an idle demo", () => {
    const effect = getEffect("web-shot")!;
    expect(effect.kind === "shader" && effect.source).toMatch(/\biClicks\[/);
    expect(effectDefaults(effect).uDemo).toBe(true);
  });

  it("the backgrounds have a Light preset on a light ground", () => {
    for (const id of ["spider-web", "plexus-web"]) {
      expect(Math.max(...(effectDefaults(getEffect(id)!).uBackground as number[])), id).toBeLessThan(0.1);
      expect(Math.min(...(effectDefaults(getEffect(id)!, { preset: "Light" }).uBackground as number[])), id).toBeGreaterThan(0.85);
    }
  });

  it("the loader weaves, drops its spider and leaves the frame as empty as it found it", () => {
    const effect = getEffect("spider-web-loader")!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    const motion = renderVectorEffect(effect, effectDefaults(effect));
    expect(svgMotionIssues(motion)).toEqual([]);
    expect(JSON.stringify(motion)).not.toMatch(/\{\{|NaN|undefined/);
    const end = svgDuration(motion);
    const frame = (ms: number) => svgFrame(motion.animate!, [], ms);
    expect(frame(0).get("spider")!.attrs.transform).toBe(frame(end).get("spider")!.attrs.transform);
    expect(frame(1800).get("spider")!.attrs.transform).not.toBe(frame(0).get("spider")!.attrs.transform);
    expect(Number(frame(end).get("web")!.attrs.opacity)).toBe(0);
  });
});

describe("promo effects", () => {
  const IDS = ["orbit-swoosh", "tick-ring-burst", "swoosh-underline", "knockout-wipe", "before-after", "slime-drop", "app-window"];
  const OVERLAYS = ["orbit-swoosh", "tick-ring-burst", "swoosh-underline"];

  it("are found together by their tag", () => {
    const found = findEffects({ tags: ["promo"] }).map((e) => e.id);
    for (const id of IDS) expect(found, id).toContain(id);
  });

  it("draws the title accents as clear overlays, with a cream background a preset away", () => {
    for (const id of OVERLAYS) {
      const effect = getEffect(id)!;
      expect(effect, id).toMatchObject({ transparent: true });
      expect(effect.tags, id).toContain("overlay");
      expect(effectDefaults(effect).uBackgroundAlpha, id).toBe(0);
      expect(effectDefaults(effect, { preset: "Cream" }).uBackgroundAlpha, id).toBe(1);
    }
  });

  it("the accents hold still when not animated, for laying under a title", () => {
    for (const id of ["tick-ring-burst", "swoosh-underline"]) expect(effectControls(getEffect(id)!).find((c) => c.name === "uAnimate"), id).toMatchObject({ type: "bool", default: true });
  });

  it("knocks a picture out to its cut-out over a checkerboard, as a transition", () => {
    const effect = getEffect("knockout-wipe")!;
    expect(effect).toMatchObject({ video: "transition", loop: 4 });
    expect(effectDefaults(effect)).toMatchObject({ uFrom: SAMPLE_IMAGES.portrait, uTo: SAMPLE_IMAGES.cutout, uChecker: true });
    expect(effectInputs(effect).images.map((i) => i.name)).toEqual(["uFrom", "uTo"]);
  });

  it("compares two pictures at the pointer while hovered, sweeping while idle", () => {
    const effect = getEffect("before-after")!;
    expect(effect).toMatchObject({ video: "interactive" });
    expect(effectDefaults(effect)).toMatchObject({ uBefore: SAMPLE_IMAGES.portrait, uAfter: SAMPLE_IMAGES.cutout, uDemo: true });
    expect(effectInputs(effect).interactions).toEqual(expect.arrayContaining(["hover", "pointer"]));
  });

  it("samples the portrait cut out of its background, lined up with it", () => {
    const svg = (url: string) => atob(url.split(",")[1]!);
    const portrait = svg(SAMPLE_IMAGES.portrait);
    const cutout = svg(SAMPLE_IMAGES.cutout);
    expect(cutout).not.toContain("<rect");
    expect(portrait.replace(/<rect [^>]*\/>\n/, "")).toBe(cutout);
  });

  it("drops the slime title in from above, squashes and settles, leaving the splash", () => {
    const effect = getEffect("slime-drop")!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    for (const word of ["SLOP", "A", "Supercalifragilistic & <co>"]) {
      const motion = renderVectorEffect(effect, { word });
      expect(svgMotionIssues(motion), word).toEqual([]);
      expect(JSON.stringify(motion), word).not.toMatch(/\{\{|NaN|undefined/);
    }
    const motion = renderVectorEffect(effect, effectDefaults(effect));
    const end = svgDuration(motion);
    const frame = (ms: number) => svgFrame(motion.animate!, [], ms);
    expect(frame(0).get("drop")!.attrs.transform).toBe("translate(0 -240)");
    expect(frame(end).get("drop")!.attrs.transform).toBe("translate(0 0)");
    expect(frame(end).get("squash")!.attrs.transform).toContain("scale(1 1)");
    expect(Number(frame(end).get("d0")!.attrs.opacity)).toBe(1);
    // A bigger splash throws its droplets further.
    const far = renderVectorEffect(effect, { spread: 2 });
    const x = (m: typeof motion) => Math.abs(Number(svgFrame(m.animate!, [], svgDuration(m)).get("d0")!.attrs.cx) - 200);
    expect(x(far)).toBeGreaterThan(x(motion));
  });

  it("app window fills its ring, draws its tick, says it is done and leaves as it came", () => {
    const effect = getEffect("app-window")!;
    if (effect.kind !== "vector") throw new Error("vector expected");
    const motion = renderVectorEffect(effect, effectDefaults(effect));
    expect(svgMotionIssues(motion)).toEqual([]);
    expect(JSON.stringify(motion)).not.toMatch(/\{\{|NaN|undefined/);
    const frame = (ms: number) => svgFrame(motion.animate!, [], ms);
    expect(Number(frame(0).get("card")!.attrs.opacity)).toBe(0);
    expect(Number(frame(2600).get("label")!.attrs.opacity)).toBe(0);
    expect(Number(frame(2600).get("doneLabel")!.attrs.opacity)).toBe(1);
    expect(Number(frame(svgDuration(motion)).get("card")!.attrs.opacity)).toBe(0);
    // Long labels shrink to fit the window.
    const long = renderVectorEffect(effect, { label: "Transcoding every clip in the project" });
    expect(Number(/id="label"[^>]*font-size="([\d.]+)"/.exec(long.svg)![1])).toBeLessThan(18);
  });
});
