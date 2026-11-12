// flair-metal-hash: dec1fe45
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
    float3 uGasA;
    float3 uGasB;
    packed_float3 uDeep;
    float uSpeed;
    float uDensity;
};

struct flair_nebula_frag_out
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
    float2 p = (fragCoord / float2(_182.iResolution[1u])) * 2.0;
    float t = _182.iTime * _182.uSpeed;
    float2 param = p + float2(t);
    int param_1 = 5;
    float _204 = fbm(param, param_1);
    float2 param_2 = (p - float2(t)) + float2(3.2999999523162841796875);
    int param_3 = 5;
    float _214 = fbm(param_2, param_3);
    float2 q = float2(_204, _214);
    float2 param_4 = (p * 1.2999999523162841796875) + (q * 2.5);
    int param_5 = 6;
    float _227 = fbm(param_4, param_5);
    float gas = _227;
    float2 param_6 = (p * 3.0) - q;
    int param_7 = 5;
    float _237 = fbm(param_6, param_7);
    float dust = smoothstep(0.449999988079071044921875, 0.75, _237);
    float3 col = float3(_182.uDeep);
    col += ((_182.uGasA * smoothstep(0.3499999940395355224609375, 0.800000011920928955078125, gas)) * _182.uDensity);
    col += ((_182.uGasB * smoothstep(0.5, 0.89999997615814208984375, (gas * q.x) * 1.60000002384185791015625)) * _182.uDensity);
    col *= (1.0 - (0.60000002384185791015625 * dust));
    float2 param_8 = floor(fragCoord);
    float star = step(0.995999991893768310546875, hash12(param_8));
    float2 param_9 = floor(fragCoord * 0.5) + float2(7.0);
    float bright = step(0.9993000030517578125, hash12(param_9));
    col += float3((star * 0.699999988079071044921875) + (bright * (0.800000011920928955078125 + (0.20000000298023223876953125 * sin((_182.iTime * 4.0) + fragCoord.x)))));
    fragColor = float4(col, 1.0);
}

fragment flair_nebula_frag_out flair_nebula_frag(constant FlairUniforms& _182 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_nebula_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _333;
    if (_182.flair_flipY > 0.5)
    {
        _333 = _182.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _333 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _333);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _182);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

