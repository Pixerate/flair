// flair-metal-hash: 96583275
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
    packed_float3 uColor;
    float uRate;
    int uBranches;
    float uRough;
    float uWidth;
    float uFlash;
    float uAfterglow;
};

struct flair_lightning_frag_out
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
float strikeLevel(thread const float& age, thread const float& seed)
{
    if ((age < 0.0) || (age > 0.3499999940395355224609375))
    {
        return 0.0;
    }
    if (age < 0.039999999105930328369140625)
    {
        return 1.0;
    }
    float2 param = float2(floor(age * 30.0), seed);
    float flick = 0.300000011920928955078125 + (0.699999988079071044921875 * step(0.449999988079071044921875, hash12(param)));
    return flick * (1.0 - (age * 1.7000000476837158203125));
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
    float _254 = zigzag(param, param_1);
    return (_254 * rough) * env;
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
float2 arcPoint(thread const float2& a, thread const float2& b, thread const float& t, thread const float& seed, thread const float& rough, thread const float& open)
{
    float2 ab = b - a;
    float param = t;
    float param_1 = seed;
    float param_2 = rough;
    float param_3 = open;
    return (a + (ab * t)) + (float2(-ab.y, ab.x) * arcKick(param, param_1, param_2, param_3));
}

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float3 bolt(thread const float2& p, thread const float2& a, thread const float2& b, thread const float& seed, thread const float& age, thread const float& px, thread float& flash, constant FlairUniforms& _591)
{
    if ((age < 0.0) || (age > 2.2000000476837158203125))
    {
        return float3(0.0);
    }
    float param = age;
    float param_1 = seed;
    float on = strikeLevel(param, param_1);
    float level0 = fast::max(on, (_591.uAfterglow * 0.449999988079071044921875) * exp((-age) * 1.60000002384185791015625));
    if (level0 < 0.00200000009499490261077880859375)
    {
        return float3(0.0);
    }
    flash += on;
    float reach = fast::clamp(age / 0.070000000298023223876953125, 0.0, 1.0) * 1.0499999523162841796875;
    float w = fast::max((0.002199999988079071044921875 * _591.uWidth) * mix(0.60000002384185791015625, 1.0, on), 0.699999988079071044921875 * px);
    float2 param_2 = p;
    float2 param_3 = a;
    float2 param_4 = b;
    float param_5 = seed;
    float param_6 = _591.uRough;
    float param_7 = 0.0;
    float2 m = arcDist(param_2, param_3, param_4, param_5, param_6, param_7);
    float param_8 = m.x;
    float param_9 = w;
    float3 param_10 = float3(_591.uColor);
    float3 col = (arcLight(param_8, param_9, param_10) * level0) * smoothstep(reach, reach - 0.02999999932944774627685546875, m.y);
    col += (((float3(_591.uColor) * exp((-length(p - b)) / 0.02999999932944774627685546875)) * on) * smoothstep(0.949999988079071044921875, 1.0, reach));
    float2 dir = fast::normalize(b - a);
    float len = length(b - a);
    for (int j = 0; j < 4; j++)
    {
        if (j >= _591.uBranches)
        {
            break;
        }
        float fj = float(j);
        float2 param_11 = float2(seed, fj + 1.2999999523162841796875);
        float2 param_12 = float2(fj + 3.099999904632568359375, seed);
        float2 param_13 = float2(seed + fj, 7.69999980926513671875);
        float3 h = float3(hash12(param_11), hash12(param_12), hash12(param_13));
        float t0 = 0.119999997317790985107421875 + (0.60000002384185791015625 * h.x);
        float prog = ((reach - t0) / (1.0 - t0)) * 1.2000000476837158203125;
        if (prog <= 0.0)
        {
            continue;
        }
        float2 param_14 = a;
        float2 param_15 = b;
        float param_16 = t0;
        float param_17 = seed;
        float param_18 = _591.uRough;
        float param_19 = 0.0;
        float2 s = arcPoint(param_14, param_15, param_16, param_17, param_18, param_19);
        float turn = ((h.y < 0.5) ? (-1.0) : 1.0) * (0.3499999940395355224609375 + (0.550000011920928955078125 * fract(h.y * 7.0)));
        float param_20 = turn;
        float2 bdir = rot(param_20) * dir;
        float blen = (len * (1.0 - t0)) * (0.25 + (0.3499999940395355224609375 * h.z));
        float2 e = s + (bdir * blen);
        float bseed = (seed + (fj * 5.30000019073486328125)) + 1.0;
        float2 param_21 = p;
        float2 param_22 = s;
        float2 param_23 = e;
        float param_24 = bseed;
        float param_25 = _591.uRough * 1.2999999523162841796875;
        float param_26 = 1.0;
        float2 d = arcDist(param_21, param_22, param_23, param_24, param_25, param_26);
        float shown = smoothstep(prog, prog - 0.0500000007450580596923828125, d.y);
        float param_27 = d.x;
        float param_28 = w * 0.60000002384185791015625;
        float3 param_29 = float3(_591.uColor);
        col += ((((arcLight(param_27, param_28, param_29) * level0) * 0.60000002384185791015625) * (1.0 - (0.800000011920928955078125 * d.y))) * shown);
        float t1 = 0.300000011920928955078125 + (0.4000000059604644775390625 * fract(h.z * 11.0));
        float2 param_30 = s;
        float2 param_31 = e;
        float param_32 = t1;
        float param_33 = bseed;
        float param_34 = _591.uRough * 1.2999999523162841796875;
        float param_35 = 1.0;
        float2 s2 = arcPoint(param_30, param_31, param_32, param_33, param_34, param_35);
        float param_36 = (-turn) * 0.89999997615814208984375;
        float2 e2 = s2 + ((((rot(param_36) * bdir) * blen) * (1.0 - t1)) * 0.60000002384185791015625);
        float2 param_37 = p;
        float2 param_38 = s2;
        float2 param_39 = e2;
        float param_40 = bseed + 2.7000000476837158203125;
        float param_41 = _591.uRough * 1.5;
        float param_42 = 1.0;
        float2 d2 = arcDist(param_37, param_38, param_39, param_40, param_41, param_42);
        float param_43 = d2.x;
        float param_44 = w * 0.4000000059604644775390625;
        float3 param_45 = float3(_591.uColor);
        col += ((((arcLight(param_43, param_44, param_45) * level0) * 0.3499999940395355224609375) * (1.0 - d2.y)) * smoothstep(prog, prog - 0.0500000007450580596923828125, t1 + (d2.y * 0.300000011920928955078125)));
    }
    return col;
}

static inline __attribute__((always_inline))
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _591)
{
    float px = 1.0 / _591.iResolution[1u];
    float2 p = fragCoord * px;
    float aspect = _591.iResolution[0u] * px;
    float3 col = float3(0.0);
    float flash = 0.0;
    if (_591.uRate > 0.0)
    {
        float slot = 1.0 / _591.uRate;
        float k0 = floor(_591.iTime / slot);
        for (int i = 0; i < 5; i++)
        {
            float k = k0 - float(i);
            if ((float(i - 1) * slot) > 2.2000000476837158203125)
            {
                break;
            }
            float2 param = float2(k, 9.1000003814697265625);
            if (hash12(param) > 0.800000011920928955078125)
            {
                continue;
            }
            float2 param_1 = float2(k, 3.2999999523162841796875);
            float2 h = hash22(param_1);
            float2 param_2 = float2(k, 5.900000095367431640625);
            float2 g = hash22(param_2);
            float2 a = float2((0.100000001490116119384765625 + (0.800000011920928955078125 * h.y)) * aspect, 1.0499999523162841796875);
            float2 b = float2(a.x + ((g.x - 0.5) * 0.699999988079071044921875), (0.3499999940395355224609375 * g.y) - 0.0500000007450580596923828125);
            float2 param_3 = p;
            float2 param_4 = a;
            float2 param_5 = b;
            float param_6 = (k * 1.37000000476837158203125) + 0.5;
            float param_7 = _591.iTime - ((k + (0.699999988079071044921875 * h.x)) * slot);
            float param_8 = px;
            float param_9 = flash;
            float3 _1079 = bolt(param_3, param_4, param_5, param_6, param_7, param_8, param_9, _591);
            flash = param_9;
            col += _1079;
        }
    }
    for (int i_1 = 0; i_1 < 4; i_1++)
    {
        float4 c = _591.iClicks[i_1];
        if (c.w < 0.5)
        {
            continue;
        }
        float2 b_1 = c.xy * px;
        float2 param_10 = float2(c.z, 1.89999997615814208984375);
        float2 a_1 = float2(b_1.x + ((hash12(param_10) - 0.5) * 0.5), 1.0499999523162841796875);
        float2 param_11 = p;
        float2 param_12 = a_1;
        float2 param_13 = b_1;
        float param_14 = (fract(c.z * 0.731000006198883056640625) * 97.0) + float(i_1);
        float param_15 = _591.iTime - c.z;
        float param_16 = px;
        float param_17 = flash;
        float3 _1151 = bolt(param_11, param_12, param_13, param_14, param_15, param_16, param_17, _591);
        flash = param_17;
        col += _1151;
    }
    col += (((mix(float3(_591.uColor), float3(1.0), float3(0.300000011920928955078125)) * _591.uFlash) * fast::min(flash, 1.5)) * (0.100000001490116119384765625 + (0.25 * p.y)));
    float3 param_18 = col;
    float4 _1177 = glow(param_18);
    fragColor = _1177;
}

fragment flair_lightning_frag_out flair_lightning_frag(constant FlairUniforms& _591 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_lightning_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1189;
    if (_591.flair_flipY > 0.5)
    {
        _1189 = _591.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1189 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1189);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _591);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

