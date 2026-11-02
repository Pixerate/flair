<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  /** What the row holds, for screen readers ("Groups", "Tags"). */
  export let label: string;
  let className = "";
  export { className as class };

  let row: HTMLDivElement;
  /** Whether there is more of the row out of sight to each side. */
  let before = false;
  let after = false;
  let resize: ResizeObserver | null = null;
  let mutations: MutationObserver | null = null;

  function measure() {
    if (!row) return;
    before = row.scrollLeft > 1;
    after = row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
  }

  /** Scrolls most of a row's width: what a swipe or a trackpad does, for a mouse. */
  function nudge(direction: -1 | 1) {
    const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    row.scrollBy({ left: direction * row.clientWidth * 0.7, behavior });
  }

  onMount(() => {
    measure();
    // The row's chips change with the search (counts, tags, categories), and so does its width.
    resize = new ResizeObserver(measure);
    resize.observe(row);
    mutations = new MutationObserver(measure);
    mutations.observe(row, { childList: true, subtree: true, characterData: true });
  });

  onDestroy(() => {
    resize?.disconnect();
    mutations?.disconnect();
  });

  const edge = "pointer-events-none absolute bottom-1 top-0 flex w-14 items-center from-[var(--flair-page)] from-40% to-transparent";
  const arrow =
    "glass pointer-events-auto grid h-7 w-7 place-items-center rounded-full text-muted shadow-sm transition hover:text-ink [@media(pointer:coarse)]:hidden";
</script>

<div class="relative -mx-4 {className}">
  <div bind:this={row} on:scroll={measure} class="flex items-center gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label={label}>
    <slot />
  </div>
  <!-- Fades say there is more to see; the arrows scroll to it, for a mouse with no sideways wheel. -->
  {#if before}
    <div class="{edge} left-0 justify-start bg-gradient-to-r pl-2">
      <button class={arrow} tabindex="-1" aria-label="Scroll {label} left" on:click={() => nudge(-1)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </button>
    </div>
  {/if}
  {#if after}
    <div class="{edge} right-0 justify-end bg-gradient-to-l pr-2">
      <button class={arrow} tabindex="-1" aria-label="Scroll {label} right" on:click={() => nudge(1)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>
  {/if}
</div>
