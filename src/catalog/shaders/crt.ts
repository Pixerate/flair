import { FBM, glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * CRT shaders: a picture on a cathode-ray tube doing the things tubes do.
 * Switching on and off (the picture opening out of a bright line, and
 * collapsing back to a dot that fades), losing vertical hold so the picture
 * rolls, and showing on an old television set in a dark room. The curved CRT
 * screen and TV static live in this category too.
 */

/** `scanlines(y, amount)`: brightness through a tube's scanlines at pixel row y. */
const SCANLINES = `
float scanlines(float y, float amount) {
  return 1.0 - amount * 0.5 * (1.0 - cos(y * 3.14159));
}`.trim();

export const crtPower: ShaderEffect = {
  kind: "shader",
  id: "crt-power",
  name: "CRT power",
  description:
    "A picture on an old tube television switching on and off: a bright line stretching across the dark screen and opening out into the picture, overbright for a moment, then later squashing back down to a glowing line, shrinking to a dot and fading away. Loops; or turn Animate off and set Power.",
  category: "crt",
  video: "filter",
  tags: ["crt", "tv", "retro", "power", "switch-on", "switch-off", "transition", "image"],
  loop: 5,
  source: glsl(
    `// CRT power over 5 s: dark to 0.4 s; switching on to 1.1 s (a line grows across, then opens to the picture);
// on until 3.6 s; switching off to 4.2 s (squashing to a line, then to a dot); the dot's afterglow fading to 5 s.
// Still, Power runs the switch-on from 0 (dark) to 1 (on).
uniform sampler2D uImage;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform vec3 uPhosphor;     // @control color default=#E8F1FF label="Glow"
uniform float uScanlines;   // @control min=0 max=1 default=0.4 label="Scanlines"
uniform float uCurve;       // @control min=0 max=0.5 default=0.12 label="Curvature"
uniform float uAfterglow;   // @control min=0 max=1 default=0.8 label="Afterglow"
uniform bool uAnimate;      // @control default=true label="Animate"
uniform float uProgress;    // @control min=0 max=1 default=1 label="Power (when still)"
${BACKDROP_CONTROLS}`,
    PICTURE,
    SCANLINES,
    `// The picture's width and height (0–1 of the screen), how overbright it is, and the dot's glow.
vec4 switchOn(float u) {
  float sx = smoothstep(0.0, 0.3, u);
  float sy = smoothstep(0.3, 1.0, u);
  return vec4(sx, sy * sy, (1.0 - smoothstep(0.3, 1.0, u)) * step(0.001, u), 0.0);
}
vec4 switchOff(float u) {
  float sy = 1.0 - smoothstep(0.0, 0.5, u);
  float sx = 1.0 - smoothstep(0.5, 1.0, u);
  return vec4(sx, sy, smoothstep(0.0, 0.5, u), smoothstep(0.75, 1.0, u));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float aspect = iResolution.x / iResolution.y;
  float px = 2.0 / iResolution.y;
  vec2 q = fragCoord / iResolution.xy * 2.0 - 1.0;
  q *= 1.0 + uCurve * dot(q.yx, q.yx) * 0.5;
  if (abs(q.x) > 1.0 || abs(q.y) > 1.0) {
    fragColor = vec4(0.0, 0.0, 0.0, uBackdropAlpha);
    return;
  }
  vec4 state;
  if (uAnimate) {
    float c = mod(iTime, 5.0);
    if (c < 0.4) state = vec4(0.0);
    else if (c < 1.1) state = switchOn((c - 0.4) / 0.7);
    else if (c < 3.6) state = vec4(1.0, 1.0, 0.0, 0.0);
    else if (c < 4.2) state = switchOff((c - 3.6) / 0.6);
    else state = vec4(0.0, 0.0, 0.0, 1.0 - smoothstep(4.2, 5.0, c));
  } else {
    state = switchOn(clamp(uProgress, 0.0, 1.0));
  }
  float sx = state.x;
  float sy = max(state.y, px * 1.5);
  float flare = state.z;

  // The whole picture squeezed into what is open of the screen.
  vec2 st = 0.5 + 0.5 * q / max(vec2(sx, sy), 1e-3);
  vec4 pic = pictureRGBA(uImage, clamp(st, 0.0, 1.0));
  vec3 col = mix(pic.rgb, uPhosphor, 0.85 * flare) * (1.0 + 1.5 * flare);
  col *= scanlines(fragCoord.y, uScanlines);
  float open = (1.0 - smoothstep(sx - px, sx + px, abs(q.x))) * (1.0 - smoothstep(sy - px, sy + px, abs(q.y))) * step(0.001, sx);
  vec3 screen = vec3(0.02, 0.025, 0.03);
  vec3 outCol = mix(screen, col, open);
  float alpha = mix(uBackdropAlpha, pic.a, open);

  // The bright line's bloom above and below it while it is thin, and the dot's afterglow.
  float off = max(abs(q.y) - sy, 0.0);
  float bloom = flare * exp(-off * off * 900.0) * (1.0 - smoothstep(sx, sx + 0.08, abs(q.x))) * 0.8;
  float r = length(q * vec2(aspect, 1.0));
  float spot = uAfterglow * state.w * (exp(-r * r * 900.0) + 0.3 * exp(-r * r * 40.0));
  vec3 glow = uPhosphor * (bloom + spot);
  outCol += glow;
  alpha = max(alpha, clamp(bloom + spot, 0.0, 1.0));
  // The tube's corners darken.
  outCol *= smoothstep(1.0, 0.7, max(abs(q.x), abs(q.y)) * 0.98 + 0.02 * length(q));
  fragColor = vec4(clamp(outCol, 0.0, 1.0), alpha);
}`,
  ),
  presets: [
    { name: "Switch on", values: { uAnimate: false, uProgress: 0.6 } },
    { name: "Green phosphor", values: { uPhosphor: [0.6, 1, 0.7] } },
    { name: "Flat screen", values: { uCurve: 0, uScanlines: 0.15 } },
  ],
};

export const verticalRoll: ShaderEffect = {
  kind: "shader",
  id: "vertical-roll",
  name: "Vertical roll",
  description:
    "A picture on a tube set that has lost its vertical hold: the picture rolling up the screen with the black blanking bar between frames, the lines tearing sideways near it, then (if you like) slowing and catching again as if someone fixed the knob.",
  category: "crt",
  video: "filter",
  tags: ["crt", "tv", "retro", "roll", "vertical-hold", "glitch", "analogue", "image"],
  source: glsl(
    `// Vertical roll: the picture and its blanking bar (uBar of each roll) wrap round the screen, offset by how far it
// has rolled. Mode 0 rolls steadily; mode 1 repeats every 5 s, rolling fast and slowing to a stop in 3 s, a whole
// number of rolls, so it catches with the picture in place, then holds steady.
uniform sampler2D uImage;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Image"
uniform int uMode;          // @control min=0 max=1 default=1 label="Mode (0 rolls, 1 rolls then catches)"
uniform float uRoll;        // @control min=0.05 max=1.5 default=0.5 step=0.05 label="Rolls a second"
uniform float uBar;         // @control min=0.02 max=0.25 default=0.08 label="Bar height"
uniform float uTear;        // @control min=0 max=1 default=0.5 label="Tearing"
uniform float uScanlines;   // @control min=0 max=1 default=0.35 label="Scanlines"
uniform float uNoise;       // @control min=0 max=1 default=0.25 label="Noise"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    SCANLINES,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float offset;
  float speed;
  if (uMode == 1) {
    float rolls = max(1.0, floor(uRoll * 3.0 + 0.5));
    float c = mod(iTime, 5.0);
    float u = clamp(c / 3.0, 0.0, 1.0);
    offset = rolls * (1.0 - (1.0 - u) * (1.0 - u));
    speed = 2.0 * rolls / 3.0 * (1.0 - u);
  } else {
    offset = iTime * uRoll;
    speed = uRoll;
  }
  float y = fract(uv.y - offset);
  float inBar = 1.0 - step(uBar, y);
  float v = (y - uBar) / (1.0 - uBar);
  // The lines just after the bar bend sideways, the more the faster it rolls.
  float pull = 1.0 - smoothstep(0.0, 0.35, v);
  float x = uv.x + uTear * min(speed, 1.5) * (0.04 * pull * sin(v * 18.0 + iTime * 4.0) + 0.006 * sin(uv.y * 40.0 + iTime * 9.0));
  vec4 pic = pictureRGBA(uImage, vec2(fract(x), clamp(v, 0.0, 1.0)));
  vec3 col = pic.rgb * (1.0 + 0.15 * min(speed, 1.0) * pull);
  col *= scanlines(fragCoord.y, uScanlines);
  float frame = floor(iTime * 30.0);
  col += uNoise * 0.25 * (hash12(vec2(floor(fragCoord.y * 0.5), frame)) - 0.5) * min(speed + 0.3, 1.0);
  col += uNoise * 0.12 * (hash12(fragCoord + frame) - 0.5);
  // The bar: black, with a pale stripe of sync pulses across it.
  vec3 barCol = vec3(0.015) + 0.25 * step(0.55, y / uBar) * step(y / uBar, 0.7) * step(0.5, hash12(vec2(floor(uv.x * 60.0), 1.0)));
  float alpha = mix(pic.a, 1.0, inBar);
  fragColor = vec4(clamp(mix(col, barCol, inBar), 0.0, 1.0), alpha);
}`,
  ),
  presets: [
    { name: "Rolling", values: { uMode: 0, uRoll: 0.4 } },
    { name: "Fast tear", values: { uMode: 0, uRoll: 1.2, uTear: 1, uNoise: 0.5 } },
    { name: "Clean", values: { uTear: 0.2, uNoise: 0, uScanlines: 0.1 } },
  ],
};

export const crtTelevision: ShaderEffect = {
  kind: "shader",
  id: "crt-television",
  name: "CRT television",
  description:
    "A picture on an old television set in a dark room: a wooden cabinet with a rounded, bulging screen, its dial knobs and speaker grille, rabbit-ear antennas on top, scanlines and a little snow on the glass, its glare, and the screen's light spilling onto the wall and floor.",
  category: "crt",
  video: "filter",
  tags: ["crt", "tv", "retro", "television", "vintage", "screen", "living-room", "image"],
  source: glsl(
    `// CRT television: the set drawn in units of the frame's height, centred and scaled by uSize; the screen is a
// rounded box on its left whose picture is bulged as if through curved glass; the room is lit by the screen's
// average colour (five taps of the picture), falling off from the set.
uniform sampler2D uImage;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform float uSize;        // @control min=0.5 max=1.2 default=0.85 label="Set size"
uniform vec3 uCabinet;      // @control color default=#6B4428 label="Cabinet"
uniform vec3 uRoom;         // @control color default=#17151C label="Room"
uniform float uScanlines;   // @control min=0 max=1 default=0.45 label="Scanlines"
uniform float uStatic;      // @control min=0 max=1 default=0.08 label="Snow"
uniform float uGlare;       // @control min=0 max=1 default=0.6 label="Glare"
uniform bool uAntenna;      // @control default=true label="Antenna"
${BACKDROP_CONTROLS}`,
    HASH,
    NOISE,
    FBM,
    PICTURE,
    SCANLINES,
    `float roundBox(vec2 p, vec2 hs, float r) {
  vec2 q = abs(p) - hs + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y / uSize + vec2(0.0, 0.03);
  float pxs = px / uSize;
  float frame = floor(iTime * 30.0);

  // The screen's average colour, to light the room.
  vec3 glowCol = (picture(uImage, vec2(0.5)) + picture(uImage, vec2(0.25)) + picture(uImage, vec2(0.75)) + picture(uImage, vec2(0.25, 0.75)) + picture(uImage, vec2(0.75, 0.25))) / 5.0;

  // The room: a wall, a darker floor below the set's feet, and the screen's light falling off from it.
  vec2 screenC = vec2(-0.12, 0.02);
  float floorY = -0.47;
  vec3 col = p.y < floorY ? uRoom * 0.55 : uRoom;
  col += glowCol * 0.22 * exp(-length((p - screenC) * vec2(0.7, 1.0)) * 2.4);
  col *= 1.0 - 0.5 * exp(-pow(length((p - vec2(0.0, floorY)) * vec2(1.0, 6.0)) / 0.7, 2.0)) * step(p.y, floorY + 0.02);

  // Rabbit ears.
  if (uAntenna) {
    float ears = min(segment(p, vec2(0.05, 0.4), vec2(-0.3, 0.78)), segment(p, vec2(0.08, 0.4), vec2(0.42, 0.74)));
    float balls = min(length(p - vec2(-0.3, 0.78)), length(p - vec2(0.42, 0.74))) - 0.012;
    col = mix(col, vec3(0.62, 0.64, 0.68), 1.0 - smoothstep(0.0, pxs * 1.5, min(ears - 0.004, balls)));
    col = mix(col, vec3(0.1), 1.0 - smoothstep(0.0, pxs, length(p - vec2(0.065, 0.405)) - 0.035));
  }
  // Legs.
  float legs = min(segment(p, vec2(-0.48, -0.38), vec2(-0.52, floorY + 0.01)), segment(p, vec2(0.48, -0.38), vec2(0.52, floorY + 0.01))) - 0.012;
  col = mix(col, uCabinet * 0.45, 1.0 - smoothstep(0.0, pxs, legs));

  // The cabinet: wood grain, bevelled edges.
  float box = roundBox(p, vec2(0.64, 0.4), 0.05);
  float grain = fbm(vec2(p.x * 2.5, p.y * 38.0 + 3.0 * vnoise(p * 4.0)), 4);
  vec3 wood = uCabinet * (0.72 + 0.5 * grain);
  wood *= 0.8 + 0.35 * smoothstep(-0.03, 0.0, -box) * (0.5 + 0.5 * p.y / 0.4);
  wood = mix(wood, wood * 1.4, (1.0 - smoothstep(0.0, 0.012, abs(box + 0.012))) * step(0.0, p.y));
  col = mix(col, wood, 1.0 - smoothstep(0.0, pxs, box));

  // The side panel: two dials and a speaker grille.
  for (int i = 0; i < 2; i++) {
    vec2 c = vec2(0.47, 0.22 - 0.16 * float(i));
    float d = length(p - c);
    vec3 knob = mix(vec3(0.12), vec3(0.32), smoothstep(0.05, -0.05, (p - c).x + (p - c).y));
    float a = 1.1 + 2.3 * float(i);
    float tick = segment(p, c, c + 0.032 * vec2(cos(a), sin(a))) - 0.004;
    knob = mix(knob, vec3(0.85), 1.0 - smoothstep(0.0, pxs, tick));
    col = mix(col, vec3(0.05), 0.5 * (1.0 - smoothstep(0.0, 0.01, d - 0.05)));
    col = mix(col, knob, 1.0 - smoothstep(0.0, pxs, d - 0.045));
  }
  float grille = roundBox(p - vec2(0.47, -0.2), vec2(0.09, 0.13), 0.02);
  vec3 slots = mix(vec3(0.06), uCabinet * 0.5, step(0.5, fract(p.y * 70.0)));
  col = mix(col, slots, 1.0 - smoothstep(0.0, pxs, grille));

  // The screen: a dark bezel round curved glass.
  vec2 hs = vec2(0.43, 0.32);
  float bezel = roundBox(p - screenC, hs + 0.035, 0.1);
  col = mix(col, vec3(0.04) + 0.06 * smoothstep(0.0, -0.035, bezel), 1.0 - smoothstep(0.0, pxs, bezel));
  float glass = roundBox(p - screenC, hs, 0.09);
  vec2 q = (p - screenC) / hs;
  q *= 1.0 + 0.07 * dot(q, q);
  vec4 pic = pictureRGBA(uImage, q * 0.5 + 0.5);
  vec3 tube = mix(pic.rgb, vec3(hash12(fragCoord + frame)), uStatic);
  tube *= scanlines(fragCoord.y, uScanlines);
  tube *= 1.0 - 0.45 * smoothstep(0.6, 1.25, length(q));
  float glare = smoothstep(0.35, 0.0, abs(q.x * 0.5 + q.y - 0.75)) * smoothstep(1.2, 0.2, length(q - vec2(-0.3, 0.55)));
  tube += uGlare * 0.22 * glare + uGlare * 0.08 * smoothstep(0.7, 1.0, q.y);
  col = mix(col, tube, 1.0 - smoothstep(0.0, pxs, glass));
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  ),
  presets: [
    { name: "Plastic", values: { uCabinet: [0.85, 0.82, 0.76], uRoom: [0.2, 0.22, 0.26] } },
    { name: "Lost signal", values: { uStatic: 0.8 } },
    { name: "Close up", values: { uSize: 1.15, uAntenna: false } },
  ],
};

export const crtShaders: ShaderEffect[] = [crtPower, verticalRoll, crtTelevision];
