import type { Rect } from './geometry.js';

export interface EffectBase {
  /** Unique identifier for the effect so it can be stopped or updated. */
  id: string;
  /** End the effect when this many subsequent shots begin. */
  shots?: number;
  /** Duration in milliseconds after which the effect stops automatically. */
  duration?: number;
  /** When to start: 'start' of shot or after commands are 'drawn'. Default: 'drawn'. */
  at?: 'start' | 'drawn';
}

export interface GradientEffect extends EffectBase {
  type: 'gradient';
  colors: string[];
  rect?: Rect;
  ids?: string[];
  angle?: number;
  period?: number;
  opacity?: number;
}

export interface FlowEffect extends EffectBase {
  type: 'flow';
  along: string;
  color?: string;
  dots?: number;
  period?: number;
  size?: number;
  direction?: 'forward' | 'back' | 'both';
  label?: string;
}

export interface GlowEffect extends EffectBase {
  type: 'glow';
  ids: string[];
  color?: string;
  size?: number;
  pulse?: boolean;
}

export interface SpotlightEffect extends EffectBase {
  type: 'spotlight';
  ids: string[];
  dim?: number;
  padding?: number;
}

export interface ShimmerEffect extends EffectBase {
  type: 'shimmer';
  ids: string[];
  color?: string;
  period?: number;
}

export interface RippleEffect extends EffectBase {
  type: 'ripple';
  ids: string[];
  color?: string;
  period?: number;
  size?: number;
  times?: number;
}

export interface TimerEffect extends EffectBase {
  type: 'timer';
  ids: string[];
  time?: number;
  fill?: boolean;
  repeat?: boolean;
  color?: string;
  size?: number;
}

export interface CounterEffect extends EffectBase {
  type: 'counter';
  to: number;
  from?: number;
  time?: number;
  text?: string;
  decimals?: number;
  near?: string;
  x?: number;
  y?: number;
  color?: string;
  size?: number;
}

export interface HighlightEffect extends EffectBase {
  type: 'highlight';
  ids: string[];
  style?: 'marker' | 'underline';
  color?: string;
}

export interface BlurEffect extends EffectBase {
  type: 'blur';
  ids: string[];
  amount?: number;
  padding?: number;
}

export interface BurstEffect extends EffectBase {
  type: 'burst';
  ids: string[];
  color?: string;
  sparks?: number;
  size?: number;
}

/** Media layer effect driving a WebGL shader (or other media stream) under or over the scene. */
export interface MediaEffect extends EffectBase {
  type: 'media';
  /** ID in Scene.media. */
  media: string;
  rect?: Rect;
  ids?: string[];
  padding?: number;
  layer?: 'under' | 'over';
  opacity?: number;
}

export type Effect =
  | GradientEffect
  | FlowEffect
  | GlowEffect
  | SpotlightEffect
  | ShimmerEffect
  | RippleEffect
  | TimerEffect
  | CounterEffect
  | HighlightEffect
  | BlurEffect
  | BurstEffect
  | MediaEffect;

export const EFFECT_TYPES = [
  'gradient',
  'flow',
  'glow',
  'spotlight',
  'shimmer',
  'ripple',
  'timer',
  'counter',
  'highlight',
  'blur',
  'burst',
  'media',
] as const;

export const EFFECT_FADE_MS = 300;

export interface RunningEffect {
  effect: Effect;
  /** Timestamp when started (ms). */
  from: number;
  /** Timestamp when stopping/fading begins (ms). */
  until?: number;
}

/** Returns true if the effect has completely expired and finished fading out. */
export function effectGone(running: RunningEffect, now: number): boolean {
  if (running.until !== undefined) {
    return now >= running.until + EFFECT_FADE_MS;
  }
  if (running.effect.duration !== undefined) {
    return now >= running.from + running.effect.duration + EFFECT_FADE_MS;
  }
  return false;
}

/** Returns current opacity multiplier (0 to 1) accounting for fade in / fade out. */
export function effectOpacity(running: RunningEffect, now: number): number {
  if (now < running.from) return 0;
  // Fade in over first 150ms
  const inFade = Math.min(1, (now - running.from) / 150);

  if (running.until !== undefined) {
    const out = Math.max(0, 1 - (now - running.until) / EFFECT_FADE_MS);
    return inFade * out;
  }
  if (running.effect.duration !== undefined) {
    const remaining = running.from + running.effect.duration - now;
    if (remaining < 0) {
      const out = Math.max(0, 1 + remaining / EFFECT_FADE_MS);
      return inFade * out;
    }
  }
  return inFade;
}
