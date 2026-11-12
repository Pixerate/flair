// flair-metal-hash: 306842b0
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
    packed_float3 uFill;
    float uSize;
    float uHeight;
    float uSpeed;
    float uSmoulder;
    float uSparks;
    float3 uHot;
    float3 uMid;
    float3 uCool;
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_flaming_text_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 textHalf(constant FlairUniforms& _252, texture2d<float> uText, sampler uTextSmplr)
{
    float2 size = float2(int2(uText.get_width(), uText.get_height()));
    float aspect = size.x / fast::max(size.y, 1.0);
    float h = fast::min(_252.uSize, ((_252.iResolution[0u] / _252.iResolution[1u]) * 0.920000016689300537109375) / aspect);
    return float2(h * aspect, h) * 0.5;
}

static inline __attribute__((always_inline))
float letters(thread const float2& p, thread const float2& hb, texture2d<float> uText, sampler uTextSmplr)
{
    float2 uv = (p / (hb * 2.0)) + float2(0.5);
    bool _575 = uv.x < 0.0;
    bool _582;
    if (!_575)
    {
        _582 = uv.x > 1.0;
    }
    else
    {
        _582 = _575;
    }
    bool _589;
    if (!_582)
    {
        _589 = uv.y < 0.0;
    }
    else
    {
        _589 = _582;
    }
    bool _596;
    if (!_589)
    {
        _596 = uv.y > 1.0;
    }
    else
    {
        _596 = _589;
    }
    if (_596)
    {
        return 0.0;
    }
    return uText.sample(uTextSmplr, uv).w;
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
float flameNoise(thread const float2& p, thread const float& t)
{
    float2 param = (p * 0.60000002384185791015625) + float2(0.0, (-t) * 0.5);
    int param_1 = 3;
    float _301 = fbm(param, param_1);
    float2 param_2 = (p * 0.60000002384185791015625) + float2(4.30000019073486328125, 1.7000000476837158203125 - (t * 0.699999988079071044921875));
    int param_3 = 3;
    float _313 = fbm(param_2, param_3);
    float2 w = float2(_301, _313);
    float2 param_4 = (p + ((w - float2(0.5)) * 1.7999999523162841796875)) + float2(0.0, -t);
    int param_5 = 4;
    float _329 = fbm(param_4, param_5);
    return _329;
}

static inline __attribute__((always_inline))
float blurred(thread const float2& p, thread const float2& hb, thread const float& r, texture2d<float> uText, sampler uTextSmplr)
{
    float2 param = p;
    float2 param_1 = hb;
    float s = letters(param, param_1, uText, uTextSmplr) * 2.0;
    for (int i = 0; i < 4; i++)
    {
        float a = (float(i) * 1.57079994678497314453125) + 0.785000026226043701171875;
        float2 param_2 = p + (float2(cos(a), sin(a)) * r);
        float2 param_3 = hb;
        s += letters(param_2, param_3, uText, uTextSmplr);
    }
    return s / 6.0;
}

static inline __attribute__((always_inline))
float3 fireLight(thread float& h, constant FlairUniforms& _252)
{
    h = fast::clamp(h, 0.0, 1.0);
    float3 c = _252.uCool * smoothstep(0.0, 0.20000000298023223876953125, h);
    c = mix(c, _252.uMid, float3(smoothstep(0.2199999988079071044921875, 0.550000011920928955078125, h)));
    c = mix(c, _252.uHot, float3(smoothstep(0.60000002384185791015625, 0.949999988079071044921875, h)));
    return c * (0.699999988079071044921875 + ((3.0 * h) * h));
}

static inline __attribute__((always_inline))
float4 fireBase(constant FlairUniforms& _252)
{
    return float4(float3(_252.uBackground) * _252.uBackgroundAlpha, _252.uBackgroundAlpha);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float sparks(thread const float2& p, thread const float& t, thread const float& amount)
{
    float s = 0.0;
    for (int l = 0; l < 3; l++)
    {
        float fl = float(l);
        float scale = 7.0 + (5.0 * fl);
        float2 q = (p * scale) - float2(0.0, t * (2.2000000476837158203125 + (0.60000002384185791015625 * fl)));
        float2 cell = floor(q);
        float2 param = cell + float2(fl * 31.700000762939453125);
        float2 param_1 = cell + float2(7.69999980926513671875, fl);
        float3 h = float3(hash22(param), hash12(param_1));
        if (h.z > (amount * 0.5))
        {
            continue;
        }
        float2 c = (float2(0.25) + (h.xy * 0.5)) + float2(0.119999997317790985107421875 * sin((t * 2.5) + (h.x * 40.0)), 0.0);
        float2 d = ((fract(q) - c) * float2(1.0, 0.550000011920928955078125)) / float2(scale);
        float r = (0.001599999959580600261688232421875 + (0.001599999959580600261688232421875 * h.y)) * (1.0 - (0.25 * fl));
        float twinkle = 0.550000011920928955078125 + (0.449999988079071044921875 * sin((t * 17.0) + (h.y * 60.0)));
        s += (exp((-dot(d, d)) / (r * r)) * twinkle);
    }
    return s;
}

static inline __attribute__((always_inline))
float4 fireOver(thread const float4& base, thread float3& light)
{
    light = float3(1.0) - exp(-fast::max(light, float3(0.0)));
    float a = fast::max(light.x, fast::max(light.y, light.z));
    float3 col = (base.xyz * (1.0 - a)) + light;
    float alpha = base.w + (a * (1.0 - base.w));
    return float4(fast::min(col / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), float3(1.0)), alpha);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _252, texture2d<float> uText, sampler uTextSmplr)
{
    float px = 1.0 / _252.iResolution[1u];
    float2 hb = textHalf(_252, uText, uTextSmplr);
    float2 p = ((fragCoord - (float2(_252.iResolution[0], _252.iResolution[1]) * 0.5)) * px) + float2(0.0, _252.uHeight * 0.300000011920928955078125);
    float t = (_252.iTime * _252.uSpeed) * 1.60000002384185791015625;
    float2 param = p;
    float2 param_1 = hb;
    float mask = letters(param, param_1, uText, uTextSmplr);
    float heat = 0.0;
    float n = 0.0;
    for (int i = 0; i < 3; i++)
    {
        float fi = float(i);
        float2 param_2 = (p * 8.0) + float2(fi * 7.30000019073486328125);
        float param_3 = t * (1.0 + (0.1500000059604644775390625 * fi));
        float m = flameNoise(param_2, param_3);
        n = fast::max(n, m);
        float lift = _252.uHeight * (0.0199999995529651641845703125 + ((1.7000000476837158203125 * m) * m));
        float2 param_4 = float2((p.y * 7.0) - (t * 1.2000000476837158203125), (fi * 5.0) + (p.x * 2.0));
        float side = ((vnoise(param_4) - 0.5) * _252.uHeight) * 0.449999988079071044921875;
        float2 param_5 = p - float2(side, lift);
        float2 param_6 = hb;
        float param_7 = 0.0040000001899898052215576171875 + (lift * 0.119999997317790985107421875);
        heat = fast::max(heat, (blurred(param_5, param_6, param_7, uText, uTextSmplr) * powr(fast::max(1.0 - (lift / (_252.uHeight * 1.35000002384185791015625)), 0.0), 1.39999997615814208984375)) * (0.4000000059604644775390625 + (0.75 * m)));
    }
    heat = fast::max(heat, mask * 0.300000011920928955078125);
    float param_8 = heat;
    float3 _795 = fireLight(param_8, _252);
    float3 light = _795 * (1.0 - (0.85000002384185791015625 * mask));
    float2 param_9 = (p * 16.0) + float2(0.0, (-t) * 0.20000000298023223876953125);
    int param_10 = 4;
    float _812 = fbm(param_9, param_10);
    float glowing = _812;
    float cracks = (0.60000002384185791015625 * smoothstep(0.0350000001490116119384765625, 0.0, abs(glowing - 0.5))) + smoothstep(0.60000002384185791015625, 0.7799999713897705078125, glowing);
    float edge = fast::clamp(length(float2(dfdx(mask), dfdy(mask))) * 3.0, 0.0, 1.0);
    float pulse = 0.75 + (0.25 * sin((_252.iTime * 2.0) + (glowing * 12.0)));
    float param_11 = 0.3499999940395355224609375 + (0.449999988079071044921875 * cracks);
    float3 _853 = fireLight(param_11, _252);
    float3 coal = float3(_252.uFill) + ((float3(1.0) - exp(((-_853) * cracks) * pulse)) * _252.uSmoulder);
    float4 acc = fireBase(_252);
    acc = float4((acc.xyz * (1.0 - mask)) + (coal * mask), (acc.w * (1.0 - mask)) + mask);
    light += (((_252.uMid * edge) * _252.uSmoulder) * 0.800000011920928955078125);
    float rise = (smoothstep((-hb.y) * 0.5, hb.y, p.y) * exp((-fast::max(p.y - hb.y, 0.0)) / ((_252.uHeight * 1.2000000476837158203125) + 0.02999999932944774627685546875))) * (1.0 - smoothstep(hb.x * 0.60000002384185791015625, hb.x + 0.0500000007450580596923828125, abs(p.x)));
    float2 param_12 = p;
    float param_13 = _252.iTime * _252.uSpeed;
    float param_14 = _252.uSparks;
    light += (((mix(_252.uHot, _252.uMid, float3(0.4000000059604644775390625)) * sparks(param_12, param_13, param_14)) * rise) * 1.60000002384185791015625);
    float4 param_15 = acc;
    float3 param_16 = light;
    float4 _966 = fireOver(param_15, param_16);
    fragColor = _966;
}

fragment flair_flaming_text_frag_out flair_flaming_text_frag(constant FlairUniforms& _252 [[buffer(0)]], texture2d<float> uText [[texture(1)]], sampler uTextSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_flaming_text_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _979;
    if (_252.flair_flipY > 0.5)
    {
        _979 = _252.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _979 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _979);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _252, uText, uTextSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

