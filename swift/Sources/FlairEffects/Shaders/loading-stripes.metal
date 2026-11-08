// flair-metal-hash: d753e04b
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
    float3 uScreen;
    packed_float3 uInk;
    float uSpeed;
    float uStripe;
};

constant spvUnsafeArray<float3, 16> _283 = spvUnsafeArray<float3, 16>({ float3(0.0), float3(1.0), float3(0.53299999237060546875, 0.0, 0.0), float3(0.666999995708465576171875, 1.0, 0.933000028133392333984375), float3(0.800000011920928955078125, 0.2669999897480010986328125, 0.800000011920928955078125), float3(0.0, 0.800000011920928955078125, 0.333000004291534423828125), float3(0.0, 0.0, 0.666999995708465576171875), float3(0.933000028133392333984375, 0.933000028133392333984375, 0.46700000762939453125), float3(0.86699998378753662109375, 0.53299999237060546875, 0.333000004291534423828125), float3(0.4000000059604644775390625, 0.2669999897480010986328125, 0.0), float3(1.0, 0.46700000762939453125, 0.46700000762939453125), float3(0.20000000298023223876953125), float3(0.46700000762939453125), float3(0.666999995708465576171875, 1.0, 0.4000000059604644775390625), float3(0.0, 0.53299999237060546875, 1.0), float3(0.732999980449676513671875) });
constant spvUnsafeArray<int2, 15> _387 = spvUnsafeArray<int2, 15>({ int2(0), int2(509487, 1057), int2(509487, 17701), int2(492607, 31777), int2(459838, 15888), int2(33825, 31777), int2(1033774, 17969), int2(141873, 4228), int2(575022, 14897), int2(708145, 17977), int2(135327, 4228), int2(575023, 15921), int2(135310, 14468), int2(951854, 31281), int2(0, 6336) });
constant spvUnsafeArray<int, 120> _399 = spvUnsafeArray<int, 120>({ 1, 2, 3, 4, 4, 0, 1, 5, 6, 7, 0, 8, 9, 0, 10, 6, 1, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 8, 6, 11, 12, 9, 13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 6, 11, 7, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 });

struct flair_loading_stripes_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float glyphBit(thread const int2& g, thread const int& x, thread const int& y)
{
    if ((((x < 0) || (x > 4)) || (y < 0)) || (y > 6))
    {
        return 0.0;
    }
    int _86;
    if (y < 4)
    {
        _86 = g.x >> (x + (5 * y));
    }
    else
    {
        _86 = g.y >> (x + (5 * (y - 4)));
    }
    int bits = _86;
    return float(bits & 1);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _127)
{
    float2 screen = float2(128.0, 80.0);
    float px = fast::max(1.0, floor(fast::min((_127.iResolution[0u] * 0.7799999713897705078125) / screen.x, (_127.iResolution[1u] * 0.7200000286102294921875) / screen.y)));
    float2 origin = floor((float2(_127.iResolution[0], _127.iResolution[1]) - (screen * px)) * 0.5);
    float2 q = floor((fragCoord - origin) / float2(px));
    bool _168 = q.x < 0.0;
    bool _175;
    if (!_168)
    {
        _175 = q.y < 0.0;
    }
    else
    {
        _175 = _168;
    }
    bool _184;
    if (!_175)
    {
        _184 = q.x >= screen.x;
    }
    else
    {
        _184 = _175;
    }
    bool _193;
    if (!_184)
    {
        _193 = q.y >= screen.y;
    }
    else
    {
        _193 = _184;
    }
    if (_193)
    {
        float row = floor(fragCoord.y / px);
        float tick = floor((_127.iTime * _127.uSpeed) * 20.0);
        float2 param = float2(tick, 3.0);
        float offset = floor(hash12(param) * 400.0);
        float a = floor((row + offset) / _127.uStripe);
        float b = floor((row + (offset * 1.7000000476837158203125)) / (_127.uStripe * 2.2999999523162841796875));
        float2 param_1 = float2(a + (b * 31.0), tick);
        int c = int(hash12(param_1) * 16.0);
        fragColor = float4(_283[c], 1.0);
        return;
    }
    float3 col = _127.uScreen;
    float x = q.x - 4.0;
    float y = (screen.y - 5.0) - q.y;
    int tc = int(floor(x / 6.0));
    int tr = int(floor(y / 8.0));
    int gx = int(mod(x, 6.0));
    int gy = int(mod(y, 8.0));
    if ((((x >= 0.0) && (y >= 0.0)) && (tc < 20)) && (tr < 6))
    {
        int2 param_2 = _387[_399[(tr * 20) + tc]];
        int param_3 = gx;
        int param_4 = gy;
        float ink = glyphBit(param_2, param_3, param_4);
        bool _425 = ((tr == 5) && (tc == 0)) && (gx < 6);
        bool _436;
        if (_425)
        {
            _436 = mod(floor(_127.iTime * 2.5), 2.0) < 1.0;
        }
        else
        {
            _436 = _425;
        }
        if (_436)
        {
            ink = 1.0;
        }
        col = mix(col, float3(_127.uInk), float3(ink));
    }
    fragColor = float4(col, 1.0);
}

fragment flair_loading_stripes_frag_out flair_loading_stripes_frag(constant FlairUniforms& _127 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_loading_stripes_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _461;
    if (_127.flair_flipY > 0.5)
    {
        _461 = _127.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _461 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _461);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _127);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

