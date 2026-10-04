import type { Scene } from './types.js';

/**
 * Generates a self-contained, standalone HTML player for an animated scene.
 * Includes interactive playback controls, camera panning/zooming, title and caption rendering,
 * and embedded WebGL fragment shaders for bespoke motion graphics.
 */
export function standaloneSceneHtml(scene: Scene): string {
  const serializedScene = JSON.stringify(scene).replace(/</g, '\\u003c');
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
      aspect-ratio: 16 / 9;
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
      <canvas id="sceneCanvas" class="layer"></canvas>
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
    let shotStartTime = 0;
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

    function draw() {
      const now = performance.now() / 1000;
      renderShader(now);

      ctx.clearRect(0, 0, sceneCanvas.width, sceneCanvas.height);
      ctx.save();
      const shot = scene.shots[currentShotIdx];

      // Draw shot elements
      if (shot && shot.run) {
        for (const cmd of shot.run) {
          if (cmd.type === 'element' && cmd.element) {
            const el = cmd.element;
            ctx.fillStyle = el.backgroundColor || 'rgba(59, 130, 246, 0.4)';
            ctx.strokeStyle = el.strokeColor || '#3b82f6';
            ctx.lineWidth = 3;
            ctx.strokeRect(el.x, el.y, el.width, el.height);
            ctx.fillRect(el.x, el.y, el.width, el.height);

            if (el.text) {
              ctx.fillStyle = '#fff';
              ctx.font = '24px sans-serif';
              ctx.fillText(el.text, el.x + 16, el.y + 40);
            }
          }
        }
      }
      ctx.restore();

      if (isPlaying) {
        requestAnimationFrame(draw);
      }
    }

    playBtn.addEventListener('click', () => {
      isPlaying = !isPlaying;
      playBtn.textContent = isPlaying ? 'Pause' : 'Play';
      if (isPlaying) requestAnimationFrame(draw);
    });

    prevBtn.addEventListener('click', () => {
      if (currentShotIdx > 0) {
        currentShotIdx--;
        updateShotUI();
        draw();
      }
    });

    nextBtn.addEventListener('click', () => {
      if (currentShotIdx < scene.shots.length - 1) {
        currentShotIdx++;
        updateShotUI();
        draw();
      }
    });

    updateShotUI();
    draw();
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
