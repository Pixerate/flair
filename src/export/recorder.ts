// gifenc ships without types; the reference brings them along.
/// <reference path="../shader/gifenc.d.ts" />
import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { controlValue, parseControls, type ControlValue, type TextureSettings } from '../shader/controls.js';
import { MAX_CLICKS, MAX_TRAIL, PointerTracker, TRAIL_SECONDS } from '../shader/pointer.js';
import { VERTEX_SOURCE, wrapSource } from '../shader/program.js';
import { SVG_EDGE } from '../shader/textures.js';

// ==========================================
// Tools: Chrome and ffmpeg
// ==========================================

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

/** Chromium builds Playwright downloaded (`npx playwright install chromium`), newest first. */
function playwrightChromes(): string[] {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(os.homedir(), 'Library/Caches/ms-playwright'),
    path.join(os.homedir(), '.cache/ms-playwright'),
  ].filter((r): r is string => Boolean(r));
  const found: string[] = [];
  for (const root of roots) {
    let dirs: string[] = [];
    try {
      dirs = fs.readdirSync(root).filter((d) => /^chromium-\d+$/.test(d));
    } catch {
      continue;
    }
    dirs.sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const dir of dirs) {
      for (const bin of [
        'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
        'chrome-linux/chrome',
        'chrome-linux64/chrome',
      ]) found.push(path.join(root, dir, bin));
    }
  }
  return found;
}

/**
 * Finds a local Chrome or Chromium executable, or `null`: `CHROME_PATH` (or
 * `CHROME_BIN`), then the usual install places, then a Chromium Playwright
 * downloaded.
 */
export function findChrome(): string | null {
  const env = process.env.CHROME_PATH || process.env.CHROME_BIN;
  if (env) return env;
  return [...CHROME_CANDIDATES, ...playwrightChromes()].find((candidate) => fs.existsSync(candidate)) ?? null;
}

/** The ffmpeg to run: `FFMPEG_PATH`, else `ffmpeg` on the `PATH`. */
export function ffmpegPath(): string {
  return process.env.FFMPEG_PATH || 'ffmpeg';
}

const NO_FFMPEG =
  'ffmpeg is not installed (or not on the PATH). Install it (brew install ffmpeg, apt install ffmpeg), or set FFMPEG_PATH; GIF, PNG and SVG output do not need it.';

// ==========================================
// Output formats
// ==========================================

/** A file type the exporter writes, from the output path. */
export type OutputFormat = 'mp4' | 'webm' | 'mov' | 'gif' | 'png' | 'svg';

/** What to write and how. */
export interface OutputPlan {
  format: OutputFormat;
  /** The output path, resolved. For a PNG sequence, a printf pattern (`…/frame_%04d.png`). */
  path: string;
  /** Whether the frames keep their alpha. */
  alpha: boolean;
  /** ffmpeg's arguments after the input (for mp4, webm and mov). */
  ffmpegArgs?: string[];
}

/**
 * Works out the format from `outputPath`'s extension and what alpha it can
 * keep. A path with no extension, or ending in a slash, is a folder of PNG
 * frames; a `.png` path with a `%d` pattern (`out_%04d.png`) names each
 * frame, and one without gets `_%04d` added (unless there is one frame).
 * Throws a sentence for formats it cannot write, and for alpha in MP4.
 */
export function planOutput(outputPath: string, options: { alpha?: boolean; frames?: number } = {}): OutputPlan {
  const resolved = path.resolve(process.cwd(), outputPath);
  const trailingSlash = /[\\/]$/.test(outputPath);
  const ext = trailingSlash ? '' : path.extname(resolved).toLowerCase();
  const alpha = Boolean(options.alpha);
  switch (ext) {
    case '': {
      return { format: 'png', path: path.join(resolved, 'frame_%04d.png'), alpha };
    }
    case '.png': {
      if (/%0?\d*d/.test(resolved) || (options.frames ?? 2) === 1) return { format: 'png', path: resolved, alpha };
      return { format: 'png', path: resolved.replace(/\.png$/i, '_%04d.png'), alpha };
    }
    case '.gif':
      return { format: 'gif', path: resolved, alpha };
    case '.svg':
      return { format: 'svg', path: resolved, alpha };
    case '.mp4':
    case '.m4v': {
      if (alpha) throw new Error('MP4 (H.264) cannot hold alpha; write .webm, .mov, .gif or .png frames for a transparent render, or drop --alpha.');
      return {
        format: 'mp4',
        path: resolved,
        alpha,
        ffmpegArgs: [
          // yuv420p needs even sizes; sRGB pixels go to BT.709, tagged so players show the same colours.
          '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
          '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
          '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
          '-movflags', '+faststart',
        ],
      };
    }
    case '.webm':
      return {
        format: 'webm',
        path: resolved,
        alpha,
        ffmpegArgs: alpha
          ? ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '30', '-auto-alt-ref', '0', '-row-mt', '1']
          : ['-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', '-b:v', '0', '-crf', '30', '-row-mt', '1',
             '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709'],
      };
    case '.mov':
      return {
        format: 'mov',
        path: resolved,
        alpha,
        ffmpegArgs: [
          '-c:v', 'prores_ks', '-profile:v', '4444', '-vendor', 'apl0',
          '-pix_fmt', alpha ? 'yuva444p10le' : 'yuv444p10le',
          ...(alpha ? ['-alpha_bits', '16'] : []),
          '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
        ],
      };
    default:
      throw new Error(`Flair cannot write "${ext}" files; write .mp4, .webm, .mov, .gif, .svg, or .png frames (a folder, or a pattern like out_%04d.png).`);
  }
}

/** A frame number put into a PNG sequence's printf pattern (`%04d`, `%d`). */
export function sequencePath(pattern: string, frame: number): string {
  return pattern.replace(/%(0?)(\d*)d/, (_, zero: string, width: string) => String(frame).padStart(Number(width || 0), zero ? '0' : ' '));
}

// ==========================================
// The pointer, scripted
// ==========================================

/** Pointer uniforms for one frame. */
export interface PointerFrame {
  mouse: [number, number, number, number];
  pointer: [number, number, number, number];
  /** `iClicks`, MAX_CLICKS × 4 numbers. */
  clicks: number[];
  /** `iTrail`, MAX_TRAIL × 4 numbers. */
  trail: number[];
}

/**
 * A pointer that shows off an interactive shader in a recording: it hovers
 * over the canvas from the start, wanders a figure-of-eight (so trails have
 * a path), and clicks every `interval` seconds, holding each press for a
 * moment. Returns the uniforms for each frame time, in order.
 */
export function scriptedPointer(width: number, height: number, times: readonly number[], options: { interval?: number; period?: number } = {}): PointerFrame[] {
  const interval = options.interval ?? 0.8;
  const period = Math.max(2, options.period ?? (times[times.length - 1] ?? 2));
  const at = (t: number): [number, number] => [
    width * (0.5 + 0.3 * Math.sin((2 * Math.PI * t) / period)),
    height * (0.5 + 0.22 * Math.sin((4 * Math.PI * t) / period)),
  ];
  const press = 0.25;
  const tracker = new PointerTracker();
  tracker.hover(true, 0);
  tracker.move(...at(0), 0);
  let clock = 0;
  let nextClick = 0.25;
  let release = Infinity;
  let mouse: [number, number, number, number] = [0, 0, 0, 0];
  const frames: PointerFrame[] = [];
  for (const time of times) {
    // Walk the script up to `time` in trail-sized steps, so the trail and clicks land where they would live.
    while (clock < time) {
      const next = Math.min(time, clock + TRAIL_SECONDS, nextClick, release);
      clock = next;
      const [x, y] = at(clock);
      tracker.move(x, y, clock);
      if (mouse[2] > 0) mouse = [x, y, mouse[2], mouse[3]];
      if (clock >= release) {
        tracker.up(clock);
        mouse = [mouse[0], mouse[1], -mouse[2], -Math.abs(mouse[3])];
        release = Infinity;
      }
      if (clock >= nextClick) {
        tracker.down(x, y, clock);
        mouse = [x, y, x, y];
        release = clock + press;
        nextClick = clock + interval;
      }
    }
    frames.push({
      mouse: [...mouse],
      pointer: tracker.pointer(time),
      clicks: [...tracker.clicksAt(time)],
      trail: [...tracker.trailAt(time)],
    });
  }
  return frames;
}

// ==========================================
// The page
// ==========================================

/** A shader control as the page sets it. */
export interface PageControl {
  name: string;
  type: string;
  value: ControlValue;
  texture?: TextureSettings;
}

/** What the render page draws. */
export interface PageConfig {
  width: number;
  height: number;
  frames: number;
  /** Keep alpha in the frames (else they are composited over `background`). */
  alpha: boolean;
  /** CSS colour under transparent pixels when `alpha` is false. */
  background: string;
  /** How frames go back: PNG files, or raw RGBA (rows top down). */
  send: 'png' | 'rgba';
  /** A shader to run, or (when absent) SVG frame markup from `/state`. */
  shader?: {
    /** The full GLSL ES 3.00 fragment shader (see {@link fragmentSource}). */
    fragment: string;
    controls: PageControl[];
    /** Draws its frame opaque, as `ShaderRenderer` does without `alpha`: its own alpha is ignored. */
    opaque: boolean;
  };
}

/** JSON that is safe inside a `<script>`. */
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

/**
 * The page headless Chrome runs: it compiles the shader with the same
 * wrapper as `ShaderRenderer` (`wrapSource`, so every built-in, `iPointer`,
 * `iClicks`, `iTrail`, `iAudio`, `iSpectrum`, `iBeat` and `iScroll` included, is
 * declared; the audio and scroll ones stay 0, so those effects play their idle
 * demos), sets each control by its
 * type (`int` and `bool` as integers), loads image controls the way
 * `loadImage` does (SVGs sized to their long edge first) before the first
 * frame, and flips them as the renderer does. Each frame asks `/state` for
 * its time, pointer, video frames or SVG markup, draws, and posts the
 * pixels to `/frame`.
 */
export function renderPageHtml(config: PageConfig): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>html,body{margin:0;background:transparent;overflow:hidden}</style>
</head>
<body>
<script>
const CONFIG = ${scriptJson(config)};
const VERTEX = ${scriptJson(VERTEX_SOURCE)};
const W = CONFIG.width, H = CONFIG.height;
const report = (message) => fetch("/error", { method: "POST", body: String(message) });
addEventListener("error", (e) => report("The render page failed: " + e.message));
addEventListener("unhandledrejection", (e) => report((e.reason && e.reason.message) || String(e.reason)));

// SVGs decode at their own (often icon) size: give them ${SVG_EDGE} px on the long edge, and a viewBox.
function sizeSvg(markup, w0, h0) {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.localName !== "svg" || doc.getElementsByTagName("parsererror").length) throw new Error("Not an SVG document.");
  const len = (n) => { const m = (svg.getAttribute(n) || "").trim().match(/^([\\d.]+)(px)?$/); return m && +m[1] > 0 ? +m[1] : 0; };
  const box = (svg.getAttribute("viewBox") || "").trim().split(/[\\s,]+/).map(Number);
  const hasBox = box.length === 4 && box[2] > 0 && box[3] > 0;
  const w = len("width") || (hasBox ? box[2] : 300), h = len("height") || (hasBox ? box[3] : 150);
  if (!hasBox) svg.setAttribute("viewBox", "0 0 " + w + " " + h);
  const scale = w0 ? 1 : ${SVG_EDGE} / Math.max(w, h);
  svg.setAttribute("width", w0 || Math.max(1, Math.round(w * scale)));
  svg.setAttribute("height", h0 || Math.max(1, Math.round(h * scale)));
  return new XMLSerializer().serializeToString(svg);
}
const isSvg = (url) => /^data:image\\/svg\\+xml[;,]/i.test(url) || /^(?!data:)[^?#]*\\.svg([?#]|$)/i.test(url);
async function decode(src, name) {
  const img = new Image();
  img.src = src;
  try { await img.decode(); } catch (e) { throw new Error("Could not load the image " + name + "."); }
  return img;
}
async function loadImage(url, name) {
  if (!isSvg(url)) return decode(url, name);
  const text = await (await fetch(url)).text();
  const blob = URL.createObjectURL(new Blob([sizeSvg(text)], { type: "image/svg+xml" }));
  try { return await decode(blob, name); } finally { URL.revokeObjectURL(blob); }
}

const out = document.createElement("canvas");
out.width = W; out.height = H;
const ctx = out.getContext("2d", { willReadFrequently: CONFIG.send === "rgba" });
let gl = null, glCanvas = null, u = null;
const textures = {};

function setupShader() {
  glCanvas = document.createElement("canvas");
  glCanvas.width = W; glCanvas.height = H;
  // As createContext: no antialiasing, depth or stencil; unpremultiplied alpha so pixels read back exactly.
  gl = glCanvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false, depth: false, stencil: false, powerPreference: "high-performance" });
  if (!gl) throw new Error("WebGL2 is not available in headless Chrome.");
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("The shader does not compile: " + gl.getShaderInfoLog(s));
    return s;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, CONFIG.shader.fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("The shader does not link: " + gl.getProgramInfoLog(program));
  gl.useProgram(program);
  u = (n) => gl.getUniformLocation(program, n);
  gl.viewport(0, 0, W, H);
  if (CONFIG.shader.opaque) {
    // An opaque canvas, as ShaderRenderer has without alpha: alpha stays 1 whatever the shader writes.
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.colorMask(true, true, true, false);
  }
}

function makeTexture(unit, texture) {
  const t = gl.createTexture();
  const settings = texture || { filter: "mipmap", wrap: "repeat" };
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  // Black until (or unless) a picture arrives, as TextureCache does.
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, { mipmap: gl.LINEAR_MIPMAP_LINEAR, linear: gl.LINEAR, nearest: gl.NEAREST }[settings.filter]);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, settings.filter === "nearest" ? gl.NEAREST : gl.LINEAR);
  const wrap = { repeat: gl.REPEAT, clamp: gl.CLAMP_TO_EDGE, mirror: gl.MIRRORED_REPEAT }[settings.wrap];
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  return { unit, texture: t };
}

function upload(name, img) {
  const slot = textures[name];
  if (!slot) return;
  gl.activeTexture(gl.TEXTURE0 + slot.unit);
  gl.bindTexture(gl.TEXTURE_2D, slot.texture);
  // Rows bottom up, as the renderer's TextureCache uploads them.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.generateMipmap(gl.TEXTURE_2D);
}

async function setControls() {
  let unit = 0;
  const loads = [];
  for (const c of CONFIG.shader.controls) {
    const loc = u(c.name);
    const v = c.value;
    if (c.type === "sampler2D") {
      textures[c.name] = makeTexture(unit, c.texture);
      if (loc) gl.uniform1i(loc, unit);
      unit++;
      if (v) loads.push(loadImage(v, "for " + c.name).then((img) => upload(c.name, img)));
      continue;
    }
    if (!loc) continue;
    if (c.type === "float") gl.uniform1f(loc, v);
    else if (c.type === "int") gl.uniform1i(loc, Math.round(v));
    else if (c.type === "bool") gl.uniform1i(loc, v ? 1 : 0);
    else if (Array.isArray(v)) gl["uniform" + v.length + "fv"](loc, v);
  }
  await Promise.all(loads);
}

function drawShader(s) {
  gl.viewport(0, 0, W, H);
  const set = (n, f) => { const l = u(n); if (l) f(l); };
  set("iResolution", (l) => gl.uniform3f(l, W, H, 1));
  set("iTime", (l) => gl.uniform1f(l, s.time));
  set("iTimeDelta", (l) => gl.uniform1f(l, s.delta));
  set("iFrame", (l) => gl.uniform1i(l, s.frame));
  set("iMouse", (l) => gl.uniform4fv(l, s.mouse));
  set("iPointer", (l) => gl.uniform4fv(l, s.pointer));
  set("iClicks", (l) => gl.uniform4fv(l, new Float32Array(s.clicks)));
  set("iTrail", (l) => gl.uniform4fv(l, new Float32Array(s.trail)));
  // glslsandbox-style names, for complete programs.
  set("u_resolution", (l) => gl.uniform2f(l, W, H));
  set("u_time", (l) => gl.uniform1f(l, s.time));
  set("u_mouse", (l) => gl.uniform2f(l, s.pointer[0], s.pointer[1]));
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

async function frameImage(s) {
  if (CONFIG.shader) {
    for (const [name, url] of Object.entries(s.video || {})) upload(name, await decode(url, "of the video frame"));
    drawShader(s);
    return glCanvas;
  }
  const markup = sizeSvg(s.svg, W, H);
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
  try { return await decode(url, "of the SVG frame"); } finally { URL.revokeObjectURL(url); }
}

async function capture(src) {
  // The WebGL canvas reads back exactly when nothing is composited under it.
  const direct = CONFIG.shader && (CONFIG.alpha || CONFIG.shader.opaque);
  if (direct) {
    if (CONFIG.send === "png") return new Promise((r) => glCanvas.toBlob(r, "image/png"));
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const flipped = new Uint8Array(px.length), row = W * 4;
    for (let y = 0; y < H; y++) flipped.set(px.subarray((H - 1 - y) * row, (H - y) * row), y * row);
    return flipped;
  }
  ctx.clearRect(0, 0, W, H);
  if (!CONFIG.alpha) { ctx.fillStyle = CONFIG.background; ctx.fillRect(0, 0, W, H); }
  ctx.drawImage(src, 0, 0, W, H);
  if (CONFIG.send === "png") return new Promise((r) => out.toBlob(r, "image/png"));
  return ctx.getImageData(0, 0, W, H).data;
}

(async () => {
  if (CONFIG.shader) { setupShader(); await setControls(); }
  for (let i = 0; i < CONFIG.frames; i++) {
    const s = await (await fetch("/state?i=" + i)).json();
    const body = await capture(await frameImage(s));
    const r = await fetch("/frame?i=" + i, { method: "POST", body });
    if (!r.ok) return;
  }
})().catch((e) => report((e && e.message) || String(e)));
</script>
</body>
</html>
`;
}

// ==========================================
// The render loop
// ==========================================

/** One frame's state, as the page asks for it. */
export interface FrameState {
  time: number;
  delta: number;
  frame: number;
  mouse: [number, number, number, number];
  pointer: [number, number, number, number];
  clicks: number[];
  trail: number[];
  /** SVG markup to draw (vector frames). */
  svg?: string;
  /** Image control → local file to show this frame (video frames). */
  video?: Record<string, string>;
}

/** A render: the page to run, each frame's state, and where it goes. */
export interface RenderJob {
  page: PageConfig;
  state: (frame: number) => FrameState;
  plan: OutputPlan;
  fps: number;
  onProgress?: (frame: number, total: number) => void;
}

/** Frames written somewhere: a sink takes them in order and finishes. */
interface Sink {
  write(frame: number, data: Buffer): Promise<void>;
  finish(): Promise<void>;
  abort(): void;
}

function ffmpegSink(plan: OutputPlan, fps: number): Sink {
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', ...plan.ffmpegArgs!, '-r', String(fps), plan.path];
  const proc = spawn(ffmpegPath(), args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = '';
  let failed: Error | null = null;
  proc.stderr!.on('data', (d) => (stderr += d.toString()));
  const done = new Promise<void>((resolve, reject) => {
    proc.on('error', (err: NodeJS.ErrnoException) => {
      failed = err.code === 'ENOENT' ? new Error(NO_FFMPEG) : new Error(`ffmpeg could not start: ${err.message}`);
      reject(failed);
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject((failed ??= new Error(`ffmpeg failed (exit ${code}): ${stderr.trim() || 'no message'}`)));
    });
  });
  done.catch(() => {});
  proc.stdin!.on('error', () => {});
  return {
    async write(_frame, data) {
      if (failed) throw failed;
      if (!proc.stdin!.write(data)) await new Promise((r) => proc.stdin!.once('drain', r));
    },
    async finish() {
      proc.stdin!.end();
      await done;
    },
    abort() {
      proc.kill('SIGKILL');
    },
  };
}

function pngSink(plan: OutputPlan): Sink {
  fs.mkdirSync(path.dirname(plan.path), { recursive: true });
  return {
    async write(frame, data) {
      await fs.promises.writeFile(plan.path.includes('%') ? sequencePath(plan.path, frame) : plan.path, data);
    },
    async finish() {},
    abort() {},
  };
}

async function gifSink(plan: OutputPlan, width: number, height: number, fps: number): Promise<Sink> {
  // gifenc is CommonJS in Node: its functions may only be on the default export.
  const mod = (await import('gifenc')) as Partial<typeof import('gifenc')> & { default?: typeof import('gifenc') };
  const { GIFEncoder, quantize, applyPalette } = (typeof mod.GIFEncoder === 'function' ? mod : mod.default!) as typeof import('gifenc');
  const gif = GIFEncoder();
  const delay = 1000 / fps;
  return {
    async write(frame, data) {
      const rgba = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      const first = frame === 0 ? { repeat: 0 } : {};
      if (plan.alpha) {
        // One-bit alpha: each frame replaces the last (dispose 2), with a transparent palette entry.
        const palette = quantize(rgba, 256, { format: 'rgba4444', oneBitAlpha: true });
        const transparentIndex = palette.findIndex((c) => c[3] === 0);
        gif.writeFrame(applyPalette(rgba, palette, 'rgba4444'), width, height, {
          palette,
          delay,
          dispose: 2,
          ...(transparentIndex >= 0 ? { transparent: true, transparentIndex } : {}),
          ...first,
        });
      } else {
        const palette = quantize(rgba, 256);
        gif.writeFrame(applyPalette(rgba, palette), width, height, { palette, delay, ...first });
      }
    },
    async finish() {
      gif.finish();
      fs.mkdirSync(path.dirname(plan.path), { recursive: true });
      await fs.promises.writeFile(plan.path, gif.bytes());
    },
    abort() {},
  };
}

/** Chrome's flags: GPU WebGL where there is one (Metal on macOS), SwiftShader otherwise. */
function chromeArgs(userDataDir: string, width: number, height: number, url: string): string[] {
  return [
    '--headless=new',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    `--user-data-dir=${userDataDir}`,
    `--window-size=${Math.max(64, width)},${Math.max(64, height)}`,
    '--use-gl=angle',
    ...(process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-angle=swiftshader']),
    '--enable-webgl',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-gpu-sandbox',
    '--force-color-profile=srgb',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-extensions',
    url,
  ];
}

/** Default stall timeout in milliseconds if not overridden via FLAIR_STALL_TIMEOUT_MS. */
const DEFAULT_STALL_MS = 120_000;

/**
 * Runs a render: serves the page to headless Chrome on 127.0.0.1, hands it
 * each frame's state, and writes the frames it posts back. Resolves with the
 * output path (a PNG sequence's pattern).
 */
export async function runRender(job: RenderJob): Promise<string> {
  const { page, plan, fps, onProgress } = job;
  const total = page.frames;
  const chromeBin = findChrome();
  if (!chromeBin) {
    throw new Error('Chrome or Chromium is needed to render, and none was found. Install Google Chrome, run "npx playwright install chromium", or set CHROME_PATH.');
  }
  fs.mkdirSync(path.dirname(plan.path), { recursive: true });
  const sink = plan.format === 'gif' ? await gifSink(plan, page.width, page.height, fps) : plan.format === 'png' ? pngSink(plan) : ffmpegSink(plan, fps);
  const html = renderPageHtml(page);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flair-chrome-'));

  return new Promise<string>((resolve, reject) => {
    let chrome: ChildProcess | null = null;
    let finished = false;
    let written = 0;
    let stall: NodeJS.Timeout | undefined;
    const sockets = new Set<import('node:net').Socket>();

    const stallTimeoutMs = Number(process.env.FLAIR_STALL_TIMEOUT_MS) || DEFAULT_STALL_MS;
    let chromeStderr = '';

    const cleanup = () => {
      clearTimeout(stall);
      try {
        chrome?.kill('SIGKILL');
      } catch {}
      for (const s of sockets) s.destroy();
      server.close();
      fs.rm(userDataDir, { recursive: true, force: true }, () => {});
    };
    const fail = (err: Error) => {
      if (finished) return;
      finished = true;
      sink.abort();
      cleanup();
      reject(err);
    };
    const succeed = () => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(plan.path);
    };
    const watchdog = () => {
      clearTimeout(stall);
      stall = setTimeout(() => {
        const diag = chromeStderr.trim() ? `\nChrome stderr:\n${chromeStderr.trim()}` : '';
        fail(new Error(`The render stalled: no frame for ${stallTimeoutMs / 1000} s after frame ${written} of ${total}. Is WebGL2 available to headless Chrome?${diag}`));
      }, stallTimeoutMs);
    };

    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (url.pathname === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(html);
        return;
      }
      if (url.pathname === '/state') {
        const i = Number(url.searchParams.get('i'));
        try {
          const s = job.state(i);
          const body = { ...s, ...(s.video ? { video: Object.fromEntries(Object.keys(s.video).map((k) => [k, `/video?i=${i}&name=${encodeURIComponent(k)}`])) } : {}) };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(body));
        } catch (e) {
          res.writeHead(500);
          res.end();
          fail(e as Error);
        }
        return;
      }
      if (url.pathname === '/video') {
        const i = Number(url.searchParams.get('i'));
        const file = job.state(i).video?.[url.searchParams.get('name') ?? ''];
        if (!file) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, { 'Content-Type': 'image/png' });
        fs.createReadStream(file).pipe(res);
        return;
      }
      if (url.pathname === '/frame' && req.method === 'POST') {
        const i = Number(url.searchParams.get('i'));
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          sink
            .write(i, Buffer.concat(chunks))
            .then(async () => {
              written++;
              watchdog();
              onProgress?.(written, total);
              res.writeHead(200);
              res.end('ok');
              if (written >= total) {
                await sink.finish();
                succeed();
              }
            })
            .catch((e: Error) => {
              res.writeHead(500);
              res.end();
              fail(e);
            });
        });
        return;
      }
      if (url.pathname === '/error' && req.method === 'POST') {
        let message = '';
        req.on('data', (c) => (message += c));
        req.on('end', () => {
          res.writeHead(200);
          res.end();
          fail(new Error(message || 'The render page failed.'));
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.on('connection', (s) => {
      sockets.add(s);
      s.on('close', () => sockets.delete(s));
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as import('node:net').AddressInfo;
      chrome = spawn(chromeBin, chromeArgs(userDataDir, page.width, page.height, `http://127.0.0.1:${port}/`), {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      chrome.stderr?.on('data', (chunk) => {
        chromeStderr = (chromeStderr + chunk.toString()).slice(-4000);
      });
      chrome.on('error', (err) => {
        const diag = chromeStderr.trim() ? `\nChrome stderr:\n${chromeStderr.trim()}` : '';
        fail(new Error(`Could not launch Chrome at ${chromeBin}: ${err.message}${diag}`));
      });
      chrome.on('exit', (code) => {
        if (!finished && written < total) {
          const diag = chromeStderr.trim() ? `\nChrome stderr:\n${chromeStderr.trim()}` : '';
          fail(new Error(`Chrome quit (exit ${code}) after ${written} of ${total} frames.${diag}`));
        }
      });
      watchdog();
    });
  });
}

// ==========================================
// Shader export
// ==========================================

/** Where the pointer is in a recording: nowhere (`none`), or the scripted pointer of {@link scriptedPointer} (`auto`). */
export type PointerMode = 'none' | 'auto';

export interface ExportOptions {
  /** GLSL fragment shader source (Shadertoy-style `mainImage`). */
  source: string;
  /**
   * Control values over the declared defaults. An image control takes a
   * URL, a `data:` URL, or a local file path (read into a `data:` URL).
   */
  values?: Record<string, ControlValue>;
  /** Destination: .mp4, .webm, .mov, .gif, or PNG frames (a folder or `out_%04d.png`). */
  outputPath: string;
  width?: number;
  height?: number;
  fps?: number;
  /** Seconds (default 3). */
  duration?: number;
  /** Keep the shader's alpha (WebM, MOV, GIF and PNG; MP4 is always opaque). */
  alpha?: boolean;
  /**
   * The shader draws over other content (`fragColor.a` is coverage): without
   * `alpha` it is composited over `background`. Otherwise its alpha is
   * ignored without `alpha`, as on an opaque canvas.
   */
  transparent?: boolean;
  /** CSS colour under transparent pixels when `alpha` is off (default black). */
  background?: string;
  /** The pointer: `none` (default) or `auto`, a scripted pointer that hovers, wanders and clicks. */
  pointer?: PointerMode;
  onProgress?: (frame: number, total: number) => void;
}

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
};

/**
 * An image for the page, as a `data:` URL: a local file is read, an
 * `http(s):` URL fetched (so CORS does not matter); `data:` URLs stay.
 */
export async function imageDataUrl(source: string, cwd = process.cwd()): Promise<string> {
  if (/^data:/i.test(source) || source === '') return source;
  if (/^https?:/i.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Could not download the image at ${source} (HTTP ${res.status}).`);
    const type = res.headers.get('content-type')?.split(';')[0] || MIME[path.extname(new URL(source).pathname).toLowerCase()] || 'application/octet-stream';
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  }
  const file = path.resolve(cwd, source.replace(/^file:\/\//, ''));
  if (!fs.existsSync(file)) throw new Error(`There is no image at ${file}.`);
  const type = MIME[path.extname(file).toLowerCase()];
  if (!type) throw new Error(`${path.basename(file)} is not an image Flair can show; give it a PNG, JPEG, GIF, WebP, AVIF, BMP or SVG.`);
  return `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
}

/**
 * The fragment shader the page compiles: a Shadertoy-style `mainImage`
 * source goes in `wrapSource`, as `ShaderRenderer` compiles it. A complete
 * program (one with its own `void main()`, glslsandbox-style, reading
 * `u_time` and `u_resolution`) is kept as written, with `#version 300 es`
 * added when it has none.
 */
export function fragmentSource(source: string): string {
  if (!/\bvoid\s+main\s*\(\s*\)/.test(source)) return wrapSource(source);
  return /^\s*#version\b/.test(source) ? source : `#version 300 es\n#line 1\n${source}`;
}

/** Shader controls with their values, images as `data:` URLs, ready for the page. */
export async function pageControls(source: string, values: Record<string, ControlValue> = {}): Promise<PageControl[]> {
  return Promise.all(
    parseControls(source).map(async (c) => {
      let value = controlValue(c, values);
      if (c.type === 'sampler2D' && typeof value === 'string') value = await imageDataUrl(value);
      return { name: c.name, type: c.type, value, ...(c.texture ? { texture: c.texture } : {}) };
    }),
  );
}

/** Frame times and pointer uniforms for `frames` frames at `fps`. */
export function frameStates(frames: number, fps: number, width: number, height: number, pointer: PointerMode): FrameState[] {
  const times = Array.from({ length: frames }, (_, i) => i / fps);
  const scripted = pointer === 'auto' ? scriptedPointer(width, height, times) : undefined;
  const none = { mouse: [0, 0, 0, 0] as [number, number, number, number], pointer: [0, 0, 0, 0] as [number, number, number, number], clicks: new Array(MAX_CLICKS * 4).fill(0), trail: new Array(MAX_TRAIL * 4).fill(0) };
  return times.map((time, i) => ({ time, delta: i === 0 ? 0 : 1 / fps, frame: i, ...(scripted?.[i] ?? none) }));
}

/**
 * Renders a shader animation frame by frame with WebGL2 in headless Chrome,
 * the way `ShaderRenderer` draws it (the same GLSL wrapper and built-ins,
 * images, int and bool controls), and writes MP4 (H.264), WebM (VP9, with
 * alpha when asked), MOV (ProRes 4444), GIF or PNG frames. MP4, WebM and
 * MOV need ffmpeg; GIF and PNG do not.
 */
export async function exportMotionGraphic(options: ExportOptions): Promise<string> {
  const { source, values = {}, outputPath, fps = 30, duration = 3, onProgress } = options;
  const width = Math.max(1, Math.round(options.width ?? 720));
  const height = Math.max(1, Math.round(options.height ?? 720));
  const frames = Math.max(1, Math.round(duration * fps));
  const plan = planOutput(outputPath, { alpha: options.alpha, frames });
  if (plan.format === 'svg') throw new Error('A shader cannot be written as SVG; write .mp4, .webm, .mov, .gif or .png frames.');
  const states = frameStates(frames, fps, width, height, options.pointer ?? 'none');
  return runRender({
    page: {
      width,
      height,
      frames,
      alpha: plan.alpha,
      background: options.background ?? '#000000',
      send: plan.format === 'gif' ? 'rgba' : 'png',
      shader: {
        fragment: fragmentSource(source),
        controls: await pageControls(source, values),
        opaque: !plan.alpha && !options.transparent,
      },
    },
    state: (i) => states[i]!,
    plan,
    fps,
    onProgress,
  });
}
