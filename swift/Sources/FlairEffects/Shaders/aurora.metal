// flair-metal-hash: ca74fe52
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
    float3 uSky;
    float3 uGlowA;
    packed_float3 uGlowB;
    float uSpeed;
    float uIntensity;
    float uHeight;
};

struct flair_aurora_frag_out
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _182)
{
    float2 uv = fragCoord / float2(_182.iResolution[0], _182.iResolution[1]);
    float t = _182.iTime * _182.uSpeed;
    float3 col = _182.uSky * (0.60000002384185791015625 + (0.4000000059604644775390625 * uv.y));
    for (int i = 0; i < 3; i++)
    {
        float fi = float(i);
        float x = (uv.x * (1.39999997615814208984375 + (0.300000011920928955078125 * fi))) + (fi * 3.7000000476837158203125);
        float2 param = float2((x * 1.5) + (t * 0.4000000059604644775390625), (t * 0.25) + fi);
        int param_1 = 4;
        float _247 = fbm(param, param_1);
        float wave = _247;
        float centre = (_182.uHeight + (0.180000007152557373046875 * (wave - 0.5))) + (0.0599999986588954925537109375 * fi);
        float band = exp(-powr((uv.y - centre) * (7.0 + (2.0 * fi)), 2.0));
        float2 param_2 = float2(x * 12.0, (t * 0.60000002384185791015625) + (fi * 9.0));
        int param_3 = 3;
        float _289 = fbm(param_2, param_3);
        float rays = 0.550000011920928955078125 + (0.449999988079071044921875 * _289);
        float above = smoothstep(centre - 0.0500000007450580596923828125, centre + 0.3499999940395355224609375, uv.y) * 0.3499999940395355224609375;
        float3 glow = mix(_182.uGlowA, float3(_182.uGlowB), float3(fast::clamp(((uv.y * 1.39999997615814208984375) - 0.20000000298023223876953125) + (0.25 * fi), 0.0, 1.0)));
        col += (((glow * ((band * rays) + (above * band))) * 0.60000002384185791015625) * _182.uIntensity);
    }
    float2 param_4 = floor(fragCoord * 0.5);
    float stars = step(0.9969999790191650390625, hash12(param_4)) * smoothstep(0.300000011920928955078125, 1.0, uv.y);
    float2 param_5 = floor(fragCoord);
    col += float3((stars * 0.60000002384185791015625) * (0.5 + (0.5 * sin((_182.iTime * 3.0) + (hash12(param_5) * 40.0)))));
    fragColor = float4(col, 1.0);
}

fragment flair_aurora_frag_out flair_aurora_frag(constant FlairUniforms& _182 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_aurora_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _387;
    if (_182.flair_flipY > 0.5)
    {
        _387 = _182.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _387 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _387);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _182);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

