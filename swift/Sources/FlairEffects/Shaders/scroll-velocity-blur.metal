// flair-metal-hash: e26e5317
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
    float uAmount;
    float uMax;
    float uSplit;
    float uStretch;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
    uint uDemo;
};

struct flair_scroll_velocity_blur_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool scrollDemo(constant FlairUniforms& _60)
{
    bool _227 = _60.uDemo != 0u;
    bool _239;
    if (_227)
    {
        _239 = dot(_60.iScroll, _60.iScroll) == 0.0;
    }
    else
    {
        _239 = _227;
    }
    return _239;
}

static inline __attribute__((always_inline))
float4 scroll(constant FlairUniforms& _60)
{
    if (!scrollDemo(_60))
    {
        return _60.iScroll;
    }
    float ph = fract(_60.iTime / 6.0);
    float _258;
    if (ph < 0.5)
    {
        _258 = (ph * 2.400000095367431640625) - 0.100000001490116119384765625;
    }
    else
    {
        _258 = ((1.0 - ph) * 2.400000095367431640625) - 0.100000001490116119384765625;
    }
    float u = fast::clamp(_258, 0.0, 1.0);
    float x = (u * u) * (3.0 - (2.0 * u));
    float moving = float((u > 0.0) && (u < 1.0));
    float v = (((((moving * 6.0) * u) * (1.0 - u)) * 0.4000000059604644775390625) * 2.0) * ((ph < 0.5) ? 1.0 : (-1.0));
    return float4(x, x, v, moving);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _60)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_60.uBackdrop) * _60.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_60.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _60)
{
    float4 _203;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _203 = overBackdrop(param, _60);
    }
    else
    {
        float2 param_1 = fract(uv);
        _203 = float4(testCard(param_1), 1.0);
    }
    return _203;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _60, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_60.iResolution[0], _60.iResolution[1]);
    float4 s = scroll(_60);
    float v = s.z;
    float len = fast::clamp(abs(v) * _60.uAmount, 0.0, _60.uMax) * sign(v);
    uv.y = ((uv.y - 0.5) / (1.0 + ((_60.uStretch * abs(len)) / fast::max(_60.uMax, 0.001000000047497451305389404296875)))) + 0.5;
    float4 acc = float4(0.0);
    float3 split = float3(0.0);
    for (int i = 0; i < 16; i++)
    {
        float t = ((float(i) + 0.5) / 16.0) - 0.5;
        float w = 1.0 - (abs(t) * 1.2000000476837158203125);
        float2 param = uv + float2(0.0, t * len);
        float4 c = pictureRGBA(uImage, uImageSmplr, param, _60);
        acc += (c * w);
        split += (float3(c.x * fast::max(-t, 0.0), 0.0, c.z * fast::max(t, 0.0)) * w);
    }
    acc /= float4(6.400000095367431640625);
    split /= float3(6.400000095367431640625);
    float3 col = acc.xyz + ((((split * 2.0) - (float3(acc.x, 0.0, acc.z) * 0.5)) * _60.uSplit) * fast::clamp(abs(len) * 10.0, 0.0, 1.0));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), fast::clamp(acc.w, 0.0, 1.0));
}

fragment flair_scroll_velocity_blur_frag_out flair_scroll_velocity_blur_frag(constant FlairUniforms& _60 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_scroll_velocity_blur_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _468;
    if (_60.flair_flipY > 0.5)
    {
        _468 = _60.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _468 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _468);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _60, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

