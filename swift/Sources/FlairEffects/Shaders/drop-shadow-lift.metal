// flair-metal-hash: d756e21c
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
    float uSize;
    uint uImageColours;
    float3 uColour;
    float3 uBackground;
    packed_float3 uShadow;
    float uOpacity;
    float uRestBlur;
    float uLiftBlur;
    float uLiftDrop;
    float uLiftScale;
    uint uDemo;
    float uBackgroundAlpha;
};

struct flair_drop_shadow_lift_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 shapeAt(thread const float2& p, thread const float& spacing, texture2d<float> uMask, sampler uMaskSmplr, constant FlairUniforms& _72)
{
    float2 size = float2(int2(uMask.get_width(), uMask.get_height()));
    if (size.x <= 1.0)
    {
        float2 q = abs(p) - float2(0.180000007152557373046875 * _72.uSize);
        float a = step((length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - (0.07999999821186065673828125 * _72.uSize), 0.0);
        return float4(float3(a), a);
    }
    float aspect = size.x / size.y;
    float h = fast::min(_72.uSize, ((_72.iResolution[0u] / _72.iResolution[1u]) * _72.uSize) / aspect);
    float2 uv = (p / float2(h * aspect, h)) + float2(0.5);
    bool _141 = uv.x < 0.0;
    bool _148;
    if (!_141)
    {
        _148 = uv.x > 1.0;
    }
    else
    {
        _148 = _141;
    }
    bool _155;
    if (!_148)
    {
        _155 = uv.y < 0.0;
    }
    else
    {
        _155 = _148;
    }
    bool _162;
    if (!_155)
    {
        _162 = uv.y > 1.0;
    }
    else
    {
        _162 = _155;
    }
    if (_162)
    {
        return float4(0.0);
    }
    float4 c = uMask.sample(uMaskSmplr, uv, level(log2(fast::max((spacing * size.y) / h, 1.0))));
    return float4(fast::clamp(c.xyz / float3(fast::max(c.w, 0.001000000047497451305389404296875)), float3(0.0), float3(1.0)) * c.w, c.w);
}

static inline __attribute__((always_inline))
float blurred(thread const float2& p, thread const float& radius, texture2d<float> uMask, sampler uMaskSmplr, constant FlairUniforms& _72)
{
    float sum = 0.0;
    for (int i = 0; i < 24; i++)
    {
        float r = radius * sqrt((float(i) + 0.5) / 24.0);
        float a = float(i) * 2.399960041046142578125;
        float2 param = p + (float2(cos(a), sin(a)) * r);
        float param_1 = radius * 0.3499999940395355224609375;
        sum += shapeAt(param, param_1, uMask, uMaskSmplr, _72).w;
    }
    return sum / 24.0;
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, texture2d<float> uMask, sampler uMaskSmplr, constant FlairUniforms& _72)
{
    float px = 1.0 / _72.iResolution[1u];
    float2 p = (fragCoord - (float2(_72.iResolution[0], _72.iResolution[1]) * 0.5)) * px;
    float _272;
    if (_72.uDemo != 0u)
    {
        _272 = smoothstep(0.0, 1.0, 0.5 - (0.5 * cos(_72.iTime * 1.2999999523162841796875)));
    }
    else
    {
        _272 = 0.0;
    }
    float idle = _272;
    float lift = mix(idle, 1.0, fast::clamp(_72.iPointer.z, 0.0, 1.0));
    float k = 1.0 + (_72.uLiftScale * lift);
    float2 rise = float2(0.0, 0.01200000010430812835693359375 * lift);
    float ks = k * (1.0 + (0.0500000007450580596923828125 * lift));
    float2 drop = float2(0.0, -(0.008000000379979610443115234375 + (_72.uLiftDrop * lift)));
    float radius = mix(_72.uRestBlur, _72.uLiftBlur, lift) + px;
    float2 param = (p - drop) / float2(ks);
    float param_1 = radius / ks;
    float shadow = (blurred(param, param_1, uMask, uMaskSmplr, _72) * _72.uOpacity) * mix(1.0, 0.699999988079071044921875, lift);
    float3 col = mix(_72.uBackground, float3(_72.uShadow), float3(shadow));
    float2 param_2 = (p - rise) / float2(k);
    float param_3 = px / k;
    float4 c = shapeAt(param_2, param_3, uMask, uMaskSmplr, _72);
    float3 _382;
    if (_72.uImageColours != 0u)
    {
        _382 = c.xyz / float3(fast::max(c.w, 9.9999997473787516355514526367188e-05));
    }
    else
    {
        _382 = _72.uColour;
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
    float3 _451;
    if (a > 0.0)
    {
        _451 = bg + (d / float3(a));
    }
    else
    {
        _451 = bg;
    }
    float3 fg = _451;
    float alpha = a + (opacity * (1.0 - a));
    float3 _473;
    if (alpha > 0.0)
    {
        _473 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _473 = bg;
    }
    float3 col = _473;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, texture2d<float> uMask, sampler uMaskSmplr, constant FlairUniforms& _72)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, uMask, uMaskSmplr, _72);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _72.uBackground;
    float param_4 = _72.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_drop_shadow_lift_frag_out flair_drop_shadow_lift_frag(constant FlairUniforms& _72 [[buffer(0)]], texture2d<float> uMask [[texture(1)]], sampler uMaskSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_drop_shadow_lift_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _529;
    if (_72.flair_flipY > 0.5)
    {
        _529 = _72.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _529 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _529);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, uMask, uMaskSmplr, _72);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

