// flair-metal-hash: 33ee5448
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
    float uSpin;
    float uTilt;
    float uField;
    float uBeam;
    float uFlash;
    float3 uStar;
    float3 uFieldColor;
    float3 uBeamColor;
    packed_float3 uSpace;
    uint uDemo;
};

struct flair_pulsar_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool soundDemo(constant FlairUniforms& _150)
{
    bool _155 = _150.uDemo != 0u;
    bool _163;
    if (_155)
    {
        _163 = _150.iBeat == 0.0;
    }
    else
    {
        _163 = _155;
    }
    bool _174;
    if (_163)
    {
        _174 = dot(_150.iAudio, _150.iAudio) == 0.0;
    }
    else
    {
        _174 = _163;
    }
    return _174;
}

static inline __attribute__((always_inline))
float demoKick(constant FlairUniforms& _150)
{
    return exp((-mod(_150.iTime, 0.5)) * 7.0);
}

static inline __attribute__((always_inline))
float demoHat(constant FlairUniforms& _150)
{
    return exp((-mod(_150.iTime + 0.25, 0.5)) * 16.0);
}

static inline __attribute__((always_inline))
float4 sound(constant FlairUniforms& _150)
{
    if (!soundDemo(_150))
    {
        return _150.iAudio;
    }
    float k = demoKick(_150);
    float mid = (0.4000000059604644775390625 + (0.119999997317790985107421875 * sin(_150.iTime * 1.7000000476837158203125))) + (0.100000001490116119384765625 * sin(_150.iTime * 3.099999904632568359375));
    return float4((0.449999988079071044921875 + (0.300000011920928955078125 * k)) + (0.100000001490116119384765625 * mid), 0.300000011920928955078125 + (0.64999997615814208984375 * k), mid, (0.25 + (0.4000000059604644775390625 * demoHat(_150))) + (0.07999999821186065673828125 * sin(_150.iTime * 5.30000019073486328125)));
}

static inline __attribute__((always_inline))
float beat(constant FlairUniforms& _150)
{
    float _254;
    if (soundDemo(_150))
    {
        _254 = mod(_150.iTime, 0.5);
    }
    else
    {
        _254 = _150.iBeat;
    }
    return _254;
}

static inline __attribute__((always_inline))
float3 across(thread const float3& v)
{
    float3 _394;
    if (abs(v.y) < 0.89999997615814208984375)
    {
        _394 = cross(v, float3(0.0, 1.0, 0.0));
    }
    else
    {
        _394 = cross(v, float3(1.0, 0.0, 0.0));
    }
    return fast::normalize(_394);
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
float spectrum(thread float& x, constant FlairUniforms& _150)
{
    x = fast::clamp(x, 0.0, 1.0);
    if (soundDemo(_150))
    {
        float tilt = 0.800000011920928955078125 - (0.5 * x);
        float wander = ((0.60000002384185791015625 + (0.25 * sin((_150.iTime * 0.699999988079071044921875) + (x * 5.0)))) + (0.100000001490116119384765625 * sin((x * 23.0) + (_150.iTime * 2.2999999523162841796875)))) + (0.070000000298023223876953125 * sin((x * 47.0) - (_150.iTime * 3.7000000476837158203125)));
        return fast::clamp(((tilt * wander) + ((0.550000011920928955078125 * demoKick(_150)) * exp((-x) * 7.0))) + ((0.3499999940395355224609375 * demoHat(_150)) * smoothstep(0.550000011920928955078125, 0.89999997615814208984375, x)), 0.0, 1.0);
    }
    float f = x * 63.0;
    int i = int(f);
    int j = min((i + 1), 63);
    return mix(_150.iSpectrum[i / 4][spvSMod(i, 4)], _150.iSpectrum[j / 4][spvSMod(j, 4)], f - float(i));
}

static inline __attribute__((always_inline))
float segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 ab = b - a;
    return length((p - a) - (ab * fast::clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _150)
{
    float2 p = (fragCoord - (float2(_150.iResolution[0], _150.iResolution[1]) * 0.5)) / float2(_150.iResolution[1u]);
    float4 s = sound(_150);
    float b = beat(_150);
    float _428;
    if (b >= 0.0)
    {
        _428 = exp((-b) * 5.0);
    }
    else
    {
        _428 = 0.0;
    }
    float hit = _428;
    float3 axis = float3(0.185495555400848388671875, 0.927477777004241943359375, 0.3246172368526458740234375);
    float3 param = axis;
    float3 e1 = across(param);
    float3 e2 = cross(axis, e1);
    float phase = ((_150.iTime * _150.uSpin) * 2.0) + (0.60000002384185791015625 * s.y);
    float3 m = (axis * cos(_150.uTilt)) + (((e1 * cos(phase)) + (e2 * sin(phase))) * sin(_150.uTilt));
    float3 param_1 = m;
    float3 f1 = across(param_1);
    float3 f2 = cross(m, f1);
    float2 bent = p + ((fast::normalize(p + float2(9.9999997473787516355514526367188e-06)) * 0.00150000001303851604461669921875) / float2(fast::max(dot(p, p), 0.00999999977648258209228515625)));
    float2 param_2 = (bent * 3.0) + float2(4.0);
    float2 param_3 = bent * 7.0;
    float3 col = float3(_150.uSpace) + (((_150.uFieldColor * 0.0599999986588954925537109375) * vnoise(param_2)) * vnoise(param_3));
    float2 cell = floor(bent * 260.0);
    float2 param_4 = cell;
    float2 param_5 = cell + float2(3.0);
    col += ((float3(0.85000002384185791015625, 0.89999997615814208984375, 1.0) * step(0.995999991893768310546875, hash12(param_4))) * (0.60000002384185791015625 + (0.4000000059604644775390625 * sin((_150.iTime * 3.0) + (hash12(param_5) * 50.0)))));
    float3 light = float3(0.0);
    for (int j = 0; j < 16; j++)
    {
        float param_6 = float(j) / 15.0;
        float _578 = spectrum(param_6, _150);
        float level0 = _578;
        float psi = ((6.283185482025146484375 * float(j / 2)) / 8.0) + (0.20000000298023223876953125 * float(spvSMod(j, 2)));
        float L = ((spvSMod(j, 2) == 0) ? 0.319999992847442626953125 : 0.180000007152557373046875) * (0.550000011920928955078125 + ((0.89999997615814208984375 * level0) * _150.uField));
        if (length(p) > (L + 0.0599999986588954925537109375))
        {
            continue;
        }
        float3 side = (f1 * cos(psi)) + (f2 * sin(psi));
        float best = 1000.0;
        float2 prev = float2(0.0);
        for (int i = 0; i <= 22; i++)
        {
            float th = (3.1415927410125732421875 * float(i)) / 22.0;
            float sn = sin(th);
            float2 q = (((side * sn) + (m * cos(th))) * ((L * sn) * sn)).xy;
            if (i > 0)
            {
                float2 param_7 = p;
                float2 param_8 = prev;
                float2 param_9 = q;
                best = fast::min(best, segment(param_7, param_8, param_9));
            }
            prev = q;
        }
        light += ((((float3(0.800000011920928955078125) * exp((-best) / 0.00200000009499490261077880859375)) + (_150.uFieldColor * ((0.60000002384185791015625 * exp((-best) / 0.0040000001899898052215576171875)) + (0.3499999940395355224609375 * exp((-best) / 0.0199999995529651641845703125))))) * (0.1500000059604644775390625 + (1.2000000476837158203125 * level0))) * _150.uField);
    }
    float facing = abs(m.z);
    float2 _733;
    for (int k = 0; k < 2; k++)
    {
        if (k == 0)
        {
            _733 = m.xy;
        }
        else
        {
            _733 = -m.xy;
        }
        float2 dir = _733;
        float len = length(dir);
        if (len < 0.001000000047497451305389404296875)
        {
            continue;
        }
        dir /= float2(len);
        float along = dot(p, dir);
        float perp = abs(dot(p, float2(-dir.y, dir.x)));
        float width = 0.008000000379979610443115234375 + ((along * 0.119999997317790985107421875) * (1.0 - (0.5 * len)));
        if (along > 0.0)
        {
            light += ((((_150.uBeamColor * exp((-perp) / width)) * exp((-along) * 1.2000000476837158203125)) * _150.uBeam) * (0.60000002384185791015625 + (0.800000011920928955078125 * s.x)));
        }
    }
    float flash = (powr(facing, 24.0) * _150.uBeam) + ((0.60000002384185791015625 * hit) * _150.uFlash);
    light += ((_150.uBeamColor * flash) * ((0.60000002384185791015625 * exp((-length(p)) * 4.0)) + 0.0500000007450580596923828125));
    float r = length(p);
    light += ((_150.uStar * ((exp((-r) / 0.01200000010430812835693359375) * 2.0) + (0.4000000059604644775390625 * exp((-r) / 0.0500000007450580596923828125)))) * (0.800000011920928955078125 + (0.4000000059604644775390625 * s.x)));
    col += light;
    fragColor = float4(float3(1.0) - exp((-col) * 1.2999999523162841796875), 1.0);
}

fragment flair_pulsar_frag_out flair_pulsar_frag(constant FlairUniforms& _150 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_pulsar_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _890;
    if (_150.flair_flipY > 0.5)
    {
        _890 = _150.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _890 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _890);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _150);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

