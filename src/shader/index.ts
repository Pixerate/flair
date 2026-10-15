/**
 * Shaders: Shadertoy-style WebGL2 fragment shaders for the browser.
 *
 * - Source and controls: `parseControls`, `controlValue`, `coerceControlValue`.
 * - Image controls: `sampler2D` uniforms load images through `TextureCache`.
 * - Compiling and drawing: `compileShader`, `drawFrame`, `wrapSource`.
 * - Running shaders: `ShaderRenderer` (a live preview), `ThumbnailPool`
 *   (many animated thumbnails on one context), `ShaderFrames` (frames at
 *   exact times, off screen).
 * - Output: `recordGif`, `standaloneHtml`.
 *
 * @packageDocumentation
 */

export {
  checkControlValue,
  coerceControlValue,
  componentCount,
  controlValue,
  describeValue,
  hexToRgb,
  humanise,
  imageUrls,
  isImageUrl,
  parseControls,
  rgbToHex,
  type ControlCheck,
  type ControlDef,
  type ControlType,
  type ControlValue,
  type TextureSettings,
} from "./controls.js";
export {
  applyTextureSettings,
  ImageLoadError,
  isSvgUrl,
  loadImage,
  preloadImages,
  releaseImages,
  sizeSvg,
  SVG_EDGE,
  TextureCache,
  type TextureSource,
} from "./textures.js";
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
export {
  ShaderRenderer,
  type CompileStatus,
  type RendererStats,
  type ShaderRendererOptions,
} from "./renderer.js";
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
export {
  type BlendMode,
  type ColorRgba,
  ALL_BLEND_MODES,
  blendRgba,
  getGlslBlendFunction,
} from "./blend.js";
export {
  type TransitionType,
  type TransitionOptions,
  type LinearWipeOptions,
  type RadialIrisOptions,
  type BlockDissolveOptions,
  type GridWipeOptions,
  type GlassWipeOptions,
  type TwisterOptions,
  type LightLeakOptions,
  type CrossZoomOptions,
  type TransitionSample,
  ALL_TRANSITION_TYPES,
  sampleTransition,
  blendTransitionPixel,
  getTransitionGLSL,
} from "./transition.js";
export {
  type ColorRGB,
  type ColorRGBA,
  type ColorSpace,
  type AscCdl,
  type LiftGammaGain,
  srgbToLinear,
  linearToSrgb,
  srgbToLinearRgb,
  linearRgbToSrgb,
  linearSrgbToOklab,
  oklabToLinearSrgb,
  srgbToOklab,
  oklabToSrgb,
  oklabToOklch,
  oklchToOklab,
  interpolateOklab,
  interpolateOklch,
  convertColorSpace,
  applyAscCdl,
  applyLiftGammaGain,
  applyVibrance,
  getWhiteBalanceGains,
  getOklabGLSL,
  getColorGradingGLSL,
} from "./color.js";


