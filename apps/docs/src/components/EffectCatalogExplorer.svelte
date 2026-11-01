<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { EFFECT_CATEGORY_GROUPS, EFFECT_META, effectTags, findEffectMeta, normaliseTag, type EffectCategory, type EffectMeta } from "@pixerate/flair/catalog/lazy";
  import recentEffects from "../data/recent-effects.generated.json";
  import EffectPreviewCard from "./EffectPreviewCard.svelte";
  import EffectDetail from "./EffectDetail.svelte";

  /** Show the section heading (off where the page has its own). */
  export let heading = true;

  const PAGE = 24;
  const NEW = "New";
  const recentIds: string[] = recentEffects.map((e: { id: string }) => e.id);
  /** The latest additions, badged wherever they show, not only under "New". */
  const isNew = new Set(recentIds);

  let text = "";
  /** Tags every effect shown must have. */
  let tags: string[] = [];
  let group = "All";
  let category: EffectCategory | "all" = "all";
  let kind: "all" | "shader" | "vector" | "camera" = "all";
  let limit = PAGE;
  let hoveredId: string | null = null;
  let selected: EffectMeta | null = null;
  let searchEl: HTMLInputElement;
  let sentinel: HTMLDivElement;
  let more: IntersectionObserver | null = null;
  /** Whether the page's hash has been read, so the list's hash is not written over it first. */
  let ready = false;

  /** Tag suggestions shown for what is typed. */
  const SUGGESTED = 6;

  const KINDS: [typeof kind, string][] = [["all", "All"], ["shader", "Shaders"], ["vector", "SVG"], ["camera", "Camera"]];
  const groups = ["All", NEW, ...EFFECT_CATEGORY_GROUPS.map((g) => g.name)];

  function query(g: string, c: EffectCategory | "all" = "all"): EffectMeta[] {
    const base = { text: words, ...(kind === "all" ? {} : { kind }), ...(tags.length ? { tags } : {}) };
    if (g === NEW) {
      const found = new Set(findEffectMeta(base).map((e) => e.id));
      return recentIds.filter((id) => found.has(id)).map((id) => EFFECT_META.find((e) => e.id === id)!);
    }
    return findEffectMeta({ ...base, ...(g === "All" ? {} : { group: g }), ...(c === "all" ? {} : { category: c }) });
  }

  /** What is typed, less a leading "#" (which looks for tags). */
  $: words = text.trim().replace(/^#/, "");
  $: results = (words, kind, tags, query(group, category));
  $: counts = (words, kind, tags, Object.fromEntries(groups.map((g) => [g, query(g).length])));
  /** Tags of the effects in view whose name has what is typed in it, the most used first. */
  $: suggestions = words
    ? effectTags({ ...(kind === "all" ? {} : { kind }), ...(tags.length ? { tags } : {}) })
        .filter((t) => !tags.includes(t.tag) && t.tag.includes(normaliseTag(words)))
        .slice(0, SUGGESTED)
    : [];
  $: listHash(tags);
  $: categories = EFFECT_CATEGORY_GROUPS.find((g) => g.name === group)?.categories ?? [];
  $: (text, tags, group, category, kind, (limit = PAGE));
  $: shown = results.slice(0, limit);
  $: position = selected ? results.findIndex((e) => e.id === selected!.id) : -1;

  function pickGroup(g: string) {
    group = g;
    category = "all";
  }

  function addTag(tag: string) {
    if (!tags.includes(tag)) tags = [...tags, tag];
    text = "";
  }

  function removeTag(tag: string) {
    tags = tags.filter((t) => t !== tag);
  }

  /** From an effect's sheet: every effect with this tag. */
  function onlyTag(tag: string) {
    selected = null;
    text = "";
    tags = [tag];
    kind = "all";
    pickGroup("All");
    document.getElementById("effects")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /** The list's own hash: `#effects?tag=glass,hover`, so a tag search can be shared. */
  function listHash(_: string[]) {
    if (!ready || selected) return;
    const hash = tags.length ? `#effects?tag=${tags.map(encodeURIComponent).join(",")}` : "";
    if (hash !== location.hash && (hash || location.hash.startsWith("#effects?"))) history.replaceState(null, "", hash || location.pathname + location.search);
  }

  function onSearchKey(e: KeyboardEvent) {
    if (e.key === "Enter" && text.trim().startsWith("#") && suggestions[0]) addTag(suggestions[0].tag);
    else if (e.key === "Backspace" && !text && tags.length) tags = tags.slice(0, -1);
  }

  function clearFilters() {
    text = "";
    tags = [];
    kind = "all";
    pickGroup("All");
  }

  function open(effect: EffectMeta) {
    selected = effect;
    history.replaceState(null, "", `#effect/${effect.id}`);
  }

  function close() {
    selected = null;
    history.replaceState(null, "", location.pathname + location.search);
    listHash(tags);
  }

  function step(by: number) {
    const list = position >= 0 ? results : EFFECT_META;
    const at = list.findIndex((e) => e.id === selected?.id);
    const next = list[(at + by + list.length) % list.length];
    if (next) open(next);
  }

  /** `#effect/<id>` opens that effect (the hero links here); `#effects?q=fire` searches; `#effects?tag=glass,hover` shows effects with those tags. */
  async function fromHash() {
    const params = location.hash.startsWith("#effects?") ? new URLSearchParams(location.hash.slice("#effects?".length)) : null;
    if (params) {
      const known = new Set(effectTags().map((t) => t.tag));
      const wanted = (params.get("tag") ?? "").split(",").map(normaliseTag).filter((t) => known.has(t));
      if (wanted.join() !== tags.join()) tags = wanted;
      if (params.has("q")) text = params.get("q") ?? "";
      return;
    }
    const effectId = location.hash.match(/^#effect\/([a-z0-9-]+)/)?.[1];
    const found = effectId && EFFECT_META.find((e) => e.id === effectId);
    if (found) {
      selected = found;
      await tick();
      document.getElementById("effects")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function onKey(e: KeyboardEvent) {
    const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (e.key === "/" && !typing && !selected) {
      e.preventDefault();
      searchEl.focus();
    }
  }

  onMount(async () => {
    await fromHash();
    ready = true;
    window.addEventListener("hashchange", fromHash);
    more = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && limit < results.length) limit += PAGE;
    }, { rootMargin: "600px 0px" });
    more.observe(sentinel);
  });

  onDestroy(() => {
    if (typeof window !== "undefined") window.removeEventListener("hashchange", fromHash);
    more?.disconnect();
  });

  const chip = (on: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] transition ${
      on ? "border-transparent bg-[var(--flair-ink)] text-[var(--flair-page)]" : "border-[var(--flair-line)] text-muted hover:border-[var(--flair-line-strong)] hover:text-ink"
    }`;
</script>

<svelte:window on:keydown={onKey} />

<section id="effects" class="mx-auto max-w-7xl scroll-mt-24 px-4 py-16">
  {#if heading}
    <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
      <h2 class="m-0 text-3xl font-semibold tracking-tight text-ink md:text-4xl">Effects</h2>
      <p class="m-0 text-sm text-muted">{EFFECT_META.length} shaders and animated SVGs, each with controls and presets.</p>
    </div>
  {/if}

  <!-- One bar: search, kind. -->
  <div class="glass sticky top-[calc(var(--sl-nav-height,3.5rem)+0.75rem)] z-20 flex items-center gap-2 rounded-2xl p-1.5 shadow-lg shadow-black/5">
    <svg class="ml-3 shrink-0 text-faint" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
    <input
      bind:this={searchEl}
      bind:value={text}
      type="search"
      placeholder="Search effects, or #tag"
      aria-label="Search effects"
      class="min-w-0 flex-1 border-0 bg-transparent px-1 py-2 text-[15px] text-ink placeholder:text-faint focus:outline-none"
      on:keydown={onSearchKey}
    />
    <kbd class="hidden rounded-md border border-[var(--flair-line)] px-1.5 py-0.5 font-mono text-[11px] text-faint md:block">/</kbd>
    <div class="flex shrink-0 rounded-xl bg-[var(--flair-glass)] p-0.5" role="group" aria-label="Kind">
      {#each KINDS as [value, label]}
        <button
          on:click={() => (kind = value)}
          aria-pressed={kind === value}
          class="rounded-[10px] px-3 py-1.5 text-xs transition {kind === value ? 'bg-[var(--flair-glass-hover)] text-ink shadow-sm' : 'text-muted hover:text-ink'}"
        >
          {label}
        </button>
      {/each}
    </div>
  </div>

  <!-- The tags searched by, then tags for what is typed. -->
  {#if tags.length || suggestions.length}
    <div class="-mx-4 mt-3 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="Tags">
      {#each tags as tag (tag)}
        <button class="{chip(true)} !py-1 !text-xs" aria-label="Remove tag {tag}" on:click={() => removeTag(tag)}>
          #{tag} <span class="ml-1 opacity-60" aria-hidden="true">✕</span>
        </button>
      {/each}
      {#each suggestions as { tag, count } (tag)}
        <button class="{chip(false)} !py-1 !text-xs" title="Only effects tagged {tag}" on:click={() => addTag(tag)}>
          #{tag} <span class="ml-0.5 opacity-50">{count}</span>
        </button>
      {/each}
    </div>
  {/if}

  <!-- Groups, then the categories of the chosen group. -->
  <div class="-mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="Groups">
    {#each groups as g}
      <button class={chip(group === g)} aria-pressed={group === g} on:click={() => pickGroup(g)}>
        {g} <span class="ml-0.5 opacity-50">{counts[g]}</span>
      </button>
    {/each}
  </div>
  {#if categories.length > 1}
    <div class="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="{group} categories">
      {#each ["all" as const, ...categories] as c}
        <button class="{chip(category === c)} !py-1 !text-xs" aria-pressed={category === c} on:click={() => (category = c)}>
          {c === "all" ? `All ${group.toLowerCase()}` : c}
        </button>
      {/each}
    </div>
  {/if}

  {#if results.length === 0}
    <p class="py-24 text-center text-muted">
      Nothing matches {[words && `“${words}”`, ...tags.map((t) => `#${t}`)].filter(Boolean).join(" and ") || "these filters"}. <button class="text-ink underline" on:click={clearFilters}>Clear filters</button>
    </p>
  {:else}
    <div class="mt-8 grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {#each shown as effect (effect.id)}
        <button
          id={`explorer-${effect.id}`}
          class="group text-left"
          title={effect.description}
          on:click={() => open(effect)}
          on:pointerenter={() => (hoveredId = effect.id)}
          on:pointerleave={() => (hoveredId = null)}
        >
          <div class="relative aspect-video overflow-hidden rounded-2xl ring-1 ring-[var(--flair-line)] transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-xl group-hover:shadow-black/20 group-hover:ring-[var(--flair-line-strong)] group-focus-visible:ring-2 group-focus-visible:ring-violet-400">
            <EffectPreviewCard effectMeta={effect} hovered={hoveredId === effect.id} />
            {#if isNew.has(effect.id)}
              <span class="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0c0c14] shadow-sm backdrop-blur-md">New</span>
            {/if}
            {#if effect.trigger}
              <span class="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white backdrop-blur-md">{effect.trigger}</span>
            {/if}
          </div>
          <div class="mt-2.5 flex items-baseline justify-between gap-3 px-0.5">
            <h3 class="m-0 truncate text-sm font-medium text-ink">{effect.name}</h3>
            <span class="shrink-0 text-[11px] text-faint">{effect.category}</span>
          </div>
        </button>
      {/each}
    </div>
  {/if}
  <div bind:this={sentinel} aria-hidden="true" class="h-px"></div>
  {#if limit < results.length}
    <div class="mt-10 text-center">
      <button class="glass rounded-full px-5 py-2 text-sm text-muted hover:text-ink" on:click={() => (limit += PAGE * 2)}>
        Show more <span class="opacity-50">· {results.length - limit} left</span>
      </button>
    </div>
  {/if}
</section>

{#if selected}
  <EffectDetail meta={selected} isNew={isNew.has(selected.id)} position={position} total={position >= 0 ? results.length : 0} on:close={close} on:step={(e) => step(e.detail)} on:tag={(e) => onlyTag(e.detail)} />
{/if}
