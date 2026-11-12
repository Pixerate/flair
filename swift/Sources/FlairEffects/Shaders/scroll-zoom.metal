// flair-metal-hash: 8b4be16e
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    float uFrom;
    float uTo;
    float2 uFocus;
    float uPan;
    float uTurn;
    float uVignette;
    char _m19_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
    uint uDemo;
};

struct flair_scroll_zoom_frag_out
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
    float k = (s.x * s.x) * (3.0 - (2.0 * s.x));
    float zoom = mix(_60.uFrom, _60.uTo, k);
    float a = radians(_60.uTurn) * (k - 0.5);
    float2 aspect = float2(_60.iResolution[0u] / _60.iResolution[1u], 1.0);
    float2 p = (uv - _60.uFocus) * aspect;
    p = (float2x2(float2(cos(a), sin(a)), float2(-sin(a), cos(a))) * p) / float2(zoom);
    float2 at = ((p / aspect) + _60.uFocus) + float2(0.0, _60.uPan * (k - 0.5));
    float2 param = at;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _60);
    float vig = 1.0 - (_60.uVignette * smoothstep(0.3499999940395355224609375, 0.949999988079071044921875, length((uv - float2(0.5)) * aspect) / length(aspect * 0.5)));
    fragColor = float4(pic.xyz * vig, pic.w);
}

fragment flair_scroll_zoom_frag_out flair_scroll_zoom_frag(constant FlairUniforms& _60 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_scroll_zoom_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _443;
    if (_60.flair_flipY > 0.5)
    {
        _443 = _60.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _443 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _443);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _60, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

