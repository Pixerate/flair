/**
 * Gobo: Shadertoy-style WebGL2 fragment shaders for the browser.
 *
 * - Source and controls: `parseControls`, `controlValue`, `coerceControlValue`.
 * - Compiling and drawing: `compileShader`, `drawFrame`, `wrapSource`.
 * - Running shaders: `ShaderRenderer` (a live preview), `ThumbnailPool`
 *   (many animated thumbnails on one context), `ShaderFrames` (frames at
 *   exact times, off screen).
 * - Output: `recordGif`, `standaloneHtml`.
 *
 * @packageDocumentation
 */

export {
  coerceControlValue,
  componentCount,
  controlValue,
  describeValue,
  hexToRgb,
  humanise,
  parseControls,
  rgbToHex,
  type ControlDef,
  type ControlType,
  type ControlValue,
} from "./controls.js";
export {
  BUILTIN_UNIFORMS,
  compileShader,
  createContext,
  drawFrame,
  formatCompileError,
  parseCompileLog,
  resetGlCaches,
  ShaderCompileError,
  VERTEX_SOURCE,
  wrapSource,
  type CompiledShader,
  type CompileError,
  type CompileResult,
  type FrameState,
} from "./program.js";
export { ShaderRenderer, type CompileStatus, type RendererStats } from "./renderer.js";
export {
  registerThumbnail,
  sharedThumbnailPool,
  ThumbnailPool,
  type ThumbnailHandle,
  type ThumbnailPoolOptions,
} from "./thumbnails.js";
export { ShaderFrames, type RenderOptions, type ShaderFramesOptions } from "./frames.js";
export { recordGif, type GifOptions } from "./gif.js";
export { standaloneHtml, type StandaloneOptions } from "./standalone.js";
