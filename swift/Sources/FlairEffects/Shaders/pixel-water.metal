// flair-metal-hash: dc932701
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
    float uPixel;
    float uTile;
    float3 uDeep;
    float3 uMid;
    float3 uLight;
    packed_float3 uFoam;
    float uSparkle;
};

struct flair_pixel_water_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _97)
{
    float2 cell = floor(fragCoord / float2(_97.uPixel));
    float tile = floor(_97.uTile);
    float2 p = mod(cell, float2(tile));
    float k = 6.28318023681640625 / tile;
    float w = (_97.iTime * 6.28318023681640625) / 4.0;
    float a = sin(((k * p.x) + (1.39999997615814208984375 * sin(((k * 2.0) * p.y) + w))) + w);
    float b = sin((((k * 2.0) * p.y) - w) + (0.89999997615814208984375 * sin((k * p.x) - w)));
    float v = (0.5 + (0.2800000011920928955078125 * a)) + (0.2199999988079071044921875 * b);
    float3 _180;
    if (v < 0.4000000059604644775390625)
    {
        _180 = _97.uDeep;
    }
    else
    {
        float3 _191;
        if (v < 0.7200000286102294921875)
        {
            _191 = _97.uMid;
        }
        else
        {
            _191 = _97.uLight;
        }
        _180 = _191;
    }
    float3 col = _180;
    bool _205 = v > 0.86000001430511474609375;
    bool _213;
    if (_205)
    {
        _213 = mod(p.y, 2.0) < 1.0;
    }
    else
    {
        _213 = _205;
    }
    if (_213)
    {
        col = float3(_97.uFoam);
    }
    float2 block = floor(p / float2(8.0));
    float2 param = block + float2(tile);
    float2 at = floor(((block * 8.0) + float2(1.0)) + (hash22(param) * 6.0));
    float2 param_1 = (block * 1.7000000476837158203125) + float2(tile);
    float phase = fract((_97.iTime / 4.0) + hash12(param_1));
    float _258;
    if (phase < 0.119999997317790985107421875)
    {
        _258 = phase / 0.119999997317790985107421875;
    }
    else
    {
        _258 = 0.0;
    }
    float life = _258;
    float2 param_2 = block + float2(9.1000003814697265625);
    if ((hash12(param_2) < _97.uSparkle) && (life > 0.0))
    {
        float2 d = abs(p - at);
        float arm = float((life > 0.300000011920928955078125) && (life < 0.75));
        bool _300 = (d.x + d.y) < 0.5;
        bool _325;
        if (!_300)
        {
            bool _305 = arm > 0.5;
            bool _314;
            if (_305)
            {
                _314 = fast::min(d.x, d.y) < 0.5;
            }
            else
            {
                _314 = _305;
            }
            bool _324;
            if (_314)
            {
                _324 = (d.x + d.y) < 1.5;
            }
            else
            {
                _324 = _314;
            }
            _325 = _324;
        }
        else
        {
            _325 = _300;
        }
        if (_325)
        {
            col = float3(_97.uFoam);
        }
    }
    fragColor = float4(col, 1.0);
}

fragment flair_pixel_water_frag_out flair_pixel_water_frag(constant FlairUniforms& _97 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_pixel_water_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _347;
    if (_97.flair_flipY > 0.5)
    {
        _347 = _97.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _347 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _347);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _97);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

