/**
 * Scrolling as shaders see it: `iScroll`, a `vec4` of
 * - x: the canvas's progress through the viewport, 0 when its top meets the
 *   viewport's bottom, 1 when its bottom leaves the top;
 * - y: the page's scroll, as a share of how far it can scroll;
 * - z: scroll velocity in viewport heights per second (positive scrolling
 *   down, smoothed);
 * - w: 1 while scrolling, easing back to 0 after.
 *
 * Where nothing scrolls it (thumbnails, recordings without a script) it is
 * all zero, and scroll effects play an idle demo.
 */

/** Seconds the velocity takes to follow a change (most of the way). */
export const SCROLL_SMOOTHING = 0.12;

/** Seconds `iScroll.w` takes to ease back to 0 once scrolling stops. */
export const SCROLL_SETTLE = 0.4;

const clamp01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x);
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/**
 * An element's progress through the viewport: 0 when its top meets the
 * viewport's bottom, 1 when its bottom leaves the top, from its box (as
 * `getBoundingClientRect` gives it) and the viewport's height.
 */
export function viewportProgress(top: number, height: number, viewport: number): number {
  const travel = viewport + height;
  return travel > 0 ? clamp01((viewport - top) / travel) : 0;
}

/**
 * Follows one element's scrolling for `iScroll`: feed it where the element
 * is at each frame, with a steady clock in seconds, and read the uniform.
 * The same positions at the same times always give the same uniform.
 */
export class ScrollTracker {
  private progress = 0;
  private page = 0;
  private offset: number | undefined;
  private last: number | undefined;
  private velocity = 0;
  private movedAt = -Infinity;
  private seen = false;

  /**
   * Where things are at `time` seconds: the element's `progress` (see
   * {@link viewportProgress}), the page's scroll share, and the element's
   * top in viewport heights (from which the velocity comes; any steady
   * measure that grows as the page scrolls down will do).
   */
  sample(progress: number, page: number, offset: number, time: number) {
    const dt = this.last === undefined ? 0 : time - this.last;
    if (this.offset !== undefined && dt > 0) {
      const moved = offset - this.offset;
      const speed = moved / dt;
      this.velocity += (speed - this.velocity) * (1 - Math.exp(-dt / SCROLL_SMOOTHING));
      if (Math.abs(moved) > 1e-6) this.movedAt = time;
    }
    if (this.offset !== undefined && Math.abs(offset - this.offset) > 1e-6 && dt <= 0) this.movedAt = time;
    this.progress = clamp01(progress);
    this.page = clamp01(page);
    this.offset = offset;
    this.last = time;
    this.seen = true;
  }

  /** Whether scrolling has settled (nothing more to animate until it moves). */
  settled(time: number): boolean {
    return time - this.movedAt > SCROLL_SETTLE && Math.abs(this.velocity) < 2e-3;
  }

  /** `iScroll` at `time` (all zero before the first sample). */
  scroll(time: number): [number, number, number, number] {
    if (!this.seen) return [0, 0, 0, 0];
    const active = 1 - smooth((time - this.movedAt) / SCROLL_SETTLE);
    // A sliver above 0, so a measured page never reads as "nothing scrolls it".
    return [Math.max(this.progress, 1e-4), this.page, Math.abs(this.velocity) < 2e-3 ? 0 : this.velocity, active];
  }

  /** Forgets the velocity and activity (when the page jumps, say). */
  clear() {
    this.velocity = 0;
    this.movedAt = -Infinity;
    this.offset = undefined;
    this.last = undefined;
  }
}
