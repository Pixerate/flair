// flair-metal-hash: f9535ef3
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

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
    float uScale;
    float uFlow;
    float uReact;
    char _m16_pad[4];
    packed_float3 uPhase;
    float uContrast;
    uint uDemo;
};

struct flair_audio_plasma_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool soundDemo(constant FlairUniforms& _158)
{
    bool _163 = _158.uDemo != 0u;
    bool _171;
    if (_163)
    {
        _171 = _158.iBeat == 0.0;
    }
    else
    {
        _171 = _163;
    }
    bool _182;
    if (_171)
    {
        _182 = dot(_158.iAudio, _158.iAudio) == 0.0;
    }
    else
    {
        _182 = _171;
    }
    return _182;
}

static inline __attribute__((always_inline))
float demoKick(constant FlairUniforms& _158)
{
    return exp((-mod(_158.iTime, 0.5)) * 7.0);
}

static inline __attribute__((always_inline))
float demoHat(constant FlairUniforms& _158)
{
    return exp((-mod(_158.iTime + 0.25, 0.5)) * 16.0);
}

static inline __attribute__((always_inline))
float4 sound(constant FlairUniforms& _158)
{
    if (!soundDemo(_158))
    {
        return _158.iAudio;
    }
    float k = demoKick(_158);
    float mid = (0.4000000059604644775390625 + (0.119999997317790985107421875 * sin(_158.iTime * 1.7000000476837158203125))) + (0.100000001490116119384765625 * sin(_158.iTime * 3.099999904632568359375));
    return float4((0.449999988079071044921875 + (0.300000011920928955078125 * k)) + (0.100000001490116119384765625 * mid), 0.300000011920928955078125 + (0.64999997615814208984375 * k), mid, (0.25 + (0.4000000059604644775390625 * demoHat(_158))) + (0.07999999821186065673828125 * sin(_158.iTime * 5.30000019073486328125)));
}

static inline __attribute__((always_inline))
float beat(constant FlairUniforms& _158)
{
    float _262;
    if (soundDemo(_158))
    {
        _262 = mod(_158.iTime, 0.5);
    }
    else
    {
        _262 = _158.iBeat;
    }
    return _262;
}

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
float3 palette(thread const float& t, thread const float3& a, thread const float3& b, thread const float3& c, thread const float3& d)
{
    return a + (b * cos(((c * t) + d) * 6.28318023681640625));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _158)
{
    float2 p = (fragCoord - (float2(_158.iResolution[0], _158.iResolution[1]) * 0.5)) / float2(_158.iResolution[1u]);
    float4 s = sound(_158) * _158.uReact;
    float b = beat(_158);
    float _298;
    if (b >= 0.0)
    {
        _298 = exp((-b) * 5.0) * _158.uReact;
    }
    else
    {
        _298 = 0.0;
    }
    float hit = _298;
    float t = _158.iTime * _158.uFlow;
    float push = (0.800000011920928955078125 * s.y) + (0.5 * hit);
    float2 q = (p * _158.uScale) * (1.0 - (0.100000001490116119384765625 * s.y));
    float2 param = (q * 0.699999988079071044921875) + float2(t * 0.300000011920928955078125);
    float2 param_1 = ((q * 0.699999988079071044921875) - float2(t * 0.2700000107288360595703125)) + float2(5.0);
    float2 w = float2(vnoise(param), vnoise(param_1)) - float2(0.5);
    q += (w * (1.2000000476837158203125 + (1.5 * s.z)));
    float v = sin((q.x + t) + push);
    v += sin(((q.y * 1.2999999523162841796875) - (t * 0.800000011920928955078125)) + (push * 0.699999988079071044921875));
    v += sin(((q.x + q.y) * 0.800000011920928955078125) + (t * 0.60000002384185791015625));
    v += sin(((length(q + float2(sin(t * 0.4000000059604644775390625), cos(t * 0.300000011920928955078125))) * 2.0) - (t * 1.2000000476837158203125)) - (push * 1.5));
    v = (v * 0.25) * _158.uContrast;
    float param_2 = ((v * 0.699999988079071044921875) + (0.1500000059604644775390625 * s.z)) + (0.0500000007450580596923828125 * t);
    float3 param_3 = float3(0.449999988079071044921875, 0.4000000059604644775390625, 0.5);
    float3 param_4 = float3(0.4000000059604644775390625, 0.3499999940395355224609375, 0.4000000059604644775390625);
    float3 param_5 = float3(0.800000011920928955078125, 0.699999988079071044921875, 0.60000002384185791015625);
    float3 param_6 = float3(_158.uPhase) + float3(0.0, 0.100000001490116119384765625 * s.w, 0.20000000298023223876953125 * s.y);
    float3 col = palette(param_2, param_3, param_4, param_5, param_6);
    col *= ((0.75 + (0.3499999940395355224609375 * s.x)) + (0.4000000059604644775390625 * hit));
    float2 param_7 = fragCoord + float2(floor(_158.iTime * 30.0));
    col += float3(((hash12(param_7) - 0.5) * 0.0599999986588954925537109375) * s.w);
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), 1.0);
}

fragment flair_audio_plasma_frag_out flair_audio_plasma_frag(constant FlairUniforms& _158 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_audio_plasma_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _515;
    if (_158.flair_flipY > 0.5)
    {
        _515 = _158.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _515 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _515);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _158);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

