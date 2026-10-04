/**
 * Controls declared in a shader's source. A uniform becomes a control when
 * its declaration carries an `@control` comment on the same line:
 *
 *   uniform float uSpeed;  // @control min=0 max=4 default=1 label="Speed"
 *   uniform int uSteps;    // @control min=1 max=64 default=16
 *   uniform bool uGrain;   // @control default=true label="Film grain"
 *   uniform vec2 uCenter;  // @control min=-1 max=1 default=0,0
 *   uniform vec3 uTint;    // @control color default=#77C16A label="Tint"
 *
 * The source is the single source of truth for which controls exist and
 * their defaults; values someone picks are stored next to it.
 */

/** The uniform types a control can have. */
export type ControlType = "float" | "int" | "bool" | "vec2" | "vec3" | "vec4";

/** A control's value: a number (`float`, `int`), a boolean (`bool`) or the components of a vector. */
export type ControlValue = number | boolean | number[];

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
}

const DECLARATION =
  /^\s*uniform\s+(float|int|bool|vec2|vec3|vec4)\s+([A-Za-z_]\w*)\s*;\s*\/\/\s*@control\b(.*)$/;
const ATTRIBUTE = /([a-z]+)(?:=("[^"]*"|\S+))?/gi;

const COMPONENTS: Record<ControlType, number> = {
  float: 1,
  int: 1,
  bool: 1,
  vec2: 2,
  vec3: 3,
  vec4: 4,
};

/** The number of components a control type has: 1 for scalars and `bool`, else the vector size. */
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
    const type = m[1] as ControlType;
    const name = m[2]!;
    seen.add(name);
    const attrs: Record<string, string | undefined> = {};
    for (const a of m[3]!.matchAll(ATTRIBUTE)) {
      attrs[a[1]!.toLowerCase()] = a[2]?.replace(/^"|"$/g, "");
    }
    const color = "color" in attrs && (type === "vec3" || type === "vec4");
    const num = (v: string | undefined, fallback: number) =>
      v !== undefined && Number.isFinite(Number(v)) ? Number(v) : fallback;
    const min = num(attrs.min, 0);
    const rawMax = num(attrs.max, type === "int" ? 10 : 1);
    const max = rawMax > min ? rawMax : min + 1;
    controls.push({
      name,
      type,
      label: attrs.label ?? humanise(name),
      color,
      min,
      max,
      step: num(attrs.step, type === "int" ? 1 : (max - min) / 200),
      default: parseDefault(attrs.default, type, color),
      line: index + 1,
    });
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
  const n = COMPONENTS[control.type];
  if (n === 1) return typeof v === "number" ? v : control.default;
  return Array.isArray(v) && v.length === n ? v : control.default;
}

/**
 * Checks a value from outside (an agent's tool call, a URL, a form) against a
 * control. Returns the value to store, or a sentence saying what the control
 * takes. Colours also accept "#RRGGBB"; `int` values are rounded.
 */
export function coerceControlValue(control: ControlDef, raw: unknown): ControlValue | string {
  const n = COMPONENTS[control.type];
  if (control.type === "bool") {
    return typeof raw === "boolean" ? raw : `${control.name} takes true or false.`;
  }
  if (control.color && typeof raw === "string") {
    const rgb = hexToRgb(raw);
    if (!rgb) return `${control.name} takes a colour like "#77C16A".`;
    return control.type === "vec4" ? [...rgb, 1] : rgb;
  }
  if (n === 1) {
    if (typeof raw !== "number" || !Number.isFinite(raw)) return `${control.name} takes a number.`;
    return control.type === "int" ? Math.round(raw) : raw;
  }
  if (
    !Array.isArray(raw) ||
    raw.length !== n ||
    !raw.every((x) => typeof x === "number" && Number.isFinite(x))
  ) {
    return `${control.name} takes ${n} numbers${control.color ? ' (or a colour like "#77C16A")' : ""}.`;
  }
  return raw as number[];
}

/** A value as compact, JSON-friendly data: colours as hex, numbers to three decimals. */
export function describeValue(control: ControlDef, value: ControlValue): unknown {
  if (control.color && Array.isArray(value)) return rgbToHex(value);
  if (Array.isArray(value)) return value.map((v) => Math.round(v * 1000) / 1000);
  if (typeof value === "number") return Math.round(value * 1000) / 1000;
  return value;
}
