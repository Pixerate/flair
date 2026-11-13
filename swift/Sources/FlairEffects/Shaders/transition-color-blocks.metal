// flair-metal-hash: e7aea45d
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
    uint uAnimate;
    float uProgress;
    float3 uColorA;
    float3 uColorB;
    float3 uColorC;
    packed_float3 uColorD;
    int uBands;
    float uWidth;
    int uRows;
    float uStagger;
    float uAngle;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_transition_color_blocks_frag_out
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
float3 flatColour(thread const int& i, constant FlairUniforms& _92)
{
    int k = i - (4 * (i / 4));
    float3 _263;
    if (k == 0)
    {
        _263 = _92.uColorA;
    }
    else
    {
        float3 _272;
        if (k == 1)
        {
            _272 = _92.uColorB;
        }
        else
        {
            float3 _282;
            if (k == 2)
            {
                _282 = _92.uColorC;
            }
            else
            {
                _282 = float3(_92.uColorD);
            }
            _272 = _282;
        }
        _263 = _272;
    }
    return _263;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _92)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_92.uBackdrop) * _92.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_92.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _92)
{
    float4 _234;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _234 = overBackdrop(param, _92);
    }
    else
    {
        float2 param_1 = fract(uv);
        _234 = float4(testCard(param_1), 1.0);
    }
    return _234;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _92, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float2 uv = fragCoord / float2(_92.iResolution[0], _92.iResolution[1]);
    float2 p = (fragCoord - (float2(_92.iResolution[0], _92.iResolution[1]) * 0.5)) / float2(_92.iResolution[1u]);
    float _320;
    if (_92.uAnimate != 0u)
    {
        _320 = smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, 0.5 - (0.5 * cos((_92.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _320 = _92.uProgress;
    }
    float k = _320;
    float aspect = _92.iResolution[0u] / _92.iResolution[1u];
    float a = radians(_92.uAngle);
    float2 dir = float2(cos(a), sin(a));
    float2 perp = float2(-dir.y, dir.x);
    float extent = (abs(dir.x) * aspect) + abs(dir.y);
    float s = (dot(p, dir) / extent) + 0.5;
    float row = floor(((dot(p, perp) / ((abs(perp.x) * aspect) + abs(perp.y))) + 0.5) * float(_92.uRows));
    float _407;
    if (_92.uRows > 1)
    {
        float2 param = float2(row, 4.0);
        _407 = hash12(param) * _92.uStagger;
    }
    else
    {
        _407 = 0.0;
    }
    float lag = _407;
    float u = ((k * ((1.0 + _92.uWidth) + _92.uStagger)) - s) - lag;
    float px = 1.5 / (_92.iResolution[1u] * extent);
    float n = float(_92.uBands);
    float b = fast::clamp(u / _92.uWidth, 0.0, 0.99989998340606689453125) * n;
    int i = int(floor(b));
    int param_1 = i;
    float3 band = flatColour(param_1, _92);
    if (i > 0)
    {
        int param_2 = i - 1;
        band = mix(flatColour(param_2, _92), band, float3(smoothstep(0.0, (px * n) / _92.uWidth, fract(b))));
    }
    float2 param_3 = uv;
    float4 col = pictureRGBA(uFrom, uFromSmplr, param_3, _92);
    col = mix(col, float4(band, 1.0), float4(smoothstep(0.0, px, u)));
    float2 param_4 = uv;
    fragColor = mix(col, pictureRGBA(uTo, uToSmplr, param_4, _92), float4(smoothstep(_92.uWidth - px, _92.uWidth, u)));
}

fragment flair_transition_color_blocks_frag_out flair_transition_color_blocks_frag(constant FlairUniforms& _92 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_transition_color_blocks_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _527;
    if (_92.flair_flipY > 0.5)
    {
        _527 = _92.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _527 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _527);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _92, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

