// flair-metal-hash: 7a195a5b
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
    float uHorizon;
    uint uFit;
    float uRipple;
    float uScale;
    float uSpeed;
    char _m18_pad[12];
    packed_float3 uWater;
    float uDepth;
    float uGlints;
    float uBlur;
    char _m22_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_water_reflection_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _152)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_152.uBackdrop) * _152.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_152.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float4 pictureBlurRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float& blurPx, constant FlairUniforms& _152)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    if (size.x <= 1.0)
    {
        float2 param = fract(uv);
        return float4(testCard(param), 1.0);
    }
    float4 param_1 = tex.sample(texSmplr, uv, level(log2(fast::max((blurPx * size.x) / _152.iResolution[0u], 1.0))));
    return overBackdrop(param_1, _152);
}

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
float waves(thread const float2& w, thread const float& t)
{
    float2 param = w + float2(0.0, t);
    float2 param_1 = (w * 2.2999999523162841796875) + float2(t * 0.60000002384185791015625, (-t) * 0.4000000059604644775390625);
    return (vnoise(param) * 0.60000002384185791015625) + (vnoise(param_1) * 0.4000000059604644775390625);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _152, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_152.iResolution[0], _152.iResolution[1]);
    float h = _152.uHorizon;
    if (uv.y >= h)
    {
        float2 _369;
        if (_152.uFit != 0u)
        {
            _369 = float2(uv.x, uv.y - h);
        }
        else
        {
            _369 = uv;
        }
        float2 src = _369;
        float2 param = src;
        float param_1 = 1.0;
        fragColor = pictureBlurRGBA(uImage, uImageSmplr, param, param_1, _152);
        return;
    }
    float dist = h - uv.y;
    float z = 1.0 / (dist + 0.02999999932944774627685546875);
    float2 w = (float2(((((uv.x * _152.iResolution[0u]) / _152.iResolution[1u]) * 6.0) * z) * 0.119999997317790985107421875, z) * float2(_152.uScale, 0.3499999940395355224609375 * _152.uScale)) * 4.0;
    float t = _152.iTime * _152.uSpeed;
    float e = 0.0500000007450580596923828125;
    float2 param_2 = w + float2(e, 0.0);
    float param_3 = t;
    float2 param_4 = w - float2(e, 0.0);
    float param_5 = t;
    float2 param_6 = w + float2(0.0, e);
    float param_7 = t;
    float2 param_8 = w - float2(0.0, e);
    float param_9 = t;
    float2 slope = float2(waves(param_2, param_3) - waves(param_4, param_5), waves(param_6, param_7) - waves(param_8, param_9)) / float2(2.0 * e);
    float near = dist / fast::max(h, 0.001000000047497451305389404296875);
    float2 offset = ((slope * _152.uRipple) * float2(0.00999999977648258209228515625, 0.02500000037252902984619140625)) * (0.1500000059604644775390625 + near);
    float _498;
    if (_152.uFit != 0u)
    {
        _498 = dist;
    }
    else
    {
        _498 = h + dist;
    }
    float my = _498;
    float2 param_10 = float2(uv.x, my) + offset;
    float param_11 = 1.0 + ((_152.uBlur * 30.0) * near);
    float4 refl = pictureBlurRGBA(uImage, uImageSmplr, param_10, param_11, _152);
    float3 col = refl.xyz;
    col = mix(col, float3(_152.uWater), float3(_152.uDepth * (0.300000011920928955078125 + (0.699999988079071044921875 * smoothstep(0.0, 0.800000011920928955078125, near)))));
    col *= (0.699999988079071044921875 + (0.300000011920928955078125 * (1.0 - near)));
    float glint = powr(fast::clamp(0.5 + (0.5 * ((slope.x * 0.699999988079071044921875) - (slope.y * 0.699999988079071044921875))), 0.0, 1.0), 24.0);
    col += float3(((glint * _152.uGlints) * (0.4000000059604644775390625 + (0.800000011920928955078125 * dot(refl.xyz, float3(0.333000004291534423828125))))) * smoothstep(0.89999997615814208984375, 0.20000000298023223876953125, near));
    col += float3(0.119999997317790985107421875 * exp(((-dist) * _152.iResolution[1u]) / 2.0));
    fragColor = float4(col, refl.w);
}

fragment flair_water_reflection_frag_out flair_water_reflection_frag(constant FlairUniforms& _152 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_water_reflection_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _614;
    if (_152.flair_flipY > 0.5)
    {
        _614 = _152.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _614 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _614);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _152, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

