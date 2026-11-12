// flair-metal-hash: ca605830
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
    float3 uColorA;
    packed_float3 uColorB;
    float uHeight;
    float uGlow;
    uint uBottom;
    char _m18_pad[8];
    packed_float3 uTrack;
    float uTrackAlpha;
    uint uDemo;
};

struct flair_scroll_progress_glow_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool scrollDemo(constant FlairUniforms& _34)
{
    bool _40 = _34.uDemo != 0u;
    bool _52;
    if (_40)
    {
        _52 = dot(_34.iScroll, _34.iScroll) == 0.0;
    }
    else
    {
        _52 = _40;
    }
    return _52;
}

static inline __attribute__((always_inline))
float4 scroll(constant FlairUniforms& _34)
{
    if (!scrollDemo(_34))
    {
        return _34.iScroll;
    }
    float ph = fract(_34.iTime / 6.0);
    float _75;
    if (ph < 0.5)
    {
        _75 = (ph * 2.400000095367431640625) - 0.100000001490116119384765625;
    }
    else
    {
        _75 = ((1.0 - ph) * 2.400000095367431640625) - 0.100000001490116119384765625;
    }
    float u = fast::clamp(_75, 0.0, 1.0);
    float x = (u * u) * (3.0 - (2.0 * u));
    float moving = float((u > 0.0) && (u < 1.0));
    float v = (((((moving * 6.0) * u) * (1.0 - u)) * 0.4000000059604644775390625) * 2.0) * ((ph < 0.5) ? 1.0 : (-1.0));
    return float4(x, x, v, moving);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _34)
{
    float4 s = scroll(_34);
    float progress = fast::clamp(s.y, 0.0, 1.0);
    float x = fragCoord.x;
    float _145;
    if (_34.uBottom != 0u)
    {
        _145 = fragCoord.y;
    }
    else
    {
        _145 = _34.iResolution[1u] - fragCoord.y;
    }
    float y = _145;
    float end = progress * _34.iResolution[0u];
    float inBar = fast::clamp((_34.uHeight - y) + 0.5, 0.0, 1.0);
    float filled = fast::clamp((end - x) + 0.5, 0.0, 1.0);
    float3 tint = mix(_34.uColorA, float3(_34.uColorB), float3(x / _34.iResolution[0u]));
    float lit = 0.3499999940395355224609375 + (0.64999997615814208984375 * s.w);
    float under = (((filled * exp((-fast::max(y - _34.uHeight, 0.0)) / (6.0 + (10.0 * s.w)))) * 0.5) * _34.uGlow) * lit;
    float head = ((exp((-length(float2(x - end, fast::max(y - (_34.uHeight * 0.5), 0.0)))) / (8.0 + (20.0 * s.w))) * _34.uGlow) * (0.4000000059604644775390625 + (0.89999997615814208984375 * s.w))) * step(0.001000000047497451305389404296875, progress);
    float3 light = tint * (under + (head * 1.39999997615814208984375));
    float4 bar = float4(mix(float3(_34.uTrack), tint * (1.0 + (0.300000011920928955078125 * s.w)), float3(filled)), inBar * mix(_34.uTrackAlpha, 1.0, filled));
    float3 g = float3(1.0) - exp(-light);
    float ga = fast::max(g.x, fast::max(g.y, g.z));
    float alpha = bar.w + (ga * (1.0 - bar.w));
    float3 col = ((bar.xyz * bar.w) + (g * (1.0 - bar.w))) / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05));
    fragColor = float4(col, alpha);
}

fragment flair_scroll_progress_glow_frag_out flair_scroll_progress_glow_frag(constant FlairUniforms& _34 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_scroll_progress_glow_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _350;
    if (_34.flair_flipY > 0.5)
    {
        _350 = _34.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _350 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _350);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _34);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

