import { standaloneHtml } from "./standalone.js";
import { shaderSource } from "./test-utils.js";
import { VERTEX_SOURCE, wrapSource } from "./program.js";

/** The value of `const NAME = …;` in the page's script. */
function constant(html: string, name: string): unknown {
  const m = new RegExp(`^const ${name} = (.*);$`, "m").exec(html);
  if (!m) throw new Error(`No ${name} in the page.`);
  return JSON.parse(m[1]!);
}

describe("standaloneHtml", () => {
  const source = shaderSource(
    "uniform float uSpeed; // @control default=1",
    "uniform vec3 uTint; // @control color default=#ff0000",
  );

  it("is a complete page with a full-window canvas", () => {
    const html = standaloneHtml("Plasma", source);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>Plasma</title>");
    expect(html).toContain('<canvas id="c"></canvas>');
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
  });

  it("embeds the wrapped fragment shader and the vertex shader", () => {
    const html = standaloneHtml("Plasma", source);
    expect(constant(html, "FRAGMENT")).toBe(wrapSource(source));
    expect(constant(html, "VERTEX")).toBe(VERTEX_SOURCE);
  });

  it("bakes in control values, falling back to defaults", () => {
    const html = standaloneHtml("Plasma", source, { uSpeed: 2.5 });
    expect(constant(html, "CONTROLS")).toEqual([
      { name: "uSpeed", type: "float", value: 2.5 },
      { name: "uTint", type: "vec3", value: [1, 0, 0] },
    ]);
  });

  it("escapes the title", () => {
    expect(standaloneHtml('<b>"Fish" & chips</b>', source)).toContain(
      "<title>&lt;b&gt;&quot;Fish&quot; &amp; chips&lt;/b&gt;</title>",
    );
  });

  it("cannot be broken out of by a </script> in the shader", () => {
    const evil = shaderSource("// </script><script>alert(1)</script> <!--");
    const html = standaloneHtml("Evil", evil);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(html).not.toContain("<!--");
    expect(constant(html, "FRAGMENT")).toBe(wrapSource(evil));
  });

  it("credits Gobo by default, or whatever it is told", () => {
    expect(standaloneHtml("A", source)).toContain("// Exported with Gobo.");
    expect(
      standaloneHtml("A", source, undefined, { credit: "Exported from Generative FX." }),
    ).toContain("// Exported from Generative FX.");
  });

  it("keeps a multi-line credit inside its comment", () => {
    const html = standaloneHtml("A", source, undefined, { credit: "one\nalert(1)" });
    expect(html).toContain("// one alert(1)");
  });

  it("runs: compiles both shaders, sets the controls and starts drawing", () => {
    const html = standaloneHtml("Plasma", source, { uSpeed: 2 });
    const script = /<script>([\s\S]*)<\/script>/.exec(html)![1]!;
    const calls: string[] = [];
    const gl = new Proxy(
      { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, TRIANGLES: 4 },
      {
        get(target, prop: string) {
          if (prop in target) return target[prop as keyof typeof target];
          return (...args: unknown[]) => {
            calls.push(
              `${prop}(${args.map((a) => (typeof a === "string" && a.length > 40 ? "…" : JSON.stringify(a))).join(",")})`,
            );
            return prop === "getShaderParameter"
              ? true
              : prop === "getUniformLocation"
                ? args[1]
                : {};
          };
        },
      },
    );
    const canvas = {
      getContext: () => gl,
      addEventListener: () => {},
      getBoundingClientRect: () => ({ left: 0, bottom: 100, width: 100, height: 100 }),
      clientWidth: 100,
      clientHeight: 50,
      width: 0,
      height: 0,
    };
    const frames: FrameRequestCallback[] = [];
    new Function(
      "document",
      "requestAnimationFrame",
      "addEventListener",
      "devicePixelRatio",
      script,
    )(
      { getElementById: () => canvas, body: {} },
      (cb: FrameRequestCallback) => frames.push(cb),
      () => {},
      2,
    );
    expect(calls.filter((c) => c.startsWith("compileShader"))).toHaveLength(2);
    expect(calls).toContain('uniform1f("uSpeed",2)');
    expect(calls).toContain('uniform3fv("uTint",[1,0,0])');
    frames[0]!(16);
    expect([canvas.width, canvas.height]).toEqual([200, 100]);
    expect(calls).toContain('uniform3f("iResolution",200,100,1)');
    expect(calls).toContain("drawArrays(4,0,3)");
  });
});
