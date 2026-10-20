import { checkEffectProvider, isEffectError, type EffectPixels, type EffectProvider } from "@pixerate/editor/effects";
import { EFFECTS } from "../catalog/index.js";
import { PRIMITIVES } from "../motion/library.js";
import { installFakeImages, installFakeWebGl, type FakeGl } from "../shader/test-utils.js";
import { flairEffects, type SvgRasterizer } from "./index.js";

/** Draws a vector frame as a solid picture: jsdom has no SVG layout. */
const fakeRaster: SvgRasterizer = async (_motion, _time, { width, height }) => ({ width, height, data: new Uint8ClampedArray(width * height * 4).fill(200) });

const pixels = (width: number, height: number, value = 128): EffectPixels => ({ width, height, data: new Uint8ClampedArray(width * height * 4).fill(value) });

/** The error a call fails with, as an editor sees it: its `code` and message. */
async function failure(run: () => unknown): Promise<{ code?: string; message: string }> {
  try {
    await run();
  } catch (e) {
    return { code: isEffectError(e) ? e.code : undefined, message: (e as Error).message };
  }
  throw new Error("It did not fail.");
}

function setup(options: Parameters<typeof flairEffects>[0] = {}) {
  const webgl = installFakeWebGl();
  installFakeImages();
  return { webgl, provider: flairEffects({ rasterizeSvg: fakeRaster, ...options }) };
}

describe("flairEffects conforms to @pixerate/editor/effects", () => {
  it("passes checkEffectProvider over the whole catalog and every primitive", async () => {
    const { provider } = setup();
    const issues = await checkEffectProvider(provider);
    // These primitives rightly refuse the checker's bare <rect>: one tints a fill it does not have, one follows a path it does not name.
    const needMore = new Set(["emphasis.color-pulse", "path.follow"]);
    expect(issues.filter((i) => !(needMore.has(i.effectId!) && i.message === "applyVectorEffect failed: unsupported"))).toEqual([]);
  }, 120_000);

  it("lists every effect and primitive once, with search('') the same as list()", async () => {
    const { provider } = setup();
    const list = await provider.list();
    expect(list).toHaveLength(EFFECTS.length + PRIMITIVES.length);
    expect(await provider.search("")).toEqual(list);
    expect(provider).toMatchObject({ id: "flair", name: "Flair", capabilities: { supportsHostImages: true, supportsVector: true, supportsMask: false, supportsFloat: false } });
  });
});

describe("the catalog as the contract sees it", () => {
  let provider: EffectProvider;
  beforeEach(() => {
    provider = setup().provider;
  });

  it("makes video filters filters that read source", async () => {
    const crt = await provider.describe("crt");
    expect(crt.uses).toContain("filter");
    expect(crt.inputs).toEqual([expect.objectContaining({ name: "source", kind: "image", required: true })]);
    expect(Object.keys(crt.controls.properties)).not.toContain("uImage");
  });

  it("makes transitions read from and to, with progress rather than uAnimate and uProgress controls", async () => {
    const wipe = await provider.describe("transition-wipe");
    expect(wipe.uses).toEqual(["transition"]);
    expect(wipe.inputs.map((i) => [i.name, i.required])).toEqual([
      ["from", true],
      ["to", true],
    ]);
    expect(Object.keys(wipe.controls.properties)).not.toEqual(expect.arrayContaining(["uAnimate"]));
    expect(wipe.controls.properties.uProgress).toBeUndefined();
    expect(wipe).toMatchObject({ loop: true, duration: 4000 });
  });

  it("sorts the rest into generators, overlays and titles", async () => {
    expect((await provider.describe("aurora")).uses).toEqual(["generator"]);
    const overlay = (await provider.list()).find((e) => e.kind === "shader" && e.transparent)!;
    expect(overlay.uses).toContain("overlay");
    expect((await provider.describe("lower-third")).uses).toContain("title");
    expect((await provider.list({ use: "transition" })).length).toBe(20);
  });

  it("gives colours as #rrggbb, with defaults and presets that validate", async () => {
    const duotone = await provider.describe("image-duotone");
    expect(duotone.defaults.uShadow).toMatch(/^#[0-9a-f]{6}$/);
    expect(duotone.controls.properties.uShadow!.default).toBe(duotone.defaults.uShadow);
    expect(duotone.presets.map((p) => p.name)).toEqual(["Spotify", "Newsprint"]);
    expect(Object.values(duotone.presets[0]!.values).some((v) => typeof v === "string" && v.startsWith("#"))).toBe(true);
  });

  it("describes motion primitives with their parameters", async () => {
    const pop = await provider.describe("entrance.pop");
    expect(pop).toMatchObject({ kind: "motion", uses: ["motion"], category: "entrance", inputs: [] });
    for (const property of Object.values(pop.controls.properties)) expect(property.description).toBeTruthy();
  });

  it("searches by words, best first, and filters by use and kind", async () => {
    const fire = await provider.search("fire");
    expect(fire.length).toBeGreaterThan(0);
    expect(fire.every((e) => JSON.stringify(e).toLowerCase().includes("fire"))).toBe(true);
    expect((await provider.search("", { kind: "motion" })).length).toBe(PRIMITIVES.length);
    expect(await provider.search("", { limit: 3 })).toHaveLength(3);
  });

  it("refuses unknown ids with unknown_effect", async () => {
    expect(await failure(() => provider.describe("auroa"))).toMatchObject({ code: "unknown_effect", message: expect.stringContaining("auroa") });
    expect(await failure(() => provider.createRenderer("auroa", { width: 4, height: 4 }))).toMatchObject({ code: "unknown_effect" });
    expect(await failure(() => provider.applyVectorEffect!("auroa", "<svg/>"))).toMatchObject({ code: "unknown_effect" });
  });

  it("offers only the kinds asked for", async () => {
    const shaders = flairEffects({ kinds: ["shader"] });
    expect((await shaders.list()).every((e) => e.kind === "shader")).toBe(true);
    expect(shaders.capabilities.supportsVector).toBe(false);
    expect(await failure(() => shaders.describe("entrance.pop"))).toMatchObject({ code: "unknown_effect" });
  });
});

describe("rendering", () => {
  const lastGl = (webgl: ReturnType<typeof installFakeWebGl>): FakeGl => webgl.last();

  it("renders a shader at the time asked for, in ms, with contract values as Flair's", async () => {
    const { webgl, provider } = setup();
    const renderer = await provider.createRenderer("aurora", { width: 6, height: 4 });
    const out = await renderer.render({ time: 1500, values: { uSpeed: 2 } });
    expect([out.width, out.height, out.data.length]).toEqual([6, 4, 96]);
    expect(out.data).toBeInstanceOf(Uint8ClampedArray);
    const gl = lastGl(webgl);
    expect(gl.uniform("iTime")).toEqual([1.5]);
    expect(gl.uniform("uSpeed")).toEqual([2]);
    renderer.dispose();
  });

  it("takes hex colours, and refuses bad values with invalid_values, leaving the renderer usable", async () => {
    const { webgl, provider } = setup();
    const renderer = await provider.createRenderer("image-duotone", { width: 2, height: 2 });
    const source = pixels(2, 2);
    await renderer.render({ time: 0, inputs: { source }, values: { uShadow: "#ff0000" } });
    expect(lastGl(webgl).uniform("uShadow")).toEqual([[1, 0, 0]]);
    expect(await failure(() => renderer.render({ time: 0, inputs: { source }, values: { uShadow: "red" } }))).toMatchObject({ code: "invalid_values", message: expect.stringContaining("uShadow") });
    expect(await failure(() => renderer.render({ time: 0, inputs: { source }, values: { uContrast: 99 } }))).toMatchObject({ code: "invalid_values" });
    expect(await failure(() => renderer.render({ time: 0, inputs: { source }, values: { uNope: 1 } }))).toMatchObject({ code: "invalid_values" });
    await expect(renderer.render({ time: 0, inputs: { source } })).resolves.toMatchObject({ width: 2 });
  });

  it("shows inputs in their image controls, and says which inputs exist or are missing", async () => {
    const { webgl, provider } = setup();
    const renderer = await provider.createRenderer("crt", { width: 2, height: 2 });
    const source = pixels(3, 3, 7);
    await renderer.render({ time: 0, inputs: { source } });
    const uploaded = lastGl(webgl).textures.find((t) => (t.image as ImageData | undefined)?.data?.[0] === 7);
    expect(uploaded).toMatchObject({ flipped: true });
    expect(await failure(() => renderer.render({ time: 0, inputs: { source, extra: source } }))).toMatchObject({ code: "unsupported", message: expect.stringMatching(/no input "extra".*"source"/) });
    expect(await failure(() => renderer.render({ time: 0 }))).toMatchObject({ code: "unsupported", message: expect.stringContaining('needs the input "source"') });
  });

  it("drives a transition's progress: given, or time over its duration", async () => {
    const { webgl, provider } = setup();
    const renderer = await provider.createRenderer("transition-wipe", { width: 2, height: 2 });
    const inputs = { from: pixels(2, 2, 0), to: pixels(2, 2, 255) };
    await renderer.render({ time: 0, inputs, progress: 0.25 });
    const gl = lastGl(webgl);
    expect([gl.uniform("uAnimate"), gl.uniform("uProgress")]).toEqual([[0], [0.25]]);
    await renderer.render({ time: 3000, inputs });
    expect(gl.uniform("uProgress")).toEqual([0.75]);
    await renderer.render({ time: 9000, inputs });
    expect(gl.uniform("uProgress")).toEqual([1]);
  });

  it("refuses a render after dispose with disposed, and a time that is not a number", async () => {
    const { provider } = setup();
    const renderer = await provider.createRenderer("aurora", { width: 2, height: 2 });
    expect(await failure(() => renderer.render({ time: Number.NaN }))).toMatchObject({ code: "unsupported", message: expect.stringContaining("time") });
    renderer.dispose();
    expect(await failure(() => renderer.render({ time: 0 }))).toMatchObject({ code: "disposed" });
  });

  it("refuses sizes below a pixel, a mask (not supported yet), and pixels from a primitive", async () => {
    const { provider } = setup();
    expect(await failure(() => provider.createRenderer("aurora", { width: 0, height: 4 }))).toMatchObject({ code: "unsupported", message: expect.stringContaining("width and height") });
    const renderer = await provider.createRenderer("aurora", { width: 2, height: 2 });
    expect(await failure(() => renderer.render({ time: 0, mask: pixels(2, 2) }))).toMatchObject({ code: "unsupported", message: expect.stringContaining("applyEffectMask") });
    expect(await failure(() => provider.createRenderer("entrance.pop", { width: 2, height: 2 }))).toMatchObject({ code: "unsupported", message: expect.stringContaining("applyVectorEffect") });
  });

  it("renders vector effects with the rasteriser, at the time and values asked for", async () => {
    installFakeWebGl();
    const rasterize = vi.fn(fakeRaster);
    const provider = flairEffects({ rasterizeSvg: rasterize });
    const renderer = await provider.createRenderer("lower-third", { width: 4, height: 2 });
    const out = await renderer.render({ time: 250, values: { title: "Ada Lovelace" } as never });
    expect(out.width).toBe(4);
    const [motion, time, size] = rasterize.mock.calls[0]!;
    expect([time, size]).toEqual([250, { width: 4, height: 2 }]);
    expect(motion.svg).toContain("Ada Lovelace");
  });

  it("in a Worker, refuses vector pixels without a rasteriser, saying what to do", async () => {
    installFakeWebGl();
    vi.stubGlobal("document", undefined);
    const provider = flairEffects();
    expect(provider.capabilities.supportsWorker).toBe(true);
    expect(await failure(() => provider.createRenderer("lower-third", { width: 4, height: 2 }))).toMatchObject({ code: "unsupported", message: expect.stringMatching(/Worker.*rasterizeSvg.*applyVectorEffect/) });
  });
});

describe("applyVectorEffect", () => {
  const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><clipPath id="clip"><rect id="cliprect" width="10" height="10"/></clipPath></defs><g id="logo"><circle id="dot" cx="50" cy="50" r="10"/></g><rect id="bar" x="0" y="80" width="100" height="10"/></svg>';

  it("applies a primitive to each top-level element with an id, or the ones asked for", async () => {
    const { provider } = setup();
    const all = await provider.applyVectorEffect!("entrance.fade", SVG);
    // Each use is tagged with what it moved (primitives may wrap the element).
    expect(new Set(all.animate!.map((a) => (a as { tag?: string }).tag))).toEqual(new Set(["entrance.fade@logo", "entrance.fade@bar"]));
    expect(all).toMatchObject({ loop: false });
    expect(all.duration).toBeGreaterThan(0);
    const one = await provider.applyVectorEffect!("entrance.fade", { svg: SVG, nodeIds: ["dot"] });
    expect(new Set(one.animate!.map((a) => (a as { tag?: string }).tag))).toEqual(new Set(["entrance.fade@dot"]));
  });

  it("applies primitives that need more once given it: a fill to tint, a path to follow", async () => {
    const { provider } = setup();
    const art = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path id="route" d="M0 0 L100 100" fill="none"/><circle id="ball" r="5" fill="#ff0000"/></svg>';
    await expect(provider.applyVectorEffect!("emphasis.color-pulse", { svg: art, nodeIds: ["ball"] })).resolves.toMatchObject({ svg: expect.stringContaining("ball") });
    await expect(provider.applyVectorEffect!("path.follow", { svg: art, nodeIds: ["ball"] }, { path: "route" })).resolves.toMatchObject({ animate: [expect.objectContaining({ along: "route" })] });
  });

  it("checks a primitive's parameters against its schema", async () => {
    const { provider } = setup();
    expect(await failure(() => provider.applyVectorEffect!("entrance.fade", SVG, { nope: 1 }))).toMatchObject({ code: "invalid_values" });
  });

  it("says what to do with an SVG without ids, or no SVG", async () => {
    const { provider } = setup();
    expect(await failure(() => provider.applyVectorEffect!("entrance.fade", '<svg viewBox="0 0 1 1"><rect/></svg>'))).toMatchObject({ code: "unsupported", message: expect.stringContaining("nodeIds") });
    expect(await failure(() => provider.applyVectorEffect!("entrance.fade", "not svg"))).toMatchObject({ code: "unsupported" });
  });

  it("gives a vector effect's own animated SVG, with values filled in", async () => {
    const { provider } = setup();
    const motion = await provider.applyVectorEffect!("lower-third", SVG);
    expect(motion.svg).toContain("<svg");
    expect(motion).toMatchObject({ loop: true, hold: expect.any(Number) });
    expect(motion.duration).toBeGreaterThan(motion.hold!);
  });

  it("refuses shaders, which are pixels", async () => {
    const { provider } = setup();
    expect(await failure(() => provider.applyVectorEffect!("aurora", SVG))).toMatchObject({ code: "unsupported", message: expect.stringContaining("createRenderer") });
  });
});
