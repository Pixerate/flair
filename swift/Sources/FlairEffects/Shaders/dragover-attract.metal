// flair-metal-hash: f8ad8915
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
    float3 uColor;
    packed_float3 uFill;
    float uRadius;
    float uInset;
    float uPull;
    float uDash;
    float uHover;
    float2 uTarget;
    float uLanded;
    uint uDemo;
};

struct flair_dragover_attract_frag_out
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _113)
{
    float2 hs = float2(_113.iResolution[0], _113.iResolution[1]) * 0.5;
    float2 b = fast::max(hs - float2(_113.uInset), float2(4.0));
    float r = fast::min(_113.uRadius, fast::min(b.x, b.y));
    float demoPhase = fract(_113.iTime / 4.0);
    float2 demo = hs + ((b * 0.60000002384185791015625) * float2(sin(_113.iTime * 0.89999997615814208984375), 0.60000002384185791015625 * sin(_113.iTime * 1.2999999523162841796875)));
    bool _172 = _113.uDemo != 0u;
    bool _180;
    if (_172)
    {
        _180 = _113.iPointer.z <= 0.0;
    }
    else
    {
        _180 = _172;
    }
    bool _187;
    if (_180)
    {
        _187 = _113.uHover <= 0.0;
    }
    else
    {
        _187 = _180;
    }
    float _188;
    if (_187)
    {
        _188 = smoothstep(0.0, 0.1500000059604644775390625, demoPhase) * smoothstep(0.800000011920928955078125, 0.64999997615814208984375, demoPhase);
    }
    else
    {
        _188 = 0.0;
    }
    float demoOn = _188;
    float over_ = fast::max(fast::max(fast::clamp(_113.iPointer.z, 0.0, 1.0), _113.uHover), demoOn);
    float2 _214;
    if (_113.iPointer.z > 0.0)
    {
        _214 = _113.iPointer.xy;
    }
    else
    {
        float2 _225;
        if (_113.uHover > 0.0)
        {
            _225 = _113.uTarget * float2(_113.iResolution[0], _113.iResolution[1]);
        }
        else
        {
            _225 = demo;
        }
        _214 = _225;
    }
    float2 at = _214;
    float2 p = fragCoord - hs;
    float near = exp(-powr(length(fragCoord - at) / ((0.3499999940395355224609375 * fast::min(b.x, b.y)) + 40.0), 2.0));
    float2 param = p;
    float2 param_1 = b + float2((_113.uPull * over_) * near);
    float param_2 = r;
    float d = boxSd(param, param_1, param_2);
    float s = (precise::atan2(p.y, p.x) * length(b)) / 1.2000000476837158203125;
    float dash = step(0.5, fract((s - ((_113.iTime * 30.0) * over_)) / (2.0 * _113.uDash)));
    float line = smoothstep(2.0, 1.0, abs(d)) * mix(dash, 1.0, over_ * 0.60000002384185791015625);
    float4 acc = float4(0.0);
    float4 param_3 = acc;
    float3 param_4 = float3(_113.uFill);
    float param_5 = smoothstep(1.0, -1.0, d) * (0.1500000059604644775390625 + (0.550000011920928955078125 * over_));
    acc = over(param_3, param_4, param_5);
    float4 param_6 = acc;
    float3 param_7 = _113.uColor;
    float param_8 = line * (0.550000011920928955078125 + (0.449999988079071044921875 * over_));
    acc = over(param_6, param_7, param_8);
    float2 landAt = at;
    float landAge = -1.0;
    if (_113.iClicks[0].w > 0.5)
    {
        landAt = _113.iClicks[0].xy;
        landAge = (_113.iTime - _113.iClicks[0].z) / 0.89999997615814208984375;
    }
    else
    {
        if (_113.uLanded > 0.0)
        {
            landAge = _113.uLanded;
            landAt = _113.uTarget * float2(_113.iResolution[0], _113.iResolution[1]);
        }
        else
        {
            bool _384 = _113.uDemo != 0u;
            bool _390;
            if (_384)
            {
                _390 = _113.iPointer.z <= 0.0;
            }
            else
            {
                _390 = _384;
            }
            if (_390)
            {
                landAge = (demoPhase - 0.64999997615814208984375) / 0.300000011920928955078125;
                landAt = demo;
            }
        }
    }
    if ((landAge > 0.0) && (landAge < 1.0))
    {
        float rr = (landAge * length(b)) * 1.2000000476837158203125;
        float ring = (exp((-abs(length(fragCoord - landAt) - rr)) / 3.0) * (1.0 - landAge)) * smoothstep(1.0, -1.0, d);
        float4 param_9 = acc;
        float3 param_10 = _113.uColor;
        float param_11 = ring * 0.800000011920928955078125;
        acc = over(param_9, param_10, param_11);
    }
    float4 param_12 = acc;
    fragColor = unpremultiply(param_12);
}

fragment flair_dragover_attract_frag_out flair_dragover_attract_frag(constant FlairUniforms& _113 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_dragover_attract_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _453;
    if (_113.flair_flipY > 0.5)
    {
        _453 = _113.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _453 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _453);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _113);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

