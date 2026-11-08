// flair-metal-hash: 6848bcdc
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
    packed_float3 uColor;
    float uDensity;
    float uHeight;
    float uSpeed;
    int uLayers;
};

struct flair_fog_banks_frag_out
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
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _231)
{
    float2 p = fragCoord / float2(_231.iResolution[1u]);
    float y = fragCoord.y / _231.iResolution[1u];
    float4 acc = float4(0.0);
    for (int i = 0; i < 6; i++)
    {
        if (i >= _231.uLayers)
        {
            break;
        }
        float fi = float(i);
        float near = (fi + 1.0) / float(_231.uLayers);
        float centre = _231.uHeight * mix(0.85000002384185791015625, 0.119999997317790985107421875, near);
        float thick = _231.uHeight * mix(0.119999997317790985107421875, 0.300000011920928955078125, near);
        float band = exp(-powr((y - centre) / thick, 2.0));
        band = fast::max(band, step(y, centre) * mix(0.300000011920928955078125, 1.0, near));
        float scale = mix(1.2000000476837158203125, 2.599999904632568359375, near);
        float2 q = float2(((p.x * scale) + ((_231.iTime * _231.uSpeed) * mix(0.014999999664723873138427734375, 0.07999999821186065673828125, near))) + (fi * 7.30000019073486328125), ((p.y * scale) * 3.0) + (fi * 2.099999904632568359375));
        float2 param = (q * 0.699999988079071044921875) - float2(_231.iTime * 0.0199999995529651641845703125);
        int param_1 = 3;
        float _356 = fbm(param, param_1);
        float2 param_2 = q + (float2(_356, 0.0) * 0.60000002384185791015625);
        int param_3 = 5;
        float _363 = fbm(param_2, param_3);
        float n = _363;
        float a = ((smoothstep(0.300000011920928955078125, 0.800000011920928955078125, n) * band) * _231.uDensity) * mix(0.3499999940395355224609375, 0.800000011920928955078125, near);
        a = fast::clamp(a + ((((1.0 - smoothstep(0.0, _231.uHeight * 0.4000000059604644775390625, y)) * 0.119999997317790985107421875) * _231.uDensity) * near), 0.0, 1.0);
        float3 c = float3(_231.uColor) * mix(0.85000002384185791015625, 1.0, n);
        float4 param_4 = acc;
        float3 param_5 = c;
        float param_6 = a;
        acc = over(param_4, param_5, param_6);
    }
    float4 param_7 = acc;
    fragColor = unpremultiply(param_7);
}

fragment flair_fog_banks_frag_out flair_fog_banks_frag(constant FlairUniforms& _231 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_fog_banks_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _424;
    if (_231.flair_flipY > 0.5)
    {
        _424 = _231.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _424 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _424);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _231);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

