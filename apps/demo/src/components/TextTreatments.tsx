import { useEffect, useRef, useState } from "react";
import { textTreatments, type TextTreatmentEffect } from "@pixerate/flair/catalog";
import { previewTextTreatment, type TreatmentPreview } from "@pixerate/flair/embed";

/** One treatment playing the gallery's scripted edit: check a sentence, fix two words. */
function TreatmentCard({ effect, color, nameTag, reduced }: { effect: TextTreatmentEffect; color: string | undefined; nameTag: boolean; reduced: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const preview = useRef<TreatmentPreview | undefined>(undefined);
  useEffect(() => {
    preview.current = previewTextTreatment(host.current!, effect, { reducedMotion: reduced ? "always" : "user" });
    return () => preview.current!.dispose();
  }, [effect, reduced]);
  useEffect(() => {
    preview.current?.setValues({ nameTag, ...(color ? { color } : {}) });
  }, [color, nameTag, reduced]);
  return (
    <figure className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div ref={host} className="bg-white text-slate-900 text-[15px] min-h-[8.5rem] pt-5" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }} />
      <figcaption className="p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-medium text-slate-100">{effect.name}</h3>
          <code className="text-[11px] text-slate-500">{effect.id}</code>
        </div>
        <p className="mt-1 text-sm text-slate-400">{effect.description}</p>
      </figcaption>
    </figure>
  );
}

/**
 * Every text treatment playing the same scripted edit on a paragraph, side by side, with the
 * agent's colour, its name tag and Reduce Motion to try.
 */
export function TextTreatments() {
  const [color, setColor] = useState<string | undefined>(undefined);
  const [nameTag, setNameTag] = useState(true);
  const [reduced, setReduced] = useState(false);
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4" aria-labelledby="text-treatments">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="text-treatments" className="text-lg font-semibold">
            Text treatments
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            How an agent's edits look over someone's text: checking a sentence, selecting a word, typing over it, the change landing, and its caret. Each draws
            from the host's line rectangles, never changing the text, and draws the same layers on the web and in Swift.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
          <label className="flex items-center gap-2">
            Agent colour
            <input type="color" value={color ?? "#af52de"} onChange={(e) => setColor(e.target.value)} className="h-7 w-10 rounded border border-slate-700 bg-transparent" />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={nameTag} onChange={(e) => setNameTag(e.target.checked)} /> Name tag
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} /> Reduce Motion
          </label>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {textTreatments.map((t) => (
          <TreatmentCard key={t.id} effect={t} color={color} nameTag={nameTag} reduced={reduced} />
        ))}
      </div>
      <pre className="overflow-x-auto rounded-lg bg-slate-950 border border-slate-800 p-3 text-sm text-slate-300">
        <code>{`import { mountTextTreatment, rangeRects, caretAt } from "@pixerate/flair/embed";

const overlay = mountTextTreatment(editor, "soft-sweep", { values: { color: "#af52de" } });
const caret = overlay.play("caret", () => ({ caret: caretAt(node, offset, editor), label: "Partner" }));
await overlay.play("checking", { lines: rangeRects(sentence, editor) }).finished;`}</code>
      </pre>
    </section>
  );
}
