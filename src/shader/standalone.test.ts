import { standaloneHtml } from "./standalone.js";
import { flush, shaderSource } from "./test-utils.js";
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

  it("credits Flair by default, or whatever it is told", () => {
    expect(standaloneHtml("A", source)).toContain("// Exported with Flair.");
    expect(
      standaloneHtml("A", source, undefined, { credit: "Exported from Generative FX." }),
    ).toContain("// Exported from Generative FX.");
  });

  it("keeps a multi-line credit inside its comment", () => {
    const html = standaloneHtml("A", source, undefined, { credit: "one\nalert(1)" });
    expect(html).toContain("// one alert(1)");
  });

  /** Runs the page's script against a recording WebGL2 stand-in; `calls` are its calls, as text. */
  function run(html: string, elements: Record<string, unknown> = {}) {
    const script = /<script>([\s\S]*)<\/script>/.exec(html)![1]!;
    const calls: string[] = [];
    const constants = {
      VERTEX_SHADER: 1,
      FRAGMENT_SHADER: 2,
      COMPILE_STATUS: 3,
      TRIANGLES: 4,
      TEXTURE0: 100,
      TEXTURE_2D: 5,
      LINEAR_MIPMAP_LINEAR: 6,
      LINEAR: 7,
      NEAREST: 8,
      REPEAT: 9,
      CLAMP_TO_EDGE: 10,
      MIRRORED_REPEAT: 11,
    };
    const gl = new Proxy(constants, {
      get(target, prop: string) {
        if (prop in target) return target[prop as keyof typeof target];
        if (/^[A-Z_]+$/.test(prop)) return prop;
        return (...args: unknown[]) => {
          calls.push(
            `${prop}(${args.map((a) => (typeof a === "string" && a.length > 40 ? "…" : a instanceof Uint8Array ? `[${a.join(",")}]` : JSON.stringify(a))).join(",")})`,
          );
          return prop === "getShaderParameter"
            ? true
            : prop === "getUniformLocation"
              ? args[1]
              : {};
        };
      },
    });
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
    const images: { src: string; crossOrigin?: string; onload?: () => void }[] = [];
    new Function(
      "document",
      "requestAnimationFrame",
      "addEventListener",
      "devicePixelRatio",
      "Image",
      script,
    )(
      { getElementById: (id: string) => (id === "c" ? canvas : (elements[id] ?? null)), body: {} },
      (cb: FrameRequestCallback) => frames.push(cb),
      () => {},
      2,
      function Image(this: (typeof images)[number]) {
        images.push(this);
      },
    );
    return { calls, canvas, frames, images };
  }

  it("runs: compiles both shaders, sets the controls and starts drawing", () => {
    const { calls, canvas, frames } = run(standaloneHtml("Plasma", source, { uSpeed: 2 }));
    expect(calls.filter((c) => c.startsWith("compileShader"))).toHaveLength(2);
    expect(calls).toContain('uniform1f("uSpeed",2)');
    expect(calls).toContain('uniform3fv("uTint",[1,0,0])');
    frames[0]!(16);
    expect([canvas.width, canvas.height]).toEqual([200, 100]);
    expect(calls).toContain('uniform3f("iResolution",200,100,1)');
    expect(calls).toContain("drawArrays(4,0,3)");
  });

  describe("audio", () => {
    const sound = shaderSource("// uses iAudio and iSpectrum and iBeat");

    it("adds a player or a microphone button only when asked", () => {
      expect(standaloneHtml("A", sound)).not.toMatch(/<audio|<button|iAudio"/);
      const withFile = standaloneHtml("A", sound, undefined, { audio: 'song.mp3?a="b"' });
      expect(withFile).toContain('<audio id="a" src="song.mp3?a=&quot;b&quot;" controls loop crossorigin="anonymous"');
      expect(withFile.match(/<\/script>/g)).toHaveLength(1);
      expect(standaloneHtml("A", sound, undefined, { audio: "mic" })).toContain('<button id="m"');
    });

    it("listens to the player once it plays, feeding the audio uniforms", () => {
      const connected: string[] = [];
      class FakeContext {
        sampleRate = 48000;
        destination = "speakers";
        resume() {
          return Promise.resolve();
        }
        createMediaElementSource() {
          return { connect: (to: unknown) => connected.push(to === "speakers" ? "speakers" : "analyser") };
        }
        createAnalyser() {
          return {
            fftSize: 2048,
            frequencyBinCount: 1024,
            getFloatFrequencyData: (out: Float32Array) => out.fill(-30),
            getFloatTimeDomainData: (out: Float32Array) => out.fill(1),
          };
        }
      }
      vi.stubGlobal("AudioContext", FakeContext);
      delete (window as { flairAudio?: unknown }).flairAudio;
      const listeners: Record<string, () => void> = {};
      const player = { addEventListener: (type: string, f: () => void) => (listeners[type] = f) };
      const { calls, frames } = run(standaloneHtml("A", sound, undefined, { audio: "song.mp3" }), { a: player });
      frames[0]!(16);
      expect(calls.some((c) => c.startsWith('uniform4f("iAudio"'))).toBe(false);
      listeners.play!();
      expect(connected).toEqual(["speakers", "analyser"]);
      frames[1]!(32);
      expect(calls).toContain('uniform4f("iAudio",1,1,1,1)');
      expect(calls).toContain('uniform1f("iBeat",-1)');
    });
  });

  describe("images", () => {
    const photos = shaderSource(
      "uniform sampler2D uA; // @control filter=nearest wrap=clamp",
      "uniform sampler2D uB; // @control",
      "uniform sampler2D uC; // @control",
    );

    it("bakes in the URLs and sampling settings", () => {
      const html = standaloneHtml("Photos", photos, { uA: "https://example.com/a.png" });
      expect(constant(html, "CONTROLS")).toEqual([
        {
          name: "uA",
          type: "sampler2D",
          value: "https://example.com/a.png",
          texture: { filter: "nearest", wrap: "clamp" },
        },
        { name: "uB", type: "sampler2D", value: "", texture: { filter: "mipmap", wrap: "repeat" } },
        { name: "uC", type: "sampler2D", value: "", texture: { filter: "mipmap", wrap: "repeat" } },
      ]);
    });

    it("binds each to its own unit, black until its image loads upright", () => {
      const { calls, images } = run(
        standaloneHtml("Photos", photos, {
          uA: "https://example.com/a.png",
          uB: "data:image/png;base64,AAAA",
        }),
      );
      expect(calls).toContain('uniform1i("uA",0)');
      expect(calls).toContain('uniform1i("uB",1)');
      expect(calls).toContain('uniform1i("uC",2)');
      expect(calls).toContain('texImage2D(5,0,"RGBA",1,1,0,"RGBA","UNSIGNED_BYTE",[0,0,0,255])');
      expect(calls).toContain('texParameteri(5,"TEXTURE_MIN_FILTER",8)');
      expect(calls).toContain('texParameteri(5,"TEXTURE_WRAP_S",10)');
      // No image for uC; data URLs need no CORS.
      expect(images.map((i) => [i.src, i.crossOrigin])).toEqual([
        ["https://example.com/a.png", "anonymous"],
        ["data:image/png;base64,AAAA", undefined],
      ]);
      calls.length = 0;
      images[1]!.onload!();
      expect(calls).toEqual([
        "activeTexture(101)",
        "bindTexture(5,{})",
        'pixelStorei("UNPACK_FLIP_Y_WEBGL",true)',
        'texImage2D(5,0,"RGBA","RGBA","UNSIGNED_BYTE",{"src":"data:image/png;base64,AAAA"})',
        "generateMipmap(5)",
      ]);
    });

    it("sizes an SVG before decoding it", async () => {
      const markup = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 12"></svg>';
      const blobs: Blob[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(markup)),
      );
      vi.stubGlobal(
        "URL",
        Object.assign(class extends URL {}, {
          createObjectURL: (blob: Blob) => (blobs.push(blob), "blob:sized"),
        }),
      );
      const { images } = run(
        standaloneHtml("Logo", photos, { uA: "https://example.com/logo.svg" }),
      );
      expect(images[0]!.src).toBeUndefined();
      await flush();
      expect(images[0]!.src).toBe("blob:sized");
      const svg = new DOMParser().parseFromString(
        await blobs[0]!.text(),
        "image/svg+xml",
      ).documentElement;
      expect([svg.getAttribute("width"), svg.getAttribute("height")]).toEqual(["2048", "1024"]);
    });
  });
});
