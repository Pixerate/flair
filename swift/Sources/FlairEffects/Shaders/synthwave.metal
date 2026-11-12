// flair-metal-hash: 4b604a4f
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float3 uSkyTop;
    float3 uSkyBottom;
    float3 uSunTop;
    float3 uSunBottom;
    packed_float3 uGrid;
    float uHorizon;
};

struct flair_synthwave_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _29)
{
    float2 uv = fragCoord / float2(_29.iResolution[0], _29.iResolution[1]);
    float2 p = (fragCoord - (float2(_29.iResolution[0], _29.iResolution[1]) * 0.5)) / float2(_29.iResolution[1u]);
    float horizon = _29.uHorizon - 0.5;
    float3 col;
    if (p.y > horizon)
    {
        float h = (p.y - horizon) / (0.5 - horizon);
        col = mix(_29.uSkyBottom, _29.uSkyTop, float3(h));
        float2 s = p - float2(0.0, horizon + 0.180000007152557373046875);
        float sun = smoothstep(0.20000000298023223876953125, 0.194999992847442626953125, length(s));
        float bands = step(0.0, sin(((s.y + 0.20000000298023223876953125) * 60.0) - 1.5)) + step(0.0599999986588954925537109375, s.y);
        sun *= fast::clamp(bands, 0.0, 1.0);
        col = mix(col, mix(_29.uSunBottom, _29.uSunTop, float3(fast::clamp(((s.y / 0.20000000298023223876953125) * 0.5) + 0.5, 0.0, 1.0))), float3(sun));
        col += ((_29.uSunBottom * 0.25) * exp((-length(s)) * 4.0));
    }
    else
    {
        float depth = horizon - p.y;
        float2 g = float2(p.x / depth, 1.0 / depth);
        g.y += (_29.iTime * 2.0);
        float2 grid = abs(fract(g * 0.5) - float2(0.5)) / fwidth(g * 0.5);
        float line = 1.0 - fast::clamp(fast::min(grid.x, grid.y), 0.0, 1.0);
        float fade = smoothstep(0.0, 0.25, depth);
        col = mix(_29.uSkyTop * 0.4000000059604644775390625, _29.uSkyBottom * 0.300000011920928955078125, float3(uv.y));
        col += (((float3(_29.uGrid) * line) * fade) + ((float3(_29.uGrid) * 0.25) * exp((-depth) * 20.0)));
    }
    fragColor = float4(col, 1.0);
}

fragment flair_synthwave_frag_out flair_synthwave_frag(constant FlairUniforms& _29 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_synthwave_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _241;
    if (_29.flair_flipY > 0.5)
    {
        _241 = _29.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _241 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _241);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _29);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

