// flair-metal-hash: 21fa4a9b
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
    packed_float3 uBackground;
    float uBackgroundAlpha;
    packed_float3 uSparkle;
    float uDensity;
    float uChance;
    float uSize;
    float uSpeed;
};

struct flair_sparkles_frag_out
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
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _97)
{
    float2 p = (fragCoord / float2(_97.iResolution[1u])) * _97.uDensity;
    float glint = 0.0;
    for (int layer = 0; layer < 2; layer++)
    {
        float2 q = (p * (1.0 + (float(layer) * 0.60000002384185791015625))) + float2(float(layer) * 7.30000019073486328125);
        float2 id = floor(q);
        float2 param = (id + float2(19.0)) + float2(float(layer) * 31.0);
        float keep = step(1.0 - _97.uChance, hash12(param));
        float2 f = fract(q) - float2(0.5);
        float2 param_1 = id;
        float2 o = hash22(param_1) - float2(0.5);
        float2 d = f - (o * 0.60000002384185791015625);
        float2 param_2 = id + float2(4.0);
        float phase = hash12(param_2) * 6.28318023681640625;
        float tw = powr(fast::max(0.0, sin(((_97.iTime * _97.uSpeed) * 2.0) + phase)), 4.0);
        float r = length(d);
        float rays = fast::max(0.0, 1.0 - (abs(d.x * d.y) * 3000.0));
        float core = 0.00999999977648258209228515625 / (r + 0.00999999977648258209228515625);
        float star = ((((rays * 0.800000011920928955078125) + core) * smoothstep(_97.uSize, 0.0, r)) * tw) * keep;
        glint += star;
    }
    float3 col = (float3(_97.uBackground) * _97.uBackgroundAlpha) + (float3(_97.uSparkle) * glint);
    float a = fast::clamp(_97.uBackgroundAlpha + (glint * (1.0 - _97.uBackgroundAlpha)), 0.0, 1.0);
    fragColor = float4(col, a);
}

fragment flair_sparkles_frag_out flair_sparkles_frag(constant FlairUniforms& _97 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_sparkles_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _281;
    if (_97.flair_flipY > 0.5)
    {
        _281 = _97.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _281 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _281);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _97);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

