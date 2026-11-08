// flair-metal-hash: 698561d8
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
    float uAspect;
    char _m14_pad[12];
    packed_float3 uColor;
    float uOpacity;
    float uSoftness;
    float uShift;
    uint uAnimate;
    float uProgress;
};

struct flair_letterbox_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _29)
{
    float c = mod(_29.iTime, 5.0) / 5.0;
    float _45;
    if (_29.uAnimate != 0u)
    {
        _45 = smoothstep(0.0, 0.20000000298023223876953125, c) - smoothstep(0.800000011920928955078125, 1.0, c);
    }
    else
    {
        _45 = _29.uProgress;
    }
    float amount = _45;
    float2 size = float2(_29.iResolution[0], _29.iResolution[1]);
    bool pillar = _29.uAspect < (size.x / size.y);
    float _82;
    if (pillar)
    {
        _82 = fragCoord.x;
    }
    else
    {
        _82 = fragCoord.y;
    }
    float p = _82;
    float _93;
    if (pillar)
    {
        _93 = size.x;
    }
    else
    {
        _93 = size.y;
    }
    float extent = _93;
    float _104;
    if (pillar)
    {
        _104 = size.y * _29.uAspect;
    }
    else
    {
        _104 = size.x / _29.uAspect;
    }
    float opening = _104;
    float bar = (fast::max(0.0, extent - opening) * 0.5) * amount;
    float inside = fast::min(p - (bar * (1.0 + _29.uShift)), (extent - (bar * (1.0 - _29.uShift))) - p);
    float cover = 1.0 - smoothstep(-0.5, fast::max(_29.uSoftness, 1.0) - 0.5, inside);
    fragColor = float4(_29.uColor[0], _29.uColor[1], _29.uColor[2], cover * _29.uOpacity);
}

fragment flair_letterbox_frag_out flair_letterbox_frag(constant FlairUniforms& _29 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_letterbox_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _181;
    if (_29.flair_flipY > 0.5)
    {
        _181 = _29.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _181 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _181);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _29);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

