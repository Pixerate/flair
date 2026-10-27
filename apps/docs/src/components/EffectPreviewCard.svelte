<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { sharedThumbnailPool, SvgPlayer, ThumbnailPool, type ThumbnailHandle } from "@pixerate/flair";
  import { effectDefaults, renderVectorEffect, SAMPLE_IMAGES } from "@pixerate/flair/catalog";
  import { loadEffect, type EffectMeta } from "@pixerate/flair/catalog/lazy";
  import { showsOverPicture } from "../lib/overPicture";

  export let effectMeta: EffectMeta;
  export let hovered = false;

  let containerEl: HTMLDivElement;
  let canvasEl: HTMLCanvasElement;
  let vectorHostEl: HTMLDivElement;
  let cursorEl: HTMLDivElement;
  let ringEl: HTMLSpanElement;

  let visible = false;
  let loaded = false;
  let webglFailed = false;
  let shaderHandle: ThumbnailHandle | null = null;
  let svgPlayer: SvgPlayer | null = null;
  let stopDemo: (() => void) | null = null;
  let observer: IntersectionObserver | null = null;
  /** When a vector demo starts over after a real hover. */
  let restartAt = 0;

  $: isOverlay = showsOverPicture(effectMeta);
  $: lightGround = effectMeta.kind === "vector" && !isOverlay;
  $: trigger = effectMeta.trigger;
  $: shaderHandle?.setHovered(hovered);
  $: onHover(hovered);

  /** Overlays draw on transparent canvases, over a picture, so they show what they add. */
  function poolFor(transparent: boolean | undefined): ThumbnailPool {
    if (!transparent) return sharedThumbnailPool();
    const w = window as unknown as { __flairOverlayPool?: ThumbnailPool };
    return (w.__flairOverlayPool ??= new ThumbnailPool({ alpha: true }));
  }

  function onHover(on: boolean) {
    // A real hover takes over from the demo: the demo cursor steps aside for the real one.
    if (on && cursorEl) cursorEl.style.opacity = "0";
    else restartAt = performance.now() + 1200;
    if (trigger === "hover" || trigger === "press") svgPlayer?.setActive(on);
  }

  async function start() {
    if (loaded) return;
    loaded = true;
    try {
      const effect = await loadEffect(effectMeta.id);
      if (!visible) return cleanup();
      if (effect.kind === "shader") {
        shaderHandle = poolFor(effect.transparent).register(canvasEl, effect.source, effectDefaults(effect), (ok) => (webglFailed = !ok));
        shaderHandle.setHovered(hovered);
      } else {
        // The player listens to nothing: the card's hover and the demo below drive it.
        svgPlayer = new SvgPlayer(vectorHostEl, renderVectorEffect(effect, effectDefaults(effect)), {
          hold: effect.hold,
          trigger: effect.trigger,
          triggerTarget: document.createElement("div"),
          pauseWhenHidden: true,
        });
        stopDemo = runDemo(svgPlayer);
      }
    } catch (err) {
      console.warn(`Flair: could not preview ${effectMeta.id}`, err);
    }
  }

  /**
   * While nobody hovers the card, an interactive vector effect acts out its own
   * interaction: a cursor glides in, hovers, holds or clicks, lets the picture
   * play out, then leaves. Scroll effects play as if the page scrolled down and back.
   */
  function runDemo(p: SvgPlayer): (() => void) | null {
    if (!trigger || matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
    if (trigger === "scroll") {
      let raf = 0;
      const begin = performance.now();
      const step = (now: number) => {
        raf = requestAnimationFrame(step);
        p.setProgress(0.5 - 0.5 * Math.cos((((now - begin) / 5000) % 1) * 2 * Math.PI));
      };
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    }
    const showCursor = (state: "out" | "in" | "down") => {
      if (!cursorEl) return;
      cursorEl.style.opacity = state === "out" ? "0" : "1";
      cursorEl.style.transform = state === "out" ? "translate(28px, 28px)" : state === "down" ? "translate(0, 0) scale(0.85)" : "translate(0, 0)";
    };
    const ping = () => ringEl?.animate([{ transform: "scale(0.3)", opacity: 0.9 }, { transform: "scale(1.6)", opacity: 0 }], { duration: 450, easing: "ease-out" });
    let phase = 0;
    let waitUntil = performance.now() + 600;
    const timer = setInterval(() => {
      if (hovered || !visible) return;
      const now = performance.now();
      if (restartAt) {
        if (now < restartAt) return;
        restartAt = 0;
        phase = 0;
      }
      if (now < waitUntil || p.isPlaying) return;
      if (trigger === "click") {
        if (phase === 0) showCursor("in");
        else {
          showCursor("down");
          setTimeout(() => showCursor("in"), 120);
          ping();
          p.advance();
        }
        phase = 1;
        waitUntil = now + 900;
        return;
      }
      // Hover and press: in, act, (play to the end), let go, (play back), out, rest.
      if (phase === 0) {
        showCursor("in");
        waitUntil = now + 350;
      } else if (phase === 1) {
        if (trigger === "press") showCursor("down");
        p.setActive(true);
        waitUntil = now + 900;
      } else if (phase === 2) {
        showCursor(trigger === "press" ? "in" : "out");
        p.setActive(false);
        waitUntil = now + 300;
      } else {
        showCursor("out");
        waitUntil = now + 900;
      }
      phase = (phase + 1) % 4;
    }, 100);
    return () => clearInterval(timer);
  }

  function cleanup() {
    stopDemo?.();
    stopDemo = null;
    shaderHandle?.dispose();
    shaderHandle = null;
    svgPlayer?.dispose();
    svgPlayer = null;
    loaded = false;
  }

  onMount(() => {
    // Cards far out of view give back their drawing: a gallery of always-playing pictures swamps scrolling.
    observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        if (visible) start();
        else cleanup();
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(containerEl);
  });

  onDestroy(() => {
    observer?.disconnect();
    cleanup();
  });
</script>

<div bind:this={containerEl} class="absolute inset-0 select-none {lightGround ? 'bg-[#f1f1f5]' : 'bg-[#0d0d14]'}">
  {#if isOverlay}
    <img src={SAMPLE_IMAGES.city} alt="" loading="lazy" class="pointer-events-none absolute inset-0 h-full w-full object-cover" />
  {/if}

  {#if effectMeta.kind === "shader"}
    <canvas bind:this={canvasEl} class="pointer-events-none absolute inset-0 h-full w-full"></canvas>
    {#if webglFailed}
      <span class="absolute inset-0 grid place-items-center text-xs text-white/50">Needs WebGL2</span>
    {/if}
  {:else}
    <div bind:this={vectorHostEl} class="pointer-events-none absolute {isOverlay ? 'inset-0' : 'inset-[12%]'}"></div>
    {#if trigger && trigger !== "scroll"}
      <div
        bind:this={cursorEl}
        aria-hidden="true"
        class="pointer-events-none absolute left-1/2 top-1/2 opacity-0 transition-[opacity,transform] duration-300 ease-out"
        style="transform: translate(28px, 28px)"
      >
        <span bind:this={ringEl} class="absolute -left-3 -top-3 h-6 w-6 rounded-full border-2 border-violet-500 opacity-0"></span>
        <svg width="18" height="22" viewBox="0 0 18 22" class="drop-shadow">
          <path d="M1 1 L1 17 L5 13 L8 20 L11 19 L8 12 L14 12 Z" fill="#fff" stroke="#111827" stroke-width="1.5" stroke-linejoin="round" />
        </svg>
      </div>
    {/if}
  {/if}
</div>
