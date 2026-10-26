<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { sharedThumbnailPool, SvgPlayer, ThumbnailPool, type ThumbnailHandle } from "@pixerate/flair";
  import { effectDefaults, renderVectorEffect, SAMPLE_IMAGES, type EffectDefinition } from "@pixerate/flair/catalog";
  import { loadEffect } from "@pixerate/flair/catalog/lazy";
  import { showsOverPicture } from "../lib/overPicture";

  export let effectMeta: any;
  export let hovered: boolean = false;

  let containerEl: HTMLDivElement;
  let canvasEl: HTMLCanvasElement;
  let vectorHostEl: HTMLDivElement;

  let isIntersecting = false;
  let loadedEffect: any = null;
  let shaderHandle: ThumbnailHandle | null = null;
  let svgPlayer: SvgPlayer | null = null;
  let webglFailed = false;

  let observer: IntersectionObserver | null = null;

  // Global shared overlay pool for transparent shaders
  let overlayPool: ThumbnailPool | null = null;
  function getPool(effect: any): ThumbnailPool {
    if (!effect.transparent) return sharedThumbnailPool();
    // Use window-scoped singleton or module-level singleton
    const w = window as any;
    return (w.__flairOverlayPool ??= new ThumbnailPool({ alpha: true }));
  }

  $: isOverlay = showsOverPicture(effectMeta);

  // When hover changes, update handles
  $: if (shaderHandle) {
    shaderHandle.setHovered(hovered);
  }
  $: if (svgPlayer && (effectMeta?.trigger === "hover" || effectMeta?.trigger === "press")) {
    svgPlayer.setActive(hovered);
  }

  async function initEffect() {
    if (!isIntersecting || loadedEffect) return;

    try {
      const effect = await loadEffect(effectMeta.id);
      if (!effect || !isIntersecting) return;
      loadedEffect = effect;

      if (effect.kind === "shader" && canvasEl) {
        const pool = getPool(effect);
        const defaults = effectDefaults(effect);
        shaderHandle = pool.register(canvasEl, effect.source, defaults, (ok) => {
          webglFailed = !ok;
        });
        if (hovered) shaderHandle.setHovered(true);
      } else if (effect.kind === "vector" && vectorHostEl) {
        const defaults = effectDefaults(effect);
        const motion = renderVectorEffect(effect, defaults);
        svgPlayer = new SvgPlayer(vectorHostEl, motion, {
          hold: effect.hold,
          trigger: effect.trigger,
          triggerTarget: document.createElement("div"),
          pauseWhenHidden: true,
        });
      }
    } catch (err) {
      console.warn(`Failed to load or render effect ${effectMeta?.id}:`, err);
    }
  }

  function cleanup() {
    if (shaderHandle) {
      shaderHandle.dispose();
      shaderHandle = null;
    }
    if (svgPlayer) {
      svgPlayer.dispose();
      svgPlayer = null;
    }
    loadedEffect = null;
  }

  onMount(() => {
    if (typeof IntersectionObserver !== "undefined" && containerEl) {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          isIntersecting = Boolean(entry?.isIntersecting);
          if (isIntersecting) {
            initEffect();
          } else {
            // When scrolled far out of view, clean up resources to keep GPU memory lean
            cleanup();
          }
        },
        { rootMargin: "200px 0px" }
      );
      observer.observe(containerEl);
    } else {
      isIntersecting = true;
      initEffect();
    }
  });

  onDestroy(() => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    cleanup();
  });
</script>

<div
  bind:this={containerEl}
  class="relative aspect-video w-full overflow-hidden rounded-t-xl bg-slate-950 flex items-center justify-center select-none"
>
  <!-- Background sample image for overlays and transparent effects -->
  {#if isOverlay}
    <img
      src={SAMPLE_IMAGES.city}
      alt=""
      class="absolute inset-0 h-full w-full object-cover pointer-events-none opacity-80"
      loading="lazy"
    />
  {/if}

  <!-- Canvas container for WebGL Shaders -->
  {#if effectMeta.kind === "shader"}
    <canvas
      bind:this={canvasEl}
      class="absolute inset-0 h-full w-full pointer-events-none"
    />
    {#if webglFailed}
      <div class="absolute inset-0 flex items-center justify-center text-xs text-slate-400 bg-slate-900/80">
        WebGL2 preview unavailable
      </div>
    {/if}
  {:else}
    <!-- Vector / SVG Player container -->
    <div
      bind:this={vectorHostEl}
      class={isOverlay ? "absolute inset-0 pointer-events-none" : "absolute inset-[10%] pointer-events-none flex items-center justify-center"}
    />
  {/if}

  <!-- Subtle placeholder when not yet loaded or scrolled into view -->
  {#if !loadedEffect}
    <div class="absolute inset-0 flex items-center justify-center bg-slate-900/40 text-slate-500 text-xs font-mono animate-pulse">
      flair
    </div>
  {/if}

  <!-- Kind / Category badge overlay in top corner -->
  <span class="absolute top-2 left-2 rounded bg-black/70 backdrop-blur-sm px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-mono text-slate-300 pointer-events-none">
    {effectMeta.kind}
    {#if effectMeta.trigger}
      · {effectMeta.trigger}
    {/if}
  </span>
</div>
