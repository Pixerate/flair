// flair-metal-hash: d21e4444
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
    float3 uBackground;
    float3 uInk;
    packed_float3 uBand;
    float uTint;
    float uStretch;
    float uCut;
    float uWaves;
    int uColumns;
    float uSize;
    float uSpeed;
    float uBackgroundAlpha;
};

struct flair_stretch_text_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _42, texture2d<float> uText, sampler uTextSmplr)
{
    float2 p = (fragCoord - (float2(_42.iResolution[0], _42.iResolution[1]) * 0.5)) / float2(_42.iResolution[1u]);
    float2 size = float2(int2(uText.get_width(), uText.get_height()));
    float aspect = size.x / fast::max(size.y, 1.0);
    float frame = _42.iResolution[0u] / _42.iResolution[1u];
    float h = fast::min(_42.uSize, (frame * 0.920000016689300537109375) / aspect);
    float u = (p.x / (h * aspect)) + 0.5;
    float v = (p.y / h) + 0.5;
    float _112;
    if (_42.uColumns > 0)
    {
        _112 = (floor(u * float(_42.uColumns)) + 0.5) / float(_42.uColumns);
    }
    else
    {
        _112 = u;
    }
    float across = _112;
    float wave = 0.5 + (0.5 * sin(((across * _42.uWaves) * 6.28318023681640625) - (((_42.iTime * _42.uSpeed) * 6.28318023681640625) / 4.0)));
    float s = (_42.uStretch * fast::max((0.939999997615814208984375 / h) - 1.0, 0.0)) * wave;
    float d = v - _42.uCut;
    float inBand = step(abs(d), 0.5 * s);
    float row = _42.uCut + (sign(d) * fast::max(abs(d) - (0.5 * s), 0.0));
    float mask = 0.0;
    if ((((u >= 0.0) && (u <= 1.0)) && (row >= 0.0)) && (row <= 1.0))
    {
        mask = uText.sample(uTextSmplr, float2(u, row)).w;
    }
    float3 ink = mix(_42.uInk, float3(_42.uBand), float3(_42.uTint * inBand));
    fragColor = float4(mix(_42.uBackground, ink, float3(mask)), 1.0);
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
    float3 _280;
    if (a > 0.0)
    {
        _280 = bg + (d / float3(a));
    }
    else
    {
        _280 = bg;
    }
    float3 fg = _280;
    float alpha = a + (opacity * (1.0 - a));
    float3 _302;
    if (alpha > 0.0)
    {
        _302 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _302 = bg;
    }
    float3 col = _302;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _42, texture2d<float> uText, sampler uTextSmplr)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _42, uText, uTextSmplr);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _42.uBackground;
    float param_4 = _42.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_stretch_text_frag_out flair_stretch_text_frag(constant FlairUniforms& _42 [[buffer(0)]], texture2d<float> uText [[texture(1)]], sampler uTextSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_stretch_text_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _359;
    if (_42.flair_flipY > 0.5)
    {
        _359 = _42.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _359 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _359);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _42, uText, uTextSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

