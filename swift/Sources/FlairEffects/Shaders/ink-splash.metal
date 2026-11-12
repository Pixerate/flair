// flair-metal-hash: 962d04c2
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
    float3 uInk;
    float3 uInk2;
    packed_float3 uBackground;
    float uSwirl;
    float uSpread;
    float uDensity;
    uint uSurface;
    float uBackgroundAlpha;
};

struct flair_ink_splash_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 pa = p - a;
    float2 ba = b - a;
    float h = fast::clamp(dot(pa, ba) / fast::max(dot(ba, ba), 9.999999717180685365747194737196e-10), 0.0, 1.0);
    return float2(length(pa - (ba * h)), h);
}

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float2 curl(thread const float2& q, thread const float2& c, thread const float& angle, thread const float& r)
{
    float2 d = q - c;
    float param = angle * exp((-dot(d, d)) / (r * r));
    return c + (rot(param) * d);
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
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _309)
{
    float2 p = (fragCoord - (float2(_309.iResolution[0], _309.iResolution[1]) * 0.5)) / float2(_309.iResolution[1u]);
    float px = 1.0 / _309.iResolution[1u];
    float t = mod(_309.iTime, 8.0);
    float top = 0.36000001430511474609375;
    float3 bg = float3(_309.uBackground) * (0.939999997615814208984375 + (0.0599999986588954925537109375 * smoothstep(-0.5, top, p.y)));
    if (_309.uSurface != 0u)
    {
        bg = mix(bg, (float3(_309.uBackground) * 1.03999996185302734375) + float3(0.0199999995529651641845703125), float3(step(top, p.y)));
        bg *= (1.0 - (0.07999999821186065673828125 * exp((-abs(p.y - top)) / (2.0 * px))));
    }
    float dens = 0.0;
    float hue = 0.0;
    if (t < 0.449999988079071044921875)
    {
        float y = mix(0.62000000476837158203125, top, (t / 0.449999988079071044921875) * (t / 0.449999988079071044921875));
        float d = length((p - float2(0.0, y)) * float2(1.0, 0.800000011920928955078125)) - 0.02199999988079071044921875;
        float2 param = p;
        float2 param_1 = float2(0.0, y);
        float2 param_2 = float2(0.0, y + 0.0500000007450580596923828125);
        d = fast::min(d, segment(param, param_1, param_2).x - 0.006000000052154064178466796875);
        dens = fast::clamp(0.5 - (d / px), 0.0, 1.0) * 2.0;
    }
    else
    {
        float tau = t - 0.449999988079071044921875;
        float grow = 1.0 - exp((-tau) * 0.60000002384185791015625);
        float2 c = float2(0.0, (top - 0.039999999105930328369140625) - (0.5 * (1.0 - exp((-tau) * 0.4199999868869781494140625))));
        float R = 0.0500000007450580596923828125 + ((0.20000000298023223876953125 * _309.uSpread) * grow);
        float2 q = p - c;
        float spin = (_309.uSwirl * 1.7000000476837158203125) * (1.0 - exp((-tau) * 0.5));
        float2 param_3 = q;
        float2 param_4 = float2((-0.60000002384185791015625) * R, (-0.1500000059604644775390625) * R);
        float param_5 = -spin;
        float param_6 = R * 0.699999988079071044921875;
        q = curl(param_3, param_4, param_5, param_6);
        float2 param_7 = q;
        float2 param_8 = float2(0.60000002384185791015625 * R, (-0.1500000059604644775390625) * R);
        float param_9 = spin;
        float param_10 = R * 0.699999988079071044921875;
        q = curl(param_7, param_8, param_9, param_10);
        float2 param_11 = ((q / float2(R)) * 1.2000000476837158203125) + float2(3.099999904632568359375, (-tau) * 0.25);
        int param_12 = 5;
        float _526 = fbm(param_11, param_12);
        float2 param_13 = ((q / float2(R)) * 1.2000000476837158203125) + float2(7.69999980926513671875 + (tau * 0.20000000298023223876953125), 1.2999999523162841796875);
        int param_14 = 5;
        float _541 = fbm(param_13, param_14);
        float2 w = float2(_526, _541) - float2(0.5);
        q += ((w * R) * (0.4000000059604644775390625 + (0.3499999940395355224609375 * _309.uSwirl)));
        float e = length(q / float2(1.0, 0.62000000476837158203125)) / R;
        float2 param_15 = (fast::normalize(q + float2(9.9999997473787516355514526367188e-06)) * 2.2000000476837158203125) + float2(tau * 0.0500000007450580596923828125, 4.0);
        int param_16 = 4;
        float _582 = fbm(param_15, param_16);
        float edge = 0.75 + (0.550000011920928955078125 * _582);
        float cloud = smoothstep(edge, edge * 0.3499999940395355224609375, e);
        float2 param_17 = ((q / float2(R)) * 2.599999904632568359375) + float2(9.0);
        int param_18 = 5;
        float _603 = fbm(param_17, param_18);
        float strands = 1.0 - abs((2.0 * _603) - 1.0);
        dens = (cloud * mix(0.60000002384185791015625, 1.5, strands * strands)) + (0.300000011920928955078125 * smoothstep(edge * 1.39999997615814208984375, edge * 0.20000000298023223876953125, e));
        for (int j = 0; j < 5; j++)
        {
            float2 param_19 = float2(float(j) + 0.5, 4.19999980926513671875);
            float2 h = hash22(param_19);
            float x = ((h.x - 0.5) * 1.39999997615814208984375) * R;
            float len = (R * (0.60000002384185791015625 + (1.39999997615814208984375 * h.y))) * smoothstep(0.300000011920928955078125, 3.0, tau);
            float2 param_20 = q;
            float2 param_21 = float2(x, (-0.300000011920928955078125) * R);
            float2 param_22 = float2(x * 1.2999999523162841796875, ((-0.300000011920928955078125) * R) - len);
            float2 sg = segment(param_20, param_21, param_22);
            dens += ((exp(((-sg.x) * sg.x) / ((R * R) * 0.01200000010430812835693359375)) * (1.0 - (sg.y * 0.699999988079071044921875))) * 0.60000002384185791015625);
        }
        float2 param_23 = (p * 9.0) + float2(2.0);
        int param_24 = 3;
        float _708 = fbm(param_23, param_24);
        float2 tw = p + ((float2(_708, 0.0) - float2(0.5)) * 0.039999999105930328369140625);
        float2 param_25 = tw;
        float2 param_26 = float2(0.0, top);
        float2 param_27 = c + float2(0.0, 0.300000011920928955078125 * R);
        float2 sg_1 = segment(param_25, param_26, param_27);
        dens += ((exp(((-sg_1.x) * sg_1.x) / 5.9999998484272509813308715820312e-05) * 0.5) * exp((-tau) * 0.3499999940395355224609375));
        dens *= (mix(1.2999999523162841796875, 0.60000002384185791015625, grow) * (1.0 - smoothstep(5.599999904632568359375, 7.5, t)));
        if (_309.uSurface != 0u)
        {
            dens *= smoothstep(top + (2.0 * px), top - (2.0 * px), p.y);
        }
        float2 param_28 = ((q / float2(R)) * 1.5) + float2(11.0);
        int param_29 = 3;
        float _782 = fbm(param_28, param_29);
        hue = smoothstep(0.3499999940395355224609375, 0.75, _782);
    }
    float3 ink = fast::max(mix(_309.uInk, _309.uInk2, float3(hue)), float3(0.0199999995529651641845703125));
    float3 col = bg * powr(ink, float3((dens * _309.uDensity) * 1.2999999523162841796875));
    fragColor = float4(col, 1.0);
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _857;
    if (a > 0.0)
    {
        _857 = bg + (d / float3(a));
    }
    else
    {
        _857 = bg;
    }
    float3 fg = _857;
    float alpha = a + (opacity * (1.0 - a));
    float3 _879;
    if (alpha > 0.0)
    {
        _879 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _879 = bg;
    }
    float3 col = _879;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _309)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _309);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_309.uBackground);
    float param_4 = _309.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_ink_splash_frag_out flair_ink_splash_frag(constant FlairUniforms& _309 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_ink_splash_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _936;
    if (_309.flair_flipY > 0.5)
    {
        _936 = _309.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _936 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _936);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _309);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

