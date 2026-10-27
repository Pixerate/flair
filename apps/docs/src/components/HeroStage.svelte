<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { mountEffect, type MountedEffect } from "@pixerate/flair/embed";
  import { effectDefaults, type EffectDefinition } from "@pixerate/flair/catalog";
  import { getEffectMeta, loadEffect } from "@pixerate/flair/catalog/lazy";

  type Theme = "dark" | "light";

  /** The live backgrounds the hero cycles through, with the preset each uses on a dark and on a light page. */
  const SCENES: { id: string; dark?: string; light: string }[] = [
    { id: "neon-fluid", light: "Light" },
    { id: "prism-burst", dark: "Soft", light: "Light" },
    { id: "molten-web", light: "Light" },
    { id: "neon-warp", light: "Light" },
    { id: "neon-worms", light: "Light" },
  ];
  /** Ms each background plays before the next fades in. */
  const HOLD = 9000;

  const hosts: HTMLDivElement[] = [];
  let titleHost: HTMLDivElement;
  let layers: ({ mounted: MountedEffect; effect: EffectDefinition; scene: number } | null)[] = [null, null];
  let front = 0;
  let index = 0;
  /** Bumped by every change of background, so a slow load that was overtaken is dropped. */
  let request = 0;
  let title: MountedEffect | null = null;
  let titleShown = false;
  let webgl = true;
  let reducedMotion = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let copied = false;
  let theme: Theme = "dark";
  let themeWatch: MutationObserver | null = null;

  $: scene = SCENES[index]!;
  $: sceneName = getEffectMeta(scene.id)?.name ?? scene.id;

  /** The page's theme, as Starlight's theme provider sets it on <html>. */
  function pageTheme(): Theme {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  }

  /** A scene's control values for a theme: its preset for that theme over the effect's defaults. */
  function valuesFor(effect: EffectDefinition, i: number, t: Theme) {
    const preset = SCENES[i]![t];
    return effectDefaults(effect, preset ? { preset } : {});
  }

  function schedule() {
    clearTimeout(timer);
    if (!reducedMotion) timer = setTimeout(() => show(index + 1), HOLD);
  }

  async function show(next: number) {
    const i = (next + SCENES.length) % SCENES.length;
    const mine = ++request;
    const back = 1 - front;
    try {
      const effect = await loadEffect(SCENES[i]!.id);
      if (mine !== request) return;
      layers[back]?.mounted.dispose();
      const mounted = mountEffect(hosts[back]!, effect, {
        values: valuesFor(effect, i, theme),
        className: "absolute inset-0 h-full w-full",
      });
      // A full-screen background at device resolution costs a lot for little: one pixel per CSS pixel looks the same behind glass.
      mounted.renderer?.setPixelRatio(1);
      layers[back] = { mounted, effect, scene: i };
      await mounted.ready();
      if (mine !== request) return;
      hosts[back]!.style.opacity = "1";
      hosts[front]!.style.opacity = "0";
      front = back;
      index = i;
    } catch (err) {
      webgl = false;
      console.warn("Flair hero: no WebGL2, showing the still fallback.", err);
      return;
    }
    schedule();
  }

  /** Repaints the playing backgrounds in the new theme's palette, in place. */
  function applyTheme(next: Theme) {
    if (next === theme) return;
    theme = next;
    for (const layer of layers) layer?.mounted.setValues(valuesFor(layer.effect, layer.scene, theme));
  }

  async function copyInstall() {
    try {
      await navigator.clipboard.writeText("pnpm add @pixerate/flair");
      copied = true;
      setTimeout(() => (copied = false), 1600);
    } catch {
      // Clipboard refused (an insecure origin, say): the command stays on screen to copy by hand.
    }
  }

  onMount(() => {
    reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    theme = pageTheme();
    themeWatch = new MutationObserver(() => applyTheme(pageTheme()));
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    show(0);
    loadEffect("iridescent-text")
      .then(async (effect) => {
        title = mountEffect(titleHost, effect, {
          values: { uSize: 0.96, uHalo: 0.55 },
          className: "absolute inset-0 h-full w-full",
        });
        await title.ready();
        titleShown = true;
      })
      .catch(() => (titleShown = false));
  });

  onDestroy(() => {
    clearTimeout(timer);
    themeWatch?.disconnect();
    request++;
    for (const layer of layers) layer?.mounted.dispose();
    title?.dispose();
  });
</script>

<section class="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden bg-[var(--flair-page)] text-ink">
  <!-- Live backgrounds, crossfading. -->
  <div aria-hidden="true" class="absolute inset-0">
    {#each [0, 1] as i}
      <div bind:this={hosts[i]} class="absolute inset-0 opacity-0 transition-opacity duration-[1400ms] ease-out"></div>
    {/each}
    {#if !webgl}
      <div class="absolute inset-0 bg-[radial-gradient(60%_60%_at_30%_40%,rgba(176,76,255,0.35),transparent),radial-gradient(50%_50%_at_75%_60%,rgba(47,230,224,0.25),transparent)]"></div>
    {/if}
    <!-- Quiet the background towards the page colour, most behind the title, and fade into the page below. -->
    <div class="absolute inset-0 bg-[var(--flair-page)] opacity-[var(--flair-hero-veil)]"></div>
    <div class="absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_42%,var(--flair-page),transparent_75%)] opacity-[var(--flair-hero-centre)]"></div>
    <div class="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[var(--flair-page)]"></div>
  </div>

  <div class="relative mx-auto flex min-h-[78vh] max-w-5xl flex-col items-center justify-center px-6 pb-24 pt-14 text-center">
    <!-- The title is drawn live by the iridescent-text effect; the plain word shows until it is ready, or without WebGL2. -->
    <h1 class="relative m-0 aspect-[5/2] w-full max-w-[880px]">
      <span class="iridescent-text absolute inset-0 grid place-items-center text-7xl font-black tracking-tight transition-opacity duration-700 md:text-9xl {titleShown ? 'opacity-0' : 'opacity-100'}">Flair</span>
      <div bind:this={titleHost} aria-hidden="true" class="absolute inset-0 transition-opacity duration-700 {titleShown ? 'opacity-100' : 'opacity-0'}"></div>
    </h1>

    <p class="mt-2 max-w-xl text-lg text-muted md:text-xl">Visual effects and motion graphics for the web.</p>

    <div class="mt-10 flex flex-wrap items-center justify-center gap-3">
      <button
        on:click={copyInstall}
        class="glass group inline-flex items-center gap-3 rounded-full py-2.5 pl-5 pr-3 font-mono text-sm text-ink transition hover:bg-[var(--flair-glass-hover)]"
        aria-label="Copy the install command"
      >
        <span class="text-faint">$</span>
        <span>pnpm add @pixerate/flair</span>
        <span class="grid h-7 w-7 place-items-center rounded-full bg-[var(--flair-glass-hover)] text-muted transition group-hover:text-ink">
          {#if copied}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7" /></svg>
          {:else}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
          {/if}
        </span>
      </button>
      <a href="#effects" class="rounded-full bg-[var(--flair-ink)] px-5 py-2.5 text-sm font-medium text-[var(--flair-page)] no-underline transition hover:opacity-90">Browse effects</a>
      <a href="/getting-started/introduction/" class="rounded-full px-4 py-2.5 text-sm font-medium text-muted no-underline transition hover:text-[var(--flair-ink)]">Docs →</a>
    </div>

    <!-- What is playing behind the title, and a way to step through. -->
    {#if webgl}
      <div class="glass mt-12 flex items-center gap-1 whitespace-nowrap rounded-full p-1 text-xs">
        <button class="grid h-7 w-7 place-items-center rounded-full text-faint hover:bg-[var(--flair-glass-hover)] hover:text-[var(--flair-ink)]" aria-label="Previous background" on:click={() => show(index - 1)}>‹</button>
        <a href={`#effect/${scene.id}`} class="px-2 text-ink no-underline hover:opacity-80">{sceneName}</a>
        <div class="flex gap-1 px-1" aria-hidden="true">
          {#each SCENES as s, i (s.id)}
            <span class="h-1 rounded-full bg-[var(--flair-ink)] transition-all duration-500 {i === index ? 'w-4 opacity-80' : 'w-1 opacity-30'}"></span>
          {/each}
        </div>
        <button class="grid h-7 w-7 place-items-center rounded-full text-faint hover:bg-[var(--flair-glass-hover)] hover:text-[var(--flair-ink)]" aria-label="Next background" on:click={() => show(index + 1)}>›</button>
      </div>
    {/if}
  </div>
</section>
