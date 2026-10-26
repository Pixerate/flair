<script lang="ts">
  import { onMount } from "svelte";
  import { SlopVideo } from "@slopmachine/svelte";

  // Bucket ID passed as prop or from env, defaulting to the user-provided bucket
  export let bucketId: string = "eYRCorLl9gVPWohDanED";

  // Reactive state tracking system theme
  let isDark = true;

  onMount(() => {
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      isDark = mediaQuery.matches;

      const handler = (e: MediaQueryListEvent) => {
        isDark = e.matches;
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handler);
        return () => mediaQuery.removeEventListener("change", handler);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handler);
        return () => mediaQuery.removeListener(handler);
      }
    }
  });
</script>

<div
  class="hero-bg-video-container pointer-events-none absolute -top-12 bottom-0 left-1/2 -translate-x-1/2 w-screen -z-20 overflow-hidden select-none"
>
  <SlopVideo
    {bucketId}
    aspectRatio="16:9"
    duration={10}
    variables={{
      color: isDark ? "dark" : "light",
    }}
    class="hero-bg-video-wrapper w-full h-full {isDark ? 'opacity-35' : 'opacity-25'} scale-105 transition-opacity duration-500"
  />

  <!-- Soft gradient mask fading to background -->
  <div
    class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white dark:to-[#0b0f19] pointer-events-none"
  ></div>
</div>

<style>
  :global(.hero-bg-video-wrapper) {
    width: 100% !important;
    height: 100% !important;
  }

  :global(.hero-bg-video-wrapper .slop-wrapper) {
    width: 100% !important;
    height: 100% !important;
    max-width: none !important;
    aspect-ratio: auto !important;
  }
</style>
