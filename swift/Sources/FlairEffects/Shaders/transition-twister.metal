// flair-metal-hash: 3c612362
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
    uint uAnimate;
    float uProgress;
    char _m15_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_transition_twister_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 flair_transition(texture2d<float> texA, sampler texASmplr, texture2d<float> texB, sampler texBSmplr, thread const float2& uv, thread const float& progress)
{
    float p = fast::clamp(progress, 0.0, 1.0);
    float2 d = uv - float2(0.5);
    float dist = length(d);
    float angle = (((1.0 - cos(p * 6.283185482025146484375)) * 0.5) * 6.283185482025146484375) * fast::max(0.0, 1.0 - dist);
    float c = cos(angle);
    float s = sin(angle);
    float2 ruv = fast::clamp(float2((d.x * c) - (d.y * s), (d.x * s) + (d.y * c)) + float2(0.5), float2(0.0), float2(1.0));
    float w = smoothstep(0.4000000059604644775390625, 0.60000002384185791015625, p);
    float4 a = texA.sample(texASmplr, ruv);
    float4 b = texB.sample(texBSmplr, ruv);
    return mix(a, b, float4(w));
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _51)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_51.uBackdrop) * _51.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_51.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _51, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float2 uv = fragCoord / float2(_51.iResolution[0], _51.iResolution[1]);
    float _180;
    if (_51.uAnimate != 0u)
    {
        _180 = smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, 0.5 - (0.5 * cos((_51.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _180 = _51.uProgress;
    }
    float p = _180;
    float2 param = uv;
    float param_1 = p;
    float4 param_2 = flair_transition(uFrom, uFromSmplr, uTo, uToSmplr, param, param_1);
    fragColor = overBackdrop(param_2, _51);
}

fragment flair_transition_twister_frag_out flair_transition_twister_frag(constant FlairUniforms& _51 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_transition_twister_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _222;
    if (_51.flair_flipY > 0.5)
    {
        _222 = _51.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _222 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _222);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _51, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

