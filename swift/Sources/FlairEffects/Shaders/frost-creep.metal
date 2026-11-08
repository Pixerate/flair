// flair-metal-hash: 5f6f86e8
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
    uint uAnimate;
    float uCoverage;
    float uScale;
    float3 uColor;
};

struct flair_frost_creep_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 voronoi(thread const float2& q)
{
    float2 id = floor(q);
    float2 f = fract(q);
    float f1 = 8.0;
    float f2 = 8.0;
    float2 nearest = id;
    for (int j = -1; j <= 1; j++)
    {
        for (int i = -1; i <= 1; i++)
        {
            float2 o = float2(float(i), float(j));
            float2 param = id + o;
            float d = length((o + hash22(param)) - f);
            if (d < f1)
            {
                f2 = f1;
                f1 = d;
                nearest = id + o;
            }
            else
            {
                if (d < f2)
                {
                    f2 = d;
                }
            }
        }
    }
    return float4(f1, f2, nearest);
}

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
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _292)
{
    float2 p = fragCoord / float2(_292.iResolution[1u]);
    float _304;
    if (_292.uAnimate != 0u)
    {
        _304 = 0.5 - (0.5 * cos((_292.iTime * 6.28318023681640625) / 8.0));
    }
    else
    {
        _304 = _292.uCoverage;
    }
    float coverage = _304;
    float edge = fast::min(fast::min(fragCoord.x, _292.iResolution[0u] - fragCoord.x), fast::min(fragCoord.y, _292.iResolution[1u] - fragCoord.y)) / _292.iResolution[1u];
    float2 param = (p * _292.uScale) * 3.0;
    float4 v = voronoi(param);
    float2 param_1 = (p * _292.uScale) * 0.800000011920928955078125;
    int param_2 = 5;
    float _359 = fbm(param_1, param_2);
    float n = _359;
    float2 param_3 = v.zw;
    float g = (edge + ((n - 0.5) * 0.300000011920928955078125)) + ((hash12(param_3) - 0.5) * 0.039999999105930328369140625);
    float front = mix(-0.25, 0.75, coverage);
    float frost = 1.0 - smoothstep(front - 0.0599999986588954925537109375, front, g);
    if (frost <= 0.0)
    {
        fragColor = float4(0.0);
        return;
    }
    float2 param_4 = v.zw + float2(3.099999904632568359375);
    float facet = hash12(param_4);
    float ridges = 1.0 - smoothstep(0.0, 0.0599999986588954925537109375, v.y - v.x);
    float2 param_5 = ((p * _292.uScale) * float2(6.0, 1.5)) + v.zw;
    int param_6 = 3;
    float _426 = fbm(param_5, param_6);
    float needles = smoothstep(0.550000011920928955078125, 0.800000011920928955078125, _426);
    float fresh = 1.0 - smoothstep(0.0, 0.3499999940395355224609375, front - g);
    float rim = smoothstep(front - 0.0599999986588954925537109375, front - 0.014999999664723873138427734375, g);
    float3 col = mix(_292.uColor * float3(0.800000011920928955078125, 0.89999997615814208984375, 1.0), float3(1.0), float3((((facet * 0.4000000059604644775390625) + (ridges * 0.60000002384185791015625)) + (rim * 0.5)) + (needles * 0.4000000059604644775390625)));
    float alpha = frost * fast::clamp(((((0.3499999940395355224609375 + (0.25 * (1.0 - fresh))) + (0.20000000298023223876953125 * facet)) + (0.3499999940395355224609375 * ridges)) + (0.25 * needles)) + (0.300000011920928955078125 * rim), 0.0, 1.0);
    fragColor = float4(fast::min(col, float3(1.0)), alpha);
}

fragment flair_frost_creep_frag_out flair_frost_creep_frag(constant FlairUniforms& _292 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_frost_creep_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _507;
    if (_292.flair_flipY > 0.5)
    {
        _507 = _292.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _507 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _507);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _292);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

