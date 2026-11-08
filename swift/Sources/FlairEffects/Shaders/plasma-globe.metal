// flair-metal-hash: f76c3c19
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
    int uFilaments;
    float uJag;
    float uTouch;
    float3 uFilament;
    float3 uCore;
    float3 uGlass;
    packed_float3 uBackground;
    uint uDemo;
    float uBackgroundAlpha;
};

struct flair_plasma_globe_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool soundDemo(constant FlairUniforms& _153)
{
    bool _158 = _153.uDemo != 0u;
    bool _166;
    if (_158)
    {
        _166 = _153.iBeat == 0.0;
    }
    else
    {
        _166 = _158;
    }
    bool _177;
    if (_166)
    {
        _177 = dot(_153.iAudio, _153.iAudio) == 0.0;
    }
    else
    {
        _177 = _166;
    }
    return _177;
}

static inline __attribute__((always_inline))
float demoKick(constant FlairUniforms& _153)
{
    return exp((-mod(_153.iTime, 0.5)) * 7.0);
}

static inline __attribute__((always_inline))
float demoHat(constant FlairUniforms& _153)
{
    return exp((-mod(_153.iTime + 0.25, 0.5)) * 16.0);
}

static inline __attribute__((always_inline))
float4 sound(constant FlairUniforms& _153)
{
    if (!soundDemo(_153))
    {
        return _153.iAudio;
    }
    float k = demoKick(_153);
    float mid = (0.4000000059604644775390625 + (0.119999997317790985107421875 * sin(_153.iTime * 1.7000000476837158203125))) + (0.100000001490116119384765625 * sin(_153.iTime * 3.099999904632568359375));
    return float4((0.449999988079071044921875 + (0.300000011920928955078125 * k)) + (0.100000001490116119384765625 * mid), 0.300000011920928955078125 + (0.64999997615814208984375 * k), mid, (0.25 + (0.4000000059604644775390625 * demoHat(_153))) + (0.07999999821186065673828125 * sin(_153.iTime * 5.30000019073486328125)));
}

static inline __attribute__((always_inline))
float beat(constant FlairUniforms& _153)
{
    float _257;
    if (soundDemo(_153))
    {
        _257 = mod(_153.iTime, 0.5);
    }
    else
    {
        _257 = _153.iBeat;
    }
    return _257;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float spectrum(thread float& x, constant FlairUniforms& _153)
{
    x = fast::clamp(x, 0.0, 1.0);
    if (soundDemo(_153))
    {
        float tilt = 0.800000011920928955078125 - (0.5 * x);
        float wander = ((0.60000002384185791015625 + (0.25 * sin((_153.iTime * 0.699999988079071044921875) + (x * 5.0)))) + (0.100000001490116119384765625 * sin((x * 23.0) + (_153.iTime * 2.2999999523162841796875)))) + (0.070000000298023223876953125 * sin((x * 47.0) - (_153.iTime * 3.7000000476837158203125)));
        return fast::clamp(((tilt * wander) + ((0.550000011920928955078125 * demoKick(_153)) * exp((-x) * 7.0))) + ((0.3499999940395355224609375 * demoHat(_153)) * smoothstep(0.550000011920928955078125, 0.89999997615814208984375, x)), 0.0, 1.0);
    }
    float f = x * 63.0;
    int i = int(f);
    int j = min((i + 1), 63);
    return mix(_153.iSpectrum[i / 4][spvSMod(i, 4)], _153.iSpectrum[j / 4][spvSMod(j, 4)], f - float(i));
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
float turn(thread const float& a)
{
    return mod(a + 3.1415927410125732421875, 6.283185482025146484375) - 3.1415927410125732421875;
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _153)
{
    float px = 1.0 / _153.iResolution[1u];
    float2 p = ((fragCoord - (float2(_153.iResolution[0], _153.iResolution[1]) * 0.5)) * px) - float2(0.0, 0.0500000007450580596923828125);
    float4 s = sound(_153);
    float b = beat(_153);
    float t = _153.iTime;
    float R = 0.36000001430511474609375;
    float r = length(p);
    float ang = precise::atan2(p.y, p.x);
    float3 col = float3(_153.uBackground) * (1.0 - (0.4000000059604644775390625 * length(p)));
    float y = ((p.y + R) + 0.20000000298023223876953125) / 0.20000000298023223876953125;
    float stand = (step(0.0, y) * step(y, 1.0)) * step(abs(p.x), 0.100000001490116119384765625 + (0.0500000007450580596923828125 * (1.0 - y)));
    col = mix(col, float3(0.0599999986588954925537109375, 0.0599999986588954925537109375, 0.07999999821186065673828125) * (1.0 + (0.60000002384185791015625 * smoothstep(0.100000001490116119384765625, -0.100000001490116119384765625, p.x))), float3(stand));
    float2 param = float2(floor((t - fast::max(b, 0.0)) * 8.0), 1.7000000476837158203125);
    float touchA = ((hash12(param) - 0.5) * 2.0) * 3.1415927410125732421875;
    float _476;
    if (b >= 0.0)
    {
        _476 = _153.uTouch * exp((-b) * 2.5);
    }
    else
    {
        _476 = 0.0;
    }
    float pull = _476;
    float3 light = float3(0.0);
    if (r < R)
    {
        for (int k = 0; k < 16; k++)
        {
            if (k >= _153.uFilaments)
            {
                break;
            }
            float fk = float(k);
            float param_1 = (fk + 0.5) / float(_153.uFilaments);
            float _526 = spectrum(param_1, _153);
            float level0 = _526;
            float2 param_2 = float2(t * 0.25, fk * 7.0);
            float base = ((6.283185482025146484375 * (fk + (0.300000011920928955078125 * vnoise(param_2)))) / float(_153.uFilaments)) + (0.20000000298023223876953125 * sin((t * 0.300000011920928955078125) + (fk * 1.2999999523162841796875)));
            float param_3 = touchA - base;
            float toTouch = turn(param_3);
            base += (((toTouch * pull) * smoothstep(0.1500000059604644775390625, 1.0, r / R)) * smoothstep(2.0, 0.60000002384185791015625, abs(toTouch)));
            float2 param_4 = float2((r * 14.0) - (t * 2.0), fk * 5.099999904632568359375);
            float2 param_5 = float2((r * 70.0) - (t * 11.0), fk * 2.2999999523162841796875);
            float2 param_6 = float2((r * 180.0) - (t * 23.0), fk * 9.69999980926513671875);
            float jag = (((vnoise(param_4) - 0.5) * 0.3499999940395355224609375) + (((vnoise(param_5) - 0.5) * 0.2199999988079071044921875) * (0.4000000059604644775390625 + s.w))) + (((vnoise(param_6) - 0.5) * 0.100000001490116119384765625) * (0.300000011920928955078125 + s.w));
            float a = base + ((jag * _153.uJag) * (r / R));
            float param_7 = ang - a;
            float dist = abs(turn(param_7)) * r;
            float width = 0.00200000009499490261077880859375 + (0.0040000001899898052215576171875 * level0);
            float core = exp((-dist) / width);
            float halo = 0.300000011920928955078125 * exp((-dist) / (width * 7.0));
            light += (((mix(_153.uFilament, _153.uCore, float3(core * 0.60000002384185791015625)) * (core + halo)) * ((0.300000011920928955078125 + (1.39999997615814208984375 * level0)) + pull)) * smoothstep(0.0199999995529651641845703125, 0.070000000298023223876953125, r));
            float2 param_8 = float2((R * 14.0) - (t * 2.0), fk * 5.099999904632568359375);
            float end = base + (((vnoise(param_8) - 0.5) * 0.3499999940395355224609375) * _153.uJag);
            light += (((_153.uFilament * (0.300000011920928955078125 + level0)) * 0.5) * exp((-length(p - (float2(cos(end), sin(end)) * R))) / 0.014999999664723873138427734375));
        }
        light += ((_153.uCore * (0.5 + s.x)) * (exp((-r) / 0.0199999995529651641845703125) + (0.300000011920928955078125 * exp((-r) / 0.07999999821186065673828125))));
        light += (_153.uGlass * 0.039999999105930328369140625);
    }
    light += (((float3(1.0) * pull) * 0.800000011920928955078125) * exp((-length(p - (float2(cos(touchA), sin(touchA)) * R))) / 0.0199999995529651641845703125));
    float rim = (exp((-abs(r - R)) / 0.0040000001899898052215576171875) * 0.3499999940395355224609375) + ((exp((-fast::max(r - R, 0.0)) / 0.02999999932944774627685546875) * 0.039999999105930328369140625) * step(R, r));
    float2 hl = (p - float2(-0.14000000059604644775390625, 0.17000000178813934326171875)) / float2(0.07999999821186065673828125, 0.0350000001490116119384765625);
    float highlight = (exp((-dot(hl, hl)) * 2.0) * 0.180000007152557373046875) * step(r, R);
    col += ((light + (_153.uGlass * rim)) + float3(highlight));
    fragColor = float4(float3(1.0) - exp((-col) * 1.5), 1.0);
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
    float3 _895;
    if (a > 0.0)
    {
        _895 = bg + (d / float3(a));
    }
    else
    {
        _895 = bg;
    }
    float3 fg = _895;
    float alpha = a + (opacity * (1.0 - a));
    float3 _917;
    if (alpha > 0.0)
    {
        _917 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _917 = bg;
    }
    float3 col = _917;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _153)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _153);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_153.uBackground);
    float param_4 = _153.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_plasma_globe_frag_out flair_plasma_globe_frag(constant FlairUniforms& _153 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_plasma_globe_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _974;
    if (_153.flair_flipY > 0.5)
    {
        _974 = _153.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _974 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _974);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _153);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

