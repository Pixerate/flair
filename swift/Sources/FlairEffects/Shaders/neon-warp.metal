// flair-metal-hash: cb16c3a4
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
    float3 uColorA;
    float3 uColorB;
    packed_float3 uBackground;
    float uSpeed;
    float uDensity;
    float uLength;
    float uClear;
    float uWidth;
    float uBackgroundAlpha;
};

struct flair_neon_warp_frag_out
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
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _76)
{
    float2 p = (fragCoord - (float2(_76.iResolution[0], _76.iResolution[1]) * 0.5)) / float2(_76.iResolution[1u]);
    float r = length(p);
    float a = (precise::atan2(p.y, p.x) / 6.28318023681640625) + 0.5;
    float3 light = float3(0.0);
    for (int layer = 0; layer < 3; layer++)
    {
        float fl = float(layer);
        float count = floor(_76.uDensity * (1.0 + (0.37000000476837158203125 * fl)));
        float slot = floor((a * count) + (fl * 0.37000000476837158203125));
        float2 param = float2(slot, (fl * 13.0) + 1.0);
        float h = hash12(param);
        float z = fract((h * 7.0) + ((_76.iTime * _76.uSpeed) * (0.5 + h)));
        float head = _76.uClear + ((z * z) * 1.2999999523162841796875);
        float len = _76.uLength * (0.20000000298023223876953125 + z);
        float along = smoothstep(head - len, head, r) * step(r, head);
        float across = (((abs(fract((a * count) + (fl * 0.37000000476837158203125)) - 0.5) / count) * 6.28318023681640625) * r) * _76.iResolution[1u];
        float line = ((smoothstep(_76.uWidth, 0.0, across) * along) * smoothstep(0.0, 0.1500000059604644775390625, z)) * step(0.3499999940395355224609375, h);
        float2 param_1 = float2(slot, fl + 5.0);
        float3 tint = mix(_76.uColorA, _76.uColorB, float3(step(0.5, hash12(param_1))));
        light += ((tint * line) * (0.60000002384185791015625 + (1.2000000476837158203125 * z)));
    }
    light += ((mix(_76.uColorA, _76.uColorB, float3(0.5)) * 0.119999997317790985107421875) * exp((-powr(r - _76.uClear, 2.0)) * 40.0));
    float3 col = (float3(_76.uBackground) * (1.0 - fast::clamp(fast::max(light.x, fast::max(light.y, light.z)), 0.0, 1.0))) + light;
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
    float3 _342;
    if (a > 0.0)
    {
        _342 = bg + (d / float3(a));
    }
    else
    {
        _342 = bg;
    }
    float3 fg = _342;
    float alpha = a + (opacity * (1.0 - a));
    float3 _364;
    if (alpha > 0.0)
    {
        _364 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _364 = bg;
    }
    float3 col = _364;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _76)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _76);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_76.uBackground);
    float param_4 = _76.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_neon_warp_frag_out flair_neon_warp_frag(constant FlairUniforms& _76 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_neon_warp_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _422;
    if (_76.flair_flipY > 0.5)
    {
        _422 = _76.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _422 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _422);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _76);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

