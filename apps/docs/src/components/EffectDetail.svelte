<script lang="ts">
  import { createEventDispatcher, onDestroy, tick } from "svelte";
  import { mountEffect, type MountedEffect } from "@pixerate/flair/embed";
  import { effectDefaults, SAMPLE_IMAGES, type EffectDefinition } from "@pixerate/flair/catalog";
  import { loadEffect, type EffectMeta } from "@pixerate/flair/catalog/lazy";
  import { showsOverPicture } from "../lib/overPicture";

  export let meta: EffectMeta;
  /** Where it sits in the list being browsed, for "3 of 40". */
  export let position = 0;
  export let total = 0;

  const dispatch = createEventDispatcher<{ close: void; step: number }>();

  let stage: HTMLDivElement;
  let panel: HTMLDivElement;
  let mounted: MountedEffect | null = null;
  let effect: EffectDefinition | null = null;
  let preset = "";
  let copied = false;
  let failed = false;
  /** The id whose effect is mounted, so a quick step past one drops its late load. */
  let showing = "";

  $: isOverlay = showsOverPicture(meta);
  $: lightGround = meta.kind === "vector" && !isOverlay;
  $: snippet = `import { mountEffect } from "@pixerate/flair/embed";\n\nmountEffect(document.querySelector("#hero"), "${meta.id}"${preset ? `, { preset: "${preset}" }` : ""});`;
  $: load(meta.id);

  async function load(id: string) {
    showing = id;
    preset = "";
    failed = false;
    mounted?.dispose();
    mounted = null;
    await tick();
    try {
      const next = await loadEffect(id);
      if (showing !== id || !stage) return;
      effect = next;
      mounted = mountEffect(stage, next, { className: "absolute inset-0 h-full w-full" });
    } catch (err) {
      failed = true;
      console.warn(`Flair: could not show ${id}`, err);
    }
    panel?.focus();
  }

  function choose(name: string) {
    preset = name;
    if (effect && mounted) mounted.setValues(effectDefaults(effect, name ? { preset: name } : {}));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      copied = true;
      setTimeout(() => (copied = false), 1600);
    } catch {
      // Clipboard refused: the snippet stays selectable.
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") dispatch("close");
    else if (e.key === "ArrowRight") dispatch("step", 1);
    else if (e.key === "ArrowLeft") dispatch("step", -1);
  }

  /** Moves the sheet to <body>, above Starlight's header whatever stacking context the page puts us in. */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }

  onDestroy(() => mounted?.dispose());
</script>

<svelte:window on:keydown={onKey} />

<div use:portal class="fixed inset-0 z-[1000] flex items-end justify-center md:items-center md:p-6" role="presentation">
  <button class="absolute inset-0 cursor-default bg-black/55 backdrop-blur-sm" aria-label="Close" on:click={() => dispatch("close")}></button>

  <div
    bind:this={panel}
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    aria-label={meta.name}
    class="glass-strong relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl p-3 shadow-2xl outline-none md:rounded-3xl"
  >
    <div class="relative aspect-video overflow-hidden rounded-2xl {lightGround ? 'bg-[#f1f1f5]' : 'bg-[#0d0d14]'}">
      {#if isOverlay}
        <img src={SAMPLE_IMAGES.city} alt="" class="absolute inset-0 h-full w-full object-cover" />
      {/if}
      <div bind:this={stage} class="absolute {lightGround ? 'inset-[10%]' : 'inset-0'}"></div>
      {#if failed}
        <span class="absolute inset-0 grid place-items-center text-sm text-white/60">This preview needs WebGL2.</span>
      {/if}
      <div class="absolute right-3 top-3 flex gap-1.5">
        <button class="glass-on-dark grid h-8 w-8 place-items-center rounded-full" aria-label="Previous effect" on:click={() => dispatch("step", -1)}>‹</button>
        <button class="glass-on-dark grid h-8 w-8 place-items-center rounded-full" aria-label="Next effect" on:click={() => dispatch("step", 1)}>›</button>
        <button class="glass-on-dark grid h-8 w-8 place-items-center rounded-full" aria-label="Close" on:click={() => dispatch("close")}>✕</button>
      </div>
      {#if meta.trigger}
        <span class="glass-on-dark absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-[11px]">{meta.trigger} to play</span>
      {/if}
    </div>

    <div class="px-3 pb-3 pt-5 md:px-5">
      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 class="m-0 text-2xl font-semibold tracking-tight text-ink">{meta.name}</h3>
        <span class="text-xs text-faint">{meta.category} · {meta.kind}{total ? ` · ${position + 1} of ${total}` : ""}</span>
      </div>
      <p class="mt-2 text-[15px] leading-relaxed text-muted">{meta.description}</p>

      {#if meta.presets.length}
        <div class="mt-5 flex flex-wrap gap-1.5" role="group" aria-label="Presets">
          {#each ["", ...meta.presets] as name}
            <button
              on:click={() => choose(name)}
              aria-pressed={preset === name}
              class="rounded-full border px-3 py-1 text-xs transition {preset === name
                ? 'border-transparent bg-[var(--flair-ink)] text-[var(--flair-page)]'
                : 'border-[var(--flair-line)] text-muted hover:border-[var(--flair-line-strong)] hover:text-ink'}"
            >
              {name || "Default"}
            </button>
          {/each}
        </div>
      {/if}

      <div class="relative mt-5 overflow-hidden rounded-xl bg-[#0b0b12] ring-1 ring-white/5">
        <pre class="m-0 overflow-x-auto bg-transparent p-4 pr-16 text-[12.5px] leading-relaxed text-slate-200"><code>{snippet}</code></pre>
        <button on:click={copy} class="absolute right-2 top-2 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/15">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {#if meta.controls.length}
        <details class="group mt-4">
          <summary class="cursor-pointer list-none text-xs text-faint hover:text-ink">
            <span class="inline-block transition-transform group-open:rotate-90">›</span>
            {meta.controls.length} controls
          </summary>
          <div class="mt-3 flex flex-wrap gap-1.5">
            {#each meta.controls as control}
              <span class="rounded-md border border-[var(--flair-line)] px-2 py-0.5 font-mono text-[11px] text-muted" title={control.type}>{control.name}</span>
            {/each}
          </div>
        </details>
      {/if}
    </div>
  </div>
</div>
