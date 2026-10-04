#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_time;

uniform float speed;      // @control min=0.2 max=4.0 default=1.2 label="Pulse Speed"
uniform vec3 neonCore;    // @control color default=#00e5ff label="Core Neon"
uniform vec3 neonGlow;    // @control color default=#ff0055 label="Outer Glow"
uniform float rings;      // @control min=1.0 max=8.0 default=5.0 label="Ring Count"
uniform float dispersion; // @control min=0.0 max=1.0 default=0.3 label="Chromatic Dispersion"

float sdHexagon(in vec2 p, in float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  float t = u_time * speed;

  // Background subtle dark radial vignette
  float bgDist = length(uv);
  vec3 col = vec3(0.04, 0.05, 0.09) * (1.0 - 0.4 * bgDist);

  // Rotating geometric grid pulses
  vec2 rotUv = rot(t * 0.2) * uv;

  for (float i = 1.0; i <= 6.0; i += 1.0) {
    if (i > rings) break;
    float phase = fract(t * 0.35 + i / rings);
    float radius = phase * 1.5;
    float hex = abs(sdHexagon(rotUv, radius));
    float width = 0.008 + 0.004 * sin(t * 2.0 + i);

    // Glowing outline
    float ringGlow = width / (hex + 0.005);
    vec3 ringColor = mix(neonCore, neonGlow, phase);
    col += ringColor * ringGlow * (1.0 - phase) * 0.45;
  }

  // Central energy core with chromatic aberration
  vec2 disp = vec2(dispersion * 0.015 * sin(t * 3.0), 0.0);
  float dR = length(uv + disp);
  float dG = length(uv);
  float dB = length(uv - disp);

  float coreR = 0.04 / (dR * dR + 0.02);
  float coreG = 0.04 / (dG * dG + 0.02);
  float coreB = 0.04 / (dB * dB + 0.02);

  col.r += coreR * neonCore.r * 0.3;
  col.g += coreG * neonCore.g * 0.3;
  col.b += coreB * neonGlow.b * 0.3;

  // Orbiting energy dots
  for (int j = 0; j < 8; j++) {
    float angle = float(j) * 0.785398 + t * 0.8;
    vec2 p = vec2(cos(angle), sin(angle)) * (0.6 + 0.15 * sin(t * 2.0 + float(j)));
    float dotDist = length(uv - p);
    col += neonCore * (0.003 / (dotDist * dotDist + 0.002));
  }

  // Tone mapping and soft clamp
  col = col / (1.0 + col);
  fragColor = vec4(col, 1.0);
}

void main() {
  mainImage(fragColor, gl_FragCoord.xy);
}
