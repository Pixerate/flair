/**
 * A UI-agnostic, agent-ready effect editor, built on `@pixerate/editor`'s
 * undo history and command registry.
 *
 * - Documents: `EffectDocument`, `createEffectDocument`, `valuesAt`,
 *   `motionAt`, `documentIssues`, `parseEffectDocument`.
 * - Keyframes: `Track`, `Keyframe`, `Easing`, `evaluateTrack`.
 * - Editing: `EffectEditor` / `createEffectEditor` (state, undo, playhead,
 *   commands), bound to a preview with `bindShaderRenderer` or `bindSvgView`.
 * - Agents: `createEffectToolProvider`, `callTool`, `toolDefinitions`,
 *   `EFFECT_AGENT_INSTRUCTIONS`. The model is the host's to provide.
 *
 * Needs `@pixerate/editor` (an optional peer dependency of Flair).
 *
 * @packageDocumentation
 */

export {
  createEffectDocument,
  documentControls,
  documentIssues,
  motionAt,
  parseEffectDocument,
  valuesAt,
  type EffectDocument,
  type EffectSource,
} from "./document.js";
export {
  cubicBezierAt,
  EASING_PRESETS,
  evaluateEasing,
  evaluateTrack,
  interpolateControlValue,
  isEasing,
  keyframeTimes,
  normalizeKeyframes,
  type CubicBezierEasing,
  type Easing,
  type EasingPreset,
  type Keyframe,
  type SpringEasing,
  type Track,
} from "./timeline.js";
export {
  createEffectEditor,
  EffectEditor,
  type CompileReport,
  type EditResult,
  type EffectEditorOptions,
  type EffectEditorState,
} from "./editor.js";
export { describeEditor, effectCommands } from "./commands.js";
export {
  callTool,
  createEffectToolProvider,
  EFFECT_AGENT_INSTRUCTIONS,
  toolDefinitions,
  type EffectToolProviderOptions,
} from "./agent.js";
export { bindShaderRenderer, bindSvgView, type ShaderPreview } from "./bind.js";
