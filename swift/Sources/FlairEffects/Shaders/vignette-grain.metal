// flair-metal-hash: d1303ef2
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
    float uStrength;
    float uRoundness;
    float uSoftness;
    float uGrain;
    float uGrainSize;
};

struct flair_vignette_grain_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

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
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _114)
{
    float aspect = _114.iResolution[0u] / _114.iResolution[1u];
    float2 q = abs((fragCoord / float2(_114.iResolution[0], _114.iResolution[1])) - float2(0.5)) * 2.0;
    q.x *= mix(1.0, aspect, _114.uRoundness * 0.5);
    float n = mix(8.0, 2.0, _114.uRoundness);
    float dist = powr(powr(q.x, n) + powr(q.y, n), 1.0 / n);
    float dark = smoothstep(1.25 - (_114.uSoftness * 1.2000000476837158203125), 1.2999999523162841796875, dist) * _114.uStrength;
    float4 param = float4(0.0);
    float3 param_1 = float3(0.0);
    float param_2 = dark;
    float4 acc = over(param, param_1, param_2);
    float frame = mod(floor(_114.iTime * 24.0), 64.0);
    float2 gc = floor(fragCoord / float2(_114.uGrainSize)) + (float2(17.3099994659423828125, 31.729999542236328125) * frame);
    float2 param_3 = gc;
    float2 param_4 = gc + float2(41.700000762939453125);
    float g = ((hash12(param_3) + hash12(param_4)) - 1.0) * 0.5;
    float3 grainCol = select(float3(0.039999999105930328369140625, 0.039999999105930328369140625, 0.0599999986588954925537109375), float3(0.949999988079071044921875, 0.930000007152557373046875, 0.87999999523162841796875), bool3(g > 0.0));
    float4 param_5 = acc;
    float3 param_6 = grainCol;
    float param_7 = (abs(g) * _114.uGrain) * 2.099999904632568359375;
    acc = over(param_5, param_6, param_7);
    float4 param_8 = acc;
    fragColor = unpremultiply(param_8);
}

fragment flair_vignette_grain_frag_out flair_vignette_grain_frag(constant FlairUniforms& _114 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_vignette_grain_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _266;
    if (_114.flair_flipY > 0.5)
    {
        _266 = _114.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _266 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _266);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _114);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

