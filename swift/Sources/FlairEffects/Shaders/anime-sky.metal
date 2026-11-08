// flair-metal-hash: 8810fc52
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of signed integer mod accurate to SPIR-V specification
template<typename Tx, typename Ty>
inline Tx spvSMod(Tx x, Ty y)
{
    Tx remainder = x - y * (x / y);
    return select(Tx(remainder + y), remainder, remainder == 0 || (x >= 0) == (y >= 0));
}

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
    float3 uZenith;
    float3 uHorizon;
    float3 uCloud;
    float3 uCloudShade;
    packed_float3 uSun;
    float uCover;
    float uScale;
    float uBands;
    float uSpeed;
    float uGlare;
    float uSunX;
    float uSunY;
};

struct flair_anime_sky_frag_out
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
float cloudField(thread const float2& p, thread const int& octaves, constant FlairUniforms& _186)
{
    float2 q = ((p / float2(_186.uScale)) * float2(3.2000000476837158203125, 2.599999904632568359375)) + float2((_186.iTime * _186.uSpeed) * 2.0, 0.0);
    float heap = smoothstep(0.5, -0.5, p.y);
    float2 param = q;
    int param_1 = octaves;
    float _215 = fbm(param, param_1);
    return ((_215 - 0.5) + ((heap - 0.60000002384185791015625) * 0.60000002384185791015625)) + ((_186.uCover - 0.5) * 0.449999988079071044921875);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _186)
{
    float2 uv = fragCoord / float2(_186.iResolution[0], _186.iResolution[1]);
    float aspect = _186.iResolution[0u] / _186.iResolution[1u];
    float2 p = (fragCoord - (float2(_186.iResolution[0], _186.iResolution[1]) * 0.5)) / float2(_186.iResolution[1u]);
    float2 sun = (float2(_186.uSunX, _186.uSunY) - float2(0.5)) * float2(aspect, 1.0);
    float3 col = mix(_186.uHorizon, _186.uZenith, float3(powr(uv.y, 0.800000011920928955078125)));
    float ds = length(p - sun);
    col += ((float3(_186.uSun) * _186.uGlare) * ((0.5 * exp((-ds) * 3.0)) + (0.60000002384185791015625 * exp((-ds) * 18.0))));
    float2 param = p;
    int param_1 = 5;
    float d = cloudField(param, param_1, _186);
    float aa = fast::max(fwidth(d), 9.9999997473787516355514526367188e-05);
    float inside = smoothstep(-aa, aa, d);
    if (inside > 0.0)
    {
        float2 toSun = fast::normalize((sun - p) + float2(9.9999997473787516355514526367188e-05));
        float2 param_2 = p + (fast::normalize(toSun + float2(0.0, 1.0)) * 0.0500000007450580596923828125);
        int param_3 = 3;
        float lit = fast::clamp((1.0499999523162841796875 - (cloudField(param_2, param_3, _186) * 3.0)) + (0.300000011920928955078125 * p.y), 0.0, 1.0);
        float x = lit * _186.uBands;
        float k = floor(x);
        float w = fast::max(fwidth(x), 0.001000000047497451305389404296875) * 0.75;
        float band = fast::min((k + smoothstep(1.0 - w, 1.0, fract(x))) / _186.uBands, 1.0);
        float3 cloud = mix(_186.uCloudShade, _186.uCloud, float3(band));
        float rim = smoothstep(0.02999999932944774627685546875, 0.0, d) * smoothstep(0.4000000059604644775390625, 0.800000011920928955078125, lit);
        cloud = mix(cloud, float3(_186.uSun), float3((rim * 0.5) * (0.4000000059604644775390625 + (0.60000002384185791015625 * _186.uGlare))));
        col = mix(col, cloud, float3(inside));
    }
    for (int i = 0; i < 4; i++)
    {
        float t = 0.5 + (0.449999988079071044921875 * float(i));
        float2 c = sun * (1.0 - (2.0 * t));
        float r = 0.02999999932944774627685546875 + (0.0350000001490116119384765625 * float(spvSMod(i, 3)));
        float ring = (smoothstep(r, r * 0.60000002384185791015625, length(p - c)) * 0.3499999940395355224609375) + (smoothstep(0.01200000010430812835693359375, 0.0, abs(length(p - c) - r)) * 0.4000000059604644775390625);
        col += (((float3(_186.uSun) * ring) * _186.uGlare) * 0.25);
    }
    fragColor = float4(fast::min(col, float3(1.0)), 1.0);
}

fragment flair_anime_sky_frag_out flair_anime_sky_frag(constant FlairUniforms& _186 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_anime_sky_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _498;
    if (_186.flair_flipY > 0.5)
    {
        _498 = _186.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _498 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _498);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _186);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

