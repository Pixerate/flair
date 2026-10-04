/**
 * Time source for generative animations and playback.
 * By default that is real time (animation frames and timers).
 * A ManualClock instead moves only when told to, enabling frame-exact
 * rendering, video recording, scrubbing, or fast simulation without waiting.
 */
export interface Clock {
  /** Current time in milliseconds. */
  now(): number;
  /** Resolves on the next frame. */
  frame(): Promise<void>;
  /** Resolves after `ms` milliseconds of this clock's time. */
  sleep(ms: number): Promise<void>;
  /**
   * Whether the clock follows wall time. Live clocks stop when the tab is in
   * the background (browsers pause animation frames there).
   */
  readonly live: boolean;
}

export const pageHidden = (): boolean =>
  typeof document !== 'undefined' && document.hidden;

export const realClock: Clock = {
  live: true,
  now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  frame: () =>
    new Promise<void>((resolve) =>
      typeof requestAnimationFrame === 'function' && !pageHidden()
        ? requestAnimationFrame(() => resolve())
        : setTimeout(resolve, 16),
    ),
  sleep: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
};

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * A clock that only moves when {@link advance} or {@link tick} is called.
 * Each call fires the sleeps that fall due, in order, letting awaiting code
 * run before the next sleep fires, then resolves pending frames.
 */
export class ManualClock implements Clock {
  readonly live = false;
  private time: number;
  private frames: (() => void)[] = [];
  private sleepers: { at: number; seq: number; resolve: () => void }[] = [];
  private seq = 0;

  constructor(start = 0) {
    this.time = start;
  }

  now(): number {
    return this.time;
  }

  frame(): Promise<void> {
    return new Promise((resolve) => this.frames.push(resolve));
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) =>
      this.sleepers.push({ at: this.time + Math.max(0, ms), seq: this.seq++, resolve }),
    );
  }

  get pending(): boolean {
    return this.frames.length > 0 || this.sleepers.length > 0;
  }

  async advance(ms: number): Promise<void> {
    const end = this.time + Math.max(0, ms);
    await settle();
    for (;;) {
      let next: (typeof this.sleepers)[number] | undefined;
      for (const s of this.sleepers)
        if (s.at <= end && (!next || s.at < next.at || (s.at === next.at && s.seq < next.seq)))
          next = s;
      if (!next) break;
      this.sleepers.splice(this.sleepers.indexOf(next), 1);
      this.time = Math.max(this.time, next.at);
      next.resolve();
      await settle();
    }
    this.time = end;
    const frames = this.frames;
    this.frames = [];
    for (const resolve of frames) resolve();
    await settle();
  }

  tick(fps = 60): Promise<void> {
    return this.advance(1000 / fps);
  }
}

/**
 * A repeatable pseudo-random number in [0, 1) for a key and index.
 * Useful for deterministic, reproducible animations.
 */
export function jitter(key: string, n: number): number {
  let h = 2166136261 ^ n;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}
