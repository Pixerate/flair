import { useEffect, useState } from "react";
import { compileShader, createContext, parseControls, ShaderFrames, type ControlValue } from "@pixerate/flair";
import { PAINT_HINTS, SAMPLE_IMAGES, SHADER_EFFECTS, type ShaderEffect } from "@pixerate/flair/catalog";
import { flairEffects } from "@pixerate/flair/integrations";

interface Result {
  id: string;
  ok: boolean;
  errors: string[];
}

/** Effects that show a picture over a backdrop (see `BACKDROP` in the catalog). */
const PICTURE_EFFECTS = SHADER_EFFECTS.filter((e) => /uniform float uBackdropAlpha;/.test(e.source));
/**
 * These draw a whole opaque device or scene around the picture, so they stay opaque with a clear
 * backdrop (the funhouse mirror hangs on a wall unless its frame is turned off).
 */
const OPAQUE = new Set(["gameboy-screen", "funhouse-mirror", "scratch-card", "polaroid-develop", "cover-flow", "tarot-reveal", "cinema-projector", "crt-television"]);

/**
 * Renders `effect` with the sample icon (black strokes on clear, like a Lucide
 * icon) and checks it shows: over the default backdrop the frame is opaque and
 * not one flat colour; with the backdrop clear it keeps the icon's alpha, so
 * much of the frame is clear and the icon is not.
 */
async function checkIcon(effect: ShaderEffect): Promise<Result> {
  const width = 160;
  const height = 90;
  const time = effect.loop ? effect.loop / 2 : 1;
  const images = Object.fromEntries(
    parseControls(effect.source)
      .filter((c) => c.type === "sampler2D")
      .map((c) => [c.name, SAMPLE_IMAGES.icon]),
  );
  const frame = async (values: Record<string, ControlValue>) => {
    const frames = new ShaderFrames({ source: effect.source, values: { ...images, ...values }, width, height, alpha: true });
    try {
      await frames.ready();
      frames.render(time);
      return frames.readPixels();
    } finally {
      frames.dispose();
    }
  };
  const errors: string[] = [];
  try {
    const opaque = await frame({});
    let low = 255;
    let high = 0;
    let minAlpha = 255;
    for (let i = 0; i < opaque.length; i += 4) {
      const l = 0.2126 * opaque[i]! + 0.7152 * opaque[i + 1]! + 0.0722 * opaque[i + 2]!;
      low = Math.min(low, l);
      high = Math.max(high, l);
      minAlpha = Math.min(minAlpha, opaque[i + 3]!);
    }
    // Transparent effects (a card on clear, say) are clear around what they draw whatever the backdrop.
    if (minAlpha < 255 && !effect.transparent) errors.push(`over the backdrop, alpha drops to ${minAlpha}`);
    if (high - low < 48) errors.push(`over the backdrop, the icon does not show (brightness ${low.toFixed(0)}–${high.toFixed(0)})`);

    if (OPAQUE.has(effect.id)) return { id: `${effect.id} (icon)`, ok: errors.length === 0, errors };
    const clear = await frame({ uBackdropAlpha: 0 });
    let maxAlpha = 0;
    let clearPixels = 0;
    for (let i = 3; i < clear.length; i += 4) {
      maxAlpha = Math.max(maxAlpha, clear[i]!);
      if (clear[i]! < 16) clearPixels += 1;
    }
    const share = clearPixels / (width * height);
    if (share < 0.2) errors.push(`with a clear backdrop, only ${(share * 100).toFixed(0)}% of the frame is clear`);
    if (maxAlpha < 128) errors.push(`with a clear backdrop, the icon's alpha is lost (max ${maxAlpha})`);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  return { id: `${effect.id} (icon)`, ok: errors.length === 0, errors };
}

/** The sample stroke paint is checked along: an S-curve across a 64 × 64 frame, as points in pixels from the top left. */
const PAINT_SIZE = 64;
const PAINT_STROKE: number[] = Array.from({ length: 17 }, (_, i) => {
  const t = i / 16;
  return [8 + 48 * t, 32 - 16 * Math.sin(t * Math.PI * 2)];
}).flat();

/** A pixel's distance from the sample stroke. */
function strokeDistance(x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i + 3 < PAINT_STROKE.length; i += 2) {
    const [ax, ay, bx, by] = PAINT_STROKE.slice(i, i + 4) as [number, number, number, number];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

const paintProvider = flairEffects({ kinds: ["shader"] });

/**
 * Renders a hinted effect as an editor paints with it: its hint's values over its defaults, at
 * 64 × 64, a path effect given the sample stroke. It must draw something, and a path effect must
 * stay mostly clear away from the stroke.
 */
async function checkPaint(id: string): Promise<Result> {
  const errors: string[] = [];
  try {
    const description = await paintProvider.describe(id);
    const paint = description.paint!;
    const properties = description.controls.properties as Record<string, { anyOf?: { format?: string }[] }>;
    const pathControl = Object.keys(properties).find((k) => properties[k]!.anyOf?.some((o) => o.format === "svg-path"));
    const values = { ...paint.values, ...(paint.map === "path" && pathControl && { [pathControl]: PAINT_STROKE }) };
    const renderer = await paintProvider.createRenderer(id, { width: PAINT_SIZE, height: PAINT_SIZE });
    try {
      const { data } = await renderer.render({ time: 1500, values });
      let drawn = 0;
      let outside = 0;
      let clearOutside = 0;
      for (let y = 0; y < PAINT_SIZE; y++) {
        for (let x = 0; x < PAINT_SIZE; x++) {
          const alpha = data[(y * PAINT_SIZE + x) * 4 + 3]!;
          if (alpha > 16) drawn += 1;
          if (strokeDistance(x + 0.5, y + 0.5) > 14) {
            outside += 1;
            if (alpha <= 16) clearOutside += 1;
          }
        }
      }
      if (drawn < 8) errors.push(`painted with its hint, it draws almost nothing (${drawn} pixels)`);
      if (paint.map === "path" && clearOutside / outside < 0.75) errors.push(`as path paint, only ${((clearOutside / outside) * 100).toFixed(0)}% of the frame away from the stroke is clear`);
    } finally {
      renderer.dispose();
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  return { id: `${id} (paint)`, ok: errors.length === 0, errors };
}

/**
 * `#check`: compiles every catalog shader on this browser's GPU, renders the
 * image effects with a transparent icon and each paint hint along a stroke, and lists the results (also as
 * `window.flairCheck`, for automated runs).
 */
export function CheckPage() {
  const [results, setResults] = useState<Result[] | null>(null);
  useEffect(() => {
    const gl = createContext(document.createElement("canvas"));
    if (!gl) {
      setResults([{ id: "webgl2", ok: false, errors: ["This browser has no WebGL2."] }]);
      return;
    }
    const compiled = SHADER_EFFECTS.map((effect) => {
      const result = compileShader(gl, effect.source, parseControls(effect.source));
      return {
        id: effect.id,
        ok: result.ok,
        errors: result.ok ? [] : result.errors.map((e) => `line ${e.line}: ${e.message}`),
      };
    });
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    let cancelled = false;
    void (async () => {
      const rendered: Result[] = [];
      // One at a time: browsers cap live WebGL contexts.
      for (const effect of PICTURE_EFFECTS) rendered.push(await checkIcon(effect));
      for (const id of Object.keys(PAINT_HINTS)) rendered.push(await checkPaint(id));
      if (cancelled) return;
      const out = [...compiled, ...rendered];
      (window as unknown as { flairCheck: Result[] }).flairCheck = out;
      setResults(out);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!results) return <p className="p-6">Compiling and rendering…</p>;
  const failed = results.filter((r) => !r.ok);
  return (
    <div className="p-6 space-y-3 font-mono text-sm">
      <h1 id="check-summary" className="text-lg">
        {failed.length === 0 ? `All ${results.length} checks pass.` : `${failed.length} of ${results.length} checks fail.`}
      </h1>
      {results.map((r) => (
        <div key={r.id} className={r.ok ? "text-emerald-400" : "text-rose-400"}>
          {r.ok ? "✓" : "✗"} {r.id}
          {r.errors.map((e) => (
            <div key={e} className="pl-6 text-rose-300">
              {e}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
