// flair-metal-hash: c0a2e49e
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
    int uMode;
    float3 uMetal;
    packed_float3 uBill;
    float uDensity;
    float uSize;
    float uSpin;
    float uGlint;
    uint uPile;
    uint uDemo;
};

struct flair_money_rain_frag_out
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
float heapTop(thread const float& x, constant FlairUniforms& _287)
{
    float2 param = float2(x * 3.099999904632568359375, 2.2999999523162841796875);
    return (-0.5) + ((0.12999999523162841796875 * _287.uSize) * (0.4199999868869781494140625 + (0.579999983310699462890625 * vnoise(param))));
}

static inline __attribute__((always_inline))
bool pickBill(thread const float& h, constant FlairUniforms& _287)
{
    if (_287.uMode == 0)
    {
        return false;
    }
    if (_287.uMode == 1)
    {
        return true;
    }
    return h > 0.550000011920928955078125;
}

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float sdBox(thread const float2& p, thread const float2& b)
{
    float2 d = abs(p) - b;
    return length(fast::max(d, float2(0.0))) + fast::min(fast::max(d.x, d.y), 0.0);
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 paintBill(thread const float4& acc, thread const float2& dp, thread const float& r, thread const float& spin, thread const float& flutter, thread const float& seed, thread const float& depthDim, thread const float& fade, thread const float& px, constant FlairUniforms& _287)
{
    float squash = 0.2800000011920928955078125 + (0.7200000286102294921875 * abs(cos(flutter)));
    float param = spin;
    float2 q = rot(param) * dp;
    float curl = (0.2199999988079071044921875 * r) * sin((((q.x / fast::max(r, 9.9999997473787516355514526367188e-06)) * 3.2000000476837158203125) + (seed * 6.0)) + (_287.iTime * 2.7999999523162841796875));
    q.y += curl;
    q.y /= squash;
    float2 halfSize = float2(r * 1.35000002384185791015625, r * 0.63999998569488525390625);
    float2 param_1 = q;
    float2 param_2 = halfSize;
    float sd = sdBox(param_1, param_2);
    float cover = 1.0 - smoothstep(-px, px / squash, sd);
    if (cover <= 0.001000000047497451305389404296875)
    {
        return acc;
    }
    float2 uv = q / halfSize;
    float border = fast::max(smoothstep(0.7599999904632568359375, 0.839999973773956298828125, abs(uv.x)), smoothstep(0.660000026226043701171875, 0.7599999904632568359375, abs(uv.y)));
    float innerLine = fast::max(exp(-powr((abs(uv.x) - 0.819999992847442626953125) / 0.02999999932944774627685546875, 2.0)), exp(-powr((abs(uv.y) - 0.7200000286102294921875) / 0.039999999105930328369140625, 2.0)));
    float oval = 1.0 - smoothstep(0.36000001430511474609375, 0.439999997615814208984375, length(float2(uv.x * 1.25, uv.y * 1.35000002384185791015625)));
    float emblem = (1.0 - smoothstep(0.14000000059604644775390625, 0.20000000298023223876953125, length(float2(uv.x * 1.5, uv.y)))) * oval;
    float corners = (step(0.680000007152557373046875, abs(uv.x)) * step(0.550000011920928955078125, abs(uv.y))) * (1.0 - (border * 0.5));
    float3 paper = mix(float3(_287.uBill), float3(0.920000016689300537109375, 0.939999997615814208984375, 0.86000001430511474609375), float3(0.4199999868869781494140625));
    float3 ink = float3(_287.uBill) * 0.4199999868869781494140625;
    float3 col = mix(paper, float3(_287.uBill) * 0.7200000286102294921875, float3(border * 0.75));
    col = mix(col, ink, float3(fast::clamp(((innerLine * 0.550000011920928955078125) + (emblem * 0.64999997615814208984375)) + (corners * 0.3499999940395355224609375), 0.0, 1.0)));
    col = mix(col, paper * 1.059999942779541015625, float3((oval * 0.3499999940395355224609375) * (1.0 - emblem)));
    float curlShade = 0.819999992847442626953125 + (0.180000007152557373046875 * cos((((q.x / fast::max(r, 9.9999997473787516355514526367188e-06)) * 3.2000000476837158203125) + (seed * 6.0)) + (_287.iTime * 2.7999999523162841796875)));
    float tiltShade = (0.64999997615814208984375 + (0.3499999940395355224609375 * abs(cos(flutter)))) * ((cos(flutter) < 0.0) ? 0.85000002384185791015625 : 1.0);
    col *= (curlShade * tiltShade);
    col += ((float3(0.119999997317790985107421875) * _287.uGlint) * powr(1.0 - abs(cos(flutter)), 3.0));
    float4 param_3 = acc;
    float3 param_4 = fast::min(col * depthDim, float3(1.10000002384185791015625));
    float param_5 = cover * fade;
    return over(param_3, param_4, param_5);
}

static inline __attribute__((always_inline))
float4 paintCoin(thread const float4& acc, thread const float2& dp, thread const float& r, thread const float& spin, thread const float& flip, thread const float& depthDim, thread const float& fade, thread const float& px, constant FlairUniforms& _287)
{
    float c = cos(flip);
    float ac = abs(c);
    float squash = fast::max(ac, 0.100000001490116119384765625);
    float param = spin;
    float2 q = rot(param) * dp;
    float edgeOff = (((1.0 - ac) * 0.14000000059604644775390625) * r) * sign((c == 0.0) ? 1.0 : c);
    float2 qFront = float2(q.x / squash, q.y);
    float2 qBack = float2((q.x - edgeOff) / squash, q.y);
    float dFront = length(qFront) - r;
    float dBack = length(qBack) - r;
    float sd = fast::min(dFront, dBack);
    float cover = 1.0 - smoothstep(-px, px / squash, sd);
    if (cover <= 0.001000000047497451305389404296875)
    {
        return acc;
    }
    float2 u = qFront / float2(fast::max(r, 9.9999997473787516355514526367188e-06));
    float rad = length(u);
    bool onEdge = (dFront > 0.0) && (dBack <= 0.0);
    float3 darkMetal = _287.uMetal * float3(0.3400000035762786865234375, 0.2700000107288360595703125, 0.180000007152557373046875);
    float3 hiMetal = mix(_287.uMetal, float3(1.0, 0.980000019073486328125, 0.87999999523162841796875), float3(0.7200000286102294921875));
    float3 col;
    if (onEdge)
    {
        float ridges = 0.5 + (0.5 * sin(precise::atan2(qBack.y, qBack.x) * 28.0));
        col = mix(darkMetal, _287.uMetal * 0.85000002384185791015625, float3(ridges * 0.75));
    }
    else
    {
        float rim = smoothstep(0.7400000095367431640625, 0.819999992847442626953125, rad) * (1.0 - smoothstep(0.949999988079071044921875, 1.0, rad));
        float groove = exp(-powr((rad - 0.7599999904632568359375) / 0.04500000178813934326171875, 2.0));
        float bar = smoothstep(0.180000007152557373046875, 0.119999997317790985107421875, abs(u.x)) * smoothstep(0.519999980926513671875, 0.449999988079071044921875, abs(u.y));
        float ring = exp(-powr((rad - 0.4199999868869781494140625) / 0.070000000298023223876953125, 2.0)) * step(0.100000001490116119384765625, abs(u.x));
        float emboss = fast::clamp((rim + (fast::max(bar, ring) * 0.75)) - (groove * 0.800000011920928955078125), 0.0, 1.0);
        float2 n2 = (u * (0.699999988079071044921875 + (0.5 * rim))) + float2(0.0, emboss * 0.3499999940395355224609375);
        float3 n = fast::normalize(float3(n2.x * c, n2.y, fast::max(ac, 0.1500000059604644775390625)));
        float3 ldir = float3(-0.4478997886180877685546875, 0.646966397762298583984375, 0.617106378078460693359375);
        float diff = fast::clamp(dot(n, ldir), 0.0, 1.0);
        float3 hvec = fast::normalize(ldir + float3(0.0, 0.0, 1.0));
        float spec = powr(fast::max(dot(n, hvec), 0.0), 18.0);
        float sweep = powr(fast::max(0.0, 1.0 - (abs(sin((flip * 1.0) + 0.4000000059604644775390625)) * 3.5)), 2.0);
        float glint = ((spec * 1.10000002384185791015625) + ((sweep * 0.89999997615814208984375) * (1.0 - groove))) * _287.uGlint;
        col = mix(darkMetal, _287.uMetal, float3(0.3499999940395355224609375 + (0.75 * diff)));
        col = mix(col, darkMetal, float3(groove * 0.449999988079071044921875));
        col += (hiMetal * glint);
    }
    float4 param_1 = acc;
    float3 param_2 = fast::min(col * depthDim, float3(1.2000000476837158203125));
    float param_3 = cover * fade;
    return over(param_1, param_2, param_3);
}

static inline __attribute__((always_inline))
float4 paintPiece(thread const float4& acc, thread const float2& dp, thread const float& r, thread const float& spin, thread const float& flip, thread const float& seed, thread const bool& isBill, thread const float& depthDim, thread const float& fade, thread const float& px, constant FlairUniforms& _287)
{
    if (isBill)
    {
        float4 param = acc;
        float2 param_1 = dp;
        float param_2 = r;
        float param_3 = spin;
        float param_4 = flip;
        float param_5 = seed;
        float param_6 = depthDim;
        float param_7 = fade;
        float param_8 = px;
        return paintBill(param, param_1, param_2, param_3, param_4, param_5, param_6, param_7, param_8, _287);
    }
    float4 param_9 = acc;
    float2 param_10 = dp;
    float param_11 = r;
    float param_12 = spin;
    float param_13 = flip;
    float param_14 = depthDim;
    float param_15 = fade;
    float param_16 = px;
    return paintCoin(param_9, param_10, param_11, param_12, param_13, param_14, param_15, param_16, _287);
}

static inline __attribute__((always_inline))
float4 clickAt(thread const int& i, thread const bool& demo, thread const float& period, constant FlairUniforms& _287)
{
    bool _275 = !demo;
    bool _295;
    if (!_275)
    {
        _295 = _287.iClicks[0].w > 0.5;
    }
    else
    {
        _295 = _275;
    }
    if (_295)
    {
        return _287.iClicks[i];
    }
    float k = floor(_287.iTime / period) - float(i);
    float2 param = float2((k * 1.37000000476837158203125) + 0.5, 3.7000000476837158203125);
    float2 h = hash22(param);
    return float4((float2(0.20000000298023223876953125) + (h * 0.60000002384185791015625)) * float2(_287.iResolution[0], _287.iResolution[1]), k * period, 1.0);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _287)
{
    float px = 1.0 / _287.iResolution[1u];
    float2 p = (fragCoord - (float2(_287.iResolution[0], _287.iResolution[1]) * 0.5)) * px;
    float4 acc = float4(0.0);
    bool _1024 = _287.uPile != 0u;
    bool _1032;
    if (_1024)
    {
        _1032 = _287.uDensity > 0.00999999977648258209228515625;
    }
    else
    {
        _1032 = _1024;
    }
    bool _1043;
    if (_1032)
    {
        _1043 = p.y < ((-0.5) + (0.189999997615814208984375 * _287.uSize));
    }
    else
    {
        _1043 = _1032;
    }
    if (_1043)
    {
        float gs = 0.04500000178813934326171875 * _287.uSize;
        float2 gc = floor(p / float2(gs));
        for (int j = -1; j <= 1; j++)
        {
            for (int i = -1; i <= 1; i++)
            {
                float2 c = gc + float2(float(i), float(j));
                float2 param = c + float2(11.69999980926513671875);
                float2 h = hash22(param);
                float2 site = ((c + float2(0.25)) + (h * 0.5)) * gs;
                float param_1 = site.x;
                float top = heapTop(param_1, _287);
                if (site.y > top)
                {
                    continue;
                }
                float r = gs * (0.579999983310699462890625 + (0.2199999988079071044921875 * h.y));
                if (length(p - site) > (r * 1.5))
                {
                    continue;
                }
                float depth = fast::clamp((top - site.y) / fast::max(0.119999997317790985107421875 * _287.uSize, 0.0199999995529651641845703125), 0.0, 1.0);
                float dim = 1.0 - (0.550000011920928955078125 * depth);
                float param_2 = fract(h.x * 5.69999980926513671875);
                bool isBill = pickBill(param_2, _287);
                float flip = ((h.y - 0.5) * 1.2000000476837158203125) + (sin(((_287.iTime * 0.800000011920928955078125) * _287.uSpin) + (h.x * 12.0)) * 0.1500000059604644775390625);
                float4 param_3 = acc;
                float2 param_4 = p - site;
                float param_5 = r;
                float param_6 = h.x * 6.283185482025146484375;
                float param_7 = flip;
                float param_8 = (c.x * 3.099999904632568359375) + c.y;
                bool param_9 = isBill;
                float param_10 = dim;
                float param_11 = 1.0;
                float param_12 = px;
                acc = paintPiece(param_3, param_4, param_5, param_6, param_7, param_8, param_9, param_10, param_11, param_12, _287);
            }
        }
    }
    if (_287.uDensity > 0.001000000047497451305389404296875)
    {
        for (int l = 1; l >= 0; l--)
        {
            float fl = float(l);
            float sc = 1.0 - (0.2800000011920928955078125 * fl);
            float dim_1 = 1.0 - (0.20000000298023223876953125 * fl);
            float cs = (0.12999999523162841796875 * _287.uSize) * sc;
            float fallSpeed = 0.37999999523162841796875 + (0.119999997317790985107421875 * (1.0 - fl));
            float2 q = (p + float2(fl * 0.37000000476837158203125, _287.iTime * fallSpeed)) / float2(cs);
            float2 gc_1 = floor(q);
            for (int j_1 = -1; j_1 <= 1; j_1++)
            {
                for (int i_1 = -1; i_1 <= 1; i_1++)
                {
                    float2 id = gc_1 + float2(float(i_1), float(j_1));
                    float2 param_13 = id + float2(fl * 19.299999237060546875);
                    float2 param_14 = (id * 2.099999904632568359375) + float2(fl * 7.69999980926513671875);
                    float4 h_1 = float4(hash22(param_13), hash22(param_14));
                    if (h_1.x > _287.uDensity)
                    {
                        continue;
                    }
                    float param_15 = h_1.y;
                    bool isBill_1 = pickBill(param_15, _287);
                    float sway = (isBill_1 ? 0.3499999940395355224609375 : 0.119999997317790985107421875) * sin((_287.iTime * (1.60000002384185791015625 + (1.2000000476837158203125 * h_1.z))) + (h_1.w * 6.283185482025146484375));
                    float2 center = (((id + float2(0.20000000298023223876953125)) + (h_1.zw * 0.60000002384185791015625)) + float2(sway, 0.0)) * cs;
                    float2 dp = (q * cs) - center;
                    float r_1 = ((0.0320000015199184417724609375 * _287.uSize) * sc) * (0.819999992847442626953125 + (0.3499999940395355224609375 * h_1.y));
                    if (length(dp) > (r_1 * 1.5))
                    {
                        continue;
                    }
                    float spin = (h_1.w * 6.283185482025146484375) + (((_287.iTime * _287.uSpin) * (isBill_1 ? 1.2000000476837158203125 : 2.2000000476837158203125)) * ((h_1.z < 0.5) ? 1.0 : (-1.0)));
                    float flip_1 = (h_1.z * 6.283185482025146484375) + (((_287.iTime * _287.uSpin) * (isBill_1 ? 3.2000000476837158203125 : 4.80000019073486328125)) * (0.699999988079071044921875 + (0.60000002384185791015625 * h_1.y)));
                    float4 param_16 = acc;
                    float2 param_17 = dp;
                    float param_18 = r_1;
                    float param_19 = spin;
                    float param_20 = flip_1;
                    float param_21 = (id.x * 5.30000019073486328125) + id.y;
                    bool param_22 = isBill_1;
                    float param_23 = dim_1;
                    float param_24 = 1.0;
                    float param_25 = px;
                    acc = paintPiece(param_16, param_17, param_18, param_19, param_20, param_21, param_22, param_23, param_24, param_25, _287);
                }
            }
        }
    }
    for (int i_2 = 3; i_2 >= 0; i_2--)
    {
        int param_26 = i_2;
        bool param_27 = _287.uDemo != 0u;
        float param_28 = 3.0;
        float4 c_1 = clickAt(param_26, param_27, param_28, _287);
        if (c_1.w < 0.5)
        {
            continue;
        }
        float age = _287.iTime - c_1.z;
        if ((age < 0.0) || (age > 3.2000000476837158203125))
        {
            continue;
        }
        float2 origin = (c_1.xy - (float2(_287.iResolution[0], _287.iResolution[1]) * 0.5)) * px;
        float e = (1.0 - exp((-2.400000095367431640625) * age)) / 2.400000095367431640625;
        float drop = 0.4199999868869781494140625 * (age - e);
        float maxReach = ((0.949999988079071044921875 * e) + drop) + (0.100000001490116119384765625 * _287.uSize);
        if (length((p - origin) + float2(0.0, drop * 0.5)) > maxReach)
        {
            continue;
        }
        float fade = 1.0 - smoothstep(2.5, 3.2000000476837158203125, age);
        for (int j_2 = 0; j_2 < 18; j_2++)
        {
            float fj = float(j_2);
            float2 param_29 = float2((fj * 3.7000000476837158203125) + 1.0, c_1.z);
            float2 param_30 = float2(c_1.z * 1.89999997615814208984375, fj * 7.099999904632568359375);
            float4 h_2 = float4(hash22(param_29), hash22(param_30));
            float ang = h_2.x * 6.283185482025146484375;
            float speed = 0.449999988079071044921875 + (0.550000011920928955078125 * h_2.y);
            float2 v0 = float2(cos(ang), (sin(ang) * 0.800000011920928955078125) + 0.3499999940395355224609375) * speed;
            float2 pos = (origin + (v0 * e)) - float2(0.0, (0.3499999940395355224609375 + (0.1500000059604644775390625 * h_2.z)) * (age - e));
            float2 dp_1 = p - pos;
            float r_2 = (0.02999999932944774627685546875 * _287.uSize) * (0.800000011920928955078125 + (0.3499999940395355224609375 * h_2.w));
            bool _1623 = abs(dp_1.x) > (r_2 * 1.5);
            bool _1633;
            if (!_1623)
            {
                _1633 = abs(dp_1.y) > (r_2 * 1.5);
            }
            else
            {
                _1633 = _1623;
            }
            if (_1633)
            {
                continue;
            }
            float param_31 = h_2.z;
            bool isBill_2 = pickBill(param_31, _287);
            float spin_1 = (h_2.w * 6.283185482025146484375) + (((age * _287.uSpin) * 3.0) * ((h_2.x < 0.5) ? 1.0 : (-1.0)));
            float flip_2 = (h_2.z * 6.283185482025146484375) + ((age * _287.uSpin) * 6.0);
            float4 param_32 = acc;
            float2 param_33 = dp_1;
            float param_34 = r_2;
            float param_35 = spin_1;
            float param_36 = flip_2;
            float param_37 = fj + c_1.z;
            bool param_38 = isBill_2;
            float param_39 = 1.0;
            float param_40 = fade;
            float param_41 = px;
            acc = paintPiece(param_32, param_33, param_34, param_35, param_36, param_37, param_38, param_39, param_40, param_41, _287);
        }
    }
    float4 param_42 = acc;
    fragColor = unpremultiply(param_42);
}

fragment flair_money_rain_frag_out flair_money_rain_frag(constant FlairUniforms& _287 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_money_rain_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1709;
    if (_287.flair_flipY > 0.5)
    {
        _1709 = _287.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1709 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1709);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _287);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

