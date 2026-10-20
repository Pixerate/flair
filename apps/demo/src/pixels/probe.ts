import { ShaderFrames, type FramesCanvas, type LiveSource } from "@pixerate/flair";
import { effectDefaults, SHADER_EFFECTS } from "@pixerate/flair/catalog";

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

export async function probe(options: { effect: string; width: number; height: number; frames: number }): Promise<ProbeResult> {
  return {
    where: typeof document !== "undefined" ? "page" : "worker",
    checks: await orientation(),
    effect: options.effect,
    size: `${options.width} × ${options.height}`,
    timings: await timings(options.effect, options.width, options.height, options.frames),
  };
}
