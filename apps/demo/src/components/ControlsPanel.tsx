import { useEffect, useState } from "react";
import { ParametersPanel } from "@pixerate/editor-react/parameters";
import type { ParametersController } from "@pixerate/editor/parameters";
import { SAMPLE_IMAGES } from "@pixerate/flair/catalog";
import { bindEffectParameters, type EffectEditor } from "@pixerate/flair/editor";

const IMAGES = Object.entries(SAMPLE_IMAGES).map(([label, url]) => ({ url, label }));

/**
 * The effect's controls as `@pixerate/editor`'s parameters panel. The binding
 * sends every change (and keyframe diamond) to the effect editor, which owns
 * the undo history, so the panel's own toolbar and presets are off.
 */
export function ControlsPanel({ editor }: { editor: EffectEditor }) {
  const [controller, setController] = useState<ParametersController | null>(null);
  useEffect(() => {
    const binding = bindEffectParameters(editor, { images: IMAGES });
    setController(binding.controller);
    return () => binding.dispose();
  }, [editor]);
  if (!controller) return null;
  return (
    <ParametersPanel
      controller={controller}
      showToolbar={false}
      showPresets={false}
      showKeyframes
      showFieldReset
      emptyMessage={<p className="text-sm text-slate-400">This effect has no controls.</p>}
    />
  );
}
