// flair-metal-hash: 2e931733
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

// Implementation of signed integer mod accurate to SPIR-V specification
template<typename Tx, typename Ty>
inline Tx spvSMod(Tx x, Ty y)
{
    Tx remainder = x - y * (x / y);
    return select(Tx(remainder + y), remainder, remainder == 0 || (x >= 0) == (y >= 0));
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
    float uSize;
    int uRings;
    float uSpacing;
    float uTilt;
    float uSpin;
    float uReact;
    float uFlash;
    float uMotes;
    float3 uRune;
    float3 uArcane;
    float3 uWisp;
    packed_float3 uNight;
    uint uDemo;
};

constant spvUnsafeArray<float2, 16> _514 = spvUnsafeArray<float2, 16>({ float2(0.17678000032901763916015625, 0.0), float2(-0.22576999664306640625, 0.2068299949169158935546875), float2(0.0345599986612796783447265625, -0.3937700092792510986328125), float2(0.2845700085163116455078125, 0.3711700141429901123046875), float2(-0.52222001552581787109375, -0.0923700034618377685546875), float2(0.494690001010894775390625, -0.31468999385833740234375), float2(-0.1654500067234039306640625, 0.6155300140380859375), float2(-0.31558001041412353515625, -0.607590019702911376953125), float2(0.684650003910064697265625, 0.250010013580322265625), float2(-0.7122499942779541015625, 0.294030010700225830078125), float2(0.3433299958705902099609375, -0.73373997211456298828125), float2(0.2537600100040435791015625, 0.80892002582550048828125), float2(-0.76476001739501953125, -0.443159997463226318359375), float2(0.89713001251220703125, -0.1972700059413909912109375), float2(-0.54746997356414794921875, 0.77880001068115234375), float2(-0.12653000652790069580078125, -0.976080000400543212890625) });
constant spvUnsafeArray<float2, 10> _1899 = spvUnsafeArray<float2, 10>({ float2(0.22360999882221221923828125, 0.0), float2(-0.2855800092220306396484375, 0.261619985103607177734375), float2(0.043710000813007354736328125, -0.4980899989604949951171875), float2(0.3599599897861480712890625, 0.469500005245208740234375), float2(-0.66057002544403076171875, -0.116839997470378875732421875), float2(0.625739991664886474609375, -0.3980599939823150634765625), float2(-0.20927999913692474365234375, 0.778590023517608642578125), float2(-0.3991700112819671630859375, -0.76854002475738525390625), float2(0.866020023822784423828125, 0.316240012645721435546875), float2(-0.900929987430572509765625, 0.37191998958587646484375) });

struct flair_arcane_sigil_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
void setKey(thread const float& tolerance, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _316, thread float4& gMaskPlace)
{
    gKeyTolerance = tolerance;
    float4 c = uMask.sample(uMaskSmplr, float2(0.00999999977648258209228515625, 0.9900000095367431640625), level(0.0));
    gKeyColour = c.xyz / float3(fast::max(c.w, 0.001000000047497451305389404296875));
    float2 size = float2(int2(uMask.get_width(), uMask.get_height()));
    float aspect = size.x / size.y;
    float h = fast::min(_316.uSize, ((_316.iResolution[0u] / _316.iResolution[1u]) * _316.uSize) / aspect);
    gMaskPlace = float4(1.0 / (h * aspect), 1.0 / h, size.y / h, float(size.x > 1.0));
}

static inline __attribute__((always_inline))
bool soundDemo(constant FlairUniforms& _316)
{
    bool _574 = _316.uDemo != 0u;
    bool _581;
    if (_574)
    {
        _581 = _316.iBeat == 0.0;
    }
    else
    {
        _581 = _574;
    }
    bool _592;
    if (_581)
    {
        _592 = dot(_316.iAudio, _316.iAudio) == 0.0;
    }
    else
    {
        _592 = _581;
    }
    return _592;
}

static inline __attribute__((always_inline))
float demoKick(constant FlairUniforms& _316)
{
    return exp((-mod(_316.iTime, 0.5)) * 7.0);
}

static inline __attribute__((always_inline))
float demoHat(constant FlairUniforms& _316)
{
    return exp((-mod(_316.iTime + 0.25, 0.5)) * 16.0);
}

static inline __attribute__((always_inline))
float4 sound(constant FlairUniforms& _316)
{
    if (!soundDemo(_316))
    {
        return _316.iAudio;
    }
    float k = demoKick(_316);
    float mid = (0.4000000059604644775390625 + (0.119999997317790985107421875 * sin(_316.iTime * 1.7000000476837158203125))) + (0.100000001490116119384765625 * sin(_316.iTime * 3.099999904632568359375));
    return float4((0.449999988079071044921875 + (0.300000011920928955078125 * k)) + (0.100000001490116119384765625 * mid), 0.300000011920928955078125 + (0.64999997615814208984375 * k), mid, (0.25 + (0.4000000059604644775390625 * demoHat(_316))) + (0.07999999821186065673828125 * sin(_316.iTime * 5.30000019073486328125)));
}

static inline __attribute__((always_inline))
float beat(constant FlairUniforms& _316)
{
    float _666;
    if (soundDemo(_316))
    {
        _666 = mod(_316.iTime, 0.5);
    }
    else
    {
        _666 = _316.iBeat;
    }
    return _666;
}

static inline __attribute__((always_inline))
float farReach(thread const float2& q, texture2d<float> uMask, sampler uMaskSmplr, thread float4& gMaskPlace)
{
    float2 full = float2(int2(uMask.get_width(), uMask.get_height()));
    int lod = int(ceil(0.5 * log2(fast::max((full.x * full.y) / 64.0, 1.0))));
    int2 size = int2(uMask.get_width(lod), uMask.get_height(lod));
    float2 texel = float2(1.0) / (float2(size) * gMaskPlace.xy);
    float radius = fast::min(texel.x, texel.y);
    float k = 0.1500000059604644775390625 * radius;
    float best = 1000.0;
    float weight = 0.0;
    for (int y = 0; y < 64; y++)
    {
        if (y >= size.y)
        {
            break;
        }
        for (int x = 0; x < 64; x++)
        {
            if (x >= size.x)
            {
                break;
            }
            float a = uMask.read(uint2(int2(x, y)), lod).w;
            if (a < 0.02999999932944774627685546875)
            {
                continue;
            }
            float2 centre = (((float2(float(x), float(y)) + float2(0.5)) / float2(size)) - float2(0.5)) / gMaskPlace.xy;
            float d = length(q - centre) - (radius * sqrt(a));
            if (d < best)
            {
                weight = (weight * exp((d - best) / k)) + 1.0;
                best = d;
            }
            else
            {
                weight += exp((best - d) / k);
            }
        }
    }
    float _997;
    if (weight > 0.0)
    {
        _997 = fast::max((best - (k * log(weight))) + (0.439999997615814208984375 * radius), 0.0);
    }
    else
    {
        _997 = 1.0;
    }
    return _997;
}

static inline __attribute__((always_inline))
float shapeLod(thread const float2& p, thread const float& lod, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, thread float4& gMaskPlace)
{
    float2 uv = (p * gMaskPlace.xy) + float2(0.5);
    bool _358 = uv.x < 0.0;
    bool _365;
    if (!_358)
    {
        _365 = uv.x > 1.0;
    }
    else
    {
        _365 = _358;
    }
    bool _372;
    if (!_365)
    {
        _372 = uv.y < 0.0;
    }
    else
    {
        _372 = _365;
    }
    bool _379;
    if (!_372)
    {
        _379 = uv.y > 1.0;
    }
    else
    {
        _379 = _372;
    }
    if (_379)
    {
        return 0.0;
    }
    float4 c = uMask.sample(uMaskSmplr, uv, level(lod));
    float a = c.w;
    if (gKeyTolerance > 0.0)
    {
        float away = distance(c.xyz / float3(fast::max(c.w, 0.001000000047497451305389404296875)), gKeyColour);
        a *= smoothstep(gKeyTolerance, gKeyTolerance + 0.119999997317790985107421875, away);
    }
    return a;
}

static inline __attribute__((always_inline))
float shapeAt(thread const float2& p, thread const float& blur, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _316, thread float4& gMaskPlace)
{
    if (gMaskPlace.w < 0.5)
    {
        float d = length(p) - (0.300000011920928955078125 * _316.uSize);
        return fast::clamp(0.5 - (d / fast::max(blur, 0.0040000001899898052215576171875)), 0.0, 1.0);
    }
    float2 param = p;
    float param_1 = log2(fast::max(blur * gMaskPlace.z, 1.0));
    return shapeLod(param, param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, gMaskPlace);
}

static inline __attribute__((always_inline))
float coverage(thread const float2& p, thread const float& radius, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _316, thread float4& gMaskPlace)
{
    float sum = 0.0;
    if (gMaskPlace.w < 0.5)
    {
        for (int i = 0; i < 16; i++)
        {
            float2 param = p + (_514[i] * radius);
            float param_1 = radius * 0.4000000059604644775390625;
            sum += shapeAt(param, param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _316, gMaskPlace);
        }
    }
    else
    {
        float lod = log2(fast::max((radius * 0.4000000059604644775390625) * gMaskPlace.z, 1.0));
        for (int i_1 = 0; i_1 < 16; i_1++)
        {
            float2 param_2 = p + (_514[i_1] * radius);
            float param_3 = lod;
            sum += shapeLod(param_2, param_3, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, gMaskPlace);
        }
    }
    return sum / 16.0;
}

static inline __attribute__((always_inline))
float nearReach(thread const float2& q, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _316, thread float4& gMaskPlace)
{
    float r0 = 0.0;
    float2 param = q;
    float param_1 = 0.0030000000260770320892333984375;
    float c0 = shapeAt(param, param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _316, gMaskPlace);
    if (c0 >= 0.0199999995529651641845703125)
    {
        return 0.0;
    }
    float r = 0.008000000379979610443115234375;
    for (int i = 0; i < 7; i++)
    {
        float2 param_2 = q;
        float param_3 = r;
        float c = coverage(param_2, param_3, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _316, gMaskPlace);
        if (c >= 0.0199999995529651641845703125)
        {
            return 0.89999997615814208984375 * mix(r0, r, (0.0199999995529651641845703125 - c0) / fast::max(c - c0, 9.9999997473787516355514526367188e-05));
        }
        r0 = r;
        c0 = c;
        r *= 1.5;
    }
    return 0.89999997615814208984375 * r0;
}

static inline __attribute__((always_inline))
float reach(thread const float2& q, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _316, thread float4& gMaskPlace)
{
    if (gMaskPlace.w < 0.5)
    {
        return fast::max(length(q) - (0.300000011920928955078125 * _316.uSize), 0.0);
    }
    float2 param = q;
    float far = farReach(param, uMask, uMaskSmplr, gMaskPlace);
    if (far > 0.119999997317790985107421875)
    {
        return far;
    }
    float2 param_1 = q;
    float near = nearReach(param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _316, gMaskPlace);
    return mix(near, far, smoothstep(0.039999999105930328369140625, 0.070000000298023223876953125, near));
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
float spectrum(thread float& x, constant FlairUniforms& _316)
{
    x = fast::clamp(x, 0.0, 1.0);
    if (soundDemo(_316))
    {
        float tilt = 0.800000011920928955078125 - (0.5 * x);
        float wander = ((0.60000002384185791015625 + (0.25 * sin((_316.iTime * 0.699999988079071044921875) + (x * 5.0)))) + (0.100000001490116119384765625 * sin((x * 23.0) + (_316.iTime * 2.2999999523162841796875)))) + (0.070000000298023223876953125 * sin((x * 47.0) - (_316.iTime * 3.7000000476837158203125)));
        return fast::clamp(((tilt * wander) + ((0.550000011920928955078125 * demoKick(_316)) * exp((-x) * 7.0))) + ((0.3499999940395355224609375 * demoHat(_316)) * smoothstep(0.550000011920928955078125, 0.89999997615814208984375, x)), 0.0, 1.0);
    }
    float f = x * 63.0;
    int i = int(f);
    int j = min((i + 1), 63);
    return mix(_316.iSpectrum[i / 4][spvSMod(i, 4)], _316.iSpectrum[j / 4][spvSMod(j, 4)], f - float(i));
}

static inline __attribute__((always_inline))
float segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 ab = b - a;
    return length((p - a) - (ab * fast::clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0)));
}

static inline __attribute__((always_inline))
float rune(thread const float2& uv, thread const float& h)
{
    float2 param = uv;
    float2 param_1 = float2(0.5, 0.119999997317790985107421875);
    float2 param_2 = float2(0.5, 0.87999999523162841796875);
    float d = segment(param, param_1, param_2);
    if (fract(h * 2.0) > 0.5)
    {
        float2 param_3 = uv;
        float2 param_4 = float2(0.5, 0.87999999523162841796875);
        float2 param_5 = float2(0.819999992847442626953125, 0.62000000476837158203125);
        d = fast::min(d, segment(param_3, param_4, param_5));
    }
    if (fract(h * 4.0) > 0.5)
    {
        float2 param_6 = uv;
        float2 param_7 = float2(0.5, 0.62000000476837158203125);
        float2 param_8 = float2(0.180000007152557373046875, 0.4199999868869781494140625);
        d = fast::min(d, segment(param_6, param_7, param_8));
    }
    if (fract(h * 8.0) > 0.5)
    {
        float2 param_9 = uv;
        float2 param_10 = float2(0.5, 0.37999999523162841796875);
        float2 param_11 = float2(0.819999992847442626953125, 0.119999997317790985107421875);
        d = fast::min(d, segment(param_9, param_10, param_11));
    }
    if (fract(h * 16.0) > 0.5)
    {
        float2 param_12 = uv;
        float2 param_13 = float2(0.5, 0.87999999523162841796875);
        float2 param_14 = float2(0.180000007152557373046875, 0.62000000476837158203125);
        d = fast::min(d, segment(param_12, param_13, param_14));
    }
    if (fract(h * 32.0) > 0.550000011920928955078125)
    {
        float2 param_15 = uv;
        float2 param_16 = float2(0.180000007152557373046875, 0.550000011920928955078125);
        float2 param_17 = float2(0.819999992847442626953125, 0.3499999940395355224609375);
        d = fast::min(d, segment(param_15, param_16, param_17));
    }
    return d;
}

static inline __attribute__((always_inline))
float runeBand(thread const float& d, thread const float& mid, thread const float& hw, thread const float2& q, thread const float& turn, thread const float& count, thread const float& seed, constant FlairUniforms& _316)
{
    float lines = exp(-powr((abs(d - mid) - (hw * 1.25)) / 0.00179999996908009052276611328125, 2.0));
    float v = (d - (mid - hw)) / (2.0 * hw);
    if ((v < 0.0) || (v > 1.0))
    {
        return lines;
    }
    float a = fract((precise::atan2(q.y, q.x) / 6.283185482025146484375) + turn);
    float cell = floor(a * count);
    float2 uv = float2(((fract(a * count) - 0.5) / 0.60000002384185791015625) + 0.5, v);
    bool _1226 = uv.x < 0.0;
    bool _1233;
    if (!_1226)
    {
        _1233 = uv.x > 1.0;
    }
    else
    {
        _1233 = _1226;
    }
    if (_1233)
    {
        return lines;
    }
    float2 param = float2(cell, seed);
    float h = hash12(param);
    float2 param_1 = uv;
    float param_2 = h;
    float r = rune(param_1, param_2);
    float stroke = smoothstep(0.0900000035762786865234375, 0.039999999105930328369140625, r) + (0.3499999940395355224609375 * exp((-r) / 0.119999997317790985107421875));
    return lines + (stroke * (0.699999988079071044921875 + (0.300000011920928955078125 * sin((_316.iTime * 2.0) + (h * 40.0)))));
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _316, thread float4& gMaskPlace)
{
    float param = 0.0;
    setKey(param, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _316, gMaskPlace);
    float px = 1.0 / _316.iResolution[1u];
    float2 p = (fragCoord - (float2(_316.iResolution[0], _316.iResolution[1]) * 0.5)) * px;
    float4 s = sound(_316);
    float b = beat(_316);
    float _1299;
    if (b >= 0.0)
    {
        _1299 = exp((-b) * 5.0);
    }
    else
    {
        _1299 = 0.0;
    }
    float hit = _1299;
    float t = _316.iTime;
    float n = float(_316.uRings);
    float2 param_1 = p;
    float dp = reach(param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _316, gMaskPlace);
    float sT = sin(radians(_316.uTilt));
    float2 q = float2(p.x, p.y / sT);
    float orbitMid = 0.0350000001490116119384765625 + (_316.uSpacing * (n + 0.800000011920928955078125));
    float _1348;
    if (abs(q.y) < 0.60000002384185791015625)
    {
        float2 param_2 = q;
        _1348 = reach(param_2, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _316, gMaskPlace);
    }
    else
    {
        _1348 = 1.0;
    }
    float dq = _1348;
    float2 param_3 = (p * 2.5) + float2(t * 0.0199999995529651641845703125, 0.0);
    int param_4 = 4;
    float _1379 = fbm(param_3, param_4);
    float3 col = (float3(_316.uNight) * (1.2000000476837158203125 - (0.60000002384185791015625 * length(p)))) + ((_316.uArcane * 0.07999999821186065673828125) * _1379);
    float2 param_5 = floor(fragCoord / float2(2.0));
    float star = hash12(param_5);
    col += ((float3(0.89999997615814208984375, 0.85000002384185791015625, 1.0) * step(0.9969999790191650390625, star)) * (0.5 + (0.5 * sin((t * 3.0) + (star * 70.0)))));
    float2 param_6 = (p * 2.0) - float2(t * 0.100000001490116119384765625);
    int param_7 = 3;
    float _1430 = fbm(param_6, param_7);
    float2 param_8 = ((p * 3.5) + float2(0.300000011920928955078125 * sin(t * 0.20000000298023223876953125), (-t) * 0.3499999940395355224609375)) + float2(_1430);
    int param_9 = 4;
    float _1435 = fbm(param_8, param_9);
    float wisp = _1435;
    col += ((((_316.uWisp * powr(wisp, 3.0)) * 2.5) * exp((-dp) / 0.0900000035762786865234375)) * (0.4000000059604644775390625 + (0.89999997615814208984375 * s.y)));
    float k = floor((dp - 0.0350000001490116119384765625) / _316.uSpacing);
    if ((k >= 0.0) && (k < n))
    {
        float x = (k + 0.5) / n;
        float param_10 = 1.0 - x;
        float _1479 = spectrum(param_10, _316);
        float level0 = _1479 * _316.uReact;
        float _1487;
        if (b >= 0.0)
        {
            _1487 = (exp(-powr((x - (b * 1.39999997615814208984375)) / 0.1500000059604644775390625, 2.0)) * exp((-b) * 1.5)) * _316.uFlash;
        }
        else
        {
            _1487 = 0.0;
        }
        float pulse = _1487;
        float dir = (mod(k, 2.0) < 0.5) ? 1.0 : (-1.0);
        float param_11 = dp;
        float param_12 = 0.0350000001490116119384765625 + ((k + 0.5) * _316.uSpacing);
        float param_13 = _316.uSpacing * 0.300000011920928955078125;
        float2 param_14 = p;
        float param_15 = (((dir * t) * _316.uSpin) * 0.02999999932944774627685546875) / (1.0 + (0.300000011920928955078125 * k));
        float param_16 = floor(18.0 + (10.0 * k));
        float param_17 = k + 1.0;
        float band = runeBand(param_11, param_12, param_13, param_14, param_15, param_16, param_17, _316);
        col += ((mix(_316.uRune, float3(1.0), float3(0.300000011920928955078125 * pulse)) * band) * ((0.25 + (1.2999999523162841796875 * level0)) + (1.5 * pulse)));
    }
    for (int i = 0; i < 32; i++)
    {
        if (float(i) >= (32.0 * _316.uMotes))
        {
            break;
        }
        float2 param_18 = float2(float(i), 3.099999904632568359375);
        float2 hh = hash22(param_18);
        float life = fract(((t * 0.119999997317790985107421875) * (0.60000002384185791015625 + hh.x)) + hh.y);
        float rad = mix(0.60000002384185791015625, 0.0500000007450580596923828125, life * life);
        float ang = (hh.x * 6.28318023681640625) + (life * 5.0);
        float m = length(p - (float2(cos(ang) * 1.5, sin(ang)) * rad));
        float twinkle = sin(3.1415927410125732421875 * life) * (0.60000002384185791015625 + (0.4000000059604644775390625 * sin((t * 9.0) + (hh.y * 30.0))));
        col += (((mix(_316.uRune, _316.uWisp, float3(hh.y)) * twinkle) * ((1.2000000476837158203125 * exp(((-m) * m) / 1.2000000424450263381004333496094e-05)) + (0.1500000059604644775390625 * exp((-m) / 0.01200000010430812835693359375)))) * (0.5 + s.w));
    }
    float2 param_19 = p;
    float param_20 = px;
    float inside = shapeAt(param_19, param_20, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _316, gMaskPlace);
    float param_21 = (t * 0.25) + (1.5 / (0.1500000059604644775390625 + length(p)));
    float2 sw = rot(param_21) * p;
    float2 param_22 = sw * 7.0;
    float2 param_23 = (sw * 17.0) - float2(t);
    float swirl = (0.60000002384185791015625 * vnoise(param_22)) + (0.4000000059604644775390625 * vnoise(param_23));
    float2 param_24 = p;
    float param_25 = 0.01200000010430812835693359375;
    float3 portal = (mix(_316.uArcane * 0.300000011920928955078125, _316.uWisp, float3(swirl * swirl)) * (0.5 + (0.800000011920928955078125 * s.x))) + ((_316.uRune * (1.0 - coverage(param_24, param_25, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _316, gMaskPlace))) * 1.5);
    col = mix(col, portal, float3(inside));
    col += (((_316.uRune * exp(-powr(dp / 0.006000000052154064178466796875, 2.0))) * (1.0 - inside)) * (0.60000002384185791015625 + ((1.5 * hit) * _316.uFlash)));
    float param_26 = dq;
    float param_27 = orbitMid;
    float param_28 = _316.uSpacing * 0.3499999940395355224609375;
    float2 param_29 = q;
    float param_30 = ((-t) * _316.uSpin) * 0.0500000007450580596923828125;
    float param_31 = 48.0;
    float param_32 = 99.0;
    float3 orbit = (_316.uRune * runeBand(param_26, param_27, param_28, param_29, param_30, param_31, param_32, _316)) * ((0.3499999940395355224609375 + ((1.2000000476837158203125 * s.z) * _316.uReact)) + (hit * _316.uFlash));
    if (q.y > 0.0)
    {
        orbit *= (1.0 - inside);
    }
    col += orbit;
    fragColor = float4(float3(1.0) - exp((-col) * 1.2999999523162841796875), 1.0);
}

fragment flair_arcane_sigil_frag_out flair_arcane_sigil_frag(constant FlairUniforms& _316 [[buffer(0)]], texture2d<float> uMask [[texture(1)]], sampler uMaskSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_arcane_sigil_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float gKeyTolerance;
    float3 gKeyColour;
    float4 gMaskPlace;
    float _1847;
    if (_316.flair_flipY > 0.5)
    {
        _1847 = _316.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1847 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1847);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _316, gMaskPlace);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

