// flair-metal-hash: cc74d530
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
    int uSegments;
    float uZoom;
    float uSpeed;
    float3 uTint;
};

struct flair_kaleidoscope_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _54)
{
    float2 p = (fragCoord - (float2(_54.iResolution[0], _54.iResolution[1]) * 0.5)) / float2(_54.iResolution[1u]);
    float t = _54.iTime * _54.uSpeed;
    float n = float(_54.uSegments);
    float a = precise::atan2(p.y, p.x) + (t * 0.300000011920928955078125);
    float r = length(p);
    float wedge = 6.28318023681640625 / n;
    a = mod(a, wedge);
    a = abs(a - (wedge * 0.5));
    float2 q = (float2(cos(a), sin(a)) * r) * _54.uZoom;
    float param = t * 0.20000000298023223876953125;
    q = (rot(param) * q) + float2(t);
    float3 col = float3(0.5) + (cos(((float3(0.0, 2.0, 4.0) + float3(q.x * 2.0)) + float3(sin(q.y * 3.0))) + float3(t)) * 0.5);
    col *= (0.60000002384185791015625 + ((0.4000000059604644775390625 * sin(q.x * 5.0)) * sin(q.y * 5.0)));
    col *= smoothstep(1.2000000476837158203125, 0.20000000298023223876953125, r);
    fragColor = float4(col * _54.uTint, 1.0);
}

fragment flair_kaleidoscope_frag_out flair_kaleidoscope_frag(constant FlairUniforms& _54 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_kaleidoscope_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _197;
    if (_54.flair_flipY > 0.5)
    {
        _197 = _54.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _197 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _197);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _54);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

