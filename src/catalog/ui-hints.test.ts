import { Ajv } from "ajv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { flairEffects } from "../integrations/effects.js";
import { effectControls, effectMeta, getEffect, renderVectorEffect, UI_COLOR_ROLES, UI_HINTS, uiContentHash, uiHint, uiValues, type VectorEffect } from "./index.js";
import { getEffectMeta } from "./lazy.js";
import { effectUi } from "./ui-hints.js";

// UiDescriptor's JSON Schema, copied from @pixerate/schemas (see the file's $comment).
const descriptorSchema = JSON.parse(readFileSync(resolve(__dirname, "../../tests/fixtures/ui-descriptor.schema.json"), "utf8"));
const ajv = new Ajv({ strict: false, allErrors: true });
const validDescriptor = ajv.compile(descriptorSchema);

const ids = Object.keys(UI_HINTS);
const vector = (id: string) => getEffect(id) as VectorEffect;

describe("UI hints", () => {
  it("are the pilot's three effects", () => {
    expect(ids.sort()).toEqual(["gauge", "progress-bar", "toggle-switch"]);
    expect(uiHint("aurora")).toBeUndefined();
    expect(uiHint("constructor")).toBeUndefined();
  });

  it.each(ids)("%s: its descriptor is a UiDescriptor and its bindings name real controls", (id) => {
    const effect = vector(id);
    const meta = effectMeta(effect);
    expect(effect.kind).toBe("vector");
    expect(validDescriptor(meta.ui), JSON.stringify(validDescriptor.errors)).toBe(true);
    const { ui, bindings } = UI_HINTS[id]!;
    const contract = ui.contract!;
    const controls = new Map(effectControls(effect).map((c) => [c.name, c]));
    // Every colour role is a kebab-case role, drawn by a colour control.
    expect(contract.colorRoles).toEqual(Object.keys(bindings.colors));
    for (const [role, control] of Object.entries(bindings.colors)) {
      expect(role).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(controls.get(control)?.color, `${id}: ${role} → ${control}`).toBe(true);
    }
    expect(contract.colorRoles!.filter((r) => !(UI_COLOR_ROLES as readonly string[]).includes(r))).toEqual([]);
    // Every prop fills a control, and every control a prop names exists.
    const props = (contract.props?.properties ?? {}) as Record<string, unknown>;
    expect(Object.keys(bindings.props).sort()).toEqual(Object.keys(props).sort());
    for (const control of Object.values(bindings.props)) expect(controls.has(control), `${id}: ${control}`).toBe(true);
    // Props are a JSON Schema the example's props meet; state is bound to an interaction the effect answers.
    const stateNames = (contract.state ?? []).map((s) => s.name);
    const exampleProps = Object.fromEntries(Object.entries(ui.example ?? {}).filter(([k]) => !stateNames.includes(k)));
    const validProps = ajv.compile(contract.props!);
    expect(validProps(exampleProps), JSON.stringify(validProps.errors)).toBe(true);
    for (const name of stateNames) {
      expect(bindings.state?.[name]?.interaction).toBe(effect.trigger);
      const field = contract.state!.find((s) => s.name === name)!;
      expect(contract.events?.map((e) => e.name)).toContain(field.event);
    }
    expect(contract.a11y?.role).toBeTruthy();
    expect(contract.a11y?.reducedMotionAt).toBeGreaterThan(0);
    expect(ui.platforms).toEqual(["react", "svelte", "html-page"]);
  });

  it("are left off effects that are not UI, and off an edited copy that lost a bound control", () => {
    expect(effectMeta(getEffect("aurora")!).ui).toBeUndefined();
    expect(effectMeta(getEffect("checkbox")!).ui).toBeUndefined();
    const gauge = vector("gauge");
    const edited: VectorEffect = { ...gauge, motion: { ...gauge.motion, svg: gauge.motion.svg.replace("{{needleColor: color default=#0F172A label='Needle'}}", "") } };
    expect(effectUi(edited)).toBeUndefined();
    expect(effectMeta(edited).ui).toBeUndefined();
  });

  it("render from their examples", () => {
    const words: Record<string, string[]> = { "toggle-switch": [], "progress-bar": ["Uploading"], gauge: ["Performance", "100"] };
    for (const id of ids) {
      const effect = vector(id);
      const { values } = uiValues(effect, UI_HINTS[id]!.ui.example ?? {});
      const motion = renderVectorEffect(effect, values);
      expect(motion.svg, id).not.toMatch(/\{\{/);
      for (const word of words[id]!) expect(motion.svg, id).toContain(word);
    }
  });
});

describe("uiValues", () => {
  it("fills the bound controls from typed data, and keeps state apart", () => {
    expect(uiValues(vector("gauge"), { value: 88, max: 160, unit: " km/h", label: "Speed" })).toEqual({ values: { value: 88, max: 160, unit: " km/h", label: "Speed" }, state: {} });
    expect(uiValues(vector("progress-bar"), { value: 40 })).toEqual({ values: { value: 40 }, state: {} });
    expect(uiValues(vector("toggle-switch"), { checked: true })).toEqual({ values: {}, state: { checked: true } });
    const gauge = renderVectorEffect(vector("gauge"), uiValues(vector("gauge"), { value: 88, max: 160, unit: " km/h", label: "Speed" }).values);
    expect(gauge.svg).toContain("Speed");
    expect(gauge.svg).toContain("160");
  });

  it("refuses data that does not fit, saying what it takes", () => {
    expect(() => uiValues(vector("gauge"), { values: "1,2,3" })).toThrow(/"gauge" \(gauge\) has no prop "values"; it takes "value", "max", "unit", "label"/);
    expect(() => uiValues(vector("gauge"), { value: "72" })).toThrow(/"gauge"'s "value" must be a number, not "72"/);
    expect(() => uiValues(vector("gauge"), { value: 1, max: 0 })).toThrow(/"max" must be more than 0/);
    expect(() => uiValues(vector("progress-bar"), { value: 120 })).toThrow(/must be at most 100, not 120/);
    expect(() => uiValues(vector("toggle-switch"), { checked: "yes" })).toThrow(/"checked" must be a boolean/);
    expect(() => uiValues(getEffect("aurora")!, { value: 1 })).toThrow(/"aurora" is not offered as a UI component/);
  });
});

describe("content hashes", () => {
  it("are 16 hex digits, one per effect, the same each time and the same in the lazy catalog", () => {
    const hashes = ids.map((id) => effectMeta(vector(id)).ui!.contentHash!);
    for (const hash of hashes) expect(hash).toMatch(/^[0-9a-f]{16}$/);
    expect(new Set(hashes).size).toBe(ids.length);
    expect(ids.map((id) => effectMeta(vector(id)).ui!.contentHash)).toEqual(hashes);
    expect(ids.map((id) => getEffectMeta(id)!.ui!.contentHash)).toEqual(hashes);
    // A copy with the same content hashes the same.
    const copy = structuredClone({ ...vector("gauge"), derived: undefined });
    const gauge = vector("gauge");
    expect(uiContentHash({ ...copy, derived: gauge.derived }, UI_HINTS.gauge!, effectControls(gauge))).toBe(hashes[ids.indexOf("gauge")]);
  });

  it("change when the effect's picture, controls or descriptor change", () => {
    const toggle = vector("toggle-switch");
    const hint = UI_HINTS["toggle-switch"]!;
    const before = uiContentHash(toggle, hint, effectControls(toggle));
    const recoloured: VectorEffect = { ...toggle, motion: { ...toggle.motion, svg: toggle.motion.svg.replace("default=#6366F1", "default=#22C55E") } };
    expect(uiContentHash(recoloured, hint, effectControls(recoloured))).not.toBe(before);
    const redrawn: VectorEffect = { ...toggle, motion: { ...toggle.motion, svg: toggle.motion.svg.replace('rx="25"', 'rx="20"') } };
    expect(uiContentHash(redrawn, hint, effectControls(redrawn))).not.toBe(before);
    const slower: VectorEffect = { ...toggle, hold: 1200 };
    expect(uiContentHash(slower, hint, effectControls(slower))).not.toBe(before);
    expect(uiContentHash(toggle, { ...hint, ui: { ...hint.ui, implements: "toggle" } }, effectControls(toggle))).not.toBe(before);
  });
});

describe("flairEffects()", () => {
  it("declares uiHints, and gives each UI effect its descriptor and bindings on its summary and description", async () => {
    const provider = flairEffects();
    expect(provider.capabilities.uiHints).toBe(true);
    const components = provider.list().filter((s) => s.ui);
    expect(components.map((s) => s.id).sort()).toEqual([...ids].sort());
    for (const summary of components) {
      const description = await provider.describe(summary.id);
      expect(description.ui, summary.id).toEqual(summary.ui);
      expect(description.uiBindings, summary.id).toEqual(UI_HINTS[summary.id]!.bindings);
      expect(summary.ui!.contentHash).toBe(getEffectMeta(summary.id)!.ui!.contentHash);
    }
    expect((await provider.describe("aurora")).ui).toBeUndefined();
  });
});
