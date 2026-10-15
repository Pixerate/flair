import { hexToRgb, rgbToHex, type ControlDef, type ControlValue } from "@pixerate/flair";
import { SAMPLE_IMAGES } from "@pixerate/flair/catalog";
import type { EffectEditor, EffectEditorState } from "@pixerate/flair/editor";

const IMAGES = Object.entries(SAMPLE_IMAGES).map(([name, url]) => ({ name, url }));

function NumberInput({ control, value, onChange }: { control: ControlDef; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={control.min}
        max={control.max}
        step={control.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 min-w-0"
        aria-label={control.label}
      />
      <input
        type="number"
        min={control.min}
        max={control.max}
        step={control.step}
        value={+value.toFixed(3)}
        onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value))}
        className="w-16 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-xs tabular-nums"
        aria-label={`${control.label} value`}
      />
    </div>
  );
}

function ControlInput({ control, value, onChange }: { control: ControlDef; value: ControlValue; onChange: (v: unknown) => void }) {
  if (control.type === "bool")
    return <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-violet-500" aria-label={control.label} />;
  if (control.type === "sampler2D") {
    const url = String(value);
    return (
      <div className="space-y-1.5">
        <div className="flex gap-1.5">
          {IMAGES.map((img) => (
            <button
              key={img.name}
              onClick={() => onChange(img.url)}
              className={`h-9 w-14 rounded overflow-hidden border ${url === img.url ? "border-violet-500" : "border-slate-700"}`}
              title={img.name}
            >
              <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
        <input
          defaultValue={url.startsWith("data:") ? "" : url}
          onKeyDown={(e) => e.key === "Enter" && onChange((e.target as HTMLInputElement).value)}
          placeholder="Image URL, then Enter"
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          aria-label={`${control.label} URL`}
        />
      </div>
    );
  }
  if (control.color && Array.isArray(value))
    return (
      <div className="flex items-center gap-2">
        <input type="color" value={rgbToHex(value)} onChange={(e) => onChange(hexToRgb(e.target.value))} className="h-7 w-10 rounded bg-transparent" aria-label={control.label} />
        <code className="text-xs text-slate-400">{rgbToHex(value)}</code>
      </div>
    );
  if (Array.isArray(value))
    return (
      <div className="space-y-1">
        {value.map((v, i) => (
          <NumberInput key={i} control={{ ...control, label: `${control.label} ${"xyzw"[i]}` }} value={v} onChange={(n) => onChange(value.map((x, j) => (j === i ? n : x)))} />
        ))}
      </div>
    );
  return <NumberInput control={control} value={Number(value)} onChange={onChange} />;
}

/** One row per control, generated from the effect's control definitions. */
export function ControlsPanel({ editor, state }: { editor: EffectEditor; state: EffectEditorState }) {
  const { controls, values, document: doc, time } = state;
  if (controls.length === 0) return <p className="text-sm text-slate-400">This effect has no controls.</p>;
  return (
    <div className="space-y-3">
      {controls.map((control) => {
        const track = doc.tracks[control.name];
        const onKey = track?.keyframes.some((k) => Math.abs(k.time - time) < 1);
        return (
          <div key={control.name}>
            <div className="mb-1 flex items-center gap-2 text-sm">
              <button
                onClick={() => (onKey ? editor.removeKeyframe(control.name, time) : editor.setKeyframe(control.name, time))}
                className={`text-xs leading-none ${onKey ? "text-amber-400" : track ? "text-amber-400/50" : "text-slate-600 hover:text-slate-300"}`}
                title={onKey ? "Delete keyframe here" : "Keyframe at the playhead"}
                aria-label={`${onKey ? "Delete" : "Add"} keyframe for ${control.label}`}
              >
                ◆
              </button>
              <span className="text-slate-200">{control.label}</span>
              <code className="ml-auto text-[11px] text-slate-500">{control.name}</code>
            </div>
            <ControlInput control={control} value={values[control.name]!} onChange={(v) => editor.setValue(control.name, v)} />
          </div>
        );
      })}
    </div>
  );
}
