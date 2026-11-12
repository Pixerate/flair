// flair-metal-hash: ac8e1c96
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
    float uSize;
    float uAngle;
    float uSwing;
    float uSpin;
    float uLength;
    float uFade;
    float3 uBackground;
    float3 uShadow;
    packed_float3 uColour;
    uint uImageColours;
    float uBackgroundAlpha;
};

struct flair_long_shadow_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 shapeAt(thread const float2& p, thread const float& spacing, texture2d<float> uMask, sampler uMaskSmplr, constant FlairUniforms& _67)
{
    float2 size = float2(int2(uMask.get_width(), uMask.get_height()));
    if (size.x <= 1.0)
    {
        float2 q = abs(p) - float2(0.180000007152557373046875 * _67.uSize);
        float a = step((length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - (0.07999999821186065673828125 * _67.uSize), 0.0);
        return float4(float3(a), a);
    }
    float aspect = size.x / size.y;
    float h = fast::min(_67.uSize, ((_67.iResolution[0u] / _67.iResolution[1u]) * _67.uSize) / aspect);
    float2 uv = (p / float2(h * aspect, h)) + float2(0.5);
    bool _136 = uv.x < 0.0;
    bool _143;
    if (!_136)
    {
        _143 = uv.x > 1.0;
    }
    else
    {
        _143 = _136;
    }
    bool _150;
    if (!_143)
    {
        _150 = uv.y < 0.0;
    }
    else
    {
        _150 = _143;
    }
    bool _157;
    if (!_150)
    {
        _157 = uv.y > 1.0;
    }
    else
    {
        _157 = _150;
    }
    if (_157)
    {
        return float4(0.0);
    }
    float4 c = uMask.sample(uMaskSmplr, uv, level(log2(fast::max((spacing * size.y) / h, 1.0))));
    return float4(fast::clamp(c.xyz / float3(fast::max(c.w, 0.001000000047497451305389404296875)), float3(0.0), float3(1.0)) * c.w, c.w);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, texture2d<float> uMask, sampler uMaskSmplr, constant FlairUniforms& _67)
{
    float2 p = (fragCoord - (float2(_67.iResolution[0], _67.iResolution[1]) * 0.5)) / float2(_67.iResolution[1u]);
    float a = radians((_67.uAngle + (_67.uSpin * _67.iTime)) + (_67.uSwing * sin(_67.iTime * 0.4000000059604644775390625)));
    float2 dir = float2(cos(a), sin(a));
    float spacing = _67.uLength / 96.0;
    float shade = 0.0;
    for (int i = 1; i <= 96; i++)
    {
        float2 param = p - (dir * (float(i) * spacing));
        float param_1 = spacing;
        float m = shapeAt(param, param_1, uMask, uMaskSmplr, _67).w;
        shade = fast::max(shade, m);
        if (shade > 0.9900000095367431640625)
        {
            break;
        }
    }
    float2 size = float2(int2(uMask.get_width(), uMask.get_height()));
    float _289;
    if (size.x <= 1.0)
    {
        _289 = 1.0;
    }
    else
    {
        _289 = size.x / size.y;
    }
    float aspect = _289;
    float _303;
    if (size.x <= 1.0)
    {
        _303 = 0.519999980926513671875 * _67.uSize;
    }
    else
    {
        _303 = fast::min(_67.uSize, ((_67.iResolution[0u] / _67.iResolution[1u]) * _67.uSize) / aspect);
    }
    float h = _303;
    float reach = (0.5 * h) * ((abs(dir.x) * aspect) + abs(dir.y));
    shade *= (1.0 - (_67.uFade * fast::clamp((dot(p, dir) + reach) / ((2.0 * reach) + _67.uLength), 0.0, 1.0)));
    float3 col = mix(_67.uBackground, _67.uShadow, float3(shade));
    float2 param_2 = p;
    float param_3 = 1.0 / _67.iResolution[1u];
    float4 c = shapeAt(param_2, param_3, uMask, uMaskSmplr, _67);
    float3 _382;
    if (_67.uImageColours != 0u)
    {
        _382 = c.xyz / float3(fast::max(c.w, 9.9999997473787516355514526367188e-05));
    }
    else
    {
        _382 = float3(_67.uColour);
    }
    float3 ink = _382;
    fragColor = float4(mix(col, ink, float3(c.w)), 1.0);
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
    float3 _452;
    if (a > 0.0)
    {
        _452 = bg + (d / float3(a));
    }
    else
    {
        _452 = bg;
    }
    float3 fg = _452;
    float alpha = a + (opacity * (1.0 - a));
    float3 _474;
    if (alpha > 0.0)
    {
        _474 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _474 = bg;
    }
    float3 col = _474;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, texture2d<float> uMask, sampler uMaskSmplr, constant FlairUniforms& _67)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, uMask, uMaskSmplr, _67);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _67.uBackground;
    float param_4 = _67.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_long_shadow_frag_out flair_long_shadow_frag(constant FlairUniforms& _67 [[buffer(0)]], texture2d<float> uMask [[texture(1)]], sampler uMaskSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_long_shadow_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _531;
    if (_67.flair_flipY > 0.5)
    {
        _531 = _67.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _531 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _531);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, uMask, uMaskSmplr, _67);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

