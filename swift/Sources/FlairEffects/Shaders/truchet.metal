// flair-metal-hash: a8f5faae
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
    packed_float3 uLine;
    float uTiles;
    float uWidth;
    float uSpeed;
    float uBackgroundAlpha;
};

struct flair_truchet_frag_out
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
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _75)
{
    float2 p = (fragCoord / float2(_75.iResolution[1u])) * _75.uTiles;
    float2 id = floor(p);
    float2 f = fract(p) - float2(0.5);
    float2 param = id;
    float flip = (hash12(param) > 0.5) ? 1.0 : (-1.0);
    f.x *= flip;
    float2 c = select(float2(-0.5), float2(0.5), bool2(f.x > (-f.y)));
    float2 q = f - c;
    float d = abs(length(q) - 0.5);
    float angle = precise::atan2(q.y, q.x);
    float checker = (mod(id.x + id.y, 2.0) * 2.0) - 1.0;
    float flow = 0.5 + (0.5 * sin((((angle * 4.0) * checker) * flip) + ((_75.iTime * _75.uSpeed) * 4.0)));
    float line = 1.0 - smoothstep(_75.uWidth - 0.0199999995529651641845703125, _75.uWidth, d);
    float3 col = mix(_75.uBackground, float3(_75.uLine) * (0.449999988079071044921875 + (0.75 * flow)), float3(line));
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
    float3 _245;
    if (a > 0.0)
    {
        _245 = bg + (d / float3(a));
    }
    else
    {
        _245 = bg;
    }
    float3 fg = _245;
    float alpha = a + (opacity * (1.0 - a));
    float3 _267;
    if (alpha > 0.0)
    {
        _267 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _267 = bg;
    }
    float3 col = _267;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _75)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _75);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _75.uBackground;
    float param_4 = _75.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_truchet_frag_out flair_truchet_frag(constant FlairUniforms& _75 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_truchet_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _325;
    if (_75.flair_flipY > 0.5)
    {
        _325 = _75.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _325 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _325);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _75);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

