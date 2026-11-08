// flair-metal-hash: 33ded6d5
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
    float3 uColorA;
    float3 uColorB;
    packed_float3 uBackground;
    float uScale;
    float uSpeed;
    float uCount;
    float uWidth;
    float uGlow;
    float uBackgroundAlpha;
};

struct flair_neon_worms_frag_out
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
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _134)
{
    float2 p = (fragCoord / float2(_134.iResolution[1u])) * _134.uScale;
    float t = _134.iTime * _134.uSpeed;
    float2 param = (p * 1.2999999523162841796875) + float2(t, 0.0);
    float2 param_1 = (p * 1.2999999523162841796875) + float2(4.0, -t);
    float2 w = float2(vnoise(param), vnoise(param_1));
    float2 param_2 = (p + (w * 0.89999997615814208984375)) + float2(0.300000011920928955078125 * t);
    float2 param_3 = ((p * 2.099999904632568359375) - w) + float2(0.0, 0.4000000059604644775390625 * t);
    float n = (0.64999997615814208984375 * vnoise(param_2)) + (0.3499999940395355224609375 * vnoise(param_3));
    float f = (n * _134.uCount) * 2.0;
    float d = abs(fract(f) - 0.5) / fast::max(fwidth(f), 9.9999997473787516355514526367188e-05);
    float x = fragCoord.x / _134.iResolution[0u];
    float3 tint = mix(_134.uColorA, _134.uColorB, float3(0.5 + (0.5 * sin((6.28318023681640625 * ((x * 0.60000002384185791015625) + n)) + (t * 2.0)))));
    float tube = smoothstep(_134.uWidth, _134.uWidth * 0.300000011920928955078125, d);
    float glow = _134.uGlow * exp((-d) / (_134.uWidth * 3.5));
    float3 light = (tint * ((0.550000011920928955078125 * glow) + tube)) + (float3(0.60000002384185791015625) * smoothstep(_134.uWidth * 0.449999988079071044921875, 0.0, d));
    float3 col = (float3(_134.uBackground) * (1.0 - fast::clamp(fast::max(light.x, fast::max(light.y, light.z)), 0.0, 1.0))) + light;
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
    float3 _354;
    if (a > 0.0)
    {
        _354 = bg + (d / float3(a));
    }
    else
    {
        _354 = bg;
    }
    float3 fg = _354;
    float alpha = a + (opacity * (1.0 - a));
    float3 _376;
    if (alpha > 0.0)
    {
        _376 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _376 = bg;
    }
    float3 col = _376;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _134)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _134);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_134.uBackground);
    float param_4 = _134.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_neon_worms_frag_out flair_neon_worms_frag(constant FlairUniforms& _134 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_neon_worms_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _434;
    if (_134.flair_flipY > 0.5)
    {
        _434 = _134.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _434 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _434);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _134);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

