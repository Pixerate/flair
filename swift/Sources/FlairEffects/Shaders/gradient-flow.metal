// flair-metal-hash: 663df2f2
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
    packed_float3 uColorB;
    float uSpeed;
    float uScale;
    float uContrast;
};

struct flair_gradient_flow_frag_out
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
    float3 _273 = toOklab(param);
    float3 param_1 = b;
    float3 _276 = toOklab(param_1);
    float3 param_2 = mix(_273, _276, float3(t));
    return fromOklab(param_2);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _294)
{
    float2 p = (fragCoord / float2(_294.iResolution[1u])) * _294.uScale;
    float t = _294.iTime * _294.uSpeed;
    float2 param = p + float2(t);
    int param_1 = 4;
    float _319 = fbm(param, param_1);
    float2 param_2 = (p + float2(5.19999980926513671875, 1.2999999523162841796875)) - float2(t);
    int param_3 = 4;
    float _330 = fbm(param_2, param_3);
    float2 q = float2(_319, _330);
    float2 param_4 = ((p + (q * 3.0)) + float2(1.7000000476837158203125, 9.19999980926513671875)) + float2(0.5 * t);
    int param_5 = 5;
    float _348 = fbm(param_4, param_5);
    float f = _348;
    f = fast::clamp(((f - 0.5) * _294.uContrast) + 0.5, 0.0, 1.0);
    float3 param_6 = _294.uColorA;
    float3 param_7 = float3(_294.uColorB);
    float param_8 = smoothstep(0.0, 1.0, f);
    fragColor = float4(oklabMix(param_6, param_7, param_8), 1.0);
}

fragment flair_gradient_flow_frag_out flair_gradient_flow_frag(constant FlairUniforms& _294 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_gradient_flow_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _385;
    if (_294.flair_flipY > 0.5)
    {
        _385 = _294.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _385 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _385);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _294);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

