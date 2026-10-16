/**
 * Node-only tools: rendering a shader, or a catalog effect applied to a
 * picture, video, SVG, words or a path, to MP4, WebM, MOV, GIF, PNG frames
 * or (vector effects) animated SVG, through headless Chrome (and ffmpeg for
 * video). Kept out of the main entry so it stays browser-safe.
 *
 * @packageDocumentation
 */

export {
  exportMotionGraphic,
  findChrome,
  ffmpegPath,
  planOutput,
  type ExportOptions,
  type OutputFormat,
  type OutputPlan,
  type PointerMode,
} from "./export/recorder.js";
export {
  exportEffect,
  nodeSubjectValues,
  vectorTimeline,
  type EffectExportOptions,
  type NodeSubject,
  type NodeSubjectValues,
} from "./export/effect.js";
