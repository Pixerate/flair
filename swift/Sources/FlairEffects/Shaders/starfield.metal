// flair-metal-hash: 00a749dd
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
    float3 uBackground;
    packed_float3 uStar;
    float uSpeed;
    float uStreak;
    int uLayers;
    float uBackgroundAlpha;
};

struct flair_starfield_frag_out
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
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _131)
{
    float2 p = (fragCoord - (float2(_131.iResolution[0], _131.iResolution[1]) * 0.5)) / float2(_131.iResolution[1u]);
    float3 col = _131.uBackground;
    float n = float(_131.uLayers);
    for (int i = 0; i < 8; i++)
    {
        if (i >= _131.uLayers)
        {
            break;
        }
        float depth = fract((float(i) / n) + ((_131.iTime * _131.uSpeed) * 0.100000001490116119384765625));
        float scale = mix(20.0, 0.5, depth);
        float fade = depth * smoothstep(1.0, 0.85000002384185791015625, depth);
        float param = float(i) * 1.7000000476837158203125;
        float2 q = ((rot(param) * p) * scale) + float2(float(i) * 13.1000003814697265625);
        float2 id = floor(q);
        float2 f = fract(q) - float2(0.5);
        float2 param_1 = id;
        float2 o = hash22(param_1) - float2(0.5);
        float2 d = f - (o * 0.800000011920928955078125);
        float2 dir = fast::normalize(p + float2(9.9999997473787516355514526367188e-05));
        float along = dot(d, dir);
        float across = length(d - (dir * along));
        float len = 0.0199999995529651641845703125 + ((_131.uStreak * depth) * 0.4000000059604644775390625);
        float star = smoothstep(0.02999999932944774627685546875, 0.0, across) * smoothstep(len, 0.0, abs(along));
        float2 param_2 = id + float2(2.0);
        star *= step(0.60000002384185791015625, hash12(param_2));
        col += (((float3(_131.uStar) * star) * fade) * 1.5);
    }
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
    float3 _342;
    if (a > 0.0)
    {
        _342 = bg + (d / float3(a));
    }
    else
    {
        _342 = bg;
    }
    float3 fg = _342;
    float alpha = a + (opacity * (1.0 - a));
    float3 _364;
    if (alpha > 0.0)
    {
        _364 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _364 = bg;
    }
    float3 col = _364;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _131)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _131);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _131.uBackground;
    float param_4 = _131.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_starfield_frag_out flair_starfield_frag(constant FlairUniforms& _131 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_starfield_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _422;
    if (_131.flair_flipY > 0.5)
    {
        _422 = _131.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _422 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _422);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _131);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

