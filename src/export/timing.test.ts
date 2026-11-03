import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exportEffect, effectQueryFromFlags } from './effect.js';
import { ffmpegPath } from './recorder.js';
import { decodeFootage, probeFootage } from './timing.js';

const hasFfmpeg = spawnSync(ffmpegPath(), ['-version']).status === 0;

let dir: string;
let clip: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flair-timing-test-'));
  clip = path.join(dir, 'clip.mp4');
  // Two seconds at 25 fps, each frame a flat grey a little lighter than the last.
  if (hasFfmpeg) {
    const made = spawnSync(ffmpegPath(), [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=black:s=64x36:r=25:d=2',
      '-vf', "geq=lum='N*5':cb=128:cr=128",
      '-c:v', 'libx264', '-pix_fmt', 'yuv444p', '-qp', '0', clip,
    ]);
    if (made.status !== 0) throw new Error(made.stderr.toString());
  } else fs.writeFileSync(clip, '');
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('timing effects in Node', () => {
  it.skipIf(!hasFfmpeg)('decodes a video once and reads any frame', async () => {
    expect(await probeFootage(clip)).toMatchObject({ fps: 25, width: 64, height: 36 });
    const decoded = await decodeFootage(clip, 32, 18);
    try {
      expect(decoded.footage).toMatchObject({ width: 32, height: 18, fps: 25, duration: 2000 });
      const out = new Uint8ClampedArray(32 * 18 * 4);
      await decoded.footage.frame(400, out);
      const late = out[0]!;
      await decoded.footage.frame(0, out);
      // Frame 10 is lighter than frame 0, and opaque.
      expect(late).toBeGreaterThan(out[0]! + 30);
      expect(out[3]).toBe(255);
    } finally {
      decoded.dispose();
    }
  });

  it.skipIf(!hasFfmpeg)('renders a retime as long as the retimed clip, at the video\'s own frame rate', async () => {
    const frames = path.join(dir, 'slow');
    await exportEffect('retime-speed', { subject: { video: clip }, values: { speed: 0.5, smooth: false }, outputPath: `${frames}/`, width: 16, height: 10 });
    expect(fs.readdirSync(frames).filter((f) => f.endsWith('.png'))).toHaveLength(100);
    const gif = path.join(dir, 'reverse.gif');
    await exportEffect('retime-reverse', { subject: { video: clip }, outputPath: gif, width: 16, height: 10, duration: 0.4 });
    expect(fs.statSync(gif).size).toBeGreaterThan(0);
    // The decoded frames are gone afterwards.
    expect(fs.readdirSync(os.tmpdir()).some((f) => f.startsWith('flair-footage-') && fs.existsSync(path.join(os.tmpdir(), f, 'frames.rgba')))).toBe(false);
  });

  it('refuses what a retime cannot do, saying what to do instead', async () => {
    await expect(exportEffect('long-exposure', { outputPath: path.join(dir, 'x.mp4') })).rejects.toThrow(/needs a video: subject: \{ video: "clip\.mp4" \} \(or --video clip\.mp4\)/);
    await expect(exportEffect('long-exposure', { subject: { video: clip }, region: [0, 0, 0.5, 0.5], outputPath: path.join(dir, 'x.mp4') })).rejects.toThrow(/cannot be confined to a region/);
    await expect(exportEffect('long-exposure', { subject: { video: clip }, audio: 'copy', outputPath: path.join(dir, 'x.mp4') })).rejects.toThrow(/own sound would not follow/);
    await expect(exportEffect('long-exposure', { subject: { text: 'hello' }, outputPath: path.join(dir, 'x.mp4') })).rejects.toThrow(/timing effect: it retimes video footage/);
  });

  it('finds timing effects (and camera moves) by kind', () => {
    expect(effectQueryFromFlags({ kind: 'timing' })).toEqual({ kind: 'timing' });
    expect(() => effectQueryFromFlags({ kind: 'sound' })).toThrow(/--kind takes shader, vector, camera or timing/);
  });
});
