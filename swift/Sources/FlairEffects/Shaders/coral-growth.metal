// flair-metal-hash: 9f58735e
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
    float3 uWater;
    float3 uBody;
    float3 uTip;
    packed_float3 uFront;
    int uArms;
    float uThickness;
    float uSpread;
    float uCycle;
    float uRings;
};

struct flair_coral_growth_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
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
float2 arm(thread float2& q, thread const float& k, thread const float& g, constant FlairUniforms& _232)
{
    float L = 0.20000000298023223876953125;
    float sc = 1.0;
    float id = 1.0 + (k * 61.0);
    float d = 100000.0;
    float along = 0.0;
    float arc = 0.0;
    for (int i = 0; i < 7; i++)
    {
        float fi = float(i);
        float2 param = float2(q.y * 6.0, id * 3.7000000476837158203125);
        q.x += (((vnoise(param) - 0.5) * 0.119999997317790985107421875) * sin(3.141590118408203125 * fast::clamp(q.y / L, 0.0, 1.0)));
        float shown = fast::clamp((g - arc) / sc, 0.0, L);
        if (shown <= 0.0)
        {
            break;
        }
        float y = fast::clamp(q.y, 0.0, shown);
        float age = fast::clamp(((g - arc) - (y * sc)) / 0.119999997317790985107421875, 0.0, 1.0);
        float w = (_232.uThickness * sqrt(sc)) * mix(0.60000002384185791015625, 1.0, age);
        float dd = (length(q - float2(0.0, y)) * sc) - w;
        if (dd < d)
        {
            d = dd;
            along = arc + (y * sc);
        }
        arc += (L * sc);
        q.y -= L;
        id = (id * 2.0) + step(0.0, q.x);
        q.x = abs(q.x);
        float2 param_1 = float2(id, fi);
        float param_2 = radians(_232.uSpread) * (0.60000002384185791015625 + (0.800000011920928955078125 * hash12(param_1)));
        q = rot(param_2) * q;
        float2 param_3 = float2(fi, id * 1.2999999523162841796875);
        float s = 0.7799999713897705078125 + (0.100000001490116119384765625 * hash12(param_3));
        q /= float2(s);
        sc *= s;
    }
    return float2(d, along);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _232)
{
    float2 c = (fragCoord - (float2(_232.iResolution[0], _232.iResolution[1]) * 0.5)) / float2(_232.iResolution[1u]);
    float px = 1.0 / _232.iResolution[1u];
    float r = length(c);
    float cyc = fract(_232.iTime / fast::max(_232.uCycle, 0.100000001490116119384765625));
    float g = 0.949999988079071044921875 * (1.0 - powr(1.0 - smoothstep(0.0, 0.85000002384185791015625, cyc), 1.5));
    float grow = 1.0 - smoothstep(0.87999999523162841796875, 1.0, cyc);
    float n = float(_232.uArms);
    float sector = 6.28318023681640625 / n;
    float idx = floor((precise::atan2(c.y, c.x) / sector) + 0.5);
    float d = r - fast::min(g, 0.0500000007450580596923828125);
    float along = 0.0;
    for (int k = -1; k <= 1; k++)
    {
        float s = idx + float(k);
        float param = 1.57079994678497314453125 - (s * sector);
        float2 q = rot(param) * c;
        float2 param_1 = q;
        float param_2 = mod(s, n);
        float param_3 = g;
        float2 _432 = arm(param_1, param_2, param_3, _232);
        float2 a = _432;
        if (a.x < d)
        {
            d = a.x;
            along = a.y;
        }
    }
    float2 param_4 = (c * 5.0) + float2(_232.iTime * 0.0500000007450580596923828125);
    float3 col = (_232.uWater * (0.75 + (0.3499999940395355224609375 * vnoise(param_4)))) * (1.14999997615814208984375 - (0.5 * r));
    float coral = (1.0 - smoothstep(-px, px, d)) * grow;
    float inner = fast::clamp((-d) / _232.uThickness, 0.0, 1.0);
    float2 grad = float2(dfdx(d), dfdy(d));
    float lit = dot(grad / float2(fast::max(length(grad), 9.9999999747524270787835121154785e-07)), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    float3 body = mix(_232.uTip, _232.uBody, float3(smoothstep(0.0, 0.89999997615814208984375, inner)));
    body *= (0.89999997615814208984375 + ((0.300000011920928955078125 * lit) * (1.0 - inner)));
    float2 param_5 = c * 140.0;
    body *= (0.87999999523162841796875 + (0.23999999463558197021484375 * vnoise(param_5)));
    body *= (1.0 - ((_232.uRings * 0.300000011920928955078125) * smoothstep(0.699999988079071044921875, 1.0, 0.5 + (0.5 * cos(along * 45.0)))));
    float tip = exp((-fast::max(g - along, 0.0)) / 0.0350000001490116119384765625);
    body = mix(body, float3(_232.uFront), float3(tip * 0.75));
    float halo = (exp((-fast::max(d, 0.0)) / 0.0199999995529651641845703125) * (1.0 - coral)) * grow;
    col = mix(col, col * 0.699999988079071044921875, float3(halo * 0.60000002384185791015625));
    col += (((_232.uBody * halo) * 0.100000001490116119384765625) + (((((float3(_232.uFront) * exp((-fast::max(d, 0.0)) / 0.006000000052154064178466796875)) * (1.0 - coral)) * grow) * tip) * 0.4000000059604644775390625));
    col = mix(col, body, float3(coral));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), 1.0);
}

fragment flair_coral_growth_frag_out flair_coral_growth_frag(constant FlairUniforms& _232 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_coral_growth_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _636;
    if (_232.flair_flipY > 0.5)
    {
        _636 = _232.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _636 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _636);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _232);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

