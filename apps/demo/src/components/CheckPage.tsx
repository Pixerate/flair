import { useEffect, useState } from "react";
import { compileShader, createContext, parseControls } from "@pixerate/flair";
import { SHADER_EFFECTS } from "@pixerate/flair/catalog";

interface Result {
  id: string;
  ok: boolean;
  errors: string[];
}

/**
 * `#check`: compiles every catalog shader on this browser's GPU and lists the
 * results (also as `window.flairCheck`, for automated runs).
 */
export function CheckPage() {
  const [results, setResults] = useState<Result[] | null>(null);
  useEffect(() => {
    const gl = createContext(document.createElement("canvas"));
    if (!gl) {
      setResults([{ id: "webgl2", ok: false, errors: ["This browser has no WebGL2."] }]);
      return;
    }
    const out = SHADER_EFFECTS.map((effect) => {
      const result = compileShader(gl, effect.source, parseControls(effect.source));
      return {
        id: effect.id,
        ok: result.ok,
        errors: result.ok ? [] : result.errors.map((e) => `line ${e.line}: ${e.message}`),
      };
    });
    (window as unknown as { flairCheck: Result[] }).flairCheck = out;
    setResults(out);
  }, []);

  if (!results) return <p className="p-6">Compiling…</p>;
  const failed = results.filter((r) => !r.ok);
  return (
    <div className="p-6 space-y-3 font-mono text-sm">
      <h1 id="check-summary" className="text-lg">
        {failed.length === 0 ? `All ${results.length} shaders compile.` : `${failed.length} of ${results.length} shaders fail.`}
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
