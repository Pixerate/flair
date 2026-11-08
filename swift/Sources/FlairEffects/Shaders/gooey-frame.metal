// flair-metal-hash: 0ab1616d
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
    packed_float3 uColor;
    float uInset;
    float uRadius;
    float uThickness;
    float uDrips;
    float uWobble;
    float uGloss;
    uint uShadow;
};

struct flair_gooey_frame_frag_out
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
float boxSdf(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
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
float smin(thread const float& a, thread const float& b, thread const float& k)
{
    float h = fast::clamp(0.5 + ((0.5 * (b - a)) / k), 0.0, 1.0);
    return mix(b, a, h) - ((k * h) * (1.0 - h));
}

static inline __attribute__((always_inline))
float gooFrame(thread const float2& p, thread const float2& box, thread const float& rad, thread const float& T, constant FlairUniforms& _423)
{
    float ph = (6.28318023681640625 * T) / 8.0;
    float2 param = (p * 6.0) + (float2(cos(ph), sin(ph)) * 1.2999999523162841796875);
    float n1 = vnoise(param);
    float2 param_1 = ((p * 14.0) + (float2(cos((2.0 * ph) + 1.0), sin((2.0 * ph) + 1.0)) * 0.89999997615814208984375)) + float2(9.0);
    float n2 = vnoise(param_1);
    float th = _423.uThickness * (1.0 + (_423.uWobble * (((n1 - 0.5) * 1.10000002384185791015625) + ((n2 - 0.5) * 0.4000000059604644775390625))));
    th *= mix(1.0, 1.35000002384185791015625, smoothstep(0.20000000298023223876953125, -1.0, p.y / box.y));
    float2 param_2 = p;
    float2 param_3 = box;
    float param_4 = rad;
    float d = abs(boxSdf(param_2, param_3, param_4) + (((_423.uWobble * _423.uThickness) * (n2 - 0.5)) * 0.800000011920928955078125)) - th;
    float _579;
    float _601;
    float _614;
    float _646;
    float _693;
    float _733;
    for (int k = 0; k < 12; k++)
    {
        float2 param_5 = float2(float(k) + 0.5, 7.30000019073486328125);
        float2 param_6 = float2(4.099999904632568359375, (float(k) * 1.89999997615814208984375) + 0.300000011920928955078125);
        float3 h = float3(hash22(param_5), hash12(param_6));
        if (h.z > _423.uDrips)
        {
            continue;
        }
        float cyc = mod(T + (h.x * 8.0), 8.0);
        float which = floor(cyc / 4.0);
        float a = cyc - (which * 4.0);
        float2 param_7 = float2((float(k) * 3.099999904632568359375) + (which * 17.0), 2.2000000476837158203125);
        float2 hh = hash22(param_7);
        bool top = hh.y < 0.300000011920928955078125;
        float x = ((hh.x * 2.0) - 1.0) * fast::max((box.x - rad) - (_423.uThickness * 2.0), 0.0);
        if (abs(p.x - x) > 0.119999997317790985107421875)
        {
            continue;
        }
        if (top)
        {
            _579 = box.y;
        }
        else
        {
            _579 = -box.y;
        }
        float y0 = _579;
        float grow = smoothstep(0.0, 0.800000011920928955078125, a);
        if (top)
        {
            _601 = 1.0 - smoothstep(2.7999999523162841796875, 3.900000095367431640625, a);
        }
        else
        {
            _601 = 1.0;
        }
        float w = (_423.uThickness * (0.60000002384185791015625 + (0.3499999940395355224609375 * h.y))) * _601;
        if (top)
        {
            _614 = 0.0500000007450580596923828125 + (0.100000001490116119384765625 * h.y);
        }
        else
        {
            _614 = 0.070000000298023223876953125 + (0.1500000059604644775390625 * h.y);
        }
        float lmax = _614;
        float run = smoothstep(0.60000002384185791015625, 2.599999904632568359375, a);
        bool dropped = (!top) && (a > 2.599999904632568359375);
        if (dropped)
        {
            _646 = 1.0 - smoothstep(2.599999904632568359375, 3.2999999523162841796875, a);
        }
        else
        {
            _646 = 1.0;
        }
        float len = (lmax * run) * _646;
        float2 param_8 = p;
        float2 param_9 = float2(x, y0);
        float2 param_10 = float2(x, y0 - len);
        float2 sg = segment(param_8, param_9, param_10);
        float param_11 = d;
        float param_12 = sg.x - ((w * mix(0.800000011920928955078125, 0.5, sg.y)) * grow);
        float param_13 = ((w * 1.2000000476837158203125) * grow) + 9.9999997473787516355514526367188e-05;
        d = smin(param_11, param_12, param_13);
        if (dropped)
        {
            _693 = (1.25 * (a - 2.599999904632568359375)) * (a - 2.599999904632568359375);
        }
        else
        {
            _693 = 0.0;
        }
        float fall = _693;
        float2 bead = float2(x, ((y0 - (lmax * run)) - fall) - (w * 0.300000011920928955078125));
        float db = length((p - bead) * float2(1.0, 0.85000002384185791015625)) - (w * mix(0.800000011920928955078125, 1.5, grow));
        if (dropped)
        {
            _733 = fast::min(d, db);
        }
        else
        {
            float param_14 = d;
            float param_15 = db;
            float param_16 = ((w * 0.800000011920928955078125) * grow) + 9.9999997473787516355514526367188e-05;
            _733 = smin(param_14, param_15, param_16);
        }
        d = _733;
    }
    return d;
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
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
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _423)
{
    float px = 1.0 / _423.iResolution[1u];
    float2 p = (fragCoord - (float2(_423.iResolution[0], _423.iResolution[1]) * 0.5)) * px;
    float2 box = fast::max(((float2(_423.iResolution[0], _423.iResolution[1]) * 0.5) * px) - float2(_423.uInset), float2(0.0500000007450580596923828125));
    float rad = fast::min(_423.uRadius, fast::min(box.x, box.y));
    float T = mod(_423.iTime, 8.0);
    float4 acc = float4(0.0);
    float2 param = p;
    float2 param_1 = box;
    float param_2 = rad;
    float param_3 = T;
    float d = gooFrame(param, param_1, param_2, param_3, _423);
    float cover = fast::clamp(0.5 - (d / px), 0.0, 1.0);
    if (_423.uShadow != 0u)
    {
        float2 param_4 = p + float2(-0.007000000216066837310791015625, 0.0130000002682209014892578125);
        float2 param_5 = box;
        float param_6 = rad;
        float param_7 = T;
        float dS = gooFrame(param_4, param_5, param_6, param_7, _423);
        float4 param_8 = acc;
        float3 param_9 = float3(0.0);
        float param_10 = (0.319999992847442626953125 * smoothstep(0.0199999995529651641845703125, -0.00999999977648258209228515625, dS)) * (1.0 - cover);
        acc = over(param_8, param_9, param_10);
    }
    if (cover > 0.0)
    {
        float eps = px;
        float2 param_11 = p + float2(eps, 0.0);
        float2 param_12 = box;
        float param_13 = rad;
        float param_14 = T;
        float2 param_15 = p + float2(0.0, eps);
        float2 param_16 = box;
        float param_17 = rad;
        float param_18 = T;
        float2 g = float2(gooFrame(param_11, param_12, param_13, param_14, _423), gooFrame(param_15, param_16, param_17, param_18, _423)) - float2(d);
        g /= float2(eps);
        float3 n = fast::normalize(float3((g * exp(fast::min(d, 0.0) / (_423.uThickness * 0.89999997615814208984375))) * 1.60000002384185791015625, 1.0));
        float thick = smoothstep(0.0, (-_423.uThickness) * 1.2000000476837158203125, d);
        float3 param_19 = float3(_423.uColor);
        float3 param_20 = n;
        float param_21 = thick;
        float param_22 = _423.uGloss;
        float4 param_23 = acc;
        float3 param_24 = gooShade(param_19, param_20, param_21, param_22);
        float param_25 = cover * mix(0.9700000286102294921875, 0.89999997615814208984375, thick);
        acc = over(param_23, param_24, param_25);
    }
    float4 param_26 = acc;
    fragColor = unpremultiply(param_26);
}

fragment flair_gooey_frame_frag_out flair_gooey_frame_frag(constant FlairUniforms& _423 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_gooey_frame_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _954;
    if (_423.flair_flipY > 0.5)
    {
        _954 = _423.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _954 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _954);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _423);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

