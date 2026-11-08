// flair-metal-hash: d3345231
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
    packed_float3 uNeon;
    float uRings;
    float uWidth;
    float uGlow;
    float uBackgroundAlpha;
};

struct flair_neon_ripple_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _40)
{
    float2 _49;
    if (_40.iMouse.z > 0.0)
    {
        _49 = _40.iMouse.xy;
    }
    else
    {
        _49 = float2(_40.iResolution[0], _40.iResolution[1]) * 0.5;
    }
    float2 centre = _49;
    float r = length(fragCoord - centre) / _40.iResolution[1u];
    float phase = fract((r * _40.uRings) - (_40.iTime * 0.5));
    float ringDist = fast::min(phase, 1.0 - phase) / _40.uRings;
    float fade = smoothstep(1.2000000476837158203125, 0.0, r);
    float core = smoothstep(_40.uWidth, 0.0, ringDist);
    float glow = (((_40.uWidth * 2.0) / (ringDist + _40.uWidth)) * 0.25) * _40.uGlow;
    float3 col = _40.uBackground + ((float3(_40.uNeon) * (core + glow)) * fade);
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
    float3 _185;
    if (a > 0.0)
    {
        _185 = bg + (d / float3(a));
    }
    else
    {
        _185 = bg;
    }
    float3 fg = _185;
    float alpha = a + (opacity * (1.0 - a));
    float3 _207;
    if (alpha > 0.0)
    {
        _207 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _207 = bg;
    }
    float3 col = _207;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _40)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _40);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _40.uBackground;
    float param_4 = _40.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_neon_ripple_frag_out flair_neon_ripple_frag(constant FlairUniforms& _40 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_neon_ripple_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _265;
    if (_40.flair_flipY > 0.5)
    {
        _265 = _40.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _265 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _265);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _40);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

