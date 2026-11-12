// flair-metal-hash: 81ac35bd
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
    packed_float3 uGlyph;
    float uCell;
    float uSpeed;
    float uBackgroundAlpha;
};

struct flair_digital_rain_frag_out
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
float glyph(thread const float2& cell, thread const float2& f, constant FlairUniforms& _92)
{
    float2 g = floor(f * float2(3.0, 5.0));
    float2 param = cell;
    float2 param_1 = (g + (cell * 13.69999980926513671875)) + float2(floor((_92.iTime * 4.0) * hash12(param)));
    float on = step(0.449999988079071044921875, hash12(param_1));
    float2 inset = abs(fract(f * float2(3.0, 5.0)) - float2(0.5));
    return on * step(fast::max(inset.x, inset.y), 0.37999999523162841796875);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _92)
{
    float2 q = fragCoord / float2(_92.uCell);
    float2 cell = floor(q);
    float2 f = fract(q);
    float col = cell.x;
    float2 param = float2(col, 1.0);
    float speed = ((0.5 + hash12(param)) * _92.uSpeed) * 8.0;
    float2 param_1 = float2(col, 2.0);
    float offset = hash12(param_1) * 100.0;
    float head = fract(((_92.iTime * speed) + offset) / 40.0) * ((_92.iResolution[1u] / _92.uCell) + 30.0);
    float y = (_92.iResolution[1u] / _92.uCell) - cell.y;
    float trail = head - y;
    float _202;
    if (trail >= 0.0)
    {
        _202 = exp((-trail) * 0.1500000059604644775390625);
    }
    else
    {
        _202 = 0.0;
    }
    float lit = _202;
    float isHead = step(abs(trail), 0.5);
    float2 param_2 = cell;
    float2 param_3 = f;
    float g = glyph(param_2, param_3, _92);
    float3 c = (_92.uBackground + ((float3(_92.uGlyph) * g) * lit)) + ((float3(0.800000011920928955078125) * g) * isHead);
    fragColor = float4(c, 1.0);
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
    float3 _291;
    if (a > 0.0)
    {
        _291 = bg + (d / float3(a));
    }
    else
    {
        _291 = bg;
    }
    float3 fg = _291;
    float alpha = a + (opacity * (1.0 - a));
    float3 _313;
    if (alpha > 0.0)
    {
        _313 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _313 = bg;
    }
    float3 col = _313;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _92)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _92);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _92.uBackground;
    float param_4 = _92.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_digital_rain_frag_out flair_digital_rain_frag(constant FlairUniforms& _92 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_digital_rain_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _371;
    if (_92.flair_flipY > 0.5)
    {
        _371 = _92.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _371 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _371);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _92);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

