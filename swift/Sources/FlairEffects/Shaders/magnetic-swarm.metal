// flair-metal-hash: c199f6e0
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

// Implementation of signed integer mod accurate to SPIR-V specification
template<typename Tx, typename Ty>
inline Tx spvSMod(Tx x, Ty y)
{
    Tx remainder = x - y * (x / y);
    return select(Tx(remainder + y), remainder, remainder == 0 || (x >= 0) == (y >= 0));
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
    int uCount;
    float uRadius;
    float uSpeed;
    float uLag;
    float uFling;
    float uSize;
    float3 uColorA;
    packed_float3 uColorB;
    uint uDemo;
};

struct flair_magnetic_swarm_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 drift(thread const float& t, constant FlairUniforms& _168)
{
    return float2(_168.iResolution[0], _168.iResolution[1]) * (float2(0.5) + float2(0.300000011920928955078125 * sin(t * 0.5299999713897705078125), 0.23999999463558197021484375 * sin((t * 0.810000002384185791015625) + 1.2999999523162841796875)));
}

static inline __attribute__((always_inline))
float2 pointerAt(thread const float& t, constant FlairUniforms& _168)
{
    float2 at = _168.iPointer.xy;
    for (int i = 0; i < 32; i++)
    {
        if (_168.iTrail[i].w < 0.5)
        {
            break;
        }
        at = _168.iTrail[i].xy;
        if (_168.iTrail[i].z <= t)
        {
            break;
        }
    }
    return at;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 clickAt(thread const int& i, thread const bool& demo, thread const float& period, constant FlairUniforms& _168)
{
    bool _214 = !demo;
    bool _222;
    if (!_214)
    {
        _222 = _168.iClicks[0].w > 0.5;
    }
    else
    {
        _222 = _214;
    }
    if (_222)
    {
        return _168.iClicks[i];
    }
    float k = floor(_168.iTime / period) - float(i);
    float2 param = float2((k * 1.37000000476837158203125) + 0.5, 3.7000000476837158203125);
    float2 h = hash22(param);
    return float4((float2(0.20000000298023223876953125) + (h * 0.60000002384185791015625)) * float2(_168.iResolution[0], _168.iResolution[1]), k * period, 1.0);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _168)
{
    float px = 1.0 / _168.iResolution[1u];
    float2 p = fragCoord * px;
    float hover = fast::clamp(_168.iPointer.z, 0.0, 1.0);
    float2 _325;
    spvUnsafeArray<float2, 4> centres;
    for (int g = 0; g < 4; g++)
    {
        float lag = (_168.uLag * float(g)) / 3.0;
        if (_168.uDemo != 0u)
        {
            float param = _168.iTime - (lag * 1.2000000476837158203125);
            _325 = drift(param, _168);
        }
        else
        {
            _325 = float2(_168.iResolution[0], _168.iResolution[1]) * 0.5;
        }
        float2 idle = _325;
        float param_1 = _168.iTime - (lag * 0.25);
        centres[g] = mix(idle, pointerAt(param_1, _168), float2(hover)) * px;
    }
    spvUnsafeArray<float4, 4> clicks;
    for (int k = 0; k < 4; k++)
    {
        int param_2 = k;
        bool param_3 = _168.uDemo != 0u;
        float param_4 = 3.0;
        clicks[k] = clickAt(param_2, param_3, param_4, _168);
    }
    float3 col = float3(0.0);
    float dc = length(p - centres[0]);
    col += (mix(_168.uColorA, float3(1.0), float3(0.5)) * ((0.25 * exp(((-dc) * dc) / 0.00039999998989515006542205810546875)) + (0.0500000007450580596923828125 * exp((-dc) / 0.0500000007450580596923828125))));
    for (int i = 0; i < 160; i++)
    {
        if (i >= _168.uCount)
        {
            break;
        }
        float fi = float(i);
        float2 param_5 = float2(fi, 4.099999904632568359375);
        float2 h = hash22(param_5);
        float2 param_6 = float2(fi, 9.69999980926513671875);
        float h3 = hash12(param_6);
        float r = _168.uRadius * (0.25 + (0.75 * sqrt(h.x)));
        float w = ((_168.uSpeed * (0.699999988079071044921875 + (0.60000002384185791015625 * h.y))) * 0.25) / (r + 0.0500000007450580596923828125);
        float a = (_168.iTime * w) + (h3 * 6.28318023681640625);
        float2 param_7 = float2(fi, 2.2999999523162841796875);
        float tilt = hash12(param_7) * 3.141590118408203125;
        float2 param_8 = float2(fi, 5.5);
        float ecc = 0.20000000298023223876953125 + (0.800000011920928955078125 * hash12(param_8));
        float param_9 = tilt;
        float2 pos = centres[spvSMod(i, 4)] + ((rot(param_9) * float2(cos(a), sin(a) * ecc)) * r);
        float energy = 0.0;
        for (int k_1 = 0; k_1 < 4; k_1++)
        {
            float4 c = clicks[k_1];
            if (c.w < 0.5)
            {
                continue;
            }
            float age = _168.iTime - c.z;
            if ((age < 0.0) || (age > 4.0))
            {
                continue;
            }
            float2 dir = pos - (c.xy * px);
            float d = length(dir);
            float push = (((_168.uFling * 0.699999988079071044921875) * exp((-d) * 2.5)) * (1.0 - exp((-age) * 9.0))) * exp((-age) * 1.2999999523162841796875);
            pos += ((dir / float2(fast::max(d, 9.9999997473787516355514526367188e-05))) * push);
            energy += push;
        }
        float2 dp = p - pos;
        bool _611 = abs(dp.x) > 0.0599999986588954925537109375;
        bool _619;
        if (!_611)
        {
            _619 = abs(dp.y) > 0.0599999986588954925537109375;
        }
        else
        {
            _619 = _611;
        }
        if (_619)
        {
            continue;
        }
        float dist = length(dp);
        float rr = (0.0035000001080334186553955078125 * _168.uSize) * (0.60000002384185791015625 + (0.800000011920928955078125 * h.y));
        float3 hue = mix(_168.uColorA, float3(_168.uColorB), float3(smoothstep(0.20000000298023223876953125, 1.0, r / fast::max(_168.uRadius, 0.001000000047497451305389404296875))));
        float twinkle = 0.75 + (0.25 * sin((_168.iTime * 6.0) + (fi * 2.099999904632568359375)));
        float core = 1.0 - smoothstep(rr * 0.5, rr + px, dist);
        float halo = exp((-dist) / (rr * 2.5)) * 0.4000000059604644775390625;
        col += (((hue * ((core * 1.60000002384185791015625) + halo)) * twinkle) * (1.0 + (energy * 3.0)));
    }
    float3 param_10 = col;
    float4 _701 = glow(param_10);
    fragColor = _701;
}

fragment flair_magnetic_swarm_frag_out flair_magnetic_swarm_frag(constant FlairUniforms& _168 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_magnetic_swarm_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _714;
    if (_168.flair_flipY > 0.5)
    {
        _714 = _168.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _714 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _714);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _168);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

