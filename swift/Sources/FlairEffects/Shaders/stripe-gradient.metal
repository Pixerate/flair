// flair-metal-hash: c22272f5
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
    float3 uColorA;
    float3 uColorB;
    float3 uColorC;
    packed_float3 uColorD;
    float uSpeed;
    float uScale;
    float uAngle;
    float uCut;
    char _m21_pad[4];
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_stripe_gradient_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
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
float layer(thread const float2& p, thread const float& t, thread const float& seed)
{
    float w = (sin((((p.x * 1.60000002384185791015625) + t) + (seed * 2.099999904632568359375)) + (sin(((p.y * 1.2999999523162841796875) + (t * 0.699999988079071044921875)) + seed) * 1.2000000476837158203125)) * 0.5) + 0.5;
    float2 param = float2(((p.x * 1.2000000476837158203125) + (t * 0.4000000059604644775390625)) + (seed * 13.0), (p.y * 2.400000095367431640625) - (t * 0.300000011920928955078125));
    float n = vnoise(param);
    return mix(w, n, 0.449999988079071044921875);
}

static inline __attribute__((always_inline))
float3 toOklab(thread float3& c)
{
    c = powr(fast::max(c, float3(0.0)), float3(2.2000000476837158203125));
    float3 lms = float3x3(float3(0.4122000038623809814453125, 0.2118999958038330078125, 0.088299997150897979736328125), float3(0.536300003528594970703125, 0.680700004100799560546875, 0.2816999852657318115234375), float3(0.051399998366832733154296875, 0.107400000095367431640625, 0.62999999523162841796875)) * c;
    lms = powr(lms, float3(0.3333333432674407958984375));
    return float3x3(float3(0.2105000019073486328125, 1.97800004482269287109375, 0.02590000070631504058837890625), float3(0.793600022792816162109375, -2.4286000728607177734375, 0.782800018787384033203125), float3(-0.0041000000201165676116943359375, 0.4505999982357025146484375, -0.808700025081634521484375)) * lms;
}

static inline __attribute__((always_inline))
float3 fromOklab(thread const float3& c)
{
    float3 lms = float3x3(float3(1.0), float3(0.3962999880313873291015625, -0.10559999942779541015625, -0.089500002562999725341796875), float3(0.21580000221729278564453125, -0.063900001347064971923828125, -1.29149997234344482421875)) * c;
    lms = (lms * lms) * lms;
    float3 rgb = float3x3(float3(4.0767002105712890625, -1.2683999538421630859375, -0.0041999998502433300018310546875), float3(-3.3076999187469482421875, 2.6098001003265380859375, -0.70340001583099365234375), float3(0.231000006198883056640625, -0.34130001068115234375, 1.70759999752044677734375)) * lms;
    return powr(fast::max(rgb, float3(0.0)), float3(0.4545454680919647216796875));
}

static inline __attribute__((always_inline))
float3 oklabMix(thread const float3& a, thread const float3& b, thread const float& t)
{
    float3 param = a;
    float3 _251 = toOklab(param);
    float3 param_1 = b;
    float3 _254 = toOklab(param_1);
    float3 param_2 = mix(_251, _254, float3(t));
    return fromOklab(param_2);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _330)
{
    float px = 1.0 / _330.iResolution[1u];
    float2 p0 = (fragCoord - (float2(_330.iResolution[0], _330.iResolution[1]) * 0.5)) * px;
    float param = radians(_330.uAngle);
    float2 p = ((rot(param) * p0) / float2(_330.uScale)) * 2.0;
    float t = _330.iTime * _330.uSpeed;
    float3 col = _330.uColorA;
    float2 param_1 = p;
    float param_2 = t;
    float param_3 = 1.0;
    float3 param_4 = col;
    float3 param_5 = _330.uColorB;
    float param_6 = smoothstep(0.4199999868869781494140625, 0.7200000286102294921875, layer(param_1, param_2, param_3));
    col = oklabMix(param_4, param_5, param_6);
    float2 param_7 = (p * 1.10000002384185791015625) + float2(0.0, 0.60000002384185791015625);
    float param_8 = t * 1.14999997615814208984375;
    float param_9 = 2.0;
    float3 param_10 = col;
    float3 param_11 = _330.uColorC;
    float param_12 = smoothstep(0.4799999892711639404296875, 0.7799999713897705078125, layer(param_7, param_8, param_9));
    col = oklabMix(param_10, param_11, param_12);
    float2 param_13 = (p * 0.89999997615814208984375) - float2(0.0, 0.800000011920928955078125);
    float param_14 = t * 0.89999997615814208984375;
    float param_15 = 3.0;
    float3 param_16 = col;
    float3 param_17 = float3(_330.uColorD);
    float param_18 = smoothstep(0.550000011920928955078125, 0.85000002384185791015625, layer(param_13, param_14, param_15));
    col = oklabMix(param_16, param_17, param_18);
    col += float3(0.0599999986588954925537109375 * sin(((p.x * 3.0) - (p.y * 2.0)) + (t * 1.5)));
    if (_330.uCut > 0.0)
    {
        float edge = p0.y - (((-0.5) + _330.uCut) + (p0.x * 0.25));
        col = mix(float3(_330.uBackground), col, float3(fast::clamp((edge / px) + 0.5, 0.0, 1.0)));
    }
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
    float3 _534;
    if (a > 0.0)
    {
        _534 = bg + (d / float3(a));
    }
    else
    {
        _534 = bg;
    }
    float3 fg = _534;
    float alpha = a + (opacity * (1.0 - a));
    float3 _556;
    if (alpha > 0.0)
    {
        _556 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _556 = bg;
    }
    float3 col = _556;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _330)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _330);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_330.uBackground);
    float param_4 = _330.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_stripe_gradient_frag_out flair_stripe_gradient_frag(constant FlairUniforms& _330 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_stripe_gradient_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _614;
    if (_330.flair_flipY > 0.5)
    {
        _614 = _330.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _614 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _614);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _330);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

