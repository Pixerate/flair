/**
 * Footage for timing effects in Node: a video file decoded once by ffmpeg
 * into raw RGBA frames on disk, so a retime can read any frame, in any
 * order, without seeking the video again.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_FOOTAGE_FPS, type TimingFootage } from '../catalog/timing.js';
import { ffmpegPath } from './recorder.js';

const NO_FFMPEG = 'A timing effect needs ffmpeg to decode its video, and it is not installed (or not on the PATH); install it (brew install ffmpeg, apt install ffmpeg), or set FFMPEG_PATH.';

function ffmpeg(args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr!.on('data', (d) => (stderr += d.toString()));
    proc.on('error', (err: NodeJS.ErrnoException) => reject(err.code === 'ENOENT' ? new Error(NO_FFMPEG) : err));
    proc.on('close', (code) => resolve({ code: code ?? 1, stderr }));
  });
}

/** A video file's frame rate and size, from ffmpeg's report (undefined where it does not say). */
export async function probeFootage(file: string): Promise<{ fps?: number; width?: number; height?: number }> {
  const { stderr } = await ffmpeg(['-hide_banner', '-i', file]);
  const line = stderr.split('\n').find((l) => /Stream #\d+:\d+.*Video:/.test(l));
  if (!line) throw new Error(`There is no video stream in ${file}${/No such file|Invalid data/.test(stderr) ? ` (${stderr.trim().split('\n').pop()})` : ''}.`);
  const size = /\b(\d{2,5})x(\d{2,5})\b/.exec(line);
  const fps = /,\s*(\d+(?:\.\d+)?)\s*fps\b/.exec(line) ?? /,\s*(\d+(?:\.\d+)?)\s*tbr\b/.exec(line);
  const rate = fps ? Number(fps[1]) : undefined;
  return {
    ...(rate && rate > 0 && rate <= 240 ? { fps: rate } : {}),
    ...(size ? { width: Number(size[1]), height: Number(size[2]) } : {}),
  };
}

/** Footage decoded to disk, with what frees it. */
export interface DecodedFootage {
  footage: TimingFootage;
  /** Closes and deletes the decoded frames. */
  dispose(): void;
}

/**
 * Decodes `file` with ffmpeg at `width` × `height` (cover-fitted: scaled to
 * fill, then cropped to the middle) and `fps` (default the video's own, else
 * {@link DEFAULT_FOOTAGE_FPS}) into raw RGBA in a temporary folder, and gives
 * it as {@link TimingFootage}. The decoded frames take `width × height × 4`
 * bytes each on disk until `dispose`. Rejects with a sentence when ffmpeg is
 * missing or cannot decode the video.
 */
export async function decodeFootage(file: string, width: number, height: number, options: { fps?: number } = {}): Promise<DecodedFootage> {
  const fps = options.fps ?? (await probeFootage(file)).fps ?? DEFAULT_FOOTAGE_FPS;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flair-footage-'));
  const raw = path.join(dir, 'frames.rgba');
  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  try {
    const { code, stderr } = await ffmpeg([
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', file,
      '-an',
      '-vf', `fps=${fps},scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},format=rgba`,
      '-f', 'rawvideo', '-pix_fmt', 'rgba',
      raw,
    ]);
    const bytes = width * height * 4;
    const count = fs.existsSync(raw) ? Math.floor(fs.statSync(raw).size / bytes) : 0;
    if (code !== 0 || count === 0) throw new Error(`ffmpeg could not decode the video at ${file}: ${stderr.trim() || `exit ${code}`}`);
    const fd = fs.openSync(raw, 'r');
    return {
      footage: {
        width,
        height,
        fps,
        duration: (count * 1000) / fps,
        frame(ms, out) {
          const i = Math.min(count - 1, Math.max(0, Math.round((ms * fps) / 1000)));
          fs.readSync(fd, out, 0, bytes, i * bytes);
        },
      },
      dispose() {
        fs.closeSync(fd);
        cleanup();
      },
    };
  } catch (err) {
    cleanup();
    throw err;
  }
}
