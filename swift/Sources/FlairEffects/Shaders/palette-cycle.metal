// flair-metal-hash: 63b5dce0
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
    int uScene;
    float uPixel;
    float uRate;
    float3 uDeep;
    float3 uFoam;
    float3 uRock;
    float3 uSky;
};

constant spvUnsafeArray<float, 16> _160 = spvUnsafeArray<float, 16>({ 0.0, 0.100000001490116119384765625, 0.2199999988079071044921875, 0.4000000059604644775390625, 0.699999988079071044921875, 1.0, 0.75, 0.449999988079071044921875, 0.25, 0.119999997317790985107421875, 0.0500000007450580596923828125, 0.0, 0.07999999821186065673828125, 0.180000007152557373046875, 0.100000001490116119384765625, 0.0 });

struct flair_palette_cycle_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 rainbow(thread const float& i)
{
    float t = mod(i, 16.0) / 16.0;
    return float3(0.5) + (cos((float3(t) + float3(0.0, 0.3300000131130218505859375, 0.670000016689300537109375)) * 6.28318023681640625) * 0.5);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float _noise1(thread const float& x, thread const float& seed)
{
    float i = floor(x);
    float f = fract(x);
    f = (f * f) * (3.0 - (2.0 * f));
    float2 param = float2(i, seed);
    float2 param_1 = float2(i + 1.0, seed);
    return mix(hash12(param), hash12(param_1), f);
}

static inline __attribute__((always_inline))
float bayer2(thread float2& a)
{
    a = floor(a);
    return fract((a.x / 2.0) + ((a.y * a.y) * 0.75));
}

static inline __attribute__((always_inline))
float bayer4(thread const float2& a)
{
    float2 param = a * 0.5;
    float _93 = bayer2(param);
    float2 param_1 = a;
    float _98 = bayer2(param_1);
    return (_93 * 0.25) + _98;
}

static inline __attribute__((always_inline))
float3 water(thread const float& i, constant FlairUniforms& _141)
{
    return mix(_141.uDeep, _141.uFoam, float3(_160[int(mod(i, 16.0))]));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _141)
{
    float2 cell = floor(fragCoord / float2(_141.uPixel));
    float2 grid = fast::max(floor(float2(_141.iResolution[0], _141.iResolution[1]) / float2(_141.uPixel)), float2(1.0));
    float shift = floor(_141.iTime * _141.uRate);
    if (_141.uScene == 1)
    {
        float2 p = (cell / float2(grid.y)) * 8.0;
        float v = ((sin(p.x) + sin(p.y * 1.2999999523162841796875)) + sin((p.x + p.y) * 0.699999988079071044921875)) + sin(length(p - float2(4.0)) * 1.5);
        float index = floor(((v * 0.125) + 0.5) * 32.0);
        float param = index - shift;
        fragColor = float4(rainbow(param), 1.0);
        return;
    }
    float2 uv = cell / grid;
    float mid = floor(grid.x * 0.5);
    float param_1 = cell.y * 0.20000000298023223876953125;
    float param_2 = 2.0;
    float fallHalf = floor((grid.x * 0.100000001490116119384765625) + (2.0 * _noise1(param_1, param_2)));
    float param_3 = cell.x * 0.07999999821186065673828125;
    float param_4 = 1.0;
    float cliffTop = floor(grid.y * (0.7400000095367431640625 + (0.07999999821186065673828125 * _noise1(param_3, param_4))));
    float poolTop = floor(grid.y * 0.2599999904632568359375);
    float3 col = mix(_141.uSky, (_141.uSky * 1.7999999523162841796875) + float3(0.039999999105930328369140625), float3(floor((1.0 - uv.y) * 4.0) / 4.0));
    float2 param_5 = cell;
    if (hash12(param_5) > 0.98500001430511474609375)
    {
        col = float3(0.85000002384185791015625, 0.85000002384185791015625, 1.0);
    }
    bool _356 = cell.y < cliffTop;
    bool _363;
    if (_356)
    {
        _363 = cell.y >= poolTop;
    }
    else
    {
        _363 = _356;
    }
    if (_363)
    {
        float param_6 = (cell.x * 0.300000011920928955078125) + (floor(cell.y / 3.0) * 7.0);
        float param_7 = 5.0;
        float2 param_8 = cell;
        float tone = floor(fast::clamp((_noise1(param_6, param_7) * 2.2000000476837158203125) + ((bayer4(param_8) - 0.5) * 0.60000002384185791015625), 0.0, 2.0));
        col = _141.uRock * (0.64999997615814208984375 + (0.25 * tone));
    }
    bool _407 = abs(cell.x - mid) <= fallHalf;
    bool _414;
    if (_407)
    {
        _414 = cell.y >= poolTop;
    }
    else
    {
        _414 = _407;
    }
    bool _422;
    if (_414)
    {
        _422 = cell.y < (cliffTop + 1.0);
    }
    else
    {
        _422 = _414;
    }
    if (_422)
    {
        float2 param_9 = float2(cell.x, 7.0);
        float streak = floor(hash12(param_9) * 6.0);
        float param_10 = (floor(cell.y / 2.0) + streak) + shift;
        col = water(param_10, _141);
        if (abs(cell.x - mid) == fallHalf)
        {
            col = mix(col, _141.uDeep, float3(0.5));
        }
    }
    if (cell.y < poolTop)
    {
        float2 d = (cell - float2(mid, poolTop)) * float2(1.0, 2.599999904632568359375);
        float ring = floor(length(d) / 2.0);
        float param_11 = ring - shift;
        col = mix(_141.uDeep * 0.699999988079071044921875, water(param_11, _141), float3(0.75 - ((0.4000000059604644775390625 * uv.y) / 0.2599999904632568359375)));
        bool _500 = abs(cell.x - mid) <= (fallHalf + 3.0);
        bool _508;
        if (_500)
        {
            _508 = cell.y > (poolTop - 4.0);
        }
        else
        {
            _508 = _500;
        }
        if (_508)
        {
            float2 param_12 = cell;
            float param_13 = floor(hash12(param_12) * 16.0) + shift;
            col = water(param_13, _141);
        }
    }
    fragColor = float4(col, 1.0);
}

fragment flair_palette_cycle_frag_out flair_palette_cycle_frag(constant FlairUniforms& _141 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_palette_cycle_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _537;
    if (_141.flair_flipY > 0.5)
    {
        _537 = _141.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _537 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _537);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _141);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

