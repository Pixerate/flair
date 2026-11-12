// flair-metal-hash: a48cec40
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
    float3 uStone;
    float3 uVein;
    packed_float3 uAccent;
    float uSpeed;
    float uScale;
    float uWarp;
};

struct flair_marble_frag_out
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
    float2 p = (fragCoord / float2(_182.iResolution[1u])) * _182.uScale;
    float t = _182.iTime * _182.uSpeed;
    float2 param = p + float2(0.0, t);
    int param_1 = 5;
    float _207 = fbm(param, param_1);
    float2 param_2 = p + float2(5.19999980926513671875, 1.2999999523162841796875 - t);
    int param_3 = 5;
    float _217 = fbm(param_2, param_3);
    float2 q = float2(_207, _217);
    float2 param_4 = ((p + (q * _182.uWarp)) + float2(1.7000000476837158203125, 9.19999980926513671875)) + float2(0.300000011920928955078125 * t);
    int param_5 = 5;
    float _238 = fbm(param_4, param_5);
    float2 param_6 = (p + (q * _182.uWarp)) + float2(8.30000019073486328125, 2.7999999523162841796875);
    int param_7 = 5;
    float _251 = fbm(param_6, param_7);
    float2 r = float2(_238, _251);
    float2 param_8 = p + (r * _182.uWarp);
    int param_9 = 5;
    float _262 = fbm(param_8, param_9);
    float f = _262;
    float vein = 1.0 - smoothstep(0.0, 0.0599999986588954925537109375, abs(sin((f * 12.0) + (r.x * 6.0))));
    float3 col = mix(_182.uStone, _182.uStone * 0.85000002384185791015625, float3(length(q) * 0.60000002384185791015625));
    col = mix(col, float3(_182.uAccent), float3(smoothstep(0.550000011920928955078125, 0.89999997615814208984375, r.y) * 0.5));
    col = mix(col, _182.uVein, float3(vein * 0.85000002384185791015625));
    fragColor = float4(col, 1.0);
}

fragment flair_marble_frag_out flair_marble_frag(constant FlairUniforms& _182 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_marble_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _327;
    if (_182.flair_flipY > 0.5)
    {
        _327 = _182.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _327 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _327);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _182);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

