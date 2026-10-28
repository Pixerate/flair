/**
 * Renders a catalog effect, applied to a subject, to a file in Node: video
 * (MP4, WebM, MOV), GIF, PNG frames, or (vector effects) an animated SVG.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  EFFECT_CATEGORIES,
  EFFECT_INPUTS,
  EFFECT_INTERACTIONS,
  effectControls,
  effectDefaults,
  effectInputs,
  effectTags,
  getEffect,
  drawsAlpha,
  normaliseTag,
  renderVectorEffect,
  sanitizeEffectValues,
  type EffectCategory,
  type EffectDefinition,
  type EffectInput,
  type EffectInteraction,
  type VectorEffect,
} from '../catalog/index.js';
import { subjectValues, type EffectSubject } from '../embed/index.js';
import { didYouMean } from '../motion/params.js';
import { checkControlValue, parseColor, type ControlDef, type ControlValue } from '../shader/controls.js';
import { wrapSource } from '../shader/program.js';
import { svgAnimatedMarkup } from '../vector/animated.js';
import { changeLength, type SvgMotion } from '../vector/motion.js';
import { svgFrameMarkup, svgViewBox } from '../vector/static.js';
import { svgDuration } from '../vector/svg.js';
import {
  BACKDROP_FITS,
  ffmpegPath,
  findChrome,
  frameStates,
  imageDataUrl,
  pageControls,
  planOutput,
  runRender,
  type BackdropFit,
  type FrameState,
  type OutputFormat,
  type PageConfig,
  type PointerMode,
} from './recorder.js';
import { checkShutter, type ShutterOptions } from './shutter.js';

/**
 * What an effect is applied to, in Node:
 * - `{ image }`: a picture's file path or URL (or a `data:` URL).
 * - `{ svg }`: an SVG's file path, URL, or markup (`"<svg …>"`).
 * - `{ text }`: words, for a vector effect's text, or drawn with `textImage` for a shader's text or mask.
 * - `{ path }`: SVG path data (`d`), for a shape control.
 * - `{ video }`: a video file's path, decoded to frames with ffmpeg and shown one per frame.
 */
export type NodeSubject =
  | { image: string }
  | { svg: string }
  | { text: string; font?: string; weight?: number | string }
  | { path: string }
  | { video: string };

/**
 * Part of the frame, normalized 0 to 1 from the top left: x, y, width,
 * height. `[0.5, 0, 0.5, 1]` is the right half.
 */
export type EffectRegion = readonly [x: number, y: number, width: number, height: number];

/**
 * How {@link exportEffect} renders. `shutterAngle` and `shutterSamples`
 * (from {@link ShutterOptions}) add motion blur to video, GIF and PNG
 * output: each frame averages `shutterSamples` renders across the time the
 * shutter is open, the scripted pointer, a vector's timeline and a video
 * subject's frame taken at each.
 */
export interface EffectExportOptions extends ShutterOptions {
  /** What to apply it to; several fill several controls in order (a transition's from and to). */
  subject?: NodeSubject | readonly NodeSubject[];
  /** A preset by name, under `values`. */
  preset?: string;
  /** Control values over the defaults (and the subject). An image control also takes a file path. */
  values?: Record<string, ControlValue>;
  /** .mp4, .webm, .mov, .gif, .svg (vector effects), or PNG frames (a folder, or `out_%04d.png`). */
  outputPath: string;
  /**
   * Pixels (default: the backdrop's own size when there is one, else the input video's size if a video
   * subject is provided, 1280 × 720 for effects that show a picture, 720 × 720 for other shaders, a
   * vector's own shape 720 px on its long edge). Given only `width`, the height keeps that shape.
   */
  width?: number;
  height?: number;
  fps?: number;
  /**
   * Seconds. Default: a video subject's duration, a shader's loop (when it loops in 12 s or less),
   * else 3; a vector effect's one play-through (with its trigger acted out).
   */
  duration?: number;
  /** Keep transparency (WebM, MOV, GIF, PNG and SVG; MP4 is always opaque). */
  alpha?: boolean;
  /** CSS colour under transparent pixels without `alpha` (default black for shaders, white for vector effects). */
  background?: string;
  /**
   * A picture drawn under the effect in every frame instead of the flat
   * `background`: a file path, an `http(s):` URL, or a `data:` URL. For
   * overlays that take no picture of their own (sparkles, bokeh, confetti),
   * so the render shows them over a photo. The frame defaults to the
   * backdrop's own size. Refused with `alpha` (the backdrop fills the
   * frame), with `.svg` output, and for a shader that draws every pixel
   * itself (give the picture to an image effect as its `subject` instead).
   */
  backdrop?: string;
  /** How the backdrop fills the frame: `cover` (the default) crops to fill, `contain` fits it whole over `background`, `fill` stretches it. */
  backdropFit?: BackdropFit;
  /**
   * Confines the effect to part of the frame, normalized 0 to 1: `[x, y,
   * width, height]` from the top left. The effect renders at that box's
   * size (so it is not stretched) and the rest of the frame is the backdrop
   * or `background` (or transparent, with `alpha`). Default: the whole frame.
   */
  region?: EffectRegion;
  /**
   * The pointer, for effects that answer it: `auto` (the default for them),
   * a scripted pointer that hovers, wanders and clicks; `none` leaves it
   * still. Vector effects with a trigger have it acted out (clicked through
   * their steps, or hovered and let go).
   */
  pointer?: PointerMode;
  /**
   * How to handle audio when exporting video (MP4, WebM, MOV):
   * - `true` or `'copy'` (default when subject has audio): pass through the audio stream from the video subject.
   * - `false` or `'mute'`: do not include audio.
   * - A file path or URL to an audio or video file to mux as the soundtrack.
   */
  audio?: boolean | 'copy' | 'mute' | string;
  /** Extra flags to pass to headless Chrome. */
  chromeFlags?: string[];
  /** Draw with SwiftShader, Chrome's software GL, everywhere: the same frames on every machine (see `ExportOptions.software`). */
  software?: boolean;
  /** Timeout in ms waiting for headless Chrome to render a frame before failing (default 180000). */
  stallTimeoutMs?: number;
  /** When true, ignores control values not present on the effect definition instead of throwing. */
  ignoreUnknownControls?: boolean;
  onProgress?: (frame: number, total: number) => void;
}

const isUrl = (s: string) => /^(https?|data):/i.test(s);

/** An SVG subject as markup: given markup stays, a URL is fetched, a path read. */
async function svgMarkup(svg: string): Promise<string> {
  const text = svg.trim();
  if (text.startsWith('<')) return text;
  if (/^data:image\/svg\+xml/i.test(text)) {
    const comma = text.indexOf(',');
    const meta = text.slice(0, comma);
    const body = text.slice(comma + 1);
    return /;base64/i.test(meta) ? Buffer.from(body, 'base64').toString('utf8') : decodeURIComponent(body);
  }
  if (/^https?:/i.test(text)) {
    const res = await fetch(text);
    if (!res.ok) throw new Error(`Could not download the SVG at ${text} (HTTP ${res.status}).`);
    return res.text();
  }
  const file = path.resolve(text);
  if (!fs.existsSync(file)) throw new Error(`There is no SVG at ${file}; give a file path, a URL, or markup starting with "<svg".`);
  return fs.readFileSync(file, 'utf8');
}

/** What a Node subject becomes: control values, and video files by image control. */
export interface NodeSubjectValues {
  values: Record<string, ControlValue>;
  /** Image control → video file. */
  video: Record<string, string>;
}

/**
 * The control values that put Node subjects in `effect` (see
 * `subjectValues` in `@pixerate/flair/embed`, which picks the controls):
 * image files and URLs become `data:` URLs, SVG files and URLs are read as
 * markup, and a video is kept as its file for its control, to be decoded to
 * frames. Throws a sentence when the effect takes no such thing.
 */
export async function nodeSubjectValues(effect: EffectDefinition, subject: NodeSubject | readonly NodeSubject[]): Promise<NodeSubjectValues> {
  const list = (Array.isArray(subject) ? subject : [subject]) as readonly NodeSubject[];
  const browser: EffectSubject[] = [];
  const videoFiles: string[] = [];
  for (const s of list) {
    if ('image' in s) browser.push({ image: await imageDataUrl(s.image) });
    else if ('svg' in s) browser.push({ svg: await svgMarkup(s.svg) });
    else if ('video' in s) {
      const file = path.resolve(s.video);
      if (!isUrl(s.video) && !fs.existsSync(file)) throw new Error(`There is no video at ${file}.`);
      videoFiles.push(isUrl(s.video) ? s.video : file);
      // A stand-in: subjectValues only needs to know it is a video to pick its control.
      browser.push({ video: { readyState: 0, currentTime: 0 } as unknown as HTMLVideoElement });
    } else browser.push(s);
  }
  const { values, live } = subjectValues(effect, browser);
  const video: Record<string, string> = {};
  Object.keys(live).forEach((name, i) => (video[name] = videoFiles[i]!));
  return { values, video };
}

/** The effect for an id (or the definition itself); a sentence when there is none. */
export function resolveEffect(effect: string | EffectDefinition): EffectDefinition {
  if (typeof effect !== 'string') return effect;
  const def = getEffect(effect);
  if (!def) throw new Error(`There is no effect "${effect}" in the catalog; "flair effects" (or findEffects()) lists them.`);
  return def;
}

/**
 * Checks control values against an effect's controls: unknown names, and
 * values a control cannot take, are sentences. Image controls take file
 * paths too (read into `data:` URLs).
 */
export async function checkEffectValues(
  effect: EffectDefinition,
  values: Record<string, ControlValue>,
  options: { ignoreUnknownControls?: boolean } = {},
): Promise<Record<string, ControlValue>> {
  const controls = new Map(effectControls(effect).map((c) => [c.name, c]));
  const out: Record<string, ControlValue> = {};
  for (const [name, raw] of Object.entries(values)) {
    const control = controls.get(name);
    if (!control) {
      if (options.ignoreUnknownControls) continue;
      throw new Error(`"${effect.id}" has no control "${name}"; it has ${[...controls.keys()].join(', ') || 'none'}.`);
    }
    if (control.type === 'sampler2D' && typeof raw === 'string') {
      out[name] = await imageDataUrl(raw);
      continue;
    }
    if (effect.kind === 'vector' && control.color && typeof raw === 'string' && raw.trim().toLowerCase() === 'currentcolor') {
      out[name] = raw;
      continue;
    }
    const check = checkControlValue(control, raw);
    if (!check.ok) throw new Error(check.message);
    out[name] = check.value;
  }
  return out;
}

/** How a vector effect plays over time in a recording: the frame at each ms, and its loop. */
export interface VectorTimeline {
  /** One play-through, ms. */
  length: number;
  /** Step start times (ms) for the whole loop, for an animated SVG. */
  steps: number[];
  /** The picture's time and steps at `ms` into the recording. */
  at(ms: number): { time: number; steps: number[] };
}

/** Ms an effect rests before its trigger is acted out. */
const REST = 300;

/**
 * A vector effect's timeline: a loop plays and rests `hold` ms; a hover, press or
 * scroll trigger plays to the end, rests, and plays back (a scroll down and up); a click trigger is
 * clicked through each of its steps (or, with none, clicked again after
 * each play-through).
 */
export function vectorTimeline(effect: Pick<VectorEffect, 'hold' | 'trigger'>, motion: SvgMotion): VectorTimeline {
  const hold = effect.hold ?? 600;
  const d = svgDuration(motion);
  if (effect.trigger === 'hover' || effect.trigger === 'press' || effect.trigger === 'scroll') {
    const length = REST + d + hold + d;
    return {
      length,
      steps: [],
      at(ms) {
        const p = ms % length;
        const time = p < REST ? 0 : p < REST + d ? p - REST : p < REST + d + hold ? d : Math.max(0, d - (p - REST - d - hold));
        return { time, steps: [] };
      },
    };
  }
  if (effect.trigger === 'click') {
    const anims = motion.animate ?? [];
    const last = anims.reduce((n, a) => Math.max(n, a.step ?? 0), 0);
    if (last === 0) {
      const length = REST + d + hold;
      return { length, steps: [], at: (ms) => ({ time: Math.max(0, (ms % length) - REST), steps: [] }) };
    }
    // One click per step, each when the step before has played and rested.
    const clicks: number[] = [];
    let at = REST;
    for (let step = 1; step <= last; step++) {
      clicks.push(at);
      const ends = anims.filter((a) => (a.step ?? 0) === step).map((a) => (a.delay ?? 0) + changeLength(a));
      at += Math.max(0, ...ends) + hold;
    }
    const length = at;
    return {
      length,
      steps: clicks,
      at(ms) {
        const p = ms % length;
        return { time: p, steps: clicks.filter((c) => c <= p) };
      },
    };
  }
  const length = d + hold;
  return { length, steps: [], at: (ms) => ({ time: ms % length, steps: [] }) };
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** Default pixel size for an effect (see {@link EffectExportOptions.width}). */
export function defaultSize(effect: EffectDefinition, motion?: SvgMotion): { width: number; height: number } {
  if (effect.kind === 'vector') {
    const box = svgViewBox((motion ?? effect.motion).svg);
    const aspect = box && box[2] > 0 && box[3] > 0 ? box[2] / box[3] : 1;
    return aspect >= 1 ? { width: 720, height: even(720 / aspect) } : { width: even(720 * aspect), height: 720 };
  }
  return effectInputs(effect).images.length ? { width: 1280, height: 720 } : { width: 720, height: 720 };
}

function run(bin: string, args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr!.on('data', (d) => (stderr += d.toString()));
    proc.on('error', (err: NodeJS.ErrnoException) =>
      reject(err.code === 'ENOENT' ? new Error('A video subject needs ffmpeg to decode it, and it is not installed (or not on the PATH); install it, or set FFMPEG_PATH.') : err),
    );
    proc.on('close', (code) => resolve({ code: code ?? 1, stderr }));
  });
}

/** Metadata probed from a video file using ffmpeg. */
export interface VideoProbe {
  duration?: number;
  width?: number;
  height?: number;
  hasAudio: boolean;
}

/** Probes duration, dimensions, and audio presence of a video file. */
export async function probeVideo(file: string): Promise<VideoProbe> {
  const { stderr } = await run(ffmpegPath(), ['-hide_banner', '-i', file]);
  const durMatch = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  const duration = durMatch ? Number(durMatch[1]) * 3600 + Number(durMatch[2]) * 60 + Number(durMatch[3]) : undefined;

  const vidLine = stderr.split('\n').find((l) => /Stream #\d+:\d+.*Video:/.test(l));
  let width: number | undefined;
  let height: number | undefined;
  if (vidLine) {
    const m = /\b(\d{2,5})x(\d{2,5})\b/.exec(vidLine);
    if (m) {
      width = Number(m[1]);
      height = Number(m[2]);
    }
  }

  const hasAudio = /Stream #\d+:\d+.*Audio:/.test(stderr);
  return { duration, width, height, hasAudio };
}

/** A video's length in seconds, from ffmpeg's report (undefined when it does not say). */
export async function videoSeconds(file: string): Promise<number | undefined> {
  const probe = await probeVideo(file);
  return probe.duration;
}

async function muxAudio(
  videoPath: string,
  audioSource: string,
  format: string,
  duration: number,
  strict = false,
): Promise<void> {
  const isVideoFormat = format === 'mp4' || format === 'webm' || format === 'mov';
  if (!isVideoFormat) return;
  const ext = path.extname(videoPath);
  const muxedPath = path.join(path.dirname(videoPath), `.${path.basename(videoPath, ext)}.muxed${ext}`);
  const aCodec = format === 'webm' ? ['-c:a', 'libopus'] : ['-c:a', 'aac'];
  const muxArgs = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', videoPath,
    '-i', audioSource,
    '-c:v', 'copy',
    ...aCodec,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-t', String(duration),
    ...(format === 'mp4' ? ['-movflags', '+faststart'] : []),
    muxedPath,
  ];
  let muxRes = await run(ffmpegPath(), muxArgs);
  if (muxRes.code !== 0) {
    const fallbackArgs = [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', videoPath,
      '-i', audioSource,
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-t', String(duration),
      ...(format === 'mp4' ? ['-movflags', '+faststart'] : []),
      muxedPath,
    ];
    muxRes = await run(ffmpegPath(), fallbackArgs);
  }
  if (muxRes.code === 0 && fs.existsSync(muxedPath)) {
    fs.renameSync(muxedPath, videoPath);
  } else {
    try { fs.unlinkSync(muxedPath); } catch {}
    if (strict) {
      throw new Error(`ffmpeg could not mux audio from "${audioSource}": ${muxRes.stderr.trim() || `exit ${muxRes.code}`}`);
    }
  }
}

/**
 * Decodes `frames` frames of a video at `fps` into PNGs in `dir` (looping a
 * short video), at most 2048 px on the long edge. Returns their paths.
 */
export async function extractVideoFrames(file: string, fps: number, frames: number, dir: string): Promise<string[]> {
  fs.mkdirSync(dir, { recursive: true });
  const { code, stderr } = await run(ffmpegPath(), [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-stream_loop', '-1', '-i', file,
    '-vf', `fps=${fps},scale='if(gte(iw,ih),min(2048,iw),-2)':'if(gte(iw,ih),-2,min(2048,ih))'`,
    '-frames:v', String(frames), '-start_number', '0',
    path.join(dir, '%06d.png'),
  ]);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(dir, f));
  if (code !== 0 || !files.length) throw new Error(`ffmpeg could not decode the video at ${file}: ${stderr.trim() || `exit ${code}`}`);
  return files;
}

/** A PNG, JPEG, GIF, WebP, BMP or SVG's own size, in display orientation (JPEG EXIF rotation applied, as Chrome draws it); undefined for others. */
export function imageNaturalSize(data: Buffer | Uint8Array): { width: number; height: number } | undefined {
  const b = Buffer.isBuffer(data) ? data : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const ok = (width: number, height: number) => (width > 0 && height > 0 ? { width, height } : undefined);
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47 && b.toString('ascii', 12, 16) === 'IHDR') return ok(b.readUInt32BE(16), b.readUInt32BE(20));
  if (b.length >= 10 && b.toString('ascii', 0, 4) === 'GIF8') return ok(b.readUInt16LE(6), b.readUInt16LE(8));
  if (b.length >= 26 && b.toString('ascii', 0, 2) === 'BM') return ok(b.readInt32LE(18), Math.abs(b.readInt32LE(22)));
  if (b.length >= 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8 ') return ok(b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff);
    if (chunk === 'VP8L') {
      const [b0, b1, b2, b3] = [b[21]!, b[22]!, b[23]!, b[24]!];
      return ok(1 + (((b1 & 0x3f) << 8) | b0), 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)));
    }
    if (chunk === 'VP8X') return ok(1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3));
    return undefined;
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let orientation = 1;
    let off = 2;
    while (off + 9 < b.length) {
      if (b[off] !== 0xff) return undefined;
      const marker = b[off + 1]!;
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue; }
      const len = b.readUInt16BE(off + 2);
      if (marker === 0xe1 && b.toString('ascii', off + 4, off + 10) === 'Exif\0\0') orientation = exifOrientation(b, off + 10) ?? orientation;
      // Start of frame (SOF0–SOF15, but not DHT, JPG or DAC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const height = b.readUInt16BE(off + 5);
        const width = b.readUInt16BE(off + 7);
        return orientation >= 5 && orientation <= 8 ? ok(height, width) : ok(width, height);
      }
      off += 2 + len;
    }
    return undefined;
  }
  const text = b.subarray(0, 4096).toString('utf8');
  if (/<svg\b/i.test(text)) {
    const open = /<svg\b[^>]*>/i.exec(b.toString('utf8'))?.[0] ?? '';
    const len = (name: string) => {
      const m = new RegExp(`\\s${name}\\s*=\\s*["']\\s*([\\d.]+)(px)?\\s*["']`, 'i').exec(open);
      return m && Number(m[1]) > 0 ? Number(m[1]) : 0;
    };
    const box = svgViewBox(open);
    const hasBox = box && box[2] > 0 && box[3] > 0;
    return ok(Math.round(len('width') || (hasBox ? box[2] : 300)), Math.round(len('height') || (hasBox ? box[3] : 150)));
  }
  return undefined;
}

/** The orientation tag (1–8) in a JPEG's EXIF block starting at `tiff`. */
function exifOrientation(b: Buffer, tiff: number): number | undefined {
  if (tiff + 8 > b.length) return undefined;
  const le = b.toString('ascii', tiff, tiff + 2) === 'II';
  const u16 = (o: number) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const u32 = (o: number) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > b.length) return undefined;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > b.length) return undefined;
    if (u16(entry) === 0x0112) return u16(entry + 8);
  }
  return undefined;
}

/** A `data:` URL's bytes (an empty buffer for anything else). */
function dataUrlBytes(url: string): Buffer {
  const comma = url.indexOf(',');
  if (!/^data:/i.test(url) || comma < 0) return Buffer.alloc(0);
  const meta = url.slice(0, comma);
  const body = url.slice(comma + 1);
  return /;base64/i.test(meta) ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body), 'utf8');
}

/** A backdrop's size from its `data:` URL (see {@link imageNaturalSize}). */
export function backdropSize(dataUrl: string): { width: number; height: number } | undefined {
  return imageNaturalSize(dataUrlBytes(dataUrl));
}

/** Checks a region: four numbers in 0–1 whose box stays in the frame; a sentence otherwise. */
export function checkRegion(region: unknown): EffectRegion {
  const bad = (why: string) =>
    new Error(`region takes [x, y, width, height], normalized 0 to 1 from the top left (like [0.5, 0, 0.5, 1] for the right half); ${why}.`);
  if (!Array.isArray(region) || region.length !== 4) throw bad(`not ${JSON.stringify(region)}`);
  if (!region.every((n) => typeof n === 'number' && Number.isFinite(n))) throw bad(`every entry must be a number, not ${JSON.stringify(region)}`);
  const [x, y, w, h] = region as number[];
  if (x! < 0 || y! < 0 || x! > 1 || y! > 1) throw bad(`x and y must be between 0 and 1, not ${x} and ${y}`);
  if (!(w! > 0) || !(h! > 0)) throw bad(`width and height must be more than 0, not ${w} and ${h}`);
  const eps = 1e-6;
  if (x! + w! > 1 + eps || y! + h! > 1 + eps) throw bad(`x + width and y + height must be at most 1 (the box leaves the frame: ${x! + w!}, ${y! + h!})`);
  return [x!, y!, w!, h!];
}

/** A normalized region in frame pixels, at least one pixel and inside the frame. */
export function regionPixels(region: EffectRegion, width: number, height: number): [number, number, number, number] {
  const x = Math.min(width - 1, Math.round(region[0] * width));
  const y = Math.min(height - 1, Math.round(region[1] * height));
  const w = Math.max(1, Math.min(width - x, Math.round(region[2] * width)));
  const h = Math.max(1, Math.min(height - y, Math.round(region[3] * height)));
  return [x, y, w, h];
}

/**
 * An export's pixel size: the given `width` and `height`, else `natural`
 * (a backdrop's or video's own size, rounded to even pixels), else the
 * effect's {@link defaultSize}. Given only a width, the height keeps that shape.
 */
export function effectFrameSize(
  effect: EffectDefinition,
  options: { width?: number; height?: number },
  natural?: { width: number; height: number },
  motion?: SvgMotion,
): { width: number; height: number } {
  const fallback = natural && natural.width > 0 && natural.height > 0 ? { width: even(natural.width), height: even(natural.height) } : defaultSize(effect, motion);
  const width = Math.max(1, Math.round(options.width ?? fallback.width));
  const height = Math.max(1, Math.round(options.height ?? (options.width ? (options.width * fallback.height) / fallback.width : fallback.height)));
  return { width, height };
}

/** The page's backdrop and region, when there are any. */
function pageExtras(backdrop: { src: string; fit: BackdropFit } | undefined, box: [number, number, number, number] | undefined): Pick<PageConfig, 'backdrop' | 'region'> {
  return { ...(backdrop ? { backdrop: { src: backdrop.src, fit: backdrop.fit } } : {}), ...(box ? { region: box } : {}) };
}

/** The backdrop, read and checked against what the render asks for; sentences for what cannot be. */
async function resolveBackdrop(def: EffectDefinition, options: EffectExportOptions, values: Record<string, ControlValue>, format: OutputFormat) {
  if (!options.backdrop) return undefined;
  if (format === 'svg') {
    throw new Error('An animated SVG cannot carry a backdrop picture; write .mp4, .webm, .mov, .gif or .png frames to render over it, or drop the backdrop.');
  }
  if (def.kind === 'shader' && !drawsAlpha(def, values)) {
    throw new Error(
      effectInputs(def).images.length
        ? `"${def.id}" draws every pixel itself, so a backdrop would be hidden under it; pass the picture as its subject instead (subject: { image }, or --image).`
        : `"${def.id}" draws every pixel itself and takes no picture, so a backdrop would be hidden under it; pick an overlay effect ("flair effects --transparent", or findEffects({ transparent: true })), or drop the backdrop.`,
    );
  }
  const src = await imageDataUrl(options.backdrop);
  return { src, fit: options.backdropFit ?? 'cover', size: backdropSize(src) };
}

/**
 * Renders a catalog effect (by id or definition), applied to `subject`, to
 * a file: a shader through WebGL2 in headless Chrome, a vector effect by
 * drawing each frame's SVG there, or (to `.svg`) a vector effect as one
 * animated SVG with no browser at all. MP4, WebM, MOV and video subjects
 * need ffmpeg. Throws a sentence when the effect is unknown, takes no such
 * subject, or cannot be written in that format. A `backdrop` draws a
 * picture under an overlay in every frame (and `region` places the effect
 * in part of the frame).
 *
 * ```ts
 * await exportEffect("image-duotone", { subject: { image: "team.jpg" }, preset: "Spotify", outputPath: "team.mp4" });
 * await exportEffect("click-ripple", { alpha: true, outputPath: "ripple.webm" });
 * await exportEffect("typewriter", { subject: { text: "Hello" }, outputPath: "hello.gif" });
 * await exportEffect("toggle-switch", { outputPath: "toggle.svg" });
 * await exportEffect("sparkles", { backdrop: "beach.jpg", region: [0, 0, 1, 0.5], outputPath: "beach.mp4" });
 * ```
 */
export async function exportEffect(effect: string | EffectDefinition, options: EffectExportOptions): Promise<string> {
  const def = resolveEffect(effect);
  if (options.preset && !def.presets?.some((p) => p.name === options.preset)) {
    const names = def.presets?.map((p) => `"${p.name}"`).join(', ');
    throw new Error(`"${def.id}" has no preset "${options.preset}"; ${names ? `its presets are ${names}` : 'it has no presets'}.`);
  }
  const fromSubject = options.subject ? await nodeSubjectValues(def, options.subject) : { values: {}, video: {} };
  const explicit = await checkEffectValues(def, options.values ?? {}, { ignoreUnknownControls: options.ignoreUnknownControls });
  const values = { ...effectDefaults(def, options.preset ? { preset: options.preset } : {}), ...fromSubject.values, ...explicit };
  const fps = options.fps ?? 30;
  const shutter = checkShutter(options);
  const background = options.background ?? (def.kind === 'vector' ? '#ffffff' : '#000000');
  const region = options.region === undefined ? undefined : checkRegion(options.region);
  if (options.backdropFit !== undefined && !BACKDROP_FITS.includes(options.backdropFit)) {
    throw new Error(`backdropFit (--backdrop-fit) takes ${BACKDROP_FITS.join(', ')}; not "${options.backdropFit}".`);
  }
  if (options.backdrop && options.alpha) {
    throw new Error('A backdrop fills the frame, so there is no transparency left to keep; drop alpha (--alpha) to render over the backdrop, or drop the backdrop to render the effect alone with alpha.');
  }

  if (def.kind === 'vector') {
    const motion = renderVectorEffect(def, values);
    const timeline = vectorTimeline(def, motion);
    const duration = options.duration ?? timeline.length / 1000;
    const frames = Math.max(1, Math.round(duration * fps));
    const plan = planOutput(options.outputPath, { alpha: options.alpha, frames });
    const backdrop = await resolveBackdrop(def, options, values, plan.format);
    if (plan.format === 'svg') {
      if (region) throw new Error('An animated SVG cannot be confined to a region; write .mp4, .webm, .mov, .gif or .png frames, or drop the region.');
      if (shutter) throw new Error('An animated SVG has no frames to motion-blur; write .mp4, .webm, .mov, .gif or .png frames for shutterAngle (--shutter-angle), or drop it.');
      const markup = svgAnimatedMarkup(motion, {
        ...(def.hold !== undefined ? { hold: def.hold } : {}),
        ...(timeline.steps.length ? { steps: timeline.steps, duration: timeline.length } : {}),
        ...(options.duration !== undefined ? { duration: options.duration * 1000 } : {}),
        fps,
      });
      if (!markup) throw new Error(`"${def.id}" has no <svg> to write.`);
      // A file gets a size of its own (it fills its container otherwise); a background only when asked for.
      const size = defaultSize(def, motion);
      const w = Math.round(options.width ?? size.width);
      const h = Math.round(options.height ?? (options.width ? (options.width * size.height) / size.width : size.height));
      const style = !plan.alpha && options.background ? ` style="background:${options.background.replace(/["<>&]/g, '')}"` : '';
      const out = markup.replace(/^<svg\b[^>]*>/, (open) =>
        open.replace(/\swidth="100%"/, ` width="${w}"`).replace(/\sheight="100%"/, ` height="${h}"`).replace(/>$/, `${style}>`),
      );
      fs.mkdirSync(path.dirname(plan.path), { recursive: true });
      fs.writeFileSync(plan.path, out, 'utf8');
      options.onProgress?.(1, 1);
      return plan.path;
    }
    const { width, height } = effectFrameSize(def, options, backdrop?.size, motion);
    const box = region ? regionPixels(region, width, height) : undefined;
    const base = frameStates(frames, fps, box?.[2] ?? width, box?.[3] ?? height, 'none', shutter);
    const pointer = options.pointer ?? 'auto';
    const state = (i: number): FrameState => {
      const ms = shutter ? base[i]!.time * 1000 : (i / fps) * 1000;
      const { time, steps } = pointer === 'none' && def.trigger ? { time: 0, steps: [] } : timeline.at(ms);
      return { ...base[i]!, svg: svgFrameMarkup(motion, { at: time, steps })! };
    };
    const rendered = await runRender({
      page: { width, height, frames, alpha: plan.alpha, background, send: plan.format === 'gif' ? 'rgba' : 'png', ...pageExtras(backdrop, box) },
      state,
      plan,
      fps,
      chromeFlags: options.chromeFlags,
      software: options.software,
      ...(shutter ? { subframes: shutter.samples } : {}),
      ...(options.onProgress ? { onProgress: options.onProgress } : {}),
    });
    if (typeof options.audio === 'string' && options.audio !== 'mute' && options.audio !== 'copy') {
      await muxAudio(rendered, options.audio, plan.format, duration, true);
    }
    return rendered;
  }

  // A shader.
  const videoEntries = Object.entries(fromSubject.video);
  let duration = options.duration;
  let probedVideo: VideoProbe | undefined;
  if (videoEntries.length) {
    probedVideo = await probeVideo(videoEntries[0]![1]);
  }
  if (duration === undefined && probedVideo?.duration !== undefined) {
    duration = probedVideo.duration;
  }
  duration ??= def.loop && def.loop <= 12 ? def.loop : 3;
  const frames = Math.max(1, Math.round(duration * fps));
  const plan = planOutput(options.outputPath, { alpha: options.alpha, frames });
  if (plan.format === 'svg') {
    throw new Error(`"${def.id}" is a shader effect, which draws pixels; write .mp4, .webm, .mov, .gif or .png frames (only vector effects become SVG).`);
  }
  const backdrop = await resolveBackdrop(def, options, values, plan.format);
  const video = probedVideo?.width && probedVideo.height ? { width: probedVideo.width, height: probedVideo.height } : undefined;
  const { width, height } = effectFrameSize(def, options, backdrop?.size ?? video);
  const box = region ? regionPixels(region, width, height) : undefined;
  const interactive = effectInputs(def).interactions.length > 0;
  const states = frameStates(frames, fps, box?.[2] ?? width, box?.[3] ?? height, options.pointer ?? (interactive ? 'auto' : 'none'), shutter);

  const tmp = videoEntries.length ? fs.mkdtempSync(path.join(os.tmpdir(), 'flair-video-')) : undefined;
  try {
    const videoFrames: Record<string, string[]> = {};
    for (const [name, file] of videoEntries) videoFrames[name] = await extractVideoFrames(file, fps, frames, path.join(tmp!, name));
    const state = (i: number): FrameState => {
      if (!videoEntries.length) return states[i]!;
      // Every sub-frame of a blurred frame shows that frame's picture (the video has no finer times).
      const at = states[i]!.frame;
      const video = Object.fromEntries(Object.entries(videoFrames).map(([name, files]) => [name, files[Math.min(at, files.length - 1)]!]));
      return { ...states[i]!, video };
    };
    const rendered = await runRender({
      page: {
        width,
        height,
        frames,
        alpha: plan.alpha,
        background,
        send: plan.format === 'gif' ? 'rgba' : 'png',
        ...pageExtras(backdrop, box),
        shader: {
          fragment: wrapSource(def.source),
          controls: await pageControls(def.source, values),
          opaque: !plan.alpha && !drawsAlpha(def, values),
        },
      },
      state,
      plan,
      fps,
      chromeFlags: options.chromeFlags,
      software: options.software,
      stallTimeoutMs: options.stallTimeoutMs,
      ...(shutter ? { subframes: shutter.samples } : {}),
      ...(options.onProgress ? { onProgress: options.onProgress } : {}),
    });

    const audioSource =
      options.audio === false || options.audio === 'mute'
        ? undefined
        : typeof options.audio === 'string' && options.audio !== 'copy'
          ? options.audio
          : (options.audio === true || options.audio === 'copy' || options.audio === undefined) && probedVideo?.hasAudio && videoEntries.length
            ? videoEntries[0]![1]
            : undefined;

    if (audioSource) {
      await muxAudio(rendered, audioSource, plan.format, duration, Boolean(options.audio));
    }

    return rendered;
  } finally {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export type EffectBufferSubject =
  | NodeSubject
  | { imageBuffer: Buffer | Uint8Array; ext?: string };

/** A backdrop for {@link exportEffectBuffer}: a file path, URL or `data:` URL, or the picture's bytes (`ext` names its type, default `png`). */
export type EffectBufferBackdrop = string | { imageBuffer: Buffer | Uint8Array; ext?: string };

export interface EffectBufferExportOptions extends Omit<EffectExportOptions, 'outputPath' | 'subject' | 'backdrop'> {
  /** Output format (`'mp4'`, `'webm'`, `'mov'`, `'gif'`, `'png'`, `'svg'`). Defaults to `'mp4'`. */
  format?: OutputFormat;
  /** Subject(s) to apply the effect to; supports in-memory `{ imageBuffer, ext }` in addition to `NodeSubject`. */
  subject?: EffectBufferSubject | readonly EffectBufferSubject[];
  /**
   * A picture drawn under the effect (see {@link EffectExportOptions.backdrop}): a path, URL or
   * `data:` URL, or in-memory `{ imageBuffer, ext }`. Without `width` and `height`, the result
   * takes the backdrop's own size (rounded to even pixels).
   */
  backdrop?: EffectBufferBackdrop;
}

export interface EffectBufferExportResult {
  buffer: Buffer;
  format: OutputFormat;
  mimeType: string;
  width: number;
  height: number;
}

const FORMAT_MIME_TYPES: Record<OutputFormat, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  gif: 'image/gif',
  png: 'image/png',
  svg: 'image/svg+xml',
};

/**
 * Renders a catalog effect to an in-memory `Buffer`, automatically managing temporary files,
 * headless Chrome discovery, control value sanitization, and single-frame PNG sequence resolution.
 */
export async function exportEffectBuffer(
  effect: string | EffectDefinition,
  options: EffectBufferExportOptions = {},
): Promise<EffectBufferExportResult> {
  const def = resolveEffect(effect);
  const { format = 'mp4', subject: rawSubject, values: rawValues, backdrop: rawBackdrop, ...restOptions } = options;

  if (!process.env.CHROME_PATH) {
    const detectedChrome = findChrome();
    if (detectedChrome) {
      process.env.CHROME_PATH = detectedChrome;
    }
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flair-export-'));
  try {
    let resolvedSubject: NodeSubject | readonly NodeSubject[] | undefined;
    if (rawSubject) {
      const list = (Array.isArray(rawSubject) ? rawSubject : [rawSubject]) as readonly EffectBufferSubject[];
      const mapped: NodeSubject[] = [];
      for (let i = 0; i < list.length; i++) {
        const item = list[i]!;
        if ('imageBuffer' in item) {
          const ext = item.ext && /^[a-z0-9]+$/i.test(item.ext) ? item.ext.toLowerCase() : 'png';
          const inputPath = path.join(tmpDir, `input_${i}.${ext}`);
          fs.writeFileSync(inputPath, item.imageBuffer);
          mapped.push({ image: inputPath });
        } else {
          mapped.push(item);
        }
      }
      resolvedSubject = Array.isArray(rawSubject) ? mapped : mapped[0];
    }

    let backdrop: string | undefined;
    if (rawBackdrop !== undefined && rawBackdrop !== '') {
      if (typeof rawBackdrop === 'string') backdrop = rawBackdrop;
      else {
        const ext = rawBackdrop.ext && /^[a-z0-9]+$/i.test(rawBackdrop.ext) ? rawBackdrop.ext.toLowerCase() : 'png';
        backdrop = path.join(tmpDir, `backdrop.${ext}`);
        fs.writeFileSync(backdrop, rawBackdrop.imageBuffer);
      }
      // Read once here, for its size; exportEffect keeps a data: URL as it is.
      if (!restOptions.alpha && format !== 'svg') backdrop = await imageDataUrl(backdrop);
    }
    const natural = backdrop && /^data:/i.test(backdrop) ? backdropSize(backdrop) : undefined;
    const baseSize = natural ? { width: even(natural.width), height: even(natural.height) } : defaultSize(def);
    const given = (n: number | undefined) => (n && Number.isFinite(n) && n > 0 ? even(n) : undefined);
    const givenWidth = given(restOptions.width);
    const givenHeight = given(restOptions.height);
    // With a backdrop, one given side keeps the backdrop's shape.
    const width = givenWidth ?? (givenHeight && natural ? even((givenHeight * natural.width) / natural.height) : baseSize.width);
    const height = givenHeight ?? (givenWidth && natural ? even((givenWidth * natural.height) / natural.width) : baseSize.height);
    const duration = format === 'png' ? (restOptions.duration ?? 1) : restOptions.duration;
    const fps = format === 'png' ? (restOptions.fps ?? 1) : restOptions.fps;
    const outputPath = path.join(tmpDir, `output.${format}`);
    const sanitized = rawValues ? sanitizeEffectValues(def, rawValues) : undefined;

    const writtenPath = await exportEffect(def, {
      ...restOptions,
      outputPath,
      width,
      height,
      ...(duration !== undefined ? { duration } : {}),
      ...(fps !== undefined ? { fps } : {}),
      ...(sanitized ? { values: sanitized } : {}),
      ...(resolvedSubject ? { subject: resolvedSubject } : {}),
      ...(backdrop ? { backdrop } : {}),
      ignoreUnknownControls: restOptions.ignoreUnknownControls ?? true,
    });

    let finalFilePath = writtenPath || outputPath;
    if (!fs.existsSync(finalFilePath)) {
      const sequenceCandidate = outputPath.replace(/\.png$/i, '_0000.png');
      if (fs.existsSync(sequenceCandidate)) {
        finalFilePath = sequenceCandidate;
      } else {
        finalFilePath = outputPath;
      }
    }

    const buffer = fs.readFileSync(finalFilePath);
    return {
      buffer,
      format,
      mimeType: FORMAT_MIME_TYPES[format] ?? 'application/octet-stream',
      width,
      height,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ==========================================
// Command-line helpers
// ==========================================

/** `"1280x720"` → `{ width: 1280, height: 720 }`; a sentence for anything else. */
export function parseSize(size: string): { width: number; height: number } {
  const m = /^\s*(\d+)\s*[x×X]\s*(\d+)\s*$/.exec(size);
  if (!m || Number(m[1]) < 1 || Number(m[2]) < 1) throw new Error(`--size takes width x height in pixels, like 1280x720, not "${size}".`);
  return { width: Number(m[1]), height: Number(m[2]) };
}

/** `"0.5,0,0.5,1"` → a region (see {@link checkRegion}); a sentence for anything else. */
export function parseRegion(text: string): EffectRegion {
  const parts = text.split(/[\s,]+/).filter(Boolean).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`--region takes x,y,width,height, normalized 0 to 1 from the top left, like 0.5,0,0.5,1 for the right half; not "${text}".`);
  }
  return checkRegion(parts);
}

/**
 * A `--set` value read for its control: numbers for `float` and `int`,
 * `true`/`false` (or 1/0) for `bool`, a colour (`#77C16A`, `rgb(…)`) or
 * numbers separated by commas or spaces for vectors, and the text itself
 * for images (a path or URL) and text.
 */
export function parseSetValue(control: ControlDef, raw: string): ControlValue {
  const text = raw.trim();
  switch (control.type) {
    case 'float':
    case 'int': {
      const n = Number(text);
      if (text === '' || !Number.isFinite(n)) throw new Error(`${control.name} takes a number, not "${raw}".`);
      return n;
    }
    case 'bool': {
      if (/^(true|1|yes|on)$/i.test(text)) return true;
      if (/^(false|0|no|off)$/i.test(text)) return false;
      throw new Error(`${control.name} takes true or false, not "${raw}".`);
    }
    case 'sampler2D':
    case 'text':
      return raw;
    default: {
      if (control.color && (parseColor(text) || /^currentcolor$/i.test(text)) && !/^[-\d.]+([\s,]+[-\d.]+)*$/.test(text)) return text;
      const parts = text.split(/[\s,]+/).filter(Boolean).map(Number);
      if (!parts.length || parts.some((n) => !Number.isFinite(n))) {
        throw new Error(`${control.name} takes ${control.type === 'vec2' ? 2 : control.type === 'vec3' ? 3 : 4} numbers separated by commas${control.color ? ', or a colour like "#77C16A"' : ''}, not "${raw}".`);
      }
      return parts;
    }
  }
}

/** `--set name=value` flags as control values for an effect; sentences for unknown names and bad values. */
export function parseSets(effect: EffectDefinition, sets: readonly string[]): Record<string, ControlValue> {
  const controls = new Map(effectControls(effect).map((c) => [c.name, c]));
  const out: Record<string, ControlValue> = {};
  for (const set of sets) {
    const eq = set.indexOf('=');
    if (eq <= 0) throw new Error(`--set takes name=value, like --set uSpeed=2, not "${set}".`);
    const name = set.slice(0, eq).trim();
    const control = controls.get(name);
    if (!control) throw new Error(`"${effect.id}" has no control "${name}"; it has ${[...controls.keys()].join(', ') || 'none'}.`);
    out[name] = parseSetValue(control, set.slice(eq + 1));
  }
  return out;
}

/** The render command's subject flags. */
export interface SubjectFlags {
  image?: readonly string[];
  svg?: readonly string[];
  text?: readonly string[];
  path?: readonly string[];
  video?: readonly string[];
  font?: string;
  weight?: string;
}

/** Subjects from the render command's flags, in the order images, SVGs, videos, texts, paths. */
export function subjectsFromFlags(flags: SubjectFlags): NodeSubject[] {
  const weight = flags.weight === undefined ? undefined : /^\d+$/.test(flags.weight) ? Number(flags.weight) : flags.weight;
  return [
    ...(flags.image ?? []).map((image) => ({ image })),
    ...(flags.svg ?? []).map((svg) => ({ svg })),
    ...(flags.video ?? []).map((video) => ({ video })),
    ...(flags.text ?? []).map((text) => ({ text, ...(flags.font ? { font: flags.font } : {}), ...(weight !== undefined ? { weight } : {}) })),
    ...(flags.path ?? []).map((p) => ({ path: p })),
  ];
}

/** Comma-separated (or repeated) flag values checked against a list; a sentence for the rest. */
export function parseChoices<T extends string>(flag: string, values: readonly string[] | undefined, allowed: readonly T[]): T[] | undefined {
  if (!values?.length) return undefined;
  const list = values.flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean);
  const bad = list.filter((v) => !(allowed as readonly string[]).includes(v));
  if (bad.length) throw new Error(`${flag} takes ${allowed.join(', ')}; not ${bad.map((b) => `"${b}"`).join(', ')}.`);
  return list as T[];
}

/** The effects command's filters, checked. */
export function effectQueryFromFlags(flags: { accepts?: readonly string[]; interaction?: readonly string[]; category?: string; kind?: string; search?: string; tag?: readonly string[]; transparent?: boolean }) {
  const accepts = parseChoices<EffectInput>('--accepts', flags.accepts, EFFECT_INPUTS);
  const interaction = parseChoices<EffectInteraction>('--interaction', flags.interaction, EFFECT_INTERACTIONS);
  const tags = flags.tag?.length ? flags.tag.flatMap((t) => t.split(',')).map(normaliseTag).filter(Boolean) : undefined;
  if (tags) {
    const known = effectTags().map((t) => t.tag);
    const unknown = tags.find((t) => !known.includes(t));
    if (unknown !== undefined) throw new Error(`No effect is tagged "${unknown}".${didYouMean(unknown, known)} \`flair tags\` lists the tags there are.`);
  }
  if (flags.category && !(EFFECT_CATEGORIES as readonly string[]).includes(flags.category)) {
    throw new Error(`--category takes one of ${EFFECT_CATEGORIES.join(', ')}; not "${flags.category}".`);
  }
  if (flags.kind && flags.kind !== 'shader' && flags.kind !== 'vector') throw new Error(`--kind takes shader or vector; not "${flags.kind}".`);
  return {
    ...(accepts ? { accepts } : {}),
    ...(interaction ? { interaction } : {}),
    ...(flags.category ? { category: flags.category as EffectCategory } : {}),
    ...(flags.kind ? { kind: flags.kind as 'shader' | 'vector' } : {}),
    ...(flags.search ? { text: flags.search } : {}),
    ...(tags ? { tags } : {}),
    ...(flags.transparent !== undefined ? { transparent: flags.transparent } : {}),
  };
}

/** One line about an effect for the effects command: id, kind, category, and what it takes. */
export function describeEffect(effect: EffectDefinition): string {
  const inputs = effectInputs(effect);
  const parts = [
    `${effect.kind}/${effect.category}`,
    `takes ${inputs.accepts.join(', ') || 'nothing'}`,
    ...(inputs.video ? [`video: ${inputs.video}`] : []),
    ...(inputs.interactions.length ? [`answers ${inputs.interactions.join(', ')}`] : []),
    ...(inputs.transparent ? ['overlay'] : []),
    ...(effect.presets?.length ? [`presets: ${effect.presets.map((p) => p.name).join(', ')}`] : []),
  ];
  return `${effect.id.padEnd(24)} ${parts.join(' · ')}`;
}
