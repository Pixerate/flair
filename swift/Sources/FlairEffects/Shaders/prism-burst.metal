// flair-metal-hash: b8e70187
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
    float2 uCenter;
    float uRays;
    float uSharpness;
    float uSpin;
    float uSaturation;
    float uCore;
    float uReach;
    float uBackgroundAlpha;
};

struct flair_prism_burst_frag_out
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
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _135)
{
    float2 p = ((fragCoord - (float2(_135.iResolution[0], _135.iResolution[1]) * 0.5)) / float2(_135.iResolution[1u])) - _135.uCenter;
    float r = length(p);
    float a = precise::atan2(p.y, p.x) + (_135.iTime * _135.uSpin);
    float2 dir = float2(cos(a), sin(a));
    float2 param = ((dir * _135.uRays) * 0.5) + float2(_135.iTime * 0.1500000059604644775390625);
    float2 param_1 = (((dir * _135.uRays) * 1.2999999523162841796875) - float2(_135.iTime * 0.100000001490116119384765625)) + float2(7.0);
    float n = (0.60000002384185791015625 * vnoise(param)) + (0.4000000059604644775390625 * vnoise(param_1));
    float rays = powr(n, _135.uSharpness) * 2.2000000476837158203125;
    float3 hue = float3(0.5) + (cos((float3(a * 2.0) + float3(0.0, 2.099999904632568359375, 4.19999980926513671875)) + float3(_135.iTime * 0.20000000298023223876953125)) * 0.5);
    hue = mix(float3(dot(hue, float3(0.333000004291534423828125))), hue, float3(_135.uSaturation));
    float fall = exp((-r) / _135.uReach);
    float3 light = (((hue * rays) * fall) * smoothstep(0.0, 0.07999999821186065673828125, r)) * 1.39999997615814208984375;
    light += ((((float3(0.01200000010430812835693359375, 0.011640000157058238983154296875, 0.01104000024497509002685546875) / float3((r * r) + 0.0040000001899898052215576171875)) * 0.1500000059604644775390625) + ((hue * 0.25) * exp((-r) * 6.0))) * _135.uCore);
    float3 col = (_135.uBackground * (1.0 - fast::clamp(fast::max(light.x, fast::max(light.y, light.z)), 0.0, 1.0))) + light;
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
    float3 _365;
    if (a > 0.0)
    {
        _365 = bg + (d / float3(a));
    }
    else
    {
        _365 = bg;
    }
    float3 fg = _365;
    float alpha = a + (opacity * (1.0 - a));
    float3 _387;
    if (alpha > 0.0)
    {
        _387 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _387 = bg;
    }
    float3 col = _387;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _135)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _135);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _135.uBackground;
    float param_4 = _135.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_prism_burst_frag_out flair_prism_burst_frag(constant FlairUniforms& _135 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_prism_burst_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _445;
    if (_135.flair_flipY > 0.5)
    {
        _445 = _135.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _445 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _445);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _135);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

