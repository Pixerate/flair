// flair-metal-hash: 576f2c4a
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
    float uAmount;
    float uScanlines;
    float uRoll;
    float3 uTint;
};

struct flair_tv_static_frag_out
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _65)
{
    float2 uv = fragCoord / float2(_65.iResolution[0], _65.iResolution[1]);
    float2 param = floor(fragCoord * 0.5) + float2(floor(_65.iTime * 30.0) * 17.3099994659423828125);
    float n = hash12(param);
    float scan = 1.0 - ((_65.uScanlines * 0.5) * (1.0 + sin(fragCoord.y * 3.141590118408203125)));
    float bar = 1.0 + ((_65.uRoll * 0.60000002384185791015625) * smoothstep(0.1500000059604644775390625, 0.0, abs(fract(uv.y - (_65.iTime * 0.20000000298023223876953125)) - 0.5) - 0.300000011920928955078125));
    float3 col = ((_65.uTint * mix(0.5, n, _65.uAmount)) * scan) * bar;
    col *= smoothstep(1.2000000476837158203125, 0.4000000059604644775390625, length(uv - float2(0.5)) * 1.39999997615814208984375);
    fragColor = float4(col, 1.0);
}

fragment flair_tv_static_frag_out flair_tv_static_frag(constant FlairUniforms& _65 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_tv_static_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _170;
    if (_65.flair_flipY > 0.5)
    {
        _170 = _65.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _170 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _170);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _65);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

