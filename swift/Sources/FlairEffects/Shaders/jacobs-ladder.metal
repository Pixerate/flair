// flair-metal-hash: eb943bef
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
    float3 uColor;
    float3 uRod;
    packed_float3 uBackground;
    float uPeriod;
    float uSpread;
    float uRough;
    float uWidth;
    float uBackgroundAlpha;
};

struct flair_jacobs_ladder_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float rodX(thread const float& y, constant FlairUniforms& _447)
{
    return 0.0350000001490116119384765625 + (_447.uSpread * fast::clamp((y - (-0.4000000059604644775390625)) / 0.699999988079071044921875, 0.0, 1.0));
}

static inline __attribute__((always_inline))
float segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 ab = b - a;
    float t = fast::clamp(dot(p - a, ab) / fast::max(dot(ab, ab), 9.9999999392252902907785028219223e-09), 0.0, 1.0);
    return length((p - a) - (ab * t));
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float jag(thread const float& x, thread const float& seed)
{
    float i = floor(x);
    float2 param = float2(i, seed);
    float2 param_1 = float2(i + 1.0, seed);
    return (mix(hash12(param), hash12(param_1), fract(x)) * 2.0) - 1.0;
}

static inline __attribute__((always_inline))
float zigzag(thread float& x, thread const float& seed)
{
    float s = 0.0;
    float amp = 0.60000002384185791015625;
    for (int i = 0; i < 5; i++)
    {
        float param = x;
        float param_1 = seed + (float(i) * 17.299999237060546875);
        s += (amp * jag(param, param_1));
        x *= 2.099999904632568359375;
        amp *= 0.5;
    }
    return s;
}

static inline __attribute__((always_inline))
float arcKick(thread const float& t, thread const float& seed, thread const float& rough, thread const float& open)
{
    float env = sqrt(fast::max(sin((3.141590118408203125 * t) * (1.0 - (0.5 * open))), 0.0));
    float param = t * 5.0;
    float param_1 = seed;
    float _193 = zigzag(param, param_1);
    return (_193 * rough) * env;
}

static inline __attribute__((always_inline))
float chordDist(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 ab = b - a;
    float t = fast::clamp(dot(p - a, ab) / fast::max(dot(ab, ab), 1.0000000133514319600180897396058e-10), 0.0, 1.0);
    return length((p - a) - (ab * t));
}

static inline __attribute__((always_inline))
float2 arcDist(thread const float2& p, thread const float2& a, thread const float2& b, thread const float& seed, thread const float& rough, thread const float& open)
{
    float2 ab = b - a;
    float len = fast::max(length(ab), 9.9999997473787516355514526367188e-05);
    float2 dir = ab / float2(len);
    float2 q = p - a;
    float along = dot(q, dir);
    float side = dot(q, float2(-dir.y, dir.x));
    float t = fast::clamp(along / len, 0.0, 1.0);
    float band = (rough * len) * 1.2999999523162841796875;
    if (abs(side) > (band + 0.300000011920928955078125))
    {
        return float2(length(float2(along - (t * len), abs(side) - band)), t);
    }
    float2 lp = float2(along, side);
    float param = t - 0.008000000379979610443115234375;
    float param_1 = seed;
    float param_2 = rough;
    float param_3 = open;
    float2 c0 = float2((t - 0.008000000379979610443115234375) * len, arcKick(param, param_1, param_2, param_3) * len);
    float param_4 = t;
    float param_5 = seed;
    float param_6 = rough;
    float param_7 = open;
    float2 c1 = float2(t * len, arcKick(param_4, param_5, param_6, param_7) * len);
    float param_8 = t + 0.008000000379979610443115234375;
    float param_9 = seed;
    float param_10 = rough;
    float param_11 = open;
    float2 c2 = float2((t + 0.008000000379979610443115234375) * len, arcKick(param_8, param_9, param_10, param_11) * len);
    float2 param_12 = lp;
    float2 param_13 = c0;
    float2 param_14 = c1;
    float2 param_15 = lp;
    float2 param_16 = c1;
    float2 param_17 = c2;
    return float2(fast::min(chordDist(param_12, param_13, param_14), chordDist(param_15, param_16, param_17)), t);
}

static inline __attribute__((always_inline))
float3 arcLight(thread const float& d, thread const float& w, thread const float3& col)
{
    float core = exp(((-d) * d) / (w * w));
    float halo = (0.550000011920928955078125 * exp((-d) / (w * 4.0))) + (0.180000007152557373046875 * exp((-d) / (w * 20.0)));
    return ((mix(col, float3(1.0), float3(0.75)) * core) * 2.0) + (col * halo);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _447)
{
    float px = 1.0 / _447.iResolution[1u];
    float2 p = (fragCoord - (float2(_447.iResolution[0], _447.iResolution[1]) * 0.5)) * px;
    float w = fast::max(0.0030000000260770320892333984375 * _447.uWidth, 0.699999988079071044921875 * px);
    float3 col = float3(_447.uBackground);
    float2 bq = abs(p - float2(0.0, -0.449999988079071044921875)) - float2(0.119999997317790985107421875 + (_447.uSpread * 0.300000011920928955078125), 0.0500000007450580596923828125);
    if (fast::max(bq.x, bq.y) < 0.0)
    {
        col = mix(_447.uRod * 0.20000000298023223876953125, _447.uRod * 0.3499999940395355224609375, float3(smoothstep(-0.0500000007450580596923828125, 0.0500000007450580596923828125, (p.y - (-0.4000000059604644775390625)) + 0.0500000007450580596923828125)));
    }
    for (int s = 0; s < 2; s++)
    {
        float side = (s == 0) ? (-1.0) : 1.0;
        float param = -0.4000000059604644775390625;
        float2 a = float2(side * rodX(param, _447), -0.4000000059604644775390625);
        float param_1 = 0.300000011920928955078125;
        float2 b = float2(side * rodX(param_1, _447), 0.3300000131130218505859375);
        float2 param_2 = p;
        float2 param_3 = a;
        float2 param_4 = b;
        float d = segment(param_2, param_3, param_4);
        float r = 0.007000000216066837310791015625;
        float across = fast::clamp(d / r, 0.0, 1.0);
        float3 metal = (_447.uRod * (0.449999988079071044921875 + (0.550000011920928955078125 * sqrt(1.0 - (across * across))))) + float3(0.25 * exp((-d) / (r * 0.300000011920928955078125)));
        col = mix(col, metal, float3(smoothstep(r, r - px, d)));
    }
    float u = fract(_447.iTime / _447.uPeriod);
    float climb = fast::clamp(u / 0.87999999523162841796875, 0.0, 1.0);
    float y = (-0.37999999523162841796875) + (0.680000007152557373046875 * powr(climb, 1.5));
    float tick = floor(_447.iTime * 20.0);
    float3 light = float3(0.0);
    if (u < 0.87999999523162841796875)
    {
        float param_5 = y;
        float2 l = float2((-rodX(param_5, _447)) + 0.006000000052154064178466796875, y);
        float param_6 = y;
        float2 r_1 = float2(rodX(param_6, _447) - 0.006000000052154064178466796875, y);
        float bow = ((r_1.x - l.x) * 0.1500000059604644775390625) + (0.119999997317790985107421875 * smoothstep(0.60000002384185791015625, 0.87999999523162841796875, u));
        float2 param_7 = float2(tick, 3.0);
        float2 mid = float2((hash12(param_7) - 0.5) * 0.039999999105930328369140625, y + bow);
        float2 param_8 = p;
        float2 param_9 = l;
        float2 param_10 = mid;
        float param_11 = tick * 2.099999904632568359375;
        float param_12 = _447.uRough;
        float param_13 = 0.0;
        float2 param_14 = p;
        float2 param_15 = mid;
        float2 param_16 = r_1;
        float param_17 = (tick * 2.099999904632568359375) + 1.0;
        float param_18 = _447.uRough;
        float param_19 = 0.0;
        float d_1 = fast::min(arcDist(param_8, param_9, param_10, param_11, param_12, param_13).x, arcDist(param_14, param_15, param_16, param_17, param_18, param_19).x);
        float strike = 1.0 + (1.5 * exp(((-u) * _447.uPeriod) * 12.0));
        float2 param_20 = float2(tick, 1.0);
        float2 param_21 = float2(tick, 2.0);
        float flick = (0.75 + (0.3499999940395355224609375 * hash12(param_20))) - ((0.4000000059604644775390625 * smoothstep(0.75, 0.87999999523162841796875, u)) * step(0.5, hash12(param_21)));
        float param_22 = d_1;
        float param_23 = w;
        float3 param_24 = _447.uColor;
        light += ((arcLight(param_22, param_23, param_24) * strike) * flick);
        light += (((_447.uColor * (exp((-length(p - l)) / 0.0199999995529651641845703125) + exp((-length(p - r_1)) / 0.0199999995529651641845703125))) * 0.60000002384185791015625) * flick);
    }
    else
    {
        float age = (u - 0.87999999523162841796875) * _447.uPeriod;
        float2 c = float2(0.0, 0.4199999868869781494140625 + (age * 0.25));
        light += (((_447.uColor * exp((-length(p - c)) / (0.02999999932944774627685546875 + (age * 0.100000001490116119384765625)))) * exp((-age) * 6.0)) * 0.800000011920928955078125);
    }
    col += (float3(1.0) - exp(-light));
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
    float3 _872;
    if (a > 0.0)
    {
        _872 = bg + (d / float3(a));
    }
    else
    {
        _872 = bg;
    }
    float3 fg = _872;
    float alpha = a + (opacity * (1.0 - a));
    float3 _894;
    if (alpha > 0.0)
    {
        _894 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _894 = bg;
    }
    float3 col = _894;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _447)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _447);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_447.uBackground);
    float param_4 = _447.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_jacobs_ladder_frag_out flair_jacobs_ladder_frag(constant FlairUniforms& _447 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_jacobs_ladder_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _951;
    if (_447.flair_flipY > 0.5)
    {
        _951 = _447.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _951 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _951);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _447);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

