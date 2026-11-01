// gifenc ships without types. The reference (not an import) brings them along when a host
// type-checks these sources through the `workspace` condition.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../shader/gifenc.d.ts" />
import { CAMERA_PREVIEW_SOURCE, cameraPreviewLength, cameraPreviewValues } from "../catalog/camera.js";
import { drawsAlpha, effectDefaults, effectInputs, getEffect, SAMPLE_IMAGES, type EffectDefinition } from "../catalog/index.js";
import { renderVectorEffect, type ShaderEffect } from "../catalog/types.js";
import { muxMp4 } from "../export/mp4mux.js";
import { muxWebm, type WebmFrame } from "../export/webmmux.js";
import { checkShutter, FrameAverager, shutterTimes, type Shutter, type ShutterOptions } from "../export/shutter.js";
import { analyseAudioBuffer, type AudioBufferAnalysis } from "../shader/audio.js";
import { zipStore, type ZipEntry } from "../export/zip.js";
import { parseColor, type ControlValue } from "../shader/controls.js";
import { ShaderFrames, type RenderOptions } from "../shader/frames.js";
import { seekVideo, type LiveSource } from "../shader/textures.js";
import { svgDuration, svgView } from "../vector/svg.js";
import { subjectValues, type EffectSubject } from "./index.js";

/** What {@link recordEffect} makes: a video (`mp4`, `webm`), an animated `gif`, or `png` frames in a ZIP. */
export type RecordFormat = "mp4" | "webm" | "gif" | "png";

/** The pointer for one frame of a shader: `iPointer`, `iMouse`, and clicks and trail so far (times in seconds). */
export type RecordPointer = Pick<RenderOptions, "pointer" | "mouse" | "clicks" | "trail">;

/**
 * How {@link recordEffect} records. `shutterAngle` and `shutterSamples`
 * (from {@link ShutterOptions}) add motion blur: each frame averages
 * `shutterSamples` pictures drawn while the shutter is open, and the
 * pointer, sound, a `<video>` subject and `beforeFrame` are all taken at
 * each of those times.
 */
export interface RecordOptions extends ShutterOptions {
  /** What to apply the effect to (see {@link EffectSubject}); several fill several controls in order. */
  subject?: EffectSubject | readonly EffectSubject[];
  /** A preset by name, then these values, over the effect's defaults. */
  preset?: string;
  values?: Record<string, ControlValue>;
  /**
   * The file to make (default `mp4` where the browser encodes H.264, else
   * `webm`; `webm` when `alpha` is on).
   */
  format?: RecordFormat;
  /** Pixels (default 1280 × 720). Videos round them up to even numbers, as their encoders need. */
  width?: number;
  height?: number;
  /** Frames per second (default 30). GIF delays are whole hundredths of a second, so 10, 20, 25 and 50 play back exactly there. */
  fps?: number;
  /**
   * Seconds to record (default: a shader's `loop`, or a vector effect's
   * picture plus its `hold`, else 4).
   */
  duration?: number;
  /** The time of the first frame, in seconds (default 0). */
  start?: number;
  /** Bits per second for `mp4` and `webm` (default `width × height × fps × 0.15`). */
  bitrate?: number;
  /**
   * Keep transparency (default: whether the effect draws alpha, see
   * `drawsAlpha`: an overlay, or a background opacity below 1): `webm` (VP9
   * or VP8 with an alpha channel, which Chrome, Edge and Firefox play),
   * `png`, and `gif` (one see-through colour). `mp4` cannot, so it lays the
   * picture over `background` unless `alpha: true` was asked for. Without
   * it, transparent pixels are laid over `background`.
   */
  alpha?: boolean;
  /** A CSS colour under the picture when `alpha` is off (default black for shaders, white for vector effects). */
  background?: string;
  /**
   * The pointer, for shaders that answer it: the same every frame, or a
   * function of the frame's time in seconds. Without it, interactive
   * effects play their idle demos, as on a page nobody has touched.
   *
   * ```ts
   * pointer: { clicks: [{ x: 640, y: 360, time: 0.5 }] }
   * pointer: (t) => ({ pointer: [640 + 200 * Math.sin(t), 360, 1, 0] })
   * ```
   */
  pointer?: RecordPointer | ((time: number) => RecordPointer);
  /** A vector effect's step start times in ms, for pictures that change on steps (default none). */
  steps?: readonly number[];
  /**
   * Sound: a decoded `AudioBuffer`, or the URL of an audio file to fetch and
   * decode. An audio-reactive shader follows it frame for frame (each
   * frame's `iAudio`, `iSpectrum` and `iBeat` come from `analyseAudioBuffer`
   * at that frame's time, so the picture is the same on every machine), and
   * the stretch from `start` to `start + duration` is muxed into an `mp4`
   * (AAC) or `webm` (Opus) as its sound track, unless `audioTrack` is false.
   * `gif` and `png` have no sound, so there it only drives the picture.
   * Effects that don't hear sound just get the sound track.
   */
  audio?: AudioBuffer | string;
  /** Put `audio` in the video as its sound track (default true for `mp4` and `webm`). */
  audioTrack?: boolean;
  /**
   * Called before each frame is drawn, with its time in seconds: draw a
   * canvas subject for that time here. (A `<video>` subject is paused and
   * sought to each frame's time for you.)
   */
  beforeFrame?: (time: number, index: number) => void | Promise<void>;
  /** Called after each frame with the share done, 0–1. */
  onProgress?: (fraction: number) => void;

  /** Aborting rejects with an `AbortError` `DOMException`. */
  signal?: AbortSignal;
}

/** What a recording will be, worked out from the options before any frame is drawn (see {@link recordingPlan}). */
export interface RecordingPlan {
  effect: EffectDefinition;
  format: RecordFormat;
  width: number;
  height: number;
  fps: number;
  duration: number;
  start: number;
  frames: number;
  alpha: boolean;
  /** For `mp4` and `webm`: the encoder's settings. */
  encoder?: VideoEncoderConfig;
  /** For `mp4` and `webm` with `audio`: the sound's encoder settings (AAC or Opus, 48 kHz stereo). */
  audioEncoder?: AudioEncoderConfig;
  /** Motion blur, when `shutterAngle` is above 0: the angle and the sub-frames drawn for each frame. */
  shutter?: Shutter;
}

/** The rate sound tracks are encoded at (Opus only takes 48 kHz; AAC is happy with it). */
const AUDIO_RATE = 48000;

/** An AAC or Opus encoder config the browser takes, or undefined. */
async function audioConfig(format: "mp4" | "webm"): Promise<AudioEncoderConfig | undefined> {
  if (typeof AudioEncoder === "undefined" || typeof AudioData === "undefined") return undefined;
  const config: AudioEncoderConfig = { codec: format === "mp4" ? "mp4a.40.2" : "opus", sampleRate: AUDIO_RATE, numberOfChannels: 2, bitrate: 128_000 };
  try {
    return (await AudioEncoder.isConfigSupported(config)).supported ? config : undefined;
  } catch {
    return undefined;
  }
}

const DEFAULT_SECONDS = 4;

/** Lets the page repaint between frames so progress shows and Cancel works. */
const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const formats = (list: RecordFormat[]) => list.map((f) => `"${f}"`).join(", ").replace(/, ([^,]*)$/, " or $1");

/** H.264 levels by the most macroblocks a frame and a second may hold, for the codec string. */
const AVC_LEVELS: [level: number, frame: number, second: number][] = [
  [0x1f, 3600, 108000], // 3.1
  [0x28, 8192, 245760], // 4.0
  [0x2a, 8704, 522240], // 4.2
  [0x32, 22080, 589824], // 5.0
  [0x33, 36864, 983040], // 5.1
  [0x34, 36864, 2073600], // 5.2
  [0x3c, 139264, 4177920], // 6.0
];

/** H.264 codec strings to try, High profile first, at the lowest level that holds the picture. */
function avcCodecs(width: number, height: number, fps: number): string[] {
  const mbs = Math.ceil(width / 16) * Math.ceil(height / 16);
  const level = (AVC_LEVELS.find(([, f, s]) => mbs <= f && mbs * fps <= s) ?? AVC_LEVELS[AVC_LEVELS.length - 1]!)[0];
  const hex = level.toString(16).toUpperCase().padStart(2, "0");
  return ["avc1.6400", "avc1.4D00", "avc1.42E0"].map((p) => p + hex);
}

/** The first of `codecs` the browser encodes with these settings, as a config; undefined when none. */
async function supported(codecs: string[], base: Omit<VideoEncoderConfig, "codec">): Promise<VideoEncoderConfig | undefined> {
  for (const codec of codecs) {
    const config: VideoEncoderConfig = { ...base, codec };
    try {
      const answer = await VideoEncoder.isConfigSupported(config);
      if (answer.supported) return config;
    } catch {
      // A codec string the browser does not know: try the next.
    }
  }
  return undefined;
}

const hasWebCodecs = () => typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";

/** A video's encoder config, or undefined when the browser cannot encode it. */
async function videoConfig(format: "mp4" | "webm", width: number, height: number, fps: number, bitrate: number) {
  const base: Omit<VideoEncoderConfig, "codec"> = {
    width,
    height,
    bitrate,
    framerate: fps,
    latencyMode: "quality",
    ...(format === "mp4" ? { avc: { format: "avc" as const } } : {}),
  };
  return supported(format === "mp4" ? avcCodecs(width, height, fps) : ["vp09.00.10.08", "vp8"], base);
}

const resolveEffect = (effect: EffectDefinition | string) => {
  const def = typeof effect === "string" ? getEffect(effect) : effect;
  if (!def) throw new Error(`There is no effect "${String(effect)}" in the catalog; findEffects() lists them.`);
  return def;
};

/** A positive number option, or a sentence saying what it should be. */
function positive(name: string, value: number | undefined, fallback: number): number {
  const n = value ?? fallback;
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a number above 0 (it was ${String(value)}).`);
  return n;
}

const even = (n: number) => Math.max(2, Math.ceil(n / 2) * 2);

/**
 * What {@link recordEffect} would make of these options, without drawing a
 * frame: the format (after falling back where the browser cannot encode
 * one), size, length, frame count, whether it keeps transparency, and the
 * encoder settings. Rejects with a sentence when the effect is unknown, an
 * option is out of range, or the browser cannot make the format asked for.
 */
export async function recordingPlan(effect: EffectDefinition | string, options: RecordOptions = {}): Promise<RecordingPlan> {
  const def = resolveEffect(effect);
  if (options.preset && !def.presets?.some((p) => p.name === options.preset)) {
    const names = def.presets?.map((p) => `"${p.name}"`).join(", ");
    throw new Error(`"${def.id}" has no preset "${options.preset}"${names ? `; it has ${names}` : ""}.`);
  }
  const fps = positive("fps", options.fps, 30);
  const start = options.start ?? 0;
  if (!Number.isFinite(start) || start < 0) throw new Error(`start must be 0 or more seconds (it was ${String(options.start)}).`);
  const duration = positive("duration", options.duration, defaultDuration(def, options));
  const shutter = checkShutter(options);
  let width = Math.round(positive("width", options.width, 1280));
  let height = Math.round(positive("height", options.height, 720));
  const explicitAlpha = options.alpha === true;
  let alpha = options.alpha ?? drawsAlpha(def, effectDefaults(def, { ...(options.preset ? { preset: options.preset } : {}), ...(options.values ? { values: options.values } : {}) }));
  let format = options.format;
  if (format && !["mp4", "webm", "gif", "png"].includes(format)) throw new Error(`format is one of "mp4", "webm", "gif" or "png" (it was "${format}").`);
  if (format === "mp4" && alpha) {
    if (explicitAlpha) throw new Error(`An mp4 (H.264) cannot keep transparency; record ${formats(["webm", "png", "gif"])} to keep it, or pass alpha: false.`);
    alpha = false;
  }

  let encoder: VideoEncoderConfig | undefined;
  if (format !== "gif" && format !== "png") {
    if (!hasWebCodecs())
      throw new Error(`This browser cannot encode video (it has no WebCodecs VideoEncoder), so it cannot record ${format ?? "a video"}; record ${formats(["gif", "png"])} instead.`);
    const w = even(width);
    const h = even(height);
    const bitrate = Math.round(positive("bitrate", options.bitrate, w * h * fps * 0.15));
    const tryFormat = (f: "mp4" | "webm") => videoConfig(f, w, h, fps, bitrate);
    // Transparency needs webm; mp4 is the first choice otherwise, as it plays everywhere.
    const choices: ("mp4" | "webm")[] = format ? [format] : alpha ? ["webm"] : ["mp4", "webm"];
    for (const f of choices) {
      encoder = await tryFormat(f);
      if (encoder) {
        format = f;
        break;
      }
    }
    if (!encoder && !format && alpha && !explicitAlpha) {
      // Transparency was only the effect's default: an opaque mp4 will do.
      encoder = await tryFormat("mp4");
      if (encoder) {
        format = "mp4";
        alpha = false;
      }
    }
    if (!encoder) {
      const asked = format ?? (alpha ? "webm" : "mp4");
      const other = asked === "mp4" ? "webm" : "mp4";
      if (alpha && asked === "webm") throw new Error(`This browser cannot encode VP8 or VP9, so it cannot record a webm with transparency; record ${formats(["png", "gif"])} to keep it, or pass alpha: false.`);
      const otherWorks = format && (await tryFormat(other));
      const codec = asked === "mp4" ? "H.264" : "VP8 or VP9";
      throw new Error(
        format
          ? `This browser cannot encode ${codec} at ${w} × ${h}, so it cannot record ${asked}; record ${formats(otherWorks ? [other, "gif", "png"] : ["gif", "png"])} instead.`
          : `This browser cannot encode H.264, VP8 or VP9 at ${w} × ${h}; record ${formats(["gif", "png"])} instead.`,
      );
    }
    width = w;
    height = h;
  }
  let audioEncoder: AudioEncoderConfig | undefined;
  if (options.audio !== undefined && options.audioTrack !== false && (format === "mp4" || format === "webm")) {
    audioEncoder = await audioConfig(format);
    if (!audioEncoder && format === "mp4" && !options.format) {
      // No AAC here: a webm (Opus) keeps the sound.
      const webm = await videoConfig("webm", width, height, fps, encoder!.bitrate ?? Math.round(width * height * fps * 0.15));
      const opus = webm && (await audioConfig("webm"));
      if (webm && opus) {
        format = "webm";
        encoder = webm;
        audioEncoder = opus;
      }
    }
    if (!audioEncoder) {
      const codec = format === "mp4" ? "AAC" : "Opus";
      throw new Error(`This browser cannot encode ${codec} audio, so it cannot put the sound in ${format === "mp4" ? "an mp4" : "a webm"}; ${format === "mp4" ? 'record "webm" (Opus), or ' : ""}pass audioTrack: false to record the picture alone (the sound still drives it).`);
    }
  }
  return { effect: def, format: format!, width, height, fps, duration, start, frames: Math.max(1, Math.round(duration * fps)), alpha, ...(shutter ? { shutter } : {}), ...(encoder ? { encoder } : {}), ...(audioEncoder ? { audioEncoder } : {}) };
}

/** A shader's loop, a vector effect's picture plus its hold, or one loop of a camera move's preview, else 4 seconds. */
function defaultDuration(def: EffectDefinition, options: RecordOptions): number {
  if (def.kind === "shader") return def.loop ?? DEFAULT_SECONDS;
  if (def.kind === "camera") return cameraPreviewLength(def) / 1000;
  const motion = renderVectorEffect(def, effectValues(def, options).values);
  return (svgDuration(motion, options.steps ?? []) + (def.hold ?? 600)) / 1000;
}

function effectValues(def: EffectDefinition, options: RecordOptions) {
  const values = effectDefaults(def, { ...(options.preset ? { preset: options.preset } : {}), ...(options.values ? { values: options.values } : {}) });
  if (!options.subject) return { values, live: {} as Record<string, LiveSource> };
  const s = subjectValues(def, options.subject);
  return { values: { ...values, ...s.values }, live: s.live };
}

/** RGBA bytes of one frame. */
type Pixels = Uint8ClampedArray<ArrayBuffer>;

/** Draws frames as straight (not premultiplied) RGBA, rows top down. */
interface FrameSource {
  frame(time: number, index: number, out: Pixels): Promise<void>;
  dispose(): void;
}

function shaderSource(plan: RecordingPlan, values: Record<string, ControlValue>, live: Record<string, LiveSource>, options: RecordOptions, sound?: AudioBufferAnalysis): FrameSource {
  const def = plan.effect as Extract<EffectDefinition, { kind: "shader" | "camera" }>;
  // A camera move previews on its picture through the preview shader, its view worked out for each frame.
  const camera = def.kind === "camera" ? def : undefined;
  const base = camera ? { uImage: typeof values.uImage === "string" && values.uImage ? values.uImage : SAMPLE_IMAGES.landscape } : values;
  const viewAt = (time: number) => (camera ? cameraPreviewValues(camera, values, time * 1000, plan.width / plan.height) : {});
  // An effect that draws alpha is drawn with it even when it is not kept, to be laid over the background.
  const frames = new ShaderFrames({
    source: camera ? CAMERA_PREVIEW_SOURCE : (def as ShaderEffect).source,
    values: { ...base, ...viewAt(plan.start) },
    width: plan.width,
    height: plan.height,
    alpha: plan.alpha || drawsAlpha(def, values),
  });
  const videos: { video: HTMLVideoElement; time: number; paused: boolean }[] = [];
  for (const [name, source] of Object.entries(live)) {
    frames.setLiveSource(name, source);
    if (typeof HTMLVideoElement !== "undefined" && source instanceof HTMLVideoElement) {
      videos.push({ video: source, time: source.currentTime, paused: source.paused });
      source.pause();
    }
  }
  const script = options.pointer;
  return {
    async frame(time, index, out) {
      for (const { video } of videos) await seekVideo(video, time);
      await options.beforeFrame?.(time, index);
      await frames.ready();
      const pointer = typeof script === "function" ? script(time) : script;
      if (camera) frames.setValues({ ...base, ...viewAt(time) });
      frames.render(time, { frame: index, delta: 1 / plan.fps, ...pointer, ...(sound ? { audio: sound.at(time) } : {}) });
      frames.readPixels(out);
    },
    dispose() {
      frames.dispose();
      for (const { video, time, paused } of videos) {
        video.currentTime = time;
        if (!paused) void video.play().catch(() => undefined);
      }
    },
  };
}

function vectorSource(plan: RecordingPlan, values: Record<string, ControlValue>, options: RecordOptions): FrameSource {
  const def = plan.effect as Extract<EffectDefinition, { kind: "vector" }>;
  const view = svgView(renderVectorEffect(def, values));
  // In the page (out of sight) so its fonts, sizes and colours resolve as they would on screen.
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:-100000px;top:0;width:${plan.width}px;height:${plan.height}px;pointer-events:none;`;
  host.appendChild(view.element);
  document.body.appendChild(host);
  const steps = options.steps ?? [];
  return {
    async frame(time, index, out) {
      await options.beforeFrame?.(time, index);
      view.draw(time * 1000, steps);
      const canvas = await view.capture({ width: plan.width, height: plan.height });
      if (!canvas) throw new Error(`"${def.id}" has no picture to record: its SVG does not parse.`);
      out.set(canvas.getContext("2d")!.getImageData(0, 0, plan.width, plan.height).data);
    },
    dispose: () => host.remove(),
  };
}

/**
 * Motion blur: each frame is the average (in premultiplied alpha) of the
 * shutter's sub-frames, each drawn by `source` at its own time.
 */
function shutterSource(source: FrameSource, plan: RecordingPlan, shutter: Shutter): FrameSource {
  const average = new FrameAverager(plan.width * plan.height);
  const sub: Pixels = new Uint8ClampedArray(plan.width * plan.height * 4);
  return {
    async frame(time, index, out) {
      for (const t of shutterTimes(time, plan.fps, shutter)) {
        await source.frame(t, index, sub);
        average.add(sub);
      }
      average.result(out);
    },
    dispose: () => source.dispose(),
  };
}

/** Lays straight-alpha pixels over an opaque colour, in place. */
function flatten(rgba: Pixels, background: [number, number, number]) {
  const [br, bg, bb] = background;
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3]!;
    if (a === 255) continue;
    const k = a / 255;
    rgba[i] = rgba[i]! * k + br * (1 - k);
    rgba[i + 1] = rgba[i + 1]! * k + bg * (1 - k);
    rgba[i + 2] = rgba[i + 2]! * k + bb * (1 - k);
    rgba[i + 3] = 255;
  }
}

/** Turns frames into a file, one at a time. */
interface Encoder {
  add(rgba: Pixels, index: number): Promise<void>;
  finish(): Promise<Blob>;
  close(): void;
}

async function gifEncoder(plan: RecordingPlan): Promise<Encoder> {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const gif = GIFEncoder();
  const delay = 1000 / plan.fps;
  return {
    async add(rgba, i) {
      const repeat = i === 0 ? { repeat: 0 } : {};
      if (!plan.alpha) {
        const palette = quantize(rgba, 256);
        gif.writeFrame(applyPalette(rgba, palette), plan.width, plan.height, { palette, delay, ...repeat });
        return;
      }
      // One colour is see-through: pixels at most half covered. Each frame replaces the last (dispose 2).
      const palette = quantize(rgba, 256, { format: "rgba4444", oneBitAlpha: true });
      const transparentIndex = palette.findIndex((c) => c[3] === 0);
      gif.writeFrame(applyPalette(rgba, palette, "rgba4444"), plan.width, plan.height, {
        palette,
        delay,
        dispose: 2,
        ...(transparentIndex >= 0 ? { transparent: true, transparentIndex } : {}),
        ...repeat,
      });
    },
    async finish() {
      gif.finish();
      return new Blob([gif.bytes()], { type: "image/gif" });
    },
    close() {},
  };
}

function pngEncoder(plan: RecordingPlan): Encoder {
  const canvas = document.createElement("canvas");
  canvas.width = plan.width;
  canvas.height = plan.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot draw on a canvas, so it cannot make PNG frames.");
  const entries: ZipEntry[] = [];
  const digits = Math.max(4, String(plan.frames).length);
  return {
    async add(rgba, i) {
      context.putImageData(new ImageData(rgba, plan.width, plan.height), 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("The browser could not encode a PNG frame.");
      entries.push({ name: `frame-${String(i + 1).padStart(digits, "0")}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
    },
    async finish() {
      return new Blob([zipStore(entries) as Uint8Array<ArrayBuffer>], { type: "application/zip" });
    },
    close() {},
  };
}

const bytesOf = (source: AllowSharedBufferSource) =>
  source instanceof ArrayBuffer || (typeof SharedArrayBuffer !== "undefined" && source instanceof SharedArrayBuffer)
    ? new Uint8Array(source.slice(0))
    : new Uint8Array((source as ArrayBufferView).buffer.slice((source as ArrayBufferView).byteOffset, (source as ArrayBufferView).byteOffset + (source as ArrayBufferView).byteLength));

/** A WebCodecs encoder whose chunks are collected, with the first decoder description it gives. */
function collector(config: VideoEncoderConfig, fail: (e: Error) => void) {
  const chunks: { data: Uint8Array; timestamp: number; duration?: number; key: boolean }[] = [];
  const out = { chunks, description: undefined as Uint8Array | undefined, encoder: undefined as unknown as VideoEncoder };
  out.encoder = new VideoEncoder({
    output(chunk, metadata) {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      const desc = metadata?.decoderConfig?.description;
      if (desc && !out.description) out.description = bytesOf(desc);
      chunks.push({ data, timestamp: chunk.timestamp, ...(chunk.duration ? { duration: chunk.duration } : {}), key: chunk.type === "key" });
    },
    error: (e) => fail(new Error(`The video encoder failed: ${e.message}`, { cause: e })),
  });
  out.encoder.configure(config);
  return out;
}

/** Fetches and decodes an audio file at {@link AUDIO_RATE}. */
async function decodeAudio(url: string): Promise<AudioBuffer> {
  if (typeof OfflineAudioContext === "undefined") throw new Error("This browser has no Web Audio (OfflineAudioContext), so it cannot decode the audio.");
  let bytes: ArrayBuffer;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    bytes = await response.arrayBuffer();
  } catch (e) {
    throw new Error(`The audio at ${url} could not be loaded (${(e as Error).message}); a file from another site needs CORS.`, { cause: e });
  }
  try {
    return await new OfflineAudioContext(2, 1, AUDIO_RATE).decodeAudioData(bytes);
  } catch (e) {
    throw new Error(`The audio at ${url} could not be decoded; give it an mp3, AAC, Ogg, Opus, FLAC or WAV file the browser plays.`, { cause: e });
  }
}

/** Encoded sound, ready to mux. */
interface EncodedSound {
  codec: "aac" | "opus";
  sampleRate: number;
  channels: number;
  description?: Uint8Array;
  chunks: { data: Uint8Array; timestamp: number; duration?: number; key: boolean }[];
}

/**
 * The stretch of `buffer` a recording covers, at 48 kHz stereo (rendered by
 * an `OfflineAudioContext`, which resamples and mixes), encoded with
 * WebCodecs.
 */
async function encodeSound(buffer: AudioBuffer, plan: RecordingPlan): Promise<EncodedSound> {
  const config = plan.audioEncoder!;
  const channels = config.numberOfChannels;
  const length = Math.max(1, Math.round(plan.duration * AUDIO_RATE));
  const offline = new OfflineAudioContext(channels, length, AUDIO_RATE);
  const node = offline.createBufferSource();
  node.buffer = buffer;
  node.connect(offline.destination);
  node.start(0, Math.min(plan.start, buffer.duration));
  const rendered = await offline.startRendering();
  const out: EncodedSound = { codec: config.codec === "opus" ? "opus" : "aac", sampleRate: AUDIO_RATE, channels, chunks: [] };
  let failure: Error | undefined;
  const encoder = new AudioEncoder({
    output(chunk, metadata) {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      const desc = metadata?.decoderConfig?.description;
      if (desc && !out.description) out.description = bytesOf(desc);
      out.chunks.push({ data, timestamp: chunk.timestamp, ...(chunk.duration ? { duration: chunk.duration } : {}), key: true });
    },
    error: (e) => (failure ??= new Error(`The audio encoder failed: ${e.message}`, { cause: e })),
  });
  encoder.configure(config);
  const block = 4800;
  for (let at = 0; at < length; at += block) {
    const n = Math.min(block, length - at);
    const planes = new Float32Array(n * channels);
    for (let c = 0; c < channels; c++) planes.set(rendered.getChannelData(c).subarray(at, at + n), c * n);
    const data = new AudioData({ format: "f32-planar", sampleRate: AUDIO_RATE, numberOfFrames: n, numberOfChannels: channels, timestamp: Math.round((at * 1e6) / AUDIO_RATE), data: planes });
    try {
      encoder.encode(data);
    } finally {
      data.close();
    }
  }
  await encoder.flush();
  encoder.close();
  if (failure) throw failure;
  out.chunks.sort((a, b) => a.timestamp - b.timestamp);
  return out;
}

/**
 * Encodes with WebCodecs and muxes into mp4 or webm. With `alpha`, a second
 * encoder (same codec) takes the alpha as a greyscale picture, and each
 * frame's alpha goes beside it in the webm, as Chrome's own recordings do:
 * browsers' encoders do not keep alpha themselves.
 */
function videoEncoder(plan: RecordingPlan, sound?: Promise<EncodedSound>): Encoder {
  const config = plan.encoder!;
  let failure: Error | undefined;
  const fail = (e: Error) => (failure ??= e);
  const color = collector(config, fail);
  const alpha = plan.alpha ? collector(config, fail) : undefined;
  const encoders = [color.encoder, ...(alpha ? [alpha.encoder] : [])];
  const frameUs = 1e6 / plan.fps;
  // A keyframe every two seconds, so players can seek.
  const keyEvery = Math.max(1, Math.round(plan.fps * 2));
  const { width, height } = plan;
  // I420: the alpha as luma, with neutral chroma.
  const plane = alpha ? new Uint8Array(width * height * 1.5).fill(128) : undefined;
  const check = () => {
    if (failure) throw failure;
  };
  const encode = (encoder: VideoEncoder, frame: VideoFrame, key: boolean) => {
    try {
      encoder.encode(frame, { keyFrame: key });
    } finally {
      frame.close();
    }
  };
  return {
    async add(rgba, i) {
      check();
      const timing = { codedWidth: width, codedHeight: height, timestamp: Math.round(i * frameUs), duration: Math.round(frameUs) };
      const key = i % keyEvery === 0;
      encode(color.encoder, new VideoFrame(rgba, { format: "RGBX", ...timing }), key);
      if (alpha && plane) {
        for (let p = 0, q = 3; p < width * height; p++, q += 4) plane[p] = rgba[q]!;
        encode(alpha.encoder, new VideoFrame(plane, { format: "I420", ...timing }), key);
      }
      // Hold back while an encoder is behind, so frames don't pile up in memory.
      while (encoders.some((e) => e.encodeQueueSize > 4) && !failure) await new Promise((resolve) => setTimeout(resolve, 1));
    },
    async finish() {
      await Promise.all(encoders.map((e) => e.flush()));
      check();
      for (const e of encoders) e.close();
      const byTime = (a: { timestamp: number }, b: { timestamp: number }) => a.timestamp - b.timestamp;
      const chunks = color.chunks.sort(byTime);
      const audio = await sound;
      if (plan.format === "mp4") {
        if (!color.description) throw new Error("The H.264 encoder gave no decoder configuration (avcC), so the mp4 cannot be written.");
        const file = muxMp4({
          width,
          height,
          avcC: color.description,
          samples: chunks,
          ...(audio ? { audio: { sampleRate: audio.sampleRate, channels: audio.channels, ...(audio.description ? { config: audio.description } : {}), samples: audio.chunks } } : {}),
        });
        return new Blob([file as Uint8Array<ArrayBuffer>], { type: "video/mp4" });
      }
      const alphas = new Map(alpha?.chunks.map((c) => [c.timestamp, c.data]));
      const frames: WebmFrame[] = chunks.map((c) => {
        const a = alphas.get(c.timestamp);
        if (alpha && !a) throw new Error(`The alpha encoder dropped the frame at ${c.timestamp / 1e6} s, so the webm cannot keep transparency; record "png" or "gif" instead.`);
        return { ...c, ...(a ? { alpha: a } : {}) };
      });
      const codec = config.codec.startsWith("vp8") ? "vp8" : "vp9";
      const file = muxWebm({
        codec,
        width,
        height,
        frames,
        duration: plan.frames * frameUs,
        fps: plan.fps,
        ...(audio ? { audio: { sampleRate: audio.sampleRate, channels: audio.channels, ...(audio.description ? { codecPrivate: audio.description } : {}), packets: audio.chunks } } : {}),
      });
      return new Blob([file as Uint8Array<ArrayBuffer>], { type: "video/webm" });
    },
    close() {
      for (const e of encoders) if (e.state !== "closed") e.close();
    },
  };
}

/**
 * Records a catalog effect (by id or definition), applied to `subject`, to a
 * file in the browser: an `mp4` or `webm` video (WebCodecs, muxed here with
 * no dependencies), an animated `gif`, or `png` frames.
 *
 * Frames are drawn off screen at exact times (`start + i / fps`), so the
 * result is smooth whatever the page's frame rate, and the same on every
 * machine. Shaders render with `ShaderFrames` (a `<video>` subject is paused
 * and sought to each frame, and put back after); vector effects are drawn
 * with `svgView` and rasterised. Shaders that answer the pointer play their
 * idle demos unless `pointer` scripts it. With `audio`, audio-reactive
 * shaders follow the sound frame for frame, and videos carry it as their
 * sound track. With `shutterAngle`, each frame is motion-blurred: the
 * average of `shutterSamples` pictures drawn while the shutter is open.
 *
 * `png` resolves to a ZIP of numbered frames (`frame-0001.png`, …), so every
 * format is one `Blob` to save or upload.
 *
 * Rejects with a sentence when the effect is unknown, takes no such
 * subject, or the browser cannot make the format (naming the formats that
 * would work); with a `ShaderCompileError` or `ImageLoadError` as
 * `ShaderFrames` does; and with an `AbortError` when `signal` aborts.
 *
 * ```ts
 * const mp4 = await recordEffect("image-duotone", { subject: { image: "/team.jpg" }, preset: "Spotify" });
 * const gif = await recordEffect("typewriter", { subject: { text: "Hello" }, format: "gif", width: 640, height: 360, fps: 25 });
 * const webm = await recordEffect("click-ripple", { format: "webm", alpha: true, pointer: { clicks: [{ x: 640, y: 360, time: 0.2 }] } });
 * const music = await recordEffect("spectrum-bars", { audio: "/song.mp3", duration: 10 });
 * const blurred = await recordEffect("neon-warp", { shutterAngle: 180 });
 * ```
 */
export async function recordEffect(effect: EffectDefinition | string, options: RecordOptions = {}): Promise<Blob> {
  const plan = await recordingPlan(effect, options);
  const { signal, onProgress } = options;
  const { values, live } = effectValues(plan.effect, options);
  const background = (parseColor(options.background ?? (plan.effect.kind !== "vector" ? "#000000" : "#ffffff")) ?? [0, 0, 0]).map((c) => Math.round(c * 255)) as [number, number, number];

  const buffer = options.audio === undefined ? undefined : typeof options.audio === "string" ? await decodeAudio(options.audio) : options.audio;
  const sound = buffer && plan.effect.kind === "shader" && effectInputs(plan.effect).accepts.includes("audio") ? analyseAudioBuffer(buffer) : undefined;
  // The sound track encodes alongside the frames.
  const track = buffer && plan.audioEncoder ? encodeSound(buffer, plan) : undefined;
  track?.catch(() => undefined);
  const drawn = plan.effect.kind !== "vector" ? shaderSource(plan, values, live, options, sound) : vectorSource(plan, values, options);
  const source = plan.shutter ? shutterSource(drawn, plan, plan.shutter) : drawn;
  let encoder: Encoder | undefined;
  try {
    encoder = plan.format === "gif" ? await gifEncoder(plan) : plan.format === "png" ? pngEncoder(plan) : videoEncoder(plan, track);
    const rgba = new Uint8ClampedArray(plan.width * plan.height * 4);
    for (let i = 0; i < plan.frames; i++) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      await source.frame(plan.start + i / plan.fps, i, rgba);
      if (!plan.alpha) flatten(rgba, background);
      await encoder.add(rgba, i);
      onProgress?.((i + 1) / plan.frames);
      if (i % 2 === 1) await yieldToBrowser();
    }
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    return await encoder.finish();
  } finally {
    encoder?.close();
    source.dispose();
  }
}
