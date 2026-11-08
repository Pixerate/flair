// flair-metal-hash: b4c76be6
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
    packed_float3 uBackground;
    float uBackgroundAlpha;
    float3 uWarm;
    packed_float3 uCool;
    int uCount;
    float uSize;
    float uSpeed;
};

struct flair_bokeh_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _97)
{
    float2 p = fragCoord / float2(_97.iResolution[1u]);
    float aspect = _97.iResolution[0u] / _97.iResolution[1u];
    float3 col = (float3(_97.uBackground) * (0.699999988079071044921875 + ((0.300000011920928955078125 * fragCoord.y) / _97.iResolution[1u]))) * _97.uBackgroundAlpha;
    float lightAlpha = 0.0;
    for (int i = 0; i < 60; i++)
    {
        if (i >= _97.uCount)
        {
            break;
        }
        float fi = float(i);
        float2 param = float2(fi, 3.099999904632568359375);
        float2 h = hash22(param);
        float2 param_1 = float2(fi, 9.69999980926513671875);
        float depth = hash12(param_1);
        float2 c = float2((fract(h.x + (((_97.iTime * _97.uSpeed) * (0.20000000298023223876953125 + depth)) * 0.100000001490116119384765625)) * (aspect + 0.4000000059604644775390625)) - 0.20000000298023223876953125, h.y);
        c.y += (0.02999999932944774627685546875 * sin((_97.iTime * 0.5) + fi));
        float r = _97.uSize * (0.5 + depth);
        float d = length(p - c);
        float disc = smoothstep(r, r * 0.85000002384185791015625, d) * (0.60000002384185791015625 + (0.4000000059604644775390625 * smoothstep(r * 0.4000000059604644775390625, r, d)));
        float2 param_2 = float2(fi, 1.2999999523162841796875);
        float3 light = mix(_97.uWarm, float3(_97.uCool), float3(step(0.5, hash12(param_2))));
        float weight = disc * (0.1500000059604644775390625 + (0.25 * (1.0 - depth)));
        col += (light * weight);
        lightAlpha += weight;
    }
    float a = fast::clamp(_97.uBackgroundAlpha + (lightAlpha * (1.0 - _97.uBackgroundAlpha)), 0.0, 1.0);
    fragColor = float4(col, a);
}

fragment flair_bokeh_frag_out flair_bokeh_frag(constant FlairUniforms& _97 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_bokeh_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _296;
    if (_97.flair_flipY > 0.5)
    {
        _296 = _97.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _296 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _296);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _97);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

