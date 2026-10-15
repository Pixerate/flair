import type { SvgBox } from './motion.js';

export type BoxFit = 'fill' | 'contain' | 'cover' | 'none' | 'scale-down';

export type BoxAlignment =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'centerLeft'
  | 'center'
  | 'centerRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight';

export interface FittedBoxResult {
  box: SvgBox;
  scaleX: number;
  scaleY: number;
  dx: number;
  dy: number;
}

const ALIGN_FACTORS: Record<BoxAlignment, [number, number]> = {
  topLeft: [0, 0],
  topCenter: [0.5, 0],
  topRight: [1, 0],
  centerLeft: [0, 0.5],
  center: [0.5, 0.5],
  centerRight: [1, 0.5],
  bottomLeft: [0, 1],
  bottomCenter: [0.5, 1],
  bottomRight: [1, 1],
};

/**
 * Calculates scaling and translation to fit a source bounding box inside a destination bounding box.
 * Pure 2D math without DOM dependencies, matching Rive/Flutter BoxFit & Alignment semantics.
 */
export function computeBoxFit(
  src: SvgBox,
  dst: SvgBox,
  fit: BoxFit = 'contain',
  alignment: BoxAlignment = 'center',
): FittedBoxResult {
  const [, , srcW, srcH] = src;
  const [dstX, dstY, dstW, dstH] = dst;

  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
    return { box: dst, scaleX: 1, scaleY: 1, dx: 0, dy: 0 };
  }

  let scaleX = dstW / srcW;
  let scaleY = dstH / srcH;

  switch (fit) {
    case 'fill':
      break;
    case 'contain': {
      const s = Math.min(scaleX, scaleY);
      scaleX = s;
      scaleY = s;
      break;
    }
    case 'cover': {
      const s = Math.max(scaleX, scaleY);
      scaleX = s;
      scaleY = s;
      break;
    }
    case 'none':
      scaleX = 1;
      scaleY = 1;
      break;
    case 'scale-down': {
      const s = Math.min(1, Math.min(scaleX, scaleY));
      scaleX = s;
      scaleY = s;
      break;
    }
  }

  const fittedW = srcW * scaleX;
  const fittedH = srcH * scaleY;

  const [alignX, alignY] = ALIGN_FACTORS[alignment] ?? [0.5, 0.5];
  const outX = dstX + (dstW - fittedW) * alignX;
  const outY = dstY + (dstH - fittedH) * alignY;

  const dx = outX - src[0] * scaleX;
  const dy = outY - src[1] * scaleY;

  return {
    box: [outX, outY, fittedW, fittedH],
    scaleX,
    scaleY,
    dx,
    dy,
  };
}

export interface StackLayoutOptions {
  direction?: 'row' | 'column';
  gap?: number;
  padding?: number;
  startX?: number;
  startY?: number;
}

/**
 * Lays out sequential bounding boxes along a row or column with spacing and padding.
 */
export function layoutStack(
  sizes: readonly { width: number; height: number }[],
  options: StackLayoutOptions = {},
): SvgBox[] {
  const direction = options.direction ?? 'column';
  const gap = options.gap ?? 0;
  const padding = options.padding ?? 0;
  let currentX = (options.startX ?? 0) + padding;
  let currentY = (options.startY ?? 0) + padding;

  const boxes: SvgBox[] = [];

  for (const item of sizes) {
    boxes.push([currentX, currentY, item.width, item.height]);
    if (direction === 'row') {
      currentX += item.width + gap;
    } else {
      currentY += item.height + gap;
    }
  }

  return boxes;
}
