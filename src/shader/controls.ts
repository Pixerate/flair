/**
 * Controls declared in a shader's source. A uniform becomes a control when
 * its declaration carries an `@control` comment on the same line:
 *
 *   uniform float uSpeed;  // @control min=0 max=4 default=1 label="Speed"
 *   uniform int uSteps;    // @control min=1 max=64 default=16
 *   uniform bool uGrain;   // @control default=true label="Film grain"
 *   uniform vec2 uCenter;  // @control min=-1 max=1 default=0,0
 *   uniform vec3 uTint;    // @control color default=#77C16A label="Tint"
 *   uniform sampler2D uPhoto; // @control filter=linear wrap=clamp label="Photo"
 *   uniform float uAngle;  // @control min=0 max=360 default=45 unit=degrees
 *
 * The source is the single source of truth for which controls exist and
 * their defaults; values someone picks are stored next to it.
 */

/** The uniform types a control can have. */
export type ControlType = "float" | "int" | "bool" | "vec2" | "vec3" | "vec4" | "sampler2D" | "text";

/**
 * A control's value: a number (`float`, `int`), a boolean (`bool`), the
 * components of a vector, an image URL (`sampler2D`; "" for none), or a
 * string (`text`, vector effects only: shaders cannot take text).
 */
export type ControlValue = number | boolean | number[] | string;

/** How an image is sampled: Shadertoy's channel settings. */
export interface TextureSettings {
  /** `mipmap` (the default), `linear` or `nearest` (pixelated). */
  filter: "mipmap" | "linear" | "nearest";
  /** Outside 0–1: `repeat` (the default), `clamp` to the edge, or `mirror`. */
  wrap: "repeat" | "clamp" | "mirror";
}

/** A control parsed from an annotated uniform. */
export interface ControlDef {
  /** The uniform's name. */
  name: string;
  type: ControlType;
  /** `label="…"`, or the name made readable ("uFlowSpeed" → "Flow speed"). */
  label: string;
  /** A `vec3` or `vec4` shown as a colour picker. */
  color: boolean;
  min: number;
  /** Always greater than `min`. */
  max: number;
  step: number;
  default: ControlValue;
  /** 1-based line of the declaration. */
  line: number;
  /** Sampling settings, for `sampler2D` controls only. */
  texture?: TextureSettings;
  /** `unit="…"`: what the number is measured in ("pixels", "degrees"), when the label does not say. */
  unit?: string;
  /**
   * The bounds the declaration states (`min=`, `max=`), which values may not
   * pass (see {@link checkControlValue}). A range left to its default (0–1,
   * 0–10 for `int`) only sizes the slider.
   */
  limits?: { min?: number; max?: number };
}

const DECLARATION =
  /^\s*uniform\s+(float|int|bool|vec2|vec3|vec4|sampler2D)\s+([A-Za-z_]\w*)\s*;\s*\/\/\s*@control\b(.*)$/;
const ATTRIBUTE = /([a-z]+)(?:=("[^"]*"|'[^']*'|\S+))?/gi;

const COMPONENTS: Record<ControlType, number> = {
  float: 1,
  int: 1,
  bool: 1,
  vec2: 2,
  vec3: 3,
  vec4: 4,
  sampler2D: 1,
  text: 1,
};

/** The number of components a control type has: 1 for scalars, `bool`, `sampler2D` and `text`, else the vector size. */
export function componentCount(type: ControlType): number {
  return COMPONENTS[type];
}

/** "uFlowSpeed" → "Flow speed". */
export function humanise(name: string): string {
  const words = name
    .replace(/^u(?=[A-Z])/, "")
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "#77C16A" (or "#7c6") → [0.467, 0.757, 0.416]; null when it is not a hex colour. */
export function hexToRgb(hex: string): number[] | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  const digits = m[1]!;
  const h =
    digits.length === 3
      ? digits
          .split("")
          .map((c) => c + c)
          .join("")
      : digits;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

/**
 * A CSS colour as [r, g, b] (0–1), or [r, g, b, a] when it gives an alpha
 * below 1: hex (`#7c6`, `#7c6f`, `#77C16A`, `#77C16AFF`), `rgb()`/`rgba()`
 * and `hsl()`/`hsla()`, with commas or spaces, numbers or percentages.
 * Null for anything else (names like "red" and `currentColor` included).
 */
export function parseColor(css: string): number[] | null {
  const text = css.trim().toLowerCase();
  const hex = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text);
  if (hex) {
    const d = hex[1]!.length <= 4 ? Array.from(hex[1]!, (c) => c + c).join("") : hex[1]!;
    const rgba = (d.match(/../g) ?? []).map((h) => parseInt(h, 16) / 255);
    return rgba.length === 4 && rgba[3]! < 1 ? rgba : rgba.slice(0, 3);
  }
  const fn = /^(rgba?|hsla?)\(\s*([^)]*)\)$/.exec(text);
  if (!fn) return null;
  const parts = fn[2]!.split(/\s*[,/]\s*|\s+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  // A component: a number, or a percentage of `full`.
  const num = (p: string, full: number) => {
    const n = parseFloat(p);
    if (!/^-?(\d+\.?\d*|\.\d+)(%|deg)?$/.test(p) || !Number.isFinite(n)) return NaN;
    return p.endsWith("%") ? (n / 100) * full : n;
  };
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  let rgb: number[];
  if (fn[1]!.startsWith("rgb")) rgb = parts.slice(0, 3).map((p) => clamp(num(p, 255) / 255));
  else {
    const h = (((num(parts[0]!, 360) % 360) + 360) % 360) / 360;
    const sat = clamp(num(parts[1]!, 1));
    const l = clamp(num(parts[2]!, 1));
    // HSL to RGB, per CSS Color 4.
    const f = (k: number) => {
      const t = (k + h * 12) % 12;
      return l - sat * Math.min(l, 1 - l) * Math.max(-1, Math.min(t - 3, 9 - t, 1));
    };
    rgb = [f(0), f(8), f(4)];
  }
  const alpha = parts[3] === undefined ? 1 : clamp(num(parts[3], 1));
  if ([...rgb, alpha].some((n) => Number.isNaN(n))) return null;
  return alpha < 1 ? [...rgb, alpha] : rgb;
}

/** As a control value: `rgb` padded or cut to the control's components (an alpha of 1 added for a vec4). */
function colourValue(control: ControlDef, rgb: number[]): number[] {
  return control.type === "vec4" ? [...rgb.slice(0, 3), rgb[3] ?? 1] : rgb.slice(0, 3);
}

/** [0.467, 0.757, 0.416] → "#77c16a". Components are clamped to 0–1; a fourth (alpha) is ignored. */
export function rgbToHex(rgb: number[]): string {
  return (
    "#" +
    rgb
      .slice(0, 3)
      .map((c) =>
        Math.round(Math.min(1, Math.max(0, c)) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function parseDefault(raw: string | undefined, type: ControlType, color: boolean): ControlValue {
  const n = COMPONENTS[type];
  if (type === "bool") return raw === "true" || raw === "1";
  if (type === "sampler2D" || type === "text") return raw ?? "";
  // Without a default, numbers start at 0 and colours at white.
  if (raw === undefined) return n === 1 ? 0 : Array.from({ length: n }, () => (color ? 1 : 0));
  if (color && raw.startsWith("#")) {
    const rgb = hexToRgb(raw) ?? [1, 1, 1];
    return type === "vec4" ? [...rgb, 1] : rgb;
  }
  const parts = raw
    .split(",")
    .map(Number)
    .map((v) => (Number.isFinite(v) ? v : 0));
  if (n === 1) return parts[0] ?? 0;
  // A short list repeats its last component: `default=0.5` on a vec3 is (0.5, 0.5, 0.5).
  return Array.from({ length: n }, (_, i) => parts[i] ?? parts[parts.length - 1] ?? 0);
}

/**
 * A control from its declaration's attributes (the text after `@control`):
 * `min`, `max`, `step`, `default`, `label`, `color`, and for images `filter`
 * and `wrap`. Values with spaces are quoted, in double or single quotes.
 * Shared by shader sources and vector effects' `{{name: type …}}` placeholders.
 */
export function controlFromDeclaration(name: string, type: ControlType, attributes: string, line: number): ControlDef {
  const attrs: Record<string, string | undefined> = {};
  for (const a of attributes.matchAll(ATTRIBUTE)) {
    attrs[a[1]!.toLowerCase()] = a[2]?.replace(/^(["'])(.*)\1$/s, "$2");
  }
  const color = "color" in attrs && (type === "vec3" || type === "vec4");
  const num = (v: string | undefined, fallback: number) =>
    v !== undefined && Number.isFinite(Number(v)) ? Number(v) : fallback;
  const min = num(attrs.min, 0);
  const rawMax = num(attrs.max, type === "int" ? 10 : 1);
  const max = rawMax > min ? rawMax : min + 1;
  const control: ControlDef = {
    name,
    type,
    label: attrs.label ?? humanise(name),
    color,
    min,
    max,
    step: num(attrs.step, type === "int" ? 1 : (max - min) / 200),
    default: parseDefault(attrs.default, type, color),
    line,
  };
  if (attrs.unit) control.unit = attrs.unit;
  const declared = (v: string | undefined) => v !== undefined && Number.isFinite(Number(v));
  if (declared(attrs.min) || declared(attrs.max)) {
    control.limits = { ...(declared(attrs.min) && { min }), ...(declared(attrs.max) && { max }) };
  }
  if (type === "sampler2D") {
    const pick = <T extends string>(v: string | undefined, options: readonly T[]): T =>
      options.find((o) => o === v?.toLowerCase()) ?? options[0]!;
    control.texture = {
      filter: pick(attrs.filter, ["mipmap", "linear", "nearest"] as const),
      wrap: pick(attrs.wrap, ["repeat", "clamp", "mirror"] as const),
    };
  }
  return control;
}

/**
 * The controls a source declares, in source order. A uniform declared twice
 * counts once (the first wins). Unknown attributes are ignored, and missing
 * or malformed ones fall back to defaults: `min=0`, `max=1` (10 for `int`),
 * a step of 1/200 of the range (1 for `int`).
 */
export function parseControls(source: string): ControlDef[] {
  const controls: ControlDef[] = [];
  const seen = new Set<string>();
  source.split("\n").forEach((text, index) => {
    const m = DECLARATION.exec(text);
    if (!m || seen.has(m[2]!)) return;
    seen.add(m[2]!);
    controls.push(controlFromDeclaration(m[2]!, m[1] as ControlType, m[3]!, index + 1));
  });
  return controls;
}

/** The value a control has: the stored one when it still fits the declaration, else the default. */
export function controlValue(
  control: ControlDef,
  values: Record<string, ControlValue> | undefined,
): ControlValue {
  const v = values?.[control.name];
  if (v === undefined) return control.default;
  if (control.type === "bool") return typeof v === "boolean" ? v : control.default;
  if (control.type === "sampler2D" || control.type === "text") return typeof v === "string" ? v : control.default;
  const n = COMPONENTS[control.type];
  if (n === 1) return typeof v === "number" ? v : control.default;
  if (control.color && typeof v === "string") {
    const rgb = parseColor(v);
    return rgb ? colourValue(control, rgb) : control.default;
  }
  return Array.isArray(v) && v.length === n ? v : control.default;
}

/** What {@link checkControlValue} decides: the value to store, or a sentence saying what the control takes. */
export type ControlCheck = { ok: true; value: ControlValue } | { ok: false; message: string };

/**
 * Checks a value from outside (an agent's tool call, a URL, a form) against a
 * control. Colours also accept CSS colours (see {@link parseColor}); `int` values are rounded. Images
 * take a URL: `https:`, `http:`, `data:image/…`, `blob:` or a relative path
 * ("" for none). Numbers beyond the control's declared {@link ControlDef.limits}
 * are refused, unless `limits: false` (for drawing what was given, as it is).
 */
export function checkControlValue(control: ControlDef, raw: unknown, options: { limits?: boolean } = {}): ControlCheck {
  const fail = (message: string): ControlCheck => ({ ok: false, message });
  const { min, max } = options.limits === false ? {} : (control.limits ?? {});
  const within = (x: number) => (min === undefined || x >= min) && (max === undefined || x <= max);
  const bounds = min !== undefined && max !== undefined ? `from ${min} to ${max}` : min !== undefined ? `of at least ${min}` : `of at most ${max}`;
  const n = COMPONENTS[control.type];
  if (control.type === "bool") {
    return typeof raw === "boolean"
      ? { ok: true, value: raw }
      : fail(`${control.name} takes true or false.`);
  }
  if (control.type === "sampler2D") {
    return typeof raw === "string" && (raw === "" || isImageUrl(raw))
      ? { ok: true, value: raw }
      : fail(`${control.name} takes an image URL: https://…, data:image/… or blob:….`);
  }
  if (control.type === "text") {
    return typeof raw === "string" ? { ok: true, value: raw } : fail(`${control.name} takes text.`);
  }
  if (control.color && typeof raw === "string") {
    const rgb = parseColor(raw);
    if (!rgb) return fail(`${control.name} takes a colour like "#77C16A", "rgb(119 193 106)" or "hsl(110 40% 59%)".`);
    return { ok: true, value: colourValue(control, rgb) };
  }
  if (n === 1) {
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      return fail(`${control.name} takes a number.`);
    }
    if (!within(raw)) return fail(`${control.name} takes a number ${bounds}, not ${raw}.`);
    return { ok: true, value: control.type === "int" ? Math.round(raw) : raw };
  }
  if (
    !Array.isArray(raw) ||
    raw.length !== n ||
    !raw.every((x) => typeof x === "number" && Number.isFinite(x))
  ) {
    return fail(
      `${control.name} takes ${n} numbers${control.color ? ' (or a colour like "#77C16A")' : ""}.`,
    );
  }
  if (!control.color && !(raw as number[]).every(within)) {
    return fail(`${control.name} takes ${n} numbers, each ${bounds}, not [${(raw as number[]).join(", ")}].`);
  }
  return { ok: true, value: raw as number[] };
}

/**
 * {@link checkControlValue} for controls whose values are never strings:
 * returns the value to store, or the message. An image control's value is a
 * string too, so use `checkControlValue` where images can appear.
 */
export function coerceControlValue(control: ControlDef, raw: unknown): ControlValue | string {
  const check = checkControlValue(control, raw);
  return check.ok ? check.value : check.message;
}

/** Whether a string is a URL an image control can load: `http(s):`, `data:image/`, `blob:` or a relative path. */
export function isImageUrl(url: string): boolean {
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url.trim())?.[1]?.toLowerCase();
  if (scheme === undefined) return url.trim() !== "";
  if (scheme === "data") return /^data:image\//i.test(url.trim());
  return scheme === "http" || scheme === "https" || scheme === "blob";
}

/** The image URLs the controls show with these values, without duplicates or empty ones. */
export function imageUrls(
  controls: ControlDef[],
  values: Record<string, ControlValue> | undefined,
): string[] {
  const urls = new Set<string>();
  for (const control of controls) {
    if (control.type !== "sampler2D") continue;
    const url = controlValue(control, values) as string;
    if (url) urls.add(url);
  }
  return [...urls];
}

/**
 * A value as compact, JSON-friendly data: colours as hex, numbers to three
 * decimals. A long `data:` URL is shortened to its type and size, which
 * keeps it out of an agent's context but cannot be stored back.
 */
export function describeValue(control: ControlDef, value: ControlValue): unknown {
  if (typeof value === "string" && value.startsWith("data:") && value.length > 100) {
    const kb = Math.round((value.length * 3) / 4 / 1024);
    return `${value.slice(0, value.indexOf(",") + 1)}… (about ${kb} kB)`;
  }
  if (control.color && Array.isArray(value)) return rgbToHex(value);
  if (Array.isArray(value)) return value.map((v) => Math.round(v * 1000) / 1000);
  if (typeof value === "number") return Math.round(value * 1000) / 1000;
  return value;
}
