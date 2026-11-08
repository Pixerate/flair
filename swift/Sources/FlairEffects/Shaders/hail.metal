// flair-metal-hash: f80ddce6
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
    float3 uColor;
    packed_float3 uShade;
    float uDensity;
    float uSize;
    float uGround;
    float uBounce;
    float uSpeed;
};

struct flair_hail_frag_out
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
float4 stoneAt(thread const float& tau, thread const float& r, thread const float& drift, constant FlairUniforms& _71)
{
    float h0 = (1.10000002384185791015625 - _71.uGround) - r;
    float tf = sqrt((2.0 * h0) / 3.2000000476837158203125);
    if (tau < tf)
    {
        return float4(0.0, 1.10000002384185791015625 - ((1.60000002384185791015625 * tau) * tau), 3.2000000476837158203125 * tau, 1.0);
    }
    float v = 3.2000000476837158203125 * tf;
    float t = tau - tf;
    float x = 0.0;
    for (int b = 0; b < 3; b++)
    {
        v *= _71.uBounce;
        float d = (2.0 * v) / 3.2000000476837158203125;
        if (t < d)
        {
            return float4(drift * (x + t), ((_71.uGround + r) + (v * t)) - ((1.60000002384185791015625 * t) * t), abs(v - (3.2000000476837158203125 * t)), 1.0);
        }
        t -= d;
        x += d;
    }
    return float4(drift * x, _71.uGround + r, 0.0, 1.0 - smoothstep(0.20000000298023223876953125, 0.699999988079071044921875, t));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _71)
{
    float px = 1.0 / _71.iResolution[1u];
    float2 p = fragCoord * px;
    float w = 0.0350000001490116119384765625;
    float col0 = floor(p.x / w);
    float4 acc = float4(0.0);
    for (int c = -1; c <= 1; c++)
    {
        float column = col0 + float(c);
        for (int k = 0; k < 2; k++)
        {
            float2 id = float2(column, float(k));
            float2 param = id;
            float period = 1.2999999523162841796875 + (1.2000000476837158203125 * hash12(param));
            float2 param_1 = id + float2(3.099999904632568359375);
            float time = (_71.iTime * _71.uSpeed) + (hash12(param_1) * period);
            float cycle = floor(time / period);
            float tau = time - (cycle * period);
            float2 seed = id + float2(cycle * 7.13000011444091796875);
            float2 param_2 = seed + float2(1.89999997615814208984375);
            if (hash12(param_2) > _71.uDensity)
            {
                continue;
            }
            float2 param_3 = seed + float2(5.5);
            float r = (0.008000000379979610443115234375 + (0.0089999996125698089599609375 * hash12(param_3))) * _71.uSize;
            float2 param_4 = seed + float2(8.19999980926513671875);
            float drift = (hash12(param_4) - 0.5) * 0.25;
            float param_5 = tau;
            float param_6 = r;
            float param_7 = drift;
            float4 s = stoneAt(param_5, param_6, param_7, _71);
            if (s.w <= 0.0)
            {
                continue;
            }
            float2 param_8 = seed + float2(2.400000095367431640625);
            float2 centre = float2((((column + 0.20000000298023223876953125) + (0.60000002384185791015625 * hash12(param_8))) * w) + s.x, s.y);
            float2 d = p - centre;
            d.y /= (1.0 + fast::min(s.z * 0.119999997317790985107421875, 0.60000002384185791015625));
            float dist = length(d);
            float disc = 1.0 - smoothstep(r - px, r + px, dist);
            if (disc <= 0.0)
            {
                continue;
            }
            float2 n = d / float2(r);
            float light = fast::clamp(0.60000002384185791015625 - (0.5 * dot(n, float2(0.60000002384185791015625, -0.60000002384185791015625))), 0.0, 1.0);
            float3 colour = mix(float3(_71.uShade), _71.uColor, float3(light));
            colour += float3(smoothstep(0.3499999940395355224609375, 0.100000001490116119384765625, length(n - float2(-0.3499999940395355224609375, 0.3499999940395355224609375))) * 0.5);
            float a = (disc * s.w) * 0.949999988079071044921875;
            float4 _423 = acc;
            float3 _428 = mix(_423.xyz, colour, float3(a));
            acc.x = _428.x;
            acc.y = _428.y;
            acc.z = _428.z;
            acc.w = fast::max(acc.w, a);
        }
    }
    fragColor = float4(fast::min(acc.xyz, float3(1.0)), acc.w);
}

fragment flair_hail_frag_out flair_hail_frag(constant FlairUniforms& _71 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_hail_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _466;
    if (_71.flair_flipY > 0.5)
    {
        _466 = _71.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _466 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _466);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _71);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

