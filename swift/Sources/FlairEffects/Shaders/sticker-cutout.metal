// flair-metal-hash: 661d59b7
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL radians() function
template<typename T>
inline T radians(T d)
{
    return d * T(0.01745329251);
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
    packed_float3 uBorderColor;
    float uBorder;
    float uSize;
    float uTurn;
    float uShadow;
    float uGloss;
    float uFoil;
    char _m20_pad[12];
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_sticker_cutout_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float maskAt(thread const float2& uv, thread const float& lod, texture2d<float> uMask, sampler uMaskSmplr)
{
    float2 inside = step(float2(0.0), uv) * step(uv, float2(1.0));
    return (uMask.sample(uMaskSmplr, uv, level(lod)).w * inside.x) * inside.y;
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, texture2d<float> uMask, sampler uMaskSmplr, constant FlairUniforms& _113)
{
    float2 res = float2(_113.iResolution[0], _113.iResolution[1]);
    float px = fast::min(res.x, res.y);
    float2 ts = float2(int2(uMask.get_width(), uMask.get_height()));
    float ia = ts.x / fast::max(ts.y, 1.0);
    float w = fast::min(res.x * _113.uSize, (res.y * _113.uSize) * ia);
    float2 hs = float2(w, w / ia) * 0.5;
    float a = radians(_113.uTurn);
    float2x2 turn = float2x2(float2(cos(a), sin(a)), float2(-sin(a), cos(a)));
    float2 p = turn * (fragCoord - (res * 0.5));
    float2 uv = (p / (hs * 2.0)) + float2(0.5);
    float2 rb = float2(_113.uBorder * px) / (hs * 2.0);
    float2 param = uv;
    float param_1 = 0.0;
    float a0 = maskAt(param, param_1, uMask, uMaskSmplr);
    float reach = a0;
    for (int i = 0; i < 16; i++)
    {
        float ang = float(i) * 0.3926990032196044921875;
        float2 d = float2(cos(ang), sin(ang)) * rb;
        float2 param_2 = uv + (d * 0.85000002384185791015625);
        float param_3 = 2.0;
        reach = fast::max(reach, maskAt(param_2, param_3, uMask, uMaskSmplr));
        float2 param_4 = uv + (d * 0.449999988079071044921875);
        float param_5 = 1.0;
        reach = fast::max(reach, maskAt(param_4, param_5, uMask, uMaskSmplr));
    }
    float cut = smoothstep(0.20000000298023223876953125, 0.5, reach);
    float2 drop = (turn * float2(0.0, (-0.0280000008642673492431640625) * px)) / (hs * 2.0);
    float sh = 0.0;
    for (int i_1 = 0; i_1 < 8; i_1++)
    {
        float ang_1 = (float(i_1) * 0.785398006439208984375) + 0.38999998569488525390625;
        float2 param_6 = (uv + drop) + ((float2(cos(ang_1), sin(ang_1)) * rb) * 1.2999999523162841796875);
        float param_7 = 3.5;
        sh += maskAt(param_6, param_7, uMask, uMaskSmplr);
    }
    sh = smoothstep(0.0, 0.449999988079071044921875, sh / 8.0) * _113.uShadow;
    float4 tex = uMask.sample(uMaskSmplr, fast::clamp(uv, float2(0.0), float2(1.0)), level(0.0));
    float3 art = tex.xyz / float3(fast::max(tex.w, 0.001000000047497451305389404296875));
    float2 sn = p / float2(fast::max(hs.x, hs.y));
    float3 holo = float3(0.5) + (cos((float3(dot(sn, float2(0.3499999940395355224609375, 0.60000002384185791015625))) + float3(0.0, 0.3300000131130218505859375, 0.670000016689300537109375)) * 6.28318023681640625) * 0.5);
    float3 lit = mix((art * 2.0) * holo, float3(1.0) - (((float3(1.0) - art) * 2.0) * (float3(1.0) - holo)), step(float3(0.5), art));
    art = mix(art, lit, float3(_113.uFoil * 0.699999988079071044921875));
    float3 border = (float3(_113.uBorderColor) * (1.0 - (0.100000001490116119384765625 * (1.0 - smoothstep(0.2199999988079071044921875, 0.60000002384185791015625, reach))))) * mix(float3(1.0), float3(0.920000016689300537109375) + (holo * 0.07999999821186065673828125), float3(_113.uFoil));
    float3 sticker = mix(border, art, float3(tex.w));
    float band = smoothstep(-0.1500000059604644775390625, 0.550000011920928955078125, dot(sn, float2(-0.481918752193450927734375, 0.87621593475341796875))) * (1.0 - smoothstep(0.550000011920928955078125, 0.62000000476837158203125, dot(sn, float2(-0.481918752193450927734375, 0.87621593475341796875))));
    sticker += float3(_113.uGloss * ((0.319999992847442626953125 * band) + 0.0500000007450580596923828125));
    float4 acc = float4(float3(_113.uBackground) * _113.uBackgroundAlpha, _113.uBackgroundAlpha);
    float4 param_8 = acc;
    float3 param_9 = float3(0.0);
    float param_10 = sh * (1.0 - cut);
    acc = over(param_8, param_9, param_10);
    float4 param_11 = acc;
    float3 param_12 = fast::clamp(sticker, float3(0.0), float3(1.0));
    float param_13 = cut;
    acc = over(param_11, param_12, param_13);
    float4 param_14 = acc;
    fragColor = unpremultiply(param_14);
}

fragment flair_sticker_cutout_frag_out flair_sticker_cutout_frag(constant FlairUniforms& _113 [[buffer(0)]], texture2d<float> uMask [[texture(1)]], sampler uMaskSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_sticker_cutout_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _497;
    if (_113.flair_flipY > 0.5)
    {
        _497 = _113.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _497 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _497);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, uMask, uMaskSmplr, _113);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

