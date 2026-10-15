import { registerThumbnail, sharedThumbnailPool, ThumbnailPool } from "./thumbnails.js";
import {
  flush,
  installFakeImages,
  installFakeWebGl,
  installManualRaf,
  setRect,
  shaderSource,
} from "./test-utils.js";

/** An IntersectionObserver whose records the test sends. */
class ObserverFake {
  static instances: ObserverFake[] = [];
  readonly observed = new Set<Element>();
  readonly options: IntersectionObserverInit | undefined;
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    ObserverFake.instances.push(this);
  }
  observe(el: Element) {
    this.observed.add(el);
  }
  unobserve(el: Element) {
    this.observed.delete(el);
  }
  disconnect() {}
  show(el: Element, isIntersecting = true) {
    this.callback(
      [{ target: el, isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

function card(width = 200, height = 100) {
  const canvas = document.createElement("canvas");
  setRect(canvas, width, height);
  return canvas;
}

function setup(options: ConstructorParameters<typeof ThumbnailPool>[0] = {}) {
  ObserverFake.instances = [];
  vi.stubGlobal("IntersectionObserver", ObserverFake);
  const webgl = installFakeWebGl();
  const raf = installManualRaf();
  const pool = new ThumbnailPool({ reducedMotion: false, ...options });
  return { webgl, raf, pool, observer: () => ObserverFake.instances[0]! };
}

const drawsInto = (webgl: ReturnType<typeof installFakeWebGl>, canvas: HTMLCanvasElement) =>
  webgl.contexts2d.find((c) => c.canvas === canvas)!.drawImage;

describe("ThumbnailPool", () => {
  it("redraws a still thumbnail when its image arrives, sharing textures by URL", async () => {
    const images = installFakeImages();
    const { webgl, raf, pool, observer } = setup({ reducedMotion: true });
    const source = shaderSource("uniform sampler2D uPhoto; // @control");
    const a = card();
    const b = card();
    pool.register(a, source, { uPhoto: "a.png" });
    pool.register(b, source, { uPhoto: "a.png" });
    observer().show(a);
    observer().show(b);
    raf.frame(1000);
    expect(images).toHaveLength(1);
    expect(drawsInto(webgl, a)).toHaveBeenCalledTimes(1);
    raf.frame(1100);
    expect(drawsInto(webgl, a)).toHaveBeenCalledTimes(1);
    await flush();
    raf.frame(1200);
    expect(drawsInto(webgl, a)).toHaveBeenCalledTimes(2);
    expect(drawsInto(webgl, b)).toHaveBeenCalledTimes(2);
    const gl = webgl.contexts[0]!;
    expect((gl.named("bindTexture").at(-1)!.args[1] as { image: unknown }).image).toBe(images[0]);
  });

  it("frees an image's texture when no thumbnail shows it", async () => {
    installFakeImages();
    const { webgl, raf, pool, observer } = setup();
    const source = shaderSource("uniform sampler2D uPhoto; // @control");
    const a = card();
    const handle = pool.register(a, source, { uPhoto: "a.png" });
    observer().show(a);
    raf.frame(1000);
    await flush();
    const gl = webgl.contexts[0]!;
    const texture = gl.textures.find((t) => t.image !== "1x1")!;
    handle.update(source, { uPhoto: "b.png" });
    expect(texture.deleted).toBe(true);
  });

  it("creates nothing until the first thumbnail", () => {
    const { webgl, raf } = setup();
    expect(webgl.contexts).toHaveLength(0);
    expect(ObserverFake.instances).toHaveLength(0);
    expect(raf.pending).toBe(0);
  });

  it("draws a visible thumbnail from the shared context, cropped like object-fit: cover", () => {
    const { webgl, raf, pool, observer } = setup();
    const canvas = card(200, 100);
    const status = vi.fn();
    pool.register(canvas, shaderSource(), undefined, status);
    expect(observer().options).toEqual({ rootMargin: "100px" });
    observer().show(canvas);
    raf.frame(1000);
    expect(status).toHaveBeenCalledWith(true);
    const gl = webgl.contexts[0]!;
    // A 2:1 card from a 480 × 270 render: 480 × 240, from the bottom of the GL canvas.
    expect(gl.named("viewport")[0]!.args).toEqual([0, 0, 480, 240]);
    const drawImage = drawsInto(webgl, canvas);
    expect(drawImage).toHaveBeenCalledWith(
      expect.any(HTMLCanvasElement),
      0,
      30,
      480,
      240,
      0,
      0,
      200,
      100,
    );
    expect([canvas.width, canvas.height]).toEqual([200, 100]);
  });

  it("crops tall thumbnails by width", () => {
    const { webgl, raf, pool, observer } = setup();
    const canvas = card(100, 200);
    pool.register(canvas, shaderSource());
    observer().show(canvas);
    raf.frame(1000);
    expect(webgl.contexts[0]!.named("viewport")[0]!.args).toEqual([0, 0, 135, 270]);
  });

  it("uses one WebGL context for every thumbnail", () => {
    const { webgl, raf, pool, observer } = setup();
    const cards = [card(), card(), card()];
    for (const c of cards) {
      pool.register(c, shaderSource());
      observer().show(c);
    }
    raf.frame(1000);
    expect(webgl.contexts).toHaveLength(1);
    for (const c of cards) expect(drawsInto(webgl, c)).toHaveBeenCalledTimes(1);
    expect(pool.size).toBe(3);
  });

  it("skips thumbnails that are off screen", () => {
    const { webgl, raf, pool, observer } = setup();
    const shown = card();
    const hidden = card();
    pool.register(shown, shaderSource());
    pool.register(hidden, shaderSource("// hidden"));
    observer().show(shown);
    raf.frame(1000);
    expect(drawsInto(webgl, hidden)).not.toHaveBeenCalled();
    expect(webgl.contexts[0]!.programs).toHaveLength(1);
    observer().show(shown, false);
    observer().show(hidden);
    raf.frame(1040);
    expect(drawsInto(webgl, hidden)).toHaveBeenCalledTimes(1);
    expect(drawsInto(webgl, shown)).toHaveBeenCalledTimes(1);
  });

  it("animates at the pool's frame rate", () => {
    const { webgl, raf, pool, observer } = setup({ fps: 10 });
    const canvas = card();
    pool.register(canvas, shaderSource());
    observer().show(canvas);
    raf.frame(1000);
    raf.frame(1050);
    raf.frame(1100);
    raf.frame(1150);
    raf.frame(1200);
    expect(drawsInto(webgl, canvas)).toHaveBeenCalledTimes(3);
    const times = webgl.contexts[0]!.named("uniform1f").filter(
      (c) => (c.args[0] as { name: string }).name === "iTime",
    );
    expect(times.map((c) => c.args[1])).toEqual([0, 0.1, 0.2]);
    expect(webgl.contexts[0]!.uniform("iFrame")).toEqual([2]);
  });

  it("compiles a source once, and reports one that does not compile without retrying it", () => {
    const { webgl, raf, pool, observer } = setup();
    const canvas = card();
    const status = vi.fn();
    pool.register(canvas, shaderSource("COMPILE_ERROR"), undefined, status);
    observer().show(canvas);
    raf.frame(1000);
    raf.frame(1100);
    expect(status).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(false);
    expect(drawsInto(webgl, canvas)).not.toHaveBeenCalled();
    // Nothing is moving, so the pool stops asking for frames.
    expect(raf.pending).toBe(0);
  });

  it("recompiles on a new source and only redraws on new values", () => {
    const { webgl, raf, pool, observer } = setup();
    const canvas = card();
    const handle = pool.register(canvas, shaderSource("uniform float uA; // @control"));
    observer().show(canvas);
    raf.frame(1000);
    const gl = webgl.contexts[0]!;
    handle.update(shaderSource("uniform float uA; // @control"), { uA: 0.5 });
    raf.frame(1010);
    expect(gl.programs).toHaveLength(1);
    expect(gl.uniform("uA")).toEqual([0.5]);
    handle.update(shaderSource("uniform float uA; // @control", "// v2"), { uA: 0.5 });
    expect(gl.programs[0]!.deleted).toBe(true);
    raf.frame(1020);
    expect(gl.programs).toHaveLength(2);
  });

  it("gives a fixed source a fresh chance to compile", () => {
    const { raf, pool, observer } = setup();
    const canvas = card();
    const status = vi.fn();
    const handle = pool.register(canvas, shaderSource("COMPILE_ERROR"), undefined, status);
    observer().show(canvas);
    raf.frame(1000);
    handle.update(shaderSource());
    raf.frame(1010);
    expect(status.mock.calls).toEqual([[false], [true]]);
  });

  describe("reduced motion", () => {
    it("holds a still frame, and animates only while hovered", () => {
      const { webgl, raf, pool, observer } = setup({ reducedMotion: true, stillTime: 2 });
      const canvas = card();
      const handle = pool.register(canvas, shaderSource());
      observer().show(canvas);
      raf.frame(1000);
      const gl = webgl.contexts[0]!;
      expect(gl.uniform("iTime")).toEqual([2]);
      expect(raf.pending).toBe(0);
      handle.setHovered(true);
      raf.frame(1500);
      expect(gl.uniform("iTime")).toEqual([0.5]);
      expect(raf.pending).toBe(1);
      handle.setHovered(false);
      raf.frame(1600);
      expect(gl.uniform("iTime")).toEqual([2]);
      expect(raf.pending).toBe(0);
    });

    it("follows prefers-reduced-motion by default", () => {
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
      }));
      const { webgl, raf, observer } = setup();
      const pool = new ThumbnailPool();
      const canvas = card();
      pool.register(canvas, shaderSource());
      observer().show(canvas);
      raf.frame(1000);
      expect(webgl.contexts[0]!.uniform("iTime")).toEqual([2]);
    });

    it("supports hoverOnly / animateMode: 'hover' regardless of prefers-reduced-motion", () => {
      vi.stubGlobal("matchMedia", () => ({ matches: false }));
      const { webgl, raf, observer } = setup({ hoverOnly: true, stillTime: 1.5 });
      const canvas = card();
      const handle = new ThumbnailPool({ animateMode: "hover", stillTime: 1.5 }).register(
        canvas,
        shaderSource(),
      );
      observer().show(canvas);
      raf.frame(1000);
      const gl = webgl.contexts[0]!;
      expect(gl.uniform("iTime")).toEqual([1.5]);
      expect(raf.pending).toBe(0);
      handle.setHovered(true);
      raf.frame(1200);
      expect(gl.uniform("iTime")).toEqual([0.2]);
      expect(raf.pending).toBe(1);
    });

    it("clears the 2D canvas before drawing when alpha: true is set", () => {
      const { webgl, raf, pool, observer } = setup({ alpha: true });
      const canvas = card(200, 100);
      pool.register(canvas, shaderSource());
      observer().show(canvas);
      raf.frame(1000);
      expect(webgl.contexts[0]!.attributes).toMatchObject({ alpha: true });
      const ctx2d = webgl.contexts2d.find((c) => c.canvas === canvas)!;
      expect(ctx2d.clearRect).toHaveBeenCalledWith(0, 0, 200, 100);
    });
  });

  it("stops drawing a disposed thumbnail and frees its program", () => {
    const { webgl, raf, pool, observer } = setup();
    const canvas = card();
    const handle = pool.register(canvas, shaderSource());
    observer().show(canvas);
    raf.frame(1000);
    handle.dispose();
    expect(observer().observed.has(canvas)).toBe(false);
    expect(webgl.contexts[0]!.programs[0]!.deleted).toBe(true);
    raf.frame(1100);
    expect(drawsInto(webgl, canvas)).toHaveBeenCalledTimes(1);
    expect(pool.size).toBe(0);
  });

  it("treats every thumbnail as visible without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const webgl = installFakeWebGl();
    const raf = installManualRaf();
    const pool = new ThumbnailPool({ reducedMotion: false });
    const canvas = card();
    pool.register(canvas, shaderSource());
    raf.frame(1000);
    expect(drawsInto(webgl, canvas)).toHaveBeenCalledTimes(1);
  });

  it("reports failure at once without WebGL2", () => {
    vi.stubGlobal("IntersectionObserver", ObserverFake);
    installFakeWebGl({ webgl: false });
    installManualRaf();
    const status = vi.fn();
    new ThumbnailPool().register(card(), shaderSource(), undefined, status);
    expect(status).toHaveBeenCalledWith(false);
  });

  it("recompiles everything after the shared context is lost and restored", () => {
    const { webgl, raf, pool, observer } = setup();
    const canvas = card();
    pool.register(canvas, shaderSource());
    observer().show(canvas);
    raf.frame(1000);
    const glCanvas = drawsInto(webgl, canvas).mock.calls[0]![0] as HTMLCanvasElement;
    const lost = new Event("webglcontextlost", { cancelable: true });
    glCanvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    glCanvas.dispatchEvent(new Event("webglcontextrestored"));
    raf.frame(1010);
    expect(webgl.contexts[0]!.programs).toHaveLength(2);
  });
});

describe("registerThumbnail", () => {
  it("uses one shared pool", () => {
    vi.stubGlobal("IntersectionObserver", ObserverFake);
    installFakeWebGl();
    installManualRaf();
    const pool = sharedThumbnailPool();
    expect(sharedThumbnailPool()).toBe(pool);
    const before = pool.size;
    const handle = registerThumbnail(card(), shaderSource());
    expect(pool.size).toBe(before + 1);
    handle.dispose();
    expect(pool.size).toBe(before);
  });
});
