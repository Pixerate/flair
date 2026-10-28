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

function setup(options: Parameters<typeof flairEffects>[0] = {}, gl: Parameters<typeof installFakeWebGl>[0] = {}) {
  const webgl = installFakeWebGl(gl);
  installFakeImages();
  return { webgl, provider: flairEffects({ rasterizeSvg: fakeRaster, ...options }) };
}

describe("flairEffects conforms to @pixerate/editor/effects", () => {
  it("passes checkEffectProvider over the whole catalog and every primitive", async () => {
    const { provider } = setup();
    expect(await checkEffectProvider(provider)).toEqual([]);
  }, 120_000);

  it("lists every effect and primitive once, with search('') the same as list()", async () => {
    const { provider } = setup();
    const list = await provider.list();
    expect(list).toHaveLength(EFFECTS.length + PRIMITIVES.length);
    expect(await provider.search("")).toEqual(list);
    expect(provider).toMatchObject({ id: "flair", name: "Flair", capabilities: { supportsHostImages: true, supportsVector: true, supportsMask: true, supportsFloat: true } });
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
    expect((await provider.list({ use: "transition" })).length).toBe(21);
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

  it("refuses sizes below a pixel, a depth that is not 8, 16 or 32, and pixels from a primitive", async () => {
    const { provider } = setup();
    expect(await failure(() => provider.createRenderer("aurora", { width: 0, height: 4 }))).toMatchObject({ code: "unsupported", message: expect.stringContaining("width and height") });
    expect(await failure(() => provider.createRenderer("aurora", { width: 2, height: 2, depth: 12 as never }))).toMatchObject({ code: "unsupported", message: expect.stringContaining("8, 16 or 32") });
    expect(await failure(() => provider.createRenderer("entrance.pop", { width: 2, height: 2 }))).toMatchObject({ code: "unsupported", message: expect.stringContaining("applyVectorEffect") });
  });

  it("renders deep layers in floats, giving float pixels in linear light with their 8-bit encoding", async () => {
    const { webgl, provider } = setup();
    const renderer = await provider.createRenderer("aurora", { width: 2, height: 2, depth: 16 });
    expect(renderer.depth).toBe(16);
    const out = await renderer.render({ time: 0 });
    expect(out.float).toBeInstanceOf(Float32Array);
    expect([out.float!.length, out.data.length]).toEqual([16, 16]);
    expect(lastGl(webgl).named("texImage2D").some((c) => c.args[2] === lastGl(webgl).RGBA16F)).toBe(true);
    const full = await provider.createRenderer("aurora", { width: 2, height: 2, depth: 32 });
    expect(full.depth).toBe(32);
  });

  it("gives 8-bit frames where the GPU cannot render to floats, and says so", async () => {
    installFakeWebGl({ extensions: [] });
    installFakeImages();
    const renderer = await flairEffects().createRenderer("aurora", { width: 2, height: 2, depth: 32 });
    expect(renderer.depth).toBe(8);
    expect((await renderer.render({ time: 0 })).float).toBeUndefined();
  });

  it("takes float pictures in, uploaded as floats", async () => {
    const { webgl, provider } = setup();
    const renderer = await provider.createRenderer("crt", { width: 2, height: 2, depth: 16 });
    const source: EffectPixels = { ...pixels(2, 2), float: new Float32Array(16).fill(2) };
    await renderer.render({ time: 0, inputs: { source } });
    expect(lastGl(webgl).named("texImage2D").some((c) => c.args[8] === source.float)).toBe(true);
  });

  it("masks a filter on the GPU, over its source", async () => {
    const { webgl, provider } = setup();
    const renderer = await provider.createRenderer("crt", { width: 2, height: 2 });
    const source = pixels(2, 2, 9);
    const mask = pixels(2, 2, 255);
    await renderer.render({ time: 0, inputs: { source }, mask });
    const gl = lastGl(webgl);
    const composite = gl.draws.find((d) => d.program?.shaders.some((sh) => sh.source.includes("flair_mask")))!;
    expect(composite).toBeDefined();
    expect((composite.textures[1] as { image?: { data?: Uint8ClampedArray } }).image?.data?.[0]).toBe(255);
    expect((composite.textures[2] as { image?: { data?: Uint8ClampedArray } }).image?.data?.[0]).toBe(9);
    // Without a mask the next frame is the effect alone.
    await renderer.render({ time: 0, inputs: { source } });
    expect(gl.draws.filter((d) => d.program?.shaders.some((sh) => sh.source.includes("flair_mask")))).toHaveLength(1);
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

  it("masks a vector effect by multiplying its alpha, and gives floats at depth 16", async () => {
    const { provider } = setup();
    const renderer = await provider.createRenderer("lower-third", { width: 2, height: 1, depth: 16 });
    const mask = { width: 2, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 0]) };
    const out = await renderer.render({ time: 0, mask });
    expect([out.data[3], out.data[7]]).toEqual([200, 0]);
    expect(out.float![3]).toBeCloseTo(200 / 255);
    expect(await failure(() => renderer.render({ time: 0, mask: pixels(4, 4) }))).toMatchObject({ code: "unsupported", message: expect.stringContaining("2 × 1") });
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
    expect(new Set(all.animate!.map((a) => a.tag))).toEqual(new Set(["entrance.fade@logo", "entrance.fade@bar"]));
    expect(all).toMatchObject({ loop: false });
    expect(all.duration).toBeGreaterThan(0);
    const one = await provider.applyVectorEffect!("entrance.fade", { svg: SVG, nodeIds: ["dot"] });
    expect(new Set(one.animate!.map((a) => a.tag))).toEqual(new Set(["entrance.fade@dot"]));
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

describe("authoring", () => {
  /** The fake GPU fails a source containing COMPILE_ERROR, at line 3. */
  const BROKEN = { compileLog: "ERROR: 0:3: 'oops' : syntax error\n" };

  async function open(source: Parameters<NonNullable<EffectProvider["openAuthoring"]>>[0] = { effectId: "aurora" }, gl: Parameters<typeof installFakeWebGl>[0] = BROKEN) {
    const { webgl, provider } = setup({}, gl);
    const session = await provider.openAuthoring!(source);
    return { webgl, provider, session };
  }

  it("passes the editor's authoring checks, opening shaders with their GLSL", async () => {
    const { provider } = setup();
    expect(provider.capabilities.supportsAuthoring).toBe(true);
    expect(await checkEffectProvider(provider, { ids: ["aurora", "crt", "transition-wipe"] })).toEqual([]);
    expect(flairEffects({ kinds: ["motion"] }).capabilities.supportsAuthoring).toBe(false);
  });

  it("gives compile errors from setSource on the source's lines, and clears them when fixed", async () => {
    const { session } = await open();
    expect(session.getState()).toMatchObject({ providerId: "flair", effectId: "aurora", kind: "shader", sourceLanguage: "glsl", compiled: true, issues: [] });
    const good = session.getState().source!;
    const lines = good.split("\n");
    lines.splice(2, 0, "COMPILE_ERROR");
    const result = await session.setSource!(lines.join("\n"));
    expect(result).toEqual({ ok: true, issues: [{ message: expect.stringContaining("oops"), line: 3, severity: "error" }] });
    expect(session.getState()).toMatchObject({ compiled: false, issues: [{ line: 3, severity: "error" }] });
    expect(await session.setSource!(good)).toEqual({ ok: true, issues: [] });
    expect(session.getState()).toMatchObject({ compiled: true, issues: [] });
    expect(await session.setSource!(42 as never)).toMatchObject({ ok: false, message: expect.stringContaining("string") });
  });

  it("adds a // @control uniform added to the source to the description", async () => {
    const { session } = await open();
    const before = session.getState().description;
    await session.setSource!(`${session.getState().source}\nuniform float uNew; // @control min=0 max=1 default=0.5 label="New"`);
    const { description, values } = session.getState();
    expect(description).not.toBe(before);
    expect(description.controls.properties.uNew).toMatchObject({ type: "number", minimum: 0, maximum: 1 });
    expect([description.defaults.uNew, values.uNew]).toEqual([0.5, 0.5]);
    expect(session.setValue("uNew", 0.75)).toEqual({ ok: true });
  });

  it("refuses bad values naming the control, all or nothing, changing nothing", async () => {
    const { session } = await open();
    const before = session.getState();
    expect(session.setValue("uSpeed", 9)).toEqual({ ok: false, message: expect.stringContaining('control "uSpeed"') });
    expect(session.setValue("uSped", 1)).toEqual({ ok: false, message: expect.stringMatching(/no control "uSped"; the controls are uSky, uGlowA/) });
    expect(session.setValues({ uSpeed: 1, uGlowA: 42 } as never)).toEqual({ ok: false, message: expect.stringContaining('control "uGlowA"') });
    expect(session.resetValues(["uNope"])).toMatchObject({ ok: false, message: expect.stringContaining("the controls are") });
    expect(session.setKeyframe("uSpeed", -1, 1)).toMatchObject({ ok: false, message: expect.stringContaining("0 or more") });
    expect(session.removeKeyframe("uSpeed", 10)).toMatchObject({ ok: false, message: expect.stringContaining("has none") });
    expect(session.applyPreset("Nope")).toMatchObject({ ok: false, message: expect.stringContaining('"Arctic", "Ember", "Ice"') });
    expect(session.setTiming({ duration: 0 })).toMatchObject({ ok: false });
    expect(session.getState()).toBe(before);
    expect(session.setValues({ uSpeed: 1, uGlowA: "#ff0000" })).toEqual({ ok: true });
    expect(session.getState().values).toMatchObject({ uSpeed: 1, uGlowA: "#ff0000" });
  });

  it("merges a gesture into one undo step, and undoes and redoes values and source", async () => {
    const { session } = await open();
    const { values, source } = session.getState();
    session.setValue("uSpeed", 0.5, { gesture: "drag" });
    session.setValue("uHeight", 0.9, { gesture: "drag" });
    session.setValue("uSpeed", 1.5, { gesture: "drag" });
    expect(session.getState().values).toMatchObject({ uSpeed: 1.5, uHeight: 0.9 });
    expect(session.undo()).toBe(true);
    expect(session.getState()).toMatchObject({ values, canUndo: false, canRedo: true });
    expect(session.redo()).toBe(true);
    expect(session.getState().values).toMatchObject({ uSpeed: 1.5, uHeight: 0.9 });

    await session.setSource!(`${source}\n// COMPILE_ERROR`);
    expect(session.getState().compiled).toBe(false);
    session.undo();
    expect(session.getState()).toMatchObject({ source, compiled: true });
    session.redo();
    expect(session.getState()).toMatchObject({ source: `${source}\n// COMPILE_ERROR`, compiled: false });
  });

  it("keeps the state object until something changes, and tells subscribers", async () => {
    const { session } = await open();
    const seen: unknown[] = [];
    const unsubscribe = session.subscribe((state) => seen.push(state));
    expect(session.getState()).toBe(session.getState());
    session.seek(99_999);
    expect(session.getState().time).toBe(session.getState().duration);
    expect(seen.at(-1)).toBe(session.getState());
    unsubscribe();
    session.seek(0);
    expect(seen).toHaveLength(1);
  });

  it("previews the keyframed values at each time, unless values are given", async () => {
    const { webgl, session } = await open();
    expect(session.setKeyframe("uSpeed", 0, 0)).toEqual({ ok: true });
    expect(session.setKeyframe("uSpeed", 1000, 2)).toEqual({ ok: true });
    expect(session.getState().tracks.uSpeed).toEqual([
      { time: 0, value: 0 },
      { time: 1000, value: 2 },
    ]);
    const preview = await session.createPreview({ width: 4, height: 4 });
    const out = await preview.render({ time: 500 });
    expect([out.width, out.height]).toEqual([4, 4]);
    expect(webgl.last().uniform("uSpeed")).toEqual([1]);
    expect(webgl.last().uniform("iTime")).toEqual([0.5]);
    await preview.render({ time: 1000 });
    expect(webgl.last().uniform("uSpeed")).toEqual([2]);
    await preview.render({ time: 500, values: { uSpeed: 0.25 } });
    expect(webgl.last().uniform("uSpeed")).toEqual([0.25]);
    await expect(preview.render({ time: 0, values: { uSpeed: "fast" } as never })).rejects.toMatchObject({ code: "invalid_values" });
  });

  it("previews the source as it is now: one that fails draws nothing, a fixed one draws again", async () => {
    const { webgl, session } = await open(undefined, { ...BROKEN, pixel: () => [9, 9, 9, 255] });
    const preview = await session.createPreview({ width: 2, height: 2 });
    expect((await preview.render({ time: 0 })).data[0]).toBe(9);
    const source = session.getState().source!;
    await session.setSource!(`${source}\n// COMPILE_ERROR`);
    const contexts = webgl.contexts.length;
    const failed = await preview.render({ time: 0 });
    expect([...failed.data]).toEqual(new Array(16).fill(0));
    expect(session.getState()).toMatchObject({ compiled: false, issues: [{ line: 3, severity: "error" }] });
    await session.setSource!(`${source}\n// fixed`);
    expect((await preview.render({ time: 0 })).data[0]).toBe(9);
    // Each new source got a pipeline of its own.
    expect(webgl.contexts.length).toBe(contexts + 2);
    expect(session.getState().compiled).toBe(true);
  });

  it("feeds a transition's from and to, and its progress over the timeline", async () => {
    const { webgl, session } = await open({ effectId: "transition-wipe" });
    const preview = await session.createPreview({ width: 2, height: 2 });
    await expect(preview.render({ time: 0 })).rejects.toMatchObject({ code: "unsupported", message: expect.stringContaining('"from"') });
    await preview.render({ time: session.getState().duration / 4, inputs: { from: pixels(2, 2), to: pixels(2, 2, 10) } });
    expect(webgl.last().uniform("uProgress")).toEqual([0.25]);
  });

  it("exports a document that reopens with its source, values, tracks and presets", async () => {
    const { provider, session } = await open();
    await session.setSource!(`${session.getState().source}\n// edited`);
    session.setValue("uGlowA", "#112233");
    session.setKeyframe("uHeight", 0, 0.1);
    session.setKeyframe("uHeight", 2000, 0.9, "ease-in");
    expect(session.savePreset("Mine")).toEqual({ ok: true });
    session.setTiming({ duration: 6000, loop: false });
    const saved = JSON.parse(JSON.stringify(session.exportDocument()));
    expect(saved).toMatchObject({ version: 1, providerId: "flair", effectId: "aurora", duration: 6000, loop: false, values: { uGlowA: "#112233" } });

    const state = session.getState();
    const reopened = (await provider.openAuthoring!({ document: saved })).getState();
    expect(reopened).toMatchObject({ source: state.source, values: state.values, tracks: state.tracks, duration: 6000, loop: false });
    expect(reopened.description.presets.map((p) => p.name)).toEqual(["Arctic", "Ember", "Ice", "Mine"]);
    expect(reopened.description.presets).toEqual(state.description.presets);

    // Only the contract's fields: the catalog effect with them over it.
    const { flair: _, ...contract } = saved;
    const fromContract = (await provider.openAuthoring!({ document: contract })).getState();
    expect(fromContract).toMatchObject({ values: state.values, tracks: state.tracks, duration: 6000 });
    expect(fromContract.description.presets.map((p) => p.name)).toEqual(["Arctic", "Ember", "Ice", "Mine"]);
  });

  it("refuses a corrupted document with invalid_values, naming what is wrong", async () => {
    const { provider, session } = await open();
    const saved = JSON.parse(JSON.stringify(session.exportDocument()));
    const { flair: _, ...contract } = saved;
    expect(await failure(() => provider.openAuthoring!({ document: { ...saved, values: { uSpeed: "fast" } } }))).toMatchObject({ code: "invalid_values", message: expect.stringContaining("/values/uSpeed") });
    expect(await failure(() => provider.openAuthoring!({ document: { ...saved, flair: { version: 2 } } }))).toMatchObject({ code: "invalid_values", message: expect.stringContaining("/flair") });
    expect(await failure(() => provider.openAuthoring!({ document: { ...contract, tracks: { uNope: [] } } }))).toMatchObject({ code: "invalid_values", message: expect.stringContaining("/tracks/uNope") });
    expect(await failure(() => provider.openAuthoring!({ document: { ...contract, providerId: "other" } }))).toMatchObject({ code: "invalid_values", message: expect.stringContaining("/providerId") });
    expect(await failure(() => provider.openAuthoring!({ document: "nope" }))).toMatchObject({ code: "invalid_values" });
  });

  it("opens vector effects without source, with a preset's values, and refuses primitives and unknown ids", async () => {
    const { provider } = setup();
    const vector = (await provider.list({ kind: "vector" }))[0]!;
    const session = await provider.openAuthoring!({ effectId: vector.id });
    expect(session.getState()).toMatchObject({ kind: "vector", source: null, sourceLanguage: null, compiled: null });
    expect(await session.setSource!("<svg/>")).toMatchObject({ ok: false, message: expect.stringContaining("sourceLanguage is null") });
    const out = await (await session.createPreview({ width: 4, height: 2 })).render({ time: 0 });
    expect([out.width, out.height]).toEqual([4, 2]);

    const ember = (await provider.describe("aurora")).presets.find((p) => p.name === "Ember")!;
    expect((await provider.openAuthoring!({ effectId: "aurora", preset: "Ember" })).getState().values).toMatchObject(ember.values);
    expect(await failure(() => provider.openAuthoring!({ effectId: "aurora", preset: "Nope" }))).toMatchObject({ code: "unsupported", message: expect.stringContaining('"Arctic"') });
    expect(await failure(() => provider.openAuthoring!({ effectId: "entrance.pop" }))).toMatchObject({ code: "unsupported", message: expect.stringContaining("applyVectorEffect") });
    expect(await failure(() => provider.openAuthoring!({ effectId: "auroa" }))).toMatchObject({ code: "unknown_effect" });
  });

  it("in a Worker without a rasteriser, refuses a vector preview saying what to do", async () => {
    const { provider } = setup();
    const vector = (await provider.list({ kind: "vector" }))[0]!;
    vi.stubGlobal("document", undefined);
    const worker = flairEffects();
    vi.unstubAllGlobals();
    const session = await worker.openAuthoring!({ effectId: vector.id });
    expect(await failure(() => session.createPreview({ width: 2, height: 2 }))).toMatchObject({ code: "unsupported", message: expect.stringContaining("rasterizeSvg") });
  });

  it("disposes its previews, and refuses writes once closed", async () => {
    const { session } = await open();
    const preview = await session.createPreview({ width: 2, height: 2 });
    session.dispose();
    expect(await failure(() => preview.render({ time: 0 }))).toMatchObject({ code: "disposed" });
    expect(session.setValue("uSpeed", 1)).toMatchObject({ ok: false, message: expect.stringContaining("closed") });
    expect(await session.setSource!("void mainImage(out vec4 c, in vec2 p) {}")).toMatchObject({ ok: false });
    expect(session.undo()).toBe(false);
    expect(() => session.dispose()).not.toThrow();
  });
});
