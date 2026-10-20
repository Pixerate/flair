import { Ajv2020 } from "ajv/dist/2020.js";
import { checkControlValue, isImageUrl, parseControls } from "./controls.js";
import { controlSchema, controlsSchema, controlUnit, CSS_COLOR_PATTERN, IMAGE_URL_PATTERN } from "./schema.js";

const ajv = new Ajv2020({ strict: true, allErrors: true });

const SOURCE = [
  'uniform float uSpeed;  // @control min=0 max=4 default=1 label="Speed"',
  'uniform float uSize;   // @control min=1 max=64 default=8 label="Size (px)"',
  "uniform float uTurn;   // @control min=0 max=360 default=45 unit=degrees",
  "uniform int uSteps;    // @control min=1 max=64 default=16",
  "uniform bool uGrain;   // @control default=true",
  "uniform vec2 uCenter;  // @control min=-1 max=1 default=0,0",
  "uniform vec3 uTint;    // @control color default=#77C16A",
  "uniform vec4 uGlow;    // @control color default=#77C16A80",
  "uniform sampler2D uPhoto; // @control",
].join("\n");

describe("controlsSchema", () => {
  const controls = parseControls(SOURCE);
  const schema = controlsSchema(controls, { title: "Test" });
  const validate = ajv.compile(schema);

  it("is a strict object of the controls, none required", () => {
    expect(schema).toMatchObject({ type: "object", additionalProperties: false, title: "Test" });
    expect(Object.keys(schema.properties!)).toEqual(controls.map((c) => c.name));
    expect(schema.required).toBeUndefined();
    expect(validate({})).toBe(true);
    expect(validate({ uNope: 1 })).toBe(false);
  });

  it("maps each type", () => {
    const p = schema.properties!;
    expect(p.uSpeed).toMatchObject({ type: "number", minimum: 0, maximum: 4, default: 1, title: "Speed" });
    expect(p.uSteps).toMatchObject({ type: "integer", minimum: 1, maximum: 64, default: 16 });
    expect(p.uGrain).toMatchObject({ type: "boolean", default: true });
    expect(p.uCenter).toMatchObject({ type: "array", minItems: 2, maxItems: 2, items: { type: "number", minimum: -1, maximum: 1 } });
    expect(p.uTint!.anyOf![0]).toMatchObject({ type: "array", minItems: 3, maxItems: 3 });
    expect(p.uGlow!.anyOf![0]).toMatchObject({ minItems: 4 });
    expect(p.uPhoto).toMatchObject({ type: "string", default: "" });
  });

  it("describes units, ranges and defaults", () => {
    const p = schema.properties!;
    expect(p.uSize).toMatchObject({ title: "Size", description: "Size in pixels: from 1 to 64 (default 8)." });
    expect(p.uTurn!.description).toBe("Turn in degrees: from 0 to 360 (default 45).");
    expect(p.uSpeed!.description).toBe("Speed: from 0 to 4 (default 1).");
    expect(p.uTint!.description).toContain('a CSS colour string such as "#77c16a"');
    expect(p.uCenter!.description).toContain("2 numbers (x, y), each from -1 to 1");
    expect(controlUnit(controls[0]!)).toBeUndefined();
  });

  it.each([
    ["uSpeed", 2, true],
    ["uSpeed", 5, false],
    ["uSpeed", "2", false],
    ["uSteps", 3.5, false],
    ["uGrain", 1, false],
    ["uCenter", [0.2, -0.5], true],
    ["uCenter", [0.2], false],
    ["uTint", "#fff", true],
    ["uTint", "rgb(10 20 30)", true],
    ["uTint", "hsl(110 40% 59%)", true],
    ["uTint", [1, 0, 0], true],
    ["uTint", [2, 0, 0], false],
    ["uTint", "red", false],
    ["uGlow", [1, 0, 0, 0.5], true],
    ["uPhoto", "", true],
    ["uPhoto", "https://example.com/a.png", true],
    ["uPhoto", "img/a.png", true],
    ["uPhoto", "javascript:alert(1)", false],
    ["uPhoto", "data:text/html,hi", false],
  ])("%s = %j is %s", (name, value, ok) => {
    expect(validate({ [name]: value })).toBe(ok);
  });

  it("takes no value checkControlValue refuses", () => {
    const samples: unknown[] = [0, 1, 2.5, -3, true, "", "#fff", "rgb(1,2,3)", "nope", [0, 0], [0, 0, 0], [0.5, 0.5, 0.5, 0.5], "https://x/a.png", "ftp://x"];
    for (const control of controls) {
      const one = ajv.compile(controlSchema(control));
      for (const value of samples) if (one(value)) expect(checkControlValue(control, value).ok, `${control.name} ${JSON.stringify(value)}`).toBe(true);
    }
  });
});

describe("patterns", () => {
  it("IMAGE_URL_PATTERN agrees with isImageUrl", () => {
    const re = new RegExp(IMAGE_URL_PATTERN);
    for (const url of ["", "https://a/b.png", "HTTP://a", "blob:x", "data:image/png;base64,AA", "Data:Image/png,x", "a.png", "/a/b.png", " a.png", "javascript:x", "data:text/plain,x", "ftp://x", "   "]) {
      expect(re.test(url), url).toBe(url === "" || isImageUrl(url));
    }
  });

  it("CSS_COLOR_PATTERN takes hex, rgb() and hsl()", () => {
    const re = new RegExp(CSS_COLOR_PATTERN);
    for (const c of ["#fff", "fff", "#ffff", "#77C16A", "#77C16A80", "rgb(1, 2, 3)", "rgba(1 2 3 / 50%)", "hsl(1 2% 3%)"]) expect(re.test(c), c).toBe(true);
    for (const c of ["red", "currentColor", "#ff", "lab(1 2 3)"]) expect(re.test(c), c).toBe(false);
  });
});
