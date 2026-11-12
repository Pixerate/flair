// flair-metal-hash: c6cf28dc
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
    float3 uHot;
    packed_float3 uDisc;
    float uRadius;
    float uSpin;
};

struct flair_event_horizon_frag_out
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
    float2 p = (fragCoord - (float2(_182.iResolution[0], _182.iResolution[1]) * 0.5)) / float2(_182.iResolution[1u]);
    p.y *= 2.2000000476837158203125;
    float r = length(p);
    float a = precise::atan2(p.y, p.x);
    float swirl = (a + ((_182.uSpin * _182.iTime) * 0.5)) + (1.5 / (r + 0.0500000007450580596923828125));
    float2 param = float2(swirl * 3.0, r * 8.0);
    int param_1 = 5;
    float _234 = fbm(param, param_1);
    float streaks = _234;
    float disc = smoothstep(_182.uRadius, _182.uRadius * 1.60000002384185791015625, r) * smoothstep(1.0, _182.uRadius * 1.60000002384185791015625, r);
    float3 col = mix(float3(_182.uDisc), _182.uHot, float3(smoothstep(0.5, 0.89999997615814208984375, streaks) * smoothstep(0.60000002384185791015625, 0.100000001490116119384765625, r)));
    col *= (disc * (0.4000000059604644775390625 + (1.2000000476837158203125 * streaks)));
    col += ((_182.uHot * 0.60000002384185791015625) * exp((-abs(r - (_182.uRadius * 1.0499999523162841796875))) * 60.0));
    col *= smoothstep(_182.uRadius * 0.949999988079071044921875, _182.uRadius * 1.0499999523162841796875, r);
    fragColor = float4(col, 1.0);
}

fragment flair_event_horizon_frag_out flair_event_horizon_frag(constant FlairUniforms& _182 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_event_horizon_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _320;
    if (_182.flair_flipY > 0.5)
    {
        _320 = _182.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _320 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _320);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _182);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

