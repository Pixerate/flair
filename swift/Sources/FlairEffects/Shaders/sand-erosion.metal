// flair-metal-hash: 2d942c1f
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
    float3 uSand;
    packed_float3 uShade;
    float uWind;
    float uTurbulence;
    float uGrain;
    float uSize;
    uint uFromRight;
    packed_float3 uBackground;
    float uBackgroundAlpha;
    uint uAnimate;
    float uProgress;
};

struct flair_sand_erosion_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float mask(thread const float2& p, thread float& shapeW, thread float& shapeH, thread float2& origin, texture2d<float> uMask, sampler uMaskSmplr)
{
    float2 uv = (p - origin) / float2(shapeW, shapeH);
    bool _233 = uv.x < 0.0;
    bool _240;
    if (!_233)
    {
        _240 = uv.x > 1.0;
    }
    else
    {
        _240 = _233;
    }
    bool _247;
    if (!_240)
    {
        _247 = uv.y < 0.0;
    }
    else
    {
        _247 = _240;
    }
    bool _254;
    if (!_247)
    {
        _254 = uv.y > 1.0;
    }
    else
    {
        _254 = _247;
    }
    if (_254)
    {
        return 0.0;
    }
    return uMask.sample(uMaskSmplr, uv).w;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float batchOf(thread const float2& s, thread float& shapeW, thread float2& origin, constant FlairUniforms& _285)
{
    float x = (s.x - origin.x) / shapeW;
    if (_285.uFromRight != 0u)
    {
        x = 1.0 - x;
    }
    float2 param = s * 9.0;
    float2 param_1 = s * 40.0;
    float t = ((0.449999988079071044921875 + (1.5 * x)) + (0.5 * (vnoise(param) - 0.5))) + (0.1500000059604644775390625 * (vnoise(param_1) - 0.5));
    return floor(t / 0.07500000298023223876953125);
}

static inline __attribute__((always_inline))
float3 _packed(thread const float2& p, thread const float& light, constant FlairUniforms& _285)
{
    float2 param = floor(p / float2(_285.uGrain * 0.449999988079071044921875));
    float speck = hash12(param);
    float2 param_1 = p * 30.0;
    float tone = vnoise(param_1);
    return mix(float3(_285.uShade), _285.uSand, float3(fast::clamp(light * ((0.699999988079071044921875 + (0.25 * speck)) + (0.20000000298023223876953125 * tone)), 0.0, 1.0)));
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float2 blown(thread const float& a, thread const float2& s, thread float& dirX, constant FlairUniforms& _285)
{
    float2 param = (s * 6.0) + float2(a * 1.2999999523162841796875, 0.0);
    float n1 = vnoise(param) - 0.5;
    float2 param_1 = (s * 6.0) + float2(7.69999980926513671875, a * 1.10000002384185791015625);
    float n2 = vnoise(param_1) - 0.5;
    float2 d = float2((dirX * _285.uWind) * ((0.1500000059604644775390625 * a) + ((0.550000011920928955078125 * a) * a)), (0.0500000007450580596923828125 * a) + ((0.02999999932944774627685546875 * a) * a));
    return d + (float2(0.07999999821186065673828125 * n1, 0.2199999988079071044921875 * n2) * (_285.uTurbulence * a));
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float3 sand(thread const float2& cell, thread const float& light, constant FlairUniforms& _285)
{
    float2 param = cell + float2(0.5);
    float2 h = hash22(param);
    return mix(float3(_285.uShade), _285.uSand, float3(fast::clamp(light * (0.64999997615814208984375 + (0.449999988079071044921875 * h.x)), 0.0, 1.0))) * (0.89999997615814208984375 + (0.20000000298023223876953125 * h.y));
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, thread float& shapeW, thread float& shapeH, thread float2& origin, thread float& dirX, texture2d<float> uMask, sampler uMaskSmplr, constant FlairUniforms& _285)
{
    float2 p = (fragCoord - (float2(_285.iResolution[0], _285.iResolution[1]) * 0.5)) / float2(_285.iResolution[1u]);
    float px = 1.0 / _285.iResolution[1u];
    float2 size = float2(int2(uMask.get_width(), uMask.get_height()));
    float aspect = size.x / fast::max(size.y, 1.0);
    shapeH = fast::min(_285.uSize * 0.60000002384185791015625, (((_285.iResolution[0u] / _285.iResolution[1u]) * _285.uSize) * 0.800000011920928955078125) / aspect);
    shapeW = shapeH * aspect;
    origin = float2((-0.5) * shapeW, (-0.5) * shapeH);
    dirX = (_285.uFromRight != 0u) ? (-1.0) : 1.0;
    float _526;
    if (_285.uAnimate != 0u)
    {
        _526 = 4.0 - abs(mod(_285.iTime, 8.0) - 4.0);
    }
    else
    {
        _526 = _285.uProgress * 4.0;
    }
    float e = _526;
    float now = floor(e / 0.07500000298023223876953125);
    float4 acc = float4(float3(_285.uBackground) * _285.uBackgroundAlpha, _285.uBackgroundAlpha);
    float2 param = p;
    float m = mask(param, shapeW, shapeH, origin, uMask, uMaskSmplr);
    if (m > 0.0)
    {
        float2 param_1 = p;
        float left = (batchOf(param_1, shapeW, origin, _285) - now) * 0.07500000298023223876953125;
        if (left > 0.0)
        {
            float e2 = 0.006000000052154064178466796875;
            float2 param_2 = p + float2(-e2, e2);
            float2 param_3 = p + float2(e2, -e2);
            float lit = 0.60000002384185791015625 + (0.4000000059604644775390625 * fast::clamp(((mask(param_2, shapeW, shapeH, origin, uMask, uMaskSmplr) - mask(param_3, shapeW, shapeH, origin, uMask, uMaskSmplr)) * 2.0) + 0.5, 0.0, 1.0));
            float loose = smoothstep(0.300000011920928955078125, 0.0, left);
            float2 param_4 = floor(p / float2(_285.uGrain * 0.5)) + float2(3.099999904632568359375);
            float keep = step(loose * 0.699999988079071044921875, hash12(param_4));
            float2 param_5 = p;
            float param_6 = lit;
            float4 param_7 = acc;
            float3 param_8 = _packed(param_5, param_6, _285);
            float param_9 = m * keep;
            acc = over(param_7, param_8, param_9);
        }
    }
    if (e > 0.20000000298023223876953125)
    {
        for (int k = 23; k >= 0; k--)
        {
            float b = now - float(k);
            float a = e - (b * 0.07500000298023223876953125);
            if ((a < 0.0) || (a > 1.7999999523162841796875))
            {
                continue;
            }
            float2 from = ((p - float2((dirX * _285.uWind) * ((0.1500000059604644775390625 * a) + ((0.550000011920928955078125 * a) * a)), (0.0500000007450580596923828125 * a) + ((0.02999999932944774627685546875 * a) * a))) - origin) / float2(shapeW, shapeH);
            float2 sway = ((float2(0.039999999105930328369140625, 0.10999999940395355224609375) * (_285.uTurbulence * a)) / float2(shapeW, shapeH)) + float2(0.001000000047497451305389404296875);
            if (_285.uFromRight != 0u)
            {
                from.x = 1.0 - from.x;
            }
            float slabLo = fast::max(((b * 0.07500000298023223876953125) - 0.77499997615814208984375) / 1.5, 0.0);
            float slabHi = fast::min((((b + 1.0) * 0.07500000298023223876953125) - 0.125) / 1.5, 1.0);
            bool _746 = (from.x + sway.x) < slabLo;
            bool _757;
            if (!_746)
            {
                _757 = (from.x - sway.x) > slabHi;
            }
            else
            {
                _757 = _746;
            }
            bool _767;
            if (!_757)
            {
                _767 = (from.y + sway.y) < 0.0;
            }
            else
            {
                _767 = _757;
            }
            bool _777;
            if (!_767)
            {
                _777 = (from.y - sway.y) > 1.0;
            }
            else
            {
                _777 = _767;
            }
            if (_777)
            {
                continue;
            }
            float param_10 = a;
            float2 param_11 = p;
            float2 s = p - blown(param_10, param_11, dirX, _285);
            float param_12 = a;
            float2 param_13 = s;
            s = p - blown(param_12, param_13, dirX, _285);
            float param_14 = a;
            float2 param_15 = s;
            s = p - blown(param_14, param_15, dirX, _285);
            float2 param_16 = s;
            if (batchOf(param_16, shapeW, origin, _285) != b)
            {
                continue;
            }
            float2 param_17 = s;
            float ms = mask(param_17, shapeW, shapeH, origin, uMask, uMaskSmplr);
            if (ms < 0.300000011920928955078125)
            {
                continue;
            }
            float2 g = s / float2(_285.uGrain);
            float2 cell = floor(g);
            float2 param_18 = cell + float2(9.69999980926513671875);
            float2 h = hash22(param_18);
            if (h.x < 0.300000011920928955078125)
            {
                continue;
            }
            float rad = (0.25 + (0.25 * h.y)) * (1.0 - ((0.4000000059604644775390625 * a) / 1.7999999523162841796875));
            float2 param_19 = cell + float2(2.2999999523162841796875);
            float d = length((fract(g) - float2(0.5)) - ((hash22(param_19) - float2(0.5)) * 0.4000000059604644775390625));
            float grain = smoothstep(rad, rad - fast::max(px / _285.uGrain, 0.1500000059604644775390625), d);
            float fade = 1.0 - smoothstep(0.89999997615814208984375, 1.7999999523162841796875, a);
            float2 param_20 = cell;
            float param_21 = 0.89999997615814208984375;
            float4 param_22 = acc;
            float3 param_23 = sand(param_20, param_21, _285);
            float param_24 = (fast::max(grain, 0.2199999988079071044921875) * fade) * ms;
            acc = over(param_22, param_23, param_24);
        }
    }
    float4 param_25 = acc;
    fragColor = unpremultiply(param_25);
}

fragment flair_sand_erosion_frag_out flair_sand_erosion_frag(constant FlairUniforms& _285 [[buffer(0)]], texture2d<float> uMask [[texture(1)]], sampler uMaskSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_sand_erosion_frag_out out = {};
    float shapeW = 1.0;
    float shapeH = 0.300000011920928955078125;
    float2 origin = float2(0.0);
    float dirX = 1.0;
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _915;
    if (_285.flair_flipY > 0.5)
    {
        _915 = _285.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _915 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _915);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, shapeW, shapeH, origin, dirX, uMask, uMaskSmplr, _285);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

