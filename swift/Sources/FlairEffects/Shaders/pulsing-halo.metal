// flair-metal-hash: 0d371a26
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
    float3 uColor;
    packed_float3 uInner;
    float uRadius;
    float uWidth;
    int uRings;
    float uSpacing;
    float uBreath;
    float uPeriod;
    float uShimmer;
    float uIntensity;
};

struct flair_pulsing_halo_frag_out
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
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _158)
{
    float2 p = (fragCoord - (float2(_158.iResolution[0], _158.iResolution[1]) * 0.5)) / float2(_158.iResolution[1u]);
    float d = length(p);
    float2 dir = p / float2(fast::max(d, 9.9999997473787516355514526367188e-05));
    float phase = (6.28318023681640625 * _158.iTime) / _158.uPeriod;
    float b = 0.5 - (0.5 * cos(phase));
    float scale = 1.0 + (_158.uBreath * (b - 0.300000011920928955078125));
    float2 drift = float2(cos(phase), sin(phase));
    float3 light = float3(0.0);
    float _337;
    for (int i = 0; i < 4; i++)
    {
        if (i >= _158.uRings)
        {
            break;
        }
        float fi = float(i);
        float r = (_158.uRadius + ((fi * _158.uSpacing) * (1.0 + (0.5 * b)))) * scale;
        float w = _158.uWidth * (1.0 + (0.5 * fi));
        float ring = exp(-powr((d - r) / w, 2.0)) + (0.4000000059604644775390625 * exp((-abs(d - r)) / (w * 3.0)));
        float2 param = ((dir * 3.0) + (drift * 0.800000011920928955078125)) + float2(fi * 7.30000019073486328125);
        float2 param_1 = ((dir * 7.0) - (drift * 1.2999999523162841796875)) + float2(fi * 3.099999904632568359375);
        float s = (vnoise(param) * 0.60000002384185791015625) + (vnoise(param_1) * 0.4000000059604644775390625);
        float sh = mix(1.0, 0.3499999940395355224609375 + (1.2999999523162841796875 * s), _158.uShimmer);
        float fade = 1.0 / (1.0 + (0.89999997615814208984375 * fi));
        if (_158.uRings > 1)
        {
            _337 = fi / float(_158.uRings - 1);
        }
        else
        {
            _337 = 0.60000002384185791015625;
        }
        float3 tint = mix(float3(_158.uInner), _158.uColor, float3(_337));
        light += (((tint * ring) * sh) * fade);
    }
    light += ((float3(_158.uInner) * 0.180000007152557373046875) * exp((-powr(d / (_158.uRadius * scale), 2.0)) * 1.5));
    light *= (_158.uIntensity * (0.699999988079071044921875 + (0.449999988079071044921875 * b)));
    float3 param_2 = light;
    float4 _392 = glow(param_2);
    fragColor = _392;
}

fragment flair_pulsing_halo_frag_out flair_pulsing_halo_frag(constant FlairUniforms& _158 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_pulsing_halo_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _405;
    if (_158.flair_flipY > 0.5)
    {
        _405 = _158.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _405 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _405);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _158);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

