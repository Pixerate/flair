// flair-metal-hash: 11fcbbfa
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
    float uAperture;
    float uBloom;
    float uOval;
    float uBreathing;
    float uBlend;
    char _m20_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_transition_focus_pull_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float progress(constant FlairUniforms& _69)
{
    float _339;
    if (_69.uAnimate != 0u)
    {
        _339 = smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, 0.5 - (0.5 * cos((_69.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _339 = _69.uProgress;
    }
    return _339;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _69)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_69.uBackdrop) * _69.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_69.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _69)
{
    float4 _213;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _213 = overBackdrop(param, _69);
    }
    else
    {
        float2 param_1 = fract(uv);
        _213 = float4(testCard(param_1), 1.0);
    }
    return _213;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _69)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _69).xyz;
}

static inline __attribute__((always_inline))
float3 lensBlur(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float& radius, thread const float& bloom, thread const float& oval, constant FlairUniforms& _69)
{
    if ((radius * _69.iResolution[1u]) < 0.5)
    {
        float2 param = uv;
        return picture(tex, texSmplr, param, _69);
    }
    float2 scale = float2((_69.iResolution[1u] / _69.iResolution[0u]) * (1.0 - (0.449999988079071044921875 * oval)), 1.0) * radius;
    float3 sum = float3(0.0);
    float total = 0.0;
    for (int i = 0; i < 32; i++)
    {
        float f = (float(i) + 0.5) / 32.0;
        float a = float(i) * 2.399960041046142578125;
        float2 param_1 = uv + ((float2(cos(a), sin(a)) * sqrt(f)) * scale);
        float3 c = picture(tex, texSmplr, param_1, _69);
        float w = 1.0 + ((bloom * 10.0) * smoothstep(0.60000002384185791015625, 1.0, dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875))));
        sum += (c * w);
        total += w;
    }
    return sum / float3(total);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _69, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float2 uv = fragCoord / float2(_69.iResolution[0], _69.iResolution[1]);
    float t = progress(_69);
    float u = smoothstep(0.0, 1.0, 1.0 - abs((2.0 * t) - 1.0));
    float2 p = float2(0.5) + ((uv - float2(0.5)) / float2(1.0 + (_69.uBreathing * u)));
    float radius = _69.uAperture * u;
    float k = smoothstep(0.5 - (0.5 * _69.uBlend), (0.5 + (0.5 * _69.uBlend)) + 9.9999997473787516355514526367188e-05, t);
    float4 col = float4(0.0);
    if (k < 1.0)
    {
        float2 param = p;
        float param_1 = radius;
        float param_2 = _69.uBloom;
        float param_3 = _69.uOval;
        float2 param_4 = p;
        col += (float4(lensBlur(uFrom, uFromSmplr, param, param_1, param_2, param_3, _69), pictureRGBA(uFrom, uFromSmplr, param_4, _69).w) * (1.0 - k));
    }
    if (k > 0.0)
    {
        float2 param_5 = p;
        float param_6 = radius;
        float param_7 = _69.uBloom;
        float param_8 = _69.uOval;
        float2 param_9 = p;
        col += (float4(lensBlur(uTo, uToSmplr, param_5, param_6, param_7, param_8, _69), pictureRGBA(uTo, uToSmplr, param_9, _69).w) * k);
    }
    fragColor = col;
}

fragment flair_transition_focus_pull_frag_out flair_transition_focus_pull_frag(constant FlairUniforms& _69 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_transition_focus_pull_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _484;
    if (_69.flair_flipY > 0.5)
    {
        _484 = _69.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _484 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _484);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _69, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

