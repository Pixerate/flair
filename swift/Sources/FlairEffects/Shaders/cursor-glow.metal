// flair-metal-hash: 718541f6
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
    packed_float3 uColor;
    float uRadius;
    float uIntensity;
    float uHalo;
    uint uDemo;
};

struct flair_cursor_glow_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 hoverPoint(thread const bool& demo, thread const float& idle, constant FlairUniforms& _41)
{
    float2 drift = float2(_41.iResolution[0], _41.iResolution[1]) * (float2(0.5) + float2(0.2800000011920928955078125 * sin(_41.iTime * 0.62999999523162841796875), 0.2199999988079071044921875 * sin((_41.iTime * 0.910000026226043701171875) + 1.2999999523162841796875)));
    float h = fast::clamp(_41.iPointer.z, 0.0, 1.0);
    return float3(mix(drift, _41.iPointer.xy, float2(h)), mix(demo ? idle : 0.0, 1.0, h));
}

static inline __attribute__((always_inline))
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _41)
{
    bool param = _41.uDemo != 0u;
    float param_1 = 0.699999988079071044921875;
    float3 hp = hoverPoint(param, param_1, _41);
    float d = length(fragCoord - hp.xy) / _41.iResolution[1u];
    float press = 1.0 - exp((-fast::max(_41.iPointer.w, 0.0)) * 4.0);
    if (_41.uDemo != 0u)
    {
        press = fast::max(press, (1.0 - _41.iPointer.z) * powr(fast::max(sin(_41.iTime * 1.2999999523162841796875), 0.0), 3.0));
    }
    float light = ((exp((-powr(d / _41.uRadius, 2.0)) * 2.0) * _41.uIntensity) * hp.z) * (1.0 + (0.60000002384185791015625 * press));
    float ringR = _41.uRadius * mix(1.2999999523162841796875, 0.550000011920928955078125, press);
    float ringW = fast::max(_41.uRadius * 0.0500000007450580596923828125, 1.5 / _41.iResolution[1u]);
    float ring = ((exp(-powr((d - ringR) / ringW, 2.0)) * _41.uHalo) * hp.z) * (0.60000002384185791015625 + (0.800000011920928955078125 * press));
    float3 param_2 = (float3(_41.uColor) * light) + ((mix(float3(_41.uColor), float3(1.0), float3(0.5)) * ring) * 1.5);
    float4 _250 = glow(param_2);
    fragColor = _250;
}

fragment flair_cursor_glow_frag_out flair_cursor_glow_frag(constant FlairUniforms& _41 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_cursor_glow_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _263;
    if (_41.flair_flipY > 0.5)
    {
        _263 = _41.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _263 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _263);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _41);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

