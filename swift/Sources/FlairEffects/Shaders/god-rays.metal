// flair-metal-hash: 977e7d30
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
    float3 uLight;
    float2 uSource;
    float uRays;
    float uSpeed;
    float uStrength;
    float uBackgroundAlpha;
};

struct flair_god_rays_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

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
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _135)
{
    float2 p = (fragCoord - (float2(_135.iResolution[0], _135.iResolution[1]) * 0.5)) / float2(_135.iResolution[1u]);
    float2 d = p - ((_135.uSource * float2(_135.iResolution[0u] / _135.iResolution[1u], 1.0)) * 0.5);
    float a = precise::atan2(d.x, -d.y);
    float r = length(d);
    float t = _135.iTime * _135.uSpeed;
    float2 param = float2(a * _135.uRays, t);
    float2 param_1 = float2((a * _135.uRays) * 2.2999999523162841796875, (-t) * 1.2999999523162841796875);
    float rays = (vnoise(param) * 0.60000002384185791015625) + (vnoise(param_1) * 0.4000000059604644775390625);
    rays = powr(rays, 2.0) * smoothstep(1.60000002384185791015625, 0.0, r);
    float glow = exp((-r) * 4.0);
    float3 col = _135.uBackground + ((_135.uLight * ((rays * 0.89999997615814208984375) + (glow * 0.800000011920928955078125))) * _135.uStrength);
    fragColor = float4(col, 1.0);
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
    float3 _291;
    if (a > 0.0)
    {
        _291 = bg + (d / float3(a));
    }
    else
    {
        _291 = bg;
    }
    float3 fg = _291;
    float alpha = a + (opacity * (1.0 - a));
    float3 _313;
    if (alpha > 0.0)
    {
        _313 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _313 = bg;
    }
    float3 col = _313;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _135)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _135);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _135.uBackground;
    float param_4 = _135.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_god_rays_frag_out flair_god_rays_frag(constant FlairUniforms& _135 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_god_rays_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _371;
    if (_135.flair_flipY > 0.5)
    {
        _371 = _135.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _371 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _371);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _135);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

