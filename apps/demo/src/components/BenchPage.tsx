import { useEffect, useState } from "react";
import { ShaderFrames } from "@pixerate/flair";
import { effectDefaults, SHADER_EFFECTS, type ShaderEffect } from "@pixerate/flair/catalog";

export interface BenchResult {
  id: string;
  /** Median ms per frame. */
  ms: number;
  /** Slowest frame, ms. */
  worst: number;
  /** "gpu" from timer queries, "wall" from wall-clock time with a sync after each frame. */
  timer: "gpu" | "wall";
}

/** `#bench?size=1080&frames=24&only=aurora,fur`: the options, read from the hash. */
function options() {
  const params = new URLSearchParams(location.hash.split("?")[1] ?? "");
  const size = Number(params.get("size") ?? 1080);
  const only = params.get("only")?.split(",").filter(Boolean);
  return {
    width: Math.round((size * 16) / 9),
    height: size,
    frames: Math.max(4, Number(params.get("frames") ?? 24)),
    effects: only ? SHADER_EFFECTS.filter((e) => only.includes(e.id)) : SHADER_EFFECTS,
  };
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
};

/** Yields to the browser without a timer, which a hidden page would throttle. */
const yieldNow = () =>
  new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(0);
  });

/** The GPU timer extension, when the browser offers it. */
type TimerExt = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };

/** One draw's GPU time in ms, or undefined when the reading was disturbed (another page, a clock change). */
async function gpuTime(gl: WebGL2RenderingContext, ext: TimerExt, draw: () => void): Promise<number | undefined> {
  const query = gl.createQuery()!;
  gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
  draw();
  gl.endQuery(ext.TIME_ELAPSED_EXT);
  for (let tries = 0; tries < 5000 && !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE); tries++) await yieldNow();
  const ok = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) && !gl.getParameter(ext.GPU_DISJOINT_EXT);
  const ns = ok ? (gl.getQueryParameter(query, gl.QUERY_RESULT) as number) : 0;
  gl.deleteQuery(query);
  return ok && ns > 0 ? ns / 1e6 : undefined;
}

/** Repeats of each frame; the fastest counts, so a busy GPU (another page drawing) skews it least. */
const TRIES = 3;

/**
 * Times one effect at its defaults: a few frames to warm up, then `frames`
 * frames at different times, each drawn on its own `TRIES` times and timed on
 * the GPU when it can be (else by the wall clock with a one-pixel read to
 * wait for the GPU to finish), keeping each frame's fastest.
 */
async function bench(effect: ShaderEffect, width: number, height: number, frames: number): Promise<BenchResult> {
  const canvas = document.createElement("canvas");
  const shader = new ShaderFrames({ source: effect.source, values: effectDefaults(effect), width, height, canvas, alpha: Boolean(effect.transparent) });
  try {
    await shader.ready();
    const gl = canvas.getContext("webgl2")!;
    const pixel = new Uint8Array(4);
    const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExt | null;
    for (let i = 0; i < 3; i++) {
      shader.render(0.5 + i * 0.37);
      sync();
    }
    const times: number[] = [];
    let kind: BenchResult["timer"] = ext ? "gpu" : "wall";
    for (let i = 0; i < frames; i++) {
      const time = 1 + i * 0.29;
      let best = Infinity;
      for (let t = 0; t < TRIES; t++) {
        const gpu = ext ? await gpuTime(gl, ext, () => shader.render(time)) : undefined;
        if (gpu !== undefined) {
          best = Math.min(best, gpu);
          continue;
        }
        kind = "wall";
        const start = performance.now();
        shader.render(time);
        sync();
        best = Math.min(best, performance.now() - start);
      }
      times.push(best);
    }
    return { id: effect.id, ms: median(times), worst: Math.max(...times), timer: kind };
  } finally {
    shader.dispose();
  }
}

/**
 * `#bench`: renders every catalog shader off screen at 1920 × 1080 (or
 * `?size=720`, `?frames=`, `?only=id,id`) and lists the time each frame takes,
 * slowest first (also as `window.flairBench`, for automated runs).
 */
export function BenchPage() {
  const [results, setResults] = useState<BenchResult[]>([]);
  const [done, setDone] = useState(false);
  const { width, height, frames, effects } = options();
  useEffect(() => {
    let stopped = false;
    void (async () => {
      const out: BenchResult[] = [];
      for (const effect of effects) {
        if (stopped) return;
        // Let the page breathe between effects.
        await yieldNow();
        try {
          out.push(await bench(effect, width, height, frames));
        } catch (e) {
          out.push({ id: `${effect.id} (${e instanceof Error ? e.message : String(e)})`, ms: NaN, worst: NaN, timer: "wall" });
        }
        setResults([...out]);
      }
      out.sort((a, b) => (b.ms || 0) - (a.ms || 0));
      (window as unknown as { flairBench: BenchResult[] }).flairBench = out;
      setResults(out);
      setDone(true);
    })();
    return () => {
      stopped = true;
    };
  }, []);

  return (
    <div className="p-6 space-y-3 font-mono text-sm">
      <h1 id="bench-summary" className="text-lg">
        {done ? `${results.length} shaders at ${width} × ${height}, slowest first` : `Timing ${results.length + 1} of ${effects.length} at ${width} × ${height}…`}
      </h1>
      <p className="text-slate-500">
        Median GPU time per frame (each frame's fastest of {TRIES}), then the slowest frame. Keep this tab in front and the GPU otherwise idle: a hidden
        tab or other pages drawing make every number larger.
      </p>
      <table>
        <tbody>
          {results.map((r) => (
            <tr key={r.id} className={r.ms > 8 ? "text-rose-400" : r.ms > 4 ? "text-amber-300" : "text-emerald-400"}>
              <td className="pr-6 text-right">{Number.isFinite(r.ms) ? r.ms.toFixed(2) : "—"} ms</td>
              <td className="pr-6 text-right text-slate-500">{Number.isFinite(r.worst) ? r.worst.toFixed(2) : "—"}</td>
              <td className="pr-6 text-slate-500">{r.timer}</td>
              <td>{r.id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
