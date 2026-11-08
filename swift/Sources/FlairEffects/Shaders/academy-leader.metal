// flair-metal-hash: fa6b3f4a
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
    float3 uLight;
    float3 uShade;
    packed_float3 uInk;
    float uWear;
};

struct flair_academy_leader_frag_out
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
float ring(thread const float2& p, thread const float2& c, thread const float& r)
{
    return abs(length(p - c) - r);
}

static inline __attribute__((always_inline))
float seg(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 pa = p - a;
    float2 ba = b - a;
    return length(pa - (ba * fast::clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)));
}

static inline __attribute__((always_inline))
float arc(thread const float2& p, thread const float2& c, thread const float& r, thread const float& a0, thread const float& sweep)
{
    float2 d = p - c;
    if (mod(a0 - precise::atan2(d.y, d.x), 6.28318023681640625) <= sweep)
    {
        return abs(length(d) - r);
    }
    float2 e0 = c + (float2(cos(a0), sin(a0)) * r);
    float2 e1 = c + (float2(cos(a0 - sweep), sin(a0 - sweep)) * r);
    return fast::min(length(p - e0), length(p - e1));
}

static inline __attribute__((always_inline))
float numeral(thread const int& n, thread const float2& p)
{
    if (n == 8)
    {
        float2 param = p;
        float2 param_1 = float2(0.0, 0.4199999868869781494140625);
        float param_2 = 0.319999992847442626953125;
        float2 param_3 = p;
        float2 param_4 = float2(0.0, -0.36000001430511474609375);
        float param_5 = 0.4199999868869781494140625;
        return fast::min(ring(param, param_1, param_2), ring(param_3, param_4, param_5));
    }
    if (n == 7)
    {
        float2 param_6 = p;
        float2 param_7 = float2(-0.4199999868869781494140625, 0.7799999713897705078125);
        float2 param_8 = float2(0.4199999868869781494140625, 0.7799999713897705078125);
        float2 param_9 = p;
        float2 param_10 = float2(0.4199999868869781494140625, 0.7799999713897705078125);
        float2 param_11 = float2(-0.100000001490116119384765625, -0.7799999713897705078125);
        return fast::min(seg(param_6, param_7, param_8), seg(param_9, param_10, param_11));
    }
    if (n == 6)
    {
        float2 param_12 = p;
        float2 param_13 = float2(0.0, -0.36000001430511474609375);
        float param_14 = 0.4199999868869781494140625;
        float2 param_15 = p;
        float2 param_16 = float2(-0.4099999964237213134765625, -0.2800000011920928955078125);
        float2 param_17 = float2(0.180000007152557373046875, 0.7799999713897705078125);
        return fast::min(ring(param_12, param_13, param_14), seg(param_15, param_16, param_17));
    }
    if (n == 5)
    {
        float2 param_18 = p;
        float2 param_19 = float2(-0.319999992847442626953125, 0.7799999713897705078125);
        float2 param_20 = float2(0.4000000059604644775390625, 0.7799999713897705078125);
        float2 param_21 = p;
        float2 param_22 = float2(-0.319999992847442626953125, 0.7799999713897705078125);
        float2 param_23 = float2(-0.300000011920928955078125, 0.0);
        float2 param_24 = p;
        float2 param_25 = float2(0.0, -0.3400000035762786865234375);
        float param_26 = 0.439999997615814208984375;
        float param_27 = 2.28999996185302734375;
        float param_28 = 4.900000095367431640625;
        return fast::min(fast::min(seg(param_18, param_19, param_20), seg(param_21, param_22, param_23)), arc(param_24, param_25, param_26, param_27, param_28));
    }
    if (n == 4)
    {
        float2 param_29 = p;
        float2 param_30 = float2(0.20000000298023223876953125, 0.7799999713897705078125);
        float2 param_31 = float2(-0.449999988079071044921875, -0.25);
        float2 param_32 = p;
        float2 param_33 = float2(-0.449999988079071044921875, -0.25);
        float2 param_34 = float2(0.449999988079071044921875, -0.25);
        float2 param_35 = p;
        float2 param_36 = float2(0.20000000298023223876953125, 0.7799999713897705078125);
        float2 param_37 = float2(0.20000000298023223876953125, -0.7799999713897705078125);
        return fast::min(fast::min(seg(param_29, param_30, param_31), seg(param_32, param_33, param_34)), seg(param_35, param_36, param_37));
    }
    if (n == 3)
    {
        float2 param_38 = p;
        float2 param_39 = float2(0.0, 0.4000000059604644775390625);
        float param_40 = 0.36000001430511474609375;
        float param_41 = 2.599999904632568359375;
        float param_42 = 4.1700000762939453125;
        float2 param_43 = p;
        float2 param_44 = float2(0.0, -0.36000001430511474609375);
        float param_45 = 0.4199999868869781494140625;
        float param_46 = 1.57079994678497314453125;
        float param_47 = 4.1700000762939453125;
        return fast::min(arc(param_38, param_39, param_40, param_41, param_42), arc(param_43, param_44, param_45, param_46, param_47));
    }
    float2 param_48 = p;
    float2 param_49 = float2(0.0, 0.37999999523162841796875);
    float param_50 = 0.37999999523162841796875;
    float param_51 = 2.7000000476837158203125;
    float param_52 = 3.2999999523162841796875;
    float2 param_53 = p;
    float2 param_54 = float2(0.31400001049041748046875, 0.16500000655651092529296875);
    float2 param_55 = float2(-0.4199999868869781494140625, -0.7799999713897705078125);
    float2 param_56 = p;
    float2 param_57 = float2(-0.4199999868869781494140625, -0.7799999713897705078125);
    float2 param_58 = float2(0.439999997615814208984375, -0.7799999713897705078125);
    return fast::min(fast::min(arc(param_48, param_49, param_50, param_51, param_52), seg(param_53, param_54, param_55)), seg(param_56, param_57, param_58));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _374)
{
    float c = mod(_374.iTime, 7.0);
    float frame = floor(_374.iTime * 24.0);
    float px = 1.0 / _374.iResolution[1u];
    if (c >= 6.083333492279052734375)
    {
        float2 param = fragCoord + float2(frame);
        fragColor = float4(float3(0.0199999995529651641845703125) + float3(((hash12(param) - 0.5) * 0.02999999932944774627685546875) * _374.uWear), 1.0);
        return;
    }
    int _424;
    if (c < 6.0)
    {
        _424 = 8 - int(floor(c));
    }
    else
    {
        _424 = 2;
    }
    int n = _424;
    float _437;
    if (c < 6.0)
    {
        _437 = fract(c);
    }
    else
    {
        _437 = 0.0;
    }
    float second = _437;
    float2 param_1 = float2(frame, 1.0);
    float2 param_2 = float2(frame, 2.0);
    float2 weave = ((float2(hash12(param_1), hash12(param_2)) - float2(0.5)) * 0.0040000001899898052215576171875) * _374.uWear;
    float2 p = ((fragCoord - (float2(_374.iResolution[0], _374.iResolution[1]) * 0.5)) / float2(_374.iResolution[1u])) + weave;
    float a = precise::atan2(p.x, p.y);
    if (a < 0.0)
    {
        a += 6.28318023681640625;
    }
    float3 _493;
    if (a < (second * 6.28318023681640625))
    {
        _493 = _374.uShade;
    }
    else
    {
        _493 = _374.uLight;
    }
    float3 col = _493;
    float lines = fast::min(abs(p.x), abs(p.y)) - 0.00150000001303851604461669921875;
    float2 param_3 = p;
    float2 param_4 = float2(0.0);
    float param_5 = 0.36000001430511474609375;
    float2 param_6 = p;
    float2 param_7 = float2(0.0);
    float param_8 = 0.4099999964237213134765625;
    lines = fast::min(lines, fast::min(ring(param_3, param_4, param_5), ring(param_6, param_7, param_8)) - 0.006000000052154064178466796875);
    int param_9 = n;
    float2 param_10 = p / float2(0.20000000298023223876953125);
    float digit = (numeral(param_9, param_10) * 0.20000000298023223876953125) - 0.0130000002682209014892578125;
    float ink = 1.0 - smoothstep(-px, px, fast::min(lines, digit));
    col = mix(col, float3(_374.uInk), float3(ink));
    float2 param_11 = float2(frame, 7.0);
    col *= (1.0 - ((_374.uWear * 0.119999997317790985107421875) * hash12(param_11)));
    float2 param_12 = fragCoord + (float2(17.3099994659423828125, 31.729999542236328125) * frame);
    col += float3(((hash12(param_12) - 0.5) * 0.07999999821186065673828125) * _374.uWear);
    float2 cell = floor(p * 40.0);
    float2 param_13 = cell + float2(frame * 3.099999904632568359375);
    float speck = step(0.99849998950958251953125 - (0.00200000009499490261077880859375 * _374.uWear), hash12(param_13));
    col = mix(col, float3(0.0500000007450580596923828125), float3((speck * smoothstep(0.02999999932944774627685546875, 0.0, length(fract(p * 40.0) - float2(0.5)) * 0.0500000007450580596923828125)) * _374.uWear));
    for (int i = 0; i < 2; i++)
    {
        float2 param_14 = float2(frame, float(i) * 13.0);
        float h = hash12(param_14);
        float2 param_15 = float2(floor(frame / 6.0), float(i));
        float x = (((hash12(param_15) - 0.5) * _374.iResolution[0u]) / _374.iResolution[1u]) + ((h - 0.5) * 0.00999999977648258209228515625);
        col += float3(((((h > 0.5) ? 0.25 : (-0.25)) * _374.uWear) * (1.0 - smoothstep(0.0, 1.5 * px, abs(p.x - x)))) * step(0.300000011920928955078125, h));
    }
    if (n == 2)
    {
        col = mix(col, float3(1.0), float3(0.3499999940395355224609375));
    }
    col *= (1.0 - (0.3499999940395355224609375 * smoothstep(0.5, 1.10000002384185791015625, length(p * float2(0.800000011920928955078125, 1.0)))));
    fragColor = float4(col, 1.0);
}

fragment flair_academy_leader_frag_out flair_academy_leader_frag(constant FlairUniforms& _374 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_academy_leader_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _728;
    if (_374.flair_flipY > 0.5)
    {
        _728 = _374.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _728 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _728);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _374);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

