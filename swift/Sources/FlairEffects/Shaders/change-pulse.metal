// flair-metal-hash: 242aa1a6
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
    int uTone;
    float3 uCreate;
    float3 uUpdate;
    packed_float3 uRemove;
    float uRadius;
    float uInset;
    float uSpread;
    float uStrength;
    uint uAnimate;
    float uProgress;
};

struct flair_change_pulse_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float boxSd(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _112)
{
    float _119;
    if (_112.uAnimate != 0u)
    {
        _119 = smoothstep(0.0, 0.85000002384185791015625, fract(_112.iTime / 2.0));
    }
    else
    {
        _119 = fast::clamp(_112.uProgress, 0.0, 1.0);
    }
    float t = _119;
    float2 hs = float2(_112.iResolution[0], _112.iResolution[1]) * 0.5;
    float2 p = fragCoord - hs;
    float2 b = fast::max(hs - float2(_112.uInset), float2(1.0));
    float r = fast::min(_112.uRadius, fast::min(b.x, b.y));
    float3 _174;
    if (_112.uTone == 0)
    {
        _174 = _112.uCreate;
    }
    else
    {
        float3 _185;
        if (_112.uTone == 2)
        {
            _185 = float3(_112.uRemove);
        }
        else
        {
            _185 = _112.uUpdate;
        }
        _174 = _185;
    }
    float3 c = _174;
    float fade = 1.0 - t;
    float4 acc = float4(0.0);
    if (_112.uTone == 2)
    {
        float2 param = p;
        float2 param_1 = b * (1.0 - (0.25 * t));
        float param_2 = r;
        float d = boxSd(param, param_1, param_2);
        float fill = ((smoothstep(1.0, -1.0, d) * 0.3499999940395355224609375) * fade) * fade;
        float ring = exp((-abs(d)) / 2.0) * fade;
        float4 param_3 = acc;
        float3 param_4 = c;
        float param_5 = fill * _112.uStrength;
        acc = over(param_3, param_4, param_5);
        float4 param_6 = acc;
        float3 param_7 = c;
        float param_8 = ring * _112.uStrength;
        acc = over(param_6, param_7, param_8);
    }
    else
    {
        if (_112.uTone == 0)
        {
            float2 param_9 = p;
            float2 param_10 = b;
            float param_11 = r;
            float d_1 = boxSd(param_9, param_10, param_11);
            float grow = _112.uSpread * (1.0 - ((1.0 - t) * (1.0 - t)));
            float ring_1 = exp((-abs(d_1 - grow)) / (1.5 + (3.0 * t))) * fade;
            float fill_1 = (((smoothstep(1.0, -1.0, d_1) * 0.2199999988079071044921875) * fade) * fade) * fade;
            float4 param_12 = acc;
            float3 param_13 = c;
            float param_14 = fill_1 * _112.uStrength;
            acc = over(param_12, param_13, param_14);
            float4 param_15 = acc;
            float3 param_16 = c;
            float param_17 = ring_1 * _112.uStrength;
            acc = over(param_15, param_16, param_17);
        }
        else
        {
            float2 param_18 = p;
            float2 param_19 = b;
            float param_20 = r;
            float d_2 = boxSd(param_18, param_19, param_20);
            float inside = smoothstep(1.0, -1.0, d_2);
            float x = (fragCoord.x - _112.uInset) / fast::max(2.0 * b.x, 1.0);
            float band = (exp(-powr((x - mix(-0.20000000298023223876953125, 1.2000000476837158203125, t)) * 6.0, 2.0)) * inside) * 0.300000011920928955078125;
            float ring_2 = exp((-abs(d_2)) / 2.0) * sin(3.141590118408203125 * t);
            float4 param_21 = acc;
            float3 param_22 = c;
            float param_23 = band * _112.uStrength;
            acc = over(param_21, param_22, param_23);
            float4 param_24 = acc;
            float3 param_25 = c;
            float param_26 = ring_2 * _112.uStrength;
            acc = over(param_24, param_25, param_26);
        }
    }
    float4 param_27 = acc;
    fragColor = unpremultiply(param_27);
}

fragment flair_change_pulse_frag_out flair_change_pulse_frag(constant FlairUniforms& _112 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_change_pulse_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _415;
    if (_112.flair_flipY > 0.5)
    {
        _415 = _112.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _415 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _415);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _112);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

