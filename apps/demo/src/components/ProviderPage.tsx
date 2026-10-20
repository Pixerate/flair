import { useEffect, useRef, useState } from "react";
import { checkEffectProvider, type EffectConformanceIssue, type EffectPixels } from "@pixerate/editor/effects";
import { flairEffects } from "@pixerate/flair/integrations";

interface Sample {
  id: string;
  note: string;
  pixels: EffectPixels;
}

/** A soft diagonal gradient with a grid, as the picture filters and transitions work on. */
function picture(width: number, height: number, hue: number): EffectPixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const t = (x + y) / (width + height);
      const grid = x % 32 < 2 || y % 32 < 2 ? 0.4 : 1;
      data[i] = (hue ? 40 + 200 * t : 230 - 160 * t) * grid;
      data[i + 1] = (hue ? 90 + 120 * (1 - t) : 120 + 80 * t) * grid;
      data[i + 2] = (hue ? 230 - 100 * t : 60 + 120 * t) * grid;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

function Swatch({ sample }: { sample: Sample }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    canvas.width = sample.pixels.width;
    canvas.height = sample.pixels.height;
    canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(sample.pixels.data), sample.pixels.width, sample.pixels.height), 0, 0);
  }, [sample]);
  return (
    <figure className="space-y-1">
      <canvas ref={ref} className="w-64 rounded border border-slate-700 bg-[conic-gradient(#334155_25%,#1e293b_0_50%,#334155_0_75%,#1e293b_0)] bg-[length:16px_16px]" />
      <figcaption className="text-slate-400">
        {sample.id}: {sample.note}
      </figcaption>
    </figure>
  );
}

/**
 * `#provider`: Flair as `@pixerate/editor`'s effects provider, on this GPU.
 * Runs the editor's own conformance check (`checkEffectProvider`) over every
 * effect with real rendering, and draws a few through the contract (also as
 * `window.flairProvider`, for automated runs).
 */
export function ProviderPage() {
  const [issues, setIssues] = useState<EffectConformanceIssue[] | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [status, setStatus] = useState("Checking every effect…");
  useEffect(() => {
    void (async () => {
      const provider = flairEffects();
      const started = performance.now();
      const found = await checkEffectProvider(provider, { size: 16 });
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      setIssues(found);
      setStatus(`${(await provider.list()).length} effects checked in ${seconds} s`);
      const size = { width: 256, height: 144 };
      const from = picture(size.width, size.height, 0);
      const to = picture(size.width, size.height, 1);
      const drawn: Sample[] = [];
      const draw = async (id: string, note: string, request: Parameters<Awaited<ReturnType<typeof provider.createRenderer>>["render"]>[0]) => {
        const renderer = await provider.createRenderer(id, size);
        drawn.push({ id, note, pixels: await renderer.render(request) });
        renderer.dispose();
        setSamples([...drawn]);
      };
      await draw("crt", "filter on source", { time: 1000, inputs: { source: from } });
      await draw("image-duotone", 'filter, uShadow "#1e3a8a"', { time: 0, inputs: { source: from }, values: { uShadow: "#1e3a8a" } });
      await draw("transition-wipe", "transition at progress 0.5", { time: 0, inputs: { from, to }, progress: 0.5 });
      await draw("aurora", "generator at 2 s", { time: 2000 });
      await draw("lower-third", "vector effect at 1.5 s", { time: 1500 });
      const half = { ...size, data: new Uint8ClampedArray(size.width * size.height * 4) };
      for (let i = 0; i < size.width * size.height; i++) half.data[i * 4 + 3] = i % size.width < size.width / 2 ? 255 : 0;
      await draw("crt", "filter masked to the left half", { time: 1000, inputs: { source: from }, mask: half });
      const deep = await provider.createRenderer("aurora", { ...size, depth: 16 });
      const hdr = await deep.render({ time: 2000 });
      deep.dispose();
      const linear = hdr.float ? [...hdr.float.slice(0, 4)].map((v) => Math.round(v * 1000) / 1000) : null;
      drawn.push({ id: "aurora", note: `depth ${deep.depth}: float ${linear ? `linear ${linear.join(", ")}` : "none"}`, pixels: hdr });
      setSamples([...drawn]);
      (window as unknown as { flairProvider: unknown }).flairProvider = { issues: found, seconds: Number(seconds), samples: drawn.map((s) => `${s.id}: ${s.note}`), capabilities: provider.capabilities };
    })().catch((e: unknown) => setStatus(`Failed: ${e instanceof Error ? e.message : String(e)}`));
  }, []);

  return (
    <div className="p-6 space-y-6 font-mono text-sm">
      <h1 id="provider-summary" className="text-lg">
        Flair as an effects provider: {status}
      </h1>
      {issues && (
        <section>
          <h2 className={issues.length ? "text-amber-300" : "text-emerald-400"}>{issues.length ? `${issues.length} conformance issues` : "Conforms: no issues"}</h2>
          <ul className="text-slate-400">
            {issues.map((issue, i) => (
              <li key={i}>
                {issue.effectId ?? "provider"}: {issue.message}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="flex flex-wrap gap-4">
        {samples.map((s) => (
          <Swatch key={`${s.id} ${s.note}`} sample={s} />
        ))}
      </section>
    </div>
  );
}
