// flair-metal-hash: 9b410ebe
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
    float uDot;
    float uSpacing;
    float uSpeed;
    float uReach;
    float uLine;
    float uFlash;
    char _m19_pad[8];
    packed_float3 uColor;
    uint uDemo;
};

struct flair_ripple_dot_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool soundDemo(constant FlairUniforms& _51)
{
    bool _57 = _51.uDemo != 0u;
    bool _66;
    if (_57)
    {
        _66 = _51.iBeat == 0.0;
    }
    else
    {
        _66 = _57;
    }
    bool _77;
    if (_66)
    {
        _77 = dot(_51.iAudio, _51.iAudio) == 0.0;
    }
    else
    {
        _77 = _66;
    }
    return _77;
}

static inline __attribute__((always_inline))
float demoKick(constant FlairUniforms& _51)
{
    return exp((-mod(_51.iTime, 0.5)) * 7.0);
}

static inline __attribute__((always_inline))
float demoHat(constant FlairUniforms& _51)
{
    return exp((-mod(_51.iTime + 0.25, 0.5)) * 16.0);
}

static inline __attribute__((always_inline))
float4 sound(constant FlairUniforms& _51)
{
    if (!soundDemo(_51))
    {
        return _51.iAudio;
    }
    float k = demoKick(_51);
    float mid = (0.4000000059604644775390625 + (0.119999997317790985107421875 * sin(_51.iTime * 1.7000000476837158203125))) + (0.100000001490116119384765625 * sin(_51.iTime * 3.099999904632568359375));
    return float4((0.449999988079071044921875 + (0.300000011920928955078125 * k)) + (0.100000001490116119384765625 * mid), 0.300000011920928955078125 + (0.64999997615814208984375 * k), mid, (0.25 + (0.4000000059604644775390625 * demoHat(_51))) + (0.07999999821186065673828125 * sin(_51.iTime * 5.30000019073486328125)));
}

static inline __attribute__((always_inline))
float beat(constant FlairUniforms& _51)
{
    float _157;
    if (soundDemo(_51))
    {
        _157 = mod(_51.iTime, 0.5);
    }
    else
    {
        _157 = _51.iBeat;
    }
    return _157;
}

static inline __attribute__((always_inline))
float spectrum(thread float& x, constant FlairUniforms& _51)
{
    x = fast::clamp(x, 0.0, 1.0);
    if (soundDemo(_51))
    {
        float tilt = 0.800000011920928955078125 - (0.5 * x);
        float wander = ((0.60000002384185791015625 + (0.25 * sin((_51.iTime * 0.699999988079071044921875) + (x * 5.0)))) + (0.100000001490116119384765625 * sin((x * 23.0) + (_51.iTime * 2.2999999523162841796875)))) + (0.070000000298023223876953125 * sin((x * 47.0) - (_51.iTime * 3.7000000476837158203125)));
        return fast::clamp(((tilt * wander) + ((0.550000011920928955078125 * demoKick(_51)) * exp((-x) * 7.0))) + ((0.3499999940395355224609375 * demoHat(_51)) * smoothstep(0.550000011920928955078125, 0.89999997615814208984375, x)), 0.0, 1.0);
    }
    float f = x * 63.0;
    int i = int(f);
    int j = min((i + 1), 63);
    return mix(_51.iSpectrum[i / 4][spvSMod(i, 4)], _51.iSpectrum[j / 4][spvSMod(j, 4)], f - float(i));
}

static inline __attribute__((always_inline))
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _51)
{
    float px = 1.0 / _51.iResolution[1u];
    float2 p = (fragCoord - (float2(_51.iResolution[0], _51.iResolution[1]) * 0.5)) * px;
    float4 s = sound(_51);
    float b = beat(_51);
    float _324;
    if (b >= 0.0)
    {
        _324 = exp((-b) * 3.0);
    }
    else
    {
        _324 = 0.0;
    }
    float hit = _324;
    float r = length(p);
    float size = _51.uDot * ((1.0 + (0.60000002384185791015625 * s.y)) + (0.300000011920928955078125 * hit));
    float light = smoothstep(size + px, size - px, r) + (0.1500000059604644775390625 * exp((-fast::max(r - size, 0.0)) / (size * 2.0)));
    float x = r / _51.uReach;
    if (x < 1.0)
    {
        float phase = (r / _51.uSpacing) - ((_51.iTime * _51.uSpeed) * 2.0);
        float away = (abs(fract(phase) - 0.5) * _51.uSpacing) / px;
        float ring = exp(-powr(away / _51.uLine, 2.0));
        float param = x;
        float _418 = spectrum(param, _51);
        light += (((ring * (0.0599999986588954925537109375 + (0.89999997615814208984375 * _418))) * smoothstep(1.0, 0.60000002384185791015625, x)) * smoothstep(size, size + 0.00999999977648258209228515625, r));
    }
    float br = (fast::max(b, 0.0) * _51.uReach) * 1.2000000476837158203125;
    light += (((_51.uFlash * hit) * exp(-powr((r - br) / ((_51.uLine * px) * 1.5), 2.0))) * 1.2000000476837158203125);
    float3 param_1 = float3(_51.uColor) * light;
    float4 _470 = glow(param_1);
    fragColor = _470;
}

fragment flair_ripple_dot_frag_out flair_ripple_dot_frag(constant FlairUniforms& _51 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_ripple_dot_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _483;
    if (_51.flair_flipY > 0.5)
    {
        _483 = _51.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _483 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _483);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _51);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

