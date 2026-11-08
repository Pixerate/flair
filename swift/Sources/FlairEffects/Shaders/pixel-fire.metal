// flair-metal-hash: c42898be
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
float3 ramp(thread const float& t, constant FlairUniforms& _188)
{
    float3 c = mix(float3(0.0199999995529651641845703125, 0.00999999977648258209228515625, 0.00999999977648258209228515625), _188.uEmber, float3(smoothstep(0.0, 0.300000011920928955078125, t)));
    c = mix(c, _188.uFlame, float3(smoothstep(0.300000011920928955078125, 0.60000002384185791015625, t)));
    c = mix(c, _188.uCore, float3(smoothstep(0.60000002384185791015625, 0.85000002384185791015625, t)));
    return mix(c, float3(1.0, 1.0, 0.939999997615814208984375), float3(smoothstep(0.85000002384185791015625, 1.0, t)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _188)
{
    float2 cell = floor(fragCoord / float2(_188.uPixel));
    float rows = fast::max(floor(_188.iResolution[1u] / _188.uPixel), 1.0);
    float t = _188.iTime * _188.uSpeed;
    float y = cell.y / rows;
    float x = (cell.x / rows) - (((_188.uWind * y) * y) * 0.800000011920928955078125);
    float2 param = float2((x * 7.0) + ((_188.uWind * t) * 1.5), (y * 4.0) - (t * 2.599999904632568359375));
    int param_1 = 4;
    float _289 = fbm(param, param_1);
    float n = _289;
    float2 param_2 = cell + float2(floor(t * 14.0) * 7.309999942779541015625);
    float flick = hash12(param_2) - 0.5;
    float heat = (1.0499999523162841796875 - ((y / _188.uHeight) * (0.3499999940395355224609375 + (1.5 * n)))) + ((flick * 0.2199999988079071044921875) * _188.uFlicker);
    float levels = float(_188.uLevels);
    float lvl = fast::clamp(floor(heat * levels), 0.0, levels - 1.0);
    float param_3 = lvl / (levels - 1.0);
    fragColor = float4(ramp(param_3, _188), 1.0);
}

fragment flair_pixel_fire_frag_out flair_pixel_fire_frag(constant FlairUniforms& _188 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_pixel_fire_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _360;
    if (_188.flair_flipY > 0.5)
    {
        _360 = _188.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _360 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _360);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _188);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

