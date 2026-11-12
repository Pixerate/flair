// flair-metal-hash: c1a11a6d
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
    float uSpeed;
    float3 uSkyTop;
    float3 uSkyBottom;
    float3 uSun;
    float3 uCloud;
    float3 uFar;
    float3 uMid;
    packed_float3 uNear;
    float uStars;
};

struct flair_pixel_landscape_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float bayer2(thread float2& a)
{
    a = floor(a);
    return fract((a.x / 2.0) + ((a.y * a.y) * 0.75));
}

static inline __attribute__((always_inline))
float bayer4(thread const float2& a)
{
    float2 param = a * 0.5;
    float _90 = bayer2(param);
    float2 param_1 = a;
    float _95 = bayer2(param_1);
    return (_90 * 0.25) + _95;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float _noise1(thread const float& x, thread const float& seed)
{
    float i = floor(x);
    float f = fract(x);
    f = (f * f) * (3.0 - (2.0 * f));
    float2 param = float2(i, seed);
    float2 param_1 = float2(i + 1.0, seed);
    return mix(hash12(param), hash12(param_1), f);
}

static inline __attribute__((always_inline))
float mountain(thread const float& x)
{
    float param = x * 0.02999999932944774627685546875;
    float param_1 = 1.0;
    float ridge = 1.0 - abs((2.0 * _noise1(param, param_1)) - 1.0);
    float param_2 = x * 0.10999999940395355224609375;
    float param_3 = 2.0;
    return (ridge * 0.75) + (_noise1(param_2, param_3) * 0.25);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _163)
{
    float2 cell = floor(fragCoord / float2(_163.uPixel));
    float rows = fast::max(floor(_163.iResolution[1u] / _163.uPixel), 1.0);
    float cols = fast::max(floor(_163.iResolution[0u] / _163.uPixel), 1.0);
    float t = _163.iTime * _163.uSpeed;
    float y = cell.y;
    float sy = y / rows;
    float2 param = cell;
    float band = fast::clamp(floor((sy * 6.0) + ((bayer4(param) - 0.5) * 0.89999997615814208984375)), 0.0, 5.0) / 5.0;
    float3 col = mix(_163.uSkyBottom, _163.uSkyTop, float3(band));
    float2 param_1 = cell;
    float star = hash12(param_1);
    bool _237 = sy > 0.4000000059604644775390625;
    bool _248;
    if (_237)
    {
        _248 = star > (1.0 - (0.014999999664723873138427734375 * _163.uStars));
    }
    else
    {
        _248 = _237;
    }
    if (_248)
    {
        float2 param_2 = cell + float2(floor(_163.iTime * 2.0));
        col = mix(col, float3(1.0), float3(0.5 + (0.5 * step(0.5, hash12(param_2)))));
    }
    float2 sun = floor(float2(cols * 0.699999988079071044921875, rows * 0.699999988079071044921875));
    float r = fast::max(3.0, floor(rows * 0.100000001490116119384765625));
    float2 d = cell - sun;
    float dd = dot(d, d);
    bool _297 = dd <= (((r + 2.0) * (r + 2.0)) + r);
    bool _307;
    if (_297)
    {
        _307 = mod(cell.x + cell.y, 2.0) < 1.0;
    }
    else
    {
        _307 = _297;
    }
    if (_307)
    {
        col = mix(col, _163.uSun, float3(0.449999988079071044921875));
    }
    if (dd <= ((r * r) + r))
    {
        col = _163.uSun;
    }
    float cx = cell.x + floor(t * 2.0);
    float param_3 = floor(cx / 40.0);
    float param_4 = 9.0;
    float base = floor((rows * 0.7599999904632568359375) + (3.0 * _noise1(param_3, param_4)));
    float param_5 = cx * 0.04500000178813934326171875;
    float param_6 = 4.0;
    float param_7 = cx * 0.1599999964237213134765625;
    float param_8 = 5.0;
    float puff = (((fast::max(0.0, _noise1(param_5, param_6) - 0.4199999868869781494140625) * 2.400000095367431640625) * rows) * 0.119999997317790985107421875) + ((fast::max(0.0, _noise1(param_7, param_8) - 0.5) * rows) * 0.0500000007450580596923828125);
    bool _382 = y >= base;
    bool _391;
    if (_382)
    {
        _391 = y < (base + floor(puff));
    }
    else
    {
        _391 = _382;
    }
    if (_391)
    {
        float3 _398;
        if (y < (base + 1.0))
        {
            _398 = mix(_163.uCloud, _163.uSkyTop, float3(0.25));
        }
        else
        {
            _398 = _163.uCloud;
        }
        col = _398;
    }
    float mx = cell.x + floor(t * 4.0);
    float param_9 = mx;
    float mh = floor(rows * (0.300000011920928955078125 + (0.319999992847442626953125 * mountain(param_9))));
    if (y <= mh)
    {
        float param_10 = mx + 2.0;
        float param_11 = mx - 2.0;
        float slope = mountain(param_10) - mountain(param_11);
        float3 _447;
        if (slope < 0.0)
        {
            _447 = _163.uFar * 0.819999992847442626953125;
        }
        else
        {
            _447 = _163.uFar;
        }
        col = _447;
        bool _463 = mh > (rows * 0.519999980926513671875);
        bool _473;
        if (_463)
        {
            _473 = y > ((mh - 3.0) - mod(mx, 2.0));
        }
        else
        {
            _473 = _463;
        }
        if (_473)
        {
            col = mix(_163.uFar, float3(1.0), float3(0.75));
        }
    }
    float hx = cell.x + floor(t * 9.0);
    float param_12 = hx * 0.0900000035762786865234375;
    float param_13 = 6.0;
    float hh = floor(rows * ((0.23999999463558197021484375 + (0.0599999986588954925537109375 * sin(hx * 0.04500000178813934326171875))) + (0.039999999105930328369140625 * _noise1(param_12, param_13))));
    if (y <= hh)
    {
        float3 _516;
        if (y > (hh - 1.0))
        {
            _516 = mix(_163.uMid, float3(1.0), float3(0.20000000298023223876953125));
        }
        else
        {
            _516 = _163.uMid;
        }
        col = _516;
    }
    float nx = cell.x + floor(t * 18.0);
    float nh = floor(rows * (0.100000001490116119384765625 + (0.0199999995529651641845703125 * sin(nx * 0.07999999821186065673828125))));
    float slot = floor(nx / 14.0);
    float lx = abs(mod(nx, 14.0) - 7.0);
    float2 param_14 = float2(slot, 3.0);
    float treeH = floor(rows * (0.07999999821186065673828125 + (0.07999999821186065673828125 * hash12(param_14))));
    float2 param_15 = float2(slot, 7.0);
    bool _580 = (hash12(param_15) > 0.3499999940395355224609375) && (y > nh);
    bool _588;
    if (_580)
    {
        _588 = y <= (nh + treeH);
    }
    else
    {
        _588 = _580;
    }
    bool _601;
    if (_588)
    {
        _601 = lx <= floor(((nh + treeH) - y) / 2.5);
    }
    else
    {
        _601 = _588;
    }
    bool tree = _601;
    if ((y <= nh) || tree)
    {
        float3 _610;
        if (tree)
        {
            _610 = float3(_163.uNear) * 0.800000011920928955078125;
        }
        else
        {
            _610 = float3(_163.uNear);
        }
        col = _610;
    }
    bool _627 = (!tree) && (y <= nh);
    bool _634;
    if (_627)
    {
        _634 = y > (nh - 1.0);
    }
    else
    {
        _634 = _627;
    }
    if (_634)
    {
        col = mix(float3(_163.uNear), _163.uMid, float3(0.5));
    }
    fragColor = float4(col, 1.0);
}

fragment flair_pixel_landscape_frag_out flair_pixel_landscape_frag(constant FlairUniforms& _163 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_pixel_landscape_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _660;
    if (_163.flair_flipY > 0.5)
    {
        _660 = _163.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _660 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _660);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _163);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

