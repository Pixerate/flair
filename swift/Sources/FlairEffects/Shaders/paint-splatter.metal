// flair-metal-hash: 113506f0
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
    float uSpikes;
    float uDroplets;
    float uFade;
    float uGloss;
    uint uDemo;
};

struct flair_paint_splatter_frag_out
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
float4 splatAt(thread const int& i, thread const bool& demo, thread const float& period, thread float& seed, constant FlairUniforms& _313)
{
    bool _301 = !demo;
    bool _320;
    if (!_301)
    {
        _320 = _313.iClicks[0].w > 0.5;
    }
    else
    {
        _320 = _301;
    }
    if (_320)
    {
        seed = (fract((_313.iClicks[i].z * 0.618033885955810546875) + (float(i) * 0.13789999485015869140625)) * 97.0) + 1.0;
        return _313.iClicks[i];
    }
    float k = floor(_313.iTime / period) - float(i);
    float slot = mod(k, 8.0);
    float2 param = float2((slot * 1.37000000476837158203125) + 0.5, 3.7000000476837158203125);
    float2 h = hash22(param);
    seed = (slot * 11.30000019073486328125) + 1.0;
    return float4((float2(0.1500000059604644775390625) + (h * 0.699999988079071044921875)) * float2(_313.iResolution[0], _313.iResolution[1]), k * period, 1.0);
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
float splatShape(thread const float2& q, thread const float& seed, thread const float& grow, constant FlairUniforms& _313)
{
    float s = mix(0.300000011920928955078125, 1.0, grow);
    float2 b = q / float2(s);
    float d = length(b) - 0.5;
    for (int k = 0; k < 5; k++)
    {
        float2 param = float2(seed, float(k) + 0.5);
        float2 h = hash22(param);
        float2 param_1 = (h * 13.1000003814697265625) + float2(seed);
        float r = 0.20000000298023223876953125 + (0.180000007152557373046875 * hash12(param_1));
        float param_2 = d;
        float param_3 = length(b - ((h - float2(0.5)) * 0.800000011920928955078125)) - r;
        float param_4 = 0.25;
        d = smin(param_2, param_3, param_4);
    }
    float2 param_5 = (b * 5.0) + float2(seed);
    d = (d + ((vnoise(param_5) - 0.5) * 0.0900000035762786865234375)) * s;
    float sector = 0.3490655422210693359375;
    float base = floor(precise::atan2(q.y, q.x + 9.9999997473787516355514526367188e-06) / sector);
    for (int k_1 = -1; k_1 <= 1; k_1++)
    {
        float id = mod(base + float(k_1), 18.0);
        float2 param_6 = float2(id + 0.5, seed);
        float2 param_7 = float2(seed, (id * 3.099999904632568359375) + 0.699999988079071044921875);
        float3 h_1 = float3(hash22(param_6), hash12(param_7));
        if (h_1.z > _313.uSpikes)
        {
            continue;
        }
        float ang = ((id + 0.5) + ((h_1.x - 0.5) * 0.699999988079071044921875)) * sector;
        float2 dir = float2(cos(ang), sin(ang));
        float len = (0.699999988079071044921875 + (0.800000011920928955078125 * h_1.y)) * grow;
        float t = fast::clamp(dot(q, dir) / len, 0.0, 1.0);
        float param_8 = d;
        float param_9 = length(q - ((dir * t) * len)) - mix(0.10999999940395355224609375, 0.01200000010430812835693359375, sqrt(t));
        float param_10 = 0.100000001490116119384765625;
        d = smin(param_8, param_9, param_10);
        if (h_1.y > 0.5)
        {
            d = fast::min(d, (length(q - (dir * (len + ((0.100000001490116119384765625 + (0.25 * h_1.x)) * grow)))) - 0.0350000001490116119384765625) - (0.039999999105930328369140625 * h_1.x));
        }
    }
    for (int k_2 = 0; k_2 < 12; k_2++)
    {
        if (float(k_2) >= (_313.uDroplets * 12.0))
        {
            break;
        }
        float2 param_11 = float2(seed + 4.099999904632568359375, float(k_2) + 0.5);
        float2 param_12 = float2(float(k_2) * 1.7000000476837158203125, seed + 2.0);
        float3 h_2 = float3(hash22(param_11), hash12(param_12));
        float ang_1 = h_2.x * 6.28318023681640625;
        float2 dir_1 = float2(cos(ang_1), sin(ang_1));
        float dist = (1.14999997615814208984375 + (1.10000002384185791015625 * h_2.y)) * grow;
        float r_1 = 0.0199999995529651641845703125 + ((0.0599999986588954925537109375 * h_2.z) * h_2.z);
        if (k_2 < 4)
        {
            float2 param_13 = q;
            float2 param_14 = (dir_1 * 0.800000011920928955078125) * grow;
            float2 param_15 = dir_1 * dist;
            float2 sg = segment(param_13, param_14, param_15);
            d = fast::min(d, sg.x - mix(0.006000000052154064178466796875, 0.0199999995529651641845703125, sg.y));
            d = fast::min(d, length(q - (dir_1 * (dist + 0.02999999932944774627685546875))) - 0.0350000001490116119384765625);
        }
        else
        {
            d = fast::min(d, length(q - (dir_1 * dist)) - r_1);
        }
    }
    return d;
}

static inline __attribute__((always_inline))
float3 pick(thread const float& h, constant FlairUniforms& _313)
{
    float3 _728;
    if (h < 0.333000004291534423828125)
    {
        _728 = _313.uColorA;
    }
    else
    {
        float3 _738;
        if (h < 0.666999995708465576171875)
        {
            _738 = _313.uColorB;
        }
        else
        {
            _738 = float3(_313.uColorC);
        }
        _728 = _738;
    }
    return _728;
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _313)
{
    float px = 1.0 / _313.iResolution[1u];
    float2 p = fragCoord * px;
    float3 light = float3(-0.3940552175045013427734375, 0.472866237163543701171875, 0.788110435009002685546875);
    float4 acc = float4(0.0);
    float param_3;
    for (int i = 7; i >= 0; i--)
    {
        int param = i;
        bool param_1 = _313.uDemo != 0u;
        float param_2 = 1.25;
        float4 _789 = splatAt(param, param_1, param_2, param_3, _313);
        float seed = param_3;
        float4 s = _789;
        if (s.w < 0.5)
        {
            continue;
        }
        float age = _313.iTime - s.z;
        bool _804 = age < 0.0;
        bool _813;
        if (!_804)
        {
            _813 = age > _313.uFade;
        }
        else
        {
            _813 = _804;
        }
        if (_813)
        {
            continue;
        }
        float2 param_4 = float2(seed, 9.1000003814697265625);
        float R = (0.119999997317790985107421875 * _313.uSize) * (0.699999988079071044921875 + (0.60000002384185791015625 * hash12(param_4)));
        float2 q = (p - (s.xy * px)) / float2(R);
        if (dot(q, q) > 7.0)
        {
            continue;
        }
        float param_5 = seed * 2.400000095367431640625;
        float2x2 m = rot(param_5);
        float grow = 1.0 - exp((-age) * 14.0);
        float eps = px / R;
        float2 param_6 = m * q;
        float param_7 = seed;
        float param_8 = grow;
        float d = splatShape(param_6, param_7, param_8, _313);
        float cover = fast::clamp(0.5 - ((d * R) / px), 0.0, 1.0);
        if (cover <= 0.0)
        {
            continue;
        }
        float2 param_9 = m * (q + float2(eps, 0.0));
        float param_10 = seed;
        float param_11 = grow;
        float2 param_12 = m * (q + float2(0.0, eps));
        float param_13 = seed;
        float param_14 = grow;
        float2 g = float2(splatShape(param_9, param_10, param_11, _313), splatShape(param_12, param_13, param_14, _313)) - float2(d);
        g /= float2(eps);
        float3 n = fast::normalize(float3((g * exp(d / 0.070000000298023223876953125)) * 1.2999999523162841796875, 1.0));
        float2 param_15 = float2(seed, 5.30000019073486328125);
        float param_16 = hash12(param_15);
        float3 paint = pick(param_16, _313);
        float3 col = (paint * (0.7200000286102294921875 + (0.2800000011920928955078125 * dot(n, light)))) * mix(0.819999992847442626953125, 1.0, smoothstep(0.0, -0.0500000007450580596923828125, d));
        float spec = powr(fast::max(dot(reflect(-light, n), float3(0.0, 0.0, 1.0)), 0.0), 28.0);
        col = fast::min(col + float3((spec * _313.uGloss) * 0.85000002384185791015625), float3(1.0));
        float fade = 1.0 - smoothstep(_313.uFade * 0.550000011920928955078125, _313.uFade, age);
        float4 param_17 = acc;
        float3 param_18 = col;
        float param_19 = cover * fade;
        acc = over(param_17, param_18, param_19);
    }
    float4 param_20 = acc;
    fragColor = unpremultiply(param_20);
}

fragment flair_paint_splatter_frag_out flair_paint_splatter_frag(constant FlairUniforms& _313 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_paint_splatter_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1018;
    if (_313.flair_flipY > 0.5)
    {
        _1018 = _313.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1018 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1018);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _313);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

