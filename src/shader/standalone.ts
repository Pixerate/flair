import { controlValue, parseControls, type ControlValue } from "./controls.js";
import { HOVER_SECONDS, MAX_CLICKS, MAX_TRAIL, TRAIL_SECONDS } from "./pointer.js";
import { VERTEX_SOURCE, wrapSource } from "./program.js";
import { SVG_EDGE } from "./textures.js";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** JSON that is safe inside a `<script>`: a `</script>` or `<!--` in a shader comment cannot end it. */
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

export interface StandaloneOptions {
  /** The comment at the top of the script, saying where the page came from. */
  credit?: string;
  /**
   * Sound for audio-reactive shaders (`iAudio`, `iSpectrum`, `iBeat`): an
   * audio file's URL, shown as a looping `<audio controls>` player in the
   * corner, or `"mic"`, a button that asks for the microphone (heard, not
   * played back). Browsers only start sound after a click, so the page
   * listens once the player is played or the button pressed. A file from
   * another site needs CORS (it is loaded with `crossorigin="anonymous"`).
   * Without it, audio effects play their idle demos.
   */
  audio?: string;
}

/** The page's sound: `AudioAnalysis` in a few lines (see audio.ts), fed by an `AnalyserNode`. */
const AUDIO_SCRIPT = `
// iAudio, iSpectrum and iBeat, as Flair's AudioAnalysis works them out: dB to 0–1, 64 log bins, band
// averages, loudness from RMS, attack/release smoothing, and beats on the bass over its recent average.
let hear = null;
function listen(ctx, node) {
  const an = ctx.createAnalyser();
  an.fftSize = 2048; an.smoothingTimeConstant = 0; an.minDecibels = -100; an.maxDecibels = -30;
  node.connect(an);
  const n = an.frequencyBinCount, hz = ctx.sampleRate / an.fftSize, top = Math.min(16000, ctx.sampleRate / 2);
  const freq = new Float32Array(n), wave = new Float32Array(an.fftSize), raw = new Float32Array(64), spec = new Float32Array(64), v = new Float32Array(n);
  const bins = [...Array(64)].map((_, i) => [30 * (top / 30) ** (i / 64) / hz, 30 * (top / 30) ** ((i + 1) / 64) / hz]);
  const bands = [[20, 250], [250, 2000], [2000, 16000]].map(([a, b]) => [Math.max(0, Math.ceil(a / hz)), Math.min(n - 1, Math.floor(Math.min(b, ctx.sampleRate / 2) / hz))]);
  let vals = [0, 0, 0, 0], last = null, avg = 0, armed = true, beatAt = null;
  hear = (t) => {
    an.getFloatFrequencyData(freq); an.getFloatTimeDomainData(wave);
    for (let k = 0; k < n; k++) v[k] = isFinite(freq[k]) ? Math.min(1, Math.max(0, (freq[k] + 100) / 70)) : 0;
    bins.forEach(([k0, k1], b) => {
      const from = Math.ceil(k0), to = Math.min(n - 1, Math.floor(k1));
      let x = 0;
      if (to >= from) for (let k = from; k <= to; k++) x = Math.max(x, v[k]);
      else { const k = Math.min(n - 1.001, (k0 + k1) / 2), i = Math.floor(k); x = v[i] + (v[Math.min(n - 1, i + 1)] - v[i]) * (k - i); }
      raw[b] = x;
    });
    const band = ([a, b]) => { let s = 0; for (let k = a; k <= b; k++) s += v[k]; return b >= a ? s / (b - a + 1) : 0; };
    let rms = 0; for (const s of wave) rms += s * s; rms = Math.sqrt(rms / wave.length);
    const level = rms > 0 ? Math.min(1, Math.max(0, 1 + 20 * Math.log10(rms) / 60)) : 0;
    const bass = band(bands[0]), now = [level, bass, band(bands[1]), band(bands[2])];
    const dt = last === null ? Infinity : Math.max(0, t - last), up = 1 - Math.exp(-dt / 0.03), down = 1 - Math.exp(-dt / 0.25);
    const ease = (a, b) => a + (b - a) * (b > a ? up : down);
    for (let b = 0; b < 64; b++) spec[b] = ease(spec[b], raw[b]);
    vals = vals.map((x, i) => ease(x, now[i]));
    const onset = bass - avg, th = 0.12 + 0.15 * avg;
    if (last !== null && armed && onset > th && bass > 0.2 && (beatAt === null || t - beatAt >= 0.22)) { beatAt = t; armed = false; }
    else if (onset < th * 0.5) armed = true;
    avg = last === null ? bass : avg + (bass - avg) * (1 - Math.exp(-dt / 0.6));
    last = t;
    return { a: vals, s: spec, b: beatAt === null ? -1 : t - beatAt };
  };
}
const audioCtx = () => (window.flairAudio ??= new (window.AudioContext || window.webkitAudioContext)());
const player = document.getElementById("a");
if (player) player.addEventListener("play", () => {
  const ctx = audioCtx();
  ctx.resume();
  if (!hear) { const src = ctx.createMediaElementSource(player); src.connect(ctx.destination); listen(ctx, src); }
});
const mic = document.getElementById("m");
if (mic) mic.addEventListener("click", async () => {
  const ctx = audioCtx();
  await ctx.resume();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    listen(ctx, ctx.createMediaStreamSource(stream));
    mic.textContent = "Listening";
    mic.disabled = true;
  } catch (e) { mic.textContent = "No microphone"; }
});`;

/**
 * A self-contained HTML page that runs the shader full-window, with the
 * control values baked in. It has no dependencies and opens from disk. Like
 * the live preview, it feeds `iMouse` from pointer drags and caps the pixel
 * ratio at 2. It also feeds the pointer built-ins, and the audio ones from
 * a player or the microphone when `options.audio` asks for it. The page
 * itself does not scroll, so `iScroll` stays 0 (scroll effects play their
 * idle demos).
 *
 * Images are loaded by URL when the page opens: a `data:` URL travels with
 * the page, an `https:` one needs the network and CORS, and a `blob:` one
 * only lives as long as the page that made it. SVGs are sized to
 * {@link SVG_EDGE} pixels before they are decoded, as `loadImage` does.
 */
export function standaloneHtml(
  title: string,
  source: string,
  values?: Record<string, ControlValue>,
  options: StandaloneOptions = {},
): string {
  const controls = parseControls(source).map((c) => ({
    name: c.name,
    type: c.type,
    value: controlValue(c, values),
    ...(c.texture ? { texture: c.texture } : {}),
  }));
  const credit = (options.credit ?? "Exported with Flair.").replace(/\n/g, " ");
  const corner = "position:fixed;left:12px;bottom:12px;z-index:1";
  const audio =
    options.audio === undefined
      ? ""
      : options.audio === "mic"
        ? `<button id="m" style="${corner};font:14px system-ui,sans-serif;padding:6px 12px;border-radius:6px;border:0;background:#fff;color:#000;cursor:pointer">Use microphone</button>\n`
        : `<audio id="a" src="${escapeHtml(options.audio)}" controls loop crossorigin="anonymous" style="${corner}"></audio>\n`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>html,body{margin:0;height:100%;background:#000}canvas{display:block;width:100%;height:100%}</style>
</head>
<body>
<canvas id="c"></canvas>
${audio}<script>
// ${credit.replace(/</g, "\\u003c")} Shadertoy-style fragment shader on WebGL2.
const VERTEX = ${scriptJson(VERTEX_SOURCE)};
const FRAGMENT = ${scriptJson(wrapSource(source))};
const CONTROLS = ${scriptJson(controls)};
const canvas = document.getElementById("c");
const gl = canvas.getContext("webgl2");
if (!gl) document.body.textContent = "WebGL2 is not available.";
function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
const program = gl.createProgram();
gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
gl.linkProgram(program);
gl.useProgram(program);
const u = (n) => gl.getUniformLocation(program, n);
let unit = 0;
// An SVG decodes at its own, often icon, size: give it ${SVG_EDGE} px on its long edge (and a
// viewBox, so the drawing scales) to keep it sharp.
async function sizedSvg(url) {
  const doc = new DOMParser().parseFromString(await (await fetch(url)).text(), "image/svg+xml");
  const svg = doc.documentElement;
  const len = (n) => { const m = (svg.getAttribute(n) || "").trim().match(/^([\\d.]+)(px)?$/); return m && +m[1] > 0 ? +m[1] : 0; };
  const box = (svg.getAttribute("viewBox") || "").trim().split(/[\\s,]+/).map(Number);
  const hasBox = box.length === 4 && box[2] > 0 && box[3] > 0;
  const w = len("width") || (hasBox ? box[2] : 300), h = len("height") || (hasBox ? box[3] : 150);
  const scale = ${SVG_EDGE} / Math.max(w, h);
  if (!hasBox) svg.setAttribute("viewBox", "0 0 " + w + " " + h);
  svg.setAttribute("width", Math.max(1, Math.round(w * scale)));
  svg.setAttribute("height", Math.max(1, Math.round(h * scale)));
  return URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }));
}
function image(loc, url, texture) {
  const i = unit++, t = gl.createTexture();
  const bind = () => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); };
  const filter = { mipmap: gl.LINEAR_MIPMAP_LINEAR, linear: gl.LINEAR, nearest: gl.NEAREST }[texture.filter];
  const wrap = { repeat: gl.REPEAT, clamp: gl.CLAMP_TO_EDGE, mirror: gl.MIRRORED_REPEAT }[texture.wrap];
  bind();
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, texture.filter === "nearest" ? gl.NEAREST : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  gl.uniform1i(loc, i);
  if (!url) return;
  const img = new Image();
  if (!/^(data|blob):/i.test(url)) img.crossOrigin = "anonymous";
  img.onload = () => {
    bind();
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
  };
  if (/^data:image\\/svg\\+xml[;,]/i.test(url) || /^(?!data:)[^?#]*\\.svg([?#]|$)/i.test(url)) {
    sizedSvg(url).then((src) => { img.src = src; }, () => {});
  } else img.src = url;
}
for (const c of CONTROLS) {
  const loc = u(c.name);
  const v = c.value;
  if (c.type === "float") gl.uniform1f(loc, v);
  else if (c.type === "int" || c.type === "bool") gl.uniform1i(loc, Number(v));
  else if (c.type === "sampler2D") image(loc, v, c.texture);
  else gl["uniform" + v.length + "fv"](loc, v);
}
let mouse = [0, 0, 0, 0];
const px = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * canvas.width / r.width, (r.bottom - e.clientY) * canvas.height / r.height]; };
canvas.addEventListener("pointerdown", (e) => { const [x, y] = px(e); mouse = [x, y, x, y]; });
canvas.addEventListener("pointermove", (e) => { if (e.buttons && mouse[2] > 0) { const [x, y] = px(e); mouse = [x, y, mouse[2], mouse[3]]; } });
addEventListener("pointerup", () => { if (mouse[2] > 0) mouse = [mouse[0], mouse[1], -mouse[2], -Math.abs(mouse[3])]; });
let start = performance.now(), last = start, frame = 0;
// iPointer (where, how hovered, seconds pressed), iClicks (the latest clicks) and iTrail (where it has just been), newest first.
const seconds = () => (performance.now() - start) / 1000;
let at = [0, 0], over = false, hoverFrom = 0, hoverAt = -1e9, pressedAt = -1, releasedAt = -1, clicks = [], trail = [];
const hovered = (t) => { const k = Math.min(1, Math.max(0, (t - hoverAt) / ${HOVER_SECONDS})); return hoverFrom + ((over ? 1 : 0) - hoverFrom) * k * k * (3 - 2 * k); };
const hover = (on) => { const t = seconds(); hoverFrom = hovered(t); hoverAt = t; over = on; };
canvas.addEventListener("pointerenter", (e) => { at = px(e); hover(true); toTrail(); });
canvas.addEventListener("pointerleave", () => hover(false));
// A trail point at most every ${TRAIL_SECONDS.toFixed(4)} s; moves in between update the newest.
const toTrail = () => { const t = seconds(); if (trail.length && t - trail[0][2] < ${TRAIL_SECONDS}) trail[0] = [at[0], at[1], trail[0][2], 1]; else trail = [[at[0], at[1], t, 1], ...trail].slice(0, ${MAX_TRAIL}); };
canvas.addEventListener("pointermove", (e) => { at = px(e); toTrail(); });
canvas.addEventListener("pointerdown", (e) => { at = px(e); pressedAt = seconds(); clicks.unshift([at[0], at[1], pressedAt, 1]); clicks = clicks.slice(0, ${MAX_CLICKS}); });
addEventListener("pointerup", () => { if (pressedAt >= 0) releasedAt = seconds(); pressedAt = -1; });${options.audio === undefined ? "" : AUDIO_SCRIPT}
function draw(now) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  gl.viewport(0, 0, w, h);
  gl.uniform3f(u("iResolution"), w, h, 1);
  gl.uniform1f(u("iTime"), (now - start) / 1000);
  gl.uniform1f(u("iTimeDelta"), (now - last) / 1000);
  gl.uniform1i(u("iFrame"), frame++);
  gl.uniform4f(u("iMouse"), mouse[0], mouse[1], mouse[2], mouse[3]);
  const t = (now - start) / 1000;
  gl.uniform4f(u("iPointer"), at[0], at[1], hovered(t), pressedAt >= 0 ? Math.max(0, t - pressedAt) : releasedAt >= 0 ? -Math.max(1e-3, t - releasedAt) : 0);
  const c = new Float32Array(${MAX_CLICKS * 4});
  clicks.forEach((k, i) => c.set(k, i * 4));
  gl.uniform4fv(u("iClicks"), c);
  const p = new Float32Array(${MAX_TRAIL * 4});
  trail.forEach((k, i) => p.set(k, i * 4));
  gl.uniform4fv(u("iTrail"), p);${
    options.audio === undefined
      ? ""
      : `
  // With no sound yet every audio uniform stays 0, and audio effects play their idle demos.
  if (hear) { const s = hear(now / 1000); gl.uniform4f(u("iAudio"), s.a[0], s.a[1], s.a[2], s.a[3]); gl.uniform4fv(u("iSpectrum"), s.s); gl.uniform1f(u("iBeat"), s.b); }`
  }
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  last = now;
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
</script>
</body>
</html>
`;
}
