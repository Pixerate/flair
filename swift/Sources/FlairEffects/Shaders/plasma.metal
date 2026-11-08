// flair-metal-hash: 064060a2
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
    float uScale;
    float uShift;
    float3 uPhase;
};

struct flair_plasma_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 palette(thread const float& t, thread const float3& a, thread const float3& b, thread const float3& c, thread const float3& d)
{
    return a + (b * cos(((c * t) + d) * 6.28318023681640625));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _54)
{
    float2 p = ((fragCoord - (float2(_54.iResolution[0], _54.iResolution[1]) * 0.5)) / float2(_54.iResolution[1u])) * _54.uScale;
    float t = _54.iTime;
    float v = sin(p.x + t);
    v += sin((p.y + t) * 0.5);
    v += sin(((p.x + p.y) + t) * 0.5);
    float2 c = p + ((float2(sin(t * 0.5), cos(t * 0.5)) * _54.uScale) * 0.300000011920928955078125);
    v += sin(sqrt(dot(c, c) + 1.0) + t);
    float param = (v * 0.25) + _54.uShift;
    float3 param_1 = float3(0.5);
    float3 param_2 = float3(0.5);
    float3 param_3 = float3(1.0);
    float3 param_4 = _54.uPhase;
    float3 col = palette(param, param_1, param_2, param_3, param_4);
    fragColor = float4(col, 1.0);
}

fragment flair_plasma_frag_out flair_plasma_frag(constant FlairUniforms& _54 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_plasma_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _166;
    if (_54.flair_flipY > 0.5)
    {
        _166 = _54.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _166 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _166);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _54);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

