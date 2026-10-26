<script lang="ts">
  import { onMount } from "svelte";
  // Import metadata array from catalog meta.generated.json
  import metaList from "../../../../src/catalog/meta.generated.json";
  import EffectPreviewCard from "./EffectPreviewCard.svelte";

  let searchQuery = "";
  let selectedCategory = "all";
  let selectedKind = "all";
  let selectedVideo = "all";
  let selectedTransparent = "all";
  let hoveredId: string | null = null;

  // Categories list
  const categories = Array.from(new Set(metaList.map((m: any) => m.category))).sort();

  // Filtered effects
  $: filtered = metaList.filter((effect: any) => {
    if (selectedCategory !== "all" && effect.category !== selectedCategory) return false;
    if (selectedKind !== "all" && effect.kind !== selectedKind) return false;
    if (selectedTransparent === "overlay" && !effect.transparent) return false;
    if (selectedTransparent === "solid" && effect.transparent) return false;
    if (selectedVideo === "video" && !effect.video) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = effect.name.toLowerCase().includes(q);
      const matchId = effect.id.toLowerCase().includes(q);
      const matchDesc = effect.description?.toLowerCase().includes(q);
      const matchTags = effect.tags?.some((t: string) => t.toLowerCase().includes(q));
      if (!matchName && !matchId && !matchDesc && !matchTags) return false;
    }
    return true;
  });

  let selectedEffect: any = null;

  function openPreview(effect: any) {
    selectedEffect = effect;
  }

  function closePreview() {
    selectedEffect = null;
  }
</script>

<section id="catalog-explorer" class="my-20 px-4 max-w-7xl mx-auto scroll-mt-20">
  <div class="text-center max-w-3xl mx-auto mb-10">
    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-mono uppercase tracking-wider mb-3">
      450+ Hand-Crafted Looks
    </div>
    <h2 class="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white">
      Searchable Effects Library
    </h2>
    <p class="mt-4 text-base md:text-lg text-slate-600 dark:text-slate-400">
      Browse all WebGL2 shaders and animated vector effects. Search by keyword, category, tag, or interaction capability.
    </p>
  </div>

  <!-- Search & Filter Controls -->
  <div class="p-4 md:p-6 rounded-2xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-md mb-8">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <!-- Search Input -->
      <div class="md:col-span-2 relative">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search by name, tags, description... (e.g. fire, loader, liquid)"
          class="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
        />
        {#if searchQuery}
          <button
            on:click={() => (searchQuery = "")}
            class="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
          >
            &times;
          </button>
        {/if}
      </div>

      <!-- Category Filter -->
      <div>
        <select
          bind:value={selectedCategory}
          class="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Categories ({categories.length})</option>
          {#each categories as cat}
            <option value={cat}>{cat}</option>
          {/each}
        </select>
      </div>

      <!-- Kind Filter -->
      <div class="flex gap-2">
        <select
          bind:value={selectedKind}
          class="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Kinds</option>
          <option value="shader">WebGL Shaders</option>
          <option value="vector">Vector / SVG</option>
        </select>
      </div>
    </div>

    <!-- Secondary Quick Filters -->
    <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
      <div class="flex items-center gap-2">
        <span class="text-slate-500 dark:text-slate-400 font-medium">Quick filters:</span>
        <button
          on:click={() => (selectedTransparent = selectedTransparent === "overlay" ? "all" : "overlay")}
          class="px-2.5 py-1 rounded-md transition-colors {selectedTransparent === 'overlay' ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}"
        >
          Transparent Overlays
        </button>
        <button
          on:click={() => (selectedVideo = selectedVideo === "video" ? "all" : "video")}
          class="px-2.5 py-1 rounded-md transition-colors {selectedVideo === 'video' ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}"
        >
          Video Compatible
        </button>
      </div>

      <div class="text-slate-500 dark:text-slate-400 font-mono">
        Showing <strong class="text-purple-600 dark:text-purple-400">{filtered.length}</strong> of {metaList.length} effects
      </div>
    </div>
  </div>

  <!-- Effects Grid -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
    {#each filtered.slice(0, 48) as effect}
      <div
        id={`explorer-${effect.id}`}
        on:pointerenter={() => (hoveredId = effect.id)}
        on:pointerleave={() => (hoveredId = null)}
        class="rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 hover:border-purple-500/50 dark:hover:border-purple-500/50 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between group overflow-hidden"
      >
        <!-- Animated Live Preview -->
        <EffectPreviewCard effectMeta={effect} hovered={hoveredId === effect.id} />

        <div class="p-4 flex flex-col justify-between flex-1">
          <div>
            <!-- Tags and Category -->
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-xs text-purple-600 dark:text-purple-400 font-medium">
                {effect.category}
              </span>
              <span class="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                {effect.id}
              </span>
            </div>

            <h3 class="font-bold text-slate-900 dark:text-white text-base group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              {effect.name}
            </h3>

            <p class="text-xs text-slate-600 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
              {effect.description}
            </p>

            <!-- Controls pills -->
            {#if effect.controls?.length > 0}
              <div class="mt-3 flex flex-wrap gap-1">
                {#each effect.controls.slice(0, 3) as ctrl}
                  <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {ctrl.n}
                  </span>
                {/each}
                {#if effect.controls.length > 3}
                  <span class="text-[10px] text-slate-400 dark:text-slate-500">
                    +{effect.controls.length - 3}
                  </span>
                {/if}
              </div>
            {/if}
          </div>

          <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span class="text-[10px] text-slate-500 dark:text-slate-400">
              {effect.controls?.length || 0} controls
            </span>
            <button
              on:click={() => openPreview(effect)}
              class="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-500 flex items-center gap-1 cursor-pointer"
            >
              Inspect &rarr;
            </button>
          </div>
        </div>
      </div>
    {/each}
  </div>

  {#if filtered.length > 48}
    <div class="text-center mt-8">
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Showing first 48 matches. Use search to find specific effects among all {metaList.length} items.
      </p>
    </div>
  {/if}

  <!-- Detail Modal -->
  {#if selectedEffect}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      on:click={closePreview}
    >
      <div
        class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
        on:click|stopPropagation
      >
        <div class="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="px-2 py-0.5 rounded text-xs font-mono uppercase font-semibold {selectedEffect.kind === 'shader' ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'}">
                {selectedEffect.kind}
              </span>
              <span class="text-xs text-slate-500 font-mono">ID: {selectedEffect.id}</span>
            </div>
            <h3 class="text-2xl font-bold text-slate-900 dark:text-white">
              {selectedEffect.name}
            </h3>
          </div>
          <button
            on:click={closePreview}
            class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            &times;
          </button>
        </div>

        <div class="mt-4 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <EffectPreviewCard effectMeta={selectedEffect} hovered={true} />
        </div>

        <p class="mt-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {selectedEffect.description}
        </p>

        <!-- Controls section -->
        {#if selectedEffect.controls?.length > 0}
          <div class="mt-6">
            <h4 class="text-xs uppercase font-mono tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              Declared Controls ({selectedEffect.controls.length})
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {#each selectedEffect.controls as ctrl}
                <div class="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono">
                  <div class="text-purple-600 dark:text-purple-400 font-bold">{ctrl.n}</div>
                  <div class="text-slate-500 text-[11px] mt-0.5">type: {ctrl.t}</div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Usage snippet -->
        <div class="mt-6">
          <h4 class="text-xs uppercase font-mono tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            Usage in Code
          </h4>
          <pre class="p-4 rounded-xl bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto"><code>{`import { loadEffect } from "@pixerate/flair/catalog/lazy";

const effect = await loadEffect("${selectedEffect.id}");`}</code></pre>
        </div>
      </div>
    </div>
  {/if}
</section>
