#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_time;

uniform float speed;      // @control min=0.2 max=4.0 default=1.0 label="Pulse Speed"
uniform vec3 neonCore;    // @control color default=#00f0ff label="Core Neon"
uniform vec3 neonGlow;    // @control color default=#ff007f label="Outer Glow"
uniform float rings;      // @control min=1.0 max=8.0 default=5.0 label="Ring Count"
uniform float dispersion; // @control min=0.0 max=1.0 default=0.25 label="Chromatic Dispersion"

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

  // Deep spatial space background
  vec3 col = vec3(0.015, 0.02, 0.04);

  // Rotating hexagon layers
  vec2 rUv = rot(t * 0.4) * uv;

  for (float i = 1.0; i <= 6.0; i += 1.0) {
    if (i > rings) break;
    float phase = fract(t * 0.5 + i / rings);
    float radius = phase * 1.35;
    float d = abs(sdHexagon(rUv, radius));
    
    // Sharp neon glow line
    float glow = 0.007 / (d + 0.003);
    vec3 ringColor = mix(neonCore, neonGlow, phase);
    col += ringColor * glow * (1.0 - phase * 0.75) * 1.2;
  }

  // Chromatic dispersion on core pulse
  float disp = dispersion * 0.025 * sin(t * 4.0);
  float dR = length(uv + vec2(disp, 0.0));
  float dG = length(uv);
  float dB = length(uv - vec2(disp, 0.0));

  float coreR = 0.035 / (dR * dR + 0.008);
  float coreG = 0.035 / (dG * dG + 0.008);
  float coreB = 0.035 / (dB * dB + 0.008);

  col += vec3(coreR * neonCore.r, coreG * neonCore.g, coreB * neonGlow.b) * 0.85;

  // Orbiting satellite sparks
  for (int j = 0; j < 8; j++) {
    float a = float(j) * 0.785398 + t * 1.2;
    float r = 0.55 + 0.12 * sin(t * 3.0 + float(j));
    vec2 sp = vec2(cos(a), sin(a)) * r;
    float sDist = length(uv - sp);
    col += mix(neonCore, neonGlow, float(j) / 8.0) * (0.005 / (sDist * sDist + 0.0015));
  }

  // Vivid saturation tone curve
  col = pow(col, vec3(0.9));
  col = clamp(col, 0.0, 1.0);

  fragColor = vec4(col, 1.0);
}

void main() {
  mainImage(fragColor, gl_FragCoord.xy);
}
