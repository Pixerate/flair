// flair-metal-hash: 8638f0e7
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    float2 uFocusA;
    float2 uFocusB;
    float uAperture;
    float uBloom;
    float uOval;
    float uBreathing;
    uint uAnimate;
    float uProgress;
    char _m21_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_rack_focus_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float focus(constant FlairUniforms& _69)
{
    if (!(_69.uAnimate != 0u))
    {
        return _69.uProgress;
    }
    float c = mod(_69.iTime, 6.0) / 6.0;
    return smoothstep(0.20000000298023223876953125, 0.449999988079071044921875, c) - smoothstep(0.699999988079071044921875, 0.949999988079071044921875, c);
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _69, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_69.iResolution[0], _69.iResolution[1]);
    float f = focus(_69);
    uv = float2(0.5) + ((uv - float2(0.5)) / float2(1.0 + (_69.uBreathing * f)));
    float2 aspect = float2(_69.iResolution[0u] / _69.iResolution[1u], 1.0);
    float wa = 1.0 / (dot((uv - _69.uFocusA) * aspect, (uv - _69.uFocusA) * aspect) + 0.00200000009499490261077880859375);
    float wb = 1.0 / (dot((uv - _69.uFocusB) * aspect, (uv - _69.uFocusB) * aspect) + 0.00200000009499490261077880859375);
    float depth = wb / (wa + wb);
    float radius = _69.uAperture * fast::min(1.0, abs(depth - f) * 1.60000002384185791015625);
    float2 param = uv;
    float param_1 = radius;
    float param_2 = _69.uBloom;
    float param_3 = _69.uOval;
    float2 param_4 = uv;
    fragColor = float4(lensBlur(uImage, uImageSmplr, param, param_1, param_2, param_3, _69), pictureRGBA(uImage, uImageSmplr, param_4, _69).w);
}

fragment flair_rack_focus_frag_out flair_rack_focus_frag(constant FlairUniforms& _69 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_rack_focus_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _476;
    if (_69.flair_flipY > 0.5)
    {
        _476 = _69.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _476 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _476);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _69, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

