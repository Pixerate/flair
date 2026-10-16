import { useEffect, useRef, useState } from "react";
import { ShaderRenderer, sharedAudioContext, standaloneHtml, SvgPlayer, type SvgTrigger } from "@pixerate/flair";
import { EFFECTS, effectInputs, getEffect, SAMPLE_IMAGES } from "@pixerate/flair/catalog";
import { bindShaderRenderer, bindSvgView, motionAt, valuesAt, type EffectEditor } from "@pixerate/flair/editor";
import { useEditorState } from "../hooks";
import { showsOverPicture } from "../overPicture";
import { ControlsPanel } from "./ControlsPanel";
import { Timeline } from "./Timeline";

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

/** The preview: a shader renderer or an SVG view, driven by the editor. */
/** A vector effect played by the pointer (hover, press or click), rebuilt whenever the edit changes it. */
function bindTriggeredSvg(editor: EffectEditor, container: HTMLElement, trigger: SvgTrigger, onPlayer?: (player: SvgPlayer | undefined) => void): () => void {
  let player: SvgPlayer | undefined;
  let key: string | undefined;
  const sync = () => {
    const state = editor.getState();
    const motion = motionAt(state.document, state.time);
    const next = JSON.stringify(motion ?? null);
    if (next === key) return;
    key = next;
    player?.dispose();
    player = motion ? new SvgPlayer(container, motion, { trigger, triggerTarget: container.parentElement ?? container }) : undefined;
    onPlayer?.(player);
  };
  sync();
  const unsubscribe = editor.subscribe(sync);
  return () => {
    unsubscribe();
    player?.dispose();
  };
}

const TRIGGER_HINTS: Record<SvgTrigger, string> = { hover: "Hover to play", press: "Press and hold", click: "Click to play", scroll: "Scroll over it, or drag the slider" };

/**
 * A short loop to listen with, made on the spot: a kick on every beat at
 * 120 bpm, a hat between, a bass line and a chord, as an `AudioBuffer`.
 */
function sampleLoop(ctx: BaseAudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const seconds = 4;
  const buffer = ctx.createBuffer(1, rate * seconds, rate);
  const out = buffer.getChannelData(0);
  const notes = [55, 55, 65.4, 49];
  let seed = 1;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < out.length; i++) {
    const t = i / rate;
    const beat = t % 0.5;
    const kick = Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-beat * 30)) * beat) * Math.exp(-beat * 9) * 0.9;
    const off = (t + 0.25) % 0.5;
    const hat = noise() * Math.exp(-off * 60) * 0.25;
    const f = notes[Math.floor(t)]!;
    const bass = Math.sin(2 * Math.PI * f * t) * 0.25 * (0.6 + 0.4 * Math.exp(-beat * 4));
    const chord = [2, 2.52, 3].reduce((n, k) => n + Math.sin(2 * Math.PI * f * 4 * k * t), 0) * 0.04;
    out[i] = Math.tanh(kick + hat + bass + chord);
  }
  return buffer;
}

type Sound = "demo" | "loop" | "mic";

/** What an audio effect hears in the editor: its idle demo, a generated loop (played), or the microphone. */
function SoundPicker({ renderer }: { renderer: ShaderRenderer | undefined }) {
  const [sound, setSound] = useState<Sound>("demo");
  const [error, setError] = useState<string>();
  const stop = useRef<() => void>(() => {});
  useEffect(() => () => stop.current(), []);
  useEffect(() => {
    // A new preview (another effect) starts on the demo.
    stop.current();
    setSound("demo");
  }, [renderer]);
  const pick = async (next: Sound) => {
    stop.current();
    stop.current = () => {};
    setError(undefined);
    setSound(next);
    if (!renderer) return;
    if (next === "demo") return renderer.setAudioSource(null);
    // Picked by a click, so the browser lets the context start.
    const ctx = sharedAudioContext();
    await ctx.resume();
    if (next === "loop") {
      const source = ctx.createBufferSource();
      source.buffer = sampleLoop(ctx);
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0.35;
      source.connect(gain).connect(ctx.destination);
      source.start();
      renderer.setAudioSource(gain);
      stop.current = () => {
        source.stop();
        gain.disconnect();
        renderer.setAudioSource(null);
      };
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      renderer.setAudioSource(stream);
      stop.current = () => {
        for (const track of stream.getTracks()) track.stop();
        renderer.setAudioSource(null);
      };
    } catch (e) {
      setError(`No microphone: ${(e as Error).message}`);
      setSound("demo");
      renderer.setAudioSource(null);
    }
  };
  const options: [Sound, string][] = [
    ["demo", "Idle demo"],
    ["loop", "Sample loop"],
    ["mic", "Microphone"],
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-400">Sound</span>
      <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
        {options.map(([id, label]) => (
          <button key={id} onClick={() => void pick(id)} className={`rounded-md px-2.5 py-1 ${sound === id ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-100"}`} aria-pressed={sound === id}>
            {label}
          </button>
        ))}
      </div>
      {error && <span className="text-rose-300">{error}</span>}
    </div>
  );
}

function Preview({
  editor,
  kind,
  overlay,
  transparent,
  trigger,
  hint,
  scroll,
  audio,
}: {
  editor: EffectEditor;
  kind: "shader" | "vector";
  overlay: boolean;
  transparent: boolean;
  trigger?: SvgTrigger;
  hint?: string;
  /** Follows the scroll: show a scrubber, and let the wheel over the preview drive it. */
  scroll?: boolean;
  /** Hears sound: show the sound picker. */
  audio?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [renderer, setRenderer] = useState<ShaderRenderer>();
  const [progress, setProgress] = useState(0.3);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  /** Puts a scroll position into the preview (a shader's iScroll, or a vector player's place). */
  const drive = useRef<(p: number) => void>(() => {});
  useEffect(() => {
    if (kind === "vector") {
      if (!trigger) return bindSvgView(editor, host.current!);
      return bindTriggeredSvg(editor, host.current!, trigger, (player) => {
        drive.current = (p) => player?.setProgress(player.scrollPosition(p));
        if (trigger === "scroll") drive.current(progressRef.current);
      });
    }
    const renderer = new ShaderRenderer(host.current!, { className: "absolute inset-0 h-full w-full", alpha: transparent });
    const unbind = bindShaderRenderer(editor, renderer);
    drive.current = (p) => renderer.setScrollProgress(p);
    if (scroll) drive.current(progressRef.current);
    setRenderer(renderer);
    // The agent tab's `view_effect` tool captures this preview.
    const page = window as unknown as { flairPreview?: ShaderRenderer };
    page.flairPreview = renderer;
    return () => {
      if (page.flairPreview === renderer) delete page.flairPreview;
      setRenderer(undefined);
      unbind();
      renderer.dispose();
    };
  }, [editor, kind, transparent, trigger, scroll]);
  useEffect(() => {
    if (scroll) drive.current(progress);
  }, [scroll, progress]);
  // Scrolling over the preview scrolls the effect (not the page).
  useEffect(() => {
    const el = frame.current;
    if (!el || !scroll) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setProgress((p) => Math.min(1, Math.max(0, p + e.deltaY / 1500)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [scroll]);
  return (
    <div className="space-y-2">
      <div ref={frame} className={`relative aspect-video overflow-hidden rounded-xl border border-slate-800 ${overlay ? "bg-black" : kind === "vector" ? "bg-slate-100 p-[8%]" : "bg-black"}`}>
        {overlay && <img src={SAMPLE_IMAGES.city} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div ref={host} className={kind === "vector" && !overlay ? "h-full w-full" : "absolute inset-0"} />
        {(hint ?? (trigger && TRIGGER_HINTS[trigger])) && (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-slate-200">
            {hint ?? TRIGGER_HINTS[trigger!]}
          </span>
        )}
      </div>
      {scroll && (
        <label className="flex items-center gap-3 text-sm text-slate-400">
          <span>Scroll</span>
          <input type="range" min={0} max={1} step={0.001} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="flex-1 accent-violet-500" aria-label="Scroll position" />
          <span className="w-12 text-right tabular-nums">{Math.round(progress * 100)}%</span>
        </label>
      )}
      {audio && <SoundPicker renderer={renderer} />}
    </div>
  );
}

function SourceEditor({ editor, source, errors }: { editor: EffectEditor; source: string; errors: { line: number; message: string }[] }) {
  const [draft, setDraft] = useState(source);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    setDraft(source);
    setDirty(false);
  }, [source]);
  const apply = () => {
    editor.setSource(draft);
    setDirty(false);
  };
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2 text-sm">
        <span className="font-medium">Source</span>
        <span className="text-slate-500">GLSL ES 3.00 · controls are uniforms marked // @control</span>
        <button onClick={apply} disabled={!dirty} className="ml-auto rounded-md bg-violet-600 px-3 py-1 text-white disabled:opacity-40 hover:bg-violet-500">
          Compile <kbd className="text-xs opacity-70">⌘↵</kbd>
        </button>
      </div>
      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setDirty(true);
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") apply();
          e.stopPropagation();
        }}
        spellCheck={false}
        className="block h-80 w-full resize-y bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-200 focus:outline-none"
        aria-label="Shader source"
      />
      {errors.length > 0 && (
        <ul className="border-t border-rose-900/60 bg-rose-950/40 px-3 py-2 font-mono text-xs text-rose-300 space-y-0.5">
          {errors.map((e, i) => (
            <li key={i}>
              {e.line > 0 ? `line ${e.line}: ` : ""}
              {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EditorTab({ editor }: { editor: EffectEditor }) {
  const state = useEditorState(editor);
  const doc = state.document;
  const kind = doc.effect.kind;
  const based = doc.basedOn ? getEffect(doc.basedOn) : undefined;
  // Overlays and transparent shaders preview over a picture, transparent shaders on a transparent canvas.
  const overlay = showsOverPicture(based);
  const transparent = based?.kind === "shader" && Boolean(based.transparent);
  const trigger = based?.kind === "vector" ? based.trigger : undefined;
  const hint = based?.kind === "shader" && based.category === "interaction" ? "Hover, press or click" : based?.kind === "shader" && based.category === "scroll" ? "Scroll over it, or drag the slider" : undefined;
  const inputs = based ? effectInputs(based) : undefined;
  const scroll = Boolean(inputs?.interactions.includes("scroll"));
  const audio = Boolean(inputs?.accepts.includes("audio"));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      editor.commands.handleKeyDown(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor]);

  const exportHtml = () => {
    if (doc.effect.kind !== "shader") return;
    download(`${doc.basedOn ?? "effect"}.html`, standaloneHtml(doc.name, doc.effect.source, valuesAt(doc, state.time)), "text/html");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight mr-2">{doc.name}</h1>
          <select
            value={doc.basedOn ?? ""}
            onChange={(e) => e.target.value && editor.load(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
            aria-label="Start from a catalog effect"
          >
            <option value="">Start from…</option>
            {EFFECTS.map((e) => (
              <option key={e.id} value={e.id}>
                {e.category} · {e.name}
              </option>
            ))}
          </select>
          <div className="ml-auto flex gap-1.5 text-sm">
            <button onClick={() => editor.undo()} disabled={!state.history.canUndo} className="rounded-md border border-slate-700 px-2.5 py-1 disabled:opacity-40 hover:bg-slate-800" title={state.history.undoName}>
              Undo
            </button>
            <button onClick={() => editor.redo()} disabled={!state.history.canRedo} className="rounded-md border border-slate-700 px-2.5 py-1 disabled:opacity-40 hover:bg-slate-800" title={state.history.redoName}>
              Redo
            </button>
          </div>
        </div>

        <Preview key={kind} editor={editor} kind={kind} overlay={overlay} transparent={transparent} trigger={trigger} hint={hint} scroll={scroll} audio={audio} />
        <Timeline editor={editor} state={state} />

        {state.issues.length > 0 && (
          <ul className="rounded-lg border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-sm text-amber-200 space-y-0.5">
            {state.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        )}

        {doc.effect.kind === "shader" ? (
          <SourceEditor editor={editor} source={doc.effect.source} errors={state.compile?.errors ?? []} />
        ) : (
          <details className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm">
            <summary className="cursor-pointer font-medium">Picture (SVG and animations)</summary>
            <pre className="mt-2 max-h-80 overflow-auto text-xs text-slate-300">{JSON.stringify(doc.effect.motion, null, 2)}</pre>
          </details>
        )}
      </div>

      <aside className="space-y-4">
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-medium text-slate-300">Presets</h2>
          <div className="flex flex-wrap gap-1.5">
            {doc.presets.map((p) => (
              <button key={p.name} onClick={() => editor.applyPreset(p.name)} className="rounded-full border border-slate-700 px-3 py-1 text-sm hover:border-violet-500">
                {p.name}
              </button>
            ))}
            <button
              onClick={() => {
                const name = prompt("Preset name");
                if (name) editor.savePreset(name);
              }}
              className="rounded-full border border-dashed border-slate-600 px-3 py-1 text-sm text-slate-400 hover:text-slate-100"
            >
              + Save current
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-medium text-slate-300">Controls</h2>
            <button onClick={() => editor.randomize()} className="ml-auto rounded-md border border-slate-700 px-2 py-0.5 text-xs hover:bg-slate-800">
              Randomize
            </button>
            <button onClick={() => editor.resetValues()} className="rounded-md border border-slate-700 px-2 py-0.5 text-xs hover:bg-slate-800">
              Reset
            </button>
          </div>
          <ControlsPanel editor={editor} />
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2">
          <h2 className="text-sm font-medium text-slate-300">Export</h2>
          <div className="flex flex-wrap gap-1.5 text-sm">
            <button onClick={() => download(`${doc.basedOn ?? "effect"}.flair.json`, JSON.stringify(doc, null, 2), "application/json")} className="rounded-md border border-slate-700 px-2.5 py-1 hover:bg-slate-800">
              Document JSON
            </button>
            {kind === "shader" && (
              <button onClick={exportHtml} className="rounded-md border border-slate-700 px-2.5 py-1 hover:bg-slate-800">
                Standalone HTML
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">Space plays and pauses (a command, like everything here).</p>
        </section>
      </aside>
    </div>
  );
}
