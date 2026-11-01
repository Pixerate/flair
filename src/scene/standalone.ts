import { CAMERA_STEPS, type Stage, type View } from './camera.js';
import { cameraAt, cameraTrack, sceneStage } from './cameratrack.js';
import type { SceneElement } from './geometry.js';
import type { Scene } from './types.js';

/** What the standalone player shows for one shot: the camera's move into it, its move while it holds, and the elements on stage. */
interface ShotPlan {
  /** The camera at each step of its move into the shot (one view when it does not move). */
  move: View[];
  /** How long the move takes, in ms (0 when the shot cuts or stays). */
  moveMs: number;
  /** The camera at each step through the hold, when it moves while the shot holds (`camera.during`). */
  hold?: View[];
  holdMs: number;
  elements: SceneElement[];
}

/** The steps a hold's camera move is drawn in: one every 50 ms, as `playScene` steps it. */
const HOLD_STEP_MS = 50;

/** Each shot's camera moves and elements, worked out the way `playScene` plays them. */
function planShots(scene: Scene, stage: Stage): ShotPlan[] {
  return cameraTrack(scene).map((entry) => {
    // The player's steps: the last one lands on the shot's view, with no blur.
    const move = entry.moveMs > 0 ? Array.from({ length: CAMERA_STEPS - 1 }, (_, i) => cameraAt(entry, ((i + 1) / CAMERA_STEPS) * entry.moveMs, stage)) : [];
    move.push(entry.to);
    const steps = Math.max(1, Math.round(entry.holdMs / HOLD_STEP_MS));
    const hold = entry.during ? Array.from({ length: steps }, (_, i) => cameraAt(entry, entry.moveMs + ((i + 1) / steps) * entry.holdMs, stage)) : undefined;
    return { move, moveMs: entry.moveMs, ...(hold ? { hold } : {}), holdMs: entry.holdMs, elements: entry.elements };
  });
}

/**
 * Generates a self-contained, standalone HTML player for an animated scene.
 * Includes interactive playback controls, camera moves (panning, zooming,
 * 3D angles and motion blur), title and caption rendering, and embedded
 * WebGL fragment shaders for bespoke motion graphics.
 */
export function standaloneSceneHtml(scene: Scene): string {
  const stage = sceneStage(scene);
  const serializedScene = JSON.stringify(scene).replace(/</g, '\\u003c');
  const serializedPlan = JSON.stringify({ stage, shots: planShots(scene, stage) }).replace(/</g, '\\u003c');
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
      display: flex;
      flex-direction: column;
    }
    .viewport {
      position: relative;
      flex: 1;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    .board {
      position: absolute;
      inset: 0;
      transform-origin: 50% 50%;
      will-change: transform, filter;
    }
    canvas.layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
    .overlay-title {
      position: absolute;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 17, 23, 0.85);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      padding: 8px 24px;
      border-radius: 9999px;
      font-size: 1.15rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: #fff;
      pointer-events: none;
      transition: opacity 0.3s ease;
      opacity: 0;
    }
    .overlay-caption {
      position: absolute;
      bottom: 64px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 17, 23, 0.88);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 1.1rem;
      color: #f1f5f9;
      max-width: 80%;
      text-align: center;
      pointer-events: none;
      transition: opacity 0.3s ease;
      opacity: 0;
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
    <div class="viewport" id="viewport">
      <canvas id="shaderCanvas" class="layer"></canvas>
      <div id="board" class="board"><canvas id="sceneCanvas" class="layer"></canvas></div>
      <svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="motionBlur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur id="motionBlurAmount" stdDeviation="0 0"/></filter></svg>
      <div id="titleEl" class="overlay-title"></div>
      <div id="captionEl" class="overlay-caption"></div>
    </div>
    <div class="controls-bar">
      <button id="playBtn" class="btn">Play</button>
      <button id="prevBtn" class="btn">⏮</button>
      <button id="nextBtn" class="btn">⏭</button>
      <div id="timeline" class="timeline">
        <div id="progress" class="timeline-progress"></div>
      </div>
      <div id="shotBadge" class="shot-badge">Shot 1 / 1</div>
    </div>
  </div>

  <script>
    const scene = ${serializedScene};
    // Each shot's camera move (zoom, scroll, 3D angle and blur at each step) and elements, worked out in advance.
    const plan = ${serializedPlan};
    const boardEl = document.getElementById('board');
    const sceneCanvas = document.getElementById('sceneCanvas');
    const shaderCanvas = document.getElementById('shaderCanvas');
    const ctx = sceneCanvas.getContext('2d');
    const titleEl = document.getElementById('titleEl');
    const captionEl = document.getElementById('captionEl');
    const playBtn = document.getElementById('playBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const progressEl = document.getElementById('progress');
    const shotBadge = document.getElementById('shotBadge');

    let currentShotIdx = 0;
    let isPlaying = false;
    let shotStartTime = performance.now();
    let moveFrom = performance.now();
    let gl = null;
    let shaderProgram = null;

    function resize() {
      const rect = sceneCanvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      sceneCanvas.width = rect.width * dpr;
      sceneCanvas.height = rect.height * dpr;
      shaderCanvas.width = rect.width * dpr;
      shaderCanvas.height = rect.height * dpr;
    }
    window.addEventListener('resize', resize);
    resize();

    // Setup WebGL if shader media is present
    const firstShaderKey = Object.keys(scene.media || {}).find(k => scene.media[k].type === 'shader');
    if (firstShaderKey && scene.media[firstShaderKey].source) {
      try {
        gl = shaderCanvas.getContext('webgl2');
        if (gl) {
          const vs = gl.createShader(gl.VERTEX_SHADER);
          gl.shaderSource(vs, '#version 300 es\\nin vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }');
          gl.compileShader(vs);

          const fs = gl.createShader(gl.FRAGMENT_SHADER);
          const fullFrag = '#version 300 es\\nprecision highp float;\\nout vec4 fragColor;\\nuniform vec2 u_resolution;\\nuniform float u_time;\\n' + scene.media[firstShaderKey].source + '\\nvoid main() { mainImage(fragColor, gl_FragCoord.xy); }';
          gl.shaderSource(fs, fullFrag);
          gl.compileShader(fs);

          shaderProgram = gl.createProgram();
          gl.attachShader(shaderProgram, vs);
          gl.attachShader(shaderProgram, fs);
          gl.linkProgram(shaderProgram);

          const quad = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, quad);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
          const pos = gl.getAttribLocation(shaderProgram, 'position');
          gl.enableVertexAttribArray(pos);
          gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
        }
      } catch (e) {
        console.warn('Shader setup failed:', e);
      }
    }

    function renderShader(timeSeconds) {
      if (!gl || !shaderProgram) return;
      gl.viewport(0, 0, shaderCanvas.width, shaderCanvas.height);
      gl.useProgram(shaderProgram);
      const resLoc = gl.getUniformLocation(shaderProgram, 'u_resolution');
      const timeLoc = gl.getUniformLocation(shaderProgram, 'u_time');
      if (resLoc) gl.uniform2f(resLoc, shaderCanvas.width, shaderCanvas.height);
      if (timeLoc) gl.uniform1f(timeLoc, timeSeconds);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function updateShotUI() {
      const shot = scene.shots[currentShotIdx];
      if (!shot) return;

      shotBadge.textContent = 'Shot ' + (currentShotIdx + 1) + ' / ' + scene.shots.length;

      if (shot.title) {
        titleEl.textContent = shot.title;
        titleEl.style.opacity = '1';
      } else {
        titleEl.style.opacity = '0';
      }

      if (shot.caption) {
        captionEl.textContent = shot.caption;
        captionEl.style.opacity = '1';
      } else {
        captionEl.style.opacity = '0';
      }

      const pct = (currentShotIdx / scene.shots.length) * 100;
      progressEl.style.width = pct + '%';
    }

    // The camera at time 'now': a step of the current shot's move, a step of its move while it holds, or where it settled.
    function cameraNow(now) {
      const { move, moveMs, hold, holdMs } = plan.shots[currentShotIdx];
      const t = now - moveFrom;
      if (hold && t >= moveMs && holdMs > 0) {
        const u = Math.min(1, (t - moveMs) / holdMs);
        return hold[Math.min(hold.length - 1, Math.max(0, Math.ceil(u * hold.length) - 1))];
      }
      const u = moveMs > 0 ? Math.min(1, t / moveMs) : 1;
      return move[Math.min(move.length - 1, Math.floor(u * move.length))];
    }

    function applyCamera(view) {
      const w = boardEl.clientWidth || plan.stage.width;
      const angled = view.tilt || view.turn || view.roll;
      boardEl.style.transform = angled
        ? 'perspective(' + (view.perspective || 1.2) * w + 'px) rotateX(' + (view.tilt || 0) + 'deg) rotateY(' + (view.turn || 0) + 'deg) rotateZ(' + (view.roll || 0) + 'deg)'
        : 'none';
      // Motion blur streaks along a pan (taken back through the roll, as the board is blurred before it turns).
      const blur = (view.blur || 0) * w / plan.stage.width;
      if (blur >= 0.05) {
        let sx = blur, sy = blur;
        if (view.blurAngle !== undefined) {
          const a = (view.blurAngle - (view.roll || 0)) * Math.PI / 180;
          sx = Math.max(blur * 0.15, blur * Math.abs(Math.cos(a)));
          sy = Math.max(blur * 0.15, blur * Math.abs(Math.sin(a)));
        }
        document.getElementById('motionBlurAmount').setAttribute('stdDeviation', sx.toFixed(2) + ' ' + sy.toFixed(2));
        boardEl.style.filter = 'url(#motionBlur)';
      } else {
        boardEl.style.filter = 'none';
      }
    }

    function draw() {
      const now = performance.now();
      renderShader(now / 1000);

      const view = cameraNow(now);
      applyCamera(view);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, sceneCanvas.width, sceneCanvas.height);
      const k = (sceneCanvas.width / plan.stage.width) * view.zoom;
      ctx.setTransform(k, 0, 0, k, k * view.scrollX, k * view.scrollY);

      for (const el of plan.shots[currentShotIdx].elements) {
        ctx.fillStyle = el.backgroundColor || 'rgba(59, 130, 246, 0.4)';
        ctx.strokeStyle = el.strokeColor || '#3b82f6';
        ctx.lineWidth = 3;
        ctx.fillRect(el.x, el.y, el.width, el.height);
        ctx.strokeRect(el.x, el.y, el.width, el.height);
        if (el.text) {
          ctx.fillStyle = '#fff';
          ctx.font = '24px sans-serif';
          ctx.fillText(el.text, el.x + 16, el.y + 40);
        }
      }

      // Playing moves on to the next shot once this one's move and hold are over.
      const shot = scene.shots[currentShotIdx];
      if (isPlaying && now - shotStartTime > plan.shots[currentShotIdx].moveMs + (shot.hold ?? 800) && currentShotIdx < scene.shots.length - 1) {
        goTo(currentShotIdx + 1, true);
      }
      if (isPlaying || now - moveFrom < plan.shots[currentShotIdx].moveMs) {
        requestAnimationFrame(draw);
      }
    }

    // Shows a shot: forwards it plays the camera's move into it, otherwise it cuts.
    function goTo(idx, animate) {
      currentShotIdx = idx;
      shotStartTime = performance.now();
      moveFrom = animate ? shotStartTime : shotStartTime - plan.shots[idx].moveMs;
      updateShotUI();
      requestAnimationFrame(draw);
    }

    playBtn.addEventListener('click', () => {
      isPlaying = !isPlaying;
      playBtn.textContent = isPlaying ? 'Pause' : 'Play';
      // The current shot counts as settled, so its hold runs from now.
      if (isPlaying) {
        shotStartTime = performance.now() - plan.shots[currentShotIdx].moveMs;
        requestAnimationFrame(draw);
      }
    });

    prevBtn.addEventListener('click', () => {
      if (currentShotIdx > 0) goTo(currentShotIdx - 1, false);
    });

    nextBtn.addEventListener('click', () => {
      if (currentShotIdx < scene.shots.length - 1) goTo(currentShotIdx + 1, true);
    });

    window.addEventListener('resize', () => requestAnimationFrame(draw));
    goTo(0, false);
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
