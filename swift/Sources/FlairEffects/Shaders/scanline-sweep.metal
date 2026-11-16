// flair-metal-hash: 483aa9b6
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    float uSpeed;
    float uWidth;
    char _m16_pad[4];
    packed_float3 uColor;
    float uInterval;
    float uTrail;
};

struct flair_scanline_sweep_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _70)
{
    float2 p = (fragCoord - (float2(_70.iResolution[0], _70.iResolution[1]) * 0.5)) / float2(_70.iResolution[1u]);
    float aspect = _70.iResolution[0u] / _70.iResolution[1u];
    float px = 1.0 / _70.iResolution[1u];
    float a = radians(_70.uAngle);
    float2 dir = float2(cos(a), sin(a));
    float s = dot(p, dir);
    float trailLength = 0.0199999995529651641845703125 + (0.20000000298023223876953125 * _70.uTrail);
    float reach = ((0.5 * ((abs(dir.x) * aspect) + abs(dir.y))) + (_70.uWidth * 6.0)) + (trailLength * 4.0);
    float sweep = 1.5 / _70.uSpeed;
    float k = mod(_70.iTime, sweep + _70.uInterval) / sweep;
    float d = s - mix(-reach, reach, k);
    float core = 1.0 - smoothstep(_70.uWidth * 0.5, (_70.uWidth * 0.5) + px, abs(d));
    float halo = exp((-abs(d)) / (_70.uWidth * 3.5)) * 0.64999997615814208984375;
    float _192;
    if (d < 0.0)
    {
        _192 = (exp(d / trailLength) * 0.4000000059604644775390625) * _70.uTrail;
    }
    else
    {
        _192 = 0.0;
    }
    float trail = _192;
    float shimmer = 0.7200000286102294921875 + ((0.2800000011920928955078125 * sin(fragCoord.y * 2.0)) * (0.85000002384185791015625 + (0.1500000059604644775390625 * sin((fragCoord.x * 0.4000000059604644775390625) + (_70.iTime * 10.0)))));
    trail *= shimmer;
    float3 beam = (mix(float3(_70.uColor), float3(1.0), float3(core * 0.60000002384185791015625)) * ((core * 1.60000002384185791015625) + halo)) + (float3(_70.uColor) * trail);
    float3 param = beam;
    float4 _256 = glow(param);
    fragColor = _256;
}

fragment flair_scanline_sweep_frag_out flair_scanline_sweep_frag(constant FlairUniforms& _70 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_scanline_sweep_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _269;
    if (_70.flair_flipY > 0.5)
    {
        _269 = _70.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _269 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _269);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _70);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

