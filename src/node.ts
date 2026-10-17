/**
 * Node-only tools: rendering a shader, or a catalog effect applied to a
 * picture, video, SVG, words or a path, to MP4, WebM, MOV, GIF, PNG frames
 * or (vector effects) animated SVG, through headless Chrome (and ffmpeg for
 * video). Kept out of the main entry so it stays browser-safe.
 *
 * @packageDocumentation
 */

export {
  chromeArgs,
  exportMotionGraphic,
  findChrome,
  ffmpegPath,
  planOutput,
  runRender,
  type ExportOptions,
  type OutputFormat,
  type OutputPlan,
  type PointerMode,
  type RenderJob,
} from "./export/recorder.js";
export {
  exportEffect,
  nodeSubjectValues,
  probeVideo,
  vectorTimeline,
  videoSeconds,
  type EffectExportOptions,
  type NodeSubject,
  type NodeSubjectValues,
  type VideoProbe,
} from "./export/effect.js";
