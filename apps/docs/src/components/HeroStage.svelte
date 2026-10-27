<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { mountEffect, type MountedEffect } from "@pixerate/flair/embed";
  import { getEffectMeta, loadEffect } from "@pixerate/flair/catalog/lazy";

  /** The live backgrounds the hero cycles through, each with a preset where one suits. */
  const SCENES: { id: string; preset?: string }[] = [
    { id: "neon-fluid" },
    { id: "prism-burst", preset: "Soft" },
    { id: "molten-web" },
    { id: "neon-warp" },
    { id: "neon-worms" },
    { id: "aurora" },
  ];
  /** Ms each background plays before the next fades in. */
  const HOLD = 9000;

  const hosts: HTMLDivElement[] = [];
  let titleHost: HTMLDivElement;
  let layers: (MountedEffect | null)[] = [null, null];
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

  $: scene = SCENES[index]!;
  $: sceneName = getEffectMeta(scene.id)?.name ?? scene.id;

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
      layers[back]?.dispose();
      const mounted = mountEffect(hosts[back]!, effect, {
        ...(SCENES[i]!.preset ? { preset: SCENES[i]!.preset } : {}),
        className: "absolute inset-0 h-full w-full",
      });
      // A full-screen background at device resolution costs a lot for little: one pixel per CSS pixel looks the same behind glass.
      mounted.renderer?.setPixelRatio(1);
      layers[back] = mounted;
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
    request++;
    for (const layer of layers) layer?.dispose();
    title?.dispose();
  });
</script>

<section class="flair-hero relative left-1/2 w-screen -translate-x-1/2 overflow-hidden bg-[#07070b] text-white">
  <!-- Live backgrounds, crossfading. -->
  <div aria-hidden="true" class="absolute inset-0">
    {#each [0, 1] as i}
      <div bind:this={hosts[i]} class="absolute inset-0 opacity-0 transition-opacity duration-[1400ms] ease-out"></div>
    {/each}
    {#if !webgl}
      <div class="absolute inset-0 bg-[radial-gradient(60%_60%_at_30%_40%,rgba(176,76,255,0.35),transparent),radial-gradient(50%_50%_at_75%_60%,rgba(47,230,224,0.25),transparent)]"></div>
    {/if}
    <!-- Darken the middle a touch so the title reads on any background, and fade into the page below. -->
    <div class="absolute inset-0 bg-[#07070b]/30"></div>
    <div class="absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_42%,rgba(7,7,11,0.6),transparent_75%)]"></div>
    <div class="flair-hero-fade absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[var(--flair-page)]"></div>
  </div>

  <div class="relative mx-auto flex min-h-[78vh] max-w-5xl flex-col items-center justify-center px-6 pb-24 pt-14 text-center">
    <!-- The title is drawn live by the iridescent-text effect; the plain word shows until it is ready, or without WebGL2. -->
    <h1 class="relative m-0 aspect-[5/2] w-full max-w-[880px]">
      <span class="iridescent-text absolute inset-0 grid place-items-center text-7xl font-black tracking-tight transition-opacity duration-700 md:text-9xl {titleShown ? 'opacity-0' : 'opacity-100'}">Flair</span>
      <div bind:this={titleHost} aria-hidden="true" class="absolute inset-0 transition-opacity duration-700 {titleShown ? 'opacity-100' : 'opacity-0'}"></div>
    </h1>

    <p class="mt-2 max-w-xl text-lg text-white/75 md:text-xl">Visual effects and motion graphics for the web.</p>

    <div class="mt-10 flex flex-wrap items-center justify-center gap-3">
      <button
        on:click={copyInstall}
        class="glass-on-dark group inline-flex items-center gap-3 rounded-full py-2.5 pl-5 pr-3 font-mono text-sm transition hover:bg-white/10"
        aria-label="Copy the install command"
      >
        <span class="text-white/45">$</span>
        <span>pnpm add @pixerate/flair</span>
        <span class="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white/70 transition group-hover:text-white">
          {#if copied}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7" /></svg>
          {:else}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
          {/if}
        </span>
      </button>
      <a href="#effects" class="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-[#07070b] no-underline transition hover:bg-white/90">Browse effects</a>
      <a href="/getting-started/introduction/" class="rounded-full px-4 py-2.5 text-sm font-medium text-white/80 no-underline transition hover:text-white">Docs →</a>
    </div>

    <!-- What is playing behind the title, and a way to step through. -->
    {#if webgl}
      <div class="glass-on-dark mt-12 flex items-center whitespace-nowrap gap-1 rounded-full p-1 text-xs">
        <button class="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white" aria-label="Previous background" on:click={() => show(index - 1)}>‹</button>
        <a href={`#effect/${scene.id}`} class="px-2 text-white/85 no-underline hover:text-white">{sceneName}</a>
        <div class="flex gap-1 px-1" aria-hidden="true">
          {#each SCENES as s, i (s.id)}
            <span class="h-1 rounded-full transition-all duration-500 {i === index ? 'w-4 bg-white/80' : 'w-1 bg-white/30'}"></span>
          {/each}
        </div>
        <button class="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white" aria-label="Next background" on:click={() => show(index + 1)}>›</button>
      </div>
    {/if}
  </div>
</section>
