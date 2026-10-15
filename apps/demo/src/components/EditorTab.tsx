import { useEffect, useRef, useState } from "react";
import { ShaderRenderer, standaloneHtml, SvgPlayer, type SvgTrigger } from "@pixerate/flair";
import { EFFECTS, getEffect, SAMPLE_IMAGES } from "@pixerate/flair/catalog";
import { bindShaderRenderer, bindSvgView, motionAt, valuesAt, type EffectEditor } from "@pixerate/flair/editor";
import { useEditorState } from "../hooks";
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
function bindTriggeredSvg(editor: EffectEditor, container: HTMLElement, trigger: SvgTrigger): () => void {
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
  };
  sync();
  const unsubscribe = editor.subscribe(sync);
  return () => {
    unsubscribe();
    player?.dispose();
  };
}

const TRIGGER_HINTS: Record<SvgTrigger, string> = { hover: "Hover to play", press: "Press and hold", click: "Click to play" };

function Preview({
  editor,
  kind,
  overlay,
  transparent,
  trigger,
  hint,
}: {
  editor: EffectEditor;
  kind: "shader" | "vector";
  overlay: boolean;
  transparent: boolean;
  trigger?: SvgTrigger;
  hint?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (kind === "vector") return trigger ? bindTriggeredSvg(editor, host.current!, trigger) : bindSvgView(editor, host.current!);
    const renderer = new ShaderRenderer(host.current!, { className: "absolute inset-0 h-full w-full", alpha: transparent });
    const unbind = bindShaderRenderer(editor, renderer);
    // The agent tab's `view_effect` tool captures this preview.
    const page = window as unknown as { flairPreview?: ShaderRenderer };
    page.flairPreview = renderer;
    return () => {
      if (page.flairPreview === renderer) delete page.flairPreview;
      unbind();
      renderer.dispose();
    };
  }, [editor, kind, transparent, trigger]);
  return (
    <div className={`relative aspect-video overflow-hidden rounded-xl border border-slate-800 ${overlay ? "bg-black" : kind === "vector" ? "bg-slate-100 p-[8%]" : "bg-black"}`}>
      {overlay && <img src={SAMPLE_IMAGES.city} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <div ref={host} className={kind === "vector" && !overlay ? "h-full w-full" : "absolute inset-0"} />
      {(hint ?? (trigger && TRIGGER_HINTS[trigger])) && (
        <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-slate-200">
          {hint ?? TRIGGER_HINTS[trigger!]}
        </span>
      )}
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
  // Overlays preview over a picture; overlay shaders draw on a transparent canvas.
  const overlay = based?.category === "overlay";
  const transparent = based?.kind === "shader" && Boolean(based.transparent);
  const trigger = based?.kind === "vector" ? based.trigger : undefined;
  const hint = based?.kind === "shader" && based.category === "interaction" ? "Hover, press or click" : undefined;

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

        <Preview key={kind} editor={editor} kind={kind} overlay={overlay} transparent={transparent} trigger={trigger} hint={hint} />
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
