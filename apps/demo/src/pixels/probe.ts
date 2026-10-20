import { ShaderFrames, ShaderPipeline, type FramesCanvas, type LiveSource, type PipelinePass } from "@pixerate/flair";
import { effectDefaults, effectStack, SHADER_EFFECTS } from "@pixerate/flair/catalog";

/**
 * The same checks on the page and in a Worker: that each kind of picture
 * reaches an image control the right way up, and how long a frame takes to
 * render and come out as an ImageData or an ImageBitmap.
 */

/** Draws the image control as it is, so the output shows how the input arrived. */
const PASS_THROUGH = `uniform sampler2D uImage; // @control filter=nearest wrap=clamp
void mainImage(out vec4 fragColor, in vec2 fragCoord) { fragColor = texture(uImage, fragCoord / iResolution.xy); }`;

export interface OrientationCheck {
  input: string;
  ok: boolean;
  detail: string;
}

export interface Timing {
  output: "readImageData" | "toImageBitmap";
  /** Ms per frame over a run of frames, render and output together. */
  ms: number;
}

export interface ProbeResult {
  where: "page" | "worker";
  checks: OrientationCheck[];
  /** Multi-pass checks: chaining, feedback, overlays, a catalog stack. */
  pipeline: OrientationCheck[];
  effect: string;
  size: string;
  timings: Timing[];
}

const canvas = (width: number, height: number): FramesCanvas =>
  typeof document !== "undefined" ? Object.assign(document.createElement("canvas"), { width, height }) : new OffscreenCanvas(width, height);

/** A 2 × 2 picture: red on top, blue below (ImageData rows run top down). */
function topRed(): ImageData {
  const data = new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255]);
  return new ImageData(data, 2, 2);
}

async function inputs(): Promise<[string, () => Promise<LiveSource>][]> {
  const list: [string, () => Promise<LiveSource>][] = [
    ["ImageData", async () => topRed()],
    ["ImageBitmap", () => createImageBitmap(topRed())],
    [
      "OffscreenCanvas",
      async () => {
        const c = new OffscreenCanvas(2, 2);
        c.getContext("2d")!.putImageData(topRed(), 0, 0);
        return c;
      },
    ],
  ];
  if (typeof VideoFrame !== "undefined") {
    list.push(["VideoFrame", async () => new VideoFrame(await createImageBitmap(topRed()), { timestamp: 0 })]);
  }
  return list;
}

async function orientation(): Promise<OrientationCheck[]> {
  const checks: OrientationCheck[] = [];
  for (const [input, make] of await inputs()) {
    const frames = new ShaderFrames({ source: PASS_THROUGH, width: 2, height: 2, canvas: canvas(2, 2), alpha: true });
    try {
      const picture = await make();
      frames.setLiveSource("uImage", picture);
      frames.render(0);
      const { data } = frames.readImageData();
      const top = [...data.slice(0, 3)].join(",");
      const bottom = [...data.slice(8, 11)].join(",");
      checks.push({ input, ok: top === "255,0,0" && bottom === "0,0,255", detail: `top ${top}, bottom ${bottom}` });
      if ("close" in picture) picture.close();
    } catch (e) {
      checks.push({ input, ok: false, detail: e instanceof Error ? e.message : String(e) });
    } finally {
      frames.dispose();
    }
  }
  return checks;
}

/**
 * Frames a second's worth of work, as ms per frame over `count` frames in a
 * row (a few first to warm up). Throughput rather than single frames: the
 * GPU runs behind, and a Worker's clock is coarse. Bitmaps are drawn into a
 * 1 × 1 canvas and read, so the frame they hold has really been made.
 */
async function timings(effectId: string, width: number, height: number, count: number): Promise<Timing[]> {
  const effect = SHADER_EFFECTS.find((e) => e.id === effectId) ?? SHADER_EFFECTS[0]!;
  const frames = new ShaderFrames({ source: effect.source, values: effectDefaults(effect), width, height, canvas: canvas(width, height) });
  const sink = new OffscreenCanvas(1, 1).getContext("2d", { willReadFrequently: true })!;
  try {
    await frames.ready().catch(() => undefined);
    const out: Timing[] = [];
    for (const output of ["readImageData", "toImageBitmap"] as const) {
      const one = async (i: number) => {
        frames.render(1 + i / 30);
        if (output === "readImageData") frames.readImageData();
        else {
          const bitmap = await frames.toImageBitmap();
          sink.drawImage(bitmap, 0, 0, 1, 1);
          sink.getImageData(0, 0, 1, 1);
          bitmap.close();
        }
      };
      for (let i = 0; i < 3; i++) await one(i);
      const start = performance.now();
      for (let i = 0; i < count; i++) await one(i);
      out.push({ output, ms: (performance.now() - start) / count });
    }
    return out;
  } finally {
    frames.dispose();
  }
}

/** The pixel at (x, y), rows top down, as "r,g,b". */
const at = (data: Uint8ClampedArray, width: number, x: number, y: number) => [...data.slice((y * width + x) * 4, (y * width + x) * 4 + 3)].join(",");

const near = (got: string, want: number[], slack = 3) => got.split(",").every((v, i) => Math.abs(Number(v) - want[i]!) <= slack);

function pipelineChecks(): OrientationCheck[] {
  const checks: OrientationCheck[] = [];
  const run = (input: string, passes: PipelinePass[], frames: number, test: (data: Uint8ClampedArray) => [boolean, string]) => {
    let pipeline: ShaderPipeline<FramesCanvas> | undefined;
    try {
      pipeline = new ShaderPipeline({ passes, width: 4, height: 4, canvas: canvas(4, 4), alpha: true });
      for (let i = 0; i < frames; i++) pipeline.render(i / 30);
      const [ok, detail] = test(pipeline.readImageData().data);
      checks.push({ input, ok, detail });
    } catch (e) {
      checks.push({ input, ok: false, detail: e instanceof Error ? e.message : String(e) });
    } finally {
      pipeline?.dispose();
    }
  };
  const SAMPLER = "uniform sampler2D uImage; // @control filter=nearest wrap=clamp\n";
  const TOP_RED = "void mainImage(out vec4 c, in vec2 f) { c = f.y > iResolution.y * 0.5 ? vec4(1.0, 0.0, 0.0, 1.0) : vec4(0.0, 0.0, 1.0, 1.0); }";
  run("chain: swap red and blue", [{ source: TOP_RED }, { source: `${SAMPLER}void mainImage(out vec4 c, in vec2 f) { c = texture(uImage, f / iResolution.xy).bgra; }`, inputs: { uImage: "previous" } }], 1, (d) => {
    const top = at(d, 4, 1, 0);
    const bottom = at(d, 4, 1, 3);
    return [top === "0,0,255" && bottom === "255,0,0", `top ${top}, bottom ${bottom}`];
  });
  run("feedback: halves toward red, 3 frames", [{ source: `${SAMPLER}void mainImage(out vec4 c, in vec2 f) { c = vec4(texture(uImage, f / iResolution.xy).rgb * 0.5 + vec3(0.5, 0.0, 0.0), 1.0); }`, inputs: { uImage: "feedback" } }], 3, (d) => {
    const got = at(d, 4, 1, 1);
    return [near(got, [223, 0, 0]), `${got} (want about 223,0,0)`];
  });
  run("overlay: half-red over blue", [{ source: "void mainImage(out vec4 c, in vec2 f) { c = vec4(0.0, 0.0, 1.0, 1.0); }" }, { source: "void mainImage(out vec4 c, in vec2 f) { c = vec4(1.0, 0.0, 0.0, 0.5); }", blend: "over" }], 1, (d) => {
    const got = at(d, 4, 1, 1);
    return [near(got, [128, 0, 127]), `${got} (want about 128,0,127)`];
  });
  const hasFloat = (() => {
    const gl = canvas(1, 1).getContext("webgl2") as WebGL2RenderingContext | null;
    return Boolean(gl?.getExtension("EXT_color_buffer_float"));
  })();
  for (const format of hasFloat ? (["rgba16f", "rgba32f"] as const) : []) {
    const read = (passes: PipelinePass[]) => {
      const pipeline = new ShaderPipeline({ passes, width: 2, height: 2, canvas: canvas(2, 2), alpha: true, format });
      try {
        pipeline.render(0);
        return [...pipeline.readFloatPixels()].map((v) => Math.round(v * 1000) / 1000);
      } finally {
        pipeline.dispose();
      }
    };
    try {
      const hdr = read([{ source: "void mainImage(out vec4 c, in vec2 f) { c = vec4(2.0, 0.5, -0.1, 1.0); }" }]).slice(0, 3);
      checks.push({ input: `${format}: HDR out, linear`, ok: Math.abs(hdr[0]! - 4.953) < 0.02 && Math.abs(hdr[1]! - 0.214) < 0.002 && Math.abs(hdr[2]! + 0.01) < 0.002, detail: `${hdr.join(",")} (want 4.953,0.214,-0.01)` });
      const data = new Float32Array([4.953, 0.214, 0, 1, 4.953, 0.214, 0, 1, 0, 0, 1, 1, 0, 0, 1, 1]);
      const trip = read([{ source: `${SAMPLER}void mainImage(out vec4 c, in vec2 f) { c = texture(uImage, f / iResolution.xy); }`, inputs: { uImage: { width: 2, height: 2, data } } }]);
      const top = trip.slice(0, 3).join(",");
      const bottom = trip.slice(8, 11).join(",");
      checks.push({ input: `${format}: float picture in, upright`, ok: Math.abs(trip[0]! - 4.953) < 0.02 && Math.abs(trip[10]! - 1) < 0.005 && Math.abs(trip[8]!) < 0.005, detail: `top ${top}, bottom ${bottom}` });
    } catch (e) {
      checks.push({ input: `${format}: float`, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  }
  const RED = "void mainImage(out vec4 c, in vec2 f) { c = vec4(1.0, 0.0, 0.0, 1.0); }";
  const solid = (w: number, h: number, rgba: number[], right?: number[]) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) data.set(right && i % w >= w / 2 ? right : rgba, i * 4);
    return new ImageData(data, w, h);
  };
  const masked = (input: string, mask: Parameters<ShaderPipeline["setMask"]>[0], test: (d: Uint8ClampedArray) => [boolean, string]) => {
    let pipeline: ShaderPipeline<FramesCanvas> | undefined;
    try {
      pipeline = new ShaderPipeline({ passes: [{ source: RED }], width: 4, height: 4, canvas: canvas(4, 4), alpha: true, mask: mask ?? undefined });
      pipeline.render(0);
      const [ok, detail] = test(pipeline.readImageData().data);
      checks.push({ input, ok, detail });
    } catch (e) {
      checks.push({ input, ok: false, detail: e instanceof Error ? e.message : String(e) });
    } finally {
      pipeline?.dispose();
    }
  };
  masked("mask: left half over blue", { picture: solid(2, 1, [0, 0, 0, 255], [0, 0, 0, 0]), under: solid(1, 1, [0, 0, 255, 255]) }, (d) => {
    const left = at(d, 4, 0, 1);
    const right = at(d, 4, 3, 1);
    return [left === "255,0,0" && right === "0,0,255", `left ${left}, right ${right}`];
  });
  masked("mask: top-left region, no under", { region: [0, 0, 2, 2] }, (d) => {
    const inside = d[(1 * 4 + 0) * 4 + 3];
    const outside = d[(3 * 4 + 3) * 4 + 3];
    return [inside === 255 && outside === 0, `alpha inside ${inside}, outside ${outside}`];
  });
  masked("mask: luminance, inverted", { picture: solid(1, 1, [255, 255, 255, 255]), channel: "luminance", invert: true, under: solid(1, 1, [0, 255, 0, 255]) }, (d) => {
    const got = at(d, 4, 1, 1);
    return [got === "0,255,0", `${got} (white inverted: all under)`];
  });
  run("stack: aurora then crt", effectStack(["aurora", "crt"]), 2, (d) => {
    const lit = d.some((v, i) => i % 4 !== 3 && v > 8);
    return [lit, lit ? "drawn" : "all black"];
  });
  return checks;
}

export async function probe(options: { effect: string; width: number; height: number; frames: number }): Promise<ProbeResult> {
  return {
    where: typeof document !== "undefined" ? "page" : "worker",
    checks: await orientation(),
    pipeline: pipelineChecks(),
    effect: options.effect,
    size: `${options.width} × ${options.height}`,
    timings: await timings(options.effect, options.width, options.height, options.frames),
  };
}
