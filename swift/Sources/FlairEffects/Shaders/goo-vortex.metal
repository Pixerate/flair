// flair-metal-hash: 20275353
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
    packed_float3 uBackground;
    float uSpin;
    float uWidth;
    int uArms;
    float uSplat;
    float uGloss;
    float uBackgroundAlpha;
};

struct flair_goo_vortex_frag_out
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
float smin(thread const float& a, thread const float& b, thread const float& k)
{
    float h = fast::clamp(0.5 + ((0.5 * (b - a)) / k), 0.0, 1.0);
    return mix(b, a, h) - ((k * h) * (1.0 - h));
}

static inline __attribute__((always_inline))
float smax(thread const float& a, thread const float& b, thread const float& k)
{
    float param = -a;
    float param_1 = -b;
    float param_2 = k;
    return -smin(param, param_1, param_2);
}

static inline __attribute__((always_inline))
float2 meld(thread const float2& a, thread const float2& b, thread const float& k)
{
    float h = fast::clamp(0.5 + ((0.5 * (b.x - a.x)) / k), 0.0, 1.0);
    return float2(mix(b.x, a.x, h) - ((k * h) * (1.0 - h)), mix(b.y, a.y, smoothstep(0.300000011920928955078125, 0.699999988079071044921875, h)));
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
float splatSd(thread const float2& q, thread const float& seed, thread const float& age, thread const float2& dir)
{
    float grow = 1.0 - exp((-age) * 14.0);
    float wob = (0.25 * exp((-age) * 5.0)) * cos(age * 24.0);
    float s = mix(0.449999988079071044921875, 1.0, grow);
    float2 L = float2(dot(q, dir), dot(q, float2(-dir.y, dir.x)));
    float2 b = (L / float2(1.0 - wob, 1.0 + wob)) / float2(s);
    float d = length(b) - 0.5;
    for (int k = 0; k < 5; k++)
    {
        float2 param = float2(seed, float(k) + 0.5);
        float2 h = hash22(param);
        float a = h.x * 6.28318023681640625;
        float2 param_1 = h + float2(seed);
        float param_2 = d;
        float param_3 = (length(b - (float2(cos(a), sin(a)) * (0.300000011920928955078125 + (0.300000011920928955078125 * h.y)))) - 0.1599999964237213134765625) - (0.119999997317790985107421875 * hash12(param_1));
        float param_4 = 0.20000000298023223876953125;
        d = smin(param_2, param_3, param_4);
    }
    float2 param_5 = (b * 3.5) + float2(seed);
    d = (d + ((vnoise(param_5) - 0.5) * 0.07999999821186065673828125)) * s;
    for (int k_1 = 0; k_1 < 4; k_1++)
    {
        float2 param_6 = float2(seed + 3.2999999523162841796875, float(k_1) + 0.5);
        float2 param_7 = float2(float(k_1) * 2.099999904632568359375, seed);
        float3 h_1 = float3(hash22(param_6), hash12(param_7));
        float a_1 = (h_1.x - 0.5) * 2.2000000476837158203125;
        float2 rd = float2(cos(a_1), sin(a_1));
        float len = (0.5 + (0.550000011920928955078125 * h_1.y)) * grow;
        float2 param_8 = L;
        float2 param_9 = rd * 0.300000011920928955078125;
        float2 param_10 = rd * len;
        float2 sg = segment(param_8, param_9, param_10);
        float param_11 = d;
        float param_12 = sg.x - mix(0.17000000178813934326171875, 0.070000000298023223876953125, sg.y);
        float param_13 = 0.14000000059604644775390625;
        d = smin(param_11, param_12, param_13);
        float param_14 = d;
        float param_15 = (length(L - (rd * len)) - 0.100000001490116119384765625) - (0.0500000007450580596923828125 * h_1.z);
        float param_16 = 0.07999999821186065673828125;
        d = smin(param_14, param_15, param_16);
        d = fast::min(d, length(L - (rd * (len + ((0.20000000298023223876953125 + (0.20000000298023223876953125 * h_1.z)) * grow)))) - ((0.0500000007450580596923828125 + (0.0599999986588954925537109375 * h_1.z)) * grow));
    }
    for (int j = 0; j < 2; j++)
    {
        float2 param_17 = float2(seed + 6.099999904632568359375, float(j) + 0.5);
        float2 h_2 = hash22(param_17);
        float2 top = float2((h_2.x - 0.5) * 0.800000011920928955078125, -0.300000011920928955078125);
        float len_1 = (0.300000011920928955078125 + (0.800000011920928955078125 * h_2.y)) * (1.0 - exp((-fast::max(age - 0.300000011920928955078125, 0.0)) * 0.60000002384185791015625));
        float w = 0.07999999821186065673828125;
        float2 param_18 = q;
        float2 param_19 = top;
        float2 param_20 = top - float2(0.0, len_1);
        float2 sg_1 = segment(param_18, param_19, param_20);
        float param_21 = d;
        float param_22 = sg_1.x - (w * mix(1.0, 0.699999988079071044921875, sg_1.y));
        float param_23 = 0.100000001490116119384765625;
        d = smin(param_21, param_22, param_23);
        float param_24 = d;
        float param_25 = length((q - top) + float2(0.0, len_1 + (w * 0.4000000059604644775390625))) - (w * 1.39999997615814208984375);
        float param_26 = 0.0500000007450580596923828125;
        d = smin(param_24, param_25, param_26);
    }
    return d;
}

static inline __attribute__((always_inline))
float2 vortex(thread const float2& p, thread const float& T, thread const float& aspect, constant FlairUniforms& _711)
{
    float N = float(_711.uArms);
    float r = fast::max(length(p), 9.9999997473787516355514526367188e-05);
    float lr = log(r);
    float ang = precise::atan2(p.y, p.x);
    float fl = smoothstep(2.4500000476837158203125, 3.2999999523162841796875, T);
    float c = mix(2.400000095367431640625, 0.4000000059604644775390625, fl);
    float f = (((ang - ((_711.uSpin * T) * 2.2000000476837158203125)) - (c * lr)) * N) / 6.28318023681640625;
    float idx = floor(f + 0.5);
    float del = ((f - idx) * 6.28318023681640625) / N;
    float perp = (r * del) / sqrt(1.0 + (c * c));
    float arm = mod(idx, N);
    float other = mod(mod(idx + ((del > 0.0) ? 1.0 : (-1.0)), N), 2.0);
    float colour = mix(mod(arm, 2.0), other, 0.5 * smoothstep((3.141590118408203125 / N) - 0.0500000007450580596923828125, 3.141590118408203125 / N, abs(del)));
    float w = (_711.uWidth * (0.3499999940395355224609375 + (0.64999997615814208984375 * smoothstep(0.0, 0.300000011920928955078125, r)))) * (0.64999997615814208984375 + (0.3499999940395355224609375 * cos(((lr * 10.0) - (T * 6.0)) + (arm * 3.400000095367431640625))));
    float2 param = float2((lr * 7.0) + (arm * 3.099999904632568359375), (arm * 1.2999999523162841796875) + 2.0);
    float brk = vnoise(param);
    w *= smoothstep((fl * 1.10000002384185791015625) - 0.100000001490116119384765625, (fl * 1.10000002384185791015625) + 0.100000001490116119384765625, brk);
    float e = fast::clamp(T / 2.400000095367431640625, 0.0, 1.0);
    float head = mix(1.0499999523162841796875, 0.02999999932944774627685546875, 1.0 - ((1.0 - e) * (1.0 - e))) + ((fl * fl) * 1.2999999523162841796875);
    float param_1 = abs(perp) - w;
    float param_2 = head - r;
    float param_3 = _711.uWidth * 0.800000011920928955078125;
    float2 res = float2(smax(param_1, param_2, param_3), colour);
    float ballR = (0.119999997317790985107421875 * smoothstep(1.60000002384185791015625, 2.5, T)) * (1.0 - smoothstep(2.650000095367431640625, 2.9500000476837158203125, T));
    if (ballR > 0.0)
    {
        float2 param_4 = res;
        float2 param_5 = float2(r - (ballR * (1.0 + (0.0599999986588954925537109375 * sin((ang * 3.0) + (T * 9.0))))), colour);
        float param_6 = 0.039999999105930328369140625;
        res = meld(param_4, param_5, param_6);
    }
    int count = int((_711.uSplat * 12.0) + 0.5);
    float ds;
    float _1078;
    for (int k = 0; k < 12; k++)
    {
        if (k >= count)
        {
            break;
        }
        float2 param_7 = float2(float(k) + 0.5, 3.099999904632568359375);
        float2 param_8 = float2(5.69999980926513671875, float(k) * 1.2999999523162841796875);
        float3 h = float3(hash22(param_7), hash12(param_8));
        float a0 = ((float(k) * 2.399960041046142578125) + (h.x * 0.800000011920928955078125)) + 0.60000002384185791015625;
        float2 rest = float2((cos(a0) * 0.5) * aspect, sin(a0) * 0.5) * (0.3499999940395355224609375 + (0.550000011920928955078125 * h.y));
        float2 dir = fast::normalize(rest);
        float R = (0.064999997615814208984375 + (0.0599999986588954925537109375 * h.z)) * (0.699999988079071044921875 + (0.5 * _711.uSplat));
        float age = (T - 2.75) - (0.119999997317790985107421875 * h.y);
        if (age < 0.0)
        {
            continue;
        }
        float ff = fast::min(age / 0.300000011920928955078125, 1.0);
        float2 pos = rest * (1.0 - ((1.0 - ff) * (1.0 - ff)));
        if (age < 0.300000011920928955078125)
        {
            float2 param_9 = p;
            float2 param_10 = pos - (((dir * R) * 2.5) * (1.0 - ff));
            float2 param_11 = pos;
            float2 sg = segment(param_9, param_10, param_11);
            ds = sg.x - ((R * 0.60000002384185791015625) * (0.699999988079071044921875 + (0.300000011920928955078125 * sg.y)));
        }
        else
        {
            float2 q = (p - pos) / float2(R);
            float lq = length(q);
            if (lq > 3.400000095367431640625)
            {
                _1078 = lq - 2.7999999523162841796875;
            }
            else
            {
                float2 param_12 = q;
                float param_13 = (float(k) * 7.30000019073486328125) + 1.0;
                float param_14 = age - 0.300000011920928955078125;
                float2 param_15 = dir;
                _1078 = splatSd(param_12, param_13, param_14, param_15);
            }
            ds = _1078 * R;
        }
        float2 param_16 = res;
        float2 param_17 = float2(ds, mod(float(k), 2.0));
        float param_18 = 0.014999999664723873138427734375;
        res = meld(param_16, param_17, param_18);
    }
    return res;
}

static inline __attribute__((always_inline))
float3 gooShade(thread const float3& goo, thread const float3& n, thread const float& thick, thread const float& gloss)
{
    float3 light = float3(-0.36000001430511474609375, 0.4799999892711639404296875, 0.800000011920928955078125);
    float3 col = mix(goo * 1.14999997615814208984375, goo * 0.62000000476837158203125, float3(thick * 0.60000002384185791015625)) * (0.7799999713897705078125 + (0.2199999988079071044921875 * dot(n, light)));
    col = mix(col, float3(1.0), float3(powr(1.0 - n.z, 2.0) * 0.3499999940395355224609375));
    col *= (1.0 - ((0.25 * smoothstep(0.0, 0.60000002384185791015625, -n.y)) * (1.0 - thick)));
    float rz = fast::max(reflect(-light, n).z, 0.0);
    return fast::min(col + float3(gloss * ((powr(rz, 40.0) * 0.89999997615814208984375) + (powr(rz, 6.0) * 0.119999997317790985107421875))), float3(1.0));
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _711)
{
    float px = 1.0 / _711.iResolution[1u];
    float aspect = _711.iResolution[0u] / _711.iResolution[1u];
    float2 p = (fragCoord - (float2(_711.iResolution[0], _711.iResolution[1]) * 0.5)) * px;
    float T = mod(_711.iTime, 6.0);
    float fade = 1.0 - smoothstep(5.19999980926513671875, 5.94999980926513671875, T);
    float3 bg = float3(_711.uBackground) * (1.059999942779541015625 - (0.2199999988079071044921875 * dot(p, p)));
    float2 param = p + float2(-0.01200000010430812835693359375, 0.02199999988079071044921875);
    float param_1 = T;
    float param_2 = aspect;
    float dS = vortex(param, param_1, param_2, _711).x;
    bg *= (1.0 - ((0.300000011920928955078125 * smoothstep(0.02999999932944774627685546875, -0.0199999995529651641845703125, dS)) * fade));
    float2 param_3 = p;
    float param_4 = T;
    float param_5 = aspect;
    float2 v = vortex(param_3, param_4, param_5, _711);
    float cover = fast::clamp(0.5 - (v.x / px), 0.0, 1.0) * fade;
    float3 col = bg;
    if (cover > 0.0)
    {
        float eps = px;
        float2 param_6 = p + float2(eps, 0.0);
        float param_7 = T;
        float param_8 = aspect;
        float2 param_9 = p + float2(0.0, eps);
        float param_10 = T;
        float param_11 = aspect;
        float2 g = float2(vortex(param_6, param_7, param_8, _711).x, vortex(param_9, param_10, param_11, _711).x) - float2(v.x);
        g /= float2(eps);
        float3 n = fast::normalize(float3((g * exp(fast::min(v.x, 0.0) / (_711.uWidth * 1.10000002384185791015625))) * 1.60000002384185791015625, 1.0));
        float thick = smoothstep(0.0, (-_711.uWidth) * 1.2000000476837158203125, v.x);
        float3 param_12 = mix(_711.uColorA, _711.uColorB, float3(v.y));
        float3 param_13 = n;
        float param_14 = thick;
        float param_15 = _711.uGloss;
        col = mix(bg, gooShade(param_12, param_13, param_14, param_15), float3(cover));
    }
    fragColor = float4(col, 1.0);
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _1335;
    if (a > 0.0)
    {
        _1335 = bg + (d / float3(a));
    }
    else
    {
        _1335 = bg;
    }
    float3 fg = _1335;
    float alpha = a + (opacity * (1.0 - a));
    float3 _1357;
    if (alpha > 0.0)
    {
        _1357 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _1357 = bg;
    }
    float3 col = _1357;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _711)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _711);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_711.uBackground);
    float param_4 = _711.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_goo_vortex_frag_out flair_goo_vortex_frag(constant FlairUniforms& _711 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_goo_vortex_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1414;
    if (_711.flair_flipY > 0.5)
    {
        _1414 = _711.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1414 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1414);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _711);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

