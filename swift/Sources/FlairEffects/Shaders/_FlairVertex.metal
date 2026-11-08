#include <metal_stdlib>
using namespace metal;

struct FlairVertexOut {
    float4 position [[position]];
};

vertex FlairVertexOut flair_fullscreen_vertex(uint vid [[vertex_id]]) {
    FlairVertexOut out;
    float2 uv = float2((vid << 1) & 2, vid & 2);
    out.position = float4(uv * 2.0 - 1.0, 0.0, 1.0);
    return out;
}
