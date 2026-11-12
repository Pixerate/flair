// flair-metal-hash: 58512d34
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    float2 uStart;
    float2 uEnd;
    packed_float3 uColor;
    float uRate;
    int uFilaments;
    float uRough;
    float uWidth;
    float uSparks;
    uint uFollow;
};

struct flair_tesla_arc_frag_out
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
float jag(thread const float& x, thread const float& seed)
{
    float i = floor(x);
    float2 param = float2(i, seed);
    float2 param_1 = float2(i + 1.0, seed);
    return (mix(hash12(param), hash12(param_1), fract(x)) * 2.0) - 1.0;
}

static inline __attribute__((always_inline))
float zigzag(thread float& x, thread const float& seed)
{
    float s = 0.0;
    float amp = 0.60000002384185791015625;
    for (int i = 0; i < 5; i++)
    {
        float param = x;
        float param_1 = seed + (float(i) * 17.299999237060546875);
        s += (amp * jag(param, param_1));
        x *= 2.099999904632568359375;
        amp *= 0.5;
    }
    return s;
}

static inline __attribute__((always_inline))
float arcKick(thread const float& t, thread const float& seed, thread const float& rough, thread const float& open)
{
    float env = sqrt(fast::max(sin((3.141590118408203125 * t) * (1.0 - (0.5 * open))), 0.0));
    float param = t * 5.0;
    float param_1 = seed;
    float _215 = zigzag(param, param_1);
    return (_215 * rough) * env;
}

static inline __attribute__((always_inline))
float chordDist(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 ab = b - a;
    float t = fast::clamp(dot(p - a, ab) / fast::max(dot(ab, ab), 1.0000000133514319600180897396058e-10), 0.0, 1.0);
    return length((p - a) - (ab * t));
}

static inline __attribute__((always_inline))
float2 arcDist(thread const float2& p, thread const float2& a, thread const float2& b, thread const float& seed, thread const float& rough, thread const float& open)
{
    float2 ab = b - a;
    float len = fast::max(length(ab), 9.9999997473787516355514526367188e-05);
    float2 dir = ab / float2(len);
    float2 q = p - a;
    float along = dot(q, dir);
    float side = dot(q, float2(-dir.y, dir.x));
    float t = fast::clamp(along / len, 0.0, 1.0);
    float band = (rough * len) * 1.2999999523162841796875;
    if (abs(side) > (band + 0.300000011920928955078125))
    {
        return float2(length(float2(along - (t * len), abs(side) - band)), t);
    }
    float2 lp = float2(along, side);
    float param = t - 0.008000000379979610443115234375;
    float param_1 = seed;
    float param_2 = rough;
    float param_3 = open;
    float2 c0 = float2((t - 0.008000000379979610443115234375) * len, arcKick(param, param_1, param_2, param_3) * len);
    float param_4 = t;
    float param_5 = seed;
    float param_6 = rough;
    float param_7 = open;
    float2 c1 = float2(t * len, arcKick(param_4, param_5, param_6, param_7) * len);
    float param_8 = t + 0.008000000379979610443115234375;
    float param_9 = seed;
    float param_10 = rough;
    float param_11 = open;
    float2 c2 = float2((t + 0.008000000379979610443115234375) * len, arcKick(param_8, param_9, param_10, param_11) * len);
    float2 param_12 = lp;
    float2 param_13 = c0;
    float2 param_14 = c1;
    float2 param_15 = lp;
    float2 param_16 = c1;
    float2 param_17 = c2;
    return float2(fast::min(chordDist(param_12, param_13, param_14), chordDist(param_15, param_16, param_17)), t);
}

static inline __attribute__((always_inline))
float3 arcLight(thread const float& d, thread const float& w, thread const float3& col)
{
    float core = exp(((-d) * d) / (w * w));
    float halo = (0.550000011920928955078125 * exp((-d) / (w * 4.0))) + (0.180000007152557373046875 * exp((-d) / (w * 20.0)));
    return ((mix(col, float3(1.0), float3(0.75)) * core) * 2.0) + (col * halo);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 ab = b - a;
    float t = fast::clamp(dot(p - a, ab) / fast::max(dot(ab, ab), 9.9999999392252902907785028219223e-09), 0.0, 1.0);
    return length((p - a) - (ab * t));
}

static inline __attribute__((always_inline))
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _497)
{
    float px = 1.0 / _497.iResolution[1u];
    float2 p = (fragCoord - (float2(_497.iResolution[0], _497.iResolution[1]) * 0.5)) * px;
    float2 span = float2(_497.iResolution[0u] * px, 1.0) * 0.5;
    float2 a = _497.uStart * span;
    float2 b = _497.uEnd * span;
    if (_497.uFollow != 0u)
    {
        b = mix(b, (_497.iPointer.xy - (float2(_497.iResolution[0], _497.iResolution[1]) * 0.5)) * px, float2(fast::clamp(_497.iPointer.z, 0.0, 1.0)));
    }
    float tick = floor(_497.iTime * _497.uRate);
    float w = fast::max(0.0030000000260770320892333984375 * _497.uWidth, 0.699999988079071044921875 * px);
    float2 param = float2(tick, 0.699999988079071044921875);
    float level0 = 0.75 + (0.5 * hash12(param));
    float2 param_1 = p;
    float2 param_2 = a;
    float2 param_3 = b;
    float param_4 = tick;
    float param_5 = _497.uRough;
    float param_6 = 0.0;
    float2 m = arcDist(param_1, param_2, param_3, param_4, param_5, param_6);
    float param_7 = m.x;
    float param_8 = w;
    float3 param_9 = float3(_497.uColor);
    float3 col = arcLight(param_7, param_8, param_9) * level0;
    for (int i = 0; i < 3; i++)
    {
        if (i >= _497.uFilaments)
        {
            break;
        }
        float fi = float(i) + 1.0;
        float ft = floor(((_497.iTime * _497.uRate) * (0.5 + (0.20000000298023223876953125 * fi))) + (fi * 3.099999904632568359375));
        float2 param_10 = float2(ft, fi * 4.30000019073486328125);
        float on = step(0.300000011920928955078125, hash12(param_10));
        float2 param_11 = p;
        float2 param_12 = a;
        float2 param_13 = b;
        float param_14 = (ft * 1.7000000476837158203125) + (fi * 31.0);
        float param_15 = _497.uRough * (1.39999997615814208984375 + (0.4000000059604644775390625 * fi));
        float param_16 = 0.0;
        float2 f = arcDist(param_11, param_12, param_13, param_14, param_15, param_16);
        float param_17 = f.x;
        float param_18 = w * 0.5;
        float3 param_19 = float3(_497.uColor);
        col += ((arcLight(param_17, param_18, param_19) * 0.449999988079071044921875) * on);
    }
    float2 _721;
    for (int e = 0; e < 2; e++)
    {
        float2 c = select(b, a, bool2(e == 0));
        if (e == 0)
        {
            _721 = a - b;
        }
        else
        {
            _721 = b - a;
        }
        float2 away = fast::normalize(_721 + float2(9.9999997473787516355514526367188e-06));
        float r = length(p - c);
        col += ((mix(float3(_497.uColor), float3(1.0), float3(0.60000002384185791015625)) * ((exp((-r) / (0.01200000010430812835693359375 * _497.uWidth)) * 1.2000000476837158203125) + (exp((-r) / 0.0500000007450580596923828125) * 0.25))) * level0);
        for (int k = 0; k < 6; k++)
        {
            float fk = float(k);
            float2 param_20 = float2(fk, float(e) + 0.5);
            float clock = (_497.iTime * 2.2999999523162841796875) + hash12(param_20);
            float life = fract(clock);
            float2 param_21 = float2(floor(clock), fk + (float(e) * 7.0));
            float2 param_22 = float2(fk, floor(clock) + 0.300000011920928955078125);
            float3 h = float3(hash22(param_21), hash12(param_22));
            if (h.z > _497.uSparks)
            {
                continue;
            }
            float ang = precise::atan2(away.y, away.x) + ((h.x - 0.5) * 2.599999904632568359375);
            float2 v = float2(cos(ang), sin(ang)) * (0.25 + (0.3499999940395355224609375 * h.y));
            float s = life * 0.449999988079071044921875;
            float2 pos = (c + (v * s)) - float2(0.0, (0.5 * s) * s);
            if (length(p - pos) > 0.07999999821186065673828125)
            {
                continue;
            }
            float2 vel = v - float2(0.0, s);
            float2 param_23 = p;
            float2 param_24 = pos;
            float2 param_25 = pos - (vel * 0.039999999105930328369140625);
            float d = segment(param_23, param_24, param_25);
            col += ((mix(float3(_497.uColor), float3(1.0, 0.949999988079071044921875, 0.85000002384185791015625), float3(0.699999988079071044921875)) * (exp(((-d) * d) / ((w * w) * 0.5)) + (0.300000011920928955078125 * exp((-d) / (w * 3.0))))) * (1.0 - life));
        }
    }
    float3 param_26 = col;
    float4 _930 = glow(param_26);
    fragColor = _930;
}

fragment flair_tesla_arc_frag_out flair_tesla_arc_frag(constant FlairUniforms& _497 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_tesla_arc_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _942;
    if (_497.flair_flipY > 0.5)
    {
        _942 = _497.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _942 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _942);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _497);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

