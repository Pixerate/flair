/**
 * Timing effects on a page: footage from a `<video>` (or a preview clip of
 * Flair's own, made to show a retime off), retimed with `TimingRenderer` and
 * drawn on a canvas.
 */

import { DEFAULT_FOOTAGE_FPS, TimingRenderer, timingLength, timingValues, type TimingFootage } from "../catalog/timing.js";
import type { TimingEffect } from "../catalog/types.js";
import type { ControlValue } from "../shader/controls.js";
import { seekVideo, type LiveSource } from "../shader/textures.js";

/** Ms of the preview clip timing effects play on when they are given no video. */
export const PREVIEW_FOOTAGE_MS = 6000;

type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function canvas2d(width: number, height: number): Canvas2D {
  const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as Canvas2D | null;
  if (!ctx) throw new Error("This browser cannot draw on a 2D canvas, which footage frames are read from.");
  return ctx;
}

/** A number from 0 to 1 that is always the same for the same `n`. */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * A clip of Flair's own, {@link PREVIEW_FOOTAGE_MS} long, for previewing
 * timing effects without a video: a night scene with water falling, a
 * swinging lantern and a bouncing ball, and the footage's own time written in
 * the corner and drawn as a bar along the bottom, so a retime shows plainly
 * (a reverse counts down, a freeze stops the clock, a long exposure turns the
 * water silky and the lantern into a streak). Each frame is drawn from its
 * time alone.
 */
export function previewFootage(width: number, height: number, fps = DEFAULT_FOOTAGE_FPS): TimingFootage {
  const ctx = canvas2d(width, height);
  return {
    width,
    height,
    duration: PREVIEW_FOOTAGE_MS,
    fps,
    frame(ms, out) {
      const t = ms / 1000;
      const w = width;
      const h = height;
      const u = Math.min(w, h) / 100;
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#0b1026");
      sky.addColorStop(0.75, "#1e2a5a");
      sky.addColorStop(1, "#11152b");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      // Still stars, which stay sharp however long the exposure.
      ctx.fillStyle = "#cbd5e1";
      for (let i = 0; i < 40; i++) ctx.fillRect(hash(i) * w, hash(i + 99) * h * 0.55, u * 0.4, u * 0.4);
      // A waterfall on the left: streaks falling at their own speeds.
      const fallX = w * 0.08;
      const fallW = w * 0.22;
      ctx.fillStyle = "#13305e";
      ctx.fillRect(fallX, 0, fallW, h * 0.86);
      ctx.fillStyle = "#93c5fd";
      for (let i = 0; i < 70; i++) {
        const x = fallX + hash(i + 7) * fallW;
        const speed = 0.35 + hash(i + 13) * 0.3;
        const y = ((hash(i + 3) + t * speed) % 1) * h * 0.86;
        ctx.fillRect(x, y, u * 0.5, u * (2 + hash(i + 5) * 4));
      }
      // Ground.
      ctx.fillStyle = "#0a0d1a";
      ctx.fillRect(0, h * 0.86, w, h * 0.14);
      // A lantern swinging on a rope from the top, every 2 s there and back.
      const pivotX = w * 0.62;
      const rope = h * 0.5;
      const lantern = (at: number) => {
        const angle = 0.6 * Math.sin((at * Math.PI * 2) / 2);
        return [pivotX + Math.sin(angle) * rope, Math.cos(angle) * rope] as const;
      };
      // Moving things are smeared over half a frame, as a film camera's 180° shutter would, so trails join up.
      const open = 0.5 / fps;
      const [lx, ly] = lantern(t);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = u * 0.4;
      ctx.beginPath();
      ctx.moveTo(pivotX, 0);
      ctx.lineTo(lx, ly);
      ctx.stroke();
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 3; k++) {
        const [gx, gy] = lantern(t + (k / 2) * open);
        const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, u * 7);
        glow.addColorStop(0, "rgba(255,247,214,0.5)");
        glow.addColorStop(0.25, "rgba(253,186,116,0.4)");
        glow.addColorStop(1, "rgba(253,186,116,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(gx, gy, u * 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      // A ball bouncing across, left to right over the clip.
      const along = t / (PREVIEW_FOOTAGE_MS / 1000);
      const ball = (at: number) => [w * (0.36 + (0.58 * at) / (PREVIEW_FOOTAGE_MS / 1000)), h * 0.86 - u * 3 - Math.abs(Math.sin(at * Math.PI * 1.25)) * h * 0.45] as const;
      const [bx0, by0] = ball(t);
      const [bx1, by1] = ball(t + open);
      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = u * 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(bx0, by0);
      ctx.lineTo(bx1 + 0.01, by1);
      ctx.stroke();
      // The footage's own time, and how far through it is.
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(0, h - u * 1.2, w * along, u * 1.2);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = `600 ${Math.round(u * 6)}px ui-monospace, Menlo, monospace`;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`${t.toFixed(2)}s`, w - u * 30, h - u * 4);
      out.set(ctx.getImageData(0, 0, width, height).data);
    },
  };
}

/** Waits until a video knows its length. */
async function metadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 1) return;
  await new Promise<void>((resolve, reject) => {
    video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    video.addEventListener("error", () => reject(new Error("Could not load the video's footage.")), { once: true });
  });
}

/**
 * Footage from a `<video>`, read at `width` × `height` (cover-fitted, as an
 * image control fits a picture). Each frame seeks the video, so pause it
 * first, and keep it out of other hands while retiming it. Browsers do not
 * say a video's frame rate: give `fps` when it is not 30. Resolves once the
 * video knows its length; rejects when it cannot be loaded or has no length
 * (a live stream).
 */
export async function videoFootage(video: HTMLVideoElement, width: number, height: number, fps = DEFAULT_FOOTAGE_FPS): Promise<TimingFootage> {
  await metadata(video);
  if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error("A timing effect retimes footage of a known length; this video has none (a live stream cannot be retimed).");
  const ctx = canvas2d(width, height);
  const frameMs = 1000 / fps;
  return {
    width,
    height,
    duration: video.duration * 1000,
    fps,
    async frame(ms, out) {
      // Half a frame in, so rounding never lands on the frame before.
      await seekVideo(video, (ms + frameMs / 2) / 1000);
      const vw = video.videoWidth || width;
      const vh = video.videoHeight || height;
      const scale = Math.max(width / vw, height / vh);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(video, (width - vw * scale) / 2, (height - vh * scale) / 2, vw * scale, vh * scale);
      out.set(ctx.getImageData(0, 0, width, height).data);
    },
  };
}

/** The `<video>` a timing effect is given, or a sentence for a live source that is not one. */
export function footageVideo(effect: TimingEffect, live: Readonly<Record<string, LiveSource>>): HTMLVideoElement | undefined {
  const source = live.footage;
  if (!source) return undefined;
  if (typeof HTMLVideoElement !== "undefined" && source instanceof HTMLVideoElement) return source;
  throw new Error(`"${effect.id}" retimes a <video>; a canvas or picture has only the one frame, so give it a video element.`);
}

/** Ms a timing effect's retime lasts on its video, or on the preview clip without one. */
export async function timingPlayLength(effect: TimingEffect, values: Readonly<Record<string, ControlValue>>, video?: HTMLVideoElement): Promise<number> {
  if (!video) return timingLength(effect, PREVIEW_FOOTAGE_MS, values);
  await metadata(video);
  return timingLength(effect, Number.isFinite(video.duration) && video.duration > 0 ? video.duration * 1000 : PREVIEW_FOOTAGE_MS, values);
}

/**
 * Footage for a timing effect at `width` × `height`: its video (paused, with
 * a `restore` that puts it back as it was), or the preview clip.
 */
export async function timingFootage(
  effect: TimingEffect,
  live: Readonly<Record<string, LiveSource>>,
  width: number,
  height: number,
): Promise<{ footage: TimingFootage; restore(): void }> {
  const video = footageVideo(effect, live);
  if (!video) return { footage: previewFootage(width, height), restore: () => undefined };
  const time = video.currentTime;
  const paused = video.paused;
  video.pause();
  return {
    footage: await videoFootage(video, width, height),
    restore() {
      video.currentTime = time;
      if (!paused) void video.play().catch(() => undefined);
    },
  };
}

/** Most pixels across a timing effect's preview on a page: blending is done on the CPU. */
const PREVIEW_MAX_WIDTH = 640;

/** What `mountEffect` gives back for a timing effect (see `MountedEffect`). */
export interface MountedTiming {
  element: HTMLCanvasElement;
  setLive(live: Readonly<Record<string, LiveSource>>): void;
  setValues(values: Record<string, ControlValue>): void;
  play(): void;
  pause(): void;
  dispose(): void;
  ready(): Promise<void>;
}

/**
 * A timing effect playing in `host`: its video (or the preview clip)
 * retimed and drawn on a canvas, frame by frame as fast as frames can be
 * read. `loop: false` plays the retime once.
 */
export function mountTiming(
  host: HTMLElement,
  effect: TimingEffect,
  initial: Record<string, ControlValue>,
  initialLive: Readonly<Record<string, LiveSource>>,
  options: { autoplay?: boolean; loop?: boolean; className?: string },
): MountedTiming {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;width:100%;height:100%;";
  if (options.className) canvas.className = options.className;
  host.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const across = host.clientWidth || 640;
  const down = host.clientHeight || 360;
  canvas.width = Math.max(2, Math.min(PREVIEW_MAX_WIDTH, Math.round(across * Math.min(2, globalThis.devicePixelRatio || 1))));
  canvas.height = Math.max(2, Math.round((canvas.width * down) / across));
  const image = ctx.createImageData(canvas.width, canvas.height);

  let values = initial;
  let current: Promise<{ renderer: TimingRenderer; restore(): void }>;
  const load = (live: Readonly<Record<string, LiveSource>>) =>
    timingFootage(effect, live, canvas.width, canvas.height).then(({ footage, restore }) => ({ renderer: new TimingRenderer(effect, footage, { values }), restore }));
  current = load(initialLive);

  let raf = 0;
  let started = 0;
  let at = 0;
  let busy = false;
  let disposed = false;
  let first: Promise<void> | undefined;
  const draw = async (ms: number) => {
    const { renderer } = await current;
    if (disposed) return;
    const length = renderer.length;
    const time = options.loop === false ? Math.min(ms, Math.max(0, length - 1)) : length > 0 ? ms % length : 0;
    await renderer.render(time, image.data);
    if (!disposed) ctx.putImageData(image, 0, 0);
  };
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (busy) return;
    at = now - started;
    busy = true;
    void draw(at).finally(() => (busy = false));
  };
  const play = () => {
    if (raf || disposed) return;
    started = performance.now() - at;
    raf = requestAnimationFrame(frame);
  };
  const pause = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  first = draw(0);
  first.catch(() => undefined);
  if (options.autoplay ?? true) play();

  return {
    element: canvas,
    setLive(live) {
      const before = current;
      current = load(live);
      void before.then((b) => b.restore()).catch(() => undefined);
      first = draw(at);
      first.catch(() => undefined);
    },
    setValues(next) {
      // Checked here, so a bad value throws to the caller and changes nothing.
      const checked = timingValues(effect, { values: { ...values, ...next } });
      if (checked.issues.length) throw new Error(checked.issues.join(" "));
      values = checked.values;
      void current.then(({ renderer }) => renderer.setValues(values));
    },
    play,
    pause,
    dispose() {
      disposed = true;
      pause();
      void current.then((c) => c.restore()).catch(() => undefined);
      canvas.remove();
    },
    ready: async () => {
      await first;
    },
  };
}
