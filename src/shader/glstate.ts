/**
 * Saving and restoring the WebGL state Flair's drawing touches, so a
 * pipeline can render in a context someone else owns (an editor's canvas, a
 * compositor) and leave it as it found it.
 */

/** Texture units whose 2D bindings are saved: Flair binds at most this many at once (image controls, plus its own). */
const SAVED_UNITS = 16;

/** What `saveGlState` took, to put back with `restoreGlState`. */
export interface GlState {
  drawFramebuffer: WebGLFramebuffer | null;
  readFramebuffer: WebGLFramebuffer | null;
  viewport: Int32Array;
  program: WebGLProgram | null;
  activeTexture: number;
  textures: (WebGLTexture | null)[];
  vertexArray: WebGLVertexArrayObject | null;
  blend: boolean;
  blendFunc: [number, number, number, number];
  enabled: Record<number, boolean>;
  colorMask: boolean[];
  clearColor: Float32Array;
  flipY: boolean;
  premultiply: boolean;
}

/**
 * Takes the state Flair changes, and sets what its drawing needs: no
 * vertex array, no scissor, depth, stencil or culling, every colour channel
 * written, no blending.
 */
export function saveGlState(gl: WebGL2RenderingContext): GlState {
  const activeTexture = gl.getParameter(gl.ACTIVE_TEXTURE) as number;
  const textures: (WebGLTexture | null)[] = [];
  for (let unit = 0; unit < SAVED_UNITS; unit++) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    textures.push(gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null);
  }
  gl.activeTexture(activeTexture);
  const caps = [gl.SCISSOR_TEST, gl.DEPTH_TEST, gl.STENCIL_TEST, gl.CULL_FACE, gl.BLEND];
  const state: GlState = {
    drawFramebuffer: gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null,
    readFramebuffer: gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null,
    viewport: gl.getParameter(gl.VIEWPORT) as Int32Array,
    program: gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null,
    activeTexture,
    textures,
    vertexArray: gl.getParameter(gl.VERTEX_ARRAY_BINDING) as WebGLVertexArrayObject | null,
    blend: gl.isEnabled(gl.BLEND),
    blendFunc: [gl.BLEND_SRC_RGB, gl.BLEND_DST_RGB, gl.BLEND_SRC_ALPHA, gl.BLEND_DST_ALPHA].map((p) => gl.getParameter(p) as number) as GlState["blendFunc"],
    enabled: Object.fromEntries(caps.map((cap) => [cap, gl.isEnabled(cap)])),
    colorMask: gl.getParameter(gl.COLOR_WRITEMASK) as boolean[],
    clearColor: gl.getParameter(gl.COLOR_CLEAR_VALUE) as Float32Array,
    flipY: gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL) as boolean,
    premultiply: gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL) as boolean,
  };
  gl.bindVertexArray(null);
  for (const cap of caps) gl.disable(cap);
  gl.colorMask(true, true, true, true);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  return state;
}

/** Puts back what `saveGlState` took. */
export function restoreGlState(gl: WebGL2RenderingContext, state: GlState) {
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, state.drawFramebuffer);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, state.readFramebuffer);
  const [x, y, w, h] = state.viewport;
  gl.viewport(x!, y!, w!, h!);
  gl.useProgram(state.program);
  state.textures.forEach((texture, unit) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
  });
  gl.activeTexture(state.activeTexture);
  gl.bindVertexArray(state.vertexArray);
  for (const [cap, on] of Object.entries(state.enabled)) (on ? gl.enable : gl.disable).call(gl, Number(cap));
  gl.blendFuncSeparate(...state.blendFunc);
  const [r, g, b, a] = state.colorMask;
  gl.colorMask(r!, g!, b!, a!);
  const [cr, cg, cb, ca] = state.clearColor;
  gl.clearColor(cr!, cg!, cb!, ca!);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, state.flipY);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, state.premultiply);
}
