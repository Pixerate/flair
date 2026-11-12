// flair-metal-hash: 10b68973
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
    int uPuppet;
    float3 uWall;
    float3 uLight;
    packed_float3 uShadow;
    float uSpeed;
    float uDepth;
    float uSoftness;
    float uSize;
};

struct flair_shadow_puppets_frag_out
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
float capsule(thread const float2& p, thread const float2& a, thread const float2& b, thread const float& r)
{
    float2 pa = p - a;
    float2 ba = b - a;
    float h = fast::clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - (ba * h)) - r;
}

static inline __attribute__((always_inline))
float ellipse(thread const float2& p, thread const float2& r)
{
    return (length(p / r) - 1.0) * fast::min(r.x, r.y);
}

static inline __attribute__((always_inline))
float smin(thread const float& a, thread const float& b, thread const float& k)
{
    float h = fast::clamp(0.5 + ((0.5 * (b - a)) / k), 0.0, 1.0);
    return mix(b, a, h) - ((k * h) * (1.0 - h));
}

static inline __attribute__((always_inline))
float bird(thread const float2& p, thread const float& t)
{
    float flap = 0.449999988079071044921875 * sin(t * 4.0);
    float2 param = p;
    float2 param_1 = float2(0.0, -0.0199999995529651641845703125);
    float2 param_2 = float2(0.0, 0.12999999523162841796875);
    float param_3 = 0.0280000008642673492431640625;
    float d = capsule(param, param_1, param_2, param_3);
    float2 param_4 = p - float2(0.0, 0.16500000655651092529296875);
    float2 param_5 = float2(0.039999999105930328369140625, 0.0350000001490116119384765625);
    float param_6 = d;
    float param_7 = ellipse(param_4, param_5);
    float param_8 = 0.0199999995529651641845703125;
    d = smin(param_6, param_7, param_8);
    float2 param_9 = p;
    float2 param_10 = float2(0.02500000037252902984619140625, 0.17000000178813934326171875);
    float2 param_11 = float2(0.07500000298023223876953125, 0.15800000727176666259765625);
    float param_12 = 0.0089999996125698089599609375;
    d = fast::min(d, capsule(param_9, param_10, param_11, param_12));
    float _323;
    for (int s = 0; s < 2; s++)
    {
        if (s == 0)
        {
            _323 = p.x;
        }
        else
        {
            _323 = -p.x;
        }
        float2 q = float2(_323, p.y);
        float2 param_13 = q - float2(0.07999999821186065673828125, 0.0);
        float2 param_14 = float2(0.07500000298023223876953125, 0.04500000178813934326171875);
        float param_15 = d;
        float param_16 = ellipse(param_13, param_14);
        float param_17 = 0.02999999932944774627685546875;
        d = smin(param_15, param_16, param_17);
        float2 param_18 = q;
        float2 param_19 = float2(0.07999999821186065673828125, -0.00999999977648258209228515625);
        float2 param_20 = float2(0.300000011920928955078125, -0.64999997615814208984375);
        float param_21 = 0.0599999986588954925537109375;
        float param_22 = d;
        float param_23 = capsule(param_18, param_19, param_20, param_21);
        float param_24 = 0.02999999932944774627685546875;
        d = smin(param_22, param_23, param_24);
        for (int k = 0; k < 4; k++)
        {
            float fk = float(k);
            float a = (0.550000011920928955078125 - (fk * 0.2199999988079071044921875)) + (flap * (1.0 - (fk * 0.119999997317790985107421875)));
            float2 root = float2(0.12999999523162841796875, 0.0199999995529651641845703125 - (fk * 0.017999999225139617919921875));
            float2 param_25 = q;
            float2 param_26 = root;
            float2 param_27 = root + (float2(cos(a), sin(a)) * (0.20000000298023223876953125 - (fk * 0.0199999995529651641845703125)));
            float param_28 = 0.01899999938905239105224609375 - (fk * 0.00200000009499490261077880859375);
            float param_29 = d;
            float param_30 = capsule(param_25, param_26, param_27, param_28);
            float param_31 = 0.01200000010430812835693359375;
            d = smin(param_29, param_30, param_31);
        }
    }
    return d;
}

static inline __attribute__((always_inline))
float box(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float dog(thread const float2& p, thread const float& t)
{
    float bark = fast::max(sin(t * 3.0), 0.0);
    bark *= bark;
    float2 param = p - float2(-0.0199999995529651641845703125, 0.02999999932944774627685546875);
    float2 param_1 = float2(0.119999997317790985107421875, 0.064999997615814208984375);
    float param_2 = 0.0500000007450580596923828125;
    float d = box(param, param_1, param_2);
    float2 param_3 = p;
    float2 param_4 = float2(0.0599999986588954925537109375, 0.039999999105930328369140625);
    float2 param_5 = float2(0.23999999463558197021484375, 0.02500000037252902984619140625);
    float param_6 = 0.0379999987781047821044921875;
    float param_7 = d;
    float param_8 = capsule(param_3, param_4, param_5, param_6);
    float param_9 = 0.02999999932944774627685546875;
    d = smin(param_7, param_8, param_9);
    float2 pivot = float2(0.0, -0.02999999932944774627685546875);
    float param_10 = 0.4000000059604644775390625 * bark;
    float2 jaw = (rot(param_10) * (p - pivot)) + pivot;
    float2 param_11 = jaw;
    float2 param_12 = float2(0.0199999995529651641845703125, -0.039999999105930328369140625);
    float2 param_13 = float2(0.20000000298023223876953125, -0.04500000178813934326171875);
    float param_14 = 0.0240000002086162567138671875;
    float param_15 = d;
    float param_16 = capsule(param_11, param_12, param_13, param_14);
    float param_17 = 0.01200000010430812835693359375;
    d = smin(param_15, param_16, param_17);
    float2 param_18 = p;
    float2 param_19 = float2(-0.0599999986588954925537109375, 0.07999999821186065673828125);
    float2 param_20 = float2((-0.100000001490116119384765625) + (0.039999999105930328369140625 * sin(t * 1.2999999523162841796875)), 0.20000000298023223876953125);
    float param_21 = 0.0419999994337558746337890625;
    float param_22 = d;
    float param_23 = capsule(param_18, param_19, param_20, param_21);
    float param_24 = 0.02999999932944774627685546875;
    d = smin(param_22, param_23, param_24);
    float2 param_25 = p;
    float2 param_26 = float2(-0.07999999821186065673828125, 0.0);
    float2 param_27 = float2(-0.5, -0.64999997615814208984375);
    float param_28 = 0.07500000298023223876953125;
    float param_29 = d;
    float param_30 = capsule(param_25, param_26, param_27, param_28);
    float param_31 = 0.039999999105930328369140625;
    d = smin(param_29, param_30, param_31);
    return fast::max(d, -(length(p - float2(0.070000000298023223876953125)) - 0.0130000002682209014892578125));
}

static inline __attribute__((always_inline))
float rabbit(thread const float2& p, thread const float& t)
{
    float nose = (0.006000000052154064178466796875 * sin(t * 18.0)) * step(0.300000011920928955078125, sin(t * 0.89999997615814208984375));
    float2 param = p;
    float2 param_1 = float2(0.119999997317790985107421875, 0.085000000894069671630859375);
    float d = ellipse(param, param_1);
    float param_2 = d;
    float param_3 = length(p - float2(0.10999999940395355224609375 + nose, -0.02500000037252902984619140625)) - 0.0500000007450580596923828125;
    float param_4 = 0.039999999105930328369140625;
    d = smin(param_2, param_3, param_4);
    float2 param_5 = p;
    float2 param_6 = float2(-0.039999999105930328369140625, 0.0500000007450580596923828125);
    float2 param_7 = float2((-0.0900000035762786865234375) + (0.07999999821186065673828125 * sin(t * 1.7000000476837158203125)), 0.319999992847442626953125);
    float param_8 = 0.039999999105930328369140625;
    float param_9 = d;
    float param_10 = capsule(param_5, param_6, param_7, param_8);
    float param_11 = 0.02999999932944774627685546875;
    d = smin(param_9, param_10, param_11);
    float2 param_12 = p;
    float2 param_13 = float2(0.0, 0.0599999986588954925537109375);
    float2 param_14 = float2(0.02999999932944774627685546875 + (0.07999999821186065673828125 * sin((t * 1.7000000476837158203125) + 1.2000000476837158203125)), 0.300000011920928955078125);
    float param_15 = 0.037000000476837158203125;
    float param_16 = d;
    float param_17 = capsule(param_12, param_13, param_14, param_15);
    float param_18 = 0.02999999932944774627685546875;
    d = smin(param_16, param_17, param_18);
    float2 param_19 = p;
    float2 param_20 = float2(-0.0599999986588954925537109375, -0.02999999932944774627685546875);
    float2 param_21 = float2(-0.449999988079071044921875, -0.64999997615814208984375);
    float param_22 = 0.07500000298023223876953125;
    float param_23 = d;
    float param_24 = capsule(param_19, param_20, param_21, param_22);
    float param_25 = 0.039999999105930328369140625;
    d = smin(param_23, param_24, param_25);
    return fast::max(d, -(length(p - float2(0.04500000178813934326171875, 0.02500000037252902984619140625)) - 0.0130000002682209014892578125));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _660)
{
    float px = 1.0 / _660.iResolution[1u];
    float2 p = (fragCoord - (float2(_660.iResolution[0], _660.iResolution[1]) * 0.5)) * px;
    float t = _660.iTime * _660.uSpeed;
    float spot = smoothstep(0.949999988079071044921875, 0.0500000007450580596923828125, length((p - float2(0.039999999105930328369140625, 0.0500000007450580596923828125)) * float2(0.75, 1.0)));
    float3 wall = _660.uWall * mix(float3(0.1599999964237213134765625, 0.10999999940395355224609375, 0.0900000035762786865234375), _660.uLight * 1.2999999523162841796875, float3(spot));
    float2 param = fragCoord * 0.300000011920928955078125;
    float2 param_1 = fragCoord * 0.02999999932944774627685546875;
    wall *= ((0.949999988079071044921875 + (0.070000000298023223876953125 * vnoise(param))) + (0.039999999105930328369140625 * vnoise(param_1)));
    float z = _660.uDepth * (0.5 + (0.5 * sin(_660.iTime * 0.449999988079071044921875)));
    float scale = _660.uSize * (1.0 + (0.300000011920928955078125 * z));
    float2 drift = float2(0.02999999932944774627685546875 * sin(_660.iTime * 0.4000000059604644775390625), (0.0199999995529651641845703125 * sin(_660.iTime * 0.699999988079071044921875)) - 0.039999999105930328369140625);
    float2 q = (p - drift) / float2(scale);
    float _767;
    if (_660.uPuppet == 0)
    {
        float2 param_2 = q;
        float param_3 = t;
        _767 = bird(param_2, param_3);
    }
    else
    {
        float _779;
        if (_660.uPuppet == 1)
        {
            float2 param_4 = q;
            float param_5 = t;
            _779 = dog(param_4, param_5);
        }
        else
        {
            float2 param_6 = q;
            float param_7 = t;
            _779 = rabbit(param_6, param_7);
        }
        _767 = _779;
    }
    float d = _767 * scale;
    float soft = fast::max(0.00200000009499490261077880859375 + (_660.uSoftness * z), px);
    float cover = 1.0 - smoothstep(-soft, soft, d);
    float3 col = mix(wall, float3(_660.uShadow) * (0.60000002384185791015625 + (0.4000000059604644775390625 * spot)), float3(cover * 0.920000016689300537109375));
    fragColor = float4(col, 1.0);
}

fragment flair_shadow_puppets_frag_out flair_shadow_puppets_frag(constant FlairUniforms& _660 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_shadow_puppets_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _845;
    if (_660.flair_flipY > 0.5)
    {
        _845 = _660.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _845 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _845);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _660);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

