// flair-metal-hash: 973883b5
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    packed_float3 uColorC;
    int uSteps;
    float uBlock;
    float uStairs;
    float uAngle;
    float uWave;
    float uSpeed;
};

struct flair_stepped_gradient_frag_out
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
    float3 _157 = toOklab(param);
    float3 param_1 = b;
    float3 _160 = toOklab(param_1);
    float3 param_2 = mix(_157, _160, float3(t));
    return fromOklab(param_2);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _179)
{
    float2 cell = floor(fragCoord / float2(_179.uBlock));
    float2 c = (((cell + float2(0.5)) * _179.uBlock) - (float2(_179.iResolution[0], _179.iResolution[1]) * 0.5)) / float2(_179.iResolution[1u]);
    float a = radians(_179.uAngle);
    float2 dir = float2(cos(a), sin(a));
    float2 perp = float2(-dir.y, dir.x);
    float extent = ((abs(dir.x) * _179.iResolution[0u]) / _179.iResolution[1u]) + abs(dir.y);
    float t = _179.iTime * _179.uSpeed;
    float across = dot(c, perp);
    float g = (dot(c, dir) / extent) + 0.5;
    g += (_179.uWave * ((0.1599999964237213134765625 * sin((across * 3.0) + t)) + (0.070000000298023223876953125 * sin((across * 7.30000019073486328125) - (t * 1.2999999523162841796875)))));
    float _291;
    if (abs(dir.y) > abs(dir.x))
    {
        _291 = cell.x;
    }
    else
    {
        _291 = cell.y;
    }
    float column = _291;
    float q = fast::clamp(g, 0.0, 1.0) * float(_179.uSteps);
    float2 param = float2(column, 1.0);
    float2 param_1 = float2(floor(column / 3.0), 2.0);
    float threshold = 0.5 + ((((0.550000011920928955078125 * hash12(param)) + (0.449999988079071044921875 * hash12(param_1))) - 0.5) * _179.uStairs);
    float level0 = fast::min(floor(q) + step(threshold, fract(q)), float(_179.uSteps)) / float(_179.uSteps);
    float3 _351;
    if (level0 < 0.5)
    {
        float3 param_2 = _179.uColorA;
        float3 param_3 = _179.uColorB;
        float param_4 = level0 * 2.0;
        _351 = oklabMix(param_2, param_3, param_4);
    }
    else
    {
        float3 param_5 = _179.uColorB;
        float3 param_6 = float3(_179.uColorC);
        float param_7 = (level0 * 2.0) - 1.0;
        _351 = oklabMix(param_5, param_6, param_7);
    }
    float3 col = _351;
    fragColor = float4(col, 1.0);
}

fragment flair_stepped_gradient_frag_out flair_stepped_gradient_frag(constant FlairUniforms& _179 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_stepped_gradient_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _397;
    if (_179.flair_flipY > 0.5)
    {
        _397 = _179.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _397 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _397);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _179);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

