import { describe, expect, it } from "vitest";
import { callTool, createEffectToolProvider } from "../editor/agent.js";
import { createEffectDocument } from "../editor/document.js";
import { createEffectEditor } from "../editor/editor.js";
import { effectControls, effectDefaults, findEffects, getEffect } from "./index.js";
import {
  FrameBlender,
  frameEcho,
  getTimingEffect,
  longExposure,
  MAX_TIMING_FRAMES,
  retimeBoomerang,
  retimeFreeze,
  retimeRamp,
  retimeReverse,
  retimeSpeed,
  retimeStep,
  retimeStutter,
  timingEffects,
  timingLength,
  timingSample,
  timingValues,
  TimingRenderer,
  type TimingFootage,
} from "./timing.js";

const FOOTAGE = 6000;
/** The footage frame a sample shows, when it shows one. */
const only = (effect: Parameters<typeof timingSample>[0], time: number, values?: Record<string, unknown>) => {
  const { frames } = timingSample(effect, { time, footage: FOOTAGE }, values);
  expect(frames).toHaveLength(1);
  return frames[0]!.time;
};

describe("timing effects", () => {
  it("are in the catalog under timing, each with a preset that checks out", () => {
    expect(findEffects({ category: "timing" }).map((e) => e.id).sort()).toEqual(timingEffects.map((e) => e.id).sort());
    expect(findEffects({ kind: "timing" })).toHaveLength(timingEffects.length);
    for (const effect of timingEffects) {
      expect(getEffect(effect.id)).toBe(effect);
      expect(getTimingEffect(effect.id)).toBe(effect);
      expect(effectControls(effect).length).toBeGreaterThan(0);
      for (const preset of effect.presets ?? []) expect(timingValues(effect, { preset: preset.name }).issues, `${effect.id} ${preset.name}`).toEqual([]);
    }
  });

  it.each(timingEffects.map((e) => [e.id, e] as const))("%s gives frames within the footage that add up, the same every time", (_, effect) => {
    const presets = [undefined, ...(effect.presets ?? []).map((p) => p.values)];
    for (const values of presets) {
      const length = timingLength(effect, FOOTAGE, values);
      expect(length).toBeGreaterThan(0);
      for (const time of [0, length * 0.25, length * 0.5, length * 0.99, length]) {
        const sample = timingSample(effect, { time, footage: FOOTAGE }, values);
        expect(sample.frames.length).toBeGreaterThan(0);
        expect(sample.frames.length).toBeLessThanOrEqual(MAX_TIMING_FRAMES);
        expect(sample.frames.every((f) => f.time >= 0 && f.time < FOOTAGE)).toBe(true);
        expect(sample.frames.reduce((s, f) => s + f.weight, 0)).toBeCloseTo(1, 9);
        expect(timingSample(effect, { time, footage: FOOTAGE }, values)).toEqual(sample);
      }
    }
  });

  it("changes speed, stretching or squeezing the clip", () => {
    expect(timingLength(retimeSpeed, FOOTAGE, { speed: 0.5 })).toBe(12000);
    expect(timingLength(retimeSpeed, FOOTAGE, { speed: 2 })).toBe(3000);
    expect(only(retimeSpeed, 2000, { speed: 0.5, smooth: false })).toBeCloseTo(1000, 6);
    // Slowed, it blends the frames either side by nearness.
    const between = timingSample(retimeSpeed, { time: 1000 / 30 / 2 + 1000, footage: FOOTAGE }, { speed: 0.5 });
    expect(between.frames.map((f) => f.weight)).toEqual([expect.closeTo(0.75, 6), expect.closeTo(0.25, 6)]);
    // Sped up, it averages the frames it passes over.
    expect(timingSample(retimeSpeed, { time: 1000, footage: FOOTAGE }, { speed: 4 }).frames).toHaveLength(4);
  });

  it("ramps into slow motion round its moment and back out", () => {
    const values = { at: 0.5, slow: 0.2, hold: 1, ramp: 0.5, smooth: false };
    const length = timingLength(retimeRamp, FOOTAGE, values);
    expect(length).toBeGreaterThan(FOOTAGE);
    // Footage time only goes forward, slowest round the middle.
    let last = -1;
    const steps: number[] = [];
    for (let t = 0; t <= length; t += 100) {
      const s = timingSample(retimeRamp, { time: t, footage: FOOTAGE }, values).frames[0]!.time;
      expect(s).toBeGreaterThanOrEqual(last);
      steps.push(s - Math.max(0, last));
      last = s;
    }
    const middle = timingSample(retimeRamp, { time: length / 2, footage: FOOTAGE }, values).frames[0]!.time;
    expect(Math.abs(middle - 3000)).toBeLessThan(100);
    expect(only(retimeRamp, length, values)).toBe(FOOTAGE - FOOTAGE / 180);
  });

  it("reverses from the last frame to the first", () => {
    const last = 5000 + (29 * 1000) / 30;
    expect(only(retimeReverse, 0)).toBeCloseTo(last, 6);
    expect(only(retimeReverse, FOOTAGE)).toBe(0);
    expect(only(retimeReverse, 1000, { smooth: false })).toBeLessThan(only(retimeReverse, 0));
  });

  it("goes there and back, as many times as asked", () => {
    expect(timingLength(retimeBoomerang, FOOTAGE, { speed: 1, loops: 2 })).toBe(24000);
    const values = { speed: 1, loops: 2 };
    expect(only(retimeBoomerang, 1000, values)).toBeCloseTo(only(retimeBoomerang, 2 * (FOOTAGE - 1000 / 30) - 1000, values), 6);
  });

  it("holds a frame, then plays on from it", () => {
    const values = { at: 0.5, hold: 2 };
    expect(timingLength(retimeFreeze, FOOTAGE, values)).toBe(8000);
    const frozen = only(retimeFreeze, 3000, values);
    expect(only(retimeFreeze, 4500, values)).toBe(frozen);
    expect(only(retimeFreeze, 5000, values)).toBe(frozen);
    expect(only(retimeFreeze, 5500, values)).toBeGreaterThan(frozen);
  });

  it("replays the last snatch of each group", () => {
    const values = { chunk: 0.5, repeats: 3, every: 2 };
    // Six groups of two half-second snatches, each adding two replays.
    expect(timingLength(retimeStutter, FOOTAGE, values)).toBe(6000 + 6 * 2 * 500);
    expect(only(retimeStutter, 600, values)).toBe(only(retimeStutter, 1100, values));
    expect(only(retimeStutter, 600, values)).toBe(only(retimeStutter, 1600, values));
    expect(only(retimeStutter, 2000, values)).toBe(1000);
  });

  it("steps through frames at a low rate", () => {
    expect(only(retimeStep, 0, { rate: 4 })).toBe(only(retimeStep, 240, { rate: 4 }));
    expect(only(retimeStep, 260, { rate: 4 })).toBe(250 - (250 % (1000 / 30)));
  });

  it("echoes frames just before, fainter with age, leaving out the time before the footage", () => {
    const { frames, blend } = timingSample(frameEcho, { time: 150, footage: FOOTAGE }, { echoes: 4, spacing: 0.1, decay: 0.5 });
    expect(frames).toHaveLength(2);
    expect(frames[1]!.weight).toBeCloseTo(2 * frames[0]!.weight, 6);
    expect(blend).toBe("average");
    expect(timingSample(frameEcho, { time: 2000, footage: FOOTAGE }, { lighten: true }).blend).toBe("lighten");
  });

  it("holds the shutter open for the exposure, building from the start when asked", () => {
    expect(timingSample(longExposure, { time: 2000, footage: FOOTAGE }, { exposure: 1 }).frames).toHaveLength(31);
    // Before a whole exposure has passed there are only the frames so far.
    expect(timingSample(longExposure, { time: 100, footage: FOOTAGE }, { exposure: 1 }).frames).toHaveLength(4);
    const long = timingSample(longExposure, { time: 5000, footage: FOOTAGE }, { exposure: 10 });
    expect(long.frames.length).toBeLessThanOrEqual(MAX_TIMING_FRAMES);
    expect(long.frames[0]!.time).toBe(0);
    const built = timingSample(longExposure, { time: 4000, footage: FOOTAGE }, { build: true, lighten: true });
    expect(built.frames[0]!.time).toBe(0);
    expect(built.blend).toBe("lighten");
    // Fading, the oldest frame weighs least.
    const faded = timingSample(longExposure, { time: 3000, footage: FOOTAGE }, { fade: 1 }).frames;
    expect(faded[0]!.weight).toBeLessThan(faded[faded.length - 1]!.weight);
  });

  it("refuses bad footage, times and values with sentences, never guesses", () => {
    expect(() => timingSample(longExposure, { time: 0, footage: 0 })).toThrow(/length is a number of ms above 0/);
    expect(() => timingSample(longExposure, { time: Number.NaN, footage: FOOTAGE })).toThrow(/time is a number of ms/);
    expect(() => timingSample(longExposure, { time: 0, footage: FOOTAGE, fps: 0 })).toThrow(/frame rate/);
    expect(() => timingSample(longExposure, { time: 0, footage: FOOTAGE }, { shutter: 2 })).toThrow(/no control "shutter"; its controls are exposure, lighten, fade, build/);
    expect(() => timingLength(retimeSpeed, FOOTAGE, { speed: 20 })).toThrow(/speed/);
    expect(timingValues(retimeSpeed, { preset: "Nope" }).issues[0]).toMatch(/no preset "Nope"; its presets are "Slow motion"/);
  });

  it("has defaults for every control, and cannot be opened in the effect editor", () => {
    for (const effect of timingEffects) {
      expect(Object.keys(effectDefaults(effect)).sort()).toEqual(effect.controls.map((c) => c.name).sort());
      expect(() => createEffectDocument(effect.id)).toThrow(/is a timing effect.*catalog\.timing/);
    }
  });
});

describe("FrameBlender", () => {
  const px = (...rgba: number[]) => Uint8ClampedArray.from(rgba);

  it("averages by weight in premultiplied alpha", () => {
    const out = new FrameBlender(1).blend(
      [
        { rgba: px(200, 0, 0, 255), weight: 0.75 },
        { rgba: px(0, 0, 200, 255), weight: 0.25 },
      ],
      "average",
      new Uint8ClampedArray(4),
    );
    expect([...out]).toEqual([150, 0, 50, 255]);
    // A see-through frame does not darken the colour, only thins it.
    const edge = new FrameBlender(1).blend(
      [
        { rgba: px(200, 100, 0, 255), weight: 0.5 },
        { rgba: px(0, 0, 0, 0), weight: 0.5 },
      ],
      "average",
      new Uint8ClampedArray(4),
    );
    expect([...edge]).toEqual([200, 100, 0, 128]);
  });

  it("keeps the brightest when lightening, each frame dimmed by its weight", () => {
    const out = new FrameBlender(1).blend(
      [
        { rgba: px(255, 0, 0, 255), weight: 0.5 },
        { rgba: px(0, 100, 0, 255), weight: 1 },
      ],
      "lighten",
      new Uint8ClampedArray(4),
    );
    expect([...out]).toEqual([128, 100, 0, 255]);
  });

  it("refuses frames of another size", () => {
    expect(() => new FrameBlender(2).blend([{ rgba: px(0, 0, 0, 255), weight: 1 }], "average", new Uint8ClampedArray(8))).toThrow(/1 pixels cannot be blended with frames of 2/);
  });
});

describe("TimingRenderer", () => {
  /** Footage whose every pixel's red is its frame number, counting the frames read. */
  function counting(): TimingFootage & { reads: number[] } {
    const reads: number[] = [];
    return {
      width: 2,
      height: 1,
      duration: FOOTAGE,
      reads,
      frame(ms, out) {
        const i = Math.round((ms * 30) / 1000);
        reads.push(i);
        for (let p = 0; p < out.length; p += 4) out.set([i, 0, 0, 255], p);
      },
    };
  }

  it("draws the frames each moment shows, reading each footage frame once while it is needed", async () => {
    const footage = counting();
    const retime = new TimingRenderer(longExposure, footage, { values: { exposure: 0.5 } });
    expect(retime.length).toBe(FOOTAGE);
    const out = new Uint8ClampedArray(8);
    await retime.render(1000, out);
    // Frames 15 to 30, averaged.
    expect(out[0]).toBe(23);
    expect(footage.reads).toHaveLength(16);
    await retime.render(1000 + 1000 / 30, out);
    expect(footage.reads).toHaveLength(17);
  });

  it("retimes: reversed, the first frame drawn is the footage's last", async () => {
    const out = new Uint8ClampedArray(8);
    await new TimingRenderer(retimeReverse, counting()).render(0, out);
    expect(out[0]).toBe(179);
  });

  it("refuses bad values and leaves its own as they were", async () => {
    const retime = new TimingRenderer(retimeSpeed, counting(), { values: { speed: 2 } });
    expect(() => retime.setValues({ speed: 0 })).toThrow(/speed/);
    expect(retime.length).toBe(3000);
    expect(() => new TimingRenderer(retimeSpeed, { ...counting(), duration: -1 })).toThrow(/above 0/);
  });
});

describe("timing effects for agents", () => {
  type Timing = { length: number; samples: { time: number; count: number; blend: string; frames?: { time: number; weight: number }[]; note?: string }[] };

  it("finds them with catalog.search and explains a retime with catalog.timing", async () => {
    const editor = createEffectEditor({ from: "aurora" });
    const provider = createEffectToolProvider(editor);
    const search = await callTool(provider, "run_command", { id: "catalog.search", params: { kind: "timing", limit: 50 } });
    const found = (search.structuredContent as { result: { effects: { id: string }[] } }).result.effects.map((e) => e.id);
    expect(found.sort()).toEqual(timingEffects.map((e) => e.id).sort());

    const freeze = await callTool(provider, "run_command", { id: "catalog.timing", params: { id: "retime-freeze", footage: 4000, times: [2500], values: { at: 0.5, hold: 1 } } });
    expect(freeze.isError).toBeFalsy();
    const result = (freeze.structuredContent as { result: Timing }).result;
    expect(result.length).toBe(5000);
    expect(result.samples[0]).toMatchObject({ time: 2500, count: 1, blend: "average", frames: [{ time: 2000, weight: 1 }] });

    // A long exposure's many frames are summarised, not listed.
    const exposure = editor.commands.execute<Timing>("catalog.timing", { id: "long-exposure", footage: 6000, preset: "Light trails" });
    if (!exposure.ok) throw new Error(exposure.message);
    expect(exposure.result.samples).toHaveLength(3);
    const middle = exposure.result.samples[1]!;
    expect(middle).toMatchObject({ blend: "lighten" });
    expect(middle.frames).toBeUndefined();
    expect(middle.note).toMatch(/footage frames from/);
  });

  it("refuses what is wrong, saying what would be right", async () => {
    const editor = createEffectEditor({ from: "aurora" });
    const run = (params: unknown) => editor.commands.execute("catalog.timing", params);
    expect(run({ id: "long-exposur", footage: 1000 })).toMatchObject({ ok: false, message: expect.stringMatching(/no effect "long-exposur".*long-exposure/) });
    expect(run({ id: "aurora", footage: 1000 })).toMatchObject({ ok: false, message: expect.stringMatching(/"aurora" is a shader effect, not a timing effect/) });
    expect(run({ id: "long-exposure", footage: 1000, values: { exposure: 99 } })).toMatchObject({ ok: false, message: expect.stringMatching(/exposure/) });
    expect(run({ id: "long-exposure", footage: 1000, preset: "Nope" })).toMatchObject({ ok: false, message: expect.stringMatching(/its presets are/) });
    expect(run({ id: "long-exposure" })).toMatchObject({ ok: false });
    expect(run({ id: "long-exposure", footage: -5 })).toMatchObject({ ok: false });
    expect(run({ id: "long-exposure", footage: 1000, times: Array(21).fill(0) })).toMatchObject({ ok: false });
    const provider = createEffectToolProvider(editor);
    const load = await callTool(provider, "run_command", { id: "effect.load", params: { id: "retime-speed" } });
    expect(load.isError).toBe(true);
    expect(JSON.stringify(load.content)).toMatch(/timing effect.*catalog\.timing/);
  });
});
