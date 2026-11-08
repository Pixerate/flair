// flair-metal-hash: 95fbd266
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
    packed_float3 uColor2;
    float uSize;
    int uCount;
    float uGoo;
    float uSpeed;
    char _m19_pad[4];
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_metaball_loader_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 finish(thread const float4& acc, constant FlairUniforms& _64)
{
    float4 base = float4(float3(_64.uBackground) * _64.uBackgroundAlpha, _64.uBackgroundAlpha);
    float4 o = float4(acc.xyz + (base.xyz * (1.0 - acc.w)), acc.w + (base.w * (1.0 - acc.w)));
    return float4(o.xyz / float3(fast::max(o.w, 9.9999997473787516355514526367188e-05)), o.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _64)
{
    float px = 1.0 / _64.iResolution[1u];
    float2 p = (fragCoord - (float2(_64.iResolution[0], _64.iResolution[1]) * 0.5)) * px;
    float R = 0.319999992847442626953125 * _64.uSize;
    float t = _64.iTime * _64.uSpeed;
    float field = 0.0;
    float2 grad = float2(0.0);
    float hue = 0.0;
    for (int i = 0; i < 7; i++)
    {
        if (i >= _64.uCount)
        {
            break;
        }
        float fi = float(i);
        float lap = (t * 0.699999988079071044921875) + (fi / float(_64.uCount));
        float ang = 6.28318023681640625 * (lap + (0.119999997317790985107421875 * sin(((6.28318023681640625 * lap) * 1.0) + fi)));
        float2 c = float2(cos(ang), sin(ang)) * R;
        float rb = R * (0.4600000083446502685546875 - ((0.07999999821186065673828125 * fi) / float(_64.uCount)));
        float2 d = p - c;
        float dd = fast::max(dot(d, d), (rb * rb) * 0.0500000007450580596923828125);
        float k = (rb * rb) / dd;
        field += k;
        grad += ((d * ((-2.0) * k)) / float2(dd));
        hue += ((k * fi) / fast::max(float(_64.uCount) - 1.0, 1.0));
    }
    float kc = (((R * 0.300000011920928955078125) * (R * 0.300000011920928955078125)) / fast::max(dot(p, p), 9.9999999747524270787835121154785e-07)) * 0.60000002384185791015625;
    field += kc;
    float thr = 1.0 / _64.uGoo;
    float edge = (field - thr) / fast::max(length(grad), 9.9999997473787516355514526367188e-05);
    float inside = smoothstep(-px, px, edge);
    float3 col = mix(_64.uColor, float3(_64.uColor2), float3(fast::clamp(hue / fast::max(field - kc, 9.9999997473787516355514526367188e-05), 0.0, 1.0)));
    float2 n = -fast::normalize(grad + float2(9.9999999747524270787835121154785e-07));
    float lightSide = dot(n, float2(-0.60000002384185791015625, 0.800000011920928955078125));
    float rim = exp((-fast::max(edge, 0.0)) / 0.02500000037252902984619140625);
    col *= (1.0 - (((0.25 * rim) * (1.0 - lightSide)) * 0.5));
    col += float3(((0.300000011920928955078125 * rim) * smoothstep(0.4000000059604644775390625, 0.949999988079071044921875, lightSide)) * smoothstep(0.0040000001899898052215576171875, 0.01200000010430812835693359375, edge));
    float4 param = float4(0.0);
    float3 param_1 = col;
    float param_2 = inside;
    float4 acc = over(param, param_1, param_2);
    float4 param_3 = acc;
    fragColor = finish(param_3, _64);
}

fragment flair_metaball_loader_frag_out flair_metaball_loader_frag(constant FlairUniforms& _64 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_metaball_loader_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _387;
    if (_64.flair_flipY > 0.5)
    {
        _387 = _64.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _387 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _387);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _64);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

