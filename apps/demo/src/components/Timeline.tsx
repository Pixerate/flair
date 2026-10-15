import { useRef } from "react";
import type { EffectEditor, EffectEditorState } from "@pixerate/flair/editor";
import { formatTime } from "../hooks";

/** Transport and a scrubber with a lane per keyframed control. */
export function Timeline({ editor, state }: { editor: EffectEditor; state: EffectEditorState }) {
  const { document: doc, time, playing, recording } = state;
  const track = useRef<HTMLDivElement>(null);
  const tracked = Object.entries(doc.tracks);
  const pct = (ms: number) => `${(ms / doc.duration) * 100}%`;

  const scrub = (clientX: number) => {
    const box = track.current!.getBoundingClientRect();
    editor.seek(((clientX - box.left) / box.width) * doc.duration);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button onClick={() => editor.toggle()} className="rounded-md bg-violet-600 hover:bg-violet-500 px-3 py-1 font-medium w-20">
          {playing ? "Pause" : "Play"}
        </button>
        <button onClick={() => editor.stop()} className="rounded-md border border-slate-700 px-2.5 py-1 hover:bg-slate-800">
          Stop
        </button>
        <button
          onClick={() => editor.setRecording(!recording)}
          className={`rounded-md border px-2.5 py-1 ${recording ? "border-rose-500 bg-rose-500/20 text-rose-200" : "border-slate-700 hover:bg-slate-800"}`}
          title="While recording, changing a control keyframes it at the playhead"
        >
          ● Record
        </button>
        <span className="tabular-nums text-slate-300 w-28">
          {formatTime(time)} / {formatTime(doc.duration)}
        </span>
        <label className="ml-auto flex items-center gap-1.5 text-slate-400">
          Length
          <input
            type="number"
            min={0.1}
            step={0.5}
            value={doc.duration / 1000}
            onChange={(e) => Number(e.target.value) > 0 && editor.setTiming({ duration: Number(e.target.value) * 1000 })}
            className="w-16 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 tabular-nums"
          />
          s
        </label>
        <label className="flex items-center gap-1.5 text-slate-400">
          <input type="checkbox" checked={doc.loop} onChange={(e) => editor.setTiming({ loop: e.target.checked })} className="accent-violet-500" />
          Loop
        </label>
      </div>

      <div
        ref={track}
        className="relative cursor-pointer select-none rounded-md bg-slate-950 border border-slate-800"
        style={{ height: 22 + tracked.length * 18 }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          scrub(e.clientX);
        }}
        onPointerMove={(e) => e.buttons === 1 && scrub(e.clientX)}
        role="slider"
        aria-label="Playhead"
        aria-valuemin={0}
        aria-valuemax={doc.duration}
        aria-valuenow={Math.round(time)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") editor.seek(time + 100);
          if (e.key === "ArrowLeft") editor.seek(time - 100);
        }}
      >
        {Array.from({ length: 11 }, (_, i) => (
          <span key={i} className="absolute top-0 h-2 w-px bg-slate-700" style={{ left: `${i * 10}%` }} />
        ))}
        {tracked.map(([name, t], row) => (
          <div key={name} className="absolute inset-x-0" style={{ top: 18 + row * 18, height: 16 }}>
            <span className="absolute left-1 text-[10px] text-slate-500 leading-4">{name}</span>
            {t.keyframes.map((k) => (
              <span
                key={k.time}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-amber-400"
                style={{ left: pct(k.time) }}
                title={`${name} at ${formatTime(k.time)}${k.easing ? ` (${typeof k.easing === "string" ? k.easing : k.easing.type})` : ""}`}
              >
                ◆
              </span>
            ))}
          </div>
        ))}
        <span className="absolute top-0 bottom-0 w-0.5 bg-violet-400 pointer-events-none" style={{ left: pct(time) }} />
      </div>
      {tracked.length === 0 && <p className="text-xs text-slate-500">Press ◆ next to a control to keyframe it at the playhead, or turn on Record and change values while scrubbing.</p>}
    </div>
  );
}
