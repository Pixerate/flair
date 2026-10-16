import { sharedAudioContext } from "./audio.js";
import { ShaderRenderer, type RendererStats } from "./renderer.js";
import { ImageLoadError } from "./textures.js";
import {
  FakeVideo,
  flush,
  installFakeImages,
  installFakeWebGl,
  installManualRaf,
  setRect,
  shaderSource,
} from "./test-utils.js";

function setup(options: Parameters<typeof installFakeWebGl>[0] = {}) {
  const webgl = installFakeWebGl(options);
  const raf = installManualRaf();
  const host = document.createElement("div");
  document.body.appendChild(host);
  const renderer = new ShaderRenderer(host, "preview");
  setRect(renderer.canvas, 100, 50);
  renderer.setPixelRatio(1);
  const gl = options.webgl === false ? null : webgl.last();
  return { webgl, raf, host, renderer, gl };
}

const iTime = (gl: { uniform(name: string): unknown[] | undefined }) => gl.uniform("iTime")?.[0];

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ShaderRenderer", () => {
  it("adds its own canvas to the host, with a context that keeps its last frame", () => {
    const { host, renderer, gl } = setup();
    expect(renderer.canvas.parentElement).toBe(host);
    expect(renderer.canvas.className).toBe("preview");
    expect(renderer.supported).toBe(true);
    expect(gl!.attributes).toMatchObject({ preserveDrawingBuffer: true, alpha: false });
  });

  it("attaches directly to an existing HTMLCanvasElement without appending another", () => {
    installFakeWebGl();
    installManualRaf();
    const existing = document.createElement("canvas");
    document.body.appendChild(existing);
    const renderer = new ShaderRenderer(existing, "custom-canvas");
    expect(renderer.canvas).toBe(existing);
    expect(renderer.canvas.className).toBe("custom-canvas");
    renderer.dispose();
    expect(existing.parentElement).toBe(document.body);
  });

  it("requests a transparent WebGL context when alpha: true is passed", () => {
    const webgl = installFakeWebGl();
    installManualRaf();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const renderer = new ShaderRenderer(host, { alpha: true });
    expect(webgl.last().attributes).toMatchObject({ preserveDrawingBuffer: true, alpha: true });
    renderer.dispose();
  });

  it("pauses and resumes when scrolled out of view with pauseWhenHidden", () => {
    installFakeWebGl();
    installManualRaf();
    let callback: IntersectionObserverCallback | null = null;
    class MockIntersectionObserver {
      constructor(cb: IntersectionObserverCallback) {
        callback = cb;
      }
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      takeRecords = vi.fn().mockReturnValue([]);
      root = null;
      rootMargin = "";
      thresholds = [];
    }
    const origObserver = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
    try {
      const host = document.createElement("div");
      document.body.appendChild(host);
      const renderer = new ShaderRenderer(host, { pauseWhenHidden: true });
      expect(renderer.playing).toBe(true);

      // Scrolled offscreen
      callback!([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
      expect(renderer.playing).toBe(false);

      // Scrolled back into view
      callback!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      expect(renderer.playing).toBe(true);

      renderer.dispose();
    } finally {
      globalThis.IntersectionObserver = origObserver;
    }
  });

  it("defers playback until scrolled into view with playOnEnter", () => {
    installFakeWebGl();
    installManualRaf();
    let callback: IntersectionObserverCallback | null = null;
    class MockIntersectionObserver {
      constructor(cb: IntersectionObserverCallback) {
        callback = cb;
      }
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      takeRecords = vi.fn().mockReturnValue([]);
      root = null;
      rootMargin = "";
      thresholds = [];
    }
    const origObserver = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
    try {
      const host = document.createElement("div");
      document.body.appendChild(host);
      const renderer = new ShaderRenderer(host, { playOnEnter: true });
      expect(renderer.playing).toBe(false);

      // Scrolled into view
      callback!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      expect(renderer.playing).toBe(true);

      renderer.dispose();
    } finally {
      globalThis.IntersectionObserver = origObserver;
    }
  });

  it("sizes the drawing buffer from the CSS size and pixel ratio", () => {
    const { renderer } = setup();
    expect([renderer.canvas.width, renderer.canvas.height]).toEqual([100, 50]);
    renderer.setPixelRatio(2);
    expect([renderer.canvas.width, renderer.canvas.height]).toEqual([200, 100]);
    setRect(renderer.canvas, 0, 0);
    renderer.setPixelRatio(1);
    expect([renderer.canvas.width, renderer.canvas.height]).toEqual([1, 1]);
  });

  it("sizes the drawing buffer from the layout size, not a transformed bounding box", () => {
    const { renderer } = setup();
    // Rotated a quarter turn: the bounding box is 50 × 100, the canvas still 100 × 50.
    renderer.canvas.getBoundingClientRect = () => ({ width: 50, height: 100 }) as DOMRect;
    renderer.setPixelRatio(2);
    expect([renderer.canvas.width, renderer.canvas.height]).toEqual([200, 100]);
  });

  describe("setSource", () => {
    it("reports success", () => {
      const { renderer } = setup();
      expect(renderer.setSource(shaderSource())).toEqual({ ok: true, errors: [] });
      expect(renderer.status.ok).toBe(true);
    });

    it("keeps the last working program when a source does not compile", () => {
      const { renderer, gl, raf } = setup();
      renderer.setSource(shaderSource());
      const status = renderer.setSource(shaderSource("COMPILE_ERROR"));
      expect(status.ok).toBe(false);
      expect(status.errors[0]!.line).toBe(2);
      expect(gl!.programs[0]!.deleted).toBe(false);
      gl!.calls.length = 0;
      raf.frame(16);
      expect(gl!.named("useProgram")[0]!.args[0]).toBe(gl!.programs[0]);
    });

    it("replaces the program when a new source compiles", () => {
      const { renderer, gl } = setup();
      renderer.setSource(shaderSource());
      renderer.setSource(shaderSource("// v2"));
      expect(gl!.programs[0]!.deleted).toBe(true);
      expect(gl!.programs[1]!.deleted).toBe(false);
    });

    it("says when there is no WebGL2", () => {
      const { renderer } = setup({ webgl: false });
      expect(renderer.supported).toBe(false);
      expect(renderer.setSource(shaderSource())).toEqual({
        ok: false,
        errors: [{ line: 0, message: "WebGL2 is not available in this browser." }],
      });
      expect(renderer.capture()).toBeNull();
    });
  });

  describe("playback", () => {
    it("advances time with the frame clock, at the playback speed", () => {
      const { renderer, gl, raf } = setup();
      renderer.setSource(shaderSource());
      raf.frame(1000);
      expect(iTime(gl!)).toBe(0);
      raf.frame(1100);
      expect(renderer.time).toBeCloseTo(0.1);
      renderer.speed = 2;
      raf.frame(1150);
      expect(renderer.time).toBeCloseTo(0.2);
      expect(iTime(gl!)).toBeCloseTo(0.2);
      expect(gl!.uniform("iTimeDelta")![0]).toBeCloseTo(0.1);
      // The frame counter counts drawn frames, so the third frame is iFrame 3.
      expect(gl!.uniform("iFrame")).toEqual([3]);
    });

    it("never jumps more than 0.1 s at once (a background tab, a breakpoint)", () => {
      const { renderer, raf } = setup();
      renderer.setSource(shaderSource());
      raf.frame(1000);
      raf.frame(9000);
      expect(renderer.time).toBeCloseTo(0.1);
    });

    it("pauses and plays", () => {
      const { renderer, raf } = setup();
      renderer.setSource(shaderSource());
      raf.frame(1000);
      renderer.pause();
      raf.frame(1100);
      expect(renderer.time).toBe(0);
      renderer.play();
      raf.frame(1200);
      expect(renderer.time).toBeCloseTo(0.1);
    });

    it("seeks and restarts, drawing at once", () => {
      const { renderer, gl } = setup();
      renderer.setSource(shaderSource());
      renderer.pause();
      renderer.seek(3);
      expect(iTime(gl!)).toBe(3);
      renderer.seek(-2);
      expect(renderer.time).toBe(0);
      renderer.seek(5);
      renderer.restart();
      expect(renderer.time).toBe(0);
      expect(iTime(gl!)).toBe(0);
      expect(gl!.uniform("iFrame")).toEqual([0]);
    });

    it("redraws a paused preview when the source or values change", () => {
      const { renderer, gl } = setup();
      renderer.pause();
      renderer.setSource(shaderSource("uniform float uA; // @control default=1"));
      expect(gl!.uniform("uA")).toEqual([1]);
      renderer.setValues({ uA: 4 });
      expect(gl!.uniform("uA")).toEqual([4]);
    });

    it("reports stats on changes and twice a second", () => {
      const { renderer, raf } = setup();
      const stats: RendererStats[] = [];
      renderer.onStats = (s) => stats.push(s);
      renderer.setSource(shaderSource());
      renderer.pause();
      expect(stats.at(-1)).toEqual({ time: 0, fps: 0, playing: false, width: 100, height: 50 });
      renderer.play();
      stats.length = 0;
      raf.frame(1000);
      stats.length = 0;
      for (let now = 1050; now <= 1500; now += 50) raf.frame(now);
      expect(stats).toHaveLength(1);
      expect(stats[0]!.fps).toBe(20);
      expect(stats[0]!.playing).toBe(true);
    });
  });

  describe("capture", () => {
    it("returns a data URL scaled to maxEdge, at the requested time, then restores the time", () => {
      const { renderer, gl, webgl } = setup();
      const toDataURL = vi
        .spyOn(HTMLCanvasElement.prototype, "toDataURL")
        .mockReturnValue("data:image/jpeg;base64,AAAA");
      renderer.setSource(shaderSource());
      renderer.pause();
      renderer.seek(1);
      const times: unknown[] = [];
      const uniform1f = gl!.uniform1f.bind(gl);
      vi.spyOn(gl!, "uniform1f").mockImplementation((loc, x) => {
        if (loc.name === "iTime") times.push(x);
        uniform1f(loc, x);
      });
      expect(renderer.capture({ time: 7, maxEdge: 50 })).toBe("data:image/jpeg;base64,AAAA");
      expect(times).toEqual([7, 1]);
      expect(renderer.time).toBe(1);
      const out = webgl.contexts2d.at(-1)!;
      expect([out.canvas.width, out.canvas.height]).toEqual([50, 25]);
      expect(out.drawImage).toHaveBeenCalledWith(renderer.canvas, 0, 0, 50, 25);
      expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.85);
    });

    it("can capture PNG, never upscales, and is null before anything compiles", () => {
      const { renderer, webgl } = setup();
      const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("x");
      expect(renderer.capture()).toBeNull();
      renderer.setSource(shaderSource());
      renderer.capture({ type: "image/png" });
      expect(toDataURL).toHaveBeenCalledWith("image/png", 0.85);
      const out = webgl.contexts2d.at(-1)!;
      expect([out.canvas.width, out.canvas.height]).toEqual([100, 50]);
    });
  });

  describe("iMouse", () => {
    const pointer = (type: string, x: number, y: number, buttons = 1) =>
      new MouseEvent(type, { clientX: x, clientY: y, buttons, bubbles: true });

    it("follows Shadertoy: xy while pressed, zw the press point, negative once released", () => {
      const { renderer, gl } = setup();
      setRect(renderer.canvas, 100, 50, 10, 20);
      renderer.setPixelRatio(2);
      renderer.setSource(shaderSource());
      renderer.pause();
      const mouse = () => {
        renderer.seek(0);
        return gl!.uniform("iMouse");
      };
      renderer.canvas.dispatchEvent(pointer("pointerdown", 20, 60));
      // 10 px from the left and 10 px from the bottom, at 2 device pixels per CSS pixel.
      expect(mouse()).toEqual([20, 20, 20, 20]);
      renderer.canvas.dispatchEvent(pointer("pointermove", 60, 30));
      expect(mouse()).toEqual([100, 80, 20, 20]);
      window.dispatchEvent(pointer("pointerup", 60, 30, 0));
      expect(mouse()).toEqual([100, 80, -20, -20]);
    });

    it("ignores moves without a button pressed, or before a press", () => {
      const { renderer, gl } = setup();
      renderer.setSource(shaderSource());
      renderer.pause();
      renderer.canvas.dispatchEvent(pointer("pointermove", 30, 30));
      renderer.seek(0);
      expect(gl!.uniform("iMouse")).toEqual([0, 0, 0, 0]);
      renderer.canvas.dispatchEvent(pointer("pointerdown", 10, 40));
      renderer.canvas.dispatchEvent(pointer("pointermove", 30, 30, 0));
      renderer.seek(0);
      expect(gl!.uniform("iMouse")).toEqual([10, 10, 10, 10]);
    });
  });

  describe("context loss", () => {
    it("reports the loss, then recompiles the source once the context is restored", () => {
      const { renderer, gl } = setup();
      const lost: boolean[] = [];
      renderer.onContextLost = (l) => lost.push(l);
      renderer.setSource(shaderSource());
      const event = new Event("webglcontextlost", { cancelable: true });
      renderer.canvas.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(lost).toEqual([true]);
      expect(renderer.capture()).toBeNull();
      renderer.canvas.dispatchEvent(new Event("webglcontextrestored"));
      expect(lost).toEqual([true, false]);
      expect(gl!.programs).toHaveLength(2);
      expect(renderer.status.ok).toBe(true);
    });
  });

  describe("dispose", () => {
    it("stops the loop, frees the program and context, and removes the canvas", () => {
      const { renderer, gl, raf, host } = setup();
      renderer.setSource(shaderSource());
      renderer.dispose();
      expect(host.contains(renderer.canvas)).toBe(false);
      expect(gl!.programs[0]!.deleted).toBe(true);
      expect(gl!.lost).toBe(true);
      expect(raf.pending).toBe(0);
      expect(renderer.supported).toBe(false);
    });

    it("stops listening to the pointer", () => {
      const { renderer } = setup();
      const remove = vi.spyOn(window, "removeEventListener");
      renderer.dispose();
      expect(remove).toHaveBeenCalledWith("pointerup", expect.any(Function));
    });
  });

  describe("images", () => {
    const photo = shaderSource("uniform sampler2D uPhoto; // @control");
    const bound = (gl: { named(n: string): { args: unknown[] }[] }) =>
      gl.named("bindTexture").at(-1)!.args[1] as { image: unknown } | null;

    it("loads an image when its value is set, and a paused preview redraws with it", async () => {
      const images = installFakeImages();
      const { renderer, gl } = setup();
      renderer.setSource(photo);
      renderer.pause();
      renderer.setValues({ uPhoto: "https://example.com/a.png" });
      expect(images.map((i) => i.src)).toEqual(["https://example.com/a.png"]);
      expect(bound(gl!)!.image).toBe("1x1");
      await renderer.ready();
      expect(bound(gl!)!.image).toBe(images[0]);
    });

    it("ready rejects, and onImageError hears, when an image cannot load", async () => {
      installFakeImages();
      const { renderer } = setup();
      const onImageError = vi.fn();
      renderer.onImageError = onImageError;
      renderer.setSource(photo);
      renderer.setValues({ uPhoto: "https://example.com/broken.png" });
      await expect(renderer.ready()).rejects.toBeInstanceOf(ImageLoadError);
      expect(onImageError).toHaveBeenCalledWith(expect.any(ImageLoadError));
    });

    it("frees an image's texture once nothing shows it", async () => {
      installFakeImages();
      const { renderer, gl } = setup();
      renderer.setSource(photo);
      renderer.setValues({ uPhoto: "a.png" });
      await renderer.ready();
      const texture = gl!.textures.find((t) => t.image !== "1x1" && t.image !== null)!;
      renderer.setValues({ uPhoto: "b.png" });
      expect(texture.deleted).toBe(true);
    });

    it("draws a live video in place of the URL, and follows it while paused", () => {
      installFakeImages();
      const { renderer, gl, raf } = setup();
      renderer.setSource(photo);
      renderer.setValues({ uPhoto: "https://example.com/a.png" });
      renderer.pause();
      const video = new FakeVideo();
      video.readyState = 4;
      renderer.setLiveSource("uPhoto", video as unknown as HTMLVideoElement);
      expect(bound(gl!)!.image).toBe(video);
      const draws = gl!.named("drawArrays").length;
      raf.frame(16);
      expect(gl!.named("drawArrays")).toHaveLength(draws);
      video.playTo(0.5);
      raf.frame(32);
      expect(gl!.named("drawArrays")).toHaveLength(draws + 1);
      expect(gl!.named("texImage2D").filter((c) => c.args[5] === video)).toHaveLength(2);
      renderer.setLiveSource("uPhoto", null);
      expect(bound(gl!)!.image).not.toBe(video);
    });

    it("ready waits for a live video's first frame", async () => {
      const { renderer } = setup();
      renderer.setSource(photo);
      const video = new FakeVideo();
      renderer.setLiveSource("uPhoto", video as unknown as HTMLVideoElement);
      let done = false;
      const ready = renderer.ready().then(() => (done = true));
      await flush();
      expect(done).toBe(false);
      video.readyState = 2;
      video.emit("loadeddata");
      await ready;
    });

    it("deletes its textures on dispose", async () => {
      installFakeImages();
      const { renderer, gl } = setup();
      renderer.setSource(photo);
      renderer.setValues({ uPhoto: "a.png" });
      renderer.seek(0);
      await flush();
      renderer.dispose();
      expect(gl!.textures.length).toBeGreaterThan(0);
      expect(gl!.textures.every((t) => t.deleted)).toBe(true);
    });
  });

  describe("scroll", () => {
    it("feeds iScroll from where the canvas is in the viewport, and follows scrolling while paused", () => {
      const { renderer, gl, raf } = setup();
      vi.stubGlobal("innerHeight", 800);
      setRect(renderer.canvas, 100, 200, 0, 300);
      renderer.setSource(shaderSource());
      renderer.pause();
      raf.frame(1000);
      expect(gl!.uniform("iScroll")![0]).toBeCloseTo(0.5);
      // Scroll down 80 px a frame: the canvas moves up.
      for (let i = 1; i <= 5; i++) {
        setRect(renderer.canvas, 100, 200, 0, 300 - 80 * i);
        window.dispatchEvent(new Event("scroll"));
        raf.frame(1000 + (1000 / 60) * i);
      }
      const [x, , v, w] = gl!.uniform("iScroll") as number[];
      expect(x).toBeCloseTo((800 - (300 - 400)) / 1000);
      expect(v).toBeGreaterThan(3);
      expect(w).toBe(1);
    });

    it("can be pinned to a progress of the host's own", () => {
      const { renderer, gl } = setup();
      renderer.setSource(shaderSource());
      renderer.pause();
      renderer.setScrollProgress(0.25);
      expect((gl!.uniform("iScroll") as number[]).slice(0, 2)).toEqual([0.25, 0.25]);
      renderer.setScrollProgress(2);
      expect(gl!.uniform("iScroll")![0]).toBe(1);
    });

    it("stops listening on dispose", () => {
      const { renderer } = setup();
      const remove = vi.spyOn(window, "removeEventListener");
      renderer.dispose();
      expect(remove.mock.calls.map((c) => c[0])).toContain("scroll");
    });
  });

  describe("audio", () => {
    /** A Web Audio stand-in: an analyser that hears a full-scale bass. */
    function installFakeAudio(level = 1) {
      // Each test starts with a new shared context.
      try {
        (sharedAudioContext() as { state: string }).state = "closed";
      } catch {
        // None yet.
      }
      const connections: [string, string][] = [];
      const node = (name: string) => ({
        name,
        connect: vi.fn((to: { name: string }) => connections.push([name, to.name])),
        disconnect: vi.fn(),
      });
      class FakeAnalyser {
        name = "analyser";
        fftSize = 2048;
        smoothingTimeConstant = 0.8;
        minDecibels = -100;
        maxDecibels = -30;
        get frequencyBinCount() {
          return this.fftSize / 2;
        }
        getFloatFrequencyData(out: Float32Array) {
          out.fill(-100);
          for (let k = 0; k < 11; k++) out[k] = -100 + 70 * level;
        }
        getFloatTimeDomainData(out: Float32Array) {
          out.fill(0.5 * level);
        }
        connect() {}
        disconnect() {}
      }
      class FakeContext {
        state = "running";
        sampleRate = 48000;
        destination = { name: "speakers" };
        createAnalyser = () => new FakeAnalyser();
        createMediaElementSource = vi.fn(() => node("element"));
        createMediaStreamSource = vi.fn(() => node("stream"));
        resume = vi.fn(async () => {});
        addEventListener() {}
      }
      vi.stubGlobal("AudioContext", FakeContext);
      return connections;
    }

    it("plays a media element to the speakers through an analyser and feeds the audio uniforms", async () => {
      const connections = installFakeAudio();
      const { renderer, gl, raf } = setup();
      renderer.setSource(shaderSource());
      expect(gl!.uniform("iBeat")).toBeUndefined();
      raf.frame(1000);
      expect(gl!.uniform("iBeat")).toEqual([0]);
      renderer.setAudioSource(document.createElement("audio"));
      expect(connections).toEqual([["element", "speakers"], ["element", "analyser"]]);
      raf.frame(1016);
      const [level, bass, mid] = gl!.uniform("iAudio") as number[];
      expect(level).toBeGreaterThan(0.8);
      expect(bass).toBe(1);
      expect(mid).toBe(0);
      expect(gl!.uniform("iBeat")).toEqual([-1]);
      expect((gl!.uniform("iSpectrum")![0] as Float32Array)[0]).toBe(1);
    });

    it("listens to a stream without playing it, and stops on null", () => {
      const connections = installFakeAudio();
      const { renderer, gl, raf } = setup();
      renderer.setSource(shaderSource());
      class FakeStream {}
      vi.stubGlobal("MediaStream", FakeStream);
      renderer.setAudioSource(new FakeStream() as unknown as MediaStream);
      expect(connections).toEqual([["stream", "analyser"]]);
      expect(connections.some(([, to]) => to === "speakers")).toBe(false);
      raf.frame(1000);
      expect((gl!.uniform("iAudio") as number[])[1]).toBe(1);
      renderer.setAudioSource(null);
      raf.frame(1016);
      expect(gl!.uniform("iAudio")).toEqual([0, 0, 0, 0]);
      expect(gl!.uniform("iBeat")).toEqual([0]);
    });
  });
});
