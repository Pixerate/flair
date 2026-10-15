import { useSyncExternalStore } from "react";
import type { EffectEditor, EffectEditorState } from "@pixerate/flair/editor";

/** The editor's state, re-rendering on every change (`getState` is stable between changes). */
export function useEditorState(editor: EffectEditor): EffectEditorState {
  return useSyncExternalStore(
    (onChange) => editor.subscribe(onChange),
    () => editor.getState(),
  );
}

/** "1.25 s" from ms. */
export function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(2)} s`;
}
