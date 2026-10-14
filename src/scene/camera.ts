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

/** Camera view into the scene: drawn at (point + scroll) × zoom. */
export interface View {
  zoom: number;
  scrollX: number;
  scrollY: number;
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

/**
 * The view part-way (`t` from 0 to 1) from one view to another.
 * Centre moves linearly and zoom scales exponentially for smooth motion.
 */
export function between(from: View, to: View, t: number, stage: Stage): View {
  const [x0, y0] = centreOf(from, stage);
  const [x1, y1] = centreOf(to, stage);
  const zoom = from.zoom * Math.pow(to.zoom / from.zoom, t);
  return viewAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, zoom, stage);
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
