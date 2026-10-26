<script lang="ts">
  import { onMount } from "svelte";
  import recentEffects from "../data/recent-effects.generated.json";
  import EffectPreviewCard from "./EffectPreviewCard.svelte";

  let activeTab = "all";
  let hoveredId: string | null = null;

  // Filter tabs for recent effects
  $: filteredEffects =
    activeTab === "all"
      ? recentEffects
      : recentEffects.filter((e) => e.category === activeTab || e.kind === activeTab);
</script>

<section class="my-16 px-4 max-w-7xl mx-auto">
  <div class="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
    <div>
      <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-600 dark:text-pink-400 text-xs font-mono uppercase tracking-wider mb-2">
        <span class="w-2 h-2 rounded-full bg-pink-500 animate-ping"></span>
        Fresh from Git History
      </div>
      <h2 class="text-2xl md:text-4xl font-extrabold text-slate-900 dark:text-white">
        Recently Added Effects
      </h2>
      <p class="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
        Dynamically compiled from recent releases. New shaders, vector animations, and loaders.
      </p>
    </div>

    <!-- Category filter buttons -->
    <div class="flex flex-wrap gap-2">
      <button
        on:click={() => (activeTab = "all")}
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors {activeTab === 'all' ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'}"
      >
        All New ({recentEffects.length})
      </button>
      <button
        on:click={() => (activeTab = "loader")}
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors {activeTab === 'loader' ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'}"
      >
        Loaders
      </button>
      <button
        on:click={() => (activeTab = "fire")}
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors {activeTab === 'fire' ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'}"
      >
        Fire
      </button>
      <button
        on:click={() => (activeTab = "hologram")}
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors {activeTab === 'hologram' ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'}"
      >
        Holograms
      </button>
    </div>
  </div>

  <!-- Cards Grid -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
    {#each filteredEffects as effect}
      <div
        on:pointerenter={() => (hoveredId = effect.id)}
        on:pointerleave={() => (hoveredId = null)}
        class="group rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 dark:hover:border-purple-500/50 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col justify-between overflow-hidden"
      >
        <!-- Live Preview Thumbnail -->
        <EffectPreviewCard effectMeta={effect} hovered={hoveredId === effect.id} />

        <div class="p-4 flex flex-col justify-between flex-1">
          <div>
            <!-- Header info -->
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800/50">
                {effect.category}
              </span>
              <code class="text-[11px] font-mono text-slate-400 dark:text-slate-500">{effect.id}</code>
            </div>

            <!-- Effect Name -->
            <h3 class="font-bold text-slate-900 dark:text-white text-base group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              {effect.name}
            </h3>

            <!-- Description -->
            <p class="text-xs text-slate-600 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
              {effect.description}
            </p>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <!-- Tags / Features -->
            <div class="flex items-center gap-1">
              {#if effect.transparent}
                <span class="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  Overlay
                </span>
              {/if}
              {#if effect.duration}
                <span class="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  {effect.duration / 1000}s
                </span>
              {/if}
            </div>

            <a
              href={`#explorer-${effect.id}`}
              class="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
            >
              Explore &rarr;
            </a>
          </div>
        </div>
      </div>
    {/each}
  </div>
</section>
