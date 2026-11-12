// flair-metal-hash: fe2319ae
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"
#pragma clang diagnostic ignored "-Wmissing-braces"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

template<typename T, size_t Num>
struct spvUnsafeArray
{
    T elements[Num ? Num : 1];
    
    thread T& operator [] (size_t pos) thread
    {
        return elements[pos];
    }
    constexpr const thread T& operator [] (size_t pos) const thread
    {
        return elements[pos];
    }
    
    device T& operator [] (size_t pos) device
    {
        return elements[pos];
    }
    constexpr const device T& operator [] (size_t pos) const device
    {
        return elements[pos];
    }
    
    constexpr const constant T& operator [] (size_t pos) const constant
    {
        return elements[pos];
    }
    
    threadgroup T& operator [] (size_t pos) threadgroup
    {
        return elements[pos];
    }
    constexpr const threadgroup T& operator [] (size_t pos) const threadgroup
    {
        return elements[pos];
    }
};

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
    float3 uBackground;
    float3 uColorA;
    packed_float3 uColorB;
    float uDensity;
    float uSpeed;
    float uReach;
    float uWidth;
    float uPoints;
    float uGlow;
    float uBackgroundAlpha;
};

struct flair_plexus_web_frag_out
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
float2 node(thread const float2& id, thread const float& t)
{
    float2 param = id;
    float2 h = hash22(param);
    return (id + float2(0.5)) + (float2(sin((t * (0.60000002384185791015625 + h.x)) + (6.28318023681640625 * h.y)), cos((t * (0.5 + h.y)) + (6.28318023681640625 * h.x))) * 0.37999999523162841796875);
}

static inline __attribute__((always_inline))
float link(thread const float2& g, thread const float2& a, thread const float2& b, thread const float& cell, constant FlairUniforms& _182)
{
    float2 e = b - a;
    float l = fast::clamp(dot(g - a, e) / dot(e, e), 0.0, 1.0);
    float d = length((g - a) - (e * l)) * cell;
    float on = 1.0 - smoothstep(0.60000002384185791015625 * _182.uReach, _182.uReach, length(e));
    return on * (fast::clamp(((0.5 * _182.uWidth) + 0.5) - d, 0.0, 1.0) + ((_182.uGlow * 0.25) * exp((-d) / (3.0 * _182.uWidth))));
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _182)
{
    float cell = _182.iResolution[1u] / _182.uDensity;
    float2 g = fragCoord / float2(cell);
    float2 id = floor(g);
    float t = _182.iTime * _182.uSpeed;
    spvUnsafeArray<float2, 9> pts;
    for (int y = -1; y <= 1; y++)
    {
        for (int x = -1; x <= 1; x++)
        {
            float2 param = id + float2(float(x), float(y));
            float param_1 = t;
            pts[(((y + 1) * 3) + x) + 1] = node(param, param_1);
        }
    }
    float light = 0.0;
    for (int i = 0; i < 9; i++)
    {
        if (i != 4)
        {
            float2 param_2 = g;
            float2 param_3 = pts[4];
            float2 param_4 = pts[i];
            float param_5 = cell;
            light += link(param_2, param_3, param_4, param_5, _182);
        }
    }
    float2 param_6 = g;
    float2 param_7 = pts[1];
    float2 param_8 = pts[3];
    float param_9 = cell;
    float2 param_10 = g;
    float2 param_11 = pts[1];
    float2 param_12 = pts[5];
    float param_13 = cell;
    float2 param_14 = g;
    float2 param_15 = pts[7];
    float2 param_16 = pts[3];
    float param_17 = cell;
    float2 param_18 = g;
    float2 param_19 = pts[7];
    float2 param_20 = pts[5];
    float param_21 = cell;
    light += (((link(param_6, param_7, param_8, param_9, _182) + link(param_10, param_11, param_12, param_13, _182)) + link(param_14, param_15, param_16, param_17, _182)) + link(param_18, param_19, param_20, param_21, _182));
    float dots = 0.0;
    for (int i_1 = 0; i_1 < 9; i_1++)
    {
        float d = length(g - pts[i_1]) * cell;
        float2 param_22 = id + float2(float(i_1));
        float twinkle = 0.699999988079071044921875 + (0.300000011920928955078125 * sin((_182.iTime * 2.0) + (30.0 * hash12(param_22))));
        dots += (twinkle * (fast::clamp(((2.0 * _182.uPoints) + 0.5) - d, 0.0, 1.0) + ((_182.uGlow * 0.60000002384185791015625) * exp((-d) / ((4.0 * _182.uPoints) + 1.0)))));
    }
    float2 p = fragCoord / float2(_182.iResolution[0], _182.iResolution[1]);
    float3 tint = mix(_182.uColorA, float3(_182.uColorB), float3(smoothstep(0.0, 1.0, p.x + (0.25 * sin((t * 0.4000000059604644775390625) + (p.y * 3.0))))));
    float3 lit = tint * ((0.550000011920928955078125 * fast::min(light, 1.5)) + fast::min(dots, 2.0));
    float3 col = (_182.uBackground * (1.0 - fast::clamp(fast::max(lit.x, fast::max(lit.y, lit.z)), 0.0, 1.0))) + lit;
    fragColor = float4(col, 1.0);
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _545;
    if (a > 0.0)
    {
        _545 = bg + (d / float3(a));
    }
    else
    {
        _545 = bg;
    }
    float3 fg = _545;
    float alpha = a + (opacity * (1.0 - a));
    float3 _567;
    if (alpha > 0.0)
    {
        _567 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _567 = bg;
    }
    float3 col = _567;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _182)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _182);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _182.uBackground;
    float param_4 = _182.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_plexus_web_frag_out flair_plexus_web_frag(constant FlairUniforms& _182 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_plexus_web_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _624;
    if (_182.flair_flipY > 0.5)
    {
        _624 = _182.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _624 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _624);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _182);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

