// flair-metal-hash: d2602c6b
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
    packed_float3 uColor;
    float uSize;
    float uFill;
    float uOutline;
    float uScanlines;
    float uLineSpacing;
    float uFlicker;
    float uGlitch;
    float uBeam;
    char _m22_pad[4];
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_hologram_text_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 textHalf(constant FlairUniforms& _155, texture2d<float> uText, sampler uTextSmplr)
{
    float2 size = float2(int2(uText.get_width(), uText.get_height()));
    float aspect = size.x / fast::max(size.y, 1.0);
    float h = fast::min(_155.uSize * 0.699999988079071044921875, ((_155.iResolution[0u] / _155.iResolution[1u]) * 0.89999997615814208984375) / aspect);
    return float2(h * aspect, h) * 0.5;
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
float3 holoBeam(thread const float2& p, thread const float2& base, thread const float& top, thread const float& width, constant FlairUniforms& _155)
{
    float3 col = float3(0.0);
    float up = (p.y - base.y) / fast::max(top - base.y, 0.001000000047497451305389404296875);
    if ((up > 0.0) && (up < 1.2000000476837158203125))
    {
        float spread = mix(width * 0.119999997317790985107421875, width, fast::clamp(up, 0.0, 1.0));
        float across = abs(p.x - base.x) / spread;
        float2 param = float2(((p.x - base.x) / spread) * 6.0, (up * 2.0) - (_155.iTime * 0.800000011920928955078125));
        float rays = 0.60000002384185791015625 + (0.4000000059604644775390625 * vnoise(param));
        col += ((((float3(_155.uColor) * smoothstep(1.0, 0.60000002384185791015625, across)) * (1.0 - smoothstep(0.0, 1.14999997615814208984375, up))) * rays) * 0.2199999988079071044921875);
        col += (((float3(_155.uColor) * exp(((-across) * across) * 30.0)) * (1.0 - up)) * 0.119999997317790985107421875);
    }
    float2 e = (p - base) * float2(1.0, 3.599999904632568359375);
    float r = length(e);
    float rings = 0.0;
    for (int i = 0; i < 3; i++)
    {
        float ri = width * (0.180000007152557373046875 + (0.1599999964237213134765625 * float(i)));
        float d = abs((r - ri) - (0.0040000001899898052215576171875 * sin((_155.iTime * 3.0) + float(i))));
        rings += (exp(((-d) * d) / 6.0000002122251316905021667480469e-06) * (1.0 - (0.25 * float(i))));
    }
    col += (float3(_155.uColor) * (((rings * 0.89999997615814208984375) + (exp((-r) / (width * 0.119999997317790985107421875)) * 1.2000000476837158203125)) + (exp((-r) / (width * 0.5)) * 0.1500000059604644775390625)));
    return col;
}

static inline __attribute__((always_inline))
float2 holoGlitch(thread const float& v, constant FlairUniforms& _155)
{
    float k = floor(_155.iTime * 7.0);
    float2 param = float2(k, 3.2999999523162841796875);
    float on = step(1.0 - (0.449999988079071044921875 * _155.uGlitch), hash12(param));
    float2 param_1 = float2(k, 5.900000095367431640625);
    float bands = 5.0 + floor(14.0 * hash12(param_1));
    float band = floor(v * bands);
    float2 param_2 = float2(band, k + 0.5);
    float h = hash12(param_2);
    float hit = on * step(0.699999988079071044921875, h);
    float2 param_3 = float2(band, k + 9.1000003814697265625);
    return float2((((hash12(param_3) - 0.5) * 0.100000001490116119384765625) * _155.uGlitch) * hit, hit);
}

static inline __attribute__((always_inline))
float letters(thread const float2& p, thread const float2& centre, constant FlairUniforms& _155, texture2d<float> uText, sampler uTextSmplr)
{
    float2 uv = ((p - centre) / (textHalf(_155, uText, uTextSmplr) * 2.0)) + float2(0.5);
    bool _614 = uv.x < 0.0;
    bool _621;
    if (!_614)
    {
        _621 = uv.x > 1.0;
    }
    else
    {
        _621 = _614;
    }
    bool _628;
    if (!_621)
    {
        _628 = uv.y < 0.0;
    }
    else
    {
        _628 = _621;
    }
    bool _635;
    if (!_628)
    {
        _635 = uv.y > 1.0;
    }
    else
    {
        _635 = _628;
    }
    if (_635)
    {
        return 0.0;
    }
    return uText.sample(uTextSmplr, uv).w;
}

static inline __attribute__((always_inline))
float holoScan(thread const float& y, constant FlairUniforms& _155)
{
    float s = 0.5 + (0.5 * sin(((y - (_155.iTime * 24.0)) * 6.28318023681640625) / _155.uLineSpacing));
    float r = (fract(((y / _155.iResolution[1u]) * 0.60000002384185791015625) - (_155.iTime * 0.180000007152557373046875)) * 8.0) - 4.0;
    float roll = exp((-r) * r) * 0.3499999940395355224609375;
    return (1.0 - ((_155.uScanlines * 0.75) * (1.0 - s))) * (1.0 + (roll * _155.uScanlines));
}

static inline __attribute__((always_inline))
float holoFlicker(constant FlairUniforms& _155)
{
    float k = floor(_155.iTime * 18.0);
    float2 param = float2(k, 1.2999999523162841796875);
    float dip = step(1.0 - (0.119999997317790985107421875 * _155.uFlicker), hash12(param)) * 0.64999997615814208984375;
    float2 param_1 = float2(k, 7.099999904632568359375);
    return (1.0 - (_155.uFlicker * ((0.119999997317790985107421875 * hash12(param_1)) + (0.0599999986588954925537109375 * sin(_155.iTime * 11.0))))) - dip;
}

static inline __attribute__((always_inline))
float4 holoOver(thread float3& light, constant FlairUniforms& _155)
{
    light = float3(1.0) - exp(-fast::max(light, float3(0.0)));
    float a = fast::max(light.x, fast::max(light.y, light.z));
    float3 col = ((float3(_155.uBackground) * _155.uBackgroundAlpha) * (1.0 - a)) + light;
    float alpha = _155.uBackgroundAlpha + (a * (1.0 - _155.uBackgroundAlpha));
    return float4(fast::min(col / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), float3(1.0)), alpha);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _155, texture2d<float> uText, sampler uTextSmplr)
{
    float px = 1.0 / _155.iResolution[1u];
    float2 p = (fragCoord - (float2(_155.iResolution[0], _155.iResolution[1]) * 0.5)) * px;
    float2 hb = textHalf(_155, uText, uTextSmplr);
    float2 centre = float2(0.0, 0.0599999986588954925537109375 + (0.00999999977648258209228515625 * sin(_155.iTime * 1.39999997615814208984375)));
    float2 base = float2(0.0, -0.4199999868869781494140625);
    float2 param = p;
    float2 param_1 = base;
    float param_2 = centre.y - hb.y;
    float param_3 = hb.x * 1.0499999523162841796875;
    float3 light = holoBeam(param, param_1, param_2, param_3, _155) * _155.uBeam;
    float param_4 = ((p.y - centre.y) / (2.0 * hb.y)) + 0.5;
    float2 tear = holoGlitch(param_4, _155);
    float2 q = p + float2((tear.x * hb.x) * 2.0, 0.0);
    float2 param_5 = q;
    float2 param_6 = centre;
    float m = letters(param_5, param_6, _155, uText, uTextSmplr);
    float edge = fast::clamp(length(float2(dfdx(m), dfdy(m))) * 1.5, 0.0, 1.0);
    float3 c = float3(_155.uColor) * (((m * _155.uFill) * (1.10000002384185791015625 + (0.300000011920928955078125 * sin(((q.x - centre.x) * 40.0) + (_155.iTime * 3.0))))) + ((edge * _155.uOutline) * 2.2000000476837158203125));
    if (tear.y > 0.5)
    {
        float2 param_7 = q + float2(0.006000000052154064178466796875, 0.0);
        float2 param_8 = centre;
        float r = letters(param_7, param_8, _155, uText, uTextSmplr);
        float2 param_9 = q - float2(0.006000000052154064178466796875, 0.0);
        float2 param_10 = centre;
        float b = letters(param_9, param_10, _155, uText, uTextSmplr);
        c += ((float3(r, 0.0, b) * 0.60000002384185791015625) * _155.uColor[1u]);
    }
    float halo = 0.0;
    for (int i = 0; i < 6; i++)
    {
        float a = float(i) * 1.0471999645233154296875;
        float2 param_11 = q + (float2(cos(a), sin(a)) * 0.0199999995529651641845703125);
        float2 param_12 = centre;
        halo += letters(param_11, param_12, _155, uText, uTextSmplr);
    }
    light += (c + ((((float3(_155.uColor) * halo) / float3(6.0)) * 0.25) * (1.0 - m)));
    float param_13 = fragCoord.y;
    light *= (holoScan(param_13, _155) * holoFlicker(_155));
    float3 param_14 = light;
    float4 _854 = holoOver(param_14, _155);
    fragColor = _854;
}

fragment flair_hologram_text_frag_out flair_hologram_text_frag(constant FlairUniforms& _155 [[buffer(0)]], texture2d<float> uText [[texture(1)]], sampler uTextSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_hologram_text_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _867;
    if (_155.flair_flipY > 0.5)
    {
        _867 = _155.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _867 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _867);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _155, uText, uTextSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

