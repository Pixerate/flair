// flair-metal-hash: 8c8aef9d
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
    packed_float3 uBackground;
    float uBackgroundAlpha;
    float uSize;
    float uBevel;
    float uFilm;
    float uSaturation;
    float uSpeed;
    float uGloss;
    float uHalo;
    float uGlints;
};

struct flair_iridescent_text_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 textPlace(thread const float2& p, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _195)
{
    float2 size = float2(int2(uText.get_width(), uText.get_height()));
    float aspect = size.x / fast::max(size.y, 1.0);
    float h = fast::min(_195.uSize, ((_195.iResolution[0u] / _195.iResolution[1u]) * _195.uSize) / aspect);
    return float3((p / float2(h * aspect, h)) + float2(0.5), size.y / h);
}

static inline __attribute__((always_inline))
float textAt(thread const float2& p, thread const float& blur, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _195)
{
    float2 param = p;
    float3 m = textPlace(param, uText, uTextSmplr, _195);
    bool _237 = m.x < 0.0;
    bool _244;
    if (!_237)
    {
        _244 = m.x > 1.0;
    }
    else
    {
        _244 = _237;
    }
    bool _251;
    if (!_244)
    {
        _251 = m.y < 0.0;
    }
    else
    {
        _251 = _244;
    }
    bool _258;
    if (!_251)
    {
        _258 = m.y > 1.0;
    }
    else
    {
        _258 = _251;
    }
    if (_258)
    {
        return 0.0;
    }
    return uText.sample(uTextSmplr, m.xy, level(log2(fast::max(blur * m.z, 1.0)))).w;
}

static inline __attribute__((always_inline))
float bevelHeight(thread const float2& p, thread const float& bevel, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _195)
{
    float2 param = p;
    float param_1 = bevel * 0.5;
    float2 param_2 = p;
    float param_3 = bevel;
    float2 param_4 = p;
    float param_5 = bevel * 2.0;
    return ((0.449999988079071044921875 * textAt(param, param_1, uText, uTextSmplr, _195)) + (0.3499999940395355224609375 * textAt(param_2, param_3, uText, uTextSmplr, _195))) + (0.20000000298023223876953125 * textAt(param_4, param_5, uText, uTextSmplr, _195));
}

static inline __attribute__((always_inline))
float2 bevelSlope(thread const float2& p, thread const float& bevel, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _195)
{
    float e = bevel * 0.3499999940395355224609375;
    float2 param = p + float2(e, 0.0);
    float param_1 = bevel;
    float2 param_2 = p - float2(e, 0.0);
    float param_3 = bevel;
    float2 param_4 = p + float2(0.0, e);
    float param_5 = bevel;
    float2 param_6 = p - float2(0.0, e);
    float param_7 = bevel;
    float2 d = float2(bevelHeight(param, param_1, uText, uTextSmplr, _195) - bevelHeight(param_2, param_3, uText, uTextSmplr, _195), bevelHeight(param_4, param_5, uText, uTextSmplr, _195) - bevelHeight(param_6, param_7, uText, uTextSmplr, _195));
    return (d / float2(2.0 * e)) * bevel;
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
float3 film(thread const float& x, constant FlairUniforms& _195)
{
    float3 c = float3(0.5) + (cos((float3(x) + float3(0.0, 0.3300000131130218505859375, 0.670000016689300537109375)) * 6.28318023681640625) * 0.5);
    return mix(float3(dot(c, float3(0.333000004291534423828125))), c, float3(_195.uSaturation));
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _195)
{
    float px = 1.0 / _195.iResolution[1u];
    float2 p = (fragCoord - (float2(_195.iResolution[0], _195.iResolution[1]) * 0.5)) * px;
    float t = _195.iTime * _195.uSpeed;
    float2 param = p;
    float param_1 = 1.5 * px;
    float mask = textAt(param, param_1, uText, uTextSmplr, _195);
    float2 param_2 = p;
    float param_3 = _195.uBevel;
    float2 s = bevelSlope(param_2, param_3, uText, uTextSmplr, _195);
    float2 param_4 = p;
    float param_5 = _195.uBevel;
    float h = bevelHeight(param_4, param_5, uText, uTextSmplr, _195);
    float3 n = fast::normalize(float3((-s) * 2.2000000476837158203125, 1.0));
    float2 param_6 = (p * 3.0) + float2(t, (-0.60000002384185791015625) * t);
    float2 param_7 = (p * 7.0) - float2(0.4000000059604644775390625 * t, t);
    float swirl = vnoise(param_6) + (0.5 * vnoise(param_7));
    float param_8 = (_195.uFilm * (((2.0 * (1.0 - n.z)) + swirl) + (1.39999997615814208984375 * p.x))) + t;
    float3 face = film(param_8, _195);
    float3 light = float3(-0.3980148732662200927734375, 0.5970222949981689453125, 0.696526050567626953125);
    float spec = powr(fast::max(dot(reflect(-light, n), float3(0.0, 0.0, 1.0)), 0.0), 40.0);
    float rim = fast::clamp(length(s) * 1.39999997615814208984375, 0.0, 1.0);
    face = (face * (0.75 + (0.3499999940395355224609375 * h))) + float3(_195.uGloss * ((1.2000000476837158203125 * spec) + (0.699999988079071044921875 * powr(rim, 4.0))));
    float4 acc = float4(float3(_195.uBackground) * _195.uBackgroundAlpha, _195.uBackgroundAlpha);
    float2 param_9 = p;
    float param_10 = 0.070000000298023223876953125;
    float halo = ((_195.uHalo * textAt(param_9, param_10, uText, uTextSmplr, _195)) * (1.0 - mask)) * 0.699999988079071044921875;
    float param_11 = (p.x * 0.699999988079071044921875) + t;
    acc = float4(film(param_11, _195) * halo, halo) + (acc * (1.0 - halo));
    float2 g = p * 9.0;
    float2 id = floor(g);
    float2 param_12 = id;
    float2 d = (fract(g) - float2(0.5)) - ((hash22(param_12) - float2(0.5)) * 0.60000002384185791015625);
    float2 param_13 = (id + float2(0.5)) / float2(9.0);
    float param_14 = 0.0500000007450580596923828125;
    float2 param_15 = (id + float2(0.5)) / float2(9.0);
    float param_16 = 0.0199999995529651641845703125;
    float near = smoothstep(0.0199999995529651641845703125, 0.20000000298023223876953125, textAt(param_13, param_14, uText, uTextSmplr, _195)) * (1.0 - smoothstep(0.699999988079071044921875, 0.949999988079071044921875, textAt(param_15, param_16, uText, uTextSmplr, _195)));
    float2 param_17 = id + float2(3.099999904632568359375);
    float tw = powr(fast::max(0.0, sin((_195.iTime * 1.7000000476837158203125) + (hash12(param_17) * 6.28318023681640625))), 6.0);
    float star = ((fast::max(0.0, 1.0 - (abs(d.x * d.y) * 900.0)) * 0.699999988079071044921875) + (0.0040000001899898052215576171875 / (dot(d, d) + 0.0040000001899898052215576171875))) * smoothstep(0.25, 0.0, length(d));
    float2 param_18 = id + float2(9.69999980926513671875);
    float glint = fast::clamp((((_195.uGlints * near) * tw) * star) * step(0.449999988079071044921875, hash12(param_18)), 0.0, 1.0);
    acc = float4(float3(glint), glint) + (acc * (1.0 - glint));
    acc = float4(face * mask, mask) + (acc * (1.0 - mask));
    fragColor = float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

fragment flair_iridescent_text_frag_out flair_iridescent_text_frag(constant FlairUniforms& _195 [[buffer(0)]], texture2d<float> uText [[texture(1)]], sampler uTextSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_iridescent_text_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _718;
    if (_195.flair_flipY > 0.5)
    {
        _718 = _195.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _718 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _718);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, uText, uTextSmplr, _195);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

