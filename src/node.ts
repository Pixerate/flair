/**
 * Node-only tools: rendering a shader, or a catalog effect applied to a
 * picture, video, SVG, words or a path, to MP4, WebM, MOV, GIF, PNG frames
 * or (vector effects) animated SVG, through headless Chrome (and ffmpeg for
 * video). Kept out of the main entry so it stays browser-safe.
 *
 * @packageDocumentation
 */

export {
  BACKDROP_FITS,
  chromeArgs,
  exportMotionGraphic,
  findChrome,
  ffmpegPath,
  planOutput,
  runRender,
  type BackdropFit,
  type ExportOptions,
  type OutputFormat,
  type OutputPlan,
  type PointerMode,
  type RenderJob,
} from "./export/recorder.js";
export {
  backdropSize,
  checkRegion,
  effectFrameSize,
  exportEffect,
  exportEffectBuffer,
  imageNaturalSize,
  nodeSubjectValues,
  probeVideo,
  vectorTimeline,
  videoSeconds,
  type EffectBufferBackdrop,
  type EffectBufferExportOptions,
  type EffectBufferExportResult,
  type EffectBufferSubject,
  type EffectExportOptions,
  type EffectRegion,
  type NodeSubject,
  type NodeSubjectValues,
  type VideoProbe,
} from "./export/effect.js";
export { checkShutter, FrameAverager, shutterTimes, DEFAULT_SHUTTER_SAMPLES, type Shutter, type ShutterOptions } from "./export/shutter.js";
