// flair-metal-hash: 5ba65ab8
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
    uint uAnimate;
    float uProgress;
    char _m15_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_transition_block_dissolve_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float flair_hash(thread float2& p)
{
    float2 k = float2(0.31830990314483642578125, 0.367879390716552734375);
    p = (p * k) + float2(k.y, k.x);
    return fract((16.0 * k.x) * fract((p.x * p.y) * (p.x + p.y)));
}

static inline __attribute__((always_inline))
float4 flair_transition(texture2d<float> texA, sampler texASmplr, texture2d<float> texB, sampler texBSmplr, thread const float2& uv, thread const float& progress)
{
    float p = fast::clamp(progress, 0.0, 1.0);
    float blocks = 32.0;
    float2 cell = floor(uv * blocks);
    float2 param = cell;
    float _143 = flair_hash(param);
    float h = _143;
    float w = smoothstep(h - 0.0500000007450580596923828125, h, p * 1.0499999523162841796875);
    float4 a = texA.sample(texASmplr, uv);
    float4 b = texB.sample(texBSmplr, uv);
    return mix(a, b, float4(w));
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _55)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_55.uBackdrop) * _55.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_55.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _55, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float2 uv = fragCoord / float2(_55.iResolution[0], _55.iResolution[1]);
    float _182;
    if (_55.uAnimate != 0u)
    {
        _182 = smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, 0.5 - (0.5 * cos((_55.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _182 = _55.uProgress;
    }
    float p = _182;
    float2 param = uv;
    float param_1 = p;
    float4 param_2 = flair_transition(uFrom, uFromSmplr, uTo, uToSmplr, param, param_1);
    fragColor = overBackdrop(param_2, _55);
}

fragment flair_transition_block_dissolve_frag_out flair_transition_block_dissolve_frag(constant FlairUniforms& _55 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_transition_block_dissolve_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _225;
    if (_55.flair_flipY > 0.5)
    {
        _225 = _55.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _225 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _225);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _55, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

