// flair-metal-hash: 5f1774c1
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
    float uRadius;
    float uSoftness;
    float uDarkness;
    float uSpeed;
    float3 uShade;
};

struct flair_spotlight_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _30)
{
    float2 p = (fragCoord - (float2(_30.iResolution[0], _30.iResolution[1]) * 0.5)) / float2(_30.iResolution[1u]);
    float aspect = _30.iResolution[0u] / _30.iResolution[1u];
    float px = 1.0 / _30.iResolution[1u];
    float t = _30.iTime * _30.uSpeed;
    float2 _73;
    if (_30.iMouse.z > 0.0)
    {
        _73 = (_30.iMouse.xy - (float2(_30.iResolution[0], _30.iResolution[1]) * 0.5)) / float2(_30.iResolution[1u]);
    }
    else
    {
        _73 = float2((sin(t * 2.0) * 0.319999992847442626953125) * aspect, sin((t * 3.0) + 0.5) * 0.2800000011920928955078125);
    }
    float2 centre = _73;
    float r = length(p - centre);
    float dark = smoothstep((_30.uRadius * (1.0 - _30.uSoftness)) - px, _30.uRadius + px, r);
    fragColor = float4(_30.uShade, dark * _30.uDarkness);
}

fragment flair_spotlight_frag_out flair_spotlight_frag(constant FlairUniforms& _30 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_spotlight_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _153;
    if (_30.flair_flipY > 0.5)
    {
        _153 = _30.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _153 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _153);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _30);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

