<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { cameraAt, cameraBlur, cameraTrack, cameraTransform, sceneStage, SvgPlayer, type Scene, type SceneElement } from "@pixerate/flair";
  import { effectDefaults, getEffect, renderVectorEffect } from "@pixerate/flair/catalog";

  /** A dashboard laid out on a 1920×1080 stage, the way the product videos' screens are. */
  const DASHBOARD: SceneElement[] = [
    { id: "nav", type: "panel", x: 60, y: 60, width: 250, height: 960, text: "Projects", fontSize: 30 },
    { id: "graph", type: "graph", x: 370, y: 60, width: 960, height: 560, text: "Critical path", fontSize: 30 },
    { id: "velocity", type: "chart", x: 1390, y: 60, width: 470, height: 560, text: "Velocity", fontSize: 30 },
    { id: "todo", type: "card", x: 370, y: 680, width: 450, height: 340, text: "To do", fontSize: 30 },
    { id: "doing", type: "card", x: 880, y: 680, width: 450, height: 340, text: "In progress", fontSize: 30 },
    { id: "done", type: "card", x: 1390, y: 680, width: 470, height: 340, text: "Done", fontSize: 30 },
  ];
  const place = (elements: SceneElement[]) => elements.map((element) => ({ type: "element" as const, element }));
  const WIDE = { x: 0, y: 0, width: 1920, height: 1080 };

  /** The same moves the GitHub Pages gallery shows. */
  const MOVES: { name: string; about: string; scene: Scene }[] = [
    {
      name: "Swoop",
      about: "Leans the dashboard back and swings it round as it dives onto the graph, blurring on the way.",
      scene: {
        name: "swoop",
        shots: [
          { title: "Dashboard", camera: WIDE, hold: 900, run: place(DASHBOARD) },
          { title: "Tilt in", camera: { frame: ["graph"], tilt: 32, turn: -16, motionBlur: 1.5 }, hold: 1600 },
          { title: "Across", camera: { frame: ["velocity"], tilt: 24, turn: 18, motionBlur: 1.5 }, hold: 1200 },
          { title: "Flat", camera: { ...WIDE, tilt: 0, turn: 0, motionBlur: 1 }, hold: 900 },
        ],
      },
    },
    {
      name: "Whip pans",
      about: "Fast flat pans between the cards: the blur streaks along each move and is gone when the camera lands.",
      scene: {
        name: "whip",
        shots: [
          { title: "To do", camera: { frame: ["todo"], padding: 0.3 }, hold: 900, run: place(DASHBOARD) },
          { title: "In progress", camera: { frame: ["doing"], padding: 0.3, motionBlur: 3 }, hold: 900 },
          { title: "Done", camera: { frame: ["done"], padding: 0.3, motionBlur: 3 }, hold: 900 },
          { title: "Velocity", camera: { frame: ["velocity"], padding: 0.2, motionBlur: 3 }, hold: 900 },
        ],
      },
    },
    {
      name: "Rolling reveal",
      about: "Starts close, tipped and rolled with a short lens, then rolls level as it pulls back to the whole board.",
      scene: {
        name: "roll",
        shots: [
          { title: "Close", camera: { frame: ["graph"], padding: 0.05, tilt: 40, roll: -14, perspective: 0.7 }, hold: 1100, run: place(DASHBOARD) },
          { title: "Pull back", camera: { ...WIDE, tilt: 12, roll: 0, perspective: 1.2, motionBlur: 1 }, hold: 1100 },
          { title: "Level", camera: { ...WIDE, tilt: 0, motionBlur: 0.5 }, hold: 900 },
        ],
      },
    },
  ];

  const LOOKS: Record<string, string> = {
    panel: "bg-white/[0.06] border-white/15",
    graph: "bg-[#0B1220] border-teal-400/60",
    chart: "bg-[#150f2e] border-violet-400/60",
    card: "bg-white/[0.06] border-amber-300/50",
  };
  const BARS = [40, 65, 50, 85, 70, 95];

  let selected = 0;
  let frameEl: HTMLDivElement;
  let boardEl: HTMLDivElement;
  let contentEl: HTMLDivElement;
  let blurEl: SVGFEGaussianBlurElement;
  let graphEl: HTMLDivElement | null = null;
  let graph: SvgPlayer | null = null;
  let shot = 0;
  let raf = 0;
  let visible = false;
  let width = 1;
  let started = 0;
  let resize: ResizeObserver | null = null;
  let visibility: IntersectionObserver | null = null;
  const filterId = `camera-blur-${Math.random().toString(36).slice(2, 8)}`;

  $: move = MOVES[selected]!;
  $: stage = sceneStage(move.scene);
  $: track = cameraTrack(move.scene);
  $: total = track.reduce((ms, e) => ms + e.moveMs + e.holdMs, 0);
  $: entry = track[shot] ?? track[0]!;
  $: shots = JSON.stringify(move.scene.shots.map(({ title, camera }) => ({ title, camera })), null, 1);
  $: (selected, (started = performance.now()), (shot = 0));
  $: mountGraph(graphEl);

  /** The flow-network effect, playing inside the graph card. */
  function mountGraph(host: HTMLDivElement | null) {
    graph?.dispose();
    graph = null;
    const effect = getEffect("flow-network");
    if (!host || effect?.kind !== "vector") return;
    graph = new SvgPlayer(host, renderVectorEffect(effect, effectDefaults(effect)), { hold: effect.hold, pauseWhenHidden: true });
  }

  /**
   * Plays the camera on the DOM board: `cameraAt` gives the view at a time,
   * which becomes the board's zoom and scroll, `cameraTransform` (its 3D
   * angle) and `cameraBlur` (an SVG blur that streaks along a pan).
   */
  function draw(now: number) {
    const t = (now - started) % total;
    const at = [...track].reverse().find((e) => e.startMs <= t) ?? track[0]!;
    const view = cameraAt(at, t - at.startMs, stage);
    const k = width / stage.width;
    contentEl.style.transform = `scale(${k * view.zoom}) translate(${view.scrollX}px, ${view.scrollY}px)`;
    boardEl.style.transform = cameraTransform(view, stage, width);
    const [sx, sy] = cameraBlur(view, stage, width);
    blurEl.setAttribute("stdDeviation", `${sx} ${sy}`);
    boardEl.style.filter = sx > 0 ? `url(#${filterId})` : "none";
    if (shot !== at.index) shot = at.index;
    raf = requestAnimationFrame(draw);
  }

  onMount(() => {
    started = performance.now();
    // Measured on resize, not every frame: reading layout after writing transforms forces a layout per frame.
    width = frameEl.clientWidth;
    resize = new ResizeObserver(([e]) => e && (width = e.contentRect.width));
    resize.observe(frameEl);
    // Only plays while on screen.
    visibility = new IntersectionObserver(([e]) => {
      visible = Boolean(e?.isIntersecting);
      cancelAnimationFrame(raf);
      raf = visible ? requestAnimationFrame(draw) : 0;
    });
    visibility.observe(frameEl);
  });

  onDestroy(() => {
    if (typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(raf);
    resize?.disconnect();
    visibility?.disconnect();
    graph?.dispose();
  });
</script>

<section class="mx-auto max-w-5xl px-4 py-16">
  <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h2 class="m-0 text-3xl font-semibold tracking-tight text-ink md:text-4xl">Camera moves</h2>
      <p class="mt-2 max-w-xl text-sm text-muted">Scene shots tilt, turn and roll the camera in 3D, and blur while it moves.</p>
    </div>
    <div class="glass flex rounded-full p-1" role="group" aria-label="Camera moves">
      {#each MOVES as m, i}
        <button
          on:click={() => (selected = i)}
          aria-pressed={selected === i}
          class="rounded-full px-3.5 py-1.5 text-xs transition {selected === i ? 'bg-[var(--flair-ink)] text-[var(--flair-page)]' : 'text-muted hover:text-[var(--flair-ink)]'}"
        >
          {m.name}
        </button>
      {/each}
    </div>
  </div>

  <div class="glass overflow-hidden rounded-3xl p-2">
    <div bind:this={frameEl} class="relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-b from-[#0b0b12] to-[#0d1222]">
      <svg width="0" height="0" class="absolute" aria-hidden="true">
        <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur bind:this={blurEl} stdDeviation="0 0" />
        </filter>
      </svg>
      <div bind:this={boardEl} class="absolute inset-0" style="transform-origin: 50% 50%">
        <div bind:this={contentEl} class="absolute left-0 top-0" style="width: {stage.width}px; height: {stage.height}px; transform-origin: 0 0">
          {#each entry.elements as element (element.id)}
            <div
              class="absolute overflow-hidden rounded-[18px] border-[3px] {LOOKS[element.type] ?? LOOKS.card}"
              style="left: {element.x}px; top: {element.y}px; width: {element.width}px; height: {element.height}px"
            >
              <span class="absolute left-6 top-4 font-semibold text-slate-100" style="font-size: {element.fontSize}px">{element.text}</span>
              {#if element.type === "graph"}
                <div bind:this={graphEl} class="absolute inset-[10%_4%_4%]"></div>
              {:else if element.type === "chart"}
                <div class="absolute inset-x-[8%] bottom-[8%] top-[22%] flex items-end gap-[4%]">
                  {#each BARS as h}
                    <div class="flex-1 rounded-t bg-violet-400/80" style="height: {h}%"></div>
                  {/each}
                </div>
              {:else if element.type === "card"}
                {#each [0, 1, 2] as i}
                  <div class="absolute left-6 right-6 h-[16%] rounded-lg bg-white/10" style="top: {26 + i * 22}%"></div>
                {/each}
              {/if}
            </div>
          {/each}
        </div>
      </div>
      {#if entry.shot.title}
        <span class="glass-on-dark absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px]">{entry.index + 1}. {entry.shot.title}</span>
      {/if}
    </div>

    <div class="flex flex-col gap-3 px-3 pb-2 pt-4 md:flex-row md:items-start md:justify-between">
      <p class="m-0 max-w-md text-sm text-muted">{move.about}</p>
      <details class="text-xs text-faint md:max-w-[50%]">
        <summary class="cursor-pointer select-none hover:text-[var(--flair-ink)]">Shots</summary>
        <pre class="mt-2 max-h-56 overflow-auto rounded-xl bg-[#0b0b12] p-3 text-[11px] leading-relaxed text-slate-300">{shots}</pre>
      </details>
    </div>
  </div>
</section>
