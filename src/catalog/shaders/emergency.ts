import { glsl, HASH, NOISE } from "../glsl.js";
import { SAMPLE_IMAGES } from "../images.js";
import type { ShaderEffect } from "../types.js";
import { BACKDROP_CONTROLS, PICTURE } from "./image.js";

/*
 * Emergency shaders: the red and blue wash of a light bar, and a picture
 * under red-alert lighting with a beacon sweeping round. Kept below seizure
 * thresholds: neither lights up more than one and a half times a second,
 * clamped in the shader whatever the controls say, and each rises and falls
 * smoothly rather than strobing.
 */

/** The fastest either effect cycles, in cycles a second (each colour lights once a cycle). */
export const EMERGENCY_MAX_RATE = 1.5;

export const sirenLights: ShaderEffect = {
  kind: "shader",
  id: "siren-lights",
  name: "Siren lights",
  description:
    "The red and blue wash of an emergency vehicle's light bar spilling over the frame from above: the two lamps taking turns, or spinning so their beams sweep across, glowing through a faint haze. It lights up at most one and a half times a second.",
  category: "emergency",
  tags: ["emergency", "police", "siren", "light-bar", "red", "blue", "flashing", "overlay", "night"],
  transparent: true,
  source: glsl(
    `// Siren lights: two lamps just above the top of the frame. Pattern 0 alternates them (each rising and falling
// smoothly, half a cycle apart); pattern 1 spins them, so each throws a beam sweeping across and flares as it faces us.
// The rate is clamped to ${EMERGENCY_MAX_RATE} cycles a second in the shader.
uniform vec3 uColorA;           // @control color default=#FF1F2D label="Left lamp"
uniform vec3 uColorB;           // @control color default=#1F5BFF label="Right lamp"
uniform int uPattern;           // @control min=0 max=1 default=0 label="Pattern (0 alternate, 1 rotate)"
uniform float uRate;            // @control min=0.25 max=${EMERGENCY_MAX_RATE} default=1 step=0.05 label="Cycles a second"
uniform float uIntensity;       // @control min=0 max=2 default=1 label="Intensity"
uniform float uSpread;          // @control min=0.2 max=1.5 default=0.7 label="Spread"
uniform float uHaze;            // @control min=0 max=1 default=0.4 label="Haze"
uniform vec3 uBackground;       // @control color default=#05070D label="Background"
uniform float uBackgroundAlpha; // @control min=0 max=1 default=0 label="Background opacity"`,
    HASH,
    NOISE,
    `// A lamp's brightness through its cycle (0–1): rising and falling smoothly over the first half.
float lampOn(float phase) {
  return smoothstep(0.0, 0.18, phase) * (1.0 - smoothstep(0.3, 0.5, phase));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float aspect = iResolution.x / iResolution.y;
  vec2 p = vec2(fragCoord.x / iResolution.y, fragCoord.y / iResolution.y);
  float rate = clamp(uRate, 0.25, ${EMERGENCY_MAX_RATE.toFixed(1)});
  float haze = 1.0 - uHaze + uHaze * (0.55 + 0.9 * vnoise(p * 3.0 + vec2(iTime * 0.08, -iTime * 0.05)));
  vec3 light = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    float side = float(i);
    vec3 colour = i == 0 ? uColorA : uColorB;
    vec2 lamp = vec2(mix(0.2, 0.8, side) * aspect, 1.04);
    vec2 d = p - lamp;
    float r = length(d);
    float phase = fract(iTime * rate + 0.5 * side);
    float on;
    float beam = 0.0;
    if (uPattern == 1) {
      // Spinning: the beam's heading round the lamp; it faces us at a quarter turn.
      float a = phase * 6.28318;
      float facing = pow(max(sin(a), 0.0), 8.0);
      on = 0.12 + 0.88 * facing;
      vec2 dir = normalize(vec2(cos(a) * 1.4, -0.55));
      float along = dot(d, dir);
      float off = length(d - dir * along);
      float cone = 0.06 + 0.22 * max(along, 0.0);
      beam = step(0.0, along) * exp(-off * off / (cone * cone)) * (0.35 + 0.65 * max(-sin(a), 0.0) + facing) / (1.0 + 1.2 * along);
    } else {
      on = lampOn(phase);
    }
    float wash = exp(-r * r / (uSpread * uSpread));
    float hot = 0.004 / (r * r + 0.004);
    light += colour * (on * (0.85 * wash * haze + hot) + 0.9 * beam * haze);
  }
  light *= uIntensity;
  // The light is emission over the background: its strength is its coverage on a clear canvas.
  vec3 premul = uBackground * uBackgroundAlpha * (1.0 - min(max(light.r, max(light.g, light.b)), 1.0)) + light;
  float alpha = clamp(uBackgroundAlpha + max(light.r, max(light.g, light.b)), 0.0, 1.0);
  fragColor = vec4(clamp(premul / max(alpha, 1e-4), 0.0, 1.0), alpha);
}`,
  ),
  presets: [
    { name: "Night street", values: { uBackgroundAlpha: 1, uHaze: 0.6 } },
    { name: "Rotating", values: { uPattern: 1, uRate: 0.8 } },
    { name: "Ambulance", values: { uColorA: [1, 0.12, 0.15], uColorB: [1, 1, 1], uIntensity: 0.8 } },
    { name: "Hazard amber", values: { uColorA: [1, 0.62, 0.05], uColorB: [1, 0.62, 0.05], uPattern: 1, uRate: 0.7 } },
  ],
};

export const redAlert: ShaderEffect = {
  kind: "shader",
  id: "red-alert",
  name: "Red alert",
  description:
    "A picture as the main lights cut to emergency power: the scene drops into shadow and turns red, lit by a beacon spinning overhead whose beam sweeps across it, with a slow red pulse and the corners falling into dark. It sweeps at most one and a half times a second.",
  category: "emergency",
  video: "filter",
  tags: ["emergency", "alarm", "red", "beacon", "klaxon", "alert", "lighting", "image"],
  source: glsl(
    `// Red alert: the picture desaturated and dimmed to emergency light, lit by red from a beacon above the frame
// whose beam fans down and sweeps across (behind the beacon a third of each turn), plus a pulse in time with it.
// The rate is clamped to ${EMERGENCY_MAX_RATE} sweeps a second in the shader.
uniform sampler2D uImage;   // @control filter=linear wrap=clamp default=${SAMPLE_IMAGES.city} label="Image"
uniform vec3 uColor;        // @control color default=#FF2A1F label="Alarm light"
uniform float uRate;        // @control min=0.2 max=${EMERGENCY_MAX_RATE} default=0.6 step=0.05 label="Sweeps a second"
uniform float uDarken;      // @control min=0 max=1 default=0.65 label="Lights out"
uniform float uSweep;       // @control min=0 max=1 default=0.8 label="Beacon beam"
uniform float uPulse;       // @control min=0 max=1 default=0.5 label="Pulse"
uniform float uBeaconX;     // @control min=0 max=1 default=0.5 label="Beacon across"
uniform float uVignette;    // @control min=0 max=1 default=0.6 label="Vignette"
${BACKDROP_CONTROLS}`,
    PICTURE,
    `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec4 pic = pictureRGBA(uImage, uv);
  float lum = dot(pic.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 grey = mix(pic.rgb, vec3(lum), 0.7);

  // The beam's heading from straight down: it crosses the frame (about ±1.2 rad) for two thirds of each turn.
  float rate = clamp(uRate, 0.2, ${EMERGENCY_MAX_RATE.toFixed(1)});
  float turn = fract(iTime * rate);
  float heading = mix(-1.8, 1.8, turn);
  vec2 d = vec2((uv.x - uBeaconX) * aspect, uv.y - 1.08);
  float angle = atan(d.x, -d.y);
  float width = 0.16 + 0.1 * smoothstep(0.0, 1.2, length(d));
  float beam = exp(-pow((angle - heading) / width, 2.0)) * smoothstep(1.8, 1.2, abs(heading));
  float pulse = 0.5 + 0.5 * cos(heading * 1.7);

  vec3 ambient = vec3(1.0 - uDarken * 0.88);
  vec3 lit = ambient + uColor * (uPulse * 0.9 * pulse + uSweep * 2.2 * beam);
  vec3 col = grey * lit;
  // The beacon itself and the haze round it, just above the top of the frame.
  float glow = exp(-dot(d, d) * 40.0);
  col += uColor * glow * (0.4 + 0.6 * pulse);
  vec2 v = uv - 0.5;
  col *= 1.0 - uVignette * smoothstep(0.25, 0.8, length(v * vec2(aspect / 1.4, 1.0)));
  fragColor = vec4(clamp(col, 0.0, 1.0), pic.a);
}`,
  ),
  presets: [
    { name: "Blackout", values: { uDarken: 0.95, uSweep: 1, uPulse: 0.2 } },
    { name: "Amber warning", values: { uColor: [1, 0.6, 0.08], uDarken: 0.4, uRate: 0.4 } },
    { name: "Slow pulse", values: { uSweep: 0.2, uPulse: 1, uRate: 0.3 } },
  ],
};

export const emergencyShaders: ShaderEffect[] = [sirenLights, redAlert];
