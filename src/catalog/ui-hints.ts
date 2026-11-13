/**
 * UI hints: which catalog effects work as UI components, and how a host
 * drives them. An effect with a hint is offered as a component that
 * implements a component type (`switch`, `progress`, `gauge` …); one without
 * is not meant as UI.
 *
 * A hint has two parts:
 * - `ui`: a {@link UiDescriptor}, exactly the shape `@pixerate/schemas` gives
 *   it (`UiDescriptorSchema` in its `src/genui.ts`), so a registry can store
 *   it as it is. Flair does not depend on `@pixerate/schemas`: the types
 *   below mirror it, and `src/catalog/ui-hints.test.ts` checks every
 *   descriptor against a copy of its JSON Schema.
 * - `bindings`: how the descriptor maps onto the effect's own controls
 *   ({@link UiBindings}). It is Flair's, kept next to the descriptor rather
 *   than in it, because the descriptor's schema allows no other fields.
 *
 * `ui.contentHash` is worked out from the effect (see {@link uiContentHash}),
 * so a sync can tell when a component's output changed.
 */

import type { ControlDef, ControlValue } from "../shader/controls.js";
import { renderVectorEffect, vectorEffectControls, type EffectDefinition } from "./types.js";

// ---------------------------------------------------------------------------
// Mirrored from @pixerate/schemas (src/genui.ts, Pixerate/schemas#80):
// UiDescriptorSchema, UiComponentContractSchema and what they use. Keep in step.
// ---------------------------------------------------------------------------

/** Any JSON value (`JsonValue` in `@pixerate/schemas`). */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** A JSON Schema document, kept as JSON (`JsonSchemaDocument` in `@pixerate/schemas`). */
export type JsonSchemaDocument = { [key: string]: JsonValue };

/** Where a component can be rendered (`PlatformTarget` in `@pixerate/schemas`). */
export type UiPlatformTarget = "svelte" | "react" | "webcomponent" | "swiftui" | "compose" | "html-page";

/** `baseline` (the shadcn set), `data-visual` (layout follows the data) or `paradigm` (new kinds of UI). */
export type UiComponentGroup = "baseline" | "data-visual" | "paradigm";

/** Standard colour roles (`UI_COLOR_ROLES` in `@pixerate/schemas`); other kebab-case roles are allowed. */
export const UI_COLOR_ROLES = [
  "surface",
  "surface-raised",
  "ink",
  "ink-muted",
  "accent",
  "accent-ink",
  "border",
  "focus",
  "track-on",
  "track-off",
  "success",
  "warning",
  "danger",
  "overlay",
] as const;

/** A controlled value and the event it fires when it changes (`UiStateField`). */
export interface UiStateField {
  /** The controlled value's prop name, e.g. `checked`, `value`. */
  name: string;
  schema?: JsonSchemaDocument;
  /** The event fired when it changes, e.g. `change`. */
  event?: string;
  description?: string;
}

/** An event a component fires (`UiEvent`). */
export interface UiEvent {
  name: string;
  payload?: JsonSchemaDocument;
  description?: string;
}

/** Accessibility (`UiA11y`). */
export interface UiA11y {
  /** ARIA role, e.g. `switch`, `progressbar`, `meter`. */
  role?: string;
  /** Key → what it does, e.g. `{ Space: "toggle", Enter: "toggle" }`. */
  keyboard: Record<string, string>;
  /** Where the accessible name comes from. */
  labelFrom?: "prop" | "children" | "aria-label" | "content";
  /** Progress (0–1) to show, still, under prefers-reduced-motion; 1 is the rest state. */
  reducedMotionAt?: number;
}

/** How a component sizes (`UiSizing`). */
export interface UiSizing {
  mode: "intrinsic" | "fill";
  /** CSS px. */
  minWidth?: number;
  /** CSS px. */
  minHeight?: number;
  /** width / height, for components that keep a shape. */
  aspectRatio?: number;
}

/** What a component type takes and does (`UiComponentContract`). */
export interface UiComponentContract {
  /** JSON Schema for props (typed data). */
  props?: JsonSchemaDocument;
  state: UiStateField[];
  events: UiEvent[];
  a11y?: UiA11y;
  /** The colour roles it draws with. */
  colorRoles: string[];
  /** Whether it follows the page motion contract. */
  motion: boolean;
  sizing?: UiSizing;
}

/** What a provider attaches to an item it offers as a UI component (`UiDescriptor`). */
export interface UiDescriptor {
  /** The component type id it implements, e.g. `switch`, or a new type such as `gauge`. */
  implements: string;
  /** For a new type: which group it belongs to. */
  group?: UiComponentGroup;
  /** Overrides or additions to the type's contract. */
  contract?: Partial<UiComponentContract>;
  /** Platforms the provider can render it on. */
  platforms: UiPlatformTarget[];
  swiftReady?: boolean;
  /** Example props (and state), for previews and checks. */
  example?: { [key: string]: JsonValue };
  /** Changes whenever the item's output changes, so a sync can tell. */
  contentHash?: string;
}

// ---------------------------------------------------------------------------
// Flair's side: how a descriptor maps onto an effect's controls.
// ---------------------------------------------------------------------------

/**
 * How a {@link UiDescriptor} maps onto the effect's controls:
 * - `props`: prop (typed data) name → the control it fills, e.g. `{ value: "value", label: "label" }`.
 * - `colors`: colour role → the colour control that draws it, e.g.
 *   `{ "track-on": "on", "track-off": "off", surface: "background" }`. Its keys are the
 *   contract's `colorRoles`, so a theme's tokens restyle the effect by role.
 * - `state`: controlled value → the interaction that changes it. `{ interaction: "click" }` is
 *   a boolean the effect's click steps flip: step 1 turns it on, step 2 off.
 */
export interface UiBindings {
  props: Readonly<Record<string, string>>;
  colors: Readonly<Record<string, string>>;
  state?: Readonly<Record<string, { interaction: "click" }>>;
}

/** A catalog effect's UI hint: its descriptor (without `contentHash`) and its bindings. */
export interface EffectUiHint {
  ui: Omit<UiDescriptor, "contentHash">;
  bindings: UiBindings;
}

/** Where Flair renders vector components: its React and Svelte wrappers, and any page with `mountEffect`. */
const WEB: UiPlatformTarget[] = ["react", "svelte", "html-page"];

/** Every catalog effect offered as a UI component, by id. */
export const UI_HINTS: Readonly<Record<string, EffectUiHint>> = {
  "toggle-switch": {
    ui: {
      implements: "switch",
      contract: {
        props: { type: "object", properties: {}, additionalProperties: false },
        state: [{ name: "checked", schema: { type: "boolean" }, event: "change", description: "Whether the switch is on." }],
        events: [
          {
            name: "change",
            payload: { type: "object", properties: { checked: { type: "boolean" } }, required: ["checked"] },
            description: "The user flipped it; `checked` is the value asked for.",
          },
        ],
        a11y: { role: "switch", keyboard: { Space: "toggle", Enter: "toggle" }, labelFrom: "aria-label", reducedMotionAt: 1 },
        colorRoles: ["surface", "track-off", "track-on", "surface-raised"],
        motion: false,
        sizing: { mode: "intrinsic", aspectRatio: 5 / 3 },
      },
      platforms: WEB,
      example: { checked: true },
    },
    bindings: {
      props: {},
      colors: { surface: "background", "track-off": "off", "track-on": "on", "surface-raised": "knob" },
      state: { checked: { interaction: "click" } },
    },
  },
  "progress-bar": {
    ui: {
      implements: "progress",
      contract: {
        props: {
          type: "object",
          properties: {
            value: { type: "number", minimum: 0, maximum: 100, description: "Percent done." },
            label: { type: "string", description: "What is in progress; also its accessible name." },
          },
          required: ["value"],
          additionalProperties: false,
        },
        state: [],
        events: [],
        // At rest the bar is full to its value; its loop fades it out after.
        a11y: { role: "progressbar", keyboard: {}, labelFrom: "prop", reducedMotionAt: 0.5 },
        colorRoles: ["accent", "track-off", "ink"],
        motion: false,
        sizing: { mode: "intrinsic", aspectRatio: 260 / 64 },
      },
      platforms: WEB,
      example: { value: 68, label: "Uploading" },
    },
    bindings: { props: { value: "value", label: "label" }, colors: { accent: "accent", "track-off": "track", ink: "ink" } },
  },
  gauge: {
    ui: {
      implements: "gauge",
      group: "data-visual",
      contract: {
        props: {
          type: "object",
          properties: {
            value: { type: "number", minimum: 0, description: "The reading." },
            max: { type: "number", exclusiveMinimum: 0, description: "The scale's maximum (default 100)." },
            unit: { type: "string", description: 'Written after the reading, e.g. "%" or " km/h".' },
            label: { type: "string", description: "What it measures; also its accessible name." },
          },
          required: ["value"],
          additionalProperties: false,
        },
        state: [],
        events: [],
        a11y: { role: "meter", keyboard: {}, labelFrom: "prop", reducedMotionAt: 1 },
        colorRoles: ["success", "warning", "danger", "accent", "surface", "ink"],
        motion: false,
        sizing: { mode: "intrinsic", aspectRatio: 24 / 17 },
      },
      platforms: WEB,
      example: { value: 72, max: 100, unit: "%", label: "Performance" },
    },
    bindings: {
      props: { value: "value", max: "max", unit: "unit", label: "label" },
      colors: { success: "low", warning: "mid", danger: "high", accent: "needleColor", surface: "hub", ink: "ink" },
    },
  },
};

/** The UI hint for a catalog effect id, if it has one. */
export function uiHint(id: string): EffectUiHint | undefined {
  return Object.hasOwn(UI_HINTS, id) ? UI_HINTS[id] : undefined;
}

/**
 * The UI hint that applies to `effect`: a vector effect with a hinted id
 * whose controls are still the ones its bindings name (an edited copy may
 * have lost some). Undefined otherwise.
 */
export function effectUi(effect: EffectDefinition, controls?: readonly ControlDef[]): EffectUiHint | undefined {
  if (effect.kind !== "vector") return undefined;
  const hint = uiHint(effect.id);
  if (!hint) return undefined;
  const byName = new Map((controls ?? vectorEffectControls(effect)).map((c) => [c.name, c]));
  const { props, colors, state } = hint.bindings;
  if (!Object.values(props).every((name) => byName.has(name))) return undefined;
  if (!Object.values(colors).every((name) => byName.get(name)?.color)) return undefined;
  if (state && Object.values(state).some((s) => s.interaction === "click") && effect.trigger !== "click") return undefined;
  return hint;
}

/** A component's typed input, split: control values from its props, and its controlled state. */
export interface UiInput {
  values: Record<string, ControlValue>;
  state: Record<string, JsonValue>;
}

const typeOf = (v: unknown) => (Array.isArray(v) ? "array" : v === null ? "null" : typeof v);

/** Why `value` does not fit `schema` (the subset the hints use), or undefined when it does. */
function misfit(value: unknown, schema: JsonSchemaDocument | undefined): string | undefined {
  if (!schema) return undefined;
  const type = schema.type;
  const wrong =
    type === "integer" ? !Number.isInteger(value) : type === "number" ? typeof value !== "number" || !Number.isFinite(value) : typeof type === "string" && typeOf(value) !== type;
  if (wrong) return `must be ${type === "integer" ? "an integer" : `a ${String(type)}`}, not ${JSON.stringify(value)}`;
  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) return `must be at least ${schema.minimum}, not ${value}`;
    if (typeof schema.maximum === "number" && value > schema.maximum) return `must be at most ${schema.maximum}, not ${value}`;
    if (typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum) return `must be more than ${schema.exclusiveMinimum}, not ${value}`;
  }
  return undefined;
}

/**
 * A component's typed input as control values: each prop fills the control
 * its binding names, and controlled state (`checked`) comes back apart.
 * Props left out keep the effect's own values. Throws a sentence naming what
 * does not fit (an unknown prop, a wrong type, a value out of range) and
 * what the effect takes.
 *
 * ```ts
 * const gauge = getEffect("gauge")!;
 * const { values } = uiValues(gauge, { value: 88, max: 160, unit: " km/h", label: "Speed" });
 * renderVectorEffect(gauge, values);
 * ```
 */
export function uiValues(effect: EffectDefinition, input: Readonly<Record<string, unknown>>): UiInput {
  const hint = effectUi(effect);
  if (!hint) throw new Error(`"${effect.id}" is not offered as a UI component, so it takes no typed data; give it control values instead (UI_HINTS lists the effects that are).`);
  const props = (hint.ui.contract?.props?.properties ?? {}) as Record<string, JsonSchemaDocument>;
  const stateFields = hint.ui.contract?.state ?? [];
  const out: UiInput = { values: {}, state: {} };
  for (const [name, value] of Object.entries(input)) {
    if (value === undefined) continue;
    const field = stateFields.find((s) => s.name === name);
    if (!field && !Object.hasOwn(props, name)) {
      const takes = [...Object.keys(props), ...stateFields.map((s) => s.name)].map((t) => `"${t}"`);
      throw new Error(`"${effect.id}" (${hint.ui.implements}) has no prop "${name}"; it takes ${takes.join(", ") || "nothing"}.`);
    }
    const why = misfit(value, field ? field.schema : props[name]);
    if (why) throw new Error(`"${effect.id}"'s "${name}" ${why}.`);
    if (field) out.state[name] = value as JsonValue;
    else out.values[hint.bindings.props[name]!] = value as ControlValue;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Content hashes
// ---------------------------------------------------------------------------

/** FNV-1a, 64 bits, as 16 hex digits: small, synchronous and the same everywhere. */
function fnv1a64(text: string): string {
  // Four 16-bit limbs, so it needs neither BigInt nor a library.
  let h0 = 0x2325;
  let h1 = 0x8422;
  let h2 = 0x9ce4;
  let h3 = 0xcbf2;
  for (const b of new TextEncoder().encode(text)) {
    h0 ^= b;
    // × the FNV prime, 2^40 + 0x1b3.
    const t0 = h0 * 0x1b3;
    let t1 = h1 * 0x1b3;
    let t2 = h2 * 0x1b3 + (h0 << 8);
    let t3 = h3 * 0x1b3 + (h1 << 8);
    t1 += t0 >>> 16;
    t2 += t1 >>> 16;
    t3 += t2 >>> 16;
    h0 = t0 & 0xffff;
    h1 = t1 & 0xffff;
    h2 = t2 & 0xffff;
    h3 = t3 & 0xffff;
  }
  return [h3, h2, h1, h0].map((h) => h.toString(16).padStart(4, "0")).join("");
}

/** JSON with object keys sorted, so the same data always gives the same text. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

/**
 * A described effect's content hash (`ui.contentHash`): FNV-1a 64 (16 hex
 * digits) of its descriptor and bindings, its controls, presets and timing,
 * and what it draws at its defaults and at its descriptor's example. It
 * changes when any of those do, and is the same in every build.
 */
export function uiContentHash(effect: EffectDefinition, hint: EffectUiHint, controls: readonly ControlDef[]): string {
  const drawn = effect.kind === "vector" ? [renderVectorEffect(effect, {}), renderVectorEffect(effect, uiValues(effect, hint.ui.example ?? {}).values)] : [];
  return fnv1a64(
    canonical({
      id: effect.id,
      ui: hint.ui,
      bindings: hint.bindings,
      controls,
      presets: effect.presets ?? [],
      ...(effect.kind === "vector" && { hold: effect.hold ?? null, trigger: effect.trigger ?? null }),
      drawn,
    }),
  );
}

/** The descriptor `effect` is offered with, its content hash worked out, and its bindings; undefined when it is not UI. */
export function uiDescription(effect: EffectDefinition, controls: readonly ControlDef[]): { ui: UiDescriptor; bindings: UiBindings } | undefined {
  const hint = effectUi(effect, controls);
  return hint && { ui: { ...hint.ui, contentHash: uiContentHash(effect, hint, controls) }, bindings: hint.bindings };
}
