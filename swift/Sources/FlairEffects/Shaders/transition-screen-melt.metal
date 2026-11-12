// flair-metal-hash: 729d73ed
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
    uint uAnimate;
    float uProgress;
    float uColumn;
    float uStagger;
    float uRagged;
    float uStep;
    char _m19_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_transition_screen_melt_frag_out
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _146)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_146.uBackdrop) * _146.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_146.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _146)
{
    float4 _287;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _287 = overBackdrop(param, _146);
    }
    else
    {
        float2 param_1 = fract(uv);
        _287 = float4(testCard(param_1), 1.0);
    }
    return _287;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _146, texture2d<float> uTo, sampler uToSmplr, texture2d<float> uFrom, sampler uFromSmplr)
{
    float _313;
    if (_146.uAnimate != 0u)
    {
        _313 = smoothstep(0.0500000007450580596923828125, 0.949999988079071044921875, 0.5 - (0.5 * cos((_146.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _313 = _146.uProgress;
    }
    float p = _313;
    float column = floor(fragCoord.x / _146.uColumn);
    float2 param = float2(column * 0.119999997317790985107421875, 1.2999999523162841796875);
    float2 param_1 = float2(column, 2.0);
    float delay = mix(vnoise(param), hash12(param_1), _146.uRagged) * _146.uStagger;
    float local = fast::clamp((p * (1.0 + _146.uStagger)) - delay, 0.0, 1.0);
    float drop = floor(((local * local) * _146.iResolution[1u]) / _146.uStep) * _146.uStep;
    float from = fragCoord.y + drop;
    float2 res = float2(_146.iResolution[0], _146.iResolution[1]);
    bool _394 = local >= 1.0;
    bool _402;
    if (!_394)
    {
        _402 = from >= res.y;
    }
    else
    {
        _402 = _394;
    }
    float4 _403;
    if (_402)
    {
        float2 param_2 = fragCoord / res;
        _403 = pictureRGBA(uTo, uToSmplr, param_2, _146);
    }
    else
    {
        float2 param_3 = float2(fragCoord.x, from) / res;
        _403 = pictureRGBA(uFrom, uFromSmplr, param_3, _146);
    }
    fragColor = _403;
}

fragment flair_transition_screen_melt_frag_out flair_transition_screen_melt_frag(constant FlairUniforms& _146 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_transition_screen_melt_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _435;
    if (_146.flair_flipY > 0.5)
    {
        _435 = _146.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _435 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _435);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _146, uTo, uToSmplr, uFrom, uFromSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

