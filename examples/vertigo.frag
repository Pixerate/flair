#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_time;

uniform float speed;          // @control min=0.5 max=2.5 default=1.0 label="Playback Speed"
uniform vec3 hitchcockRed;    // @control color default=#c41212 label="Hitchcock Red"
uniform float spiralDensity;  // @control min=2.0 max=10.0 default=5.0 label="Spiral Density"
uniform float filmGrain;      // @control min=0.0 max=1.0 default=0.2 label="Noir 35mm Grain"

// 2D Rotation
mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

// Pseudo-random noise for film grain
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Distance functions
float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// Typography: Saul Bass style cut letterforms
float letterV(vec2 p) {
  float d1 = sdSegment(p, vec2(-0.06, 0.1), vec2(0.0, -0.1));
  float d2 = sdSegment(p, vec2(0.06, 0.1), vec2(0.0, -0.1));
  return min(d1, d2);
}

float letterE(vec2 p) {
  float d = sdSegment(p, vec2(-0.05, -0.1), vec2(-0.05, 0.1));
  d = min(d, sdSegment(p, vec2(-0.05, 0.1), vec2(0.05, 0.1)));
  d = min(d, sdSegment(p, vec2(-0.05, 0.0), vec2(0.03, 0.0)));
  d = min(d, sdSegment(p, vec2(-0.05, -0.1), vec2(0.05, -0.1)));
  return d;
}

float letterR(vec2 p) {
  float d = sdSegment(p, vec2(-0.05, -0.1), vec2(-0.05, 0.1));
  d = min(d, sdSegment(p, vec2(-0.05, 0.1), vec2(0.02, 0.1)));
  d = min(d, sdSegment(p, vec2(0.02, 0.1), vec2(0.05, 0.05)));
  d = min(d, sdSegment(p, vec2(0.05, 0.05), vec2(0.02, 0.0)));
  d = min(d, sdSegment(p, vec2(0.02, 0.0), vec2(-0.05, 0.0)));
  d = min(d, sdSegment(p, vec2(0.0, 0.0), vec2(0.05, -0.1)));
  return d;
}

float letterT(vec2 p) {
  float d = sdSegment(p, vec2(-0.06, 0.1), vec2(0.06, 0.1));
  d = min(d, sdSegment(p, vec2(0.0, 0.1), vec2(0.0, -0.1)));
  return d;
}

float letterI(vec2 p) {
  float d = sdSegment(p, vec2(0.0, -0.1), vec2(0.0, 0.1));
  d = min(d, sdSegment(p, vec2(-0.03, 0.1), vec2(0.03, 0.1)));
  d = min(d, sdSegment(p, vec2(-0.03, -0.1), vec2(0.03, -0.1)));
  return d;
}

float letterG(vec2 p) {
  float d = sdSegment(p, vec2(0.05, 0.1), vec2(-0.03, 0.1));
  d = min(d, sdSegment(p, vec2(-0.05, 0.07), vec2(-0.05, -0.07)));
  d = min(d, sdSegment(p, vec2(-0.03, -0.1), vec2(0.05, -0.1)));
  d = min(d, sdSegment(p, vec2(0.05, -0.1), vec2(0.05, -0.01)));
  d = min(d, sdSegment(p, vec2(0.01, -0.01), vec2(0.05, -0.01)));
  return d;
}

float letterO(vec2 p) {
  return abs(length(p) - 0.075);
}

float drawVertigoTitle(vec2 p) {
  float scale = 0.85;
  vec2 sp = p / scale;

  float d = letterV(sp - vec2(-0.45, 0.0));
  d = min(d, letterE(sp - vec2(-0.30, 0.0)));
  d = min(d, letterR(sp - vec2(-0.15, 0.0)));
  d = min(d, letterT(sp - vec2(0.00, 0.0)));
  d = min(d, letterI(sp - vec2(0.13, 0.0)));
  d = min(d, letterG(sp - vec2(0.28, 0.0)));
  d = min(d, letterO(sp - vec2(0.44, 0.0)));

  return d * scale;
}

// Stylized high-contrast Noir face & eye close-up in the style of Saul Bass / Kim Novak
vec3 renderWomanFaceCloseUp(vec2 uv, float t) {
  float zoomProgress = smoothstep(0.0, 3.0, t);
  vec2 eyeCenter = vec2(0.0, 0.06);
  float zoom = 1.0 + zoomProgress * zoomProgress * 8.0;
  vec2 p = (uv - eyeCenter * (1.0 - 1.0 / zoom)) * zoom;

  vec3 skinLight = vec3(0.92, 0.89, 0.86);
  vec3 skinShadow = vec3(0.05, 0.04, 0.05);

  // Chiaroscuro key lighting
  float faceLight = smoothstep(-0.7, 0.3, p.x + 0.15 * p.y);
  vec3 col = mix(skinShadow, skinLight, faceLight);

  // Nose bridge contour
  float noseBridge = abs(p.x + 0.32 + 0.15 * p.y);
  if (p.y > -0.55 && p.y < 0.2 && p.x < -0.15) {
    col = mix(col, skinShadow, smoothstep(0.09, 0.0, noseBridge) * 0.7);
  }

  // Noir lips contour
  vec2 lipP = p - vec2(-0.06, -0.62);
  float upperLip = length((lipP - vec2(0.0, 0.04)) * vec2(1.0, 2.4)) - 0.22;
  float lowerLip = length((lipP + vec2(0.0, 0.04)) * vec2(1.0, 2.0)) - 0.24;
  float lipMouth = abs(lipP.y + 0.1 * lipP.x * lipP.x);
  if (abs(lipP.x) < 0.36 && abs(lipP.y) < 0.25) {
    float lipMask = smoothstep(0.02, -0.01, max(upperLip, lowerLip));
    vec3 lipstick = mix(vec3(0.55, 0.06, 0.09), vec3(0.18, 0.01, 0.02), lipP.y * 3.0 + 0.5);
    col = mix(col, lipstick, lipMask * 0.92);
    col = mix(col, vec3(0.02), smoothstep(0.015, 0.0, lipMouth) * 0.85);
  }

  // Eye centered around (0.0, 0.06)
  vec2 ep = p - vec2(0.0, 0.06);

  float dUpper = ep.y - 0.11 + 1.25 * (ep.x * ep.x);
  float dLower = -ep.y - 0.07 + 0.95 * (ep.x * ep.x);
  float eyeBounds = smoothstep(0.01, -0.01, dUpper) * smoothstep(0.01, -0.01, dLower);

  if (abs(ep.x) < 0.38 && eyeBounds > 0.01) {
    vec3 sclera = vec3(0.96, 0.95, 0.94);
    sclera *= smoothstep(-0.02, 0.08, dUpper);

    float dIris = length(ep);
    float rIris = 0.17;
    float rPupil = 0.07 + 0.012 * sin(t * 3.0);

    if (dIris < rIris) {
      float angle = atan(ep.y, ep.x);
      float fibers = 0.85 + 0.15 * cos(angle * 28.0);
      vec3 irisCol = mix(vec3(0.18, 0.48, 0.58), vec3(0.05, 0.16, 0.22), dIris / rIris) * fibers;
      irisCol = mix(irisCol, vec3(0.02), smoothstep(rIris - 0.025, rIris, dIris));

      if (dIris < rPupil) {
        irisCol = vec3(0.005);
      } else {
        vec2 glintP = ep - vec2(0.035, 0.035);
        float glint = smoothstep(0.022, 0.005, length(glintP));
        irisCol = mix(irisCol, vec3(1.0), glint * 0.9);
      }
      sclera = irisCol;
    }
    col = mix(col, sclera, eyeBounds);
  }

  // Eyeliner and lashes
  if (abs(ep.x) < 0.42) {
    float upperLine = abs(dUpper);
    col = mix(col, vec3(0.01), smoothstep(0.022, 0.004, upperLine));
    if (ep.x > 0.28) {
      float flick = abs((ep.y - 0.08) - 0.55 * (ep.x - 0.28));
      col = mix(col, vec3(0.01), smoothstep(0.02, 0.005, flick) * smoothstep(0.44, 0.32, ep.x));
    }
  }

  // Crease and eyebrow
  if (abs(ep.x) < 0.36) {
    float crease = abs(ep.y - 0.22 + 0.8 * ep.x * ep.x);
    col = mix(col, skinShadow, smoothstep(0.025, 0.005, crease) * 0.6);
  }

  vec2 browP = ep - vec2(-0.02, 0.32);
  if (abs(browP.x) < 0.42) {
    float brow = abs(browP.y + 0.7 * browP.x * browP.x);
    float taper = smoothstep(0.42, 0.15, abs(browP.x));
    col = mix(col, vec3(0.03, 0.02, 0.02), smoothstep(0.035, 0.008, brow) * taper * 0.9);
  }

  return col;
}

// Hypnotic John Whitney Spirograph / Lissajous spirals
vec3 renderHypnoSpirals(vec2 uv, float t) {
  float r = length(uv);
  float theta = atan(uv.y, uv.x);

  vec3 col = vec3(0.015, 0.015, 0.02);
  float centerGlow = 0.018 / (r * r + 0.0035);
  col += vec3(centerGlow) * 0.65;

  for (float i = 1.0; i <= 8.0; i += 1.0) {
    if (i > spiralDensity) break;

    float dir = mod(i, 2.0) == 0.0 ? 1.0 : -1.0;
    float spin = t * 0.85 * dir + i * 0.628;

    float freq = 3.0 + i;
    float spiralWave = sin(theta * freq + spin - r * (11.0 + i * 2.5));
    float distCurve = abs(spiralWave) / (11.0 + i * 2.8);

    float curveWidth = 0.004 + 0.002 * sin(t * 2.0 + i);
    float line = curveWidth / (distCurve + 0.004);

    vec3 lineColor = (mod(i, 3.0) == 0.0) ? hitchcockRed * 1.5 : vec3(1.0);
    col += lineColor * line * smoothstep(1.5, 0.12, r) * 0.38;
  }

  for (float k = 0.0; k < 4.0; k += 1.0) {
    float expPhase = fract(t * 0.4 + k * 0.25);
    float ringR = expPhase * 1.25;
    float ringD = abs(r - ringR);
    float ringGlow = 0.0035 / (ringD + 0.002);
    col += mix(vec3(0.95), hitchcockRed, expPhase) * ringGlow * (1.0 - expPhase) * 0.32;
  }

  return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  float t = u_time * speed;

  vec3 finalColor = vec3(0.0);

  if (t < 3.0) {
    // Act 1: The Gaze - Close-up of face and eye with camera push
    vec3 faceCol = renderWomanFaceCloseUp(uv, t);

    // Hitchcock crimson wash encroaching into the scene
    float redWash = smoothstep(1.2, 3.0, t);
    float lum = dot(faceCol, vec3(0.299, 0.587, 0.114));
    vec3 noirTone = mix(faceCol, hitchcockRed * lum * 1.4, redWash);

    // Iris expands into hypnotic vortex
    if (redWash > 0.5) {
      float vortexFade = smoothstep(0.5, 1.0, redWash);
      vec3 spiralStart = renderHypnoSpirals(uv, (t - 1.5) * 1.2);
      noirTone = mix(noirTone, spiralStart, vortexFade);
    }
    finalColor = noirTone;
  } else if (t < 6.0) {
    // Act 2: The Vortex - Stark black-and-white graphic forms and expanding spirals
    float spiralTime = t - 3.0;
    vec3 spirals = renderHypnoSpirals(uv, spiralTime);
    spirals = pow(spirals, vec3(1.1));
    finalColor = spirals;
  } else {
    // Act 3: The Title - "VERTIGO" Saul Bass typography reveal
    float titleTime = t - 6.0;
    vec3 spirals = renderHypnoSpirals(uv * 1.25, t * 1.4);
    spirals *= 0.45;

    float reveal = smoothstep(0.0, 0.8, titleTime);
    float pulse = 1.0 + 0.03 * sin(titleTime * 4.0);
    vec2 titleUv = uv * pulse;

    float titleDist = drawVertigoTitle(titleUv);
    float stroke = 0.012;
    float textFill = smoothstep(stroke, stroke - 0.003, titleDist) * reveal;

    float textR = smoothstep(stroke, stroke - 0.003, drawVertigoTitle(titleUv - vec2(0.004, 0.0))) * reveal;
    float textB = smoothstep(stroke, stroke - 0.003, drawVertigoTitle(titleUv + vec2(0.004, 0.0))) * reveal;

    vec3 titleColor = vec3(textR, textFill, textB);
    vec3 redEcho = hitchcockRed * smoothstep(stroke * 1.8, stroke * 0.8, drawVertigoTitle(titleUv + vec2(0.008, -0.008))) * reveal * 0.85;

    finalColor = spirals + redEcho;
    finalColor = mix(finalColor, titleColor * 1.25, textFill);

    float barTop = sdBox(titleUv - vec2(0.0, 0.24), vec2(0.48, 0.004));
    float barBottom = sdBox(titleUv - vec2(0.0, -0.24), vec2(0.48, 0.004));
    float bars = smoothstep(0.004, 0.001, min(barTop, barBottom)) * reveal;
    finalColor += hitchcockRed * bars * 1.2;
  }

  // 35mm film grain and subtle vignette
  float grain = (hash(uv + fract(u_time * 17.31)) - 0.5) * filmGrain;
  float vig = 1.0 - 0.35 * length(uv);
  finalColor = (finalColor + grain) * vig;

  fragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
}

void main() {
  mainImage(fragColor, gl_FragCoord.xy);
}
