// flair-metal-hash: 818c2fea
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
    float uTilt;
    float uSun;
    float uReact;
    float uSpokes;
    float uWave;
    float3 uPlanet;
    float3 uBands;
    packed_float3 uRings;
    float uStars;
    uint uDemo;
};

struct flair_saturn_rings_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
bool soundDemo(constant FlairUniforms& _168)
{
    bool _173 = _168.uDemo != 0u;
    bool _181;
    if (_173)
    {
        _181 = _168.iBeat == 0.0;
    }
    else
    {
        _181 = _173;
    }
    bool _192;
    if (_181)
    {
        _192 = dot(_168.iAudio, _168.iAudio) == 0.0;
    }
    else
    {
        _192 = _181;
    }
    return _192;
}

static inline __attribute__((always_inline))
float demoKick(constant FlairUniforms& _168)
{
    return exp((-mod(_168.iTime, 0.5)) * 7.0);
}

static inline __attribute__((always_inline))
float demoHat(constant FlairUniforms& _168)
{
    return exp((-mod(_168.iTime + 0.25, 0.5)) * 16.0);
}

static inline __attribute__((always_inline))
float4 sound(constant FlairUniforms& _168)
{
    if (!soundDemo(_168))
    {
        return _168.iAudio;
    }
    float k = demoKick(_168);
    float mid = (0.4000000059604644775390625 + (0.119999997317790985107421875 * sin(_168.iTime * 1.7000000476837158203125))) + (0.100000001490116119384765625 * sin(_168.iTime * 3.099999904632568359375));
    return float4((0.449999988079071044921875 + (0.300000011920928955078125 * k)) + (0.100000001490116119384765625 * mid), 0.300000011920928955078125 + (0.64999997615814208984375 * k), mid, (0.25 + (0.4000000059604644775390625 * demoHat(_168))) + (0.07999999821186065673828125 * sin(_168.iTime * 5.30000019073486328125)));
}

static inline __attribute__((always_inline))
float beat(constant FlairUniforms& _168)
{
    float _272;
    if (soundDemo(_168))
    {
        _272 = mod(_168.iTime, 0.5);
    }
    else
    {
        _272 = _168.iBeat;
    }
    return _272;
}

static inline __attribute__((always_inline))
float hash13(thread float3& p)
{
    p = fract(p * 0.103100001811981201171875);
    p += float3(dot(p, p.zyx + float3(31.31999969482421875)));
    return fract((p.x + p.y) * p.z);
}

static inline __attribute__((always_inline))
float3 sky(thread const float3& d, constant FlairUniforms& _168)
{
    float3 g = d * 110.0;
    float3 param = floor(g);
    float _663 = hash13(param);
    float h = _663;
    return float3(0.0040000001899898052215576171875, 0.0040000001899898052215576171875, 0.008000000379979610443115234375) + ((mix(float3(0.699999988079071044921875, 0.800000011920928955078125, 1.0), float3(1.0, 0.89999997615814208984375, 0.75), float3(fract(h * 41.0))) * (step(0.98500001430511474609375, h) * exp((-length(fract(g) - float3(0.5))) * 9.0))) * _168.uStars);
}

static inline __attribute__((always_inline))
float planetHit(thread const float3& ro, thread const float3& rd)
{
    float3 o = ro * float3(1.0, 1.111111164093017578125, 1.0);
    float3 d = rd * float3(1.0, 1.111111164093017578125, 1.0);
    float a = dot(d, d);
    float bb = dot(o, d);
    float h = (bb * bb) - (a * (dot(o, o) - 1.0));
    if (h < 0.0)
    {
        return -1.0;
    }
    float t = ((-bb) - sqrt(h)) / a;
    return (t > 0.0) ? t : (-1.0);
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
float profile(thread const float& x)
{
    float c = (0.2199999988079071044921875 * smoothstep(0.0, 0.0500000007450580596923828125, x)) * step(x, 0.2599999904632568359375);
    float bRing = (0.949999988079071044921875 * smoothstep(0.23999999463558197021484375, 0.2700000107288360595703125, x)) * smoothstep(0.584999978542327880859375, 0.574999988079071044921875, x);
    float aRing = ((0.699999988079071044921875 * smoothstep(0.63999998569488525390625, 0.660000026226043701171875, x)) * smoothstep(0.930000007152557373046875, 0.910000026226043701171875, x)) * (1.0 - (0.89999997615814208984375 * exp(-powr((x - 0.86000001430511474609375) / 0.006000000052154064178466796875, 2.0))));
    float f = 0.60000002384185791015625 * exp(-powr((x - 0.980000019073486328125) / 0.0040000001899898052215576171875, 2.0));
    return fast::max(fast::max(c, bRing), fast::max(aRing, f));
}

static inline __attribute__((always_inline))
float spectrum(thread float& x, constant FlairUniforms& _168)
{
    x = fast::clamp(x, 0.0, 1.0);
    if (soundDemo(_168))
    {
        float tilt = 0.800000011920928955078125 - (0.5 * x);
        float wander = ((0.60000002384185791015625 + (0.25 * sin((_168.iTime * 0.699999988079071044921875) + (x * 5.0)))) + (0.100000001490116119384765625 * sin((x * 23.0) + (_168.iTime * 2.2999999523162841796875)))) + (0.070000000298023223876953125 * sin((x * 47.0) - (_168.iTime * 3.7000000476837158203125)));
        return fast::clamp(((tilt * wander) + ((0.550000011920928955078125 * demoKick(_168)) * exp((-x) * 7.0))) + ((0.3499999940395355224609375 * demoHat(_168)) * smoothstep(0.550000011920928955078125, 0.89999997615814208984375, x)), 0.0, 1.0);
    }
    float f = x * 63.0;
    int i = int(f);
    int j = min((i + 1), 63);
    return mix(_168.iSpectrum[i / 4][spvSMod(i, 4)], _168.iSpectrum[j / 4][spvSMod(j, 4)], f - float(i));
}

static inline __attribute__((always_inline))
float rings(thread const float2& q, thread const float& b, thread const float& hit, thread const float& treble, constant FlairUniforms& _168)
{
    float r = length(q);
    float x = (r - 1.25) / 1.10000002384185791015625;
    if ((x < 0.0) || (x > 1.0))
    {
        return 0.0;
    }
    float param = x;
    float base = profile(param);
    float2 param_1 = float2(x * 320.0, 0.5);
    float2 param_2 = float2(x * 90.0, 3.5);
    float ringlets = (0.550000011920928955078125 * vnoise(param_1)) + (0.449999988079071044921875 * vnoise(param_2));
    float param_3 = x;
    float _582 = spectrum(param_3, _168);
    float d = (base * (0.25 + (0.75 * ringlets))) * (0.3499999940395355224609375 + ((1.10000002384185791015625 * _582) * _168.uReact));
    float param_4 = _168.iTime * 0.07999999821186065673828125;
    float2 dir = rot(param_4) * (q / float2(r));
    float2 param_5 = (dir * 7.0) + float2(0.0, x * 3.0);
    float spokes = (smoothstep(0.550000011920928955078125, 0.85000002384185791015625, vnoise(param_5)) * smoothstep(0.25, 0.3499999940395355224609375, x)) * smoothstep(0.60000002384185791015625, 0.5, x);
    d *= (1.0 - (((0.60000002384185791015625 * spokes) * treble) * _168.uSpokes));
    d += ((((_168.uWave * hit) * 0.60000002384185791015625) * step(0.00999999977648258209228515625, base)) * exp(-powr((x - (b * 0.89999997615814208984375)) / 0.02500000037252902984619140625, 2.0)));
    return fast::clamp(d, 0.0, 1.0);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _168)
{
    float param = 0.300000011920928955078125;
    float2 p = (rot(param) * (fragCoord - (float2(_168.iResolution[0], _168.iResolution[1]) * 0.5))) / float2(_168.iResolution[1u]);
    float4 s = sound(_168);
    float b = beat(_168);
    float _718;
    if (b >= 0.0)
    {
        _718 = exp((-b) * 1.5);
    }
    else
    {
        _718 = 0.0;
    }
    float hit = _718;
    float tilt = radians(_168.uTilt);
    float3 ro = float3(0.0, sin(tilt), -cos(tilt)) * 7.0;
    float3 fw = fast::normalize(-ro);
    float3 rt = fast::normalize(cross(float3(0.0, 1.0, 0.0), fw));
    float3 rd = fast::normalize(((rt * p.x) + (cross(fw, rt) * p.y)) + (fw * 2.2000000476837158203125));
    float3 sun = fast::normalize(float3(cos(_168.uSun), 0.300000011920928955078125, sin(_168.uSun)));
    float3 param_1 = rd;
    float3 col = sky(param_1, _168);
    float3 param_2 = ro;
    float3 param_3 = rd;
    float tp = planetHit(param_2, param_3);
    if (tp > 0.0)
    {
        float3 pos = ro + (rd * tp);
        float3 n = fast::normalize((pos * float3(1.0, 1.111111164093017578125, 1.0)) * float3(1.0, 1.111111164093017578125, 1.0));
        float lat = pos.y * 0.89999997615814208984375;
        float2 param_4 = float2(lat * 9.0, (precise::atan2(pos.z, pos.x) * 2.0) + (_168.iTime * 0.0199999995529651641845703125));
        float w = vnoise(param_4);
        float2 param_5 = float2(lat * 40.0, 1.0);
        float bands = 0.5 + ((0.5 * sin((lat * 26.0) + (w * 2.5))) * (0.60000002384185791015625 + (0.4000000059604644775390625 * vnoise(param_5))));
        float3 c = mix(_168.uPlanet, _168.uBands, float3(bands * 0.699999988079071044921875));
        float light = smoothstep(-0.0500000007450580596923828125, 0.4000000059604644775390625, dot(n, sun));
        float k = (-pos.y) / sun.y;
        if (k > 0.0)
        {
            float2 param_6 = (pos + (sun * k)).xz;
            float param_7 = b;
            float param_8 = hit;
            float param_9 = s.w;
            light *= (1.0 - (0.85000002384185791015625 * rings(param_6, param_7, param_8, param_9, _168)));
        }
        col = ((c * light) * (0.3499999940395355224609375 + (0.64999997615814208984375 * powr(fast::max(dot(n, -rd), 0.0), 0.4000000059604644775390625)))) + (c * 0.0199999995529651641845703125);
    }
    float tr = (-ro.y) / rd.y;
    bool _914 = tr > 0.0;
    bool _923;
    if (_914)
    {
        _923 = (tp < 0.0) || (tr < tp);
    }
    else
    {
        _923 = _914;
    }
    if (_923)
    {
        float3 pos_1 = ro + (rd * tr);
        float2 param_10 = pos_1.xz;
        float param_11 = b;
        float param_12 = hit;
        float param_13 = s.w;
        float d = rings(param_10, param_11, param_12, param_13, _168);
        if (d > 0.0)
        {
            float x = (length(pos_1.xz) - 1.25) / 1.10000002384185791015625;
            float3 c_1 = float3(_168.uRings) * mix(float3(0.75, 0.800000011920928955078125, 0.85000002384185791015625), float3(1.0499999523162841796875, 1.0, 0.920000016689300537109375), float3(smoothstep(0.100000001490116119384765625, 0.4000000059604644775390625, x)));
            float _975;
            if (sign(sun.y) == sign(ro.y))
            {
                _975 = 0.3499999940395355224609375 + ((0.64999997615814208984375 * abs(sun.y)) * 2.0);
            }
            else
            {
                _975 = 0.300000011920928955078125 + (1.2000000476837158203125 * (1.0 - d));
            }
            float lit = _975;
            float3 param_14 = pos_1 + (sun * 0.001000000047497451305389404296875);
            float3 param_15 = sun;
            if (planetHit(param_14, param_15) > 0.0)
            {
                lit *= 0.0599999986588954925537109375;
            }
            col = mix(col, c_1 * lit, float3(d));
        }
    }
    fragColor = float4(float3(1.0) - exp((-col) * 1.60000002384185791015625), 1.0);
}

fragment flair_saturn_rings_frag_out flair_saturn_rings_frag(constant FlairUniforms& _168 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_saturn_rings_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1036;
    if (_168.flair_flipY > 0.5)
    {
        _1036 = _168.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1036 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1036);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _168);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

