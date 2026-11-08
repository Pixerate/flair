// flair-metal-hash: 1ee8dedf
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
    float3 uColor;
    float2 uOrigin;
    float uSize;
    float uSpokes;
    float uRings;
    float uWidth;
    float uLife;
    uint uShadow;
    uint uDemo;
};

struct flair_web_shot_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 clickAt(thread const int& i, thread const bool& demo, constant FlairUniforms& _137)
{
    bool _125 = !demo;
    bool _146;
    if (!_125)
    {
        _146 = _137.iClicks[0].w > 0.5;
    }
    else
    {
        _146 = _125;
    }
    if (_146)
    {
        return _137.iClicks[i];
    }
    float k = floor(_137.iTime / 2.0) - float(i);
    float2 param = float2((k * 1.37000000476837158203125) + 0.5, 3.7000000476837158203125);
    float2 h = hash22(param);
    return float4((float2(0.1500000059604644775390625) + (h * 0.699999988079071044921875)) * float2(_137.iResolution[0], _137.iResolution[1]), k * 2.0, 1.0);
}

static inline __attribute__((always_inline))
float strand(thread const float& d, constant FlairUniforms& _137)
{
    return fast::clamp(((0.5 * _137.uWidth) + 0.5) - d, 0.0, 1.0);
}

static inline __attribute__((always_inline))
float shotLine(thread const float2& p, thread const float2& a, thread const float2& b, thread const float& f, thread const float& px, constant FlairUniforms& _137)
{
    float2 e = (b - a) * f;
    float l = fast::clamp(dot(p - a, e) / fast::max(dot(e, e), 9.9999999392252902907785028219223e-09), 0.0, 1.0);
    float param = length((p - a) - (e * l)) / px;
    return strand(param, _137);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float splat(thread const float2& d, thread const float& o, thread const float& s, thread const float& px, constant FlairUniforms& _137)
{
    float R = _137.uSize * o;
    float r = length(d);
    if (r > ((1.25 * R) + (4.0 * px)))
    {
        return 0.0;
    }
    float2 param = float2(s, 1.7000000476837158203125);
    float a = precise::atan2(d.y, d.x) + (6.28318023681640625 * hash12(param));
    float n = floor(_137.uSpokes);
    float sector = 6.28318023681640625 / n;
    float h = 0.5 * sector;
    float k = floor((a / sector) + 0.5);
    float2 param_1 = float2(mod(k, n), s);
    float len = R * (0.699999988079071044921875 + (0.550000011920928955078125 * hash12(param_1)));
    float param_2 = (r * abs(sin(a - (k * sector)))) / px;
    float silk = strand(param_2, _137) * (1.0 - smoothstep(len - (2.0 * px), len, r));
    float j = floor(a / sector);
    float dm = a - ((j + 0.5) * sector);
    float rr = (r * cos(dm)) / cos(h);
    float bow = 1.0 - ((dm / h) * (dm / h));
    float2 param_3 = float2(mod(j, n), s);
    float2 param_4 = float2(mod(j + 1.0, n), s);
    float reach = R * (0.699999988079071044921875 + (0.550000011920928955078125 * fast::min(hash12(param_3), hash12(param_4))));
    float spacing = (0.89999997615814208984375 * R) / fast::max(_137.uRings, 1.0);
    float u = (rr + ((0.25 * spacing) * bow)) / spacing;
    float x = u - floor(u + 0.5);
    float param_5 = ((abs(x) * spacing) * cos(h)) / px;
    silk = fast::max(silk, (strand(param_5, _137) * step(0.5, u)) * (1.0 - smoothstep(reach - (2.0 * px), reach, rr)));
    silk = fast::max(silk, 1.0 - smoothstep((0.0599999986588954925537109375 * R) - px, 0.0599999986588954925537109375 * R, r));
    return fast::clamp(silk, 0.0, 1.0);
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _137)
{
    float px = 1.0 / _137.iResolution[1u];
    float2 p = fragCoord * px;
    float2 origin = (_137.uOrigin * float2(_137.iResolution[0], _137.iResolution[1])) * px;
    float2 shadow = float2(1.5, -2.5) * px;
    float4 acc = float4(0.0);
    for (int i = 7; i >= 0; i--)
    {
        int param = i;
        bool param_1 = _137.uDemo != 0u;
        float4 c = clickAt(param, param_1, _137);
        if (c.w < 0.5)
        {
            continue;
        }
        float age = _137.iTime - c.z;
        bool _537 = age < 0.0;
        bool _548;
        if (!_537)
        {
            _548 = age > (_137.uLife + 0.300000011920928955078125);
        }
        else
        {
            _548 = _537;
        }
        if (_548)
        {
            continue;
        }
        float2 at = c.xy * px;
        float seed = (c.z * 3.7000000476837158203125) + (c.x * 0.0130000002682209014892578125);
        float fly = fast::clamp(age / 0.1500000059604644775390625, 0.0, 1.0);
        float lineFade = 1.0 - smoothstep(0.20000000298023223876953125, 0.550000011920928955078125, age);
        float o = fast::clamp((age - 0.12999999523162841796875) / 0.25, 0.0, 1.0);
        o = (1.0 + ((0.1500000059604644775390625 * sin(o * 5.0)) * (1.0 - o))) - (((1.0 - o) * (1.0 - o)) * (1.0 - o));
        o *= step(0.12999999523162841796875, age);
        float fade = 1.0 - smoothstep(0.75 * _137.uLife, _137.uLife + 0.300000011920928955078125, age);
        fly = (fly * fly) * (3.0 - (2.0 * fly));
        float2 param_2 = p;
        float2 param_3 = origin;
        float2 param_4 = at;
        float param_5 = fly;
        float param_6 = px;
        float line = shotLine(param_2, param_3, param_4, param_5, param_6, _137) * lineFade;
        float2 param_7 = p - at;
        float param_8 = o;
        float param_9 = seed;
        float param_10 = px;
        float web = splat(param_7, param_8, param_9, param_10, _137);
        if (_137.uShadow != 0u)
        {
            float2 param_11 = p - shadow;
            float2 param_12 = origin;
            float2 param_13 = at;
            float param_14 = fly;
            float param_15 = px;
            float2 param_16 = (p - shadow) - at;
            float param_17 = o;
            float param_18 = seed;
            float param_19 = px;
            float sh = fast::max(shotLine(param_11, param_12, param_13, param_14, param_15, _137) * lineFade, splat(param_16, param_17, param_18, param_19, _137));
            float4 param_20 = acc;
            float3 param_21 = float3(0.0);
            float param_22 = (0.3499999940395355224609375 * sh) * fade;
            acc = over(param_20, param_21, param_22);
        }
        float4 param_23 = acc;
        float3 param_24 = _137.uColor;
        float param_25 = fast::max(line, web) * fade;
        acc = over(param_23, param_24, param_25);
    }
    float4 param_26 = acc;
    fragColor = unpremultiply(param_26);
}

fragment flair_web_shot_frag_out flair_web_shot_frag(constant FlairUniforms& _137 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_web_shot_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _725;
    if (_137.flair_flipY > 0.5)
    {
        _725 = _137.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _725 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _725);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _137);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

