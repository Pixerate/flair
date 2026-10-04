// gifenc ships without types. The reference (not an import) brings them along when a host
// type-checks these sources through the `workspace` condition.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./gifenc.d.ts" />
import type { ControlValue } from "./controls.js";
import { ShaderFrames } from "./frames.js";

export interface GifOptions {
  source: string;
  values?: Record<string, ControlValue>;
  width: number;
  height: number;
  /** Frames per second. GIF delays are whole hundredths of a second, so 10, 20, 25 and 50 play back exactly. */
  fps: number;
  /** Seconds of animation to record. */
  duration: number;
  /** `iTime` of the first frame (default 0). */
  start?: number;
  /** Called after each frame with the frames done and the total. */
  onProgress?: (done: number, total: number) => void;
  /** Aborting rejects with an `AbortError` `DOMException`. */
  signal?: AbortSignal;
}

/** Lets the page repaint between frames so progress shows and Cancel works. */
const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Records a shader as an animated GIF that loops forever. Frames are rendered
 * off screen at exact time steps (`start + i / fps`), so the result is smooth
 * whatever the page's frame rate, and nothing on screen is disturbed. Each
 * frame gets its own 256-colour palette. The encoder,
 * [gifenc](https://github.com/mattdesl/gifenc), is loaded on first use.
 *
 * Rejects with a `ShaderCompileError` when the source does not compile.
 */
export async function recordGif(options: GifOptions): Promise<Blob> {
  const { source, values, width, height, fps, duration, start = 0, onProgress, signal } = options;
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");

  const frames = new ShaderFrames({ source, values, width, height });
  try {
    const total = Math.max(1, Math.round(duration * fps));
    const delay = 1000 / fps;
    const rgba = new Uint8Array(frames.width * frames.height * 4);
    const gif = GIFEncoder();

    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      frames.render(start + i / fps, { frame: i, delta: 1 / fps });
      frames.readPixels(rgba);
      const palette = quantize(rgba, 256);
      gif.writeFrame(applyPalette(rgba, palette), frames.width, frames.height, {
        palette,
        delay,
        ...(i === 0 ? { repeat: 0 } : {}),
      });
      onProgress?.(i + 1, total);
      if (i % 2 === 1) await yieldToBrowser();
    }

    gif.finish();
    return new Blob([gif.bytes()], { type: "image/gif" });
  } finally {
    frames.dispose();
  }
}
