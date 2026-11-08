// flair-metal-hash: b4481073
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL radians() function
template<typename T>
inline T radians(T d)
{
    return d * T(0.01745329251);
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
    uint uAnimate;
    float uProgress;
    float uStrength;
    float uAngle;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_transition_displacement_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float progress(constant FlairUniforms& _73)
{
    float _242;
    if (_73.uAnimate != 0u)
    {
        _242 = smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, 0.5 - (0.5 * cos((_73.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _242 = _73.uProgress;
    }
    return _242;
}

static inline __attribute__((always_inline))
float2 coverScale(texture2d<float> tex, sampler texSmplr, constant FlairUniforms& _73)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    float frameAspect = _73.iResolution[0u] / _73.iResolution[1u];
    float _279;
    if (size.x > 1.0)
    {
        _279 = size.x / size.y;
    }
    else
    {
        _279 = frameAspect;
    }
    float imageAspect = _279;
    float2 _293;
    if (frameAspect > imageAspect)
    {
        _293 = float2(1.0, imageAspect / frameAspect);
    }
    else
    {
        _293 = float2(frameAspect / imageAspect, 1.0);
    }
    return _293;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _73)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_73.uBackdrop) * _73.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_73.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _73)
{
    float4 _217;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _217 = overBackdrop(param, _73);
    }
    else
    {
        float2 param_1 = fract(uv);
        _217 = float4(testCard(param_1), 1.0);
    }
    return _217;
}

static inline __attribute__((always_inline))
float4 coverRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _73)
{
    float2 param = float2(0.5) + ((uv - float2(0.5)) * coverScale(tex, texSmplr, _73));
    return pictureRGBA(tex, texSmplr, param, _73);
}

static inline __attribute__((always_inline))
float3 cover(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _73)
{
    float2 param = uv;
    return coverRGBA(tex, texSmplr, param, _73).xyz;
}

static inline __attribute__((always_inline))
float luma(thread const float3& c)
{
    return dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _73, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float2 uv = fragCoord / float2(_73.iResolution[0], _73.iResolution[1]);
    float t = progress(_73);
    float2 dir = float2(cos(radians(_73.uAngle)), sin(radians(_73.uAngle))) * float2(_73.iResolution[1u] / _73.iResolution[0u], 1.0);
    float2 param = uv;
    float3 param_1 = cover(uFrom, uFromSmplr, param, _73);
    float la = luma(param_1);
    float2 param_2 = uv;
    float3 param_3 = cover(uTo, uToSmplr, param_2, _73);
    float lb = luma(param_3);
    float2 param_4 = uv + (((dir * t) * _73.uStrength) * la);
    float4 a = coverRGBA(uFrom, uFromSmplr, param_4, _73);
    float2 param_5 = uv - (((dir * (1.0 - t)) * _73.uStrength) * lb);
    float4 b = coverRGBA(uTo, uToSmplr, param_5, _73);
    fragColor = mix(a, b, float4(smoothstep(0.20000000298023223876953125, 0.800000011920928955078125, t)));
}

fragment flair_transition_displacement_frag_out flair_transition_displacement_frag(constant FlairUniforms& _73 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_transition_displacement_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _422;
    if (_73.flair_flipY > 0.5)
    {
        _422 = _73.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _422 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _422);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _73, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

