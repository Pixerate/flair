import { useEffect, useRef, useState } from "react";
import { sharedThumbnailPool, SvgPlayer, ThumbnailPool, type ThumbnailHandle } from "@pixerate/flair";
import {
  EFFECT_CATEGORY_GROUPS,
  effectDefaults,
  findEffects,
  renderVectorEffect,
  SAMPLE_IMAGES,
  type EffectCategory,
  type EffectDefinition,
} from "@pixerate/flair/catalog";
import { showsOverPicture } from "../overPicture";
import { CameraMoves } from "./CameraMoves";

let overlayPool: ThumbnailPool | undefined;

/** Overlays draw on transparent canvases, over a picture, so they show what they add. */
function poolFor(effect: Extract<EffectDefinition, { kind: "shader" }>): ThumbnailPool {
  if (!effect.transparent) return sharedThumbnailPool();
  return (overlayPool ??= new ThumbnailPool({ alpha: true }));
}

function ShaderThumb({ effect, hovered }: { effect: Extract<EffectDefinition, { kind: "shader" }>; hovered: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const handle = useRef<ThumbnailHandle | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    handle.current = poolFor(effect).register(canvas.current!, effect.source, effectDefaults(effect), (ok) => setFailed(!ok));
    return () => handle.current!.dispose();
  }, [effect]);
  // Interactive shaders see a hovered card as the pointer over its middle.
  useEffect(() => handle.current?.setHovered(hovered), [hovered]);
  return (
    <>
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      {failed && <span className="absolute inset-0 grid place-items-center text-sm text-slate-400">Needs WebGL2</span>}
    </>
  );
}

const prefersReducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A pointer drawn over an interactive thumbnail while it plays its own demo:
 * it glides in to hover, presses down to press, and pings to click.
 */
function DemoCursor({ cursor, ring }: { cursor: React.RefObject<HTMLDivElement | null>; ring: React.RefObject<HTMLSpanElement | null> }) {
  return (
    <div
      ref={cursor}
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 opacity-0 transition-[opacity,transform] duration-300 ease-out"
      style={{ transform: "translate(28px, 28px)" }}
    >
      <span ref={ring} className="absolute -left-3 -top-3 h-6 w-6 rounded-full border-2 border-violet-500 opacity-0" />
      <svg width="18" height="22" viewBox="0 0 18 22" className="drop-shadow">
        <path d="M1 1 L1 17 L5 13 L8 20 L11 19 L8 12 L14 12 Z" fill="#fff" stroke="#111827" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function VectorThumb({ effect, hovered }: { effect: Extract<EffectDefinition, { kind: "vector" }>; hovered: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLSpanElement>(null);
  const player = useRef<SvgPlayer | undefined>(undefined);
  const hoveredRef = useRef(hovered);
  /** When the demo starts over (after a real hover, say). */
  const restartAt = useRef(0);
  const trigger = effect.trigger;
  useEffect(() => {
    const motion = renderVectorEffect(effect, effectDefaults(effect));
    // Clicking a card opens it, so the player listens to nothing: the card's hover and the demo below drive it.
    // Cards scrolled out of view stop drawing: a gallery of always-playing pictures swamps scrolling.
    const p = new SvgPlayer(host.current!, motion, { hold: effect.hold, trigger, triggerTarget: document.createElement("div"), pauseWhenHidden: true });
    player.current = p;
    if (!trigger || prefersReducedMotion()) return () => p.dispose();
    if (trigger === "scroll") {
      // A scroll effect's demo: as if the page scrolled it down and back up, every 5 s.
      let raf = 0;
      const start = performance.now();
      const step = (now: number) => {
        raf = requestAnimationFrame(step);
        const u = ((now - start) / 5000) % 1;
        p.setProgress(0.5 - 0.5 * Math.cos(u * 2 * Math.PI));
      };
      raf = requestAnimationFrame(step);
      return () => {
        cancelAnimationFrame(raf);
        p.dispose();
      };
    }

    let visible = false;
    const observer = new IntersectionObserver(([entry]) => (visible = Boolean(entry?.isIntersecting)));
    observer.observe(host.current!);

    // While nobody hovers the card, it acts out its own interaction, the way interactive shaders play an idle demo:
    // the cursor glides in, hovers / holds / clicks, waits for the picture to play out, then lets go and leaves.
    const showCursor = (state: "out" | "in" | "down") => {
      const el = cursor.current;
      if (!el) return;
      el.style.opacity = state === "out" ? "0" : "1";
      el.style.transform = state === "out" ? "translate(28px, 28px)" : state === "down" ? "translate(0, 0) scale(0.85)" : "translate(0, 0)";
    };
    const ping = () => ring.current?.animate([{ transform: "scale(0.3)", opacity: 0.9 }, { transform: "scale(1.6)", opacity: 0 }], { duration: 450, easing: "ease-out" });
    let phase = 0;
    let waitUntil = performance.now() + 600;
    const timer = setInterval(() => {
      if (hoveredRef.current || !visible) return;
      const now = performance.now();
      if (restartAt.current) {
        if (now < restartAt.current) return;
        restartAt.current = 0;
        phase = 0;
      }
      if (now < waitUntil || p.isPlaying) return;
      if (trigger === "click") {
        // In, click, let it play out, pause; every other round the cursor steps away.
        if (phase === 0) showCursor("in");
        else {
          showCursor("down");
          setTimeout(() => showCursor("in"), 120);
          ping();
          p.advance();
        }
        phase = 1;
        waitUntil = now + 900;
        return;
      }
      // Hover and press: in, act, (play to the end), hold, let go, (play back), out, rest.
      switch (phase) {
        case 0:
          showCursor("in");
          waitUntil = now + 350;
          break;
        case 1:
          if (trigger === "press") showCursor("down");
          p.setActive(true);
          waitUntil = now + 900;
          break;
        case 2:
          showCursor(trigger === "press" ? "in" : "out");
          p.setActive(false);
          waitUntil = now + 300;
          break;
        case 3:
          showCursor("out");
          waitUntil = now + 900;
          break;
      }
      phase = (phase + 1) % 4;
    }, 100);
    return () => {
      clearInterval(timer);
      observer.disconnect();
      p.dispose();
    };
  }, [effect, trigger]);
  useEffect(() => {
    hoveredRef.current = hovered;
    // A real hover takes over from the demo: the demo cursor steps aside for the real one.
    if (hovered && cursor.current) cursor.current.style.opacity = "0";
    else restartAt.current = performance.now() + 1200;
    if (trigger === "hover" || trigger === "press") player.current?.setActive(hovered);
  }, [trigger, hovered]);
  return (
    <>
      <div ref={host} className={showsOverPicture(effect) ? "absolute inset-0" : "absolute inset-[12%]"} />
      {trigger && trigger !== "scroll" && <DemoCursor cursor={cursor} ring={ring} />}
    </>
  );
}

function EffectCard({ effect, onOpen }: { effect: EffectDefinition; onOpen: () => void }) {
  const [hovered, setHovered] = useState(false);
  const trigger =
    effect.kind === "vector" ? effect.trigger : effect.category === "interaction" ? "pointer" : effect.category === "scroll" || effect.category === "audio" ? effect.category : undefined;
  return (
    <button
      onClick={onOpen}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      className="group text-left rounded-xl border border-slate-800 bg-slate-900 overflow-hidden hover:border-violet-500/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 transition"
    >
      <div className={`relative aspect-video ${effect.kind === "vector" && !showsOverPicture(effect) ? "bg-slate-100" : "bg-black"}`}>
        {showsOverPicture(effect) && <img src={SAMPLE_IMAGES.city} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        {effect.kind === "shader" ? <ShaderThumb effect={effect} hovered={hovered} /> : <VectorThumb effect={effect} hovered={hovered} />}
        <span className="absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-200">
          {effect.kind}
          {trigger && ` · ${trigger}`}
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
  const [group, setGroup] = useState<string | "all">("all");
  const [category, setCategory] = useState<EffectCategory | "all">("all");
  const effects = findEffects({ text, group: group === "all" ? undefined : group, category: category === "all" ? undefined : category });
  const categories = EFFECT_CATEGORY_GROUPS.find((g) => g.name === group)?.categories ?? [];
  const count = (query: { group?: string; category?: EffectCategory }) => findEffects({ text, ...query }).length;
  const chip = (on: boolean) =>
    `rounded-full px-3 py-1 text-sm border transition ${on ? "border-violet-500 bg-violet-500/15 text-violet-100" : "border-slate-700 text-slate-400 hover:text-slate-100"}`;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950/40 p-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Visual effects for the web, ready to drop in.</h1>
        <p className="mt-2 max-w-3xl text-slate-400">
          {findEffects().length} effects: WebGL2 shaders (backgrounds, textures, light, image treatments, overlays, text fills, transitions) and animated SVG
          (loaders, icons, titles, charts). Each has controls and presets; open one to edit it, keyframe it, or hand it to an agent.
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
        {(["all", ...EFFECT_CATEGORY_GROUPS.map((g) => g.name)] as const).map((g) => (
          <button
            key={g}
            onClick={() => {
              setGroup(g);
              setCategory("all");
            }}
            className={chip(group === g)}
            aria-pressed={group === g}
          >
            {g} <span className="text-slate-500">{count(g === "all" ? {} : { group: g })}</span>
          </button>
        ))}
      </div>
      {categories.length > 1 && (
        <div className="-mt-2 flex flex-wrap items-center gap-2" aria-label={`${group} categories`}>
          {(["all", ...categories] as const).map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={chip(category === c)} aria-pressed={category === c}>
              {c === "all" ? `all ${group.toLowerCase()}` : c} <span className="text-slate-500">{count(c === "all" ? { group } : { category: c })}</span>
            </button>
          ))}
        </div>
      )}

      {group === "all" && !text && <CameraMoves />}

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
