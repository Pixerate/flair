// flair-metal-hash: ec0e7bab
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
    float2 uSource;
    char _m14_pad[8];
    packed_float3 uColor;
    float uStreak;
    float uIntensity;
};

struct flair_lens_flare_frag_out
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
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _101)
{
    float2 p = (fragCoord - (float2(_101.iResolution[0], _101.iResolution[1]) * 0.5)) / float2(_101.iResolution[1u]);
    float aspect = _101.iResolution[0u] / _101.iResolution[1u];
    float2 _126;
    if (_101.iMouse.z > 0.0)
    {
        _126 = (_101.iMouse.xy - (float2(_101.iResolution[0], _101.iResolution[1]) * 0.5)) / float2(_101.iResolution[1u]);
    }
    else
    {
        _126 = (_101.uSource * float2(aspect, 1.0)) * 0.5;
    }
    float2 src = _126;
    float2 d = p - src;
    float r = length(d);
    float3 col = float3(_101.uColor) * ((exp((-r) * 20.0) * 1.5) + ((0.014999999664723873138427734375 / (r + 0.014999999664723873138427734375)) * 0.300000011920928955078125));
    float3 streakColor = mix(float3(_101.uColor), float3(0.449999988079071044921875, 0.64999997615814208984375, 1.0), float3(0.60000002384185791015625));
    float len = _101.uStreak + 0.001000000047497451305389404296875;
    col += ((streakColor * exp((-abs(d.y)) * 220.0)) * exp((-abs(d.x)) / (0.5 * len)));
    col += (((streakColor * 0.4000000059604644775390625) * exp((-abs(d.y)) * 60.0)) * exp((-abs(d.x)) / (0.25 * len)));
    for (int i = 0; i < 7; i++)
    {
        float fi = float(i);
        float2 param = float2(fi, 1.7000000476837158203125);
        float along = mix(-1.60000002384185791015625, 0.60000002384185791015625, hash12(param));
        float2 param_1 = float2(fi, 4.099999904632568359375);
        float gr = mix(0.014999999664723873138427734375, 0.10999999940395355224609375, hash12(param_1));
        float gd = length(p - (src * along));
        float2 param_2 = float2(fi, 8.30000019073486328125);
        float3 tint = mix(float3(_101.uColor), float3(0.4000000059604644775390625, 0.85000002384185791015625, 1.0), float3(hash12(param_2)));
        float disc = (1.0 - smoothstep(gr * 0.60000002384185791015625, gr, gd)) * 0.119999997317790985107421875;
        float ring = exp((-abs(gd - gr)) * 90.0) * 0.180000007152557373046875;
        float2 param_3 = float2(fi, 2.900000095367431640625);
        col += (tint * ((hash12(param_3) > 0.60000002384185791015625) ? ring : disc));
    }
    float3 param_4 = col * _101.uIntensity;
    float4 _326 = glow(param_4);
    fragColor = _326;
}

fragment flair_lens_flare_frag_out flair_lens_flare_frag(constant FlairUniforms& _101 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_lens_flare_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _339;
    if (_101.flair_flipY > 0.5)
    {
        _339 = _101.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _339 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _339);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _101);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

