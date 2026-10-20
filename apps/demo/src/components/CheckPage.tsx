import { useEffect, useState } from "react";
import { compileShader, createContext, parseControls, ShaderFrames, type ControlValue } from "@pixerate/flair";
import { SAMPLE_IMAGES, SHADER_EFFECTS, type ShaderEffect } from "@pixerate/flair/catalog";

interface Result {
  id: string;
  ok: boolean;
  errors: string[];
}

/** Effects that show a picture over a backdrop (see `BACKDROP` in the catalog). */
const PICTURE_EFFECTS = SHADER_EFFECTS.filter((e) => /uniform float uBackdropAlpha;/.test(e.source));
/**
 * These draw a whole opaque device or scene around the picture, so they stay opaque with a clear
 * backdrop (the audio ones and the floor reflection clear it with their own background opacity
 * control instead; the funhouse mirror hangs on a wall unless its frame is turned off).
 */
const OPAQUE = new Set(["gameboy-screen", "circular-spectrum", "bass-pulse", "vinyl", "floor-reflection", "funhouse-mirror"]);

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

/**
 * `#check`: compiles every catalog shader on this browser's GPU, renders the
 * image effects with a transparent icon, and lists the results (also as
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
