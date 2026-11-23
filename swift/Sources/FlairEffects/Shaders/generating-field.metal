// flair-metal-hash: c0be9d2a
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
    packed_float3 uColorC;
    int uMotion;
    float uIntensity;
    float uSpeed;
    float uRadius;
    uint uAnimate;
    float uProgress;
};

struct flair_generating_field_frag_out
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
float2 field(thread const float2& p, thread const float2& uv, thread const float& t, constant FlairUniforms& _276)
{
    if (_276.uMotion == 1)
    {
        float band = 0.5 + (0.5 * sin((uv.y * 18.0) - (t * 4.0)));
        float2 param = float2(floor(uv.y * 24.0), floor(t * 6.0));
        float strip = step(0.699999988079071044921875, hash12(param));
        return float2((0.25 + ((0.550000011920928955078125 * band) * band)) + (0.300000011920928955078125 * strip), (uv.x * 0.5) + (t * 0.0500000007450580596923828125));
    }
    if (_276.uMotion == 2)
    {
        float w = 0.0;
        for (int i = 0; i < 3; i++)
        {
            float fi = float(i);
            float y = 0.5 + ((0.180000007152557373046875 * sin((uv.x * (6.0 + (3.0 * fi))) - (t * (2.0 + fi)))) * (0.60000002384185791015625 + (0.4000000059604644775390625 * sin((t * 0.699999988079071044921875) + (fi * 2.0)))));
            w += exp((-abs(uv.y - y)) * 40.0);
        }
        return float2(0.20000000298023223876953125 + (0.800000011920928955078125 * fast::clamp(w, 0.0, 1.0)), uv.x + (0.100000001490116119384765625 * t));
    }
    if (_276.uMotion == 3)
    {
        float row = floor(uv.y * 7.0);
        float inRow = smoothstep(0.180000007152557373046875, 0.2800000011920928955078125, fract(uv.y * 7.0)) * smoothstep(0.819999992847442626953125, 0.7200000286102294921875, fract(uv.y * 7.0));
        float2 param_1 = float2(row, 2.0);
        float len = 0.550000011920928955078125 + (0.4000000059604644775390625 * hash12(param_1));
        float shimmer = 0.5 + (0.5 * sin(((uv.x - (row * 0.070000000298023223876953125)) * 9.0) - (t * 3.0)));
        return float2((inRow * step(uv.x, len)) * (0.3499999940395355224609375 + (0.64999997615814208984375 * shimmer)), (row * 0.12999999523162841796875) + (t * 0.02999999932944774627685546875));
    }
    if (_276.uMotion == 4)
    {
        float2 g = fract(p * 9.0) - float2(0.5);
        float2 id = floor(p * 9.0);
        float2 param_2 = id;
        float pulse = 0.5 + (0.5 * sin((t * 2.0) + (hash12(param_2) * 6.280000209808349609375)));
        float2 param_3 = id;
        return float2((smoothstep(0.1599999964237213134765625, 0.0500000007450580596923828125, length(g)) * pulse) + (0.1500000059604644775390625 * pulse), hash12(param_3) + (t * 0.0500000007450580596923828125));
    }
    float2 param_4 = (p * 2.0) + float2(0.0, t * 0.20000000298023223876953125);
    int param_5 = 4;
    float _568 = fbm(param_4, param_5);
    float2 param_6 = (p * 2.0) + float2(5.19999980926513671875, (-t) * 0.17000000178813934326171875);
    int param_7 = 4;
    float _580 = fbm(param_6, param_7);
    float2 q = float2(_568, _580);
    float2 param_8 = ((p * 2.2000000476837158203125) + (q * 1.7999999523162841796875)) + float2(t * 0.0500000007450580596923828125);
    int param_9 = 4;
    float _596 = fbm(param_8, param_9);
    float f = _596;
    return float2(smoothstep(0.25, 0.85000002384185791015625, f), f + (q.x * 0.60000002384185791015625));
}

static inline __attribute__((always_inline))
float boxSd(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float3 palette3(thread float& x, constant FlairUniforms& _276)
{
    x = fract(x);
    float3 _265;
    if (x < 0.333000004291534423828125)
    {
        _265 = mix(_276.uColorA, _276.uColorB, float3(x * 3.0));
    }
    else
    {
        float3 _292;
        if (x < 0.666999995708465576171875)
        {
            _292 = mix(_276.uColorB, float3(_276.uColorC), float3((x * 3.0) - 1.0));
        }
        else
        {
            _292 = mix(float3(_276.uColorC), _276.uColorA, float3((x * 3.0) - 2.0));
        }
        _265 = _292;
    }
    return _265;
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _276)
{
    float2 uv = fragCoord / float2(_276.iResolution[0], _276.iResolution[1]);
    float2 p = fragCoord / float2(_276.iResolution[1u]);
    float t = _276.iTime * _276.uSpeed;
    float _634;
    if (_276.uAnimate != 0u)
    {
        _634 = (fract(_276.iTime / 5.0) * 1.14999997615814208984375) - 0.0500000007450580596923828125;
    }
    else
    {
        _634 = fast::clamp(_276.uProgress, 0.0, 1.0);
    }
    float level0 = _634;
    float2 param = p;
    float2 param_1 = uv;
    float param_2 = t;
    float2 f = field(param, param_1, param_2, _276);
    float done = smoothstep(level0 + 0.039999999105930328369140625, level0 - 0.039999999105930328369140625, uv.x);
    float front = (exp(((-abs(uv.x - level0)) * _276.iResolution[0u]) / 18.0) * step(0.001000000047497451305389404296875, level0)) * step(level0, 0.999000012874603271484375);
    float2 hs = float2(_276.iResolution[0], _276.iResolution[1]) * 0.5;
    float2 param_3 = fragCoord - hs;
    float2 param_4 = hs;
    float param_5 = _276.uRadius;
    float inside = smoothstep(1.0, -1.0, boxSd(param_3, param_4, param_5));
    float4 acc = float4(0.0);
    float param_6 = f.y;
    float3 _712 = palette3(param_6, _276);
    float4 param_7 = acc;
    float3 param_8 = _712;
    float param_9 = ((_276.uIntensity * f.x) * (0.3499999940395355224609375 + (0.64999997615814208984375 * done))) * inside;
    acc = over(param_7, param_8, param_9);
    float param_10 = f.y + 0.300000011920928955078125;
    float3 _734 = palette3(param_10, _276);
    float4 param_11 = acc;
    float3 param_12 = mix(_734, float3(1.0), float3(0.4000000059604644775390625));
    float param_13 = (front * _276.uIntensity) * inside;
    acc = over(param_11, param_12, param_13);
    float4 param_14 = acc;
    fragColor = unpremultiply(param_14);
}

fragment flair_generating_field_frag_out flair_generating_field_frag(constant FlairUniforms& _276 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_generating_field_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _764;
    if (_276.flair_flipY > 0.5)
    {
        _764 = _276.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _764 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _764);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _276);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

