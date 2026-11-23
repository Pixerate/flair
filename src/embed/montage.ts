/**
 * The montage cycle: a montage effect's items beyond its slots, brought in
 * as it plays (see `EffectItems`). `swap` hands the next slot in turn the
 * next item each step; `carousel` changes from the item shown to the next
 * by running the effect's progress control. Time only passes while the
 * renderer plays, so a montage scrolled out of view (`pauseWhenHidden`)
 * waits where it is.
 *
 * @internal
 */

import type { EffectDefinition, EffectItems } from "../catalog/types.js";
import type { ControlValue } from "../shader/controls.js";
import { preloadImages, type LiveSource } from "../shader/textures.js";

/** Playback of a montage's items (the `MountOptions` fields of the same names). */
export interface MontageOptions {
  /** Ms each item is shown before the next comes in (default 2500); an item's own `duration` wins. */
  itemDuration?: number;
  /** Ms a carousel takes to change to the next item (default 700). */
  overlap?: number;
  /** Start again after the last item (default true). */
  loop?: boolean;
  /** Show the items in a random order. */
  shuffle?: boolean;
  /** Called with an item's index in the list each time one comes in, so the page can follow (a headline per screenshot). */
  onItem?: (index: number) => void;
  /** Pause video items while no slot shows them, and play them while one does (default true). */
  pauseOffscreenVideo?: boolean;
}

/** What the cycle needs from its mount: the item list, a way to put one item in a slot, and the renderer's clock. */
export interface MontageHost {
  items: readonly MontageItem[];
  /** Puts item `index` (or nothing) in the slot: its values and live source. */
  fill(slot: string, index: number): void;
  /** Sets control values (merged over the mount's). */
  set(values: Record<string, ControlValue>): void;
  /** Whether the renderer's clock is running. */
  playing(): boolean;
}

/** An item as the cycle sees it: what to preload, its video, how long it stays. */
export interface MontageItem {
  url?: string;
  video?: LiveSource;
  duration?: number;
}

/** The order items are shown in: the list's, or shuffled. */
function orderOf(n: number, shuffle: boolean): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  if (shuffle)
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
  return order;
}

/** Starts the cycle; returns a function that stops it. Does nothing (and stops nothing) when every item fits its slots. */
export function startMontage(def: EffectDefinition & { items: EffectItems }, host: MontageHost, options: MontageOptions = {}): () => void {
  const spec = def.items;
  const n = host.items.length;
  const order = orderOf(n, options.shuffle ?? false);
  const loop = options.loop ?? true;
  const itemMs = (i: number) => Math.max(200, host.items[i]?.duration ?? options.itemDuration ?? 2500);
  const overlap = Math.max(0, options.overlap ?? 700);
  const shown = new Set<number>();
  const pauseVideo = options.pauseOffscreenVideo ?? true;
  /** Plays the videos a slot shows and pauses the rest. */
  const syncVideos = () => {
    if (!pauseVideo) return;
    host.items.forEach((item, i) => {
      const v = item.video as HTMLVideoElement | undefined;
      if (!v || typeof v.play !== "function") return;
      if (shown.has(i)) void v.play()?.catch?.(() => undefined);
      else v.pause();
    });
  };
  const preload = (i: number) => {
    const url = host.items[i]?.url;
    if (url) void preloadImages([url]).catch(() => undefined);
  };

  if (spec.cycle === "carousel") {
    const [from, to] = spec.slots as [string, string];
    const progress = spec.progress;
    let at = 0;
    host.fill(from, order[0]!);
    host.fill(to, order[(1 % n)]!);
    shown.add(order[0]!);
    syncVideos();
    if (n < 2) return () => undefined;
    let phase: "hold" | "change" = "hold";
    let elapsed = 0;
    let last = 0;
    let raf = 0;
    let stopped = false;
    const frame = (now: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(now - last, 100) : 0;
      last = now;
      if (!host.playing()) return;
      elapsed += dt;
      const cur = order[at]!;
      const next = order[(at + 1) % n]!;
      if (phase === "hold" && elapsed >= itemMs(cur)) {
        if (!loop && at >= n - 1) return stop();
        phase = "change";
        elapsed = 0;
        shown.add(next);
        syncVideos();
        options.onItem?.(next);
      }
      if (phase === "change") {
        const p = overlap ? Math.min(1, elapsed / overlap) : 1;
        if (progress) host.set({ [progress]: p });
        if (p >= 1) {
          // The next is now the one shown; the one after waits (loading) in the second slot.
          at = (at + 1) % n;
          shown.delete(cur);
          host.fill(from, next);
          host.fill(to, order[(at + 1) % n]!);
          if (progress) host.set({ [progress]: 0 });
          syncVideos();
          phase = "hold";
          elapsed = 0;
        }
      }
    };
    const stop = () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
    raf = requestAnimationFrame(frame);
    return stop;
  }

  // Swap: the slots show the first items; each step the next slot in turn takes the next item.
  const slots = spec.slots;
  const count = Math.min(n, slots.length);
  const inSlot = order.slice(0, count);
  inSlot.forEach((item, s) => host.fill(slots[s]!, item));
  for (let s = count; s < slots.length; s++) host.fill(slots[s]!, -1);
  inSlot.forEach((i) => shown.add(i));
  syncVideos();
  if (n <= slots.length) return () => undefined;
  let nextAt = count;
  let step = 0;
  let elapsed = 0;
  let last = 0;
  let raf = 0;
  let stopped = false;
  preload(order[nextAt % n]!);
  const frame = (now: number) => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(now - last, 100) : 0;
    last = now;
    if (!host.playing()) return;
    elapsed += dt;
    const slot = step % count;
    if (elapsed < itemMs(inSlot[slot]!)) return;
    if (!loop && nextAt >= n) return stop();
    const item = order[nextAt % n]!;
    shown.delete(inSlot[slot]!);
    inSlot[slot] = item;
    shown.add(item);
    host.fill(slots[slot]!, item);
    syncVideos();
    options.onItem?.(item);
    nextAt++;
    step++;
    elapsed = 0;
    preload(order[nextAt % n]!);
  };
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
  raf = requestAnimationFrame(frame);
  return stop;
}
