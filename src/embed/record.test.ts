import { afterEach, describe, expect, it, vi } from "vitest";
import { getEffect } from "../catalog/index.js";
import { renderVectorEffect, type VectorEffect } from "../catalog/types.js";
import { svgDuration } from "../vector/svg.js";
import { recordEffect, recordingPlan } from "./index.js";

// jsdom has no WebGL: frames come from a stand-in that remembers what it was asked to draw.
const rendered: { time: number; options: Record<string, unknown> }[] = [];
vi.mock("../shader/frames.js", () => ({
  ShaderFrames: class {
    width: number;
    height: number;
    constructor(options: { width: number; height: number }) {
      this.width = options.width;
      this.height = options.height;
    }
    setLiveSource() {}
    async ready() {}
    render(time: number, options: Record<string, unknown>) {
      rendered.push({ time, options });
    }
    readPixels(out: Uint8ClampedArray) {
      out.fill(200);
      return out;
    }
    dispose() {}
  },
}));

/** WebCodecs as a browser that encodes `codecs` (by prefix) would have it, with chunks of fake bytes. */
function stubWebCodecs(codecs: string[]) {
  const supports = (codec: string) => codecs.some((c) => codec.startsWith(c));
  class FakeEncoder {
    static configs: VideoEncoderConfig[] = [];
    static async isConfigSupported(config: VideoEncoderConfig) {
      return { supported: supports(config.codec), config };
    }
    state = "unconfigured";
    encodeQueueSize = 0;
    private sent = 0;
    constructor(private init: VideoEncoderInit) {}
    configure(config: VideoEncoderConfig) {
      FakeEncoder.configs.push(config);
      this.state = "configured";
    }
    encode(frame: { timestamp: number; duration: number }, options?: { keyFrame?: boolean }) {
      const chunk = { byteLength: 8, timestamp: frame.timestamp, duration: frame.duration, type: options?.keyFrame ? "key" : "delta", copyTo: (d: Uint8Array) => d.fill(1) };
      this.init.output(chunk as unknown as EncodedVideoChunk, this.sent++ === 0 ? { decoderConfig: { codec: "avc1", description: Uint8Array.of(1, 100, 0, 31) } } : {});
    }
    async flush() {}
    close() {
      this.state = "closed";
    }
  }
  class FakeFrame {
    constructor(
      readonly data: unknown,
      readonly init: { timestamp: number; duration: number; format: string },
    ) {}
    get timestamp() {
      return this.init.timestamp;
    }
    get duration() {
      return this.init.duration;
    }
    close() {}
  }
  vi.stubGlobal("VideoEncoder", FakeEncoder);
  vi.stubGlobal("VideoFrame", FakeFrame);
  return FakeEncoder;
}

afterEach(() => {
  rendered.length = 0;
});

describe("recordingPlan", () => {
  it("records a shader's loop, a vector effect's picture and hold, else 4 seconds", async () => {
    stubWebCodecs(["avc1"]);
    expect(await recordingPlan("cell-division")).toMatchObject({ duration: 8, frames: 240, fps: 30, width: 1280, height: 720 });
    expect(await recordingPlan("aurora", { fps: 25 })).toMatchObject({ duration: 4, frames: 100 });
    const typewriter = getEffect("typewriter") as VectorEffect;
    const motion = renderVectorEffect(typewriter, { text: "Hello there, a longer line" });
    const plan = await recordingPlan(typewriter, { subject: { text: "Hello there, a longer line" } });
    expect(plan.duration).toBeCloseTo((svgDuration(motion) + (typewriter.hold ?? 600)) / 1000);
    expect(plan.duration).toBeGreaterThan((await recordingPlan(typewriter, { subject: { text: "Hi" } })).duration);
    expect(await recordingPlan("aurora", { duration: 1.5, start: 2, fps: 10 })).toMatchObject({ duration: 1.5, start: 2, frames: 15 });
  });

  it("makes an mp4 where the browser encodes H.264, else a webm", async () => {
    stubWebCodecs(["avc1", "vp09", "vp8"]);
    expect(await recordingPlan("aurora")).toMatchObject({ format: "mp4", alpha: false, encoder: { codec: "avc1.64001F", avc: { format: "avc" } } });
    stubWebCodecs(["vp8"]);
    expect(await recordingPlan("aurora")).toMatchObject({ format: "webm", encoder: { codec: "vp8" } });
    stubWebCodecs(["avc1.42"]);
    expect((await recordingPlan("aurora")).encoder?.codec).toBe("avc1.42E01F");
    // 4K at 60 needs a higher level.
    stubWebCodecs(["avc1"]);
    expect((await recordingPlan("aurora", { width: 3840, height: 2160, fps: 60 })).encoder?.codec).toBe("avc1.640034");
  });

  it("keeps a transparent effect's alpha in a webm, or lays it over the background in an mp4 when it must", async () => {
    stubWebCodecs(["avc1", "vp09"]);
    expect(await recordingPlan("click-ripple")).toMatchObject({ format: "webm", alpha: true, encoder: { codec: "vp09.00.10.08" } });
    expect(await recordingPlan("click-ripple", { format: "mp4" })).toMatchObject({ format: "mp4", alpha: false });
    expect(await recordingPlan("click-ripple", { alpha: false })).toMatchObject({ format: "mp4", alpha: false });
    expect(await recordingPlan("click-ripple", { format: "gif" })).toMatchObject({ format: "gif", alpha: true });
    stubWebCodecs(["avc1"]);
    expect(await recordingPlan("click-ripple")).toMatchObject({ format: "mp4", alpha: false });
    await expect(recordingPlan("click-ripple", { alpha: true })).rejects.toThrow(/cannot encode VP8 or VP9.*"png" or "gif"/);
    await expect(recordingPlan("click-ripple", { format: "mp4", alpha: true })).rejects.toThrow(/mp4 \(H.264\) cannot keep transparency; record "webm", "png" or "gif"/);
  });

  it("keeps the alpha of an effect whose background is faded out", async () => {
    stubWebCodecs(["avc1", "vp09"]);
    expect(await recordingPlan("sparkles")).toMatchObject({ format: "mp4", alpha: false });
    expect(await recordingPlan("sparkles", { values: { uBackgroundAlpha: 0 } })).toMatchObject({ format: "webm", alpha: true });
    expect(await recordingPlan("rainbow", { values: { uBackdropAlpha: 0 }, format: "gif" })).toMatchObject({ format: "gif", alpha: true });
  });

  it("names the formats that work when the browser cannot encode the one asked for", async () => {
    vi.stubGlobal("VideoEncoder", undefined);
    await expect(recordingPlan("aurora")).rejects.toThrow(/no WebCodecs VideoEncoder.*record "gif" or "png" instead/);
    await expect(recordingPlan("aurora", { format: "webm" })).rejects.toThrow(/cannot record webm/);
    expect(await recordingPlan("aurora", { format: "gif", width: 641 })).toMatchObject({ format: "gif", width: 641 });
    stubWebCodecs(["vp09"]);
    await expect(recordingPlan("aurora", { format: "mp4" })).rejects.toThrow(/cannot encode H.264 at 1280 × 720, so it cannot record mp4; record "webm", "gif" or "png" instead/);
    stubWebCodecs([]);
    await expect(recordingPlan("aurora")).rejects.toThrow(/cannot encode H.264, VP8 or VP9/);
  });

  it("rounds a video's size up to even numbers", async () => {
    stubWebCodecs(["avc1"]);
    expect(await recordingPlan("aurora", { width: 641, height: 361 })).toMatchObject({ width: 642, height: 362 });
  });

  it("explains options it cannot use", async () => {
    await expect(recordingPlan("nope", { format: "gif" })).rejects.toThrow(/no effect "nope"/);
    await expect(recordingPlan("image-duotone", { preset: "Nope", format: "gif" })).rejects.toThrow(/"image-duotone" has no preset "Nope"; it has/);
    await expect(recordingPlan("aurora", { fps: 0, format: "gif" })).rejects.toThrow(/fps must be a number above 0/);
    await expect(recordingPlan("aurora", { duration: -1, format: "gif" })).rejects.toThrow(/duration must be/);
    await expect(recordingPlan("aurora", { start: -1, format: "gif" })).rejects.toThrow(/start must be/);
    await expect(recordingPlan("aurora", { format: "avi" as never })).rejects.toThrow(/format is one of/);
  });
});

describe("recordEffect", () => {
  it("steps a shader frame by frame through the encoder into an mp4", async () => {
    const Encoder = stubWebCodecs(["avc1"]);
    const progress: number[] = [];
    const pointer = vi.fn((t: number) => ({ pointer: [t, 0, 1, 0] as [number, number, number, number] }));
    const blob = await recordEffect("aurora", { width: 64, height: 36, fps: 10, duration: 1, start: 0.5, pointer, onProgress: (f) => progress.push(f) });
    expect(blob.type).toBe("video/mp4");
    expect(rendered.map((r) => r.time)).toEqual(Array.from({ length: 10 }, (_, i) => 0.5 + i / 10));
    expect(rendered[3]!.options).toMatchObject({ frame: 3, delta: 0.1, pointer: [0.8, 0, 1, 0] });
    expect(pointer).toHaveBeenCalledTimes(10);
    expect(progress.at(-1)).toBe(1);
    expect(Encoder.configs.at(-1)).toMatchObject({ width: 64, height: 36, framerate: 10, bitrate: Math.round(64 * 36 * 10 * 0.15) });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const text = String.fromCharCode(...bytes.subarray(0, 64));
    expect(text).toContain("ftyp");
    expect(bytes.length).toBeGreaterThan(10 * 8);
  });

  it("encodes the alpha as a second stream for a transparent webm", async () => {
    const Encoder = stubWebCodecs(["vp09"]);
    const blob = await recordEffect("click-ripple", { width: 32, height: 16, fps: 5, duration: 1, pointer: { clicks: [{ x: 16, y: 8, time: 0.2 }] } });
    expect(blob.type).toBe("video/webm");
    expect(Encoder.configs).toHaveLength(2);
    expect(rendered[0]!.options).toMatchObject({ clicks: [{ x: 16, y: 8, time: 0.2 }] });
    // AlphaMode 1 (0x53C0, size 1, value 1) is in the track.
    const bytes = [...new Uint8Array(await blob.arrayBuffer())];
    expect(bytes.join(",")).toContain([0x53, 0xc0, 0x81, 0x01].join(","));
  });

  it("drives an audio-reactive shader from an audio buffer, frame for frame", async () => {
    // A kick at 0.5 s: half a second of silence, then a loud 60 Hz thump.
    const rate = 48000;
    const data = Float32Array.from({ length: rate * 1.2 }, (_, i) => (i > rate / 2 ? Math.sin((2 * Math.PI * 60 * i) / rate) * Math.exp(-(i - rate / 2) / 4000) : 0));
    const buffer = { sampleRate: rate, length: data.length, duration: 1.2, numberOfChannels: 1, getChannelData: () => data } as unknown as AudioBuffer;
    await recordEffect("spectrum-bars", { format: "gif", width: 16, height: 16, fps: 10, duration: 1, audio: buffer });
    const audio = rendered.map((r) => r.options.audio as { audio: number[]; beat: number });
    expect(audio).toHaveLength(10);
    expect(audio[2]!.audio[1]).toBe(0);
    expect(audio[2]!.beat).toBe(-1);
    expect(audio[6]!.audio[1]).toBeGreaterThan(0.3);
    expect(audio[7]!.beat).toBeGreaterThan(0);
    // Effects that don't hear sound are drawn without it.
    rendered.length = 0;
    await recordEffect("aurora", { format: "gif", width: 16, height: 16, fps: 10, duration: 0.2, audio: buffer });
    expect(rendered[0]!.options.audio).toBeUndefined();
  });

  it("plans a sound track: AAC in an mp4, Opus in a webm, falling back to webm, or refusing with a way out", async () => {
    const buffer = {} as AudioBuffer;
    stubWebCodecs(["avc1", "vp09"]);
    const encodes = (codecs: string[]) =>
      vi.stubGlobal("AudioEncoder", { isConfigSupported: async (c: AudioEncoderConfig) => ({ supported: codecs.some((x) => c.codec.startsWith(x)) }) });
    vi.stubGlobal("AudioData", class {});
    encodes(["mp4a", "opus"]);
    expect(await recordingPlan("spectrum-bars", { audio: buffer })).toMatchObject({ format: "mp4", audioEncoder: { codec: "mp4a.40.2", sampleRate: 48000, numberOfChannels: 2 } });
    expect(await recordingPlan("spectrum-bars", { audio: buffer, format: "webm" })).toMatchObject({ format: "webm", audioEncoder: { codec: "opus" } });
    encodes(["opus"]);
    expect(await recordingPlan("spectrum-bars", { audio: buffer })).toMatchObject({ format: "webm", encoder: { codec: "vp09.00.10.08" }, audioEncoder: { codec: "opus" } });
    await expect(recordingPlan("spectrum-bars", { audio: buffer, format: "mp4" })).rejects.toThrow(/cannot encode AAC audio.*record "webm" \(Opus\), or pass audioTrack: false/);
    expect((await recordingPlan("spectrum-bars", { audio: buffer, format: "mp4", audioTrack: false })).audioEncoder).toBeUndefined();
    expect((await recordingPlan("spectrum-bars", { audio: buffer, format: "gif" })).audioEncoder).toBeUndefined();
  });

  it("stops when aborted", async () => {
    stubWebCodecs(["avc1"]);
    const controller = new AbortController();
    controller.abort();
    await expect(recordEffect("aurora", { width: 16, height: 16, signal: controller.signal })).rejects.toThrow(/Cancelled/);
  });
});
