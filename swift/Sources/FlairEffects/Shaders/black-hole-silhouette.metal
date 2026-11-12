// flair-metal-hash: 079c2b8f
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
    float uTilt;
    float uReach;
    float uSpin;
    float uDoppler;
    float uLens;
    float uReact;
    float uFlash;
    float3 uColorHot;
    packed_float3 uColorCool;
    float uStars;
    uint uDemo;
};

constant spvUnsafeArray<float2, 16> _416 = spvUnsafeArray<float2, 16>({ float2(0.17678000032901763916015625, 0.0), float2(-0.22576999664306640625, 0.2068299949169158935546875), float2(0.0345599986612796783447265625, -0.3937700092792510986328125), float2(0.2845700085163116455078125, 0.3711700141429901123046875), float2(-0.52222001552581787109375, -0.0923700034618377685546875), float2(0.494690001010894775390625, -0.31468999385833740234375), float2(-0.1654500067234039306640625, 0.6155300140380859375), float2(-0.31558001041412353515625, -0.607590019702911376953125), float2(0.684650003910064697265625, 0.250010013580322265625), float2(-0.7122499942779541015625, 0.294030010700225830078125), float2(0.3433299958705902099609375, -0.73373997211456298828125), float2(0.2537600100040435791015625, 0.80892002582550048828125), float2(-0.76476001739501953125, -0.443159997463226318359375), float2(0.89713001251220703125, -0.1972700059413909912109375), float2(-0.54746997356414794921875, 0.77880001068115234375), float2(-0.12653000652790069580078125, -0.976080000400543212890625) });
constant spvUnsafeArray<float2, 10> _1492 = spvUnsafeArray<float2, 10>({ float2(0.22360999882221221923828125, 0.0), float2(-0.2855800092220306396484375, 0.261619985103607177734375), float2(0.043710000813007354736328125, -0.4980899989604949951171875), float2(0.3599599897861480712890625, 0.469500005245208740234375), float2(-0.66057002544403076171875, -0.116839997470378875732421875), float2(0.625739991664886474609375, -0.3980599939823150634765625), float2(-0.20927999913692474365234375, 0.778590023517608642578125), float2(-0.3991700112819671630859375, -0.76854002475738525390625), float2(0.866020023822784423828125, 0.316240012645721435546875), float2(-0.900929987430572509765625, 0.37191998958587646484375) });

struct flair_black_hole_silhouette_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
void setKey(thread const float& tolerance, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _216, thread float4& gMaskPlace)
{
    gKeyTolerance = tolerance;
    float4 c = uMask.sample(uMaskSmplr, float2(0.00999999977648258209228515625, 0.9900000095367431640625), level(0.0));
    gKeyColour = c.xyz / float3(fast::max(c.w, 0.001000000047497451305389404296875));
    float2 size = float2(int2(uMask.get_width(), uMask.get_height()));
    float aspect = size.x / size.y;
    float h = fast::min(_216.uSize, ((_216.iResolution[0u] / _216.iResolution[1u]) * _216.uSize) / aspect);
    gMaskPlace = float4(1.0 / (h * aspect), 1.0 / h, size.y / h, float(size.x > 1.0));
}

static inline __attribute__((always_inline))
bool soundDemo(constant FlairUniforms& _216)
{
    bool _477 = _216.uDemo != 0u;
    bool _484;
    if (_477)
    {
        _484 = _216.iBeat == 0.0;
    }
    else
    {
        _484 = _477;
    }
    bool _495;
    if (_484)
    {
        _495 = dot(_216.iAudio, _216.iAudio) == 0.0;
    }
    else
    {
        _495 = _484;
    }
    return _495;
}

static inline __attribute__((always_inline))
float demoKick(constant FlairUniforms& _216)
{
    return exp((-mod(_216.iTime, 0.5)) * 7.0);
}

static inline __attribute__((always_inline))
float demoHat(constant FlairUniforms& _216)
{
    return exp((-mod(_216.iTime + 0.25, 0.5)) * 16.0);
}

static inline __attribute__((always_inline))
float4 sound(constant FlairUniforms& _216)
{
    if (!soundDemo(_216))
    {
        return _216.iAudio;
    }
    float k = demoKick(_216);
    float mid = (0.4000000059604644775390625 + (0.119999997317790985107421875 * sin(_216.iTime * 1.7000000476837158203125))) + (0.100000001490116119384765625 * sin(_216.iTime * 3.099999904632568359375));
    return float4((0.449999988079071044921875 + (0.300000011920928955078125 * k)) + (0.100000001490116119384765625 * mid), 0.300000011920928955078125 + (0.64999997615814208984375 * k), mid, (0.25 + (0.4000000059604644775390625 * demoHat(_216))) + (0.07999999821186065673828125 * sin(_216.iTime * 5.30000019073486328125)));
}

static inline __attribute__((always_inline))
float beat(constant FlairUniforms& _216)
{
    float _569;
    if (soundDemo(_216))
    {
        _569 = mod(_216.iTime, 0.5);
    }
    else
    {
        _569 = _216.iBeat;
    }
    return _569;
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
    float _902;
    if (weight > 0.0)
    {
        _902 = fast::max((best - (k * log(weight))) + (0.439999997615814208984375 * radius), 0.0);
    }
    else
    {
        _902 = 1.0;
    }
    return _902;
}

static inline __attribute__((always_inline))
float shapeLod(thread const float2& p, thread const float& lod, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, thread float4& gMaskPlace)
{
    float2 uv = (p * gMaskPlace.xy) + float2(0.5);
    bool _259 = uv.x < 0.0;
    bool _266;
    if (!_259)
    {
        _266 = uv.x > 1.0;
    }
    else
    {
        _266 = _259;
    }
    bool _273;
    if (!_266)
    {
        _273 = uv.y < 0.0;
    }
    else
    {
        _273 = _266;
    }
    bool _280;
    if (!_273)
    {
        _280 = uv.y > 1.0;
    }
    else
    {
        _280 = _273;
    }
    if (_280)
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
float shapeAt(thread const float2& p, thread const float& blur, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _216, thread float4& gMaskPlace)
{
    if (gMaskPlace.w < 0.5)
    {
        float d = length(p) - (0.300000011920928955078125 * _216.uSize);
        return fast::clamp(0.5 - (d / fast::max(blur, 0.0040000001899898052215576171875)), 0.0, 1.0);
    }
    float2 param = p;
    float param_1 = log2(fast::max(blur * gMaskPlace.z, 1.0));
    return shapeLod(param, param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, gMaskPlace);
}

static inline __attribute__((always_inline))
float coverage(thread const float2& p, thread const float& radius, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _216, thread float4& gMaskPlace)
{
    float sum = 0.0;
    if (gMaskPlace.w < 0.5)
    {
        for (int i = 0; i < 16; i++)
        {
            float2 param = p + (_416[i] * radius);
            float param_1 = radius * 0.4000000059604644775390625;
            sum += shapeAt(param, param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _216, gMaskPlace);
        }
    }
    else
    {
        float lod = log2(fast::max((radius * 0.4000000059604644775390625) * gMaskPlace.z, 1.0));
        for (int i_1 = 0; i_1 < 16; i_1++)
        {
            float2 param_2 = p + (_416[i_1] * radius);
            float param_3 = lod;
            sum += shapeLod(param_2, param_3, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, gMaskPlace);
        }
    }
    return sum / 16.0;
}

static inline __attribute__((always_inline))
float nearReach(thread const float2& q, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _216, thread float4& gMaskPlace)
{
    float r0 = 0.0;
    float2 param = q;
    float param_1 = 0.0030000000260770320892333984375;
    float c0 = shapeAt(param, param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _216, gMaskPlace);
    if (c0 >= 0.0199999995529651641845703125)
    {
        return 0.0;
    }
    float r = 0.008000000379979610443115234375;
    for (int i = 0; i < 7; i++)
    {
        float2 param_2 = q;
        float param_3 = r;
        float c = coverage(param_2, param_3, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _216, gMaskPlace);
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
float reach(thread const float2& q, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _216, thread float4& gMaskPlace)
{
    if (gMaskPlace.w < 0.5)
    {
        return fast::max(length(q) - (0.300000011920928955078125 * _216.uSize), 0.0);
    }
    float2 param = q;
    float far = farReach(param, uMask, uMaskSmplr, gMaskPlace);
    if (far > 0.119999997317790985107421875)
    {
        return far;
    }
    float2 param_1 = q;
    float near = nearReach(param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _216, gMaskPlace);
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
float spectrum(thread float& x, constant FlairUniforms& _216)
{
    x = fast::clamp(x, 0.0, 1.0);
    if (soundDemo(_216))
    {
        float tilt = 0.800000011920928955078125 - (0.5 * x);
        float wander = ((0.60000002384185791015625 + (0.25 * sin((_216.iTime * 0.699999988079071044921875) + (x * 5.0)))) + (0.100000001490116119384765625 * sin((x * 23.0) + (_216.iTime * 2.2999999523162841796875)))) + (0.070000000298023223876953125 * sin((x * 47.0) - (_216.iTime * 3.7000000476837158203125)));
        return fast::clamp(((tilt * wander) + ((0.550000011920928955078125 * demoKick(_216)) * exp((-x) * 7.0))) + ((0.3499999940395355224609375 * demoHat(_216)) * smoothstep(0.550000011920928955078125, 0.89999997615814208984375, x)), 0.0, 1.0);
    }
    float f = x * 63.0;
    int i = int(f);
    int j = min((i + 1), 63);
    return mix(_216.iSpectrum[i / 4][spvSMod(i, 4)], _216.iSpectrum[j / 4][spvSMod(j, 4)], f - float(i));
}

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
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
float4 disk(thread const float& d, thread const float2& q, thread const float4& s, thread const float& b, constant FlairUniforms& _216)
{
    float x = (d - 0.02999999932944774627685546875) / _216.uReach;
    if ((x < 0.0) || (x > 1.0))
    {
        return float4(0.0);
    }
    float param = 1.0 - x;
    float _975 = spectrum(param, _216);
    float level0 = _975 * _216.uReact;
    float param_1 = ((_216.iTime * _216.uSpin) * 0.5) / (0.1500000059604644775390625 + x);
    float2 r = rot(param_1) * q;
    float2 param_2 = r * 12.0;
    float2 param_3 = (r * 31.0) + float2(9.0);
    float n = (vnoise(param_2) * 0.64999997615814208984375) + (vnoise(param_3) * 0.3499999940395355224609375);
    float gas = (0.3499999940395355224609375 + ((1.10000002384185791015625 * n) * n)) * (0.60000002384185791015625 + (0.4000000059604644775390625 * sin((x * 40.0) + (n * 3.0))));
    float edge = smoothstep(0.0, 0.0500000007450580596923828125, x) * smoothstep(1.0, 0.60000002384185791015625, x);
    float heat = 0.25 + ((0.75 * (1.0 - x)) * (1.0 - x));
    float _1047;
    if (b >= 0.0)
    {
        _1047 = (exp(-powr((x - (b * 1.60000002384185791015625)) / 0.0500000007450580596923828125, 2.0)) * exp((-b) * 2.0)) * _216.uFlash;
    }
    else
    {
        _1047 = 0.0;
    }
    float ripple = _1047;
    float e = edge * ((gas * ((0.60000002384185791015625 * heat) + (1.39999997615814208984375 * level0))) + (1.5 * ripple));
    float beta = fast::clamp((_216.uDoppler * (0.449999988079071044921875 + (0.300000011920928955078125 * s.z))) * (1.0 - (0.5 * x)), 0.0, 0.89999997615814208984375);
    float g = sqrt(1.0 - (beta * beta)) / (1.0 - ((beta * (-q.x)) / (abs(q.x) + 0.100000001490116119384765625)));
    float3 c = mix(_216.uColorHot, float3(_216.uColorCool), float3(smoothstep(0.0, 0.800000011920928955078125, x)));
    c = mix(c, float3(0.75, 0.85000002384185791015625, 1.0) * fast::max(c.x, fast::max(c.y, c.z)), float3(fast::clamp((g - 1.0) * 0.800000011920928955078125, 0.0, 0.60000002384185791015625)));
    c *= mix(float3(1.0), float3(1.0, 0.449999988079071044921875, 0.25), float3(fast::clamp((1.0 - g) * 1.5, 0.0, 1.0)));
    return float4(((((c * e) * g) * g) * g) * 1.2000000476837158203125, fast::clamp(e * 0.89999997615814208984375, 0.0, 0.920000016689300537109375));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _216, thread float4& gMaskPlace)
{
    float param = 0.0;
    setKey(param, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _216, gMaskPlace);
    float px = 1.0 / _216.iResolution[1u];
    float2 p = (fragCoord - (float2(_216.iResolution[0], _216.iResolution[1]) * 0.5)) * px;
    float4 s = sound(_216);
    float b = beat(_216);
    float _1199;
    if (b >= 0.0)
    {
        _1199 = exp((-b) * 6.0);
    }
    else
    {
        _1199 = 0.0;
    }
    float hit = _1199;
    float sT = sin(radians(_216.uTilt));
    float2 param_1 = p;
    float dp = reach(param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _216, gMaskPlace);
    float2 q = float2(p.x, p.y / sT);
    float _1232;
    if (abs(q.y) < 0.60000002384185791015625)
    {
        float2 param_2 = q;
        _1232 = reach(param_2, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _216, gMaskPlace);
    }
    else
    {
        _1232 = 1.0;
    }
    float dq = _1232;
    float2 grad = float2(dfdx(dp), dfdy(dp));
    float2 _1252;
    if (dot(grad, grad) > 9.9999999600419720025001879548654e-13)
    {
        _1252 = -fast::normalize(grad);
    }
    else
    {
        _1252 = -fast::normalize(p + float2(9.9999997473787516355514526367188e-06));
    }
    float2 toward = _1252;
    float2 sp = p + ((((toward * _216.uLens) * (1.0 + ((0.4000000059604644775390625 * hit) * _216.uFlash))) * 0.01200000010430812835693359375) / float2(dp + 0.0199999995529651641845703125));
    float2 cell = floor(sp * 240.0);
    float2 param_3 = cell;
    float h = hash12(param_3);
    float3 col = float3(0.0040000001899898052215576171875, 0.004999999888241291046142578125, 0.01200000010430812835693359375) + (((float3(0.800000011920928955078125, 0.85000002384185791015625, 1.0) * step(0.992999970912933349609375, h)) * (0.699999988079071044921875 + ((0.300000011920928955078125 * sin((_216.iTime * 6.0) + (h * 90.0))) * s.w))) * _216.uStars);
    float param_4 = 0.02999999932944774627685546875 + ((dp - 0.02999999932944774627685546875) * 2.599999904632568359375);
    float2 param_5 = p;
    float4 param_6 = s;
    float param_7 = b;
    float4 arc = disk(param_4, param_5, param_6, param_7, _216);
    col += ((arc.xyz * ((p.y > 0.0) ? 1.0 : 0.449999988079071044921875)) * smoothstep(0.0, 0.0199999995529651641845703125, abs(p.y) + 0.00999999977648258209228515625));
    float2 param_8 = p;
    float param_9 = px;
    float shadow = fast::max(shapeAt(param_8, param_9, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _216, gMaskPlace), smoothstep(0.01200000010430812835693359375, 0.0, dp));
    col *= (1.0 - shadow);
    col += ((((_216.uColorHot * exp(-powr((dp - 0.01600000075995922088623046875) / 0.0040000001899898052215576171875, 2.0))) * (0.3499999940395355224609375 + ((2.0 * hit) * _216.uFlash))) * (0.5 + s.x)) * (1.0 - shadow));
    float param_10 = dq;
    float2 param_11 = q;
    float4 param_12 = s;
    float param_13 = b;
    float4 direct = disk(param_10, param_11, param_12, param_13, _216);
    if (q.y > 0.0)
    {
        direct *= (1.0 - shadow);
    }
    col = (col * (1.0 - direct.w)) + direct.xyz;
    fragColor = float4(float3(1.0) - exp((-col) * 1.39999997615814208984375), 1.0);
}

fragment flair_black_hole_silhouette_frag_out flair_black_hole_silhouette_frag(constant FlairUniforms& _216 [[buffer(0)]], texture2d<float> uMask [[texture(1)]], sampler uMaskSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_black_hole_silhouette_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float gKeyTolerance;
    float3 gKeyColour;
    float4 gMaskPlace;
    float _1440;
    if (_216.flair_flipY > 0.5)
    {
        _1440 = _216.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1440 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1440);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _216, gMaskPlace);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

