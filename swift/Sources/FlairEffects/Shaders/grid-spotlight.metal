// flair-metal-hash: 12b1a681
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
    float3 uBackground;
    float3 uLine;
    packed_float3 uSpot;
    float uBase;
    float uCell;
    float uRadius;
    float uGlow;
    float uEdge;
    uint uDemo;
    float uBackgroundAlpha;
};

struct flair_grid_spotlight_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 hoverPoint(thread const bool& demo, thread const float& idle, constant FlairUniforms& _47)
{
    float2 drift = float2(_47.iResolution[0], _47.iResolution[1]) * (float2(0.5) + float2(0.300000011920928955078125 * sin(_47.iTime * 0.5299999713897705078125), 0.25 * sin((_47.iTime * 0.769999980926513671875) + 1.2999999523162841796875)));
    float h = fast::clamp(_47.iPointer.z, 0.0, 1.0);
    return float3(mix(drift, _47.iPointer.xy, float2(h)), mix(demo ? idle : 0.0, 1.0, h));
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _47)
{
    float px = 1.0 / _47.iResolution[1u];
    float2 p = fragCoord * px;
    bool param = _47.uDemo != 0u;
    float param_1 = 0.85000002384185791015625;
    float3 hp = hoverPoint(param, param_1, _47);
    float2 g = (abs(fract((p / float2(_47.uCell)) + float2(0.5)) - float2(0.5)) * _47.uCell) / float2(px);
    float line = fast::clamp(1.0 - fast::min(g.x, g.y), 0.0, 1.0);
    float node = fast::clamp(2.0 - length(g), 0.0, 1.0);
    float d = length(fragCoord - hp.xy) * px;
    float spot = exp(((-d) * d) / (_47.uRadius * _47.uRadius)) * hp.z;
    float2 uv = fragCoord / float2(_47.iResolution[0], _47.iResolution[1]);
    float2 e = (fast::min(uv, float2(1.0) - uv) * float2(_47.iResolution[0], _47.iResolution[1])) * px;
    float _202;
    if (_47.uEdge > 0.0)
    {
        _202 = smoothstep(0.0, 0.5 * _47.uEdge, fast::min(e.x, e.y));
    }
    else
    {
        _202 = 1.0;
    }
    float edge = _202;
    float level0 = (_47.uBase + (((1.0 - _47.uBase) * spot) * 0.699999988079071044921875)) * edge;
    float3 col = _47.uBackground + ((((float3(_47.uSpot) * spot) * _47.uGlow) * 0.25) * edge);
    float3 ink = mix(_47.uLine, float3(_47.uSpot), float3(0.5 * spot));
    col = mix(col, ink, float3(fast::clamp(fast::max(line, node * (0.5 + spot)) * level0, 0.0, 1.0)));
    fragColor = float4(col, 1.0);
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _319;
    if (a > 0.0)
    {
        _319 = bg + (d / float3(a));
    }
    else
    {
        _319 = bg;
    }
    float3 fg = _319;
    float alpha = a + (opacity * (1.0 - a));
    float3 _341;
    if (alpha > 0.0)
    {
        _341 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _341 = bg;
    }
    float3 col = _341;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _47)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _47);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _47.uBackground;
    float param_4 = _47.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_grid_spotlight_frag_out flair_grid_spotlight_frag(constant FlairUniforms& _47 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_grid_spotlight_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _399;
    if (_47.flair_flipY > 0.5)
    {
        _399 = _47.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _399 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _399);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _47);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

