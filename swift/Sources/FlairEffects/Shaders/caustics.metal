// flair-metal-hash: f554855d
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

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
    float3 uWater;
    packed_float3 uLight;
    float uSpeed;
    float uScale;
    float uBright;
};

struct flair_caustics_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _29)
{
    float2 uv = ((fragCoord / float2(_29.iResolution[1u])) * _29.uScale) * 0.25;
    float t = ((_29.iTime * _29.uSpeed) * 0.5) + 23.0;
    float2 p = mod(uv * 6.28318023681640625, float2(6.28318023681640625)) - float2(250.0);
    float2 i = p;
    float c = 1.0;
    float inten = 0.004999999888241291046142578125;
    for (int n = 0; n < 5; n++)
    {
        float tn = t * (1.0 - (3.5 / float(n + 1)));
        i = p + float2(cos(tn - i.x) + sin(tn + i.y), sin(tn - i.y) + cos(tn + i.x));
        c += (1.0 / length(float2(p.x / (sin(i.x + tn) / inten), p.y / (cos(i.y + tn) / inten))));
    }
    c /= 5.0;
    c = 1.16999995708465576171875 - powr(c, 1.39999997615814208984375);
    float light = powr(abs(c), 8.0) * _29.uBright;
    float3 col = _29.uWater + (float3(_29.uLight) * fast::clamp(light, 0.0, 1.5));
    fragColor = float4(col, 1.0);
}

fragment flair_caustics_frag_out flair_caustics_frag(constant FlairUniforms& _29 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_caustics_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _192;
    if (_29.flair_flipY > 0.5)
    {
        _192 = _29.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _192 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _192);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _29);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

