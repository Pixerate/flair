// flair-metal-hash: 6fb303fe
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
    float uSpacing;
    float uDensity;
    float uMinSize;
    float uMaxSize;
    float uRoundness;
    float uMinOpacity;
    float uMaxOpacity;
    float uTwinkle;
    float uSpeed;
    int uSeed;
    float3 uColor1;
    float3 uColor2;
    float3 uColor3;
    float3 uColor4;
    float4 uClear1;
    float4 uClear2;
    float4 uClear3;
    float4 uClear4;
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_pixel_speckles_frag_out
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
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
bool touches(thread const float4& r, thread const float2& lo, thread const float2& hi)
{
    bool _157 = r.z <= 0.0;
    bool _165;
    if (!_157)
    {
        _165 = r.w <= 0.0;
    }
    else
    {
        _165 = _157;
    }
    if (_165)
    {
        return false;
    }
    bool _177 = lo.x < (r.x + r.z);
    bool _185;
    if (_177)
    {
        _185 = hi.x > r.x;
    }
    else
    {
        _185 = _177;
    }
    bool _196;
    if (_185)
    {
        _196 = lo.y < (r.y + r.w);
    }
    else
    {
        _196 = _185;
    }
    bool _204;
    if (_196)
    {
        _204 = hi.y > r.y;
    }
    else
    {
        _204 = _196;
    }
    return _204;
}

static inline __attribute__((always_inline))
float3 speckleTint(thread const float& t, constant FlairUniforms& _117)
{
    float s = fast::clamp(t, 0.0, 1.0) * 3.0;
    if (s < 1.0)
    {
        return mix(_117.uColor1, _117.uColor2, float3(s));
    }
    if (s < 2.0)
    {
        return mix(_117.uColor2, _117.uColor3, float3(s - 1.0));
    }
    return mix(_117.uColor3, _117.uColor4, float3(s - 2.0));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _117)
{
    float px = 1.0 / _117.iResolution[1u];
    float aspect = _117.iResolution[0u] / _117.iResolution[1u];
    float2 p = float2(fragCoord.x, _117.iResolution[1u] - fragCoord.y) * px;
    float cell = fast::max(_117.uSpacing, 0.00999999977648258209228515625);
    float2 id = floor(p / float2(cell));
    float2 seed = id + float2(float(_117.uSeed) * 7.309999942779541015625, float(_117.uSeed) * 3.1700000762939453125);
    float a = 0.0;
    float3 col = _117.uColor1;
    float2 param = seed + float2(0.5);
    if (hash12(param) < _117.uDensity)
    {
        float2 param_1 = seed + float2(11.30000019073486328125);
        float2 r1 = hash22(param_1);
        float2 param_2 = seed + float2(23.8999996185302734375);
        float2 r2 = hash22(param_2);
        float2 param_3 = seed + float2(37.09999847412109375);
        float2 r3 = hash22(param_3);
        float side = fast::min(mix(_117.uMinSize, fast::max(_117.uMaxSize, _117.uMinSize), r2.x), 0.5 * cell);
        float2 centre = ((id + float2(0.25)) + (r1 * 0.5)) * cell;
        float2 lo = (centre - float2(side)) / float2(aspect, 1.0);
        float2 hi = (centre + float2(side)) / float2(aspect, 1.0);
        bool _341 = lo.x >= 0.0;
        bool _347;
        if (_341)
        {
            _347 = lo.y >= 0.0;
        }
        else
        {
            _347 = _341;
        }
        bool _353;
        if (_347)
        {
            _353 = hi.x <= 1.0;
        }
        else
        {
            _353 = _347;
        }
        bool _359;
        if (_353)
        {
            _359 = hi.y <= 1.0;
        }
        else
        {
            _359 = _353;
        }
        bool _373;
        if (_359)
        {
            float4 param_4 = _117.uClear1;
            float2 param_5 = lo;
            float2 param_6 = hi;
            _373 = !touches(param_4, param_5, param_6);
        }
        else
        {
            _373 = _359;
        }
        bool _386;
        if (_373)
        {
            float4 param_7 = _117.uClear2;
            float2 param_8 = lo;
            float2 param_9 = hi;
            _386 = !touches(param_7, param_8, param_9);
        }
        else
        {
            _386 = _373;
        }
        bool _399;
        if (_386)
        {
            float4 param_10 = _117.uClear3;
            float2 param_11 = lo;
            float2 param_12 = hi;
            _399 = !touches(param_10, param_11, param_12);
        }
        else
        {
            _399 = _386;
        }
        bool _412;
        if (_399)
        {
            float4 param_13 = _117.uClear4;
            float2 param_14 = lo;
            float2 param_15 = hi;
            _412 = !touches(param_13, param_14, param_15);
        }
        else
        {
            _412 = _399;
        }
        bool clear = _412;
        if (clear)
        {
            float radius = fast::clamp(_117.uRoundness, 0.0, 0.5) * side;
            float2 d = abs(p - centre) - float2((0.5 * side) - radius);
            float dist = (length(fast::max(d, float2(0.0))) + fast::min(fast::max(d.x, d.y), 0.0)) - radius;
            float cover = fast::clamp(0.5 - (dist / px), 0.0, 1.0);
            float cycles = 2.0 + floor(r3.x * 5.0);
            float twinkle = (1.0 - _117.uTwinkle) + (_117.uTwinkle * sin(((((_117.iTime * _117.uSpeed) * cycles) * 6.283185482025146484375) / 30.0) + (r3.y * 6.283185482025146484375)));
            a = (cover * mix(_117.uMinOpacity, _117.uMaxOpacity, r2.y)) * fast::clamp(twinkle, 0.0, 1.0);
            float2 param_16 = seed + float2(51.700000762939453125);
            float param_17 = hash12(param_16);
            col = speckleTint(param_17, _117);
        }
    }
    float bgA = _117.uBackgroundAlpha;
    float outA = a + (bgA * (1.0 - a));
    float3 _524;
    if (outA > 0.0)
    {
        _524 = ((col * a) + ((float3(_117.uBackground) * bgA) * (1.0 - a))) / float3(outA);
    }
    else
    {
        _524 = col;
    }
    float3 outC = _524;
    fragColor = float4(outC, outA);
}

fragment flair_pixel_speckles_frag_out flair_pixel_speckles_frag(constant FlairUniforms& _117 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_pixel_speckles_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _563;
    if (_117.flair_flipY > 0.5)
    {
        _563 = _117.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _563 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _563);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _117);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

