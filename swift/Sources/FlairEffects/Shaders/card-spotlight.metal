// flair-metal-hash: afbf3ba6
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
    float3 uCard;
    float3 uBorder;
    packed_float3 uSpot;
    float uRadius;
    float uGap;
    uint uDemo;
    float uBackgroundAlpha;
};

struct flair_card_spotlight_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 hoverPoint(thread const bool& demo, thread const float& idle, constant FlairUniforms& _58)
{
    float2 drift = float2(_58.iResolution[0], _58.iResolution[1]) * (float2(0.5) + float2(0.300000011920928955078125 * sin(_58.iTime * 0.5299999713897705078125), 0.25 * sin((_58.iTime * 0.769999980926513671875) + 1.2999999523162841796875)));
    float h = fast::clamp(_58.iPointer.z, 0.0, 1.0);
    return float3(mix(drift, _58.iPointer.xy, float2(h)), mix(demo ? idle : 0.0, 1.0, h));
}

static inline __attribute__((always_inline))
float4 cardRect(thread const int& i)
{
    if (i == 0)
    {
        return float4(0.0, 0.5, 0.62000000476837158203125, 1.0);
    }
    if (i == 1)
    {
        return float4(0.62000000476837158203125, 0.5, 1.0, 1.0);
    }
    if (i == 2)
    {
        return float4(0.0, 0.0, 0.300000011920928955078125, 0.5);
    }
    if (i == 3)
    {
        return float4(0.300000011920928955078125, 0.0, 0.699999988079071044921875, 0.5);
    }
    return float4(0.699999988079071044921875, 0.0, 1.0, 0.5);
}

static inline __attribute__((always_inline))
float roundedBox(thread const float2& p, thread const float2& hs, thread const float& r)
{
    float2 e = (abs(p) - hs) + float2(r);
    return (length(fast::max(e, float2(0.0))) + fast::min(fast::max(e.x, e.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _58)
{
    float2 res = float2(_58.iResolution[0], _58.iResolution[1]);
    float ry = res.y;
    bool param = _58.uDemo != 0u;
    float param_1 = 0.89999997615814208984375;
    float3 hp = hoverPoint(param, param_1, _58);
    float d = length(fragCoord - hp.xy) / ry;
    float spot = exp(((-d) * d) / (_58.uRadius * _58.uRadius)) * hp.z;
    float3 col = _58.uBackground + ((float3(_58.uSpot) * spot) * 0.0500000007450580596923828125);
    float margin = 0.0599999986588954925537109375 * ry;
    float2 area = res - float2(2.0 * margin);
    float gap = _58.uGap * ry;
    for (int i = 0; i < 5; i++)
    {
        int param_2 = i;
        float4 r = cardRect(param_2);
        float2 lo = (float2(margin) + (r.xy * area)) + (step(float2(0.001000000047497451305389404296875), r.xy) * (gap * 0.5));
        float2 hi = (float2(margin) + (r.zw * area)) - (step(r.zw, float2(0.999000012874603271484375)) * (gap * 0.5));
        float2 hs = (hi - lo) * 0.5;
        float2 p = fragCoord - ((lo + hi) * 0.5);
        float2 param_3 = p;
        float2 param_4 = hs;
        float param_5 = 0.0350000001490116119384765625 * ry;
        float sd = roundedBox(param_3, param_4, param_5);
        if (sd > 2.0)
        {
            continue;
        }
        float inside = 1.0 - smoothstep(-1.0, 1.0, sd);
        float3 face = _58.uCard + ((float3(_58.uSpot) * spot) * 0.0900000035762786865234375);
        float2 tl = fragCoord - float2(lo.x, hi.y);
        float icon = 1.0 - smoothstep(-1.0, 1.0, length(tl - (float2(0.0500000007450580596923828125, -0.0500000007450580596923828125) * ry)) - (0.017999999225139617919921875 * ry));
        float2 param_6 = tl - (float2(0.12999999523162841796875, -0.0949999988079071044921875) * ry);
        float2 param_7 = float2(0.07999999821186065673828125, 0.008000000379979610443115234375) * ry;
        float param_8 = 0.008000000379979610443115234375 * ry;
        float bar1 = 1.0 - smoothstep(-1.0, 1.0, roundedBox(param_6, param_7, param_8));
        float2 param_9 = tl - (float2(0.10999999940395355224609375, -0.125) * ry);
        float2 param_10 = float2(0.0599999986588954925537109375, 0.006000000052154064178466796875) * ry;
        float param_11 = 0.006000000052154064178466796875 * ry;
        float bar2 = 1.0 - smoothstep(-1.0, 1.0, roundedBox(param_9, param_10, param_11));
        face = mix(face, mix(_58.uBorder, float3(_58.uSpot), float3(spot * 0.60000002384185791015625)), float3(fast::max(icon, fast::max(bar1, bar2 * 0.699999988079071044921875)) * 0.89999997615814208984375));
        float line = 1.0 - smoothstep(0.0, 1.5, abs(sd + 0.75));
        float3 border = mix(_58.uBorder, float3(_58.uSpot), float3(fast::clamp(spot * 1.39999997615814208984375, 0.0, 1.0))) * (1.0 + spot);
        face = mix(face, border, float3(line));
        col = mix(col, face, float3(inside));
        col += (((float3(_58.uSpot) * line) * spot) * 0.25);
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
    float3 _504;
    if (a > 0.0)
    {
        _504 = bg + (d / float3(a));
    }
    else
    {
        _504 = bg;
    }
    float3 fg = _504;
    float alpha = a + (opacity * (1.0 - a));
    float3 _526;
    if (alpha > 0.0)
    {
        _526 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _526 = bg;
    }
    float3 col = _526;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _58)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _58);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _58.uBackground;
    float param_4 = _58.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_card_spotlight_frag_out flair_card_spotlight_frag(constant FlairUniforms& _58 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_card_spotlight_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _583;
    if (_58.flair_flipY > 0.5)
    {
        _583 = _58.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _583 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _583);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _58);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

