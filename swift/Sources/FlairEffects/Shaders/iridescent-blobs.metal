// flair-metal-hash: 94d1bf39
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
    packed_float3 uBackground;
    float uScale;
    float uSpeed;
    float uAmount;
    float uFilm;
    float uSaturation;
    float uGloss;
    float uBackgroundAlpha;
};

struct flair_iridescent_blobs_frag_out
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
float field(thread const float2& p, thread const float& t)
{
    float2 param = p + float2(t, 0.300000011920928955078125 * t);
    float2 param_1 = ((p * 1.89999997615814208984375) + float2((-0.5) * t, t)) + float2(5.0);
    return (0.60000002384185791015625 * vnoise(param)) + (0.4000000059604644775390625 * vnoise(param_1));
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _169)
{
    float2 p = (fragCoord / float2(_169.iResolution[1u])) * _169.uScale;
    float t = _169.iTime * _169.uSpeed;
    float level0 = mix(0.680000007152557373046875, 0.4000000059604644775390625, _169.uAmount);
    float2 param = p;
    float param_1 = t;
    float f = field(param, param_1);
    float e = 0.00999999977648258209228515625;
    float2 param_2 = p + float2(e, 0.0);
    float param_3 = t;
    float2 param_4 = p + float2(0.0, e);
    float param_5 = t;
    float2 grad = float2(field(param_2, param_3) - f, field(param_4, param_5) - f) / float2(e);
    float inside = f - level0;
    float aa = fwidth(f);
    float mask = smoothstep(-aa, aa, inside);
    float3 n = fast::normalize(float3(((-grad) * 0.300000011920928955078125) / float2(sqrt(fast::max(inside, 0.00200000009499490261077880859375))), 1.0));
    float3 c = float3(0.5) + (cos((float3((_169.uFilm * (((1.60000002384185791015625 * (1.0 - n.z)) + (0.60000002384185791015625 * dot(n.xy, float2(0.699999988079071044921875, 0.4000000059604644775390625)))) + (0.4000000059604644775390625 * f))) + t) + float3(0.0, 0.3300000131130218505859375, 0.670000016689300537109375)) * 6.28318023681640625) * 0.5);
    c = mix(float3(dot(c, float3(0.333000004291534423828125))), c, float3(_169.uSaturation));
    float3 light = float3(-0.4920678436756134033203125, 0.59048140048980712890625, 0.639688193798065185546875);
    float facing = fast::max(dot(reflect(-light, n), float3(0.0, 0.0, 1.0)), 0.0);
    float spec = powr(facing, 60.0) + (0.25 * powr(facing, 6.0));
    float sky = smoothstep(-0.5, 0.60000002384185791015625, n.y + (0.300000011920928955078125 * n.z));
    float3 blob = (c * (0.25 + (0.85000002384185791015625 * sky))) + float3((_169.uGloss * spec) * 1.2999999523162841796875);
    float3 col = float3(_169.uBackground) * (1.0 - ((0.60000002384185791015625 * smoothstep(0.0, -0.07999999821186065673828125, inside)) * step(inside, 0.0)));
    fragColor = float4(mix(col, blob, float3(mask)), 1.0);
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
    float3 _414;
    if (a > 0.0)
    {
        _414 = bg + (d / float3(a));
    }
    else
    {
        _414 = bg;
    }
    float3 fg = _414;
    float alpha = a + (opacity * (1.0 - a));
    float3 _436;
    if (alpha > 0.0)
    {
        _436 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _436 = bg;
    }
    float3 col = _436;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _169)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _169);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_169.uBackground);
    float param_4 = _169.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_iridescent_blobs_frag_out flair_iridescent_blobs_frag(constant FlairUniforms& _169 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_iridescent_blobs_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _494;
    if (_169.flair_flipY > 0.5)
    {
        _494 = _169.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _494 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _494);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _169);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

