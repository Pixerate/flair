// flair-metal-hash: 5fd93ac2
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
    float uPixel;
    float uHeight;
    float uWind;
    float uSpeed;
    float uFlicker;
    int uLevels;
    float3 uEmber;
    float3 uFlame;
    float3 uCore;
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_pixel_fire_frag_out
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
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float3 ramp(thread const float& t, constant FlairUniforms& _195)
{
    float3 c = mix(float3(_195.uBackground), _195.uEmber, float3(smoothstep(0.0, 0.300000011920928955078125, t)));
    c = mix(c, _195.uFlame, float3(smoothstep(0.300000011920928955078125, 0.60000002384185791015625, t)));
    c = mix(c, _195.uCore, float3(smoothstep(0.60000002384185791015625, 0.85000002384185791015625, t)));
    return mix(c, float3(1.0, 1.0, 0.939999997615814208984375), float3(smoothstep(0.85000002384185791015625, 1.0, t)));
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _195)
{
    float2 cell = floor(fragCoord / float2(_195.uPixel));
    float rows = fast::max(floor(_195.iResolution[1u] / _195.uPixel), 1.0);
    float t = _195.iTime * _195.uSpeed;
    float y = cell.y / rows;
    float x = (cell.x / rows) - (((_195.uWind * y) * y) * 0.800000011920928955078125);
    float2 param = float2((x * 7.0) + ((_195.uWind * t) * 1.5), (y * 4.0) - (t * 2.599999904632568359375));
    int param_1 = 4;
    float _299 = fbm(param, param_1);
    float n = _299;
    float2 param_2 = cell + float2(floor(t * 14.0) * 7.309999942779541015625);
    float flick = hash12(param_2) - 0.5;
    float heat = (1.0499999523162841796875 - ((y / _195.uHeight) * (0.3499999940395355224609375 + (1.5 * n)))) + ((flick * 0.2199999988079071044921875) * _195.uFlicker);
    float levels = float(_195.uLevels);
    float lvl = fast::clamp(floor(heat * levels), 0.0, levels - 1.0);
    float param_3 = lvl / (levels - 1.0);
    fragColor = float4(ramp(param_3, _195), 1.0);
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
    float3 _402;
    if (a > 0.0)
    {
        _402 = bg + (d / float3(a));
    }
    else
    {
        _402 = bg;
    }
    float3 fg = _402;
    float alpha = a + (opacity * (1.0 - a));
    float3 _424;
    if (alpha > 0.0)
    {
        _424 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _424 = bg;
    }
    float3 col = _424;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _195)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _195);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_195.uBackground);
    float param_4 = _195.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_pixel_fire_frag_out flair_pixel_fire_frag(constant FlairUniforms& _195 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_pixel_fire_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _482;
    if (_195.flair_flipY > 0.5)
    {
        _482 = _195.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _482 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _482);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _195);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

