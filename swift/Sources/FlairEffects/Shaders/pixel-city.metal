// flair-metal-hash: c63c8f22
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
    float uLit;
    float uStars;
    uint uTraffic;
    float3 uSkyTop;
    float3 uSkyBottom;
    float3 uFar;
    float3 uMid;
    float3 uNear;
    float3 uWindow;
};

struct flair_pixel_city_frag_out
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
    float _98 = bayer2(param);
    float2 param_1 = a;
    float _103 = bayer2(param_1);
    return (_98 * 0.25) + _103;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
bool tower(thread const float& x, thread const float& y, thread const float& w, thread const float& layer, thread const float& lo, thread const float& hi, thread const float& ground, thread const float& rows, thread float4& info)
{
    float slot = floor(x / w);
    float lx = x - (slot * w);
    float2 param = float2(slot, layer + 5.0);
    float width = (w - 1.0) - floor(hash12(param) * 3.0);
    float2 param_1 = float2(slot, layer);
    float h = ground + floor(rows * mix(lo, hi, hash12(param_1)));
    info = float4(slot, lx, width, h);
    return (lx < width) && (y < h);
}

static inline __attribute__((always_inline))
bool lit(thread const float3& id, constant FlairUniforms& _171)
{
    float2 param = id.xy + float2(id.z * 7.69999980926513671875);
    float clock = floor((_171.iTime * 0.4000000059604644775390625) + (hash12(param) * 10.0));
    float2 param_1 = (id.xy * 1.2999999523162841796875) + float2(id.z, clock);
    return hash12(param_1) < _171.uLit;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _171)
{
    float2 cell = floor(fragCoord / float2(_171.uPixel));
    float rows = fast::max(floor(_171.iResolution[1u] / _171.uPixel), 1.0);
    float cols = fast::max(floor(_171.iResolution[0u] / _171.uPixel), 1.0);
    float t = _171.iTime * _171.uSpeed;
    float y = cell.y;
    float sy = y / rows;
    float ground = fast::max(3.0, floor(rows * 0.0599999986588954925537109375));
    float2 param = cell;
    float band = fast::clamp(floor((sy * 8.0) + ((bayer4(param) - 0.5) * 0.89999997615814208984375)), 0.0, 7.0) / 7.0;
    float3 col = mix(_171.uSkyBottom, _171.uSkyTop, float3(band));
    bool _283 = sy > 0.3499999940395355224609375;
    bool _296;
    if (_283)
    {
        float2 param_1 = cell;
        _296 = hash12(param_1) > (1.0 - (0.0199999995529651641845703125 * _171.uStars));
    }
    else
    {
        _296 = _283;
    }
    if (_296)
    {
        float2 param_2 = cell + float2(floor(_171.iTime * 1.5));
        col = mix(col, float3(1.0), float3(0.449999988079071044921875 + (0.550000011920928955078125 * step(0.5, hash12(param_2)))));
    }
    float2 moon = floor(float2(cols * 0.800000011920928955078125, rows * 0.800000011920928955078125));
    float r = fast::max(3.0, floor(rows * 0.070000000298023223876953125));
    float2 dm = cell - moon;
    float2 bite = dm - float2(floor(r * 0.60000002384185791015625), floor(r * 0.300000011920928955078125));
    bool _356 = dot(dm, dm) <= ((r * r) + r);
    bool _366;
    if (_356)
    {
        _366 = dot(bite, bite) > (r * r);
    }
    else
    {
        _366 = _356;
    }
    if (_366)
    {
        col = float3(0.980000019073486328125, 0.939999997615814208984375, 0.800000011920928955078125);
    }
    float fx = cell.x + floor(t * 2.0);
    float param_3 = fx;
    float param_4 = y;
    float param_5 = 9.0;
    float param_6 = 1.0;
    float param_7 = 0.25;
    float param_8 = 0.550000011920928955078125;
    float param_9 = ground;
    float param_10 = rows;
    float4 param_11;
    bool _394 = tower(param_3, param_4, param_5, param_6, param_7, param_8, param_9, param_10, param_11);
    float4 info = param_11;
    if (_394)
    {
        col = _171.uFar;
        bool _404 = mod(info.y, 2.0) == 1.0;
        bool _410;
        if (_404)
        {
            _410 = mod(y, 2.0) == 0.0;
        }
        else
        {
            _410 = _404;
        }
        bool _421;
        if (_410)
        {
            float3 param_12 = float3(info.x, info.y, y);
            _421 = lit(param_12, _171);
        }
        else
        {
            _421 = _410;
        }
        bool _435;
        if (_421)
        {
            float2 param_13 = float2(info.y, y) + float2(info.x);
            _435 = hash12(param_13) < 0.300000011920928955078125;
        }
        else
        {
            _435 = _421;
        }
        if (_435)
        {
            col = mix(_171.uFar, _171.uWindow, float3(0.550000011920928955078125));
        }
    }
    float mx = cell.x + floor(t * 5.0);
    float param_14 = mx;
    float param_15 = y;
    float param_16 = 13.0;
    float param_17 = 2.0;
    float param_18 = 0.1500000059604644775390625;
    float param_19 = 0.4199999868869781494140625;
    float param_20 = ground;
    float param_21 = rows;
    float4 param_22;
    bool _468 = tower(param_14, param_15, param_16, param_17, param_18, param_19, param_20, param_21, param_22);
    info = param_22;
    if (_468)
    {
        col = _171.uMid;
        bool _479 = info.y >= 1.0;
        bool _488;
        if (_479)
        {
            _488 = info.y <= (info.z - 2.0);
        }
        else
        {
            _488 = _479;
        }
        bool _495;
        if (_488)
        {
            _495 = y >= (ground + 2.0);
        }
        else
        {
            _495 = _488;
        }
        bool _504;
        if (_495)
        {
            _504 = y <= (info.w - 3.0);
        }
        else
        {
            _504 = _495;
        }
        bool inside = _504;
        bool _512;
        if (inside)
        {
            _512 = mod(info.y, 2.0) == 1.0;
        }
        else
        {
            _512 = inside;
        }
        bool _521;
        if (_512)
        {
            _521 = mod((y - ground) - 2.0, 3.0) < 2.0;
        }
        else
        {
            _521 = _512;
        }
        bool _538;
        if (_521)
        {
            float3 param_23 = float3(info.x * 3.099999904632568359375, info.y, floor((y - ground) / 3.0));
            _538 = lit(param_23, _171);
        }
        else
        {
            _538 = _521;
        }
        if (_538)
        {
            col = _171.uWindow * 0.85000002384185791015625;
        }
    }
    float nx = cell.x + floor(t * 10.0);
    float param_24 = nx;
    float param_25 = y;
    float param_26 = 18.0;
    float param_27 = 3.0;
    float param_28 = 0.07999999821186065673828125;
    float param_29 = 0.300000011920928955078125;
    float param_30 = ground;
    float param_31 = rows;
    float4 param_32;
    bool _568 = tower(param_24, param_25, param_26, param_27, param_28, param_29, param_30, param_31, param_32);
    info = param_32;
    bool near = _568;
    float aerial = floor(info.z * 0.5);
    float2 param_33 = float2(info.x, 11.0);
    bool hasAerial = hash12(param_33) > 0.550000011920928955078125;
    if (near)
    {
        col = _171.uNear;
        float2 w = float2(info.y - 1.0, (y - ground) - 2.0);
        float2 wc = floor(w / float2(3.0));
        bool _606 = info.y >= 1.0;
        bool _615;
        if (_606)
        {
            _615 = info.y <= (info.z - 2.0);
        }
        else
        {
            _615 = _606;
        }
        bool _622;
        if (_615)
        {
            _622 = y >= (ground + 2.0);
        }
        else
        {
            _622 = _615;
        }
        bool _630;
        if (_622)
        {
            _630 = y <= (info.w - 3.0);
        }
        else
        {
            _630 = _622;
        }
        bool inside_1 = _630;
        bool _638;
        if (inside_1)
        {
            _638 = mod(w.x, 3.0) < 2.0;
        }
        else
        {
            _638 = inside_1;
        }
        bool _645;
        if (_638)
        {
            _645 = mod(w.y, 3.0) < 2.0;
        }
        else
        {
            _645 = _638;
        }
        bool _660;
        if (_645)
        {
            float3 param_34 = float3((info.x * 5.30000019073486328125) + wc.x, wc.y, 3.0);
            _660 = lit(param_34, _171);
        }
        else
        {
            _660 = _645;
        }
        if (_660)
        {
            float2 param_35 = wc + float2(info.x);
            float3 _672;
            if (hash12(param_35) < 0.20000000298023223876953125)
            {
                _672 = mix(_171.uWindow, float3(0.60000002384185791015625, 0.85000002384185791015625, 1.0), float3(0.699999988079071044921875));
            }
            else
            {
                _672 = _171.uWindow;
            }
            col = _672;
        }
    }
    else
    {
        bool _693;
        if (hasAerial)
        {
            _693 = info.y == aerial;
        }
        else
        {
            _693 = hasAerial;
        }
        bool _700;
        if (_693)
        {
            _700 = y >= info.w;
        }
        else
        {
            _700 = _693;
        }
        bool _708;
        if (_700)
        {
            _708 = y < (info.w + 5.0);
        }
        else
        {
            _708 = _700;
        }
        if (_708)
        {
            col = _171.uNear;
            bool _718 = y == (info.w + 4.0);
            bool _733;
            if (_718)
            {
                float2 param_36 = float2(info.x, 12.0);
                _733 = fract((_171.iTime * 0.800000011920928955078125) + hash12(param_36)) < 0.5;
            }
            else
            {
                _733 = _718;
            }
            if (_733)
            {
                col = float3(1.0, 0.20000000298023223876953125, 0.1500000059604644775390625);
            }
        }
    }
    if (y < ground)
    {
        col = _171.uNear * 0.60000002384185791015625;
        if ((_171.uTraffic != 0u) && (y == 2.0))
        {
            float x = cell.x + floor((t * 16.0) + (_171.iTime * 8.0));
            bool _770 = mod(x, 23.0) < 2.0;
            bool _780;
            if (_770)
            {
                float2 param_37 = float2(floor(x / 23.0), 1.0);
                _780 = hash12(param_37) > 0.4000000059604644775390625;
            }
            else
            {
                _780 = _770;
            }
            if (_780)
            {
                col = float3(1.0, 0.1500000059604644775390625, 0.100000001490116119384765625);
            }
        }
        if ((_171.uTraffic != 0u) && (y == 1.0))
        {
            float x_1 = (cell.x - floor(_171.iTime * 14.0)) + floor(t * 10.0);
            bool _809 = mod(x_1, 29.0) < 2.0;
            bool _819;
            if (_809)
            {
                float2 param_38 = float2(floor(x_1 / 29.0), 2.0);
                _819 = hash12(param_38) > 0.4000000059604644775390625;
            }
            else
            {
                _819 = _809;
            }
            if (_819)
            {
                col = float3(1.0, 0.949999988079071044921875, 0.699999988079071044921875);
            }
        }
    }
    fragColor = float4(col, 1.0);
}

fragment flair_pixel_city_frag_out flair_pixel_city_frag(constant FlairUniforms& _171 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_pixel_city_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _841;
    if (_171.flair_flipY > 0.5)
    {
        _841 = _171.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _841 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _841);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _171);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

