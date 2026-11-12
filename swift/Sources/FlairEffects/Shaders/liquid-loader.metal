// flair-metal-hash: a58d86ad
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
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
    float3 uLiquid;
    float3 uBack;
    packed_float3 uGlass;
    float uSize;
    float uSlosh;
    uint uAnimate;
    float uProgress;
    char _m20_pad[4];
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_liquid_loader_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float fillCycle(thread const float& period, constant FlairUniforms& _102)
{
    float u = fract(_102.iTime / period);
    float f = smoothstep(0.0, 0.7200000286102294921875, u);
    return f * (1.0 - smoothstep(0.86000001430511474609375, 0.980000019073486328125, u));
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float4 finish(thread const float4& acc, constant FlairUniforms& _102)
{
    float4 base = float4(float3(_102.uBackground) * _102.uBackgroundAlpha, _102.uBackgroundAlpha);
    float4 o = float4(acc.xyz + (base.xyz * (1.0 - acc.w)), acc.w + (base.w * (1.0 - acc.w)));
    return float4(o.xyz / float3(fast::max(o.w, 9.9999997473787516355514526367188e-05)), o.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _102)
{
    float px = 1.0 / _102.iResolution[1u];
    float2 p = (fragCoord - (float2(_102.iResolution[0], _102.iResolution[1]) * 0.5)) * px;
    float R = 0.5 * _102.uSize;
    float r = length(p);
    float _208;
    if (_102.uAnimate != 0u)
    {
        float param = 6.0;
        _208 = fillCycle(param, _102);
    }
    else
    {
        _208 = _102.uProgress;
    }
    float level0 = _208;
    float w = 1.0471966266632080078125;
    float y0 = mix((-R) * 1.08000004291534423828125, R * 1.08000004291534423828125, level0);
    float amp = ((R * 0.070000000298023223876953125) * _102.uSlosh) * (0.4000000059604644775390625 + (0.60000002384185791015625 * sin(3.141590118408203125 * level0)));
    float front = (y0 + (amp * sin(((p.x / R) * 5.0) + ((_102.iTime * w) * 6.0)))) + ((amp * 0.5) * sin(((p.x / R) * 9.0) - ((_102.iTime * w) * 4.0)));
    float back = (y0 + ((amp * 1.2000000476837158203125) * sin((((p.x / R) * 4.0) - ((_102.iTime * w) * 5.0)) + 1.2999999523162841796875))) + (R * 0.0199999995529651641845703125);
    float inner = R * 0.87999999523162841796875;
    float inside = smoothstep(inner, inner - px, r);
    float4 acc = float4(0.0);
    float4 param_1 = acc;
    float3 param_2 = float3(_102.uGlass);
    float param_3 = 0.119999997317790985107421875 * inside;
    acc = over(param_1, param_2, param_3);
    float4 param_4 = acc;
    float3 param_5 = _102.uBack;
    float param_6 = smoothstep(px, -px, p.y - back) * inside;
    acc = over(param_4, param_5, param_6);
    float liquid = smoothstep(px, -px, p.y - front) * inside;
    float3 lc = (_102.uLiquid * (0.800000011920928955078125 + (0.25 * smoothstep(-inner, front, p.y)))) + float3(0.3499999940395355224609375 * exp((-abs(p.y - front)) / ((2.0 * px) + 0.0040000001899898052215576171875)));
    float4 param_7 = acc;
    float3 param_8 = lc;
    float param_9 = liquid;
    acc = over(param_7, param_8, param_9);
    for (int i = 0; i < 7; i++)
    {
        float fi = float(i);
        float2 param_10 = float2(fi, 3.099999904632568359375);
        float life = fract(((_102.iTime / 6.0) * (2.0 + mod(fi, 3.0))) + hash12(param_10));
        float2 param_11 = float2(fi, 1.7000000476837158203125);
        float2 b = float2((((hash12(param_11) - 0.5) * inner) * 1.39999997615814208984375) + (0.0199999995529651641845703125 * sin((life * 12.0) + fi)), (-inner) + (life * (front + inner)));
        float2 param_12 = float2(fi, 5.30000019073486328125);
        float br = R * (0.02500000037252902984619140625 + (0.02500000037252902984619140625 * hash12(param_12)));
        float ring = smoothstep(br, br - px, length(p - b)) - (0.60000002384185791015625 * smoothstep(br * 0.699999988079071044921875, (br * 0.699999988079071044921875) - px, length(p - b)));
        float4 param_13 = acc;
        float3 param_14 = float3(1.0);
        float param_15 = ((fast::clamp(ring, 0.0, 1.0) * 0.550000011920928955078125) * liquid) * step(b.y, front - br);
        acc = over(param_13, param_14, param_15);
    }
    float rim = smoothstep(R, R - px, r) - smoothstep(inner + px, inner, r);
    float4 param_16 = acc;
    float3 param_17 = float3(_102.uGlass);
    float param_18 = rim;
    acc = over(param_16, param_17, param_18);
    float shine = (smoothstep(0.01200000010430812835693359375, 0.0, abs(r - (inner * 0.86000001430511474609375))) * smoothstep(0.20000000298023223876953125, 0.75, ((-p.x) / R) + (p.y / R))) * inside;
    float4 param_19 = acc;
    float3 param_20 = float3(1.0);
    float param_21 = shine * 0.449999988079071044921875;
    acc = over(param_19, param_20, param_21);
    float4 param_22 = acc;
    fragColor = finish(param_22, _102);
}

fragment flair_liquid_loader_frag_out flair_liquid_loader_frag(constant FlairUniforms& _102 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_liquid_loader_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _582;
    if (_102.flair_flipY > 0.5)
    {
        _582 = _102.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _582 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _582);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _102);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

