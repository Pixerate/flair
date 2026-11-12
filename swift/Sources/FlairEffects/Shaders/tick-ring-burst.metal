// flair-metal-hash: f8e781cd
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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

// Implementation of the GLSL radians() function
template<typename T>
inline T radians(T d)
{
    return d * T(0.01745329251);
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
    float3 uColor;
    packed_float3 uColorB;
    float uCount;
    float uArc;
    float uAngle;
    float uRadius;
    float uLength;
    float uWidth;
    uint uAnimate;
    float uCycle;
    char _m23_pad[4];
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_tick_ring_burst_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float backOut(thread float& x)
{
    float c = 1.89999997615814208984375;
    x -= 1.0;
    return (1.0 + ((((c + 1.0) * x) * x) * x)) + ((c * x) * x);
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _105)
{
    float px = 1.0 / _105.iResolution[1u];
    float2 p = (fragCoord - (float2(_105.iResolution[0], _105.iResolution[1]) * 0.5)) * px;
    float count = floor(_105.uCount);
    float spacing = 6.28318023681640625 / count;
    float centre = radians(_105.uAngle);
    float a = mod((precise::atan2(p.y, p.x) - centre) + 3.141590118408203125, 6.28318023681640625) - 3.141590118408203125;
    float k = floor((a / spacing) + 0.5);
    float side = (0.5 * _105.uArc) * count;
    float order = abs(k) / fast::max(side, 1.0);
    float _176;
    if (_105.uAnimate != 0u)
    {
        _176 = fract(_105.iTime / _105.uCycle);
    }
    else
    {
        _176 = 0.5;
    }
    float t = _176;
    float _193;
    if (_105.uAnimate != 0u)
    {
        float param = fast::clamp((t - (0.300000011920928955078125 * order)) / 0.1500000059604644775390625, 0.0, 1.0);
        float _206 = backOut(param);
        _193 = _206;
    }
    else
    {
        _193 = 1.0;
    }
    float grow = _193;
    float _213;
    if (_105.uAnimate != 0u)
    {
        _213 = smoothstep(0.7200000286102294921875 + (0.100000001490116119384765625 * order), 0.89999997615814208984375 + (0.07999999821186065673828125 * order), t);
    }
    else
    {
        _213 = 0.0;
    }
    float gone = _213;
    float len = ((_105.uLength * ((mod(abs(k), 2.0) < 0.5) ? 1.0 : 0.60000002384185791015625)) * grow) * (1.0 - gone);
    float r0 = _105.uRadius + ((gone * 1.5) * _105.uLength);
    float hw = ((0.0005000000237487256526947021484375 * _105.uWidth) * (1.0 - (0.3499999940395355224609375 * order))) * fast::clamp(grow * 3.0, 0.0, 1.0);
    float ang = centre + (k * spacing);
    float2 dir = float2(cos(ang), sin(ang));
    float along = dot(p, dir);
    float across = dot(p, float2(-dir.y, dir.x));
    float d = length(float2(along - fast::clamp(along, r0, r0 + fast::max(len, 0.0)), across)) - hw;
    float cover = ((fast::clamp(0.5 - (d / px), 0.0, 1.0) * step(abs(k), side)) * step(0.001000000047497451305389404296875, grow)) * (1.0 - gone);
    float3 col = mix(_105.uColor, float3(_105.uColorB), float3(order * order));
    float4 acc = float4(float3(_105.uBackground) * _105.uBackgroundAlpha, _105.uBackgroundAlpha);
    float4 param_1 = acc;
    float3 param_2 = col;
    float param_3 = cover;
    acc = over(param_1, param_2, param_3);
    float4 param_4 = acc;
    fragColor = unpremultiply(param_4);
}

fragment flair_tick_ring_burst_frag_out flair_tick_ring_burst_frag(constant FlairUniforms& _105 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_tick_ring_burst_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _380;
    if (_105.flair_flipY > 0.5)
    {
        _380 = _105.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _380 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _380);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _105);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

