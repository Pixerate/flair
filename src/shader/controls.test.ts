import {
  coerceControlValue,
  componentCount,
  controlValue,
  describeValue,
  hexToRgb,
  humanise,
  parseControls,
  rgbToHex,
  type ControlDef,
} from "./controls.js";

const one = (line: string): ControlDef => {
  const [control] = parseControls(line);
  if (!control) throw new Error(`No control in: ${line}`);
  return control;
};

describe("parseControls", () => {
  it("reads every attribute", () => {
    expect(
      one('uniform float uSpeed; // @control min=0 max=4 step=0.5 default=1 label="Flow speed"'),
    ).toEqual({
      name: "uSpeed",
      type: "float",
      label: "Flow speed",
      color: false,
      min: 0,
      max: 4,
      step: 0.5,
      default: 1,
      line: 1,
    });
  });

  it("finds controls in source order with 1-based lines, skipping plain uniforms", () => {
    const source = [
      "// header",
      "uniform float uA; // @control",
      "uniform float uPlain;",
      "uniform int uB; // @control",
      "void mainImage(out vec4 c, in vec2 p) { c = vec4(uA); }",
    ].join("\n");
    expect(parseControls(source).map((c) => [c.name, c.line])).toEqual([
      ["uA", 2],
      ["uB", 4],
    ]);
  });

  it("supports every type", () => {
    const types = ["float", "int", "bool", "vec2", "vec3", "vec4"] as const;
    const source = types.map((t, i) => `uniform ${t} u${i}; // @control`).join("\n");
    expect(parseControls(source).map((c) => c.type)).toEqual(types);
  });

  it("ignores unsupported types, comments without @control, and annotations on other lines", () => {
    const source = [
      "uniform mat3 uMatrix; // @control",
      "uniform sampler2D uTex; // @control",
      "uniform float uNote; // control",
      "uniform float uNext;",
      "// @control min=0 max=1",
    ].join("\n");
    expect(parseControls(source)).toEqual([]);
  });

  it("allows indentation and flexible spacing", () => {
    expect(one("   uniform   float   uX ;//@control max=2").max).toBe(2);
  });

  it("keeps the first declaration of a duplicated uniform", () => {
    const controls = parseControls(
      ["uniform float uX; // @control max=2", "uniform float uX; // @control max=9"].join("\n"),
    );
    expect(controls).toHaveLength(1);
    expect(controls[0]!.max).toBe(2);
  });

  it("falls back to 0..1 for floats and 0..10 in steps of 1 for ints", () => {
    const f = one("uniform float uF; // @control");
    expect([f.min, f.max, f.step, f.default]).toEqual([0, 1, 1 / 200, 0]);
    const i = one("uniform int uI; // @control");
    expect([i.min, i.max, i.step, i.default]).toEqual([0, 10, 1, 0]);
  });

  it("keeps max above min, and the default step positive", () => {
    const c = one("uniform float uX; // @control min=5 max=2");
    expect(c.max).toBe(6);
    expect(c.step).toBeCloseTo(1 / 200);
    expect(one("uniform float uY; // @control min=3 max=3").max).toBe(4);
  });

  it("ignores numbers that do not parse", () => {
    const c = one("uniform float uX; // @control min=abc max=2 step=?");
    expect(c.min).toBe(0);
    expect(c.step).toBeCloseTo(2 / 200);
  });

  it("reads attribute names in any case and ignores unknown ones", () => {
    const c = one('uniform float uX; // @control MIN=-1 Max=1 LABEL="Spin" wobble=3');
    expect([c.min, c.max, c.label]).toEqual([-1, 1, "Spin"]);
  });

  it("keeps spaces inside a quoted label", () => {
    expect(one('uniform float uX; // @control label="Very slow speed" max=2').label).toBe(
      "Very slow speed",
    );
  });

  describe("defaults", () => {
    it("bool is true only for true or 1", () => {
      expect(one("uniform bool uA; // @control default=true").default).toBe(true);
      expect(one("uniform bool uB; // @control default=1").default).toBe(true);
      expect(one("uniform bool uC; // @control default=yes").default).toBe(false);
      expect(one("uniform bool uD; // @control").default).toBe(false);
    });

    it("vectors read comma lists and repeat the last component", () => {
      expect(one("uniform vec3 uA; // @control default=0.1,0.2,0.3").default).toEqual([
        0.1, 0.2, 0.3,
      ]);
      expect(one("uniform vec3 uB; // @control default=0.5").default).toEqual([0.5, 0.5, 0.5]);
      expect(one("uniform vec4 uC; // @control default=1,2").default).toEqual([1, 2, 2, 2]);
      expect(one("uniform vec2 uD; // @control default=1,x").default).toEqual([1, 0]);
      expect(one("uniform vec2 uE; // @control default=1,2,3").default).toEqual([1, 2]);
    });

    it("vectors without a default are zero, colours white", () => {
      expect(one("uniform vec2 uA; // @control").default).toEqual([0, 0]);
      expect(one("uniform vec3 uB; // @control color").default).toEqual([1, 1, 1]);
      expect(one("uniform vec4 uC; // @control color").default).toEqual([1, 1, 1, 1]);
    });

    it("colours read hex, with alpha 1 for vec4", () => {
      expect(one("uniform vec3 uA; // @control color default=#ff0000").default).toEqual([1, 0, 0]);
      expect(one("uniform vec4 uB; // @control color default=#00f").default).toEqual([0, 0, 1, 1]);
      expect(one("uniform vec3 uC; // @control color default=#zzz").default).toEqual([1, 1, 1]);
      expect(one("uniform vec3 uD; // @control color default=0.2,0.4,0.6").default).toEqual([
        0.2, 0.4, 0.6,
      ]);
    });

    it("a scalar reads the first number of a list", () => {
      expect(one("uniform float uA; // @control default=0.25,9").default).toBe(0.25);
    });
  });

  it("only vec3 and vec4 can be colours", () => {
    expect(one("uniform vec3 uA; // @control color").color).toBe(true);
    expect(one("uniform vec4 uB; // @control color").color).toBe(true);
    expect(one("uniform vec2 uC; // @control color").color).toBe(false);
    expect(one("uniform float uD; // @control color").color).toBe(false);
  });

  it("derives a label from the name", () => {
    expect(one("uniform float uFlowSpeed; // @control").label).toBe("Flow speed");
  });
});

describe("humanise", () => {
  it.each([
    ["uFlowSpeed", "Flow speed"],
    ["uSpeed", "Speed"],
    ["speed", "Speed"],
    ["glow_amount", "Glow amount"],
    ["uRGBShift", "Rgbshift"],
    ["uLayer2Mix", "Layer2 mix"],
    ["under", "Under"],
  ])("%s → %s", (name, label) => {
    expect(humanise(name)).toBe(label);
  });
});

describe("colours", () => {
  it("hexToRgb reads six and three digits, with or without #", () => {
    expect(hexToRgb("#77C16A")).toEqual([0x77 / 255, 0xc1 / 255, 0x6a / 255]);
    expect(hexToRgb("f00")).toEqual([1, 0, 0]);
    expect(hexToRgb("  #FFFFFF ")).toEqual([1, 1, 1]);
  });

  it("hexToRgb rejects anything else", () => {
    for (const bad of ["", "#12", "#12345", "#1234567", "#ggg", "red"]) {
      expect(hexToRgb(bad)).toBeNull();
    }
  });

  it("rgbToHex clamps, rounds and ignores alpha", () => {
    expect(rgbToHex([1, 0, 0])).toBe("#ff0000");
    expect(rgbToHex([2, -1, 0.5, 0.1])).toBe("#ff0080");
  });

  it("round-trips", () => {
    expect(rgbToHex(hexToRgb("#77c16a")!)).toBe("#77c16a");
  });
});

describe("componentCount", () => {
  it("counts components", () => {
    expect(
      ["float", "int", "bool", "vec2", "vec3", "vec4"].map((t) => componentCount(t as never)),
    ).toEqual([1, 1, 1, 2, 3, 4]);
  });
});

describe("controlValue", () => {
  const speed = one("uniform float uSpeed; // @control default=1");
  const on = one("uniform bool uOn; // @control default=true");
  const center = one("uniform vec2 uCenter; // @control default=0.5,0.5");

  it("uses the stored value when it fits", () => {
    expect(controlValue(speed, { uSpeed: 3 })).toBe(3);
    expect(controlValue(on, { uOn: false })).toBe(false);
    expect(controlValue(center, { uCenter: [0, 1] })).toEqual([0, 1]);
  });

  it("falls back to the default when nothing is stored", () => {
    expect(controlValue(speed, undefined)).toBe(1);
    expect(controlValue(speed, {})).toBe(1);
  });

  it("falls back to the default when the stored value no longer fits", () => {
    expect(controlValue(speed, { uSpeed: [1, 2] })).toBe(1);
    expect(controlValue(on, { uOn: 1 })).toBe(true);
    expect(controlValue(center, { uCenter: [1, 2, 3] })).toEqual([0.5, 0.5]);
    expect(controlValue(center, { uCenter: 2 })).toEqual([0.5, 0.5]);
  });
});

describe("coerceControlValue", () => {
  const speed = one("uniform float uSpeed; // @control");
  const steps = one("uniform int uSteps; // @control");
  const on = one("uniform bool uOn; // @control");
  const center = one("uniform vec2 uCenter; // @control");
  const tint = one("uniform vec3 uTint; // @control color");
  const glow = one("uniform vec4 uGlow; // @control color");

  it("accepts values that fit", () => {
    expect(coerceControlValue(speed, 0.5)).toBe(0.5);
    expect(coerceControlValue(on, true)).toBe(true);
    expect(coerceControlValue(center, [1, 2])).toEqual([1, 2]);
    expect(coerceControlValue(tint, [0, 0.5, 1])).toEqual([0, 0.5, 1]);
  });

  it("rounds ints", () => {
    expect(coerceControlValue(steps, 2.6)).toBe(3);
  });

  it("reads hex for colours, with alpha 1 for vec4", () => {
    expect(coerceControlValue(tint, "#ff0000")).toEqual([1, 0, 0]);
    expect(coerceControlValue(glow, "#00ff00")).toEqual([0, 1, 0, 1]);
  });

  it("explains what a control takes", () => {
    expect(coerceControlValue(on, "yes")).toBe("uOn takes true or false.");
    expect(coerceControlValue(speed, "fast")).toBe("uSpeed takes a number.");
    expect(coerceControlValue(speed, Number.NaN)).toBe("uSpeed takes a number.");
    expect(coerceControlValue(speed, Infinity)).toBe("uSpeed takes a number.");
    expect(coerceControlValue(center, [1])).toBe("uCenter takes 2 numbers.");
    expect(coerceControlValue(center, [1, "2"])).toBe("uCenter takes 2 numbers.");
    expect(coerceControlValue(tint, "blue")).toBe('uTint takes a colour like "#77C16A".');
    expect(coerceControlValue(tint, [1, 2])).toBe(
      'uTint takes 3 numbers (or a colour like "#77C16A").',
    );
  });

  it("does not take hex for non-colour vectors", () => {
    expect(coerceControlValue(center, "#ffffff")).toBe("uCenter takes 2 numbers.");
  });
});

describe("describeValue", () => {
  it("writes colours as hex", () => {
    expect(describeValue(one("uniform vec3 uT; // @control color"), [1, 0, 0])).toBe("#ff0000");
  });

  it("rounds numbers to three decimals", () => {
    expect(describeValue(one("uniform float uA; // @control"), 1 / 3)).toBe(0.333);
    expect(describeValue(one("uniform vec2 uB; // @control"), [1 / 3, 2 / 3])).toEqual([
      0.333, 0.667,
    ]);
  });

  it("passes booleans through", () => {
    expect(describeValue(one("uniform bool uC; // @control"), true)).toBe(true);
  });
});
