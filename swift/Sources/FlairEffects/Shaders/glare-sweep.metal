// flair-metal-hash: 5cee023f
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
    float uStrength;
    float uSpeed;
    float uTilt;
    float uSharpness;
    float3 uColor;
};

struct flair_glare_sweep_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _29)
{
    float2 uv = fragCoord / float2(_29.iResolution[0], _29.iResolution[1]);
    float sweep = exp(-powr((((uv.x + (uv.y * _29.uTilt)) - (fract(_29.iTime * _29.uSpeed) * 2.0)) + 0.4000000059604644775390625) * _29.uSharpness, 2.0));
    fragColor = float4(_29.uColor, fast::clamp(sweep * _29.uStrength, 0.0, 1.0));
}

fragment flair_glare_sweep_frag_out flair_glare_sweep_frag(constant FlairUniforms& _29 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_glare_sweep_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _99;
    if (_29.flair_flipY > 0.5)
    {
        _99 = _29.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _99 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _99);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _29);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

