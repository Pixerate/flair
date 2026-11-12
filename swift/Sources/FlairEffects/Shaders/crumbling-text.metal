// flair-metal-hash: 79bfc8c9
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
    float3 uColor;
    packed_float3 uDust;
    float uChunk;
    float uSize;
    float uGravity;
    uint uFromRight;
    char _m19_pad[4];
    packed_float3 uBackground;
    float uBackgroundAlpha;
    uint uAnimate;
    float uProgress;
};

struct flair_crumbling_text_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float mask(thread const float2& p, thread float& textW, thread float& textH, thread float2& origin, texture2d<float> uText, sampler uTextSmplr)
{
    float2 uv = (p - origin) / float2(textW, textH);
    bool _283 = uv.x < 0.0;
    bool _290;
    if (!_283)
    {
        _290 = uv.x > 1.0;
    }
    else
    {
        _290 = _283;
    }
    bool _297;
    if (!_290)
    {
        _297 = uv.y < 0.0;
    }
    else
    {
        _297 = _290;
    }
    bool _304;
    if (!_297)
    {
        _304 = uv.y > 1.0;
    }
    else
    {
        _304 = _297;
    }
    if (_304)
    {
        return 0.0;
    }
    return uText.sample(uTextSmplr, uv).w;
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
float2 warped(thread const float2& p, thread float2& origin, thread float& cs)
{
    float2 g = (p - origin) / float2(cs);
    float2 param = (g * 1.10000002384185791015625) + float2(3.7000000476837158203125);
    float2 param_1 = (g * 1.10000002384185791015625) + float2(9.19999980926513671875);
    return g + ((float2(vnoise(param), vnoise(param_1)) - float2(0.5)) * 0.63999998569488525390625);
}

static inline __attribute__((always_inline))
float side(thread const float& x, thread float& textW, thread float2& origin, constant FlairUniforms& _334)
{
    float s = (x - origin.x) / textW;
    float _340;
    if (_334.uFromRight != 0u)
    {
        _340 = 1.0 - s;
    }
    else
    {
        _340 = s;
    }
    return _340;
}

static inline __attribute__((always_inline))
float breakTime(thread const float2& id, thread float& textW, thread float2& origin, thread float& cs, constant FlairUniforms& _334)
{
    float param = origin.x + ((id.x + 0.5) * cs);
    float2 param_1 = id + float2(2.2999999523162841796875);
    return (0.699999988079071044921875 + (3.2999999523162841796875 * fast::clamp(side(param, textW, origin, _334), 0.0, 1.0))) + (0.449999988079071044921875 * hash12(param_1));
}

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float3 stone(thread const float2& q, thread const float& ang, thread float& textW, thread float& textH, thread float2& origin, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _334)
{
    float e = 0.0040000001899898052215576171875;
    float2 param = q + float2(e, 0.0);
    float2 param_1 = q - float2(e, 0.0);
    float2 param_2 = q + float2(0.0, e);
    float2 param_3 = q - float2(0.0, e);
    float2 g = float2(mask(param, textW, textH, origin, uText, uTextSmplr) - mask(param_1, textW, textH, origin, uText, uTextSmplr), mask(param_2, textW, textH, origin, uText, uTextSmplr) - mask(param_3, textW, textH, origin, uText, uTextSmplr));
    float param_4 = ang;
    float3 n = fast::normalize(float3((-(rot(param_4) * g)) * 0.800000011920928955078125, 1.0));
    float diff = fast::clamp(dot(n, float3(-0.4920678436756134033203125, 0.59048140048980712890625, 0.639688193798065185546875)), 0.0, 1.0);
    float2 param_5 = q * 140.0;
    float2 param_6 = q * 35.0;
    float grit = (0.60000002384185791015625 * vnoise(param_5)) + (0.4000000059604644775390625 * vnoise(param_6));
    return (_334.uColor * (0.449999988079071044921875 + (0.699999988079071044921875 * diff))) * (0.800000011920928955078125 + (0.3499999940395355224609375 * grit));
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float2 ballistic(thread const float2& v, thread const float& k, thread const float& g, thread const float& t)
{
    float e = (1.0 - exp((-k) * t)) / k;
    return (v * e) - float2(0.0, (g / k) * (t - e));
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, thread float& textW, thread float& textH, thread float2& origin, thread float& cs, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _334)
{
    float2 p = (fragCoord - (float2(_334.iResolution[0], _334.iResolution[1]) * 0.5)) / float2(_334.iResolution[1u]);
    float px = 1.0 / _334.iResolution[1u];
    float2 size = float2(int2(uText.get_width(), uText.get_height()));
    float aspect = size.x / fast::max(size.y, 1.0);
    textH = fast::min(_334.uSize * 0.5, ((_334.iResolution[0u] / _334.iResolution[1u]) * _334.uSize) / aspect);
    textW = textH * aspect;
    origin = float2((-0.5) * textW, 0.100000001490116119384765625 - (0.5 * textH));
    cs = textH / _334.uChunk;
    float dirX = (_334.uFromRight != 0u) ? (-1.0) : 1.0;
    float _562;
    if (_334.uAnimate != 0u)
    {
        _562 = mod(_334.iTime, 8.0);
    }
    else
    {
        _562 = _334.uProgress * 8.0;
    }
    float tt = _562;
    float4 acc = float4(float3(_334.uBackground) * _334.uBackgroundAlpha, _334.uBackgroundAlpha);
    float2 param = p;
    float m = mask(param, textW, textH, origin, uText, uTextSmplr);
    if (m > 0.0)
    {
        float2 param_1 = p;
        float2 w = warped(param_1, origin, cs);
        float2 param_2 = floor(w);
        float td = breakTime(param_2, textW, origin, cs, _334);
        float param_3 = p.x;
        float tb = 6.0 + (1.2999999523162841796875 * side(param_3, textW, origin, _334));
        float2 param_4 = floor(p / float2(cs * 0.119999997317790985107421875));
        float grain = hash12(param_4);
        float _630;
        if (tt < td)
        {
            _630 = 1.0;
        }
        else
        {
            _630 = step(grain, smoothstep(tb, tb + 0.60000002384185791015625, tt));
        }
        float vis = _630;
        if (vis > 0.0)
        {
            float2 f = fract(w);
            float edge = fast::min(fast::min(f.x, 1.0 - f.x), fast::min(f.y, 1.0 - f.y)) * cs;
            float warn = smoothstep(td - 0.60000002384185791015625, td, tt) * step(tt, td);
            float2 param_5 = p;
            float param_6 = 0.0;
            float3 c = stone(param_5, param_6, textW, textH, origin, uText, uTextSmplr, _334) * (1.0 - ((0.75 * warn) * smoothstep(px * 2.0, 0.0, edge)));
            float4 param_7 = acc;
            float3 param_8 = c;
            float param_9 = m * vis;
            acc = over(param_7, param_8, param_9);
        }
    }
    float dust = 0.0;
    float col0 = floor((p.x - origin.x) / cs);
    float rows = ceil(_334.uChunk);
    for (int k = 0; k < 6; k++)
    {
        float cx = col0 - (dirX * float(k - 2));
        bool _733 = cx < (-1.0);
        bool _744;
        if (!_733)
        {
            _744 = (cx * cs) > (textW + cs);
        }
        else
        {
            _744 = _733;
        }
        if (_744)
        {
            continue;
        }
        for (int r = -1; r < 21; r++)
        {
            if (float(r) > rows)
            {
                break;
            }
            float2 id = float2(cx, float(r));
            float2 param_10 = id;
            float a = tt - breakTime(param_10, textW, origin, cs, _334);
            if ((a <= 0.0) || (a > 1.7999999523162841796875))
            {
                continue;
            }
            float2 param_11 = id + float2(4.099999904632568359375);
            float2 h = hash22(param_11);
            float2 centre = origin + ((id + float2(0.5)) * cs);
            float2 param_12 = float2(dirX * (0.5 + h.x), 0.300000011920928955078125 + (1.2000000476837158203125 * h.y)) * cs;
            float param_13 = 1.5;
            float param_14 = _334.uGravity;
            float param_15 = a;
            float2 off = ballistic(param_12, param_13, param_14, param_15);
            float da = a - 0.3499999940395355224609375;
            if (da > 0.0)
            {
                float2 dc = (centre + (off * 0.75)) + ((float2(dirX * 0.5, 0.300000011920928955078125) * cs) * da);
                float R = cs * (0.5 + (0.800000011920928955078125 * da));
                float dd = length(p - dc) / R;
                bool _857 = dd < 1.0;
                bool _865;
                if (_857)
                {
                    float2 param_16 = centre;
                    _865 = mask(param_16, textW, textH, origin, uText, uTextSmplr) > 0.20000000298023223876953125;
                }
                else
                {
                    _865 = _857;
                }
                if (_865)
                {
                    float2 param_17 = floor((p - dc) / float2(px * 2.5)) + id;
                    float speck = step(0.550000011920928955078125, hash12(param_17));
                    dust += ((((1.0 - dd) * smoothstep(0.0, 0.300000011920928955078125, da)) * (1.0 - smoothstep(0.5, 1.4500000476837158203125, da))) * (0.20000000298023223876953125 + (0.800000011920928955078125 * speck)));
                }
            }
            float2 rel = (p - centre) - off;
            if (length(rel) > (cs * 1.2999999523162841796875))
            {
                continue;
            }
            float ang = ((h.y - 0.5) * 6.0) * a;
            float param_18 = -ang;
            float2 q = centre + (rot(param_18) * rel);
            float2 param_19 = q;
            if (any(floor(warped(param_19, origin, cs)) != id))
            {
                continue;
            }
            float2 param_20 = q;
            float mq = mask(param_20, textW, textH, origin, uText, uTextSmplr);
            if (mq <= 0.0)
            {
                continue;
            }
            float2 param_21 = floor((q - centre) / float2(cs * 0.119999997317790985107421875)) + (id * 7.0);
            float bits = hash12(param_21);
            float cover = mq * step(smoothstep(0.3499999940395355224609375, 1.7999999523162841796875, a), bits);
            if (cover <= 0.0)
            {
                continue;
            }
            float2 param_22 = q;
            float param_23 = ang;
            float4 param_24 = acc;
            float3 param_25 = stone(param_22, param_23, textW, textH, origin, uText, uTextSmplr, _334) * 0.920000016689300537109375;
            float param_26 = cover;
            acc = over(param_24, param_25, param_26);
        }
    }
    float4 param_27 = acc;
    float3 param_28 = float3(_334.uDust);
    float param_29 = fast::clamp(dust * 0.699999988079071044921875, 0.0, 0.85000002384185791015625);
    acc = over(param_27, param_28, param_29);
    float4 param_30 = acc;
    fragColor = unpremultiply(param_30);
}

fragment flair_crumbling_text_frag_out flair_crumbling_text_frag(constant FlairUniforms& _334 [[buffer(0)]], texture2d<float> uText [[texture(1)]], sampler uTextSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_crumbling_text_frag_out out = {};
    float textW = 1.0;
    float textH = 0.300000011920928955078125;
    float2 origin = float2(0.0);
    float cs = 0.02999999932944774627685546875;
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1021;
    if (_334.flair_flipY > 0.5)
    {
        _1021 = _334.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1021 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1021);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, textW, textH, origin, cs, uText, uTextSmplr, _334);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

