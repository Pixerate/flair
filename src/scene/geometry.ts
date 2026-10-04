export type Point = [number, number];

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** An element placed or animated in a scene. */
export interface SceneElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  points?: readonly (readonly [number, number])[];
  fontSize?: number;
  text?: string;
  containerId?: string | null;
  isDeleted?: boolean;
  opacity?: number;
}

/** Bounds in scene units, ignoring rotation. */
export function boundsOf(e: SceneElement): Rect {
  if (e.points?.length) {
    const xs = e.points.map((p) => e.x + p[0]);
    const ys = e.points.map((p) => e.y + p[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return {
      x,
      y,
      width: Math.max(1, Math.max(...xs) - x),
      height: Math.max(1, Math.max(...ys) - y),
    };
  }
  return { x: e.x, y: e.y, width: Math.max(1, e.width), height: Math.max(1, e.height) };
}

/** Area of the overlap of two rectangles (0 when they do not meet). */
export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

export const areaOf = (r: Rect): number => r.width * r.height;
