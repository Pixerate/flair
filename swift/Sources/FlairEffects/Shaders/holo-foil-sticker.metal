// flair-metal-hash: 24c5779b
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
    float3 uTint;
    packed_float3 uBorderColor;
    float uBorder;
    float uSize;
    float uFoil;
    float uSparkle;
    float uShadow;
    float uTilt;
    uint uDemo;
    char _m22_pad[8];
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_holo_foil_sticker_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 hoverPoint(thread const bool& demo, thread const float& idle, constant FlairUniforms& _177)
{
    float2 drift = float2(_177.iResolution[0], _177.iResolution[1]) * (float2(0.5) + float2(0.300000011920928955078125 * sin(_177.iTime * 0.62999999523162841796875), 0.23999999463558197021484375 * sin((_177.iTime * 0.910000026226043701171875) + 1.2999999523162841796875)));
    float h = fast::clamp(_177.iPointer.z, 0.0, 1.0);
    return float3(mix(drift, _177.iPointer.xy, float2(h)), mix(demo ? idle : 0.0, 1.0, h));
}

static inline __attribute__((always_inline))
float maskAt(thread const float2& uv, thread const float& lod, texture2d<float> uMask, sampler uMaskSmplr)
{
    float2 inside = step(float2(0.0), uv) * step(uv, float2(1.0));
    return (uMask.sample(uMaskSmplr, uv, level(lod)).w * inside.x) * inside.y;
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
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _177, texture2d<float> uMask, sampler uMaskSmplr)
{
    float2 res = float2(_177.iResolution[0], _177.iResolution[1]);
    float px = fast::min(res.x, res.y);
    float2 ts = float2(int2(uMask.get_width(), uMask.get_height()));
    float ia = ts.x / fast::max(ts.y, 1.0);
    float w = fast::min(res.x * _177.uSize, (res.y * _177.uSize) * ia);
    float2 hs = float2(w, w / ia) * 0.5;
    bool param = _177.uDemo != 0u;
    float param_1 = 0.699999988079071044921875;
    float3 hp = hoverPoint(param, param_1, _177);
    float2 tilt = (fast::clamp((hp.xy - (res * 0.5)) / (res * 0.5), float2(-1.0), float2(1.0)) * hp.z) * _177.uTilt;
    float2 s = (fragCoord - (res * 0.5)) / hs;
    float2 sn = (fragCoord - (res * 0.5)) / float2(fast::max(hs.x, hs.y));
    float2 q = s / float2(fast::max(1.0 - (0.119999997317790985107421875 * dot(sn, tilt)), 0.20000000298023223876953125));
    float2 uv = (q * 0.5) + float2(0.5);
    float2 toUv = float2(1.0) / (hs * 2.0);
    float2 rb = toUv * (_177.uBorder * px);
    float2 param_2 = uv;
    float param_3 = 0.0;
    float a0 = maskAt(param_2, param_3, uMask, uMaskSmplr);
    float reach = a0;
    for (int i = 0; i < 24; i++)
    {
        float ang = float(i) * 0.2617990076541900634765625;
        float2 d = float2(cos(ang), sin(ang)) * rb;
        float2 param_4 = uv + (d * 0.85000002384185791015625);
        float param_5 = 2.0;
        reach = fast::max(reach, maskAt(param_4, param_5, uMask, uMaskSmplr));
        float2 param_6 = uv + (d * 0.550000011920928955078125);
        float param_7 = 1.0;
        reach = fast::max(reach, maskAt(param_6, param_7, uMask, uMaskSmplr));
        float2 param_8 = uv + (d * 0.2800000011920928955078125);
        float param_9 = 0.5;
        reach = fast::max(reach, maskAt(param_8, param_9, uMask, uMaskSmplr));
    }
    float cut = smoothstep(0.20000000298023223876953125, 0.5, reach);
    float face = smoothstep(0.3499999940395355224609375, 0.64999997615814208984375, a0);
    float2 drop = ((float2(0.0, 0.02999999932944774627685546875) + (tilt * 0.02500000037252902984619140625)) * px) * toUv;
    float sh = 0.0;
    for (int i_1 = 0; i_1 < 8; i_1++)
    {
        float ang_1 = (float(i_1) * 0.785398006439208984375) + 0.38999998569488525390625;
        float2 param_10 = (uv + drop) + ((float2(cos(ang_1), sin(ang_1)) * rb) * 1.2999999523162841796875);
        float param_11 = 3.5;
        sh += maskAt(param_10, param_11, uMask, uMaskSmplr);
    }
    sh = smoothstep(0.0, 0.449999988079071044921875, sh / 8.0) * _177.uShadow;
    float2 fuv = uv * float2(ia, 1.0);
    float4 tex = uMask.sample(uMaskSmplr, fast::clamp(uv, float2(0.0), float2(1.0)), level(0.0));
    float3 base = (tex.xyz / float3(fast::max(tex.w, 0.001000000047497451305389404296875))) * _177.uTint;
    float2 param_12 = fuv * 5.0;
    float nz = vnoise(param_12);
    float phase = ((((dot(fuv, float2(0.449999988079071044921875, 0.800000011920928955078125)) * 0.89999997615814208984375) + (tilt.x * 1.10000002384185791015625)) - (tilt.y * 0.800000011920928955078125)) + (nz * 0.3499999940395355224609375)) + (_177.iTime * 0.039999999105930328369140625);
    float3 rainbow = float3(0.5) + (cos((float3(phase) + float3(0.0, 0.3300000131130218505859375, 0.670000016689300537109375)) * 6.28318023681640625) * 0.5);
    float grating = 0.5 + (0.5 * sin((((fuv.x * 0.60000002384185791015625) + fuv.y) * 240.0) + (tilt.x * 18.0)));
    float3 diffraction = float3(0.5) + (cos((float3((phase * 2.400000095367431640625) + (grating * 0.180000007152557373046875)) + float3(0.0, 0.3300000131130218505859375, 0.670000016689300537109375)) * 6.28318023681640625) * 0.5);
    float3 holo = mix(rainbow, diffraction, float3(0.3499999940395355224609375));
    float band = exp((-powr((dot(sn, float2(0.581238210201263427734375, 0.81373345851898193359375)) * 1.39999997615814208984375) - ((tilt.x + tilt.y) * 0.89999997615814208984375), 2.0)) * 2.5);
    float foil = _177.uFoil * (0.4000000059604644775390625 + (0.60000002384185791015625 * band));
    float3 lit = mix((base * 2.0) * holo, float3(1.0) - (((float3(1.0) - base) * 2.0) * (float3(1.0) - holo)), step(float3(0.5), base));
    float3 metal = ((base * powr(holo, float3(1.39999997615814208984375))) * (0.85000002384185791015625 + (0.300000011920928955078125 * grating))) * 1.10000002384185791015625;
    float3 col = mix(base, mix(lit, metal, float3(0.64999997615814208984375)), float3(foil));
    col *= (1.0 - ((0.4000000059604644775390625 * smoothstep(0.25, 0.5, a0)) * (1.0 - smoothstep(0.5, 0.85000002384185791015625, a0))));
    float2 cell = floor(fuv * 26.0);
    float2 param_13 = cell;
    float2 inCell = (fract(fuv * 26.0) - float2(0.5)) - ((hash22(param_13) - float2(0.5)) * 0.5);
    float2 param_14 = cell + float2(7.099999904632568359375);
    float h = hash12(param_14);
    float catchLight = powr(0.5 + (0.5 * sin(((h * 60.0) + (_177.iTime * 2.2000000476837158203125)) + dot(tilt, float2(9.0, 7.0)))), 14.0);
    float glint = (exp((-abs(inCell.x)) * 38.0) * exp((-abs(inCell.y)) * 7.0)) + (exp((-abs(inCell.y)) * 38.0) * exp((-abs(inCell.x)) * 7.0));
    col += float3((((step(0.819999992847442626953125, h) * catchLight) * glint) * _177.uSparkle) * 1.60000002384185791015625);
    float3 border = float3(_177.uBorderColor) * (float3(0.939999997615814208984375) + (holo * 0.0599999986588954925537109375));
    float edge = 1.0 - smoothstep(0.2199999988079071044921875, 0.60000002384185791015625, reach);
    border *= (1.0 - (0.119999997317790985107421875 * edge));
    float3 sticker = mix(border, col, float3(face));
    float2 g = sn - (tilt * 0.699999988079071044921875);
    sticker += float3((0.3499999940395355224609375 * exp((-dot(g, g)) * 2.5)) + (0.0599999986588954925537109375 * smoothstep(-0.20000000298023223876953125, 1.0, sn.y)));
    float4 acc = float4(float3(_177.uBackground) * _177.uBackgroundAlpha, _177.uBackgroundAlpha);
    float4 param_15 = acc;
    float3 param_16 = float3(0.0);
    float param_17 = sh * (1.0 - cut);
    acc = over(param_15, param_16, param_17);
    float4 param_18 = acc;
    float3 param_19 = fast::clamp(sticker, float3(0.0), float3(1.0));
    float param_20 = cut;
    acc = over(param_18, param_19, param_20);
    float4 param_21 = acc;
    fragColor = unpremultiply(param_21);
}

fragment flair_holo_foil_sticker_frag_out flair_holo_foil_sticker_frag(constant FlairUniforms& _177 [[buffer(0)]], texture2d<float> uMask [[texture(1)]], sampler uMaskSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_holo_foil_sticker_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _915;
    if (_177.flair_flipY > 0.5)
    {
        _915 = _177.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _915 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _915);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _177, uMask, uMaskSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

