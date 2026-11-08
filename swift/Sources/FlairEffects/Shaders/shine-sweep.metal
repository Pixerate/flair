// flair-metal-hash: eb19b111
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

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
    float uAngle;
    float uWidth;
    float uIntensity;
    float uInterval;
    float3 uColor;
};

struct flair_shine_sweep_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _30)
{
    float2 p = (fragCoord - (float2(_30.iResolution[0], _30.iResolution[1]) * 0.5)) / float2(_30.iResolution[1u]);
    float aspect = _30.iResolution[0u] / _30.iResolution[1u];
    float slope = tan(radians(_30.uAngle));
    float s = p.x + (p.y * slope);
    float reach = ((0.5 * aspect) + (0.5 * abs(slope))) + _30.uWidth;
    float k = fast::clamp(mod(_30.iTime, _30.uInterval) / 0.89999997615814208984375, 0.0, 1.0);
    k = (k * k) * (3.0 - (2.0 * k));
    float d = (s - mix(-reach, reach, k)) / _30.uWidth;
    float band = (exp(((-d) * d) * 4.0) * 0.699999988079071044921875) + (exp(((-d) * d) * 60.0) * 0.5);
    fragColor = float4(_30.uColor, fast::clamp(band * _30.uIntensity, 0.0, 1.0));
}

fragment flair_shine_sweep_frag_out flair_shine_sweep_frag(constant FlairUniforms& _30 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_shine_sweep_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _155;
    if (_30.flair_flipY > 0.5)
    {
        _155 = _30.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _155 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _155);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _30);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

