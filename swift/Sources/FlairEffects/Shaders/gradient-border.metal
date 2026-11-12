// flair-metal-hash: 11c3cf98
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
    float3 uColorA;
    float3 uColorB;
    packed_float3 uColorC;
    float uInset;
    float uRadius;
    float uThickness;
    float uTurns;
    float uGlow;
    float uGlowSize;
    char _m22_pad[12];
    packed_float3 uFill;
    float uFillAlpha;
};

struct flair_gradient_border_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float boxSdf(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
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
    float3 _203 = toOklab(param);
    float3 param_1 = b;
    float3 _206 = toOklab(param_1);
    float3 param_2 = mix(_203, _206, float3(t));
    return fromOklab(param_2);
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _224)
{
    float px = 1.0 / _224.iResolution[1u];
    float2 p = (fragCoord - (float2(_224.iResolution[0], _224.iResolution[1]) * 0.5)) * px;
    float2 box = fast::max(((float2(_224.iResolution[0], _224.iResolution[1]) * 0.5) * px) - float2(_224.uInset), float2(0.0199999995529651641845703125));
    float rad = fast::min(_224.uRadius, fast::min(box.x, box.y));
    float2 param = p;
    float2 param_1 = box;
    float param_2 = rad;
    float sd = boxSdf(param, param_1, param_2);
    float w = fast::max(_224.uThickness, px);
    float a = fract(((precise::atan2(p.y / box.y, p.x / box.x) / 6.283185482025146484375) + 0.5) - ((_224.iTime * _224.uTurns) / 6.0));
    float s = a * 3.0;
    float3 _314;
    if (s < 1.0)
    {
        float3 param_3 = _224.uColorA;
        float3 param_4 = _224.uColorB;
        float param_5 = s;
        _314 = oklabMix(param_3, param_4, param_5);
    }
    else
    {
        float3 _332;
        if (s < 2.0)
        {
            float3 param_6 = _224.uColorB;
            float3 param_7 = float3(_224.uColorC);
            float param_8 = s - 1.0;
            _332 = oklabMix(param_6, param_7, param_8);
        }
        else
        {
            float3 param_9 = float3(_224.uColorC);
            float3 param_10 = _224.uColorA;
            float param_11 = s - 2.0;
            _332 = oklabMix(param_9, param_10, param_11);
        }
        _314 = _332;
    }
    float3 col = _314;
    float core = fast::clamp(1.0 - ((abs(sd) - (0.5 * w)) / px), 0.0, 1.0);
    float inside = fast::clamp(0.5 - (sd / px), 0.0, 1.0);
    float glow = exp((-fast::max(sd, 0.0)) / _224.uGlowSize) * (1.0 - inside);
    float4 acc = float4(0.0);
    float4 param_12 = acc;
    float3 param_13 = col;
    float param_14 = fast::clamp((glow * _224.uGlow) * 0.800000011920928955078125, 0.0, 1.0);
    acc = over(param_12, param_13, param_14);
    float4 param_15 = acc;
    float3 param_16 = float3(_224.uFill);
    float param_17 = inside * _224.uFillAlpha;
    acc = over(param_15, param_16, param_17);
    float4 param_18 = acc;
    float3 param_19 = col;
    float param_20 = ((inside * _224.uGlow) * 0.180000007152557373046875) * exp(sd / (_224.uGlowSize * 0.60000002384185791015625));
    acc = over(param_18, param_19, param_20);
    float4 param_21 = acc;
    float3 param_22 = col;
    float param_23 = core;
    acc = over(param_21, param_22, param_23);
    float4 param_24 = acc;
    fragColor = unpremultiply(param_24);
}

fragment flair_gradient_border_frag_out flair_gradient_border_frag(constant FlairUniforms& _224 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_gradient_border_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _458;
    if (_224.flair_flipY > 0.5)
    {
        _458 = _224.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _458 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _458);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _224);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

