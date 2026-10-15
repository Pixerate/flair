import { controlValue, parseControls, type ControlValue } from "./controls.js";
import { VERTEX_SOURCE, wrapSource } from "./program.js";
import { SVG_EDGE } from "./textures.js";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** JSON that is safe inside a `<script>`: a `</script>` or `<!--` in a shader comment cannot end it. */
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

export interface StandaloneOptions {
  /** The comment at the top of the script, saying where the page came from. */
  credit?: string;
}

/**
 * A self-contained HTML page that runs the shader full-window, with the
 * control values baked in. It has no dependencies and opens from disk. Like
 * the live preview, it feeds `iMouse` from pointer drags and caps the pixel
 * ratio at 2.
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
<script>
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
