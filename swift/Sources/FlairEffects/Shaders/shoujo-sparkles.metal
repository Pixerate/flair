// flair-metal-hash: 7a54ade4
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
    float3 uTop;
    packed_float3 uBottom;
    float uBackgroundAlpha;
    float3 uBubble;
    packed_float3 uSparkle;
    float uBubbles;
    float uSparkles;
    float uSpeed;
};

struct flair_shoujo_sparkles_frag_out
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
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float sparkle(thread const float2& d)
{
    float2 a = abs(d);
    float rays = (exp((-a.y) * 60.0) * smoothstep(1.0, 0.0, a.x)) + (exp((-a.x) * 60.0) * smoothstep(1.0, 0.0, a.y));
    float2 e = abs(float2(d.x + d.y, d.x - d.y)) * 0.707099974155426025390625;
    float diag = ((exp((-e.y) * 80.0) * smoothstep(0.4000000059604644775390625, 0.0, e.x)) + (exp((-e.x) * 80.0) * smoothstep(0.4000000059604644775390625, 0.0, e.y))) * 0.60000002384185791015625;
    return fast::clamp((rays + diag) + (0.0199999995529651641845703125 / ((dot(d, d) * 40.0) + 0.0199999995529651641845703125)), 0.0, 1.0);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _200)
{
    float2 uv = fragCoord / float2(_200.iResolution[0], _200.iResolution[1]);
    float2 p = fragCoord / float2(_200.iResolution[1u]);
    float px = 1.0 / _200.iResolution[1u];
    float3 bg = mix(float3(_200.uBottom), _200.uTop, float3(uv.y));
    float4 acc = float4(bg * _200.uBackgroundAlpha, _200.uBackgroundAlpha);
    for (int l = 0; l < 2; l++)
    {
        float cs = (l == 0) ? 0.319999992847442626953125 : 0.180000007152557373046875;
        float2 q = (p + float2(0.0, ((-_200.iTime) * _200.uSpeed) * ((l == 0) ? 0.0500000007450580596923828125 : 0.07999999821186065673828125))) + float2(float(l) * 3.7000000476837158203125);
        float2 cell = floor(q / float2(cs));
        float2 param = cell + float2(11.0 * float(l));
        float2 h = hash22(param);
        if (h.x > _200.uBubbles)
        {
            continue;
        }
        float r = cs * (0.180000007152557373046875 + (0.20000000298023223876953125 * h.y));
        float2 centre = ((cell + float2(0.5)) * cs) + (float2(0.25 * sin((_200.iTime * _200.uSpeed) + (h.y * 6.280000209808349609375)), 0.1500000059604644775390625 * (h.x - 0.5)) * cs);
        float d = length(q - centre);
        float fill = fast::clamp(((r - d) / px) + 0.5, 0.0, 1.0);
        float rim = fast::clamp(1.0 - (abs((d - r) + (1.5 * px)) / (1.2000000476837158203125 * px)), 0.0, 1.0);
        float2 g = (q - centre) - (float2(-0.449999988079071044921875, 0.449999988079071044921875) * r);
        float glint = fast::clamp((((0.180000007152557373046875 * r) - length(g * float2(1.0, 1.7999999523162841796875))) / px) + 0.5, 0.0, 1.0);
        float4 param_1 = acc;
        float3 param_2 = _200.uBubble;
        float param_3 = fill * 0.1599999964237213134765625;
        acc = over(param_1, param_2, param_3);
        float4 param_4 = acc;
        float3 param_5 = _200.uBubble;
        float param_6 = fast::max(rim * 0.699999988079071044921875, glint * 0.85000002384185791015625);
        acc = over(param_4, param_5, param_6);
    }
    for (int l_1 = 0; l_1 < 2; l_1++)
    {
        float cs_1 = (l_1 == 0) ? 0.2199999988079071044921875 : 0.12999999523162841796875;
        float2 q_1 = p + float2(float(l_1) * 9.1000003814697265625);
        float2 cell_1 = floor(q_1 / float2(cs_1));
        float2 param_7 = cell_1 + float2(23.0 * float(l_1));
        float2 param_8 = cell_1 + float2(41.0);
        float4 h_1 = float4(hash22(param_7), hash22(param_8));
        if (h_1.x > _200.uSparkles)
        {
            continue;
        }
        float tw = powr(fast::max(0.0, sin(((_200.iTime * _200.uSpeed) * 2.5) + (h_1.y * 6.280000209808349609375))), 3.0);
        float size = (cs_1 * (0.3499999940395355224609375 + (0.3499999940395355224609375 * h_1.z))) * tw;
        if (size <= 0.0)
        {
            continue;
        }
        float2 centre_1 = ((cell_1 + float2(0.5)) + ((h_1.zw - float2(0.5)) * 0.5)) * cs_1;
        float2 param_9 = (q_1 - centre_1) / float2(size);
        float s = sparkle(param_9);
        float4 param_10 = acc;
        float3 param_11 = float3(_200.uSparkle);
        float param_12 = s;
        acc = over(param_10, param_11, param_12);
    }
    float4 param_13 = acc;
    fragColor = unpremultiply(param_13);
}

fragment flair_shoujo_sparkles_frag_out flair_shoujo_sparkles_frag(constant FlairUniforms& _200 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_shoujo_sparkles_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _559;
    if (_200.flair_flipY > 0.5)
    {
        _559 = _200.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _559 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _559);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _200);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

