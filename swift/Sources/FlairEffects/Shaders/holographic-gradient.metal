// flair-metal-hash: 0dc5274f
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
    packed_float3 uTint;
    float uPastel;
    float uBands;
    float uWarp;
    float uSpeed;
    float uSheen;
    float uGlitter;
};

struct flair_holographic_gradient_frag_out
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
float3 palette(thread const float& t, thread const float3& a, thread const float3& b, thread const float3& c, thread const float3& d)
{
    return a + (b * cos(((c * t) + d) * 6.28318023681640625));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _145)
{
    float px = 1.0 / _145.iResolution[1u];
    float2 p = (fragCoord - (float2(_145.iResolution[0], _145.iResolution[1]) * 0.5)) * px;
    float t = _145.iTime * _145.uSpeed;
    float2 param = (p * 2.0) + float2(t * 0.5);
    float2 param_1 = ((p * 2.0) - float2(t * 0.4000000059604644775390625)) + float2(3.0);
    float2 q = p + (float2(vnoise(param), vnoise(param_1)) * (_145.uWarp * 0.300000011920928955078125));
    float v = ((dot(q, float2(0.857492923736572265625, 0.51449573040008544921875)) * _145.uBands) + (0.3499999940395355224609375 * sin((q.y * 4.0) + t))) + (t * 0.5);
    float param_2 = v;
    float3 param_3 = float3(0.5);
    float3 param_4 = float3(0.5);
    float3 param_5 = float3(1.0);
    float3 param_6 = float3(0.0, 0.3300000131130218505859375, 0.670000016689300537109375);
    float3 film = palette(param_2, param_3, param_4, param_5, param_6);
    float3 col = mix(film, float3(_145.uTint), float3(_145.uPastel));
    float2 param_7 = q * 3.0;
    float s = sin(((dot(q, float2(-0.60000002384185791015625, 1.0)) * 9.0) - (t * 2.0)) + (2.0 * vnoise(param_7)));
    col += float3((_145.uSheen * 0.3499999940395355224609375) * powr(fast::max(s, 0.0), 12.0));
    col *= (0.920000016689300537109375 + (0.07999999821186065673828125 * sin(v * 6.283185482025146484375)));
    float2 cell = floor(fragCoord / float2(2.0));
    float2 param_8 = cell;
    float g = hash12(param_8);
    float tw = 0.5 + (0.5 * sin((_145.iTime * 4.0) + (g * 60.0)));
    col += float3(((_145.uGlitter * step(0.992999970912933349609375, g)) * tw) * 0.699999988079071044921875);
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), 1.0);
}

fragment flair_holographic_gradient_frag_out flair_holographic_gradient_frag(constant FlairUniforms& _145 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_holographic_gradient_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _339;
    if (_145.flair_flipY > 0.5)
    {
        _339 = _145.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _339 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _339);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _145);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

