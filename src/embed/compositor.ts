/**
 * A {@link ScenePlan} drawn frame by frame onto a canvas. It reads only the
 * plan (no catalog), so the standalone scene page can carry it. Shader
 * layers render with `ShaderFrames`, vector layers with `svgView`, both on
 * the scene's clock, and a shot's transition blends the last shot's final
 * frame into the new one.
 */

import { textImage } from "../catalog/images.js";
import { boardHeight, projectPoint, type View } from "../scene/camera.js";
import type { SceneElement, Rect } from "../scene/geometry.js";
import { isSlot, type SceneSubject, type SlotSubject } from "../scene/layers.js";
import { keyAt, planLayerOpacity, SCENE_PLAN_VERSION, type PlanDraw, type PlanLayer, type PlanTransition, type ScenePlan } from "../scene/plan-types.js";
import { ShaderFrames } from "../shader/frames.js";
import { seekVideo, type LiveSource } from "../shader/textures.js";
import { svgDuration, svgView, type SvgView } from "../vector/svg.js";

/** Subjects for a scene's slots: what a scene could write, or a live `<video>` or canvas. */
export type SceneSlotSubjects = Record<string, SlotSubject>;

export interface SceneCompositorOptions {
  /** Pixels (default the scene's stage). */
  width?: number;
  height?: number;
  /** What fills the plan's slots. */
  subjects?: SceneSlotSubjects;
  /** Draw on this canvas (default a new one). */
  canvas?: HTMLCanvasElement;
  /**
   * Videos follow the scene's time exactly, sought to each frame (default
   * true, for recordings); false lets them play, nudged back when they drift
   * (for a page).
   */
  exact?: boolean;
  /** Draw the shots' titles and captions (default true). */
  words?: boolean;
  /** The colour under everything (default black). */
  background?: string;
}

/** An SVG as a URL: markup becomes a UTF-8 `data:` URL; a URL stays as it is. */
function svgUrl(svg: string): string {
  const markup = svg.trim();
  if (!markup.startsWith("<")) return svg;
  const withNs = /\sxmlns\s*=/.test(markup.slice(0, markup.indexOf(">") + 1)) ? markup : markup.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withNs)}`;
}

const isLive = (v: unknown): v is LiveSource => !!v && typeof v === "object";

function newCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`The picture at ${url.slice(0, 80)} could not be loaded; a picture from another site needs CORS.`));
    img.src = url;
  });
}

function videoFrom(url: string): HTMLVideoElement {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  return video;
}

/** What one layer draws with, made ready once. */
interface Drawer {
  /** Its pixels at `localMs` into the layer (`ms` on the scene's timeline), sized `w` × `h`. */
  draw(localMs: number, ms: number, w: number, h: number): Promise<CanvasImageSource | undefined>;
  dispose(): void;
}

/** Where the board is drawn: scene units to output pixels through the view. */
interface BoardSpace {
  view: View;
  /** Output pixels per stage pixel. */
  scale: number;
}

/**
 * Draws a {@link ScenePlan} at any time onto a 2D canvas: the background
 * layers, the element board through the camera (its angle in perspective),
 * layers placed on the board, overlays, and the title and caption; a
 * transition blends the outgoing shot's last frame (`uFrom`) into the
 * incoming one (`uTo`). `await ready()` first, then `await draw(ms)`.
 */
export class SceneCompositor {
  readonly canvas: HTMLCanvasElement;
  readonly plan: ScenePlan;
  readonly width: number;
  readonly height: number;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly options: SceneCompositorOptions;
  private readonly drawers = new Map<string, Drawer>();
  private readonly transitions = new Map<number, { frames: ShaderFrames; from: HTMLCanvasElement; to: HTMLCanvasElement; fromDrawn: boolean }>();
  private readonly host: HTMLDivElement;
  private readonly elements: { id: string; keys: { ms: number; element: SceneElement | null }[] }[];
  private readyPromise: Promise<void> | undefined;

  constructor(plan: ScenePlan, options: SceneCompositorOptions = {}) {
    if (plan.version !== SCENE_PLAN_VERSION) throw new Error(`This player draws scene plans of version ${SCENE_PLAN_VERSION}; this one is version ${String(plan.version)}. Make it again with scenePlan(scene).`);
    this.plan = plan;
    this.options = options;
    this.width = Math.round(options.width ?? plan.stage.width);
    this.height = Math.round(options.height ?? plan.stage.height);
    this.canvas = options.canvas ?? newCanvas(this.width, this.height);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot draw on a canvas, so it cannot draw the scene.");
    this.ctx = ctx;
    this.elements = plan.elements;
    // Vector layers are laid out in the page (out of sight), so fonts and sizes resolve as on screen.
    this.host = document.createElement("div");
    this.host.setAttribute("aria-hidden", "true");
    this.host.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;";
    document.body.appendChild(this.host);
  }

  /** Compiles every layer's shader and loads its pictures. Rejects with a sentence when one cannot be drawn. */
  ready(): Promise<void> {
    this.readyPromise ??= this.prepare();
    return this.readyPromise;
  }

  private async prepare() {
    const waits: Promise<unknown>[] = [];
    for (const layer of this.plan.layers) {
      const drawer = this.drawerFor(layer, waits);
      if (drawer) this.drawers.set(layer.key, drawer);
    }
    for (const t of this.plan.transitions) {
      const from = newCanvas(this.width, this.height);
      const to = newCanvas(this.width, this.height);
      // The pictures are the two canvases, so the image controls load nothing of their own.
      const frames = new ShaderFrames({ source: t.draw.source, values: { ...t.draw.values, [t.controls.from]: "", [t.controls.to]: "" }, width: this.width, height: this.height });
      frames.setLiveSource(t.controls.from, from);
      frames.setLiveSource(t.controls.to, to);
      waits.push(frames.ready());
      this.transitions.set(t.shot, { frames, from, to, fromDrawn: false });
    }
    await Promise.all(waits);
  }

  /** A layer's subject, with its slot filled. */
  private subjectOf(layer: PlanLayer): SceneSubject | { video: LiveSource } | undefined {
    const s = layer.subject;
    if (!s) return undefined;
    if (isSlot(s)) return this.options.subjects?.[s.slot] as SceneSubject | { video: LiveSource } | undefined;
    return s;
  }

  /** The video a layer shows, kept in step with the scene's time. */
  private follow(video: HTMLVideoElement, localMs: number): Promise<void> | void {
    const t = video.duration > 0 && Number.isFinite(video.duration) ? (localMs / 1000) % video.duration : localMs / 1000;
    if (this.options.exact !== false) return seekVideo(video, t);
    if (video.paused) void video.play().catch(() => undefined);
    if (Math.abs(video.currentTime - t) > 0.3) video.currentTime = t;
  }

  private drawerFor(layer: PlanLayer, waits: Promise<unknown>[]): Drawer | undefined {
    const subject = this.subjectOf(layer);
    const draw = layer.draw;
    const size = this.nominalSize(layer);
    if (draw.kind === "shader") return this.shaderDrawer(layer.key, draw, subject, size, waits);
    if (draw.kind === "vector") return this.vectorDrawer(draw);
    if (!subject) return undefined;
    // A bare picture.
    if ("text" in subject) {
      const url = textImage(subject.text, { ...(subject.font ? { font: subject.font } : {}), ...(subject.weight !== undefined ? { weight: subject.weight } : {}) });
      let img: HTMLImageElement | undefined;
      waits.push(loadImage(url).then((i) => (img = i)));
      return { draw: async () => img, dispose() {} };
    }
    if ("video" in subject) {
      const video = typeof subject.video === "string" ? videoFrom(subject.video) : (subject.video as LiveSource);
      return {
        draw: async (local) => {
          if (typeof HTMLVideoElement !== "undefined" && video instanceof HTMLVideoElement) await this.follow(video, local);
          return video as CanvasImageSource;
        },
        dispose: () => {
          if (typeof subject.video === "string") (video as HTMLVideoElement).removeAttribute("src");
        },
      };
    }
    const url = "svg" in subject ? svgUrl(subject.svg) : subject.image;
    let img: HTMLImageElement | undefined;
    waits.push(loadImage(url).then((i) => (img = i)));
    return { draw: async () => img, dispose() {} };
  }

  private shaderDrawer(key: string, draw: Extract<PlanDraw, { kind: "shader" }>, subject: ReturnType<SceneCompositor["subjectOf"]>, size: [number, number], waits: Promise<unknown>[]): Drawer {
    const values = { ...draw.values };
    let video: HTMLVideoElement | undefined;
    let live: LiveSource | undefined;
    if (subject && draw.subjectControl) {
      if ("text" in subject) values[draw.subjectControl] = textImage(subject.text, { ...(subject.font ? { font: subject.font } : {}), ...(subject.weight !== undefined ? { weight: subject.weight } : {}) });
      else if ("svg" in subject) values[draw.subjectControl] = svgUrl(subject.svg);
      else if ("image" in subject) values[draw.subjectControl] = subject.image;
      else if (typeof subject.video === "string") live = video = videoFrom(subject.video);
      else if (isLive(subject.video)) {
        live = subject.video;
        if (typeof HTMLVideoElement !== "undefined" && live instanceof HTMLVideoElement) video = live;
      }
      if (live) values[draw.subjectControl] = "";
    }
    let frames: ShaderFrames;
    try {
      frames = new ShaderFrames({ source: draw.source, values, width: size[0], height: size[1], alpha: true });
    } catch (e) {
      throw new Error(`Layer "${key}"${draw.effect ? ` ("${draw.effect}")` : ""} cannot be drawn: ${(e as Error).message}`, { cause: e });
    }
    if (live && draw.subjectControl) frames.setLiveSource(draw.subjectControl, live);
    waits.push(frames.ready());
    const layer = this.plan.layers.find((l) => l.key === key)!;
    return {
      draw: async (local, ms) => {
        if (video) await this.follow(video, local);
        const track = layer.tracks ? keyAt(layer.tracks, ms) : undefined;
        if (track) frames.setValues({ ...values, ...track.values });
        frames.render(local / 1000, { delta: 1 / this.plan.fps });
        return frames.canvas;
      },
      dispose: () => frames.dispose(),
    };
  }

  private vectorDrawer(draw: Extract<PlanDraw, { kind: "vector" }>): Drawer {
    const view: SvgView = svgView(draw.motion);
    const box = document.createElement("div");
    box.appendChild(view.element);
    this.host.appendChild(box);
    const loop = svgDuration(draw.motion) + draw.holdMs;
    return {
      draw: async (local, _ms, w, h) => {
        box.style.width = `${w}px`;
        box.style.height = `${h}px`;
        view.draw(loop > 0 ? local % loop : local);
        return view.capture({ width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) });
      },
      dispose: () => box.remove(),
    };
  }

  /** The pixels a layer is drawn at: the output for a screen layer, its box on the board at zoom 1 otherwise. */
  private nominalSize(layer: PlanLayer): [number, number] {
    const s = this.width / this.plan.stage.width;
    const box = this.layerBox(layer, layer.startMs);
    if (!box) return [this.width, this.height];
    const cap = (n: number) => Math.max(16, Math.min(2048, Math.round(n * s)));
    return [cap(box.width), cap(box.height)];
  }

  /** The elements at a time, as the plan keys them. */
  elementsAt(ms: number): SceneElement[] {
    const out: SceneElement[] = [];
    for (const e of this.elements) {
      const key = keyAt(e.keys, ms);
      if (key?.element && !key.element.isDeleted) out.push(key.element);
    }
    return out;
  }

  /** A layer's box on the board (undefined for a screen layer, or elements not drawn yet). */
  private layerBox(layer: PlanLayer, ms: number): Rect | undefined {
    const place = layer.place;
    if ("rect" in place) return place.rect;
    if (!("ids" in place)) return undefined;
    const wanted = new Set(place.ids);
    const els = this.elementsAt(ms).filter((el) => wanted.has(el.id) || wanted.has(el.id.replace(/_\d+$/, "")));
    if (!els.length) return undefined;
    const x0 = Math.min(...els.map((e) => e.x)) - place.padding;
    const y0 = Math.min(...els.map((e) => e.y)) - place.padding;
    const x1 = Math.max(...els.map((e) => e.x + e.width)) + place.padding;
    const y1 = Math.max(...els.map((e) => e.y + e.height)) + place.padding;
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }

  /** The camera at a time. */
  viewAt(ms: number): View {
    return (keyAt(this.plan.camera, ms) ?? this.plan.camera[0])?.view ?? { zoom: 1, scrollX: 0, scrollY: 0 };
  }

  /**
   * Sets `ctx` to draw a board box's local space (0 to its width and
   * height): its corners through the camera, as an affine fit of three of
   * them (exact flat; close in perspective). False when it is behind the camera.
   */
  private toBoard(ctx: CanvasRenderingContext2D, space: BoardSpace, box: Rect): boolean {
    const stage = this.plan.stage;
    const p0 = projectPoint(space.view, stage, [box.x, box.y]);
    const p1 = projectPoint(space.view, stage, [box.x + box.width, box.y]);
    const p2 = projectPoint(space.view, stage, [box.x, box.y + box.height]);
    if (!p0 || !p1 || !p2) return false;
    const s = space.scale;
    const w = box.width || 1;
    const h = box.height || 1;
    ctx.setTransform(((p1[0] - p0[0]) * s) / w, ((p1[1] - p0[1]) * s) / w, ((p2[0] - p0[0]) * s) / h, ((p2[1] - p0[1]) * s) / h, p0[0] * s, p0[1] * s);
    return true;
  }

  private drawElement(ctx: CanvasRenderingContext2D, space: BoardSpace, el: SceneElement) {
    const style = el as SceneElement & { backgroundColor?: string; strokeColor?: string; rotation?: number };
    const box = { x: el.x, y: el.y, width: el.width, height: el.height };
    ctx.save();
    if (!this.toBoard(ctx, space, box)) return ctx.restore();
    ctx.globalAlpha *= el.opacity ?? 1;
    if (style.rotation) {
      ctx.translate(el.width / 2, el.height / 2);
      ctx.rotate((style.rotation * Math.PI) / 180);
      ctx.translate(-el.width / 2, -el.height / 2);
    }
    ctx.fillStyle = style.backgroundColor || "rgba(59, 130, 246, 0.4)";
    ctx.strokeStyle = style.strokeColor || "#3b82f6";
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (el.type === "ellipse") ctx.ellipse(el.width / 2, el.height / 2, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
    else if (el.points?.length) el.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    else ctx.rect(0, 0, el.width, el.height);
    if (!el.points?.length) ctx.fill();
    ctx.stroke();
    if (el.text) {
      ctx.fillStyle = "#fff";
      ctx.font = `${el.fontSize ?? 24}px sans-serif`;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(el.text, 16, Math.min(el.height - 8, 16 + (el.fontSize ?? 24)));
    }
    ctx.restore();
  }

  private async drawLayer(ctx: CanvasRenderingContext2D, space: BoardSpace, layer: PlanLayer, ms: number) {
    const drawer = this.drawers.get(layer.key);
    const opacity = planLayerOpacity(layer, ms);
    if (!drawer || opacity <= 0) return;
    const box = this.layerBox(layer, ms);
    if (!("screen" in layer.place) && !box) return;
    const size = box ? this.nominalSize(layer) : [this.width, this.height];
    const pixels = await drawer.draw(ms - layer.startMs, ms, size[0]!, size[1]!);
    if (!pixels) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    if (box) {
      if (this.toBoard(ctx, space, box)) ctx.drawImage(pixels, 0, 0, box.width, box.height);
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(pixels, 0, 0, this.width, this.height);
    }
    ctx.restore();
  }

  private drawWords(ctx: CanvasRenderingContext2D, ms: number) {
    const shot = this.plan.shots[shotIndexAt(this.plan, ms)];
    if (!shot) return;
    const s = this.width / this.plan.stage.width;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (shot.title) {
      ctx.font = `600 ${Math.round(30 * s)}px system-ui, sans-serif`;
      const w = ctx.measureText(shot.title).width + 64 * s;
      const h = 60 * s;
      const x = this.width / 2 - w / 2;
      const y = 24 * s;
      ctx.fillStyle = "rgba(15, 17, 23, 0.85)";
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(shot.title, this.width / 2, y + h / 2);
    }
    if (shot.caption) {
      const band = (this.plan.stage.caption ?? 0) * s;
      ctx.font = `${Math.round(28 * s)}px system-ui, sans-serif`;
      const w = Math.min(this.width * 0.9, ctx.measureText(shot.caption).width + 40 * s);
      const h = 52 * s;
      const y = band > 0 ? boardHeight(this.plan.stage) * s + (band - h) / 2 : this.height - h - 64 * s;
      ctx.fillStyle = "rgba(15, 17, 23, 0.88)";
      ctx.beginPath();
      ctx.roundRect(this.width / 2 - w / 2, y, w, h, 8 * s);
      ctx.fill();
      ctx.fillStyle = "#f1f5f9";
      ctx.fillText(shot.caption, this.width / 2, y + h / 2, w - 40 * s);
    }
    ctx.restore();
  }

  /** Draws the scene (without a transition) at `ms` onto `ctx`. */
  private async drawScene(ctx: CanvasRenderingContext2D, ms: number) {
    const space: BoardSpace = { view: this.viewAt(ms), scale: this.width / this.plan.stage.width };
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.options.background ?? "#000";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
    const showing = this.plan.layers.filter((l) => ms >= l.startMs && ms < l.endMs);
    for (const layer of showing.filter((l) => l.role === "background")) await this.drawLayer(ctx, space, layer, ms);
    // The board: its elements, then the layers placed on it, blurred while the camera moves fast.
    const blur = (space.view.blur ?? 0) * space.scale;
    if (blur >= 0.5) ctx.filter = `blur(${blur.toFixed(1)}px)`;
    for (const el of this.elementsAt(ms)) this.drawElement(ctx, space, el);
    for (const layer of showing.filter((l) => l.role === "subject")) await this.drawLayer(ctx, space, layer, ms);
    ctx.filter = "none";
    for (const layer of showing.filter((l) => l.role === "overlay")) await this.drawLayer(ctx, space, layer, ms);
  }

  /** Draws the frame at `ms` on the scene's timeline. */
  async draw(ms: number): Promise<void> {
    await this.ready();
    const t = this.plan.transitions.find((x) => ms >= x.startMs && ms < x.startMs + x.ms);
    const ready = t && this.transitions.get(t.shot);
    if (t && ready) {
      await this.drawTransition(t, ready, ms);
    } else {
      await this.drawScene(this.ctx, ms);
    }
    if (this.options.words !== false) this.drawWords(this.ctx, ms);
  }

  private async drawTransition(t: PlanTransition, parts: { frames: ShaderFrames; from: HTMLCanvasElement; to: HTMLCanvasElement; fromDrawn: boolean }, ms: number) {
    // The outgoing shot's last frame, drawn once; the incoming shot as it plays.
    if (!parts.fromDrawn) {
      await this.drawScene(parts.from.getContext("2d")!, Math.max(0, t.startMs - 1));
      parts.fromDrawn = true;
    }
    await this.drawScene(parts.to.getContext("2d")!, ms);
    const progress = Math.min(1, Math.max(0, (ms - t.startMs) / t.ms));
    parts.frames.setValues({ ...t.draw.values, [t.controls.from]: "", [t.controls.to]: "", [t.controls.progress]: progress, [t.controls.animate]: false });
    parts.frames.render((ms - t.startMs) / 1000, { delta: 1 / this.plan.fps });
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(parts.frames.canvas, 0, 0, this.width, this.height);
    this.ctx.restore();
  }

  /** Lets go of the shaders, pictures and the hidden layout box. */
  dispose(): void {
    for (const d of this.drawers.values()) d.dispose();
    for (const t of this.transitions.values()) t.frames.dispose();
    this.drawers.clear();
    this.transitions.clear();
    this.host.remove();
  }
}

/** The shot (0-based) playing at `ms` in a plan. */
export function shotIndexAt(plan: ScenePlan, ms: number): number {
  let shot = 0;
  for (const s of plan.shots) if (ms >= s.startMs) shot = s.index;
  return shot;
}

