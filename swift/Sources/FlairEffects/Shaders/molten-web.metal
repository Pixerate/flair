// flair-metal-hash: d123d725
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
    float3 uHot;
    float3 uGlowColor;
    packed_float3 uRock;
    float uScale;
    float uSpeed;
    float uSharpness;
    float uFlicker;
};

struct flair_molten_web_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float ridge(thread const float2& p)
{
    float2 param = p;
    return 1.0 - abs((2.0 * vnoise(param)) - 1.0);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _136)
{
    float2 p = (fragCoord / float2(_136.iResolution[1u])) * _136.uScale;
    float t = _136.iTime * _136.uSpeed;
    float2 param = (p * 0.699999988079071044921875) + float2(t);
    float2 param_1 = (p * 0.699999988079071044921875) + float2(3.7000000476837158203125, -t);
    float2 w = float2(vnoise(param), vnoise(param_1));
    p += (w * 0.800000011920928955078125);
    float2 param_2 = p + float2(0.0, t * 0.5);
    float2 param_3 = ((p * 2.0299999713897705078125) + float2(11.0)) - float2(t * 0.300000011920928955078125);
    float r = (0.64999997615814208984375 * powr(ridge(param_2), _136.uSharpness)) + (0.3499999940395355224609375 * powr(ridge(param_3), _136.uSharpness * 1.39999997615814208984375));
    float2 param_4 = (p * 1.5) + float2(_136.iTime * 1.2999999523162841796875);
    r *= (1.0 - ((_136.uFlicker * 0.5) * vnoise(param_4)));
    float3 col = mix(float3(_136.uRock), _136.uGlowColor, float3(smoothstep(0.0500000007450580596923828125, 0.550000011920928955078125, r)));
    col = mix(col, _136.uHot, float3(smoothstep(0.550000011920928955078125, 0.949999988079071044921875, r)));
    col += ((_136.uGlowColor * 0.25) * smoothstep(0.0, 0.4000000059604644775390625, r));
    fragColor = float4(col, 1.0);
}

fragment flair_molten_web_frag_out flair_molten_web_frag(constant FlairUniforms& _136 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_molten_web_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _285;
    if (_136.flair_flipY > 0.5)
    {
        _285 = _136.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _285 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _285);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _136);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

