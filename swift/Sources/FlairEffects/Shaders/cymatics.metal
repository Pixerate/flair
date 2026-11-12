// flair-metal-hash: 3cf2deb5
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
    float uComplexity;
    float uLine;
    float uGrain;
    float uScatter;
    float3 uSand;
    float3 uPlate;
    packed_float3 uBackground;
    uint uRound;
    uint uDemo;
    float uBackgroundAlpha;
};

struct flair_cymatics_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool soundDemo(constant FlairUniforms& _134)
{
    bool _139 = _134.uDemo != 0u;
    bool _148;
    if (_139)
    {
        _148 = _134.iBeat == 0.0;
    }
    else
    {
        _148 = _139;
    }
    bool _159;
    if (_148)
    {
        _159 = dot(_134.iAudio, _134.iAudio) == 0.0;
    }
    else
    {
        _159 = _148;
    }
    return _159;
}

static inline __attribute__((always_inline))
float demoKick(constant FlairUniforms& _134)
{
    return exp((-mod(_134.iTime, 0.5)) * 7.0);
}

static inline __attribute__((always_inline))
float demoHat(constant FlairUniforms& _134)
{
    return exp((-mod(_134.iTime + 0.25, 0.5)) * 16.0);
}

static inline __attribute__((always_inline))
float4 sound(constant FlairUniforms& _134)
{
    if (!soundDemo(_134))
    {
        return _134.iAudio;
    }
    float k = demoKick(_134);
    float mid = (0.4000000059604644775390625 + (0.119999997317790985107421875 * sin(_134.iTime * 1.7000000476837158203125))) + (0.100000001490116119384765625 * sin(_134.iTime * 3.099999904632568359375));
    return float4((0.449999988079071044921875 + (0.300000011920928955078125 * k)) + (0.100000001490116119384765625 * mid), 0.300000011920928955078125 + (0.64999997615814208984375 * k), mid, (0.25 + (0.4000000059604644775390625 * demoHat(_134))) + (0.07999999821186065673828125 * sin(_134.iTime * 5.30000019073486328125)));
}

static inline __attribute__((always_inline))
float beat(constant FlairUniforms& _134)
{
    float _239;
    if (soundDemo(_134))
    {
        _239 = mod(_134.iTime, 0.5);
    }
    else
    {
        _239 = _134.iBeat;
    }
    return _239;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float spectrum(thread float& x, constant FlairUniforms& _134)
{
    x = fast::clamp(x, 0.0, 1.0);
    if (soundDemo(_134))
    {
        float tilt = 0.800000011920928955078125 - (0.5 * x);
        float wander = ((0.60000002384185791015625 + (0.25 * sin((_134.iTime * 0.699999988079071044921875) + (x * 5.0)))) + (0.100000001490116119384765625 * sin((x * 23.0) + (_134.iTime * 2.2999999523162841796875)))) + (0.070000000298023223876953125 * sin((x * 47.0) - (_134.iTime * 3.7000000476837158203125)));
        return fast::clamp(((tilt * wander) + ((0.550000011920928955078125 * demoKick(_134)) * exp((-x) * 7.0))) + ((0.3499999940395355224609375 * demoHat(_134)) * smoothstep(0.550000011920928955078125, 0.89999997615814208984375, x)), 0.0, 1.0);
    }
    float f = x * 63.0;
    int i = int(f);
    int j = min((i + 1), 63);
    return mix(_134.iSpectrum[i / 4][spvSMod(i, 4)], _134.iSpectrum[j / 4][spvSMod(j, 4)], f - float(i));
}

static inline __attribute__((always_inline))
float pitch(constant FlairUniforms& _134)
{
    float sum = 0.0;
    float total = 0.0;
    for (int i = 0; i < 16; i++)
    {
        float x = (float(i) + 0.5) / 16.0;
        float param = x;
        float _423 = spectrum(param, _134);
        float v = _423;
        sum += (x * v);
        total += v;
    }
    float _437;
    if (total > 0.001000000047497451305389404296875)
    {
        _437 = sum / total;
    }
    else
    {
        _437 = 0.300000011920928955078125;
    }
    return _437;
}

static inline __attribute__((always_inline))
float2 mode(thread const float& k)
{
    float n = 1.0 + floor(k * 0.5);
    return float2(n, (n + 1.0) + (2.0 * mod(k, 2.0)));
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float chladni(thread const float2& u, thread const float2& nm)
{
    return (cos((nm.x * 3.1415927410125732421875) * u.x) * cos((nm.y * 3.1415927410125732421875) * u.y)) - (cos((nm.y * 3.1415927410125732421875) * u.x) * cos((nm.x * 3.1415927410125732421875) * u.y));
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _134)
{
    float px = 1.0 / _134.iResolution[1u];
    float2 p = (fragCoord - (float2(_134.iResolution[0], _134.iResolution[1]) * 0.5)) * px;
    float4 s = sound(_134);
    float b = beat(_134);
    float _468;
    if (b >= 0.0)
    {
        _468 = exp((-b) * 7.0);
    }
    else
    {
        _468 = 0.0;
    }
    float hit = _468;
    float size = 0.439999997615814208984375;
    float2 corner = (abs(p) - float2(size)) + float2(0.0199999995529651641845703125);
    float _493;
    if (_134.uRound != 0u)
    {
        _493 = length(p) - size;
    }
    else
    {
        _493 = (length(fast::max(corner, float2(0.0))) + fast::min(fast::max(corner.x, corner.y), 0.0)) - 0.0199999995529651641845703125;
    }
    float plateD = _493;
    float3 col = float3(_134.uBackground) * (1.0 - (0.4000000059604644775390625 * length(p)));
    col *= (1.0 - (0.60000002384185791015625 * exp((-fast::max(plateD, 0.0)) / 0.02500000037252902984619140625)));
    float inside = fast::clamp(0.5 - (plateD / px), 0.0, 1.0);
    float3 plate = _134.uPlate * (0.75 + (0.5 * smoothstep(0.60000002384185791015625, -0.60000002384185791015625, p.x - p.y)));
    float2 param = float2(floor(fragCoord.y * 0.699999988079071044921875), 3.0);
    plate *= (0.949999988079071044921875 + (0.100000001490116119384765625 * hash12(param)));
    float k = _134.uComplexity * fast::clamp(((0.1500000059604644775390625 + (1.60000002384185791015625 * (pitch(_134) - 0.25))) + (0.300000011920928955078125 * s.z)) - (0.20000000298023223876953125 * s.y), 0.0, 1.0);
    float f = smoothstep(0.300000011920928955078125, 0.699999988079071044921875, fract(k));
    float param_1 = floor(k);
    float2 m0 = mode(param_1);
    float param_2 = floor(k) + 1.0;
    float2 m1 = mode(param_2);
    float2 id = floor(p / float2(_134.uGrain));
    float2 param_3 = id;
    float2 jitter = hash22(param_3);
    float2 centre = ((id + float2(0.300000011920928955078125)) + (jitter * 0.4000000059604644775390625)) * _134.uGrain;
    float2 u = (centre / float2(2.0 * size)) + float2(0.5);
    float2 param_4 = u;
    float2 param_5 = m0;
    float2 param_6 = u;
    float2 param_7 = m1;
    float figure = mix(chladni(param_4, param_5), chladni(param_6, param_7), f);
    float away = abs(figure) / (3.1415927410125732421875 * mix(m0.y, m1.y, f));
    float width = 0.010999999940395355224609375 * _134.uLine;
    float line = exp(((-away) * away) / (width * width));
    plate = mix(plate, _134.uSand * 0.449999988079071044921875, float3(line * 0.300000011920928955078125));
    float stray = 0.00999999977648258209228515625 + ((0.07999999821186065673828125 * hit) * _134.uScatter);
    float2 param_8 = id + float2(17.299999237060546875);
    if (hash12(param_8) < ((0.949999988079071044921875 * line) + (stray * (1.0 - line))))
    {
        float lift = ((1.0 - line) * hit) * _134.uScatter;
        float2 buzz = ((float2(sin((_134.iTime * 61.0) + (jitter.x * 40.0)), cos((_134.iTime * 53.0) + (jitter.y * 40.0))) * s.x) * 0.0599999986588954925537109375) * _134.uGrain;
        float2 at = centre + buzz;
        float rad = (0.319999992847442626953125 * _134.uGrain) * (1.0 + (0.5 * lift));
        float sd = length((p - at) - ((float2(0.119999997317790985107421875, -0.1599999964237213134765625) * _134.uGrain) * (0.300000011920928955078125 + lift))) - rad;
        plate *= (1.0 - (0.5 * fast::clamp(0.5 - (sd / px), 0.0, 1.0)));
        float d = length(p - at) - rad;
        float shade = 0.85000002384185791015625 + (0.3499999940395355224609375 * fast::clamp(dot((p - at) / float2(rad), float2(-0.60000002384185791015625, 0.60000002384185791015625)), -1.0, 1.0));
        plate = mix(plate, (_134.uSand * (0.75 + (0.3499999940395355224609375 * jitter.x))) * shade, float3(fast::clamp(0.5 - (d / px), 0.0, 1.0)));
    }
    float bolt = length(p) - 0.01200000010430812835693359375;
    plate = mix(plate, float3(0.550000011920928955078125) * (0.800000011920928955078125 + (0.4000000059604644775390625 * smoothstep(0.01200000010430812835693359375, -0.01200000010430812835693359375, p.x - p.y))), float3(fast::clamp(0.5 - (bolt / px), 0.0, 1.0)));
    fragColor = float4(mix(col, plate, float3(inside)), 1.0);
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _896;
    if (a > 0.0)
    {
        _896 = bg + (d / float3(a));
    }
    else
    {
        _896 = bg;
    }
    float3 fg = _896;
    float alpha = a + (opacity * (1.0 - a));
    float3 _918;
    if (alpha > 0.0)
    {
        _918 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _918 = bg;
    }
    float3 col = _918;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _134)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _134);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_134.uBackground);
    float param_4 = _134.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_cymatics_frag_out flair_cymatics_frag(constant FlairUniforms& _134 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_cymatics_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _976;
    if (_134.flair_flipY > 0.5)
    {
        _976 = _134.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _976 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _976);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _134);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

