// flair-metal-hash: 8029c6b3
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
    float3 uDayTop;
    float3 uDayHorizon;
    float3 uGoldTop;
    packed_float3 uGoldHorizon;
    float uSpeed;
    float uCycle;
    float uCoverage;
    int uLayers;
};

struct flair_sky_timelapse_frag_out
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
    float x = (fragCoord.x - (0.5 * _182.iResolution[0u])) / _182.iResolution[1u];
    float y = uv.y;
    float gold = 0.5 - (0.5 * cos((_182.iTime * _182.uCycle) * 6.28318023681640625));
    float3 top = mix(_182.uDayTop, _182.uGoldTop, float3(gold));
    float3 horizon = mix(_182.uDayHorizon, float3(_182.uGoldHorizon), float3(gold));
    float3 sky = mix(horizon, top, float3(powr(y, 0.699999988079071044921875)));
    float2 sunPos = float2(0.3499999940395355224609375, mix(0.85000002384185791015625, 0.07999999821186065673828125, gold));
    float sd = length(float2(x, y) - sunPos);
    float3 sunCol = mix(float3(1.0, 0.9700000286102294921875, 0.89999997615814208984375), float3(1.0, 0.60000002384185791015625, 0.300000011920928955078125), float3(gold));
    sky += (sunCol * (smoothstep(0.04500000178813934326171875, 0.039999999105930328369140625, sd) + (exp((-sd) * 6.0) * 0.3499999940395355224609375)));
    float3 litDay = float3(1.0);
    float3 litGold = float3(1.0, 0.7200000286102294921875, 0.5);
    float3 shadowDay = float3(0.60000002384185791015625, 0.660000026226043701171875, 0.7599999904632568359375);
    float3 shadowGold = float3(0.4199999868869781494140625, 0.300000011920928955078125, 0.4199999868869781494140625);
    float3 col = sky;
    for (int i = 0; i < 4; i++)
    {
        if (i >= _182.uLayers)
        {
            break;
        }
        float fi = float(i);
        float alt = mix(2.400000095367431640625, 0.699999988079071044921875, fi / 3.0);
        float z = alt / (y + 0.119999997317790985107421875);
        float2 plane = float2(x * z, z);
        plane += (float2((_182.iTime * _182.uSpeed) * 0.3499999940395355224609375, (_182.iTime * _182.uSpeed) * 0.119999997317790985107421875) + float2(fi * 13.1000003814697265625));
        float scale = mix(0.89999997615814208984375, 0.5, fi / 3.0);
        float2 cq = plane * scale;
        int oct = (z > 8.0) ? 3 : 5;
        float2 param = cq;
        int param_1 = oct;
        float _373 = fbm(param, param_1);
        float n = _373;
        float cover = mix(0.75, 0.3499999940395355224609375, _182.uCoverage);
        float a = smoothstep(cover, cover + 0.2199999988079071044921875, n);
        float2 param_2 = cq + float2(0.07999999821186065673828125, 0.119999997317790985107421875);
        int param_3 = oct;
        float _394 = fbm(param_2, param_3);
        float n2 = _394;
        float shade = fast::clamp(0.5 + ((n - n2) * 6.0), 0.0, 1.0);
        float3 lit = mix(litDay, litGold, float3(gold));
        float3 shadow = mix(shadowDay, shadowGold, float3(gold)) * mix(1.0, 0.800000011920928955078125, fi / 3.0);
        float3 cc = mix(shadow, lit, float3(shade));
        cc += (((sunCol * exp((-sd) * 3.0)) * 0.4000000059604644775390625) * (1.0 - a));
        a *= smoothstep(0.0, 0.25, y);
        col = mix(col, mix(cc, horizon, float3(exp((-y) * 8.0) * 0.60000002384185791015625)), float3(a));
    }
    fragColor = float4(col, 1.0);
}

fragment flair_sky_timelapse_frag_out flair_sky_timelapse_frag(constant FlairUniforms& _182 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_sky_timelapse_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _473;
    if (_182.flair_flipY > 0.5)
    {
        _473 = _182.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _473 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _473);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _182);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

