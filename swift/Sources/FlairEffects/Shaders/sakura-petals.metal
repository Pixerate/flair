// flair-metal-hash: 570930e0
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
    float3 uPetal;
    float3 uPetalBase;
    packed_float3 uBackground;
    float uBackgroundAlpha;
    float uDensity;
    float uSize;
    float uFall;
    float uWind;
    float uFlutter;
};

struct flair_sakura_petals_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float petal(thread const float2& q)
{
    float y = fast::clamp(q.y, -1.0, 1.0);
    float w = (0.62000000476837158203125 * sqrt(fast::max(1.0 - (y * y), 0.0))) * (0.699999988079071044921875 + (0.300000011920928955078125 * (y + 1.0)));
    float body = fast::min(w - abs(q.x), 1.0 - abs(q.y));
    float notch = (0.7400000095367431640625 + (1.10000002384185791015625 * abs(q.x))) - q.y;
    return fast::min(body, notch);
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _171)
{
    float2 p = (fragCoord - (float2(_171.iResolution[0], _171.iResolution[1]) * 0.5)) / float2(_171.iResolution[1u]);
    float px = 1.0 / _171.iResolution[1u];
    float4 acc = float4(float3(_171.uBackground) * _171.uBackgroundAlpha, _171.uBackgroundAlpha);
    for (int l = 2; l >= 0; l--)
    {
        float sc = 1.0 - (0.2800000011920928955078125 * float(l));
        float cs = _171.uSize * 6.0;
        float2 drift = ((float2(_171.uWind, -_171.uFall) * _171.iTime) * (0.60000002384185791015625 + (0.4000000059604644775390625 * sc))) / float2(fast::max(sc, 0.300000011920928955078125));
        float2 pl = ((p / float2(sc)) - drift) + float2(float(l) * 5.099999904632568359375);
        float2 cell = floor(pl / float2(cs));
        for (int j = -1; j <= 1; j++)
        {
            for (int i = -1; i <= 1; i++)
            {
                float2 c = cell + float2(float(i), float(j));
                float2 param = c + float2(0.310000002384185791015625 * float(l));
                float2 param_1 = (c + float2(5.30000019073486328125)) + float2(float(l));
                float4 h = float4(hash22(param), hash22(param_1));
                if (h.x > _171.uDensity)
                {
                    continue;
                }
                float t = (_171.iTime * (0.800000011920928955078125 + (0.4000000059604644775390625 * h.w))) + (h.y * 30.0);
                float2 centre = (((c + float2(0.5)) + ((h.zw - float2(0.5)) * 0.3499999940395355224609375)) * cs) + (float2(0.2199999988079071044921875 * sin(t * 1.10000002384185791015625), 0.07999999821186065673828125 * sin((t * 2.2000000476837158203125) + 1.0)) * (cs * _171.uFlutter));
                float r = _171.uSize * (0.699999988079071044921875 + (0.5 * h.z));
                float2 rel = pl - centre;
                if (length(rel) > (r * 1.2999999523162841796875))
                {
                    continue;
                }
                float spin = (h.y * 6.28318023681640625) + (_171.uFlutter * ((0.60000002384185791015625 * sin(t * 0.699999988079071044921875)) + ((0.4000000059604644775390625 * t) * (h.z - 0.5))));
                float flip = cos((t * (0.89999997615814208984375 + (_171.uFlutter * h.w))) + (h.x * 6.28318023681640625));
                float2 q = (float2x2(float2(cos(spin), -sin(spin)), float2(sin(spin), cos(spin))) * rel) / float2(r);
                float face = 0.300000011920928955078125 + (0.699999988079071044921875 * abs(flip));
                q.x /= face;
                float2 param_2 = q;
                float inside = ((petal(param_2) * r) * face) / (px / sc);
                float soft = 1.0 + (1.5 * float(l));
                float cover = fast::clamp((inside / soft) + 0.5, 0.0, 1.0);
                if (cover <= 0.0)
                {
                    continue;
                }
                float3 col = mix(_171.uPetalBase, _171.uPetal, float3(smoothstep(-0.89999997615814208984375, 0.100000001490116119384765625, q.y)));
                col *= ((flip > 0.0) ? 1.0 : 0.89999997615814208984375);
                col = mix(col, float3(1.0), float3(0.180000007152557373046875 * float(l)));
                float4 param_3 = acc;
                float3 param_4 = col;
                float param_5 = cover * (1.0 - (0.180000007152557373046875 * float(l)));
                acc = over(param_3, param_4, param_5);
            }
        }
    }
    float4 param_6 = acc;
    fragColor = unpremultiply(param_6);
}

fragment flair_sakura_petals_frag_out flair_sakura_petals_frag(constant FlairUniforms& _171 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_sakura_petals_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _548;
    if (_171.flair_flipY > 0.5)
    {
        _548 = _171.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _548 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _548);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _171);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

