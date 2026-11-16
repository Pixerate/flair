// flair-metal-hash: dd1e092d
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
    float uRadius;
    float uSoftness;
    float uDarkness;
    float uSpeed;
    float3 uShade;
};

struct flair_spotlight_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _30)
{
    float2 p = (fragCoord - (float2(_30.iResolution[0], _30.iResolution[1]) * 0.5)) / float2(_30.iResolution[1u]);
    float aspect = _30.iResolution[0u] / _30.iResolution[1u];
    float px = 1.0 / _30.iResolution[1u];
    float t = _30.iTime * _30.uSpeed;
    float2 _73;
    if (_30.iMouse.z > 0.0)
    {
        _73 = (_30.iMouse.xy - (float2(_30.iResolution[0], _30.iResolution[1]) * 0.5)) / float2(_30.iResolution[1u]);
    }
    else
    {
        _73 = float2((sin(t * 2.0) * 0.319999992847442626953125) * aspect, sin((t * 3.0) + 0.5) * 0.2800000011920928955078125);
    }
    float2 centre = _73;
    float r = length(p - centre);
    float dark = smoothstep((_30.uRadius * (1.0 - _30.uSoftness)) - px, _30.uRadius + px, r);
    float rim = (exp(-powr((r - (_30.uRadius * 0.89999997615814208984375)) / fast::max(_30.uRadius * (0.180000007152557373046875 + (0.25 * _30.uSoftness)), 0.02500000037252902984619140625), 2.0)) * 0.07999999821186065673828125) * _30.uDarkness;
    float3 col = mix(_30.uShade, float3(0.949999988079071044921875, 0.920000016689300537109375, 0.85000002384185791015625), float3(rim / fast::max((dark * _30.uDarkness) + rim, 9.9999997473787516355514526367188e-05)));
    fragColor = float4(col, fast::clamp((dark * _30.uDarkness) + (rim * 0.60000002384185791015625), 0.0, 1.0));
}

fragment flair_spotlight_frag_out flair_spotlight_frag(constant FlairUniforms& _30 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_spotlight_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _204;
    if (_30.flair_flipY > 0.5)
    {
        _204 = _30.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _204 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _204);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _30);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

