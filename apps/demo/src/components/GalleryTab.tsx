import { useEffect, useRef, useState } from "react";
import { sharedThumbnailPool, SvgPlayer } from "@pixerate/flair";
import {
  EFFECT_CATEGORIES,
  effectDefaults,
  findEffects,
  renderVectorEffect,
  type EffectCategory,
  type EffectDefinition,
} from "@pixerate/flair/catalog";
import { CameraMoves } from "./CameraMoves";

function ShaderThumb({ effect }: { effect: Extract<EffectDefinition, { kind: "shader" }> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const handle = sharedThumbnailPool().register(canvas.current!, effect.source, effectDefaults(effect), (ok) => setFailed(!ok));
    return () => handle.dispose();
  }, [effect]);
  return (
    <>
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      {failed && <span className="absolute inset-0 grid place-items-center text-sm text-slate-400">Needs WebGL2</span>}
    </>
  );
}

function VectorThumb({ effect }: { effect: Extract<EffectDefinition, { kind: "vector" }> }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const player = new SvgPlayer(host.current!, renderVectorEffect(effect, effectDefaults(effect)), { hold: effect.hold });
    return () => player.dispose();
  }, [effect]);
  return <div ref={host} className="absolute inset-[12%]" />;
}

function EffectCard({ effect, onOpen }: { effect: EffectDefinition; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="group text-left rounded-xl border border-slate-800 bg-slate-900 overflow-hidden hover:border-violet-500/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 transition"
    >
      <div className={`relative aspect-video ${effect.kind === "vector" ? "bg-slate-100" : "bg-black"}`}>
        {effect.kind === "shader" ? <ShaderThumb effect={effect} /> : <VectorThumb effect={effect} />}
        <span className="absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-200">
          {effect.kind}
        </span>
      </div>
      <div className="p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-medium text-slate-100 group-hover:text-white">{effect.name}</h3>
          <code className="text-[11px] text-slate-500">{effect.id}</code>
        </div>
        <p className="mt-1 text-sm text-slate-400 line-clamp-2">{effect.description}</p>
      </div>
    </button>
  );
}

export function GalleryTab({ onOpen }: { onOpen: (id: string) => void }) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<EffectCategory | "all">("all");
  const effects = findEffects({ text, category: category === "all" ? undefined : category });

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950/40 p-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Visual effects for the web, ready to drop in.</h1>
        <p className="mt-2 max-w-3xl text-slate-400">
          {findEffects().length} effects: WebGL2 shaders (backgrounds, textures, light, image treatments, transitions) and animated SVG
          (loaders, icons, charts). Each has controls and presets; open one to edit it, keyframe it, or hand it to an agent.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-950 border border-slate-800 p-3 text-sm text-slate-300">
          <code>{`import { ShaderRenderer } from "@pixerate/flair";
import { getEffect, effectDefaults } from "@pixerate/flair/catalog";

const aurora = getEffect("aurora");
const preview = new ShaderRenderer(document.querySelector("#hero"));
preview.setSource(aurora.source);
preview.setValues(effectDefaults(aurora, { preset: "Ember" }));`}</code>
        </pre>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search effects…"
          className="w-full sm:w-64 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
          aria-label="Search effects"
        />
        {(["all", ...EFFECT_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1 text-sm border transition ${
              category === c ? "border-violet-500 bg-violet-500/15 text-violet-100" : "border-slate-700 text-slate-400 hover:text-slate-100"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {category === "all" && !text && <CameraMoves />}

      {effects.length === 0 ? (
        <p className="text-slate-400">No effects match.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {effects.map((e) => (
            <EffectCard key={e.id} effect={e} onOpen={() => onOpen(e.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
