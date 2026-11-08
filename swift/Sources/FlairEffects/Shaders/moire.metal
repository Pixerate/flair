// flair-metal-hash: 9623b58a
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
    float3 uInk;
    packed_float3 uPaper;
    float uRings;
    float uDrift;
};

struct flair_moire_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _30)
{
    float2 p = (fragCoord - (float2(_30.iResolution[0], _30.iResolution[1]) * 0.5)) / float2(_30.iResolution[1u]);
    float2 o = float2(sin(_30.iTime * 0.4000000059604644775390625), cos(_30.iTime * 0.300000011920928955078125)) * _30.uDrift;
    float a = sin(length(p - o) * _30.uRings);
    float b = sin(length(p + o) * _30.uRings);
    float v = smoothstep(-0.20000000298023223876953125, 0.20000000298023223876953125, a * b);
    fragColor = float4(mix(_30.uInk, float3(_30.uPaper), float3(v)), 1.0);
}

fragment flair_moire_frag_out flair_moire_frag(constant FlairUniforms& _30 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_moire_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _117;
    if (_30.flair_flipY > 0.5)
    {
        _117 = _30.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _117 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _117);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _30);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

