// flair-metal-hash: 511c99bb
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
    float3 uInk;
    packed_float3 uShade;
    float uShadow;
    float uLines;
    float uLength;
    float uThickness;
    float uSway;
};

struct flair_gloom_lines_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

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
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _147)
{
    float2 uv = fragCoord / float2(_147.iResolution[0], _147.iResolution[1]);
    float depth = 1.0 - uv.y;
    float4 acc = float4(0.0);
    float shade = _147.uShadow * powr(smoothstep(_147.uLength * 1.25, 0.0, depth), 1.5);
    float4 param = acc;
    float3 param_1 = float3(_147.uShade);
    float param_2 = shade;
    acc = over(param, param_1, param_2);
    float colW = _147.iResolution[0u] / _147.uLines;
    float x = fragCoord.x / colW;
    for (int k = -1; k <= 1; k++)
    {
        float col = floor(x) + float(k);
        float2 param_3 = float2(col, 4.19999980926513671875);
        float2 h = hash22(param_3);
        float2 param_4 = float2(col, 8.69999980926513671875);
        float h3 = hash12(param_4);
        if (h.x < 0.2199999988079071044921875)
        {
            continue;
        }
        float len = (_147.uLength * (0.3499999940395355224609375 + (0.75 * h.y))) * (1.0 + (0.0599999986588954925537109375 * sin((_147.iTime * 0.89999997615814208984375) + (h3 * 6.280000209808349609375))));
        if (depth > len)
        {
            continue;
        }
        float wave = ((_147.uSway * 0.300000011920928955078125) * sin(((depth * 26.0) - (_147.iTime * 1.60000002384185791015625)) + (h3 * 6.280000209808349609375))) * smoothstep(0.0, 0.1500000059604644775390625, depth);
        float centre = ((col + 0.5) + (0.5 * (h3 - 0.5))) + wave;
        float dist = abs(x - centre) * colW;
        float w = (_147.uThickness * (0.60000002384185791015625 + (0.60000002384185791015625 * h3))) * (1.0 - (depth / len));
        float cover = fast::clamp(((0.5 * w) - dist) + 0.5, 0.0, 1.0);
        float4 param_5 = acc;
        float3 param_6 = _147.uInk;
        float param_7 = cover;
        acc = over(param_5, param_6, param_7);
    }
    float4 param_8 = acc;
    fragColor = unpremultiply(param_8);
}

fragment flair_gloom_lines_frag_out flair_gloom_lines_frag(constant FlairUniforms& _147 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_gloom_lines_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _350;
    if (_147.flair_flipY > 0.5)
    {
        _350 = _147.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _350 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _350);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _147);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

