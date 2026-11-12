// flair-metal-hash: 45f4a71c
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
    packed_float3 uBackground;
    float uBackgroundAlpha;
    float uSize;
    float uBevel;
    float3 uTint;
    float3 uSky;
    packed_float3 uGround;
    float uHorizon;
    float uBrushed;
    float uSweep;
    float uSweepTime;
    float uShadow;
};

struct flair_chrome_text_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 textPlace(thread const float2& p, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _159)
{
    float2 size = float2(int2(uText.get_width(), uText.get_height()));
    float aspect = size.x / fast::max(size.y, 1.0);
    float h = fast::min(_159.uSize, ((_159.iResolution[0u] / _159.iResolution[1u]) * _159.uSize) / aspect);
    return float3((p / float2(h * aspect, h)) + float2(0.5), size.y / h);
}

static inline __attribute__((always_inline))
float textAt(thread const float2& p, thread const float& blur, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _159)
{
    float2 param = p;
    float3 m = textPlace(param, uText, uTextSmplr, _159);
    bool _201 = m.x < 0.0;
    bool _208;
    if (!_201)
    {
        _208 = m.x > 1.0;
    }
    else
    {
        _208 = _201;
    }
    bool _215;
    if (!_208)
    {
        _215 = m.y < 0.0;
    }
    else
    {
        _215 = _208;
    }
    bool _222;
    if (!_215)
    {
        _222 = m.y > 1.0;
    }
    else
    {
        _222 = _215;
    }
    if (_222)
    {
        return 0.0;
    }
    return uText.sample(uTextSmplr, m.xy, level(log2(fast::max(blur * m.z, 1.0)))).w;
}

static inline __attribute__((always_inline))
float bevelHeight(thread const float2& p, thread const float& bevel, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _159)
{
    float2 param = p;
    float param_1 = bevel * 0.5;
    float2 param_2 = p;
    float param_3 = bevel;
    float2 param_4 = p;
    float param_5 = bevel * 2.0;
    return ((0.449999988079071044921875 * textAt(param, param_1, uText, uTextSmplr, _159)) + (0.3499999940395355224609375 * textAt(param_2, param_3, uText, uTextSmplr, _159))) + (0.20000000298023223876953125 * textAt(param_4, param_5, uText, uTextSmplr, _159));
}

static inline __attribute__((always_inline))
float2 bevelSlope(thread const float2& p, thread const float& bevel, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _159)
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
    float2 d = float2(bevelHeight(param, param_1, uText, uTextSmplr, _159) - bevelHeight(param_2, param_3, uText, uTextSmplr, _159), bevelHeight(param_4, param_5, uText, uTextSmplr, _159) - bevelHeight(param_6, param_7, uText, uTextSmplr, _159));
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _159)
{
    float px = 1.0 / _159.iResolution[1u];
    float2 p = (fragCoord - (float2(_159.iResolution[0], _159.iResolution[1]) * 0.5)) * px;
    float2 param = p;
    float param_1 = 1.5 * px;
    float mask = textAt(param, param_1, uText, uTextSmplr, _159);
    float2 param_2 = p;
    float param_3 = _159.uBevel;
    float2 s = bevelSlope(param_2, param_3, uText, uTextSmplr, _159);
    float2 param_4 = p;
    float param_5 = _159.uBevel;
    float h = bevelHeight(param_4, param_5, uText, uTextSmplr, _159);
    float2 param_6 = float2(p.x * 4.0, p.y * 700.0);
    float2 param_7 = float2(p.x * 20.0, p.y * 1500.0);
    float streak = (vnoise(param_6) * 0.60000002384185791015625) + (vnoise(param_7) * 0.4000000059604644775390625);
    s.y += ((_159.uBrushed * (streak - 0.5)) * 0.25);
    float2 param_8 = float2(0.0);
    float textH = float2(int2(uText.get_width(), uText.get_height())).y / textPlace(param_8, uText, uTextSmplr, _159).z;
    float ey = ((p.y / (0.3499999940395355224609375 * textH)) - (s.y * 1.60000002384185791015625)) - _159.uHorizon;
    float ex = (p.x * 0.60000002384185791015625) - (s.x * 1.60000002384185791015625);
    float3 sky = mix(_159.uSky, _159.uSky * float3(0.37999999523162841796875, 0.449999988079071044921875, 0.62000000476837158203125), float3(fast::clamp(ey, 0.0, 1.0)));
    float3 ground = mix(float3(_159.uGround), float3(_159.uGround) * 0.119999997317790985107421875, float3(fast::clamp((-ey) * 1.60000002384185791015625, 0.0, 1.0)));
    float3 env = select(ground, sky, bool3(ey > 0.0));
    env += float3((smoothstep(0.0599999986588954925537109375, 0.0, abs(ey)) * 0.89999997615814208984375) * (1.0 - (0.60000002384185791015625 * _159.uBrushed)));
    env = mix(env, float3(dot(env, float3(0.333000004291534423828125))), float3(_159.uBrushed * 0.5)) * (1.0 - ((0.25 * _159.uBrushed) * streak));
    float phase = fract(_159.iTime / _159.uSweepTime);
    float glintAt = mix(-2.0, 2.0, fast::clamp(phase / 0.60000002384185791015625, 0.0, 1.0));
    env += float3((_159.uSweep * exp(-powr(((ex + (0.4000000059604644775390625 * ey)) - glintAt) * 3.5, 2.0))) * (1.0 - (0.5 * _159.uBrushed)));
    float3 metal = env * _159.uTint;
    float3 n = fast::normalize(float3((-s) * 1.39999997615814208984375, 1.0));
    float3 light = float3(-0.447213590145111083984375, 0.536656320095062255859375, 0.715541779994964599609375);
    metal += (_159.uTint * (powr(fast::max(dot(reflect(-light, n), float3(0.0, 0.0, 1.0)), 0.0), 30.0) * 0.800000011920928955078125));
    metal *= (0.85000002384185791015625 + (0.1500000059604644775390625 * h));
    float2 param_9 = p - float2(0.00999999977648258209228515625, -0.01600000075995922088623046875);
    float param_10 = _159.uBevel * 2.5;
    float3 col = float3(_159.uBackground) * (1.0 - ((_159.uShadow * 0.699999988079071044921875) * textAt(param_9, param_10, uText, uTextSmplr, _159)));
    col = mix(col, metal, float3(mask));
    fragColor = float4(col, fast::max(_159.uBackgroundAlpha, mask));
}

fragment flair_chrome_text_frag_out flair_chrome_text_frag(constant FlairUniforms& _159 [[buffer(0)]], texture2d<float> uText [[texture(1)]], sampler uTextSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_chrome_text_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _626;
    if (_159.flair_flipY > 0.5)
    {
        _626 = _159.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _626 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _626);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, uText, uTextSmplr, _159);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

