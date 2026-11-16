import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import type { ControlValue } from "@pixerate/flair";
import { effectControls, effectDefaults, getEffect, renderVectorEffect, SAMPLE_IMAGES, type EffectDefinition, type ShaderEffect } from "@pixerate/flair/catalog";
import { exportEffect, ffmpegPath, findChrome, probeVideo, vectorTimeline, type NodeSubject } from "@pixerate/flair/node";
import { decodeFolder, decodeImages, decodeVideo, pictureSize } from "./frames.ts";
import { KIND_OF_TYPE, type EvalTask, type Frames, type RenderResult } from "./types.ts";

/** Pictures the harness applies filters and transitions to: the catalog's own sample photos. */
export const TEST_PICTURES = { photo: SAMPLE_IMAGES.landscape, from: SAMPLE_IMAGES.landscape, to: SAMPLE_IMAGES.city } as const;

/** Text a vector effect is given when the task does not say. */
export const DEFAULT_TEXT = "Launch day";

export interface RenderOptions {
  /** Frames to render (default 6). */
  frames?: number;
  /** Shader frame size (default 480 × 270); vector effects keep their shape, `width` wide. */
  width?: number;
  height?: number;
  /** Software GL: the same frames on every machine, slower. */
  software?: boolean;
  /** Words for a vector effect's text control. */
  text?: string;
}

/** Whether ffmpeg runs here (it reads rendered frames, pictures and videos back). */
export function ffmpegAvailable(): boolean {
  return spawnSync(ffmpegPath(), ["-version"], { stdio: "ignore" }).status === 0;
}

/** Whether headless rendering can run here: Chrome for frames, ffmpeg to read them back. */
export function renderAvailable(): boolean {
  return findChrome() !== null && ffmpegAvailable();
}

/** Seconds a render covers: a shader's loop when it loops within 6 s, else 3; a vector effect's play-through. */
export function renderSeconds(effect: EffectDefinition, text?: string): number {
  if (effect.kind === "vector") {
    const values = { ...effectDefaults(effect), ...textValues(effect, text) };
    const motion = renderVectorEffect(effect, values);
    return Math.max(0.5, vectorTimeline(effect, motion).length / 1000);
  }
  if (effect.kind === "shader" && typeof effect.loop === "number" && effect.loop > 0 && effect.loop <= 6) return effect.loop;
  return 3;
}

/** A vector effect's first text control set to `text`. */
function textValues(effect: EffectDefinition, text?: string): Record<string, ControlValue> {
  if (text === undefined) return {};
  const control = effectControls(effect).find((c) => c.type === "text");
  return control ? { [control.name]: text } : {};
}

/** A small shader that shows one picture stretched to the frame, to render the test pictures. */
const PICTURE: ShaderEffect = {
  kind: "shader",
  id: "eval-picture",
  name: "Picture",
  category: "image",
  description: "Shows a picture.",
  tags: [],
  source: `uniform sampler2D uImage; // @control default="" label="Image"
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = vec4(texture(uImage, fragCoord / iResolution.xy).rgb, 1.0);
}`,
};

/** A picture (URL or data URL) rendered to RGBA at `width` × `height`. */
export async function renderPicture(image: string, dir: string, width: number, height: number, software = false): Promise<Frames> {
  const out = path.join(dir, "picture");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  await exportEffect(PICTURE, { outputPath: path.join(out, "f_%03d.png"), subject: { image }, width, height, fps: 1, duration: 1, software });
  return decodeFolder(out);
}

/** Renders `effect` into `dir/name` as PNG frames and reads them back. */
async function renderFrames(effect: EffectDefinition, dir: string, name: string, options: { subject?: NodeSubject | NodeSubject[]; values?: Record<string, ControlValue>; frames: number; seconds: number; width?: number; height?: number; alpha?: boolean; software?: boolean }): Promise<Frames> {
  const out = path.join(dir, name);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  await exportEffect(effect, {
    outputPath: path.join(out, "f_%03d.png"),
    subject: options.subject,
    values: options.values,
    width: options.width,
    height: options.height,
    fps: options.frames / options.seconds,
    duration: options.seconds,
    alpha: options.alpha,
    software: options.software,
    ignoreUnknownControls: true,
    // A draft that cannot draw stalls rather than failing; a frame this small never takes this long.
    stallTimeoutMs: 30_000,
  });
  const frames = await decodeFolder(out);
  return { ...frames, data: frames.data.slice(0, options.frames) };
}

/**
 * Renders an effect the way its task's type is used: a background alone, a filter on the test photo,
 * an overlay with alpha, a transition at progress steps from 0 to 1, an interactive effect with a
 * scripted pointer, a vector effect over its play-through. Fails with the compiler's or renderer's
 * message rather than throwing.
 */
export async function renderForTask(task: Pick<EvalTask, "type">, effect: EffectDefinition, dir: string, options: RenderOptions = {}): Promise<RenderResult> {
  const started = Date.now();
  const frames = options.frames ?? 6;
  const width = options.width ?? 480;
  const height = options.height ?? 270;
  const software = options.software ?? false;
  const empty: Frames = { width: 0, height: 0, data: [] };
  try {
    if (KIND_OF_TYPE[task.type] === "vector") {
      if (effect.kind !== "vector") throw new Error(`It is a ${effect.kind} effect, not a vector effect.`);
      const values = textValues(effect, options.text ?? DEFAULT_TEXT);
      const result = await renderFrames(effect, dir, "frames", { values, frames, seconds: renderSeconds(effect, options.text ?? DEFAULT_TEXT), width, software });
      return { ok: true, frames: result, ms: Date.now() - started };
    }
    if (effect.kind !== "shader") throw new Error(`It is a ${effect.kind} effect, not a shader.`);
    const size = { width, height, software };
    const seconds = renderSeconds(effect);
    if (task.type === "transition") {
      const still: Record<string, ControlValue> = effectControls(effect).some((c) => c.name === "uAnimate") ? { uAnimate: false } : {};
      const subject: NodeSubject[] = [{ image: TEST_PICTURES.from }, { image: TEST_PICTURES.to }];
      const steps: Buffer[] = [];
      let shape = { width, height };
      for (let i = 0; i < frames; i++) {
        const at = await renderFrames(effect, dir, `progress-${i}`, { ...size, subject, values: { ...still, uProgress: i / (frames - 1) }, frames: 1, seconds: 1 });
        shape = { width: at.width, height: at.height };
        steps.push(at.data[0]!);
      }
      const all: Frames = { ...shape, data: steps };
      const one = (i: number): Frames => ({ ...shape, data: [steps[i]!] });
      const from = await renderPicture(TEST_PICTURES.from, dir, shape.width, shape.height, software);
      const to = await renderPicture(TEST_PICTURES.to, dir, shape.width, shape.height, software);
      return { ok: true, frames: all, transition: { at0: one(0), mid: one(Math.floor((frames - 1) / 2)), at1: one(frames - 1), from, to }, ms: Date.now() - started };
    }
    const subject: NodeSubject | undefined = task.type === "filter" ? { image: TEST_PICTURES.photo } : undefined;
    const result = await renderFrames(effect, dir, "frames", { ...size, subject, frames, seconds, alpha: task.type === "overlay" });
    return { ok: true, frames: result, ms: Date.now() - started };
  } catch (e) {
    return { ok: false, error: (e as Error).message.trim(), frames: empty, ms: Date.now() - started };
  }
}

/** A reference task's frames, its length in seconds, and the catalog effect behind it (if any). */
export interface Reference {
  frames: Frames;
  seconds: number;
  effect?: EffectDefinition;
  render?: RenderResult;
}

/** Renders or reads a reference task's frames into `dir`. */
export async function loadReference(task: EvalTask, dir: string, options: RenderOptions = {}): Promise<Reference> {
  const r = task.reference;
  if (!r) throw new Error(`Task "${task.id}" has no reference.`);
  const count = r.frames ?? options.frames ?? 6;
  if (r.effect) {
    const effect = getEffect(r.effect);
    if (!effect) throw new Error(`Task "${task.id}" names catalog effect "${r.effect}", which does not exist.`);
    const render = await renderForTask(task, effect, dir, { ...options, frames: count, text: r.text ?? options.text });
    if (!render.ok) throw new Error(`The reference "${r.effect}" did not render: ${render.error}`);
    const seconds = task.type === "transition" ? 0 : effect.kind === "vector" ? renderSeconds(effect, r.text ?? DEFAULT_TEXT) : renderSeconds(effect);
    return { frames: render.frames, seconds, effect, render };
  }
  const long = options.width ?? 480;
  const fit = (s: { width: number; height: number }) => {
    const scale = long / Math.max(s.width, s.height);
    return { width: Math.max(2, Math.round((s.width * scale) / 2) * 2), height: Math.max(2, Math.round((s.height * scale) / 2) * 2) };
  };
  if (r.video) {
    const size = fit(await pictureSize(r.video));
    const frames = await decodeVideo(r.video, count, size.width, size.height);
    return { frames, seconds: (await probeVideo(r.video)).duration ?? count };
  }
  const size = fit(await pictureSize(r.images![0]!));
  return { frames: await decodeImages(r.images!, size.width, size.height), seconds: 0 };
}

