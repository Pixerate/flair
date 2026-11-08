// flair-metal-hash: 331435a6
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
    float3 uBackground;
    float3 uBlobA;
    packed_float3 uBlobB;
    int uCount;
    float uSpeed;
    float uSize;
    float uBackgroundAlpha;
};

struct flair_lava_lamp_frag_out
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
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _75)
{
    float2 p = fragCoord / float2(_75.iResolution[1u]);
    float aspect = _75.iResolution[0u] / _75.iResolution[1u];
    float t = _75.iTime * _75.uSpeed;
    float field = 0.0;
    float tint = 0.0;
    for (int i = 0; i < 12; i++)
    {
        if (i >= _75.uCount)
        {
            break;
        }
        float fi = float(i);
        float2 param = float2(fi, 7.0);
        float2 seed = hash22(param);
        float2 c = float2(seed.x * aspect, 0.5 + (0.449999988079071044921875 * sin((t * (0.4000000059604644775390625 + seed.y)) + (fi * 2.099999904632568359375))));
        c.x += (0.100000001490116119384765625 * sin((t * 0.699999988079071044921875) + fi));
        float r = _75.uSize * (0.699999988079071044921875 + (0.60000002384185791015625 * seed.y));
        float k = (r * r) / dot(p - c, p - c);
        field += k;
        tint += (k * seed.x);
    }
    float inside = smoothstep(0.89999997615814208984375, 1.10000002384185791015625, field);
    float3 blob = mix(_75.uBlobA, float3(_75.uBlobB), float3(fast::clamp(tint / fast::max(field, 0.001000000047497451305389404296875), 0.0, 1.0)));
    blob *= (0.85000002384185791015625 + (0.1500000059604644775390625 * smoothstep(1.0, 3.0, field)));
    float3 col = mix(_75.uBackground, blob, float3(inside));
    col += (((blob * 0.1500000059604644775390625) * smoothstep(0.300000011920928955078125, 0.89999997615814208984375, field)) * (1.0 - inside));
    fragColor = float4(col, 1.0);
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _296;
    if (a > 0.0)
    {
        _296 = bg + (d / float3(a));
    }
    else
    {
        _296 = bg;
    }
    float3 fg = _296;
    float alpha = a + (opacity * (1.0 - a));
    float3 _318;
    if (alpha > 0.0)
    {
        _318 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _318 = bg;
    }
    float3 col = _318;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _75)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _75);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _75.uBackground;
    float param_4 = _75.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_lava_lamp_frag_out flair_lava_lamp_frag(constant FlairUniforms& _75 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_lava_lamp_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _376;
    if (_75.flair_flipY > 0.5)
    {
        _376 = _75.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _376 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _376);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _75);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

