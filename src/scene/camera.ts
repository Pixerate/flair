import { type Rect, type SceneElement, boundsOf } from './geometry.js';

export interface Stage {
  width: number;
  height: number;
  caption?: number;
}

export const DEFAULT_STAGE: Stage = {
  width: 1920,
  height: 1080,
  caption: 0,
};

export const CAMERA_MS = 600;

/**
 * How the camera is turned in 3D, in degrees: the board is drawn flat (see
 * {@link View}), then turned round the middle of the stage and seen in
 * perspective. Each is optional and 0 (flat) by default.
 */
export interface CameraAngle {
  /** Tips the board back round its horizontal axis (CSS `rotateX`): positive leans the top away, like a desk seen from above. −75 to 75. */
  tilt?: number;
  /** Swings the board round its vertical axis (CSS `rotateY`): positive brings the left side nearer. −75 to 75. */
  turn?: number;
  /** Rolls the board round the line of sight (CSS `rotateZ`), clockwise. −180 to 180. */
  roll?: number;
  /** How far the lens sits from the board, as a multiple of the stage width (default {@link DEFAULT_PERSPECTIVE}); smaller is more dramatic. */
  perspective?: number;
}

/** The camera's default distance from the board, as a multiple of the stage width. */
export const DEFAULT_PERSPECTIVE = 1.2;

/** The largest tilt or turn, in degrees: past this the board is seen edge-on. */
export const MAX_TILT = 75;

/**
 * Camera view into the scene: drawn at (point + scroll) × zoom, then turned
 * by its {@link CameraAngle} (see {@link cameraTransform}) and blurred by
 * `blur` while the camera moves.
 */
export interface View extends CameraAngle {
  zoom: number;
  scrollX: number;
  scrollY: number;
  /** Motion blur in stage pixels, set while the camera moves (see `ShotCamera.motionBlur`); 0 or absent when still. */
  blur?: number;
  /**
   * The direction the picture streaks in, in degrees on screen (0 is
   * horizontal, 90 vertical), when the move is mostly a pan; absent when it
   * blurs every way (a zoom or a turn).
   */
  blurAngle?: number;
}

export const boardHeight = (stage: Stage): number => stage.height - (stage.caption ?? 0);

/** View with `(cx, cy)` in the middle of the board at `zoom`. */
export function viewAt(cx: number, cy: number, zoom: number, stage: Stage): View {
  return {
    zoom,
    scrollX: stage.width / (2 * zoom) - cx,
    scrollY: boardHeight(stage) / (2 * zoom) - cy,
  };
}

/** Scene point in the middle of the board. */
export function centreOf(view: View, stage: Stage): [number, number] {
  return [
    stage.width / (2 * view.zoom) - view.scrollX,
    boardHeight(stage) / (2 * view.zoom) - view.scrollY,
  ];
}

/** The view that fits `rect` on the board, centred and with its aspect kept. */
export function frame(rect: Rect, stage: Stage): View {
  if (!(rect.width > 0 && rect.height > 0)) {
    throw new Error('A camera rectangle needs a positive width and height');
  }
  const zoom = Math.min(stage.width / rect.width, boardHeight(stage) / rect.height);
  return viewAt(rect.x + rect.width / 2, rect.y + rect.height / 2, zoom, stage);
}

export interface FramingOptions {
  /** Proportional padding added to all sides (e.g., 0.15 for 15%). Default: 0.15 */
  padding?: number;
  /** Minimum width in scene units. */
  minWidth?: number;
  /** Minimum height in scene units. */
  minHeight?: number;
}

/**
 * Calculates a camera framing rectangle that encloses target elements
 * while preserving the stage aspect ratio and applying optional margin padding.
 */
export function calculateFramingRect(
  elements: readonly SceneElement[],
  stage: Stage,
  options: FramingOptions = {},
): Rect {
  const activeElements = elements.filter((e) => !e.isDeleted);
  const targetH = boardHeight(stage);
  const stageAspect = stage.width / Math.max(1, targetH);

  if (activeElements.length === 0) {
    return {
      x: 0,
      y: 0,
      width: stage.width,
      height: targetH,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of activeElements) {
    const b = boundsOf(el);
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }

  let width = maxX - minX;
  let height = maxY - minY;

  // Apply padding (default 15%)
  const padding = options.padding ?? 0.15;
  if (padding > 0) {
    const padX = width * padding;
    const padY = height * padding;
    minX -= padX;
    minY -= padY;
    width += padX * 2;
    height += padY * 2;
  }

  // Apply min dimensions
  if (options.minWidth && width < options.minWidth) {
    const diff = options.minWidth - width;
    minX -= diff / 2;
    width = options.minWidth;
  }
  if (options.minHeight && height < options.minHeight) {
    const diff = options.minHeight - height;
    minY -= diff / 2;
    height = options.minHeight;
  }

  // Preserve stage aspect ratio centered around midpoint
  const currentAspect = width / Math.max(1, height);
  if (currentAspect < stageAspect) {
    // Taller than stage: expand width
    const targetWidth = height * stageAspect;
    const diff = targetWidth - width;
    minX -= diff / 2;
    width = targetWidth;
  } else if (currentAspect > stageAspect) {
    // Wider than stage: expand height
    const targetHeight = width / stageAspect;
    const diff = targetHeight - height;
    minY -= diff / 2;
    height = targetHeight;
  }

  return {
    x: minX,
    y: minY,
    width,
    height,
  };
}

const ANGLES = ['tilt', 'turn', 'roll'] as const;

/** Whether a view is turned in 3D at all. */
export function isAngled(view: CameraAngle): boolean {
  return ANGLES.some((k) => (view[k] ?? 0) !== 0);
}

/** The view's angle with each part clamped to its range (see {@link CameraAngle}); flat parts are left out. */
export function cameraAngle(view: CameraAngle): CameraAngle {
  const out: CameraAngle = {};
  const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));
  if (view.tilt) out.tilt = clamp(view.tilt, MAX_TILT);
  if (view.turn) out.turn = clamp(view.turn, MAX_TILT);
  if (view.roll) out.roll = clamp(view.roll, 180);
  if (view.perspective !== undefined && view.perspective !== DEFAULT_PERSPECTIVE) out.perspective = Math.max(0.3, view.perspective);
  return out;
}

/**
 * The view part-way (`t` from 0 to 1) from one view to another.
 * Centre moves linearly and zoom scales exponentially for smooth motion;
 * angles and perspective move linearly.
 */
export function between(from: View, to: View, t: number, stage: Stage): View {
  const [x0, y0] = centreOf(from, stage);
  const [x1, y1] = centreOf(to, stage);
  const zoom = from.zoom * Math.pow(to.zoom / from.zoom, t);
  const view: View = viewAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, zoom, stage);
  if (!isAngled(from) && !isAngled(to) && from.perspective === to.perspective) return view;
  const lerp = (a = 0, b = 0) => a + (b - a) * t;
  return {
    ...view,
    ...cameraAngle({
      tilt: lerp(from.tilt, to.tilt),
      turn: lerp(from.turn, to.turn),
      roll: lerp(from.roll, to.roll),
      perspective: lerp(from.perspective ?? DEFAULT_PERSPECTIVE, to.perspective ?? DEFAULT_PERSPECTIVE),
    }),
  };
}

/**
 * The CSS `transform` that turns a board layer (a box the stage's size,
 * with `transform-origin` in its middle) to the view's angle, or "none" when
 * the view is flat. Zoom and scroll are not in it: draw them inside the
 * layer, as for a flat view. `width` is the layer's width on screen in CSS
 * pixels (default: the stage width).
 */
export function cameraTransform(view: View, stage: Stage, width = stage.width): string {
  if (!isAngled(view)) return 'none';
  const a = cameraAngle(view);
  const distance = (a.perspective ?? DEFAULT_PERSPECTIVE) * width;
  return `perspective(${round(distance)}px) rotateX(${round(a.tilt ?? 0)}deg) rotateY(${round(a.turn ?? 0)}deg) rotateZ(${round(a.roll ?? 0)}deg)`;
}

/**
 * The view's motion blur as standard deviations along the board layer's own
 * x and y axes, in CSS pixels at a layer `width` wide: for an SVG
 * `<feGaussianBlur stdDeviation="x y">`, so a pan streaks along its
 * direction (CSS `blur()` can only blur every way). The layer is turned
 * after it is blurred, so the direction is taken back through its roll.
 * [0, 0] when still.
 */
export function cameraBlur(view: View, stage: Stage, width = stage.width): [number, number] {
  const blur = (view.blur ?? 0) * (width / stage.width);
  if (!(blur >= 0.05)) return [0, 0];
  if (view.blurAngle === undefined) return [round(blur), round(blur)];
  const a = ((view.blurAngle - (cameraAngle(view).roll ?? 0)) * Math.PI) / 180;
  // A little blur across the streak keeps it from looking like a scanline.
  const across = blur * 0.15;
  return [round(Math.max(across, blur * Math.abs(Math.cos(a)))), round(Math.max(across, blur * Math.abs(Math.sin(a))))];
}

/** The CSS `filter` for the view's motion blur at a layer `width` CSS pixels wide (the same every way; see {@link cameraBlur} for a streak), or "none". */
export function cameraFilter(view: View, stage: Stage, width = stage.width): string {
  const blur = (view.blur ?? 0) * (width / stage.width);
  return blur >= 0.05 ? `blur(${round(blur)}px)` : 'none';
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Where a scene point lands on screen, in stage pixels from the top left of
 * the board: drawn by the view's zoom and scroll, then turned and seen in
 * perspective as {@link cameraTransform} does. Null when the point is
 * behind the camera.
 */
export function projectPoint(view: View, stage: Stage, [x, y]: readonly [number, number]): [number, number] | null {
  const cx = stage.width / 2;
  const cy = boardHeight(stage) / 2;
  let px = (x + view.scrollX) * view.zoom - cx;
  let py = (y + view.scrollY) * view.zoom - cy;
  if (!isAngled(view)) return [px + cx, py + cy];
  const a = cameraAngle(view);
  const rad = Math.PI / 180;
  // CSS applies rotateX(tilt) rotateY(turn) rotateZ(roll) right to left: roll first.
  const [sr, cr] = [Math.sin((a.roll ?? 0) * rad), Math.cos((a.roll ?? 0) * rad)];
  [px, py] = [px * cr - py * sr, px * sr + py * cr];
  const [st, ct] = [Math.sin((a.turn ?? 0) * rad), Math.cos((a.turn ?? 0) * rad)];
  let pz = -px * st;
  px = px * ct;
  const [sx, cx2] = [Math.sin((a.tilt ?? 0) * rad), Math.cos((a.tilt ?? 0) * rad)];
  [py, pz] = [py * cx2 - pz * sx, py * sx + pz * cx2];
  const distance = (a.perspective ?? DEFAULT_PERSPECTIVE) * stage.width;
  if (pz >= distance) return null;
  const k = distance / (distance - pz);
  return [cx + px * k, cy + py * k];
}

/** How far the picture moves on screen between two views: as a pan (x, y), and as zooming and turning. */
function screenMotion(from: View, to: View, stage: Stage): { dx: number; dy: number; other: number } {
  const [x0, y0] = centreOf(from, stage);
  const [x1, y1] = centreOf(to, stage);
  const zoom = Math.sqrt(from.zoom * to.zoom);
  const scale = Math.abs(Math.log(to.zoom / from.zoom)) * stage.width * 0.5;
  const turn = ANGLES.reduce((sum, k) => sum + Math.abs((to[k] ?? 0) - (from[k] ?? 0)), 0) * (stage.width / 180);
  return { dx: (x1 - x0) * zoom, dy: (y1 - y0) * zoom, other: scale + turn };
}

/**
 * Motion blur for one step of a camera move, in stage pixels: how far the
 * picture moves on screen between two views (centre, zoom and angle), times
 * `strength` (`ShotCamera.motionBlur`), capped at 40.
 */
export function motionBlur(from: View, to: View, stage: Stage, strength: number): number {
  if (!(strength > 0)) return 0;
  const { dx, dy, other } = screenMotion(from, to, stage);
  return round(Math.min(40, (Math.hypot(dx, dy) + other) * 0.35 * strength));
}

/**
 * The direction a step of a camera move streaks in, in degrees on screen
 * (0 to 180, 0 horizontal), when most of it is a pan; undefined when it is
 * mostly zooming or turning, which blurs every way.
 */
export function motionBlurAngle(from: View, to: View, stage: Stage): number | undefined {
  const { dx, dy, other } = screenMotion(from, to, stage);
  const pan = Math.hypot(dx, dy);
  if (!(pan > 0) || pan < 0.6 * (pan + other)) return undefined;
  const a = (Math.atan2(dy, dx) * 180) / Math.PI;
  return round(((a % 180) + 180) % 180);
}

/** The blur fields of a step of a camera move with this strength: `{ blur, blurAngle }`, or nothing when still. */
export function moveBlur(from: View, to: View, stage: Stage, strength: number): Pick<View, 'blur' | 'blurAngle'> {
  const blur = motionBlur(from, to, stage, strength);
  if (!(blur > 0)) return {};
  const blurAngle = motionBlurAngle(from, to, stage);
  return blurAngle === undefined ? { blur } : { blur, blurAngle };
}

/** The part of the scene the camera currently shows. */
export function visibleRect(view: View, stage: Stage): Rect {
  return {
    x: -view.scrollX,
    y: -view.scrollY,
    width: stage.width / view.zoom,
    height: boardHeight(stage) / view.zoom,
  };
}

/** Smooth cubic ease in / ease out. */
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
