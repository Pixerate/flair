import { glsl, HASH } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Shock: jump scares. A cut to a face with a zoom punch and a shake, a single
 * hidden frame, a fluorescent tube failing and a heartbeat at the edges of
 * the frame that quickens. Each is tagged "horror" and "shock".
 *
 * Kept below seizure thresholds: none flashes more than three times a second
 * at any setting. A cut or a hidden frame comes at most once every two
 * seconds, the tube switches on a beat of a third of a second (so at most
 * one and a half flashes a second), its buzz is a few percent, and the
 * heartbeat tops out at 120 beats a minute, swelling in rather than snapping
 * on, so even a pure red pulse stays at two a second. Players show a still under prefers-reduced-motion.
 */

const LUMA = "vec3(0.2126, 0.7152, 0.0722)";

export const scareCut: ShaderEffect = {
  kind: "shader",
  id: "scare-cut",
  name: "Scare cut",
  description:
    "A jump scare: a picture slowly closing in, then a sudden cut to a stark face for a split second, the frame punching in and shaking before it settles. Once a cycle, never faster than every three seconds. Loops; or turn Animate off and set Moment.",
  category: "horror",
  video: "stills",
  tags: ["horror", "shock", "jump-scare", "flash", "zoom", "shake", "image"],
  loop: 6,
  source: glsl(
    `// Scare cut, over a cycle: a slow creep in; at the hit, the scare picture for a tenth of a second (pale and
// hard, not red); then the picture punched in and shaken, both dying away.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform sampler2D uScare;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Scare picture"
uniform vec3 uTint;        // @control color default=#E6E1D6 label="Scare tint"
uniform float uFlash;      // @control min=0 max=1 default=0.8 label="Scare brightness"
uniform float uPunch;      // @control min=0 max=1 default=0.7 label="Zoom punch"
uniform float uShake;      // @control min=0 max=1 default=0.7 label="Shake"
uniform float uCycle;      // @control min=3 max=20 default=6 label="Cycle (s)"
uniform bool uAnimate;     // @control default=true label="Animate"
uniform float uProgress;   // @control min=0 max=1 default=0.62 label="Moment (when still)"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float T = uAnimate ? mod(iTime, uCycle) : uProgress * uCycle;
  float hit = 0.6 * uCycle;
  float dt = T - hit;
  float after = step(0.0, dt);
  // The creep in, then the punch and the shake dying away.
  float zoom = 1.0 + 0.04 * smoothstep(0.0, hit, T) * (1.0 - after) + after * uPunch * 0.25 * exp(-max(dt, 0.0) * 5.0);
  vec2 shake = after * (hash22(vec2(floor(T * 30.0), 3.0)) - 0.5) * 0.05 * uShake * exp(-max(dt, 0.0) * 3.5);
  vec2 st = 0.5 + (uv - 0.5) / zoom + shake;
  vec4 pic = pictureRGBA(uImage, st);
  vec3 col = pic.rgb * (1.0 - 0.25 * smoothstep(0.3 * hit, hit, T) * (1.0 - after) * smoothstep(0.2, 0.8, length(uv - 0.5)));
  // The cut: one tenth of a second of the scare picture, hard and pale.
  float cut = after * step(dt, 0.1);
  float l = dot(pictureCover(uScare, 0.5 + (uv - 0.5) / 1.15 + shake), ${LUMA});
  vec3 scare = mix(vec3(0.02), uTint, smoothstep(0.25, 0.75, l)) * mix(0.5, 1.0, uFlash);
  col = mix(col, scare, cut);
  fragColor = vec4(col, max(pic.a, cut));
}`,
  ),
  presets: [
    { name: "Subtle", values: { uFlash: 0.4, uPunch: 0.3, uShake: 0.3 } },
    { name: "Brutal", values: { uFlash: 1, uPunch: 1, uShake: 1 } },
    { name: "Long dread", values: { uCycle: 12 } },
    { name: "The face", values: { uAnimate: false, uProgress: 0.605 } },
  ],
};

export const subliminalFlicker: ShaderEffect = {
  kind: "shader",
  id: "subliminal-flicker",
  name: "Subliminal flicker",
  description:
    "A picture that now and then shows something else for a single frame, a hidden picture laid over it so briefly you are not sure you saw it, never more than once every two seconds.",
  category: "horror",
  video: "filter",
  tags: ["horror", "shock", "subliminal", "hidden", "flicker", "single-frame", "image"],
  loop: 5,
  source: glsl(
    `// Subliminal flicker: once every uEvery seconds, for uLength seconds (a frame or two), the hidden picture shows
// through, a little larger and off-centre so it does not line up. Grain hides the seam.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Image"
uniform sampler2D uHidden; // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.portrait} label="Hidden picture"
uniform float uStrength;   // @control min=0 max=1 default=0.6 label="Strength"
uniform float uEvery;      // @control min=2 max=20 default=5 label="Every (s)"
uniform float uLength;     // @control min=0.02 max=0.12 default=0.045 label="Length (s)"
uniform float uGrain;      // @control min=0 max=1 default=0.3 label="Grain"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 pic = pictureRGBA(uImage, uv);
  float k = mod(iTime, uEvery);
  float show = step(0.5 * uEvery, k) * step(k, 0.5 * uEvery + uLength);
  vec3 hidden = pictureCover(uHidden, 0.5 + (uv - vec2(0.45, 0.52)) / 1.2);
  float l = dot(hidden, ${LUMA});
  vec3 col = mix(pic.rgb, mix(pic.rgb * 0.4, vec3(smoothstep(0.2, 0.8, l)), 0.8), show * uStrength);
  col += (hash12(fragCoord + floor(iTime * 24.0) * 17.0) - 0.5) * 0.12 * uGrain;
  fragColor = vec4(clamp(col, 0.0, 1.0), pic.a);
}`,
  ),
  presets: [
    { name: "Barely there", values: { uStrength: 0.3, uLength: 0.02 } },
    { name: "Unmissable", values: { uStrength: 1, uLength: 0.1 } },
    { name: "Rarely", values: { uEvery: 15 } },
    { name: "Clean", values: { uGrain: 0 } },
  ],
};

export const failingLight: ShaderEffect = {
  kind: "shader",
  id: "failing-light",
  name: "Failing light",
  description:
    "A picture lit by a failing fluorescent tube overhead: humming, catching, stuttering off and back on and sometimes staying dark a while, the room falling into shadow each time. It switches at most three times a second.",
  category: "horror",
  video: "filter",
  tags: ["horror", "shock", "fluorescent", "flicker", "light", "lamp", "hallway", "image"],
  source: glsl(
    `// Failing light: time in beats of a third of a second; each beat the tube is on or off, by the beat's hash, so
// it switches at most three times a second. Its light falls off from the top, where the tube hangs.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Image"
uniform vec3 uLight;       // @control color default=#E4F1FF label="Tube light"
uniform float uFailing;    // @control min=0 max=1 default=0.55 label="How badly it fails"
uniform float uDark;       // @control min=0 max=0.8 default=0.22 label="Light when off"
uniform bool uTube;        // @control default=true label="Show the tube"
${BACKDROP_CONTROLS}`,
    HASH,
    PICTURE,
    `// Whether the tube is on during beat b.
float lit(float b) {
  // Runs of failure: some stretches are steady, some stutter.
  float bad = step(hash12(vec2(floor(b / 9.0), 5.0)), uFailing);
  return step(bad * (0.35 + 0.4 * uFailing), hash12(vec2(b, 1.0)));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  float beat = floor(iTime * 3.0);
  float on = lit(beat);
  // A tube catching: a dim moment at the start of a beat after it was off; then a faint hum.
  float catching = on * (1.0 - lit(beat - 1.0)) * (1.0 - smoothstep(0.0, 0.08, fract(iTime * 3.0)));
  float level = mix(uDark, 1.0, on * (1.0 - 0.4 * catching)) * (1.0 + 0.03 * sin(iTime * 754.0));
  vec4 pic = pictureRGBA(uImage, uv);
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  // Brighter under the tube, falling off down the frame.
  float pool = mix(0.55, 1.15, exp(-length((p - vec2(0.0, 0.5)) / vec2(1.4, 1.0)) * 1.2));
  vec3 col = pic.rgb * mix(vec3(1.0), uLight, 0.35) * mix(uDark, pool, (level - uDark) / max(1.0 - uDark, 1e-3));
  if (uTube) {
    // The fixture: a bar across the top, glowing when lit.
    vec2 b = abs(p - vec2(0.0, 0.46)) - vec2(0.24 * aspect, 0.012);
    float bar = length(max(b, 0.0)) + min(max(b.x, b.y), 0.0);
    float tube = 1.0 - smoothstep(0.0, 0.003, bar);
    col = mix(col, mix(vec3(0.25), uLight * 1.1, on), tube);
    col += uLight * on * exp(-max(bar, 0.0) / 0.03) * 0.35;
  }
  fragColor = vec4(clamp(col, 0.0, 1.0), pic.a);
}`,
  ),
  presets: [
    { name: "Dying", values: { uFailing: 1, uDark: 0.1 } },
    { name: "Mostly fine", values: { uFailing: 0.2 } },
    { name: "Sodium", values: { uLight: [1, 0.72, 0.38] } },
    { name: "No fixture", values: { uTube: false } },
  ],
};

export const heartbeatVignette: ShaderEffect = {
  kind: "shader",
  id: "heartbeat-vignette",
  name: "Heartbeat vignette",
  description:
    "A deep red edge round a picture pulsing like a heartbeat, quickening and closing in as the pointer gets nearer a target spot, from a resting pulse up to at most 120 beats a minute; while idle, it drifts nearer and away on its own.",
  category: "horror",
  video: "interactive",
  tags: ["horror", "shock", "heartbeat", "pulse", "vignette", "tension", "interactive", "hover", "image"],
  source: glsl(
    `// Heartbeat vignette: a beat's swell (rising over a tenth of a beat, not snapping on, then dying away) drives a
// red edge's strength and reach. How near the pointer (or, idle, a drifting stand-in) is to the target sets the
// rate between the resting and the fastest pulse.
uniform sampler2D uImage;  // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.landscape} label="Image"
uniform vec3 uColor;       // @control color default=#9E0E18 label="Pulse"
uniform float uTargetX;    // @control min=-0.5 max=0.5 default=0.2 label="Target across"
uniform float uTargetY;    // @control min=-0.5 max=0.5 default=0.08 label="Target up"
uniform float uRest;       // @control min=40 max=110 default=60 step=1 label="Resting pulse (bpm)"
uniform float uFastest;    // @control min=60 max=120 default=115 step=1 label="Fastest pulse (bpm)"
uniform float uStrength;   // @control min=0 max=1 default=0.7 label="Strength"
uniform bool uDemo;        // @control default=true label="Drift nearer while idle"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 target = vec2(uTargetX * aspect, uTargetY);
  float hover = clamp(iPointer.z, 0.0, 1.0);
  vec2 pointer = (iPointer.xy - 0.5 * iResolution.xy) / iResolution.y;
  float idle = uDemo ? 0.7 * (0.5 + 0.5 * cos(iTime * 0.3)) : 0.7;
  float d = mix(idle, length(pointer - target), hover);
  float near = 1.0 - smoothstep(0.05, 0.7, d);
  // Never past 120 a minute (two pulses a second), whatever the controls say.
  float bpm = min(mix(uRest, max(uFastest, uRest), near), 120.0);
  float f = fract(iTime * bpm / 60.0);
  float swell = smoothstep(0.0, 0.1, f) * exp(-max(f - 0.1, 0.0) * 4.5);
  vec2 st = 0.5 + (uv - 0.5) / (1.0 + 0.006 * swell * (0.5 + near));
  vec4 pic = pictureRGBA(uImage, st);
  // Draining and darkening as it gets near.
  float l = dot(pic.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 col = mix(pic.rgb, vec3(l) * 0.85, 0.5 * near * uStrength);
  vec2 e = (uv - 0.5) * 2.0;
  float r = length(e * vec2(1.0, 0.85));
  float reach = 1.05 - 0.25 * near - 0.12 * swell;
  float edge = smoothstep(reach - 0.45, reach + 0.2, r);
  float amount = uStrength * (0.35 + 0.65 * swell * (0.45 + 0.55 * near));
  col = mix(col, uColor * (0.5 + 0.5 * swell), edge * amount);
  fragColor = vec4(col, pic.a);
}`,
  ),
  presets: [
    { name: "Calm", values: { uFastest: 90, uStrength: 0.45 } },
    { name: "Panic", values: { uRest: 90, uFastest: 120, uStrength: 1 } },
    { name: "Cold dread", values: { uColor: [0.08, 0.12, 0.3] } },
    { name: "Pointer only", values: { uDemo: false } },
  ],
};

/** The jump-scare shaders. */
export const shockShaders: ShaderEffect[] = [scareCut, subliminalFlicker, failingLight, heartbeatVignette];
