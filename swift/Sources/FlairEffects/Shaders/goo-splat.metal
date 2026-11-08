// flair-metal-hash: 19040897
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
    float3 uColorA;
    float3 uColorB;
    packed_float3 uColorC;
    float uSize;
    float uDrips;
    float uFade;
    float uGloss;
    uint uDemo;
};

struct flair_goo_splat_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 splatAt(thread const int& i, thread const bool& demo, thread const float& period, thread float& seed, constant FlairUniforms& _292)
{
    bool _280 = !demo;
    bool _299;
    if (!_280)
    {
        _299 = _292.iClicks[0].w > 0.5;
    }
    else
    {
        _299 = _280;
    }
    if (_299)
    {
        seed = (fract((_292.iClicks[i].z * 0.618033885955810546875) + (float(i) * 0.13789999485015869140625)) * 97.0) + 1.0;
        return _292.iClicks[i];
    }
    float k = floor(_292.iTime / period) - float(i);
    float slot = mod(k, 8.0);
    float2 param = float2((slot * 1.37000000476837158203125) + 0.5, 3.7000000476837158203125);
    float2 h = hash22(param);
    seed = (slot * 11.30000019073486328125) + 1.0;
    return float4((float2(0.1500000059604644775390625) + (h * 0.699999988079071044921875)) * float2(_292.iResolution[0], _292.iResolution[1]), k * period, 1.0);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float smin(thread const float& a, thread const float& b, thread const float& k)
{
    float h = fast::clamp(0.5 + ((0.5 * (b - a)) / k), 0.0, 1.0);
    return mix(b, a, h) - ((k * h) * (1.0 - h));
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
float2 segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 pa = p - a;
    float2 ba = b - a;
    float h = fast::clamp(dot(pa, ba) / fast::max(dot(ba, ba), 9.999999717180685365747194737196e-10), 0.0, 1.0);
    return float2(length(pa - (ba * h)), h);
}

static inline __attribute__((always_inline))
float gooShape(thread const float2& q, thread const float& seed, thread const float& age, constant FlairUniforms& _292)
{
    float wob = (0.2199999988079071044921875 * exp((-age) * 5.0)) * cos(age * 24.0);
    float grow = 1.0 - exp((-age) * 16.0);
    float2 b = (q / float2(1.0 + wob, 1.0 - wob)) / float2(mix(0.4000000059604644775390625, 1.0, grow));
    float d = length(b) - 0.5;
    for (int k = 0; k < 6; k++)
    {
        float2 param = float2(seed, float(k) + 0.5);
        float2 h = hash22(param);
        float a = h.x * 6.28318023681640625;
        float2 param_1 = h + float2(seed);
        float param_2 = d;
        float param_3 = (length(b - (float2(cos(a), sin(a)) * (0.3499999940395355224609375 + (0.300000011920928955078125 * h.y)))) - 0.180000007152557373046875) - (0.14000000059604644775390625 * hash12(param_1));
        float param_4 = 0.20000000298023223876953125;
        d = smin(param_2, param_3, param_4);
    }
    float2 param_5 = (b * 3.5) + float2(seed);
    d = (d + ((vnoise(param_5) - 0.5) * 0.07999999821186065673828125)) * mix(0.4000000059604644775390625, 1.0, grow);
    for (int j = 0; j < 5; j++)
    {
        float2 param_6 = float2(seed + 2.7000000476837158203125, float(j) + 0.5);
        float2 param_7 = float2(float(j) * 3.2999999523162841796875, seed);
        float3 h_1 = float3(hash22(param_6), hash12(param_7));
        if (h_1.z > _292.uDrips)
        {
            continue;
        }
        float x = (h_1.x - 0.5) * 1.10000002384185791015625;
        float len = (0.300000011920928955078125 + (1.2999999523162841796875 * h_1.y)) * (1.0 - exp((-fast::max(age - 0.25, 0.0)) * (0.25 + (0.300000011920928955078125 * h_1.y))));
        float w = 0.0500000007450580596923828125 + (0.0500000007450580596923828125 * h_1.z);
        float2 top = float2(x, (-0.25) - ((0.20000000298023223876953125 * (1.0 - (abs(h_1.x - 0.5) * 2.0))) * 0.5));
        float2 param_8 = q;
        float2 param_9 = top;
        float2 param_10 = top - float2(0.0, len);
        float2 sg = segment(param_8, param_9, param_10);
        float param_11 = d;
        float param_12 = sg.x - (w * mix(1.0, 0.699999988079071044921875, sg.y));
        float param_13 = 0.119999997317790985107421875;
        d = smin(param_11, param_12, param_13);
        float param_14 = d;
        float param_15 = length((q - top) + float2(0.0, len + (w * 0.4000000059604644775390625))) - (w * 1.4500000476837158203125);
        float param_16 = 0.0599999986588954925537109375;
        d = smin(param_14, param_15, param_16);
    }
    for (int k_1 = 0; k_1 < 5; k_1++)
    {
        float2 param_17 = float2(seed + 9.1000003814697265625, float(k_1) + 0.5);
        float2 param_18 = float2(seed, float(k_1) * 5.099999904632568359375);
        float3 h_2 = float3(hash22(param_17), hash12(param_18));
        float a_1 = h_2.x * 6.28318023681640625;
        d = fast::min(d, (length(q - ((float2(cos(a_1), sin(a_1)) * (0.949999988079071044921875 + (0.5 * h_2.y))) * grow)) - 0.039999999105930328369140625) - (0.070000000298023223876953125 * h_2.z));
    }
    return d;
}

static inline __attribute__((always_inline))
float3 pick(thread const float& h, constant FlairUniforms& _292)
{
    float3 _672;
    if (h < 0.333000004291534423828125)
    {
        _672 = _292.uColorA;
    }
    else
    {
        float3 _682;
        if (h < 0.666999995708465576171875)
        {
            _682 = _292.uColorB;
        }
        else
        {
            _682 = float3(_292.uColorC);
        }
        _672 = _682;
    }
    return _672;
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _292)
{
    float px = 1.0 / _292.iResolution[1u];
    float2 p = fragCoord * px;
    float3 light = float3(-0.36000001430511474609375, 0.4799999892711639404296875, 0.800000011920928955078125);
    float4 acc = float4(0.0);
    float param_3;
    for (int i = 7; i >= 0; i--)
    {
        int param = i;
        bool param_1 = _292.uDemo != 0u;
        float param_2 = 1.5;
        float4 _733 = splatAt(param, param_1, param_2, param_3, _292);
        float seed = param_3;
        float4 s = _733;
        if (s.w < 0.5)
        {
            continue;
        }
        float age = _292.iTime - s.z;
        bool _748 = age < 0.0;
        bool _757;
        if (!_748)
        {
            _757 = age > _292.uFade;
        }
        else
        {
            _757 = _748;
        }
        if (_757)
        {
            continue;
        }
        float2 param_4 = float2(seed, 9.1000003814697265625);
        float R = (0.100000001490116119384765625 * _292.uSize) * (0.75 + (0.5 * hash12(param_4)));
        float2 q = (p - (s.xy * px)) / float2(R);
        bool _789 = abs(q.x) > 1.7999999523162841796875;
        bool _796;
        if (!_789)
        {
            _796 = q.y > 1.7999999523162841796875;
        }
        else
        {
            _796 = _789;
        }
        bool _804;
        if (!_796)
        {
            _804 = q.y < (-2.2999999523162841796875);
        }
        else
        {
            _804 = _796;
        }
        if (_804)
        {
            continue;
        }
        float eps = px / R;
        float2 param_5 = q;
        float param_6 = seed;
        float param_7 = age;
        float d = gooShape(param_5, param_6, param_7, _292);
        float cover = fast::clamp(0.5 - ((d * R) / px), 0.0, 1.0);
        if (cover <= 0.0)
        {
            continue;
        }
        float2 param_8 = q + float2(eps, 0.0);
        float param_9 = seed;
        float param_10 = age;
        float2 param_11 = q + float2(0.0, eps);
        float param_12 = seed;
        float param_13 = age;
        float2 g = float2(gooShape(param_8, param_9, param_10, _292), gooShape(param_11, param_12, param_13, _292)) - float2(d);
        g /= float2(eps);
        float3 n = fast::normalize(float3((g * exp(d / 0.119999997317790985107421875)) * 1.60000002384185791015625, 1.0));
        float2 param_14 = float2(seed, 5.30000019073486328125);
        float param_15 = hash12(param_14);
        float3 goo = pick(param_15, _292);
        float thick = smoothstep(0.0, -0.25, d);
        float3 col = mix(goo * 1.14999997615814208984375, goo * 0.62000000476837158203125, float3(thick * 0.60000002384185791015625)) * (0.7799999713897705078125 + (0.2199999988079071044921875 * dot(n, light)));
        float fresnel = powr(1.0 - n.z, 2.0);
        col = mix(col, float3(1.0), float3(fresnel * 0.3499999940395355224609375));
        col *= (1.0 - ((0.25 * smoothstep(0.0, 0.60000002384185791015625, -n.y)) * (1.0 - thick)));
        float spec = powr(fast::max(dot(reflect(-light, n), float3(0.0, 0.0, 1.0)), 0.0), 40.0);
        float sheen = powr(fast::max(dot(reflect(-light, n), float3(0.0, 0.0, 1.0)), 0.0), 6.0);
        col = fast::min(col + float3(_292.uGloss * ((spec * 0.89999997615814208984375) + (sheen * 0.119999997317790985107421875))), float3(1.0));
        float fade = 1.0 - smoothstep(_292.uFade * 0.60000002384185791015625, _292.uFade, age);
        float4 param_16 = acc;
        float3 param_17 = col;
        float param_18 = (cover * fade) * mix(0.9700000286102294921875, 0.86000001430511474609375, thick);
        acc = over(param_16, param_17, param_18);
    }
    float4 param_19 = acc;
    fragColor = unpremultiply(param_19);
}

fragment flair_goo_splat_frag_out flair_goo_splat_frag(constant FlairUniforms& _292 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_goo_splat_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _998;
    if (_292.flair_flipY > 0.5)
    {
        _998 = _292.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _998 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _998);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _292);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

