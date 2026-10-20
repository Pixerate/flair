import { useEffect, useState } from "react";
import { probe, type ProbeResult } from "../pixels/probe";

/** `#pixels?effect=aurora&size=1080&frames=30`: the options, read from the hash. */
function options() {
  const params = new URLSearchParams(location.hash.split("?")[1] ?? "");
  const size = Number(params.get("size") ?? 1080);
  return { effect: params.get("effect") ?? "aurora", width: Math.round((size * 16) / 9), height: size, frames: Math.max(4, Number(params.get("frames") ?? 30)) };
}

function inWorker(opts: ReturnType<typeof options>): Promise<ProbeResult> {
  const worker = new Worker(new URL("../pixels/worker.ts", import.meta.url), { type: "module" });
  return new Promise<ProbeResult>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<{ result?: ProbeResult; error?: string }>) => (e.data.result ? resolve(e.data.result) : reject(new Error(e.data.error)));
    worker.onerror = (e) => reject(new Error(e.message));
    worker.postMessage(opts);
  }).finally(() => worker.terminate());
}

/**
 * `#pixels`: checks that ImageData, ImageBitmap, OffscreenCanvas and
 * VideoFrame inputs reach a shader the right way up, on the page and in a
 * Worker, and times a frame rendered and read out as an ImageData or an
 * ImageBitmap in each (also as `window.flairPixels`, for automated runs).
 */
export function PixelsPage() {
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const opts = options();
    void (async () => {
      try {
        const out = [await probe(opts)];
        setResults([...out]);
        out.push(await inWorker(opts));
        setResults([...out]);
        (window as unknown as { flairPixels: ProbeResult[] }).flairPixels = out;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  return (
    <div className="p-6 space-y-6 font-mono text-sm">
      <h1 id="pixels-summary" className="text-lg">
        Pixel input and output{results.length === 2 ? "" : "…"}
      </h1>
      {error && <pre className="text-rose-400 whitespace-pre-wrap">{error}</pre>}
      {results.map((r) => (
        <section key={r.where} className="space-y-2">
          <h2 className="text-slate-300">On the {r.where}</h2>
          <table>
            <tbody>
              {[...r.checks, ...r.pipeline].map((c) => (
                <tr key={c.input} className={c.ok ? "text-emerald-400" : "text-rose-400"}>
                  <td className="pr-6">{c.ok ? "upright" : "WRONG"}</td>
                  <td className="pr-6">{c.input}</td>
                  <td className="text-slate-500">{c.detail}</td>
                </tr>
              ))}
              {r.timings.map((t) => (
                <tr key={t.output}>
                  <td className="pr-6 text-right">{t.ms.toFixed(2)} ms</td>
                  <td className="pr-6">{t.output}</td>
                  <td className="text-slate-500">
                    {r.effect} at {r.size}, render and output, per frame over a run
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
