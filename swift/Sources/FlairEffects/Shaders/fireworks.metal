// flair-metal-hash: e2af12de
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

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
    float3 uColorC;
    packed_float3 uGold;
    float uRate;
    float uSize;
    float uGravity;
    float uTrail;
    float uBrightness;
};

struct flair_fireworks_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
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
float streak(thread const float2& p, thread const float2& tail, thread const float2& head, thread const float& w)
{
    float2 param = p;
    float2 param_1 = tail;
    float2 param_2 = head;
    float2 s = segment(param, param_1, param_2);
    float along = mix(0.07999999821186065673828125, 1.0, s.y * s.y);
    return (exp(((-s.x) * s.x) / (w * w)) + (0.119999997317790985107421875 * exp((-s.x) / (w * 3.0)))) * along;
}

static inline __attribute__((always_inline))
float3 pick(thread const float& h, constant FlairUniforms& _263)
{
    float3 _251;
    if (h < 0.333000004291534423828125)
    {
        _251 = _263.uColorA;
    }
    else
    {
        float3 _272;
        if (h < 0.666999995708465576171875)
        {
            _272 = _263.uColorB;
        }
        else
        {
            _272 = _263.uColorC;
        }
        _251 = _272;
    }
    return _251;
}

static inline __attribute__((always_inline))
float2 ballistic(thread const float2& v, thread const float& k, thread const float& g, thread const float& t)
{
    float e = (1.0 - exp((-k) * t)) / k;
    return (v * e) - float2(0.0, (g / k) * (t - e));
}

static inline __attribute__((always_inline))
float3 burst(thread const float2& p, thread const float2& c, thread const float& tb, thread const float& seed, thread const float& px, constant FlairUniforms& _263)
{
    float2 param = float2(seed, 1.7000000476837158203125);
    float2 param_1 = float2(seed, 8.30000019073486328125);
    float4 h = float4(hash22(param), hash22(param_1));
    int type = int(floor(h.x * 4.0));
    bool willow = type == 2;
    float _317;
    if (willow)
    {
        _317 = 3.400000095367431640625;
    }
    else
    {
        _317 = (type == 1) ? 2.400000095367431640625 : 1.89999997615814208984375;
    }
    float life = _317;
    if ((tb < 0.0) || (tb > life))
    {
        return float3(0.0);
    }
    float speed = ((willow ? 0.5 : 0.75) * (0.85000002384185791015625 + (0.300000011920928955078125 * h.y))) * _263.uSize;
    float k = willow ? 2.2000000476837158203125 : 3.2000000476837158203125;
    float g = 0.319999992847442626953125 * _263.uGravity;
    float _371;
    if (type == 0)
    {
        _371 = 0.0500000007450580596923828125;
    }
    else
    {
        float _378;
        if (type == 1)
        {
            _378 = 0.2800000011920928955078125;
        }
        else
        {
            _378 = willow ? 0.699999988079071044921875 : 0.0599999986588954925537109375;
        }
        _371 = _378;
    }
    float trail = _371 * _263.uTrail;
    float e = (1.0 - exp((-k) * tb)) / k;
    float drop = (g / k) * (tb - e);
    if (length((p - c) + float2(0.0, drop * 0.5)) > (((speed * e) + (drop * 0.60000002384185791015625)) + 0.0599999986588954925537109375))
    {
        return float3(0.0);
    }
    float3 _432;
    if (willow)
    {
        _432 = float3(_263.uGold);
    }
    else
    {
        float param_2 = h.z;
        _432 = pick(param_2, _263);
    }
    float3 primary = _432;
    float param_3 = fract(h.z + 0.4000000059604644775390625);
    float3 second = pick(param_3, _263);
    bool twoTone = (h.w > 0.5) && (!willow);
    float fade = 1.0 - smoothstep(life * 0.5, life, tb);
    float cool = smoothstep(0.0, 0.300000011920928955078125, tb);
    float w = fast::max(0.002799999900162220001220703125, 1.10000002384185791015625 * px);
    float tilt = 0.25 + (0.60000002384185791015625 * h.w);
    float2 ringAxis = float2(cos(h.y * 6.280000209808349609375), sin(h.y * 6.280000209808349609375));
    float3 col = float3(0.0);
    float2 dir;
    float _653;
    for (int j = 0; j < 44; j++)
    {
        float fj = float(j);
        float2 param_4 = float2((fj * 1.309999942779541015625) + 0.699999988079071044921875, seed);
        float2 r = hash22(param_4);
        float a = r.x * 6.28318023681640625;
        if (type == 3)
        {
            a = ((fj + (0.300000011920928955078125 * r.y)) / 44.0) * 6.28318023681640625;
            float2 u = float2(cos(a), sin(a) * tilt);
            dir = float2((u.x * ringAxis.x) - (u.y * ringAxis.y), (u.x * ringAxis.y) + (u.y * ringAxis.x)) * (0.949999988079071044921875 + (0.0500000007450580596923828125 * r.y));
        }
        else
        {
            float z = (2.0 * r.y) - 1.0;
            float2 param_5 = float2(fj, seed + 3.0);
            dir = (float2(cos(a), sin(a)) * sqrt(1.0 - (z * z))) * (0.89999997615814208984375 + (0.100000001490116119384765625 * hash12(param_5)));
        }
        float2 v = dir * speed;
        float2 param_6 = v;
        float param_7 = k;
        float param_8 = g;
        float param_9 = tb;
        float2 head = c + ballistic(param_6, param_7, param_8, param_9);
        float2 param_10 = v;
        float param_11 = k;
        float param_12 = g;
        float param_13 = fast::max(tb - trail, 0.0);
        float2 tail = c + ballistic(param_10, param_11, param_12, param_13);
        float2 param_14 = p;
        float2 param_15 = tail;
        float2 param_16 = head;
        float param_17 = w * (willow ? 0.89999997615814208984375 : 1.0);
        float s = streak(param_14, param_15, param_16, param_17);
        if (s < 0.001000000047497451305389404296875)
        {
            continue;
        }
        if (type == 0)
        {
            _653 = 1.0;
        }
        else
        {
            float2 param_18 = float2(fj + seed, floor(_263.iTime * 22.0));
            _653 = 0.449999988079071044921875 + (0.550000011920928955078125 * step(0.3499999940395355224609375, hash12(param_18)));
        }
        float twinkle = _653;
        float3 tint = select(primary, second, bool3(twoTone && (fj > 21.5)));
        col += ((mix(float3(1.0, 0.949999988079071044921875, 0.85000002384185791015625), tint, float3(cool)) * s) * twinkle);
    }
    col += (((mix(float3(1.0), primary, float3(0.5)) * 0.5) * exp(((-length(p - c)) * 18.0) / _263.uSize)) * exp((-tb) * 9.0));
    return (col * fade) * 1.60000002384185791015625;
}

static inline __attribute__((always_inline))
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _263)
{
    float2 p = (fragCoord - (float2(_263.iResolution[0], _263.iResolution[1]) * 0.5)) / float2(_263.iResolution[1u]);
    float px = 1.0 / _263.iResolution[1u];
    float aspect = _263.iResolution[0u] / _263.iResolution[1u];
    float3 col = float3(0.0);
    float cycle = fast::max(6.0 / _263.uRate, 3.900000095367431640625);
    for (int i = 0; i < 6; i++)
    {
        float fi = float(i);
        float tt = (_263.iTime + ((fi * cycle) / 6.0)) + 0.60000002384185791015625;
        float n = floor(tt / cycle);
        float local = tt - (n * cycle);
        float2 param = float2(fi * 7.099999904632568359375, n);
        float seed = hash12(param) * 100.0;
        float2 param_1 = float2(seed, 4.400000095367431640625);
        float2 param_2 = float2(seed, 9.8999996185302734375);
        float4 h = float4(hash22(param_1), hash22(param_2));
        float2 target = float2(((h.x - 0.5) * 0.75) * aspect, mix(0.0199999995529651641845703125, 0.300000011920928955078125, h.y));
        float2 launch = float2(target.x + ((h.z - 0.5) * 0.119999997317790985107421875), -0.560000002384185791015625);
        float rise = 0.89999997615814208984375 + (0.3499999940395355224609375 * h.w);
        if (local < rise)
        {
            float u = local / rise;
            float u0 = fast::max(u - (0.180000007152557373046875 * _263.uTrail), 0.0);
            float2 head = mix(launch, target, float2(u, 1.0 - ((1.0 - u) * (1.0 - u))));
            float2 tail = mix(launch, target, float2(u0, 1.0 - ((1.0 - u0) * (1.0 - u0))));
            float2 param_3 = float2(fi, floor(_263.iTime * 30.0));
            float flicker = 0.60000002384185791015625 + (0.4000000059604644775390625 * hash12(param_3));
            float2 param_4 = p;
            float2 param_5 = tail;
            float2 param_6 = head;
            float param_7 = fast::max(0.002199999988079071044921875, px);
            col += (((float3(1.0, 0.7200000286102294921875, 0.4199999868869781494140625) * streak(param_4, param_5, param_6, param_7)) * 0.699999988079071044921875) * flicker);
        }
        else
        {
            float2 param_8 = p;
            float2 param_9 = target;
            float param_10 = local - rise;
            float param_11 = seed;
            float param_12 = px;
            col += burst(param_8, param_9, param_10, param_11, param_12, _263);
        }
    }
    for (int i_1 = 0; i_1 < 8; i_1++)
    {
        float4 click = _263.iClicks[i_1];
        if (click.w < 0.5)
        {
            continue;
        }
        float tb = _263.iTime - click.z;
        if ((tb < 0.0) || (tb > 3.5))
        {
            continue;
        }
        float2 c = (click.xy - (float2(_263.iResolution[0], _263.iResolution[1]) * 0.5)) / float2(_263.iResolution[1u]);
        float2 param_13 = p;
        float2 param_14 = c;
        float param_15 = tb;
        float param_16 = (fract(click.z * 0.618033885955810546875) * 100.0) + (float(i_1) * 0.00999999977648258209228515625);
        float param_17 = px;
        col += burst(param_13, param_14, param_15, param_16, param_17, _263);
    }
    float3 param_18 = col * _263.uBrightness;
    float4 _1015 = glow(param_18);
    fragColor = _1015;
}

fragment flair_fireworks_frag_out flair_fireworks_frag(constant FlairUniforms& _263 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_fireworks_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1028;
    if (_263.flair_flipY > 0.5)
    {
        _1028 = _263.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1028 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1028);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _263);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

