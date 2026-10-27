/**
 * A UI-agnostic, agent-ready effect editor, built on `@pixerate/editor`'s
 * undo history and command registry.
 *
 * - Documents: `EffectDocument`, `createEffectDocument`, `valuesAt`,
 *   `motionAt`, `documentIssues`, `parseEffectDocument`.
 * - Keyframes: `Track`, `Keyframe`, `Easing`, `evaluateTrack`.
 * - Editing: `EffectEditor` / `createEffectEditor` (state, undo, playhead,
 *   commands), bound to a preview with `bindShaderRenderer` or `bindSvgView`.
 * - Animations: `effectDocumentFromAnimation` and `EffectEditor.loadAnimation`
 *   open scenes from `@pixerate/editor`'s animation editor as vector effects.
 * - Parameter panels: `parameterSchemaFor` and `bindEffectParameters` drive
 *   `@pixerate/editor/parameters` (and its React and Svelte panels).
 * - Agents: `createEffectToolRegistry`, `createEffectToolProvider`,
 *   `callTool`, `toolDefinitions`, `EFFECT_AGENT_INSTRUCTIONS`. The model is
 *   the host's to provide.
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
export { EFFECT_DOCUMENT_SCHEMA } from "./schema.js";
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
  type ValueEditOptions,
  type EffectEditorOptions,
  type EffectEditorState,
} from "./editor.js";
export { CATALOG_SEARCH_LIMIT, describeEditor, effectCommands } from "./commands.js";
export {
  callTool,
  createEffectToolProvider,
  createEffectToolRegistry,
  EFFECT_AGENT_INSTRUCTIONS,
  toolDefinitions,
  type EffectToolProviderOptions,
} from "./agent.js";
export { bindShaderRenderer, bindSvgView, type ShaderPreview } from "./bind.js";
export { effectDocumentFromAnimation, type AnimationImport, type AnimationImportOptions, type MotionScene } from "./animation.js";
export {
  bindEffectParameters,
  parameterFieldFor,
  parameterSchemaFor,
  toParameterValue,
  toParameterValues,
  type EffectParameterOptions,
  type EffectParametersBinding,
} from "./parameters.js";
