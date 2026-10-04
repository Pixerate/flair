import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { ControlValue } from '../shader/controls.js';

export interface ExportOptions {
  /** GLSL fragment shader source */
  source: string;
  /** Uniform values override */
  values?: Record<string, ControlValue>;
  /** Destination file path (.gif or .mp4) */
  outputPath: string;
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
  onProgress?: (frame: number, total: number) => void;
}

/**
 * Renders a shader animation frame-by-frame headlessly via hardware-accelerated WebGL2
 * and encodes to an animated GIF or MP4 video using ffmpeg.
 */
export async function exportMotionGraphic(options: ExportOptions): Promise<string> {
  const {
    source,
    values = {},
    outputPath,
    width = 720,
    height = 720,
    fps = 30,
    duration = 3,
    onProgress,
  } = options;

  const resolvedOut = path.resolve(process.cwd(), outputPath);
  const ext = path.extname(resolvedOut).toLowerCase();
  const isGif = ext === '.gif';
  const totalFrames = Math.max(1, Math.round(duration * fps));

  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });

  const ffmpegArgs = [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'png',
    '-r', String(fps),
    '-i', '-',
  ];

  if (isGif) {
    ffmpegArgs.push(
      '-vf',
      'split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3',
      resolvedOut
    );
  } else {
    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      resolvedOut
    );
  }

  const ffmpeg = spawn('ffmpeg', ffmpegArgs, { stdio: ['pipe', 'ignore', 'pipe'] });
  let ffmpegErr = '';
  ffmpeg.stderr.on('data', (d) => {
    ffmpegErr += d.toString();
  });

  return new Promise((resolve, reject) => {
    let currentFrame = 0;
    let chromeProc: any = null;

    ffmpeg.on('error', (err) => {
      cleanup();
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        cleanup();
        reject(new Error(`ffmpeg exited with code ${code}:\n${ffmpegErr}`));
      } else {
        cleanup();
        resolve(resolvedOut);
      }
    });

    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);

      if (url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderPageHtml(source, values, width, height, fps, totalFrames));
        return;
      }

      if (url.pathname === '/frame' && req.method === 'POST') {
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
          const buf = Buffer.concat(chunks);
          ffmpeg.stdin.write(buf);
          currentFrame++;
          onProgress?.(currentFrame, totalFrames);
          res.writeHead(200);
          res.end('ok');

          if (currentFrame >= totalFrames) {
            ffmpeg.stdin.end();
          }
        });
        return;
      }

      if (url.pathname === '/error' && req.method === 'POST') {
        let errStr = '';
        req.on('data', (c) => (errStr += c));
        req.on('end', () => {
          cleanup();
          reject(new Error(`Browser render error: ${errStr}`));
        });
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    function cleanup() {
      if (chromeProc) {
        try {
          chromeProc.kill();
        } catch {}
      }
      try {
        server.close();
      } catch {}
    }

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      const port = addr.port;

      const chromeBin =
        process.env.CHROME_BIN ||
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

      chromeProc = spawn(chromeBin, [
        '--headless=new',
        '--use-gl=angle',
        '--use-angle=metal',
        '--enable-webgl',
        '--disable-gpu-sandbox',
        `http://127.0.0.1:${port}/`,
      ]);

      chromeProc.on('error', (err: any) => {
        cleanup();
        reject(new Error(`Failed to launch Google Chrome: ${err.message}`));
      });
    });
  });
}

function prepareFragmentSource(source: string): string {
  const hasVersion = /^\s*#version\b/m.test(source);
  const hasMain = /\bvoid\s+main\s*\(\s*\)/.test(source);
  const hasMainImage = /\bvoid\s+mainImage\s*\(/.test(source);

  if (hasVersion && hasMain) {
    return source;
  }

  const clean = source.replace(/^\s*#version[^\n]*/m, '');
  const prelude = `#version 300 es
precision highp float;
precision highp int;
out vec4 fragColor;
uniform vec3 iResolution;
uniform vec2 u_resolution;
uniform float iTime;
uniform float u_time;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iMouse;
`;

  let epilogue = '';
  if (hasMainImage && !hasMain) {
    epilogue = `
void main() {
  vec4 col = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(col, gl_FragCoord.xy);
  fragColor = vec4(col.rgb, 1.0);
}
`;
  }

  return `${prelude}\n#line 1\n${clean}\n${epilogue}`;
}

function renderPageHtml(
  glslSource: string,
  values: Record<string, ControlValue>,
  width: number,
  height: number,
  fps: number,
  totalFrames: number
): string {
  const finalFs = prepareFragmentSource(glslSource);
  const jsonValues = JSON.stringify(values);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body, html { margin: 0; padding: 0; background: #000; overflow: hidden; }
    canvas { display: block; width: ${width}px; height: ${height}px; }
  </style>
</head>
<body>
  <canvas id="c" width="${width}" height="${height}"></canvas>
  <script>
    (async function() {
      const canvas = document.getElementById('c');
      const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: true });
      if (!gl) {
        await reportError('WebGL2 context not supported in browser environment');
        return;
      }

      const vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs, \`#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}\`);
      gl.compileShader(vs);

      const fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fs, ${JSON.stringify(finalFs)});
      gl.compileShader(fs);

      if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        await reportError('Shader compile error: ' + gl.getShaderInfoLog(fs));
        return;
      }

      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);

      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        await reportError('Shader link error: ' + gl.getProgramInfoLog(prog));
        return;
      }

      gl.useProgram(prog);

      const uRes = gl.getUniformLocation(prog, 'u_resolution');
      const iRes = gl.getUniformLocation(prog, 'iResolution');
      const uTime = gl.getUniformLocation(prog, 'u_time');
      const iTime = gl.getUniformLocation(prog, 'iTime');

      if (uRes) gl.uniform2f(uRes, ${width}, ${height});
      if (iRes) gl.uniform3f(iRes, ${width}, ${height}, 1.0);

      // Helper to parse hex color to [r,g,b]
      function parseColor(c) {
        if (typeof c === 'string' && c.startsWith('#')) {
          const hex = c.slice(1);
          if (hex.length === 6) {
            return [
              parseInt(hex.slice(0, 2), 16) / 255,
              parseInt(hex.slice(2, 4), 16) / 255,
              parseInt(hex.slice(4, 6), 16) / 255
            ];
          }
        }
        return c;
      }

      // Apply initial control values
      const vals = ${jsonValues};
      for (const [k, rawV] of Object.entries(vals)) {
        const v = parseColor(rawV);
        const loc = gl.getUniformLocation(prog, k);
        if (loc) {
          if (typeof v === 'number') gl.uniform1f(loc, v);
          else if (Array.isArray(v)) {
            if (v.length === 2) gl.uniform2fv(loc, v);
            else if (v.length === 3) gl.uniform3fv(loc, v);
            else if (v.length === 4) gl.uniform4fv(loc, v);
          }
        }
      }

      gl.viewport(0, 0, ${width}, ${height});

      for (let f = 0; f < ${totalFrames}; f++) {
        const t = f / ${fps};
        if (uTime) gl.uniform1f(uTime, t);
        if (iTime) gl.uniform1f(iTime, t);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const arrayBuf = await blob.arrayBuffer();
        await fetch('/frame', { method: 'POST', body: arrayBuf });
      }

      async function reportError(msg) {
        await fetch('/error', { method: 'POST', body: msg });
      }
    })();
  </script>
</body>
</html>`;
}
