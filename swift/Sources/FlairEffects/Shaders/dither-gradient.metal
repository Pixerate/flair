// flair-metal-hash: 5a1b8ea2
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"
#pragma clang diagnostic ignored "-Wmissing-braces"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

template<typename T, size_t Num>
struct spvUnsafeArray
{
    T elements[Num ? Num : 1];
    
    thread T& operator [] (size_t pos) thread
    {
        return elements[pos];
    }
    constexpr const thread T& operator [] (size_t pos) const thread
    {
        return elements[pos];
    }
    
    device T& operator [] (size_t pos) device
    {
        return elements[pos];
    }
    constexpr const device T& operator [] (size_t pos) const device
    {
        return elements[pos];
    }
    
    constexpr const constant T& operator [] (size_t pos) const constant
    {
        return elements[pos];
    }
    
    threadgroup T& operator [] (size_t pos) threadgroup
    {
        return elements[pos];
    }
    constexpr const threadgroup T& operator [] (size_t pos) const threadgroup
    {
        return elements[pos];
    }
};

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
    float3 uDark;
    packed_float3 uLight;
    float uPixel;
    float uSpeed;
};

constant spvUnsafeArray<int, 16> _61 = spvUnsafeArray<int, 16>({ 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 });

struct flair_dither_gradient_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float bayer4(thread const float2& p)
{
    float2 q = mod(floor(p), float2(4.0));
    int i = int(q.x) + (int(q.y) * 4);
    return (float(_61[i]) + 0.5) / 16.0;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _82)
{
    float2 px = floor(fragCoord / float2(_82.uPixel));
    float2 uv = (px * _82.uPixel) / float2(_82.iResolution[0], _82.iResolution[1]);
    float v = (uv.y + (0.1500000059604644775390625 * sin((uv.x * 6.0) + ((_82.iTime * _82.uSpeed) * 2.0)))) + (0.100000001490116119384765625 * sin((uv.x * 13.0) - ((_82.iTime * _82.uSpeed) * 3.0)));
    v = fast::clamp(v, 0.0, 1.0);
    float2 param = px;
    float on = step(bayer4(param), v);
    fragColor = float4(mix(_82.uDark, float3(_82.uLight), float3(on)), 1.0);
}

fragment flair_dither_gradient_frag_out flair_dither_gradient_frag(constant FlairUniforms& _82 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_dither_gradient_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _168;
    if (_82.flair_flipY > 0.5)
    {
        _168 = _82.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _168 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _168);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _82);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

