/**
 * Keeps a preview in step with an editor: the editor owns the playhead and
 * the values; the preview draws what it is told.
 */

import type { ControlValue } from "../shader/controls.js";
import type { CompileStatus } from "../shader/renderer.js";
import { svgView, type SvgView } from "../vector/svg.js";
import { motionAt } from "./document.js";
import type { EffectEditor, EffectEditorState } from "./editor.js";

/** What {@link bindShaderRenderer} needs of a renderer (`ShaderRenderer` fits). */
export interface ShaderPreview {
  setSource(source: string): CompileStatus;
  setValues(values: Record<string, ControlValue> | undefined): void;
  /** Seconds. */
  seek(time: number): void;
  pause(): void;
}

/**
 * Drives a shader preview from the editor: the source (reporting compile
 * results back), the values at the playhead, and the time. The renderer is
 * paused so the editor's playhead is the only clock. Returns an unbind
 * function.
 */
export function bindShaderRenderer(editor: EffectEditor, renderer: ShaderPreview): () => void {
  let source: string | undefined;
  renderer.pause();
  const sync = (state: EffectEditorState) => {
    const effect = state.document.effect;
    if (effect.kind !== "shader") return;
    if (effect.source !== source) {
      source = effect.source;
      editor.reportCompile(renderer.setSource(source));
    }
    renderer.setValues(state.values);
    renderer.seek(state.time / 1000);
  };
  sync(editor.getState());
  return editor.subscribe(sync);
}

/**
 * Draws a vector effect into `container` from the editor: the picture with
 * the values at the playhead, at the playhead's time. Returns an unbind
 * function, which also removes the picture.
 */
export function bindSvgView(editor: EffectEditor, container: HTMLElement): () => void {
  let view: SvgView | undefined;
  let key: string | undefined;
  const sync = (state: EffectEditorState) => {
    const motion = motionAt(state.document, state.time);
    if (!motion) {
      view?.element.remove();
      view = undefined;
      key = undefined;
      return;
    }
    const next = JSON.stringify(motion);
    if (next !== key) {
      key = next;
      view?.element.remove();
      view = svgView(motion);
      container.appendChild(view.element);
    }
    view!.draw(state.time);
  };
  sync(editor.getState());
  const unsubscribe = editor.subscribe(sync);
  return () => {
    unsubscribe();
    view?.element.remove();
  };
}
