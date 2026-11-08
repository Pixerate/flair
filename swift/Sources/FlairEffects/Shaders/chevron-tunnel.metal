// flair-metal-hash: 9d05a5c0
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
    int uCount;
    float uFrequency;
    float uSpeed;
    uint uInward;
    float2 uCentre;
    float uAngle;
    float uTwist;
    float uDepth;
    float uSoft;
    float uVignette;
};

struct flair_chevron_tunnel_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _29)
{
    float2 p = (fragCoord - (_29.uCentre * float2(_29.iResolution[0], _29.iResolution[1]))) / float2(_29.iResolution[1u]);
    float lr = log(fast::max(length(p), 9.9999997473787516355514526367188e-05));
    float a = (precise::atan2(p.y, p.x) - radians(_29.uAngle)) - (_29.uTwist * lr);
    float side = abs(fract((a * float(_29.uCount)) / 6.28318023681640625) - 0.5) * 2.0;
    float dir = (_29.uInward != 0u) ? 1.0 : (-1.0);
    float s = ((lr * _29.uFrequency) - ((dir * _29.uDepth) * side)) + ((dir * _29.iTime) * _29.uSpeed);
    float tri = abs(fract(s) - 0.5);
    float e = fast::max(fwidth(s) * 0.75, _29.uSoft * 0.25) + 9.9999997473787516355514526367188e-05;
    float m = smoothstep(0.25 - e, 0.25 + e, tri);
    float3 col = mix(_29.uColorA, float3(_29.uColorB), float3(m));
    float2 uv = (fragCoord / float2(_29.iResolution[0], _29.iResolution[1])) - float2(0.5);
    col *= (1.0 - (_29.uVignette * smoothstep(0.100000001490116119384765625, 0.75, dot(uv, uv) * 2.0)));
    fragColor = float4(col, 1.0);
}

fragment flair_chevron_tunnel_frag_out flair_chevron_tunnel_frag(constant FlairUniforms& _29 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_chevron_tunnel_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _196;
    if (_29.flair_flipY > 0.5)
    {
        _196 = _29.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _196 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _196);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _29);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

