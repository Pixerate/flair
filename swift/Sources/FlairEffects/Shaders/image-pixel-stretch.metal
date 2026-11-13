// flair-metal-hash: 6f91e8bf
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
    int uDirection;
    float uLine;
    float uTravel;
    float uSpeed;
    float uBands;
    float uRagged;
    char _m19_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_image_pixel_stretch_frag_out
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _87)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_87.uBackdrop) * _87.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_87.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _87)
{
    float4 _229;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _229 = overBackdrop(param, _87);
    }
    else
    {
        float2 param_1 = fract(uv);
        _229 = float4(testCard(param_1), 1.0);
    }
    return _229;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _87, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_87.iResolution[0], _87.iResolution[1]);
    bool upright = _87.uDirection >= 2;
    bool _266 = _87.uDirection == 1;
    bool _274;
    if (!_266)
    {
        _274 = _87.uDirection == 3;
    }
    else
    {
        _274 = _266;
    }
    bool back = _274;
    float _277;
    if (upright)
    {
        _277 = uv.y;
    }
    else
    {
        _277 = uv.x;
    }
    float along = _277;
    float _288;
    if (upright)
    {
        _288 = uv.x;
    }
    else
    {
        _288 = uv.y;
    }
    float across = _288;
    if (back)
    {
        along = 1.0 - along;
    }
    bool banded = _87.uBands >= 1.0;
    float _309;
    if (banded)
    {
        _309 = (floor(across * _87.uBands) + 0.5) / _87.uBands;
    }
    else
    {
        _309 = across;
    }
    float band = _309;
    float t = _87.iTime * _87.uSpeed;
    float _333;
    if (banded)
    {
        float2 param = float2(floor(across * _87.uBands), 7.0);
        _333 = hash12(param) - 0.5;
    }
    else
    {
        _333 = 0.5 * sin((across * 9.0) + (t * 0.699999988079071044921875));
    }
    float ragged = _333;
    float line = (_87.uLine + (_87.uTravel * sin(t + (band * 2.5)))) + (_87.uRagged * ragged);
    if (along > line)
    {
        along = line;
        across = band;
    }
    if (back)
    {
        along = 1.0 - along;
    }
    float2 _390;
    if (upright)
    {
        _390 = float2(across, along);
    }
    else
    {
        _390 = float2(along, across);
    }
    float2 param_1 = _390;
    fragColor = pictureRGBA(uImage, uImageSmplr, param_1, _87);
}

fragment flair_image_pixel_stretch_frag_out flair_image_pixel_stretch_frag(constant FlairUniforms& _87 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_image_pixel_stretch_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _416;
    if (_87.flair_flipY > 0.5)
    {
        _416 = _87.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _416 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _416);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _87, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

