import { execFile } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { ffmpegPath, probeVideo } from "@pixerate/flair/node";
import type { Frames } from "./types.ts";

/** Runs ffmpeg and returns its stdout. */
function ffmpeg(args: readonly string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath(), ["-v", "error", ...args], { encoding: "buffer", maxBuffer: 1 << 30 }, (error, stdout, stderr) => {
      if (error) reject(new Error(`ffmpeg failed: ${stderr.toString().trim() || error.message}`));
      else resolve(stdout);
    });
  });
}

/** Splits raw RGBA video into frames. */
function split(raw: Buffer, width: number, height: number): Frames {
  const size = width * height * 4;
  const data: Buffer[] = [];
  for (let at = 0; at + size <= raw.length; at += size) data.push(Buffer.from(raw.subarray(at, at + size)));
  return { width, height, data };
}

/** Decodes pictures (PNG, JPEG, GIF, WebP…) to RGBA frames scaled to `width` × `height`. */
export async function decodeImages(files: readonly string[], width: number, height: number): Promise<Frames> {
  const out: Buffer[] = [];
  for (const file of files) {
    const raw = await ffmpeg(["-i", file, "-frames:v", "1", "-vf", `scale=${width}:${height}:flags=area`, "-f", "rawvideo", "-pix_fmt", "rgba", "-"]);
    out.push(...split(raw, width, height).data);
  }
  return { width, height, data: out };
}

/** The PNG frames a render wrote to `dir`, in order, decoded at their own size or scaled. */
export async function decodeFolder(dir: string, size?: { width: number; height: number }): Promise<Frames> {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".png"))
    .sort()
    .map((f) => path.join(dir, f));
  if (!files.length) throw new Error(`The render wrote no frames to ${dir}.`);
  const own = size ?? (await pictureSize(files[0]!));
  return decodeImages(files, own.width, own.height);
}

/** A picture's size in pixels. */
export async function pictureSize(file: string): Promise<{ width: number; height: number }> {
  const probe = await probeVideo(file);
  if (!probe.width || !probe.height) throw new Error(`Could not read the size of ${file}.`);
  return { width: probe.width, height: probe.height };
}

/** `count` frames taken evenly through a video, scaled to `width` × `height`. */
export async function decodeVideo(file: string, count: number, width: number, height: number): Promise<Frames> {
  const probe = await probeVideo(file);
  const seconds = probe.duration && probe.duration > 0 ? probe.duration : 1;
  const raw = await ffmpeg(["-i", file, "-vf", `fps=${count / seconds},scale=${width}:${height}:flags=area`, "-frames:v", String(count), "-f", "rawvideo", "-pix_fmt", "rgba", "-"]);
  return split(raw, width, height);
}

/** Encodes RGBA pixels as a PNG. */
export function encodePng(rgba: Buffer, width: number, height: number): Buffer {
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  const chunk = (type: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])) >>> 0, 0);
    return Buffer.concat([head, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}

/**
 * Frames composited over a checkerboard, opaque, so a model or a person sees what an overlay draws
 * and where it leaves the picture under it alone.
 */
export function overChecker(frames: Frames, cell = 16): Frames {
  const { width, height } = frames;
  const data = frames.data.map((src) => {
    const out = Buffer.alloc(src.length);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const bg = ((x / cell) ^ (y / cell)) & 1 ? 72 : 48;
        const a = src[i + 3]! / 255;
        for (let c = 0; c < 3; c++) out[i + c] = Math.round(src[i + c]! * a + bg * (1 - a));
        out[i + 3] = 255;
      }
    return out;
  });
  return { width, height, data };
}

/** Frames side by side in one row, with a gap, as one PNG: a strip to look at. */
export function strip(frames: Frames, gap = 6): Buffer {
  const { width, height, data } = frames;
  const total = data.length * width + Math.max(0, data.length - 1) * gap;
  const out = Buffer.alloc(total * height * 4, 255);
  data.forEach((frame, n) => {
    const x0 = n * (width + gap);
    for (let y = 0; y < height; y++) frame.copy(out, (y * total + x0) * 4, y * width * 4, (y + 1) * width * 4);
  });
  return encodePng(out, total, height);
}

/** Evenly picks `count` of the frames (all of them when there are fewer). */
export function pick(frames: Frames, count: number): Frames {
  const n = frames.data.length;
  if (n <= count) return frames;
  const data = Array.from({ length: count }, (_, i) => frames.data[Math.round((i * (n - 1)) / (count - 1))]!);
  return { ...frames, data };
}
