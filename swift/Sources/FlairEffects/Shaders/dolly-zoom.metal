// flair-metal-hash: 87a2e3b1
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
    float2 uSubject;
    float uSize;
    float uStretch;
    float uBlur;
    uint uAnimate;
    float uProgress;
    char _m19_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_dolly_zoom_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float dollyAt(thread const float& t)
{
    float c = mod(t, 5.0) / 5.0;
    return smoothstep(0.100000001490116119384765625, 0.699999988079071044921875, c) - smoothstep(0.819999992847442626953125, 0.980000019073486328125, c);
}

static inline __attribute__((always_inline))
float2 warp(thread const float2& uv, thread const float& p, constant FlairUniforms& _67)
{
    float2 aspect = float2(_67.iResolution[0u] / _67.iResolution[1u], 1.0);
    float2 d = (uv - _67.uSubject) * aspect;
    float r = length(d);
    float behind = smoothstep(_67.uSize, (_67.uSize * 2.400000095367431640625) + 0.100000001490116119384765625, r);
    float s = exp(((_67.uStretch * (p - step(_67.uStretch, 0.0))) * behind) * 0.60000002384185791015625);
    return _67.uSubject + ((d / float2(s)) / aspect);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _67)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_67.uBackdrop) * _67.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_67.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _67)
{
    float4 _211;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _211 = overBackdrop(param, _67);
    }
    else
    {
        float2 param_1 = fract(uv);
        _211 = float4(testCard(param_1), 1.0);
    }
    return _211;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _67)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _67).xyz;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _67, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_67.iResolution[0], _67.iResolution[1]);
    float _320;
    if (_67.uAnimate != 0u)
    {
        float param = _67.iTime;
        _320 = dollyAt(param);
    }
    else
    {
        _320 = _67.uProgress;
    }
    float p = _320;
    float _336;
    if (_67.uAnimate != 0u)
    {
        float param_1 = _67.iTime - 0.032999999821186065673828125;
        _336 = fast::clamp(((p - dollyAt(param_1)) * _67.uBlur) * 4.0, -0.300000011920928955078125, 0.300000011920928955078125);
    }
    else
    {
        _336 = 0.0;
    }
    float dp = _336;
    float3 col = float3(0.0);
    for (int i = 0; i < 8; i++)
    {
        float2 param_2 = uv;
        float param_3 = p - ((dp * float(i)) / 7.0);
        float2 param_4 = warp(param_2, param_3, _67);
        col += picture(uImage, uImageSmplr, param_4, _67);
    }
    float2 param_5 = uv;
    float param_6 = p;
    float2 param_7 = warp(param_5, param_6, _67);
    fragColor = float4(col / float3(8.0), pictureRGBA(uImage, uImageSmplr, param_7, _67).w);
}

fragment flair_dolly_zoom_frag_out flair_dolly_zoom_frag(constant FlairUniforms& _67 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_dolly_zoom_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _416;
    if (_67.flair_flipY > 0.5)
    {
        _416 = _67.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _416 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _416);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _67, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

