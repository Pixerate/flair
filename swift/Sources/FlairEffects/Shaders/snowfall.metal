// flair-metal-hash: e0a254ad
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
    packed_float3 uColor;
    float uDensity;
    float uWind;
    float uSpeed;
    float uSize;
    int uLayers;
};

struct flair_snowfall_frag_out
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
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _97)
{
    float2 p = fragCoord / float2(_97.iResolution[1u]);
    float px = 1.0 / _97.iResolution[1u];
    float a = 0.0;
    for (int i = 0; i < 6; i++)
    {
        if (i >= _97.uLayers)
        {
            break;
        }
        float fi = float(i);
        float depth = (fi + 1.0) / float(_97.uLayers);
        float scale = mix(22.0, 6.0, depth);
        float2 vel = float2((_97.uWind * 0.119999997317790985107421875) * (0.4000000059604644775390625 + depth), (-_97.uSpeed) * mix(0.0599999986588954925537109375, 0.25, depth));
        float2 q = ((p - (vel * _97.iTime)) * scale) + float2(fi * 11.30000019073486328125);
        float2 id = floor(q);
        float2 param = id;
        float2 h = hash22(param);
        float2 param_1 = id + float2(3.7000000476837158203125);
        if (hash12(param_1) > _97.uDensity)
        {
            continue;
        }
        float phase = (_97.iTime * (0.4000000059604644775390625 + (0.60000002384185791015625 * h.x))) + (h.y * 6.28318023681640625);
        float2 centre = ((h - float2(0.5)) * 0.300000011920928955078125) + float2(sin(phase) * 0.119999997317790985107421875, cos(phase * 0.699999988079071044921875) * 0.0500000007450580596923828125);
        float d = length((fract(q) - float2(0.5)) - centre);
        float2 param_2 = id + float2(9.1000003814697265625);
        float r = (0.0599999986588954925537109375 * _97.uSize) * (0.60000002384185791015625 + (0.800000011920928955078125 * hash12(param_2)));
        float soft = fast::max((px * scale) * 1.5, r * mix(0.89999997615814208984375, 0.300000011920928955078125, depth));
        float flake = 1.0 - smoothstep(r - soft, r, d);
        a = fast::max(a, flake * mix(0.449999988079071044921875, 1.0, depth));
    }
    fragColor = float4(_97.uColor[0], _97.uColor[1], _97.uColor[2], a);
}

fragment flair_snowfall_frag_out flair_snowfall_frag(constant FlairUniforms& _97 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_snowfall_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _306;
    if (_97.flair_flipY > 0.5)
    {
        _306 = _97.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _306 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _306);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _97);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

