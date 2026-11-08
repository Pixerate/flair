// flair-metal-hash: 70ab0c7d
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
    packed_float3 uDot;
    float uSpacing;
    float uWaves;
    uint uRadial;
    float uBackgroundAlpha;
};

struct flair_dot_wave_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _41)
{
    float2 cell = floor(fragCoord / float2(_41.uSpacing));
    float2 local = fract(fragCoord / float2(_41.uSpacing)) - float2(0.5);
    float2 centre = (cell + float2(0.5)) * _41.uSpacing;
    float2 p = (centre - (float2(_41.iResolution[0], _41.iResolution[1]) * 0.5)) / float2(_41.iResolution[1u]);
    float _88;
    if (_41.uRadial != 0u)
    {
        _88 = length(p);
    }
    else
    {
        _88 = p.x + (p.y * 0.300000011920928955078125);
    }
    float d = _88;
    float phase = ((d * _41.uWaves) * 6.28318023681640625) - ((_41.iTime * 6.28318023681640625) / 4.0);
    float size = 0.100000001490116119384765625 + (0.319999992847442626953125 * (0.5 + (0.5 * sin(phase))));
    float aa = 1.5 / _41.uSpacing;
    float disc = 1.0 - smoothstep(size - aa, size + aa, length(local));
    float3 col = mix(_41.uBackground, float3(_41.uDot) * (0.60000002384185791015625 + ((0.4000000059604644775390625 * size) / 0.4199999868869781494140625)), float3(disc));
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
    float3 _212;
    if (a > 0.0)
    {
        _212 = bg + (d / float3(a));
    }
    else
    {
        _212 = bg;
    }
    float3 fg = _212;
    float alpha = a + (opacity * (1.0 - a));
    float3 _234;
    if (alpha > 0.0)
    {
        _234 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _234 = bg;
    }
    float3 col = _234;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _41)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _41);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _41.uBackground;
    float param_4 = _41.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_dot_wave_frag_out flair_dot_wave_frag(constant FlairUniforms& _41 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_dot_wave_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _292;
    if (_41.flair_flipY > 0.5)
    {
        _292 = _41.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _292 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _292);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _41);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

