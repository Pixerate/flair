/*
 * Regions of a picture placed by hand, in 0–1 of the frame (y up): a box or
 * an ellipse, or a mirrored pair of ellipses (two cheeks, two eyes). The
 * defaults sit on the sample portrait's face.
 */

/** The region controls, with a default region (the sample portrait's face). */
export const regionControls = (centre = "0.5,0.6", size = "0.26,0.5", shape = 1, feather = 4, invertLabel = "Hide everything but the region") =>
  `
uniform vec2 uCentre;      // @control min=0 max=1 default=${centre} label="Region centre"
uniform vec2 uSize;        // @control min=0 max=1 default=${size} label="Region size"
uniform int uShape;        // @control min=0 max=1 default=${shape} label="Region shape (0 box, 1 ellipse)"
uniform float uFeather;    // @control min=0 max=60 default=${feather} label="Edge softness (px)"
uniform bool uInvert;      // @control default=false label="${invertLabel}"`.trim();

/** `region(fragCoord)`: 1 inside the region, 0 outside, soft over `uFeather` pixels (needs {@link regionControls}). */
export const REGION = `
float region(vec2 fragCoord) {
  vec2 hs = max(0.5 * uSize * iResolution.xy, vec2(1.0));
  vec2 p = fragCoord - uCentre * iResolution.xy;
  float d;
  if (uShape == 0) {
    vec2 q = abs(p) - hs;
    d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  } else {
    d = (length(p / hs) - 1.0) * min(hs.x, hs.y);
  }
  float m = 1.0 - smoothstep(-0.5 * uFeather - 0.5, 0.5 * uFeather + 0.5, d);
  return uInvert ? 1.0 - m : m;
}`.trim();

/**
 * The controls of a mirrored pair of ellipses: their midpoint, how far each
 * is from it across the frame, and each one's size.
 */
export const pairRegionControls = (centre: string, spacing: number, size: string, feather: number, what: string) =>
  `
uniform vec2 uCentre;      // @control min=0 max=1 default=${centre} label="${what} centre (between the two)"
uniform float uSpacing;    // @control min=0 max=0.5 default=${spacing} label="${what} spacing (from the centre)"
uniform vec2 uSize;        // @control min=0 max=1 default=${size} label="${what} size (each)"
uniform float uFeather;    // @control min=0 max=120 default=${feather} label="Edge softness (px)"`.trim();

/**
 * `pairRegion(fragCoord)`: 1 inside either ellipse of the pair, 0 outside,
 * soft over `uFeather` pixels; `pairLocal(fragCoord)` is the point in the
 * nearer ellipse's own frame (-1 to 1 across it, x mirrored so it runs
 * outwards on both). Needs {@link pairRegionControls}.
 */
export const PAIR_REGION = `
vec2 pairLocal(vec2 fragCoord) {
  vec2 hs = max(0.5 * uSize * iResolution.xy, vec2(1.0));
  vec2 p = fragCoord - uCentre * iResolution.xy;
  p.x = abs(p.x) - uSpacing * iResolution.x;
  return p / hs;
}
float pairRegion(vec2 fragCoord) {
  vec2 hs = max(0.5 * uSize * iResolution.xy, vec2(1.0));
  float d = (length(pairLocal(fragCoord)) - 1.0) * min(hs.x, hs.y);
  return 1.0 - smoothstep(-0.5 * uFeather - 0.5, 0.5 * uFeather + 0.5, d);
}`.trim();
