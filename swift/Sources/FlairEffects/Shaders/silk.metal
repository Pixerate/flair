// flair-metal-hash: ef05b2df
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
    float3 uBase;
    packed_float3 uSheen;
    float uSpeed;
    float uFolds;
    float uGloss;
};

struct flair_silk_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float folds(thread const float2& p, thread const float& t, constant FlairUniforms& _75)
{
    float h = 0.0;
    for (int i = 1; i <= 4; i++)
    {
        float fi = float(i);
        h += (sin(((((p.x * _75.uFolds) * fi) * 0.699999988079071044921875) + (t * (1.0 + (0.300000011920928955078125 * fi)))) + sin(((p.y * 2.0) * fi) + t)) / fi);
    }
    return h;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _75)
{
    float param = 0.60000002384185791015625;
    float2 p = (rot(param) * (fragCoord - (float2(_75.iResolution[0], _75.iResolution[1]) * 0.5))) / float2(_75.iResolution[1u]);
    float t = _75.iTime * _75.uSpeed;
    float e = 0.00200000009499490261077880859375;
    float2 param_1 = p + float2(e, 0.0);
    float param_2 = t;
    float2 param_3 = p - float2(e, 0.0);
    float param_4 = t;
    float hx = (folds(param_1, param_2, _75) - folds(param_3, param_4, _75)) / (2.0 * e);
    float2 param_5 = p + float2(0.0, e);
    float param_6 = t;
    float2 param_7 = p - float2(0.0, e);
    float param_8 = t;
    float hy = (folds(param_5, param_6, _75) - folds(param_7, param_8, _75)) / (2.0 * e);
    float3 n = fast::normalize(float3((-hx) * 0.119999997317790985107421875, (-hy) * 0.119999997317790985107421875, 1.0));
    float3 l = float3(-0.3980148732662200927734375, 0.5970222949981689453125, 0.696526050567626953125);
    float diff = fast::clamp(dot(n, l), 0.0, 1.0);
    float spec = powr(fast::clamp(dot(reflect(-l, n), float3(0.0, 0.0, 1.0)), 0.0, 1.0), 20.0) * _75.uGloss;
    float3 col = (_75.uBase * (0.3499999940395355224609375 + (0.89999997615814208984375 * diff))) + (float3(_75.uSheen) * (spec + (0.119999997317790985107421875 * powr(diff, 6.0))));
    fragColor = float4(col, 1.0);
}

fragment flair_silk_frag_out flair_silk_frag(constant FlairUniforms& _75 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_silk_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _255;
    if (_75.flair_flipY > 0.5)
    {
        _255 = _75.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _255 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _255);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _75);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

