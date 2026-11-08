// flair-metal-hash: 0f701ab4
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
    float3 uBackground;
    float3 uGlow;
    packed_float3 uMoon;
    float uMoonSize;
    float uClouds;
    float uStars;
    uint uLand;
    float uBackgroundAlpha;
};

struct flair_blood_moon_frag_out
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
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float capsule(thread const float2& p, thread const float2& a, thread const float2& b, thread const float& r)
{
    float2 pa = p - a;
    float2 ba = b - a;
    return length(pa - (ba * fast::clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0))) - r;
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _256)
{
    float2 uv = fragCoord / float2(_256.iResolution[0], _256.iResolution[1]);
    float2 p = (fragCoord - (float2(_256.iResolution[0], _256.iResolution[1]) * 0.5)) / float2(_256.iResolution[1u]);
    float aspect = _256.iResolution[0u] / _256.iResolution[1u];
    float px = 1.0 / _256.iResolution[1u];
    float2 mc = float2((-0.180000007152557373046875) * aspect, 0.1599999964237213134765625);
    float md = length(p - mc);
    float3 col = mix(_256.uGlow * 0.60000002384185791015625, _256.uBackground, float3(smoothstep(0.0, 0.89999997615814208984375, uv.y)));
    col += ((_256.uGlow * 0.89999997615814208984375) * exp((-fast::max(md - _256.uMoonSize, 0.0)) / ((0.3499999940395355224609375 * _256.uMoonSize) + 0.07999999821186065673828125)));
    float2 g = (fragCoord * px) * 60.0;
    float2 gi = floor(g);
    float2 param = gi;
    float2 h = hash22(param);
    float2 param_1 = gi + float2(3.0);
    float star = step(1.0 - (0.07999999821186065673828125 * _256.uStars), hash12(param_1)) * (1.0 - smoothstep(0.02999999932944774627685546875, 0.0900000035762786865234375, length(fract(g) - h)));
    col += (((float3(1.0, 0.85000002384185791015625, 0.85000002384185791015625) * star) * (0.5 + (0.5 * sin((_256.iTime * (1.0 + (3.0 * h.x))) + (h.y * 6.0))))) * smoothstep(1.39999997615814208984375 * _256.uMoonSize, 3.0 * _256.uMoonSize, md));
    if (md < (_256.uMoonSize + (2.0 * px)))
    {
        float2 m = (p - mc) / float2(_256.uMoonSize);
        float2 param_2 = (m * 2.2000000476837158203125) + float2(3.0);
        int param_3 = 4;
        float _423 = fbm(param_2, param_3);
        float maria = _423;
        float2 param_4 = m * 7.0;
        int param_5 = 3;
        float _431 = fbm(param_4, param_5);
        float craters = _431;
        float limb = sqrt(fast::max(1.0 - dot(m, m), 0.0));
        float3 face = (float3(_256.uMoon) * ((0.550000011920928955078125 + (0.3499999940395355224609375 * smoothstep(0.3499999940395355224609375, 0.699999988079071044921875, maria))) + (0.25 * craters))) * (0.449999988079071044921875 + (0.550000011920928955078125 * limb));
        col = mix(col, face, float3(fast::clamp((_256.uMoonSize - md) / px, 0.0, 1.0)));
    }
    float2 param_6 = float2((p.x * 2.2000000476837158203125) - (_256.iTime * 0.02999999932944774627685546875), p.y * 5.0);
    int param_7 = 5;
    float _486 = fbm(param_6, param_7);
    float cloud = _486;
    float band = exp(-powr((p.y - 0.1500000059604644775390625) / 0.180000007152557373046875, 2.0));
    float thick = (smoothstep(0.5, 0.75, cloud) * band) * _256.uClouds;
    col = mix(col, (_256.uBackground * 0.60000002384185791015625) + (((_256.uGlow * 0.60000002384185791015625) * exp((-md) / 0.300000011920928955078125)) * (1.0 - smoothstep(0.550000011920928955078125, 0.800000011920928955078125, cloud))), float3(thick * 0.85000002384185791015625));
    if (_256.uLand != 0u)
    {
        float hills = ((-0.319999992847442626953125) + (0.0500000007450580596923828125 * sin((p.x * 3.0) + 1.0))) + (0.02999999932944774627685546875 * sin(p.x * 7.0));
        float near = (-0.4000000059604644775390625) + (0.07999999821186065673828125 * sin((p.x * 1.60000002384185791015625) - 0.60000002384185791015625));
        float land = fast::min(p.y - hills, p.y - near);
        float2 t = p - float2(0.300000011920928955078125 * aspect, near + 0.0);
        float2 param_8 = t;
        float2 param_9 = float2(0.0, -0.0500000007450580596923828125);
        float2 param_10 = float2(0.00999999977648258209228515625, 0.2199999988079071044921875);
        float param_11 = 0.01200000010430812835693359375;
        float tree = capsule(param_8, param_9, param_10, param_11);
        float2 param_12 = t;
        float2 param_13 = float2(0.004999999888241291046142578125, 0.119999997317790985107421875);
        float2 param_14 = float2(-0.0900000035762786865234375, 0.20000000298023223876953125);
        float param_15 = 0.006000000052154064178466796875;
        tree = fast::min(tree, capsule(param_12, param_13, param_14, param_15));
        float2 param_16 = t;
        float2 param_17 = float2(-0.0900000035762786865234375, 0.20000000298023223876953125);
        float2 param_18 = float2(-0.119999997317790985107421875, 0.2599999904632568359375);
        float param_19 = 0.0030000000260770320892333984375;
        tree = fast::min(tree, capsule(param_16, param_17, param_18, param_19));
        float2 param_20 = t;
        float2 param_21 = float2(0.008000000379979610443115234375, 0.17000000178813934326171875);
        float2 param_22 = float2(0.07999999821186065673828125, 0.2700000107288360595703125);
        float param_23 = 0.004999999888241291046142578125;
        tree = fast::min(tree, capsule(param_20, param_21, param_22, param_23));
        float2 param_24 = t;
        float2 param_25 = float2(0.07999999821186065673828125, 0.2700000107288360595703125);
        float2 param_26 = float2(0.119999997317790985107421875, 0.2800000011920928955078125);
        float param_27 = 0.0030000000260770320892333984375;
        tree = fast::min(tree, capsule(param_24, param_25, param_26, param_27));
        float2 param_28 = t;
        float2 param_29 = float2(0.00999999977648258209228515625, 0.20000000298023223876953125);
        float2 param_30 = float2(0.02999999932944774627685546875, 0.310000002384185791015625);
        float param_31 = 0.0040000001899898052215576171875;
        tree = fast::min(tree, capsule(param_28, param_29, param_30, param_31));
        float sil = fast::min(land, tree);
        col = mix(col, float3(0.01200000010430812835693359375, 0.0040000001899898052215576171875, 0.008000000379979610443115234375), float3(fast::clamp(0.5 - (sil / px), 0.0, 1.0)));
    }
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), 1.0);
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
    float3 _720;
    if (a > 0.0)
    {
        _720 = bg + (d / float3(a));
    }
    else
    {
        _720 = bg;
    }
    float3 fg = _720;
    float alpha = a + (opacity * (1.0 - a));
    float3 _742;
    if (alpha > 0.0)
    {
        _742 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _742 = bg;
    }
    float3 col = _742;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _256)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _256);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _256.uBackground;
    float param_4 = _256.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_blood_moon_frag_out flair_blood_moon_frag(constant FlairUniforms& _256 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_blood_moon_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _799;
    if (_256.flair_flipY > 0.5)
    {
        _799 = _256.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _799 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _799);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _256);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

