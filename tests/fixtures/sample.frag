#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_time;

uniform float speed; // @control min=0.1 max=5.0 default=1.0 label="Animation Speed"
uniform vec3 tint;   // @control color default=#3399ff label="Glow Tint"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float d = length(uv);
  float glow = 0.05 / (d + 0.05 * sin(u_time * speed));
  fragColor = vec4(tint * glow, 1.0);
}

void main() {
  mainImage(fragColor, gl_FragCoord.xy);
}
