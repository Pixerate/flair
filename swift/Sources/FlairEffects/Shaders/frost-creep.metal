// flair-metal-hash: bafae23e
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
    float2 param = (p * _292.uScale) * 1.60000002384185791015625;
    int param_1 = 3;
    float _352 = fbm(param, param_1);
    float2 param_2 = ((p * _292.uScale) * 1.60000002384185791015625) + float2(5.19999980926513671875);
    int param_3 = 3;
    float _363 = fbm(param_2, param_3);
    float2 warp = float2(_352, _363) - float2(0.5);
    float2 param_4 = ((p * _292.uScale) * 2.400000095367431640625) + (warp * 1.2000000476837158203125);
    int param_5 = 5;
    float _381 = fbm(param_4, param_5);
    float plume = _381;
    float2 param_6 = (p * _292.uScale) * 0.85000002384185791015625;
    int param_7 = 4;
    float _392 = fbm(param_6, param_7);
    float n = _392;
    float g = (edge + ((n - 0.5) * 0.2800000011920928955078125)) + ((plume - 0.5) * 0.14000000059604644775390625);
    float front = mix(-0.2199999988079071044921875, 0.7200000286102294921875, coverage);
    float frost = 1.0 - smoothstep(front - 0.119999997317790985107421875, front, g);
    if (frost <= 0.001000000047497451305389404296875)
    {
        fragColor = float4(0.0);
        return;
    }
    float2 param_8 = ((p * _292.uScale) * 5.0) + (warp * 0.800000011920928955078125);
    float4 v = voronoi(param_8);
    float2 param_9 = v.zw + float2(3.099999904632568359375);
    float facet = hash12(param_9);
    float feather = smoothstep(0.319999992847442626953125, 0.7799999713897705078125, plume);
    float2 param_10 = ((p * _292.uScale) * float2(7.0, 2.2000000476837158203125)) + (warp * 2.0);
    int param_11 = 4;
    float _464 = fbm(param_10, param_11);
    float needles = powr(_464, 1.60000002384185791015625);
    float2 param_12 = ((p * _292.uScale) * float2(2.2000000476837158203125, 7.0)) - (warp * 2.0);
    int param_13 = 4;
    float _478 = fbm(param_12, param_13);
    float needles2 = powr(_478, 1.60000002384185791015625);
    float crystal = fast::clamp((needles + needles2) * 0.85000002384185791015625, 0.0, 1.0);
    float2 sp = (p * _292.uScale) * 42.0;
    float2 param_14 = floor(sp);
    float sparkle = (smoothstep(0.839999973773956298828125, 0.9900000095367431640625, hash12(param_14)) * (1.0 - smoothstep(0.0, 0.449999988079071044921875, length(fract(sp) - float2(0.5))))) * crystal;
    float rim = smoothstep(front - 0.100000001490116119384765625, front - 0.0199999995529651641845703125, g) * feather;
    float3 iceBase = mix(_292.uColor * float3(0.75, 0.87999999523162841796875, 1.0), float3(1.0), float3((((0.3499999940395355224609375 * facet) + (0.449999988079071044921875 * crystal)) + (0.3499999940395355224609375 * feather)) + (0.5 * sparkle)));
    float alpha = frost * fast::clamp(((((0.180000007152557373046875 + (0.319999992847442626953125 * feather)) + (0.37999999523162841796875 * crystal)) + (0.14000000059604644775390625 * facet)) + (0.25 * rim)) + (0.20000000298023223876953125 * sparkle), 0.0, 0.959999978542327880859375);
    fragColor = float4(fast::min(iceBase, float3(1.0)), alpha);
}

fragment flair_frost_creep_frag_out flair_frost_creep_frag(constant FlairUniforms& _292 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_frost_creep_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _590;
    if (_292.flair_flipY > 0.5)
    {
        _590 = _292.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _590 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _590);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _292);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

