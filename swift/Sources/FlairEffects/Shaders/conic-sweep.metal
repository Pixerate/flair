// flair-metal-hash: dc28ec9a
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
    float uTurns;
    float uCore;
    float2 uCenter;
};

struct flair_conic_sweep_frag_out
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
    float3 _122 = toOklab(param);
    float3 param_1 = b;
    float3 _125 = toOklab(param_1);
    float3 param_2 = mix(_122, _125, float3(t));
    return fromOklab(param_2);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _146)
{
    float2 p = ((fragCoord - (float2(_146.iResolution[0], _146.iResolution[1]) * 0.5)) / float2(_146.iResolution[1u])) - _146.uCenter;
    float a = (precise::atan2(p.y, p.x) / 6.28318023681640625) + 0.5;
    a = fract(a + ((_146.iTime * _146.uTurns) / 10.0));
    float s = a * 3.0;
    float3 _195;
    if (s < 1.0)
    {
        float3 param = _146.uColorA;
        float3 param_1 = _146.uColorB;
        float param_2 = s;
        _195 = oklabMix(param, param_1, param_2);
    }
    else
    {
        float3 _213;
        if (s < 2.0)
        {
            float3 param_3 = _146.uColorB;
            float3 param_4 = float3(_146.uColorC);
            float param_5 = s - 1.0;
            _213 = oklabMix(param_3, param_4, param_5);
        }
        else
        {
            float3 param_6 = float3(_146.uColorC);
            float3 param_7 = _146.uColorA;
            float param_8 = s - 2.0;
            _213 = oklabMix(param_6, param_7, param_8);
        }
        _195 = _213;
    }
    float3 col = _195;
    float r = length(p);
    col *= (0.75 + (0.25 * smoothstep(0.89999997615814208984375, 0.0, r)));
    col += float3(_146.uCore * exp((-r) * 6.0));
    fragColor = float4(col, 1.0);
}

fragment flair_conic_sweep_frag_out flair_conic_sweep_frag(constant FlairUniforms& _146 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_conic_sweep_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _281;
    if (_146.flair_flipY > 0.5)
    {
        _281 = _146.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _281 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _281);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _146);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

