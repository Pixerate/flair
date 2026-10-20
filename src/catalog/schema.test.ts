import { Ajv2020 } from "ajv/dist/2020.js";
import { checkControlValue } from "../shader/controls.js";
import { EFFECTS, effectControls, effectControlSchema, getEffect } from "./index.js";

const ajv = new Ajv2020({ strict: true, allErrors: true });

describe("effectControlSchema", () => {
  it("is undefined for an unknown effect", () => {
    expect(effectControlSchema("no-such-effect")).toBeUndefined();
  });

  it("takes an id or a definition", () => {
    expect(effectControlSchema("aurora")).toEqual(effectControlSchema(getEffect("aurora")!));
  });

  describe.each(EFFECTS.map((e) => [e.id, e] as const))("%s", (_, effect) => {
    const schema = effectControlSchema(effect)!;
    const controls = effectControls(effect);

    it("compiles strictly, and describes every control with its default", () => {
      const validate = ajv.compile(schema);
      expect(schema).toMatchObject({ type: "object", additionalProperties: false, title: `${effect.name} controls` });
      expect(Object.keys(schema.properties!)).toEqual(controls.map((c) => c.name));
      for (const control of controls) {
        const property = schema.properties![control.name]!;
        expect(property.title).toBeTruthy();
        expect(property.description).toMatch(/default/);
        expect(property.default).toEqual(control.default);
      }
      expect(validate({ notAControl: 1 })).toBe(false);
    });

    it("takes the defaults and every preset", () => {
      const validate = ajv.compile(schema);
      const defaults = Object.fromEntries(controls.map((c) => [c.name, c.default]));
      expect(validate(defaults), JSON.stringify(validate.errors)).toBe(true);
      for (const preset of effect.presets ?? []) {
        expect(validate(preset.values), `${preset.name}: ${JSON.stringify(validate.errors)}`).toBe(true);
        for (const [name, value] of Object.entries(preset.values)) {
          const control = controls.find((c) => c.name === name)!;
          if (typeof value !== "string" || !/^currentcolor$/i.test(value)) expect(checkControlValue(control, value).ok).toBe(true);
        }
      }
    });
  });

  it("lets vector colours follow the text with currentColor, and shader colours not", () => {
    const vector = EFFECTS.find((e) => e.kind === "vector" && effectControls(e).some((c) => c.color))!;
    const colour = effectControls(vector).find((c) => c.color)!;
    expect(ajv.compile(effectControlSchema(vector)!)({ [colour.name]: "currentColor" })).toBe(true);
    const shader = EFFECTS.find((e) => e.kind === "shader" && effectControls(e).some((c) => c.color))!;
    const shaderColour = effectControls(shader).find((c) => c.color)!;
    expect(ajv.compile(effectControlSchema(shader)!)({ [shaderColour.name]: "currentColor" })).toBe(false);
  });
});
