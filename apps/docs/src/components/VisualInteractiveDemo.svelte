<script lang="ts">
  import { onMount } from "svelte";

  let pointerPos = { x: 50, y: 50 };
  let isHovered = false;
  let clickCount = 0;

  function handleMouseMove(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    pointerPos = {
      x: Math.round(((e.clientX - rect.left) / rect.width) * 100),
      y: Math.round(((e.clientY - rect.top) / rect.height) * 100),
    };
  }

  function handleClick() {
    clickCount += 1;
  }
</script>

<div class="w-full my-12 p-6 md:p-8 rounded-2xl bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
  <div class="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
    <div>
      <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-mono uppercase tracking-wider mb-2">
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
        Interactive Shader Canvas Demo
      </div>
      <h3 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
        Real-Time Uniforms & Interactive Input
      </h3>
      <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
        Hover and click the canvas below. Flair shaders receive pointer positions, trail history, clicks, audio, and scroll data automatically.
      </p>
    </div>

    <!-- Live Uniform Values Readout -->
    <div class="flex items-center gap-4 bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl font-mono text-xs">
      <div>
        <div class="text-[10px] text-slate-500">iPointer.xy</div>
        <div class="text-purple-600 dark:text-purple-400 font-bold">{pointerPos.x}%, {pointerPos.y}%</div>
      </div>
      <div class="h-6 w-[1px] bg-slate-300 dark:bg-slate-700"></div>
      <div>
        <div class="text-[10px] text-slate-500">iClicks</div>
        <div class="text-emerald-600 dark:text-emerald-400 font-bold">{clickCount}</div>
      </div>
    </div>
  </div>

  <!-- Interactive Canvas Mockup -->
  <div
    on:mousemove={handleMouseMove}
    on:mouseenter={() => (isHovered = true)}
    on:mouseleave={() => (isHovered = false)}
    on:click={handleClick}
    class="relative w-full h-64 md:h-80 my-6 rounded-xl overflow-hidden cursor-crosshair border border-slate-300 dark:border-slate-700 bg-slate-950 flex items-center justify-center select-none"
  >
    <!-- Background grid -->
    <div
      class="absolute inset-0 opacity-20"
      style="background-image: radial-gradient(#8b5cf6 1px, transparent 1px); background-size: 24px 24px;"
    ></div>

    <!-- Interactive glowing cursor trail -->
    <div
      class="absolute w-48 h-48 rounded-full pointer-events-none transition-transform duration-75 blur-2xl opacity-60"
      style="background: radial-gradient(circle, #ec4899 0%, #8b5cf6 50%, transparent 70%); left: calc({pointerPos.x}% - 96px); top: calc({pointerPos.y}% - 96px);"
    ></div>

    <!-- Center content -->
    <div class="relative z-10 text-center pointer-events-none">
      <div class="font-mono text-xs text-purple-400 mb-1">Interactive Shader Viewport</div>
      <div class="text-lg md:text-xl font-bold text-white">Move pointer to test reactive uniforms</div>
      <div class="text-xs text-slate-400 mt-2">Click to register uniform click events</div>
    </div>
  </div>
</div>
