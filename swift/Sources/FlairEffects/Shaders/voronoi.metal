// flair-metal-hash: b30a8ef6
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
    float3 uBackground;
    float3 uCell;
    packed_float3 uWall;
    float uScale;
    float uSpeed;
    float uBackgroundAlpha;
};

struct flair_voronoi_frag_out
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
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _107)
{
    float2 p = (fragCoord / float2(_107.iResolution[1u])) * _107.uScale;
    float2 i = floor(p);
    float2 f = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    float shade = 0.0;
    for (int y = -1; y <= 1; y++)
    {
        for (int x = -1; x <= 1; x++)
        {
            float2 g = float2(float(x), float(y));
            float2 param = i + g;
            float2 o = hash22(param);
            o = float2(0.5) + (sin(float2(_107.iTime * _107.uSpeed) + (o * 6.28318023681640625)) * 0.4000000059604644775390625);
            float d = length((g + o) - f);
            if (d < d1)
            {
                d2 = d1;
                d1 = d;
                float2 param_1 = i + g;
                shade = hash12(param_1);
            }
            else
            {
                if (d < d2)
                {
                    d2 = d;
                }
            }
        }
    }
    float wall = 1.0 - smoothstep(0.0, 0.07999999821186065673828125, d2 - d1);
    float3 col = mix(_107.uBackground, _107.uCell * (0.4000000059604644775390625 + (0.60000002384185791015625 * shade)), float3(smoothstep(0.89999997615814208984375, 0.100000001490116119384765625, d1)));
    col = mix(col, float3(_107.uWall), float3(wall));
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
    float3 _291;
    if (a > 0.0)
    {
        _291 = bg + (d / float3(a));
    }
    else
    {
        _291 = bg;
    }
    float3 fg = _291;
    float alpha = a + (opacity * (1.0 - a));
    float3 _313;
    if (alpha > 0.0)
    {
        _313 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _313 = bg;
    }
    float3 col = _313;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _107)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _107);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _107.uBackground;
    float param_4 = _107.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_voronoi_frag_out flair_voronoi_frag(constant FlairUniforms& _107 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_voronoi_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _371;
    if (_107.flair_flipY > 0.5)
    {
        _371 = _107.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _371 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _371);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _107);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

