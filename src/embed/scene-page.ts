/**
 * The standalone scene page's script (see `standaloneSceneHtml`): it reads
 * the scene's plan from the page, draws it with a {@link SceneCompositor}
 * on the page's clock, and wires the play, previous, next and timeline
 * controls. Bundled into `src/scene/runtime.generated.ts` by `pnpm scene:runtime`.
 */

import type { ScenePlan } from "../scene/plan-types.js";
import { SceneCompositor, shotIndexAt } from "./compositor.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function main() {
  const plan = JSON.parse($("flair-scene-plan").textContent ?? "{}") as ScenePlan;
  for (const note of plan.notes ?? []) console.warn(`Flair: ${note}`);
  const canvas = $<HTMLCanvasElement>("scene");
  const play = $<HTMLButtonElement>("playBtn");
  const prev = $<HTMLButtonElement>("prevBtn");
  const next = $<HTMLButtonElement>("nextBtn");
  const timeline = $("timeline");
  const progress = $("progress");
  const badge = $("shotBadge");
  const status = $("status");

  const compositor = new SceneCompositor(plan, { canvas, exact: false });
  try {
    await compositor.ready();
  } catch (e) {
    status.textContent = (e as Error).message;
    status.hidden = false;
  }

  let time = 0;
  let from = 0;
  let playing = false;
  let drawing = false;
  const end = Math.max(1, plan.durationMs);

  const show = async () => {
    if (drawing) return;
    drawing = true;
    try {
      await compositor.draw(time);
    } catch (e) {
      status.textContent = (e as Error).message;
      status.hidden = false;
    }
    drawing = false;
    const shot = shotIndexAt(plan, time);
    badge.textContent = `Shot ${shot + 1} / ${plan.shots.length}`;
    progress.style.width = `${(time / end) * 100}%`;
  };

  const tick = async () => {
    if (!playing) return;
    time = Math.min(end - 1, performance.now() - from);
    await show();
    if (time >= end - 1) {
      playing = false;
      play.textContent = "Play";
      return;
    }
    requestAnimationFrame(tick);
  };

  const seek = (ms: number) => {
    time = Math.min(Math.max(0, ms), end - 1);
    from = performance.now() - time;
    if (!playing) void show();
  };

  play.addEventListener("click", () => {
    playing = !playing;
    play.textContent = playing ? "Pause" : "Play";
    if (playing) {
      if (time >= end - 1) time = 0;
      from = performance.now() - time;
      requestAnimationFrame(tick);
    }
  });
  // Back to the start of this shot (or the one before, when at its start); on to the next shot's start.
  prev.addEventListener("click", () => {
    const shot = shotIndexAt(plan, time);
    const start = plan.shots[shot]!.startMs;
    seek(time - start > 300 || shot === 0 ? start : plan.shots[shot - 1]!.startMs);
  });
  next.addEventListener("click", () => {
    const shot = shotIndexAt(plan, time);
    if (shot < plan.shots.length - 1) seek(plan.shots[shot + 1]!.startMs);
  });
  timeline.addEventListener("click", (event) => {
    const box = timeline.getBoundingClientRect();
    seek(((event.clientX - box.left) / box.width) * end);
  });
  await show();
}

void main();
