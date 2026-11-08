// flair-metal-hash: 3cf291b0
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
    uint uAnimate;
    float uProgress;
    float uSize;
    float uGoo;
    float uEdge;
    uint uImageColours;
    float3 uColourA;
    float3 uColourB;
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_silhouette_morph_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 shapeAt(texture2d<float> tex, sampler texSmplr, thread const float2& p, thread const float& spacing, thread const int& fallback, constant FlairUniforms& _80)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    if (size.x <= 1.0)
    {
        float _66;
        if (fallback == 0)
        {
            _66 = length(p) - (0.300000011920928955078125 * _80.uSize);
        }
        else
        {
            _66 = length(fast::max(abs(p) - float2(0.20000000298023223876953125 * _80.uSize), float2(0.0))) - (0.07999999821186065673828125 * _80.uSize);
        }
        float d = _66;
        float a = step(d, 0.0);
        return float4(float3(a), a);
    }
    float aspect = size.x / size.y;
    float h = fast::min(_80.uSize, ((_80.iResolution[0u] / _80.iResolution[1u]) * _80.uSize) / aspect);
    float2 uv = (p / float2(h * aspect, h)) + float2(0.5);
    bool _151 = uv.x < 0.0;
    bool _158;
    if (!_151)
    {
        _158 = uv.x > 1.0;
    }
    else
    {
        _158 = _151;
    }
    bool _165;
    if (!_158)
    {
        _165 = uv.y < 0.0;
    }
    else
    {
        _165 = _158;
    }
    bool _172;
    if (!_165)
    {
        _172 = uv.y > 1.0;
    }
    else
    {
        _172 = _165;
    }
    if (_172)
    {
        return float4(0.0);
    }
    float4 c = tex.sample(texSmplr, uv, level(log2(fast::max((spacing * size.y) / h, 1.0))));
    return float4(fast::clamp(c.xyz / float3(fast::max(c.w, 0.001000000047497451305389404296875)), float3(0.0), float3(1.0)) * c.w, c.w);
}

static inline __attribute__((always_inline))
float4 blurred(texture2d<float> tex, sampler texSmplr, thread const float2& p, thread const float& radius, thread const int& fallback, constant FlairUniforms& _80)
{
    float4 sum = float4(0.0);
    for (int i = 0; i < 28; i++)
    {
        float r = radius * sqrt((float(i) + 0.5) / 28.0);
        float a = float(i) * 2.399960041046142578125;
        float2 param = p + (float2(cos(a), sin(a)) * r);
        float param_1 = radius * 0.3499999940395355224609375;
        int param_2 = fallback;
        sum += shapeAt(tex, texSmplr, param, param_1, param_2, _80);
    }
    return sum / float4(28.0);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _80, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float _269;
    if (_80.uAnimate != 0u)
    {
        _269 = smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, 0.5 - (0.5 * cos((_80.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _269 = _80.uProgress;
    }
    float t = _269;
    float2 p = (fragCoord - (float2(_80.iResolution[0], _80.iResolution[1]) * 0.5)) / float2(_80.iResolution[1u]);
    float radius = (_80.uGoo * sin(3.141590118408203125 * t)) + (1.0 / _80.iResolution[1u]);
    float2 param = p;
    float param_1 = radius;
    int param_2 = 0;
    float4 a = blurred(uFrom, uFromSmplr, param, param_1, param_2, _80);
    float2 param_3 = p;
    float param_4 = radius;
    int param_5 = 1;
    float4 b = blurred(uTo, uToSmplr, param_3, param_4, param_5, _80);
    float field = mix(a.w, b.w, t);
    float w = _80.uEdge + (fwidth(field) * 0.75);
    float inside = smoothstep(0.5 - w, 0.5 + w, field);
    float3 _358;
    if (_80.uImageColours != 0u)
    {
        _358 = a.xyz / float3(fast::max(a.w, 9.9999997473787516355514526367188e-05));
    }
    else
    {
        _358 = _80.uColourA;
    }
    float3 ca = _358;
    float3 _378;
    if (_80.uImageColours != 0u)
    {
        _378 = b.xyz / float3(fast::max(b.w, 9.9999997473787516355514526367188e-05));
    }
    else
    {
        _378 = _80.uColourB;
    }
    float3 cb = _378;
    ca = mix(cb, ca, float3(smoothstep(0.0, 0.0500000007450580596923828125, a.w)));
    cb = mix(ca, cb, float3(smoothstep(0.0, 0.0500000007450580596923828125, b.w)));
    float3 tint = mix(ca, cb, float3(smoothstep(0.20000000298023223876953125, 0.800000011920928955078125, t)));
    tint *= (0.819999992847442626953125 + (0.25 * smoothstep(0.5, 1.0, field)));
    fragColor = float4(mix(float3(_80.uBackground), tint, float3(inside)), 1.0);
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
    float3 _479;
    if (a > 0.0)
    {
        _479 = bg + (d / float3(a));
    }
    else
    {
        _479 = bg;
    }
    float3 fg = _479;
    float alpha = a + (opacity * (1.0 - a));
    float3 _501;
    if (alpha > 0.0)
    {
        _501 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _501 = bg;
    }
    float3 col = _501;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _80, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _80, uFrom, uFromSmplr, uTo, uToSmplr);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_80.uBackground);
    float param_4 = _80.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_silhouette_morph_frag_out flair_silhouette_morph_frag(constant FlairUniforms& _80 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_silhouette_morph_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _558;
    if (_80.flair_flipY > 0.5)
    {
        _558 = _80.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _558 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _558);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _80, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

