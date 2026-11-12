// flair-metal-hash: 524cc9bf
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
    float3 uSkyTop;
    float3 uSkyBottom;
    float3 uFar;
    float3 uNear;
    packed_float3 uSun;
    float uDepth;
    float uRough;
    float uDrift;
    uint uDemo;
};

struct flair_parallax_layers_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool scrollDemo(constant FlairUniforms& _134)
{
    bool _139 = _134.uDemo != 0u;
    bool _150;
    if (_139)
    {
        _150 = dot(_134.iScroll, _134.iScroll) == 0.0;
    }
    else
    {
        _150 = _139;
    }
    return _150;
}

static inline __attribute__((always_inline))
float4 scroll(constant FlairUniforms& _134)
{
    if (!scrollDemo(_134))
    {
        return _134.iScroll;
    }
    float ph = fract(_134.iTime / 6.0);
    float _172;
    if (ph < 0.5)
    {
        _172 = (ph * 2.400000095367431640625) - 0.100000001490116119384765625;
    }
    else
    {
        _172 = ((1.0 - ph) * 2.400000095367431640625) - 0.100000001490116119384765625;
    }
    float u = fast::clamp(_172, 0.0, 1.0);
    float x = (u * u) * (3.0 - (2.0 * u));
    float moving = float((u > 0.0) && (u < 1.0));
    float v = (((((moving * 6.0) * u) * (1.0 - u)) * 0.4000000059604644775390625) * 2.0) * ((ph < 0.5) ? 1.0 : (-1.0));
    return float4(x, x, v, moving);
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
float ridge(thread const float& x, thread const float& seed, constant FlairUniforms& _134)
{
    float2 param = float2(x * 1.2999999523162841796875, seed);
    float2 param_1 = float2(x * 3.099999904632568359375, seed + 7.0);
    float2 param_2 = float2(x * 8.0, seed + 3.0);
    float h = ((vnoise(param) * 0.60000002384185791015625) + ((vnoise(param_1) * 0.300000011920928955078125) * (0.5 + _134.uRough))) + ((vnoise(param_2) * 0.100000001490116119384765625) * _134.uRough);
    return h;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _134)
{
    float2 uv = fragCoord / float2(_134.iResolution[0], _134.iResolution[1]);
    float aspect = _134.iResolution[0u] / _134.iResolution[1u];
    float4 s = scroll(_134);
    float shift = (s.x - 0.5) * _134.uDepth;
    float skyY = uv.y + (shift * 0.1500000059604644775390625);
    float3 col = mix(_134.uSkyBottom, _134.uSkyTop, float3(smoothstep(0.100000001490116119384765625, 1.0, skyY)));
    float2 sun = float2(0.680000007152557373046875 * aspect, 0.62000000476837158203125 - (shift * 0.20000000298023223876953125));
    float d = length(float2(uv.x * aspect, uv.y) - sun);
    col = mix(col, float3(_134.uSun), float3(smoothstep(0.07500000298023223876953125, 0.070000000298023223876953125, d)));
    col += ((float3(_134.uSun) * exp((-d) * 6.0)) * 0.25);
    for (int i = 0; i < 5; i++)
    {
        float k = float(i) / 4.0;
        float base = (0.550000011920928955078125 - (0.100000001490116119384765625 * float(i))) + (shift * (0.1500000059604644775390625 + ((0.85000002384185791015625 * k) * k)));
        float x = (((uv.x * aspect) * (0.60000002384185791015625 + (0.5 * k))) + ((_134.iTime * _134.uDrift) * (0.300000011920928955078125 + k))) + (float(i) * 11.30000019073486328125);
        float param = x;
        float param_1 = float(i) * 5.0;
        float top = base + (ridge(param, param_1, _134) * (0.180000007152557373046875 + (0.0500000007450580596923828125 * k)));
        float layer = smoothstep(top + (1.5 / _134.iResolution[1u]), top, uv.y);
        float3 tint = mix(mix(_134.uFar, _134.uSkyBottom, float3(0.3499999940395355224609375)), _134.uNear, float3(k));
        tint = mix(tint, _134.uSkyBottom, float3(((0.25 * (1.0 - k)) * smoothstep(top - 0.25, top, uv.y)) * 0.5));
        col = mix(col, tint, float3(layer));
    }
    fragColor = float4(col, 1.0);
}

fragment flair_parallax_layers_frag_out flair_parallax_layers_frag(constant FlairUniforms& _134 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_parallax_layers_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _487;
    if (_134.flair_flipY > 0.5)
    {
        _487 = _134.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _487 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _487);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _134);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

