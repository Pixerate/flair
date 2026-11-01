import type { SceneSubject } from './layers.js';
import { scenePlan } from './plan.js';
import type { Scene } from './types.js';

export interface StandaloneSceneOptions {
  /**
   * What fills the scene's slots, written as a scene would (a picture or
   * video URL, SVG markup, words); a slot left out shows nothing.
   */
  subjects?: Record<string, SceneSubject>;
  /** The rate the camera is keyed at (default 30). */
  fps?: number;
}

/** JSON that is safe inside a `<script>`: a `</script>` or `<!--` in a value cannot end it. */
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

/**
 * A self-contained HTML page that plays a scene: its {@link ScenePlan}
 * (only the effects the scene uses, as data) and the scene compositor, so
 * shader and vector layers, pictures, transitions, camera moves (3D angles
 * and motion blur included), titles and captions all play on the scene's
 * clock, with play, previous, next and a timeline. It has no dependencies
 * and opens from disk; pictures and videos by URL need the network (and
 * CORS, from another site).
 */
export async function standaloneSceneHtml(scene: Scene, options: StandaloneSceneOptions = {}): Promise<string> {
  const plan = await scenePlan(scene, { ...(options.subjects ? { subjects: options.subjects } : {}), ...(options.fps ? { fps: options.fps } : {}) });
  const { SCENE_RUNTIME } = await import('./runtime.generated.js');
  const { stage } = plan;
  const title = scene.title || scene.name;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Flair</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0f1117;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px;
      user-select: none;
    }
    .player-container {
      position: relative;
      width: 100%;
      max-width: 1200px;
      aspect-ratio: ${stage.width} / ${stage.height};
      background: #000;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1);
    }
    #scene { display: block; width: 100%; height: 100%; }
    .status {
      position: absolute;
      top: 16px;
      left: 16px;
      right: 16px;
      background: rgba(127, 29, 29, 0.9);
      color: #fff;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 0.9rem;
    }
    .controls-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 52px;
      background: linear-gradient(to top, rgba(0, 0, 0, 0.9), transparent);
      display: flex;
      align-items: center;
      padding: 0 16px;
      gap: 12px;
      z-index: 10;
    }
    .btn {
      background: rgba(255, 255, 255, 0.15);
      border: none;
      color: #fff;
      padding: 6px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      transition: background 0.15s;
    }
    .btn:hover { background: rgba(255, 255, 255, 0.25); }
    .timeline {
      flex: 1;
      height: 6px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      cursor: pointer;
      position: relative;
    }
    .timeline-progress {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      background: #3b82f6;
      border-radius: 3px;
      width: 0%;
    }
    .shot-badge {
      font-size: 0.85rem;
      color: #94a3b8;
      font-variant-numeric: tabular-nums;
    }
  </style>
</head>
<body>
  <div class="player-container">
    <canvas id="scene" width="${stage.width}" height="${stage.height}"></canvas>
    <div id="status" class="status" role="alert" hidden></div>
    <div class="controls-bar">
      <button id="playBtn" class="btn">Play</button>
      <button id="prevBtn" class="btn" aria-label="Previous shot">⏮</button>
      <button id="nextBtn" class="btn" aria-label="Next shot">⏭</button>
      <div id="timeline" class="timeline">
        <div id="progress" class="timeline-progress"></div>
      </div>
      <div id="shotBadge" class="shot-badge">Shot 1 / ${plan.shots.length}</div>
    </div>
  </div>
  <script type="application/json" id="flair-scene-plan">${scriptJson(plan)}</script>
  <script>
// Exported with Flair: the scene compositor, drawing the plan above on the scene's clock.
${SCENE_RUNTIME.replace(/<\/script/gi, '<\\/script')}
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
