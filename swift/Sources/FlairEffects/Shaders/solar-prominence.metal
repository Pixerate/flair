// flair-metal-hash: 653a48f6
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
    int uArches;
    float uHeight;
    float uBoil;
    float uFlare;
    float3 uSurface;
    float3 uPlasma;
    float3 uCorona;
    packed_float3 uSpace;
    uint uDemo;
};

struct flair_solar_prominence_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool soundDemo(constant FlairUniforms& _197)
{
    bool _202 = _197.uDemo != 0u;
    bool _210;
    if (_202)
    {
        _210 = _197.iBeat == 0.0;
    }
    else
    {
        _210 = _202;
    }
    bool _221;
    if (_210)
    {
        _221 = dot(_197.iAudio, _197.iAudio) == 0.0;
    }
    else
    {
        _221 = _210;
    }
    return _221;
}

static inline __attribute__((always_inline))
float demoKick(constant FlairUniforms& _197)
{
    return exp((-mod(_197.iTime, 0.5)) * 7.0);
}

static inline __attribute__((always_inline))
float demoHat(constant FlairUniforms& _197)
{
    return exp((-mod(_197.iTime + 0.25, 0.5)) * 16.0);
}

static inline __attribute__((always_inline))
float4 sound(constant FlairUniforms& _197)
{
    if (!soundDemo(_197))
    {
        return _197.iAudio;
    }
    float k = demoKick(_197);
    float mid = (0.4000000059604644775390625 + (0.119999997317790985107421875 * sin(_197.iTime * 1.7000000476837158203125))) + (0.100000001490116119384765625 * sin(_197.iTime * 3.099999904632568359375));
    return float4((0.449999988079071044921875 + (0.300000011920928955078125 * k)) + (0.100000001490116119384765625 * mid), 0.300000011920928955078125 + (0.64999997615814208984375 * k), mid, (0.25 + (0.4000000059604644775390625 * demoHat(_197))) + (0.07999999821186065673828125 * sin(_197.iTime * 5.30000019073486328125)));
}

static inline __attribute__((always_inline))
float beat(constant FlairUniforms& _197)
{
    float _299;
    if (soundDemo(_197))
    {
        _299 = mod(_197.iTime, 0.5);
    }
    else
    {
        _299 = _197.iBeat;
    }
    return _299;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float spectrum(thread float& x, constant FlairUniforms& _197)
{
    x = fast::clamp(x, 0.0, 1.0);
    if (soundDemo(_197))
    {
        float tilt = 0.800000011920928955078125 - (0.5 * x);
        float wander = ((0.60000002384185791015625 + (0.25 * sin((_197.iTime * 0.699999988079071044921875) + (x * 5.0)))) + (0.100000001490116119384765625 * sin((x * 23.0) + (_197.iTime * 2.2999999523162841796875)))) + (0.070000000298023223876953125 * sin((x * 47.0) - (_197.iTime * 3.7000000476837158203125)));
        return fast::clamp(((tilt * wander) + ((0.550000011920928955078125 * demoKick(_197)) * exp((-x) * 7.0))) + ((0.3499999940395355224609375 * demoHat(_197)) * smoothstep(0.550000011920928955078125, 0.89999997615814208984375, x)), 0.0, 1.0);
    }
    float f = x * 63.0;
    int i = int(f);
    int j = min((i + 1), 63);
    return mix(_197.iSpectrum[i / 4][spvSMod(i, 4)], _197.iSpectrum[j / 4][spvSMod(j, 4)], f - float(i));
}

static inline __attribute__((always_inline))
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _197)
{
    float px = 1.0 / _197.iResolution[1u];
    float2 p = (fragCoord - (float2(_197.iResolution[0], _197.iResolution[1]) * 0.5)) * px;
    float4 s = sound(_197);
    float b = beat(_197);
    float t = _197.iTime;
    float2 C = float2(-0.1500000059604644775390625, -1.60000002384185791015625);
    float Rs = 1.2999999523162841796875;
    float2 d = p - C;
    float rad = length(d);
    float ang = precise::atan2(d.x, d.y);
    float alt = rad - Rs;
    float2 param = float2(ang * 28.0, (fast::max(alt, 0.0) * 3.0) - (t * 0.0500000007450580596923828125));
    float streamers = 0.60000002384185791015625 + (0.4000000059604644775390625 * vnoise(param));
    float3 col = float3(_197.uSpace) + ((_197.uCorona * ((0.4000000059604644775390625 * exp((-fast::max(alt, 0.0)) / 0.0599999986588954925537109375)) + (0.07999999821186065673828125 * exp((-fast::max(alt, 0.0)) / 0.449999988079071044921875)))) * streamers);
    float2 sp = d * 14.0;
    float boil = (t * 0.1500000059604644775390625) * (1.0 + ((_197.uBoil * 2.5) * s.w));
    float2 param_1 = sp + float2(boil, -boil);
    float2 param_2 = (sp * 2.2999999523162841796875) - float2(boil * 1.2999999523162841796875, boil * 0.699999988079071044921875);
    float g = (0.60000002384185791015625 * vnoise(param_1)) + (0.4000000059604644775390625 * vnoise(param_2));
    float mu = sqrt(fast::max(1.0 - ((rad / Rs) * (rad / Rs)), 0.0));
    float3 surface = ((_197.uSurface * 1.60000002384185791015625) * (0.449999988079071044921875 + (0.64999997615814208984375 * powr(mu, 0.5)))) * (0.75 + ((0.60000002384185791015625 * g) * g));
    col = mix(col, surface, float3(fast::clamp((-alt) / px, 0.0, 1.0)));
    float2 param_3 = float2(floor((t - fast::max(b, 0.0)) * 8.0), 3.0);
    float which = floor(hash12(param_3) * float(_197.uArches));
    float _594;
    if (b >= 0.0)
    {
        _594 = exp((-b) * 2.5) * _197.uFlare;
    }
    else
    {
        _594 = 0.0;
    }
    float flare = _594;
    float3 light = float3(0.0);
    float2 foot = float2(0.0);
    for (int k = 0; k < 12; k++)
    {
        if (k >= _197.uArches)
        {
            break;
        }
        float fk = (float(k) + 0.5) / float(_197.uArches);
        float param_4 = fk;
        float _638 = spectrum(param_4, _197);
        float level0 = _638;
        float a0 = ((fk - 0.5) * 1.10000002384185791015625) + (0.02999999932944774627685546875 * sin((t * 0.20000000298023223876953125) + float(k)));
        float2 param_5 = float2(float(k), 1.0);
        float w = 0.0500000007450580596923828125 + (0.0500000007450580596923828125 * hash12(param_5));
        float h = (0.039999999105930328369140625 + (0.300000011920928955078125 * level0)) * _197.uHeight;
        float boost = 0.0;
        if (float(k) == which)
        {
            h += ((fast::max(b, 0.0) * 0.5) * _197.uFlare);
            boost = flare;
            foot = C + (float2(sin(a0), cos(a0)) * Rs);
        }
        float2 uv = float2(((ang - a0) * Rs) / w, alt / h);
        float e = length(uv);
        float dist = abs(e - 1.0) * fast::min(w, h);
        if ((dist > 0.119999997317790985107421875) || (alt < (-0.00999999977648258209228515625)))
        {
            continue;
        }
        float along = precise::atan2(uv.y, uv.x);
        float2 param_6 = float2((along * 6.0) - ((t * 0.60000002384185791015625) * (1.0 + level0)), (e * 14.0) + (float(k) * 3.0));
        int param_7 = 3;
        float _754 = fbm(param_6, param_7);
        float strands = _754;
        float thick = 0.00999999977648258209228515625 + (0.0199999995529651641845703125 * level0);
        float glowing = (exp((-dist) / thick) * (0.1500000059604644775390625 + (((2.2000000476837158203125 * strands) * strands) * strands))) + (0.0500000007450580596923828125 * exp((-dist) / (thick * 5.0)));
        light += (((_197.uPlasma * glowing) * ((0.4000000059604644775390625 + (1.39999997615814208984375 * level0)) + (2.0 * boost))) * smoothstep(-0.00999999977648258209228515625, 0.00999999977648258209228515625, alt));
    }
    col += light;
    col += (((mix(_197.uCorona, float3(1.0), float3(0.5)) * flare) * 0.699999988079071044921875) * exp((-length(p - foot)) * 6.0));
    fragColor = float4(float3(1.0) - exp((-col) * 1.39999997615814208984375), 1.0);
}

fragment flair_solar_prominence_frag_out flair_solar_prominence_frag(constant FlairUniforms& _197 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_solar_prominence_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _847;
    if (_197.flair_flipY > 0.5)
    {
        _847 = _197.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _847 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _847);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _197);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

