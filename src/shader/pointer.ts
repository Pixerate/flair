/**
 * The pointer as shaders see it, beyond Shadertoy's `iMouse`: where it is
 * while it is over the canvas, how hovered the canvas is (eased in and out),
 * how long it has been pressed, and the last few clicks, so effects can
 * answer hovers, presses and taps. Times are in `iTime` seconds, so a
 * recording can script them (see `ShaderFrames`' `pointer` and `clicks`).
 */

/** How many clicks `iClicks` holds; older ones drop off. */
export const MAX_CLICKS = 8;

/** How long hovering eases in or out, in seconds. */
export const HOVER_SECONDS = 0.25;

/** A click: where (pixels from the bottom left, like `iMouse`) and when (`iTime` seconds). */
export interface ShaderClick {
  x: number;
  y: number;
  time: number;
}

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/**
 * `iClicks` from a list of clicks, newest first: `vec4(x, y, time, 1)` for
 * each click at or before `time`, zeros for the rest.
 */
export function clicksUniform(clicks: readonly ShaderClick[], time: number): Float32Array {
  const out = new Float32Array(MAX_CLICKS * 4);
  let i = 0;
  for (let k = clicks.length - 1; k >= 0 && i < MAX_CLICKS; k--) {
    const c = clicks[k]!;
    if (c.time > time) continue;
    out.set([c.x, c.y, c.time, 1], i * 4);
    i++;
  }
  return out;
}

/**
 * Follows one canvas's pointer for `iPointer` and `iClicks`: feed it pointer
 * events with the `iTime` they happen at, and read the uniforms for a frame.
 */
export class PointerTracker {
  private x = 0;
  private y = 0;
  private over = false;
  private hoverFrom = 0;
  private changedAt = -Infinity;
  private pressedAt: number | null = null;
  private releasedAt: number | null = null;
  private clicks: ShaderClick[] = [];

  /** The pointer moved to (x, y), in pixels from the bottom left. */
  move(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  /** The pointer came over the canvas (`true`) or left it. */
  hover(over: boolean, time: number) {
    if (over === this.over) return;
    this.hoverFrom = this.hovered(time);
    this.changedAt = time;
    this.over = over;
  }

  /** A press at (x, y): counts as a click. */
  down(x: number, y: number, time: number) {
    this.move(x, y);
    this.pressedAt = time;
    this.clicks.push({ x, y, time });
    if (this.clicks.length > MAX_CLICKS) this.clicks.shift();
  }

  up(time: number) {
    if (this.pressedAt !== null) this.releasedAt = time;
    this.pressedAt = null;
  }

  /** Forgets clicks and presses (when time jumps back, say). */
  clear() {
    this.clicks = [];
    this.pressedAt = null;
    this.releasedAt = null;
  }

  /** How hovered the canvas is at `time`, 0–1, eased. */
  hovered(time: number): number {
    const t = smooth((time - this.changedAt) / HOVER_SECONDS);
    return this.hoverFrom + ((this.over ? 1 : 0) - this.hoverFrom) * t;
  }

  /**
   * `iPointer` at `time`: x, y, how hovered (0–1), and the press: seconds
   * held while pressed, minus the seconds since it was let go after, 0
   * before the first press.
   */
  pointer(time: number): [number, number, number, number] {
    let press = 0;
    if (this.pressedAt !== null) press = Math.max(0, time - this.pressedAt);
    else if (this.releasedAt !== null) press = -Math.max(1e-3, time - this.releasedAt);
    return [this.x, this.y, this.hovered(time), press];
  }

  /** `iClicks` at `time` (see {@link clicksUniform}). */
  clicksAt(time: number): Float32Array {
    return clicksUniform(this.clicks, time);
  }
}
