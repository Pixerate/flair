// flair-metal-hash: 3bd9441c
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
    float3 uDot;
    packed_float3 uActive;
    float uSpacing;
    float uSize;
    float uSwell;
    float uRadius;
    float uWave;
    uint uDemo;
    float uBackgroundAlpha;
};

struct flair_dot_grid_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 hoverPoint(thread const bool& demo, thread const float& idle, constant FlairUniforms& _47)
{
    float2 drift = float2(_47.iResolution[0], _47.iResolution[1]) * (float2(0.5) + float2(0.300000011920928955078125 * sin(_47.iTime * 0.5299999713897705078125), 0.25 * sin((_47.iTime * 0.769999980926513671875) + 1.2999999523162841796875)));
    float h = fast::clamp(_47.iPointer.z, 0.0, 1.0);
    return float3(mix(drift, _47.iPointer.xy, float2(h)), mix(demo ? idle : 0.0, 1.0, h));
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _47)
{
    float px = 1.0 / _47.iResolution[1u];
    float2 p = fragCoord * px;
    bool param = _47.uDemo != 0u;
    float param_1 = 0.800000011920928955078125;
    float3 hp = hoverPoint(param, param_1, _47);
    float2 cell = floor(p / float2(_47.uSpacing));
    float2 centre = (cell + float2(0.5)) * _47.uSpacing;
    float dc = length(centre - (hp.xy * px));
    float k = exp(((-dc) * dc) / (_47.uRadius * _47.uRadius)) * hp.z;
    float wave = _47.uWave * (0.5 + (0.5 * sin((dot(centre, float2(5.0, 3.0)) * 2.0) - (_47.iTime * 1.60000002384185791015625))));
    float r = fast::min((_47.uSize * _47.uSpacing) * ((1.0 + (_47.uSwell * k)) + (0.5 * wave)), 0.4799999892711639404296875 * _47.uSpacing);
    float d = length(p - centre);
    float shape = fast::clamp(((r - d) / px) + 0.5, 0.0, 1.0);
    float3 dotCol = mix(_47.uDot, float3(_47.uActive), float3(fast::clamp(k + ((0.25 * wave) * (1.0 - k)), 0.0, 1.0)));
    float3 col = _47.uBackground + (((float3(_47.uActive) * 0.119999997317790985107421875) * k) * exp((-fast::max(d - r, 0.0)) / (0.300000011920928955078125 * _47.uSpacing)));
    col = mix(col, dotCol, float3(shape));
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
    float3 _309;
    if (a > 0.0)
    {
        _309 = bg + (d / float3(a));
    }
    else
    {
        _309 = bg;
    }
    float3 fg = _309;
    float alpha = a + (opacity * (1.0 - a));
    float3 _331;
    if (alpha > 0.0)
    {
        _331 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _331 = bg;
    }
    float3 col = _331;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _47)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _47);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _47.uBackground;
    float param_4 = _47.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_dot_grid_frag_out flair_dot_grid_frag(constant FlairUniforms& _47 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_dot_grid_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _389;
    if (_47.flair_flipY > 0.5)
    {
        _389 = _47.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _389 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _389);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _47);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

