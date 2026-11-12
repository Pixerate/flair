// flair-metal-hash: a0400628
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL radians() function
template<typename T>
inline T radians(T d)
{
    return d * T(0.01745329251);
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
    float3 uColorA;
    packed_float3 uColorB;
    float uWidth;
    float uAngle;
    float uSoft;
};

struct flair_stripes_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _29)
{
    float a = radians(_29.uAngle);
    float d = dot(fragCoord, float2(cos(a), sin(a))) / (_29.uWidth * 2.0);
    float s = fract(d - _29.iTime);
    float edge = fast::max(_29.uSoft * 0.5, 0.5 / _29.uWidth);
    float m = (smoothstep(0.5 - edge, 0.5 + edge, s) - smoothstep(1.0 - edge, 1.0, s)) + (1.0 - smoothstep(0.0, edge, s));
    fragColor = float4(mix(_29.uColorA, float3(_29.uColorB), float3(fast::clamp(m, 0.0, 1.0))), 1.0);
}

fragment flair_stripes_frag_out flair_stripes_frag(constant FlairUniforms& _29 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_stripes_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _114;
    if (_29.flair_flipY > 0.5)
    {
        _114 = _29.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _114 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _114);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _29);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

