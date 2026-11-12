// flair-metal-hash: 81fc511f
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
    float3 uBackground;
    float3 uColorA;
    float3 uColorB;
    packed_float3 uColorC;
    float uSize;
    float uStrength;
    float uSpeed;
    float uGrain;
    float uBackgroundAlpha;
};

struct flair_noise_grain_bg_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

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
    float3 _167 = toOklab(param);
    float3 param_1 = b;
    float3 _170 = toOklab(param_1);
    float3 param_2 = mix(_167, _170, float3(t));
    return fromOklab(param_2);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _188)
{
    float px = 1.0 / _188.iResolution[1u];
    float2 p = (fragCoord - (float2(_188.iResolution[0], _188.iResolution[1]) * 0.5)) * px;
    float aspect = _188.iResolution[0u] * px;
    float t = _188.iTime * _188.uSpeed;
    float2 pa = float2((-0.300000011920928955078125) * aspect, 0.25) + (float2(sin(t * 0.89999997615814208984375), cos(t * 0.699999988079071044921875)) * 0.1500000059604644775390625);
    float2 pb = float2(0.25 * aspect, 0.20000000298023223876953125) + (float2(cos((t * 0.60000002384185791015625) + 1.0), sin(t * 0.800000011920928955078125)) * 0.1500000059604644775390625);
    float2 pc = float2(0.0500000007450580596923828125 * aspect, -0.300000011920928955078125) + (float2(sin((t * 0.5) + 2.0), cos(t * 1.10000002384185791015625)) * 0.1500000059604644775390625);
    float s2 = _188.uSize * _188.uSize;
    float3 col = _188.uBackground;
    float3 param = col;
    float3 param_1 = _188.uColorA;
    float param_2 = _188.uStrength * exp((-dot(p - pa, p - pa)) / s2);
    col = oklabMix(param, param_1, param_2);
    float3 param_3 = col;
    float3 param_4 = _188.uColorB;
    float param_5 = _188.uStrength * exp((-dot(p - pb, p - pb)) / s2);
    col = oklabMix(param_3, param_4, param_5);
    float3 param_6 = col;
    float3 param_7 = float3(_188.uColorC);
    float param_8 = _188.uStrength * exp((-dot(p - pc, p - pc)) / (s2 * 0.800000011920928955078125));
    col = oklabMix(param_6, param_7, param_8);
    float2 param_9 = fragCoord + float2(floor(_188.iTime * 24.0) * 17.3099994659423828125);
    float g = hash12(param_9) - 0.5;
    float luma = dot(col, float3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625));
    col += float3((g * _188.uGrain) * (0.60000002384185791015625 + ((1.60000002384185791015625 * luma) * (1.0 - luma))));
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
    float3 _436;
    if (a > 0.0)
    {
        _436 = bg + (d / float3(a));
    }
    else
    {
        _436 = bg;
    }
    float3 fg = _436;
    float alpha = a + (opacity * (1.0 - a));
    float3 _458;
    if (alpha > 0.0)
    {
        _458 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _458 = bg;
    }
    float3 col = _458;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _188)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _188);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _188.uBackground;
    float param_4 = _188.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_noise_grain_bg_frag_out flair_noise_grain_bg_frag(constant FlairUniforms& _188 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_noise_grain_bg_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _516;
    if (_188.flair_flipY > 0.5)
    {
        _516 = _188.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _516 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _516);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _188);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

