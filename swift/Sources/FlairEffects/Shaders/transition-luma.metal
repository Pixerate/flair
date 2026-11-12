// flair-metal-hash: 39f54030
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
    float uSoftness;
    uint uLightFirst;
    int uSource;
    char _m18_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_transition_luma_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float progress(constant FlairUniforms& _68)
{
    float _237;
    if (_68.uAnimate != 0u)
    {
        _237 = smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, 0.5 - (0.5 * cos((_68.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _237 = _68.uProgress;
    }
    return _237;
}

static inline __attribute__((always_inline))
float2 coverScale(texture2d<float> tex, sampler texSmplr, constant FlairUniforms& _68)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    float frameAspect = _68.iResolution[0u] / _68.iResolution[1u];
    float _274;
    if (size.x > 1.0)
    {
        _274 = size.x / size.y;
    }
    else
    {
        _274 = frameAspect;
    }
    float imageAspect = _274;
    float2 _288;
    if (frameAspect > imageAspect)
    {
        _288 = float2(1.0, imageAspect / frameAspect);
    }
    else
    {
        _288 = float2(frameAspect / imageAspect, 1.0);
    }
    return _288;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _68)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_68.uBackdrop) * _68.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_68.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _68)
{
    float4 _212;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _212 = overBackdrop(param, _68);
    }
    else
    {
        float2 param_1 = fract(uv);
        _212 = float4(testCard(param_1), 1.0);
    }
    return _212;
}

static inline __attribute__((always_inline))
float4 coverRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _68)
{
    float2 param = float2(0.5) + ((uv - float2(0.5)) * coverScale(tex, texSmplr, _68));
    return pictureRGBA(tex, texSmplr, param, _68);
}

static inline __attribute__((always_inline))
float luma(thread const float3& c)
{
    return dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _68, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float2 uv = fragCoord / float2(_68.iResolution[0], _68.iResolution[1]);
    float t = progress(_68);
    float2 param = uv;
    float4 a = coverRGBA(uFrom, uFromSmplr, param, _68);
    float2 param_1 = uv;
    float4 b = coverRGBA(uTo, uToSmplr, param_1, _68);
    float3 _346;
    if (_68.uSource == 0)
    {
        _346 = a.xyz;
    }
    else
    {
        _346 = b.xyz;
    }
    float3 param_2 = _346;
    float l = fast::clamp(luma(param_2), 0.0, 1.0);
    if (_68.uLightFirst != 0u)
    {
        l = 1.0 - l;
    }
    float front = mix(-_68.uSoftness, 1.0 + _68.uSoftness, t);
    fragColor = mix(a, b, float4(smoothstep(l - _68.uSoftness, l + _68.uSoftness, front)));
}

fragment flair_transition_luma_frag_out flair_transition_luma_frag(constant FlairUniforms& _68 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_transition_luma_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _403;
    if (_68.flair_flipY > 0.5)
    {
        _403 = _68.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _403 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _403);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _68, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

